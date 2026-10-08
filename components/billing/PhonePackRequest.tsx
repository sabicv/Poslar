'use client';

import { useRouter } from 'next/navigation';
import { useAction } from '@/components/client-ui';
import { Button } from '@/components/ui';
import { requestPhonePack } from '@/lib/actions/support';

// Asks Poslar for more calls on the phone; the tower raises the monthly
// calls and the answer comes in Postavke → Pomoć.
export function PhonePackRequest({ label }: { label: string }) {
  const router = useRouter();
  const { pending, run } = useAction();
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(requestPhonePack, { success: 'Zahtjev poslan. Odgovor stiže u Postavke → Pomoć.', onDone: () => router.refresh() })}>
      {label}
    </Button>
  );
}
