'use client';

import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { ConfirmButton, Sheet, useAction } from '@/components/client-ui';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import type { ActionResult } from '@/lib/action-result';
import { deleteRecord, savePrivateAmount, saveRecord } from '@/lib/actions/records';
import { cn } from '@/lib/utils';

// A small form engine for package records: each module describes its
// fields once and gets a glove-friendly bottom-sheet form for free.

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'date' | 'datetime' | 'checkbox' | 'textarea';
  options?: { value: string; label: string }[];
  suffix?: string;
  placeholder?: string;
  half?: boolean;
  required?: boolean;
}

type Values = Record<string, unknown>;

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
  if (def.type === 'number') {
    const n = Number(text.replace(/\s/g, '').replace(',', '.'));
    return Number.isNaN(n) ? null : n;
  }
  if (def.type === 'datetime') return new Date(text).toISOString();
  return text;
}

export function QuickForm({
  fields,
  initial = {},
  submitLabel = 'Spremi',
  onSubmit,
  onDone,
  onDelete,
}: {
  fields: FieldDef[];
  initial?: Values;
  submitLabel?: string;
  onSubmit: (values: Values) => Promise<ActionResult<unknown>>;
  onDone?: () => void;
  onDelete?: () => Promise<ActionResult<unknown>>;
}) {
  const { pending, run } = useAction();
  const [state, setState] = useState<Record<string, string | boolean>>(() => Object.fromEntries(fields.map((f) => [f.name, toInput(f, initial[f.name])])));
  const missing = fields.some((f) => f.required && (state[f.name] === '' || state[f.name] === undefined));

  return (
    <form
      className="grid grid-cols-2 gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const values = Object.fromEntries(fields.map((f) => [f.name, fromInput(f, state[f.name])]));
        run(() => onSubmit(values), { success: 'Spremljeno', onDone });
      }}
    >
      {fields.map((f) => {
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
          <Field key={f.name} label={`${f.label}${f.required ? '' : ''}`} className={span}>
            {f.type === 'select' ? (
              <Select value={String(state[f.name])} onChange={(e) => set(e.target.value)}>
                <option value="">—</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : f.type === 'textarea' ? (
              <Textarea rows={2} value={String(state[f.name])} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
            ) : (
              <div className="relative">
                <Input
                  type={f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : 'text'}
                  inputMode={f.type === 'number' ? 'decimal' : undefined}
                  value={String(state[f.name])}
                  placeholder={f.placeholder}
                  onChange={(e) => set(e.target.value)}
                  className={cn(f.suffix && 'pr-12', f.type === 'number' && 'tabular')}
                />
                {f.suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">{f.suffix}</span> : null}
              </div>
            )}
          </Field>
        );
      })}
      <div className="col-span-2 flex gap-2 pt-1">
        <Button type="submit" variant="primary" size="lg" className="flex-1" disabled={pending || missing}>
          {submitLabel}
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
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={title}
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
          onSubmit={(values) => saveRecord(table, { ...values, ...fixed }, { id, upsertOn, revalidate })}
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
