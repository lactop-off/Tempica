'use client';

import { useState } from 'react';
import { usePunch, punchButtons } from '@/lib/usePunch';
import { Card } from '@/components/ui';
import { clsx } from '@/components/ui/clsx';
import { IconPin } from '@/components/icons';
import { clockTime, PUNCH_LABEL } from '@/lib/format';

export default function PunchPage() {
  const punch = usePunch();
  const [geoMsg, setGeoMsg] = useState('位置情報は打刻時に取得します');
  const [toast, setToast] = useState<string | null>(null);

  const dateLabel = punch.now
    ? `${punch.now.getFullYear()}年${punch.now.getMonth() + 1}月${punch.now.getDate()}日（${'日月火水木金土'[punch.now.getDay()]}）`
    : '';

  async function doPunch(type: Parameters<typeof punch.punch>[0]) {
    let geo: { lat: number; lng: number } | undefined;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      geo = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setGeoMsg('位置情報：取得済み');
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          () => {
            setGeoMsg('位置情報：許可されていません（時刻のみ記録）');
            resolve(undefined as any);
          },
          { timeout: 4000 },
        );
      });
    }
    const ok = await punch.punch(type, geo);
    if (ok) {
      setToast(`${PUNCH_LABEL[type]}を記録しました`);
      setTimeout(() => setToast(null), 2500);
    }
  }

  const sorted = [...punch.records].sort((a, b) => a.punchedAt.localeCompare(b.punchedAt));

  return (
    <div className="mx-auto max-w-[560px]">
      <Card className="rounded-[20px] p-8 text-center">
        <div className="text-[13px] text-ink-muted">{dateLabel}</div>
        <div className="num my-1 text-[64px] font-bold leading-none tracking-tight text-brand-900">
          {punch.clock}
        </div>
        <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1.5">
          <span className="h-2 w-2 rounded-full bg-ok-bright" />
          <span className="text-[13px] font-bold text-brand-600">{punch.statusLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          {punchButtons(punch.state).map((b) => (
            <button
              key={b.type}
              disabled={!b.enabled || punch.busy}
              onClick={() => doPunch(b.type)}
              className={clsx(
                'h-[72px] rounded-panel font-rounded text-lg font-bold transition disabled:cursor-not-allowed disabled:opacity-40',
                b.primary
                  ? 'bg-brand text-white shadow-brand hover:bg-brand-600'
                  : 'border border-line-strong bg-white text-ink-label hover:bg-paper-surface',
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-faint">
          <IconPin width={14} height={14} />
          <span>{geoMsg}</span>
        </div>
        {punch.error && <div className="mt-3 text-[13px] font-bold text-danger">{punch.error}</div>}
      </Card>

      <Card className="mt-4">
        <div className="mb-2 font-rounded text-sm font-bold text-brand-900">本日の打刻履歴</div>
        {sorted.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-ink-faint">
            まだ打刻がありません。
            <br />
            出勤ボタンから1日を始めましょう。
          </div>
        ) : (
          <div className="flex flex-col">
            {sorted.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b border-line-soft py-3 last:border-0">
                <span
                  className={clsx(
                    'h-2.5 w-2.5 rounded-full',
                    p.punchType === 'clock_in'
                      ? 'bg-ok-bright'
                      : p.punchType === 'clock_out'
                        ? 'bg-danger-bright'
                        : 'bg-warn-bright',
                  )}
                />
                <span className="flex-1 text-[13px] font-medium text-ink">{PUNCH_LABEL[p.punchType]}</span>
                <span className="num text-[15px] font-semibold text-brand-900">{clockTime(p.punchedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-control bg-brand-900 px-5 py-3 text-sm font-bold text-white shadow-float md:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}
