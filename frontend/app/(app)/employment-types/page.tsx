'use client';

import { useEffect, useState } from 'react';
import { api, ApiException, EmploymentType } from '@/lib/api';
import { Banner, Button, Card, EmptyState, Field, SectionTitle, Spinner } from '@/components/ui';

export default function EmploymentTypesPage() {
  const [types, setTypes] = useState<EmploymentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function load() {
    setLoading(true);
    try {
      setTypes(await api.get<EmploymentType[]>('/employment-types'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setError(null);
    if (!name.trim()) return setError('区分名を入力してください。');
    setSaving(true);
    try {
      await api.post('/employment-types', { name });
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    try {
      await api.patch(`/employment-types/${id}`, { name: editName });
      setEditId(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '更新に失敗しました');
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.del(`/employment-types/${id}`);
      await load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : '削除に失敗しました');
    }
  }

  return (
    <div className="mx-auto max-w-content">
      <Card className="mb-4">
        <SectionTitle>雇用区分を追加</SectionTitle>
        {error && (
          <div className="mb-3">
            <Banner kind="error">{error}</Banner>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field
              label="区分名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="正社員 / 契約社員 / パート など"
            />
          </div>
          <Button onClick={create} disabled={saving}>
            {saving ? '追加中…' : '追加'}
          </Button>
        </div>
      </Card>

      <Card>
        {loading ? (
          <Spinner />
        ) : types.length === 0 ? (
          <EmptyState title="雇用区分がありません" hint="正社員・契約社員などをメンバー割当用に登録します。" />
        ) : (
          <div className="flex flex-col gap-2">
            {types.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-panel border border-line bg-paper-surface px-4 py-2.5"
              >
                {editId === t.id ? (
                  <>
                    <input
                      className="field h-9 flex-1"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <button onClick={() => saveEdit(t.id)} className="text-[12px] font-semibold text-brand">
                      保存
                    </button>
                    <button onClick={() => setEditId(null)} className="text-[12px] text-ink-muted">
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-semibold text-ink">{t.name}</span>
                    <button
                      onClick={() => {
                        setEditId(t.id);
                        setEditName(t.name);
                      }}
                      className="text-[12px] text-ink-muted"
                    >
                      編集
                    </button>
                    <button onClick={() => remove(t.id)} className="text-[12px] text-danger">
                      削除
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
