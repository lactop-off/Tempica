'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, MonthlySummary, DailySummary } from '@/lib/api';
import { Card, SectionTitle, Spinner, StatusBadge } from '@/components/ui';
import { clsx } from '@/components/ui/clsx';
import { hhmm, ym } from '@/lib/format';

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

export default function AttendancePage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [data, setData] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DailySummary | null>(null);

  const period = ym(cursor);

  useEffect(() => {
    setLoading(true);
    api
      .get<MonthlySummary>(`/summaries/monthly?period=${period}`)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  const byDate = useMemo(() => {
    const m = new Map<number, DailySummary>();
    data?.daily.forEach((d) => m.set(new Date(d.workDate).getDate(), d));
    return m;
  }, [data]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function move(delta: number) {
    setCursor(new Date(year, month + delta, 1));
    setSelected(null);
  }

  return (
    <div className="mx-auto grid max-w-content grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => move(-1)} className="btn-ghost h-8 w-8 px-0 text-base">‹</button>
            <div className="font-rounded text-[17px] font-extrabold text-brand-900">
              {year}年 {month + 1}月
            </div>
            <button onClick={() => move(1)} className="btn-ghost h-8 w-8 px-0 text-base">›</button>
          </div>
          <div className="flex gap-3 text-[11px] text-ink-muted">
            <Legend className="bg-brand-50 border-brand-200">有給</Legend>
            <Legend className="bg-warn-bg border-warn-border">残業</Legend>
            <Legend className="bg-paper-surface border-line-soft">休日</Legend>
          </div>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEK.map((w, i) => (
                <div
                  key={w}
                  className={clsx(
                    'py-1 text-center text-[11px] font-bold',
                    i === 0 ? 'text-danger' : i === 6 ? 'text-accent-cyan' : 'text-ink-faint',
                  )}
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="mt-0.5 grid grid-cols-7 gap-1.5">
              {cells.map((n, i) => {
                if (n == null) return <div key={`b${i}`} />;
                const d = byDate.get(n);
                const ot = (d?.overtimeMinutes ?? 0) > 0;
                const worked = (d?.workedMinutes ?? 0) > 0;
                return (
                  <button
                    key={n}
                    onClick={() => d && setSelected(d)}
                    className={clsx(
                      'flex aspect-square flex-col items-start rounded-[10px] border p-1.5 text-left transition',
                      selected && new Date(selected.workDate).getDate() === n
                        ? 'border-brand bg-brand-50'
                        : ot
                          ? 'border-warn-border bg-warn-bg'
                          : worked
                            ? 'border-line bg-white hover:border-brand-200'
                            : 'border-line-soft bg-paper-surface',
                    )}
                  >
                    <span className="num text-[13px] font-semibold text-ink">{n}</span>
                    {worked && (
                      <span className="num mt-auto text-[10px] font-bold text-brand-600">
                        {hhmm(d!.workedMinutes)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <SectionTitle>月次サマリ</SectionTitle>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="実働時間"><span className="num font-bold text-brand-900">{hhmm(data?.total.workedMinutes)}</span></Row>
            <Row label="残業時間"><span className="num font-bold text-warn">{hhmm(data?.total.overtimeMinutes)}</span></Row>
            <Row label="深夜時間"><span className="num">{hhmm(data?.total.lateNightMinutes)}</span></Row>
            <Row label="休日労働"><span className="num">{hhmm(data?.total.holidayMinutes)}</span></Row>
            <Row label="遅刻 / 早退">
              <span className="num">{hhmm(data?.total.lateMinutes)} / {hhmm(data?.total.earlyLeaveMinutes)}</span>
            </Row>
            <Row label="出勤日数"><span className="num">{data?.days ?? 0} 日</span></Row>
          </dl>
        </Card>

        {selected && (
          <Card>
            <SectionTitle>
              {new Date(selected.workDate).getMonth() + 1}/{new Date(selected.workDate).getDate()} の明細
            </SectionTitle>
            <dl className="flex flex-col gap-2 text-sm">
              <Row label="実働"><span className="num font-bold text-brand-900">{hhmm(selected.workedMinutes)}</span></Row>
              <Row label="残業"><span className="num">{hhmm(selected.overtimeMinutes)}</span></Row>
              <Row label="状態"><StatusBadge status={selected.status} label={selected.status === 'closed' ? '締め済み' : '未確定'} /></Row>
            </dl>
            {selected.status !== 'closed' && (
              <Link href="/requests/new?type=punch_fix" className="btn-soft mt-3 h-9 w-full text-[13px]">
                打刻修正を申請
              </Link>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft pb-2 last:border-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
function Legend({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={clsx('h-2.5 w-2.5 rounded-[3px] border', className)} />
      {children}
    </span>
  );
}
