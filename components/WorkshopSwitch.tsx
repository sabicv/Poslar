'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, ChevronsUpDown, Settings } from 'lucide-react';
import { ProductMark } from '@/components/ProductMark';
import { Sheet } from '@/components/client-ui';
import type { PackageId } from '@/config/tenant.config';
import { switchWorkshop } from '@/lib/actions/workshops';
import { cn } from '@/lib/utils';

export interface SwitchWorkshop {
  id: string;
  name: string;
  package: PackageId;
  product: string;
  city: string | null;
  active: boolean;
}

// The workshop name at the top, for an owner of several: one tap lists
// them, another opens one.
export function WorkshopSwitch({ workshops, className, children }: { workshops: SwitchWorkshop[]; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [going, setGoing] = useState<string | null>(null);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Vaše radionice"
      trigger={
        <button type="button" className={cn('text-left', className)} aria-label="Promijeni radionicu">
          {children}
          <ChevronsUpDown className="size-4 shrink-0 text-faint" />
        </button>
      }
    >
      <div className="space-y-2">
        {workshops.map((w) => (
          <form key={w.id} action={switchWorkshop} onSubmit={() => setGoing(w.id)}>
            <input type="hidden" name="tenant" value={w.id} />
            <button
              type="submit"
              disabled={w.active || going !== null}
              aria-current={w.active ? 'true' : undefined}
              className={cn('flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 py-2 text-left', w.active ? 'border-accent bg-accent/10' : 'border-line hover:border-accent/60')}
            >
              <ProductMark id={w.package} />
              <span className="min-w-0 flex-1">
                <span className="block break-words font-semibold">{w.name}</span>
                <span className="block break-words text-sm text-muted">{[w.product, w.city].filter(Boolean).join(' · ')}</span>
              </span>
              {w.active ? <Check className="size-5 shrink-0 text-accent" /> : going === w.id ? <span className="text-sm text-muted">Otvaram…</span> : null}
            </button>
          </form>
        ))}
        <Link href="/app/settings/radionice" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-2 rounded-xl px-2 text-sm font-medium text-accent">
          <Settings className="size-4" /> Dodaj ili uredi radionice
        </Link>
      </div>
    </Sheet>
  );
}
