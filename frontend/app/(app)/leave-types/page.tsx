'use client';

import { useEffect, useState } from 'react';
import { api, ApiException, LeaveType } from '@/lib/api';
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

const UNIT_LABEL: Record<string, string> = { day: '日', half: '半日', hour: '時間' };

export default function LeaveTypesPage() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [unit, setUnit] = useState<'day' | 'half' | 'hour'>('day');
  const [paid, setPaid] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setTypes(await api.get<LeaveType[]>('/leave-types'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setError(null);
    if (!name.trim()) return setError('休暇種別名を入力してください。');
    setSaving(true);
    try {
      await api.post('/leave-types', { name, unit, paid });
      setShow(false);
      setName('');
      setUnit('day');
      setPaid(true);
      await load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function togglePaid(t: LeaveType) {
    try {
      await api.patch(`/leave-types/${t.id}`, { paid: !t.paid });
      await load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '更新に失敗しました');
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.del(`/leave-types/${id}`);
      await load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '削除に失敗しました');
    }
  }

  return (
    <div className="mx-auto max-w-content">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-ink-muted">休暇種別マスタ（有給・振替休日 など）</div>
        <Button size="sm" onClick={() => setShow((v) => !v)}>
          {show ? '閉じる' : '＋ 種別を追加'}
        </Button>
      </div>

      {error && (
        <div className="mb-3">
          <Banner kind="error">{error}</Banner>
        </div>
      )}

      {show && (
        <Card className="mb-4">
          <SectionTitle>休暇種別を追加</SectionTitle>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field
              label="種別名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="有給休暇"
            />
            <SelectField
              label="単位"
              value={unit}
              onChange={(e) => setUnit(e.target.value as 'day' | 'half' | 'hour')}
            >
              {Object.entries(UNIT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </SelectField>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
            />
            有給（残数を消化する）
          </label>
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
        ) : types.length === 0 ? (
          <EmptyState title="休暇種別がありません" hint="有給休暇・振替休日などを登録します。" />
        ) : (
          <div className="flex flex-col gap-2">
            {types.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-2 rounded-panel border border-line bg-paper-surface px-4 py-2.5"
              >
                <span className="font-semibold text-ink">{t.name}</span>
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-600">
                  {UNIT_LABEL[t.unit] ?? t.unit}単位
                </span>
                <span
                  className={
                    t.paid
                      ? 'rounded-full bg-ok-bg px-2 py-0.5 text-[10px] font-bold text-ok'
                      : 'rounded-full bg-line px-2 py-0.5 text-[10px] font-bold text-ink-muted'
                  }
                >
                  {t.paid ? '有給' : '無給'}
                </span>
                <span className="flex-1" />
                <button onClick={() => togglePaid(t)} className="text-[12px] text-ink-muted">
                  {t.paid ? '無給に変更' : '有給に変更'}
                </button>
                <button onClick={() => remove(t.id)} className="text-[12px] text-danger">
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
