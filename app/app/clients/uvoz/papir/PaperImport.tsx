'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';
import { toJpeg } from '@/components/ScanButton';
import { Button, Field, Input, Textarea, buttonClass } from '@/components/ui';
import { importPaperJob } from '@/lib/actions/paper-import';
import { formatEuro } from '@/lib/format';
import { uploadFile } from '@/lib/upload';
import { cn } from '@/lib/utils';

// The kuna was converted at this fixed rate (1 January 2023).
const HRK_PER_EUR = 7.5345;

type LineKind = 'labor' | 'part' | 'material' | 'fee';
interface Line {
  // Only for the list keys; never sent.
  uid: number;
  description: string;
  kind: LineKind;
  qty: number;
  unit: string;
  price: number;
}
interface Form {
  date: string;
  number: string;
  firstName: string;
  lastName: string;
  companyName: string;
  phone: string;
  oib: string;
  address: string;
  city: string;
  identifier: string;
  make: string;
  model: string;
  vin: string;
  year: number | null;
  meter: number | null;
  work: string;
  lines: Line[];
}
interface Item {
  id: number;
  file: File;
  preview: string;
  status: 'reading' | 'check' | 'saving' | 'saved' | 'skipped';
  error: string | null;
  form: Form;
  paperTotal: number | null;
  converted: boolean;
  saved?: { jobId: string; number: number };
}

const empty = (): Form => ({ date: '', number: '', firstName: '', lastName: '', companyName: '', phone: '', oib: '', address: '', city: '', identifier: '', make: '', model: '', vin: '', year: null, meter: null, work: '', lines: [] });
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
// "1.234,50" and "1,5" the Croatian way, "1.5" as written.
const num = (v: unknown) => {
  const s = typeof v === 'string' ? v.trim() : '';
  const n = typeof v === 'number' ? v : s ? Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};
let lineSeq = 0;
const KINDS: LineKind[] = ['labor', 'part', 'material', 'fee'];

// What the model read, as the form's fields (kuna converted to euro).
function fromScan(data: Record<string, unknown>): { form: Form; paperTotal: number | null; converted: boolean } {
  const c = (data.client ?? {}) as Record<string, unknown>;
  const a = (data.asset ?? {}) as Record<string, unknown>;
  const kuna = str(data.currency).toUpperCase() === 'HRK';
  const eur = (n: number | null) => (n === null ? null : kuna ? Math.round((n / HRK_PER_EUR) * 100) / 100 : n);
  const lines = (Array.isArray(data.lines) ? data.lines : [])
    .map((l) => l as Record<string, unknown>)
    .filter((l) => str(l.description))
    .map((l) => ({
      uid: ++lineSeq,
      description: str(l.description).slice(0, 300),
      kind: (KINDS.includes(l.kind as LineKind) ? l.kind : 'part') as LineKind,
      qty: num(l.qty) ?? 1,
      unit: str(l.unit).slice(0, 10),
      price: eur(num(l.price)) ?? 0,
    }));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(data.date)) ? str(data.date) : '';
  return {
    form: {
      date,
      number: str(data.number).slice(0, 40),
      firstName: str(c.first_name),
      lastName: str(c.last_name),
      companyName: str(c.company_name),
      phone: str(c.phone),
      oib: /^\d{11}$/.test(str(c.oib)) ? str(c.oib) : '',
      address: str(c.address),
      city: str(c.city),
      identifier: str(a.identifier),
      make: str(a.make),
      model: str(a.model),
      vin: str(a.vin).slice(0, 17),
      year: num(a.year),
      meter: num(data.meter),
      work: str(data.work),
      lines,
    },
    paperTotal: eur(num(data.total)),
    converted: kuna,
  };
}

