'use client';

import { useAction } from '@/components/client-ui';
import { Button } from '@/components/ui';
import { addLine } from '@/lib/actions/jobs';
import { saveRecord } from '@/lib/actions/records';

function position(): Promise<{ lat: number; lng: number } | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

// One tap stamps the step's time; arrival also keeps where the truck was,
// so the pickup point is on the map even when the caller only said "A1, kod Desinića".
export function TowStep({ jobId, column, withGps, disabled }: { jobId: string; column: string; withGps: boolean; disabled: boolean }) {
  const { pending, run } = useAction();
  return (
    <Button
      size="sm"
      variant="primary"
      className="mt-1 w-full"
      disabled={pending || disabled}
      onClick={() =>
        run(async () => {
          const gps = withGps ? await position() : null;
          return saveRecord('tow_calls', { job_id: jobId, [column]: '__now__', ...(gps ? { pickup_lat: gps.lat, pickup_lng: gps.lng } : {}) }, { upsertOn: 'job_id', revalidate: `/app/jobs/${jobId}` });
        })
      }
    >
      Sada
    </Button>
  );
}

// Days on the yard → one storage line on the work order (owner only).
export function StorageFeeButton({ jobId, days, price }: { jobId: string; days: number; price: number }) {
  const { pending, run } = useAction();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        run(() => addLine(jobId, { kind: 'fee', description: 'Ležarina na placu', qty: days, unit: 'dan', approval: 'approved' }, { unit_price: price, discount_pct: 0, vat_rate: 25 }), {
          success: 'Ležarina dodana u stavke',
        })
      }
    >
      Obračunaj ležarinu ({days} {days === 1 ? 'dan' : 'dana'})
    </Button>
  );
}
