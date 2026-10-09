import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, ProviderBlock, Section } from '@/components/legal/LegalPage';
import { FOUNDER_MONTHS, FOUNDER_SPOTS, PLANS } from '@/config/plans';
import { REFUND_DAYS, SUPPORT_HOURS } from '@/config/support';
import { GRACE_DAYS, payee } from '@/lib/billing';
import { whatsappReady } from '@/lib/whatsapp';

export const metadata: Metadata = { title: 'Uvjeti korištenja' };

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="font-medium text-accent hover:underline">
    {children}
  </Link>
);

// Terms of use. A draft in plain words, to be reviewed by a lawyer before
// the paid launch (PLAN.md, stage 9).
export default function TermsPage() {
  const trialDays = Number(process.env.TRIAL_DAYS ?? 30) || 30;
  const plans = Object.values(PLANS);
  const slip = payee() !== null;
  const whatsapp = whatsappReady();
  return (
    <LegalPage
      title="Uvjeti korištenja"
      intro={<p>Ovi uvjeti vrijede za korištenje aplikacije Poslar. Registracijom radionice prihvaćate ove uvjete i Ugovor o obradi podataka.</p>}
    >
      <Section n={1} title="Pružatelj usluge">
        <p>Uslugu pruža (u daljnjem tekstu: Pružatelj):</p>
        <ProviderBlock />
      </Section>

      <Section n={2} title="Što je Poslar">
        <p>
          Poslar je web aplikacija za radionice i obrtnike: radni nalozi, fotografije, mušterije, ponude i odobrenja, računi, podsjetnici i izvještaji. Koristi se u pregledniku ili kao aplikacija na
          mobitelu.
        </p>
        <p>
          Usluga je namijenjena obrtnicima i tvrtkama, za njihovu djelatnost. Nije namijenjena potrošačima. Radionicu koja koristi uslugu, zajedno s njezinim vlasnikom ili voditeljem, ovi uvjeti
          zovu Korisnik.
        </p>
      </Section>

      <Section n={3} title="Račun, radnici i lozinke">
        <ul>
          <li>Radionicu registrira vlasnik ili voditelj. Podaci pri registraciji moraju biti točni.</li>
          <li>Korisnik sam dodaje radnike i određuje im ulogu. Radnici ne vide iznose, naplatu ni poslovanje.</li>
          <li>Korisnik čuva lozinke i odgovara za sve što se radi s računima njegove radionice. Ako posumnja da je netko došao do lozinke, odmah je mijenja i javlja Pružatelju.</li>
        </ul>
      </Section>

      <Section n={4} title="Probno razdoblje">
        <p>
          Nova radionica koristi Poslar {trialDays} dana bez plaćanja i bez kartice. Nakon toga aplikacija se zaključava dok Korisnik ne uplati pretplatu. Podaci ostaju sačuvani i nakon uplate se
          nastavlja gdje se stalo.
        </p>
      </Section>

      <Section n={5} title="Pretplata i plaćanje">
        <ul>
          <li>
            Paketi i mjesečne cijene: {plans.map((p) => `${p.name} ${p.price} €`).join(', ')}. Cijene su s PDV-om. Opseg paketa (broj radnika, broj čitanja fotografija i pitanja Poslaru
            mjesečno, dodatne mogućnosti) navodi se na početnoj stranici i u aplikaciji, u Postavke → Pretplata.
          </li>
          <li>
            Pretplata se plaća unaprijed, karticom preko Paddlea (Paddle.com Market Ltd). Paddle je preprodavatelj (Merchant of Record) za narudžbe Poslara: naplaćuje pretplatu, obračunava PDV i
            izdaje račun. Za samo plaćanje vrijede i Paddleovi uvjeti za kupce. Pretplata karticom obnavlja se svaki mjesec dok je Korisnik ne otkaže.
          </li>
          {slip ? <li>Pretplata se može platiti i uplatom na račun Pružatelja s pozivom na broj radionice, za jedan ili više mjeseci.</li> : null}
          <li>
            Pretplatu karticom Korisnik otkazuje sam, u Postavke → Pretplata → Kartica i računi. Otkazana pretplata vrijedi do kraja plaćenog razdoblja i sljedeća naplata se ne radi.
          </li>
          <li>
            Za pitanja o naplati, kartici i Paddleovim računima Korisnik se obraća Paddleu (paddle.net). Za rad aplikacije i podršku odgovara Pružatelj.
          </li>
          <li>
            Prvih {FOUNDER_SPOTS} radionica koje se registriraju plaća osnivačku cijenu ({plans.map((p) => `${p.name} ${p.founderPrice} €`).join(', ')}) kroz {FOUNDER_MONTHS} mjeseca od
            registracije. Nakon toga vrijedi puna cijena. Pretplata se plaća mjesečno i može se otkazati u svakom trenutku.
          </li>
          <li>
            Ako uplata ne stigne do isteka plaćenog razdoblja, Korisnik ima još {GRACE_DAYS} dana. Nakon toga aplikacija se zaključava do uplate. Zbog kašnjenja se podaci ne brišu.
          </li>
          <li>Promjenu cijena Pružatelj najavljuje najmanje 30 dana unaprijed. Već plaćeno razdoblje ostaje po staroj cijeni.</li>
        </ul>
      </Section>

      <Section n={6} title="Preporuka">
        <p>
          Kad radionica registrirana preko poveznice Korisnika plati prvu pretplatu, Korisnik dobiva mjesec dana besplatno, jednom za svaku takvu radionicu. Pružatelj ne dodjeljuje nagradu ako je
          preporuka zlouporabljena, primjerice ako Korisnik preporuči sam sebe pod drugim imenom.
        </p>
      </Section>

      <Section n={7} title="Prestanak korištenja">
        <ul>
          <li>
            Korisnik može prestati koristiti uslugu kad želi. Ako zatraži povrat u roku od {REFUND_DAYS} dana od prve uplate, Pružatelj vraća iznos bez pitanja (putem Paddlea). Nakon tih{' '}
            {REFUND_DAYS} dana uplaćeni iznos za započeto razdoblje ne vraća se, osim kad povrat propisuje zakon ili ga Paddle odobri po svojim uvjetima za kupce.
          </li>
          <li>Pružatelj može isključiti pristup zbog neplaćanja ili zbog teškog ili ponovljenog kršenja ovih uvjeta. O tome obavještava Korisnika.</li>
        </ul>
      </Section>

      <Section n={8} title="Podaci Korisnika">
        <ul>
          <li>
            Podaci koje Korisnik unese (mušterije, nalozi, fotografije, računi) pripadaju Korisniku. Pružatelj ih obrađuje samo radi pružanja usluge, prema{' '}
            <A href="/obrada-podataka">Ugovoru o obradi podataka</A>.
          </li>
          <li>
            Korisnik u svakom trenutku može preuzeti sve podatke radionice (Postavke → Izvoz podataka: mušterije, vozila i uređaji, nalozi, stavke, ponude, računi, pozivi i fotografije), izdane
            račune (paket za knjigovođu) i popis zatvorenih naloga (Arhiva, tablica za Excel).
          </li>
          <li>
            Nakon prestanka korištenja podaci se čuvaju 12 mjeseci, kako bi se Korisnik mogao vratiti, a zatim se brišu. Na zahtjev Korisnika brišu se ranije, u roku od 30 dana.
          </li>
          <li>Račune i druge isprave Korisnik sam čuva onoliko koliko propisuje zakon. Prije brisanja neka ih preuzme.</li>
        </ul>
        <p>
          Kako Pružatelj postupa s osobnim podacima, opisuje <A href="/privatnost">Politika privatnosti</A>.
        </p>
      </Section>

      <Section n={9} title="Računi i fiskalizacija">
        <p>
          Poslar izrađuje račun sa stavkama i e-račun (XML). Aplikacija trenutno ne fiskalizira račune: fiskalni račun Korisnik izdaje svojom blagajnom, a broj fiskalnog računa može upisati na
          račun u aplikaciji. Korisnik odgovara za ispravnost računa i za svoje porezne obveze.
        </p>
      </Section>

      <Section n={10} title="Umjetna inteligencija">
        <p>
          Čitanje fotografija (Slikanje), odgovori na pitanja (Pitaj Poslara) i javljanje na telefon (Poslar na telefonu) rade uz pomoć umjetne inteligencije. Rezultati mogu sadržavati pogreške pa ih Korisnik provjerava prije upotrebe. Poslar daje prijedloge; ne
          zamjenjuje stručnu prosudbu, upute proizvođača ni propise.
        </p>
      </Section>

      <Section n={11} title="Poruke mušterijama">
        <p>
          Aplikacija priprema poruke (WhatsApp, SMS) koje Korisnik šalje sa svog mobitela.
          {whatsapp ? ' Kad Korisnik uključi WhatsApp obavijesti, Poslar sam šalje mušterijama obavijesti o nalogu i podsjetnike na termin, s broja Poslara.' : ''} Korisnik odgovara za
          sadržaj poruka i za to da mušterijama smije slati obavijesti i podsjetnike.
        </p>
      </Section>

      <Section n={12} title="Dostupnost i promjene usluge">
        <ul>
          <li>Pružatelj nastoji da usluga radi bez prekida, ali neprekidnu dostupnost (SLA) ne jamči. Planirano održavanje najavljuje kad je moguće.</li>
          <li>
            Podrška odgovara {SUPPORT_HOURS}. Poruke primljene izvan tog vremena obrađuju se sljedećeg radnog dana. To nije jamstvo vremena odgovora.
          </li>
          <li>Usluga se razvija i mogućnosti se mijenjaju. Bitne promjene na štetu Korisnika Pružatelj najavljuje unaprijed.</li>
        </ul>
      </Section>

      <Section n={13} title="Odgovornost">
        <ul>
          <li>Pružatelj ne odgovara za izgubljenu dobit ni za posrednu štetu, osim ako je šteta prouzročena namjerno ili krajnjom nepažnjom.</li>
          <li>U ostalim slučajevima odgovornost Pružatelja ograničena je na iznos koji je Korisnik platio za uslugu u posljednjih 12 mjeseci.</li>
          <li>Korisnik odgovara za podatke koje unosi i za način na koji koristi aplikaciju.</li>
        </ul>
      </Section>

      <Section n={14} title="Zabranjeno korištenje">
        <p>Nije dopušteno: unositi tuđe podatke bez pravne osnove, pokušavati pristupiti tuđim podacima, ometati ili preopterećivati sustav, te preprodavati ili ustupati pristup trećima.</p>
      </Section>

      <Section n={15} title="Izmjene uvjeta">
        <p>
          Pružatelj može izmijeniti ove uvjete. O bitnim izmjenama obavještava Korisnika u aplikaciji ili e-poštom najmanje 30 dana prije nego što počnu vrijediti. Ako se Korisnik ne slaže, može
          prestati koristiti uslugu prije toga dana.
        </p>
      </Section>

      <Section n={16} title="Pravo i sporovi">
        <p>Primjenjuje se pravo Republike Hrvatske. Sporove strane rješavaju dogovorom, a ako ne uspiju, nadležan je stvarno nadležni sud prema sjedištu Pružatelja.</p>
      </Section>
    </LegalPage>
  );
}
