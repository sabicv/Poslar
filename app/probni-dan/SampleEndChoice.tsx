'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Star, Trash2 } from 'lucide-react';
import { useAction } from '@/components/client-ui';
import { Button, Field, Textarea } from '@/components/ui';
import { leaveAfterTrial, moveToRealWork } from '@/lib/actions/sample-day';
import { cn } from '@/lib/utils';

// The two ways on after the 24 hours: the 30 free days on real work, or a
// review and the trial workshop deleted.
export function SampleEndChoice() {
  const router = useRouter();
  const { pending, run } = useAction();
  const [leaving, setLeaving] = useState(false);
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState('');
  const [mayPublish, setMayPublish] = useState(false);

  if (!leaving) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-accent/50 bg-accent/10 p-5">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={pending}
            onClick={() => run(moveToRealWork, { success: 'Primjeri su uklonjeni. Sretno s pravim poslovima!', onDone: () => router.replace('/app') })}
          >
            Krenite 30 dana besplatno <ArrowRight className="size-5" />
          </Button>
          <p className="mt-3 text-sm text-muted">Testni primjeri se uklanjaju. Nastavljate raditi s vlastitim radnim nalozima i mušterijama.</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <Button size="lg" className="h-auto min-h-14 w-full whitespace-normal py-3 text-center" disabled={pending} onClick={() => setLeaving(true)}>
            Ukloni podatke i ostavi povratnu informaciju
          </Button>
          <p className="mt-3 text-sm text-muted">Napišite nam što Vam nedostaje. Svi probni podaci bit će trajno obrisani.</p>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-5 rounded-2xl border border-line bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => leaveAfterTrial({ stars, body, mayPublish }), { onDone: () => window.location.replace('/probni-dan/hvala') });
      }}
    >
      <div>
        <span className="block text-xs font-medium text-muted">Ocjena</span>
        <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Ocjena">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} od 5`}
              onClick={() => setStars(n)}
              className="flex size-12 items-center justify-center rounded-xl hover:bg-surface2"
            >
              <Star className={cn('size-8', n <= stars ? 'fill-warn text-warn' : 'text-faint')} />
            </button>
          ))}
        </div>
      </div>
      <Field label="Što Vam se najviše svidjelo, a što bismo trebali unaprijediti?">
        <Textarea rows={5} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" checked={mayPublish} onChange={(e) => setMayPublish(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[rgb(var(--accent))]" />
        <span>Dopuštam objavu moje recenzije uz naziv radionice.</span>
      </label>
      <Button type="submit" variant="danger" size="lg" className="w-full" disabled={pending || stars === 0}>
        <Trash2 className="size-4" /> Pošalji i obriši radionicu
      </Button>
      <button type="button" onClick={() => setLeaving(false)} className="w-full text-center text-sm text-muted hover:text-fg">
        Natrag
      </button>
    </form>
  );
}
