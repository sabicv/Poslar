# Poslar na Google Playu

Android aplikacija je ista stranica, otvorena preko cijelog ekrana (Trusted Web Activity).
Kad mijenjamo stranicu, mijenja se i aplikacija. Novu verziju na Play šalješ samo kad
mijenjaš ime, ikonu ili adresu.

Pravila Googlea se mijenjaju. Ako nešto u konzoli izgleda drukčije nego ovdje, vrijedi konzola.

## 1. Prvo domena

Aplikacija je vezana uz jednu adresu. Kasnija promjena znači novu verziju i novu provjeru.
Zato prije Playa spoji domenu poslar.eu, korak po korak u `docs/DOMENA.md`.

## 2. Račun za razvojne programere

1. play.google.com/console → prijava Google računom → jednokratno plaćanje (oko 25 USD).
2. Osobni račun ili organizacija:
   - **Osobni:** novi osobni računi moraju prije objave za sve imati zatvoreno testiranje
     (najmanje 12 testera, 14 dana zaredom). Tvojih 30 testera to pokriva.
   - **Organizacija** (obrt ili d.o.o.): treba D-U-N-S broj tvrtke (besplatan, traje nekoliko dana).
3. Google traži potvrdu identiteta (osobna iskaznica) i adrese. To traje nekoliko dana.

## 3. Android paket (PWABuilder, bez programiranja)

1. Otvori pwabuilder.com, upiši `https://poslar.eu` → Start.
2. Package For Stores → Android → Generate Package. U opcijama:
   - Package ID: `eu.poslar.app` (biraš jednom, poslije se ne mijenja)
   - App name i Launcher name: `Poslar`
   - Start URL: `/app?izvor=play` (važno: tako aplikacija zna da je s Playa)
   - Theme i background color: `#0F172A`
   - Signing key: Create new
3. Preuzmeš ZIP. Unutra su: `.aab` (to šalješ na Play), ključ za potpis (`.keystore`)
   i datoteka s lozinkama i otiskom ključa (SHA-256).
4. **Ključ i lozinke spremi na dva sigurna mjesta** (npr. USB i oblak).
   Bez njih ne možeš poslati novu verziju iste aplikacije.

## 4. Spoji aplikaciju i stranicu

Tako aplikacija radi preko cijelog ekrana, bez trake preglednika.

1. U Play konzoli, nakon prvog slanja `.aab`: Test and release → App integrity.
   Tamo su dva otiska (SHA-256): upload key i app signing key.
2. Vercel → Environment Variables:
   - `ANDROID_PACKAGE_NAME` = `eu.poslar.app`
   - `ANDROID_SHA256_FINGERPRINTS` = oba otiska, odvojena zarezom
3. `npx vercel deploy --prod`.
4. Provjeri: `https://poslar.eu/.well-known/assetlinks.json` mora pokazati naziv paketa i otiske.

## 5. Stranica aplikacije u trgovini

- Naziv: Poslar. Kratki opis (do 80 znakova), npr.:
  „Nalozi, slike i računi za radionicu. Sve iz mobitela.”
- Ikona 512 × 512: `public/icons/poslar-512.png`.
- Slike ekrana: iz demo radionice (najmanje 2, s mobitela).
- Grafika 1024 × 500 (feature graphic): logo na tamnoj podlozi.
- Kategorija: Business (Posao). Besplatna aplikacija.
- Politika privatnosti: `https://poslar.eu/privatnost`
- Brisanje računa: `https://poslar.eu/brisanje-racuna`
- Pristup za recenzente (App access): demo prijava
  `vlasnik.gear@demo.xfiles.hr`, lozinka `Demo2026!`.

## 6. Sigurnost podataka (Data safety obrazac)

Odgovori prema onome što aplikacija stvarno radi:

- Prikuplja: ime, e-adresu, telefon (račun); fotografije (nalozi); preciznu lokaciju
  (samo kad radnik dodirne korak na terenu); zapise o greškama (Diagnostics).
- Svrha: rad aplikacije (App functionality). Ne za oglase, ne za praćenje.
- Dijeli s trećima: ne (Supabase, Vercel i Anthropic su izvršitelji obrade, to Google ne broji kao dijeljenje).
- Podaci su šifrirani u prijenosu: da.
- Korisnik može zatražiti brisanje: da (u aplikaciji i na `/brisanje-racuna`).

## 7. Naplata i pravila Googlea

Google ne dopušta da aplikacija s Playa prodaje pretplatu mimo Google naplate, niti da
upućuje na takvo plaćanje. Zato aplikacija otvorena s Playa sama skriva cijene, uplatnicu
i gumbe „Želim paket”. Pokazuje samo paket i datum do kad vrijedi.
Na webu (poslar.eu u pregledniku) sve ostaje kao prije.
Radionice plaćaju preko weba, kao i sad. U opisu aplikacije ne spominji cijene.

## 8. Zatvoreno testiranje

1. Test and release → Testing → Closed testing → Create track.
2. Dodaj testere (e-adrese Google računa) ili Google grupu.
3. Pošalji `.aab`, ispuni upitnike (sadržaj, ciljna skupina 18+, oglasi: ne).
4. Testeri dobiju poveznicu, instaliraju i koriste. Nakon 14 dana možeš zatražiti objavu za sve.
