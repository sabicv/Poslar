import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, ProviderBlock, Section } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Brisanje računa' };

// How to have an account and its data deleted, from the app or without it
// (Google Play links here from the store listing).
export default function AccountDeletionPage() {
  return (
    <LegalPage title="Brisanje računa" intro={<p>Ovdje piše kako zatražiti brisanje računa u aplikaciji Poslar, što se briše, što se čuva i u kojem roku.</p>}>
      <Section n={1} title="U aplikaciji">
        <p>
          Otvorite <strong>Postavke → Moj račun</strong>, dodirnite <strong>Zatraži brisanje računa</strong> i potvrdite. Zahtjev stiže podršci Poslara.
        </p>
      </Section>

      <Section n={2} title="Bez aplikacije">
        <p>Pošaljite nam poruku s e-adresom kojom se prijavljujete i nazivom radionice:</p>
        <ProviderBlock />
        <p>Prije brisanja provjeravamo da zahtjev stvarno dolazi od Vas.</p>
      </Section>

      <Section n={3} title="Što se briše">
        <ul>
          <li>
            <strong>Vlasnik ili voditelj radionice:</strong> cijela radionica i svi njezini podaci: nalozi, mušterije, vozila i uređaji, fotografije, ponude, izdani računi i prijave radnika.
          </li>
          <li>
            <strong>Radnik:</strong> korisnički račun (ime, e-adresa, telefon). Nalozi na kojima je radio ostaju radionici.
          </li>
        </ul>
        <p>Brisanje se ne može vratiti. Vlasnik prije toga neka preuzme račune za knjigovođu (Poslovanje → Za knjigovođu).</p>
      </Section>

      <Section n={4} title="Što se čuva">
        <ul>
          <li>Računi i uplate za pretplatu Poslara, onoliko koliko propisuju računovodstveni i porezni propisi.</li>
          <li>Sažeci IP adresa za zaštitu od zlouporabe najdulje 30 dana, zapisi o greškama najdulje 12 mjeseci.</li>
        </ul>
      </Section>

      <Section n={5} title="Rok">
        <p>
          Brisanje obavljamo u roku od 30 dana od zahtjeva i javljamo Vam kad je gotovo. Više o podacima piše u{' '}
          <Link href="/privatnost" className="font-medium text-accent hover:underline">
            Politici privatnosti
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
