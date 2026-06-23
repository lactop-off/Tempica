'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiException } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Banner, Button, Field } from '@/components/ui';
import { clsx } from '@/components/ui/clsx';

const STEPS = ['管理者アカウント', '組織情報', '基本設定'];

export default function SetupPage() {
  const router = useRouter();
  const { reload } = useAuth();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [closeDay, setCloseDay] = useState('31');

  useEffect(() => {
    api
      .get<{ initialized: boolean }>('/setup/status')
      .then((r) => {
        if (r.initialized) router.replace('/login');
      })
      .catch(() => {});
  }, [router]);

  function next() {
    setError(null);
    if (step === 0 && (!adminName || !email || password.length < 8)) {
      setError('氏名・メール・8文字以上のパスワードを入力してください。');
      return;
    }
    if (step === 1 && !orgName) {
      setError('組織名を入力してください。');
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
    else void submit();
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/setup', {
        organization: { name: orgName, closeDay: Number(closeDay) || 31 },
        admin: { name: adminName, email, password },
      });
      await api.post('/auth/login', { email, password });
      await reload();
      router.replace('/dashboard');
    } catch (err) {
      const msg =
        err instanceof ApiException ? err.error.message : 'セットアップに失敗しました。';
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-surface px-4 py-8">
      <div className="w-[560px] max-w-full rounded-[20px] border border-line bg-white p-9 shadow-card">
        <div className="font-rounded text-[22px] font-extrabold text-brand-900">初期セットアップ</div>
        <div className="mt-1 text-[13px] text-ink-muted">
          自己ホスト環境を立ち上げます。3ステップで完了します。
        </div>

        <div className="my-7 flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className="flex flex-1 items-center gap-1.5">
              <div
                className={clsx(
                  'flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-bold',
                  i <= step ? 'bg-brand text-white' : 'bg-paper-surface text-ink-faint',
                )}
              >
                {i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={clsx('h-0.5 flex-1 rounded', i < step ? 'bg-brand' : 'bg-line-strong')}
                />
              )}
            </div>
          ))}
        </div>

        <div className="mb-4 font-rounded text-[15px] font-bold text-brand-900">{STEPS[step]}</div>

        {error && (
          <div className="mb-4">
            <Banner kind="error">{error}</Banner>
          </div>
        )}

        <div className="flex flex-col gap-3.5">
          {step === 0 && (
            <>
              <Field label="管理者氏名" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="管理 太郎" />
              <Field label="メールアドレス" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
              <Field label="パスワード（8文字以上）" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </>
          )}
          {step === 1 && (
            <Field label="組織名" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="株式会社サンプル" />
          )}
          {step === 2 && (
            <Field
              label="締め日（1〜31、末日は31）"
              type="number"
              min={1}
              max={31}
              value={closeDay}
              onChange={(e) => setCloseDay(e.target.value)}
            />
          )}
        </div>

        <div className="mt-7 flex justify-between">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || submitting}>
            戻る
          </Button>
          <Button onClick={next} disabled={submitting}>
            {step < STEPS.length - 1 ? '次へ' : submitting ? '作成中…' : 'セットアップ完了'}
          </Button>
        </div>
      </div>
    </div>
  );
}
