'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, useAction } from '@/components/client-ui';
import { Button } from '@/components/ui';
import { requestDeletion } from '@/lib/actions/support';

// Asks Poslar to delete the account: the owner's whole workshop, or a
// worker's own account. Carried out from the tower within 30 days.
export function DeleteAccount({ owner }: { owner: boolean }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Brisanje računa"
      trigger={
        <button type="button" className="text-sm text-muted underline-offset-2 hover:text-crit hover:underline">
          Zatraži brisanje računa
        </button>
      }
    >
      <div className="space-y-3 text-sm text-muted">
        {owner ? (
          <>
            <p>Brišemo cijelu radionicu: naloge, mušterije, fotografije, izdane račune i prijave Vaših radnika. To se ne može vratiti.</p>
            <p>Prije toga preuzmite račune za knjigovođu (Poslovanje → Za knjigovođu). Račune morate čuvati koliko propisuje zakon.</p>
          </>
        ) : (
          <p>Brišemo Vaš korisnički račun. Nalozi koje ste radili ostaju radionici.</p>
        )}
        <p>Zahtjev stiže podršci Poslara. Brisanje obavljamo u roku od 30 dana i javljamo Vam se u Postavke → Pomoć.</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            run(() => requestDeletion(), {
              success: 'Zahtjev za brisanje je poslan',
              onDone: () => {
                setOpen(false);
                router.refresh();
              },
            })
          }
        >
          Pošalji zahtjev za brisanje
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Odustani
        </Button>
      </div>
    </Sheet>
  );
}
