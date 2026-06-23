import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BusinessException } from '../common/business-exception';
import { ApprovalResult, RequestStatus, RequestType } from '../common/constants';
import { isVisible } from '../common/rbac';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { SummariesService } from '../summaries/summaries.service';
import { computeLeaveMinutes } from '../requests/leave-minutes';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly summaries: SummariesService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** 承認者として処理待ちの承認一覧。scope で対象申請者を絞る。 */
  async pendingFor(
    orgId: string,
    approver: { id: string; deptId?: string | null },
    scope: any,
    accessibleDeptIds: string[] | undefined,
  ) {
    const candidates = await this.prisma.approval.findMany({
      where: {
        result: ApprovalResult.PENDING,
        OR: [{ approverId: null }, { approverId: approver.id }],
        request: { orgId, status: RequestStatus.PENDING },
      },
      include: { request: { include: { user: true, leaveType: true } } },
      orderBy: { request: { createdAt: 'asc' } },
    });
    // 現在ステップのものだけ + 申請者が scope 内 + 自分の申請は除外
    return candidates.filter(
      (a) =>
        a.step === a.request.currentStep &&
        a.request.userId !== approver.id &&
        isVisible(
          scope,
          { userId: approver.id, deptId: approver.deptId, accessibleDeptIds },
          { ownerUserId: a.request.userId, ownerDeptId: a.request.user.deptId },
        ),
    );
  }

  async act(
    orgId: string,
    approver: { id: string; deptId?: string | null },
    scope: any,
    accessibleDeptIds: string[] | undefined,
    approvalId: string,
    input: { result: 'approved' | 'rejected'; comment?: string },
  ) {
    const approval = await this.prisma.approval.findUnique({
      where: { id: approvalId },
      include: { request: { include: { user: true } } },
    });
    if (!approval || approval.request.orgId !== orgId) {
      throw BusinessException.notFound('承認対象が見つかりません');
    }
    const req = approval.request;

    if (req.status !== RequestStatus.PENDING || approval.result !== ApprovalResult.PENDING) {
      throw BusinessException.conflict('already_processed', '既に処理済みです');
    }
    if (approval.step !== req.currentStep) {
      throw BusinessException.conflict(
        'already_processed',
        'このステップは現在の承認対象ではありません',
      );
    }
    // 承認者資格：approverId 指定があれば一致、無ければ scope で申請者が見えること
    if (approval.approverId && approval.approverId !== approver.id) {
      throw BusinessException.forbidden(
        'not_approver',
        'あなたはこのステップの承認者ではありません',
      );
    }
    const canSee = isVisible(
      scope,
      { userId: approver.id, deptId: approver.deptId, accessibleDeptIds },
      { ownerUserId: req.userId, ownerDeptId: req.user.deptId },
    );
    if (!approval.approverId && !canSee) {
      throw BusinessException.forbidden('not_approver', 'この申請を承認する権限がありません');
    }
    if (input.result === 'rejected' && !input.comment?.trim()) {
      throw BusinessException.validation('差戻しにはコメントが必須です', [
        { field: 'comment', reason: 'required' },
      ]);
    }

    const totalSteps = await this.prisma.approval.count({ where: { requestId: req.id } });

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.approval.update({
        where: { id: approvalId },
        data: {
          result: input.result,
          approverId: approver.id,
          comment: input.comment,
          actedAt: new Date(),
        },
      });

      if (input.result === 'rejected') {
        await tx.request.update({
          where: { id: req.id },
          data: { status: RequestStatus.REJECTED },
        });
        await this.notifications.notify(req.userId, 'request.rejected', { requestId: req.id }, tx);
      } else if (approval.step >= totalSteps) {
        // 最終承認 → 反映
        await tx.request.update({
          where: { id: req.id },
          data: { status: RequestStatus.APPROVED },
        });
        await this.applyEffects(tx, req);
        await this.notifications.notify(req.userId, 'request.approved', { requestId: req.id }, tx);
      } else {
        await tx.request.update({
          where: { id: req.id },
          data: { currentStep: approval.step + 1 },
        });
      }

      await this.audit.record({
        orgId,
        actorId: approver.id,
        action: `approval.${input.result}`,
        target: req.id,
        detail: { step: approval.step },
        tx,
      });

      return tx.request.findUnique({
        where: { id: req.id },
        include: { approvals: { orderBy: { step: 'asc' } } },
      });
    });

    // punch_fix の集計再計算（トランザクション外で実行）
    if (
      input.result === 'approved' &&
      approval.step >= totalSteps &&
      req.type === RequestType.PUNCH_FIX
    ) {
      const dateStr = (req.payload as any)?.target_date;
      if (dateStr) await this.summaries.recompute(req.userId, new Date(dateStr));
    }

    return result;
  }

  /** 承認確定時の種別別反映。 */
  private async applyEffects(tx: Prisma.TransactionClient, req: any) {
    if (req.type === RequestType.PUNCH_FIX) {
      const fixes: any[] = req.payload?.fix ?? [];
      for (const f of fixes) {
        await tx.timeRecord.create({
          data: {
            userId: req.userId,
            punchType: f.punch_type,
            punchedAt: new Date(f.punched_at),
            source: 'web',
            isCorrected: true,
            requestId: req.id,
          },
        });
      }
    } else if (req.type === RequestType.LEAVE && req.leaveTypeId) {
      const leaveType = await tx.leaveType.findUnique({ where: { id: req.leaveTypeId } });
      if (leaveType?.paid) {
        const minutes = computeLeaveMinutes(req.payload ?? {}, leaveType.unit);
        // 期限が近い残数から消化
        const balances = await tx.leaveBalance.findMany({
          where: { userId: req.userId, leaveTypeId: req.leaveTypeId },
          orderBy: { expiresOn: 'asc' },
        });
        let remaining = minutes;
        for (const b of balances) {
          if (remaining <= 0) break;
          const avail = b.grantedMinutes - b.usedMinutes;
          if (avail <= 0) continue;
          const consume = Math.min(avail, remaining);
          await tx.leaveBalance.update({
            where: { id: b.id },
            data: { usedMinutes: b.usedMinutes + consume },
          });
          remaining -= consume;
        }
        // 残数が無くても消化記録は申請承認済みとして残す（マイナスにはしない）
      }
    }
  }
}
