// バックエンド API クライアント。
// 認証は HttpOnly セッション Cookie のため、すべて credentials: 'include' で送る。
// 開発時は next.config の rewrites で /api/v1 をバックエンドへプロキシする。

export interface ApiError {
  code: string;
  message: string;
  details?: { field?: string; reason: string }[];
}

export class ApiException extends Error {
  constructor(
    public status: number,
    public error: ApiError,
  ) {
    super(error.message);
  }
}

const BASE = '/api/v1';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    ...init,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const err: ApiError = data?.error ?? { code: 'error', message: `HTTP ${res.status}` };
    throw new ApiException(res.status, err);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
};

// ── ドメイン型（バックエンドのレスポンスに対応する最小定義） ──

export interface Permission {
  feature: string;
  action: string;
  scope: 'self' | 'department' | 'location' | 'org';
}
export interface AuthUser {
  id: string;
  orgId: string;
  deptId?: string | null;
  email: string;
  name: string;
}
export interface Me {
  user: AuthUser;
  permissions: Permission[];
}

export interface TimeRecord {
  id: string;
  punchType: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  punchedAt: string;
  source: string;
}
export interface DailySummary {
  id: string;
  userId: string;
  workDate: string;
  workedMinutes: number;
  overtimeMinutes: number;
  lateNightMinutes: number;
  holidayMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  status: 'open' | 'closed';
}
export interface MonthlySummary {
  period: string;
  userId: string;
  days: number;
  total: Omit<DailySummary, 'id' | 'userId' | 'workDate' | 'status'>;
  daily: DailySummary[];
}
export interface RequestItem {
  id: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected' | 'canceled';
  leaveTypeId?: string | null;
  payload: Record<string, any>;
  currentStep: number;
  createdAt: string;
  approvals?: { id: string; step: number; result: string; comment?: string }[];
  leaveType?: { id: string; name: string } | null;
  warnings?: string[];
}
export interface ApprovalItem {
  id: string;
  step: number;
  result: string;
  request: {
    id: string;
    type: string;
    userId: string;
    payload: Record<string, any>;
    createdAt: string;
    user: { id: string; name: string; deptId?: string | null };
    leaveType?: { id: string; name: string } | null;
  };
}
export interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  grantedMinutes: number;
  usedMinutes: number;
  expiresOn?: string | null;
  leaveType?: { id: string; name: string; unit: string; paid: boolean };
}
export interface Member {
  id: string;
  name: string;
  email: string;
  employeeCode?: string | null;
  status: string;
  deptId?: string | null;
  roles?: { roleId: string }[];
}
export interface Role {
  id: string;
  name: string;
  isTemplate: boolean;
  permissions: Permission[];
}
export interface WorkPattern {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  workRules?: {
    scheduledMinutes: number;
    breakMinutes: number;
    roundingUnit: number;
    roundingMethod: string;
  }[];
}
export interface Notification {
  id: string;
  type: string;
  payload: Record<string, any>;
  read: boolean;
  createdAt: string;
}
export interface Department {
  id: string;
  name: string;
  parentId?: string | null;
  kind: 'location' | 'department' | 'group';
  sortOrder: number;
  managerUserId?: string | null;
}
export interface OrganizationInfo {
  id: string;
  name: string;
  settings: Record<string, any>;
}
export interface EmploymentType {
  id: string;
  name: string;
}
export interface LeaveType {
  id: string;
  name: string;
  paid: boolean;
  unit: 'day' | 'half' | 'hour';
  grantRule?: Record<string, any>;
}
