'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, EmptyState, SectionTitle, Spinner } from '@/components/ui';
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
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  // 今週（日曜起点）
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });

  useEffect(() => {
    const from = ymd(week[0]);
    const to = ymd(week[6]);
    api
      .get<Shift[]>(`/shifts?from=${from}&to=${to}`)
      .then(setShifts)
      .catch(() => setShifts([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byDate = new Map<string, Shift>();
  shifts.forEach((s) => byDate.set(s.shiftDate.slice(0, 10), s));

  const fmt = (t?: string | null) => (t ? new Date(t).toISOString().slice(11, 16) : '—');

  return (
    <div className="mx-auto max-w-content">
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
                  <div className={clsx('text-[11px] font-bold', i === 0 ? 'text-danger' : i === 6 ? 'text-accent-cyan' : 'text-ink-faint')}>
                    {WEEK[i]}
                  </div>
                  <div className="num text-sm font-bold text-ink">{d.getDate()}</div>
                  <div className="num mt-2 text-[11px] text-brand-600">
                    {s ? `${fmt(s.startTime)}–${fmt(s.endTime)}` : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!loading && shifts.length === 0 && (
          <div className="mt-4">
            <EmptyState title="今週の予定はありません" hint="管理者がシフトを確定するとここに表示されます。" />
          </div>
        )}
      </Card>
    </div>
  );
}
