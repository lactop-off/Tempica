'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiException, TimeRecord } from './api';

export type PunchState = 'out' | 'in' | 'break';

function deriveState(records: TimeRecord[]): PunchState {
  let state: PunchState = 'out';
  for (const r of [...records].sort((a, b) => a.punchedAt.localeCompare(b.punchedAt))) {
    if (r.punchType === 'clock_in') state = 'in';
    else if (r.punchType === 'clock_out') state = 'out';
    else if (r.punchType === 'break_start' && state === 'in') state = 'break';
    else if (r.punchType === 'break_end' && state === 'break') state = 'in';
  }
  return state;
}

const STATUS_LABEL: Record<PunchState, string> = {
  out: '未出勤',
  in: '勤務中',
  break: '休憩中',
};

/** 当日の打刻状態と打刻アクションを提供する。 */
export function usePunch() {
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // クライアントのみで時刻を持つ（SSR ハイドレーション不一致を避ける）
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get<TimeRecord[]>('/time-records');
      setRecords(r);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const state = deriveState(records);

  const punch = useCallback(
    async (punchType: TimeRecord['punchType'], geo?: { lat: number; lng: number }) => {
      setBusy(true);
      setError(null);
      try {
        await api.post('/time-records', {
          punch_type: punchType,
          source: 'web',
          ...(geo ? { geo } : {}),
        });
        await refresh();
        return true;
      } catch (e) {
        setError(e instanceof ApiException ? e.error.message : '打刻に失敗しました');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const clock = now
    ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    : '--:--:--';

  return {
    records,
    loading,
    busy,
    error,
    state,
    statusLabel: STATUS_LABEL[state],
    clock,
    now,
    punch,
    refresh,
  };
}

/** 状態に応じて有効な打刻ボタンの定義。 */
export function punchButtons(state: PunchState) {
  return [
    { type: 'clock_in' as const, label: '出勤', enabled: state === 'out', primary: true },
    { type: 'clock_out' as const, label: '退勤', enabled: state === 'in' || state === 'break', primary: false },
    { type: 'break_start' as const, label: '休憩開始', enabled: state === 'in', primary: false },
    { type: 'break_end' as const, label: '休憩終了', enabled: state === 'break', primary: false },
  ];
}
