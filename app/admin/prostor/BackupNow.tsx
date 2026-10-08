'use client';

import { DatabaseBackup } from 'lucide-react';
import { useAction } from '@/components/client-ui';
import { Button } from '@/components/ui';
import { backupNow } from '@/lib/actions/backup';

export function BackupNow() {
  const { pending, run } = useAction();
  return (
    <Button variant="secondary" disabled={pending} onClick={() => run(() => backupNow(), { success: 'Kopija je spremna' })}>
      <DatabaseBackup className="size-4" /> {pending ? 'Radim kopiju…' : 'Napravi kopiju sada'}
    </Button>
  );
}
