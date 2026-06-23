'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiException, RequestItem } from '@/lib/api';
import { Button, Card, EmptyState, SectionTitle, Spinner, StatusBadge } from '@/components/ui';
import { clsx } from '@/components/ui/clsx';
import { REQUEST_TYPE_LABEL, ymd } from '@/lib/format';

const FILTERS = [
  { key: '', label: 'すべて' },
  { key: 'pending', label: '承認待ち' },
  { key: 'approved', label: '承認済み' },
  { key: 'rejected', label: '差戻し' },
];

export default function RequestsPage() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<RequestItem | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const q = filter ? `?status=${filter}` : '';
      setItems(await api.get<RequestItem[]>(`/requests${q}`));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function cancel(r: RequestItem) {
    setMsg(null);
    try {
      await api.post(`/requests/${r.id}/cancel`);
      setSelected(null);
      await load();
    } catch (e) {
      setMsg(e instanceof ApiException ? e.error.message : '取消に失敗しました');
    }
  }

  return (
    <div className="mx-auto grid max-w-content grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={clsx(
                  'rounded-control px-3 py-1.5 text-[13px] font-bold',
                  filter === f.key ? 'bg-brand-100 text-brand-600' : 'text-ink-muted hover:bg-paper-card',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Link href="/requests/new" className="btn-primary h-9 px-4 text-[13px]">＋ 新規申請</Link>
        </div>

        <Card>
          {loading ? (
            <Spinner />
          ) : items.length === 0 ? (
            <EmptyState title="申請はありません" hint="右上の「新規申請」から作成できます。" />
          ) : (
            <div className="flex flex-col">
              {items.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={clsx(
                    'flex items-center gap-3 border-b border-line-soft py-3 text-left last:border-0',
                    selected?.id === r.id && 'bg-brand-50',
                  )}
                >
                  <div className="flex-1">
                    <div className="text-sm font-bold text-ink">{REQUEST_TYPE_LABEL[r.type] ?? r.type}</div>
                    <div className="num text-[11px] text-ink-faint">
                      {r.payload?.target_date ?? ymd(r.createdAt)}
                      {r.status === 'pending' ? ` ・ ステップ ${r.currentStep}` : ''}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="h-fit">
        <SectionTitle>詳細</SectionTitle>
        {!selected ? (
          <div className="py-8 text-center text-[13px] text-ink-faint">申請を選択してください</div>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold text-ink">{REQUEST_TYPE_LABEL[selected.type] ?? selected.type}</span>
              <StatusBadge status={selected.status} />
            </div>
            <KV label="対象日">{selected.payload?.target_date ?? '—'}</KV>
            <KV label="理由">{selected.payload?.reason ?? '—'}</KV>
            {selected.leaveType && <KV label="休暇種別">{selected.leaveType.name}</KV>}
            {selected.approvals && selected.approvals.length > 0 && (
              <div>
                <div className="label">承認ステップ</div>
                <div className="flex flex-col gap-1">
                  {selected.approvals.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-[13px]">
                      <span className="text-ink-muted">ステップ {a.step}</span>
                      <StatusBadge status={a.result} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {msg && <div className="text-xs font-bold text-danger">{msg}</div>}
            {selected.status === 'pending' && (
              <Button variant="ghost" onClick={() => cancel(selected)} className="mt-1">
                この申請を取消
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line-soft pb-2">
      <div className="text-[11px] font-bold text-ink-faint">{label}</div>
      <div className="mt-0.5 text-ink">{children}</div>
    </div>
  );
}
