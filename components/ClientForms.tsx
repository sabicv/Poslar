'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { ConfirmButton, DictateButton, DictateInput, MoreToggle, Segmented, Sheet, useAction } from '@/components/client-ui';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { DEVICE_TYPES, type AssetType, type MeterUnit } from '@/config/tenant.config';
import { ScanButton } from '@/components/ScanButton';
import { deleteAsset, deleteClient, saveAsset, saveClient } from '@/lib/actions/clients';
import { deleteSite, saveSite } from '@/lib/actions/field';
import type { Asset, Client, Site } from '@/types/db';

type ClientValues = Pick<Client, 'kind' | 'first_name' | 'last_name' | 'company_name' | 'oib' | 'phone' | 'email' | 'address' | 'city' | 'notes'>;

const filled = (...values: (string | null | undefined)[]) => values.some((x) => Boolean(x && String(x).trim()));

// A text field with a microphone beside it.
function DictatedTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-start gap-2">
      <Textarea rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <DictateButton compact onText={(text) => onChange(value ? `${value.trimEnd()} ${text}` : text)} />
    </div>
  );
}

// Core: who and how to reach them. A company doubles as a partner
// (another workshop, a dealer, an insurer). The rest: "Više polja".
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
  const [more, setMore] = useState(() => filled(client?.oib, client?.email, client?.address, client?.city, client?.notes, client?.kind === 'company' ? client?.first_name : null));
  const set = (key: keyof ClientValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [key]: e.target.value }));
  const company = v.kind === 'company';

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
        <Segmented value={v.kind} onChange={(kind) => setV((s) => ({ ...s, kind }))} options={[{ value: 'person', label: 'Osoba' }, { value: 'company', label: 'Tvrtka / suradnik' }]} />
        <div className="grid grid-cols-2 gap-3">
          {company ? (
            <Field label="Naziv tvrtke" className="col-span-2">
              <DictateInput value={v.company_name ?? ''} onValue={(company_name) => setV((s) => ({ ...s, company_name }))} />
            </Field>
          ) : (
            <>
              <Field label="Ime" className="col-span-2 sm:col-span-1">
                <DictateInput mode="name" value={v.first_name ?? ''} onValue={(first_name) => setV((s) => ({ ...s, first_name }))} />
              </Field>
              <Field label="Prezime" className="col-span-2 sm:col-span-1">
                <DictateInput mode="name" value={v.last_name ?? ''} onValue={(last_name) => setV((s) => ({ ...s, last_name }))} />
              </Field>
            </>
          )}
          <Field label="Telefon" className="col-span-2">
            <DictateInput mode="phone" type="tel" value={v.phone ?? ''} onValue={(phone) => setV((s) => ({ ...s, phone }))} />
          </Field>
          {more ? (
            <>
              {company ? (
                <>
                  <Field label="Ime kontakta">
                    <DictateInput mode="name" value={v.first_name ?? ''} onValue={(x) => setV((s) => ({ ...s, first_name: x }))} />
                  </Field>
                  <Field label="Prezime kontakta">
                    <DictateInput mode="name" value={v.last_name ?? ''} onValue={(x) => setV((s) => ({ ...s, last_name: x }))} />
                  </Field>
                </>
              ) : null}
              <Field label="OIB">
                <DictateInput mode="digits" inputMode="numeric" maxLength={11} value={v.oib ?? ''} onValue={(x) => setV((s) => ({ ...s, oib: x }))} />
              </Field>
              <Field label="E-mail">
                <DictateInput mode="email" type="email" value={v.email ?? ''} onValue={(x) => setV((s) => ({ ...s, email: x }))} />
              </Field>
              <Field label="Adresa">
                <DictateInput mode="text" value={v.address ?? ''} onValue={(x) => setV((s) => ({ ...s, address: x }))} />
              </Field>
              <Field label="Grad">
                <DictateInput mode="name" value={v.city ?? ''} onValue={(x) => setV((s) => ({ ...s, city: x }))} />
              </Field>
              <Field label="Napomena" className="col-span-2">
                <DictatedTextarea value={v.notes ?? ''} onChange={(notes) => setV((s) => ({ ...s, notes }))} />
              </Field>
            </>
          ) : null}
        </div>
        <MoreToggle open={more} onToggle={() => setMore((m) => !m)} />
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

