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

// The TaktiX mark, after Vedran's design: an abstract metronome ("takt" is
// the beat of the work) in dark slate facets, no circles or guide lines,
// with a bright orange arrow for the pendulum at 45 degrees, pointing up
// and forward. The app icon (scripts/generate-icons.mjs) draws the same.
export const BRAND_SYMBOL = {
  tile: '#0B1120',
  left: 'M18 86H46V14H37Z',
  right: 'M46 86H74L55 14H46Z',
  base: { x: 12, y: 84, w: 68, h: 8 },
  shaft: { x1: 42, y1: 78, x2: 68.7, y2: 51.3 },
  head: 'M80 40L75.05 57.67L62.33 44.95Z',
};

function Symbol() {
  const s = BRAND_SYMBOL;
  return (
    <>
      <path d={s.left} fill="#3B5078" />
      <path d={s.right} fill="#2A3B5C" />
      <rect x={s.base.x} y={s.base.y} width={s.base.w} height={s.base.h} rx="1.5" fill="#4A6190" />
      <line x1={s.shaft.x1} y1={s.shaft.y1} x2={s.shaft.x2} y2={s.shaft.y2} stroke={BRAND.mark} strokeWidth="7" strokeLinecap="round" />
      <path d={s.head} fill={BRAND.mark} />
    </>
  );
}

// The mark on its dark tile.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn('size-8 shrink-0', className)} aria-hidden>
      <rect width="100" height="100" rx="22" fill={BRAND_SYMBOL.tile} />
      <g transform="translate(4 0)">
        <Symbol />
      </g>
    </svg>
  );
}

// Mark and name: "Takt" in the text colour (white on dark), "iX" in
// orange, and a small arrow pointing straight up instead of the dot of
// the "i" (a dotless ı carries it).
export function BrandLogo({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)} aria-label={BRAND.name}>
      <BrandMark className={size === 'lg' ? 'size-11' : size === 'sm' ? 'size-6' : 'size-8'} />
      <span aria-hidden className={cn('inline-flex items-end pt-[0.3em] font-display font-bold leading-none tracking-tight', size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl')}>
        Takt
        <span className="relative" style={{ color: BRAND.mark }}>
          ı
          <svg viewBox="0 0 10 12" className="absolute -top-[0.36em] left-1/2 h-[0.34em] w-[0.28em] -translate-x-1/2" aria-hidden>
            <path d="M5 0L10 6H6.5V12H3.5V6H0Z" fill="currentColor" />
          </svg>
        </span>
        <span style={{ color: BRAND.mark }}>X</span>
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
