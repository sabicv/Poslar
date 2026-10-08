import type { Metadata } from 'next';
import { WhatsappToggles } from '@/components/settings/WhatsappToggles';
import { BackLink, Badge, Card, CardHeader, PageHeader } from '@/components/ui';
import { WA_TEMPLATES, waEnabled, type WaKind } from '@/config/whatsapp';
import { requireOwner } from '@/lib/session';
import { canMessage, whatsappReady } from '@/lib/whatsapp';

export const metadata: Metadata = { title: 'Poruke mušterijama' };

// Automatske poruke: what Poslar sends to customers on WhatsApp in the
// workshop's name, each one on or off.
export default async function MessagesPage() {
  const ctx = await requireOwner();
  const t = ctx.tenant;
  const ready = whatsappReady();
  const allowed = canMessage(t);
  const body = ctx.pkg.id === 'body';
  const field = ctx.pkg.sector === 'field';
  const place = [t.address, t.city].filter(Boolean).join(', ') || t.name;
  const examples: Record<WaKind, string> = {
    confirm: WA_TEMPLATES.confirm.body.replace('{{1}}', t.name).replace('{{2}}', 'četvrtak, 15. listopada u 9:00').replace('{{3}}', field ? 'Ulica i broj mušterije' : place),
    reminder: WA_TEMPLATES.reminder.body.replace('{{1}}', '9:00').replace('{{2}}', t.name).replace('{{3}}', field ? 'Ulica i broj mušterije' : place),
    ready: WA_TEMPLATES.ready.body.replace('{{1}}', t.name).replace('{{2}}', 'Škoda Octavia ZG-1234-AB'),
    stage: WA_TEMPLATES.stage.body.replace('{{1}}', t.name).replace('{{2}}', 'ZG-1234-AB').replace('{{3}}', 'lakiranje'),
  };
  // "Gotovo" is for a workshop the customer comes back to; stages only for body shops.
  const kinds = (Object.keys(WA_TEMPLATES) as WaKind[])
    .filter((k) => (k !== 'ready' || !field) && (k !== 'stage' || body))
    .map((k) => ({ kind: k, label: WA_TEMPLATES[k].label, hint: WA_TEMPLATES[k].hint, example: examples[k], on: waEnabled(t.settings, k) }));

  return (
    <>
      <PageHeader title="Poruke mušterijama" subtitle="WhatsApp u ime Vaše radionice" back={<BackLink href="/app/settings">Postavke</BackLink>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Automatske poruke" action={<Badge tone={ready && allowed ? 'ok' : 'muted'}>{ready && allowed ? 'Uključeno' : 'Uskoro'}</Badge>} />
          <div className="space-y-3 p-4">
            {!ready ? (
              <p className="text-sm text-muted">Poslar spaja svoj WhatsApp broj. Do tada istu poruku šaljete jednim dodirom iz naloga, sa svog WhatsAppa.</p>
            ) : !allowed ? (
              <p className="text-sm text-muted">U demo verziji i na primjerima poruke se ne šalju.</p>
            ) : null}
            <WhatsappToggles kinds={kinds} />
          </div>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Kako radi" />
          <ul className="list-disc space-y-2 py-4 pl-9 pr-4 text-sm text-muted">
            <li>Poruke stižu s Poslar broja, s imenom Vaše radionice u tekstu.</li>
            <li>Mušterija može odgovoriti. Odgovor i slike koje pošalje stižu u nalog na koji se poruka odnosi.</li>
            <li>Podsjetnik ide navečer prije termina, samo jednom. Promijenite li termin, ide ponovno.</li>
            <li>Poruke se ne naplaćuju posebno. Uključene su u pretplatu.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
