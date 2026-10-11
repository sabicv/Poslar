'use client';

import { useRouter } from 'next/navigation';
import { useAction } from '@/components/client-ui';
import { Button } from '@/components/ui';
import { requestDataPack } from '@/lib/actions/support';

// Asks Poslar for the data pack. The tower adds the minutes, the photo
// reads and the questions, and the answer comes in Postavke → Pomoć.
export function PhonePackRequest({ label }: { label: string }) {
  const router = useRouter();
  const { pending, run } = useAction();
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(requestDataPack, { success: 'Zahtjev poslan. Odgovor stiže u Postavke → Pomoć.', onDone: () => router.refresh() })}>
      {label}
    </Button>
  );
}
