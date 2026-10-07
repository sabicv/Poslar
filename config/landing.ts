// The words of the public pages: the main page and one page per trade.
// Vedran's text (his edit of 2026-10-05), entered as written; only long
// dashes and typos fixed. Change the words here, not in the pages.

import type { PackageId } from '@/config/tenant.config';

// The main button: straight to real work, 30 days free. Short and the same
// on every page, so it fits a phone on one line (mobile review, 2026-10-07);
// 'where' stays for the pages that pass it.
export const CTA_HEADER = 'Započni besplatno';
export function ctaTrial(where: 'radionica' | 'teren' | 'cesta' | 'plac' | 'sve'): string {
  void where;
  return 'Započni 30 dana besplatno';
}
// The other way in: a demo workshop full of examples, for 24 hours.
export const CTA_DEMO = 'Otvori demo bez prijave';

export const MAIN = {
  eyebrow: 'Operativni sustav za radionice i majstore na terenu',
  title: 'Dok su ti ruke u poslu, pozivi i papiri više ne čekaju.',
  subtitle: 'Poslar zaprima pozive, ugovara termine i organizira naloge. Dobivaš potpunu kontrolu nad radionicom i bržu naplatu, bez administracije nakon radnog vremena.',
  pickLabel: 'Odaberi svoju struku:',
  pillars: [
    { title: 'Poslar na telefonu', text: 'Odgovara na pozive mušterija i slaže raspored dok si pod autom ili na terenu.' },
    { title: 'Bez ručne administracije', text: 'Radni nalozi, računi i paketi za knjigovođu nastaju automatski.' },
    { title: 'Potpuna kontrola', text: 'Pregled svih radova, slika i prometa na tvom mobitelu, gdje god se nalazio.' },
  ],
  scenesTitle: 'Prizori iz tvog radnog tjedna',
  scenes: [
    {
      title: 'Rad u punom pogonu, a telefon stalno zvoni.',
      text: 'Ne prekidaš rad na vozilu. Poslar preuzima poziv i prikuplja simptome. Nalog te čeka. Ti ga samo potvrdiš kad završiš.',
    },
    {
      title: 'Radno vrijeme je završilo. Vrijeme je za odmor.',
      text: 'Upiti izvan radnog vremena dobivaju ponudu slobodnih termina. Tvoj mobitel navečer ostaje slobodan za obitelj.',
    },
    {
      title: 'Potpuna transparentnost i obostrano povjerenje.',
      text: 'Fotografiraj zatečeno stanje i dodaj stavke rada. Mušterija odobrava radove preko mobitela. Sve je čisto i dokumentirano.',
    },
    {
      title: 'Jednostavan pregled svih poslovnica.',
      text: 'Prati raspored i promet svih radionica s jednog mjesta. Podaci o radnicima i nalozima dostupni su ti uvijek.',
    },
    {
      title: 'Prelaženje na novi sustav u samo jedno popodne.',
      text: 'Lako prebaci postojeće naloge i tablice u sustav. AI prepoznaje podatke i slaže ih u digitalnu arhivu.',
    },
  ],
  // Phone first, but a tablet or laptop shows even more (Vedran, 2026-10-05).
  devicesTitle: 'Mobitel na terenu. Laptop u uredu.',
  devicesText: 'Aplikacija je napravljena za mobitel. Na tabletu i laptopu je još preglednija: cijeli nalog, grafovi i raspored na jednom ekranu. Podaci su isti na svim uređajima i odmah usklađeni.',
  painsTitle: 'Zvuči ti poznato?',
  pains: [
    { q: 'Gubiš vrijeme na pisanje ponuda i računa krajem dana?', a: 'Pripremi dokumentaciju u hodu, tijekom rada. Kad zaključaš radionicu, tvoj je radni dan gotov.' },
    { q: 'Treba ti brzo povijest prijašnjih servisa na vozilu?', a: 'Upiši registraciju. U sekundi otvori pregled svih prijašnjih radova i dijelova. Bez traženja po arhivama.' },
    { q: 'Želiš potpunu jasnoću oko iznosa prije početka rada?', a: 'Pošalji ponudu mušteriji na WhatsApp prije početka rada. Obje strane imaju jasan i potvrđen dogovor.' },
    { q: 'Priprema papira za knjigovodstvo oduzima ti previše vremena?', a: 'Poslar automatski pakira sve račune i e-Račune. Knjigovodstvu šalješ sve jednim klikom na kraju mjeseca.' },
  ],
  // Each one opens with "+": the trouble, then how it goes with Poslar.
  extrasTitle: 'I još puno toga',
  extrasHint: 'Dodirni + i vidi kako to izgleda u praksi.',
  extras: [
    {
      title: 'Automatski podsjetnici mušterijama',
      problem: 'Prazan hod u rasporedu jer netko zaboravi na termin?',
      solution: 'Poslar šalje automatske WhatsApp podsjetnike. Mušterije dolaze na vrijeme, a radionica radi bez prekida.',
    },
    {
      title: 'QR prijava na ulazu radionice',
      problem: 'Jutarnji prijem više vozila stvara gužvu na ulazu?',
      solution: 'Postavi QR kod na ulazu. Mušterija sama unese podatke o vozilu. Radni nalog te odmah čeka.',
    },
    {
      title: 'Unaprijed pripremljeni cjenici i normativi',
      problem: 'Ponavljaš unos istih normativa za redovne servise?',
      solution: 'Gotovi šabloni omogućuju izradu naloga u par dodira. Manje tipkanja, brža obrada vozila.',
    },
    {
      title: 'Skeniranje prometne dozvole i pločica uređaja',
      problem: 'Ručni unos broja šasije oduzima vrijeme i donosi rizik od greške?',
      solution: 'Fotografiraj prometnu dozvolu. AI sustav sam očita VIN, marku i model te otvori nalog.',
    },
    {
      title: 'Slanje e-Računa',
      problem: 'Tvrtke od 2026. traže e-Račun. Obični PDF više nije dovoljan.',
      solution: 'Uz svaki račun automatski se slaže e-Račun. Nema dvostrukog unosa istih podataka.',
    },
    {
      title: 'Mušterije same rezerviraju termin',
      problem: 'Česti pozivi radi dogovora termina prekidaju te u radu?',
      solution: 'Stavi link kalendara na Google ili WhatsApp profil. Mušterije same biraju slobodan termin prema tvom rasporedu.',
    },
  ],
  tradesTitle: 'Prilagođeno tvojoj struci',
  tradesSubtitle: 'Svaki zanat ima svoje specifične izazove. Poslar ima rješenje za svaki od njih.',
  finalTitle: 'Isprobaj na prvom sljedećem poslu.',
  finalSub: 'Stekni prednost pred konkurencijom i digitaliziraj posao po svojoj mjeri.',
  finalAsk: 'Pitaj nas na WhatsAppu',
  madeIn: 'Razvijeno u Hrvatskoj',
};

