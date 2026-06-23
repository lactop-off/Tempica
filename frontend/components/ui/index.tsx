'use client';

import { clsx } from './clsx';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { REQUEST_STATUS_LABEL } from '@/lib/format';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('card p-5', className)}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3.5 flex items-center justify-between">
      <div className="font-rounded text-sm font-bold text-brand-900">{children}</div>
      {right}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'soft';
  size?: 'sm' | 'md' | 'lg';
};
export function Button({ variant = 'primary', size = 'md', className, ...rest }: BtnProps) {
  const v =
    variant === 'ghost' ? 'btn-ghost' : variant === 'soft' ? 'btn-soft' : 'btn-primary';
  const s =
    size === 'lg' ? 'h-12 px-6 text-[15px]' : size === 'sm' ? 'h-9 px-3.5 text-[13px]' : 'h-11 px-5 text-sm';
  return <button className={clsx(v, s, className)} {...rest} />;
}

export function Field({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <input className="field" {...rest} />
    </div>
  );
}

export function SelectField({
  label,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <select className="field" {...rest}>
        {children}
      </select>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-warn-bg text-warn border border-warn-border',
  approved: 'bg-ok-bg text-ok border border-ok-border',
  rejected: 'bg-danger-bg text-danger border border-danger-border',
  canceled: 'bg-paper-surface text-ink-faint border border-line',
  open: 'bg-warn-bg text-warn border border-warn-border',
  closed: 'bg-ok-bg text-ok border border-ok-border',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold',
        STATUS_STYLE[status] ?? 'bg-paper-surface text-ink-muted border border-line',
      )}
    >
      {label ?? REQUEST_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
      <div className="text-sm font-bold text-ink-muted">{title}</div>
      {hint && <div className="text-xs text-ink-faint">{hint}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-faint">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
      {label ?? '読込中…'}
    </div>
  );
}

export function Banner({ kind, children }: { kind: 'error' | 'warn' | 'info'; children: ReactNode }) {
  const map = {
    error: 'bg-danger-bg border-danger-border text-danger',
    warn: 'bg-warn-bg border-warn-border text-warn',
    info: 'bg-brand-50 border-brand-200 text-brand-600',
  };
  return (
    <div className={clsx('rounded-control border px-3.5 py-3 text-[13px]', map[kind])}>{children}</div>
  );
}
