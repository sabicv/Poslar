// No 'use client': the helpers (diagramFor, zonesFor) are also called on the
// server; the component runs in the browser when a client component renders it.
import { BODY_ZONES } from '@/config/packages/body';
import { FLEET_ZONES } from '@/config/packages/condition-zones';
import { MOTO_ZONES } from '@/config/packages/moto';
import { BOAT_ZONES } from '@/config/packages/marine';
import type { AssetType, ConditionZone } from '@/config/tenant.config';
import { cn } from '@/lib/utils';

export type DiagramKind = 'car' | 'truck' | 'moto' | 'boat';

export const MARK_CODES = {
  O: 'Ogrebotina',
  U: 'Udubljenje',
  P: 'Pukotina',
  K: 'Kamenčić / odlupan lak',
  L: 'Lom',
  N: 'Nedostaje',
  R: 'Korozija / hrđa',
  B: 'Savijeno / deformacija',
  D: 'Kvar / defekt / neispravno',
} as const;
export type MarkCode = keyof typeof MARK_CODES;

interface Zone {
  code: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}

const label = (code: string) => BODY_ZONES.find((z) => z.code === code)?.label ?? code;

// Top view, front up. Codes match the Body damage map (body_panel_damages.zone).
const CAR: Zone[] = [
  { code: 'front_bumper', x: 44, y: 8, w: 112, h: 22, r: 10 },
  { code: 'headlight_l', x: 30, y: 30, w: 22, h: 12, r: 4 },
  { code: 'headlight_r', x: 148, y: 30, w: 22, h: 12, r: 4 },
  { code: 'hood', x: 54, y: 34, w: 92, h: 76, r: 8 },
  { code: 'windshield', x: 56, y: 114, w: 88, h: 30, r: 6 },
  { code: 'roof', x: 56, y: 148, w: 88, h: 100, r: 6 },
  { code: 'rear_window', x: 56, y: 252, w: 88, h: 26, r: 6 },
  { code: 'trunk', x: 54, y: 282, w: 92, h: 60, r: 8 },
  { code: 'taillight_l', x: 30, y: 344, w: 22, h: 12, r: 4 },
  { code: 'taillight_r', x: 148, y: 344, w: 22, h: 12, r: 4 },
  { code: 'rear_bumper', x: 44, y: 358, w: 112, h: 22, r: 10 },
  { code: 'fender_fl', x: 20, y: 46, w: 30, h: 66, r: 8 },
  { code: 'fender_fr', x: 150, y: 46, w: 30, h: 66, r: 8 },
  { code: 'mirror_l', x: 4, y: 122, w: 14, h: 16, r: 4 },
  { code: 'mirror_r', x: 182, y: 122, w: 14, h: 16, r: 4 },
  { code: 'door_fl', x: 20, y: 116, w: 30, h: 76, r: 4 },
  { code: 'door_fr', x: 150, y: 116, w: 30, h: 76, r: 4 },
  { code: 'door_rl', x: 20, y: 196, w: 30, h: 70, r: 4 },
  { code: 'door_rr', x: 150, y: 196, w: 30, h: 70, r: 4 },
  { code: 'quarter_rl', x: 20, y: 270, w: 30, h: 70, r: 8 },
  { code: 'quarter_rr', x: 150, y: 270, w: 30, h: 70, r: 8 },
].map((z) => ({ ...z, label: label(z.code) }));

const TRUCK: Zone[] = [
  { code: 'front_bumper', label: 'Branik i maska', x: 40, y: 8, w: 120, h: 24, r: 8 },
  { code: 'windshield', label: 'Vjetrobran', x: 46, y: 36, w: 108, h: 26, r: 6 },
  { code: 'cab_roof', label: 'Krov kabine', x: 46, y: 66, w: 108, h: 62, r: 6 },
  { code: 'door_l', label: 'Vrata lijeva', x: 14, y: 40, w: 28, h: 88, r: 6 },
  { code: 'door_r', label: 'Vrata desna', x: 158, y: 40, w: 28, h: 88, r: 6 },
  { code: 'mirror_l', label: 'Retrovizor lijevi', x: 0, y: 44, w: 12, h: 22, r: 4 },
  { code: 'mirror_r', label: 'Retrovizor desni', x: 188, y: 44, w: 12, h: 22, r: 4 },
  { code: 'side_l', label: 'Lijeva strana / nadogradnja', x: 14, y: 136, w: 28, h: 214, r: 6 },
  { code: 'side_r', label: 'Desna strana / nadogradnja', x: 158, y: 136, w: 28, h: 214, r: 6 },
  { code: 'body_roof', label: 'Krov nadogradnje / teret', x: 46, y: 136, w: 108, h: 214, r: 6 },
  { code: 'rear', label: 'Stražnja strana / vrata', x: 40, y: 356, w: 120, h: 30, r: 6 },
];

export function diagramFor(assetType: AssetType, fallback: DiagramKind): DiagramKind {
  if (['boat', 'jetski', 'outboard', 'inboard'].includes(assetType)) return 'boat';
  if (['motorcycle', 'scooter', 'atv'].includes(assetType)) return 'moto';
  if (['truck', 'tractor_unit', 'bus', 'trailer', 'semi_trailer', 'machine', 'tractor', 'implement'].includes(assetType)) return 'truck';
  if (['car', 'van'].includes(assetType)) return 'car';
  return fallback;
}

export function zonesFor(kind: DiagramKind): ConditionZone[] {
  if (kind === 'car') return BODY_ZONES;
  if (kind === 'truck') return FLEET_ZONES;
  return kind === 'moto' ? MOTO_ZONES : BOAT_ZONES;
}

