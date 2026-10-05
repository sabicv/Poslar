'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

// The button of a demo form: opening a demo copies a whole workshop, which
// takes a few seconds, so it says so instead of looking stuck. "tile" is a
// whole card that is the button (the trade list on /isprobaj).
export function DemoSubmit({ children, variant = 'secondary', className }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'tile'; className?: string }) {
  const { pending } = useFormStatus();
  const busy = (
    <>
      <Loader2 className="size-5 animate-spin" /> Otvaram demo…
    </>
  );
  if (variant === 'tile') {
    return (
      <button type="submit" disabled={pending} className={className}>
        {pending ? <span className="flex min-h-10 items-center gap-2 text-sm font-medium text-accent">{busy}</span> : children}
      </button>
    );
  }
  return (
    <Button type="submit" variant={variant} size="lg" disabled={pending} className={cn('h-auto min-h-14 w-full whitespace-normal py-3 text-center', className)}>
      {pending ? busy : children}
    </Button>
  );
}
