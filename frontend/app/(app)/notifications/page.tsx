'use client';

import { useEffect, useState } from 'react';
import { api, Notification } from '@/lib/api';
import { Card, EmptyState, SectionTitle, Spinner } from '@/components/ui';
import { clsx } from '@/components/ui/clsx';

const TYPE_LABEL: Record<string, string> = {
  'request.approved': '申請が承認されました',
  'request.rejected': '申請が差し戻されました',
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setItems(await api.get<Notification[]>('/notifications'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function read(n: Notification) {
    if (n.read) return;
    await api.post(`/notifications/${n.id}/read`).catch(() => {});
    setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
  }

  return (
    <div className="mx-auto max-w-[680px]">
      <Card>
        <SectionTitle>通知</SectionTitle>
        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState title="通知はありません" />
        ) : (
          <div className="flex flex-col">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => read(n)}
                className="flex items-start gap-3 border-b border-line-soft py-3 text-left last:border-0"
              >
                <span className={clsx('mt-1.5 h-2 w-2 flex-none rounded-full', n.read ? 'bg-line-strong' : 'bg-brand')} />
                <div className="flex-1">
                  <div className={clsx('text-[13px]', n.read ? 'text-ink-muted' : 'font-bold text-ink')}>
                    {TYPE_LABEL[n.type] ?? n.type}
                  </div>
                  <div className="num text-[11px] text-ink-faint">{new Date(n.createdAt).toLocaleString('ja-JP')}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
