import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, Search, Upload, User } from 'lucide-react';
import { ClientSheet } from '@/components/ClientForms';
import { EmptyState, Input, PageHeader, buttonClass } from '@/components/ui';
import { assetTitle } from '@/lib/format';
import { requireWorkshop } from '@/lib/session';
import { cn, toIlike } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireWorkshop();
  return { title: ctx.pkg.vocabulary.client.many };
}

// A person by surname first ("Horvat Ivan"), so the alphabetical list reads
// the way it is sorted; a company by its name.
function listName(c: { kind: 'person' | 'company'; first_name: string | null; last_name: string | null; company_name: string | null }): string {
  if (c.kind === 'company' && c.company_name) return c.company_name;
  return [c.last_name, c.first_name].filter(Boolean).join(' ') || c.company_name || '-';
}

const PAGE = 150;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; vise?: string }> }) {
  const ctx = await requireWorkshop();
  const { q = '', vise } = await searchParams;
  const search = q.trim();
  // "Prikaži još" adds a page; past 900 the search is quicker anyway.
  const pages = Math.min(6, Math.max(1, Number(vise) || 1));

  let query = ctx.supabase
    .from('clients')
    .select('id, kind, first_name, last_name, company_name, phone, city, sort_name, assets(id, identifier, make, model, asset_type)')
    .order('sort_name')
    .order('id')
    .limit(PAGE * pages);
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
    sort_name: string | null;
    assets: { id: string; identifier: string | null; make: string | null; model: string | null; asset_type: never }[];
  }[];
  const letter = (c: { sort_name: string | null }) => (c.sort_name ?? '').charAt(0).toLocaleUpperCase('hr') || '#';
  const more = clients.length === PAGE * pages && pages < 6;

  return (
    <>
      <PageHeader
        title={ctx.pkg.vocabulary.client.many}
        action={
          <div className="flex gap-2">
            {ctx.isOwner ? (
              <Link href="/app/clients/uvoz" className={buttonClass('secondary')} aria-label="Uvoz iz Excela ili imenika">
                <Upload className="size-4" /> <span className="hidden sm:inline">Uvoz</span>
              </Link>
            ) : null}
            <ClientSheet title={ctx.pkg.vocabulary.client.new} />
          </div>
        }
      />
      <form className="relative mb-4" action="/app/clients">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input name="q" defaultValue={search} placeholder={`Ime, telefon, OIB ili ${ctx.pkg.vocabulary.identifier.toLowerCase()}`} className="pl-9" />
      </form>
      {clients.length === 0 && !search && ctx.isOwner ? (
        // A new workshop starts with its existing customers, not from zero.
        <Link href="/app/clients/uvoz" className="flex items-center gap-4 rounded-2xl border border-accent/40 bg-accent/10 p-5 hover:border-accent">
          <Upload className="size-8 shrink-0 text-accent" />
          <span>
            <span className="block font-semibold">Imate mušterije u Excelu ili u imeniku mobitela?</span>
            <span className="block text-sm text-muted">Uvezite ih odjednom, s vozilima i telefonima. Ne morate ništa prepisivati.</span>
          </span>
        </Link>
      ) : clients.length === 0 ? (
        <EmptyState title={search ? 'Ništa nije pronađeno' : `Još nema unosa`}>Nova stranka se dodaje i sama pri otvaranju naloga.</EmptyState>
      ) : (
        <>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {clients.map((c, i) => (
            <li key={c.id}>
              {i === 0 || letter(clients[i - 1]) !== letter(c) ? (
                <p className="bg-surface2/60 px-4 py-1 text-xs font-semibold text-muted">{letter(c)}</p>
              ) : null}
              <Link prefetch={false} href={`/app/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface2 text-muted">
                  {c.kind === 'company' ? <Building2 className="size-4" /> : <User className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{listName(c)}</span>
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
        {more ? (
          <Link
            prefetch={false}
            href={`/app/clients?${new URLSearchParams({ ...(search ? { q: search } : {}), vise: String(pages + 1) }).toString()}`}
            className={cn(buttonClass('secondary'), 'mt-3 w-full')}
          >
            Prikaži još
          </Link>
        ) : null}
        </>
      )}
    </>
  );
}
