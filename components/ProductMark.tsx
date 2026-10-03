import { Anchor, Cog, Disc3, Fan, SprayCan, Truck, Zap, type LucideIcon } from 'lucide-react';
import { BRAND, type PackageId } from '@/config/tenant.config';
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

// The TaktIX "X": two slanted bars, leaning forward like a racing number.
// The same outline as the app icon (scripts/generate-icons.mjs).
export const BRAND_X_PATH = 'M27 15H43L52.6 37L71 15H87L59 50L73 85H57L47.4 63L29 85H13L41 50Z';

// The mark: an orange X with a black outline on a light blue tile.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn('size-8 shrink-0', className)} aria-hidden>
      <rect width="100" height="100" rx="22" fill={BRAND.accent} />
      <path d={BRAND_X_PATH} fill="#0B0F14" stroke="#0B0F14" strokeWidth="9" strokeLinejoin="round" />
      <path d={BRAND_X_PATH} fill={BRAND.mark} />
    </svg>
  );
}

// Mark and name together: "Takt" in the text colour, "IX" in orange,
// leaning forward in the narrow racing font.
export function BrandLogo({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark className={size === 'lg' ? 'size-11' : size === 'sm' ? 'size-6' : 'size-8'} />
      <span className={cn('inline-block -skew-x-6 font-display font-bold tracking-tight', size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl')}>
        Takt<span style={{ color: BRAND.mark }}>IX</span>
      </span>
    </span>
  );
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
