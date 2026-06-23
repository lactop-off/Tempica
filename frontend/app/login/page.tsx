'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiException } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/icons';
import { Banner, Button, Field } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const { me, loading, reload } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [initialized, setInitialized] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && me) router.replace('/dashboard');
  }, [loading, me, router]);

  useEffect(() => {
    api
      .get<{ initialized: boolean }>('/setup/status')
      .then((r) => setInitialized(r.initialized))
      .catch(() => setInitialized(true));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/login', { email, password });
      await reload();
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiException && err.status === 401) {
        setError('メールアドレスまたはパスワードが正しくありません。');
      } else {
        setError('ログインに失敗しました。時間をおいて再度お試しください。');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-surface px-4">
      <div className="w-[380px] max-w-full">
        <div className="mb-7 flex flex-col items-center">
          <Logo size={52} />
          <div className="mt-3.5 font-rounded text-[26px] font-extrabold text-brand-900">Tempica</div>
          <div className="mt-1 text-[13px] text-ink-muted">勤怠管理システムにログイン</div>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-[18px] border border-line bg-white p-7 shadow-card"
        >
          {error && (
            <div className="mb-4">
              <Banner kind="error">{error}</Banner>
            </div>
          )}
          <Field
            label="メールアドレス"
            type="email"
            placeholder="you@example.com"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mb-4"
          />
          <Field
            label="パスワード"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" size="lg" className="mt-5 w-full" disabled={submitting}>
            {submitting ? 'ログイン中…' : 'ログイン'}
          </Button>
        </form>
        {initialized === false && (
          <div className="mt-5 text-center text-[12px] text-ink-faint">
            初回起動の場合は{' '}
            <Link href="/setup" className="font-semibold text-brand">
              初期セットアップ
            </Link>{' '}
            へ
          </div>
        )}
      </div>
    </div>
  );
}
