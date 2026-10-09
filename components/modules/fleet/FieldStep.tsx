'use client';

import { toast } from 'sonner';
import { useAction } from '@/components/client-ui';
import { Button } from '@/components/ui';
import { saveRecord } from '@/lib/actions/records';
import { enqueueFieldStep, isOfflineError } from '@/lib/offline-queue';

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
          try {
            const result = await saveRecord('fleet_field_jobs', { job_id: jobId, [column]: '__now__', ...(gps ? { lat: gps.lat, lng: gps.lng } : {}) }, { upsertOn: 'job_id', revalidate: `/app/jobs/${jobId}` });
            if (!result.ok && isOfflineError(result.error)) throw new Error(result.error);
            return result;
          } catch (error) {
            if (!isOfflineError(error)) throw error;
            await enqueueFieldStep(jobId, column, gps);
            toast.success('Spremljeno na telefonu. Šalje se kad se veza vrati.');
            return { ok: true as const };
          }
        })
      }
    >
      Sada
    </Button>
  );
}
