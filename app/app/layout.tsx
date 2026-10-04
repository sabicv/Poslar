import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { accentStyle } from '@/config/tenant.config';
import { subscription } from '@/lib/billing';
import { isDemoUser } from '@/lib/demo';
import { daysUntil, formatDate } from '@/lib/format';
import { isPlayApp } from '@/lib/play';
import { requireWorkshop } from '@/lib/session';
import { cn } from '@/lib/utils';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkshop();

  // Open tasks for a worker, open help requests for the owner.
  let inbox = ctx.supabase.from('job_messages').select('id', { count: 'exact', head: true }).eq('status', 'open').neq('sender_id', ctx.user.id);
  inbox = ctx.isOwner ? inbox.or(`receiver_id.eq.${ctx.user.id},kind.eq.help`) : inbox.eq('receiver_id', ctx.user.id);
  const [{ count }, { count: supportUnread }, { count: doorCount }] = await Promise.all([
    inbox,
    ctx.supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('tenant_unread', true),
    // Requests from the door QR code and the AI phone still waiting in Prijem.
    ctx.supabase.from('jobs').select('id', { count: 'exact', head: true }).in('source', ['qr', 'phone']).eq('phase', 'intake'),
  ]);

  const trialDaysLeft = ctx.tenant.status === 'trial' ? daysUntil(ctx.tenant.trial_ends_at) : null;
  // The owner hears a week ahead that the subscription runs out, and again
  // in the week before the workshop locks.
  const sub = subscription(ctx.tenant);
  // In the Google Play app only the dates, no way to pay (config/play.ts).
  const play = await isPlayApp();
  const noticeClass = cn('mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm', sub.status === 'grace' ? 'border-crit/40 bg-crit/10' : 'border-warn/40 bg-warn/10');
  const noticeIcon = <Wallet className={cn('size-5 shrink-0', sub.status === 'grace' ? 'text-crit' : 'text-warn')} />;
  const notice =
    ctx.isOwner && (sub.status === 'due_soon' || sub.status === 'grace') ? (
      play ? (
        <div className={noticeClass}>
          {noticeIcon}
          <span className="flex-1">
            {sub.status === 'grace'
              ? `Pretplata je istekla ${formatDate(sub.paidUntil)} Aplikacija se zaključava ${formatDate(sub.lockOn)}`
              : `Pretplata vrijedi do ${formatDate(sub.paidUntil)}`}
          </span>
        </div>
      ) : (
        <Link href="/app/settings/pretplata" className={noticeClass}>
          {noticeIcon}
          <span className="flex-1">
            {sub.status === 'grace'
              ? `Pretplata je istekla ${formatDate(sub.paidUntil)} Aplikacija se zaključava ${formatDate(sub.lockOn)} ako uplata ne stigne.`
              : `Pretplata vrijedi do ${formatDate(sub.paidUntil)} Uplatite na vrijeme.`}
          </span>
          <span className="font-medium">Plati</span>
        </Link>
      )
    ) : null;

  return (
    <div className="accent-scope min-h-dvh" style={accentStyle(ctx.pkg)}>
      <AppShell
        product={{ id: ctx.pkg.id, name: ctx.pkg.product, clients: ctx.pkg.vocabulary.client.many, modulePage: ctx.pkg.modulePage, field: ctx.pkg.sector === 'field' }}
        workshop={{ name: ctx.tenant.name, logoUrl: ctx.tenant.logo_url }}
        user={{ name: ctx.profile.full_name ?? ctx.user.email ?? '', isOwner: ctx.isOwner }}
        inboxCount={count ?? 0}
        supportUnread={supportUnread ?? 0}
        doorCount={doorCount ?? 0}
        trialDaysLeft={trialDaysLeft}
        play={play}
        demo={isDemoUser(ctx.user)}
        notice={notice}
      >
        {children}
      </AppShell>
    </div>
  );
}
