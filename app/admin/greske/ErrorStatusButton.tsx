'use client';

import { useAction } from '@/components/client-ui';
import { Button } from '@/components/ui';
import { adminSetErrorStatus } from '@/lib/actions/admin';

export function ErrorStatusButton({ id, status }: { id: string; status: 'open' | 'resolved' }) {
  const { pending, run } = useAction();
  return status === 'open' ? (
    <Button size="sm" variant="ok" disabled={pending} onClick={() => run(() => adminSetErrorStatus(id, 'resolved'), { success: 'Označeno riješeno' })}>
      Riješeno
    </Button>
  ) : (
    <Button size="sm" disabled={pending} onClick={() => run(() => adminSetErrorStatus(id, 'open'), { success: 'Ponovno otvoreno' })}>
      Otvori ponovno
    </Button>
  );
}
