'use client';

import { useState, type ReactNode } from 'react';
import { EyeOff, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { ConfirmButton, DictateInput, Sheet, useAction } from '@/components/client-ui';
import { Button, Field, Input, Select } from '@/components/ui';
import type { LineKind } from '@/config/tenant.config';
import { deleteTemplate, saveHourlyRate, saveJobAsTemplate, saveTemplate, setTemplateHidden } from '@/lib/actions/pricing';
import { cn } from '@/lib/utils';

export interface EditorLine {
  kind: LineKind;
  description: string;
  qty: number;
  unit: string;
  // The owner's own price, or null for the default shown as a hint.
  price: number | null;
  defaultPrice: number | null;
}

export interface EditorTemplate {
  code: string | null;
  name: string;
  inspection: string | null;
  kind: 'package' | 'own';
  changed: boolean;
  hidden: boolean;
  lines: EditorLine[];
}

const KINDS: Record<LineKind, string> = { labor: 'Rad', part: 'Dio', material: 'Materijal', package: 'Paket', sublet: 'Vanjska usluga', fee: 'Naknada' };
const UNITS = ['h', 'kom', 'paušal', 'l', 'm', 'kg', 'g', 'km', 'dan', 'mj.'];

const toText = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));
const toNum = (s: string) => {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const euro = (n: number) => new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(n);

type Row = { kind: LineKind; description: string; qty: string; unit: string; price: string; defaultPrice: number | null };

// One template: name, lines with the owner's prices (an empty price uses
// the hourly rate or the package price, shown greyed), checklist; and for
// a package template, hide or go back to the original.
export function TemplateEditor({
  template,
  inspections,
  hourly,
  trigger,
}: {
  template: EditorTemplate;
  inspections: { code: string; name: string }[];
  hourly: number | null;
  trigger: ReactNode;
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const fresh = () => ({
    name: template.name,
    inspection: template.inspection ?? '',
    rows: template.lines.map<Row>((l) => ({ kind: l.kind, description: l.description, qty: toText(l.qty), unit: l.unit, price: toText(l.price), defaultPrice: l.defaultPrice })),
  });
  const [v, setV] = useState(fresh);
  const setRow = (i: number, patch: Partial<Row>) => setV((s) => ({ ...s, rows: s.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  // The hint follows the line: work by the hour shows the hourly rate.
  const hint = (r: Row) => (r.kind === 'labor' && r.unit === 'h' && hourly !== null ? hourly : r.defaultPrice);
  const total = v.rows.reduce((s, r) => s + (toNum(r.qty) ?? 0) * (toNum(r.price) ?? hint(r) ?? 0), 0);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setV(fresh());
      }}
      title={template.code ? template.name : 'Novi predložak'}
      trigger={trigger}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              saveTemplate({
                code: template.code,
                name: v.name,
                inspection: v.inspection || null,
                lines: v.rows.map((r) => ({ kind: r.kind, description: r.description, qty: toNum(r.qty) ?? 1, unit: r.unit, price: toNum(r.price) })),
              }),
            { success: 'Predložak spremljen', onDone: () => setOpen(false) }
          );
        }}
      >
        <Field label="Naziv">
          <DictateInput value={v.name} onValue={(name) => setV((s) => ({ ...s, name }))} placeholder="npr. Servis klime s dezinfekcijom" />
        </Field>

        <div className="space-y-2">
          {v.rows.map((r, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-line p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <DictateInput value={r.description} onValue={(description) => setRow(i, { description })} placeholder="Opis stavke" aria-label="Opis stavke" />
                </div>
                <button type="button" onClick={() => setV((s) => ({ ...s, rows: s.rows.filter((_, j) => j !== i) }))} className="flex size-11 shrink-0 items-center justify-center rounded-lg text-faint hover:bg-surface2 hover:text-crit" aria-label="Ukloni stavku">
                  <X className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-[1fr_1fr_1.3fr] gap-2">
                <Select value={r.kind} onChange={(e) => setRow(i, { kind: e.target.value as LineKind })} aria-label="Vrsta">
                  {Object.entries(KINDS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </Select>
                <div className="flex gap-1">
                  <Input inputMode="decimal" value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} aria-label="Količina" className="min-w-0 px-2 text-center" />
                  <Select value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} aria-label="Jedinica" className="min-w-0 px-1">
                    {[...new Set([r.unit, ...UNITS])].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="relative">
                  <Input
                    inputMode="decimal"
                    value={r.price}
                    onChange={(e) => setRow(i, { price: e.target.value })}
                    placeholder={hint(r) !== null ? String(hint(r)).replace('.', ',') : 'cijena'}
                    aria-label="Cijena"
                    className="pr-7 text-right tabular"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-faint">€</span>
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="ghost" onClick={() => setV((s) => ({ ...s, rows: [...s.rows, { kind: 'labor', description: '', qty: '1', unit: 'h', price: '', defaultPrice: null }] }))}>
            <Plus className="size-4" /> Dodaj stavku
          </Button>
        </div>

        <p className="text-xs text-faint">Prazna cijena: {hourly !== null ? `rad po satu ide po Vašoj satnici (${euro(hourly)}), ostalo po cijeni zanata` : 'vrijedi cijena zanata (sivo)'}. Cijene su bez PDV-a i vidite ih samo Vi.</p>

        {inspections.length ? (
          <Field label="Kontrolna lista uz predložak">
            <Select value={v.inspection} onChange={(e) => setV((s) => ({ ...s, inspection: e.target.value }))}>
              <option value="">Bez liste</option>
              {inspections.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div className="flex items-center justify-between rounded-xl bg-surface2 px-3 py-2.5 text-sm">
          <span className="text-muted">Ukupno bez PDV-a</span>
          <span className="font-semibold tabular">{euro(total)}</span>
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending || v.rows.length === 0 || v.name.trim().length < 2}>
          Spremi predložak
        </Button>

        {template.code ? (
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            {template.kind === 'package' ? (
              <Button type="button" variant="ghost" disabled={pending} onClick={() => run(() => setTemplateHidden(template.code!, !template.hidden), { success: template.hidden ? 'Predložak se opet nudi' : 'Predložak skriven', onDone: () => setOpen(false) })}>
                <EyeOff className="size-4" /> {template.hidden ? 'Prikaži u nalozima' : 'Ne radimo ovo, sakrij'}
              </Button>
            ) : null}
            {template.kind === 'package' && template.changed ? (
              <ConfirmButton variant="ghost" confirmLabel="Da, vrati izvorno" onConfirm={() => run(() => deleteTemplate(template.code!), { success: 'Vraćeno kako je u zanatu', onDone: () => setOpen(false) })}>
                <RotateCcw className="size-4" /> Vrati izvorno
              </ConfirmButton>
            ) : null}
            {template.kind === 'own' ? (
              <ConfirmButton variant="ghost" confirmLabel="Da, obriši predložak" onConfirm={() => run(() => deleteTemplate(template.code!), { success: 'Predložak obrisan', onDone: () => setOpen(false) })}>
                <Trash2 className="size-4" /> Obriši
              </ConfirmButton>
            ) : null}
          </div>
        ) : null}
      </form>
    </Sheet>
  );
}

export function HourlyRateForm({ hourly }: { hourly: number | null }) {
  const { pending, run } = useAction();
  const [value, setValue] = useState(toText(hourly));
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveHourlyRate(toNum(value)), { success: toNum(value) === null ? 'Satnica uklonjena' : 'Satnica spremljena' });
      }}
    >
      <Field label="Satnica (bez PDV-a)" className="flex-1">
        <div className="relative">
          <DictateInput mode="number" inputMode="decimal" value={value} onValue={setValue} placeholder="npr. 45" className="!pr-24 tabular" />
          <span className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 text-xs text-faint">€ / h</span>
        </div>
      </Field>
      <Button type="submit" variant="primary" disabled={pending} className={cn('h-11')}>
        Spremi
      </Button>
    </form>
  );
}

// "Spremi kao predložak" on a work order: the approved lines and their
// prices become the owner's own template.
export function SaveAsTemplate({ jobId, suggestion }: { jobId: string; suggestion: string }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestion);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Spremi kao predložak"
      trigger={
        <Button variant="ghost" size="sm">
          Spremi kao predložak
        </Button>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveJobAsTemplate(jobId, name), { success: 'Predložak spremljen. Nađete ga u Postavke → Cjenik.', onDone: () => setOpen(false) });
        }}
      >
        <p className="text-sm text-muted">Odobrene stavke s ovog naloga, s Vašim cijenama, postaju predložak za sljedeći put.</p>
        <Field label="Naziv predloška">
          <DictateInput value={name} onValue={setName} />
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending || name.trim().length < 2}>
          Spremi
        </Button>
      </form>
    </Sheet>
  );
}
