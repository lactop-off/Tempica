import { Injectable } from '@nestjs/common';
import { Permission, Scope } from '../common/constants';
import { PrismaService } from '../prisma/prisma.service';
import { resolveScope } from '../common/rbac';

/**
 * ユーザーの権限ロード・scope 解決・アクセス可能部署の算出を担う。
 * 部署ツリーを解決して location/department スコープのデータ範囲を提供する。
 */
@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  /** ユーザーの全ロールの権限をマージして返す。 */
  async getPermissions(userId: string): Promise<Permission[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { permissions: true } } },
    });
    const perms: Permission[] = [];
    for (const r of rows) {
      const list = (r.role.permissions as unknown as Permission[]) ?? [];
      if (Array.isArray(list)) perms.push(...list);
    }
    return perms;
  }

  /** feature×action に対する最も広い scope（無ければ null）。 */
  async resolveScope(userId: string, feature: string, action: string): Promise<Scope | null> {
    const perms = await this.getPermissions(userId);
    return resolveScope(perms, feature, action);
  }

  /**
   * scope に応じてユーザーが閲覧可能な部署 ID 群を返す。
   * - org: 組織内全部署
   * - location/department: 自部署とその子孫（部署ツリー）
   * - self: 空（本人のみ）
   */
  async accessibleDeptIds(
    orgId: string,
    actorDeptId: string | null | undefined,
    scope: Scope,
  ): Promise<string[]> {
    if (scope === 'self') return [];
    const all = await this.prisma.department.findMany({
      where: { orgId },
      select: { id: true, parentId: true },
    });
    if (scope === 'org') return all.map((d) => d.id);
    if (!actorDeptId) return [];

    // location/department: 自部署を起点に子孫を辿る
    const childrenByParent = new Map<string, string[]>();
    for (const d of all) {
      if (d.parentId) {
        const arr = childrenByParent.get(d.parentId) ?? [];
        arr.push(d.id);
        childrenByParent.set(d.parentId, arr);
      }
    }
    const result: string[] = [];
    const stack = [actorDeptId];
    const seen = new Set<string>();
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      result.push(id);
      for (const c of childrenByParent.get(id) ?? []) stack.push(c);
    }
    return result;
  }

  /** 組織内で「管理権限（role manage を org スコープで保持）」を持つユーザー数を数える。 */
  async countAdmins(orgId: string): Promise<number> {
    const users = await this.prisma.appUser.findMany({
      where: { orgId, status: 'active' },
      select: { id: true, roles: { select: { role: { select: { permissions: true } } } } },
    });
    let count = 0;
    for (const u of users) {
      const perms: Permission[] = [];
      for (const r of u.roles) {
        const list = (r.role.permissions as unknown as Permission[]) ?? [];
        if (Array.isArray(list)) perms.push(...list);
      }
      if (resolveScope(perms, 'role', 'manage') === 'org') count++;
    }
    return count;
  }
}