// One line per trade on the main page.
export const TRADE_LINES: Record<PackageId, string> = {
  gear: 'Servisni plan po kilometraži, inspekcija u 50 točaka i evidencija dijelova.',
  volt: 'Baza DTC kodova, mjerenje parazitske potrošnje i dnevnik modula.',
  body: 'Interaktivna mapa oštećenja, recepture boja u gramima i zapisnici za osiguranje.',
  wheel: 'Hotel za gume s QR pozicijama, dubina šare u 3 točke i sezonski podsjetnici.',
  fleet: 'Praćenje po motosatima i kilometrima, zakonski rokovi i terenski nalozi.',
  moto: 'Zapisnik oštećenja s potpisom, konzervacija za zimu i evidencija skladišta.',
  marine: 'Nautički karton po HIN broju, konzervacija motora i vođenje zimovnika.',
  air: 'Dnevni raspored s navigacijom, karton F-plinova i izvještaji s terena.',
  aqua: 'Zapisnik tlačne probe s fotodokumentacijom, evidencija bojlera i hitne intervencije.',
  tow: 'Točne GPS lokacije, slikanje oštećenja pri utovaru i vođenje depoa.',
  deal: 'Brojač dana na placu, kartica troškova pripreme i izračun čiste zarade.',
};

export const PRICING = {
  title: 'Košta manje od jednog radnog sata mjesečno.',
  subtitle: 'Kreni odmah: 30 dana besplatno na svojim poslovima. Ili prvo 24 sata isprobaj demo s izmišljenim podacima.',
  // The founder price (config/plans.ts) instead of a contract discount.
  founder: 'Osnivačka cijena',
  founderNote: (spots: number, months: number) => `za prvih ${spots} radionica, zaključana na ${months} mjeseca.`,
  spotsLeft: (left: number, spots: number) => `Još ${left} od ${spots} mjesta.`,
  full: 'Puna cijena',
  funding: 'Mogućnost sufinanciranja pretplate iz EU fondova i nacionalnih sredstava.',
  best: 'Najčešći izbor',
  vat: 'Sve istaknute cijene uključuju PDV.',
  plans: {
    basic: ['Voditelj i do 2 radnika', 'Radni nalozi, slike i računi', 'Odobrenje ponuda preko WhatsAppa', 'Automatski paket za knjigovođu', '150 slikanja i 100 pitanja Poslaru', 'Poslar na telefonu (uključeno u paket)'],
    standard: ['Voditelj i do 5 radnika', 'Sve iz Basic paketa', 'QR prijava mušterija na ulazu', '300 slikanja i 200 pitanja Poslaru', 'Poslar na telefonu (uključeno u paket)'],
    premium: ['Voditelj i do 10 radnika', 'Sve iz Standard paketa', 'Više radionica na jednom računu', '600 slikanja i 400 pitanja Poslaru', 'Poslar na telefonu (uključeno u paket)'],
  } as Record<'basic' | 'standard' | 'premium', string[]>,
};

