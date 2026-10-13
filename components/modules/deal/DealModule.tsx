import { CarFront, KeyRound, Wallet } from 'lucide-react';
import { billingFrom } from '@/components/invoice/InvoiceDocument';
import { Badge, Button, Card, CardHeader, KeyValue } from '@/components/ui';
import { DEAL_SOURCES, daysOnLot, dealMargin, stockTone } from '@/config/packages/deal';
import { formatDate, formatDateTime, formatEuro } from '@/lib/format';
import { todayInZagreb } from '@/lib/time';
import type { ModuleProps } from '../ModuleTab';
import { Offer, foldable } from '../more';
import { DeleteRecordButton, PrivateAmountSheet, RecordButton, RecordSheet } from '../kit';
import { opts } from '../options';

export async function DealModule({ ctx, job, locked, extras }: ModuleProps) {
  const path = `/app/jobs/${job.id}`;
  const s = ctx.supabase;
  const [{ data: stock }, { data: drives }, { data: amounts }, { data: totals }] = await Promise.all([
    s.from('deal_stock').select('*').eq('job_id', job.id).maybeSingle(),
    s.from('deal_test_drives').select('*, staff:profiles(full_name)').eq('asset_id', job.asset.id).order('out_at', { ascending: false }).limit(20),
    // Owner only: a worker's read comes back empty (RLS).
    ctx.isOwner ? s.from('private_amounts').select('field, amount').eq('entity', 'deal_stock').eq('entity_id', job.id) : Promise.resolve({ data: [] as { field: string; amount: number }[] }),
    ctx.isOwner ? s.from('job_totals').select('net_total, gross_total').eq('job_id', job.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const amount = (field: string) => {
    const row = (amounts ?? []).find((a) => a.field === field);
    return row ? Number(row.amount) : null;
  };
  const purchase = amount('purchase');
  const lowest = amount('lowest');
  const sale = amount('sale');
  const vat = billingFrom(ctx.tenant.settings).vatRegistered;
  const costs = totals ? Number(vat ? totals.net_total : totals.gross_total) : 0;
  const margin = dealMargin(sale, purchase, costs);

  const today = todayInZagreb();
  const days = stock ? daysOnLot(stock.purchased_on as string, (stock.sold_on as string | null) ?? null, today) : 0;
  const openDrive = (drives ?? []).find((d) => !d.back_at);
  const { show, open } = foldable(extras);
  const showDrives = show('probne vožnje', (drives ?? []).length > 0 || job.phase === 'ready');

  const stockFields = [
    { name: 'source', label: 'Odakle je', type: 'select' as const, options: opts(DEAL_SOURCES), required: true },
    { name: 'purchased_on', label: 'Otkupljeno', type: 'date' as const, half: true, required: true },
    { name: 'keys_count', label: 'Ključeva', type: 'number' as const, suffix: 'kom', half: true },
    { name: 'registered_until', label: 'Registrirano do', type: 'date' as const, half: true },
    { name: 'service_book', label: 'Ima servisnu knjižicu', type: 'checkbox' as const },
    { name: 'notes', label: 'Napomena', type: 'textarea' as const },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <CarFront className="size-4 text-accent" /> Otkup i prodaja
            </span>
          }
          subtitle={stock ? (stock.sold_on ? `Prodano ${formatDate(stock.sold_on as string)}` : `Na placu od ${formatDate(stock.purchased_on as string)}`) : 'Kad je otkupljeno i po kojoj se cijeni nudi'}
          action={stock && !locked ? <RecordSheet table="deal_stock" title="Otkup" upsertOn="job_id" revalidate={path} fixed={{ job_id: job.id, asset_id: job.asset.id }} initial={stock} label="Uredi" fields={stockFields} /> : null}
        />
        <div className="p-4">
          {!stock ? (
            !locked ? (
              <RecordSheet
                table="deal_stock"
                title="Otkup"
                upsertOn="job_id"
                revalidate={path}
                fixed={{ job_id: job.id, asset_id: job.asset.id }}
                initial={{ source: 'private', purchased_on: today, keys_count: 2 }}
                fields={stockFields}
                trigger={
                  <Button variant="primary" size="lg" className="w-full">
                    <CarFront className="size-5" /> Upiši otkup
                  </Button>
                }
              />
            ) : (
              <p className="text-sm text-muted">Otkup nije upisan.</p>
            )
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={stock.sold_on ? 'muted' : stockTone(days)}>
                  {days} {days === 1 ? 'dan' : 'dana'} {stock.sold_on ? 'do prodaje' : 'na placu'}
                </Badge>
                <Badge tone="neutral">{DEAL_SOURCES[stock.source as string]}</Badge>
                {stock.reserved_by && !stock.sold_on ? <Badge tone="warn">Rezervirano: {stock.reserved_by as string}{stock.reserved_until ? ` do ${formatDate(stock.reserved_until as string)}` : ''}</Badge> : null}
                {stock.sold_on ? <Badge tone="ok">Prodano</Badge> : null}
              </div>
              <div className="grid gap-x-8 sm:grid-cols-2">
                <KeyValue label="Cijena u oglasu">{stock.asking_price != null ? formatEuro(Number(stock.asking_price)) : '-'}</KeyValue>
                <KeyValue label="Oglas">
                  {stock.ad_url ? (
                    <a href={stock.ad_url as string} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      Otvori oglas{stock.listed_on ? ` (od ${formatDate(stock.listed_on as string)})` : ''}
                    </a>
                  ) : stock.listed_on ? (
                    `Objavljen ${formatDate(stock.listed_on as string)}`
                  ) : (
                    'Nije objavljen'
                  )}
                </KeyValue>
                <KeyValue label="Ključevi / knjižica">{`${stock.keys_count ?? '-'} kom / ${stock.service_book ? 'ima' : 'nema'}`}</KeyValue>
                <KeyValue label="Registrirano do">{formatDate(stock.registered_until as string | null)}</KeyValue>
                {stock.sold_on ? (
                  <KeyValue label="Kupac">{[stock.buyer_name, stock.buyer_phone].filter(Boolean).join(', ') || '-'}{stock.warranty_months ? ` · jamstvo ${stock.warranty_months} mj.` : ''}</KeyValue>
                ) : null}
              </div>

              {!locked ? (
                <div className="flex flex-wrap gap-2">
                  <RecordSheet
                    table="deal_stock"
                    title="Oglas"
                    upsertOn="job_id"
                    revalidate={path}
                    fixed={{ job_id: job.id, asset_id: job.asset.id }}
                    initial={{ listed_on: stock.listed_on ?? today, asking_price: stock.asking_price, ad_url: stock.ad_url }}
                    label="Oglas"
                    fields={[
                      { name: 'asking_price', label: 'Cijena u oglasu', type: 'number', suffix: '€', half: true, required: true },
                      { name: 'listed_on', label: 'Objavljen', type: 'date', half: true },
                      { name: 'ad_url', label: 'Poveznica na oglas', placeholder: 'https://' },
                    ]}
                  />
                  {!stock.sold_on ? (
                    <RecordSheet
                      table="deal_stock"
                      title="Rezervacija"
                      upsertOn="job_id"
                      revalidate={path}
                      fixed={{ job_id: job.id, asset_id: job.asset.id }}
                      initial={{ reserved_by: stock.reserved_by, reserved_until: stock.reserved_until }}
                      label="Rezervacija"
                      fields={[
                        { name: 'reserved_by', label: 'Za koga', half: true },
                        { name: 'reserved_until', label: 'Do', type: 'date', half: true },
                      ]}
                    />
                  ) : null}
                  <RecordSheet
                    table="deal_stock"
                    title="Prodaja"
                    upsertOn="job_id"
                    revalidate={path}
                    fixed={{ job_id: job.id, asset_id: job.asset.id }}
                    initial={{ sold_on: stock.sold_on ?? today, buyer_name: stock.buyer_name, buyer_phone: stock.buyer_phone, buyer_oib: stock.buyer_oib, warranty_months: stock.warranty_months }}
                    label={stock.sold_on ? 'Podaci o prodaji' : 'Prodano'}
                    fields={[
                      { name: 'sold_on', label: 'Datum prodaje', type: 'date', half: true, required: true },
                      { name: 'warranty_months', label: 'Jamstvo', type: 'number', suffix: 'mj.', half: true },
                      { name: 'buyer_name', label: 'Kupac', required: true },
                      { name: 'buyer_phone', label: 'Telefon kupca', half: true },
                      { name: 'buyer_oib', label: 'OIB kupca', half: true },
                    ]}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Card>

      {/* Money: the owner's eyes only */}
      {ctx.isOwner && stock ? (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Wallet className="size-4 text-accent" /> Zarada
              </span>
            }
            subtitle="Vidite samo Vi, radnici ne"
          />
          <div className="grid gap-x-8 p-4 sm:grid-cols-2">
            <KeyValue label="Otkupna cijena">
              <PrivateAmountSheet entity="deal_stock" entityId={job.id} field="purchase" title="Otkupna cijena" amount={purchase} revalidate={path} />
            </KeyValue>
            <KeyValue label="Najniža cijena">
              <PrivateAmountSheet entity="deal_stock" entityId={job.id} field="lowest" title="Najniža cijena za koju prodajete" amount={lowest} revalidate={path} />
            </KeyValue>
            <KeyValue label={vat ? 'Troškovi pripreme (bez PDV-a)' : 'Troškovi pripreme'}>{formatEuro(costs)}</KeyValue>
            <KeyValue label="Prodajna cijena">
              <PrivateAmountSheet entity="deal_stock" entityId={job.id} field="sale" title="Prodajna cijena" amount={sale} revalidate={path} />
            </KeyValue>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
            <span className="text-sm text-muted">{margin !== null ? 'Zarada na vozilu' : 'Očekivana zarada po cijeni iz oglasa'}</span>
            {margin !== null ? (
              <span className={`text-lg font-semibold tabular ${margin < 0 ? 'text-crit' : 'text-ok'}`}>{formatEuro(margin)}</span>
            ) : purchase === null ? (
              <span className="text-sm text-faint">Upišite otkupnu cijenu</span>
            ) : stock.asking_price == null ? (
              <span className="text-sm text-faint">Upišite cijenu u oglasu</span>
            ) : (
              <span className="text-lg font-semibold tabular text-muted">{formatEuro(dealMargin(Number(stock.asking_price), purchase, costs))}</span>
            )}
          </div>
        </Card>
      ) : null}

      {/* Test drives */}
      {showDrives ? (
        <Offer title="Probne vožnje" summary={(drives ?? []).length ? `${(drives ?? []).length}` : 'Tko je vozio, s brojem vozačke'} filled={open('probne vožnje')}>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <KeyRound className="size-4 text-accent" /> Probne vožnje
              </span>
            }
            subtitle="Tko je vozio, s brojem vozačke"
            action={
              !locked && !openDrive ? (
                <RecordSheet
                  table="deal_test_drives"
                  title="Probna vožnja"
                  revalidate={path}
                  fixed={{ job_id: job.id, asset_id: job.asset.id, out_at: '__now__' }}
                  label="Vožnja"
                  fields={[
                    { name: 'driver_name', label: 'Ime i prezime', required: true },
                    { name: 'driver_phone', label: 'Telefon', half: true },
                    { name: 'licence_no', label: 'Broj vozačke', half: true },
                    { name: 'note', label: 'Napomena', type: 'textarea' },
                  ]}
                />
              ) : null
            }
          />
          {openDrive && !locked ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-warn/10 px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{openDrive.driver_name as string}</span> vozi od {formatDateTime(openDrive.out_at as string)}
              </span>
              <RecordButton table="deal_test_drives" id={openDrive.id as string} revalidate={path} variant="primary" size="sm" values={{ back_at: '__now__' }} success="Vozilo je vraćeno">
                Vraćeno
              </RecordButton>
            </div>
          ) : null}
          {(drives ?? []).length ? (
            <ul className="divide-y divide-line">
              {(drives ?? []).map((d) => (
                <li key={d.id as string} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                  <span className="w-32 shrink-0 text-xs text-faint">{formatDateTime(d.out_at as string)}</span>
                  <span className="font-medium">{d.driver_name as string}</span>
                  <span className="text-xs text-muted">{[d.driver_phone, d.licence_no && `vozačka ${d.licence_no}`].filter(Boolean).join(' · ')}</span>
                  {d.back_at ? <Badge tone="ok">Vraćeno</Badge> : <Badge tone="warn">Vozi</Badge>}
                  {ctx.isOwner && !locked ? (
                    <span className="ml-auto">
                      <DeleteRecordButton table="deal_test_drives" id={d.id as string} revalidate={path} label="×" />
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">Nema probnih vožnji.</p>
          )}
        </Card>
        </Offer>
      ) : null}
    </div>
  );
}
