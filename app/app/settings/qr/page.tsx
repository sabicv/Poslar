import type { Metadata } from 'next';
import { QrControls } from '@/components/intake/QrControls';
import { BackLink, Card, CardHeader, PageHeader } from '@/components/ui';
import { PLANS } from '@/config/plans';
import { qrAllowed } from '@/lib/intake';
import { intakeUrl, qrSvg } from '@/lib/qr';
import { requireOwner } from '@/lib/session';

export const metadata: Metadata = { title: 'QR samoprijem' };

export default async function QrSettingsPage() {
  const ctx = await requireOwner();
  const t = ctx.tenant;
  const allowed = qrAllowed(t);
  const url = await intakeUrl(t.intake_token);
  const svg = allowed ? await qrSvg(url) : null;
  const field = ctx.pkg.sector === 'field';

  return (
    <>
      <PageHeader title="QR samoprijem" subtitle={field ? 'Mušterija skenira kod i zatraži dolazak' : 'Mušterija na vratima skenira kod i sama prijavi kvar'} back={<BackLink href="/app/settings">Postavke</BackLink>} />
      {!allowed ? (
        <Card>
          <div className="space-y-2 p-4 text-sm">
            <p className="font-medium">QR samoprijem dolazi uz pakete Standard ({PLANS.standard.price} €) i Premium ({PLANS.premium.price} €).</p>
            <p className="text-muted">Za promjenu paketa javite se kroz „Javi problem” u Postavkama.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Vaš kod" subtitle="Isti kod vrijedi dok ne napravite novi" />
            <div className="space-y-3 p-4">
              <div className="mx-auto w-56 overflow-hidden rounded-2xl bg-white p-3" dangerouslySetInnerHTML={{ __html: svg ?? '' }} />
              <p className="break-all text-center font-mono text-xs text-muted">{url}</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Kako radi" />
            <div className="space-y-4 p-4">
              <ol className="list-inside list-decimal space-y-1 text-sm text-muted">
                <li>Mušterija skenira kod kamerom mobitela.</li>
                <li>{field ? 'Upiše adresu' : 'Slika prometnu ili upiše registraciju'}, izgovori što ne radi i ostavi broj.</li>
                <li>Nalog stiže u Prijem s oznakom „S vrata”. Vi je nazovete.</li>
              </ol>
              <QrControls url={url} enabled={t.intake_enabled} />
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
