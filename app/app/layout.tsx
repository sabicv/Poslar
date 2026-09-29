import { AppShell } from '@/components/AppShell';
import { accentStyle } from '@/config/tenant.config';
import { isDemoUser } from '@/lib/demo';
import { daysUntil } from '@/lib/format';
import { requireWorkshop } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkshop();

  // Open tasks for a worker, open help requests for the owner.
  let inbox = ctx.supabase.from('job_messages').select('id', { count: 'exact', head: true }).eq('status', 'open').neq('sender_id', ctx.user.id);
  inbox = ctx.isOwner ? inbox.or(`receiver_id.eq.${ctx.user.id},kind.eq.help`) : inbox.eq('receiver_id', ctx.user.id);
  const { count } = await inbox;

  const trialDaysLeft = ctx.tenant.status === 'trial' ? daysUntil(ctx.tenant.trial_ends_at) : null;

  return (
    <div className="accent-scope min-h-dvh" style={accentStyle(ctx.pkg)}>
      <AppShell
        product={{ id: ctx.pkg.id, name: ctx.pkg.product, clients: ctx.pkg.vocabulary.client.many, modulePage: ctx.pkg.modulePage, field: ctx.pkg.sector === 'field' }}
        workshop={{ name: ctx.tenant.name, logoUrl: ctx.tenant.logo_url }}
        user={{ name: ctx.profile.full_name ?? ctx.user.email ?? '', isOwner: ctx.isOwner }}
        inboxCount={count ?? 0}
        trialDaysLeft={trialDaysLeft}
        demo={isDemoUser(ctx.user)}
      >
        {children}
      </AppShell>
    </div>
  );
}
