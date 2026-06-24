'use client';

import { useEffect, useState } from 'react';
import { api, ApiException, Member, WorkPattern } from '@/lib/api';
import { Banner, Button, Card, Field, SectionTitle, SelectField } from '@/components/ui';
import { ymd } from '@/lib/format';

interface Assignment {
  id: string;
  workPatternId: string;
  startDate: string;
  endDate: string | null;
  workPattern?: { name: string };
}

/** 勤務形態の個人割当（有効期間つき）。設計書 S-13 の個人割当に対応。 */
export function AssignCard({ patterns }: { patterns: WorkPattern[] }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [userId, setUserId] = useState('');
  const [patternId, setPatternId] = useState('');
  const [startDate, setStartDate] = useState(ymd(new Date()));
  const [endDate, setEndDate] = useState('');
  const [history, setHistory] = useState<Assignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Member[]>('/users').then((m) => {
      setMembers(m);
      if (m[0]) setUserId(m[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (patterns[0]) setPatternId((p) => p || patterns[0].id);
  }, [patterns]);

  useEffect(() => {
    if (!userId) return;
    api.get<Assignment[]>(`/users/${userId}/work-patterns`).then(setHistory).catch(() => setHistory([]));
  }, [userId]);

  async function assign() {
    setError(null);
    if (!userId || !patternId) return setError('従業員と勤務形態を選択してください。');
    setSaving(true);
    try {
      await api.post(`/users/${userId}/work-patterns`, {
        workPatternId: patternId,
        startDate,
        endDate: endDate || undefined,
      });
      const h = await api.get<Assignment[]>(`/users/${userId}/work-patterns`);
      setHistory(h);
      setEndDate('');
    } catch (e) {
      if (e instanceof ApiException && e.error.code === 'overlap') {
        setError('割当期間が既存の割当と重複しています。期間を見直してください。');
      } else {
        setError(e instanceof ApiException ? e.error.message : '割当に失敗しました');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-4">
      <SectionTitle>従業員への割当（有効期間つき）</SectionTitle>
      {error && <div className="mb-3"><Banner kind="error">{error}</Banner></div>}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <SelectField label="従業員" value={userId} onChange={(e) => setUserId(e.target.value)}>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </SelectField>
        <SelectField label="勤務形態" value={patternId} onChange={(e) => setPatternId(e.target.value)}>
          {patterns.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </SelectField>
        <Field label="開始日" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Field label="終了日（空=現在も有効）" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={assign} disabled={saving}>{saving ? '割当中…' : 'この期間で割当'}</Button>
      </div>

      {history.length > 0 && (
        <div className="mt-5">
          <div className="label">割当履歴</div>
          <div className="flex flex-col">
            {history.map((a) => (
              <div key={a.id} className="flex items-center gap-3 border-b border-line-soft py-2 text-[13px] last:border-0">
                <span className="flex-1 font-medium text-ink">{a.workPattern?.name ?? '勤務形態'}</span>
                <span className="num text-ink-muted">
                  {a.startDate.slice(0, 10)} 〜 {a.endDate ? a.endDate.slice(0, 10) : '現在'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
