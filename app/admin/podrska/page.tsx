import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductMark } from '@/components/ProductMark';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import type { PackageId } from '@/config/tenant.config';
import { formatRelative } from '@/lib/format';
import { requireTower } from '@/lib/tower';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Podrška' };

const VIEWS = [
  { id: 'open', label: 'Čeka odgovor' },
  { id: 'answered', label: 'Odgovoreno' },
  { id: 'closed', label: 'Riješeno' },
] as const;

export default async function TowerSupport({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const admin = await requireTower();
  const { s = 'open' } = await searchParams;
  const view = VIEWS.find((v) => v.id === s) ?? VIEWS[0];
  const [{ data: tickets }, counts] = await Promise.all([
    admin
      .from('support_tickets')
      .select('id, status, page_url, last_message_at, created_at, user_id, tenant:tenants(name, package), messages:support_messages(body, from_admin, created_at)')
      .eq('status', view.id)
      .order('last_message_at', { ascending: view.id === 'open' })
      .limit(100),
    Promise.all(VIEWS.map((v) => admin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', v.id))),
  ]);
  type Row = { id: string; page_url: string | null; last_message_at: string; tenant: { name: string; package: PackageId } | null; messages: { body: string; from_admin: boolean; created_at: string }[] };
  const rows = (tickets ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Podrška" subtitle="Prijave iz aplikacije, „Javi problem”" />
      <div className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4">
        {VIEWS.map((v, i) => (
          <Link
            key={v.id}
            href={`/admin/podrska${v.id === 'open' ? '' : `?s=${v.id}`}`}
            className={cn('flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm', v.id === view.id ? 'border-accent bg-accent/15 text-fg' : 'border-line text-muted')}
          >
            {v.label}
            <span className="text-xs text-faint">{counts[i].count ?? 0}</span>
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title={view.id === 'open' ? 'Nitko ne čeka odgovor' : 'Nema prijava'} />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {rows.map((t) => {
              const ordered = [...t.messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
              const last = ordered[ordered.length - 1];
              return (
                <li key={t.id}>
                  <Link href={`/admin/podrska/${t.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-surface2">
                    {t.tenant ? <ProductMark id={t.tenant.package} className="mt-0.5 size-7" /> : null}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{t.tenant?.name ?? 'Radionica'}</span>
                        {ordered.length > 1 ? <Badge tone="muted">{ordered.length} poruka</Badge> : null}
                      </span>
                      <span className="line-clamp-2 text-sm text-muted">{last?.from_admin ? `Vi: ${last.body}` : last?.body}</span>
                      {t.page_url ? <span className="block truncate text-xs text-faint">{t.page_url}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-faint">{formatRelative(t.last_message_at)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
