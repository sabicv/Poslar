import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Camera, Check, ClipboardCheck, EyeOff, FileSpreadsheet, History, Mic, MessageCircle, Receipt, Smartphone } from 'lucide-react';
import { BrandMark, ProductMark } from '@/components/ProductMark';
import { ButtonLink } from '@/components/ui';
import { BRAND, PACKAGES, TRADE_GROUPS, accentStyle, matchPackageFromHost, type PackageConfig, type PackageId } from '@/config/tenant.config';
import { getAuth } from '@/lib/session';

// The landing page sells the product by itself: what it does in a day's
// work, in plain words, for a craftsman on a phone. On a product domain
// (airfiles.hr) it speaks about that trade; anywhere else about X-Files.

// Written the way a craftsman talks, addressing the reader with a capital
// "Vi". No translated marketing phrases.
const HEADLINES: Record<PackageId, string> = {
  volt: 'Autoelektrika bez papira, od prijema do računa.',
  gear: 'Mehaničarska radionica u Vašem džepu.',
  body: 'Limarija i lakirnica: šteta, slike i račun na jednom mjestu.',
  wheel: 'Gume, geometrija i hotel za gume, sve u mobitelu.',
  fleet: 'Servis kamiona i strojeva, bez propuštenih rokova.',
  moto: 'Servis motora i plovila, i zimovanje pod kontrolom.',
  air: 'Klima servis na terenu: raspored, izvještaj i F-plinovi.',
};

const STEPS = [
  { title: 'Primite posao', body: 'Upišite ime, telefon i registraciju ili sve izgovorite. Stalnu mušteriju aplikacija sama prepozna.', icon: ClipboardCheck },
  { title: 'Odradite ga', body: 'Slikajte stanje prije i poslije, upišite radove i dijelove. Radnik vidi što treba napraviti, a cijene vidite samo Vi.', icon: Camera },
  { title: 'Naplatite', body: 'Jednim dodirom napravite račun i pošaljete ga mušteriji na WhatsApp. Kad plati, označite plaćeno.', icon: Receipt },
];

const BENEFITS = [
  { title: 'Dovoljan je mobitel', body: 'Ništa se ne instalira i ne treba računalo. Otvorite stranicu i dodajte je na početni zaslon.', icon: Smartphone },
  { title: 'Govorite, ne tipkajte', body: 'Kvar, napomene i poruke možete izgovoriti. Dobro dođe kad su ruke masne.', icon: Mic },
  { title: 'Mušterija odobri na WhatsAppu', body: 'Pošaljete prijedlog radova s cijenama, a mušterija odobri jednim dodirom. Poslije nema „to nisam tražio”.', icon: MessageCircle },
  { title: 'Povijest svakog vozila i uređaja', body: 'Što je rađeno, kada i za koliko. Nađete u sekundi, i nakon dvije godine.', icon: History },
  { title: 'Radnici ne vide novac', body: 'Radnik vidi svoje naloge i slike. Cijene, naplatu i promet vidite samo Vi.', icon: EyeOff },
  { title: 'Knjigovođi u jednom paketu', body: 'Na kraju mjeseca preuzmete sve račune odjednom i pošaljete ih knjigovođi.', icon: FileSpreadsheet },
];

const FAQ = [
  { q: 'Treba li mi računalo?', a: 'Ne. Dovoljan je mobitel koji već imate, Android ili iPhone. Ako Vam je lakše, sve radi i na računalu.' },
  { q: 'Koliko košta?', a: 'Prvih 30 dana je besplatno i ne tražimo karticu. Nakon toga sami odlučite hoćete li nastaviti. Ništa se ne naplaćuje samo od sebe.' },
  { q: 'Mogu li dodati radnike?', a: 'Možete. Svaki radnik dobije svoju prijavu i vidi naloge na kojima radi, ali ne vidi cijene ni promet.' },
  { q: 'Kako mušterija dobije prijedlog ili račun?', a: 'Pošaljete joj poveznicu na WhatsApp. Otvori je na svom mobitelu, bez prijave i bez instaliranja.' },
  { q: 'Što je s fiskalizacijom?', a: 'Fiskalni račun i dalje izdajete na svojoj blagajni. Aplikacija uz njega napravi uredan račun sa stavkama za mušteriju, a na njega možete upisati broj fiskalnog računa.' },
  { q: 'Nisam u sustavu PDV-a. Je li to problem?', a: 'Nije. U postavkama to jednom označite i aplikacija nigdje ne dodaje PDV, a na računu piše propisana napomena.' },
  { q: 'Što dobije knjigovođa?', a: 'Na kraju mjeseca preuzmete paket sa svim računima: tablicu za Excel i svaki račun kao e-Račun.' },
  { q: 'Gdje su moji podaci?', a: 'Na serverima u Europskoj uniji. Vaše podatke vidite samo Vi i Vaši radnici.' },
  { q: 'Mogu li prestati kad hoću?', a: 'Možete. Nema ugovora ni otkaznog roka.' },
  { q: 'Što ako zapnem?', a: 'Aplikacija je složena tako da se snađete bez uputa. Ako ipak zapnete, javite nam se i pomoći ćemo.' },
];

