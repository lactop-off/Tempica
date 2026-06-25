'use client';

import { useEffect, useState } from 'react';
import { api, ApiException, Member } from '@/lib/api';
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
} from '@/components/ui';
import { clsx } from '@/components/ui/clsx';
import { ymd } from '@/lib/format';

interface Shift {
  id: string;
  shiftDate: string;
  startTime?: string | null;
  endTime?: string | null;
  kind: string;
}
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

export default function ShiftPage() {
  const { me, can } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const canEdit = can('shift', 'edit');

  // 今週（日曜起点）
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });

  async function loadWeek() {
    const from = ymd(week[0]);
    const to = ymd(week[6]);
    const r = await api.get<Shift[]>(`/shifts?from=${from}&to=${to}`).catch(() => []);
    setShifts(r);
  }
  useEffect(() => {
    loadWeek().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byDate = new Map<string, Shift>();
  shifts.forEach((s) => byDate.set(s.shiftDate.slice(0, 10), s));

  const fmt = (t?: string | null) => (t ? new Date(t).toISOString().slice(11, 16) : '—');

  return (
    <div className="mx-auto max-w-content">
      <ShiftForm canEdit={canEdit} selfId={me?.user.id} onSaved={loadWeek} defaultDate={ymd(today)} />

      <Card>
        <SectionTitle>今週のシフト・勤務予定</SectionTitle>
        {loading ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {week.map((d, i) => {
              const key = ymd(d);
              const s = byDate.get(key);
              const isToday = key === ymd(today);
              return (
                <div
                  key={key}
                  className={clsx(
                    'rounded-panel border p-2.5',
                    isToday ? 'border-brand bg-brand-50' : 'border-line bg-paper-surface',
                  )}
                >
                  <div
                    className={clsx(
                      'text-[11px] font-bold',
                      i === 0 ? 'text-danger' : i === 6 ? 'text-accent-cyan' : 'text-ink-faint',
                    )}
                  >
                    {WEEK[i]}
                  </div>
                  <div className="num text-sm font-bold text-ink">{d.getDate()}</div>
                  <div className="num mt-2 text-[11px] text-brand-600">
                    {s ? `${fmt(s.startTime)}–${fmt(s.endTime)}` : '—'}
                  </div>
                  {s && (
                    <div className="mt-0.5 text-[9px] text-ink-faint">
                      {s.kind === 'planned' ? '確定' : '希望'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!loading && shifts.length === 0 && (
          <div className="mt-4">
            <EmptyState
              title="今週の予定はありません"
              hint={canEdit ? 'シフトを登録すると表示されます。' : '希望を提出すると表示されます。'}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function ShiftForm({
  canEdit,
  selfId,
  onSaved,
  defaultDate,
}: {
  canEdit: boolean;
  selfId?: string;
  onSaved: () => void | Promise<void>;
  defaultDate: string;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [userId, setUserId] = useState('');
  const [shiftDate, setShiftDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (canEdit) api.get<Member[]>('/users').then(setMembers).catch(() => {});
  }, [canEdit]);

  // 対象が自分（または未選択）なら希望提出、他メンバーなら確定として登録される（サーバ側で判定）。
  const targetIsSelf = !userId || userId === selfId;

  async function save() {
    setError(null);
    setOk(false);
    setSaving(true);
    try {
      await api.post('/shifts', {
        userId: userId || undefined,
        shiftDate,
        startTime,
        endTime,
      });
      setOk(true);
      if (targetIsSelf) await onSaved();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '登録に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-4">
      <SectionTitle>{canEdit ? 'シフト登録 / 希望提出' : 'シフト希望を提出'}</SectionTitle>
      {error && (
        <div className="mb-3">
          <Banner kind="error">{error}</Banner>
        </div>
      )}
      {ok && (
        <div className="mb-3">
          <Banner kind="info">
            {targetIsSelf ? '希望を提出しました。' : '確定シフトを登録しました。'}
          </Banner>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {canEdit && (
          <SelectField
            label="対象メンバー"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">自分（希望提出）</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}（確定）
              </option>
            ))}
          </SelectField>
        )}
        <Field
          label="日付"
          type="date"
          value={shiftDate}
          onChange={(e) => setShiftDate(e.target.value)}
        />
        <Field
          label="開始"
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
        <Field
          label="終了"
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? '登録中…' : canEdit && !targetIsSelf ? '確定登録' : '希望提出'}
        </Button>
      </div>
    </Card>
  );
}
