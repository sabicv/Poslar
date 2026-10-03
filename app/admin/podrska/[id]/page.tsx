import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackLink, Badge, Card, CardHeader, KeyValue, PageHeader } from '@/components/ui';
import { getPlan } from '@/config/plans';
import { getPackage } from '@/config/tenant.config';
import { formatDate, formatDateTime } from '@/lib/format';
import { requireTower } from '@/lib/tower';
import { cn } from '@/lib/utils';
import { AdminReply, TicketStatusButtons } from './TicketActions';

export const metadata: Metadata = { title: 'Prijava' };

export default async function TowerTicket({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireTower();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: ticket } = await admin
    .from('support_tickets')
    .select('*, tenant:tenants(id, name, package, plan, status, trial_ends_at, paid_until, phone, city), messages:support_messages(id, body, from_admin, created_at, author_id)')
    .eq('id', id)
    .maybeSingle();
  if (!ticket) notFound();
  const tenant = ticket.tenant as { id: string; name: string; package: string; plan: string; status: string; trial_ends_at: string | null; paid_until: string | null; phone: string | null; city: string | null } | null;
  const messages = [...((ticket.messages ?? []) as { id: string; body: string; from_admin: boolean; created_at: string; author_id: string | null }[])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const authorIds = [...new Set(messages.filter((m) => !m.from_admin && m.author_id).map((m) => m.author_id as string))];
  const { data: authors } = authorIds.length ? await admin.from('profiles').select('id, full_name, role, phone').in('id', authorIds) : { data: [] };
  const who = (id: string | null) => (authors ?? []).find((a) => a.id === id);
  const writer = who(ticket.user_id as string | null);
  const email = ticket.user_id ? (await admin.auth.admin.getUserById(ticket.user_id as string)).data.user?.email : null;

  return (
    <>
      <PageHeader title={tenant?.name ?? 'Prijava'} back={<BackLink href="/admin/podrska">Podrška</BackLink>} action={<TicketStatusButtons id={id} status={ticket.status as 'open' | 'answered' | 'closed'} />} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <ul className="space-y-3 p-4">
            {messages.map((m) => (
              <li key={m.id} className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm', m.from_admin ? 'ml-auto bg-accent/15' : 'bg-surface2')}>
                <p className="mb-0.5 text-xs text-muted">
                  {m.from_admin ? 'Vi (TaktiX)' : (who(m.author_id)?.full_name ?? 'Radionica')} · {formatDateTime(m.created_at)}
                </p>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-3">
            <AdminReply id={id} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Tko piše" />
          <div className="divide-y divide-line px-4">
            <KeyValue label="Osoba">{writer ? `${writer.full_name ?? '-'} (${writer.role === 'owner' ? 'voditelj' : 'radnik'})` : '-'}</KeyValue>
            <KeyValue label="Kontakt">{[writer?.phone, email].filter(Boolean).join(' · ') || '-'}</KeyValue>
            {tenant ? (
              <>
                <KeyValue label="Zanat i paket">{`${getPackage(tenant.package).product} · ${getPlan(tenant.plan).name}`}</KeyValue>
                <KeyValue label="Status">
                  <Badge tone={tenant.status === 'active' ? 'ok' : tenant.status === 'trial' ? 'warn' : 'crit'}>
                    {tenant.status === 'active' ? (tenant.paid_until ? `plaćeno do ${formatDate(tenant.paid_until)}` : 'aktivna') : tenant.status === 'trial' ? `proba do ${formatDate(tenant.trial_ends_at)}` : 'isključena'}
                  </Badge>
                </KeyValue>
                <KeyValue label="Radionica">{[tenant.city, tenant.phone].filter(Boolean).join(' · ') || '-'}</KeyValue>
              </>
            ) : null}
            <KeyValue label="Stranica">{(ticket.page_url as string | null) ?? '-'}</KeyValue>
            <KeyValue label="Uređaj">
              <span className="text-xs">{(ticket.user_agent as string | null) ?? '-'}</span>
            </KeyValue>
          </div>
        </Card>
      </div>
    </>
  );
}