export default async function Home() {
  const host = (await headers()).get('host');
  const product = matchPackageFromHost(host);
  const { user } = await getAuth();
  // A signed-in person going to the address just wants the app.
  if (user) redirect('/app');
  const trialDays = Number(process.env.TRIAL_DAYS ?? 30) || 30;
  const register = '/register';

  return (
    <div className="min-h-dvh" style={product ? accentStyle(product) : undefined}>
      <div className="mx-auto max-w-6xl px-5 pb-safe pt-safe">
        {/* Header */}
        <header className="flex h-16 items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            {product ? <ProductMark id={product.id} /> : <BrandMark />}
            <span className="font-semibold tracking-tight">{product ? product.product : BRAND.name}</span>
          </Link>
          <nav className="flex items-center gap-2">
            <ButtonLink href="/login" size="sm" variant="ghost">
              Prijava
            </ButtonLink>
            <ButtonLink href={register} size="sm" variant="primary" className="hidden sm:inline-flex">
              Isprobajte besplatno
            </ButtonLink>
          </nav>
        </header>

        {/* Hero */}
        <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-accent" />
              {product ? product.tagline : 'Radionica · Teren · Cesta'}
            </p>
            <h1 className="max-w-2xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              {product ? HEADLINES[product.id] : (
                <>
                  Nalozi, slike i računi. <span className="text-accent">U Vašem mobitelu.</span>
                </>
              )}
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
              {product
                ? 'Upišete mušteriju, slikate, dodate radove i cijene, a račun pošaljete na WhatsApp. Bez papira, bez računala i bez tečaja.'
                : 'Za majstore kojima mušterija dovozi vozilo, za one koji idu na teren i za servise kamiona i strojeva. Upišete posao, slikate, dodate radove i cijene, a račun pošaljete na WhatsApp.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={register} variant="primary" size="lg">
                Isprobajte {trialDays} dana besplatno
              </ButtonLink>
              <ButtonLink href={product ? '#kako' : '#zanati'} size="lg">
                {product ? 'Pogledajte kako radi' : 'Za koje zanate'}
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
          <PhoneMockup product={product} />
        </section>

        {/* How it works */}
        <section id="kako" className="scroll-mt-6 border-t border-line py-14">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Kako izgleda jedan posao</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg">{i + 1}</span>
                  <s.icon className="size-5 text-muted" />
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Benefits */}
        <section className="border-t border-line py-14">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Rađeno za majstore, ne za urede</h2>
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
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Posebno za {product.product}</h2>
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
              <h2 id="zanati" className="scroll-mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
                Odaberite svoj posao
              </h2>
              <p className="mt-2 text-muted">Svaki paket koristi riječi Vašeg zanata: vozilo ili uređaj, mušterija ili tvrtka, radionica ili teren.</p>
              <div className="mt-8 space-y-8">
                {TRADE_GROUPS.map((g) => (
                  <div key={g.id}>
                    <h3 className="text-lg font-semibold">{g.name}</h3>
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

        {/* FAQ */}
        <section className="border-t border-line py-14">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Česta pitanja</h2>
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
          <h2 className="text-balance text-3xl font-semibold tracking-tight">Probajte na sljedećem poslu.</h2>
          <p className="mx-auto mt-3 max-w-md text-muted">{trialDays} dana besplatno. Ako Vam ne olakša posao, jednostavno prestanete i ništa ne plaćate.</p>
          <div className="mt-7 flex justify-center">
            <ButtonLink href={register} variant="primary" size="lg">
              Isprobajte besplatno
            </ButtonLink>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-8 text-sm text-faint">
          <span className="flex items-center gap-2">
            <BrandMark className="size-6" /> X-Files
          </span>
          <Link href="/login" className="hover:text-fg">
            Prijava za korisnike
          </Link>
        </footer>
      </div>
    </div>
  );
}

// One typical job per trade for the phone on the landing page. Prices are
// net; the total includes 25 % VAT.
type Mock = { when: string; title: string; tag: string; complaint: string; lines: [string, number][] };
const MOCKS: Record<PackageId, Mock> = {
  volt: { when: 'Za naplatu', title: 'VW Golf 7 2.0 TDI', tag: 'ZG-1234-AB', complaint: 'Akumulator se prazni preko noći', lines: [['Dijagnostika', 55], ['Akumulator AGM 70 Ah', 165]] },
  gear: { when: 'Za naplatu', title: 'Škoda Octavia 1.6 TDI', tag: 'ZG-4521-KL', complaint: 'Mali servis i kočnice', lines: [['Mali servis (ulje, filteri)', 100], ['Pločice naprijed', 60]] },
  body: { when: 'Za naplatu', title: 'VW Golf 7 2.0 TDI', tag: 'ZG-1234-AB', complaint: 'Udaren stražnji branik', lines: [['Popravak i lakiranje branika', 180], ['Poliranje', 40]] },
  wheel: { when: 'Za naplatu', title: 'Renault Clio 1.2', tag: 'ST-882-EF', complaint: 'Zamjena na zimske gume', lines: [['Montaža i balansiranje', 40], ['Hotel za gume · sezona', 40]] },
  fleet: { when: 'Za naplatu', title: 'MAN TGX 18.440', tag: 'ZG-7788-TK', complaint: 'Redovni servis i tahograf', lines: [['Servis motora', 320], ['Pregled tahografa', 80]] },
  moto: { when: 'Za naplatu', title: 'Yamaha MT-07', tag: 'ZG-456-M', complaint: 'Priprema za sezonu', lines: [['Servis (ulje, filteri)', 90], ['Lanac i zupčanici', 150]] },
  air: { when: 'danas 09:00', title: 'Daikin FTXP35M', tag: 'Dnevni boravak', complaint: 'Godišnji servis klime', lines: [['Servis klime', 60], ['Dezinfekcija isparivača', 8]] },
};
const euro = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

// A still of the app itself: one real job on a phone, as the craftsman sees it.
function PhoneMockup({ product }: { product: PackageConfig | null }) {
  const mock = MOCKS[product?.id ?? 'volt'];
  const total = mock.lines.reduce((sum, [, price]) => sum + price, 0) * 1.25;
  return (
    <div className="mx-auto w-full max-w-[300px]" aria-hidden>
      <div className="rounded-[2.4rem] border border-line bg-zinc-900 p-2.5 shadow-2xl shadow-black/50">
        <div className="overflow-hidden rounded-[1.9rem] bg-bg">
          <div className="flex h-7 items-center justify-center">
            <span className="h-1.5 w-16 rounded-full bg-zinc-800" />
          </div>
          <div className="space-y-3 px-4 pb-5 pt-2 text-[13px]">
            <p className="text-xs text-faint">Nalog #12 · {mock.when}</p>
            <p className="text-lg font-semibold leading-tight">{mock.title}</p>
            <p className="flex items-center gap-2 text-muted">
              <span className="rounded border border-line px-1 font-mono text-[11px] font-semibold text-fg">{mock.tag}</span>
              Ivan Kovač
            </p>
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="text-[11px] text-muted">Opis kvara</p>
              <p className="mt-0.5">{mock.complaint}</p>
            </div>
            <div className="space-y-1.5 rounded-xl border border-line bg-surface p-3">
              {mock.lines.map(([name, price]) => (
                <p key={name} className="flex justify-between gap-2">
                  <span>{name}</span>
                  <span className="tabular shrink-0 text-muted">{euro(price)}</span>
                </p>
              ))}
              <p className="flex justify-between border-t border-line pt-1.5 font-semibold">
                <span>Ukupno s PDV-om</span>
                <span className="tabular">{euro(total)}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-accent font-medium text-accent-fg">
                <Receipt className="size-4" /> Račun
              </span>
              <span className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line font-medium">
                <MessageCircle className="size-4" /> WhatsApp
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