export const FAQ: { q: string; a: string }[] = [
  { q: 'Treba li mi računalo u radionici?', a: 'Ne treba. Aplikacija je u potpunosti prilagođena radu na mobitelu (Android i iPhone). Ako imaš tablet ili laptop, na njima je sve još preglednije, a podaci su isti na svim uređajima.' },
  {
    q: 'Kako funkcionira besplatni probni period?',
    a: 'Odmah otvaraš svoju radionicu i 30 dana radiš besplatno na pravim poslovima. Ako želiš prvo razgledati, otvori demo s izmišljenim primjerima iz tvoje struke: traje 24 sata, a nakon toga nastavljaš 30 dana besplatno ili jednostavno odustaješ. Unos bankovne kartice za vrijeme trajanja besplatnog perioda nije potreban.',
  },
  {
    q: 'Što točno radi Poslar na telefonu?',
    a: 'Umjesto prekidanja posla zbog poziva, Poslar automatski preuzima upit. Prikupi informacije o kvaru, ponudi termin i pripremi nalog za tvoju potvrdu.',
  },
  {
    q: 'Kako prebaciti postojeću bazu klijenata i vozila?',
    a: 'Imenik iz mobitela ili Excel tablicu uvezeš u par klikova. Stare papirnate naloge ili račune dovoljno je fotografirati: AI prepoznaje podatke i sam ih dodaje u povijest vozila.',
  },
  { q: 'Vide li moji radnici cijene, zaradu i ukupan promet?', a: 'Ne. Radnici vide samo svoje radne naloge, zadatke i tehničke opise, bez pristupa financijskim podacima i maržama.' },
  {
    q: 'Gdje se čuvaju moji podaci i jesam li siguran?',
    a: 'Svi podaci pohranjeni su na sigurnim poslužiteljima unutar Europske unije u skladu s GDPR uredbom. Pristup podacima imaš isključivo ti i ovlaštene osobe iz tvoje radionice.',
  },
  { q: 'Što iz aplikacije dobiva moj knjigovođa?', a: 'Na kraju mjeseca aplikacija generira jedinstveni paket koji sadrži sve izdane račune u strukturiranoj Excel tablici te datoteke spremne za e-Račun.' },
  { q: 'Kako je riješeno pitanje fiskalizacije?', a: 'Fiskalni račun trenutno izdaješ na svojoj blagajni, a u aplikaciju jednostavno upišeš njegov broj radi potpune evidencije po radnom nalogu.' },
  { q: 'Je li za rad potrebna stalna internetska veza?', a: 'Da, potrebna je internetska veza. Sustav je optimiziran tako da troši minimalno podataka i radi stabilno čak i na slabijem mobilnom signalu.' },
  { q: 'Postoji li ugovorna obveza?', a: 'Ne. Usluga se plaća mjesečno i otkazuješ je kad god želiš. Svoju kompletnu arhivu preuzimaš jednim klikom.' },
  { q: 'Što ako mi zatreba pomoć pri korištenju?', a: 'Naša podrška dostupna ti je izravno putem WhatsAppa ili telefonskog poziva. Pomažemo ti u podešavanju i radu.' },
];

export interface TradePage {
  id: PackageId;
  slug: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  agent: string;
  scene: string;
  pains: { q: string; a: string }[];
  features: { title: string; text: string }[];
  jobs: string[];
}

