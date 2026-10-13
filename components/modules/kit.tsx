'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Fold } from '@/components/Fold';
import { ConfirmButton, DictateButton, DictateInput, Sheet, useAction } from '@/components/client-ui';
import { ScanButton, type ScanKind } from '@/components/ScanButton';
import { Button, Field, Input, Textarea } from '@/components/ui';
import type { ActionResult } from '@/lib/action-result';
import { proposeTemplateLine } from '@/lib/actions/jobs';
import { deleteRecord, savePrivateAmount, saveRecord } from '@/lib/actions/records';
import { cn } from '@/lib/utils';

// A small form engine for package records: each module describes its
// fields once and gets a glove-friendly bottom-sheet form for free.

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'hours' | 'select' | 'date' | 'datetime' | 'checkbox' | 'textarea';
  options?: { value: string; label: string }[];
  suffix?: string;
  placeholder?: string;
  half?: boolean;
  required?: boolean;
  // Rarely needed: its own row, open when it already holds something.
  extra?: boolean;
}

type Values = Record<string, unknown>;

// A list inside the sheet. The phone's own menu stays on top of the sheet
// and does not close with it, so a choice is a row, not a system dropdown.
function Choice({ value, options, onChange, allowEmpty = true }: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; allowEmpty?: boolean }) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen((next) => !next)} className="flex h-12 w-full items-center justify-between rounded-xl border border-line bg-bg px-3 text-left text-sm">
        <span className={current ? 'text-fg' : 'text-muted'}>{current?.label ?? 'Odaberite'}</span>
        <span className="text-faint">{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <div className="mt-2 grid gap-1">
          {allowEmpty && value ? (
            <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="flex h-12 items-center rounded-xl border border-line px-3 text-left text-sm text-muted">
              Poništi odabir
            </button>
          ) : null}
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn('flex h-12 items-center rounded-xl border px-3 text-left text-sm', option.value === value ? 'border-accent bg-accent/10 font-medium' : 'border-line')}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Decimal hours are easy to misread: 1.2 looks like an hour and 20 minutes.
function HoursInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const decimal = Number(value.replace(',', '.'));
  const total = Number.isFinite(decimal) ? Math.max(0, Math.round(decimal * 60)) : 0;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  function commit(nextHours: number, nextMins: number) {
    const h = Number.isFinite(nextHours) ? Math.max(0, Math.floor(nextHours)) : 0;
    const m = Number.isFinite(nextMins) ? Math.min(59, Math.max(0, Math.floor(nextMins))) : 0;
    const next = h + m / 60;
    onChange(next === 0 ? '0' : String(Math.round(next * 1000) / 1000));
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="relative">
        <Input inputMode="numeric" value={String(hours)} onChange={(e) => commit(Number(e.target.value.replace(/\D/g, '') || 0), mins)} className="tabular !pr-8" aria-label="Sati" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">h</span>
      </div>
      <div className="relative">
        <Input inputMode="numeric" value={String(mins)} onChange={(e) => commit(hours, Number(e.target.value.replace(/\D/g, '') || 0))} className="tabular !pr-10" aria-label="Minute" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">min</span>
      </div>
    </div>
  );
}

