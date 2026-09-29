import Link from 'next/link';
import { CalendarPlus, ShieldCheck } from 'lucide-react';
import { Badge, Card, CardHeader, EmptyState, buttonClass } from '@/components/ui';
import { REFRIGERANTS, fgasObligations, nextLeakCheck } from '@/config/packages/air';
import { assetTitle, clientName, daysUntil, formatDate, formatDecimal, formatNumber, formatRelative } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { addDays, dayOf, todayInZagreb, zagrebMidnight } from '@/lib/time';
import { cn } from '@/lib/utils';
import { PlanReminderButton } from './PlanReminderButton';

type PlanRow = {
  id: string;
  title: string;
  next_due_date: string;
  interval_months: number;
  last_reminded_at: string | null;
  client: { kind: 'person' | 'company'; first_name: string | null; last_name: string | null; company_name: string | null; phone: string | null } | null;
  site: { address: string; city: string | null; contact_phone: string | null } | null;
  asset: { asset_type: never; make: string | null; model: string | null } | null;
};

// Air Files: recurring service that is due, and the yearly F-gas picture.
export async function AirPage({ ctx, year: requestedYear }: { ctx: WorkshopContext; year?: string }) {
  const today = todayInZagreb();
  const year = requestedYear && /^\d{4}$/.test(requestedYear) ? Number(requestedYear) : Number(today.slice(0, 4));
  const [{ data: plans }, { data: log }, { data: devices }, { data: checks }] = await Promise.all([
    ctx.supabase
      .from('maintenance_plans')
      .select('id, title, next_due_date, interval_months, last_reminded_at, client:clients(kind, first_name, last_name, company_name, phone), site:sites(address, city, contact_phone), asset:assets(asset_type, make, model)')
      .eq('active', true)
      .lte('next_due_date', addDays(today, 60))
      .order('next_due_date'),
    ctx.supabase
      .from('air_fgas_log')
      .select('refrigerant, action, quantity_kg, leak_found')
      .gte('performed_at', zagrebMidnight(`${year}-01-01`).toISOString())
      .lt('performed_at', zagrebMidnight(`${year + 1}-01-01`).toISOString()),
    ctx.supabase.from('air_equipment').select('asset_id, refrigerant, charge_kg, hermetically_sealed, leak_detection, asset:assets(id, asset_type, make, model, client:clients(kind, first_name, last_name, company_name))'),
    ctx.supabase.from('air_fgas_log').select('asset_id, action, performed_at').in('action', ['leak_check', 'repair']).order('performed_at', { ascending: false }).limit(2000),
  ]);

  const rows = (plans ?? []) as unknown as PlanRow[];
  const groups = [
    { title: 'Prekoračeno', rows: rows.filter((p) => (daysUntil(p.next_due_date) ?? 0) < 0), tone: 'crit' as const },
    { title: 'Sljedećih 30 dana', rows: rows.filter((p) => { const d = daysUntil(p.next_due_date) ?? 0; return d >= 0 && d <= 30; }), tone: 'warn' as const },
    { title: '31–60 dana', rows: rows.filter((p) => (daysUntil(p.next_due_date) ?? 0) > 30), tone: 'muted' as const },
  ].filter((g) => g.rows.length);

  // Yearly totals per refrigerant (basis for the annual report).
  const totals = new Map<string, { charged: number; recovered: number; checks: number; leaks: number }>();
  for (const entry of log ?? []) {
    const t = totals.get(entry.refrigerant as string) ?? { charged: 0, recovered: 0, checks: 0, leaks: 0 };
    const kg = Number(entry.quantity_kg ?? 0);
    if (entry.action === 'charge' || entry.action === 'top_up') t.charged += kg;
    if (entry.action === 'recovery' || entry.action === 'decommission') t.recovered += kg;
    if (entry.action === 'leak_check') t.checks++;
    if (entry.leak_found) t.leaks++;
    totals.set(entry.refrigerant as string, t);
  }

  // Devices whose leak check is due within 60 days (or never recorded).
  const lastCheck = new Map<string, string>();
  const lastRepair = new Map<string, string>();
  for (const c of checks ?? []) {
    const latest = c.action === 'repair' ? lastRepair : lastCheck;
    if (!latest.has(c.asset_id as string)) latest.set(c.asset_id as string, dayOf(c.performed_at as string));
  }
  const leakDue = (devices ?? [])
    .map((d) => {
      const duty = fgasObligations(d.refrigerant as string | null, d.charge_kg != null ? Number(d.charge_kg) : null, { sealed: Boolean(d.hermetically_sealed), leakDetection: Boolean(d.leak_detection) });
      if (!duty.leakCheckMonths) return null;
      const { due, afterRepair } = nextLeakCheck(duty.leakCheckMonths, lastCheck.get(d.asset_id as string) ?? null, lastRepair.get(d.asset_id as string) ?? null);
      return { device: d, duty, due, afterRepair };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && (x.due === null || (daysUntil(x.due) ?? 0) <= 60))
    .sort((a, b) => (a.due ?? '0000').localeCompare(b.due ?? '0000'));

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        {groups.length === 0 ? (
          <EmptyState icon={<CalendarPlus className="size-8" />} title="Nema servisa u sljedećih 60 dana">
            Servisni plan se uključuje na nalogu, kartica „Uređaj i F-plin”. Klijent se ovdje sam pojavi mjesec dana prije roka.
          </EmptyState>
        ) : (
          groups.map((group) => (
            <div key={group.title}>
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                {group.title} <span className="rounded bg-surface2 px-1.5 text-[11px] text-faint">{group.rows.length}</span>
              </h2>
              <ul className="space-y-2">
                {group.rows.map((plan) => {
                  const phone = plan.site?.contact_phone || plan.client?.phone || null;
                  const place = [plan.site?.address, plan.site?.city].filter(Boolean).join(', ');
                  return (
                    <li key={plan.id} className="rounded-xl border border-line bg-surface p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{clientName(plan.client)}</p>
                          <p className="truncate text-xs text-muted">{[place, assetTitle(plan.asset)].filter(Boolean).join(' · ')}</p>
                          <p className="text-xs text-faint">
                            {plan.title}
                            {plan.last_reminded_at ? ` · podsjetnik poslan ${formatRelative(plan.last_reminded_at)}` : ''}
                          </p>
                        </div>
                        <Badge tone={group.tone}>{formatDate(plan.next_due_date)}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <PlanReminderButton
                          planId={plan.id}
                          phone={phone}
                          message={`Poštovani, bliži se ${plan.title.toLowerCase()}${place ? ` na adresi ${place}` : ''} (rok ${formatDate(plan.next_due_date)}). Odgovorite s danom i vremenom koje vam odgovara. — ${ctx.tenant.name}${ctx.tenant.phone ? `, ${ctx.tenant.phone}` : ''}`}
                        />
                        <Link href={`/app/jobs/new?plan=${plan.id}`} className={buttonClass('primary', 'sm')}>
                          <CalendarPlus className="size-4" /> Zakaži
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-accent" /> F-plinovi {year}
              </span>
            }
            subtitle="Ukupno po radnoj tvari — podloga za godišnje izvješće"
            action={
              <div className="flex gap-1">
                {[year - 1, year].map((y) => (
                  <Link key={y} href={`/app/module?y=${y}`} className={cn(buttonClass(y === year ? 'primary' : 'ghost', 'sm'))}>
                    {y}
                  </Link>
                ))}
              </div>
            }
          />
          {totals.size ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-faint">
                    <th className="px-4 py-2 font-normal">Tvar</th>
                    <th className="px-4 py-2 text-right font-normal">Napunjeno kg</th>
                    <th className="px-4 py-2 text-right font-normal">Povrat kg</th>
                    <th className="px-4 py-2 text-right font-normal">Provjera</th>
                    <th className="px-4 py-2 text-right font-normal">Propuštanja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...totals.entries()].map(([gas, t]) => (
                    <tr key={gas}>
                      <td className="px-4 py-2 font-medium">{REFRIGERANTS[gas]?.label ?? gas}</td>
                      <td className="px-4 py-2 text-right tabular">{formatDecimal(t.charged, 2)}</td>
                      <td className="px-4 py-2 text-right tabular">{formatDecimal(t.recovered, 2)}</td>
                      <td className="px-4 py-2 text-right tabular">{t.checks}</td>
                      <td className={cn('px-4 py-2 text-right tabular', t.leaks && 'text-crit')}>{t.leaks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">Nema zapisa za {year}.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Provjere propuštanja koje dolaze" subtitle="Uređaji ≥ 5 t CO₂e: rok u sljedećih 60 dana, bez zapisa ili kontrola nakon popravka" />
          {leakDue.length ? (
            <ul className="divide-y divide-line">
              {leakDue.map(({ device, duty, due, afterRepair }) => {
                const asset = device.asset as unknown as { id: string; asset_type: never; make: string | null; model: string | null; client: never } | null;
                return (
                  <li key={device.asset_id as string}>
                    <Link href={asset ? `/app/assets/${asset.id}` : '#'} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface2">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{clientName(asset?.client)}</span>
                        <span className="block truncate text-xs text-muted">
                          {assetTitle(asset)} · {device.refrigerant as string} {formatNumber(Number(device.charge_kg), 2)} kg · {formatDecimal(duty.tco2e, 2)} t CO₂e · svakih {duty.leakCheckMonths} mj.
                        </span>
                        {afterRepair && <span className="block text-xs text-warn">Kontrola nakon popravka propuštanja — najkasnije mjesec dana od popravka</span>}
                      </span>
                      <Badge tone={due === null || (daysUntil(due) ?? 0) < 0 ? 'crit' : 'warn'}>{due ? formatDate(due) : 'bez zapisa'}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">Nijedna provjera ne dospijeva u sljedećih 60 dana.</p>
          )}
        </Card>
      </div>
      <p className="text-xs text-faint">
        Pravila (EU 2024/573: provjere od 5 t CO₂e; servisna kartica SK 1 od 3 kg) prikazana su kao pomoć. Za izvješće i obrasce vrijedi važeći propis.
      </p>
    </div>
  );
}
