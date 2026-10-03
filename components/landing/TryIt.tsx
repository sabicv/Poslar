'use client';

import { useState } from 'react';
import { Check, ClipboardList, MessageCircle, Receipt, RotateCcw } from 'lucide-react';
import { DictateButton } from '@/components/client-ui';
import { Button, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';

type Line = [description: string, qty: number, unit: string, price: number];

// What a workshop would typically put on the order for a few common words.
// A rough example, nothing is saved; the real app uses the workshop's own prices.
const RULES: [RegExp, Line[]][] = [
  [/akumul|prazni|ne pali|anlaser|elektri/, [['Dijagnostika elektrike', 1, 'h', 45], ['Akumulator 70 Ah', 1, 'kom', 135]]],
  [/remen|razvod/, [['Komplet remena razvoda', 1, 'kom', 220], ['Zamjena remena razvoda', 3.5, 'h', 45]]],
  [/kvacil/, [['Komplet kvačila', 1, 'kom', 260], ['Zamjena kvačila', 5, 'h', 45]]],
  [/kocni|disk|plocic/, [['Pločice naprijed', 1, 'set', 55], ['Zamjena pločica', 1, 'h', 45]]],
  [/ulj|servis|filter/, [['Mali servis: ulje i filteri', 1, 'paušal', 95]]],
  [/klim|hladi|grije/, [['Servis klime', 1, 'paušal', 60], ['Dezinfekcija isparivača', 1, 'kom', 8]]],
  [/gum|probu|balans|felg/, [['Krpanje gume', 1, 'kom', 15], ['Balansiranje', 4, 'kom', 5]]],
  [/branik|udar|ogreb|lak|lim/, [['Popravak i lakiranje branika', 1, 'paušal', 180]]],
];
const FALLBACK: Line[] = [
  ['Dijagnostika', 1, 'h', 45],
  ['Rad', 1, 'h', 45],
];

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const euro = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

function linesFor(complaint: string): Line[] {
  const text = fold(complaint);
  const found = RULES.filter(([re]) => re.test(text)).flatMap(([, lines]) => lines);
  return (found.length ? found : FALLBACK).slice(0, 3);
}

// "Probaj odmah": say or type a fault and see the order, the WhatsApp
// message and the invoice the app would make. Nothing is saved.
export function TryIt({ examples, register }: { examples: string[]; register: string }) {
  const [complaint, setComplaint] = useState('');
  const [plate, setPlate] = useState('');
  const [done, setDone] = useState(false);
  const lines = linesFor(complaint);
  const net = lines.reduce((s, [, q, , p]) => s + q * p, 0);
  const gross = net * 1.25;
  const tag = plate.trim().toUpperCase() || 'ZG-1234-AB';

  if (!done) {
    return (
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap gap-2">
          {examples.map((e) => (
            <button key={e} type="button" onClick={() => setComplaint(e)} className={cn('rounded-full border px-3 py-1.5 text-sm', complaint === e ? 'border-accent bg-accent/15' : 'border-line text-muted')}>
              {e}
            </button>
          ))}
        </div>
        <Textarea rows={3} value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="Opiši kvar ili ga izgovori" />
        <div className="flex flex-wrap items-center gap-3">
          <DictateButton onText={(t) => setComplaint((c) => (c ? `${c.trimEnd()} ${t}` : t))} />
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="Registracija (nije obavezno)"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 font-mono text-sm uppercase text-fg placeholder:font-sans placeholder:normal-case placeholder:text-faint"
          />
        </div>
        <Button variant="primary" size="lg" className="w-full" disabled={!complaint.trim()} onClick={() => setDone(true)}>
          <ClipboardList className="size-5" /> Napravi nalog
        </Button>
        <p className="text-xs text-faint">Ovo je primjer. Ništa se ne sprema.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {/* The order */}
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="mb-2 flex items-center gap-2 text-xs text-faint">
            <ClipboardList className="size-4 text-accent" /> Nalog #1 · Prijem
          </p>
          <p className="font-mono text-sm font-semibold">{tag}</p>
          <p className="mt-1 text-sm text-muted">{complaint}</p>
          <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
            {lines.map(([d, q, u, p]) => (
              <li key={d} className="flex justify-between gap-2">
                <span>
                  {d}
                  <span className="block text-xs text-faint">
                    {String(q).replace('.', ',')} {u} × {euro(p)}
                  </span>
                </span>
                <span className="shrink-0 tabular">{euro(q * p)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* The WhatsApp message */}
        <div className="rounded-2xl border border-line bg-[#0B141A] p-4">
          <p className="mb-2 flex items-center gap-2 text-xs text-faint">
            <MessageCircle className="size-4 text-[#25D366]" /> WhatsApp mušteriji
          </p>
          <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-[#005C4B] px-3 py-2 text-sm text-white">
            Poštovani, za vozilo {tag} predlažemo: {lines.map(([d]) => d.toLowerCase()).join(', ')}. Ukupno {euro(gross)} s PDV-om.
            <span className="mt-1 block underline">Odobri jednim dodirom</span>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-[#25D366]">
            <Check className="size-4" /> Mušterija je odobrila
          </p>
        </div>

        {/* The invoice */}
        <div className="rounded-2xl bg-white p-4 text-neutral-900">
          <p className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
            <Receipt className="size-4" /> Račun br. 1/{new Date().getFullYear()}
          </p>
          <div className="space-y-1 text-sm">
            <p className="flex justify-between">
              <span className="text-neutral-500">Osnovica</span>
              <span className="tabular">{euro(net)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-neutral-500">PDV 25 %</span>
              <span className="tabular">{euro(gross - net)}</span>
            </p>
            <p className="flex justify-between border-t border-neutral-200 pt-1.5 font-semibold">
              <span>Ukupno</span>
              <span className="tabular">{euro(gross)}</span>
            </p>
          </div>
          <p className="mt-3 text-xs text-neutral-500">Poslano na WhatsApp. Kad plati, označiš plaćeno.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <a href={register} className="inline-flex h-12 items-center justify-center rounded-xl bg-accent px-5 font-medium text-accent-fg">
          Sviđa ti se? Probaj 30 dana besplatno
        </a>
        <Button size="lg" onClick={() => setDone(false)}>
          <RotateCcw className="size-4" /> Još jednom
        </Button>
      </div>
    </div>
  );
}
