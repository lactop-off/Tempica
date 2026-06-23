import { Injectable } from '@nestjs/common';
import { BusinessException } from '../common/business-exception';
import { CloseStatus, RequestStatus } from '../common/constants';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { SummariesService } from '../summaries/summaries.service';

function periodRange(period: string): { from: Date; to: Date } {
  const from = new Date(`${period}-01T00:00:00`);
  const to = new Date(from);
  to.setMonth(to.getMonth() + 1);
  return { from, to };
}

@Injectable()
export class ClosingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly summaries: SummariesService,
    private readonly audit: AuditService,
  ) {}

  private async orgUserIds(orgId: string): Promise<string[]> {
    const users = await this.prisma.appUser.findMany({ where: { orgId }, select: { id: true } });
    return users.map((u) => u.id);
  }

  /** 事前チェック：未承認申請・未確定（open）日次の件数を集計。 */
  async precheck(orgId: string, period: string) {
    const { from, to } = periodRange(period);
    const userIds = await this.orgUserIds(orgId);

    const pendingRequests = await this.prisma.request.count({
      where: { orgId, status: RequestStatus.PENDING },
    });
    const openSummaries = await this.prisma.dailySummary.count({
      where: { userId: { in: userIds }, workDate: { gte: from, lt: to }, status: CloseStatus.OPEN },
    });
    const close = await this.prisma.monthlyClose.findUnique({
      where: { orgId_period: { orgId, period } },
    });

    const warnings: string[] = [];
    if (pendingRequests > 0) warnings.push(`未承認の申請が${pendingRequests}件あります`);

    return {
      period,
      status: close?.status ?? CloseStatus.OPEN,
      pendingRequests,
      openSummaries,
      warnings,
    };
  }

  async close(orgId: string, actorId: string, period: string) {
    const existing = await this.prisma.monthlyClose.findUnique({
      where: { orgId_period: { orgId, period } },
    });
    if (existing?.status === CloseStatus.CLOSED) {
      throw BusinessException.conflict('already_processed', '既に締め済みです');
    }
    const { from, to } = periodRange(period);
    const userIds = await this.orgUserIds(orgId);
    const pre = await this.precheck(orgId, period);

    // 期間内の open な日次集計を再計算してから closed 化
    const open = await this.prisma.dailySummary.findMany({
      where: { userId: { in: userIds }, workDate: { gte: from, lt: to }, status: CloseStatus.OPEN },
    });
    for (const s of open) {
      await this.summaries.recompute(s.userId, s.workDate);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.dailySummary.updateMany({
        where: { userId: { in: userIds }, workDate: { gte: from, lt: to } },
        data: { status: CloseStatus.CLOSED },
      });
      await tx.monthlyClose.upsert({
        where: { orgId_period: { orgId, period } },
        create: {
          orgId,
          period,
          status: CloseStatus.CLOSED,
          closedBy: actorId,
          closedAt: new Date(),
        },
        update: { status: CloseStatus.CLOSED, closedBy: actorId, closedAt: new Date() },
      });
      await this.audit.record({
        orgId,
        actorId,
        action: 'closing.close',
        target: period,
        detail: { pendingRequests: pre.pendingRequests },
        tx,
      });
    });

    const close = await this.prisma.monthlyClose.findUnique({
      where: { orgId_period: { orgId, period } },
    });
    return { period, status: close!.status, warnings: pre.warnings };
  }

  async reopen(orgId: string, actorId: string, id: string) {
    const close = await this.prisma.monthlyClose.findUnique({ where: { id } });
    if (!close || close.orgId !== orgId)
      throw BusinessException.notFound('締めデータが見つかりません');
    const { from, to } = periodRange(close.period);
    const userIds = await this.orgUserIds(orgId);

    await this.prisma.$transaction(async (tx) => {
      await tx.dailySummary.updateMany({
        where: { userId: { in: userIds }, workDate: { gte: from, lt: to } },
        data: { status: CloseStatus.OPEN },
      });
      await tx.monthlyClose.update({
        where: { id },
        data: { status: CloseStatus.OPEN, closedBy: null, closedAt: null },
      });
      await this.audit.record({
        orgId,
        actorId,
        action: 'closing.reopen',
        target: close.period,
        tx,
      });
    });
    return { period: close.period, status: CloseStatus.OPEN };
  }
}
