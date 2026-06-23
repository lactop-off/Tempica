'use client';

import { useEffect, useState } from 'react';
import { api, LeaveBalance } from '@/lib/api';
import { Card, SectionTitle, Spinner, EmptyState } from '@/components/ui';
import { days, hhmm } from '@/lib/format';

export default function LeavePage() {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<LeaveBalance[]>('/leave-balances')
      .then(setBalances)
      .catch(() => setBalances([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-content">
      <Card>
        <SectionTitle>休暇残数</SectionTitle>
        {loading ? (
          <Spinner />
        ) : balances.length === 0 ? (
          <EmptyState title="付与された休暇がありません" hint="人事が休暇を付与するとここに表示されます。" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {balances.map((b) => {
              const remaining = b.grantedMinutes - b.usedMinutes;
              const unit = b.leaveType?.unit ?? 'day';
              return (
                <div key={b.id} className="rounded-panel border border-line bg-paper-surface p-4">
                  <div className="text-[13px] font-bold text-ink">{b.leaveType?.name ?? '休暇'}</div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="num text-[28px] font-bold text-brand-900">
                      {unit === 'hour' ? hhmm(remaining) : days(remaining)}
                    </span>
                    <span className="text-[12px] text-ink-faint">{unit === 'hour' ? '' : '日'} 残り</span>
                  </div>
                  <div className="num mt-2 text-[11px] text-ink-muted">
                    付与 {days(b.grantedMinutes)}日 ・ 取得 {days(b.usedMinutes)}日
                    {b.expiresOn ? ` ・ 失効 ${b.expiresOn.slice(0, 10)}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
