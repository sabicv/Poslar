import type { Metadata } from 'next';
import { ChevronRight, Plus } from 'lucide-react';
import { HourlyRateForm, TemplateEditor, type EditorTemplate } from '@/components/pricing/TemplateEditor';
import { BackLink, Badge, Button, Card, CardHeader, PageHeader } from '@/components/ui';
import { formatEuro } from '@/lib/format';
import { requireOwner } from '@/lib/session';
import { defaultLinePrice, linePrice, listTemplates, loadPriceBook, type TemplateEntry } from '@/lib/templates';

export const metadata: Metadata = { title: 'Cjenik' };

// The owner's prices: hourly rate, the trade's templates with his own
// prices, his own templates. Workers never get here (requireOwner).
export default async function PriceListPage() {
  const ctx = await requireOwner();
  const [templates, book] = await Promise.all([listTemplates(ctx, { includeHidden: true }), loadPriceBook(ctx.tenant.id)]);
  const inspections = ctx.pkg.inspections.map((i) => ({ code: i.code, name: i.name }));

  const toEditor = (t: TemplateEntry): EditorTemplate => ({
    code: t.code,
    name: t.name,
    inspection: t.inspection ?? null,
    kind: t.kind,
    changed: t.changed,
    hidden: t.hidden,
    lines: t.lines.map((l, i) => ({
      kind: l.kind,
      description: l.description,
      qty: l.qty,
      unit: l.unit,
      price: book.lines.get(`${t.code}#${i}`) ?? null,
      defaultPrice: t.kind === 'package' && !t.changed ? (l.price ?? null) : null,
    })),
  });
  const total = (t: TemplateEntry) => t.lines.reduce((s, l, i) => s + l.qty * (linePrice(t, i, book) ?? 0), 0);
  const ownPrices = (t: TemplateEntry) => t.lines.some((_, i) => book.lines.has(`${t.code}#${i}`));
  const missing = (t: TemplateEntry) => t.lines.some((_, i) => linePrice(t, i, book) === undefined && defaultLinePrice(t, i, book) === undefined);

  const own = templates.filter((t) => t.kind === 'own');
  const trade = templates.filter((t) => t.kind === 'package' && !t.hidden);
  const hidden = templates.filter((t) => t.hidden);

  const row = (t: TemplateEntry) => (
    <li key={t.code}>
      <TemplateEditor
        template={toEditor(t)}
        inspections={inspections}
        hourly={book.hourly}
        trigger={
          <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{t.name}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                {t.lines.length} {t.lines.length === 1 ? 'stavka' : t.lines.length < 5 ? 'stavke' : 'stavki'}
                {ownPrices(t) ? <Badge tone="accent">Vaše cijene</Badge> : null}
                {t.changed ? <Badge tone="neutral">Izmijenjeno</Badge> : null}
                {missing(t) ? <Badge tone="warn">bez cijene</Badge> : null}
              </span>
            </span>
            <span className="shrink-0 text-sm tabular">{formatEuro(total(t))}</span>
            <ChevronRight className="size-4 shrink-0 text-faint" />
          </button>
        }
      />
    </li>
  );

  return (
    <>
      <PageHeader title="Cjenik i predlošci" subtitle="Vaše cijene vidite samo Vi. Radnici vide stavke bez iznosa." back={<BackLink href="/app/settings">Postavke</BackLink>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Satnica" subtitle="Vrijedi za sav rad po satu u predlošcima i za novu stavku rada" />
            <div className="p-4">
              <HourlyRateForm hourly={book.hourly} />
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Vaši predlošci"
              subtitle="Poslovi koje radite na svoj način"
              action={
                <TemplateEditor
                  template={{ code: null, name: '', inspection: null, kind: 'own', changed: false, hidden: false, lines: [{ kind: 'labor', description: '', qty: 1, unit: 'h', price: null, defaultPrice: null }] }}
                  inspections={inspections}
                  hourly={book.hourly}
                  trigger={
                    <Button size="sm" variant="primary">
                      <Plus className="size-4" /> Novi
                    </Button>
                  }
                />
              }
            />
            {own.length ? (
              <ul className="divide-y divide-line">{own.map(row)}</ul>
            ) : (
              <p className="px-4 py-4 text-sm text-muted">Još nemate svojih. Dodajte „Novi” ili na nalogu, u Stavkama, dodirnite „Spremi kao predložak”.</p>
            )}
          </Card>
          {hidden.length ? (
            <Card>
              <CardHeader title="Skriveni" subtitle="Ne nude se na nalogu" />
              <ul className="divide-y divide-line">{hidden.map(row)}</ul>
            </Card>
          ) : null}
        </div>
        <Card>
          <CardHeader title={`Predlošci zanata (${ctx.pkg.short})`} subtitle="Dodirnite posao za svoje cijene ili izmjenu" />
          <ul className="divide-y divide-line">{trade.map(row)}</ul>
        </Card>
      </div>
    </>
  );
}
