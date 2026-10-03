'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Check, ChevronDown, MapPin, Search, User, X } from 'lucide-react';
import { DictateButton, DictateInput, Segmented } from '@/components/client-ui';
import { ScanButton } from '@/components/ScanButton';
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { CLIMATE_TYPES, type AssetType, type MeterUnit, type Vocabulary } from '@/config/tenant.config';
import { createJob } from '@/lib/actions/jobs';
import { searchClients, type ClientHit } from '@/lib/actions/clients';
import { clearDraft, readDraft, writeDraft } from '@/lib/drafts';
import { assetTitle, clientName } from '@/lib/format';
import { cn } from '@/lib/utils';

const DRAFT_KEY = 'draft:new-job';

type SiteKind = 'house' | 'flat' | 'apartment' | 'office' | 'commercial' | 'other';
const SITE_KINDS: { value: SiteKind; label: string }[] = [
  { value: 'flat', label: 'Stan' },
  { value: 'house', label: 'Kuća' },
  { value: 'apartment', label: 'Apartman' },
  { value: 'office', label: 'Ured' },
  { value: 'commercial', label: 'Poslovni' },
];

export interface NewJobPreset {
  client: ClientHit;
  assetId: string | null;
  siteId: string | null;
  planId: string | null;
  templateCode: string | null;
  complaint: string | null;
}

export interface FieldOptions {
  enabled: boolean;
  defaultMode: 'workshop' | 'field';
  staff: { id: string; name: string }[];
  me: string;
  isOwner: boolean;
}

