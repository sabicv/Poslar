'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Copy, FileText, Link2, MessageCircle, Plus, Send } from 'lucide-react';
import { ConfirmButton, DictateButton, MoreToggle, Segmented, Sheet, useAction } from '@/components/client-ui';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Textarea, buttonClass } from '@/components/ui';
import { invoiceTotals, lineAmount } from '@/components/invoice/InvoiceDocument';
import type { LineKind } from '@/config/tenant.config';
import { addLine, applyTemplate, createApproval, deleteLine, setLineApproval, setLinePrice, updateLine } from '@/lib/actions/jobs';
import { copyText } from '@/lib/clipboard';
import { formatDateTime, formatEuro } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Approval, JobLine, LineApproval, LinePriority } from '@/types/db';

type Price = { unit_price: number; discount_pct: number; vat_rate: number };

const KIND_LABELS: Record<LineKind, string> = {
  labor: 'Rad',
  part: 'Dio',
  material: 'Materijal',
  package: 'Paket',
  sublet: 'Vanjska usluga',
  fee: 'Naknada',
};

const PRIORITY: Record<LinePriority, { label: string; tone: 'crit' | 'warn' | 'muted' }> = {
  urgent: { label: 'Hitno', tone: 'crit' },
  recommended: { label: 'Preporučeno', tone: 'warn' },
  optional: { label: 'Po želji', tone: 'muted' },
};

const APPROVAL_LABELS: Record<LineApproval, string> = {
  approved: 'Odobreno',
  proposed: 'Čeka odobrenje',
  declined: 'Odbijeno',
  deferred: 'Odgođeno',
};

const net = (qty: number, p?: Price) => (p ? lineAmount({ description: '', qty, unit: '', ...p }) : 0);
const num = (value: string) => Number(value.replace(/\s/g, '').replace(',', '.'));

