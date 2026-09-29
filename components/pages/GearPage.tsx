import Link from 'next/link';
import { Phone } from 'lucide-react';
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { assetTitle, clientName, daysUntil, formatDate, formatNumber } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';

export async function GearPage({ ctx }: { ctx: WorkshopContext }) {
  const horizon = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  const { data } = await ctx.supabase
    .from('gear_asset_schedule')
    .select('id, label, next_due_date, next_due_meter, asset:assets(id, identifier, make, model, asset_type, client:clients(kind, first_name, last_name, company_name, phone))')
    .or(`next_due_date.lte.${horizon},next_due_meter.not.is.null`)
    .order('next_due_date', { nullsFirst: false })
    .limit(300);

  type Row = {
    id: string;
    label: string;
    next_due_date: string | null;
    next_due_meter: number | null;
    asset: { id: string; identifier: string | null; make: string | null; model: string | null; asset_type: never; client: { kind: 'person' | 'company'; first_name: string | null; last_name: string | null; company_name: string | null; phone: string | null } | null } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  // One card per vehicle, most urgent first.
  const byAsset = new Map<string, { asset: NonNullable<Row['asset']>; items: Row[]; minDays: number }>();
  for (const row of rows) {
    if (!row.asset) continue;
    const days = daysUntil(row.next_due_date) ?? 9999;
    const entry = byAsset.get(row.asset.id) ?? { asset: row.asset, items: [], minDays: 9999 };
    entry.items.push(row);
    entry.minDays = Math.min(entry.minDays, days);
    byAsset.set(row.asset.id, entry);
  }
  const vehicles = [...byAsset.values()].sort((a, b) => a.minDays - b.minDays);

  if (!vehicles.length) {
    return <EmptyState title="Nema servisa u sljedećih 60 dana">Servisni plan se puni na nalogu, kartica „Servis i dijelovi”.</EmptyState>;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {vehicles.map(({ asset, items, minDays }) => (
        <Card key={asset.id}>
          <CardHeader
            title={
              <Link href={`/app/assets/${asset.id}`} className="hover:underline">
                {asset.identifier ? <span className="mr-2 font-mono">{asset.identifier}</span> : null}
                {assetTitle(asset)}
              </Link>
            }
            subtitle={clientName(asset.client)}
            action={<Badge tone={minDays < 0 ? 'crit' : minDays <= 14 ? 'warn' : 'muted'}>{minDays < 0 ? 'Prekoračeno' : minDays > 900 ? 'Po km' : `Za ${minDays} d`}</Badge>}
          />
          <ul className="divide-y divide-line text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between px-4 py-2.5">
                <span>{i.label}</span>
                <span className="tabular text-muted">{[i.next_due_date && formatDate(i.next_due_date), i.next_due_meter !== null && `${formatNumber(i.next_due_meter)} km`].filter(Boolean).join(' / ')}</span>
              </li>
            ))}
          </ul>
          {asset.client?.phone ? (
            <div className="border-t border-line px-4 py-2.5">
              <a href={`tel:${asset.client.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 text-sm text-accent">
                <Phone className="size-4" /> Nazovi {asset.client.phone}
              </a>
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
