'use client';

import { useEffect, useState } from 'react';
import { api, ApiException, Department, EmploymentType, Member, Role } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  SectionTitle,
  SelectField,
  Spinner,
  StatusBadge,
} from '@/components/ui';

const STATUS_LABEL: Record<string, string> = {
  active: '在籍',
  suspended: '休止',
  retired: '退職',
};

export default function MembersPage() {
  const { can } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [empTypes, setEmpTypes] = useState<EmploymentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    employeeCode: '',
    deptId: '',
    employmentTypeId: '',
    roleId: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setMembers(await api.get<Member[]>('/users'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    if (can('role', 'view')) api.get<Role[]>('/roles').then(setRoles).catch(() => {});
    api.get<Department[]>('/departments').then(setDepts).catch(() => {});
    api.get<EmploymentType[]>('/employment-types').then(setEmpTypes).catch(() => {});
  }, [can]);

  const deptName = (id?: string | null) => depts.find((d) => d.id === id)?.name;
  const empName = (id?: string | null) => empTypes.find((t) => t.id === id)?.name;
  const roleName = (id?: string) => roles.find((r) => r.id === id)?.name;

  async function create() {
    setError(null);
    if (!form.name || !form.email || form.password.length < 8) {
      setError('氏名・メール・8文字以上のパスワードを入力してください。');
      return;
    }
    setSaving(true);
    try {
      await api.post('/users', {
        name: form.name,
        email: form.email,
        password: form.password,
        employeeCode: form.employeeCode || undefined,
        deptId: form.deptId || undefined,
        employmentTypeId: form.employmentTypeId || undefined,
        roleIds: form.roleId ? [form.roleId] : [],
      });
      setForm({
        name: '',
        email: '',
        password: '',
        employeeCode: '',
        deptId: '',
        employmentTypeId: '',
        roleId: '',
      });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '登録に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  const canCreate = can('member', 'create');
  const canEdit = can('member', 'edit');

  return (
    <div className="mx-auto max-w-content">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-ink-muted">
          メンバー <span className="num font-bold text-brand-900">{members.length}</span> 名
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? '閉じる' : '＋ メンバー追加'}
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-3">
          <Banner kind="error">{error}</Banner>
        </div>
      )}

      {showForm && (
        <Card className="mb-4">
          <SectionTitle>新規メンバー</SectionTitle>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field
              label="氏名"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Field
              label="メール"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Field
              label="初期パスワード"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <Field
              label="社員コード（任意）"
              value={form.employeeCode}
              onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
            />
            <SelectField
              label="部署"
              value={form.deptId}
              onChange={(e) => setForm({ ...form, deptId: e.target.value })}
            >
              <option value="">（未所属）</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="雇用区分"
              value={form.employmentTypeId}
              onChange={(e) => setForm({ ...form, employmentTypeId: e.target.value })}
            >
              <option value="">（未設定）</option>
              {empTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="ロール"
              value={form.roleId}
              onChange={(e) => setForm({ ...form, roleId: e.target.value })}
            >
              <option value="">（未割当）</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={create} disabled={saving}>
              {saving ? '登録中…' : '登録'}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        {loading ? (
          <Spinner />
        ) : members.length === 0 ? (
          <EmptyState title="メンバーがいません" />
        ) : (
          <div className="flex flex-col">
            {members.map((m) =>
              editId === m.id ? (
                <MemberEditRow
                  key={m.id}
                  member={m}
                  depts={depts}
                  empTypes={empTypes}
                  roles={roles}
                  onClose={() => setEditId(null)}
                  onSaved={async () => {
                    setEditId(null);
                    await load();
                  }}
                />
              ) : (
                <div
                  key={m.id}
                  className="flex items-center gap-3 border-b border-line-soft py-3 last:border-0"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-100 font-rounded text-sm font-extrabold text-brand-600">
                    {m.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-ink">{m.name}</div>
                    <div className="truncate text-[12px] text-ink-faint">
                      {m.email}
                      {deptName(m.deptId) ? ` ・ ${deptName(m.deptId)}` : ''}
                      {empName(m.employmentTypeId) ? ` ・ ${empName(m.employmentTypeId)}` : ''}
                      {m.roles?.[0] ? ` ・ ${roleName(m.roles[0].roleId) ?? 'ロール'}` : ''}
                    </div>
                  </div>
                  {m.employeeCode && (
                    <span className="num hidden text-[12px] text-ink-muted sm:block">
                      {m.employeeCode}
                    </span>
                  )}
                  <StatusBadge
                    status={
                      m.status === 'active' ? 'approved' : m.status === 'retired' ? 'canceled' : 'pending'
                    }
                    label={STATUS_LABEL[m.status] ?? m.status}
                  />
                  {canEdit && (
                    <button
                      onClick={() => setEditId(m.id)}
                      className="text-[12px] text-ink-muted"
                    >
                      編集
                    </button>
                  )}
                </div>
              ),
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function MemberEditRow({
  member,
  depts,
  empTypes,
  roles,
  onClose,
  onSaved,
}: {
  member: Member;
  depts: Department[];
  empTypes: EmploymentType[];
  roles: Role[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(member.name);
  const [employeeCode, setEmployeeCode] = useState(member.employeeCode ?? '');
  const [deptId, setDeptId] = useState(member.deptId ?? '');
  const [employmentTypeId, setEmploymentTypeId] = useState(member.employmentTypeId ?? '');
  const [roleId, setRoleId] = useState(member.roles?.[0]?.roleId ?? '');
  const [status, setStatus] = useState(member.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/users/${member.id}`, {
        name,
        employeeCode: employeeCode || undefined,
        deptId: deptId || undefined,
        employmentTypeId: employmentTypeId || undefined,
        status,
        roleIds: roleId ? [roleId] : [],
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '保存に失敗しました');
      setSaving(false);
    }
  }

  return (
    <div className="border-b border-line-soft py-3 last:border-0">
      {error && (
        <div className="mb-2">
          <Banner kind="error">{error}</Banner>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="氏名" value={name} onChange={(e) => setName(e.target.value)} />
        <Field
          label="社員コード"
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
        />
        <SelectField label="部署" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
          <option value="">（未所属）</option>
          {depts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="雇用区分"
          value={employmentTypeId}
          onChange={(e) => setEmploymentTypeId(e.target.value)}
        >
          <option value="">（未設定）</option>
          {empTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="ロール" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="">（未割当）</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="在籍状態" value={status} onChange={(e) => setStatus(e.target.value)}>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onClose} className="text-[13px] text-ink-muted">
          取消
        </button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? '保存中…' : '保存'}
        </Button>
      </div>
    </div>
  );
}
