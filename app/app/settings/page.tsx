import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, LogOut } from 'lucide-react';
import { SupportButton } from '@/components/SupportButton';
import { Badge, Button, Card, CardHeader, KeyValue, PageHeader } from '@/components/ui';
import { AI_LABELS, PLANS, TERM_LABELS, aiQuota, getPlan, monthlyPrice } from '@/config/plans';
import { aiUsageThisMonth } from '@/lib/ai-usage';
import { signOut } from '@/lib/actions/auth';
import { hasModule } from '@/config/tenant.config';
import { formatDate } from '@/lib/format';
import { isPlatformAdmin, requireWorkshop } from '@/lib/session';
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

export default async function SettingsPage() {
  const ctx = await requireWorkshop();
  const t = ctx.tenant;
  const [{ data: staff }, { data: tickets }, scans, answers, tower] = await Promise.all([
    ctx.isOwner ? ctx.supabase.from('profiles').select('*').order('created_at') : Promise.resolve({ data: [] }),
    ctx.supabase.from('support_tickets').select('id, tenant_unread'),
    ctx.isOwner ? aiUsageThisMonth(t.id, 'scan') : Promise.resolve(0),
    ctx.isOwner ? aiUsageThisMonth(t.id, 'copilot') : Promise.resolve(0),
    isPlatformAdmin(),
  ]);
  const plan = getPlan(t.plan);
  const unread = (tickets ?? []).filter((x) => x.tenant_unread).length;

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
          </Card>
          <Card>
            <CardHeader title="Pomoć" subtitle="Nešto ne radi ili Vam nešto treba? Javite nam." />
            <div className="flex flex-wrap items-center gap-2 p-4">
              <SupportButton />
              {(tickets ?? []).length ? (
                <Link href="/app/podrska" className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface2 hover:text-fg">
                  Moje prijave ({(tickets ?? []).length})
                  {unread ? <Badge tone="accent">{unread === 1 ? 'novi odgovor' : `${unread} nova odgovora`}</Badge> : null}
                  <ChevronRight className="size-4" />
                </Link>
              ) : null}
            </div>
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
              <KeyValue label="Pretplata">{`${plan.name} · ${plan.people} · ${monthlyPrice(t.plan, t.billing_term)} € mjesečno`}</KeyValue>
              <KeyValue label="Način plaćanja">{TERM_LABELS[t.billing_term] ?? TERM_LABELS.monthly}</KeyValue>
              {t.paid_until ? <KeyValue label="Plaćeno do">{formatDate(t.paid_until)}</KeyValue> : null}
              <KeyValue label={`${AI_LABELS.scan} ovaj mjesec`}>{`${scans} od ${aiQuota(t.plan, t.ai_quota, 'scan')}`}</KeyValue>
              <KeyValue label={`${AI_LABELS.copilot} ovaj mjesec`}>{`${answers} od ${aiQuota(t.plan, t.ai_quota, 'copilot')}`}</KeyValue>
            </div>
            <p className="border-t border-line px-4 py-2.5 text-xs text-faint">Veći paket: {Object.values(PLANS).filter((p) => p.price > plan.price).map((p) => `${p.name} ${p.price} €`).join(', ') || 'imate najveći'}. Promjenu tražite kroz „Javi problem”.</p>
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
                <BillingForm billing={(() => { const b = billingFrom(t.settings); return { iban: b.iban ?? '', vatRegistered: b.vatRegistered, note: b.note ?? '' }; })()} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Tim" subtitle="Radnici vide naloge, ali ne i iznose, naplatu ni poslovanje" />
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
    </>
  );
}
