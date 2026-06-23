'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api, ApprovalItem } from '@/lib/api';
import { clsx } from '@/components/ui/clsx';
import { Logo, IconBell, IconLogout } from '@/components/icons';
import { NAV, BOTTOM_NAV, NavItem } from './nav';
import { Spinner } from '@/components/ui';

function useApprovalBadge(enabled: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    api
      .get<ApprovalItem[]>('/approvals')
      .then((r) => setCount(r.length))
      .catch(() => setCount(0));
  }, [enabled]);
  return count;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { me, loading, can, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !me) router.replace('/login');
  }, [loading, me, router]);

  const canApprove = can('approval', 'approve');
  const approvalCount = useApprovalBadge(canApprove);

  if (loading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-surface">
        <Spinner />
      </div>
    );
  }

  const roleLabel = me.permissions.some((p) => p.feature === 'role' && p.action === 'manage')
    ? '管理者'
    : me.permissions.some((p) => p.feature === 'approval' && p.action === 'approve')
      ? '管理者・承認者'
      : '一般従業員';

  const visible = (it: NavItem) => !it.perm || can(it.perm[0], it.perm[1]);
  const badgeFor = (it: NavItem) => (it.badge === 'approvals' && approvalCount > 0 ? approvalCount : null);

  const screenLabel =
    NAV.flatMap((s) => s.items).find((i) => pathname.startsWith(i.href))?.label ?? 'Tempica';

  return (
    <div className="min-h-screen bg-paper-surface">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        {/* sidebar (desktop) */}
        <aside className="hidden w-[236px] flex-none border-r border-line bg-paper-surface px-3 py-4 md:block">
          <Link href="/dashboard" className="mb-4 flex items-center gap-2.5 px-3 py-1">
            <Logo size={28} />
            <span className="font-rounded text-xl font-extrabold tracking-tight text-brand-900">
              Tempica
            </span>
          </Link>
          {NAV.map((sec) => {
            const items = sec.items.filter(visible);
            if (!items.length) return null;
            return (
              <div key={sec.title} className="mb-1">
                <div className="px-3 pb-1.5 pt-2.5 text-[10.5px] font-bold tracking-[0.1em] text-ink-faint">
                  {sec.title}
                </div>
                {items.map((it) => {
                  const active = pathname.startsWith(it.href);
                  const badge = badgeFor(it);
                  const Icon = it.icon;
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      className={clsx(
                        'mb-0.5 flex items-center gap-2.5 rounded-control px-3 py-2 text-[13.5px] font-medium transition',
                        active
                          ? 'bg-brand-100 font-bold text-brand-600'
                          : 'text-ink hover:bg-paper-card',
                      )}
                    >
                      <span className="flex w-5 justify-center">
                        <Icon width={18} height={18} />
                      </span>
                      <span className="flex-1">{it.label}</span>
                      {badge != null && (
                        <span className="num rounded-[9px] bg-brand px-1.5 py-px text-[10px] font-bold text-white">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </aside>

        {/* main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* header */}
          <header className="flex h-[60px] flex-none items-center gap-4 border-b border-line bg-white px-4 md:px-6">
            <div className="flex items-center gap-2 md:hidden">
              <Logo size={24} />
            </div>
            <div className="hidden font-rounded text-[17px] font-extrabold text-brand-900 md:block">
              {screenLabel}
            </div>
            <div className="flex-1" />
            <Link
              href="/notifications"
              className="relative flex h-[34px] w-[34px] items-center justify-center rounded-control border border-line bg-paper-surface text-ink-muted"
              aria-label="通知"
            >
              <IconBell width={18} height={18} />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-brand-100 font-rounded text-sm font-extrabold text-brand-600">
                {me.user.name.slice(0, 1)}
              </div>
              <div className="hidden leading-tight sm:block">
                <div className="text-[13px] font-bold text-ink">{me.user.name}</div>
                <div className="text-[11px] text-ink-faint">{roleLabel}</div>
              </div>
              <button
                onClick={() => logout().then(() => router.replace('/login'))}
                className="ml-1 flex h-[34px] w-[34px] items-center justify-center rounded-control border border-line bg-paper-surface text-ink-muted hover:text-danger"
                aria-label="ログアウト"
              >
                <IconLogout width={17} height={17} />
              </button>
            </div>
          </header>

          {/* content */}
          <main className="flex-1 px-4 pb-24 pt-6 md:px-7 md:pb-8">{children}</main>
        </div>
      </div>

      {/* bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white md:hidden">
        {BOTTOM_NAV.filter(visible).map((it) => {
          const active = pathname.startsWith(it.href);
          const badge = badgeFor(it);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={clsx(
                'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold',
                active ? 'text-brand-600' : 'text-ink-faint',
              )}
            >
              <Icon width={20} height={20} />
              {it.label}
              {badge != null && (
                <span className="num absolute right-1/4 top-1 rounded-full bg-danger px-1 text-[8px] text-white">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
