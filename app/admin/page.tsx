import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ProductMark } from '@/components/ProductMark';
import { Badge, Button, Card, CardHeader, PageHeader, Stat } from '@/components/ui';
import { PACKAGES, accentStyle, getPackage, type PackageId } from '@/config/tenant.config';
import { signOut } from '@/lib/actions/auth';
import { countJobs, daysUntil, formatDate, formatRelative } from '@/lib/format';
import { getAuth, isPlatformAdmin } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Tenant } from '@/types/db';
import { CreateWorkshop, TenantActions } from './AdminForms';

export const metadata: Metadata = { title: 'Super Admin' };

export default async function AdminPage() {
  if (!(await isPlatformAdmin())) redirect('/app');
  const { user } = await getAuth();
  const admin = createAdminClient();

  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: tenants }, { data: profiles }, { data: jobs }, { data: ai }] = await Promise.all([
    admin.from('tenants').select('*').order('created_at', { ascending: false }),
    admin.from('profiles').select('tenant_id, role, full_name, id'),
    admin.from('jobs').select('tenant_id, created_at').gte('created_at', monthAgo),
    admin.from('copilot_messages').select('tenant_id, input_tokens, output_tokens').eq('role', 'assistant').gte('created_at', monthAgo).limit(20000),
  ]);
  // AI Kopilot usage per workshop over 30 days (answers and tokens).
  const aiUsage = new Map<string, { answers: number; tokens: number }>();
  for (const row of ai ?? []) {
    const u = aiUsage.get(row.tenant_id as string) ?? { answers: 0, tokens: 0 };
    u.answers++;
    u.tokens += Number(row.input_tokens ?? 0) + Number(row.output_tokens ?? 0);
    aiUsage.set(row.tenant_id as string, u);
  }
  const list = (tenants ?? []) as Tenant[];
  const staffCount = new Map<string, number>();
  const ownerName = new Map<string, string>();
  for (const p of profiles ?? []) {
    staffCount.set(p.tenant_id as string, (staffCount.get(p.tenant_id as string) ?? 0) + 1);
    if (p.role === 'owner' && !ownerName.has(p.tenant_id as string)) ownerName.set(p.tenant_id as string, (p.full_name as string | null) ?? '');
  }
  const activity = new Map<string, { count: number; last: string }>();
  for (const j of jobs ?? []) {
    const row = activity.get(j.tenant_id as string) ?? { count: 0, last: j.created_at as string };
    row.count++;
    if ((j.created_at as string) > row.last) row.last = j.created_at as string;
    activity.set(j.tenant_id as string, row);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-safe sm:px-6">
      <div className="flex items-center justify-between py-4">
        <p className="text-sm text-muted">TaktiX · Toranj · {user?.email}</p>
        <form action={signOut}>
          <Button type="submit" size="sm" variant="ghost">
            Odjava
          </Button>
        </form>
      </div>
      <PageHeader title="Radionice" subtitle="Otvaranje, isključivanje i probna razdoblja" action={<CreateWorkshop />} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Radionica" value={list.length} />
        <Stat label="Aktivne (plaćaju)" value={list.filter((t) => t.status === 'active').length} tone="ok" />
        <Stat label="Na probi" value={list.filter((t) => t.status === 'trial').length} tone="warn" />
        <Stat label="Isključene" value={list.filter((t) => t.status === 'suspended').length} tone="crit" />
      </div>

      <div className="mb-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Object.values(PACKAGES).map((p) => (
          <div key={p.id} className="accent-scope flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2" style={accentStyle(p)}>
            <ProductMark id={p.id} className="size-6" />
            <span className="text-sm">{p.short}</span>
            <span className="ml-auto text-sm font-semibold tabular">{list.filter((t) => t.package === p.id).length}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader title="Sve radionice" />
        <ul className="divide-y divide-line">
          {list.map((t) => {
            const pkg = getPackage(t.package);
            const left = t.status === 'trial' ? daysUntil(t.trial_ends_at) : null;
            const act = activity.get(t.id);
            return (
              <li key={t.id} className="accent-scope flex flex-wrap items-center gap-3 px-4 py-3" style={accentStyle(pkg)}>
                <ProductMark id={t.package as PackageId} className="size-7" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted">
                    {[ownerName.get(t.id), t.city, t.oib && `OIB ${t.oib}`, `${staffCount.get(t.id) ?? 0} korisnika`, `od ${formatDate(t.created_at)}`].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-xs text-faint">
                    {act ? `${countJobs(act.count)} u 30 dana · zadnji ${formatRelative(act.last)}` : 'Nema naloga u 30 dana'}
                    {aiUsage.get(t.id) ? ` · Kopilot: ${aiUsage.get(t.id)!.answers} odgovora, ${Math.round(aiUsage.get(t.id)!.tokens / 1000)}k tokena` : ''}
                  </p>
                </div>
                <Badge tone={t.status === 'active' ? 'ok' : t.status === 'trial' ? (left !== null && left < 0 ? 'crit' : 'warn') : 'crit'}>
                  {t.status === 'active' ? 'Aktivna' : t.status === 'trial' ? (left !== null && left < 0 ? 'Proba istekla' : `Proba · ${left ?? '?'} d`) : 'Isključena'}
                </Badge>
                <TenantActions id={t.id} status={t.status} pkg={t.package} note={t.status_note} />
              </li>
            );
          })}
        </ul>
      </Card>
    </main>
  );
}
