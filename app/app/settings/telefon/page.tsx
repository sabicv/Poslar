import type { Metadata } from 'next';
import Link from 'next/link';
import { PhoneForwarded } from 'lucide-react';
import { SupportWhatsApp } from '@/components/SupportWhatsApp';
import { BackLink, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { readHours } from '@/lib/calendar';
import { formatDateTime } from '@/lib/format';
import { requireOwner } from '@/lib/session';
import { CalendarForm } from './CalendarForm';

export const metadata: Metadata = { title: 'AI telefon' };

// The phone agent from the owner's side: is it on, how to forward the
// calls he does not take, the working hours it books into, and the calls.
export default async function PhoneAgentPage() {
  const ctx = await requireOwner();
  const t = ctx.tenant;
  const on = Boolean(t.phone_agent_number_id && t.phone_agent_number);
  const number = (t.phone_agent_number ?? '').replace(/[^\d+]/g, '');
  const { data: calls } = await ctx.supabase
    .from('phone_calls')
    .select('id, caller, started_at, created_at, duration_s, summary, transcript, job_id, job:jobs(number)')
    .order('created_at', { ascending: false })
    .limit(20);
  type Call = { id: string; caller: string | null; started_at: string | null; created_at: string; duration_s: number | null; summary: string | null; transcript: string | null; job_id: string | null; job: { number: number } | null };
  const rows = (calls ?? []) as unknown as Call[];

  return (
    <>
      <PageHeader title="AI telefon" subtitle="Javlja se kad Vi ne možete i dogovara termine" back={<BackLink href="/app/settings">Postavke</BackLink>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader title={on ? 'Uključen' : 'Nije uključen'} subtitle={on ? `AI broj radionice: ${t.phone_agent_number}` : undefined} />
            <div className="space-y-3 p-4 text-sm">
              {on ? (
                <>
                  <p>Pozive koje ne preuzmete preusmjerite na AI broj. Na svom mobitelu upišite kod i nazovite ga, kao da zovete broj:</p>
                  <ul className="space-y-2">
                    <li className="rounded-xl bg-surface2 px-3 py-2">
                      Kad se ne javite: <span className="font-mono">**61*{number}#</span>
                    </li>
                    <li className="rounded-xl bg-surface2 px-3 py-2">
                      Kad odbijete ili razgovarate: <span className="font-mono">**67*{number}#</span>
                    </li>
                    <li className="rounded-xl bg-surface2 px-3 py-2">
                      Kad ste bez signala: <span className="font-mono">**62*{number}#</span>
                    </li>
                    <li className="rounded-xl bg-surface2 px-3 py-2">
                      Isključiti sve: <span className="font-mono">##002#</span>
                    </li>
                  </ul>
                  <p className="text-xs text-muted">Preusmjereni poziv operater naplaćuje kao Vaš poziv na taj broj. AI se predstavlja kao virtualni asistent radionice.</p>
                </>
              ) : (
                <>
                  <p>Kad ga uključimo, pozive koje ne preuzmete preuzima AI: prepozna mušteriju, ponudi slobodan termin iz Vašeg radnog vremena i upiše nalog u Prijem. Vi samo potvrdite termin porukom.</p>
                  <SupportWhatsApp message={`Pozdrav, želim AI telefon za radionicu ${t.name}. `} label="Želim AI telefon" variant="primary" />
                </>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Radno vrijeme i termini" subtitle="AI nudi samo slobodne termine unutar ovoga" />
            <div className="p-4">
              <CalendarForm hours={readHours(t.settings)} />
            </div>
          </Card>
        </div>
        <Card>
          <CardHeader title="Zadnji pozivi" />
          {rows.length ? (
            <ul className="divide-y divide-line">
              {rows.map((c) => (
                <li key={c.id} className="space-y-1.5 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium">{c.caller ?? 'Nepoznat broj'}</span>
                    <span className="text-xs text-muted">{formatDateTime(c.started_at ?? c.created_at)}</span>
                    {c.duration_s ? <span className="text-xs text-faint">{Math.max(1, Math.round(c.duration_s / 60))} min</span> : null}
                    {c.job_id && c.job ? (
                      <Link href={`/app/jobs/${c.job_id}`} className="ml-auto text-xs font-medium text-accent hover:underline">
                        Nalog #{c.job.number}
                      </Link>
                    ) : null}
                  </div>
                  {c.summary ? <p className="text-muted">{c.summary}</p> : null}
                  {c.transcript ? (
                    <details className="text-xs text-faint">
                      <summary className="cursor-pointer select-none">Cijeli razgovor</summary>
                      <p className="mt-2 whitespace-pre-wrap">{c.transcript}</p>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<PhoneForwarded className="size-8" />} title="Još nema poziva">
              Ovdje se pojavi svaki poziv koji preuzme AI, sa sažetkom.
            </EmptyState>
          )}
        </Card>
      </div>
    </>
  );
}
