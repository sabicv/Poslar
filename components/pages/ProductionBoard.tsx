'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useAction } from '@/components/client-ui';
import { Badge, Button, type Tone } from '@/components/ui';
import { advanceBodyPhase } from '@/lib/actions/production';
import { cn } from '@/lib/utils';

export interface BoardCard {
  id: string;
  number: number;
  identifier: string | null;
  title: string;
  client: string;
  urgent: boolean;
  badges: { label: string; tone: Tone }[];
  // The stage one tap moves it to; null after the last stage.
  next: string | null;
}

export interface BoardColumn {
  id: string;
  label: string;
  cards: BoardCard[];
}

// The production board. On a phone one stage at a time: the stages are a
// strip of tabs with their counts, and a swipe left or right goes to the
// next or previous stage. From a tablet up, all stages side by side.
// Every card moves to the next stage with one tap, without opening the job.
export function ProductionBoard({ columns }: { columns: BoardColumn[] }) {
  const firstFull = Math.max(0, columns.findIndex((c) => c.cards.length > 0));
  const [current, setCurrent] = useState(firstFull);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  function go(index: number) {
    const i = Math.min(columns.length - 1, Math.max(0, index));
    setCurrent(i);
    strip.current?.children[i]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  return (
    <>
      {/* Phone: stage tabs and one stage, swipe to change */}
      <div className="md:hidden">
        <div ref={strip} className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4" role="tablist" aria-label="Faze proizvodnje">
          {columns.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={i === current}
              onClick={() => go(i)}
              className={cn(
                'flex h-12 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm transition-colors',
                i === current ? 'bg-accent font-medium text-accent-fg' : 'border border-line text-muted'
              )}
            >
              {c.label}
              <span className={cn('tabular text-xs', i === current ? 'opacity-80' : 'text-faint')}>{c.cards.length}</span>
            </button>
          ))}
        </div>
        <div
          className="min-h-[50dvh]"
          onTouchStart={(e) => {
            touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }}
          onTouchEnd={(e) => {
            const start = touch.current;
            touch.current = null;
            if (!start) return;
            const dx = e.changedTouches[0].clientX - start.x;
            const dy = e.changedTouches[0].clientY - start.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1));
          }}
        >
          <p className="mb-3 text-xs text-faint">
            {columns[current]?.label} · {columns[current]?.cards.length ?? 0} · povuci lijevo ili desno za drugu fazu
          </p>
          <div className="space-y-3">
            {columns[current]?.cards.length ? (
              columns[current].cards.map((card) => <Card key={card.id} card={card} />)
            ) : (
              <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">Nijedno vozilo nije u ovoj fazi.</p>
            )}
          </div>
        </div>
      </div>

      {/* Tablet and computer: all stages side by side */}
      <div className="no-scrollbar hidden gap-3 overflow-x-auto pb-4 md:flex">
        {columns.map((c) => (
          <section key={c.id} className="w-72 shrink-0">
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
              {c.label}
              <span className="rounded bg-surface2 px-1.5 text-[11px] text-faint">{c.cards.length}</span>
            </h2>
            <div className="space-y-2">
              {c.cards.map((card) => (
                <Card key={card.id} card={card} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function Card({ card }: { card: BoardCard }) {
  const { pending, run } = useAction();
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <Link prefetch={false} href={`/app/jobs/${card.id}?tab=modul`} className="block rounded-t-2xl p-4 hover:bg-surface2/50">
        <div className="flex flex-wrap items-center gap-2">
          {card.identifier ? <span className="rounded-md border border-line bg-bg px-1.5 py-0.5 font-mono text-xs font-semibold">{card.identifier}</span> : null}
          <span className="text-xs text-faint">#{card.number}</span>
          {card.urgent ? <Badge tone="crit">Hitno</Badge> : null}
        </div>
        <p className="mt-1.5 break-words text-[15px] font-medium leading-snug">{card.title}</p>
        <p className="break-words text-sm text-muted">{card.client}</p>
        {card.badges.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {card.badges.map((b) => (
              <Badge key={b.label} tone={b.tone}>
                {b.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </Link>
      {card.next ? (
        <div className="border-t border-line p-2">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => advanceBodyPhase(card.id), { success: `Sada: ${card.next}` })}
            className="w-full justify-between"
          >
            <span>{card.next}</span>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
