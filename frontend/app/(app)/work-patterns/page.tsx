'use client';

import { useEffect, useState } from 'react';
import { api, ApiException, WorkPattern } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Banner, Button, Card, EmptyState, Field, SectionTitle, SelectField, Spinner } from '@/components/ui';
import { hhmm } from '@/lib/format';
import { AssignCard } from './AssignCard';

const TYPE_LABEL: Record<string, string> = {
  fixed: '固定',
  flex: 'フレックス',
  variable_month: '変形（1ヶ月）',
  shift: 'シフト',
};

export default function WorkPatternsPage() {
  const { can } = useAuth();
  const [items, setItems] = useState<WorkPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'fixed', scheduledMinutes: '480', roundingUnit: '15', roundingMethod: 'nearest' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setItems(await api.get<WorkPattern[]>('/work-patterns'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setError(null);
    if (!form.name) return setError('名称を入力してください。');
    setSaving(true);
    try {
      await api.post('/work-patterns', {
        name: form.name,
        type: form.type,
        workRule: {
          scheduledMinutes: Number(form.scheduledMinutes),
          roundingUnit: Number(form.roundingUnit),
          roundingMethod: form.roundingMethod,
        },
      });
      setShow(false);
      setForm({ name: '', type: 'fixed', scheduledMinutes: '480', roundingUnit: '15', roundingMethod: 'nearest' });
      await load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  const canManage = can('work_pattern', 'manage');

  return (
    <div className="mx-auto max-w-content">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-ink-muted">勤務形態テンプレート</div>
        {canManage && <Button size="sm" onClick={() => setShow((v) => !v)}>{show ? '閉じる' : '＋ 新規作成'}</Button>}
      </div>

      {show && (
        <Card className="mb-4">
          <SectionTitle>勤務形態を作成</SectionTitle>
          {error && <div className="mb-3"><Banner kind="error">{error}</Banner></div>}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="標準（固定9-18）" />
            <SelectField label="種別" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </SelectField>
            <Field label="所定労働（分）" type="number" value={form.scheduledMinutes} onChange={(e) => setForm({ ...form, scheduledMinutes: e.target.value })} />
            <Field label="丸め単位（分）" type="number" min={1} max={60} value={form.roundingUnit} onChange={(e) => setForm({ ...form, roundingUnit: e.target.value })} />
            <SelectField label="丸め方法" value={form.roundingMethod} onChange={(e) => setForm({ ...form, roundingMethod: e.target.value })}>
              <option value="none">なし</option>
              <option value="up">切り上げ</option>
              <option value="down">切り捨て</option>
              <option value="nearest">四捨五入</option>
            </SelectField>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={create} disabled={saving}>{saving ? '作成中…' : '作成'}</Button>
          </div>
        </Card>
      )}

      <Card>
        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState title="勤務形態がありません" hint="テンプレートを作成して従業員へ割り当てます。" />
        ) : (
          <div className="flex flex-col">
            {items.map((p) => {
              const rule = p.workRules?.[0];
              return (
                <div key={p.id} className="flex items-center gap-3 border-b border-line-soft py-3 last:border-0">
                  <div className="flex-1">
                    <div className="text-sm font-bold text-ink">{p.name}</div>
                    <div className="text-[12px] text-ink-faint">
                      {TYPE_LABEL[p.type] ?? p.type}
                      {rule ? ` ・ 所定 ${hhmm(rule.scheduledMinutes)} ・ 丸め ${rule.roundingUnit}分` : ''}
                    </div>
                  </div>
                  {!p.isActive && <span className="text-[11px] text-ink-faint">無効</span>}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {canManage && can('member', 'view') && items.length > 0 && <AssignCard patterns={items} />}
    </div>
  );
}
