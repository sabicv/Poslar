import { Anchor, Cog, Disc3, Fan, SprayCan, Truck, X, Zap, type LucideIcon } from 'lucide-react';
import type { PackageId } from '@/config/tenant.config';
import { cn } from '@/lib/utils';

export const PRODUCT_ICONS: Record<PackageId, LucideIcon> = {
  volt: Zap,
  gear: Cog,
  body: SprayCan,
  wheel: Disc3,
  fleet: Truck,
  moto: Anchor,
  air: Fan,
};

// The X-Files brand mark: a light tile with an X.
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-950', className)}>
      <X className="size-[62%]" strokeWidth={2.6} />
    </span>
  );
}

export function ProductMark({ id, className }: { id: PackageId; className?: string }) {
  const Icon = PRODUCT_ICONS[id];
  return (
    <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg', className)}>
      <Icon className="size-[60%]" strokeWidth={2.2} />
    </span>
  );
}
