import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, LogOut, PlayCircle } from 'lucide-react';
import { VideoChip } from '@/components/help/VideoChip';
import { SupportButton } from '@/components/SupportButton';
import { ReferralShare } from '@/components/billing/ReferralShare';
import { SupportWhatsApp } from '@/components/SupportWhatsApp';
import { DeleteAccount } from '@/components/settings/DeleteAccount';
import { Badge, Button, Card, CardHeader, KeyValue, PageHeader } from '@/components/ui';
import { HELP_TOPICS } from '@/config/help';
import { LEGAL_PAGES } from '@/config/legal';
import { AI_LABELS, TERM_LABELS, aiQuota, getPlan, monthlyPrice } from '@/config/plans';
import { aiUsageThisMonth } from '@/lib/ai-usage';
import { loadHelpVideos } from '@/lib/help';
import { isPlayApp } from '@/lib/play';
import { signOut } from '@/lib/actions/auth';
import { hasModule } from '@/config/tenant.config';
import { formatDate } from '@/lib/format';
import { appOrigin } from '@/lib/qr';
import { isPlatformAdmin, requireWorkshop } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Profile } from '@/types/db';
import { billingFrom } from '@/components/invoice/InvoiceDocument';
import { BillingForm, LogoUpload, ModuleToggles, ProfileForm, TeamManager, ThemeToggle, WorkshopForm } from './SettingsForms';

export const metadata: Metadata = { title: 'Postavke' };

