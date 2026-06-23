'use client';

import { useEffect, useState } from 'react';
import { api, ApiException, Member, Role } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Banner, Button, Card, EmptyState, Field, SectionTitle, SelectField, Spinner, StatusBadge } from '@/components/ui';

export default function MembersPage() {
  const { can } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
  }, [can]);

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
        roleIds: form.roleId ? [form.roleId] : [],
      });
      setForm({ name: '', email: '', password: '', roleId: '' });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '登録に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  const canCreate = can('member', 'create');

  return (
    <div className="mx-auto max-w-content">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-ink-muted">メンバー <span className="num font-bold text-brand-900">{members.length}</span> 名</div>
        {canCreate && <Button size="sm" onClick={() => setShowForm((v) => !v)}>{showForm ? '閉じる' : '＋ メンバー追加'}</Button>}
      </div>

      {showForm && (
        <Card className="mb-4">
          <SectionTitle>新規メンバー</SectionTitle>
          {error && <div className="mb-3"><Banner kind="error">{error}</Banner></div>}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="氏名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Field label="メール" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Field label="初期パスワード" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <SelectField label="ロール" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
              <option value="">（未割当）</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </SelectField>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={create} disabled={saving}>{saving ? '登録中…' : '登録'}</Button>
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
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 border-b border-line-soft py-3 last:border-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-100 font-rounded text-sm font-extrabold text-brand-600">
                  {m.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink">{m.name}</div>
                  <div className="truncate text-[12px] text-ink-faint">{m.email}</div>
                </div>
                {m.employeeCode && <span className="num hidden text-[12px] text-ink-muted sm:block">{m.employeeCode}</span>}
                <StatusBadge
                  status={m.status === 'active' ? 'approved' : m.status === 'retired' ? 'canceled' : 'pending'}
                  label={m.status === 'active' ? '在籍' : m.status === 'retired' ? '退職' : '休止'}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
