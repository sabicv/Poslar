import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { formatDateTime, formatRelative } from '@/lib/format';
import { requireTower } from '@/lib/tower';
import { cn } from '@/lib/utils';
import { ErrorStatusButton } from './ErrorStatusButton';

export const metadata: Metadata = { title: 'Greške' };

const SOURCE = { client: 'Preglednik', server: 'Server', action: 'Spremanje' } as const;

// Errors from browsers, the server and failed saves, one row per kind,
// most recent first. A resolved error that happens again comes back here.
export default async function TowerErrors({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const admin = await requireTower();
  const { s } = await searchParams;
  const status = s === 'resolved' ? 'resolved' : 'open';
  const [{ data: errors }, { count: openCount }, { count: resolvedCount }] = await Promise.all([
    admin.from('app_errors').select('*, tenant:tenants(name)').eq('status', status).order('last_seen', { ascending: false }).limit(100),
    admin.from('app_errors').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    admin.from('app_errors').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
  ]);
  type Row = { id: string; source: keyof typeof SOURCE; message: string; stack: string | null; url: string | null; digest: string | null; user_agent: string | null; count: number; first_seen: string; last_seen: string; tenant: { name: string } | null };
  const rows = (errors ?? []) as unknown as Row[];
  const day = Date.now() - 86400000;

  return (
    <>
      <PageHeader title="Greške" subtitle="Hvataju se same, iz preglednika, servera i spremanja" />
      <div className="mb-4 flex gap-1.5">
        {[
          { id: 'open', label: 'Otvorene', count: openCount ?? 0 },
          { id: 'resolved', label: 'Riješene', count: resolvedCount ?? 0 },
        ].map((v) => (
          <Link
            key={v.id}
            href={`/admin/greske${v.id === 'open' ? '' : '?s=resolved'}`}
            className={cn('flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm', v.id === status ? 'border-accent bg-accent/15 text-fg' : 'border-line text-muted')}
          >
            {v.label} <span className="text-xs text-faint">{v.count}</span>
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title={status === 'open' ? 'Nema otvorenih grešaka' : 'Nema riješenih grešaka'} />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {rows.map((e) => (
              <li key={e.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={e.source === 'server' ? 'crit' : e.source === 'action' ? 'warn' : 'neutral'}>{SOURCE[e.source]}</Badge>
                  <Badge tone={e.count > 10 ? 'crit' : 'muted'}>{e.count}×</Badge>
                  {new Date(e.last_seen).getTime() > day ? <Badge tone="accent">zadnja 24 h</Badge> : null}
                  <span className="ml-auto text-xs text-faint">{formatRelative(e.last_seen)}</span>
                </div>
                <p className="break-words font-mono text-sm">{e.message}</p>
                <p className="text-xs text-muted">{[e.url, e.tenant?.name, e.digest && `oznaka ${e.digest}`].filter(Boolean).join(' · ')}</p>
                <details className="text-xs text-faint">
                  <summary className="cursor-pointer select-none">Detalji</summary>
                  <p className="mt-2">Prvi put {formatDateTime(e.first_seen)}, zadnji put {formatDateTime(e.last_seen)}</p>
                  {e.user_agent ? <p className="mt-1 break-words">{e.user_agent}</p> : null}
                  {e.stack ? <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-surface2 p-2 font-mono text-xs leading-snug">{e.stack}</pre> : null}
                </details>
                <ErrorStatusButton id={e.id} status={status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
