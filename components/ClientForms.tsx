'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { ConfirmButton, Segmented, Sheet, useAction } from '@/components/client-ui';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import type { AssetType, MeterUnit } from '@/config/tenant.config';
import { deleteAsset, deleteClient, saveAsset, saveClient } from '@/lib/actions/clients';
import { deleteSite, saveSite } from '@/lib/actions/field';
import type { Asset, Client, Site } from '@/types/db';

type ClientValues = Pick<Client, 'kind' | 'first_name' | 'last_name' | 'company_name' | 'oib' | 'phone' | 'email' | 'address' | 'city' | 'notes'>;

export function ClientSheet({ client, title, isOwner }: { client?: Client; title: string; isOwner?: boolean }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<ClientValues>({
    kind: client?.kind ?? 'person',
    first_name: client?.first_name ?? '',
    last_name: client?.last_name ?? '',
    company_name: client?.company_name ?? '',
    oib: client?.oib ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    address: client?.address ?? '',
    city: client?.city ?? '',
    notes: client?.notes ?? '',
  });
  const set = (key: keyof ClientValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [key]: e.target.value }));

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={title}
      trigger={
        client ? (
          <Button size="sm">
            <Pencil className="size-4" /> Uredi
          </Button>
        ) : (
          <Button variant="primary">
            <Plus className="size-4" /> {title}
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <Segmented value={v.kind} onChange={(kind) => setV((s) => ({ ...s, kind }))} options={[{ value: 'person', label: 'Osoba' }, { value: 'company', label: 'Tvrtka' }]} />
        {v.kind === 'company' ? (
          <Field label="Naziv tvrtke">
            <Input value={v.company_name ?? ''} onChange={set('company_name')} />
          </Field>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label={v.kind === 'company' ? 'Kontakt — ime' : 'Ime'}>
            <Input value={v.first_name ?? ''} onChange={set('first_name')} />
          </Field>
          <Field label={v.kind === 'company' ? 'Kontakt — prezime' : 'Prezime'}>
            <Input value={v.last_name ?? ''} onChange={set('last_name')} />
          </Field>
          <Field label="Telefon">
            <Input type="tel" value={v.phone ?? ''} onChange={set('phone')} />
          </Field>
          <Field label="OIB">
            <Input inputMode="numeric" maxLength={11} value={v.oib ?? ''} onChange={set('oib')} />
          </Field>
          <Field label="E-mail" className="col-span-2">
            <Input type="email" value={v.email ?? ''} onChange={set('email')} />
          </Field>
          <Field label="Adresa">
            <Input value={v.address ?? ''} onChange={set('address')} />
          </Field>
          <Field label="Grad">
            <Input value={v.city ?? ''} onChange={set('city')} />
          </Field>
        </div>
        <Field label="Napomena">
          <Textarea rows={2} value={v.notes ?? ''} onChange={set('notes')} />
        </Field>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={pending}
            onClick={() =>
              run(() => saveClient(client?.id ?? null, v), {
                success: 'Spremljeno',
                onDone: (data) => {
                  setOpen(false);
                  if (!client && data?.id) router.push(`/app/clients/${data.id}`);
                },
              })
            }
          >
            Spremi
          </Button>
          {client && isOwner ? (
            <ConfirmButton size="lg" confirmLabel="Obrisati sve?" onConfirm={() => run(() => deleteClient(client.id), { success: 'Obrisano', onDone: () => router.replace('/app/clients') })}>
              Obriši
            </ConfirmButton>
          ) : null}
        </div>
        {client && isOwner ? <p className="text-xs text-faint">Brisanjem se brišu i svi objekti, nalozi i fotografije ove stranke.</p> : null}
      </div>
    </Sheet>
  );
}

export function AssetSheet({
  clientId,
  asset,
  assetTypes,
  parents,
  sites = [],
  title,
  isOwner,
}: {
  clientId: string;
  asset?: Asset;
  assetTypes: { value: AssetType; label: string; unit: MeterUnit }[];
  parents: { value: string; label: string }[];
  sites?: { value: string; label: string }[];
  title: string;
  isOwner?: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    asset_type: asset?.asset_type ?? assetTypes[0]?.value ?? 'car',
    identifier: asset?.identifier ?? '',
    vin: asset?.vin ?? '',
    make: asset?.make ?? '',
    model: asset?.model ?? '',
    variant: asset?.variant ?? '',
    year: asset?.year?.toString() ?? '',
    engine_code: asset?.engine_code ?? '',
    fuel: asset?.fuel ?? '',
    internal_number: asset?.internal_number ?? '',
    paint_code: asset?.paint_code ?? '',
    parent_asset_id: asset?.parent_asset_id ?? '',
    site_id: asset?.site_id ?? (sites.length === 1 ? sites[0].value : ''),
    notes: asset?.notes ?? '',
  });
  const set = (key: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [key]: e.target.value }));
  const unit = assetTypes.find((t) => t.value === v.asset_type)?.unit ?? 'km';

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={title}
      trigger={
        asset ? (
          <Button size="sm">
            <Pencil className="size-4" /> Uredi
          </Button>
        ) : (
          <Button size="sm" variant="secondary">
            <Plus className="size-4" /> {title}
          </Button>
        )
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vrsta" className="col-span-2">
          <Select value={v.asset_type} onChange={set('asset_type')}>
            {assetTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        {sites.length ? (
          <Field label="Lokacija" className="col-span-2">
            <Select value={v.site_id} onChange={set('site_id')}>
              <option value="">—</option>
              {sites.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Registracija / oznaka">
          <Input value={v.identifier} className="font-mono uppercase" onChange={set('identifier')} />
        </Field>
        <Field label="Godište">
          <Input inputMode="numeric" maxLength={4} value={v.year} onChange={set('year')} />
        </Field>
        <Field label="Marka">
          <Input value={v.make} onChange={set('make')} />
        </Field>
        <Field label="Model">
          <Input value={v.model} onChange={set('model')} />
        </Field>
        <Field label="VIN / HIN / serijski" className="col-span-2">
          <Input value={v.vin} className="font-mono uppercase" onChange={set('vin')} />
        </Field>
        <Field label="Oznaka motora">
          <Input value={v.engine_code} onChange={set('engine_code')} />
        </Field>
        <Field label="Gorivo">
          <Select value={v.fuel} onChange={set('fuel')}>
            <option value="">—</option>
            <option value="petrol">Benzin</option>
            <option value="diesel">Dizel</option>
            <option value="hybrid">Hibrid</option>
            <option value="plugin">Plug-in hibrid</option>
            <option value="electric">Električni</option>
            <option value="lpg">Plin (LPG)</option>
            <option value="cng">CNG</option>
          </Select>
        </Field>
        <Field label="Interni / garažni broj">
          <Input value={v.internal_number} onChange={set('internal_number')} />
        </Field>
        <Field label="Šifra boje">
          <Input value={v.paint_code} onChange={set('paint_code')} />
        </Field>
        {parents.length ? (
          <Field label="Nadređeno vozilo (npr. tegljač za prikolicu)" className="col-span-2">
            <Select value={v.parent_asset_id} onChange={set('parent_asset_id')}>
              <option value="">—</option>
              {parents.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Napomena" className="col-span-2">
          <Textarea rows={2} value={v.notes} onChange={set('notes')} />
        </Field>
        <p className="col-span-2 text-xs text-faint">Brojilo: {unit === 'mth' ? 'motosati' : 'kilometri'}</p>
        <div className="col-span-2 flex gap-2">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  saveAsset(asset?.id ?? null, {
                    client_id: clientId,
                    asset_type: v.asset_type as AssetType,
                    identifier: v.identifier,
                    vin: v.vin,
                    make: v.make,
                    model: v.model,
                    variant: v.variant,
                    year: v.year ? Number(v.year) : null,
                    engine_code: v.engine_code,
                    fuel: (v.fuel || null) as never,
                    internal_number: v.internal_number,
                    paint_code: v.paint_code,
                    parent_asset_id: v.parent_asset_id || null,
                    site_id: v.site_id || null,
                    meter_primary_unit: asset?.meter_primary_unit ?? unit,
                    notes: v.notes,
                  }),
                { success: 'Spremljeno', onDone: () => setOpen(false) }
              )
            }
          >
            Spremi
          </Button>
          {asset && isOwner ? (
            <ConfirmButton size="lg" confirmLabel="Obrisati s nalozima?" onConfirm={() => run(() => deleteAsset(asset.id), { success: 'Obrisano', onDone: () => router.replace(`/app/clients/${clientId}`) })}>
              Obriši
            </ConfirmButton>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}

type SiteKind = 'house' | 'flat' | 'apartment' | 'office' | 'commercial' | 'other';
export const SITE_KIND_LABELS: Record<SiteKind, string> = { flat: 'Stan', house: 'Kuća', apartment: 'Apartman', office: 'Ured', commercial: 'Poslovni prostor', other: 'Ostalo' };

// A place where the customer has devices: address, how to get in, who opens.
export function SiteSheet({ clientId, site, isOwner }: { clientId: string; site?: Site; isOwner?: boolean }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    label: site?.label ?? '',
    kind: (site?.kind ?? 'flat') as SiteKind,
    address: site?.address ?? '',
    city: site?.city ?? '',
    postal_code: site?.postal_code ?? '',
    access_notes: site?.access_notes ?? '',
    contact_name: site?.contact_name ?? '',
    contact_phone: site?.contact_phone ?? '',
  });
  const set = (key: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [key]: e.target.value }));

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={site ? 'Lokacija' : 'Nova lokacija'}
      trigger={
        site ? (
          <Button size="sm" variant="ghost" aria-label="Uredi lokaciju">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm" variant="secondary">
            <Plus className="size-4" /> Lokacija
          </Button>
        )
      }
    >
      <div className="space-y-3">
        <Segmented
          value={v.kind}
          onChange={(kind) => setV((s) => ({ ...s, kind }))}
          options={(['flat', 'house', 'apartment', 'office', 'commercial'] as SiteKind[]).map((k) => ({ value: k, label: SITE_KIND_LABELS[k].split(' ')[0] }))}
        />
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <Field label="Adresa">
            <Input value={v.address} onChange={set('address')} placeholder="Ulica i broj" />
          </Field>
          <Field label="Grad">
            <Input value={v.city} onChange={set('city')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Naziv (nije obavezno)">
            <Input value={v.label} onChange={set('label')} placeholder="npr. Apartman 3" />
          </Field>
          <Field label="Poštanski broj">
            <Input value={v.postal_code} onChange={set('postal_code')} inputMode="numeric" />
          </Field>
        </div>
        <Field label="Upute za ulaz">
          <Textarea rows={2} value={v.access_notes} onChange={set('access_notes')} placeholder="Kat, šifra ulaza, ključ kod susjeda, parking, pas…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Osoba na lokaciji">
            <Input value={v.contact_name} onChange={set('contact_name')} />
          </Field>
          <Field label="Njezin telefon">
            <Input type="tel" value={v.contact_phone} onChange={set('contact_phone')} />
          </Field>
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={pending || v.address.trim().length < 3}
            onClick={() => run(() => saveSite(site?.id ?? null, { ...v, client_id: clientId }), { success: 'Lokacija spremljena', onDone: () => setOpen(false) })}
          >
            Spremi
          </Button>
          {site && isOwner ? (
            <ConfirmButton size="lg" confirmLabel="Obrisati lokaciju?" onConfirm={() => run(() => deleteSite(site.id, clientId), { success: 'Obrisano', onDone: () => setOpen(false) })}>
              Obriši
            </ConfirmButton>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
