'use client';

import { useEffect, useState } from 'react';
import { api, ApiException, ApprovalItem } from '@/lib/api';
import { Banner, Button, Card, EmptyState, Spinner } from '@/components/ui';
import { REQUEST_TYPE_LABEL, ymd } from '@/lib/format';

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setItems(await api.get<ApprovalItem[]>('/approvals'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function act(a: ApprovalItem, result: 'approved' | 'rejected') {
    setError(null);
    const comment = comments[a.id]?.trim() ?? '';
    if (result === 'rejected' && !comment) {
      setError('差戻しにはコメントが必須です。');
      return;
    }
    setBusy(a.id);
    try {
      await api.post(`/approvals/${a.id}`, { result, comment: comment || undefined });
      await load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '処理に失敗しました');
      if (e instanceof ApiException && e.status === 409) await load();
    } finally {
      setBusy(null);
    }
  }

  async function approveAll() {
    for (const a of items) {
      try {
        await api.post(`/approvals/${a.id}`, { result: 'approved' });
      } catch {
        /* 競合等はスキップ */
      }
    }
    await load();
  }

  return (
    <div className="mx-auto max-w-content">
      {error && <div className="mb-3"><Banner kind="error">{error}</Banner></div>}

      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-ink-muted">
          承認待ち <span className="num font-bold text-brand-900">{items.length}</span> 件
        </div>
        {items.length > 1 && (
          <Button variant="soft" size="sm" onClick={approveAll}>一括承認</Button>
        )}
      </div>

      {loading ? (
        <Card><Spinner /></Card>
      ) : items.length === 0 ? (
        <Card><EmptyState title="承認待ちはありません" hint="新しい申請が届くとここに表示されます。" /></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{a.request.user.name}</span>
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-600">
                      {REQUEST_TYPE_LABEL[a.request.type] ?? a.request.type}
                    </span>
                  </div>
                  <div className="num mt-1 text-[12px] text-ink-faint">
                    対象日 {a.request.payload?.target_date ?? ymd(a.request.createdAt)}
                  </div>
                  {a.request.payload?.reason && (
                    <div className="mt-1.5 text-[13px] text-ink-muted">理由：{a.request.payload.reason}</div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="field flex-1"
                  placeholder="コメント（差戻し時は必須）"
                  value={comments[a.id] ?? ''}
                  onChange={(e) => setComments((c) => ({ ...c, [a.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" disabled={busy === a.id} onClick={() => act(a, 'rejected')}>
                    差戻し
                  </Button>
                  <Button size="sm" disabled={busy === a.id} onClick={() => act(a, 'approved')}>
                    承認
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
