'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, KeyRound, MessageCircle, Settings2, Wallet } from 'lucide-react';
import { Sheet, useAction } from '@/components/client-ui';
import { Button, Field, Input, Select, Textarea, buttonClass } from '@/components/ui';
import { copyText } from '@/lib/clipboard';
import { whatsappLink } from '@/lib/contact';
import { PLANS, TERM_LABELS, type BillingTerm, type PlanId } from '@/config/plans';
import { PACKAGES, type PackageId } from '@/config/tenant.config';
import { adminDeleteWorkshop, adminExtendTrial, adminRecordPayment, adminResetPassword, adminSetPackage, adminSetPhoneAgent, adminSetStatus, adminUpdateSubscription } from '@/lib/actions/admin';

export interface WorkshopSheetData {
  id: string;
  name: string;
  status: 'trial' | 'active' | 'suspended';
  pkg: PackageId;
  statusNote: string | null;
  plan: PlanId;
  term: BillingTerm;
  paidUntil: string | null;
  notes: string | null;
  aiScan: number;
  aiCopilot: number;
  monthly: number;
  payments: { id: string; amount: number; months: number; paid_on: string; note: string | null }[];
  // Shared demo workshops are never deleted.
  demo: boolean;
  staff: { id: string; name: string; role: string; email: string | null; phone: string | null }[];
  phone: { numberId: string; number: string; calls: number; minutes: number };
}

// The workshop's AI phone number at Vapi; empty switches it off.
function PhoneAgent({ id, phone }: { id: string; phone: WorkshopSheetData['phone'] }) {
  const { pending, run } = useAction();
  const [v, setV] = useState({ numberId: phone.numberId, number: phone.number });
  return (
    <section className="space-y-3 border-t border-line pt-4">
      <p className="font-semibold">AI telefon</p>
      <p className="text-xs text-muted">
        {phone.numberId ? `Uključen. Ovaj mjesec: ${phone.calls} poziva, ${phone.minutes} min.` : 'Isključen. Upišite broj iz Vapija (docs/VAPI.md).'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vapi ID broja">
          <Input value={v.numberId} onChange={(e) => setV((s) => ({ ...s, numberId: e.target.value }))} placeholder="Phone Numbers → ID" />
        </Field>
        <Field label="Broj za preusmjeravanje">
          <Input value={v.number} onChange={(e) => setV((s) => ({ ...s, number: e.target.value }))} placeholder="+385 1 234 5678" inputMode="tel" />
        </Field>
      </div>
      <Button className="w-full" disabled={pending} onClick={() => run(() => adminSetPhoneAgent(id, v.numberId, v.number), { success: v.numberId ? 'AI telefon spremljen' : 'AI telefon isključen' })}>
        Spremi AI telefon
      </Button>
    </section>
  );
}

// Someone forgot the password: a new one, shown once, sent on WhatsApp.
function NewPassword({ person }: { person: WorkshopSheetData['staff'][number] }) {
  const { pending, run } = useAction();
  const [password, setPassword] = useState<string | null>(null);
  const message = (p: string) =>
    `Pozdrav, nova lozinka za TaktiX: ${p}\nPrijava: ${window.location.origin}/login${person.email ? `\nE-mail: ${person.email}` : ''}\nLozinku možete promijeniti u Postavke → Moj račun → Promijeni lozinku.`;
  return (
    <li className="space-y-2 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {person.name} <span className="text-xs font-normal text-faint">{person.role === 'owner' ? 'voditelj' : 'radnik'}</span>
          </span>
          <span className="block truncate text-xs text-muted">{[person.email, person.phone].filter(Boolean).join(' · ')}</span>
        </span>
        <Button size="sm" disabled={pending} onClick={() => run(() => adminResetPassword(person.id), { success: 'Nova lozinka postavljena', onDone: (d) => d && setPassword(d.password) })}>
          <KeyRound className="size-4" /> Nova lozinka
        </Button>
      </div>
      {password ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2">
          <span className="font-mono text-base tracking-wide">{password}</span>
          <span className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => copyText(message(password)).then((ok) => (ok ? toast.success('Poruka kopirana') : toast.error('Kopiranje nije uspjelo')))}>
              <Copy className="size-4" /> Kopiraj
            </Button>
            {person.phone ? (
              <a href={whatsappLink(person.phone, message(password))} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'sm')}>
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            ) : null}
          </span>
        </div>
      ) : null}
    </li>
  );
}

