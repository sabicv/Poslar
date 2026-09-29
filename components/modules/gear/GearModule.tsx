import Link from 'next/link';
import { CalendarClock, Package, Truck } from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components/ui';
import { daysUntil, formatDate, formatNumber } from '@/lib/format';
import type { ModuleProps } from '../ModuleTab';
import { DeleteRecordButton, RecordButton, RecordSheet } from '../kit';
import { opts } from '../options';

const ORDER_STATUS = { to_order: 'Naručiti', ordered: 'Naručeno', arrived: 'Stiglo', installed: 'Ugrađeno', returned: 'Vraćeno' } as const;
const ORDER_TONE = { to_order: 'warn', ordered: 'accent', arrived: 'ok', installed: 'muted', returned: 'muted' } as const;
const FLOW: (keyof typeof ORDER_STATUS)[] = ['to_order', 'ordered', 'arrived', 'installed'];

const TASK_PRESETS: Record<string, { label: string; km?: number; months?: number }> = {
  oil: { label: 'Ulje i filter ulja', km: 15000, months: 12 },
  air_filter: { label: 'Filter zraka', km: 30000, months: 24 },
  cabin_filter: { label: 'Filter kabine', km: 15000, months: 12 },
  fuel_filter: { label: 'Filter goriva', km: 60000, months: 48 },
  spark_plugs: { label: 'Svjećice', km: 60000, months: 48 },
  timing_belt: { label: 'Remen razvoda', km: 120000, months: 60 },
  brake_fluid: { label: 'Kočiona tekućina', months: 24 },
  coolant: { label: 'Rashladna tekućina', km: 150000, months: 60 },
  gearbox_oil: { label: 'Ulje mjenjača', km: 60000, months: 60 },
  ac_service: { label: 'Servis klime', months: 24 },
};

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export async function GearModule({ ctx, job, locked }: ModuleProps) {
  const path = `/app/jobs/${job.id}`;
  const [{ data: lines }, { data: parts }, { data: suppliers }, { data: schedule }] = await Promise.all([
    ctx.supabase.from('job_lines').select('id, description, qty, unit, approval').eq('job_id', job.id).eq('kind', 'part').order('sort'),
    ctx.supabase.from('gear_parts').select('*').eq('job_id', job.id),
    ctx.supabase.from('gear_suppliers').select('id, name, phone, delivery_days').order('name'),
    ctx.supabase.from('gear_asset_schedule').select('*').eq('asset_id', job.asset.id).order('next_due_date', { nullsFirst: false }),
  ]);
  const partByLine = new Map((parts ?? []).map((p) => [p.job_line_id as string, p]));
  const supplierOptions = (suppliers ?? []).map((s) => ({ value: s.id as string, label: s.name as string }));
  const supplierName = new Map((suppliers ?? []).map((s) => [s.id as string, s.name as string]));
  const meter = job.meter_out ?? job.meter_in;
  const today = new Date();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Package className="size-4 text-accent" /> Dijelovi na nalogu
            </span>
          }
          subtitle="Kataloški broj, dobavljač i status narudžbe za svaku stavku vrste Dio"
          action={
            <RecordSheet
              table="gear_suppliers"
              title="Novi dobavljač"
              revalidate={path}
              label="Dobavljač"
              trigger={
                <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface2 px-3 text-sm">
                  <Truck className="size-4" /> Dobavljač
                </button>
              }
              fields={[
                { name: 'name', label: 'Naziv', required: true },
                { name: 'contact', label: 'Kontakt osoba', half: true },
                { name: 'phone', label: 'Telefon', half: true },
                { name: 'delivery_days', label: 'Rok isporuke', type: 'number', suffix: 'dana', half: true },
                { name: 'customer_number', label: 'Naš kupčev broj', half: true },
              ]}
            />
          }
        />
        {!lines?.length ? (
          <p className="px-4 py-4 text-sm text-muted">
            Nema stavki vrste Dio. Dodajte ih u kartici{' '}
            <Link href={`${path}?tab=stavke`} className="text-accent">
              Stavke
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {lines.map((line) => {
              const part = partByLine.get(line.id as string);
              const status = (part?.order_status as keyof typeof ORDER_STATUS | undefined) ?? 'to_order';
              const nextStatus = FLOW[FLOW.indexOf(status) + 1];
              return (
                <li key={line.id as string} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm">{line.description as string}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {[
                          `${formatNumber(line.qty as number)} ${line.unit}`,
                          part?.brand,
                          part?.catalog_number && `kat. ${part.catalog_number}`,
                          part?.supplier_id && supplierName.get(part.supplier_id as string),
                          part?.supplier_order_no && `nar. ${part.supplier_order_no}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <Badge tone={ORDER_TONE[status]}>{ORDER_STATUS[status]}</Badge>
                  </div>
                  {!locked ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {nextStatus ? (
                        <RecordButton
                          table="gear_parts"
                          upsertOn="job_line_id"
                          revalidate={path}
                          size="sm"
                          variant="primary"
                          values={{
                            job_line_id: line.id,
                            job_id: job.id,
                            order_status: nextStatus,
                            ...(nextStatus === 'installed' ? { installed_meter: meter, installed_date: '__today__' } : {}),
                          }}
                        >
                          → {ORDER_STATUS[nextStatus]}
                        </RecordButton>
                      ) : null}
                      <RecordSheet
                        table="gear_parts"
                        title={line.description as string}
                        upsertOn="job_line_id"
                        revalidate={path}
                        fixed={{ job_line_id: line.id, job_id: job.id }}
                        initial={part ?? { order_status: 'to_order' }}
                        label="Detalji"
                        fields={[
                          { name: 'catalog_number', label: 'Kataloški broj', half: true },
                          { name: 'oe_number', label: 'OE broj', half: true },
                          { name: 'brand', label: 'Proizvođač', half: true },
                          { name: 'supplier_id', label: 'Dobavljač', type: 'select', options: supplierOptions, half: true },
                          { name: 'supplier_order_no', label: 'Broj narudžbe', half: true },
                          { name: 'order_status', label: 'Status', type: 'select', options: opts(ORDER_STATUS), half: true, required: true },
                          { name: 'serial_or_lot', label: 'Serijski broj / LOT (jamstvo)' },
                        ]}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <CalendarClock className="size-4 text-accent" /> Servisni plan vozila
            </span>
          }
          subtitle="Što prije nastupi: kilometri ili vrijeme"
          action={
            <RecordSheet
              table="gear_asset_schedule"
              title="Stavka servisnog plana"
              revalidate={path}
              fixed={{ asset_id: job.asset.id }}
              label="Stavka"
              initial={{ last_done_meter: meter, last_done_date: today.toISOString().slice(0, 10) }}
              fields={[
                {
                  name: 'task_code',
                  label: 'Vrsta',
                  type: 'select',
                  // A task already in this vehicle's plan is edited on its row, not added twice.
                  options: Object.entries(TASK_PRESETS)
                    .filter(([value]) => !(schedule ?? []).some((row) => row.task_code === value))
                    .map(([value, t]) => ({ value, label: t.label })),
                  required: true,
                },
                { name: 'label', label: 'Naziv (kako piše stranci)', required: true },
                { name: 'interval_km', label: 'Interval', type: 'number', suffix: 'km', half: true },
                { name: 'interval_months', label: 'Interval', type: 'number', suffix: 'mj.', half: true },
                { name: 'last_done_meter', label: 'Zadnje obavljeno na', type: 'number', suffix: 'km', half: true },
                { name: 'last_done_date', label: 'Zadnje obavljeno', type: 'date', half: true },
                { name: 'next_due_meter', label: 'Sljedeće na', type: 'number', suffix: 'km', half: true },
                { name: 'next_due_date', label: 'Sljedeće do', type: 'date', half: true },
              ]}
            />
          }
        />
        {!schedule?.length ? (
          <p className="px-4 py-4 text-sm text-muted">Dodajte intervale (ulje, remen, kočiona tekućina…) i aplikacija će pokazati što dolazi na red.</p>
        ) : (
          <ul className="divide-y divide-line">
            {schedule.map((row) => {
              const days = daysUntil(row.next_due_date as string | null);
              const kmLeft = row.next_due_meter !== null && meter !== null ? Number(row.next_due_meter) - Number(meter) : null;
              const overdue = (days !== null && days < 0) || (kmLeft !== null && kmLeft < 0);
              const soon = !overdue && ((days !== null && days <= 45) || (kmLeft !== null && kmLeft <= 1500));
              const doneValues = {
                last_done_meter: meter,
                last_done_date: '__today__',
                next_due_meter: row.interval_km && meter !== null ? Number(meter) + Number(row.interval_km) : null,
                next_due_date: row.interval_months ? addMonths(today, Number(row.interval_months)) : null,
              };
              return (
                <li key={row.id as string} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{row.label as string}</p>
                    <p className="text-xs text-muted">
                      Sljedeće: {[row.next_due_meter !== null && `${formatNumber(row.next_due_meter as number)} km`, row.next_due_date && formatDate(row.next_due_date as string)].filter(Boolean).join(' ili ') || '—'}
                    </p>
                  </div>
                  <Badge tone={overdue ? 'crit' : soon ? 'warn' : 'ok'}>{overdue ? 'Prekoračeno' : soon ? 'Uskoro' : 'U redu'}</Badge>
                  {!locked ? (
                    <RecordButton table="gear_asset_schedule" id={row.id as string} revalidate={path} size="sm" values={doneValues} success="Plan pomaknut">
                      Obavljeno sada
                    </RecordButton>
                  ) : null}
                  <DeleteRecordButton table="gear_asset_schedule" id={row.id as string} revalidate={path} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
