import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BusinessException } from '../common/business-exception';
import { Scope } from '../common/constants';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export interface ListScope {
  scope: Scope;
  accessibleDeptIds?: string[];
}

/** 2つの期間 [s1,e1] [s2,e2]（end は null=無限）が重なるか。 */
export function periodsOverlap(s1: Date, e1: Date | null, s2: Date, e2: Date | null): boolean {
  const end1 = e1 ? e1.getTime() : Infinity;
  const end2 = e2 ? e2.getTime() : Infinity;
  return s1.getTime() <= end2 && s2.getTime() <= end1;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** scope に応じた app_user 検索条件を組み立てる。 */
  buildScopeWhere(orgId: string, actorUserId: string, ls: ListScope): Prisma.AppUserWhereInput {
    const base: Prisma.AppUserWhereInput = { orgId };
    if (ls.scope === 'org') return base;
    if (ls.scope === 'self') return { ...base, id: actorUserId };
    // department / location: アクセス可能部署 + 自分
    return {
      ...base,
      OR: [{ id: actorUserId }, { deptId: { in: ls.accessibleDeptIds ?? [] } }],
    };
  }

  async assertSameOrg(orgId: string, userId: string) {
    const u = await this.prisma.appUser.findUnique({ where: { id: userId } });
    if (!u || u.orgId !== orgId) throw BusinessException.notFound('ユーザーが見つかりません');
    return u;
  }

  /**
   * 勤務形態の個人割当を追加する。
   * - 終了日 >= 開始日
   * - 同一ユーザーの期間重複を禁止（アプリ事前検証 + DB EXCLUDE が最終防衛線）
   */
  async assignWorkPattern(
    orgId: string,
    actorId: string,
    userId: string,
    input: { workPatternId: string; startDate: string; endDate?: string | null },
  ) {
    await this.assertSameOrg(orgId, userId);
    const pattern = await this.prisma.workPattern.findUnique({
      where: { id: input.workPatternId },
    });
    if (!pattern || pattern.orgId !== orgId) {
      throw BusinessException.notFound('勤務形態が見つかりません');
    }
    const start = new Date(input.startDate);
    const end = input.endDate ? new Date(input.endDate) : null;
    if (end && end.getTime() < start.getTime()) {
      throw BusinessException.validation('終了日は開始日以降にしてください', [
        { field: 'endDate', reason: 'end_before_start' },
      ]);
    }

    const existing = await this.prisma.userWorkPattern.findMany({ where: { userId } });
    for (const e of existing) {
      if (periodsOverlap(start, end, e.startDate, e.endDate)) {
        throw BusinessException.conflict('overlap', '割当期間が他の割当と重複しています', [
          { field: 'startDate', reason: 'overlap' },
        ]);
      }
    }

    const created = await this.prisma.userWorkPattern.create({
      data: { userId, workPatternId: input.workPatternId, startDate: start, endDate: end },
    });
    await this.audit.record({
      orgId,
      actorId,
      action: 'user.assignWorkPattern',
      target: userId,
      detail: {
        workPatternId: input.workPatternId,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
      },
    });
    return created;
  }
}
