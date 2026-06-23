import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BusinessException } from '../common/business-exception';
import { CloseStatus, RequestStatus, RequestType } from '../common/constants';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { computeLeaveMinutes } from './leave-minutes';

interface ApprovalStep {
  step: number;
  approverId: string | null;
}

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** payload から対象日（YYYY-MM-DD）を抽出。 */
  private targetDate(payload: Record<string, any>): string | null {
    return payload?.target_date ?? payload?.date ?? payload?.from ?? null;
  }

  /** 対象日が締め済みなら 422 period_closed。 */
  private async assertNotClosed(orgId: string, dateStr: string | null) {
    if (!dateStr) return;
    const period = dateStr.slice(0, 7); // YYYY-MM
    const close = await this.prisma.monthlyClose.findUnique({
      where: { orgId_period: { orgId, period } },
    });
    if (close?.status === CloseStatus.CLOSED) {
      throw BusinessException.validation('対象日は締め済みです', [
        { field: 'payload.target_date', reason: 'period_closed' },
      ]);
    }
  }

  /** 承認経路を解決してステップ配列を返す（無ければ単一ステップ）。 */
  private async resolveSteps(orgId: string, type: string): Promise<ApprovalStep[]> {
    const route = await this.prisma.approvalRoute.findFirst({
      where: { orgId, OR: [{ appliesTo: type }, { appliesTo: 'all' }] },
      orderBy: { appliesTo: 'asc' }, // 'all' より具体的な type を優先
    });
    const steps = (route?.steps as unknown as any[]) ?? [];
    if (!Array.isArray(steps) || steps.length === 0) {
      return [{ step: 1, approverId: null }];
    }
    return steps.map((s, i) => ({
      step: s.step ?? i + 1,
      approverId: s.approver_type === 'user' ? (s.approver_ref ?? null) : null,
    }));
  }

  async create(
    orgId: string,
    userId: string,
    dto: { type: string; leaveTypeId?: string; payload: Record<string, any> },
  ) {
    const warnings: string[] = [];
    await this.assertNotClosed(orgId, this.targetDate(dto.payload));

    // 休暇は残数超過を警告（ブロックはしない）
    if (dto.type === RequestType.LEAVE) {
      if (!dto.leaveTypeId) {
        throw BusinessException.validation('休暇種別を指定してください', [
          { field: 'leaveTypeId', reason: 'required' },
        ]);
      }
      const leaveType = await this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
      if (!leaveType || leaveType.orgId !== orgId) {
        throw BusinessException.notFound('休暇種別が見つかりません');
      }
      const requested = computeLeaveMinutes(dto.payload, leaveType.unit);
      const balances = await this.prisma.leaveBalance.findMany({
        where: { userId, leaveTypeId: dto.leaveTypeId },
      });
      const remaining = balances.reduce((s, b) => s + (b.grantedMinutes - b.usedMinutes), 0);
      if (leaveType.paid && requested > remaining) {
        warnings.push('休暇残数を超える申請です');
      }
    }

    const steps = await this.resolveSteps(orgId, dto.type);

    const request = await this.prisma.$transaction(async (tx) => {
      const req = await tx.request.create({
        data: {
          orgId,
          userId,
          type: dto.type,
          status: RequestStatus.PENDING,
          leaveTypeId: dto.leaveTypeId,
          payload: dto.payload as Prisma.InputJsonValue,
          currentStep: 1,
        },
      });
      await tx.approval.createMany({
        data: steps.map((s) => ({ requestId: req.id, step: s.step, approverId: s.approverId })),
      });
      await this.audit.record({
        orgId,
        actorId: userId,
        action: 'request.create',
        target: req.id,
        detail: { type: dto.type },
        tx,
      });
      return req;
    });

    return { ...request, warnings };
  }

  async listForUser(orgId: string, userId: string, status?: string) {
    return this.prisma.request.findMany({
      where: { orgId, userId, status: status as any },
      include: { approvals: { orderBy: { step: 'asc' } }, leaveType: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancel(orgId: string, userId: string, requestId: string) {
    const req = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!req || req.orgId !== orgId) throw BusinessException.notFound('申請が見つかりません');
    if (req.userId !== userId)
      throw BusinessException.forbidden('forbidden', '自分の申請のみ取消できます');
    if (req.status !== RequestStatus.PENDING) {
      throw BusinessException.conflict('already_processed', '処理済みの申請は取消できません');
    }
    const updated = await this.prisma.request.update({
      where: { id: requestId },
      data: { status: RequestStatus.CANCELED },
    });
    await this.audit.record({
      orgId,
      actorId: userId,
      action: 'request.cancel',
      target: requestId,
    });
    return updated;
  }
}