const MODULE_LABELS: Record<string, string> = {
  dvi: 'Digitalna inspekcija (DVI)',
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
  const [{ data: staff }, { data: tickets }, scans, answers, tower, links, play] = await Promise.all([
    ctx.isOwner ? ctx.supabase.from('profiles').select('*').order('created_at') : Promise.resolve({ data: [] }),
    ctx.supabase.from('support_tickets').select('id, tenant_unread'),
    ctx.isOwner ? aiUsageThisMonth(t.id, 'scan') : Promise.resolve(0),
    ctx.isOwner ? aiUsageThisMonth(t.id, 'copilot') : Promise.resolve(0),
    isPlatformAdmin(),
    loadHelpVideos(),
    isPlayApp(),
  ]);
  // How-to videos that have a link; a worker skips the owner's screens.
  const videos = HELP_TOPICS.filter((h) => links[h.id] && (ctx.isOwner || !h.owner)).map((h) => ({ ...h, url: links[h.id] }));
  const plan = getPlan(t.plan);
  const unread = (tickets ?? []).filter((x) => x.tenant_unread).length;
  // The owner's own link for colleagues (not in the shared demo workshops).
  const isDemo = (t.settings as { demo?: unknown } | null)?.demo === true;
  const referral = ctx.isOwner && !isDemo ? await loadReferral(t.id, t.billing_ref) : null;

  return (
    <>
      <PageHeader title="Postavke" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {/* Only for TaktiX itself: the way into the tower from a workshop account. */}
          {tower ? (
            <Link href="/admin" className="flex items-center justify-between gap-3 rounded-2xl border border-accent/50 bg-accent/10 px-4 py-3">
              <span>
                <span className="block font-semibold">Toranj</span>
                <span className="block text-sm text-muted">Radionice, pretplate, podrška i greške</span>
              </span>
              <ChevronRight className="size-5 text-accent" />
            </Link>
          ) : null}
          <Card>
            <CardHeader
              title="Moj račun"
              subtitle={ctx.user.email}
              action={
                <form action={signOut}>
                  <Button type="submit" size="sm" variant="secondary">
                    <LogOut className="size-4" /> Odjava
                  </Button>
                </form>
              }
            />
            <div className="p-4">
              <ProfileForm
                fullName={ctx.profile.full_name ?? ''}
                phone={ctx.profile.phone ?? ''}
                fgasCertificate={hasModule(ctx.pkg, ctx.tenant.enabled_modules, 'fgas') ? (ctx.profile.fgas_certificate ?? '') : undefined}
              />
            </div>
            {/* Shared demo accounts are never deleted. */}
            {!isDemo ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
                <Link href="/nova-lozinka" className="text-sm font-medium text-accent hover:underline">
                  Promijeni lozinku
                </Link>
                <DeleteAccount owner={ctx.isOwner} />
              </div>
            ) : null}
          </Card>
          <Card>
            <CardHeader title="Pomoć" subtitle="Nešto ne radi ili Vam nešto treba? Javite nam." />
            <div className="flex flex-wrap items-center gap-2 p-4">
              <SupportButton />
              <SupportWhatsApp
                message={
                  isDemo
                    ? `Pozdrav, isprobavam TaktiX demo (${ctx.pkg.product}). `
                    : `Pozdrav, ovdje ${[ctx.profile.full_name, t.name].filter(Boolean).join(', ')} (br. ${t.billing_ref}). `
                }
              />
              {(tickets ?? []).length ? (
                <Link href="/app/podrska" className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface2 hover:text-fg">
                  Moje prijave ({(tickets ?? []).length})
                  {unread ? <Badge tone="accent">{unread === 1 ? 'novi odgovor' : `${unread} nova odgovora`}</Badge> : null}
                  <ChevronRight className="size-4" />
                </Link>
              ) : null}
            </div>
            {videos.length ? (
              <div className="border-t border-line">
                <p className="px-4 pt-3 text-xs font-medium text-muted">Video upute</p>
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
              </div>
            ) : null}
          </Card>
          <Card>
            <CardHeader title="Izgled" />
            <div className="p-4">
              <ThemeToggle />
            </div>
          </Card>
          {ctx.isOwner ? (
          <Card>
            <CardHeader title="Pretplata" />
            <div className="divide-y divide-line px-4">
              <KeyValue label="Paket">{ctx.pkg.product}</KeyValue>
              <KeyValue label="Status">
                <Badge tone={t.status === 'active' ? 'ok' : t.status === 'trial' ? 'warn' : 'crit'}>{t.status === 'active' ? 'Aktivno' : t.status === 'trial' ? 'Probno razdoblje' : 'Isključeno'}</Badge>
              </KeyValue>
              {t.status === 'trial' ? <KeyValue label="Proba traje do">{formatDate(t.trial_ends_at)}</KeyValue> : null}
              {/* The Google Play app shows no prices (config/play.ts). */}
              {play ? (
                <KeyValue label="Pretplata">{`${plan.name} · ${plan.people}`}</KeyValue>
              ) : (
                <>
                  <KeyValue label="Pretplata">{`${plan.name} · ${plan.people} · ${monthlyPrice(t.plan, t.billing_term)} € mjesečno`}</KeyValue>
                  <KeyValue label="Način plaćanja">{TERM_LABELS[t.billing_term] ?? TERM_LABELS.monthly}</KeyValue>
                </>
              )}
              {t.paid_until ? <KeyValue label="Plaćeno do">{formatDate(t.paid_until)}</KeyValue> : null}
              <KeyValue label={`${AI_LABELS.scan} ovaj mjesec`}>{`${scans} od ${aiQuota(t.plan, t.ai_quota, 'scan')}`}</KeyValue>
              <KeyValue label={`${AI_LABELS.copilot} ovaj mjesec`}>{`${answers} od ${aiQuota(t.plan, t.ai_quota, 'copilot')}`}</KeyValue>
            </div>
            {!play ? (
              <Link href="/app/settings/pretplata" className="flex items-center justify-between border-t border-line px-4 py-3 text-sm font-medium text-accent">
                Pretplata, paketi i uplata
                <ChevronRight className="size-4" />
              </Link>
            ) : null}
          </Card>
          ) : null}
          {referral ? (
            <Card>
              <CardHeader title="Preporučite TaktiX" subtitle="Kolega se registrira preko Vaše poveznice. Kad plati prvu pretplatu, Vi dobivate mjesec dana gratis." />
              <div className="space-y-3 p-4">
                <ReferralShare link={referral.link} workshop={t.name} />
              </div>
              {referral.joined ? (
                <div className="divide-y divide-line border-t border-line px-4">
                  <KeyValue label="Registrirano preko poveznice">{referral.joined}</KeyValue>
                  <KeyValue label="Od toga plaća">{referral.paid}</KeyValue>
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>

        {ctx.isOwner ? (
          <div className="space-y-4">
            <Card>
              <CardHeader title="Radionica" />
              <div className="space-y-5 p-4">
                <LogoUpload tenantId={t.id} logoUrl={t.logo_url} />
                <WorkshopForm tenant={{ name: t.name, oib: t.oib ?? '', phone: t.phone ?? '', email: t.email ?? '', address: t.address ?? '', city: t.city ?? '' }} />
              </div>
            </Card>
            <Link href="/app/settings/qr" className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 hover:border-accent/60">
              <span>
                <span className="block font-semibold">QR samoprijem</span>
                <span className="block text-sm text-muted">Kod za vrata, plakat za ispis</span>
              </span>
              <ChevronRight className="size-5 text-faint" />
            </Link>
            <Link href="/app/settings/cjenik" className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 hover:border-accent/60">
              <span>
                <span className="block font-semibold">Cjenik i predlošci</span>
                <span className="block text-sm text-muted">Satnica, Vaše cijene i Vaši poslovi</span>
              </span>
              <ChevronRight className="size-5 text-faint" />
            </Link>
            <Card>
              <CardHeader title="Račun" subtitle="Pojavljuje se na računu za stranku" />
              <div className="p-4">
                <BillingForm
                  billing={(() => {
                    const b = billingFrom(t.settings);
                    const fiscal = (t.settings as { fiscal?: { premises?: string; device?: string } | null } | null)?.fiscal;
                    return { iban: b.iban ?? '', vatRegistered: b.vatRegistered, note: b.note ?? '', premises: fiscal?.premises ?? '', device: fiscal?.device ?? '' };
                  })()}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Tim" subtitle="Radnici vide naloge, ali ne i iznose, naplatu ni poslovanje" action={<VideoChip href={links.team} />} />
              <div className="p-4">
                <TeamManager me={ctx.user.id} staff={((staff ?? []) as Profile[]).map((p) => ({ id: p.id, name: p.full_name ?? '-', role: p.role }))} />
              </div>
            </Card>
            {ctx.pkg.optionalModules.length ? (
              <Card>
                <CardHeader title="Dodatni moduli" />
                <div className="p-4">
                  <ModuleToggles modules={ctx.pkg.optionalModules.map((m) => ({ id: m, label: MODULE_LABELS[m] ?? m, on: t.enabled_modules.includes(m) }))} />
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="mt-8 flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
        {LEGAL_PAGES.map((p) => (
          <Link key={p.href} href={p.href} className="hover:text-fg">
            {p.title}
          </Link>
        ))}
      </p>
    </>
  );
}