// Intake in three blocks: who, what (object), what to do. Everything a
// small workshop rarely needs sits behind one "Više podataka" button.
export function NewJobForm({
  vocabulary,
  assetTypes,
  defaultAssetType,
  symptoms,
  templates,
  isFleet,
  preset,
  field,
}: {
  vocabulary: Vocabulary;
  assetTypes: { value: AssetType; label: string; unit: MeterUnit }[];
  defaultAssetType: AssetType;
  symptoms: string[];
  templates: { code: string; name: string }[];
  isFleet: boolean;
  preset: NewJobPreset | null;
  field: FieldOptions;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [mode, setMode] = useState<'workshop' | 'field'>(field.enabled ? field.defaultMode : 'workshop');
  const [more, setMore] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [client, setClient] = useState<ClientHit | null>(preset?.client ?? null);
  const [assetId, setAssetId] = useState<string | null>(preset?.assetId ?? null);
  const [siteId, setSiteId] = useState<string | null>(preset?.siteId ?? (preset?.client.sites?.length === 1 ? preset.client.sites[0].id : null));
  const [newSite, setNewSite] = useState({ address: '', city: '', kind: 'flat' as SiteKind, accessNotes: '' });
  const [newClient, setNewClient] = useState({ kind: (isFleet ? 'company' : 'person') as 'person' | 'company', name: '', companyName: '', phone: '', oib: '' });
  const [newAsset, setNewAsset] = useState({ assetType: defaultAssetType, identifier: '', make: '', model: '', year: '', vin: '' });
  const [complaint, setComplaint] = useState(preset?.complaint ?? '');
  const [picked, setPicked] = useState<string[]>([]);
  const [meterIn, setMeterIn] = useState('');
  const [templateCode, setTemplateCode] = useState(preset?.templateCode ?? '');
  const [isUrgent, setIsUrgent] = useState(false);
  const [promisedAt, setPromisedAt] = useState('');
  const [source, setSource] = useState<'workshop' | 'phone' | 'field'>('workshop');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('08:00');
  const [duration, setDuration] = useState('60');
  const [tech, setTech] = useState(field.isOwner ? '' : field.me);
  const restored = useRef(false);
  const isField = mode === 'field';
  // Road vehicles have a registration certificate to photograph; devices have a nameplate.
  const vehicles = !CLIMATE_TYPES.includes(defaultAssetType);

  // Unsaved intake survives a closed tab or a dead battery.
  useEffect(() => {
    if (restored.current || preset) return;
    restored.current = true;
    const draft = readDraft<{ complaint: string; picked: string[]; newClient: typeof newClient; newAsset: typeof newAsset; meterIn: string; newSite?: typeof newSite }>(DRAFT_KEY);
    if (draft) {
      setComplaint(draft.complaint ?? '');
      setPicked(draft.picked ?? []);
      if (draft.newClient && 'name' in draft.newClient) setNewClient(draft.newClient);
      if (draft.newAsset) setNewAsset(draft.newAsset);
      if (draft.newSite) setNewSite(draft.newSite);
      setMeterIn(draft.meterIn ?? '');
    }
  }, [preset]);

  useEffect(() => {
    if (!restored.current) return;
    writeDraft(DRAFT_KEY, { complaint, picked, newClient, newAsset, meterIn, newSite });
  }, [complaint, picked, newClient, newAsset, meterIn, newSite]);

  useEffect(() => {
    if (client || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        setHits(await searchClients(query));
      } catch {
        setHits([]);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, client]);

  const sites = client?.sites ?? [];
  const usingNewSite = isField && (!client || siteId === null);
  // On the road, show only the devices at the chosen address.
  const visibleAssets = !client ? [] : isField ? (usingNewSite ? [] : client.assets.filter((a) => a.site_id === siteId || a.site_id === null)) : client.assets;
  const selectedAsset = client?.assets.find((a) => a.id === assetId) ?? null;
  const meterUnit: MeterUnit = selectedAsset?.meter_primary_unit ?? assetTypes.find((t) => t.value === newAsset.assetType)?.unit ?? 'km';

  function pickClient(hit: ClientHit) {
    setClient(hit);
    const onlySite = (hit.sites ?? []).length === 1 ? hit.sites[0].id : null;
    setSiteId(onlySite);
    const candidates = isField && onlySite ? hit.assets.filter((a) => a.site_id === onlySite || a.site_id === null) : hit.assets;
    setAssetId(candidates.length === 1 ? candidates[0].id : null);
    setQuery('');
    setHits([]);
  }

  function chooseSite(id: string | null) {
    setSiteId(id);
    const candidates = client && id ? client.assets.filter((a) => a.site_id === id || a.site_id === null) : [];
    setAssetId(candidates.length === 1 ? candidates[0].id : null);
  }

  // A photo of the registration certificate: a known vehicle is picked
  // with its owner, a new one fills the client and vehicle fields.
  async function fromRegistration(d: Record<string, unknown>) {
    const s = (k: string) => (typeof d[k] === 'string' && (d[k] as string).trim() ? (d[k] as string).trim() : '');
    const plate = s('identifier');
    if (plate) {
      const compact = plate.replace(/[\s-]/g, '').toUpperCase();
      const known = (await searchClients(plate).catch(() => [])).find((h) => h.assets.some((a) => (a.identifier ?? '').replace(/[\s-]/g, '').toUpperCase() === compact));
      if (known) {
        pickClient(known);
        setAssetId(known.assets.find((a) => (a.identifier ?? '').replace(/[\s-]/g, '').toUpperCase() === compact)!.id);
        toast.success(`${plate} već postoji: ${clientName(known)}`);
        return;
      }
    }
    const company = s('company_name');
    setNewClient((c) => ({
      ...c,
      kind: company ? 'company' : 'person',
      companyName: company || c.companyName,
      name: [s('first_name'), company ? '' : s('last_name')].filter(Boolean).join(' ') || c.name,
      oib: /^\d{11}$/.test(s('oib')) ? s('oib') : c.oib,
    }));
    setNewAsset((a) => ({
      ...a,
      identifier: plate || a.identifier,
      make: s('make') || a.make,
      model: s('model') || a.model,
      year: d.year ? String(d.year) : a.year,
      vin: s('vin') || a.vin,
    }));
    // OIB, VIN and year live behind "Više podataka": open it so they show.
    if (s('vin') || d.year || s('oib')) setMore(true);
  }

  function useQueryAsNew() {
    const text = query.trim();
    // A plate-looking query becomes the identifier, anything else the name.
    if (!isField && /\d/.test(text) && text.length <= 12) setNewAsset((a) => ({ ...a, identifier: text.toUpperCase() }));
    else if (newClient.kind === 'company') setNewClient((c) => ({ ...c, companyName: text }));
    else setNewClient((c) => ({ ...c, name: text }));
    setQuery('');
    setHits([]);
  }

  function submit() {
    const fullComplaint = [picked.join(', '), complaint.trim()].filter(Boolean).join('. ');
    // One "Ime i prezime" field; the last word is the surname.
    const words = newClient.name.trim().split(/\s+/).filter(Boolean);
    const person = { firstName: words.length > 1 ? words.slice(0, -1).join(' ') : words[0] ?? '', lastName: words.length > 1 ? words[words.length - 1] : '' };
    start(async () => {
      const result = await createJob({
        clientId: client?.id ?? null,
        newClient: client ? null : { kind: newClient.kind, firstName: person.firstName, lastName: person.lastName, companyName: newClient.companyName, phone: newClient.phone, oib: newClient.oib },
        assetId,
        newAsset: assetId ? null : { ...newAsset, year: newAsset.year ? Number(newAsset.year) : null },
        complaint: fullComplaint,
        meterIn: !isField && meterIn ? Number(meterIn.replace(/\s/g, '').replace(',', '.')) : null,
        templateCode: templateCode || null,
        isUrgent,
        promisedAt: !isField && promisedAt ? new Date(promisedAt).toISOString() : null,
        source,
        field: isField
          ? {
              siteId: usingNewSite ? null : siteId,
              newSite: usingNewSite ? newSite : null,
              scheduledStart: date ? new Date(`${date}T${time || '08:00'}`).toISOString() : null,
              durationMin: Number(duration),
              assignedTo: tech || null,
              planId: preset?.planId ?? null,
            }
          : null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      clearDraft(DRAFT_KEY);
      if (result.data?.warning) toast.warning(result.data.warning);
      else toast.success(isField && date ? 'Posjet zakazan' : 'Nalog otvoren');
      router.replace(`/app/jobs/${result.data!.id}`);
    });
  }

  return (
    <div className="space-y-4">
      {field.enabled && field.defaultMode === 'workshop' ? (
        <Segmented
          value={mode}
          onChange={setMode}
          size="lg"
          options={[
            { value: 'workshop', label: 'U radionici' },
            { value: 'field', label: 'Na terenu' },
          ]}
        />
      ) : null}

      {/* Who */}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">{isField ? vocabulary.client.one : `${vocabulary.client.one} i ${vocabulary.asset.one.toLowerCase()}`}</h2>
        {client ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                {client.kind === 'company' ? <Building2 className="size-4 text-accent" /> : <User className="size-4 text-accent" />}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{clientName(client)}</span>
                  {client.phone ? <span className="block text-xs text-muted">{client.phone}</span> : null}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setClient(null);
                  setAssetId(null);
                  setSiteId(null);
                }}
                aria-label="Promijeni"
              >
                <X className="size-4" />
              </Button>
            </div>
            {!isField ? <AssetChoice assets={visibleAssets} assetId={assetId} onPick={setAssetId} newLabel={vocabulary.asset.new} /> : null}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Search, with the camera for the registration certificate right beside it. */}
            <div className="relative flex gap-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isField ? 'Traži: ime, telefon ili adresa' : `Traži: ${vocabulary.identifier.toLowerCase()}, ime ili telefon`}
                className="pl-9"
                autoFocus
              />
              {!isField && vehicles ? <ScanButton kind="prometna" label="Slikaj prometnu dozvolu" onResult={fromRegistration} /> : null}
              {hits.length > 0 || query.trim().length >= 2 ? (
                <div className="absolute inset-x-0 top-12 z-20 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/40">
                  {hits.map((hit) => (
                    <button key={hit.id} type="button" onClick={() => pickClient(hit)} className="block w-full border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-surface2">
                      <span className="block text-sm font-medium">{clientName(hit)}</span>
                      <span className="block truncate text-xs text-muted">
                        {[hit.phone, ...(isField ? (hit.sites ?? []).map((s) => s.address) : hit.assets.map((a) => a.identifier ?? assetTitle(a)))].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  ))}
                  <button type="button" onClick={useQueryAsNew} className="block w-full px-3 py-2.5 text-left text-sm text-accent hover:bg-surface2">
                    + Novi unos „{query.trim()}”
                  </button>
                </div>
              ) : null}
            </div>

            <Segmented
              value={newClient.kind}
              onChange={(kind) => setNewClient((c) => ({ ...c, kind }))}
              options={[
                { value: 'person', label: 'Osoba' },
                { value: 'company', label: 'Tvrtka / suradnik' },
              ]}
            />
            {/* One field per row on a phone, so there is room for the microphone. */}
            <div className="grid gap-3 sm:grid-cols-2">
              {newClient.kind === 'company' ? (
                <Field label="Naziv tvrtke">
                  <DictateInput value={newClient.companyName} onValue={(companyName) => setNewClient((c) => ({ ...c, companyName }))} />
                </Field>
              ) : (
                <Field label="Ime i prezime">
                  <DictateInput mode="name" value={newClient.name} autoComplete="off" onValue={(name) => setNewClient((c) => ({ ...c, name }))} />
                </Field>
              )}
              <Field label="Telefon">
                <DictateInput mode="phone" type="tel" value={newClient.phone} onValue={(phone) => setNewClient((c) => ({ ...c, phone }))} />
              </Field>
            </div>
            {more ? (
              <Field label="OIB">
                <DictateInput mode="digits" inputMode="numeric" maxLength={11} value={newClient.oib} onValue={(oib) => setNewClient((c) => ({ ...c, oib: oib.slice(0, 11) }))} />
              </Field>
            ) : null}
          </div>
        )}

        {!isField && !assetId ? <NewAssetFields vocabulary={vocabulary} assetTypes={assetTypes} value={newAsset} onChange={setNewAsset} more={more} /> : null}
      </Card>

      {/* Field: where, which device, when */}
      {isField ? (
        <Card className="space-y-4 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="size-4 text-accent" /> Lokacija
          </h2>
          {sites.length ? (
            <div className="grid gap-2">
              {sites.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => chooseSite(s.id)}
                  className={cn('flex items-center justify-between rounded-xl border px-3 py-2.5 text-left', siteId === s.id ? 'border-accent bg-accent/5' : 'border-line hover:border-faint/60')}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{[s.label, s.address].filter(Boolean).join(' · ')}</span>
                    <span className="block truncate text-xs text-muted">{[s.city, s.access_notes].filter(Boolean).join(' · ')}</span>
                  </span>
                  {siteId === s.id ? <Check className="size-4 text-accent" /> : null}
                </button>
              ))}
              <button
                type="button"
                onClick={() => chooseSite(null)}
                className={cn('rounded-xl border border-dashed px-3 py-2.5 text-left text-sm', siteId === null ? 'border-accent text-fg' : 'border-line text-muted')}
              >
                + Nova lokacija
              </button>
            </div>
          ) : null}
          {usingNewSite ? (
            <div className="space-y-3">
              <div className="grid grid-cols-[2fr_1fr] gap-3">
                <Field label="Adresa">
                  <DictateInput value={newSite.address} onValue={(address) => setNewSite((s) => ({ ...s, address }))} placeholder="Ulica i broj" autoComplete="street-address" />
                </Field>
                <Field label="Grad">
                  <DictateInput mode="name" value={newSite.city} onValue={(city) => setNewSite((s) => ({ ...s, city }))} />
                </Field>
              </div>
              {more ? (
                <>
                  <Segmented value={newSite.kind} onChange={(kind) => setNewSite((s) => ({ ...s, kind }))} options={SITE_KINDS} />
                  <Field label="Upute za ulaz">
                    <DictateInput value={newSite.accessNotes} onValue={(accessNotes) => setNewSite((s) => ({ ...s, accessNotes }))} placeholder="Kat, šifra, ključ kod susjeda…" />
                  </Field>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="border-t border-line pt-4">
            {/* The nameplate camera sits on the heading row, taking no extra line. */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{vocabulary.asset.one}</h3>
              {!assetId ? (
                <ScanButton
                  kind="plocica"
                  label="Slikaj natpisnu pločicu"
                  onResult={(d) =>
                    setNewAsset((a) => ({
                      ...a,
                      make: typeof d.make === 'string' && d.make ? d.make : a.make,
                      model: typeof d.model === 'string' && d.model ? d.model : a.model,
                      year: d.year ? String(d.year) : a.year,
                    }))
                  }
                />
              ) : null}
            </div>
            {client && !usingNewSite ? <AssetChoice assets={visibleAssets} assetId={assetId} onPick={setAssetId} newLabel={vocabulary.asset.new} /> : null}
            {!assetId ? <NewAssetFields vocabulary={vocabulary} assetTypes={assetTypes} value={newAsset} onChange={setNewAsset} field more={more} /> : null}
          </div>

          <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
            <Field label="Datum posjeta">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Vrijeme">
              <Input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            {more ? (
              <>
                <Field label="Trajanje" className="sm:col-span-2">
                  <Segmented
                    value={duration}
                    onChange={setDuration}
                    options={[
                      { value: '60', label: '1 h' },
                      { value: '120', label: '2 h' },
                      { value: '240', label: '4 h' },
                      { value: '480', label: 'Dan' },
                    ]}
                  />
                </Field>
                {field.staff.length > 1 ? (
                  <Field label="Tehničar" className="sm:col-span-2">
                    <Select value={tech} onChange={(e) => setTech(e.target.value)}>
                      <option value="">Nije dodijeljeno</option>
                      {field.staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
              </>
            ) : null}
            {!date ? <p className="text-xs text-faint sm:col-span-2">Bez datuma nalog ide u „Nezakazano” u rasporedu.</p> : null}
          </div>
        </Card>
      ) : null}

      {/* What to do */}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Što treba napraviti</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {symptoms.map((symptom) => {
            const on = picked.includes(symptom);
            return (
              <button
                key={symptom}
                type="button"
                onClick={() => setPicked((p) => (on ? p.filter((s) => s !== symptom) : [...p, symptom]))}
                className={cn('h-11 rounded-full border px-3.5 text-sm transition-colors sm:h-10', on ? 'border-accent bg-accent/15 text-fg' : 'border-line text-muted hover:text-fg')}
              >
                {symptom}
              </button>
            );
          })}
        </div>
        <Textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} rows={3} placeholder="Opis kvara riječima klijenta" />
        <div className="mt-2">
          <DictateButton onText={(text) => setComplaint((c) => (c ? `${c.trimEnd()} ${text}` : text))} />
        </div>
      </Card>

      {more ? (
        <Card className="grid gap-4 p-4 sm:grid-cols-2">
          {!isField ? (
            <>
              <Field label={`Stanje brojila (${meterUnit === 'mth' ? 'motosati' : 'km'})`}>
                <DictateInput mode="number" inputMode="decimal" value={meterIn} onValue={setMeterIn} />
              </Field>
              <Field label="Obećano do">
                <Input type="datetime-local" value={promisedAt} onChange={(e) => setPromisedAt(e.target.value)} />
              </Field>
            </>
          ) : null}
          {templates.length ? (
            <Field label="Predložak posla">
              <Select value={templateCode} onChange={(e) => setTemplateCode(e.target.value)}>
                <option value="">Bez predloška</option>
                {templates.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {!isField ? (
            <Field label="Kako je stiglo">
              <Select value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
                <option value="workshop">Došao u radionicu</option>
                <option value="phone">Telefonom</option>
                <option value="field">Teren</option>
              </Select>
            </Field>
          ) : null}
          <label className="flex items-center gap-3 text-sm sm:col-span-2">
            <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} className="size-5 accent-[rgb(var(--crit))]" />
            Hitno
          </label>
        </Card>
      ) : null}

      <button type="button" onClick={() => setMore((m) => !m)} className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium text-muted hover:text-fg">
        <ChevronDown className={cn('size-4 transition-transform', more && 'rotate-180')} />
        {more ? 'Manje podataka' : isField ? 'Više podataka (vrsta, serijski, trajanje, tehničar…)' : 'Više podataka (OIB, VIN, km, rok, predložak, hitno…)'}
      </button>

      <div className="sticky bottom-20 z-10 lg:bottom-4">
        <Button variant="primary" size="lg" className="w-full shadow-2xl shadow-black/50" disabled={pending} onClick={submit}>
          {pending ? 'Spremam…' : isField ? (date ? 'Zakaži posjet' : 'Otvori nalog bez termina') : 'Otvori nalog'}
        </Button>
      </div>
    </div>
  );
}

function AssetChoice({
  assets,
  assetId,
  onPick,
  newLabel,
}: {
  assets: ClientHit['assets'];
  assetId: string | null;
  onPick: (id: string | null) => void;
  newLabel: string;
}) {
  return (
    <div className="grid gap-2">
      {assets.map((asset) => (
        <button
          key={asset.id}
          type="button"
          onClick={() => onPick(asset.id)}
          className={cn('flex items-center justify-between rounded-xl border px-3 py-2.5 text-left', assetId === asset.id ? 'border-accent bg-accent/5' : 'border-line hover:border-faint/60')}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{assetTitle(asset)}</span>
            <span className="block font-mono text-xs text-muted">{asset.identifier ?? '-'}</span>
          </span>
          {assetId === asset.id ? <Check className="size-4 text-accent" /> : null}
        </button>
      ))}
      <button type="button" onClick={() => onPick(null)} className={cn('rounded-xl border border-dashed px-3 py-2.5 text-left text-sm', assetId === null ? 'border-accent text-fg' : 'border-line text-muted')}>
        + {newLabel}
      </button>
    </div>
  );
}

type NewAsset = { assetType: AssetType; identifier: string; make: string; model: string; year: string; vin: string };

// Core: plate (or a room label for a device), make and model. Type, year and
// serial number only with "Više podataka".
function NewAssetFields({
  vocabulary,
  assetTypes,
  value,
  onChange,
  field = false,
  more,
}: {
  vocabulary: Vocabulary;
  assetTypes: { value: AssetType; label: string }[];
  value: NewAsset;
  onChange: (update: (v: NewAsset) => NewAsset) => void;
  field?: boolean;
  more: boolean;
}) {
  return (
    <div className={cn('space-y-3', !field && 'mt-4 border-t border-line pt-4')}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={field ? 'Gdje je (npr. Dnevni boravak)' : vocabulary.identifier} className="col-span-2">
          <DictateInput
            mode={field ? 'text' : 'plate'}
            value={value.identifier}
            className={cn(!field && 'font-mono uppercase')}
            onValue={(identifier) => onChange((a) => ({ ...a, identifier }))}
          />
        </Field>
        <Field label="Marka">
          <DictateInput mode="name" value={value.make} onValue={(make) => onChange((a) => ({ ...a, make }))} placeholder={field ? 'npr. Daikin' : undefined} />
        </Field>
        <Field label="Model">
          <DictateInput mode="name" value={value.model} onValue={(model) => onChange((a) => ({ ...a, model }))} placeholder={field ? 'npr. FTXP35M' : undefined} />
        </Field>
      </div>
      {more ? (
        <>
          {assetTypes.length > 1 ? (
            <Field label="Vrsta">
              <Select value={value.assetType} onChange={(e) => onChange((a) => ({ ...a, assetType: e.target.value as AssetType }))}>
                {assetTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label={field ? 'Godina ugradnje' : 'Godište'}>
              <DictateInput mode="digits" inputMode="numeric" maxLength={4} value={value.year} onValue={(year) => onChange((a) => ({ ...a, year: year.replace(/\D/g, '').slice(0, 4) }))} />
            </Field>
            <Field label={field ? 'Serijski broj' : 'VIN'}>
              <DictateInput mode={field ? 'text' : 'vin'} value={value.vin} className="font-mono uppercase" onValue={(vin) => onChange((a) => ({ ...a, vin }))} />
            </Field>
          </div>
        </>
      ) : null}
    </div>
  );
}
