'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Car, Check, CheckCircle2, Copy, FileText, MapPin, MessageCircle, Navigation, Phone, RefreshCw, Send } from 'lucide-react';
import { ConfirmButton, Segmented, Sheet, useAction } from '@/components/client-ui';
import { Badge, Button, Field, Input, Select, buttonClass } from '@/components/ui';
import { fieldStep, markCustomerNotified, markReportShared, renewReportLink, scheduleJob } from '@/lib/actions/field';
import { copyText } from '@/lib/clipboard';
import { googleMapsLink, smsLink, wazeLink, whatsappLink } from '@/lib/contact';
import { vocativeHR } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface FieldJob {
  id: string;
  phase: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  departed_at: string | null;
  arrived_at: string | null;
  arrived_lat: number | null;
  arrived_lng: number | null;
  left_at: string | null;
  customer_notified_at: string | null;
  report_token: string;
  report_shared_at: string | null;
  assigned_to: string | null;
}

export interface FieldSite {
  address: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  access_notes: string | null;
  contact_phone: string | null;
}

export interface FieldContext {
  workshopName: string;
  techName: string;
  clientFirstName: string | null;
  clientPhone: string | null;
  appUrl: string;
  isOwner: boolean;
}

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' }) : '');

function position(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

// The one big button a technician needs: it always shows the next step.
export function FieldActions({ job, site, ctx, variant = 'card' }: { job: FieldJob; site: FieldSite | null; ctx: FieldContext; variant?: 'card' | 'panel' }) {
  const { pending, run } = useAction();
  const [onTheWay, setOnTheWay] = useState(false);
  const phone = site?.contact_phone || ctx.clientPhone;
  const reportUrl = `${ctx.appUrl || (typeof window !== 'undefined' ? window.location.origin : '')}/r/${job.report_token}`;

  function arrived() {
    run(async () => fieldStep(job.id, 'arrived', await position()), { success: 'Dolazak zabilježen' });
  }

  function shareReport(channel: 'whatsapp' | 'copy') {
    const greeting = ctx.clientFirstName ? `Poštovani ${vocativeHR(ctx.clientFirstName)}, ` : 'Poštovani, ';
    const message = `${greeting}posao na vašoj adresi je završen. Izvještaj s fotografijama: ${reportUrl} — ${ctx.workshopName}`;
    if (channel === 'whatsapp') window.open(whatsappLink(phone, message), '_blank', 'noopener');
    else void copyText(reportUrl).then((ok) => (ok ? toast.success('Poveznica kopirana') : toast.error('Kopiranje nije uspjelo — označite poveznicu i kopirajte')));
    run(() => markReportShared(job.id));
  }

  const step = job.left_at ? 'done' : job.arrived_at ? 'working' : job.departed_at ? 'driving' : 'planned';

  const primary =
    step === 'planned' ? (
      <Button variant="primary" size="lg" className="flex-1" disabled={pending} onClick={() => setOnTheWay(true)}>
        <Car className="size-5" /> Na putu
      </Button>
    ) : step === 'driving' ? (
      <Button variant="primary" size="lg" className="flex-1" disabled={pending} onClick={arrived}>
        <MapPin className="size-5" /> Stigao
      </Button>
    ) : step === 'working' ? (
      <ConfirmButton variant="primary" size="lg" className="flex-1" confirmLabel="Potvrdi: posao završen" onConfirm={() => run(() => fieldStep(job.id, 'left'), { success: 'Završeno na lokaciji' })}>
        <CheckCircle2 className="size-5" /> Završio
      </ConfirmButton>
    ) : (
      <Button variant="ok" size="lg" className="flex-1" disabled={pending} onClick={() => shareReport('whatsapp')}>
        <Send className="size-5" /> {job.report_shared_at ? 'Pošalji izvještaj ponovno' : 'Pošalji izvještaj'}
      </Button>
    );

  const nav = site ? (
    <a href={googleMapsLink(site)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'lg', 'px-4')} aria-label="Navigacija">
      <Navigation className="size-5" />
    </a>
  ) : null;
  const call = phone ? (
    <a href={`tel:${phone.replace(/\s/g, '')}`} className={buttonClass('secondary', 'lg', 'px-4')} aria-label="Nazovi">
      <Phone className="size-5" />
    </a>
  ) : null;

  return (
    <>
      {variant === 'panel' ? (
        <div className="space-y-4">
          <ol className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Na putu', at: job.departed_at, extra: job.customer_notified_at ? 'klijent obaviješten' : null },
              {
                label: 'Stigao',
                at: job.arrived_at,
                extra:
                  job.arrived_lat != null ? (
                    <a href={`https://www.google.com/maps?q=${job.arrived_lat},${job.arrived_lng}`} target="_blank" rel="noopener noreferrer" className="underline">
                      GPS ✓
                    </a>
                  ) : null,
              },
              { label: 'Završio', at: job.left_at, extra: job.arrived_at && job.left_at ? `${Math.round((new Date(job.left_at).getTime() - new Date(job.arrived_at).getTime()) / 60000)} min na lokaciji` : null },
            ].map((s) => (
              <li key={s.label} className={cn('rounded-xl border p-2.5', s.at ? 'border-ok/40 bg-ok/5' : 'border-line')}>
                <p className="text-xs text-muted">{s.label}</p>
                <p className="text-sm font-semibold tabular">{s.at ? time(s.at) : '—'}</p>
                {s.extra ? <p className="text-[11px] text-faint">{s.extra}</p> : null}
              </li>
            ))}
          </ol>
          <div className="flex gap-2">
            {primary}
            {nav}
            {call}
          </div>
          {site ? (
            <div className="flex flex-wrap gap-2 text-xs">
              <a href={wazeLink(site)} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                Otvori u Wazeu
              </a>
            </div>
          ) : null}
          {step === 'done' ? (
            <div className="space-y-2 rounded-xl border border-line bg-bg p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <FileText className="size-4 text-accent" /> Izvještaj za klijenta
                {job.report_shared_at ? <Badge tone="ok">poslan</Badge> : null}
              </p>
              <p className="truncate font-mono text-xs text-muted">{reportUrl}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => shareReport('copy')}>
                  <Copy className="size-4" /> Kopiraj
                </Button>
                <a href={reportUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
                  Pregledaj
                </a>
                {ctx.isOwner ? (
                  <ConfirmButton size="sm" variant="ghost" confirmLabel="Stara poveznica prestaje raditi" onConfirm={() => run(() => renewReportLink(job.id), { success: 'Nova poveznica izrađena' })}>
                    <RefreshCw className="size-4" /> Nova poveznica
                  </ConfirmButton>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex gap-2">
          {primary}
          {nav}
          {call}
        </div>
      )}

      <OnTheWaySheet open={onTheWay} onOpenChange={setOnTheWay} job={job} phone={phone} ctx={ctx} />
    </>
  );
}

function OnTheWaySheet({ open, onOpenChange, job, phone, ctx }: { open: boolean; onOpenChange: (o: boolean) => void; job: FieldJob; phone: string | null; ctx: FieldContext }) {
  const { pending, run } = useAction();
  const [minutes, setMinutes] = useState<'15' | '30' | '45' | '60'>('30');
  const eta = new Date(Date.now() + Number(minutes) * 60000);
  const etaText = eta.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' });
  const greeting = ctx.clientFirstName ? `Dobar dan ${vocativeHR(ctx.clientFirstName)}, ` : 'Dobar dan, ';
  const message = `${greeting}ovdje ${ctx.workshopName}. ${ctx.techName} je krenuo prema vama i stiže oko ${etaText}.`;

  function go(channel: 'whatsapp' | 'sms' | 'none') {
    if (channel === 'whatsapp') window.open(whatsappLink(phone, message), '_blank', 'noopener');
    if (channel === 'sms') window.location.href = smsLink(phone, message);
    run(
      async () => {
        const step = await fieldStep(job.id, 'departed');
        if (!step.ok || channel === 'none') return step;
        return markCustomerNotified(job.id, `oko ${etaText}`);
      },
      { onDone: () => onOpenChange(false) }
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Krećem na lokaciju">
      <div className="space-y-4">
        <Field label="Dolazak za">
          <Segmented
            value={minutes}
            onChange={setMinutes}
            size="lg"
            options={(['15', '30', '45', '60'] as const).map((m) => ({ value: m, label: `${m} min` }))}
          />
        </Field>
        <p className="rounded-xl border border-line bg-bg p-3 text-sm text-muted">{message}</p>
        <div className="grid gap-2">
          <Button variant="primary" size="lg" disabled={pending} onClick={() => go('whatsapp')}>
            <MessageCircle className="size-5" /> Pošalji WhatsApp i kreni
          </Button>
          <Button size="lg" disabled={pending} onClick={() => go('sms')}>
            Pošalji SMS i kreni
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => go('none')}>
            Kreni bez poruke
          </Button>
        </div>
        {!phone ? <p className="text-xs text-warn">Klijent nema upisan broj telefona.</p> : null}
      </div>
    </Sheet>
  );
}

// Date, time, duration and technician for a field job.
export function ScheduleSheet({
  jobId,
  current,
  staff,
  trigger,
}: {
  jobId: string;
  current: { start: string | null; end: string | null; assignedTo: string | null };
  staff: { id: string; name: string }[];
  trigger?: React.ReactNode;
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const local = (iso: string | null) => {
    if (!iso) return { date: '', time: '08:00' };
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  };
  const initial = local(current.start);
  const [date, setDate] = useState(initial.date);
  const [clock, setClock] = useState(initial.time);
  const initialMinutes = current.start && current.end ? Math.round((new Date(current.end).getTime() - new Date(current.start).getTime()) / 60000) : 60;
  const [duration, setDuration] = useState<string>(['60', '120', '240', '480'].includes(String(initialMinutes)) ? String(initialMinutes) : '60');
  const [tech, setTech] = useState(current.assignedTo ?? '');

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Termin"
      trigger={
        trigger ?? (
          <Button size="sm">
            <CalendarClock className="size-4" /> {current.start ? 'Promijeni termin' : 'Zakaži'}
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Vrijeme">
            <Input type="time" step={900} value={clock} onChange={(e) => setClock(e.target.value)} />
          </Field>
        </div>
        <Field label="Trajanje">
          <Segmented
            value={duration}
            onChange={setDuration}
            options={[
              { value: '60', label: '1 h' },
              { value: '120', label: '2 h' },
              { value: '240', label: '4 h' },
              { value: '480', label: 'Dan' },
            ]}
          />
        </Field>
        <Field label="Tehničar">
          <Select value={tech} onChange={(e) => setTech(e.target.value)}>
            <option value="">Nije dodijeljeno</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={pending || !date}
            onClick={() =>
              run(() => scheduleJob(jobId, { start: new Date(`${date}T${clock || '08:00'}`).toISOString(), durationMin: Number(duration), assignedTo: tech || null }), {
                success: 'Termin spremljen',
                onDone: () => setOpen(false),
              })
            }
          >
            <Check className="size-5" /> Spremi termin
          </Button>
          {current.start ? (
            <Button size="lg" variant="ghost" disabled={pending} onClick={() => run(() => scheduleJob(jobId, { start: null, durationMin: null, assignedTo: tech || null }), { onDone: () => setOpen(false) })}>
              Ukloni
            </Button>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
