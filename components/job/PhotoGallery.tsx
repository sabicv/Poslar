'use client';

import { plural } from '@/lib/format';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Camera, FileText, ImagePlus, Pencil } from 'lucide-react';
import { ConfirmButton, Lightbox, Segmented, Sheet, useAction } from '@/components/client-ui';
import { Button, EmptyState, Field, Input, Select } from '@/components/ui';
import { deleteAttachment, updateAttachment } from '@/lib/actions/jobs';
import { uploadFile } from '@/lib/upload';
import { cn } from '@/lib/utils';

interface FileView {
  id: string;
  url: string;
  thumbUrl: string;
  isPdf: boolean;
  tag: string | null;
  caption: string | null;
  stage: 'before' | 'during' | 'after' | null;
  visibility: 'internal' | 'customer' | 'insurer';
  when: string;
  gpsLat: number | null;
  gpsLng: number | null;
}

const STAGES = { before: 'Prije', during: 'Tijekom', after: 'Poslije' } as const;

export function PhotoGallery({
  tenantId,
  jobId,
  tags,
  withStages,
  files,
  archive = false,
}: {
  tenantId: string;
  jobId: string;
  tags: { code: string; label: string }[];
  withStages: boolean;
  files: FileView[];
  // The trail keeps the pictures. Taking them happens on the function.
  archive?: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [tag, setTag] = useState(tags[0]?.code ?? 'intake');
  const [stage, setStage] = useState<'before' | 'during' | 'after'>('before');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [editing, setEditing] = useState<FileView | null>(null);
  const tagLabel = (code: string | null) => tags.find((t) => t.code === code)?.label ?? 'Ostalo';

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    const all = [...list];
    setProgress({ done: 0, total: all.length });
    let failed = 0;
    let queued = 0;
    for (const file of all) {
      try {
        const result = await uploadFile({ tenantId, jobId, file, tag, stage: withStages ? stage : null });
        if ('queued' in result && result.queued) queued++;
      } catch {
        failed++;
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setProgress(null);
    if (failed) toast.error(`${failed} datoteka nije poslano. Provjerite vezu i pokušajte ponovno.`);
    else if (queued) toast.success(queued === 1 ? 'Spremljeno na telefonu. Šalje se kad se veza vrati.' : `${queued} fotografija na telefonu. Šalju se kad se veza vrati.`);
    else toast.success(all.length === 1 ? 'Fotografija spremljena' : `${all.length} ${plural(all.length, 'datoteka spremljena', 'datoteke spremljene', 'datoteka spremljeno')}`);
    router.refresh();
  }

  const images = files.filter((f) => !f.isPdf);
  const groups = tags.map((t) => ({ ...t, files: files.filter((f) => f.tag === t.code) })).filter((g) => g.files.length);
  const untagged = files.filter((f) => !tags.some((t) => t.code === f.tag));
  if (untagged.length) groups.push({ code: '_', label: 'Ostalo', files: untagged });

  return (
    <div className="space-y-5">
      {archive ? null : (
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Select value={tag} onChange={(e) => setTag(e.target.value)}>
            {tags.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </Select>
          {withStages ? (
            <Segmented value={stage} onChange={setStage} options={(Object.keys(STAGES) as (keyof typeof STAGES)[]).map((s) => ({ value: s, label: STAGES[s] }))} />
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="primary" size="lg" disabled={progress !== null} onClick={() => cameraRef.current?.click()}>
            <Camera className="size-5" /> Slikaj
          </Button>
          <Button size="lg" disabled={progress !== null} onClick={() => pickerRef.current?.click()}>
            <ImagePlus className="size-5" /> Iz galerije
          </Button>
        </div>
        {progress ? (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
              <div className="h-full bg-accent transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">
              Šaljem {progress.done + 1} / {progress.total}…
            </p>
          </div>
        ) : null}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
        <input ref={pickerRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
      </div>
      )}

      {files.length === 0 ? (
        <EmptyState icon={<Camera className="size-8" />} title="Još nema fotografija">
          {archive
            ? 'Snimaju se uz stanje, brojilo ili dio. Ovdje ostaju.'
            : 'Slikajte stanje pri prijemu, oštećenja, stare i nove dijelove. Datum, lokacija i otisak datoteke spremaju se automatski.'}
        </EmptyState>
      ) : (
        groups.map((group) => (
          <section key={group.code}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {group.label} <span className="text-faint">· {group.files.length}</span>
            </h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {group.files.map((file) => (
                <div key={file.id} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-surface2">
                  {file.isPdf ? (
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex h-full flex-col items-center justify-center gap-1 text-muted">
                      <FileText className="size-8" />
                      <span className="px-2 text-center text-xs">{file.caption ?? 'PDF'}</span>
                    </a>
                  ) : (
                    <button type="button" className="block h-full w-full" onClick={() => setViewer(images.findIndex((i) => i.id === file.id))}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={file.thumbUrl || file.url} alt={file.caption ?? group.label} loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  )}
                  {file.stage ? <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 text-xs text-white">{STAGES[file.stage]}</span> : null}
                  {file.visibility !== 'internal' ? <span className="absolute bottom-1.5 left-1.5 rounded bg-accent px-1.5 text-xs font-medium text-accent-fg">Stranka</span> : null}
                  <button
                    type="button"
                    onClick={() => setEditing(file)}
                    className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-lg bg-black/55 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Uredi"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {viewer !== null && images[viewer] ? (
        <Lightbox
          index={viewer}
          onClose={() => setViewer(null)}
          items={images.map((i) => ({ id: i.id, url: i.url, label: tagLabel(i.tag), caption: i.caption, when: i.when, gpsLat: i.gpsLat, gpsLng: i.gpsLng }))}
        />
      ) : null}

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title="Fotografija">
        {editing ? <EditFile key={editing.id} file={editing} tags={tags} jobId={jobId} pending={pending} run={run} onClose={() => setEditing(null)} /> : null}
      </Sheet>
    </div>
  );
}

function EditFile({
  file,
  tags,
  jobId,
  pending,
  run,
  onClose,
}: {
  file: FileView;
  tags: { code: string; label: string }[];
  jobId: string;
  pending: boolean;
  run: ReturnType<typeof useAction>['run'];
  onClose: () => void;
}) {
  const [tag, setTag] = useState(file.tag ?? '');
  const [caption, setCaption] = useState(file.caption ?? '');
  const [visible, setVisible] = useState(file.visibility !== 'internal');
  return (
    <div className="space-y-4">
      <Field label="Vrsta">
        <Select value={tag} onChange={(e) => setTag(e.target.value)}>
          {tags.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Opis">
        <Input value={caption} onChange={(e) => setCaption(e.target.value)} />
      </Field>
      <label className={cn('flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm', visible ? 'border-accent/40 bg-accent/5' : 'border-line')}>
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="size-5" />
        Prikaži stranci (izvještaj i odobrenje)
      </label>
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={pending}
          onClick={() => run(() => updateAttachment(file.id, jobId, { tag: tag || null, caption: caption.trim() || null, visibility: visible ? 'customer' : 'internal' }), { success: 'Spremljeno', onDone: onClose })}
        >
          Spremi
        </Button>
        <ConfirmButton size="lg" onConfirm={() => run(() => deleteAttachment(file.id), { success: 'Obrisano', onDone: onClose })}>
          Obriši
        </ConfirmButton>
      </div>
    </div>
  );
}