// Core: plate or label, make, model (and where it is, on the road). The
// rest: "Više polja".
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
  const [more, setMore] = useState(() =>
    filled(asset?.vin, asset?.year?.toString(), asset?.engine_code, asset?.fuel, asset?.internal_number, asset?.paint_code, asset?.parent_asset_id, asset?.notes)
  );
  const set = (key: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [key]: e.target.value }));
  const unit = assetTypes.find((t) => t.value === v.asset_type)?.unit ?? 'km';
  // A vehicle is read from its registration certificate, a device from its nameplate.
  const device = assetTypes.some((t) => DEVICE_TYPES.includes(t.value));
  const fromPhoto = (d: Record<string, unknown>) => {
    const s = (k: string) => (typeof d[k] === 'string' && (d[k] as string).trim() ? (d[k] as string).trim() : null);
    setV((x) => ({
      ...x,
      identifier: (!device && s('identifier')) || x.identifier,
      make: s('make') ?? x.make,
      model: s('model') ?? x.model,
      year: d.year ? String(d.year) : x.year,
      vin: s('vin') ?? s('serial') ?? x.vin,
    }));
    if (d.year || s('vin') || s('serial')) setMore(true);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={title}
      action={<ScanButton kind={device ? 'plocica' : 'prometna'} label={device ? 'Slikaj natpisnu pločicu' : 'Slikaj prometnu dozvolu'} onResult={fromPhoto} />}
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
        {sites.length ? (
          <Field label="Lokacija" className="col-span-2">
            <Select value={v.site_id} onChange={set('site_id')}>
              <option value="">-</option>
              {sites.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Registracija / oznaka" className="col-span-2">
          <DictateInput mode={sites.length ? 'text' : 'plate'} value={v.identifier} className="font-mono uppercase" onValue={(x) => setV((s) => ({ ...s, identifier: x }))} />
        </Field>
        <Field label="Marka">
          <DictateInput mode="name" value={v.make} onValue={(x) => setV((s) => ({ ...s, make: x }))} />
        </Field>
        <Field label="Model">
          <DictateInput mode="name" value={v.model} onValue={(x) => setV((s) => ({ ...s, model: x }))} />
        </Field>
        {more ? (
          <>
            {assetTypes.length > 1 ? (
              <Field label="Vrsta" className="col-span-2">
                <Select value={v.asset_type} onChange={set('asset_type')}>
                  {assetTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Godište">
              <DictateInput mode="digits" inputMode="numeric" maxLength={4} value={v.year} onValue={(x) => setV((s) => ({ ...s, year: x }))} />
            </Field>
            <Field label="VIN / HIN / serijski">
              <DictateInput mode="vin" value={v.vin} className="font-mono uppercase" onValue={(x) => setV((s) => ({ ...s, vin: x }))} />
            </Field>
            <Field label="Oznaka motora">
              <DictateInput mode="vin" value={v.engine_code} onValue={(x) => setV((s) => ({ ...s, engine_code: x }))} />
            </Field>
            <Field label="Gorivo">
              <Select value={v.fuel} onChange={set('fuel')}>
                <option value="">-</option>
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
              <DictateInput mode="text" value={v.internal_number} onValue={(x) => setV((s) => ({ ...s, internal_number: x }))} />
            </Field>
            <Field label="Šifra boje">
              <DictateInput mode="vin" value={v.paint_code} onValue={(x) => setV((s) => ({ ...s, paint_code: x }))} />
            </Field>
            {parents.length ? (
              <Field label="Nadređeno vozilo (npr. tegljač za prikolicu)" className="col-span-2">
                <Select value={v.parent_asset_id} onChange={set('parent_asset_id')}>
                  <option value="">-</option>
                  {parents.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Napomena" className="col-span-2">
              <DictatedTextarea value={v.notes} onChange={(notes) => setV((s) => ({ ...s, notes }))} />
            </Field>
          </>
        ) : null}
        <MoreToggle open={more} onToggle={() => setMore((m) => !m)} className="col-span-2" />
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

// A place where the customer has devices. Core: address and how to get in;
// kind, name, postcode and a contact on site: "Više polja".
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
  const [more, setMore] = useState(() => filled(site?.label, site?.postal_code, site?.contact_name, site?.contact_phone));
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
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <Field label="Adresa">
            <DictateInput mode="text" value={v.address} onValue={(x) => setV((s) => ({ ...s, address: x }))} placeholder="Ulica i broj" />
          </Field>
          <Field label="Grad">
            <DictateInput mode="name" value={v.city} onValue={(x) => setV((s) => ({ ...s, city: x }))} />
          </Field>
        </div>
        <Field label="Upute za ulaz">
          <DictatedTextarea value={v.access_notes} onChange={(access_notes) => setV((s) => ({ ...s, access_notes }))} placeholder="Kat, šifra, ključ kod susjeda, pas…" />
        </Field>
        {more ? (
          <>
            <Segmented
              value={v.kind}
              onChange={(kind) => setV((s) => ({ ...s, kind }))}
              options={(['flat', 'house', 'apartment', 'office', 'commercial'] as SiteKind[]).map((k) => ({ value: k, label: SITE_KIND_LABELS[k].split(' ')[0] }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Naziv">
                <DictateInput mode="text" value={v.label} onValue={(x) => setV((s) => ({ ...s, label: x }))} placeholder="npr. Apartman 3" />
              </Field>
              <Field label="Poštanski broj">
                <DictateInput mode="digits" value={v.postal_code} onValue={(x) => setV((s) => ({ ...s, postal_code: x }))} inputMode="numeric" />
              </Field>
              <Field label="Osoba na lokaciji">
                <DictateInput mode="name" value={v.contact_name} onValue={(x) => setV((s) => ({ ...s, contact_name: x }))} />
              </Field>
              <Field label="Njezin telefon">
                <DictateInput mode="phone" type="tel" value={v.contact_phone} onValue={(x) => setV((s) => ({ ...s, contact_phone: x }))} />
              </Field>
            </div>
          </>
        ) : null}
        <MoreToggle open={more} onToggle={() => setMore((m) => !m)} />
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
