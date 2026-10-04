import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, ProviderBlock, Section } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Politika privatnosti' };

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="font-medium text-accent hover:underline">
    {children}
  </Link>
);

// Privacy policy. Facts as built: data in the EU (Supabase eu-west-1 and
// Vercel dub1, both Ireland), photos and job data to Anthropic only when
// someone uses photo reading or the Kopilot, no tracking cookies. A draft
// to be reviewed by a lawyer before the paid launch.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Politika privatnosti"
      intro={<p>Ovdje piše koje osobne podatke obrađujemo kad koristite TaktiX ili posjetite ovu stranicu, zašto, s kim ih dijelimo, koliko ih čuvamo i koja su Vaša prava.</p>}
    >
      <Section n={1} title="Tko obrađuje podatke">
        <ProviderBlock />
        <p>Za sva pitanja o podacima pišite nam na gornju adresu.</p>
      </Section>

      <Section n={2} title="Dvije uloge">
        <ul>
          <li>
            Za podatke <strong>korisnika aplikacije</strong> (vlasnika, voditelja i radnika radionica) i <strong>posjetitelja stranice</strong> mi smo voditelj obrade.
          </li>
          <li>
            Za podatke <strong>mušterija</strong> koje radionica unosi u TaktiX (imena, telefoni, vozila i uređaji, fotografije, ponude, računi) voditelj obrade je radionica. Mi ih obrađujemo samo
            po njezinu nalogu, prema <A href="/obrada-podataka">Ugovoru o obradi podataka</A>. Ako ste mušterija, za svoje podatke obratite se radionici.
          </li>
        </ul>
      </Section>

      <Section n={3} title="Koje podatke obrađujemo">
        <ul>
          <li>
            <strong>Račun:</strong> ime i prezime, e-adresa, telefon, uloga u radionici. Lozinku ne spremamo, nego samo njezin nepovratni sažetak.
          </li>
          <li>
            <strong>Radionica:</strong> naziv, OIB, adresa, telefon, e-adresa, IBAN, logotip, oznake poslovnog prostora i naplatnog uređaja.
          </li>
          <li>
            <strong>Pretplata:</strong> paket, uplate (iznos i datum), poziv na broj, preporuke.
          </li>
          <li>
            <strong>Rad u aplikaciji:</strong> tko je otvorio ili uredio nalog i kada. Kod rada na terenu i vučne službe spremamo lokaciju mobitela u trenutku kad radnik dodirne korak (primjerice
            „Na putu” ili „Stigao”); lokaciju ne pratimo stalno. Uz fotografiju spremamo vrijeme i mjesto snimanja ako ih fotografija sadrži.
          </li>
          <li>
            <strong>Podrška:</strong> poruke koje pošaljete kroz „Javi problem” i vrsta preglednika.
          </li>
          <li>
            <strong>Greške:</strong> kad aplikacija javi grešku, spremamo poruku greške, stranicu, vrstu preglednika, vrijeme te radionicu i korisnika kod kojeg se dogodila.
          </li>
          <li>
            <strong>Zaštita od zlouporabe:</strong> kod registracije i prijave kvara preko QR koda IP adresu spremamo samo kao nepovratni sažetak, da bismo ograničili broj pokušaja.
          </li>
          <li>
            <strong>Posjet stranici:</strong> pružatelji poslužitelja bilježe IP adresu i vrijeme zahtjeva u svojim tehničkim zapisima.
          </li>
        </ul>
      </Section>

      <Section n={4} title="Zašto i na kojoj osnovi">
        <ul>
          <li>Pružanje usluge, podrška i naplata pretplate: izvršenje ugovora (čl. 6. st. 1. t. b) Opće uredbe o zaštiti podataka).</li>
          <li>Računi za pretplatu i knjigovodstvo: zakonska obveza (čl. 6. st. 1. t. c).</li>
          <li>Sigurnost, sprječavanje zlouporabe i otklanjanje grešaka: legitimni interes (čl. 6. st. 1. t. f).</li>
        </ul>
        <p>Podatke ne koristimo za oglašavanje i ne prodajemo ih.</p>
      </Section>

      <Section n={5} title="S kim dijelimo podatke">
        <p>Podatke obrađuju ovi izvršitelji obrade, samo za potrebe usluge:</p>
        <ul>
          <li>
            <strong>Supabase Inc.</strong>: baza podataka, prijava i pohrana fotografija. Podaci su pohranjeni u Europskoj uniji (Irska).
          </li>
          <li>
            <strong>Vercel Inc.</strong>: poslužitelj aplikacije u Europskoj uniji (Dublin, Irska). Datoteke same aplikacije isporučuju se preko njihove globalne mreže.
          </li>
          <li>
            <strong>Anthropic PBC</strong> (SAD): samo kad korisnik pokrene čitanje fotografije (Slikanje) ili Kopilot. Šalje se ta fotografija (primjerice prometna dozvola, s podacima vlasnika
            vozila) ili tehnički podaci naloga: vozilo ili uređaj, opis kvara, stavke i nalazi. Ime, telefon i adresu mušterije Kopilotu ne šaljemo.
          </li>
          <li>
            <strong>Vapi Inc.</strong> (SAD): AI telefon, samo za radionice koje ga uključe. Obrađuje razgovor s pozivateljem: broj s kojeg zove, govor, prijepis i sažetak. Za
            prepoznavanje i izgovor govora Vapi koristi svoje podizvršitelje.
          </li>
        </ul>
        <p>
          S izvršiteljima obrade imamo ugovore o obradi podataka. Gdje podaci odlaze izvan Europskog gospodarskog prostora, prijenos se temelji na standardnim ugovornim klauzulama Europske
          komisije.
        </p>
        <p>
          WhatsApp, SMS i navigacija: aplikacija samo otvara te aplikacije na Vašem mobitelu s pripremljenom porukom ili adresom. Mi te poruke ne šaljemo i ne čitamo.
        </p>
      </Section>

      <Section n={6} title="Koliko dugo čuvamo podatke">
        <ul>
          <li>Podatke računa i radionice: dok traje korištenje, zatim 12 mjeseci, pa ih brišemo. Na zahtjev ih brišemo ranije, u roku od 30 dana.</li>
          <li>Račune i uplate za pretplatu: onoliko koliko propisuju računovodstveni i porezni propisi.</li>
          <li>Sažetke IP adresa za zaštitu od zlouporabe: 30 dana.</li>
          <li>Zapise o greškama: do 12 mjeseci nakon što je greška riješena.</li>
        </ul>
      </Section>

      <Section n={7} title="Vaša prava">
        <p>
          Imate pravo na pristup svojim podacima, ispravak, brisanje, ograničenje obrade, prenosivost i prigovor na obradu koja se temelji na legitimnom interesu. Zahtjev pošaljite na našu
          e-adresu; odgovaramo u roku od mjesec dana. Kako zatražiti brisanje računa, piše na stranici <A href="/brisanje-racuna">Brisanje računa</A>.
        </p>
        <p>
          Ako mislite da obrada nije zakonita, možete podnijeti pritužbu Agenciji za zaštitu osobnih podataka (AZOP), Selska cesta 136, 10000 Zagreb, azop.hr.
        </p>
      </Section>

      <Section n={8} title="Kolačići">
        <p>
          Koristimo samo nužne kolačiće: kolačić prijave, da ostanete prijavljeni. U pregledniku pamtimo i odabir izgleda (tamno ili svijetlo). Aplikacija na mobitelu čuva samo svoje datoteke za
          brže otvaranje, ne Vaše podatke. Kolačiće za praćenje ili oglase ne koristimo, pa za njih ne tražimo privolu.
        </p>
      </Section>

      <Section n={9} title="Sigurnost">
        <ul>
          <li>Veza je šifrirana (HTTPS), a lozinke spremamo samo kao nepovratni sažetak.</li>
          <li>Svaka radionica vidi samo svoje podatke; to provjerava sama baza podataka. Radnici ne vide iznose ni poslovanje.</li>
          <li>Podacima radionice pristupamo samo kad je to potrebno za podršku, otklanjanje greške ili kad to traži zakon.</li>
        </ul>
      </Section>

      <Section n={10} title="Izmjene">
        <p>Ako promijenimo ovu politiku, novu verziju objavljujemo ovdje s datumom. O bitnim promjenama obavještavamo korisnike u aplikaciji ili e-poštom.</p>
      </Section>
    </LegalPage>
  );
}
