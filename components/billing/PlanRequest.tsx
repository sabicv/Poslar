'use client';

import { useRouter } from 'next/navigation';
import { useAction } from '@/components/client-ui';
import { Button } from '@/components/ui';
import { requestPlan } from '@/lib/actions/support';

// Asks Poslar to switch the plan; the answer comes in Postavke → Pomoć.
export function PlanRequest({ plan, term, label }: { plan: 'basic' | 'standard' | 'premium'; term: 'monthly' | '24m'; label: string }) {
  const router = useRouter();
  const { pending, run } = useAction();
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => requestPlan(plan, term), { success: 'Zahtjev poslan. Odgovor stiže u Postavke → Pomoć.', onDone: () => router.refresh() })}>
      {label}
    </Button>
  );
}
