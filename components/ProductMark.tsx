import { Anchor, Bike, CarFront, Cog, Disc3, Droplets, Fan, KeyRound, PlugZap, Siren, Sparkles, SprayCan, Truck, WashingMachine, Zap, type LucideIcon } from 'lucide-react';
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
  detail: Sparkles,
  electric: PlugZap,
  appliance: WashingMachine,
  locksmith: KeyRound,
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

// A trade's mark, in the logo's orange (Vedran, 2026-10-07): on the dark
// theme an orange glyph with a thin orange ring on a dark tile; on the
// light theme a solid orange tile with a white glyph, so it shows in the sun.
export function ProductMark({ id, className }: { id: PackageId; className?: string }) {
  const Icon = PRODUCT_ICONS[id];
  return (
    <span
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface2 text-[rgb(var(--orange))] ring-1 ring-[rgb(var(--orange))]',
        '[[data-theme=light]_&]:bg-[rgb(var(--orange))] [[data-theme=light]_&]:text-white [[data-theme=light]_&]:ring-0',
        className
      )}
    >
      <Icon className="size-[60%]" strokeWidth={2.4} />
    </span>
  );
}
