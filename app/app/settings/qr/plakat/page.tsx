import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PrintButton } from '@/components/intake/QrControls';
import { BackLink } from '@/components/ui';
import { qrAllowed } from '@/lib/intake';
import { intakeUrl, qrSvg } from '@/lib/qr';
import { requireOwner } from '@/lib/session';

export const metadata: Metadata = { title: 'Plakat' };

// An A4 poster for the door: big code, three steps, the workshop's phone.
// The app's bars hide when printing.
export default async function QrPosterPage() {
  const ctx = await requireOwner();
  const t = ctx.tenant;
  if (!qrAllowed(t)) redirect('/app/settings/qr');
  const url = await intakeUrl(t.intake_token);
  const svg = await qrSvg(url);
  const field = ctx.pkg.sector === 'field';
  const steps = field
    ? ['Skenirajte kod kamerom mobitela', 'Upišite adresu i recite što trebate', 'Javljamo se s terminom']
    : ['Skenirajte kod kamerom mobitela', 'Slikajte prometnu i recite što ne radi', 'Majstor Vas zove, ne morate čekati'];

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <BackLink href="/app/settings/qr">QR samoprijem</BackLink>
        <PrintButton />
      </div>
      <article className="mx-auto flex aspect-[1/1.414] w-full max-w-[640px] flex-col items-center justify-between rounded-2xl bg-white p-[6%] text-center text-[#0B1120] shadow-lg print:max-w-none print:rounded-none print:shadow-none">
        <div>
          <p className="text-[clamp(14px,2.6vw,20px)] font-semibold uppercase tracking-widest text-[#475569]">{t.name}</p>
          <h1 className="mt-2 font-display text-[clamp(30px,7vw,56px)] font-bold leading-none">{field ? 'Trebate majstora?' : 'Prijavite kvar bez čekanja'}</h1>
        </div>
        <div className="w-[55%] min-w-[180px]" dangerouslySetInnerHTML={{ __html: svg }} />
        <ol className="grid w-full gap-2 text-left text-[clamp(13px,2.4vw,20px)]">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <span className="flex size-[1.8em] shrink-0 items-center justify-center rounded-full bg-[#0B1120] font-bold text-white">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <p className="text-[clamp(12px,2.2vw,18px)] text-[#475569]">{t.phone ? `Ili nazovite ${t.phone}` : 'Kamera mobitela prepoznaje kod sama'}</p>
      </article>
    </>
  );
}