const digits = (v: string) => v.replace(/[^0-9]/g, '');
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

// Everything about one workshop's subscription in one sheet: status,
// payments, plan, AI quota, internal notes and the trade.
export function WorkshopSheet({ w }: { w: WorkshopSheetData }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(w.statusNote ?? '');
  const [pack, setPack] = useState(w.pkg);
  const [sub, setSub] = useState({ plan: w.plan, term: w.term, paidUntil: w.paidUntil ?? '', notes: w.notes ?? '', aiScan: String(w.aiScan), aiCopilot: String(w.aiCopilot) });
  const [pay, setPay] = useState({ amount: String(w.monthly), months: '1', note: '' });
  const [confirm, setConfirm] = useState('');
  const router = useRouter();
  // A payment or another change elsewhere moves the date: the form follows,
  // so "Spremi pretplatu" never writes an old date back.
  useEffect(() => setSub((v) => ({ ...v, paidUntil: w.paidUntil ?? '' })), [w.paidUntil]);

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={w.name}
      trigger={
        <Button size="sm" variant="secondary">
          <Settings2 className="size-4" /> Uredi
        </Button>
      }
    >
      <div className="space-y-6">
        <section className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Button variant={w.status === 'active' ? 'ok' : 'secondary'} disabled={pending} onClick={() => run(() => adminSetStatus(w.id, 'active', null), { success: 'Aktivirano' })}>
              Aktiviraj
            </Button>
            <Button disabled={pending} onClick={() => run(() => adminExtendTrial(w.id, 14), { success: 'Proba produljena 14 dana' })}>
              +14 d probe
            </Button>
            <Button variant="danger" disabled={pending || w.status === 'suspended'} onClick={() => run(() => adminSetStatus(w.id, 'suspended', reason), { success: 'Radionica isključena' })}>
              Isključi
            </Button>
          </div>
          <Field label="Razlog isključenja (radionica ga ne vidi)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="npr. neplaćena pretplata za rujan" />
          </Field>
        </section>

        {!w.demo && w.staff.length ? (
          <section className="space-y-2 border-t border-line pt-4">
            <p className="font-semibold">Ljudi i lozinke</p>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {w.staff.map((p) => (
                <NewPassword key={p.id} person={p} />
              ))}
            </ul>
            <p className="text-xs text-faint">Nova lozinka odmah zamjenjuje staru. Pošaljite je osobi i recite joj da je promijeni.</p>
          </section>
        ) : null}

        <section className="space-y-3 border-t border-line pt-4">
          <p className="font-semibold">Uplata</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Iznos (€)">
              <Input inputMode="decimal" value={pay.amount} onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))} />
            </Field>
            <Field label="Za mjeseci">
              <Input inputMode="numeric" value={pay.months} onChange={(e) => setPay((p) => ({ ...p, months: digits(e.target.value) }))} />
            </Field>
            <Field label="Napomena" className="col-span-2">
              <Input value={pay.note} onChange={(e) => setPay((p) => ({ ...p, note: e.target.value }))} placeholder="npr. uplata na račun, poziv na broj" />
            </Field>
          </div>
          <Button
            variant="primary"
            className="w-full"
            disabled={pending || !pay.amount || !pay.months}
            onClick={() =>
              run(() => adminRecordPayment(w.id, num(pay.amount) ?? 0, Number(pay.months), pay.note), {
                success: 'Uplata upisana, „plaćeno do” pomaknuto',
                onDone: (data) => {
                  if (data) setSub((v) => ({ ...v, paidUntil: data.paidUntil }));
                  setPay((p) => ({ ...p, note: '' }));
                },
              })
            }
          >
            <Wallet className="size-4" /> Upiši uplatu
          </Button>
          {w.payments.length ? (
            <ul className="divide-y divide-line rounded-xl border border-line text-sm">
              {w.payments.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-xs text-faint">{p.paid_on.split('-').reverse().join('. ')}.</span>
                  <span className="tabular">{p.amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })} €</span>
                  <span className="text-xs text-muted">{p.months} mj.</span>
                  {p.note ? <span className="truncate text-xs text-faint">{p.note}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="space-y-3 border-t border-line pt-4">
          <p className="font-semibold">Pretplata</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Paket">
              <Select
                value={sub.plan}
                onChange={(e) => {
                  const plan = e.target.value as PlanId;
                  setSub((v) => ({ ...v, plan, aiScan: String(PLANS[plan].ai.scan), aiCopilot: String(PLANS[plan].ai.copilot) }));
                }}
              >
                {Object.values(PLANS).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.price} €
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Plaćanje">
              <Select value={sub.term} onChange={(e) => setSub((v) => ({ ...v, term: e.target.value as BillingTerm }))}>
                {Object.entries(TERM_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Plaćeno do" className="col-span-2">
              <Input type="date" value={sub.paidUntil} onChange={(e) => setSub((v) => ({ ...v, paidUntil: e.target.value }))} />
            </Field>
            <Field label="Slikanja mjesečno">
              <Input inputMode="numeric" value={sub.aiScan} onChange={(e) => setSub((v) => ({ ...v, aiScan: digits(e.target.value) }))} />
            </Field>
            <Field label="Kopilot mjesečno">
              <Input inputMode="numeric" value={sub.aiCopilot} onChange={(e) => setSub((v) => ({ ...v, aiCopilot: digits(e.target.value) }))} />
            </Field>
            <Field label="Bilješke (samo Toranj)" className="col-span-2">
              <Textarea rows={3} value={sub.notes} onChange={(e) => setSub((v) => ({ ...v, notes: e.target.value }))} placeholder="npr. dogovor na sajmu, zvati nakon 15 h" />
            </Field>
          </div>
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              run(() => adminUpdateSubscription(w.id, { plan: sub.plan, term: sub.term, paidUntil: sub.paidUntil || null, notes: sub.notes, aiScan: num(sub.aiScan), aiCopilot: num(sub.aiCopilot) }), {
                success: 'Pretplata spremljena',
              })
            }
          >
            Spremi pretplatu
          </Button>
        </section>

        {/* Also on a demo workshop: that is where the first test call goes. */}
        <PhoneAgent id={w.id} phone={w.phone} />

        <section className="border-t border-line pt-4">
          <Field label="Zanat" hint="Promjena zanata mijenja izbornike i obrasce. Podaci ostaju.">
            <div className="flex gap-2">
              <Select value={pack} onChange={(e) => setPack(e.target.value as PackageId)}>
                {Object.values(PACKAGES).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.product}
                  </option>
                ))}
              </Select>
              <Button disabled={pending || pack === w.pkg} onClick={() => run(() => adminSetPackage(w.id, pack), { success: 'Zanat promijenjen' })}>
                Promijeni
              </Button>
            </div>
          </Field>
          <p className="mt-3 text-xs text-faint">Isključena radionica ne vidi ništa, ali se podaci ne brišu. Aktivacijom se sve vraća.</p>
        </section>

        {/* Deletion on request, or a year after the subscription ended (privacy policy). */}
        {!w.demo ? (
          <section className="space-y-3 border-t border-line pt-4">
            <p className="font-semibold text-crit">Brisanje</p>
            <p className="text-xs text-muted">Briše radionicu, sve njezine naloge, mušterije i fotografije te prijave njezinih ljudi. Ne može se vratiti.</p>
            <Field label="Za potvrdu upišite naziv radionice">
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={w.name} />
            </Field>
            <Button
              variant="danger"
              className="w-full"
              disabled={pending || confirm.trim() !== w.name}
              onClick={() =>
                run(() => adminDeleteWorkshop(w.id, confirm), {
                  success: 'Radionica obrisana',
                  onDone: () => {
                    setOpen(false);
                    router.refresh();
                  },
                })
              }
            >
              Obriši radionicu i sve podatke
            </Button>
          </section>
        ) : null}
      </div>
    </Sheet>
  );
}
