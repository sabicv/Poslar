import Link from 'next/link';
import { QrCode, Search } from 'lucide-react';
import { RecordSheet } from '@/components/modules/kit';
import { StorageActions } from '@/components/modules/wheel/StorageActions';
import { tireSize, treadTone } from '@/components/modules/wheel/WheelModule';
import { Badge, Card, CardHeader, EmptyState, Input } from '@/components/ui';
import { SEASON_LABELS } from '@/config/packages/wheel';
import { clientName, formatDate } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { toIlike } from '@/lib/utils';

// The tyre hotel: what is stored where, and who owns it.
export async function WheelPage({ ctx, q }: { ctx: WorkshopContext; q: string }) {
  const search = q.trim();
  const [{ data: locations }, { data: stays }] = await Promise.all([
    ctx.supabase.from('wheel_storage_locations').select('*').order('sector').order('rack').order('shelf').order('slot'),
    ctx.supabase
      .from('wheel_storage_stays')
      .select(
        'id, location_id, checked_in_at, season_label, set:wheel_tire_sets(id, qr_code, season, width, aspect, rim_diameter, load_index, speed_index, brand, model, tires:wheel_tires(tread_inner_mm, tread_middle_mm, tread_outer_mm), client:clients(id, kind, first_name, last_name, company_name, phone), asset:assets(id, identifier))'
      )
      .is('checked_out_at', null)
      .order('checked_in_at', { ascending: false }),
  ]);

  type Stay = {
    id: string;
    location_id: string;
    checked_in_at: string;
    season_label: string | null;
    set: {
      id: string;
      qr_code: string;
      season: string;
      brand: string | null;
      model: string | null;
      tires: { tread_inner_mm: number | null; tread_middle_mm: number | null; tread_outer_mm: number | null }[];
      client: { id: string; kind: 'person' | 'company'; first_name: string | null; last_name: string | null; company_name: string | null; phone: string | null } | null;
      asset: { id: string; identifier: string | null } | null;
    } & Record<string, unknown>;
  };
  let rows = (stays ?? []) as unknown as Stay[];

  if (search) {
    const needle = search.toLowerCase().replace(/[\s-]/g, '');
    const { data: clients } = await ctx.supabase.from('clients').select('id').or(`first_name.ilike.${toIlike(search)},last_name.ilike.${toIlike(search)},company_name.ilike.${toIlike(search)}`).limit(50);
    const clientIds = new Set((clients ?? []).map((c) => c.id as string));
    rows = rows.filter(
      (r) =>
        r.set.qr_code === needle ||
        (r.set.asset?.identifier ?? '').toLowerCase().replace(/[\s-]/g, '').includes(needle) ||
        (r.set.client && clientIds.has(r.set.client.id))
    );
  }

  const label = (id: string) => {
    const l = (locations ?? []).find((x) => x.id === id);
    return l ? `${l.sector}-${l.rack}-${l.shelf}-${l.slot}` : '—';
  };
  const occupied = new Set(((stays ?? []) as unknown as Stay[]).map((s) => s.location_id));
  const capacity = (locations ?? []).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted">Na čuvanju</p>
          <p className="text-2xl font-semibold tabular">{(stays ?? []).length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Slobodno</p>
          <p className="text-2xl font-semibold tabular">{Math.max(0, capacity - occupied.size)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Popunjenost</p>
          <p className="text-2xl font-semibold tabular">{capacity ? Math.round((occupied.size / capacity) * 100) : 0}%</p>
        </Card>
      </div>

      <form className="relative" action="/app/module">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input name="q" defaultValue={search} placeholder="QR kod s naljepnice, registracija ili prezime" className="pl-9" />
      </form>

      {rows.length === 0 ? (
        <EmptyState title={search ? 'Ništa nije pronađeno' : 'Hotel je prazan'}>Setove zaprimate na nalogu, kartica „Gume i hotel”.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((stay) => {
            const treads = stay.set.tires.flatMap((t) => [t.tread_inner_mm, t.tread_middle_mm, t.tread_outer_mm]).filter((v): v is number => v !== null).map(Number);
            const min = treads.length ? Math.min(...treads) : null;
            return (
              <Card key={stay.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-lg font-bold tracking-wide text-accent">{label(stay.location_id)}</p>
                    <p className="text-sm font-medium">{clientName(stay.set.client)}</p>
                    <p className="text-xs text-muted">
                      {stay.set.asset?.identifier ? (
                        <Link prefetch={false} href={`/app/assets/${stay.set.asset.id}`} className="font-mono hover:underline">
                          {stay.set.asset.identifier}
                        </Link>
                      ) : null}{' '}
                      · od {formatDate(stay.checked_in_at)}
                    </p>
                  </div>
                  <Link href={`/app/module/label/${stay.set.id}`} target="_blank" className="flex items-center gap-1 text-xs text-muted hover:text-fg">
                    <QrCode className="size-4" /> {stay.set.qr_code}
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge tone={stay.set.season === 'winter' ? 'accent' : 'neutral'}>{SEASON_LABELS[stay.set.season]}</Badge>
                  <span className="font-mono text-xs">{tireSize(stay.set)}</span>
                  {min !== null ? <Badge tone={treadTone(stay.set.season, min)}>min {min.toFixed(1)} mm</Badge> : null}
                </div>
                <div className="mt-3">
                  <StorageActions setId={stay.set.id} stayId={stay.id} locations={[]} seasonLabel="" jobId={null} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader
          title="Police i mjesta"
          subtitle="Oznaka: sektor-regal-polica-mjesto (npr. A-3-2-4)"
          action={
            <RecordSheet
              table="wheel_storage_locations"
              title="Novo mjesto"
              revalidate="/app/module"
              label="Mjesto"
              initial={{ sector: 'A', rack: 1, shelf: 1, slot: 1, capacity: 1, indoor: true }}
              fields={[
                { name: 'sector', label: 'Sektor', required: true, half: true },
                { name: 'rack', label: 'Regal', type: 'number', required: true, half: true },
                { name: 'shelf', label: 'Polica', type: 'number', required: true, half: true },
                { name: 'slot', label: 'Mjesto', type: 'number', required: true, half: true },
                { name: 'indoor', label: 'Zatvoreni prostor', type: 'checkbox' },
              ]}
            />
          }
        />
        {locations?.length ? (
          <div className="flex flex-wrap gap-1.5 p-4">
            {locations.map((l) => (
              <span
                key={l.id as string}
                className={`rounded-md border px-2 py-1 font-mono text-xs ${occupied.has(l.id as string) ? 'border-accent/40 bg-accent/10 text-fg' : 'border-line text-faint'}`}
              >
                {l.sector}-{l.rack}-{l.shelf}-{l.slot}
              </span>
            ))}
          </div>
        ) : (
          <p className="px-4 py-4 text-sm text-muted">Dodajte mjesta u skladištu da biste mogli zaprimati gume.</p>
        )}
      </Card>
    </div>
  );
}
