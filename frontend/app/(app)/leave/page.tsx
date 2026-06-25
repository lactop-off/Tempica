'use client';

import { useEffect, useState } from 'react';
import { api, ApiException, LeaveBalance, LeaveType, Member } from '@/lib/api';
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
import { days, hhmm } from '@/lib/format';

export default function LeavePage() {
  const { me, can } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const canManage = can('leave', 'manage');

  async function loadBalances() {
    const b = await api.get<LeaveBalance[]>('/leave-balances').catch(() => []);
    setBalances(b);
  }
  useEffect(() => {
    loadBalances().finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-content">
      {canManage && <GrantCard onGranted={loadBalances} selfId={me?.user.id} />}

      <Card>
        <SectionTitle>休暇残数</SectionTitle>
        {loading ? (
          <Spinner />
        ) : balances.length === 0 ? (
          <EmptyState
            title="付与された休暇がありません"
            hint="人事が休暇を付与するとここに表示されます。"
          />
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

function GrantCard({
  onGranted,
  selfId,
}: {
  onGranted: () => void | Promise<void>;
  selfId?: string;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [userId, setUserId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [days, setDays] = useState('10');
  const [expiresOn, setExpiresOn] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    api.get<Member[]>('/users').then(setMembers).catch(() => {});
    api.get<LeaveType[]>('/leave-types').then(setTypes).catch(() => {});
  }, []);

  async function grant() {
    setError(null);
    setOk(false);
    const n = Number(days);
    if (!userId || !leaveTypeId) return setError('対象メンバーと休暇種別を選択してください。');
    if (!Number.isFinite(n) || n <= 0) return setError('付与日数を正しく入力してください。');
    setSaving(true);
    try {
      await api.post('/leave-balances', {
        userId,
        leaveTypeId,
        grantedMinutes: Math.round(n * 480), // 所定480分=1日換算
        expiresOn: expiresOn || undefined,
      });
      setOk(true);
      if (userId === selfId) await onGranted();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '付与に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-4">
      <SectionTitle>休暇を付与（人事）</SectionTitle>
      {error && (
        <div className="mb-3">
          <Banner kind="error">{error}</Banner>
        </div>
      )}
      {ok && (
        <div className="mb-3">
          <Banner kind="info">付与しました。</Banner>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <SelectField label="対象メンバー" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">選択…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="休暇種別"
          value={leaveTypeId}
          onChange={(e) => setLeaveTypeId(e.target.value)}
        >
          <option value="">選択…</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
        <Field
          label="付与日数"
          type="number"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
        <Field
          label="失効日（任意）"
          type="date"
          value={expiresOn}
          onChange={(e) => setExpiresOn(e.target.value)}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={grant} disabled={saving}>
          {saving ? '付与中…' : '付与'}
        </Button>
      </div>
    </Card>
  );
}
