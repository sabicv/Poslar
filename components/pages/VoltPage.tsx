import Link from 'next/link';
import { Search } from 'lucide-react';
import { Badge, Card, CardHeader, EmptyState, Input } from '@/components/ui';
import { DTC_CATEGORY_HINTS, DTC_CODES, findDtcCode, searchDtcCodes } from '@/config/packages/volt-dtc';
import type { WorkshopContext } from '@/lib/session';
import { RecordSheet } from '@/components/modules/kit';

export async function VoltPage({ ctx, q }: { ctx: WorkshopContext; q: string }) {
  const [{ data: solved }, { data: custom }] = await Promise.all([
    ctx.supabase
      .from('volt_dtc_findings')
      .select('code, confirmed_cause, resolution_note, job_id, created_at')
      .not('confirmed_cause', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200),
    ctx.supabase.from('volt_dtc_custom').select('*').order('code'),
  ]);

  const query = q.trim();
  const hits = query ? searchDtcCodes(query, 20) : [];
  const ownHits = query ? (custom ?? []).filter((c) => `${c.code} ${c.description_hr}`.toLowerCase().includes(query.toLowerCase())) : [];
  const cases = new Map<string, { cause: string; note: string | null; jobId: string }[]>();
  for (const row of solved ?? []) {
    const list = cases.get(row.code as string) ?? [];
    list.push({ cause: row.confirmed_cause as string, note: row.resolution_note as string | null, jobId: row.job_id as string });
    cases.set(row.code as string, list);
  }
  const shownCodes = query ? [...new Set([...hits.map((h) => h.code), ...ownHits.map((h) => h.code as string)])] : [...cases.keys()].slice(0, 30);

  return (
    <div className="space-y-4">
      <form className="relative" action="/app/module">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input name="q" defaultValue={query} placeholder="Kod (P0299, 0299) ili riječ (turbo, ključ, AdBlue)…" className="pl-9" />
      </form>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          {DTC_CODES.length} kodova u knjižnici · {(custom ?? []).length} Vaših · {(solved ?? []).length} riješenih slučajeva
        </p>
        <RecordSheet
          table="volt_dtc_custom"
          title="Vlastiti kod"
          revalidate="/app/module"
          label="Vlastiti kod"
          fields={[
            { name: 'code', label: 'Kod', required: true, half: true },
            { name: 'brand', label: 'Marka', half: true },
            { name: 'description_hr', label: 'Opis', required: true, type: 'textarea' },
          ]}
        />
      </div>

      {shownCodes.length === 0 ? (
        <EmptyState title={query ? 'Nema pogodaka' : 'Još nema riješenih slučajeva'}>
          {query ? 'Pokušajte samo brojevima koda ili jednom riječju.' : 'Kad na nalogu upišete „Potvrđeni uzrok” kod greške, pojavit će se ovdje za sljedeći put.'}
        </EmptyState>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shownCodes.map((code) => {
            const entry = findDtcCode(code);
            const own = (custom ?? []).find((c) => c.code === code);
            const list = cases.get(code) ?? [];
            const hints = entry ? DTC_CATEGORY_HINTS[entry.category] : null;
            return (
              <Card key={code}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <span className="font-mono">{code}</span>
                      {entry ? <Badge tone="muted">{entry.category}</Badge> : null}
                      {entry?.brand ? <Badge tone="accent">{entry.brand}</Badge> : null}
                      {own ? <Badge tone="accent">Vaš</Badge> : null}
                    </span>
                  }
                  subtitle={(own?.description_hr as string | undefined) ?? entry?.description}
                />
                <div className="space-y-3 p-4 text-sm">
                  {list.length ? (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ok">Na Vašim nalozima bilo je</p>
                      <ul className="space-y-1">
                        {list.slice(0, 5).map((c, i) => (
                          <li key={i}>
                            <Link prefetch={false} href={`/app/jobs/${c.jobId}?tab=modul`} className="hover:underline">
                              {c.cause}
                            </Link>
                            {c.note ? <span className="text-muted">: {c.note}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {/* The same general advice fits every code of a category, so it stays folded. */}
                  {hints ? (
                    <details className="text-muted">
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-faint">Česti uzroci i prva mjerenja ({entry?.category})</summary>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <ul className="list-disc space-y-0.5 pl-4">{hints.causes.map((c) => <li key={c}>{c}</li>)}</ul>
                        <ul className="list-disc space-y-0.5 pl-4">{hints.tests.map((t) => <li key={t}>{t}</li>)}</ul>
                      </div>
                    </details>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
