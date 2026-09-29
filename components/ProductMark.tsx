import { Anchor, Cog, Disc3, SprayCan, Truck, Zap, type LucideIcon } from 'lucide-react';
import type { PackageId } from '@/config/tenant.config';
import { cn } from '@/lib/utils';

export const PRODUCT_ICONS: Record<PackageId, LucideIcon> = {
  volt: Zap,
  gear: Cog,
  body: SprayCan,
  wheel: Disc3,
  fleet: Truck,
  moto: Anchor,
};

export function ProductMark({ id, className }: { id: PackageId; className?: string }) {
  const Icon = PRODUCT_ICONS[id];
  return (
    <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg', className)}>
      <Icon className="size-[60%]" strokeWidth={2.2} />
    </span>
  );
}
