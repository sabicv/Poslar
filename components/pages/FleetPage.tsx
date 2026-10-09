import Link from 'next/link';
import { complianceTone } from '@/components/modules/fleet/FleetModule';
import { RecordButton } from '@/components/modules/kit';
import { Badge, Card, CardHeader, EmptyState, buttonClass } from '@/components/ui';
import { COMPLIANCE_LABELS } from '@/config/packages/fleet';
import { MACHINE_COMPLIANCE_LABELS } from '@/config/packages/machine';
import { assetTitle, clientName, daysUntil, formatDate, formatRelative } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';

const PRIORITY = { vehicle_down: { label: 'Vozilo stoji', tone: 'crit' }, urgent: { label: 'Hitno', tone: 'warn' }, planned: { label: 'Planirano', tone: 'muted' } } as const;

export async function FleetPage({ ctx }: { ctx: WorkshopContext }) {
  const horizon = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  const [{ data: items }, { data: requests }] = await Promise.all([
    ctx.supabase
      .from('fleet_compliance_items')
      .select('id, kind, valid_until, asset:assets(id, identifier, make, model, asset_type, client:clients(kind, first_name, last_name, company_name))')
      .lte('valid_until', horizon)
      .order('valid_until')
      .limit(300),
    ctx.supabase
      .from('fleet_service_requests')
      .select('id, description, priority, status, reported_by, created_at, asset:assets(id, identifier, make, model, asset_type)')
      .in('status', ['new', 'accepted'])
      .order('created_at', { ascending: false }),
  ]);

  type Asset = { id: string; identifier: string | null; make: string | null; model: string | null; asset_type: never; client?: { kind: 'person' | 'company'; first_name: string | null; last_name: string | null; company_name: string | null } | null };
  const due = (items ?? []) as unknown as { id: string; kind: string; valid_until: string; asset: Asset | null }[];
  const reqs = (requests ?? []) as unknown as { id: string; description: string; priority: keyof typeof PRIORITY; status: string; reported_by: string | null; created_at: string; asset: Asset | null }[];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Rokovi u sljedećih 60 dana" subtitle={`${due.filter((d) => (daysUntil(d.valid_until) ?? 0) < 0).length} isteklih`} />
        {due.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Nema rokova koji ističu" />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {due.map((d) => {
              const days = daysUntil(d.valid_until);
              return (
                <li key={d.id}>
                  <Link href={d.asset ? `/app/assets/${d.asset.id}` : '#'} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm hover:bg-surface2">
                    <span className="font-mono font-semibold">{d.asset?.identifier ?? '-'}</span>
                    <span className="text-muted">{assetTitle(d.asset)}</span>
                    <span className="w-full text-xs text-faint sm:w-auto">{clientName(d.asset?.client)}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-xs">{(ctx.pkg.id === 'machine' ? MACHINE_COMPLIANCE_LABELS : COMPLIANCE_LABELS)[d.kind] ?? d.kind}</span>
                      <Badge tone={complianceTone(days)}>{days !== null && days < 0 ? `isteklo ${formatDate(d.valid_until)}` : formatDate(d.valid_until)}</Badge>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Zahtjevi tvrtki" subtitle="Prijave kvarova od vozača i voditelja flota" />
        {reqs.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Nema otvorenih zahtjeva" />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {reqs.map((r) => (
              <li key={r.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={PRIORITY[r.priority].tone}>{PRIORITY[r.priority].label}</Badge>
                  <span className="font-mono font-semibold">{r.asset?.identifier}</span>
                  <span className="text-xs text-faint">
                    {r.reported_by ?? ''} · {formatRelative(r.created_at)}
                  </span>
                </div>
                <p className="text-sm">{r.description}</p>
                <div className="flex gap-2">
                  {r.asset ? (
                    <Link href={`/app/jobs/new?asset=${r.asset.id}`} className={buttonClass('primary', 'sm')}>
                      Otvori nalog
                    </Link>
                  ) : null}
                  {r.status === 'new' ? (
                    <RecordButton table="fleet_service_requests" id={r.id} revalidate="/app/module" size="sm" values={{ status: 'accepted' }}>
                      Prihvati
                    </RecordButton>
                  ) : null}
                  <RecordButton table="fleet_service_requests" id={r.id} revalidate="/app/module" size="sm" variant="ghost" values={{ status: 'rejected' }}>
                    Odbij
                  </RecordButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
