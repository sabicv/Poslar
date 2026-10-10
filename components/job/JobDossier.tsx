import type { ReactNode } from 'react';
import { formatDateTime } from '@/lib/format';
import type { DossierData } from '@/lib/dossier';

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-neutral-200 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{title}</p>
      <div className="mt-1">{children}</div>
    </section>
  );
}

// The job, on the same paper as the invoice. One attachment, not a dump of every tab.
export function JobDossier({ data }: { data: DossierData }) {
  const w = data.workshop;
  return (
    <article className="invoice relative mx-auto w-full max-w-[210mm] overflow-x-hidden rounded-2xl bg-white p-6 text-[13px] leading-relaxed text-neutral-900 shadow-sm print:rounded-none print:p-0 print:shadow-none sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral-200 pb-5">
        <div className="min-w-0">
          {w.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.logoUrl} alt="" className="mb-2 h-12 w-auto object-contain" />
          ) : null}
          <p className="text-base font-semibold">{w.name}</p>
          <p className="text-neutral-600">{[w.address, w.city].filter(Boolean).join(', ')}</p>
          <p className="text-neutral-600">{[w.phone, w.email].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Zapisnik</p>
          <h1 className="text-lg font-semibold">Nalog #{data.jobNumber}</h1>
          <p className="text-neutral-600">Prilog računu</p>
        </div>
      </header>

      <section className="grid gap-4 border-b border-neutral-200 py-5 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Mušterija</p>
          <p className="font-medium">{data.clientName}</p>
          {data.place ? <p className="text-neutral-600">{data.place}</p> : null}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{data.assetLabel}</p>
          <p className="font-medium">{data.assetName}</p>
          {data.identifier ? <p className="font-mono text-neutral-600">{data.identifier}</p> : null}
          {data.when ? <p className="text-neutral-600">{data.when}</p> : null}
          {data.technician ? <p className="text-neutral-600">{data.technician}</p> : null}
        </div>
      </section>

      {data.request ? (
        <Block title="Zahtjev">
          <p className="whitespace-pre-line">{data.request}</p>
        </Block>
      ) : null}
      {data.intake.length ? (
        <Block title="Stanje pri prijemu">
          <ul className="space-y-0.5">
            {data.intake.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </Block>
      ) : null}
      {data.handover.length ? (
        <Block title="Stanje pri predaji">
          <ul className="space-y-0.5">
            {data.handover.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </Block>
      ) : null}
      {data.findings.length || data.okCount ? (
        <Block title="Nalaz">
          {data.okCount ? <p className="text-neutral-600">{data.okCount} provjerenih stavki u redu.</p> : null}
          {data.findings.length ? (
            <ul className="mt-1 space-y-1">
              {data.findings.map((f) => (
                <li key={`${f.tone}-${f.label}`}>
                  <span className="font-medium">{f.tone === 'crit' ? 'Hitno' : 'Preporuka'} · </span>
                  {f.label}
                  {f.detail ? <span className="text-neutral-600"> · {f.detail}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Block>
      ) : null}
      {data.workDone ? (
        <Block title="Obavljeni posao">
          <p className="whitespace-pre-line">{data.workDone}</p>
        </Block>
      ) : null}
      {data.works.length ? (
        <Block title="Odobreni radovi">
          <ul className="space-y-0.5">
            {data.works.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </Block>
      ) : null}
      {data.photos.length ? (
        <Block title="Fotografije">
          <div className="grid grid-cols-2 gap-2">
            {data.photos.map((photo) => (
              <figure key={photo.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.caption ?? ''} className="aspect-[4/3] w-full rounded-md object-cover" />
                {photo.caption ? <figcaption className="mt-1 text-[11px] text-neutral-500">{photo.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </Block>
      ) : null}
      {data.signature ? (
        <Block title={data.signature.kind === 'handover' ? 'Potpis pri predaji' : 'Potpis pri prijemu'}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.signature.url} alt="Potpis" className="h-16 w-auto" />
          <p className="text-neutral-600">{[data.signature.name, data.signature.when ? formatDateTime(data.signature.when) : null].filter(Boolean).join(' · ')}</p>
        </Block>
      ) : null}

      <footer className="mt-6 text-[11px] text-neutral-500">
        <p>Zapisnik je prilog računu. Cijene su na računu.</p>
      </footer>
    </article>
  );
}
