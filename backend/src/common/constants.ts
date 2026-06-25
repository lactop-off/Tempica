// 業務ドメインで使用する定数・列挙の集約。
// 設計書のステータス類（VARCHAR + コメント）に対応する値をここで一元管理する。

/** RBAC: 機能（feature）。1権限 = 機能 × 操作 × データ範囲。 */
export const Feature = {
  ORGANIZATION: 'organization',
  DEPARTMENT: 'department',
  MEMBER: 'member',
  ROLE: 'role',
  WORK_PATTERN: 'work_pattern',
  ATTENDANCE: 'attendance',
  REQUEST: 'request',
  APPROVAL: 'approval',
  LEAVE: 'leave',
  SHIFT: 'shift',
  CLOSING: 'closing',
  CSV: 'csv',
  REPORT: 'report',
  AUDIT: 'audit',
  NOTIFICATION: 'notification',
} as const;
export type Feature = (typeof Feature)[keyof typeof Feature];

/** RBAC: 操作（action）。 */
export const Action = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  APPROVE: 'approve',
  MANAGE: 'manage', // 設定・管理操作
} as const;
export type Action = (typeof Action)[keyof typeof Action];

/** RBAC: データ範囲（scope）。広い順に org > location > department > self。 */
export const Scope = {
  SELF: 'self',
  DEPARTMENT: 'department',
  LOCATION: 'location',
  ORG: 'org',
} as const;
export type Scope = (typeof Scope)[keyof typeof Scope];

/** scope の広さ（大きいほど広い）。データ範囲解決に使用。 */
export const SCOPE_RANK: Record<Scope, number> = {
  self: 0,
  department: 1,
  location: 2,
  org: 3,
};

export interface Permission {
  feature: string;
  action: string;
  scope: Scope;
}

/** 打刻種別。 */
export const PunchType = {
  CLOCK_IN: 'clock_in',
  CLOCK_OUT: 'clock_out',
  BREAK_START: 'break_start',
  BREAK_END: 'break_end',
} as const;
export type PunchType = (typeof PunchType)[keyof typeof PunchType];

/** 申請種別。 */
export const RequestType = {
  PUNCH_FIX: 'punch_fix',
  OVERTIME: 'overtime',
  LATE_EARLY: 'late_early',
  LEAVE: 'leave',
  DIRECT: 'direct',
  BUSINESS_TRIP: 'business_trip',
} as const;
export type RequestType = (typeof RequestType)[keyof typeof RequestType];

export const RequestStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELED: 'canceled',
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export const ApprovalResult = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

/** 承認経路ステップの承認者タイプ。固定（user/部署長）か動的（scope）かを表す。 */
export const ApproverType = {
  USER: 'user', // 特定個人（approver_ref = userId）
  DEPARTMENT_MANAGER: 'department_manager', // 申請者の所属部署の部署長
  MANAGER_OF_APPLICANT: 'manager_of_applicant', // 申請者の上長（最小実装では所属部署長と同義）
  SCOPE: 'scope', // scope で申請者が見える承認者なら誰でも（既定）
} as const;
export type ApproverType = (typeof ApproverType)[keyof typeof ApproverType];

/** 承認者が1人も解決できないステップの終端ポリシー。 */
export const NoApproverPolicy = {
  AUTO_APPROVE: 'auto_approve', // 監査記録の上で自動承認
  BLOCK: 'block', // 申請を受け付けない（422）
} as const;
export type NoApproverPolicy = (typeof NoApproverPolicy)[keyof typeof NoApproverPolicy];

export const WorkPatternType = {
  FIXED: 'fixed',
  FLEX: 'flex',
  VARIABLE_MONTH: 'variable_month',
  SHIFT: 'shift',
} as const;

export const RoundingMethod = {
  NONE: 'none',
  UP: 'up',
  DOWN: 'down',
  NEAREST: 'nearest',
} as const;
export type RoundingMethod = (typeof RoundingMethod)[keyof typeof RoundingMethod];

export const CloseStatus = {
  OPEN: 'open',
  CLOSED: 'closed',
} as const;

/** 業務エラーの機械可読コード（設計書 E. エラー方針）。 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERIOD_CLOSED: 'period_closed',
  BALANCE_EXCEEDED: 'balance_exceeded',
  OVERLAP: 'overlap',
  DOUBLE_PUNCH: 'double_punch',
  ALREADY_PROCESSED: 'already_processed',
  NOT_APPROVER: 'not_approver',
  LAST_ADMIN: 'last_admin',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
} as const;
