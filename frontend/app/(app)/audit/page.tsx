'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, EmptyState, SectionTitle, Spinner } from '@/components/ui';

interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  target: string | null;
  detail: Record<string, any> | null;
  at: string;
}

// アクションの日本語ラベル（無いものはそのまま表示）
const ACTION_LABEL: Record<string, string> = {
  'setup.completed': '初期セットアップ完了',
  'member.create': 'メンバー作成',
  'member.update': 'メンバー更新',
  'role.create': 'ロール作成',
  'role.update': 'ロール更新',
  'role.delete': 'ロール削除',
  'workPattern.create': '勤務形態作成',
  'workRule.set': '就業ルール設定',
  'user.assignWorkPattern': '勤務形態割当',
  'request.create': '申請作成',
  'request.cancel': '申請取消',
  'approval.approved': '承認',
  'approval.rejected': '差戻し',
  'closing.close': '月次締め',
  'closing.reopen': '締め解除',
  'csv.export': 'CSV出力',
  'leaveBalance.grant': '休暇付与',
  'approvalRoute.create': '承認経路作成',
  'approvalRoute.update': '承認経路更新',
  'organization.update': '組織設定更新',
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const q = filter ? `?action=${encodeURIComponent(filter)}` : '';
    setLoading(true);
    api.get<AuditLog[]>(`/audit-logs${q}`).then(setLogs).catch(() => setLogs([])).finally(() => setLoading(false));
  }, [filter]);

  const actions = Array.from(new Set(logs.map((l) => l.action)));

  return (
    <div className="mx-auto max-w-content">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-ink-muted">重要操作の証跡</div>
        <select className="field h-9 w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">すべての操作</option>
          {actions.map((a) => <option key={a} value={a}>{ACTION_LABEL[a] ?? a}</option>)}
        </select>
      </div>
      <Card>
        <SectionTitle>監査ログ</SectionTitle>
        {loading ? (
          <Spinner />
        ) : logs.length === 0 ? (
          <EmptyState title="ログがありません" />
        ) : (
          <div className="flex flex-col">
            {logs.map((l) => (
              <div key={l.id} className="flex items-start gap-3 border-b border-line-soft py-2.5 last:border-0">
                <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-brand-200" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-ink">{ACTION_LABEL[l.action] ?? l.action}</div>
                  {l.target && <div className="num truncate text-[11px] text-ink-faint">対象: {l.target}</div>}
                </div>
                <div className="num whitespace-nowrap text-[11px] text-ink-faint">
                  {new Date(l.at).toLocaleString('ja-JP')}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
