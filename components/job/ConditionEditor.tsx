'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, PenLine } from 'lucide-react';
import { Fold } from '@/components/Fold';
import { Diagram, MARK_CODES, zonesFor, type DiagramKind } from '@/components/Diagram';
import { UndrawnZones } from './UndrawnZones';
import type { ConditionZone } from '@/config/tenant.config';
import { Segmented, Sheet, SignaturePad, useAction } from '@/components/client-ui';
import { Button, Card, CardHeader, Field, Input, Textarea } from '@/components/ui';
import { plural } from '@/lib/format';
import { ShotButton } from './ShotButton';
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
  zones,
  marks: markList,
  level = 'fuel',
  equipment,
  reports,
  clientName,
  locked,
  intakeTitle,
  handoverTitle,
  intakeOpen,
  photos,
  silhouette = false,
  part = 'both',
}: {
  jobId: string;
  tenantId: string;
  diagram: DiagramKind;
  zones?: ConditionZone[];
  marks?: { code: string; label: string }[];
  level?: 'fuel' | 'battery' | 'none';
  equipment: string[];
  reports: Partial<Record<Kind, ReportView>>;
  clientName: string;
  locked: boolean;
  intakeTitle: string;
  handoverTitle: string;
  intakeOpen: boolean;
  photos: Partial<Record<Kind, { url: string }[]>>;
  // Body shop, and only a car: the floor plan is how damage is marked.
  silhouette?: boolean;
  part?: 'intake' | 'handover' | 'both';
}) {
  const marks = markList?.length ? markList : (Object.entries(MARK_CODES) as [string, string][]).map(([code, label]) => ({ code, label }));
  return (
    <div className="space-y-4">
      {part !== 'handover' ? <ReportForm
        key="intake"
        jobId={jobId}
        tenantId={tenantId}
        kind="intake"
        diagram={diagram}
        zones={zones}
        markList={marks}
        level={level}
        equipment={equipment}
        report={reports.intake ?? null}
        copyFrom={null}
        clientName={clientName}
        locked={locked}
        title={intakeTitle}
        startOpen={intakeOpen}
        photos={photos.intake ?? []}
        silhouette={silhouette}
      /> : null}
      {part !== 'intake' ? <ReportForm
        key="handover"
        jobId={jobId}
        tenantId={tenantId}
        kind="handover"
        diagram={diagram}
        zones={zones}
        markList={marks}
        level={level}
        equipment={equipment}
        report={reports.handover ?? null}
        copyFrom={reports.intake ?? null}
        clientName={clientName}
        locked={locked}
        title={handoverTitle}
        startOpen={false}
        photos={photos.handover ?? []}
        silhouette={silhouette}
      /> : null}
    </div>
  );
}

