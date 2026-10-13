'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { Fold } from '@/components/Fold';
import { DeleteConfirm, DictateButton, DictateInput, Segmented, Sheet, useAction } from '@/components/client-ui';
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
// (another workshop, a dealer, an insurer). Address, OIB and notes are a row.
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
          <div className="col-span-2">
            <Fold
              title="Adresa i OIB"
              summary={[v.city, v.oib].filter(Boolean).join(' · ') || 'E-mail, adresa, napomena'}
              startOpen={filled(v.oib, v.email, v.address, v.city, v.notes, company ? v.first_name : null)}
              reveal={filled(v.oib, v.address, v.city)}
            >
              <div className="grid grid-cols-2 gap-3 p-4">
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
                <Field label="Adresa" className="col-span-2">
                  <DictateInput mode="text" value={v.address ?? ''} onValue={(x) => setV((s) => ({ ...s, address: x }))} />
                </Field>
                <Field label="Grad">
                  <DictateInput mode="name" value={v.city ?? ''} onValue={(x) => setV((s) => ({ ...s, city: x }))} />
                </Field>
                <Field label="Napomena" className="col-span-2">
                  <DictatedTextarea value={v.notes ?? ''} onChange={(notes) => setV((s) => ({ ...s, notes }))} />
                </Field>
              </div>
            </Fold>
          </div>
        </div>
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
        </div>
        {client && isOwner ? (
          <DeleteConfirm
            label="Obriši mušteriju"
            question="Obrisati ovu mušteriju?"
            detail="Brišu se i njezina vozila i uređaji, nalozi i slike. To se ne može vratiti. Mušterija s izdanim računima se ne briše."
            disabled={pending}
            className="w-full"
            onConfirm={() => run(() => deleteClient(client.id), { success: 'Mušterija obrisana', onDone: () => router.replace('/app/clients') })}
          />
        ) : null}
      </div>
    </Sheet>
  );
}

// Core: plate or label, make, model (and where it is, on the road).
// Year, VIN and the rest are one row.
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
        <div className="col-span-2">
          <Fold
            title="Godište, VIN i ostalo"
            summary={[v.year, v.vin].filter(Boolean).join(' · ') || 'Motor, gorivo, boja, napomena'}
            startOpen={filled(v.vin, v.year, v.engine_code, v.fuel, v.internal_number, v.paint_code, v.parent_asset_id, v.notes)}
            reveal={filled(v.vin, v.year)}
          >
            <div className="grid grid-cols-2 gap-3 p-4">
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
              <Field label="VIN / HIN / serijski" className="col-span-2">
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
            </div>
          </Fold>
        </div>
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
        </div>
        {asset && isOwner ? (
          <DeleteConfirm
            label="Obriši"
            question="Obrisati ovo, zajedno s nalozima?"
            detail="Brišu se i njegovi nalozi i slike. To se ne može vratiti. Ako ima izdanih računa, ne briše se."
            disabled={pending}
            className="w-full"
            onConfirm={() => run(() => deleteAsset(asset.id), { success: 'Obrisano', onDone: () => router.replace(`/app/clients/${clientId}`) })}
          />
        ) : null}
      </div>
    </Sheet>
  );
}

type SiteKind = 'house' | 'flat' | 'apartment' | 'office' | 'commercial' | 'other';
export const SITE_KIND_LABELS: Record<SiteKind, string> = { flat: 'Stan', house: 'Kuća', apartment: 'Apartman', office: 'Ured', commercial: 'Poslovni prostor', other: 'Ostalo' };

// A place where the customer has devices. Core: address and how to get in.
// Kind, name, postcode and a contact on site are one row.
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
        <Fold
          title="Naziv i kontakt"
          summary={[v.label, v.contact_name].filter(Boolean).join(' · ') || 'Vrsta prostora, pošta, osoba na lokaciji'}
          startOpen={filled(v.label, v.postal_code, v.contact_name, v.contact_phone)}
        >
          <div className="space-y-3 p-4">
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
          </div>
        </Fold>
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
        </div>
        {site && isOwner ? (
          <DeleteConfirm
            label="Obriši lokaciju"
            question="Obrisati ovu lokaciju?"
            disabled={pending}
            className="w-full"
            onConfirm={() => run(() => deleteSite(site.id, clientId), { success: 'Obrisano', onDone: () => setOpen(false) })}
          />
        ) : null}
      </div>
    </Sheet>
  );
}
