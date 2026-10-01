import Link from 'next/link';
import { RecordButton, RecordSheet } from '@/components/modules/kit';
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { ASSET_TYPE_LABELS } from '@/config/tenant.config';
import { assetTitle, clientName, daysUntil, formatDate } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';

const KIND = { hall: 'Hala', covered: 'Nadstrešnica', outdoor: 'Otvoreno' };

export async function MotoPage({ ctx }: { ctx: WorkshopContext }) {
  const [{ data: locations }, { data: stays }] = await Promise.all([
    ctx.supabase.from('moto_storage_locations').select('*').order('area').order('slot'),
    ctx.supabase
      .from('moto_storage_stays')
      .select('id, location_id, from_date, until_date, asset:assets(id, identifier, make, model, asset_type, client:clients(kind, first_name, last_name, company_name, phone))')
      .is('released_at', null)
      .order('from_date'),
  ]);
  type Stay = { id: string; location_id: string; from_date: string; until_date: string | null; asset: { id: string; identifier: string | null; make: string | null; model: string | null; asset_type: keyof typeof ASSET_TYPE_LABELS; client: never } | null };
  const rows = (stays ?? []) as unknown as Stay[];
  const where = new Map((locations ?? []).map((l) => [l.id as string, l.slot === '—' ? (l.area as string) : `${l.area} · ${l.slot}`]));
  const occupied = new Set(rows.map((r) => r.location_id));

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <EmptyState title="Ništa nije na skladištu">Smještaj se otvara na nalogu, kartica „Sezona i plovilo”.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((s) => {
            const left = daysUntil(s.until_date);
            return (
              <Card key={s.id} className="p-4">
                <p className="font-mono text-lg font-bold text-accent">{where.get(s.location_id)}</p>
                {s.asset ? (
                  <Link prefetch={false} href={`/app/assets/${s.asset.id}`} className="block text-sm font-medium hover:underline">
                    {assetTitle(s.asset)} {s.asset.identifier ? <span className="font-mono text-muted">· {s.asset.identifier}</span> : null}
                  </Link>
                ) : null}
                <p className="text-xs text-muted">
                  {clientName(s.asset?.client)} · {s.asset ? ASSET_TYPE_LABELS[s.asset.asset_type] : ''}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="muted">od {formatDate(s.from_date)}</Badge>
                  {s.until_date ? <Badge tone={left !== null && left <= 14 ? 'warn' : 'muted'}>do {formatDate(s.until_date)}</Badge> : null}
                  <span className="ml-auto">
                    <RecordButton table="moto_storage_stays" id={s.id} revalidate="/app/module" size="sm" values={{ released_at: '__now__' }} success="Izdano">
                      Izdaj
                    </RecordButton>
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader
          title="Mjesta za smještaj"
          action={
            <RecordSheet
              table="moto_storage_locations"
              title="Novo mjesto"
              revalidate="/app/module"
              label="Mjesto"
              initial={{ kind: 'hall' }}
              fields={[
                { name: 'area', label: 'Prostor', placeholder: 'npr. Hala 1', required: true, half: true },
                { name: 'slot', label: 'Mjesto', placeholder: 'npr. 12', required: true, half: true },
                { name: 'kind', label: 'Vrsta', type: 'select', options: Object.entries(KIND).map(([value, label]) => ({ value, label })), required: true },
              ]}
            />
          }
        />
        {locations?.length ? (
          <div className="flex flex-wrap gap-1.5 p-4">
            {locations.map((l) => (
              <span key={l.id as string} className={`rounded-md border px-2 py-1 text-xs ${occupied.has(l.id as string) ? 'border-accent/40 bg-accent/10' : 'border-line text-faint'}`}>
                {where.get(l.id as string)}
              </span>
            ))}
          </div>
        ) : (
          <p className="px-4 py-4 text-sm text-muted">Dodajte mjesta u hali ili na otvorenom.</p>
        )}
      </Card>
    </div>
  );
}