function toInput(def: FieldDef, value: unknown): string | boolean {
  if (def.type === 'checkbox') return Boolean(value);
  if (value === null || value === undefined) return '';
  if (def.type === 'datetime' && typeof value === 'string') {
    const d = new Date(value);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  if (def.type === 'date' && typeof value === 'string') return value.slice(0, 10);
  return String(value);
}

function fromInput(def: FieldDef, raw: string | boolean): unknown {
  if (def.type === 'checkbox') return Boolean(raw);
  const text = String(raw).trim();
  if (text === '') return null;
  if (def.type === 'number' || def.type === 'hours') {
    const n = Number(text.replace(/\s/g, '').replace(',', '.'));
    return Number.isNaN(n) ? null : n;
  }
  if (def.type === 'datetime') return new Date(text).toISOString();
  return text;
}

type FormState = Record<string, string | boolean>;

// "Slikaj gumu / pločicu": what the photo says (its keys) → the form's fields.
export interface FormScan {
  kind: ScanKind;
  label: string;
  map: Record<string, string>;
}

// What was typed into a sheet survives closing it by accident (a swipe, a
// tap beside it, a phone call): it comes back when the sheet is opened
// again, until it is saved. Kept per form for this browser tab only.
function readDraft(key: string | undefined): FormState | null {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(`draft:${key}`);
    return raw ? (JSON.parse(raw) as FormState) : null;
  } catch {
    return null;
  }
}
function writeDraft(key: string | undefined, state: FormState | null) {
  if (!key) return;
  try {
    if (state) sessionStorage.setItem(`draft:${key}`, JSON.stringify(state));
    else sessionStorage.removeItem(`draft:${key}`);
  } catch {
    // Private mode or storage full: the form still works, just without a draft.
  }
}

