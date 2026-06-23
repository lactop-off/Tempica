'use client';

import { useEffect, useState } from 'react';
import { api, ApiException } from '@/lib/api';
import { Banner, Button, Card, SectionTitle, Spinner } from '@/components/ui';
import { ym } from '@/lib/format';

interface Precheck {
  period: string;
  status: string;
  pendingRequests: number;
  openSummaries: number;
  warnings: string[];
}

export default function ClosingPage() {
  const [period, setPeriod] = useState(() => ym(new Date()));
  const [pre, setPre] = useState<Precheck | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'info' | 'error' | 'warn'; text: string } | null>(null);

  async function check() {
    setLoading(true);
    setMsg(null);
    try {
      setPre(await api.get<Precheck>(`/closings/precheck?period=${period}`));
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof ApiException ? e.error.message : '取得に失敗しました' });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  async function close() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post<{ status: string; warnings: string[] }>('/closings', { period });
      setMsg({
        kind: r.warnings?.length ? 'warn' : 'info',
        text: r.warnings?.length ? `締めました（${r.warnings.join(' / ')}）` : '締め処理が完了しました。',
      });
      await check();
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof ApiException ? e.error.message : '締めに失敗しました' });
    } finally {
      setBusy(false);
    }
  }

  const closed = pre?.status === 'closed';
  const csvUrl = `/api/v1/exports/csv?period=${period}`;

  return (
    <div className="mx-auto grid max-w-content grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle>月次締め</SectionTitle>
        <label className="label">対象期間</label>
        <input type="month" className="field mb-4" value={period} onChange={(e) => setPeriod(e.target.value)} />

        {loading ? (
          <Spinner />
        ) : pre ? (
          <div className="flex flex-col gap-2 text-sm">
            <Row label="ステータス">
              <span className={closed ? 'font-bold text-ok' : 'font-bold text-warn'}>{closed ? '締め済み' : '未締め'}</span>
            </Row>
            <Row label="未承認の申請"><span className="num">{pre.pendingRequests} 件</span></Row>
            <Row label="未確定の日次"><span className="num">{pre.openSummaries} 件</span></Row>
          </div>
        ) : null}

        {pre && pre.pendingRequests > 0 && !closed && (
          <div className="mt-3"><Banner kind="warn">未承認の申請が {pre.pendingRequests} 件あります。</Banner></div>
        )}
        {msg && <div className="mt-3"><Banner kind={msg.kind}>{msg.text}</Banner></div>}

        <Button className="mt-4 w-full" onClick={close} disabled={busy || closed}>
          {closed ? '締め済み' : busy ? '処理中…' : '月次を締める'}
        </Button>
      </Card>

      <Card>
        <SectionTitle>CSV 出力</SectionTitle>
        <p className="mb-4 text-[13px] text-ink-muted">
          給与システム向けに勤怠 CSV を出力します。マッピング未指定時は既定の項目セットで出力します。
          {!closed && <span className="text-warn">（未締めの場合、組織設定により拒否されることがあります）</span>}
        </p>
        <a href={csvUrl} className="btn-primary h-11 w-full" download>
          {period} の CSV をダウンロード
        </a>
        <div className="mt-3 text-[12px] text-ink-faint">
          UTF-8（BOM付）で出力。Shift_JIS が必要な場合は CSV マッピングで設定できます。
        </div>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft pb-2 last:border-0">
      <span className="text-ink-muted">{label}</span>
      {children}
    </div>
  );
}