export function LinesEditor({
  jobId,
  lines,
  prices,
  templates,
  isOwner,
  locked,
  approval,
  appUrl,
  clientPhone,
  vatRegistered,
}: {
  jobId: string;
  lines: JobLine[];
  prices: Record<string, Price>;
  templates: { code: string; name: string }[];
  isOwner: boolean;
  locked: boolean;
  approval: Approval | null;
  appUrl: string;
  clientPhone: string | null;
  vatRegistered: boolean;
}) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState<JobLine | null>(null);
  const [adding, setAdding] = useState(false);
  const [saves, setSaves] = useState(0);
  const [template, setTemplate] = useState('');
  const [link, setLink] = useState<string | null>(null);

  const groups: { title: string; approval: LineApproval[] }[] = [
    { title: 'Radovi i dijelovi', approval: ['approved'] },
    { title: 'Predloženo stranci', approval: ['proposed'] },
    { title: 'Odbijeno ili odgođeno', approval: ['declined', 'deferred'] },
  ];

  const approved = lines.filter((l) => l.approval === 'approved');
  // The same sums as on the invoice, cent for cent.
  const totals = invoiceTotals(
    approved.filter((l) => prices[l.id]).map((l) => ({ description: l.description, qty: Number(l.qty), unit: l.unit, ...prices[l.id] })),
    vatRegistered
  );
  const proposedCount = lines.filter((l) => l.approval === 'proposed').length;
  const origin = appUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  function sendApproval() {
    run(() => createApproval(jobId), {
      onDone: (data) => {
        if (data?.token) setLink(`${origin}/approve/${data.token}`);
      },
    });
  }

  return (
    <div className="space-y-4">
      {lines.length === 0 ? (
        <EmptyState title="Nalog još nema stavki" action={!locked ? <Button variant="primary" onClick={() => setAdding(true)}><Plus className="size-4" /> Dodaj stavku</Button> : undefined}>
          Dodajte rad, dijelove i materijal ili odaberite gotov predložak.
        </EmptyState>
      ) : (
        groups.map((group) => {
          const rows = lines.filter((l) => group.approval.includes(l.approval));
          if (!rows.length) return null;
          return (
            <Card key={group.title}>
              <CardHeader title={group.title} />
              <ul className="divide-y divide-line">
                {rows.map((line) => (
                  <li key={line.id}>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => setEditing(line)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface2 disabled:hover:bg-transparent"
                    >
                      <span className="mt-0.5 w-16 shrink-0 text-xs text-faint">{KIND_LABELS[line.kind]}</span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-sm', line.approval === 'declined' && 'text-muted line-through')}>{line.description}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          {Number(line.qty) === 1 && line.unit === 'paušal' ? null : (
                            <span className="tabular">
                              {Number(line.qty).toLocaleString('hr-HR')} {line.unit}
                            </span>
                          )}
                          {line.priority ? <Badge tone={PRIORITY[line.priority].tone}>{PRIORITY[line.priority].label}</Badge> : null}
                          {line.source === 'inspection' ? <Badge tone="muted">Iz inspekcije</Badge> : null}
                          {line.approval === 'deferred' ? <Badge tone="muted">Odgođeno</Badge> : null}
                        </span>
                      </span>
                      {isOwner ? (
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-medium tabular">{prices[line.id] ? formatEuro(net(Number(line.qty), prices[line.id])) : '-'}</span>
                          {/* Unit price only when it differs from the line amount. */}
                          {!prices[line.id] ? (
                            <span className="block text-xs text-warn">bez cijene</span>
                          ) : Number(line.qty) !== 1 || Number(prices[line.id].discount_pct) ? (
                            <span className="block text-xs text-faint tabular">
                              {formatEuro(prices[line.id].unit_price)} / {line.unit}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </button>
                    {isOwner && line.approval === 'proposed' && !locked ? (
                      <div className="flex gap-2 px-4 pb-3 pl-[5.75rem]">
                        <Button size="sm" variant="ok" disabled={pending} onClick={() => run(() => setLineApproval(jobId, line.id, 'approved'))}>
                          Odobreno
                        </Button>
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setLineApproval(jobId, line.id, 'declined'))}>
                          Odbijeno
                        </Button>
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setLineApproval(jobId, line.id, 'deferred'))}>
                          Kasnije
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}

      {isOwner && lines.length > 0 ? (
        <Card className="space-y-1.5 p-4 text-sm">
          {vatRegistered ? (
            <>
              <div className="flex justify-between text-muted">
                <span>Osnovica (odobreno)</span>
                <span className="tabular">{formatEuro(totals.net)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>PDV</span>
                <span className="tabular">{formatEuro(totals.vat)}</span>
              </div>
            </>
          ) : null}
          <div className={cn('flex justify-between text-base font-semibold', vatRegistered && 'border-t border-line pt-2')}>
            <span>{vatRegistered ? 'Ukupno' : 'Ukupno (odobreno)'}</span>
            <span className="tabular">{formatEuro(totals.gross)}</span>
          </div>
          <Link href={`/app/jobs/${jobId}/racun`} prefetch={false} className={cn(buttonClass('primary', 'lg'), 'mt-3 w-full')}>
            <FileText className="size-5" /> Račun
          </Link>
        </Card>
      ) : null}

      {!locked ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Dodaj stavku
          </Button>
          {templates.length ? (
            <div className="flex min-w-0 flex-1 gap-2 sm:flex-none">
              <Select value={template} onChange={(e) => setTemplate(e.target.value)} className="min-w-0 sm:w-64">
                <option value="">Predložak…</option>
                {templates.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Button disabled={!template || pending} onClick={() => run(() => applyTemplate(jobId, template), { success: 'Predložak dodan', onDone: () => setTemplate('') })}>
                Dodaj
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">Nalog je zaključan. Stavke se više ne mogu mijenjati.</p>
      )}

      {isOwner ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Odobrenje stranke putem poveznice</p>
              <p className="text-xs text-muted">
                {approval
                  ? approval.status === 'decided'
                    ? `Odlučeno ${formatDateTime(approval.decided_at)} · ${approval.signer_name ?? ''}`
                    : approval.status === 'viewed'
                      ? `Stranka je otvorila ${formatDateTime(approval.viewed_at)}`
                      : approval.status === 'expired'
                        ? 'Prethodna poveznica je istekla'
                        : `Poslano ${formatDateTime(approval.sent_at)}`
                  : 'Stranka vidi predložene stavke s cijenama i odobrava ih jednim dodirom.'}
              </p>
            </div>
            <Button variant="secondary" disabled={pending || proposedCount === 0 || locked} onClick={sendApproval}>
              <Send className="size-4" /> {proposedCount ? `Pošalji (${proposedCount})` : 'Nema prijedloga'}
            </Button>
          </div>
          {link ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-xs">
                <Link2 className="size-4 shrink-0 text-accent" />
                <span className="truncate font-mono">{link}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => copyText(link).then((ok) => (ok ? toast.success('Poveznica kopirana') : toast.error('Kopiranje nije uspjelo. Označite poveznicu i kopirajte.')))}>
                  <Copy className="size-4" /> Kopiraj
                </Button>
                <a
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface2 px-3 text-sm"
                  href={`https://wa.me/${(clientPhone ?? '').replace(/[^\d]/g, '').replace(/^0/, '385')}?text=${encodeURIComponent(`Poštovani, molimo pregledajte i odobrite predložene radove: ${link}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* The key changes only after a save, so a sheet closed by accident
          keeps what was typed into it. */}
      <LineSheet
        key={`${editing?.id ?? 'new'}-${saves}`}
        open={adding || editing !== null}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSaved={() => setSaves((n) => n + 1)}
        jobId={jobId}
        line={editing}
        price={editing ? prices[editing.id] : undefined}
        isOwner={isOwner}
        vatRegistered={vatRegistered}
      />
    </div>
  );
}

function LineSheet({
  open,
  onClose,
  onSaved,
  jobId,
  line,
  price,
  isOwner,
  vatRegistered,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  jobId: string;
  line: JobLine | null;
  price?: Price;
  isOwner: boolean;
  vatRegistered: boolean;
}) {
  const { pending, run } = useAction();
  const [kind, setKind] = useState<LineKind>(line?.kind ?? 'labor');
  const [description, setDescription] = useState(line?.description ?? '');
  const [qty, setQty] = useState(String(line?.qty ?? 1));
  const [unit, setUnit] = useState(line?.unit ?? 'h');
  const [approval, setApproval] = useState<LineApproval>(line?.approval ?? 'approved');
  const [priority, setPriority] = useState<LinePriority | ''>(line?.priority ?? '');
  const [unitPrice, setUnitPrice] = useState(price ? String(price.unit_price) : '');
  const [discount, setDiscount] = useState(price ? String(price.discount_pct) : '0');
  const [vat, setVat] = useState(price ? String(price.vat_rate) : '25');
  // Core: kind, what, how many, price. Unit, discount, VAT and the customer
  // approval flow: "Više polja" (open when a line already uses them).
  const defaultUnit = (k: LineKind) => (k === 'labor' ? 'h' : k === 'material' ? 'l' : 'kom');
  const [more, setMore] = useState(() => Boolean(line && line.unit !== defaultUnit(line.kind)) || Boolean(price && (Number(price.discount_pct) !== 0 || Number(price.vat_rate) !== 25)));

  function saved() {
    onSaved();
    onClose();
  }

  function save() {
    const values = { kind, description, qty: num(qty) || 0, unit: unit || 'kom', approval, priority: priority || null };
    const priceValues = unitPrice !== '' ? { unit_price: num(unitPrice) || 0, discount_pct: num(discount) || 0, vat_rate: num(vat) || 0 } : undefined;
    if (line) {
      run(
        async () => {
          const result = await updateLine(jobId, line.id, values);
          if (!result.ok || !isOwner || !priceValues) return result;
          return setLinePrice(jobId, line.id, priceValues);
        },
        { success: 'Spremljeno', onDone: saved }
      );
    } else {
      run(() => addLine(jobId, values, isOwner ? priceValues : undefined), { success: 'Stavka dodana', onDone: saved });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={line ? 'Uredi stavku' : 'Nova stavka'}>
      <div className="space-y-4">
        <Segmented
          value={kind}
          onChange={(k) => {
            setKind(k);
            if (!line) setUnit(defaultUnit(k));
          }}
          options={(['labor', 'part', 'material', 'fee'] as LineKind[]).map((k) => ({ value: k, label: KIND_LABELS[k] }))}
        />
        <Field label="Opis">
          <div className="flex items-start gap-2">
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} autoFocus={!line} />
            <DictateButton compact onText={(text) => setDescription((d) => (d ? `${d.trimEnd()} ${text}` : text))} />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Količina (${unit})`}>
            <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          {isOwner ? (
            <Field label="Cijena / jed. (€)">
              <Input inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0,00" />
            </Field>
          ) : null}
        </div>
        {more ? (
        <>
        <div className={cn('grid gap-3', isOwner && vatRegistered ? 'grid-cols-3' : 'grid-cols-2')}>
          <Field label="Jedinica">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {['h', 'kom', 'l', 'kg', 'g', 'm', 'paušal', 'set'].map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
          {isOwner ? (
            <>
              <Field label="Popust %">
                <Input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </Field>
              {/* Outside the VAT system there is no rate to choose. */}
              {vatRegistered ? (
                <Field label="PDV %">
                  <Input inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} />
                </Field>
              ) : null}
            </>
          ) : null}
        </div>
        </>
        ) : null}
        {/* Always in view: whether it is being done or first offered to the customer. */}
        <Field label="Status">
          <Segmented
            value={approval}
            onChange={setApproval}
            options={[
              { value: 'approved', label: 'Radi se', tone: 'ok' },
              { value: 'proposed', label: 'Predloži', tone: 'warn' },
              { value: 'declined', label: 'Odbijeno', tone: 'neutral' },
            ]}
          />
        </Field>
        {approval === 'proposed' ? (
          <>
          <p className="-mt-2 text-xs text-muted">Mušterija dobije poveznicu i sama odobri ili odbije stavku jednim dodirom; odluka se ovdje upiše sama.</p>
          <Field label="Važnost">
            <Segmented
              value={priority || null}
              onChange={(p) => setPriority(p)}
              options={[
                { value: 'urgent', label: 'Hitno', tone: 'crit' },
                { value: 'recommended', label: 'Preporučeno', tone: 'warn' },
                { value: 'optional', label: 'Po želji', tone: 'neutral' },
              ]}
            />
          </Field>
          </>
        ) : null}
        <MoreToggle open={more} onToggle={() => setMore((m) => !m)} />
        <div className="flex gap-2 pt-2">
          <Button variant="primary" size="lg" className="flex-1" disabled={pending || !description.trim()} onClick={save}>
            Spremi
          </Button>
          {line ? (
            <ConfirmButton size="lg" onConfirm={() => run(() => deleteLine(jobId, line.id), { success: 'Obrisano', onDone: onClose })}>
              Obriši
            </ConfirmButton>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
