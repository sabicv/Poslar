import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, Search, User } from 'lucide-react';
import { ClientSheet } from '@/components/ClientForms';
import { EmptyState, Input, PageHeader } from '@/components/ui';
import { assetTitle, clientName } from '@/lib/format';
import { requireWorkshop } from '@/lib/session';
import { toIlike } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireWorkshop();
  return { title: ctx.pkg.vocabulary.client.many };
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireWorkshop();
  const { q = '' } = await searchParams;
  const search = q.trim();

  let query = ctx.supabase
    .from('clients')
    .select('id, kind, first_name, last_name, company_name, phone, city, assets(id, identifier, make, model, asset_type)')
    .order('updated_at', { ascending: false })
    .limit(150);
  if (search) {
    const like = toIlike(search);
    const compact = toIlike(search.replace(/[\s-]/g, ''));
    const { data: assets } = await ctx.supabase.from('assets').select('client_id').or(`identifier.ilike.${like},identifier.ilike.${compact},vin.ilike.${like}`).limit(50);
    const byAsset = (assets ?? []).map((a) => a.client_id as string);
    query = query.or(
      [`first_name.ilike.${like}`, `last_name.ilike.${like}`, `company_name.ilike.${like}`, `phone.ilike.${compact}`, `oib.ilike.${like}`, ...(byAsset.length ? [`id.in.(${byAsset.join(',')})`] : [])].join(',')
    );
  }
  const { data } = await query;
  const clients = (data ?? []) as unknown as {
    id: string;
    kind: 'person' | 'company';
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    phone: string | null;
    city: string | null;
    assets: { id: string; identifier: string | null; make: string | null; model: string | null; asset_type: never }[];
  }[];

  return (
    <>
      <PageHeader title={ctx.pkg.vocabulary.client.many} action={<ClientSheet title={ctx.pkg.vocabulary.client.new} />} />
      <form className="relative mb-4" action="/app/clients">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input name="q" defaultValue={search} placeholder={`Ime, telefon, OIB ili ${ctx.pkg.vocabulary.identifier.toLowerCase()}`} className="pl-9" />
      </form>
      {clients.length === 0 ? (
        <EmptyState title={search ? 'Ništa nije pronađeno' : `Još nema unosa`}>Nova stranka se dodaje i sama pri otvaranju naloga.</EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {clients.map((c) => (
            <li key={c.id}>
              <Link prefetch={false} href={`/app/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface2 text-muted">
                  {c.kind === 'company' ? <Building2 className="size-4" /> : <User className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{clientName(c)}</span>
                  {c.assets.length ? (
                    <span className="block truncate text-xs text-muted">
                      {c.assets
                        .slice(0, 3)
                        .map((a) => a.identifier ?? assetTitle(a))
                        .join(' · ')}
                      {c.assets.length > 3 ? ` +${c.assets.length - 3}` : ''}
                    </span>
                  ) : null}
                </span>
                {c.phone ? <span className="hidden text-sm tabular text-muted sm:block">{c.phone}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
