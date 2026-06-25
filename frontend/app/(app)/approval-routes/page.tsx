'use client';

import { useEffect, useState } from 'react';
import { api, ApiException, Member } from '@/lib/api';
import { Banner, Button, Card, EmptyState, Field, SectionTitle, SelectField, Spinner } from '@/components/ui';
import { REQUEST_TYPE_LABEL } from '@/lib/format';

type ApproverType = 'user' | 'department_manager' | 'scope';
interface Step {
  step: number;
  approver_type: ApproverType;
  approver_ref?: string;
}
interface Route {
  id: string;
  name: string;
  appliesTo: string;
  steps: Step[];
  onNoApprover?: 'auto_approve' | 'block';
  allowSelfApprove?: boolean;
}

const APPLIES_OPTIONS = [['all', 'すべての申請'], ...Object.entries(REQUEST_TYPE_LABEL)];
const TYPE_LABEL: Record<string, string> = {
  user: '指定ユーザー',
  department_manager: '申請者の部署長',
  scope: '権限保持者の誰でも',
};
const NO_APPROVER_LABEL: Record<string, string> = {
  auto_approve: '自動承認',
  block: '保留（承認者待ち）',
};

export default function ApprovalRoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [appliesTo, setAppliesTo] = useState('all');
  const [steps, setSteps] = useState<Step[]>([{ step: 1, approver_type: 'scope' }]);
  const [onNoApprover, setOnNoApprover] = useState<'auto_approve' | 'block'>('auto_approve');
  const [allowSelfApprove, setAllowSelfApprove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRoutes(await api.get<Route[]>('/approval-routes'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    api.get<Member[]>('/users').then(setMembers).catch(() => {});
  }, []);

  function addStep() {
    setSteps((s) => [...s, { step: s.length + 1, approver_type: 'scope' }]);
  }
  function updateStep(i: number, patch: Partial<Step>) {
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  }
  function removeStep(i: number) {
    setSteps((s) => s.filter((_, idx) => idx !== i).map((st, idx) => ({ ...st, step: idx + 1 })));
  }

  async function create() {
    setError(null);
    if (!name.trim()) return setError('経路名を入力してください。');
    setSaving(true);
    try {
      await api.post('/approval-routes', { name, appliesTo, steps, onNoApprover, allowSelfApprove });
      setShow(false);
      setName('');
      setAppliesTo('all');
      setSteps([{ step: 1, approver_type: 'scope' }]);
      setOnNoApprover('auto_approve');
      setAllowSelfApprove(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api.del(`/approval-routes/${id}`).catch(() => {});
    await load();
  }

  const memberName = (id?: string) => members.find((m) => m.id === id)?.name ?? '—';

  return (
    <div className="mx-auto max-w-content">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-ink-muted">多段・条件つきの承認経路</div>
        <Button size="sm" onClick={() => setShow((v) => !v)}>{show ? '閉じる' : '＋ 経路を作成'}</Button>
      </div>

      {show && (
        <Card className="mb-4">
          <SectionTitle>承認経路を作成</SectionTitle>
          {error && <div className="mb-3"><Banner kind="error">{error}</Banner></div>}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="経路名" value={name} onChange={(e) => setName(e.target.value)} placeholder="標準承認フロー" />
            <SelectField label="適用対象" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)}>
              {APPLIES_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </SelectField>
          </div>

          <div className="mt-4">
            <div className="label">承認ステップ</div>
            <div className="flex flex-col gap-2">
              {steps.map((st, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="num w-12 text-[13px] font-bold text-brand-600">STEP {st.step}</span>
                  <select
                    className="field h-10 flex-1"
                    value={st.approver_type}
                    onChange={(e) => updateStep(i, { approver_type: e.target.value as Step['approver_type'], approver_ref: undefined })}
                  >
                    {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {st.approver_type === 'user' && (
                    <select className="field h-10 flex-1" value={st.approver_ref ?? ''} onChange={(e) => updateStep(i, { approver_ref: e.target.value })}>
                      <option value="">選択…</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  )}
                  {steps.length > 1 && (
                    <button onClick={() => removeStep(i)} className="btn-ghost h-10 w-10 px-0 text-base">×</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addStep} className="mt-2 text-[13px] font-semibold text-brand">＋ ステップを追加</button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <SelectField
              label="承認者がいない場合"
              value={onNoApprover}
              onChange={(e) => setOnNoApprover(e.target.value as 'auto_approve' | 'block')}
            >
              <option value="auto_approve">自動承認（監査ログに記録）</option>
              <option value="block">保留（承認者が決まるまで進めない）</option>
            </SelectField>
            <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-ink">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={allowSelfApprove}
                onChange={(e) => setAllowSelfApprove(e.target.checked)}
              />
              自己承認を許可する
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={create} disabled={saving}>{saving ? '作成中…' : '作成'}</Button>
          </div>
        </Card>
      )}

      <Card>
        {loading ? (
          <Spinner />
        ) : routes.length === 0 ? (
          <EmptyState title="承認経路がありません" hint="未設定の場合は単一ステップ（権限保持者の承認）で運用されます。" />
        ) : (
          <div className="flex flex-col gap-2">
            {routes.map((r) => (
              <div key={r.id} className="rounded-panel border border-line bg-paper-surface px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink">{r.name}</span>
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-600">
                    {r.appliesTo === 'all' ? 'すべて' : REQUEST_TYPE_LABEL[r.appliesTo] ?? r.appliesTo}
                  </span>
                  <span className="flex-1" />
                  <button onClick={() => remove(r.id)} className="text-[12px] text-danger">削除</button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-muted">
                  {(r.steps ?? []).map((s, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <span className="rounded-control bg-white px-2 py-1">
                        {s.step}. {TYPE_LABEL[s.approver_type] ?? s.approver_type}
                        {s.approver_type === 'user' ? `（${memberName(s.approver_ref)}）` : ''}
                      </span>
                      {i < (r.steps?.length ?? 0) - 1 && <span className="text-ink-faint">→</span>}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-ink-faint">
                  <span>承認者不在時: {NO_APPROVER_LABEL[r.onNoApprover ?? 'auto_approve']}</span>
                  <span>自己承認: {r.allowSelfApprove ? '許可' : '不可'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
