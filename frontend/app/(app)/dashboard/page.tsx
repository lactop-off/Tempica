'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, DailySummary, LeaveBalance, RequestItem, ApprovalItem } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePunch, punchButtons } from '@/lib/usePunch';
import { Card, SectionTitle, StatusBadge } from '@/components/ui';
import { clsx } from '@/components/ui/clsx';
import { hhmm, days, clockTime, ymd, REQUEST_TYPE_LABEL } from '@/lib/format';

export default function DashboardPage() {
  const { me, can } = useAuth();
  const punch = usePunch();
  const [today, setToday] = useState<DailySummary | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [leave, setLeave] = useState<LeaveBalance[]>([]);
  const [recent, setRecent] = useState<RequestItem[]>([]);

  useEffect(() => {
    const t = ymd(new Date());
    api.get<DailySummary[]>(`/summaries/daily?from=${t}&to=${t}`).then((r) => setToday(r[0] ?? null)).catch(() => {});
    api.get<LeaveBalance[]>('/leave-balances').then(setLeave).catch(() => {});
    api.get<RequestItem[]>('/requests').then((r) => setRecent(r.slice(0, 4))).catch(() => {});
    if (can('approval', 'approve')) {
      api.get<ApprovalItem[]>('/approvals').then((r) => setPending(r.length)).catch(() => setPending(0));
    }
  }, [can]);

  const clockIn = punch.records.find((r) => r.punchType === 'clock_in');
  const paidRemaining = leave
    .filter((b) => b.leaveType?.paid !== false)
    .reduce((s, b) => s + (b.grantedMinutes - b.usedMinutes), 0);
  const greeting = `${me?.user.name} さん、こんにちは。今日も一日よろしくお願いします。`;

  return (
    <div className="mx-auto max-w-content">
      <div className="mb-4 text-sm text-ink-muted">{greeting}</div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <div className="text-xs font-medium text-ink-muted">本日の勤務</div>
          <div className="mt-2 font-rounded text-lg font-extrabold text-ok-bright">{punch.statusLabel}</div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="num text-[34px] font-bold tracking-tight text-brand-900">
              {hhmm(today?.workedMinutes ?? 0)}
            </span>
            <span className="text-[13px] text-ink-faint">/ 8:00 実働</span>
          </div>
          <div className="mt-2 text-xs text-ink-muted">
            出勤 <span className="num">{clockTime(clockIn?.punchedAt)}</span>
            {today ? <> ・ 残業 <span className="num">{hhmm(today.overtimeMinutes)}</span></> : null}
          </div>
        </Card>

        {can('approval', 'approve') && (
          <Card>
            <div className="text-xs font-medium text-ink-muted">承認待ち</div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="num text-[34px] font-bold text-brand-900">{pending ?? '–'}</span>
              <span className="text-[13px] text-ink-faint">件</span>
            </div>
            <Link href="/approvals" className="btn-soft mt-3.5 h-9 w-full text-[13px]">
              承認一覧へ
            </Link>
          </Card>
        )}

        <Card>
          <div className="text-xs font-medium text-ink-muted">有給残数</div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="num text-[34px] font-bold text-brand-900">{days(paidRemaining)}</span>
            <span className="text-[13px] text-ink-faint">日</span>
          </div>
          <Link href="/leave" className="mt-3.5 block text-xs font-semibold text-brand">
            休暇の詳細 →
          </Link>
        </Card>
      </div>

      {can('attendance', 'create') && (
        <Card className="mb-4">
          <SectionTitle right={<Link href="/punch" className="text-xs font-semibold text-brand">打刻画面 →</Link>}>
            クイック打刻
          </SectionTitle>
          <div className="flex flex-wrap items-center gap-4">
            <div className="num text-[38px] font-bold text-brand-900">{punch.clock}</div>
            <div className="flex flex-1 flex-wrap gap-2.5">
              {punchButtons(punch.state).map((b) => (
                <button
                  key={b.type}
                  disabled={!b.enabled || punch.busy}
                  onClick={() => punch.punch(b.type)}
                  className={clsx(
                    'h-11 min-w-[96px] flex-1 rounded-control font-rounded text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40',
                    b.primary
                      ? 'bg-brand text-white shadow-brand hover:bg-brand-600'
                      : 'border border-line-strong bg-white text-ink-label hover:bg-paper-surface',
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          {punch.error && <div className="mt-2 text-xs font-bold text-danger">{punch.error}</div>}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>最近の申請</SectionTitle>
          {recent.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-ink-faint">申請はまだありません。</div>
          ) : (
            <div className="flex flex-col">
              {recent.map((r) => (
                <div key={r.id} className="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-0">
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-ink">{REQUEST_TYPE_LABEL[r.type] ?? r.type}</div>
                    <div className="num text-[11px] text-ink-faint">{ymd(r.createdAt)}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>ショートカット</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/requests/new" className="btn-soft h-11">申請を作成</Link>
            <Link href="/attendance" className="btn-ghost h-11">勤怠を見る</Link>
            <Link href="/shift" className="btn-ghost h-11">シフト</Link>
            <Link href="/leave" className="btn-ghost h-11">休暇残数</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
