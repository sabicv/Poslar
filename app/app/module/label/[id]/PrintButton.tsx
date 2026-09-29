'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui';

export function PrintButton() {
  return (
    <Button variant="primary" className="mt-4 w-full print:hidden" onClick={() => window.print()}>
      <Printer className="size-4" /> Ispiši naljepnicu
    </Button>
  );
}
