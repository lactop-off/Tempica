import { Permission, Scope, SCOPE_RANK } from './constants';

/**
 * カスタム RBAC のコアロジック（純粋関数）。
 * 「1権限 = 機能(feature) × 操作(action) × データ範囲(scope)」を評価する。
 */

/**
 * 指定 feature×action に対してユーザーが持つ最も広い scope を返す。
 * 権限が無ければ null。
 */
export function resolveScope(
  permissions: Permission[],
  feature: string,
  action: string,
): Scope | null {
  let best: Scope | null = null;
  for (const p of permissions) {
    if (p.feature === feature && p.action === action) {
      if (best === null || SCOPE_RANK[p.scope] > SCOPE_RANK[best]) {
        best = p.scope;
      }
    }
  }
  return best;
}

export function hasPermission(permissions: Permission[], feature: string, action: string): boolean {
  return resolveScope(permissions, feature, action) !== null;
}

export interface SubjectContext {
  /** 操作対象データの所有ユーザー */
  ownerUserId: string;
  /** 操作対象データの所属部署 */
  ownerDeptId?: string | null;
}

export interface ActorContext {
  userId: string;
  deptId?: string | null;
  /** location/department スコープで閲覧可能な部署 ID 群（部署ツリーを解決済み） */
  accessibleDeptIds?: string[];
}

/**
 * 与えられた scope の下で、actor が subject のデータにアクセスできるか判定する。
 * org スコープは同一組織内すべて許可（呼び出し側で org の一致を保証する前提）。
 */
export function isVisible(scope: Scope, actor: ActorContext, subject: SubjectContext): boolean {
  switch (scope) {
    case 'org':
      return true;
    case 'location':
    case 'department': {
      if (subject.ownerUserId === actor.userId) return true; // 自分は常に可
      if (!subject.ownerDeptId) return false;
      const ids = actor.accessibleDeptIds ?? (actor.deptId ? [actor.deptId] : []);
      return ids.includes(subject.ownerDeptId);
    }
    case 'self':
    default:
      return subject.ownerUserId === actor.userId;
  }
}

/** 複数権限セットをマージ（ユーザーが複数ロールを保有する場合）。 */
export function mergePermissions(...sets: Permission[][]): Permission[] {
  return sets.flat();
}
