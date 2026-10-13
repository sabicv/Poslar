import type { Metadata } from 'next';
import Link from 'next/link';
import { LogOut, PlayCircle } from 'lucide-react';
import { signOut } from '@/lib/actions/auth';
import { VideoChip } from '@/components/help/VideoChip';
import { SupportButton } from '@/components/SupportButton';
import { ReferralShare } from '@/components/billing/ReferralShare';
import { SupportWhatsApp } from '@/components/SupportWhatsApp';
import { DailySummaryControls } from '@/components/settings/DailySummaryControls';
import { DeleteAccount } from '@/components/settings/DeleteAccount';
import { Fold } from '@/components/Fold';
import { Badge, Card, CardHeader, KeyValue, NavRow, PageHeader } from '@/components/ui';
import { HELP_TOPICS } from '@/config/help';
import { LEGAL_PAGES } from '@/config/legal';
import { AI_LABELS, TERM_LABELS, aiQuota, getPlan, monthlyPrice } from '@/config/plans';
import { aiUsageThisMonth } from '@/lib/ai-usage';
import { loadHelpVideos } from '@/lib/help';
import { isPlayApp } from '@/lib/play';
import { hasModule } from '@/config/tenant.config';
import { formatDate, plural } from '@/lib/format';
import { appOrigin } from '@/lib/qr';
import { isPlatformAdmin, requireWorkshop } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { isGuestTenant } from '@/lib/guest';
import { myWorkshops } from '@/lib/workshops';
import type { Profile } from '@/types/db';
import { billingFrom } from '@/components/invoice/InvoiceDocument';
import { BillingForm, LogoUpload, ModuleToggles, ProfileForm, TeamManager, ThemeToggle, WorkshopForm } from './SettingsForms';

export const metadata: Metadata = { title: 'Postavke' };

const MODULE_LABELS: Record<string, string> = {
  dvi: 'Pregled u točkama (DVI)',
  field_visits: 'Rad na terenu: lokacije, raspored, poruka „Na putu”, izvještaj za klijenta',
  condition_report: 'Zapisnik o stanju pri prijemu',
  approvals: 'Odobrenje stranke putem poveznice',
  service_plan: 'Servisni plan vozila',
  parts: 'Dijelovi i dobavljači',
  wheel_hotel: 'Hotel za gume',
};

// Workshops that signed up through this one's link, read past RLS: the
// owner only ever sees the two counts, never the other workshops' names.
async function loadReferral(tenantId: string, billingRef: number) {
  const { data } = await createAdminClient().from('tenants').select('referral_rewarded_at').eq('referred_by', tenantId);
  return {
    link: `${await appOrigin()}/register?ref=${billingRef}`,
    joined: (data ?? []).length,
    paid: (data ?? []).filter((r) => r.referral_rewarded_at).length,
  };
}

