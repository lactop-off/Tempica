'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiException } from '@/lib/api';
import { Banner, Button, Card, Field, SelectField } from '@/components/ui';
import { clsx } from '@/components/ui/clsx';
import { ymd } from '@/lib/format';

const TYPES = [
  { key: 'punch_fix', label: '打刻修正' },
  { key: 'overtime', label: '残業' },
  { key: 'late_early', label: '遅刻・早退' },
  { key: 'leave', label: '休暇' },
  { key: 'direct', label: '直行直帰' },
  { key: 'business_trip', label: '出張' },
];

interface LeaveType {
  id: string;
  name: string;
  unit: string;
}

export default function NewRequestPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [type, setType] = useState(params.get('type') ?? 'punch_fix');
  const [targetDate, setTargetDate] = useState(ymd(new Date()));
  const [reason, setReason] = useState('');
  const [fixTime, setFixTime] = useState('18:00');
  const [fixPunch, setFixPunch] = useState('clock_out');
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [leaveDays, setLeaveDays] = useState('1');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<LeaveType[]>('/leave-types')
      .then((t) => {
        setLeaveTypes(t);
        if (t[0]) setLeaveTypeId(t[0].id);
      })
      .catch(() => {});
  }, []);

  async function submit() {
    setError(null);
    setWarnings([]);
    if (!reason.trim()) {
      setError('理由を入力してください。');
      return;
    }
    const payload: Record<string, any> = { target_date: targetDate, reason };
    let leave_type_id: string | undefined;
    if (type === 'punch_fix') {
      payload.fix = [{ punch_type: fixPunch, punched_at: `${targetDate}T${fixTime}:00+09:00` }];
    } else if (type === 'leave') {
      leave_type_id = leaveTypeId;
      payload.days = Number(leaveDays);
    } else if (type === 'business_trip') {
      payload.destination = destination;
    }

    setSubmitting(true);
    try {
      const res = await api.post<{ warnings?: string[] }>('/requests', { type, leave_type_id, payload });
      if (res.warnings && res.warnings.length) {
        setWarnings(res.warnings);
        setTimeout(() => router.push('/requests'), 1200);
      } else {
        router.push('/requests');
      }
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '送信に失敗しました。');
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <Card>
        <div className="mb-4 font-rounded text-base font-bold text-brand-900">申請を作成</div>

        <div className="mb-5 flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={clsx(
                'rounded-control px-3.5 py-2 text-[13px] font-bold',
                type === t.key ? 'bg-brand text-white shadow-brand' : 'border border-line-strong bg-white text-ink-label hover:bg-paper-surface',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <div className="mb-3"><Banner kind="error">{error}</Banner></div>}
        {warnings.map((w, i) => (
          <div key={i} className="mb-3"><Banner kind="warn">{w}（申請は受け付けました）</Banner></div>
        ))}

        <div className="flex flex-col gap-3.5">
          <Field label="対象日" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />

          {type === 'punch_fix' && (
            <div className="grid grid-cols-2 gap-3.5">
              <SelectField label="打刻種別" value={fixPunch} onChange={(e) => setFixPunch(e.target.value)}>
                <option value="clock_in">出勤</option>
                <option value="clock_out">退勤</option>
                <option value="break_start">休憩開始</option>
                <option value="break_end">休憩終了</option>
              </SelectField>
              <Field label="正しい時刻" type="time" value={fixTime} onChange={(e) => setFixTime(e.target.value)} />
            </div>
          )}

          {type === 'leave' && (
            <div className="grid grid-cols-2 gap-3.5">
              <SelectField label="休暇種別" value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
                {leaveTypes.length === 0 && <option value="">（種別未設定）</option>}
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </SelectField>
              <Field label="日数" type="number" min={0.5} step={0.5} value={leaveDays} onChange={(e) => setLeaveDays(e.target.value)} />
            </div>
          )}

          {type === 'business_trip' && (
            <Field label="行先" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="例：大阪支社" />
          )}

          <div>
            <label className="label">理由</label>
            <textarea
              className="field h-24 resize-none py-2.5"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="申請の理由を入力してください"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => router.back()}>キャンセル</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? '送信中…' : '申請を送信'}</Button>
        </div>
      </Card>
    </div>
  );
}
