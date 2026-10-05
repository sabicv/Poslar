import { Anchor, CarFront, Cog, Disc3, Droplets, Fan, Siren, SprayCan, Truck, Zap, type LucideIcon } from 'lucide-react';
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
  aqua: Droplets,
  tow: Siren,
  deal: CarFront,
};

// The TaktiX mark, after Vedran's sketch of 2026-10-05: a blue metronome
// ("takt" is the beat of the work) with its scale, on a base with two
// feet, and the pendulum as an orange arrow that swings from the middle of
// the base at 45 degrees, with its weight across the rod, up and out of
// the body. A thin outline in the tile colour keeps the arrow apart from
// the body. The app icon (scripts/generate-icons.mjs) draws the same.
export const BRAND_SYMBOL = {
  tile: '#0D172C',
  blue: '#2875BC',
  blueDark: '#1D5FA6',
  body: 'M50 7L58.5 14.5L77 80H23L41.5 14.5Z',
  shaft: 'M50 73L74.75 48.25',
  head: 'M82.53 40.47L78.99 53.91L69.09 44.01Z',
  weight: { x: 59.84, y: 52.76, cx: 63.44, cy: 59.56 },
};

function Symbol({ bg = BRAND_SYMBOL.tile }: { bg?: string }) {
  const s = BRAND_SYMBOL;
  const weight = { x: s.weight.x, y: s.weight.y, width: 7.2, height: 13.6, rx: 1.8, transform: `rotate(-45 ${s.weight.cx} ${s.weight.cy})` };
  return (
    <g transform="translate(-1.5 0)">
      <path d={s.body} fill={s.blue} />
      <rect x="48" y="20" width="4" height="9" rx="1.2" fill={bg} />
      <rect x="48" y="32" width="4" height="14" rx="1.2" fill={bg} />
      <rect x="15" y="82.5" width="70" height="6.5" rx="1.6" fill={s.blue} />
      <rect x="23" y="91" width="11" height="3.2" rx="0.9" fill={s.blueDark} />
      <rect x="66" y="91" width="11" height="3.2" rx="0.9" fill={s.blueDark} />
      <g stroke={bg} strokeLinejoin="round" strokeLinecap="round">
        <path d={s.shaft} strokeWidth="9" fill="none" />
        <path d={s.head} strokeWidth="3.4" fill={bg} />
        <rect {...weight} fill={bg} strokeWidth="3.4" />
        <circle cx="50" cy="73" r="3.8" fill={bg} strokeWidth="3" />
      </g>
      <path d={s.shaft} stroke={BRAND.mark} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d={s.head} fill={BRAND.mark} />
      <rect {...weight} fill={BRAND.mark} />
      <circle cx="50" cy="73" r="3.6" fill={BRAND.mark} />
    </g>
  );
}

// The mark on its dark tile.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn('size-8 shrink-0', className)} aria-hidden>
      <rect width="100" height="100" rx="22" fill={BRAND_SYMBOL.tile} />
      <Symbol />
    </svg>
  );
}

// Mark and name: "Takt" in the mark's blue, "iX" in orange, in a heavy
// grotesk like the sketch.
export function BrandLogo({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)} aria-label={BRAND.name}>
      <BrandMark className={size === 'lg' ? 'size-11' : size === 'sm' ? 'size-6' : 'size-8'} />
      <span aria-hidden className={cn('font-sans font-extrabold leading-none tracking-tight', size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl')} style={{ color: BRAND.blue }}>
        Takt<span style={{ color: BRAND.mark }}>iX</span>
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
