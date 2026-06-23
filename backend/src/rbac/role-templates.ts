import { Action, Feature, Permission, Scope } from '../common/constants';

const p = (feature: Feature, action: Action, scope: Scope): Permission => ({
  feature,
  action,
  scope,
});

/**
 * 設計書 6.2「標準ロールの初期権限（テンプレート）」に対応する初期権限セット。
 * 各組織はこれを複製・調整して使う（カスタム RBAC）。
 */
export interface RoleTemplate {
  name: string;
  permissions: Permission[];
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    name: '一般従業員',
    permissions: [
      p(Feature.ATTENDANCE, Action.CREATE, 'self'), // 打刻
      p(Feature.ATTENDANCE, Action.VIEW, 'self'),
      p(Feature.REQUEST, Action.CREATE, 'self'),
      p(Feature.REQUEST, Action.VIEW, 'self'),
      p(Feature.LEAVE, Action.VIEW, 'self'),
      p(Feature.SHIFT, Action.VIEW, 'self'),
      p(Feature.SHIFT, Action.CREATE, 'self'), // 希望提出
      p(Feature.REPORT, Action.VIEW, 'self'),
      p(Feature.NOTIFICATION, Action.VIEW, 'self'),
    ],
  },
  {
    name: '現場管理者',
    permissions: [
      p(Feature.ATTENDANCE, Action.CREATE, 'self'),
      p(Feature.ATTENDANCE, Action.VIEW, 'department'),
      p(Feature.REQUEST, Action.CREATE, 'self'),
      p(Feature.REQUEST, Action.VIEW, 'department'),
      p(Feature.APPROVAL, Action.APPROVE, 'department'),
      p(Feature.APPROVAL, Action.VIEW, 'department'),
      p(Feature.SHIFT, Action.VIEW, 'department'),
      p(Feature.SHIFT, Action.EDIT, 'department'), // シフト編成
      p(Feature.LEAVE, Action.VIEW, 'department'),
      p(Feature.REPORT, Action.VIEW, 'department'),
      p(Feature.NOTIFICATION, Action.VIEW, 'self'),
    ],
  },
  {
    name: '人事・労務',
    permissions: [
      p(Feature.ATTENDANCE, Action.CREATE, 'self'),
      p(Feature.ATTENDANCE, Action.VIEW, 'org'),
      p(Feature.ATTENDANCE, Action.EDIT, 'org'),
      p(Feature.REQUEST, Action.CREATE, 'self'),
      p(Feature.REQUEST, Action.VIEW, 'org'),
      p(Feature.APPROVAL, Action.APPROVE, 'org'),
      p(Feature.APPROVAL, Action.VIEW, 'org'),
      p(Feature.SHIFT, Action.VIEW, 'org'),
      p(Feature.SHIFT, Action.EDIT, 'org'),
      p(Feature.MEMBER, Action.VIEW, 'org'),
      p(Feature.MEMBER, Action.CREATE, 'org'),
      p(Feature.MEMBER, Action.EDIT, 'org'),
      p(Feature.DEPARTMENT, Action.VIEW, 'org'),
      p(Feature.DEPARTMENT, Action.MANAGE, 'org'),
      p(Feature.ORGANIZATION, Action.VIEW, 'org'),
      p(Feature.ORGANIZATION, Action.MANAGE, 'org'),
      p(Feature.WORK_PATTERN, Action.VIEW, 'org'),
      p(Feature.WORK_PATTERN, Action.MANAGE, 'org'),
      p(Feature.LEAVE, Action.VIEW, 'org'),
      p(Feature.LEAVE, Action.MANAGE, 'org'),
      p(Feature.CLOSING, Action.MANAGE, 'org'),
      p(Feature.CSV, Action.MANAGE, 'org'),
      p(Feature.REPORT, Action.VIEW, 'org'),
      p(Feature.NOTIFICATION, Action.VIEW, 'self'),
    ],
  },
  {
    name: '経営層',
    permissions: [
      p(Feature.ATTENDANCE, Action.CREATE, 'self'),
      p(Feature.ATTENDANCE, Action.VIEW, 'org'),
      p(Feature.REPORT, Action.VIEW, 'org'),
      p(Feature.NOTIFICATION, Action.VIEW, 'self'),
    ],
  },
  {
    name: 'システム管理者',
    permissions: [
      p(Feature.ATTENDANCE, Action.CREATE, 'self'),
      p(Feature.ATTENDANCE, Action.VIEW, 'org'),
      p(Feature.ATTENDANCE, Action.EDIT, 'org'),
      p(Feature.REQUEST, Action.CREATE, 'self'),
      p(Feature.REQUEST, Action.VIEW, 'org'),
      p(Feature.APPROVAL, Action.APPROVE, 'org'),
      p(Feature.APPROVAL, Action.VIEW, 'org'),
      p(Feature.SHIFT, Action.VIEW, 'org'),
      p(Feature.SHIFT, Action.EDIT, 'org'),
      p(Feature.MEMBER, Action.VIEW, 'org'),
      p(Feature.MEMBER, Action.CREATE, 'org'),
      p(Feature.MEMBER, Action.EDIT, 'org'),
      p(Feature.DEPARTMENT, Action.VIEW, 'org'),
      p(Feature.DEPARTMENT, Action.MANAGE, 'org'),
      p(Feature.ORGANIZATION, Action.VIEW, 'org'),
      p(Feature.ORGANIZATION, Action.MANAGE, 'org'),
      p(Feature.WORK_PATTERN, Action.VIEW, 'org'),
      p(Feature.WORK_PATTERN, Action.MANAGE, 'org'),
      p(Feature.LEAVE, Action.VIEW, 'org'),
      p(Feature.LEAVE, Action.MANAGE, 'org'),
      p(Feature.CLOSING, Action.MANAGE, 'org'),
      p(Feature.CSV, Action.MANAGE, 'org'),
      p(Feature.REPORT, Action.VIEW, 'org'),
      p(Feature.ROLE, Action.VIEW, 'org'),
      p(Feature.ROLE, Action.MANAGE, 'org'), // ロール・権限設定（管理権限）
      p(Feature.AUDIT, Action.VIEW, 'org'),
      p(Feature.NOTIFICATION, Action.VIEW, 'self'),
    ],
  },
];

/** システム管理者テンプレートの権限（初期セットアップの初期管理者に付与）。 */
export function adminPermissions(): Permission[] {
  return ROLE_TEMPLATES.find((r) => r.name === 'システム管理者')!.permissions;
}