export default async function SettingsPage() {
  const ctx = await requireWorkshop();
  const t = ctx.tenant;
  const [{ data: staff }, { data: tickets }, scans, answers, tower, links, play, workshops] = await Promise.all([
    ctx.isOwner ? ctx.supabase.from('profiles').select('*').order('created_at') : Promise.resolve({ data: [] }),
    ctx.supabase.from('support_tickets').select('id, tenant_unread'),
    ctx.isOwner ? aiUsageThisMonth(t, 'scan') : Promise.resolve(0),
    ctx.isOwner ? aiUsageThisMonth(t, 'copilot') : Promise.resolve(0),
    isPlatformAdmin(),
    loadHelpVideos(),
    isPlayApp(),
    myWorkshops(ctx),
  ]);
  // How-to videos that have a link; a worker skips the owner's screens.
  const videos = HELP_TOPICS.filter((h) => links[h.id] && (ctx.isOwner || !h.owner)).map((h) => ({ ...h, url: links[h.id] }));
  const plan = getPlan(t.plan);
  const unread = (tickets ?? []).filter((x) => x.tenant_unread).length;
  // The owner's own link for colleagues (not in the shared demo workshops).
  const isDemo = (t.settings as { demo?: unknown } | null)?.demo === true;
  const referral = ctx.isOwner && !isDemo ? await loadReferral(t.id, t.billing_ref) : null;
  const place = ctx.pkg.sector === 'field' ? 'Servis' : 'Radionica';

  const account = (
    <div className="space-y-4">
      {tower ? (
        <Card className="border-accent/50 bg-accent/10">
          <NavRow href="/admin" title="Toranj" subtitle="Radionice, pretplate, podrška i greške" />
        </Card>
      ) : null}
      <h2 className="px-1 type-kicker">Račun</h2>
      <Card>
        <CardHeader title="Moj račun" subtitle={ctx.user.email} />
        <div className="space-y-5 p-4">
          <ProfileForm
            fullName={ctx.profile.full_name ?? ''}
            phone={ctx.profile.phone ?? ''}
            fgasCertificate={hasModule(ctx.pkg, ctx.tenant.enabled_modules, 'fgas') ? (ctx.profile.fgas_certificate ?? '') : undefined}
          />
        </div>
        <Fold plain title="Izgled" summary="Svijetlo ili tamno">
          <div className="p-4">
            <ThemeToggle />
          </div>
        </Fold>
        {!isDemo ? (
          <Fold plain title="Lozinka i brisanje" summary="Promjena lozinke ili zahtjev za brisanje">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
              <Link href="/nova-lozinka" className="font-medium text-accent hover:underline">
                Promijeni lozinku
              </Link>
              <DeleteAccount owner={ctx.isOwner} />
            </div>
          </Fold>
        ) : null}
        <div className="border-t border-line px-4 py-3 text-sm">
          <form action={signOut}>
            <button type="submit" className="inline-flex min-h-12 items-center gap-2 font-medium text-muted hover:text-fg">
              <LogOut className="size-4" />
              Odjava
            </button>
          </form>
        </div>
      </Card>
    </div>
  );

  const billing = ctx.isOwner ? (
    <div className="space-y-4">
      <h2 className="px-1 type-kicker">Pretplata</h2>
      <Card>
        <div className="divide-y divide-line px-4">
          <KeyValue label="Zanat">{ctx.pkg.product}</KeyValue>
          <KeyValue label="Status">
            <Badge tone={t.status === 'active' ? 'ok' : t.status === 'trial' ? 'warn' : 'crit'}>{t.status === 'active' ? 'Aktivno' : t.status === 'trial' ? 'Probno razdoblje' : 'Isključeno'}</Badge>
          </KeyValue>
          {t.status === 'trial' ? <KeyValue label="Proba traje do">{formatDate(t.trial_ends_at)}</KeyValue> : null}
          {play ? (
            <KeyValue label="Paket">{`${plan.name} · ${plan.people}`}</KeyValue>
          ) : (
            <>
              <KeyValue label="Paket">{`${plan.name} · ${plan.people} · ${monthlyPrice(t.plan, t.billing_term, t.founder_until)} € mjesečno`}</KeyValue>
              <KeyValue label="Plaćanje">{TERM_LABELS[t.billing_term] ?? TERM_LABELS.monthly}</KeyValue>
            </>
          )}
          {t.paid_until ? <KeyValue label="Plaćeno do">{formatDate(t.paid_until)}</KeyValue> : null}
        </div>
        <Fold plain title="Korištenje ovaj mjesec" summary={`${AI_LABELS.scan} ${scans}, ${AI_LABELS.copilot} ${answers}`}>
          <div className="divide-y divide-line px-4">
            <KeyValue label={AI_LABELS.scan}>{`${scans} od ${aiQuota(t.plan, t.ai_quota, 'scan')}`}</KeyValue>
            <KeyValue label={AI_LABELS.copilot}>{`${answers} od ${aiQuota(t.plan, t.ai_quota, 'copilot')}`}</KeyValue>
          </div>
        </Fold>
        {!play ? (
          <div className="border-t border-line">
            <NavRow href="/app/settings/pretplata" title="Paketi i uplata" />
          </div>
        ) : null}
      </Card>
      {referral ? (
        <Fold title="Preporuka kolegi" summary="Mjesec dana gratis kad kolega plati prvu pretplatu">
          <div className="p-4">
            <ReferralShare link={referral.link} workshop={t.name} />
          </div>
          {referral.joined ? (
            <div className="divide-y divide-line border-t border-line px-4">
              <KeyValue label="Registrirano preko poveznice">{referral.joined}</KeyValue>
              <KeyValue label="Od toga plaća">{referral.paid}</KeyValue>
            </div>
          ) : null}
        </Fold>
      ) : null}
    </div>
  ) : null;

  const help = (
    <div className="space-y-4">
      <h2 className="px-1 type-kicker">Pomoć</h2>
      <Card>
        <CardHeader title="Javite nam" subtitle="Nešto ne radi ili Vam nešto treba." />
        <div className="flex flex-wrap items-center gap-2 p-4">
          <SupportButton />
          <SupportWhatsApp
            message={
              isDemo
                ? `Pozdrav, isprobavam demo Poslara (${ctx.pkg.product}). `
                : `Pozdrav, ovdje ${[ctx.profile.full_name, t.name].filter(Boolean).join(', ')} (br. ${t.billing_ref}). `
            }
          />
          {(tickets ?? []).length ? (
            <Link href="/app/podrska" className="text-sm font-medium text-accent hover:underline">
              Moje prijave ({(tickets ?? []).length})
              {unread ? ` · ${unread === 1 ? 'novi odgovor' : `${unread} nova odgovora`}` : ''}
            </Link>
          ) : null}
        </div>
        {videos.length ? (
          <Fold plain title="Video upute" summary={`${videos.length}`}>
            <ul className="py-1">
              {videos.map((v) => (
                <li key={v.id}>
                  <a href={v.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface2">
                    <PlayCircle className="size-5 shrink-0 text-accent" />
                    {v.title}
                  </a>
                </li>
              ))}
            </ul>
          </Fold>
        ) : null}
      </Card>
      <p className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-faint">
        {LEGAL_PAGES.map((p) => (
          <Link key={p.href} href={p.href} className="hover:text-fg">
            {p.title}
          </Link>
        ))}
      </p>
    </div>
  );

  const workshop = ctx.isOwner ? (
    <div className="space-y-4">
      <h2 className="px-1 type-kicker">{place}</h2>
      <Fold title={`Podaci: ${t.name}`} summary={[t.city, t.phone].filter(Boolean).join(' · ') || 'Naziv, adresa, telefon'}>
        <div className="space-y-5 p-4">
          <LogoUpload tenantId={t.id} logoUrl={t.logo_url} />
          <WorkshopForm tenant={{ name: t.name, oib: t.oib ?? '', phone: t.phone ?? '', email: t.email ?? '', address: t.address ?? '', city: t.city ?? '' }} />
        </div>
      </Fold>
      <Fold title="Podaci na računu" summary="IBAN, PDV i oznake fiskalizacije">
        <div className="p-4">
          <BillingForm
            billing={(() => {
              const b = billingFrom(t.settings);
              const fiscal = (t.settings as { fiscal?: { premises?: string; device?: string; operator?: string } | null } | null)?.fiscal;
              return { iban: b.iban ?? '', vatRegistered: b.vatRegistered, note: b.note ?? '', premises: fiscal?.premises ?? '', device: fiscal?.device ?? '', operator: fiscal?.operator ?? '' };
            })()}
          />
        </div>
      </Fold>
      <Card>
        <div className="divide-y divide-line">
          <NavRow
            href="/app/settings/radionice"
            title="Radionice"
            subtitle={workshops.length > 1 ? `${workshops.length} · prebacivanje i nova` : 'Druga i treća uz Premium'}
          />
          <NavRow href="/app/settings/qr" title="QR samoprijem" subtitle="Kod za vrata, plakat za ispis" />
          <NavRow href="/app/settings/poruke" title="Poruke mušterijama" subtitle="Termin, podsjetnik i „gotovo” na WhatsApp" />
          <NavRow href="/app/settings/termin" title="Rezerviraj termin" subtitle={t.booking_enabled !== false ? 'Uključeno' : 'Isključeno'} />
          <NavRow href="/app/settings/telefon" title="Poslar na telefonu" subtitle={t.phone_agent_number_id ? 'Uključen' : 'Javlja se kad Vi ne možete'} />
          <NavRow href="/app/settings/cjenik" title="Cjenik i predlošci" subtitle="Satnica i Vaši poslovi" />
          <NavRow href="/app/clients/uvoz" title="Uvoz mušterija" subtitle="Excel, CSV ili imenik" />
          <NavRow href="/app/settings/izvoz" title="Izvoz podataka" subtitle="Sve u jednoj datoteci" />
        </div>
        {!isDemo && !isGuestTenant(t) ? (
          <div className="border-t border-line">
            <DailySummaryControls enabled={(t.settings as { daily_email?: unknown } | null)?.daily_email !== false} />
          </div>
        ) : null}
      </Card>
      <Fold title="Tim" summary={`${(staff ?? []).length} ${plural((staff ?? []).length, 'osoba', 'osobe', 'osoba')} · radnici ne vide iznose`}>
        <div className="space-y-3 p-4">
          <VideoChip href={links.team} />
          <TeamManager me={ctx.user.id} staff={((staff ?? []) as Profile[]).map((p) => ({ id: p.id, name: p.full_name ?? '-', role: p.role }))} />
        </div>
      </Fold>
      {ctx.pkg.optionalModules.length ? (
        <Fold title="Dodatni moduli" summary="Uključite ono što ova radionica koristi">
          <div className="p-4">
            <ModuleToggles modules={ctx.pkg.optionalModules.map((m) => ({ id: m, label: MODULE_LABELS[m] ?? m, on: t.enabled_modules.includes(m) }))} />
          </div>
        </Fold>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <PageHeader title="Postavke" />
      <div className="mx-auto max-w-xl space-y-8">
        {workshop}
        {billing}
        {account}
        {help}
      </div>
    </>
  );
}
