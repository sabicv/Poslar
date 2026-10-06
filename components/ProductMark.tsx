import { Anchor, Bike, CarFront, Cog, Disc3, Droplets, Fan, Siren, SprayCan, Truck, Zap, type LucideIcon } from 'lucide-react';
import { BRAND, type PackageId } from '@/config/tenant.config';
import { cn } from '@/lib/utils';

export const PRODUCT_ICONS: Record<PackageId, LucideIcon> = {
  volt: Zap,
  gear: Cog,
  body: SprayCan,
  wheel: Disc3,
  fleet: Truck,
  moto: Bike,
  marine: Anchor,
  air: Fan,
  aqua: Droplets,
  tow: Siren,
  deal: CarFront,
};

// The Poslar mark: a checkbox drawn as one white line on a blue tile, the
// job done. The files in public/brand come from scripts/brand.mjs; the app
// icon (scripts/generate-icons.mjs) draws the same mark.
export function BrandMark({ className }: { className?: string }) {
  return <img src="/brand/poslar-mark.svg" alt="" aria-hidden width={32} height={32} className={cn('size-8 shrink-0', className)} />;
}

// The logo: a blue pill, "Poslar" in orange with a white outline and the
// mark at the letters' height.
const LOGO_RATIO = 364.08 / 135.08;
const LOGO_HEIGHT = { sm: 32, md: 40, lg: 56 };

export function BrandLogo({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const h = LOGO_HEIGHT[size];
  return <img src="/brand/poslar-logo.svg" alt={BRAND.name} width={Math.round(h * LOGO_RATIO)} height={h} className={cn('block shrink-0', className)} style={{ height: h, width: 'auto' }} />;
}

// A trade's mark: a dark tile with the glyph glowing in the trade's colour,
// like a lamp on an instrument cluster.
export function ProductMark({ id, className }: { id: PackageId; className?: string }) {
  const Icon = PRODUCT_ICONS[id];
  return (
    <span
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0B1220] text-accent ring-1 ring-accent/60 shadow-[0_0_14px_rgb(var(--accent)/0.35)]',
        className
      )}
    >
      <Icon className="size-[60%]" strokeWidth={2.4} />
    </span>
  );
}
