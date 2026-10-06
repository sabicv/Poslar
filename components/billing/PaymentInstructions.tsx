import Link from 'next/link';
import { formatEuro } from '@/lib/format';
import { payee, support } from '@/lib/billing';
import { hub3Svg } from '@/lib/hub3';

const groupIban = (iban: string) => iban.replace(/(.{4})(?=.)/g, '$1 ');

// How to pay the subscription by bank transfer: the slip written out and
// the HUB-3 barcode a bank's app scans. Months: 1, 6 or 12 at once.
export async function PaymentInstructions({
  workshop,
  monthly,
  months,
  linkBase,
}: {
  workshop: { name: string; address: string | null; city: string | null; billingRef: number };
  monthly: number;
  months: number;
  linkBase?: string;
}) {
  const to = payee();
  const help = support();
  if (!to) {
    return (
      <p className="text-sm text-muted">
        Upute za uplatu dobit ćete od podrške Poslara{help.phone ? `: ${help.phone}` : ''}
        {help.email ? `, ${help.email}` : ''}.
      </p>
    );
  }
  const amount = Math.round(monthly * months * 100) / 100;
  const reference = String(workshop.billingRef);
  const description = `Poslar pretplata ${months} mj.`;
  const svg = await hub3Svg({ amount, payerName: workshop.name, payerStreet: workshop.address ?? '', payerCity: workshop.city ?? '', reference, description }, to);
  const rows: [string, string][] = [
    ['Iznos', formatEuro(amount)],
    ['Primatelj', [to.name, to.street, to.city].filter(Boolean).join(', ')],
    ['IBAN', groupIban(to.iban)],
    ['Model i poziv na broj', `HR00 ${reference}`],
    ['Opis', description],
  ];

  return (
    <div className="space-y-4">
      {linkBase ? (
        <div className="flex gap-1.5">
          {[1, 6, 12].map((m) => (
            <Link
              key={m}
              href={`${linkBase}?mj=${m}`}
              scroll={false}
              className={`flex h-9 items-center rounded-full border px-3 text-sm ${m === months ? 'border-accent bg-accent/15 text-fg' : 'border-line text-muted'}`}
            >
              {m === 1 ? '1 mjesec' : `${m} mjeseci`}
            </Link>
          ))}
        </div>
      ) : null}
      <dl className="divide-y divide-line rounded-xl border border-line text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-wrap justify-between gap-x-3 px-3 py-2">
            <dt className="text-muted">{k}</dt>
            <dd className={`text-right font-medium ${k === 'IBAN' || k.startsWith('Model') ? 'font-mono' : ''}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <div>
        <div className="mx-auto max-w-xs overflow-hidden rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-1.5 text-center text-xs text-muted">U aplikaciji svoje banke odaberite „Slikaj i plati” i skenirajte ovaj kod.</p>
      </div>
      <p className="text-xs text-faint">Uplata se upisuje ručno, obično isti ili sljedeći radni dan. Poziv na broj {reference} je samo Vaš, po njemu znamo tko je platio.</p>
    </div>
  );
}
