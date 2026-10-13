import type { ReactNode } from 'react';
import type { JobSheet as Sheet } from '@/lib/job-sheet';

function Block({ title, lines }: { title: string; lines: string[] }) {
  if (!lines.length) return null;
  return (
    <section className="border-b border-neutral-200 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {lines.map((line, index) => (
          <li key={`${title}-${index}`}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

function Text({ title, children }: { title: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <section className="border-b border-neutral-200 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{title}</p>
      <div className="mt-1 whitespace-pre-line">{children}</div>
    </section>
  );
}

// The job as one sheet of paper: every entry a reviewer would look for.
export function JobSheet({ data }: { data: Sheet }) {
  return (
    <article className="invoice relative mx-auto w-full max-w-[210mm] overflow-x-hidden rounded-2xl bg-white p-6 text-[13px] leading-relaxed text-neutral-900 shadow-sm print:rounded-none print:p-0 print:shadow-none sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <p className="text-base font-semibold">{data.workshop}</p>
          <h1 className="text-lg font-semibold">Nalog #{data.jobNumber}</h1>
          <p className="text-neutral-600">Primljeno {data.received}</p>
        </div>
        <p className="text-sm font-medium">{data.phase}</p>
      </header>

      <section className="grid gap-4 border-b border-neutral-200 py-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Mušterija</p>
          <p className="font-medium">{data.client}</p>
          {data.phone ? <p className="text-neutral-600">{data.phone}</p> : null}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{data.assetLabel}</p>
          <p className="font-medium">{data.assetName}</p>
          {data.identifier ? <p className="font-mono text-neutral-600">{data.identifier}</p> : null}
          {data.meter ? <p className="text-neutral-600">{data.meter}</p> : null}
          {data.promised ? <p className="text-neutral-600">Obećano do {data.promised}</p> : null}
          {data.bay ? <p className="text-neutral-600">Mjesto: {data.bay}</p> : null}
        </div>
      </section>

      <Text title="Zahtjev">{data.complaint}</Text>
      <Text title="Nalaz">{data.diagnosis}</Text>
      <Text title="Obavljeni posao">{data.work}</Text>
      <Block title="Stanje pri prijemu" lines={data.intake} />
      <Block title="Stanje pri predaji" lines={data.handover} />
      <Block title="Procjena" lines={[...data.estimate, ...data.damages]} />
      {data.paint ? <Text title="Lakirnica">{data.paint}</Text> : null}
      <Block title="Proizvodnja" lines={data.phases} />
      <Block title="ADAS" lines={data.calibrations} />
      <Block title="Materijal" lines={data.materials} />
      <Block title="Radovi" lines={data.lines} />

      {data.lists.map((list) => (
        <section key={`${list.title}-${list.when}`} className="border-b border-neutral-200 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            {list.title} · {list.when}
            {list.done ? ' · završeno' : ''}
          </p>
          {list.items.length ? (
            <ul className="mt-1 space-y-0.5">
              {list.items.map((item) => (
                <li key={item.label}>
                  {item.label}: {item.result}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-neutral-600">Nema upisanih stavki.</p>
          )}
        </section>
      ))}

      {data.messages.length ? (
        <section className="border-b border-neutral-200 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Poruke radnicima</p>
          <ul className="mt-1 space-y-1">
            {data.messages.map((message, index) => (
              <li key={index}>
                <span className="text-neutral-500">{message.when}</span> {message.body}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-6 text-[11px] text-neutral-500">Pregled naloga za radionicu. Cijene su na ponudi i računu.</footer>
    </article>
  );
}
