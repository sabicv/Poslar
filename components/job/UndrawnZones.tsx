'use client';

import { drawnCodes, ZoneGrid, type DiagramKind } from '@/components/Diagram';
import { Fold } from '@/components/Fold';
import type { ConditionZone } from '@/config/tenant.config';

// Parts the silhouette does not draw (a wheel, a window, a lever). Closed
// until one of them is already marked, so the floor plan stays the page.
export function UndrawnZones({
  kind,
  zones,
  marked,
  onZone,
  disabled,
}: {
  kind: DiagramKind;
  zones: ConditionZone[];
  marked: Record<string, string[]>;
  onZone: (zone: { code: string; label: string }) => void;
  disabled?: boolean;
}) {
  const drawn = new Set(drawnCodes(kind));
  if (!drawn.size) return null;
  const rest = zones.filter((zone) => !drawn.has(zone.code));
  if (!rest.length) return null;
  const markedCount = rest.filter((zone) => (marked[zone.code] ?? []).length > 0).length;
  return (
    <div className="mt-4">
      <Fold plain title="Nije na crtežu" summary={markedCount ? `${markedCount} s oznakom` : 'Naplatak, staklo i slično'} startOpen={markedCount > 0}>
        <div className="pt-3">
          <ZoneGrid zones={rest} marked={marked} onZone={onZone} disabled={disabled} />
        </div>
      </Fold>
    </div>
  );
}
