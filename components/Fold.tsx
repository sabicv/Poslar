'use client';

import { Minus, Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// One function, one row. "+" opens the inputs, "−" puts the screen back.
export function Fold({
  title,
  summary,
  startOpen = false,
  reveal = false,
  plain = false,
  children,
}: {
  title: string;
  summary?: string | null;
  startOpen?: boolean;
  // Opens once when data arrives from outside (a scan, a restored draft).
  // Closing it afterwards stays closed.
  reveal?: boolean;
  // Inside an existing card: no second frame, only the row and a divider.
  plain?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  useEffect(() => {
    if (reveal) setOpen(true);
  }, [reveal]);
  return (
    <div className={plain ? 'border-t border-line' : 'rounded-2xl border border-line bg-surface'}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="type-title">{title}</p>
          {!open && summary ? <p className="mt-0.5 truncate text-xs text-muted">{summary}</p> : null}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? `Zatvori: ${title}` : `Otvori: ${title}`}
          onClick={() => setOpen((value) => !value)}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-line bg-surface2 text-fg"
        >
          {open ? <Minus className="size-5" /> : <Plus className="size-5" />}
        </button>
      </div>
      <div hidden={!open} className={cn('border-t border-line', plain && 'bg-surface2/40')}>
        {children}
      </div>
    </div>
  );
}
