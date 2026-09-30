import { CalendarX2, MapPin, ShieldCheck, Timer } from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components/ui';
import { COMPLIANCE_LABELS } from '@/config/packages/fleet';
import { daysUntil, formatDate, formatDateTime } from '@/lib/format';
import type { ModuleProps } from '../ModuleTab';
import { MoreSections, foldable } from '../more';
import { DeleteRecordButton, RecordButton, RecordSheet } from '../kit';
import { opts } from '../options';
import { FieldStep } from './FieldStep';

const STEPS = [
  { key: 'departed_at', label: 'Krenuo' },
  { key: 'arrived_at', label: 'Stigao', gps: true },
  { key: 'work_started', label: 'Početak rada' },
  { key: 'work_finished', label: 'Kraj rada' },
  { key: 'returned_at', label: 'Povratak' },
] as const;
const DOWNTIME = { breakdown: 'Kvar', waiting_parts: 'Čeka dijelove', planned: 'Planirano', accident: 'Nezgoda' };

export function complianceTone(days: number | null): 'crit' | 'warn' | 'ok' | 'muted' {
  if (days === null) return 'muted';
  if (days < 0) return 'crit';
  if (days <= 30) return 'warn';
  return 'ok';
}

export async function FleetModule({ ctx, job, locked, extras }: ModuleProps) {
  const path = `/app/jobs/${job.id}`;
  const s = ctx.supabase;
  const [{ data: field }, { data: compliance }, { data: downtime }, { data: trailers }] = await Promise.all([
    s.from('fleet_field_jobs').select('*').eq('job_id', job.id).maybeSingle(),
    s.from('fleet_compliance_items').select('*').eq('asset_id', job.asset.id).order('valid_until'),
    s.from('fleet_downtime').select('*').eq('job_id', job.id).order('from_at'),
    s.from('assets').select('id, identifier, asset_type, make, model').eq('parent_asset_id', job.asset.id),
  ]);
  const isField = job.source === 'field' || Boolean(field);
  const openDowntime = (downtime ?? []).find((d) => !d.to_at);
  const hours =
    field?.work_started && field?.work_finished ? (new Date(field.work_finished as string).getTime() - new Date(field.work_started as string).getTime()) / 3600000 : null;

  // Core: legal deadlines. The rest with "Više" or once it has data.
  const { show, hidden } = foldable(extras);
  const showField = show('terenski nalog', isField);
  const showDowntime = show('zastoj', (downtime ?? []).length > 0);
  const showTrailers = show('priključna vozila', (trailers ?? []).length > 0);

  return (
    <div className="space-y-4">
      {/* Field job timeline */}
      {showField ? (
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <MapPin className="size-4 text-accent" /> Terenski nalog
            </span>
          }
          subtitle={isField ? 'Svaki korak bilježi vrijeme; dolazak i lokaciju (GPS)' : 'Za intervenciju na terenu uključite terenski nalog'}
          action={
            field ? (
              <RecordSheet
                table="fleet_field_jobs"
                title="Terenski nalog"
                upsertOn="job_id"
                revalidate={path}
                fixed={{ job_id: job.id }}
                initial={field}
                label="Uredi"
                fields={[
                  { name: 'address', label: 'Adresa / lokacija' },
                  { name: 'travel_km', label: 'Put', type: 'number', suffix: 'km', half: true },
                  { name: 'travel_hours', label: 'Vrijeme puta', type: 'number', suffix: 'h', half: true },
                  { name: 'signer_name', label: 'Potvrdio (ime)' },
                ]}
              />
            ) : null
          }
        />
        <div className="p-4">
          {!field ? (
            !locked ? (
              <RecordButton table="fleet_field_jobs" upsertOn="job_id" revalidate={path} variant="primary" values={{ job_id: job.id }}>
                Uključi terenski nalog
              </RecordButton>
            ) : null
          ) : (
            <>
              <ol className="grid gap-2 sm:grid-cols-5">
                {STEPS.map((step, i) => {
                  const at = field[step.key] as string | null;
                  const previousDone = i === 0 || Boolean(field[STEPS[i - 1].key]);
                  return (
                    <li key={step.key} className={`rounded-xl border p-3 ${at ? 'border-ok/40 bg-ok/5' : 'border-line'}`}>
                      <p className="text-xs text-muted">{step.label}</p>
                      {at ? (
                        <p className="mt-1 text-sm font-semibold tabular">{formatDateTime(at)}</p>
                      ) : !locked ? (
                        <FieldStep jobId={job.id} column={step.key} withGps={'gps' in step} disabled={!previousDone} />
                      ) : (
                        <p className="mt-1 text-sm text-faint">—</p>
                      )}
                    </li>
                  );
                })}
              </ol>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                {field.address ? <span>{field.address as string}</span> : null}
                {field.lat && field.lng ? (
                  <a className="text-accent" href={`https://www.google.com/maps?q=${field.lat},${field.lng}`} target="_blank" rel="noopener noreferrer">
                    Lokacija na karti
                  </a>
                ) : null}
                {field.travel_km ? <span>{field.travel_km as number} km puta</span> : null}
                {hours !== null ? <span>Rad: {hours.toFixed(1)} h</span> : null}
              </div>
            </>
          )}
        </div>
      </Card>
      ) : null}

      {/* Compliance */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" /> Zakonski rokovi
            </span>
          }
          action={
            <RecordSheet
              table="fleet_compliance_items"
              title="Rok"
              revalidate={path}
              fixed={{ asset_id: job.asset.id }}
              label="Rok"
              fields={[
                { name: 'kind', label: 'Vrsta', type: 'select', options: opts(COMPLIANCE_LABELS), required: true },
                { name: 'valid_from', label: 'Vrijedi od', type: 'date', half: true },
                { name: 'valid_until', label: 'Vrijedi do', type: 'date', half: true, required: true },
                { name: 'notes', label: 'Napomena', type: 'textarea' },
              ]}
            />
          }
        />
        {compliance?.length ? (
          <ul className="divide-y divide-line">
            {compliance.map((c) => {
              const days = daysUntil(c.valid_until as string);
              return (
                <li key={c.id as string} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="flex-1">{COMPLIANCE_LABELS[c.kind as string]}</span>
                  <span className="tabular text-muted">{formatDate(c.valid_until as string)}</span>
                  <Badge tone={complianceTone(days)}>{days === null ? '—' : days < 0 ? `Isteklo ${-days} d` : days === 0 ? 'Ističe danas' : `Još ${days} d`}</Badge>
                  <RecordSheet
                    table="fleet_compliance_items"
                    title={COMPLIANCE_LABELS[c.kind as string]}
                    id={c.id as string}
                    revalidate={path}
                    initial={c}
                    deletable
                    trigger={<button className="text-xs text-accent">Obnovi</button>}
                    fields={[
                      { name: 'valid_from', label: 'Vrijedi od', type: 'date', half: true },
                      { name: 'valid_until', label: 'Vrijedi do', type: 'date', half: true, required: true },
                      { name: 'notes', label: 'Napomena', type: 'textarea' },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-4 text-sm text-muted">Upišite rokove — pregled svih vozila koji ističu je u izborniku Rokovi.</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Downtime */}
        {showDowntime ? (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Timer className="size-4 text-accent" /> Zastoj vozila
              </span>
            }
          />
          <div className="space-y-3 p-4">
            {!locked ? (
              openDowntime ? (
                <RecordButton table="fleet_downtime" id={openDowntime.id as string} revalidate={path} variant="ok" values={{ to_at: '__now__' }} success="Vozilo ponovno u pogonu">
                  Vozilo ponovno u pogonu
                </RecordButton>
              ) : (
                <RecordSheet
                  table="fleet_downtime"
                  title="Početak zastoja"
                  revalidate={path}
                  fixed={{ asset_id: job.asset.id, job_id: job.id }}
                  initial={{ from_at: job.created_at, reason: 'breakdown' }}
                  label="Zastoj"
                  fields={[
                    { name: 'from_at', label: 'Od', type: 'datetime', required: true },
                    { name: 'reason', label: 'Razlog', type: 'select', options: opts(DOWNTIME) },
                  ]}
                />
              )
            ) : null}
            {(downtime ?? []).map((d) => {
              const end = d.to_at ? new Date(d.to_at as string) : new Date();
              const h = (end.getTime() - new Date(d.from_at as string).getTime()) / 3600000;
              return (
                <div key={d.id as string} className="flex items-center justify-between text-sm">
                  <span>
                    {DOWNTIME[d.reason as keyof typeof DOWNTIME] ?? 'Zastoj'} <span className="text-faint">· od {formatDateTime(d.from_at as string)}</span>
                  </span>
                  <span className={`tabular ${d.to_at ? 'text-muted' : 'text-crit'}`}>{h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`}</span>
                </div>
              );
            })}
          </div>
        </Card>
        ) : null}

        {/* Coupled units */}
        {showTrailers ? (
        <Card>
          <CardHeader title="Priključna vozila" />
          {trailers?.length ? (
            <ul className="divide-y divide-line">
              {trailers.map((t) => (
                <li key={t.id as string} className="px-4 py-3 text-sm">
                  <a href={`/app/assets/${t.id}`} className="hover:underline">
                    <span className="font-mono font-semibold">{(t.identifier as string | null) ?? '—'}</span> <span className="text-muted">{[t.make, t.model].filter(Boolean).join(' ')}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">Nema. Prikolicu povežite na njezinoj kartici (Nadređeno vozilo).</p>
          )}
          {field && !locked ? (
            <div className="border-t border-line px-4 py-3">
              <DeleteRecordButton table="fleet_field_jobs" id={job.id} revalidate={path} label="Ukloni terenski nalog" />
            </div>
          ) : null}
        </Card>
        ) : null}
      </div>

      {!compliance?.length ? (
        <p className="flex items-center gap-2 text-xs text-faint">
          <CalendarX2 className="size-3.5" /> Rokovi se prate po vozilu, ne po nalogu — vide se na svakom sljedećem nalogu.
        </p>
      ) : null}
      <MoreSections href={`${path}?tab=modul&vise=1`} hidden={hidden} />
    </div>
  );
}