function ReportForm({
  jobId,
  tenantId,
  kind,
  diagram,
  zones,
  markList,
  level,
  equipment,
  report,
  copyFrom,
  clientName,
  locked,
  title,
  startOpen,
  photos,
  silhouette,
}: {
  jobId: string;
  tenantId: string;
  kind: Kind;
  diagram: DiagramKind;
  zones?: ConditionZone[];
  markList: { code: string; label: string }[];
  level: 'fuel' | 'battery' | 'none';
  equipment: string[];
  report: ReportView | null;
  copyFrom: ReportView | null;
  clientName: string;
  locked: boolean;
  title: string;
  startOpen: boolean;
  photos: { url: string }[];
  silhouette: boolean;
}) {
  const { pending, run } = useAction();
  const base = report ?? copyFrom;
  // An empty handover still starts from whatever was marked at intake.
  const [marks, setMarks] = useState<ConditionMark[]>(report?.marks?.length ? report.marks : (copyFrom?.marks ?? []));
  const [present, setPresent] = useState<Record<string, boolean>>(() => {
    const known = Object.fromEntries((base?.equipment ?? []).map((e) => [e.item, e.present]));
    return Object.fromEntries(equipment.map((item) => [item, known[item] ?? false]));
  });
  const [fuel, setFuel] = useState<string | null>(report?.fuel_level ?? copyFrom?.fuel_level ?? null);
  const [zone, setZone] = useState<{ code: string; label: string } | null>(null);
  const [zoneNote, setZoneNote] = useState('');
  const [signer, setSigner] = useState(report?.signer_name ?? clientName);
  const [signature, setSignature] = useState<Blob | null>(null);
  const [dirty, setDirty] = useState(!report && Boolean(copyFrom));
  // Set by a tap (mark, equipment, fuel): only real changes save themselves.
  const [touched, setTouched] = useState(false);
  const signed = Boolean(report?.signed_at);
  const readOnly = locked || signed;

  const marked: Record<string, string[]> = {};
  for (const m of marks) (marked[m.zone] ??= []).push(m.code);
  const zoneList = zones ?? zonesFor(diagram);
  const zoneLabels = Object.fromEntries(zoneList.map((z) => [z.code, z.label]));

  const markName = (code: string) => markList.find((m) => m.code === code)?.label ?? code;
  const same = (a: ConditionMark, b: ConditionMark) => a.zone === b.zone && a.code === b.code;
  const intakeMarks = kind === 'handover' ? (copyFrom?.marks ?? []) : [];
  const repaired = intakeMarks.filter((m) => !marks.some((h) => same(m, h)));
  const unchanged = intakeMarks.filter((m) => marks.some((h) => same(m, h)));
  const added = marks.filter((m) => !intakeMarks.some((h) => same(m, h)));
  const nameOf = (m: ConditionMark) => `${zoneLabels[m.zone] ?? m.zone} (${markName(m.code)})`;

  function toggleMark(zoneCode: string, code: string) {
    setDirty(true);
    setTouched(true);
    setMarks((all) => {
      if (all.some((m) => m.zone === zoneCode && m.code === code)) return all.filter((m) => !(m.zone === zoneCode && m.code === code));
      return [...all, { zone: zoneCode, code, note: zoneNote.trim() || undefined }];
    });
    setZone(null);
  }

  function saveZoneNote(zoneCode: string, note: string) {
    setZoneNote(note);
    setDirty(true);
    setTouched(true);
    setMarks((all) => all.map((m) => (m.zone === zoneCode ? { ...m, note: note.trim() || undefined } : m)));
  }

  function save(after?: () => void, quiet = false) {
    run(
      () =>
        saveConditionReport(jobId, kind, {
          diagram,
          marks,
          equipment: Object.entries(present).map(([item, p]) => ({ item, present: p })),
          fuel_level: level === 'none' ? null : (fuel as (typeof FUEL)[number] | null),
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

  const summary = [
    signed ? `Potpisano ${formatDateTime(report!.signed_at)}` : null,
    marks.length ? `${marks.length} ${plural(marks.length, 'oznaka', 'oznake', 'oznaka')}` : null,
    photos.length ? `${photos.length} ${plural(photos.length, 'fotografija', 'fotografije', 'fotografija')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Fold title={title} summary={summary || (kind === 'handover' ? 'Usporedba s prijemom' : 'Oznaka i fotografija oštećenja')} startOpen={startOpen}>
      <Card className="rounded-none border-0">
        <div className="p-4">
          <Diagram
            kind={diagram}
            zones={zoneList}
            marked={marked}
            onZone={(z) => {
              setZoneNote(marks.find((m) => m.zone === z.code)?.note ?? '');
              setZone(z);
            }}
            disabled={readOnly}
            detail={!(silhouette && diagram !== 'boat')}
          />
          {silhouette && diagram !== 'boat' ? (
            <UndrawnZones
              kind={diagram}
              zones={zoneList}
              marked={marked}
              onZone={(z) => {
                setZoneNote(marks.find((m) => m.zone === z.code)?.note ?? '');
                setZone(z);
              }}
              disabled={readOnly}
            />
          ) : null}
          {/* The list below names every mark in full, so no separate legend. */}
          {marks.length ? (
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {marks.map((m, i) => (
                <li key={`${m.zone}-${m.code}-${i}`} className="px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span>{zoneLabels[m.zone] ?? m.zone}</span>
                    <span className="shrink-0 text-muted">{markName(m.code)}</span>
                  </div>
                  {m.note ? <p className="mt-0.5 text-xs text-faint">{m.note}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">{markList.some((m) => m.label === 'Ogrebotina') ? 'Bez vidljivih oštećenja.' : 'Ništa označeno.'}</p>
          )}
          {photos.length ? (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {photos.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={photo.url} src={photo.url} alt="" className="aspect-square rounded-lg border border-line object-cover" />
              ))}
            </div>
          ) : null}
          {!readOnly ? (
            <div className="mt-4">
              <ShotButton
                tenantId={tenantId}
                jobId={jobId}
                tag="damage"
                caption={title}
                stage={kind === 'intake' ? 'before' : 'after'}
                label="Fotografija oštećenja"
                count={photos.length}
              />
            </div>
          ) : null}
          {kind === 'handover' && intakeMarks.length ? (
            <div className="mt-4 space-y-1 rounded-xl border border-line px-3 py-2 text-sm">
              <p>{repaired.length ? `Popravljeno: ${repaired.map(nameOf).join(', ')}` : 'Ništa od prijema nije uklonjeno.'}</p>
              {unchanged.length ? <p className="text-muted">Isto kao pri prijemu: {unchanged.map(nameOf).join(', ')}</p> : null}
              {added.length ? <p>Novo pri predaji: {added.map(nameOf).join(', ')}</p> : null}
            </div>
          ) : null}
        </div>
      </Card>

      {equipment.length || level !== 'none' ? (
      <Card>
        <CardHeader title={level === 'battery' ? 'Oprema i baterija' : level === 'fuel' ? 'Oprema i gorivo' : 'Oprema'} />
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
          {level !== 'none' ? (
            <Field label={level === 'battery' ? 'Baterija' : 'Gorivo / baterija'}>
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
          ) : null}
          {!readOnly ? <p className="text-xs text-faint">{pending ? 'Spremam…' : dirty ? (touched ? 'Upisujem…' : '') : report ? 'Spremljeno' : ''}</p> : null}
        </div>
      </Card>
      ) : null}

      <Card>
        <CardHeader title="Potpis mušterije" />
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
                Potpisom mušterija potvrđuje stanje {kind === 'intake' ? 'pri prijemu' : 'pri predaji'} i navedenu opremu.
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
          {markList.map((mark) => {
            const on = zone ? (marked[zone.code] ?? []).includes(mark.code) : false;
            return (
              <button
                key={mark.code}
                type="button"
                aria-pressed={on}
                onClick={() => zone && !readOnly && toggleMark(zone.code, mark.code)}
                className={cn('flex h-14 items-center gap-3 rounded-xl border px-4 text-left', on ? 'border-[rgb(var(--orange))] bg-[rgb(var(--orange))]/10' : 'border-line hover:bg-surface2')}
              >
                <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg font-semibold', on ? 'bg-[rgb(var(--orange))] text-white' : 'bg-surface2')}>{mark.code}</span>
                <span className="flex-1">{mark.label}</span>
                {on ? <Check className="size-5 text-[rgb(var(--orange))]" /> : null}
              </button>
            );
          })}
          {zone && !readOnly ? (
            <Field label="Gdje točno?">
              <Textarea
                rows={2}
                value={zoneNote}
                placeholder="npr. donji rub, oko 4 cm"
                onChange={(e) => saveZoneNote(zone.code, e.target.value)}
              />
            </Field>
          ) : null}
          <Button size="lg" variant="primary" className="mt-2" onClick={() => setZone(null)}>
            Gotovo
          </Button>
        </div>
      </Sheet>
    </Fold>
  );
}
