'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { Sheet, useAction } from '@/components/client-ui';
import { Button } from '@/components/ui';
import { moveToRealWork } from '@/lib/actions/sample-day';

// "Probni period: preostalo još 14 h · Pređite na prave poslove". The
// owner can leave the examples behind before the 24 hours are up.
export function SampleDayBanner({ hours, owner }: { hours: number; owner: boolean }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
      <Clock className="size-5 shrink-0 text-accent" />
      <span className="flex-1">Probni period: preostalo još {hours} h</span>
      {owner ? (
        <Sheet
          open={open}
          onOpenChange={setOpen}
          title="Pređite na prave poslove"
          trigger={
            <button type="button" className="font-medium text-accent hover:underline">
              Pređite na prave poslove
            </button>
          }
        >
          <div className="space-y-4 text-sm">
            <p className="text-muted">Testni primjeri se uklanjaju. Nastavljate raditi s vlastitim radnim nalozima i mušterijama.</p>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={pending}
              onClick={() =>
                run(moveToRealWork, {
                  success: 'Primjeri su uklonjeni. Sretno s pravim poslovima!',
                  onDone: () => {
                    setOpen(false);
                    router.refresh();
                  },
                })
              }
            >
              Krenite 30 dana besplatno
            </Button>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