export const TRADE_PAGES: TradePage[] = [
  {
    id: 'gear',
    slug: 'automehanicar',
    eyebrow: 'Automehanika i opći servis',
    title: 'Ti si pod dizalicom. Poslar preuzima poziv i slaže termin.',
    subtitle: 'Pozivi, radni nalozi, servisni planovi i računi. Sve teče glatko dok su ti ruke u poslu.',
    agent: 'Mušterija zove radi redovnog servisa. Poslar prikupi podatke o vozilu, provjeri kalendar i ponudi slobodan termin.',
    scene: 'Mlađi radnik radi veliki servis. Poslar ga vodi kroz svaki korak zahvata, dok inspekcija u 50 točaka jamči da nijedan detalj ne ostane nepregledan.',
    pains: [
      { q: 'Koliko je pređeno od zadnje izmjene ulja?', a: 'Servisni plan bilježi kilometre i datume te sam šalje podsjetnik klijentu kad dođe vrijeme za servis.' },
      { q: 'Mušterija sumnja da je zamjena kočnica bila potrebna?', a: 'Priloži fotografiju potrošenih diskova uz stavku naloga. Klijent odobrava rad jednim klikom na mobitelu.' },
      { q: 'Želiš na vrijeme obavijestiti mušterije o nadolazećem servisu ili zamjeni guma?', a: 'Poslar pripremi listu i šalje obavijest s opcijom brze rezervacije termina putem WhatsAppa.' },
    ],
    features: [
      { title: 'Inspekcija u 50 točaka', text: 'Jasne oznake stanja (zeleno, žuto, crveno) uz obaveznu fotografiju oštećenja ili istrošenosti.' },
      { title: 'Servisni plan vozila', text: 'Automatizirano praćenje izmjene ulja, filtera i remenja po prijeđenim kilometrima i vremenu.' },
      { title: 'Upravljanje dijelovima', text: 'Kataloški brojevi, dobavljači, nabavne cijene i jamstva vezani uz radni nalog.' },
      { title: 'Unaprijed pripremljeni poslovi', text: 'Otvaranje standardnih servisnih radova jednim dodirom ekrana.' },
      { title: 'Dodatni moduli', text: 'Ugrađena evidencija za hotel guma i terenske intervencije.' },
    ],
    jobs: ['Mali servis', 'Veliki servis', 'Izmjena seta razvodnog remena', 'Zamjena prednjih kočnica', 'Zamjena seta spojke', 'Servis klima uređaja', 'Priprema za tehnički pregled', 'Zamjena prednjih amortizera'],
  },
  {
    id: 'volt',
    slug: 'autoelektricar',
    eyebrow: 'Autoelektrika, dijagnostika i elektronika',
    title: 'Greška na autu? Rješenje je već u tvojoj arhivi.',
    subtitle: 'Kodovi grešaka, mjerenja i zahvati na modulima. Sve ostaje zapisano i pretraživo u sekundi.',
    agent: 'Kod kompleksnijih autoelektričnih upita, Poslar prikupi simptome i pripremi nalog prije dolaska vozila u radionicu.',
    scene: 'Radnik u radionici ima brz pristup bazi prošlih popravaka i opisima grešaka. Popravak teče znatno brže.',
    pains: [
      { q: 'Koji si specifičan kvar lani riješio na istom modelu vozila?', a: 'Unesi DTC kod u tražilicu i odmah otvori svoje stare bilješke s točnim rješenjem.' },
      { q: 'Kako dokazati koliku struju auto vuče dok miruje?', a: 'Modul za mjerenje parazitske potrošnje izbacuje čitljiv grafički prikaz pada struje spreman za mušteriju.' },
      { q: 'Gdje ti je ostala sigurnosna kopija kodiranja s prošlotjednog modula?', a: 'Dnevnik zahvata automatski čuva sve izmjene i backup datoteke uz broj šasije.' },
    ],
    features: [
      { title: 'Baza DTC kodova', text: 'Povezivanje tvorničkih grešaka s tvojom vlastitom arhivom uspješnih popravaka.' },
      { title: 'Parazitska potrošnja', text: 'Mjerenje i grafički prikaz pražnjenja akumulatora kroz vrijeme.' },
      { title: 'Dnevnik zahvata na modulima', text: 'Bilježenje kodiranja, adaptacija i pohrana sigurnosnih kopija (backup).' },
      { title: 'Evidencija ključeva', text: 'Zapisnik programiranja ključeva i imobilizatora.' },
      { title: 'Testiranje sustava', text: 'Zapisnici ispitanosti akumulatora, alternatora i sustava punjenja.' },
    ],
    jobs: ['Električna dijagnostika', 'Test akumulatora i punjenja', 'Mjerenje parazitske potrošnje', 'Programiranje ključa', 'Kodiranje upravljačkog modula', 'Zamjena alternatora', 'Zamjena pokretača (anlasera)', 'Ugradnja parking senzora'],
  },
  {
    id: 'body',
    slug: 'limar-lakirer',
    eyebrow: 'Autolimarija, lakirnica i procjena šteta',
    title: 'Oštećenja, fotografije i zapisnik. Osiguranje dobiva sve na dlanu.',
    subtitle: 'Od zaprimanja do izlaska iz komore. Svaka faza je dokumentirana, a svaki gram boje izbrojan.',
    agent: 'Za limarske radove Poslar zaprima upit i fotografije oštećenja unaprijed, omogućujući bržu i točniju procjenu.',
    scene: 'Upravljaš radovima u limariji i lakirnici. U svakom trenutku na mobitelu vidiš u kojoj se točno fazi nalazi koje vozilo, od pripreme i kitanja do komore i poliranja.',
    pains: [
      { q: 'Kako dokazati točnu potrošnju i recepturu zamiješane boje?', a: 'Zapisuj šifru boje i točnu recepturu u gramima za svaki radni nalog.' },
      { q: 'Osiguravajuća kuća traži dodatne dokaze oštećenja prije popravka?', a: 'Izvezi službeni zapisnik s fotografijama „prije, tijekom i poslije” radova u jednom dokumentu.' },
      { q: 'Želiš pružiti mušterijama točnu informaciju o napretku radova bez čestih poziva?', a: 'Ažuriranjem statusa u aplikaciji (priprema, lakiranje, završeno) Poslar šalje automatsku obavijest mušteriji.' },
    ],
    features: [
      { title: 'Interaktivna mapa oštećenja', text: 'Dodirni oštećeni dio na vizualnom modelu vozila, dodaj operaciju i predviđene radne sate.' },
      { title: 'Evidencija lakirnice', text: 'Pohrana šifri boja, receptura i utroška materijala u gramima.' },
      { title: 'Zapisnici za osiguranja', text: 'Automatsko generiranje dokumentacije s fotografijama prije i poslije popravka.' },
      { title: 'Praćenje proizvodnje', text: 'Kontrola protoka vozila kroz limarske i lakirerske faze.' },
      { title: 'Standardni normativi', text: 'Brzo otvaranje radnih naloga za najčešće limarske i lakirerske zahvate.' },
    ],
    jobs: ['Popravak plastičnog branika', 'Lakiranje jednog elementa', 'Popravak i lakiranje vrata', 'Zamjena prednjeg blatobrana', 'Spot repair (lokalno lakiranje)', 'PDR popravak udubljenja od tuče', 'Poliranje i restauracija farova', 'Nanošenje keramičke zaštite'],
  },
  {
    id: 'wheel',
    slug: 'vulkanizer',
    eyebrow: 'Vulkanizerske usluge, geometrija kotača i hotel za gume',
    title: 'Prebrodi sezonsku gužvu bez kaosa na telefonu.',
    subtitle: 'Termini, hotel za gume i obavijesti mušterijama. Ti mijenjaš gume, sustav vodi sve ostalo.',
    agent: 'U sezonskim gužvama Poslar automatski raspoređuje termine izmjene guma prema stvarnim kapacitetima radionice.',
    scene: 'Radnik preuzima set guma iz skladišta. Skenira QR kod s naljepnice i odmah zna točnu lokaciju u hotelu za gume.',
    pains: [
      { q: 'Potrebna ti je brza informacija o točnoj lokaciji pohranjenih guma u skladištu?', a: 'QR naljepnica točno označava regal, policu i poziciju u hotelu za gume.' },
      { q: 'Mušterija tvrdi da su joj gume prošle sezone imale dublju šaru?', a: 'Prijemni zapisnik bilježi dubinu šare u tri točke, DOT broj i zatečeno stanje felgi.' },
      { q: 'Kako na vrijeme obavijestiti sve klijente da rezerviraju termin prije gužve?', a: 'Pošalji grupni sezonski podsjetnik na WhatsApp jednim klikom iz aplikacije.' },
    ],
    features: [
      { title: 'Hotel za gume', text: 'Sustav označavanja QR kodovima uz točan raspored (sektor, regal, polica, mjesto).' },
      { title: 'Karton stanja guma', text: 'Unos dubine šare u 3 točke, DOT oznake i pregled oštećenja naplataka.' },
      { title: 'Geometrija kotača', text: 'Pohrana parametara prije i poslije podešavanja te evidencija momenta pritezanja (Nm).' },
      { title: 'Sezonske SMS/WhatsApp kampanje', text: 'Automatizirano slanje obavijesti pred početak ljetne ili zimske sezone.' },
      { title: 'Mobilni vulkanizer', text: 'Nalozi i evidencija radova na terenu ili za vozne parkove tvrtki.' },
    ],
    jobs: ['Sezonska zamjena guma', 'Balansiranje 4 kotača', 'Krpanje gume (čep/zakrpa)', 'Geometrija kotača (optika)', 'Čuvanje guma u hotelu (sezona)', 'Montaža 4 nove gume', 'Programiranje TPMS senzora', 'Zamjena ventila'],
  },
  {
    id: 'fleet',
    slug: 'kamioni-strojevi',
    eyebrow: 'Teretni program, građevinska mehanizacija i vozni parkovi',
    title: 'Nijedan rok ne promakne. Ni periodični pregled, ni tahograf.',
    subtitle: 'Motosati, kilometri i zakonske obveze. Potpuna evidencija za tegljače, prikolice, bagere i traktore.',
    agent: 'Disponent flote šalje zahtjev za servis tegljača. Poslar zaprima podatke i usklađuje termin prema slobodnim kapacitetima.',
    scene: 'Servisna ekipa je na terenu kod radnog stroja. Radni nalog sadrži točnu GPS lokaciju, popis radova i digitalni potpis strojara ili vozača po završetku.',
    pains: [
      { q: 'Kako izbjeći propuste oko atesta, tahografa ili tehničkog pregleda?', a: 'Sustav automatski šalje upozorenja o zakonskim rokovima tjednima unaprijed.' },
      { q: 'Kako osigurati redovito održavanje flote prema radnim satima i kilometraži?', a: 'Poslar prati oba parametra i automatski najavljuje nadolazeće servisne intervale za svako vozilo.' },
      { q: 'Kamion i prikolica stigli su skupa, ali zahtijevaju odvojenu povijest održavanja?', a: 'Sustav vodi zasebne kartone za vučna i priključna vozila ili radne alate.' },
    ],
    features: [
      { title: 'Servisni intervali', text: 'Praćenje dospijeća po radnim satima (mth) i kilometraži.' },
      { title: 'Odvojena povijest vozila', text: 'Zasebni kartoni za tegljače, prikolice, građevinske strojeve i priključke.' },
      { title: 'Upozorenja o zakonskim rokovima', text: 'Automatsko praćenje kalendara za tahograf, kalibracije i tehničke preglede.' },
      { title: 'Terenski radni nalozi', text: 'GPS lokacija kvara, evidencija utrošenog vremena i digitalni potpis korisnika.' },
      { title: 'Zapisnik stanja', text: 'Detaljan pregled opreme i zatečenog stanja prije početka radova.' },
    ],
    jobs: ['Preventivni servis PM-A', 'Prošireni servis PM-B', 'Terenska dijagnostika i popravak', 'Priprema teretnog vozila za tehnički', 'Pregled kočionog sustava prikolice', 'Zamjena obloga kočnica po osovini', 'Redoviti servis radnog stroja (250 mth)', 'Izrada i zamjena hidrauličnog crijeva'],
  },
  {
    id: 'moto',
    slug: 'motocikli',
    eyebrow: 'Motocikli, skuteri i quadovi',
    title: 'Sezona kreće naglo. Ti stigneš sve prije prvog sunčanog dana.',
    subtitle: 'Zaprimanje s potpisom, konzervacija za zimu i skladište motocikala. Jedan sustav za cijelu sezonu.',
    agent: 'Prvi topli dan i telefon zvoni bez prestanka, svi žele dekonzervaciju odjednom. Poslar slaže termine po redu i otvara nalog s registracijom dok ti radiš na dizalici.',
    scene: 'Preko zime garaža je puna motocikala na čuvanju. Skladišni modul ti točno pokazuje gdje je koji motocikl i u kojoj je fazi konzervacije, bez listanja bilježnice.',
    pains: [
      { q: 'Vlasnik tvrdi da je ogrebotina na oklopu nastala kod tebe tijekom zimovanja?', a: 'Prijemni zapisnik ima fotografije zatečenog stanja i digitalni potpis klijenta pri predaji.' },
      { q: 'Gubiš vrijeme tražeći gdje je u garaži odloženi motocikl?', a: 'Skladišni modul povezuje registraciju s točnim mjestom i trenutnom fazom rada.' },
      { q: 'Kupac polovnog motocikla traži dokaz da je lanac i vilica servisirana lani?', a: 'Kompletan karton vozila vodi se po VIN-u i kilometraži, pretraživ u sekundi.' },
    ],
    features: [
      { title: 'Prijemni zapisnik', text: 'Evidencija oklopa i prateće opreme uz fotografije i potpis klijenta.' },
      { title: 'Konzervacija i dekonzervacija', text: 'Unaprijed definirane kontrolne liste radova za zimski i ljetni period.' },
      { title: 'Upravljanje skladištem', text: 'Evidencija smještaja svakog motocikla u garaži ili zimovniku.' },
      { title: 'Karton vozila', text: 'Pretraga po VIN-u, serijskom broju i kilometraži.' },
      { title: 'Prilagođeni normativi', text: 'Pripremljeni radni zadaci za lanac, kočnice, vilicu i variomat.' },
    ],
    jobs: ['Mali servis motocikla', 'Veliki servis motocikla', 'Konzervacija za zimu', 'Dekonzervacija i probna vožnja', 'Zamjena lanca i zupčanika', 'Servis prednje ovjesne vilice', 'Zamjena kočionih pločica', 'Servis variomata i remena'],
  },
  {
    id: 'marine',
    slug: 'nautika',
    eyebrow: 'Plovila, jet-skiji, vanbrodski i unutarnji motori',
    title: 'Zimovanje bez papirnatog kaosa. Proljeće bez stresa.',
    subtitle: 'Zaprimanje s potpisom, konzervacija motora i vođenje zimovnika. Za plovila, jet-skije i vanbrodske motore.',
    agent: 'S prvim sunčanim danima u ožujku svi klijenti zovu u isto vrijeme radi dekonzervacije. Poslar samostalno slaže termine i organizira kalendar radova.',
    scene: 'Tijekom zimskih mjeseci poslovanje je pod potpunom kontrolom. Skladišni modul točno prikazuje gdje je smješteno koje plovilo i u kojoj je fazi konzervacije.',
    pains: [
      { q: 'Vlasnik tvrdi da je ogrebotina na trupu nastala tijekom zimovanja?', a: 'Prijemni zapisnik sadrži fotografije zatečenog stanja i digitalni potpis klijenta pri predaji.' },
      { q: 'Gubiš vrijeme tražeći gdje se u zimovniku nalazi skinuti vanbrodski motor?', a: 'Skladišni modul povezuje serijski broj motora s točnim mjestom u skladištu.' },
      { q: 'Kada je na plovilu zadnji put mijenjan impeler ili cinkovi?', a: 'Kompletan karton motora vodi se po HIN broju, serijskom broju i radnim satima.' },
    ],
    features: [
      { title: 'Prijemni zapisnik', text: 'Detaljna evidencija trupa i prateće opreme uz fotografije i potpis.' },
      { title: 'Konzervacija i dekonzervacija', text: 'Unaprijed definirane kontrolne liste radova za zimski i ljetni period.' },
      { title: 'Nautički karton', text: 'Pretraga po HIN broju, serijskom broju motora i motosatima.' },
      { title: 'Upravljanje zimovnikom', text: 'Evidencija smještaja plovila, jet-skija i vanbrodskih motora.' },
      { title: 'Prilagođeni normativi', text: 'Pripremljeni radni zadaci za impeler, anode i antivegetativnu zaštitu.' },
    ],
    jobs: ['Konzervacija vanbrodskog motora', 'Dekonzervacija i test rada', 'Konzervacija jet-skija', 'Godišnji servis vanbrodskog motora', 'Zamjena impelera i pumpe vode', 'Zamjena anoda', 'Nanošenje antivegetativnog premaza', 'Prijem i pregled trupa prije zimovanja'],
  },
  {
    id: 'air',
    slug: 'klima-serviser',
    eyebrow: 'Klima uređaji, dizalice topline i ventilacijski sustavi',
    title: 'Ti montiraš na terenu. Poslar puni tvoj dnevni raspored.',
    subtitle: 'Raspored rada, evidencija F-plinova i slikovni izvještaji. Sve dostupno s terena.',
    agent: 'U srpnju na +35 °C telefon zvoni bez prestanka. Poslar preuzima pozive, bilježi adresu, provjerava lokacije i ugovara termine prema tvom planu kretanja.',
    scene: 'Više terenskih timova radi na terenu. Svaki monter na mobitelu ima svoj dnevni raspored i navigaciju. Ti iz ureda ili vozila pratiš završene izvještaje sa slikama.',
    pains: [
      { q: 'Koliko je radnog medija dopunjeno u sustav na prošlom servisu?', a: 'Karton opreme automatski bilježi F-plinove i ispitivanja propusnosti uz svaki uređaj.' },
      { q: 'Vlasnik objekta nije bio prisutan tijekom radova i traži dokaz?', a: 'Slikovni izvještaj sa satnicom i GPS lokacijom šalje se izravno na njegov e-mail ili WhatsApp.' },
      { q: 'Ne stigneš ručno voditi evidenciju o dospijeću godišnjih servisa?', a: 'Sustav sam prepoznaje objekte kojima se bliži rok servisa i priprema podsjetnike.' },
    ],
    features: [
      { title: 'Pametni dnevni raspored', text: 'Ugrađena navigacija i slanje automatske obavijesti klijentu „Na putu sam” jednim klikom.' },
      { title: 'Terenski slikovni izvještaj', text: 'Izrada izvještaja s fotografijama prije i poslije čišćenja ili ugradnje.' },
      { title: 'Evidencija F-plinova', text: 'Vođenje baze radnih medija i evidencije provjere zabrtvljenosti.' },
      { title: 'Automatski godišnji podsjetnici', text: 'Pravovremeno obavještavanje klijenata o redovitom servisu.' },
      { title: 'Podrška za kompleksne sustave', text: 'Kartoni za split sustave, multi-split, dizalice topline i rekuperatore.' },
    ],
    jobs: ['Redoviti godišnji servis klime', 'Montaža split sustava do 3,5 kW', 'Dopuna rashladnog medija R32', 'Tlačna proba i provjera propusnosti', 'Dubinsko kemijsko čišćenje i dezinfekcija', 'Dijagnostika i servis dizalice topline', 'Servis multi-split sustava', 'Čišćenje i servis rekuperatora'],
  },
  {
    id: 'aqua',
    slug: 'vodoinstalater',
    eyebrow: 'Vodoinstalacije, grijanje, bojleri i hitne intervencije',
    title: 'Curi voda? Poslar odmah daje prvu uputu klijentu.',
    subtitle: 'Hitni pozivi, tlačne probe i servisi bojlera. Potpuna organizacija terenskog rada.',
    agent: 'Klijent zove u panici zbog puknuća cijevi. Poslar ga smireno uputi kako zatvoriti glavni ventil, prikupi adresu i odmah ti otvara nalog za hitnu intervenciju.',
    scene: 'Pomoćnik samostalno izvodi tlačnu probu cjevovoda. Preko aplikacije fotografira manometar i generira službeni zapisnik bez potrebe za naknadnim pisanjem u uredu.',
    pains: [
      { q: 'Zaboraviš kad je na kojem objektu potrebno zamijeniti zaštitnu anodu u bojleru?', a: 'Sustav vodi bazu ugrađenih uređaja i upozorava na dospijeće servisa.' },
      { q: 'Investitor ili nadzorni inženjer traži službeni zapisnik tlačne probe?', a: 'Generiraj digitalni zapisnik s fotografijom manometra i parametrima tlaka spreman za slanje.' },
      { q: 'Dolaziš na objekt i ne znaš gdje se nalazi glavni ventil ili specifični vodovi?', a: 'Napomene o pristupu i fotografije izvedenog stanja pod žbukom vezane su uz adresu objekta.' },
    ],
    features: [
      { title: 'Zapisnik tlačne probe', text: 'Automatska izrada dokumenta s fotografijom manometra i početnim i završnim tlakom.' },
      { title: 'Protokol za hitne pozive', text: 'Automatsko slanje osnovnih uputa klijentu u slučaju poplave ili kvara.' },
      { title: 'Karton objekta i uređaja', text: 'Pohrana podataka o instalacijama, bojlerima, kotlovima i pristupnim šiframa.' },
      { title: 'Planer redovitih servisa', text: 'Pravovremeno zakazivanje servisa bojlera i kotlovnica.' },
      { title: 'Terenska navigacija', text: 'Brzo pokretanje rute i slanje obavijesti klijentu o dolasku.' },
    ],
    jobs: ['Detekcija i lociranje curenja', 'Redoviti servis plinskog ili električnog bojlera', 'Zamjena bojlera', 'Servis plinskog kotla', 'Popravak ugradbenog vodokotlića', 'Zamjena mješalice ili slavine', 'Tlačna proba cjevovoda', 'Odzračivanje i balansiranje sustava grijanja'],
  },
  {
    id: 'tow',
    slug: 'vucna-sluzba',
    eyebrow: 'Vuča vozila, asistencija i pomoć na cesti',
    title: 'Poziv u tri ujutro. Lokacija i navigacija spremni u sekundi.',
    subtitle: 'Brzo preuzimanje lokacije, fotografije pri utovaru, obračun kilometara i vođenje depoa.',
    agent: 'Dok voziš ili spavaš, Poslar preuzima poziv vozača u kvaru, zabilježi točnu GPS lokaciju, marku vozila i broj predmeta asistencije te ti priprema rute za polazak.',
    scene: 'Noćna smjena odrađuje intervenciju. Vozač vučnog vozila ima sve podatke i fotografije utovarenog vozila na mobitelu, dok ured ima uvid u status intervencije u realnom vremenu.',
    pains: [
      { q: 'Kako se zaštititi od lažnih tvrdnji da je oštećenje na vozilu nastalo tijekom utovara?', a: 'Obavezni foto-zapisnik s vremenskom oznakom prije podizanja na navoz rješava sve prigovore.' },
      { q: 'Osiguravajuća kuća ili asistencija traži detaljan izvještaj o vremenu i kilometraži?', a: 'Svi koraci (polazak, dolazak, utovar, dostava) bilježe se automatski i slažu u izvještaj.' },
      { q: 'Zaboraviš koliko je dana pojedino vozilo smješteno na tvom depou?', a: 'Automatski brojač dana na depou samostalno obračunava točan iznos ležarine.' },
    ],
    features: [
      { title: 'Sustav za hitne pozive', text: 'Preuzimanje točne lokacije pozivatelja i pokretanje navigacije u jednom dodiru.' },
      { title: 'Slikovni zapisnik utovara', text: 'Brzo fotografiranje stanja vozila prije podizanja radi zaštite od šteta.' },
      { title: 'Praćenje koraka intervencije', text: 'Zapis vremena polaska, dolaska na lokaciju, utovara i istovara.' },
      { title: 'Izvještaji za asistencije', text: 'Automatska priprema podataka s brojem predmeta, kilometražom i ležarinom.' },
      { title: 'Upravljanje depoom', text: 'Pregled parkiranih vozila i brojač dana za obračun ležarine.' },
    ],
    jobs: ['Gradski prijevoz vozila', 'Međugradska vuča', 'Terenska asistencija i dovoz goriva', 'Izvlačenje vozila s terena', 'Ležarina na depou (po danu)', 'Rad noću ili blagdanom', 'Utovar vozila s blokiranim kotačima', 'Prijevoz radnih strojeva'],
  },
  {
    id: 'deal',
    slug: 'auto-plac',
    eyebrow: 'Otkup, priprema i prodaja rabljenih vozila',
    title: 'Svaki auto na placu: dani, uloženi trošak i čista zarada.',
    subtitle: 'Od otkupa do prodaje. Potpuni financijski pregled ulaganja u svako vozilo na lageru.',
    agent: 'Kupac zove kasno navečer za auto iz oglasa. Poslar provjerava je li vozilo slobodno ili rezervirano, daje osnovne informacije i ugovara termin za razgledavanje.',
    scene: 'Vodiš jedan ili više auto placeva. U svakom trenutku na mobitelu vidiš koliko dana pojedini auto stoji na skladištu, koliko je uloženo u njegovu pripremu i kolika je očekivana marža.',
    pains: [
      { q: 'Auto stoji na placu 90 dana, a nemaš točan pregled koliko te do sada koštao?', a: 'Svako vozilo ima svoju karticu u koju ulaze nabavna cijena, svi dijelovi, poliranje i popravci.' },
      { q: 'Netko ode na probnu vožnju, a ti nemaš zabilježeno tko je upravljao vozilom u slučaju prekršaja?', a: 'Digitalni zapisnik probne vožnje sa slikom vozačke dozvole izrađuje se u par sekundi.' },
      { q: 'Krivo procijeniš zaradu jer nisi uračunao sitne troškove pripreme prije prodaje?', a: 'Sustav automatski oduzima sve troškove servisa i ulaganja od prodajne cijene i prikazuje čistu zaradu.' },
    ],
    features: [
      { title: 'Financijski karton vozila', text: 'Praćenje broja dana na lageru, nabavne cijene i svih dodatnih troškova pripreme.' },
      { title: 'Interni radni nalozi', text: 'Otvaranje naloga za vlastitu radionicu ili vanjske partnere (servis, poliranje, kemijsko čišćenje).' },
      { title: 'Zapisnik probne vožnje', text: 'Slikanje dokumenta vozača i evidencija vremena probne vožnje.' },
      { title: 'Status vozila', text: 'Pregled slobodnih, rezerviranih i prodanih vozila u realnom vremenu.' },
      { title: 'Zaštićeni financijski podaci', text: 'Izračun čiste zarade i marže vidljiv je isključivo vlasniku računa.' },
    ],
    jobs: ['Ulazni pregled vozila pri otkupu', 'Pripremni servis pred prodaju', 'Kemijsko čišćenje i poliranje', 'Zamjena seta guma za prodaju', 'Priprema dokumentacije za registraciju', 'Otklanjanje sitnih limarskih oštećenja', 'Zamjena akumulatora', 'Ispitivanje i punjenje klime'],
  },
];

export const tradeBySlug = (slug: string) => TRADE_PAGES.find((t) => t.slug === slug) ?? null;
export const tradeById = (id: PackageId) => TRADE_PAGES.find((t) => t.id === id)!;

// Every trade page lists its five features and this one, so the grid is
// always full (3 x 2 on a computer, 2 x 3 on a tablet).
export const COMMON_FEATURE = { title: 'Pitaj Poslara', text: 'Na svakom nalogu koraci, specifikacije i upozorenja. Pitaš glasom, Poslar odgovara.' };

export const TRADE_SECTION = {
  agent: 'Poslar na djelu',
  scene: 'Prizor iz radionice',
  pains: 'Zvuči ti poznato?',
  features: 'Ključne mogućnosti',
  jobs: 'Gotovi normativi radova',
};
