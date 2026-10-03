'use client';

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, CheckCircle2, ListPlus, MessageSquare, Plus } from 'lucide-react';
import { ConfirmButton, DictateButton, Segmented, useAction } from '@/components/client-ui';
import { Badge, Button, Card, Input, Select } from '@/components/ui';
import type { InspectionItem, InspectionTemplate } from '@/config/tenant.config';
import { completeInspection, deleteInspection, linesFromInspection, saveInspectionResult, startInspection } from '@/lib/actions/jobs';
import { uploadFile } from '@/lib/upload';
import { cn } from '@/lib/utils';
import type { InspectionStatus } from '@/types/db';

interface Result {
  item_code: string;
  status: InspectionStatus;
  measure_value: number | null;
  note: string | null;
  photo_ids: string[];
  job_line_id: string | null;
}

// A typed measurement decides the colour on its own.
function statusFromMeasure(item: InspectionItem, value: number): InspectionStatus {
  if (item.critBelow !== undefined && value < item.critBelow) return 'crit';
  if (item.critAbove !== undefined && value > item.critAbove) return 'crit';
  if (item.warnBelow !== undefined && value < item.warnBelow) return 'warn';
  if (item.warnAbove !== undefined && value > item.warnAbove) return 'warn';
  return 'ok';
}

function thresholdHint(item: InspectionItem) {
  const parts = [];
  if (item.warnBelow !== undefined) parts.push(`žuto < ${item.warnBelow}`);
  if (item.critBelow !== undefined) parts.push(`crveno < ${item.critBelow}`);
  if (item.warnAbove !== undefined) parts.push(`žuto > ${item.warnAbove}`);
  if (item.critAbove !== undefined) parts.push(`crveno > ${item.critAbove}`);
  return parts.join(' · ');
}

export function StartInspection({ jobId, templates, hasCurrent }: { jobId: string; templates: { code: string; name: string; purpose: string }[]; hasCurrent: boolean }) {
  const { pending, run } = useAction();
  const [code, setCode] = useState(templates[0]?.code ?? '');
  if (!templates.length) return null;
  return (
    <Card className="flex flex-wrap items-center gap-2 p-4">
      <p className="w-full text-sm font-medium">{hasCurrent ? 'Nova inspekcija ili kontrolna lista' : 'Započni inspekciju'}</p>
      <Select value={code} onChange={(e) => setCode(e.target.value)} className="min-w-0 flex-1">
        {templates.map((t) => (
          <option key={t.code} value={t.code}>
            {t.name}: {t.purpose}
          </option>
        ))}
      </Select>
      <Button variant={hasCurrent ? 'secondary' : 'primary'} disabled={pending || !code} onClick={() => run(() => startInspection(jobId, code))}>
        <Plus className="size-4" /> Započni
      </Button>
    </Card>
  );
}

