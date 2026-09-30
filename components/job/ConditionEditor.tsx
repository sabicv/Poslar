'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, PenLine } from 'lucide-react';
import { Diagram, MARK_CODES, zonesFor, type DiagramKind, type MarkCode } from '@/components/Diagram';
import { Segmented, Sheet, SignaturePad, useAction } from '@/components/client-ui';
import { Badge, Button, Card, CardHeader, Field, Input } from '@/components/ui';
import { saveConditionReport, signConditionReport } from '@/lib/actions/jobs';
import { formatDateTime } from '@/lib/format';
import { uploadBlob } from '@/lib/upload';
import { cn } from '@/lib/utils';
import type { ConditionMark, ConditionReport } from '@/types/db';

type Kind = 'intake' | 'handover';
type ReportView = ConditionReport & { signatureUrl: string | null };
const FUEL = ['0', '1/4', '1/2', '3/4', '1'] as const;

export function ConditionEditor({
  jobId,
  tenantId,
  diagram,
  equipment,
  reports,
  clientName,
  locked,
}: {
  jobId: string;
  tenantId: string;
  diagram: DiagramKind;
  equipment: string[];
  reports: Partial<Record<Kind, ReportView>>;
  clientName: string;
  locked: boolean;
}) {
  const [kind, setKind] = useState<Kind>(reports.intake?.signed_at && !reports.handover ? 'handover' : 'intake');
  return (
    <div className="space-y-4">
      <Segmented
        value={kind}
        onChange={setKind}
        size="lg"
        options={[
          { value: 'intake', label: 'Prijem' },
          { value: 'handover', label: 'Predaja' },
        ]}
      />
      <ReportForm
        key={kind}
        jobId={jobId}
        tenantId={tenantId}
        kind={kind}
        diagram={diagram}
        equipment={equipment}
        report={reports[kind] ?? null}
        copyFrom={kind === 'handover' ? reports.intake ?? null : null}
        clientName={clientName}
        locked={locked}
      />
    </div>
  );
}