export function QuickForm({
  fields,
  initial = {},
  submitLabel = 'Spremi',
  onSubmit,
  onDone,
  onDelete,
  draftKey,
  scan,
  scanTarget,
}: {
  fields: FieldDef[];
  initial?: Values;
  submitLabel?: string;
  onSubmit: (values: Values) => Promise<ActionResult<unknown>>;
  onDone?: () => void;
  onDelete?: () => Promise<ActionResult<unknown>>;
  draftKey?: string;
  scan?: FormScan;
  scanTarget?: { current: ((data: Record<string, unknown>) => void) | null };
}) {
  const { pending, run } = useAction();
  const [restored, setRestored] = useState(() => readDraft(draftKey));
  const [state, setStateRaw] = useState<FormState>(() => restored ?? Object.fromEntries(fields.map((f) => [f.name, toInput(f, initial[f.name])])));
  const setState = (update: (s: FormState) => FormState) =>
    setStateRaw((s) => {
      const next = update(s);
      writeDraft(draftKey, next);
      return next;
    });
  // Shown next to the button too: a toast alone is easy to miss on a phone.
  const [error, setError] = useState<string | null>(null);
  const missing = fields.some((f) => f.required && (state[f.name] === '' || state[f.name] === undefined));
  const held = (v: unknown) => v !== null && v !== undefined && v !== '' && v !== false;
  const main = fields.filter((f) => !f.extra);
  const extra = fields.filter((f) => f.extra);
  const extraOn = extra.some((f) => held(state[f.name]));
  const extraSummary = extra.filter((f) => held(state[f.name])).map((f) => f.label).slice(0, 3).join(', ') || 'Rijetko potrebno';

  // What the photo says goes into the matching fields: only what was read
  // and fits (a select takes only its own options), and a folded field
  // that received something unfolds so it can be checked.
  function applyScan(data: Record<string, unknown>) {
    if (!scan) return;
    setState((s) => {
      const next = { ...s };
      for (const [from, to] of Object.entries(scan.map)) {
        const v = data[from];
        const f = fields.find((x) => x.name === to);
        if (v === null || v === undefined || v === '' || !f) continue;
        if (f.type === 'select' && !f.options?.some((o) => o.value === String(v))) continue;
        next[to] = String(v);
      }
      return next;
    });
  }
  // In a sheet the camera sits in the title bar and hands its result here.
  if (scanTarget) scanTarget.current = applyScan;

  return (
    <form
      className="grid grid-cols-2 gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const values = Object.fromEntries(fields.map((f) => [f.name, fromInput(f, state[f.name])]));
        run(
          async () => {
            const result = await onSubmit(values);
            // The database names the column; the form knows its label.
            const column = !result.ok ? /\(([a-z0-9_]+)\)\.$/.exec(result.error)?.[1] : null;
            const field = column ? fields.find((f) => f.name === column) : null;
            const final = field ? { ok: false as const, error: `Provjerite polje „${field.label}”.` } : result;
            if (final.ok) writeDraft(draftKey, null);
            else setError(final.error);
            return final;
          },
          { success: 'Spremljeno', onDone }
        );
      }}
    >
      {scan && !scanTarget ? (
        <div className="col-span-2">
          <ScanButton variant="full" kind={scan.kind} label={scan.label} onResult={applyScan} />
        </div>
      ) : null}
      {restored ? (
        <p className="col-span-2 flex items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-fg">
          Vraćeno je ono što ste upisali prije zatvaranja.
          <button
            type="button"
            className="shrink-0 font-medium text-accent"
            onClick={() => {
              writeDraft(draftKey, null);
              setRestored(null);
              setStateRaw(Object.fromEntries(fields.map((f) => [f.name, toInput(f, initial[f.name])])));
            }}
          >
            Očisti
          </button>
        </p>
      ) : null}
      {(() => {
      function draw(f: FieldDef) {
        const set = (value: string | boolean) => setState((s) => ({ ...s, [f.name]: value }));
        const span = f.half ? 'col-span-1' : 'col-span-2';
        if (f.type === 'checkbox') {
          return (
            <label key={f.name} className={cn(span, 'flex min-h-11 items-center gap-3 rounded-xl border border-line px-3 text-sm')}>
              <input type="checkbox" checked={Boolean(state[f.name])} onChange={(e) => set(e.target.checked)} className="size-5" />
              {f.label}
            </label>
          );
        }
        return (
          <Field key={f.name} label={f.required ? <>{f.label} <span className="text-crit">*</span></> : f.label} className={span}>
            {f.type === 'select' ? (
              <Choice value={String(state[f.name] ?? '')} options={f.options ?? []} allowEmpty={!f.required} onChange={(next) => set(next)} />
            ) : f.type === 'hours' ? (
              <HoursInput value={String(state[f.name] ?? '')} onChange={(next) => set(next)} />
            ) : f.type === 'textarea' ? (
              <div className="flex items-start gap-2">
                <Textarea rows={2} value={String(state[f.name])} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
                <DictateButton compact onText={(text) => setState((s) => ({ ...s, [f.name]: s[f.name] ? `${String(s[f.name]).trimEnd()} ${text}` : text }))} />
              </div>
            ) : f.type === 'date' || f.type === 'datetime' ? (
              <Input type={f.type === 'date' ? 'date' : 'datetime-local'} value={String(state[f.name])} onChange={(e) => set(e.target.value)} />
            ) : (
              // Text and numbers can be said instead of typed; the unit sits left of the microphone.
              <div className="relative">
                <DictateInput
                  mode={f.type === 'number' ? 'number' : 'text'}
                  inputMode={f.type === 'number' ? 'decimal' : undefined}
                  value={String(state[f.name])}
                  placeholder={f.placeholder}
                  onValue={set}
                  className={cn(f.suffix && '!pr-20', f.type === 'number' && 'tabular')}
                />
                {f.suffix ? <span className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 text-xs text-faint">{f.suffix}</span> : null}
              </div>
            )}
          </Field>
        );
      }
      return (
        <>
          {main.map(draw)}
          {extra.length ? (
            <div className="col-span-2">
              <Fold plain title="Dodatno" summary={extraSummary} startOpen={extraOn} reveal={extraOn}>
                <div className="grid grid-cols-2 gap-3 p-4">{extra.map(draw)}</div>
              </Fold>
            </div>
          ) : null}
        </>
      );
      })()}
      {missing ? <p className="col-span-2 text-xs text-muted">Polja sa zvjezdicom su obavezna.</p> : null}
      {error ? (
        <p role="alert" className="col-span-2 rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">
          {error}
        </p>
      ) : null}
      <div className="col-span-2 flex gap-2 pt-1">
        <Button type="submit" variant="primary" size="lg" className="flex-1" disabled={pending || missing}>
          {pending ? 'Spremam…' : submitLabel}
        </Button>
        {onDelete ? (
          <ConfirmButton size="lg" onConfirm={() => run(onDelete, { success: 'Obrisano', onDone })}>
            Obriši
          </ConfirmButton>
        ) : null}
      </div>
    </form>
  );
}

