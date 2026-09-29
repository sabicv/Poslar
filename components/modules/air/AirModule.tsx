import { CalendarClock, Gauge, ShieldCheck } from 'lucide-react';
import { Badge, Card, CardHeader, KeyValue } from '@/components/ui';
import { REFRIGERANTS, fgasObligations, nextLeakCheck } from '@/config/packages/air';
import { assetTitle, daysUntil, formatDate, formatDateTime, formatDecimal, formatNumber } from '@/lib/format';
import { addMonths, dayOf, todayInZagreb } from '@/lib/time';
import type { ModuleProps } from '../ModuleTab';
import { DeleteRecordButton, RecordSheet } from '../kit';
import { opts } from '../options';
import { ChargeCalculator } from './ChargeCalculator';

export const FGAS_ACTIONS: Record<string, string> = {
  charge: 'Punjenje (nova instalacija)',
  top_up: 'Dopuna',
  recovery: 'Povrat (izvlačenje) plina',
  leak_check: 'Provjera propuštanja',
  repair: 'Popravak propuštanja',
  decommission: 'Stavljanje izvan uporabe',
};

const gasOptions = Object.entries(REFRIGERANTS).map(([value, g]) => ({ value, label: `${g.label} · GWP ${g.gwp}` }));

export async function AirModule({ ctx, job, locked }: ModuleProps) {
  const path = `/app/jobs/${job.id}`;
  const s = ctx.supabase;
  const [{ data: device }, { data: log }, { data: plans }, { data: me }] = await Promise.all([
    s.from('air_equipment').select('*').eq('asset_id', job.asset.id).maybeSingle(),
    s.from('air_fgas_log').select('*, technician:profiles(full_name)').eq('asset_id', job.asset.id).order('performed_at', { ascending: false }).limit(20),
    s.from('maintenance_plans').select('*').eq('client_id', job.client.id).eq('active', true),
    s.from('profiles').select('fgas_certificate').eq('id', ctx.user.id).single(),
  ]);

  const duty = fgasObligations((device?.refrigerant as string | null) ?? null, device?.charge_kg != null ? Number(device.charge_kg) : null, {
    sealed: Boolean(device?.hermetically_sealed),
    leakDetection: Boolean(device?.leak_detection),
  });
  const lastDay = (action: string) => {
    const entry = (log ?? []).find((l) => l.action === action);
    return entry ? dayOf(entry.performed_at as string) : null;
  };
  const leakCheck = duty.leakCheckMonths ? nextLeakCheck(duty.leakCheckMonths, lastDay('leak_check'), lastDay('repair')) : null;
  const nextCheck = leakCheck?.due ?? null;
  const plan = (plans ?? []).find((p) => p.asset_id === job.asset.id) ?? (plans ?? []).find((p) => !p.asset_id && p.site_id === job.site_id) ?? null;
  const today = todayInZagreb();
  const refrigerant = (device?.refrigerant as string | null) ?? 'R32';

  return (
    <div className="space-y-4">
      {/* Device and legal obligations */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Gauge className="size-4 text-accent" /> {assetTitle(job.asset)}
            </span>
          }
          subtitle="Podaci s natpisne pločice — iz njih se računaju obveze"
          action={
            <RecordSheet
              table="air_equipment"
              title="Podaci uređaja"
              upsertOn="asset_id"
              revalidate={path}
              fixed={{ asset_id: job.asset.id }}
              initial={device ?? { refrigerant: 'R32' }}
              label={device ? 'Uredi' : 'Upiši'}
              fields={[
                { name: 'refrigerant', label: 'Radna tvar', type: 'select', options: gasOptions, half: true, required: true },
                { name: 'charge_kg', label: 'Tvorničko punjenje', type: 'number', suffix: 'kg', half: true, required: true },
                { name: 'cooling_kw', label: 'Snaga hlađenja', type: 'number', suffix: 'kW', half: true },
                { name: 'heating_kw', label: 'Snaga grijanja', type: 'number', suffix: 'kW', half: true },
                { name: 'indoor_units', label: 'Broj unutarnjih jedinica', type: 'number', half: true },
                { name: 'install_date', label: 'Datum montaže', type: 'date', half: true },
                { name: 'indoor_serial', label: 'Serijski — unutarnja', half: true },
                { name: 'outdoor_serial', label: 'Serijski — vanjska', half: true },
                { name: 'warranty_until', label: 'Jamstvo do', type: 'date', half: true },
                { name: 'hermetically_sealed', label: 'Hermetički zatvoren sustav', type: 'checkbox' },
                { name: 'leak_detection', label: 'Ugrađen sustav za otkrivanje propuštanja', type: 'checkbox' },
              ]}
            />
          }
        />
        {device ? (
          <div className="p-4">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {duty.tco2e !== null ? <Badge tone="neutral">{formatDecimal(duty.tco2e, 2)} t CO₂e</Badge> : null}
              {duty.serviceCard ? <Badge tone="warn">Servisna kartica SK 1 obavezna (≥ 3 kg)</Badge> : null}
              {duty.leakCheckMonths ? <Badge tone="accent">Provjera propuštanja svakih {duty.leakCheckMonths} mj.</Badge> : <Badge tone="muted">Bez obvezne periodične provjere</Badge>}
            </div>
            <p className="mb-3 text-sm text-muted">{duty.note}</p>
            <div className="grid gap-x-8 sm:grid-cols-2">
              <KeyValue label="Radna tvar">{`${device.refrigerant ?? '—'} · ${device.charge_kg != null ? formatNumber(Number(device.charge_kg), 2) : '—'} kg`}</KeyValue>
              <KeyValue label="Snaga">
                {[device.cooling_kw && `${formatNumber(Number(device.cooling_kw), 2)} kW hlađenje`, device.heating_kw && `${formatNumber(Number(device.heating_kw), 2)} kW grijanje`].filter(Boolean).join(' · ') || '—'}
              </KeyValue>
              <KeyValue label="Serijski">{[device.indoor_serial, device.outdoor_serial].filter(Boolean).join(' / ') || '—'}</KeyValue>
              <KeyValue label="Montaža / jamstvo">{`${formatDate(device.install_date as string | null)} / ${formatDate(device.warranty_until as string | null)}`}</KeyValue>
              {duty.leakCheckMonths ? (
                <KeyValue label={leakCheck?.afterRepair ? 'Kontrola nakon popravka propuštanja' : 'Sljedeća provjera propuštanja'}>
                  {nextCheck ? (
                    <Badge tone={(daysUntil(nextCheck) ?? 0) < 0 ? 'crit' : (daysUntil(nextCheck) ?? 99) <= 30 ? 'warn' : 'ok'}>{formatDate(nextCheck)}</Badge>
                  ) : (
                    <Badge tone="warn">Nema zapisa o provjeri</Badge>
                  )}
                </KeyValue>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="px-4 py-4 text-sm text-muted">Upišite radnu tvar i punjenje s natpisne pločice (fotografirajte je u kartici Fotografije).</p>
        )}
      </Card>

      {/* F-gas record */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" /> Evidencija F-plina
            </span>
          }
          subtitle="Svaka intervencija s radnom tvari — čuva se najmanje 5 godina"
          action={
            !locked ? (
              <RecordSheet
                table="air_fgas_log"
                title="Zapis intervencije"
                revalidate={path}
                fixed={{ job_id: job.id, asset_id: job.asset.id, technician_id: ctx.user.id, performed_at: '__now__' }}
                initial={{ refrigerant, action: 'leak_check', quantity_kg: 0, leak_found: false, technician_cert: me?.fgas_certificate ?? '' }}
                label="Zapis"
                fields={[
                  { name: 'action', label: 'Vrsta intervencije', type: 'select', options: opts(FGAS_ACTIONS), required: true },
                  { name: 'refrigerant', label: 'Radna tvar', type: 'select', options: gasOptions, half: true, required: true },
                  { name: 'quantity_kg', label: 'Količina', type: 'number', suffix: 'kg', half: true },
                  { name: 'leak_found', label: 'Pronađeno propuštanje', type: 'checkbox' },
                  { name: 'leak_location', label: 'Mjesto propuštanja' },
                  { name: 'cause', label: 'Uzrok i poduzete mjere', type: 'textarea' },
                  { name: 'technician_cert', label: 'Broj certifikata servisera', required: true },
                ]}
              />
            ) : null
          }
        />
        {(log ?? []).length ? (
          <ul className="divide-y divide-line">
            {(log ?? []).map((entry) => (
              <li key={entry.id as string} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className="w-32 shrink-0 text-xs text-faint">{formatDateTime(entry.performed_at as string)}</span>
                <span className="font-medium">{FGAS_ACTIONS[entry.action as string]}</span>
                {Number(entry.quantity_kg) > 0 ? <Badge tone="neutral">{`${formatNumber(Number(entry.quantity_kg), 2)} kg ${entry.refrigerant}`}</Badge> : null}
                {entry.leak_found === true ? <Badge tone="crit">Propuštanje: {(entry.leak_location as string | null) ?? 'da'}</Badge> : entry.action === 'leak_check' ? <Badge tone="ok">Bez propuštanja</Badge> : null}
                <span className="text-xs text-muted">
                  {(entry.technician as { full_name: string | null } | null)?.full_name ?? ''} · cert. {(entry.technician_cert as string | null) ?? '—'}
                </span>
                {entry.job_id === job.id && !locked ? (
                  <span className="ml-auto">
                    <DeleteRecordButton table="air_fgas_log" id={entry.id as string} revalidate={path} label="×" />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-4 text-sm text-muted">Nema zapisa za ovaj uređaj.</p>
        )}
        {!me?.fgas_certificate ? <p className="border-t border-line px-4 py-2.5 text-xs text-faint">Upišite broj svog F-plin certifikata u Postavke → Moj račun da se sam popunjava.</p> : null}
      </Card>

      {/* Extra charge calculator */}
      {!locked ? <ChargeCalculator jobId={job.id} assetId={job.asset.id} refrigerant={refrigerant} certificate={(me?.fgas_certificate as string | null) ?? ''} /> : null}

      {/* Maintenance plan */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <CalendarClock className="size-4 text-accent" /> Servisni plan
            </span>
          }
          subtitle={plan ? `${plan.title} · svakih ${plan.interval_months} mj.` : 'Ponavljajući servis: aplikacija sama ponudi termin kad se približi'}
          action={
            <RecordSheet
              table="maintenance_plans"
              title="Servisni plan"
              id={plan?.id as string | undefined}
              revalidate={path}
              fixed={{ client_id: job.client.id, site_id: job.site_id, asset_id: job.asset.id }}
              initial={
                plan ?? {
                  title: `Godišnji servis — ${assetTitle(job.asset)}`,
                  interval_months: 12,
                  next_due_date: addMonths(today, 12),
                  template_code: 'air.service_one',
                }
              }
              label={plan ? 'Uredi' : 'Uključi'}
              deletable={ctx.isOwner}
              fields={[
                { name: 'title', label: 'Naziv', required: true },
                { name: 'interval_months', label: 'Svakih', type: 'number', suffix: 'mj.', half: true, required: true },
                { name: 'next_due_date', label: 'Sljedeći servis', type: 'date', half: true, required: true },
                { name: 'template_code', label: 'Predložak posla', type: 'select', options: ctx.pkg.templates.map((t) => ({ value: t.code, label: t.name })) },
                { name: 'notes', label: 'Napomena', type: 'textarea' },
              ]}
            />
          }
        />
        {plan ? (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
            <span className="text-muted">Sljedeći servis:</span>
            <Badge tone={(daysUntil(plan.next_due_date as string) ?? 0) < 0 ? 'crit' : (daysUntil(plan.next_due_date as string) ?? 99) <= 30 ? 'warn' : 'ok'}>{formatDate(plan.next_due_date as string)}</Badge>
            <span className="text-xs text-faint">Kad je ovaj nalog vezan uz plan i označen „Odrađeno”, datum se sam pomakne.</span>
          </div>
        ) : (
          <p className="px-4 py-3 text-sm text-muted">Nakon uključivanja klijent se mjesec dana prije roka sam pojavi u „Servisni planovi”, spreman za podsjetnik i zakazivanje.</p>
        )}
      </Card>
    </div>
  );
}
