'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, ChevronRight, X } from 'lucide-react';
import { useAction } from '@/components/client-ui';
import { Button } from '@/components/ui';
import { createSample, deleteSample, hideFirstSteps, markSolo } from '@/lib/actions/onboarding';
import { cn } from '@/lib/utils';

type Step = { id: string; title: string; hint: string; href: string; done: boolean };

// The new owner's first four steps, on the board until they are done.
export function FirstSteps({ steps, sample }: { steps: Step[]; sample: boolean }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const done = steps.filter((s) => s.done).length;
  return (
    <section className="mb-5 rounded-2xl border border-accent/40 bg-accent/5">
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <p className="font-semibold">
          Prvi koraci <span className="text-sm font-normal text-muted">{done} od {steps.length}</span>
        </p>
        <button type="button" onClick={() => run(() => hideFirstSteps())} disabled={pending} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface2" aria-label="Sakrij prve korake">
          <X className="size-4" />
        </button>
      </div>
      <div className="mx-4 mt-2 h-1.5 overflow-hidden rounded-full bg-surface2">
        <div className="h-full bg-accent transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-2 divide-y divide-line">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
            {s.done ? <CheckCircle2 className="size-5 shrink-0 text-ok" /> : <Circle className="size-5 shrink-0 text-faint" />}
            <Link href={s.href} className={cn('min-w-0 flex-1', s.done && 'opacity-60')}>
              <span className={cn('block text-sm font-medium', s.done && 'line-through')}>{s.title}</span>
              <span className="block truncate text-xs text-muted">{s.hint}</span>
            </Link>
            {s.id === 'team' && !s.done ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => markSolo())}>
                Radim sam
              </Button>
            ) : !s.done ? (
              <ChevronRight className="size-4 shrink-0 text-faint" />
            ) : null}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        {sample ? (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => deleteSample(), { success: 'Primjer obrisan' })}>
            Obriši primjer
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => createSample(), { success: 'Primjer je dodan', onDone: (d) => d && router.push(`/app/jobs/${d.jobId}`) })}
          >
            Pogledaj primjer naloga
          </Button>
        )}
        <span className="text-xs text-faint">{sample ? 'Obrišite ga kad Vam više ne treba; nestaju svi podaci primjera.' : 'Doda jedan izmišljeni nalog da vidite kako izgleda.'}</span>
      </div>
    </section>
  );
}
