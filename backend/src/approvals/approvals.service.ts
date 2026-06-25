import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BusinessException } from '../common/business-exception';
import { ApprovalResult, RequestStatus, RequestType } from '../common/constants';
import { isVisible } from '../common/rbac';
import { AuditService } from '../audit/audit.service';
import { ApprovalRoutingService } from '../approval-routes/approval-routing.service';
import { decideStep } from '../approval-routes/approval-routing';
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
    private readonly routing: ApprovalRoutingService,
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
    // 自己承認はルートで明示許可されていない限り不可
    const plan = await this.routing.resolvePlan(orgId, req.type);
    if (!plan.allowSelfApprove && approver.id === req.userId) {
      throw BusinessException.forbidden('not_approver', '自分の申請は承認できません');
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
    const { request, finalized } = await this.recordDecision({
      orgId,
      req,
      approval,
      totalSteps,
      result: input.result,
      actorId: approver.id,
      comment: input.comment,
    });

    if (input.result === 'approved') {
      if (finalized) {
        await this.recomputeIfPunchFix(req); // 集計再計算（トランザクション外）
      } else {
        // 後続に承認者不在のステップがあればポリシーに従って前進させる
        await this.autoResolve(orgId, req.id);
        return this.getRequestView(req.id);
      }
    }
    return request;
  }

  /**
   * 承認経路の自動解決。現在ステップの承認者を解決し、1人もいなければ
   * ルートの onNoApprover に従って自動承認で前進させる（多段にも対応）。
   * pending（人間が承認）または block に達したら停止する。
   * 申請作成直後と、各ステップ承認後に呼ばれる。
   */
  async autoResolve(orgId: string, requestId: string): Promise<void> {
    for (let guard = 0; guard < 100; guard++) {
      const req = await this.prisma.request.findUnique({
        where: { id: requestId },
        include: { user: true },
      });
      if (!req || req.status !== RequestStatus.PENDING) return;

      const approval = await this.prisma.approval.findFirst({
        where: { requestId, step: req.currentStep },
      });
      if (!approval || approval.result !== ApprovalResult.PENDING) return;

      const plan = await this.routing.resolvePlan(orgId, req.type);
      const stepDesc = plan.steps.find((s) => s.step === approval.step) ?? {
        step: approval.step,
        approverType: 'scope',
        approverRef: null,
      };
      const { ids } = await this.routing.candidateApprovers(orgId, stepDesc, {
        userId: req.userId,
        deptId: req.user.deptId,
      });
      const decision = decideStep({
        candidateIds: ids,
        applicantId: req.userId,
        allowSelfApprove: plan.allowSelfApprove,
        onNoApprover: plan.onNoApprover,
      });
      if (decision.resolution !== 'auto_approve') return; // pending / block はここで停止

      const totalSteps = await this.prisma.approval.count({ where: { requestId } });
      const { finalized } = await this.recordDecision({
        orgId,
        req,
        approval,
        totalSteps,
        result: 'approved',
        actorId: null,
        comment: '承認者不在のため自動承認',
        auto: true,
      });
      if (finalized) {
        await this.recomputeIfPunchFix(req);
        return;
      }
    }
  }

  /** 1ステップの承認/差戻しを記録し、ステータス遷移・反映・監査・通知を行う共通処理。 */
  private async recordDecision(params: {
    orgId: string;
    req: any;
    approval: { id: string; step: number };
    totalSteps: number;
    result: 'approved' | 'rejected';
    actorId: string | null;
    comment?: string;
    auto?: boolean;
  }): Promise<{ request: any; finalized: boolean }> {
    const { orgId, req, approval, totalSteps, result, actorId, comment, auto } = params;
    const finalized = result === 'approved' && approval.step >= totalSteps;

    const request = await this.prisma.$transaction(async (tx) => {
      await tx.approval.update({
        where: { id: approval.id },
        data: { result, approverId: actorId, comment, actedAt: new Date() },
      });

      if (result === 'rejected') {
        await tx.request.update({
          where: { id: req.id },
          data: { status: RequestStatus.REJECTED },
        });
        await this.notifications.notify(req.userId, 'request.rejected', { requestId: req.id }, tx);
      } else if (finalized) {
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
        actorId,
        action: auto ? 'approval.auto_approved' : `approval.${result}`,
        target: req.id,
        detail: { step: approval.step },
        tx,
      });

      return tx.request.findUnique({
        where: { id: req.id },
        include: { approvals: { orderBy: { step: 'asc' } } },
      });
    });
    return { request, finalized };
  }

  /** punch_fix の対象日を再集計（トランザクション外で実行）。 */
  private async recomputeIfPunchFix(req: any) {
    if (req.type !== RequestType.PUNCH_FIX) return;
    const dateStr = (req.payload as any)?.target_date;
    if (dateStr) await this.summaries.recompute(req.userId, new Date(dateStr));
  }

  /** 申請の現在状態（承認ステップ込み）を取得。 */
  private getRequestView(requestId: string) {
    return this.prisma.request.findUnique({
      where: { id: requestId },
      include: { approvals: { orderBy: { step: 'asc' } } },
    });
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
