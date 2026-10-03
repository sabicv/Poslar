import { existsSync } from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Camera, Check, ClipboardCheck, EyeOff, FileSpreadsheet, History, Mic, MessageCircle, Receipt, Smartphone, Upload, X } from 'lucide-react';
import { TryIt } from '@/components/landing/TryIt';
import { BrandLogo, ProductMark } from '@/components/ProductMark';
import { ButtonLink } from '@/components/ui';
import { BRAND, PACKAGES, TRADE_GROUPS, accentStyle, matchPackageFromHost, type PackageId } from '@/config/tenant.config';
import { getAuth } from '@/lib/session';
import { cn } from '@/lib/utils';

// The landing page sells the product by itself: what it does in a day's
// work, in plain words, for a craftsman on a phone. On a product domain
// (airfiles.hr) it speaks about that trade; anywhere else about TaktiX.

// The way it is said in a workshop: "ti", short sentences (ten words at
// most), and only the real troubles — oily hands, lost papers, arguments
// over the price, invoices written late at night. No translated
// marketing phrases.
const HEADLINES: Record<PackageId, string> = {
  volt: 'Autoelektrika bez papira. Od prijema do računa.',
  gear: 'Mehaničarska radionica u tvom džepu.',
  body: 'Šteta, slike i račun. Sve na jednom mjestu.',
  wheel: 'Gume, geometrija i hotel za gume. Sve u mobitelu.',
  fleet: 'Servis kamiona i strojeva. Nijedan rok ne propuštaš.',
  moto: 'Servis motora i plovila. Zimovanje bez papira.',
  air: 'Klima servis na terenu. Raspored, izvještaj i F-plinovi.',
};

// The four troubles every craftsman knows, each with its fix.
const PROBLEMS = [
  { pain: 'Ruke su ti u ulju.', fix: 'Dodirneš mikrofon i izgovoriš kvar. Aplikacija ga sama zapiše.', icon: Mic },
  { pain: 'Nalog je opet negdje nestao.', fix: 'Sve ti je u mobitelu. Nalog, slike i broj telefona.', icon: ClipboardCheck },
  { pain: 'Mušterija kaže da to nije tražila.', fix: 'Cijenu joj pošalješ na WhatsApp. Ona odobri jednim dodirom. Svađe nema.', icon: MessageCircle },
  { pain: 'Račune pišeš kasno navečer.', fix: 'Račun napraviš odmah, jednim dodirom. Navečer si slobodan.', icon: Receipt },
];

// Photo reading is promised only while it is switched on (an AI key is set).
const SCAN = Boolean(process.env.ANTHROPIC_API_KEY);

// Each step with a real screenshot of that screen (public/landing, made
// from the demo workshops).
const STEPS = [
  { title: 'Primiš posao', body: `Upišeš ime i registraciju.${SCAN ? ' Ili slikaš prometnu.' : ' Ili sve izgovoriš.'} Stalnu mušteriju aplikacija sama prepozna.`, icon: ClipboardCheck, shot: 'prijem' },
  { title: 'Odradiš ga', body: 'Slikaš prije i poslije. Upišeš rad i dijelove. Radnik vidi posao, ali ne i cijene.', icon: Camera, shot: 'rad' },
  { title: 'Naplatiš', body: 'Račun pošalješ na WhatsApp. Kad plati, označiš plaćeno.', icon: Receipt, shot: 'racun' },
];

const OLD_WAY = ['Nalog na papiru, pa ga tražiš.', 'Mušterija zove i pita za cijenu.', 'Svađa: „to nisam tražio”.', 'Račune pišeš navečer.', 'Knjigovođi nosiš fasciklu.'];
const NEW_WAY = ['Izgovoriš kvar i nalog je otvoren.', 'Cijenu pošalješ na WhatsApp.', 'Mušterija odobri jednim dodirom.', 'Račun napraviš odmah.', 'Knjigovođi pošalješ jedan paket.'];

// Prices with VAT; 10 % less with a 24-month contract.
const PLANS = [
  { name: 'Basic', price: 30, people: 'Voditelj i 2 radnika', extras: ['Nalozi, slike i računi', 'Odobrenje preko WhatsAppa', 'Paket za knjigovođu'] },
  { name: 'Standard', price: 50, people: 'Voditelj i 5 radnika', extras: ['Sve iz paketa Basic', 'QR samoprijem na vratima (uskoro)'], best: true },
  { name: 'Premium', price: 90, people: 'Voditelj i 10 radnika', extras: ['Sve iz paketa Standard', 'QR samoprijem na vratima (uskoro)'] },
];

