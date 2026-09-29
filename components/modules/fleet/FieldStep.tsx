'use client';

import { useAction } from '@/components/client-ui';
import { Button } from '@/components/ui';
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

// One tap stamps the time (and, on arrival, the phone's location).
export function FieldStep({ jobId, column, withGps, disabled }: { jobId: string; column: string; withGps: boolean; disabled: boolean }) {
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
          return saveRecord('fleet_field_jobs', { job_id: jobId, [column]: '__now__', ...(gps ? { lat: gps.lat, lng: gps.lng } : {}) }, { upsertOn: 'job_id', revalidate: `/app/jobs/${jobId}` });
        })
      }
    >
      Sada
    </Button>
  );
}
