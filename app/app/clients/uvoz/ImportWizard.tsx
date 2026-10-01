'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookUser, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, CardHeader, Select, buttonClass } from '@/components/ui';
import { importClients, type ImportResult } from '@/lib/actions/import';
import { buildClients, detectColumns, targetLabels, type Detected, type Target } from '@/lib/import/detect';
import { readTable, type Table } from '@/lib/import/read';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';

type ContactsApi = { select: (props: string[], opts: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[]; email?: string[] }[]> };

// Bring a workshop's existing customers in at once: from an Excel/CSV
// export, a phone's address book file (.vcf) or, on Android, straight from
// the phone's contacts. The app recognises the columns itself; the owner
// only checks the preview.
export function ImportWizard({ vocabulary, isClimate }: { vocabulary: { clients: string; asset: string; assets: string; identifier: string }; isClimate: boolean }) {
  const [table, setTable] = useState<Table | null>(null);
  const [source, setSource] = useState('');
  const [detected, setDetected] = useState<Detected | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const contacts = typeof navigator !== 'undefined' ? ((navigator as unknown as { contacts?: ContactsApi }).contacts ?? null) : null;
  const labels = targetLabels(vocabulary.identifier, vocabulary.asset);

  const built = useMemo(() => (table && detected ? buildClients(table, detected, isClimate) : null), [table, detected, isClimate]);
  const assetCount = built?.clients.reduce((s, c) => s + c.assets.length, 0) ?? 0;

  function load(next: Table, name: string) {
    if (next.length === 0) {
      setError('U datoteci nema redaka.');
      return;
    }
    setError(null);
    setResult(null);
    setTable(next);
    setSource(name);
    setDetected(detectColumns(next));
  }

  async function fromFile(file: File | undefined) {
    if (!file) return;
    try {
      load(await readTable(file), file.name);
    } catch (e) {
      setError((e as Error).message || 'Datoteku nije moguće pročitati.');
    }
  }

  async function fromContacts() {
    try {
      const picked = await contacts!.select(['name', 'tel', 'email'], { multiple: true });
      load([['Ime i prezime', 'Telefon', 'E-mail'], ...picked.map((c) => [c.name?.[0] ?? '', c.tel?.[0] ?? '', c.email?.[0] ?? ''])], 'Imenik mobitela');
    } catch {
      // Closed without choosing.
    }
  }

  async function run() {
    if (!built) return;
    const total: ImportResult = { clients: 0, assets: 0, sites: 0, existingClients: 0, existingAssets: 0 };
    setProgress(0);
    for (let i = 0; i < built.clients.length; i += 200) {
      const res = await importClients(built.clients.slice(i, i + 200));
      if (!res.ok) {
        setProgress(null);
        setError(res.error);
        toast.error(res.error);
        return;
      }
      for (const k of Object.keys(total) as (keyof ImportResult)[]) total[k] += res.data![k];
      setProgress(Math.min(100, Math.round(((i + 200) / built.clients.length) * 100)));
    }
    setProgress(null);
    setResult(total);
    setTable(null);
  }

  if (result) {
    return (
      <Card className="space-y-3 p-5">
        <h2 className="text-lg font-semibold">Uvoz je gotov</h2>
        <p className="text-sm">
          Dodano: <b>{result.clients}</b> {plural(result.clients, 'mušterija', 'mušterije', 'mušterija')} i <b>{result.assets}</b> {vocabulary.assets.toLowerCase()}
          {result.sites ? ` (${result.sites} ${plural(result.sites, 'lokacija', 'lokacije', 'lokacija')})` : ''}.
        </p>
        {result.existingClients || result.existingAssets ? (
          <p className="text-sm text-muted">
            Već je postojalo pa nije dirano: {result.existingClients} {plural(result.existingClients, 'mušterija', 'mušterije', 'mušterija')}, {result.existingAssets} {vocabulary.assets.toLowerCase()}.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/app/clients" className={buttonClass('primary')}>
            Na popis
          </Link>
          <Button onClick={() => setResult(null)}>Uvezi još</Button>
        </div>
      </Card>
    );
  }

  if (!table || !detected || !built) {
    return (
      <div className="space-y-3">
        <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-line bg-surface p-4 hover:border-accent/60">
          <FileSpreadsheet className="size-8 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Datoteka</span>
            <span className="block text-sm text-muted">Excel ili CSV iz starog programa, ili imenik (.vcf) s mobitela ili iz Gmaila</span>
          </span>
          <Upload className="size-5 text-muted" />
          <input type="file" accept=".xlsx,.csv,.txt,.vcf,text/csv,text/vcard" className="sr-only" onChange={(e) => fromFile(e.target.files?.[0])} />
        </label>
        {contacts ? (
          <button type="button" onClick={fromContacts} className="flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left hover:border-accent/60">
            <BookUser className="size-8 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Imenik mobitela</span>
              <span className="block text-sm text-muted">Označite kontakte koji su Vaše mušterije</span>
            </span>
          </button>
        ) : null}
        {error ? <p className="rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</p> : null}
        <p className="px-1 text-xs text-faint">
          Aplikacija sama prepozna stupce (ime, telefon, {vocabulary.identifier.toLowerCase()}, marka…) i preskoči sve što već postoji, pa isti uvoz ne može ništa udvostručiti.
        </p>
      </div>
    );
  }

  const width = detected.targets.length;
  const header = detected.hasHeader ? table[0] : [];
  const example = (i: number) => (detected.hasHeader ? table.slice(1) : table).map((r) => r[i]).find(Boolean) ?? '';

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm text-muted">{source}</p>
        <p className="mt-1 text-lg font-semibold">
          {built.clients.length} {plural(built.clients.length, 'mušterija', 'mušterije', 'mušterija')}
          {assetCount ? `, ${assetCount} ${vocabulary.assets.toLowerCase()}` : ''}
        </p>
        {built.skipped ? <p className="text-xs text-faint">{built.skipped} redaka bez imena se preskače.</p> : null}
      </Card>

      <Card>
        <CardHeader title="Što je u kojem stupcu" subtitle="Prepoznato samo; promijenite ako nešto ne štima" />
        <ul className="divide-y divide-line">
          {Array.from({ length: width }, (_, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <span className="min-w-[8rem] flex-1">
                <span className="block text-sm font-medium">{header[i] || `Stupac ${i + 1}`}</span>
                <span className="block truncate text-xs text-faint">{example(i) || '—'}</span>
              </span>
              <Select
                value={detected.targets[i]}
                onChange={(e) => setDetected((d) => d && { ...d, targets: d.targets.map((t, j) => (j === i ? (e.target.value as Target) : t)) })}
                className={cn('w-44', detected.targets[i] === 'skip' && 'text-muted')}
              >
                {(Object.keys(labels) as Target[]).map((t) => (
                  <option key={t} value={t}>
                    {labels[t]}
                  </option>
                ))}
              </Select>
            </li>
          ))}
        </ul>
        <label className="flex items-center gap-3 border-t border-line px-4 py-3 text-sm">
          <input type="checkbox" checked={detected.hasHeader} onChange={(e) => setDetected((d) => d && { ...d, hasHeader: e.target.checked })} className="size-5" />
          Prvi redak su naslovi stupaca
        </label>
      </Card>

      <Card>
        <CardHeader title="Pregled" subtitle="Prvih nekoliko, kako će biti upisani" />
        <ul className="divide-y divide-line">
          {built.clients.slice(0, 5).map((c, i) => (
            <li key={i} className="px-4 py-3 text-sm">
              <p className="font-medium">{c.company_name ?? [c.first_name, c.last_name].filter(Boolean).join(' ')}</p>
              <p className="text-xs text-muted">{[c.phone, c.email, c.oib && `OIB ${c.oib}`, [c.address, c.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'bez kontakta'}</p>
              {c.assets.map((a, j) => (
                <p key={j} className="mt-0.5 text-xs">
                  <span className="font-mono">{a.identifier ?? a.vin ?? ''}</span> {[a.make, a.model, a.year].filter(Boolean).join(' ')}
                </p>
              ))}
            </li>
          ))}
        </ul>
      </Card>

      {error ? <p className="rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</p> : null}
      {progress !== null ? (
        <div className="h-2 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={progress}>
          <div className="h-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="lg" className="flex-1" disabled={progress !== null || built.clients.length === 0} onClick={run}>
          {progress !== null ? `Uvozim… ${progress} %` : `Uvezi ${built.clients.length} ${plural(built.clients.length, 'mušteriju', 'mušterije', 'mušterija')}`}
        </Button>
        <Button size="lg" disabled={progress !== null} onClick={() => setTable(null)}>
          Druga datoteka
        </Button>
      </div>
    </div>
  );
}