// "+ Dodaj" button (or custom trigger) opening a sheet that saves one record.
export function RecordSheet({
  table,
  title,
  fields,
  fixed = {},
  initial,
  id,
  upsertOn,
  revalidate,
  trigger,
  label = 'Dodaj',
  deletable,
  scan,
  proposeTemplate,
}: {
  table: string;
  title: string;
  fields: FieldDef[];
  fixed?: Values;
  initial?: Values;
  id?: string | null;
  upsertOn?: string;
  revalidate: string;
  trigger?: ReactNode;
  label?: string;
  deletable?: boolean;
  scan?: FormScan;
  // A priced template to propose on the job once this record is saved
  // (the going rate for the measurement itself, e.g. "Test akumulatora").
  // Never approved automatically — the owner confirms it in Stavke.
  proposeTemplate?: string;
}) {
  const [open, setOpen] = useState(false);
  const scanTarget = useRef<((data: Record<string, unknown>) => void) | null>(null);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={title}
      action={scan ? <ScanButton kind={scan.kind} label={scan.label} onResult={(data) => scanTarget.current?.(data)} /> : undefined}
      trigger={
        trigger ?? (
          <Button size="sm" variant="secondary">
            <Plus className="size-4" /> {label}
          </Button>
        )
      }
    >
      {open ? (
        <QuickForm
          fields={fields}
          initial={initial}
          draftKey={`${table}:${id ?? JSON.stringify(fixed)}`}
          scan={scan}
          scanTarget={scanTarget}
          onSubmit={async (values) => {
            const result = await saveRecord(table, { ...values, ...fixed }, { id, upsertOn, revalidate });
            const jobId = fixed.job_id;
            if (result.ok && proposeTemplate && typeof jobId === 'string') await proposeTemplateLine(jobId, proposeTemplate);
            return result;
          }}
          onDelete={deletable && id ? () => deleteRecord(table, id, revalidate) : undefined}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </Sheet>
  );
}

// One-tap action on a record (e.g. "Stigao na teren" stamps a time).
export function RecordButton({
  table,
  values,
  id,
  upsertOn,
  revalidate,
  children,
  variant = 'secondary',
  size = 'md',
  success,
  className,
  disabled,
}: {
  table: string;
  values: Values | (() => Promise<Values>);
  id?: string | null;
  upsertOn?: string;
  revalidate: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ok' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  success?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending, run } = useAction();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending || disabled}
      onClick={() =>
        run(async () => saveRecord(table, typeof values === 'function' ? await values() : values, { id, upsertOn, revalidate }), { success })
      }
    >
      {children}
    </Button>
  );
}

export function DeleteRecordButton({ table, id, revalidate, label = 'Obriši' }: { table: string; id: string; revalidate: string; label?: string }) {
  const { run } = useAction();
  return (
    <ConfirmButton size="sm" variant="ghost" onConfirm={() => run(() => deleteRecord(table, id, revalidate), { success: 'Obrisano' })}>
      {label}
    </ConfirmButton>
  );
}

// Owner-only amount (private_amounts) edited in a sheet; workers never get this component.
export function PrivateAmountSheet({
  entity,
  entityId,
  field,
  title,
  amount,
  revalidate,
}: {
  entity: string;
  entityId: string;
  field: string;
  title: string;
  amount: number | null;
  revalidate: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={title}
      trigger={
        <button type="button" className="text-sm font-medium tabular text-accent hover:underline">
          {amount === null ? 'Upiši iznos' : new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(amount)}
        </button>
      }
    >
      {open ? (
        <QuickForm
          fields={[{ name: 'amount', label: 'Iznos', type: 'number', suffix: '€' }]}
          initial={{ amount }}
          onSubmit={(values) => savePrivateAmount(entity, entityId, field, (values.amount as number | null) ?? null, revalidate)}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </Sheet>
  );
}