function ReportForm({
  jobId,
  tenantId,
  kind,
  diagram,
  equipment,
  report,
  copyFrom,
  clientName,
  locked,
}: {
  jobId: string;
  tenantId: string;
  kind: Kind;
  diagram: DiagramKind;
  equipment: string[];
  report: ReportView | null;
  copyFrom: ReportView | null;
  clientName: string;
  locked: boolean;
}) {
  const { pending, run } = useAction();
  const base = report ?? copyFrom;
  const [marks, setMarks] = useState<ConditionMark[]>(base?.marks ?? []);
  const [present, setPresent] = useState<Record<string, boolean>>(() => {
    const known = Object.fromEntries((base?.equipment ?? []).map((e) => [e.item, e.present]));
    return Object.fromEntries(equipment.map((item) => [item, known[item] ?? false]));
  });
  const [fuel, setFuel] = useState<string | null>(base?.fuel_level ?? null);
  const [zone, setZone] = useState<{ code: string; label: string } | null>(null);
  const [signer, setSigner] = useState(report?.signer_name ?? clientName);
  const [signature, setSignature] = useState<Blob | null>(null);
  const [dirty, setDirty] = useState(!report && Boolean(copyFrom));
  // Set by a tap (mark, equipment, fuel): only real changes save themselves.
  const [touched, setTouched] = useState(false);
  const signed = Boolean(report?.signed_at);
  const readOnly = locked || signed;

  const marked: Record<string, string[]> = {};
  for (const m of marks) (marked[m.zone] ??= []).push(m.code);
  const zoneLabels = Object.fromEntries(zonesFor(diagram).map((z) => [z.code, z.label]));

  function toggleMark(zoneCode: string, code: MarkCode) {
    setDirty(true);
    setTouched(true);
    setMarks((all) => (all.some((m) => m.zone === zoneCode && m.code === code) ? all.filter((m) => !(m.zone === zoneCode && m.code === code)) : [...all, { zone: zoneCode, code }]));
  }

  function save(after?: () => void, quiet = false) {
    run(
      () =>
        saveConditionReport(jobId, kind, {
          diagram,
          marks,
          equipment: Object.entries(present).map(([item, p]) => ({ item, present: p })),
          fuel_level: fuel as (typeof FUEL)[number] | null,
        }),
      {
        success: after || quiet ? undefined : 'Zapisnik spremljen',
        quiet,
        onDone: () => {
          setDirty(false);
          after?.();
        },
      }
    );
  }

  // No "Spremi" button: every change saves itself a moment later.
  useEffect(() => {
    if (!touched || !dirty || readOnly) return;
    const timer = window.setTimeout(() => save(undefined, true), 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touched, dirty, marks, present, fuel, readOnly]);

  async function sign() {
    if (!signature) return toast.error('Potpis je prazan.');
    if (!signer.trim()) return toast.error('Upišite ime potpisnika.');
    save(async () => {
      try {
        const path = await uploadBlob(tenantId, jobId, signature, `potpis-${kind}`);
        run(() => signConditionReport(jobId, kind, signer, path), { success: 'Zapisnik potpisan' });
      } catch (error) {
        toast.error((error as Error).message);
      }
    });
  }

  return (
    <>
      <Card>
        <CardHeader
          title={kind === 'intake' ? 'Stanje pri prijemu' : 'Stanje pri predaji'}
          subtitle={signed ? `Potpisano ${formatDateTime(report!.signed_at)} · ${report!.signer_name ?? ''}` : 'Dodirnite dio i označite oštećenje'}
          action={signed ? <Badge tone="ok"><Check className="size-3" /> Potpisano</Badge> : null}
        />
        <div className="p-4">
          <Diagram kind={diagram} marked={marked} onZone={setZone} disabled={readOnly} />
          {/* The list below names every mark in full, so no separate legend. */}
          {marks.length ? (
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {marks.map((m, i) => (
                <li key={`${m.zone}-${m.code}-${i}`} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{zoneLabels[m.zone] ?? m.zone}</span>
                  <span className="text-muted">{MARK_CODES[m.code as MarkCode]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">Bez vidljivih oštećenja.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Oprema i gorivo" />
        <div className="space-y-4 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {equipment.map((item) => (
              <label key={item} className={cn('flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm', present[item] ? 'border-ok/40 bg-ok/5' : 'border-line')}>
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={present[item] ?? false}
                  onChange={(e) => {
                    setDirty(true);
                    setTouched(true);
                    setPresent((p) => ({ ...p, [item]: e.target.checked }));
                  }}
                  className="size-5 accent-[rgb(var(--ok))]"
                />
                {item}
              </label>
            ))}
          </div>
          <Field label="Gorivo / baterija">
            <Segmented
              value={fuel}
              disabled={readOnly}
              onChange={(f) => {
                setDirty(true);
                setTouched(true);
                setFuel(f);
              }}
              options={FUEL.map((f) => ({ value: f, label: f === '0' ? 'Prazno' : f === '1' ? 'Puno' : f }))}
            />
          </Field>
          {!readOnly ? <p className="text-xs text-faint">{pending ? 'Spremam…' : dirty ? (touched ? 'Upisujem…' : '') : report ? 'Spremljeno' : ''}</p> : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Potpis stranke" />
        <div className="space-y-4 p-4">
          {signed && report?.signatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={report.signatureUrl} alt="Potpis" className="h-32 rounded-xl border border-line bg-white object-contain p-2" />
          ) : readOnly ? (
            <p className="text-sm text-muted">Nalog je zaključan.</p>
          ) : (
            <>
              <Field label="Ime i prezime potpisnika">
                <Input value={signer} onChange={(e) => setSigner(e.target.value)} />
              </Field>
              <SignaturePad onChange={setSignature} />
              <p className="text-xs text-faint">
                Potpisom stranka potvrđuje stanje {kind === 'intake' ? 'pri predaji vozila servisu' : 'pri preuzimanju'} i navedenu opremu.
              </p>
              <Button variant="primary" size="lg" disabled={pending || !signature} onClick={sign}>
                <PenLine className="size-4" /> Potvrdi potpis
              </Button>
            </>
          )}
        </div>
      </Card>

      <Sheet open={zone !== null} onOpenChange={(o) => !o && setZone(null)} title={zone?.label ?? ''}>
        <div className="grid gap-2">
          {(Object.keys(MARK_CODES) as MarkCode[]).map((code) => {
            const on = zone ? (marked[zone.code] ?? []).includes(code) : false;
            return (
              <button
                key={code}
                type="button"
                onClick={() => zone && toggleMark(zone.code, code)}
                className={cn('flex h-14 items-center gap-3 rounded-xl border px-4 text-left', on ? 'border-warn bg-warn/10' : 'border-line hover:bg-surface2')}
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-surface2 font-mono font-bold">{code}</span>
                <span className="flex-1">{MARK_CODES[code]}</span>
                {on ? <Check className="size-5 text-warn" /> : null}
              </button>
            );
          })}
          <Button size="lg" variant="primary" className="mt-2" onClick={() => setZone(null)}>
            Gotovo
          </Button>
        </div>
      </Sheet>
    </>
  );
}
