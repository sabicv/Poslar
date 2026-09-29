import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// Server-safe building blocks (no hooks). Tap targets are at least 44 px,
// "lg" is 56 px for gloved hands.

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ok';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-110 active:brightness-95 shadow-[0_0_0_1px_rgb(var(--accent)/0.4)]',
  secondary: 'bg-surface2 text-fg border border-line hover:border-faint/60',
  ghost: 'text-muted hover:text-fg hover:bg-surface2',
  danger: 'bg-crit/12 text-crit border border-crit/30 hover:bg-crit/20',
  ok: 'bg-ok/12 text-ok border border-ok/30 hover:bg-ok/20',
};

const SIZES: Record<Size, string> = {
  // 44 px on phones (gloves), compact 36 px from the sm breakpoint up.
  sm: 'h-11 sm:h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-14 px-5 text-base gap-2.5 rounded-xl',
};

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background,border,filter,color] duration-100 disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...props }, ref) {
    return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
  }
);

export function ButtonLink({
  href,
  variant = 'secondary',
  size = 'md',
  className,
  children,
  prefetch,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
}) {
  return (
    <Link href={href} prefetch={prefetch} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl border border-line bg-surface', className)}>{children}</div>;
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'crit' | 'muted';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface2 text-fg border-line',
  accent: 'bg-accent/15 text-accent border-accent/30',
  ok: 'bg-ok/12 text-ok border-ok/30',
  warn: 'bg-warn/12 text-warn border-warn/30',
  crit: 'bg-crit/12 text-crit border-crit/30',
  muted: 'bg-transparent text-faint border-line',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-xs font-medium', TONES[tone], className)}>
      {children}
    </span>
  );
}

const DOTS: Record<Tone, string> = {
  neutral: 'bg-fg',
  accent: 'bg-accent',
  ok: 'bg-ok',
  warn: 'bg-warn',
  crit: 'bg-crit',
  muted: 'bg-faint',
};

export function Dot({ tone = 'accent', className }: { tone?: Tone; className?: string }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', DOTS[tone], className)} />;
}

const fieldBase =
  'w-full rounded-xl border border-line bg-bg px-3 text-fg placeholder:text-faint outline-none transition-colors focus:border-accent disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldBase, 'h-11', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...props },
  ref
) {
  return <textarea ref={ref} rows={rows} className={cn(fieldBase, 'py-2.5 leading-relaxed', className)} {...props} />;
});

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, style, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(fieldBase, 'h-11 appearance-none pr-9', className)}
      style={{ backgroundImage: CHEVRON, backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px', ...style }}
      {...props}
    >
      {children}
    </select>
  );
});

export function Field({ label, hint, className, children }: { label: ReactNode; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      {icon ? <div className="mb-1 text-faint">{icon}</div> : null}
      <p className="text-sm font-medium text-fg">{title}</p>
      {children ? <div className="max-w-sm text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tracking-tight tabular', tone === 'crit' && 'text-crit', tone === 'warn' && 'text-warn', tone === 'ok' && 'text-ok')}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-faint">{hint}</p> : null}
    </Card>
  );
}

export function PageHeader({ title, subtitle, action, back }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mb-2 inline-flex h-8 items-center gap-1 text-sm text-muted hover:text-fg">
      <span aria-hidden>←</span> {children}
    </Link>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 text-right text-fg">{children}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface2', className)} />;
}