const BENEFITS = [
  { title: 'Dovoljan je mobitel', body: 'Ništa ne instaliraš. Računalo ti ne treba.', icon: Smartphone },
  SCAN
    ? { title: 'Slikaš umjesto da pišeš', body: 'Slikaš prometnu ili pločicu uređaja. Podaci se upišu sami.', icon: Camera }
    : { title: 'Pričaš umjesto da tipkaš', body: 'Ime, telefon i kvar izgovoriš. Aplikacija sve zapiše.', icon: Mic },
  { title: 'Svako vozilo ima povijest', body: 'Što je rađeno, kad i za koliko. Nađeš u sekundi.', icon: History },
  { title: 'Radnici ne vide novac', body: 'Radnik vidi svoje naloge. Cijene i promet vidiš samo ti.', icon: EyeOff },
  { title: 'Knjigovođi jedan paket', body: 'Na kraju mjeseca preuzmeš sve račune odjednom.', icon: FileSpreadsheet },
  { title: 'Ne prepisuješ stare podatke', body: 'Mušterije uvezeš iz Excela ili iz imenika mobitela.', icon: Upload },
];

const FAQ = [
  { q: 'Treba li mi računalo?', a: 'Ne treba. Dovoljan je tvoj mobitel. Android ili iPhone, svejedno je.' },
  { q: 'Koliko košta?', a: 'Od 30 € mjesečno, s PDV-om. Prvih 30 dana ne plaćaš ništa. Karticu ne tražimo.' },
  { q: 'Mogu li dodati radnike?', a: 'Možeš. Svaki radnik ima svoju prijavu. Naloge vidi, cijene i promet ne vidi.' },
  { q: 'Kako mušterija dobije račun?', a: 'Pošalješ joj poveznicu na WhatsApp. Otvori je na mobitelu. Ništa ne mora instalirati.' },
  { q: 'A fiskalizacija?', a: 'Fiskalni račun i dalje izdaješ na blagajni. Mi ti napravimo uredan račun sa stavkama. Na njega upišeš broj fiskalnog računa.' },
  { q: 'Nisam u sustavu PDV-a. Smeta li to?', a: 'Ne smeta. To jednom označiš u postavkama. PDV se onda nigdje ne dodaje.' },
  { q: 'Što dobije knjigovođa?', a: 'Jedan paket za cijeli mjesec. Tablicu za Excel i sve račune.' },
  { q: 'Moram li prepisivati stare mušterije?', a: 'Ne moraš. Uvezeš Excel ili imenik s mobitela. Što već postoji, preskočimo.' },
  { q: 'Gdje su moji podaci?', a: 'Na serverima u Europskoj uniji. Tvoje podatke vidiš samo ti i tvoji radnici.' },
  { q: 'Mogu li odustati kad hoću?', a: 'Možeš. Bez ugovora nema otkaznog roka. Uz ugovor na 24 mjeseca plaćaš 10 % manje.' },
  { q: 'Što ako zapnem?', a: 'Javi nam se. Pomoći ćemo ti.' },
];

