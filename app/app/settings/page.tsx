import type { Metadata } from 'next';
import { Badge, Card, CardHeader, KeyValue, PageHeader } from '@/components/ui';
import { hasModule } from '@/config/tenant.config';
import { formatDate } from '@/lib/format';
import { requireWorkshop } from '@/lib/session';
import type { Profile } from '@/types/db';
import { LogoUpload, ModuleToggles, ProfileForm, TeamManager, ThemeToggle, WorkshopForm } from './SettingsForms';

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
  const { data: staff } = ctx.isOwner ? await ctx.supabase.from('profiles').select('*').order('created_at') : { data: [] };
  const t = ctx.tenant;

  return (
    <>
      <PageHeader title="Postavke" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Moj račun" subtitle={ctx.user.email} />
            <div className="p-4">
              <ProfileForm
                fullName={ctx.profile.full_name ?? ''}
                phone={ctx.profile.phone ?? ''}
                fgasCertificate={hasModule(ctx.pkg, ctx.tenant.enabled_modules, 'fgas') ? (ctx.profile.fgas_certificate ?? '') : undefined}
              />
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
            </div>
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
            <Card>
              <CardHeader title="Tim" subtitle="Radnici vide naloge, ali ne i iznose, naplatu ni poslovanje" />
              <div className="p-4">
                <TeamManager me={ctx.user.id} staff={((staff ?? []) as Profile[]).map((p) => ({ id: p.id, name: p.full_name ?? '—', role: p.role }))} />
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
