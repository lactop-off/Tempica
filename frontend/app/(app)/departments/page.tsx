'use client';

import { useEffect, useState } from 'react';
import { api, ApiException, Department, Member } from '@/lib/api';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  SectionTitle,
  SelectField,
  Spinner,
} from '@/components/ui';

const KIND_LABEL: Record<string, string> = {
  location: '拠点',
  department: '部署',
  group: 'グループ',
};

export default function DepartmentsPage() {
  const [depts, setDepts] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [kind, setKind] = useState('department');
  const [parentId, setParentId] = useState('');
  const [managerUserId, setManagerUserId] = useState('');

  async function load() {
    setLoading(true);
    try {
      setDepts(await api.get<Department[]>('/departments'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    api
      .get<Member[]>('/users')
      .then(setMembers)
      .catch(() => {});
  }, []);

  const memberName = (id?: string | null) => members.find((m) => m.id === id)?.name ?? '—';
  const deptName = (id?: string | null) => depts.find((d) => d.id === id)?.name ?? '—';

  async function create() {
    setError(null);
    if (!name.trim()) return setError('部署名を入力してください。');
    setSaving(true);
    try {
      await api.post('/departments', {
        name,
        kind,
        parentId: parentId || undefined,
        managerUserId: managerUserId || undefined,
      });
      setShow(false);
      setName('');
      setKind('department');
      setParentId('');
      setManagerUserId('');
      await load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function setManager(dept: Department, value: string) {
    try {
      await api.patch(`/departments/${dept.id}`, { managerUserId: value || null });
      await load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '更新に失敗しました');
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.del(`/departments/${id}`);
      await load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '削除に失敗しました');
    }
  }

  return (
    <div className="mx-auto max-w-content">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-ink-muted">
          部署ツリーと部署長。部署長は承認経路の「部署長」承認に使われます。
        </div>
        <Button size="sm" onClick={() => setShow((v) => !v)}>
          {show ? '閉じる' : '＋ 部署を追加'}
        </Button>
      </div>

      {error && (
        <div className="mb-3">
          <Banner kind="error">{error}</Banner>
        </div>
      )}

      {show && (
        <Card className="mb-4">
          <SectionTitle>部署を追加</SectionTitle>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field
              label="部署名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="開発部"
            />
            <SelectField label="種別" value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="親部署（任意）"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">（最上位）</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="部署長（任意）"
              value={managerUserId}
              onChange={(e) => setManagerUserId(e.target.value)}
            >
              <option value="">（未設定）</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={create} disabled={saving}>
              {saving ? '作成中…' : '作成'}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        {loading ? (
          <Spinner />
        ) : depts.length === 0 ? (
          <EmptyState title="部署がありません" hint="拠点・部署を追加して組織構造を作成します。" />
        ) : (
          <div className="flex flex-col gap-2">
            {depts.map((d) => (
              <div
                key={d.id}
                className="rounded-panel border border-line bg-paper-surface px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-ink">{d.name}</span>
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-600">
                    {KIND_LABEL[d.kind] ?? d.kind}
                  </span>
                  {d.parentId && (
                    <span className="text-[12px] text-ink-muted">親: {deptName(d.parentId)}</span>
                  )}
                  <span className="flex-1" />
                  <button onClick={() => remove(d.id)} className="text-[12px] text-danger">
                    削除
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="w-16 text-[12px] text-ink-muted">部署長</span>
                  <select
                    className="field h-9 max-w-[260px] flex-1"
                    value={d.managerUserId ?? ''}
                    onChange={(e) => setManager(d, e.target.value)}
                  >
                    <option value="">（未設定）</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[12px] text-ink-faint">現在: {memberName(d.managerUserId)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
