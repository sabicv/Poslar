import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Badge, Card, CardHeader, buttonClass } from '@/components/ui';
import { REFRIGERANTS, fgasObligations, nextLeakCheck } from '@/config/packages/air';
import { assetTitle, clientName, daysUntil, formatDate, formatDecimal, formatNumber } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { dayOf, todayInZagreb, zagrebMidnight } from '@/lib/time';
import { cn } from '@/lib/utils';
import { DuePlans } from './DuePlans';

// Air Files: recurring service that is due, and the yearly F-gas picture.
export async function AirPage({ ctx, year: requestedYear }: { ctx: WorkshopContext; year?: string }) {
  const today = todayInZagreb();
  const year = requestedYear && /^\d{4}$/.test(requestedYear) ? Number(requestedYear) : Number(today.slice(0, 4));
  const [{ data: log }, { data: devices }, { data: checks }] = await Promise.all([
    ctx.supabase
      .from('air_fgas_log')
      .select('refrigerant, action, quantity_kg, leak_found')
      .gte('performed_at', zagrebMidnight(`${year}-01-01`).toISOString())
      .lt('performed_at', zagrebMidnight(`${year + 1}-01-01`).toISOString()),
    ctx.supabase.from('air_equipment').select('asset_id, refrigerant, charge_kg, hermetically_sealed, leak_detection, asset:assets(id, asset_type, make, model, client:clients(kind, first_name, last_name, company_name))'),
    ctx.supabase.from('air_fgas_log').select('asset_id, action, performed_at').in('action', ['leak_check', 'repair']).order('performed_at', { ascending: false }).limit(2000),
  ]);

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
      <DuePlans ctx={ctx} emptyHint="Servisni plan se uključuje na nalogu, kartica „Uređaj i F-plin”. Klijent se ovdje sam pojavi mjesec dana prije roka." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-accent" /> F-plinovi {year}
              </span>
            }
            subtitle="Po radnoj tvari, za godišnje izvješće"
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
                  <tr className="whitespace-nowrap text-left text-xs text-faint">
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
          <CardHeader title="Provjere propuštanja u sljedećih 60 dana" />
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
                        {afterRepair && <span className="block text-xs text-warn">Kontrola nakon popravka propuštanja, najkasnije mjesec dana od popravka</span>}
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
