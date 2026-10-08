'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAction } from '@/components/client-ui';
import { VideoChip } from '@/components/help/VideoChip';
import { Button, Card, CardHeader, Field, Input, Select, buttonClass } from '@/components/ui';
import { saveAccountant, sendToAccountant } from '@/lib/actions/accountant';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';

const MONTHS = ['siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj', 'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac'];

// One month of issued invoices for the accountant: a ZIP with the invoice
// book (CSV for Excel) and an e-Račun XML per invoice, or just the table.
// With the accountant's address it goes by e-mail, now or by itself on
// the 2nd of every month.
export function AccountingExport({
  perMonth,
  today,
  video,
  accountant,
}: {
  perMonth: Record<string, number>;
  today: string;
  video?: string | null;
  accountant: { email: string | null; auto: boolean; lastSent: string | null };
}) {
  const [y, m] = today.split('-').map(Number);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return { key, label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}.` };
  });
  // Early in the month the accountant asks for the previous one.
  const [month, setMonth] = useState(months[Number(today.slice(8, 10)) <= 15 ? 1 : 0].key);
  const [email, setEmail] = useState(accountant.email ?? '');
  const [auto, setAuto] = useState(accountant.auto);
  const { pending, run } = useAction();
  const count = perMonth[month] ?? 0;
  const href = (format: 'zip' | 'csv') => `/app/business/izvoz?mjesec=${month}&oblik=${format}`;
  const changed = email.trim() !== (accountant.email ?? '') || auto !== accountant.auto;

  return (
    <Card>
      <CardHeader title="Za knjigovođu" subtitle="Izdani računi za jedan mjesec" action={<VideoChip href={video} />} />
      <div className="space-y-3 p-4">
        <Select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mjesec">
          {months.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label} · {perMonth[o.key] ?? 0} {plural(perMonth[o.key] ?? 0, 'račun', 'računa', 'računa')}
            </option>
          ))}
        </Select>
        {count ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {accountant.email ? (
              <Button
                variant="primary"
                size="lg"
                className="w-full sm:col-span-2"
                disabled={pending}
                onClick={() => run(() => sendToAccountant(month), { onDone: (d) => toast.success(`Poslano na ${d?.to}: ${d?.count} ${plural(d?.count ?? 0, 'račun', 'računa', 'računa')}`) })}
              >
                <Send className="size-5" /> Pošalji knjigovođi
              </Button>
            ) : null}
            <a href={href('zip')} download className={cn(buttonClass(accountant.email ? 'secondary' : 'primary', 'lg'), 'w-full')}>
              <Download className="size-5" /> Paket (ZIP)
            </a>
            <a href={href('csv')} download className={cn(buttonClass('secondary', 'lg'), 'w-full')}>
              <FileSpreadsheet className="size-5" /> Samo tablica
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted">U tom mjesecu nema izdanih računa.</p>
        )}
        <p className="text-xs text-faint">Paket sadrži knjigu računa za Excel i svaki račun kao e-Račun (XML).</p>
        <div className="space-y-3 border-t border-line pt-3">
          <Field label="E-mail knjigovođe">
            <Input type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="knjigovodja@primjer.hr" />
          </Field>
          <label className="flex min-h-12 items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 shrink-0 accent-[rgb(var(--accent))]" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            <span>Svakog 2. u mjesecu sam pošalji račune za prošli mjesec</span>
          </label>
          {changed ? (
            <Button variant="secondary" disabled={pending} onClick={() => run(() => saveAccountant({ email, auto }), { success: 'Spremljeno' })}>
              Spremi
            </Button>
          ) : accountant.lastSent ? (
            <p className="text-xs text-muted">Zadnji paket otišao je sam, za {months.find((o) => o.key === accountant.lastSent)?.label ?? accountant.lastSent}</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
