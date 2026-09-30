'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Card, CardHeader, Select, buttonClass } from '@/components/ui';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';

const MONTHS = ['siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj', 'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac'];

// One month of issued invoices for the accountant: a ZIP with the invoice
// book (CSV for Excel) and an e-Račun XML per invoice, or just the table.
export function AccountingExport({ perMonth, today }: { perMonth: Record<string, number>; today: string }) {
  const [y, m] = today.split('-').map(Number);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return { key, label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}.` };
  });
  // Early in the month the accountant asks for the previous one.
  const [month, setMonth] = useState(months[Number(today.slice(8, 10)) <= 15 ? 1 : 0].key);
  const count = perMonth[month] ?? 0;
  const href = (format: 'zip' | 'csv') => `/app/business/izvoz?mjesec=${month}&oblik=${format}`;

  return (
    <Card>
      <CardHeader title="Za knjigovođu" subtitle="Izdani računi za jedan mjesec" />
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
            <a href={href('zip')} download className={cn(buttonClass('primary', 'lg'), 'w-full')}>
              <Download className="size-5" /> Paket (ZIP)
            </a>
            <a href={href('csv')} download className={cn(buttonClass('secondary', 'lg'), 'w-full')}>
              <FileSpreadsheet className="size-5" /> Samo tablica
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted">U tom mjesecu nema izdanih računa.</p>
        )}
        <p className="text-xs text-faint">Paket sadrži knjigu računa za Excel i svaki račun kao e-Račun (XML). Pošaljite ga knjigovođi e-mailom ili WhatsAppom.</p>
      </div>
    </Card>
  );
}
