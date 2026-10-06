'use client';

import { useEffect } from 'react';
import { reportError } from '@/components/ErrorReporter';
import { SupportButton } from '@/components/SupportButton';
import { Button } from '@/components/ui';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Poslar sees it in the tower even when nobody writes in.
  useEffect(() => reportError(error), [error]);
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Nešto nije uspjelo</h1>
      <p className="mt-2 text-sm text-muted">Provjerite vezu i pokušajte ponovno. Podaci koje ste spremili nisu izgubljeni.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button variant="primary" onClick={reset}>
          Pokušaj ponovno
        </Button>
        <SupportButton after="stay" prefill={`Pojavila se greška${error.digest ? ` (oznaka ${error.digest})` : ''}. Prije toga: `} />
      </div>
    </div>
  );
}
