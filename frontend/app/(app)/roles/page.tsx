'use client';

import { useEffect, useState } from 'react';
import { api, Role } from '@/lib/api';
import { Card, EmptyState, SectionTitle, Spinner } from '@/components/ui';

const SCOPE_LABEL: Record<string, string> = {
  self: '自分',
  department: '部署',
  location: '拠点',
  org: '全社',
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.get<Role[]>('/roles').then(setRoles).catch(() => setRoles([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-content">
      <Card>
        <SectionTitle>ロール・権限</SectionTitle>
        {loading ? (
          <Spinner />
        ) : roles.length === 0 ? (
          <EmptyState title="ロールがありません" />
        ) : (
          <div className="flex flex-col gap-2">
            {roles.map((r) => (
              <div key={r.id} className="rounded-panel border border-line bg-paper-surface">
                <button
                  onClick={() => setOpen(open === r.id ? null : r.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="font-bold text-ink">{r.name}</span>
                  {r.isTemplate && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-600">テンプレート</span>
                  )}
                  <span className="flex-1" />
                  <span className="num text-[12px] text-ink-faint">{r.permissions?.length ?? 0} 権限</span>
                </button>
                {open === r.id && (
                  <div className="border-t border-line px-4 py-3">
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {(r.permissions ?? []).map((p, i) => (
                        <div key={i} className="flex items-center justify-between rounded-control bg-white px-3 py-1.5 text-[12px]">
                          <span className="text-ink-muted">{p.feature} · {p.action}</span>
                          <span className="font-bold text-brand-600">{SCOPE_LABEL[p.scope] ?? p.scope}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
