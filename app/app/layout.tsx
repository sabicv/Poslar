import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { GuestBanner } from '@/components/onboarding/GuestBanner';
import { SampleDayBanner } from '@/components/onboarding/SampleDayBanner';
import { accentStyle, getPackage } from '@/config/tenant.config';
import { subscription } from '@/lib/billing';
import { isDemoUser } from '@/lib/demo';
import { daysUntil, formatDate } from '@/lib/format';
import { guestAiUsed } from '@/lib/ai-usage';
import { GUEST_AI_TOTAL, isGuestTenant } from '@/lib/guest';
import { isPlayApp } from '@/lib/play';
import { sampleHoursLeft } from '@/lib/sample-day';
import { requireWorkshop } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { cn } from '@/lib/utils';
import { myWorkshops } from '@/lib/workshops';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkshop();

  // Open tasks for a worker, open help requests for the owner.
  let inbox = ctx.supabase.from('job_messages').select('id', { count: 'exact', head: true }).eq('status', 'open').neq('sender_id', ctx.user.id);
  inbox = ctx.isOwner ? inbox.or(`receiver_id.eq.${ctx.user.id},kind.eq.help`) : inbox.eq('receiver_id', ctx.user.id);
  const [{ count }, { count: supportUnread }, { count: doorCount }, workshops] = await Promise.all([
    inbox,
    ctx.supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('tenant_unread', true),
    // Requests from the door QR code, the AI phone and the booking page still waiting in Prijem.
    ctx.supabase.from('jobs').select('id', { count: 'exact', head: true }).in('source', ['qr', 'phone', 'booking']).eq('phase', 'intake'),
    myWorkshops(ctx),
  ]);

  const guest = isGuestTenant(ctx.tenant);
  // Older open demos still carry the 24-hour clock. It no longer applies.
  if (guest && (ctx.tenant.sample_until || ctx.tenant.trial_ends_at)) {
    await createAdminClient().from('tenants').update({ sample_until: null, trial_ends_at: null }).eq('id', ctx.tenant.id);
  }
  const used = guest ? await guestAiUsed(ctx.user.id) : null;
  // During the 24-hour trial on examples the banner counts hours instead.
  const sampleHours = guest ? null : sampleHoursLeft(ctx.tenant.sample_until);
  const trialDaysLeft = !guest && ctx.tenant.status === 'trial' && sampleHours === null ? daysUntil(ctx.tenant.trial_ends_at) : null;
  // The owner hears a week ahead that the subscription runs out, and again
  // in the week before the workshop locks.
  const sub = subscription(ctx.tenant);
  // In the Google Play app only the dates, no way to pay (config/play.ts).
  const play = await isPlayApp();
  const noticeClass = cn('mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm', sub.status === 'grace' ? 'border-crit/40 bg-crit/10' : 'border-warn/40 bg-warn/10');
  const noticeIcon = <Wallet className={cn('size-5 shrink-0', sub.status === 'grace' ? 'text-crit' : 'text-warn')} />;
  const notice = guest ? (
    <GuestBanner pkg={ctx.pkg.id} left={Math.max(0, GUEST_AI_TOTAL - (used ?? 0))} />
  ) : sampleHours !== null ? (
      <SampleDayBanner hours={sampleHours} owner={ctx.isOwner} />
    ) : ctx.isOwner && (sub.status === 'due_soon' || sub.status === 'grace') ? (
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
        workshops={workshops.map((w) => ({ id: w.id, name: w.name, package: w.package, product: getPackage(w.package).product, city: w.city, active: w.active }))}
      >
        {children}
      </AppShell>
    </div>
  );
}
