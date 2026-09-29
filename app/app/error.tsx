'use client';

import { Button } from '@/components/ui';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Nešto nije uspjelo</h1>
      <p className="mt-2 text-sm text-muted">Provjerite vezu i pokušajte ponovno. Podaci koje ste spremili nisu izgubljeni.</p>
      <Button variant="primary" className="mt-6" onClick={reset}>
        Pokušaj ponovno
      </Button>
    </div>
  );
}
