'use client';

import { useEffect, useState } from 'react';
import { api, ApiException, OrganizationInfo } from '@/lib/api';
import { Banner, Button, Card, Field, SectionTitle, Spinner } from '@/components/ui';

export default function OrganizationPage() {
  const [org, setOrg] = useState<OrganizationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState('');
  const [csvAllowUnclosed, setCsvAllowUnclosed] = useState(false);

  useEffect(() => {
    api
      .get<OrganizationInfo>('/organization')
      .then((o) => {
        setOrg(o);
        setName(o.name);
        setCsvAllowUnclosed(Boolean(o.settings?.csvAllowUnclosed));
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setError(null);
    setSaved(false);
    if (!name.trim()) return setError('組織名を入力してください。');
    setSaving(true);
    try {
      const next = await api.patch<OrganizationInfo>('/organization', {
        name,
        settings: { ...(org?.settings ?? {}), csvAllowUnclosed },
      });
      setOrg(next);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-content">
        <Card>
          <Spinner />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-content">
      <Card>
        <SectionTitle>組織情報</SectionTitle>
        {error && (
          <div className="mb-3">
            <Banner kind="error">{error}</Banner>
          </div>
        )}
        {saved && (
          <div className="mb-3">
            <Banner kind="info">保存しました。</Banner>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3.5">
          <Field label="組織名" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="mt-6">
          <SectionTitle>運用設定</SectionTitle>
          <label className="flex items-start gap-3 rounded-panel border border-line bg-paper-surface px-4 py-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={csvAllowUnclosed}
              onChange={(e) => setCsvAllowUnclosed(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-semibold text-ink">
                未締め期間の CSV 出力を許可する
              </span>
              <span className="block text-[12px] text-ink-muted">
                既定は無効（未締めが混在する期間の出力は 409 で拒否）。有効にすると締め前でも出力できます。
              </span>
            </span>
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