export default async function Home() {
  const host = (await headers()).get('host');
  const product = matchPackageFromHost(host);
  const { user } = await getAuth();
  // A signed-in person going to the address just wants the app.
  if (user) redirect('/app');
  const trialDays = Number(process.env.TRIAL_DAYS ?? 30) || 30;
  const register = '/register';
  // Screenshots of this trade, or of the general workshop on the TaktiX address.
  const shots = product?.id ?? 'gear';
  const examples = (product ?? PACKAGES.gear).symptoms.slice(0, 4);
  // Photos from real work (public/landing/foto-1.jpg …), shown once added.
  const dir = path.join(process.cwd(), 'public', 'landing');
  const photos = Array.from({ length: 10 }, (_, i) => ['jpg', 'webp'].map((ext) => `foto-${i + 1}.${ext}`).find((f) => existsSync(path.join(dir, f)))).filter(Boolean) as string[];

  return (
    <div className="min-h-dvh" style={product ? accentStyle(product) : undefined}>
      <div className="mx-auto max-w-6xl px-5 pb-safe pt-safe">
        {/* Header */}
        <header className="flex h-16 items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            {product ? (
              <>
                <ProductMark id={product.id} />
                <span className="font-semibold tracking-tight">{product.product}</span>
              </>
            ) : (
              <BrandLogo />
            )}
          </Link>
          <nav className="flex items-center gap-1">
            <ButtonLink href="#cijene" size="sm" variant="ghost">
              Cijene
            </ButtonLink>
            <ButtonLink href="/login" size="sm" variant="ghost">
              Prijava
            </ButtonLink>
            <ButtonLink href={register} size="sm" variant="primary" className="hidden sm:inline-flex">
              Probaj besplatno
            </ButtonLink>
          </nav>
        </header>

        {/* Hero */}
        <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-accent" />
              {product ? product.tagline : BRAND.tagline}
            </p>
            <h1 className="max-w-2xl text-balance font-display text-5xl font-bold leading-[1.0] tracking-tight sm:text-7xl">
              {product ? HEADLINES[product.id] : (
                <>
                  Gotov posao, poslan račun. <span className="text-accent">Sve iz mobitela.</span>
                </>
              )}
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
              {product
                ? 'Upišeš mušteriju i slikaš vozilo. Dodaš rad i cijenu. Račun pošalješ na WhatsApp.'
                : 'Za mehaničare, servisere i terence. Nema papira po stolu. Nema pisanja računa u ponoć.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={register} variant="primary" size="lg">
                Probaj {trialDays} dana besplatno
              </ButtonLink>
              <ButtonLink href="#probaj" size="lg">
                Probaj odmah, bez prijave
              </ButtonLink>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              {['Bez kartice', 'Bez ugovora', 'Podaci u EU'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-accent" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <PhoneShot src={`/landing/${shots}-hero.webp`} alt="Radni nalog u aplikaciji" />
        </section>

        {/* The troubles, each with its fix */}
        <section className="border-t border-line py-14">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Znaš kako to ide</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {PROBLEMS.map((p) => (
              <li key={p.pain} className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-lg font-semibold">{p.pain}</p>
                <p className="mt-2 flex gap-3 text-sm text-muted">
                  <p.icon className="mt-0.5 size-5 shrink-0 text-accent" />
                  {p.fix}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Real work, once Vedran adds the photos */}
        {photos.length ? (
          <section className="border-t border-line py-14">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">U radionici i na terenu</h2>
            <div className="no-scrollbar -mx-5 mt-8 flex snap-x gap-3 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
              {photos.map((f) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={f} src={`/landing/${f}`} alt="" loading="lazy" className="aspect-[3/2] w-[80%] shrink-0 snap-center rounded-2xl border border-line object-cover sm:w-full" />
              ))}
            </div>
          </section>
        ) : null}

        {/* Try it without an account */}
        <section id="probaj" className="scroll-mt-6 border-t border-line py-14">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Probaj odmah</h2>
          <p className="mb-6 mt-2 text-muted">Izgovori ili upiši kvar. Vidi nalog, poruku i račun.</p>
          <TryIt examples={examples} register={register} />
        </section>

        {/* How it works, with the real screens */}
        <section id="kako" className="scroll-mt-6 border-t border-line py-14">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Kako ide jedan posao</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg">{i + 1}</span>
                  <s.icon className="size-5 text-muted" />
                </div>
                <h3 className="mt-4 font-display text-xl font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{s.body}</p>
                <PhoneShot src={`/landing/${shots}-${s.shot}.webp`} alt={s.title} crop className="mt-5 max-w-[240px]" />
              </li>
            ))}
          </ol>
        </section>

        {/* The old way and the new one */}
        <section className="border-t border-line py-14">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Stari način. Tvoj način.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <p className="mb-3 font-display text-lg font-bold text-faint">Stari način</p>
              <ul className="space-y-2.5">
                {OLD_WAY.map((t) => (
                  <li key={t} className="flex gap-3 text-muted">
                    <X className="mt-0.5 size-5 shrink-0 text-crit" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-accent/50 bg-accent/10 p-5">
              <p className="mb-3 font-display text-lg font-bold text-accent">Tvoj način</p>
              <ul className="space-y-2.5">
                {NEW_WAY.map((t) => (
                  <li key={t} className="flex gap-3">
                    <Check className="mt-0.5 size-5 shrink-0 text-ok" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="border-t border-line py-14">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Rađeno za majstore, ne za urede</h2>
          <div className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-4">
                <b.icon className="mt-0.5 size-6 shrink-0 text-accent" />
                <div>
                  <h3 className="font-semibold">{b.title}</h3>
                  <p className="mt-1 text-sm text-muted">{b.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Trades, or this product's extras */}
        <section className="border-t border-line py-14">
          {product ? (
            <>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Posebno za {product.product}</h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-3">
                {product.pitch.map((line) => (
                  <li key={line} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
                    <Check className="mt-0.5 size-5 shrink-0 text-accent" />
                    {line}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2 id="zanati" className="scroll-mt-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Odaberi svoj posao
              </h2>
              <p className="mt-2 text-muted">Svaki paket priča jezikom tvog zanata.</p>
              <div className="mt-8 space-y-8">
                {TRADE_GROUPS.map((g) => (
                  <div key={g.id}>
                    <h3 className="font-display text-xl font-bold">{g.name}</h3>
                    <p className="text-sm text-muted">{g.hint}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {g.packages.map((id) => PACKAGES[id]).map((p) => (
                        <Link key={p.id} href={`/register?paket=${p.id}`} className="accent-scope group flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent/60" style={accentStyle(p)}>
                          <ProductMark id={p.id} className="size-10" />
                          <span className="min-w-0">
                            <span className="block font-semibold">{p.product}</span>
                            <span className="block text-sm text-muted">{p.tagline}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Prices */}
        <section id="cijene" className="scroll-mt-6 border-t border-line py-14">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Cijene</h2>
          <p className="mt-2 text-muted">Prvih {trialDays} dana besplatno. Bez kartice.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className={cn('flex flex-col rounded-2xl border p-5', p.best ? 'border-accent bg-accent/10' : 'border-line bg-surface')}>
                <p className="flex items-center justify-between font-display text-2xl font-bold">
                  {p.name}
                  {p.best ? <span className="rounded-full bg-accent px-2.5 py-0.5 font-sans text-xs font-semibold text-accent-fg">Preporuka</span> : null}
                </p>
                <p className="mt-3">
                  <span className="font-display text-5xl font-bold">{p.price} €</span>
                  <span className="text-muted"> / mjesečno</span>
                </p>
                <p className="text-sm text-muted">s PDV-om · uz 24 mjeseca {Math.round(p.price * 0.9)} €</p>
                <p className="mt-4 font-medium">{p.people}</p>
                <ul className="mt-2 flex-1 space-y-1.5 text-sm text-muted">
                  {p.extras.map((e) => (
                    <li key={e} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" /> {e}
                    </li>
                  ))}
                </ul>
                <ButtonLink href={register} variant={p.best ? 'primary' : 'secondary'} size="lg" className="mt-5 w-full">
                  Probaj besplatno
                </ButtonLink>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-faint">Mjesečno bez ugovora. Uz ugovor na 24 mjeseca plaćaš 10 % manje.</p>
        </section>

        {/* FAQ */}
        <section className="border-t border-line py-14">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Česta pitanja</h2>
          <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <span className="text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final call */}
        <section className="my-10 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
          <h2 className="text-balance font-display text-4xl font-bold tracking-tight">Probaj na sljedećem poslu.</h2>
          <p className="mx-auto mt-3 max-w-md text-muted">{trialDays} dana besplatno. Ako ti ne pomogne, ne plaćaš ništa.</p>
          <div className="mt-7 flex justify-center">
            <ButtonLink href={register} variant="primary" size="lg">
              Probaj besplatno
            </ButtonLink>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-8 text-sm text-faint">
          <span className="flex items-center gap-2">
            <BrandLogo size="sm" />
          </span>
          <Link href="/login" className="hover:text-fg">
            Prijava za korisnike
          </Link>
        </footer>
      </div>
    </div>
  );
}

// A real screenshot of the app in a phone frame. "crop" shows the top of the
// screen in a shorter frame, for the steps.
function PhoneShot({ src, alt, crop = false, className }: { src: string; alt: string; crop?: boolean; className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-[300px]', className)}>
      <div className="rounded-[2.2rem] border border-line bg-[#05080F] p-2 shadow-2xl shadow-black/50">
        <div className="overflow-hidden rounded-[1.7rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} loading="lazy" className={cn('block w-full', crop && 'aspect-[393/560] object-cover object-top')} />
        </div>
      </div>
    </div>
  );
}