export function resolveZones(kind: DiagramKind, packageKind: DiagramKind, packageZones?: ConditionZone[]): ConditionZone[] {
  if (kind === packageKind && packageZones?.length) return packageZones;
  return zonesFor(kind);
}

export function drawnCodes(kind: DiagramKind): string[] {
  if (kind === 'car') return CAR.map((zone) => zone.code);
  if (kind === 'truck') return TRUCK.map((zone) => zone.code);
  if (kind === 'moto') return MOTO.map((zone) => zone.code);
  return [];
}

const motoLabel = (code: string) => MOTO_ZONES.find((zone) => zone.code === code)?.label ?? code;

// Top view, front up. The rest of a motorcycle (ručice, lanac, koferi) stays
// in the zone list under the drawing.
const MOTO: Zone[] = [
  { code: 'windshield', x: 68, y: 6, w: 64, h: 22, r: 6 },
  { code: 'mask', x: 56, y: 30, w: 88, h: 34, r: 8 },
  { code: 'mirror_l', x: 6, y: 36, w: 40, h: 16, r: 4 },
  { code: 'mirror_r', x: 154, y: 36, w: 40, h: 16, r: 4 },
  { code: 'bars', x: 28, y: 68, w: 144, h: 16, r: 6 },
  { code: 'wheel_f', x: 74, y: 90, w: 52, h: 28, r: 10 },
  { code: 'front_fender', x: 80, y: 120, w: 40, h: 14, r: 4 },
  { code: 'fairing_l', x: 22, y: 140, w: 40, h: 72, r: 8 },
  { code: 'tank', x: 66, y: 140, w: 68, h: 72, r: 12 },
  { code: 'fairing_r', x: 138, y: 140, w: 40, h: 72, r: 8 },
  { code: 'seat_rider', x: 72, y: 216, w: 56, h: 40, r: 8 },
  { code: 'exhaust', x: 146, y: 220, w: 18, h: 64, r: 6 },
  { code: 'seat_pillion', x: 76, y: 258, w: 48, h: 26, r: 6 },
  { code: 'rear_fairing', x: 62, y: 288, w: 76, h: 34, r: 8 },
  { code: 'tail', x: 74, y: 324, w: 52, h: 16, r: 4 },
  { code: 'taillight', x: 82, y: 342, w: 36, h: 12, r: 3 },
  { code: 'wheel_r', x: 74, y: 358, w: 52, h: 26, r: 10 },
].map((zone) => ({ ...zone, label: motoLabel(zone.code) }));

export function ZoneGrid({
  zones,
  marked,
  onZone,
  disabled,
}: {
  zones: ConditionZone[];
  marked: Record<string, string[]>;
  onZone: (zone: { code: string; label: string }) => void;
  disabled?: boolean;
}) {
  const groups = [...new Set(zones.map((z) => z.group))];
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group}>
          <p className="mb-2 text-xs font-medium text-muted">{group}</p>
          <div className="grid grid-cols-2 gap-2">
            {zones
              .filter((z) => z.group === group)
              .map((zone) => {
                const codes = marked[zone.code] ?? [];
                return (
                  <button
                    key={zone.code}
                    type="button"
                    disabled={disabled}
                    onClick={() => onZone(zone)}
                    className={cn(
                      'flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm',
                      codes.length ? 'border-[rgb(var(--orange))] bg-[rgb(var(--orange))]/10' : 'border-line hover:bg-surface2'
                    )}
                  >
                    <span className="min-w-0">{zone.label}</span>
                    {codes.length ? (
                      <span className="flex shrink-0 gap-1">
                        {codes.map((code) => (
                          <span key={code} className="flex size-7 items-center justify-center rounded-md bg-[rgb(var(--orange))] font-mono text-sm font-bold text-white">
                            {code}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Diagram({
  kind,
  marked,
  onZone,
  disabled,
  detail = false,
  zones,
}: {
  kind: DiagramKind;
  marked: Record<string, string[]>;
  onZone: (zone: { code: string; label: string }) => void;
  disabled?: boolean;
  detail?: boolean;
  zones?: ConditionZone[];
}) {
  if (kind === 'boat' || detail) {
    return <ZoneGrid zones={zones ?? zonesFor(kind)} marked={marked} onZone={onZone} disabled={disabled} />;
  }

  const map = kind === 'car' ? CAR : kind === 'truck' ? TRUCK : MOTO;
  return (
    <svg viewBox="0 0 200 390" className="mx-auto block h-auto w-full max-w-[280px] select-none" role="img" aria-label="Dijagram vozila">
      {map.map((zone) => {
        const codes = marked[zone.code] ?? [];
        return (
          <g
            key={zone.code}
            onClick={() => !disabled && onZone(zone)}
            className={cn(!disabled && 'cursor-pointer')}
            role="button"
            aria-label={zone.label}
          >
            <rect
              x={zone.x}
              y={zone.y}
              width={zone.w}
              height={zone.h}
              rx={zone.r ?? 4}
              className={cn('stroke-[1.2] transition-colors', codes.length ? 'fill-warn/25 stroke-warn' : 'fill-surface2 stroke-line hover:fill-accent/15')}
            />
            {codes.length ? (
              <text x={zone.x + zone.w / 2} y={zone.y + zone.h / 2 + 4} textAnchor="middle" className="fill-warn font-mono text-[11px] font-bold">
                {codes.join('')}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
