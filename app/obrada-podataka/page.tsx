import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, ProviderBlock, Section } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Ugovor o obradi podataka' };

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="font-medium text-accent hover:underline">
    {children}
  </Link>
);

// The data processing agreement (GDPR art. 28) between a workshop (the
// controller of its customers' data) and Poslar (the processor). Accepted
// at registration together with the terms. A draft for the lawyer.
export default function ProcessingAgreementPage() {
  return (
    <LegalPage
      title="Ugovor o obradi podataka"
      intro={
        <p>
          Ovaj ugovor uređuje obradu osobnih podataka koje radionica unosi u Poslar, u skladu s člankom 28. Opće uredbe o zaštiti podataka (GDPR). Sklapa se registracijom radionice, zajedno s{' '}
          <A href="/uvjeti">Uvjetima korištenja</A>, i vrijedi dok radionica koristi uslugu.
        </p>
      }
    >
      <Section n={1} title="Stranke">
        <ul>
          <li>
            <strong>Voditelj obrade:</strong> radionica koja koristi Poslar (Korisnik).
          </li>
          <li>
            <strong>Izvršitelj obrade:</strong> Pružatelj usluge:
          </li>
        </ul>
        <ProviderBlock />
      </Section>

      <Section n={2} title="Predmet, svrha i trajanje">
        <p>
          Izvršitelj obrađuje osobne podatke koje Korisnik i njegovi radnici unesu u Poslar, samo radi pružanja usluge: pohrana, prikaz i pretraživanje, izrada naloga, ponuda, računa i izvještaja,
          priprema poruka mušterijama i čitanje fotografija na zahtjev korisnika. Obrada traje dok traje korištenje usluge, te do brisanja podataka nakon njegova prestanka (točka 6).
        </p>
      </Section>

      <Section n={3} title="Vrste podataka i ispitanici">
        <p>Ispitanici su mušterije Korisnika i njihove kontakt osobe, osobe koje se prijave preko QR koda radionice, te radnici Korisnika.</p>
        <ul>
          <li>Ime i prezime ili naziv, OIB, adresa, telefon i e-adresa mušterije.</li>
          <li>Podaci o vozilima i uređajima: registracija, broj šasije ili serijski broj, stanje brojila, povijest radova.</li>
          <li>Fotografije (mogu prikazivati osobe, registracije ili dokumente), s vremenom i mjestom snimanja.</li>
          <li>Adrese i lokacije rada na terenu, vremena dolaska i odlaska.</li>
          <li>Opisi kvarova i radova, ponude, odobrenja (ime potpisnika, vrijeme, IP adresa i preglednik) i računi.</li>
          <li>Pozivi koje preuzme Poslar na telefonu (automatsko javljanje uz pomoć umjetne inteligencije), kad ga Korisnik uključi: broj pozivatelja, prijepis i sažetak razgovora, dogovoreni termin.</li>
          <li>Podaci o radnicima Korisnika: ime, telefon, uloga, broj certifikata gdje se vodi, rad na nalozima.</li>
        </ul>
        <p>Posebne kategorije podataka (primjerice podaci o zdravlju) nisu potrebne za uslugu i Korisnik ih ne unosi.</p>
      </Section>

      <Section n={4} title="Obveze izvršitelja">
        <ul>
          <li>Obrađuje podatke samo po uputama Korisnika. Upute su ovaj ugovor i radnje koje Korisnik obavi u aplikaciji. Iznimka je obrada koju propisuje zakon.</li>
          <li>Osobe koje imaju pristup podacima obvezane su na povjerljivost.</li>
          <li>
            Primjenjuje mjere zaštite: šifriranu vezu (HTTPS), odvojen pristup za svaku radionicu koji provjerava sama baza podataka, uloge (radnici ne vide iznose), lozinke spremljene kao
            nepovratni sažetak, te zapise o greškama.
          </li>
          <li>Pomaže Korisniku kod zahtjeva ispitanika. Većinu (uvid, ispravak, izvoz, brisanje) Korisnik obavlja sam u aplikaciji.</li>
          <li>O povredi osobnih podataka obavještava Korisnika bez nepotrebnog odgađanja, u pravilu u roku od 48 sati od saznanja, s podacima koje tada ima.</li>
          <li>Na zahtjev daje Korisniku podatke potrebne za dokazivanje ispunjavanja ovih obveza i omogućuje provjeru uz razumnu najavu.</li>
        </ul>
      </Section>

      <Section n={5} title="Podizvršitelji">
        <p>Korisnik daje opće odobrenje za ove podizvršitelje:</p>
        <ul>
          <li>
            <strong>Supabase Inc.</strong>: baza podataka, prijava i pohrana datoteka; podaci u Europskoj uniji (Irska).
          </li>
          <li>
            <strong>Vercel Inc.</strong>: poslužitelj aplikacije u Europskoj uniji (Dublin, Irska).
          </li>
          <li>
            <strong>Anthropic PBC</strong>, SAD: čitanje fotografija i Kopilot, samo kad ih korisnik pokrene; bez imena, telefona i adrese mušterije u Kopilotu.
          </li>
          <li>
            <strong>Vapi Inc.</strong>, SAD: Poslar na telefonu, samo kad ga Korisnik uključi: broj pozivatelja, razgovor, prijepis i sažetak.
          </li>
        </ul>
        <p>
          Izvršitelj s podizvršiteljima ima ugovore s jednakim obvezama zaštite. Prijenos izvan Europskog gospodarskog prostora temelji se na standardnim ugovornim klauzulama Europske komisije.
          O novom podizvršitelju izvršitelj obavještava Korisnika najmanje 30 dana unaprijed; Korisnik može prigovoriti, a ako se ne dogovore, može prestati koristiti uslugu.
        </p>
      </Section>

      <Section n={6} title="Kraj obrade">
        <p>
          Nakon prestanka korištenja izvršitelj čuva podatke 12 mjeseci, kako bi se Korisnik mogao vratiti, a zatim ih briše. Na zahtjev Korisnika briše ih ranije, u roku od 30 dana. Prije
          brisanja Korisnik može preuzeti svoje podatke (računi, popis naloga). Podaci koje izvršitelj mora čuvati po zakonu čuvaju se samo za tu svrhu.
        </p>
      </Section>

      <Section n={7} title="Obveze voditelja">
        <ul>
          <li>Ima pravnu osnovu za podatke koje unosi i obavještava mušterije o obradi.</li>
          <li>Unosi točne podatke i samo one koji su potrebni za posao.</li>
          <li>Brine o pristupima svojih radnika i odmah ih ukida kad radnik ode.</li>
        </ul>
      </Section>

      <Section n={8} title="Završne odredbe">
        <p>
          Primjenjuje se pravo Republike Hrvatske. Za pitanja zaštite podataka ovaj ugovor ima prednost pred Uvjetima korištenja. Kako postupamo s podacima korisnika aplikacije, opisuje{' '}
          <A href="/privatnost">Politika privatnosti</A>.
        </p>
      </Section>
    </LegalPage>
  );
}
