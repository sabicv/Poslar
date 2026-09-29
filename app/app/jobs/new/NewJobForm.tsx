'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Check, Search, User, X } from 'lucide-react';
import { DictateButton, Segmented } from '@/components/client-ui';
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import type { AssetType, MeterUnit, Vocabulary } from '@/config/tenant.config';
import { createJob } from '@/lib/actions/jobs';
import { searchClients, type ClientHit } from '@/lib/actions/clients';
import { clearDraft, readDraft, writeDraft } from '@/lib/drafts';
import { assetTitle, clientName } from '@/lib/format';
import { cn } from '@/lib/utils';

const DRAFT_KEY = 'draft:new-job';

interface Preset {
  id: string;
  asset_type: AssetType;
  identifier: string | null;
  make: string | null;
  model: string | null;
  meter_primary_unit: MeterUnit;
  client: ClientHit;
}

export function NewJobForm({
  vocabulary,
  assetTypes,
  defaultAssetType,
  symptoms,
  templates,
  isFleet,
  preset,
}: {
  vocabulary: Vocabulary;
  assetTypes: { value: AssetType; label: string; unit: MeterUnit }[];
  defaultAssetType: AssetType;
  symptoms: string[];
  templates: { code: string; name: string }[];
  isFleet: boolean;
  preset: Preset | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [client, setClient] = useState<ClientHit | null>(preset?.client ?? null);
  const [assetId, setAssetId] = useState<string | null>(preset?.id ?? null);
  const [newClient, setNewClient] = useState({ kind: (isFleet ? 'company' : 'person') as 'person' | 'company', firstName: '', lastName: '', companyName: '', phone: '', oib: '' });
  const [newAsset, setNewAsset] = useState({ assetType: defaultAssetType, identifier: '', make: '', model: '', year: '', vin: '' });
  const [complaint, setComplaint] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [meterIn, setMeterIn] = useState('');
  const [templateCode, setTemplateCode] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [promisedAt, setPromisedAt] = useState('');
  const [source, setSource] = useState<'workshop' | 'phone' | 'field'>('workshop');
  const restored = useRef(false);

  // Unsaved intake survives a closed tab or a dead battery.
  useEffect(() => {
    if (restored.current || preset) return;
    restored.current = true;
    const draft = readDraft<{ complaint: string; picked: string[]; newClient: typeof newClient; newAsset: typeof newAsset; meterIn: string }>(DRAFT_KEY);
    if (draft) {
      setComplaint(draft.complaint ?? '');
      setPicked(draft.picked ?? []);
      if (draft.newClient) setNewClient(draft.newClient);
      if (draft.newAsset) setNewAsset(draft.newAsset);
      setMeterIn(draft.meterIn ?? '');
    }
  }, [preset]);

  useEffect(() => {
    if (!restored.current) return;
    writeDraft(DRAFT_KEY, { complaint, picked, newClient, newAsset, meterIn });
  }, [complaint, picked, newClient, newAsset, meterIn]);

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

  const selectedAsset = client?.assets.find((a) => a.id === assetId) ?? null;
  const meterUnit: MeterUnit = selectedAsset?.meter_primary_unit ?? assetTypes.find((t) => t.value === newAsset.assetType)?.unit ?? 'km';

  function pickClient(hit: ClientHit) {
    setClient(hit);
    setAssetId(hit.assets.length === 1 ? hit.assets[0].id : null);
    setQuery('');
    setHits([]);
  }

  function useQueryAsNew() {
    const text = query.trim();
    // A plate-looking query becomes the identifier, anything else the name.
    if (/\d/.test(text) && text.length <= 12) setNewAsset((a) => ({ ...a, identifier: text.toUpperCase() }));
    else if (newClient.kind === 'company') setNewClient((c) => ({ ...c, companyName: text }));
    else {
      const [first, ...rest] = text.split(' ');
      setNewClient((c) => ({ ...c, firstName: first ?? '', lastName: rest.join(' ') }));
    }
    setQuery('');
    setHits([]);
  }

  function submit() {
    const fullComplaint = [picked.join(', '), complaint.trim()].filter(Boolean).join('. ');
    start(async () => {
      const result = await createJob({
        clientId: client?.id ?? null,
        newClient: client ? null : newClient,
        assetId,
        newAsset: assetId ? null : { ...newAsset, year: newAsset.year ? Number(newAsset.year) : null },
        complaint: fullComplaint,
        meterIn: meterIn ? Number(meterIn.replace(/\s/g, '').replace(',', '.')) : null,
        templateCode: templateCode || null,
        isUrgent,
        promisedAt: promisedAt ? new Date(promisedAt).toISOString() : null,
        source,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      clearDraft(DRAFT_KEY);
      if (result.data?.warning) toast.warning(result.data.warning);
      else toast.success('Nalog otvoren');
      router.replace(`/app/jobs/${result.data!.id}`);
    });
  }

  return (
    <div className="space-y-4">
      {/* Customer + object */}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">
          {vocabulary.client.one} i {vocabulary.asset.one.toLowerCase()}
        </h2>
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
              <Button size="sm" variant="ghost" onClick={() => { setClient(null); setAssetId(null); }} aria-label="Promijeni">
                <X className="size-4" />
              </Button>
            </div>
            <div className="grid gap-2">
              {client.assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setAssetId(asset.id)}
                  className={cn('flex items-center justify-between rounded-xl border px-3 py-2.5 text-left', assetId === asset.id ? 'border-accent bg-accent/5' : 'border-line hover:border-faint/60')}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{assetTitle(asset)}</span>
                    <span className="block font-mono text-xs text-muted">{asset.identifier ?? '—'}</span>
                  </span>
                  {assetId === asset.id ? <Check className="size-4 text-accent" /> : null}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAssetId(null)}
                className={cn('rounded-xl border border-dashed px-3 py-2.5 text-left text-sm', assetId === null ? 'border-accent text-fg' : 'border-line text-muted')}
              >
                + {vocabulary.asset.new}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Traži: ${vocabulary.identifier.toLowerCase()}, ime ili telefon`} className="pl-9" autoFocus />
              {hits.length > 0 || query.trim().length >= 2 ? (
                <div className="absolute inset-x-0 top-12 z-20 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/40">
                  {hits.map((hit) => (
                    <button key={hit.id} type="button" onClick={() => pickClient(hit)} className="block w-full border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-surface2">
                      <span className="block text-sm font-medium">{clientName(hit)}</span>
                      <span className="block truncate text-xs text-muted">
                        {[hit.phone, ...hit.assets.map((a) => a.identifier ?? assetTitle(a))].filter(Boolean).join(' · ')}
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
                { value: 'company', label: 'Tvrtka' },
              ]}
            />
            {newClient.kind === 'company' ? (
              <Field label="Naziv tvrtke">
                <Input value={newClient.companyName} onChange={(e) => setNewClient((c) => ({ ...c, companyName: e.target.value }))} />
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ime">
                  <Input value={newClient.firstName} autoComplete="off" onChange={(e) => setNewClient((c) => ({ ...c, firstName: e.target.value }))} />
                </Field>
                <Field label="Prezime">
                  <Input value={newClient.lastName} autoComplete="off" onChange={(e) => setNewClient((c) => ({ ...c, lastName: e.target.value }))} />
                </Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefon">
                <Input type="tel" value={newClient.phone} onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value }))} />
              </Field>
              <Field label="OIB">
                <Input inputMode="numeric" maxLength={11} value={newClient.oib} onChange={(e) => setNewClient((c) => ({ ...c, oib: e.target.value }))} />
              </Field>
            </div>
          </div>
        )}

        {!assetId ? (
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <Field label="Vrsta">
              <Select value={newAsset.assetType} onChange={(e) => setNewAsset((a) => ({ ...a, assetType: e.target.value as AssetType }))}>
                {assetTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={vocabulary.identifier}>
                <Input value={newAsset.identifier} className="font-mono uppercase" onChange={(e) => setNewAsset((a) => ({ ...a, identifier: e.target.value }))} />
              </Field>
              <Field label="Godište">
                <Input inputMode="numeric" maxLength={4} value={newAsset.year} onChange={(e) => setNewAsset((a) => ({ ...a, year: e.target.value.replace(/\D/g, '') }))} />
              </Field>
              <Field label="Marka">
                <Input value={newAsset.make} onChange={(e) => setNewAsset((a) => ({ ...a, make: e.target.value }))} />
              </Field>
              <Field label="Model">
                <Input value={newAsset.model} onChange={(e) => setNewAsset((a) => ({ ...a, model: e.target.value }))} />
              </Field>
            </div>
            <Field label="VIN / serijski broj">
              <Input value={newAsset.vin} className="font-mono uppercase" onChange={(e) => setNewAsset((a) => ({ ...a, vin: e.target.value }))} />
            </Field>
          </div>
        ) : null}
      </Card>

      {/* Complaint */}
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
                className={cn('h-10 rounded-full border px-3.5 text-sm transition-colors', on ? 'border-accent bg-accent/15 text-fg' : 'border-line text-muted hover:text-fg')}
              >
                {symptom}
              </button>
            );
          })}
        </div>
        <Textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} rows={3} placeholder="Opis kvara riječima stranke" />
        <div className="mt-2">
          <DictateButton onText={(text) => setComplaint((c) => (c ? `${c.trimEnd()} ${text}` : text))} />
        </div>
      </Card>

      <Card className="grid gap-4 p-4 sm:grid-cols-2">
        <Field label={`Stanje brojila (${meterUnit === 'mth' ? 'motosati' : 'km'})`}>
          <Input inputMode="decimal" value={meterIn} onChange={(e) => setMeterIn(e.target.value)} />
        </Field>
        <Field label="Obećano do">
          <Input type="datetime-local" value={promisedAt} onChange={(e) => setPromisedAt(e.target.value)} />
        </Field>
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
        <Field label="Kako je stiglo">
          <Select value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
            <option value="workshop">Došao u radionicu</option>
            <option value="phone">Telefonom</option>
            <option value="field">Teren</option>
          </Select>
        </Field>
        <label className="flex items-center gap-3 text-sm sm:col-span-2">
          <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} className="size-5 accent-[rgb(var(--crit))]" />
          Hitno
        </label>
      </Card>

      <div className="sticky bottom-20 z-10 lg:bottom-4">
        <Button variant="primary" size="lg" className="w-full shadow-2xl shadow-black/50" disabled={pending} onClick={submit}>
          {pending ? 'Otvaram…' : 'Otvori nalog'}
        </Button>
      </div>
    </div>
  );
}
