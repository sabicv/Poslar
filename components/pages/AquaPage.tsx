import Link from 'next/link';
import { Badge, Card, CardHeader } from '@/components/ui';
import { assetTitle, clientName, formatDate } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { addMonths, todayInZagreb } from '@/lib/time';
import { DuePlans } from './DuePlans';

// Aqua Files: service that is due, and water heaters whose anode is old
// enough to offer a service even without a plan.
export async function AquaPage({ ctx }: { ctx: WorkshopContext }) {
  const today = todayInZagreb();
  const { data: heaters } = await ctx.supabase
    .from('aqua_equipment')
    .select('asset_id, anode_changed_on, asset:assets!inner(id, asset_type, make, model, client:clients(kind, first_name, last_name, company_name, phone))')
    .eq('asset.asset_type', 'water_heater')
    .lte('anode_changed_on', addMonths(today, -24))
    .order('anode_changed_on')
    .limit(100);
  type Row = { asset_id: string; anode_changed_on: string; asset: { id: string; asset_type: never; make: string | null; model: string | null; client: { kind: 'person' | 'company'; first_name: string | null; last_name: string | null; company_name: string | null; phone: string | null } | null } | null };
  const rows = (heaters ?? []) as unknown as Row[];

  return (
    <div className="space-y-6">
      <DuePlans ctx={ctx} emptyHint="Servisni plan se uključuje na nalogu, kartica „Uređaj i tlačna proba”. Mušterija se ovdje pojavi mjesec dana prije roka." />
      <Card>
        <CardHeader title="Bojleri sa starom anodom" subtitle="Anoda mijenjana prije više od 2 godine: dobar razlog za poziv" />
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.asset_id}>
                <Link href={r.asset ? `/app/assets/${r.asset.id}` : '#'} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{clientName(r.asset?.client)}</span>
                    <span className="block truncate text-xs text-muted">{[assetTitle(r.asset), r.asset?.client?.phone].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Badge tone="warn">{formatDate(r.anode_changed_on)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-4 text-sm text-muted">Nema bojlera s anodom starijom od 2 godine. Datum zamjene anode upisuje se na nalogu.</p>
        )}
      </Card>
    </div>
  );
}