export function InspectionRunner({
  jobId,
  tenantId,
  inspection,
  template,
  results: initial,
  photos: initialPhotos,
  locked,
}: {
  jobId: string;
  tenantId: string;
  inspection: { id: string; title: string; completed: boolean };
  template: InspectionTemplate;
  results: Result[];
  photos: Record<string, string>;
  locked: boolean;
}) {
  const { pending, run } = useAction();
  const [results, setResults] = useState<Record<string, Result>>(() => Object.fromEntries(initial.map((r) => [r.item_code, r])));
  const [photos, setPhotos] = useState(initialPhotos);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoTarget = useRef<InspectionItem | null>(null);
  const readOnly = locked || inspection.completed;
  const isDvi = template.purpose === 'dvi';

  const items = useMemo(() => template.sections.flatMap((s) => s.items), [template]);
  const counts = useMemo(() => {
    const c = { ok: 0, warn: 0, crit: 0, na: 0, done: 0 };
    for (const item of items) {
      const s = results[item.code]?.status;
      if (s && s !== 'not_checked') {
        c.done++;
        c[s]++;
      }
    }
    return c;
  }, [items, results]);
  const pendingFindings = items.filter((i) => ['warn', 'crit'].includes(results[i.code]?.status ?? '') && !results[i.code]?.job_line_id).length;

  // Optimistic: the colour changes on tap, the save follows in the background.
  function save(item: InspectionItem, patch: Partial<Result>) {
    const previous = results[item.code];
    const base: Result = previous ?? { item_code: item.code, status: 'not_checked', measure_value: null, note: null, photo_ids: [], job_line_id: null };
    const next: Result = { ...base, ...patch };
    setResults((r) => ({ ...r, [item.code]: next }));
    saveInspectionResult(jobId, inspection.id, item.code, {
      status: next.status,
      measure_value: next.measure_value,
      measure_unit: item.unit ?? null,
      note: next.note,
      ...(patch.photo_ids ? { photo_ids: patch.photo_ids } : {}),
    })
      .then((res) => {
        if (!res.ok) {
          toast.error(res.error);
          setResults((r) => ({ ...r, [item.code]: previous }));
        }
      })
      .catch(() => {
        toast.error('Nije spremljeno. Provjerite vezu.');
        setResults((r) => ({ ...r, [item.code]: previous }));
      });
  }

  async function onPhoto(file: File) {
    const item = photoTarget.current;
    if (!item) return;
    setUploadingItem(item.code);
    try {
      const { id } = await uploadFile({ tenantId, jobId, file, tag: 'inspection', caption: item.label });
      setPhotos((p) => ({ ...p, [id]: URL.createObjectURL(file) }));
      save(item, { photo_ids: [...(results[item.code]?.photo_ids ?? []), id] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploadingItem(null);
    }
  }

  const options = isDvi
    ? [
        { value: 'ok' as const, label: 'OK', tone: 'ok' as const },
        { value: 'warn' as const, label: 'Pratiti', tone: 'warn' as const },
        { value: 'crit' as const, label: 'Hitno', tone: 'crit' as const },
        { value: 'na' as const, label: 'N/P', tone: 'neutral' as const },
      ]
    : [
        { value: 'ok' as const, label: 'Obavljeno', tone: 'ok' as const },
        { value: 'warn' as const, label: 'Napomena', tone: 'warn' as const },
        { value: 'na' as const, label: 'N/P', tone: 'neutral' as const },
      ];

  return (
    <div className="space-y-4">
      {/* Sticks under the header and the job tabs (2.75rem), whatever the header's height. */}
      <Card className="sticky top-[calc(var(--shell-top)+2.75rem)] z-10 p-4 lg:top-12">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{inspection.title}</p>
            <p className="text-xs text-muted">
              {counts.done} / {items.length} provjereno
            </p>
          </div>
          <div className="flex gap-1.5">
            <Badge tone="ok">{counts.ok}</Badge>
            <Badge tone="warn">{counts.warn}</Badge>
            {isDvi ? <Badge tone="crit">{counts.crit}</Badge> : null}
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface2">
          <div className="flex h-full">
            <div className="bg-ok" style={{ width: `${(counts.ok / items.length) * 100}%` }} />
            <div className="bg-warn" style={{ width: `${(counts.warn / items.length) * 100}%` }} />
            <div className="bg-crit" style={{ width: `${(counts.crit / items.length) * 100}%` }} />
            <div className="bg-faint" style={{ width: `${(counts.na / items.length) * 100}%` }} />
          </div>
        </div>
      </Card>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void onPhoto(file);
        }}
      />

      {template.sections.map((section) => (
        <Card key={section.title}>
          <div className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">{section.title}</div>
          <ul className="divide-y divide-line">
            {section.items.map((item) => {
              const r = results[item.code];
              const status = r?.status ?? 'not_checked';
              return (
                <li key={item.code} className={cn('px-4 py-3', status === 'crit' && 'bg-crit/[0.04]', status === 'warn' && 'bg-warn/[0.04]')}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="pt-1 text-sm">{item.label}</p>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => {
                          // With a note already there the field is open: take the finger to it.
                          if (r?.note) return document.getElementById(`note-${item.code}`)?.focus();
                          setOpenNote(openNote === item.code ? null : item.code);
                          if (openNote !== item.code) setTimeout(() => document.getElementById(`note-${item.code}`)?.focus(), 0);
                        }}
                        className={cn('flex size-9 items-center justify-center rounded-lg hover:bg-surface2', r?.note ? 'text-accent' : 'text-faint')}
                        aria-label="Napomena"
                      >
                        <MessageSquare className="size-4" />
                      </button>
                      <button
                        type="button"
                        disabled={readOnly || uploadingItem !== null}
                        onClick={() => {
                          photoTarget.current = item;
                          fileRef.current?.click();
                        }}
                        className={cn('flex size-9 items-center justify-center rounded-lg hover:bg-surface2', r?.photo_ids?.length ? 'text-accent' : 'text-faint', uploadingItem === item.code && 'animate-pulse')}
                        aria-label="Fotografija"
                      >
                        <Camera className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className={cn('mt-2 grid gap-2', item.unit ? 'grid-cols-[7.5rem_1fr]' : '')}>
                    {item.unit ? (
                      <div className="relative">
                        <Input
                          inputMode="decimal"
                          disabled={readOnly}
                          defaultValue={r?.measure_value ?? ''}
                          className="h-9 pr-10 tabular"
                          onBlur={(e) => {
                            const raw = e.target.value.trim().replace(',', '.');
                            if (raw === '') return;
                            const value = Number(raw);
                            if (Number.isNaN(value) || value === r?.measure_value) return;
                            save(item, { measure_value: value, status: statusFromMeasure(item, value) });
                          }}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">{item.unit}</span>
                      </div>
                    ) : null}
                    <Segmented value={status === 'not_checked' ? null : status} disabled={readOnly} options={options} onChange={(s) => save(item, { status: s })} />
                  </div>
                  {item.unit && thresholdHint(item) ? <p className="mt-1 text-[11px] text-faint">{thresholdHint(item)}</p> : null}
                  {openNote === item.code || r?.note ? (
                    <div className="mt-2 flex gap-2">
                    <Input
                      key={r?.note ?? ''}
                      id={`note-${item.code}`}
                      className="h-11"
                      disabled={readOnly}
                      placeholder="Napomena"
                      defaultValue={r?.note ?? ''}
                      onBlur={(e) => {
                        const note = e.target.value.trim() || null;
                        if (note !== (r?.note ?? null)) save(item, { note });
                      }}
                    />
                    {!readOnly ? <DictateButton compact onText={(text) => save(item, { note: r?.note ? `${r.note.trimEnd()} ${text}` : text })} /> : null}
                    </div>
                  ) : null}
                  {r?.photo_ids?.length ? (
                    <div className="mt-2 flex gap-2">
                      {r.photo_ids.map((pid) =>
                        photos[pid] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={pid} src={photos[pid]} alt="" className="size-14 rounded-lg border border-line object-cover" />
                        ) : null
                      )}
                    </div>
                  ) : null}
                  {r?.job_line_id ? <p className="mt-1.5 text-xs text-accent">→ u stavkama</p> : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      {!locked ? (
        <div className="flex flex-wrap gap-2">
          {pendingFindings > 0 ? (
            <Button
              variant="primary"
              disabled={pending}
              onClick={() => run(() => linesFromInspection(jobId, inspection.id), { onDone: (d) => toast.success(`${d?.count ?? 0} nalaza dodano u stavke kao prijedlog`) })}
            >
              <ListPlus className="size-4" /> Nalazi u stavke ({pendingFindings})
            </Button>
          ) : null}
          <Button variant={inspection.completed ? 'secondary' : 'ok'} disabled={pending} onClick={() => run(() => completeInspection(jobId, inspection.id, !inspection.completed))}>
            <CheckCircle2 className="size-4" /> {inspection.completed ? 'Nastavi uređivati' : 'Završi'}
          </Button>
          <ConfirmButton size="md" variant="ghost" confirmLabel="Obrisati inspekciju?" onConfirm={() => run(() => deleteInspection(jobId, inspection.id))}>
            Obriši
          </ConfirmButton>
        </div>
      ) : null}
    </div>
  );
}