export function PaperImport({ identifierLabel, field }: { identifierLabel: string; field: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const update = (id: number, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const setForm = (id: number, patch: Partial<Form>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, form: { ...i.form, ...patch } } : i)));

  // One photo after another: the model reads, the owner checks.
  async function add(files: FileList | null) {
    if (!files?.length) return;
    const fresh = [...files].map((file) => ({ id: ++seq.current, file, preview: URL.createObjectURL(file), status: 'reading' as const, error: null, form: empty(), paperTotal: null, converted: false }));
    setItems((list) => [...fresh, ...list]);
    if (input.current) input.current.value = '';
    for (const item of fresh) {
      try {
        const image = await toJpeg(item.file, 2400);
        const res = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'papir', image }) });
        const body = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: string };
        if (!res.ok || !body.data) throw new Error(body.error ?? 'Papir nije pročitan.');
        update(item.id, { status: 'check', ...fromScan(body.data) });
      } catch (error) {
        update(item.id, { status: 'check', error: `${(error as Error).message} Podatke možete upisati ručno.` });
      }
    }
  }

  async function save(item: Item) {
    update(item.id, { status: 'saving', error: null });
    const lines = item.form.lines.filter((l) => l.description.trim()).map(({ description, kind, qty, unit, price }) => ({ description, kind, qty, unit, price }));
    const result = await importPaperJob({ ...item.form, lines }).catch(() => ({ ok: false as const, error: 'Nema veze s internetom. Pokušajte ponovno.' }));
    if (!result.ok || !result.data) {
      update(item.id, { status: 'check', error: result.ok ? 'Nije spremljeno.' : result.error });
      return;
    }
    // The paper itself stays with the job.
    await uploadFile({ tenantId: result.data.tenantId, jobId: result.data.jobId, file: item.file, tag: 'document', caption: 'Papirnati dokument' }).catch(() => null);
    update(item.id, { status: 'saved', saved: { jobId: result.data.jobId, number: result.data.number } });
  }

  const open = items.filter((i) => i.status === 'reading' || i.status === 'check' || i.status === 'saving');
  const done = items.filter((i) => i.status === 'saved').length;

  return (
    <div className="space-y-4">
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
      <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={() => input.current?.click()}>
        <Camera className="size-5" /> Slikaj ili odaberi papire
      </Button>
      {done ? <p className="text-sm text-muted">Spremljeno u povijest: {done}</p> : null}
      {open.length === 0 && items.length === 0 ? (
        <ol className="list-inside list-decimal space-y-1 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
          <li>Slikajte stari nalog ili račun ravno, cijeli list, bez odsjaja. Može i više slika odjednom iz galerije.</li>
          <li>Poslar pročita mušteriju, {identifierLabel.toLowerCase()}, datum, posao i stavke, i rukom pisano.</li>
          <li>Provjerite i spremite. Nalog ide u povijest kao preuzet i plaćen, sa slikom papira.</li>
        </ol>
      ) : null}

      {items.map((item) => (
        <div key={item.id} className={cn('overflow-hidden rounded-2xl border bg-surface', item.status === 'saved' ? 'border-line' : 'border-accent/40')}>
          <div className="flex items-center gap-3 border-b border-line p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href={item.preview} target="_blank" rel="noreferrer" className="shrink-0">
              <img src={item.preview} alt="Papir" className="size-16 rounded-lg object-cover" />
            </a>
            <div className="min-w-0 flex-1 text-sm">
              {item.status === 'reading' ? (
                <span className="flex items-center gap-2 text-muted">
                  <Loader2 className="size-4 animate-spin" /> Poslar čita papir…
                </span>
              ) : item.status === 'saved' && item.saved ? (
                <span className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="size-5 text-accent" />
                  <span className="font-medium">Spremljeno u povijest</span>
                  <Link href={`/app/jobs/${item.saved.jobId}`} className="text-accent hover:underline">
                    Nalog #{item.saved.number}
                  </Link>
                </span>
              ) : item.status === 'skipped' ? (
                <span className="text-muted">Preskočeno</span>
              ) : (
                <span className="font-medium">{[item.form.identifier, [item.form.firstName, item.form.lastName].filter(Boolean).join(' ') || item.form.companyName].filter(Boolean).join(' · ') || 'Provjerite podatke'}</span>
              )}
            </div>
          </div>
          {item.status === 'check' || item.status === 'saving' ? <PaperForm item={item} identifierLabel={identifierLabel} field={field} setForm={(p) => setForm(item.id, p)} onSave={() => save(item)} onSkip={() => update(item.id, { status: 'skipped' })} /> : null}
        </div>
      ))}
    </div>
  );
}

function PaperForm({ item, identifierLabel, field, setForm, onSave, onSkip }: { item: Item; identifierLabel: string; field: boolean; setForm: (p: Partial<Form>) => void; onSave: () => void; onSkip: () => void }) {
  const f = item.form;
  const t = (key: keyof Form) => ({ value: (f[key] as string) ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ [key]: e.target.value } as Partial<Form>) });
  const n = (key: 'meter' | 'year') => ({ inputMode: 'numeric' as const, value: f[key] ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ [key]: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) || null }) });
  const setLine = (i: number, patch: Partial<Line>) => setForm({ lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const net = f.lines.reduce((s, l) => s + l.qty * l.price, 0);
  return (
    <div className="space-y-4 p-4">
      {item.error ? <p className="rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">{item.error}</p> : null}
      {item.converted ? <p className="rounded-xl bg-surface2 px-3 py-2 text-xs text-muted">Iznosi su bili u kunama, preračunati u eure po tečaju 7,53450.</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Datum">
          <Input type="date" {...t('date')} />
        </Field>
        <Field label="Broj dokumenta">
          <Input {...t('number')} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ime">
          <Input {...t('firstName')} autoComplete="off" />
        </Field>
        <Field label="Prezime">
          <Input {...t('lastName')} autoComplete="off" />
        </Field>
        <Field label="Tvrtka (ako je)">
          <Input {...t('companyName')} autoComplete="off" />
        </Field>
        <Field label="Telefon">
          <Input type="tel" inputMode="tel" {...t('phone')} autoComplete="off" />
        </Field>
        {field ? (
          <>
            <Field label="Adresa">
              <Input {...t('address')} autoComplete="off" />
            </Field>
            <Field label="Mjesto">
              <Input {...t('city')} autoComplete="off" />
            </Field>
          </>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={identifierLabel}>
          <Input {...t('identifier')} autoCapitalize="characters" autoComplete="off" />
        </Field>
        <Field label="Marka">
          <Input {...t('make')} autoComplete="off" />
        </Field>
        <Field label="Model">
          <Input {...t('model')} autoComplete="off" />
        </Field>
        <Field label={field ? 'Sati rada' : 'Kilometri'}>
          <Input {...n('meter')} />
        </Field>
      </div>
      <Field label="Posao">
        <Textarea rows={3} {...t('work')} />
      </Field>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted">Stavke (cijene bez PDV-a)</p>
        {f.lines.map((l, i) => (
          // Phone: the name on its own row, amount and price under it.
          // Amounts are read when the field is left, so "1," can be typed on the way to "1,5".
          <div key={l.uid} className="grid grid-cols-[1fr_1fr_3rem] items-center gap-2 rounded-xl border border-line p-2 sm:grid-cols-[1fr_5rem_7rem_3rem] sm:border-0 sm:p-0">
            <Input aria-label="Stavka" className="col-span-3 sm:col-span-1" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
            <Input aria-label="Količina" placeholder="Kol." inputMode="decimal" defaultValue={String(l.qty).replace('.', ',')} onBlur={(e) => setLine(i, { qty: num(e.target.value) ?? 0 })} />
            <Input aria-label="Cijena" placeholder="€" inputMode="decimal" defaultValue={String(l.price).replace('.', ',')} onBlur={(e) => setLine(i, { price: num(e.target.value) ?? 0 })} />
            <button type="button" aria-label="Ukloni stavku" className="flex size-12 items-center justify-center rounded-xl text-muted hover:bg-surface2" onClick={() => setForm({ lines: f.lines.filter((_, j) => j !== i) })}>
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setForm({ lines: [...f.lines, { uid: ++lineSeq, description: '', kind: 'part', qty: 1, unit: '', price: 0 }] })}>
          <Plus className="size-4" /> Dodaj stavku
        </Button>
        <p className="text-sm text-muted">
          Stavke ukupno: <span className="font-medium text-fg tabular">{formatEuro(net)}</span> bez PDV-a
          {item.paperTotal !== null ? <> · na papiru {formatEuro(item.paperTotal)}</> : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={item.status === 'saving'} onClick={onSave}>
          {item.status === 'saving' ? 'Spremam…' : 'Spremi u povijest'}
        </Button>
        <button type="button" className={buttonClass('ghost')} onClick={onSkip}>
          Preskoči
        </button>
      </div>
    </div>
  );
}
