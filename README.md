# Poslar

Jedna aplikacija za radionice i servise na terenu, jedanaest zanata. Svaka radionica ima točno jedan paket. Na zajedničkoj adresi (poslar.eu) paket određuje prijavljena radionica, a na poddomeni zanata sama poddomena:

| Paket (id) | Naziv | Poddomena | Za koga |
|---|---|---|---|
| volt | **Poslar Autoelektričar** | autoelektricar.poslar.eu | autoelektrika, dijagnostika, elektronika |
| gear | **Poslar Automehaničar** | automehanicar.poslar.eu | automehanika i opći servis |
| body | **Poslar Limar i lakirer** | limar-lakirer.poslar.eu | limarija, lakirnica, procjena štete |
| wheel | **Poslar Vulkanizer** | vulkanizer.poslar.eu | vulkanizeri, geometrija, hotel za gume |
| fleet | **Poslar Kamioni i strojevi** | kamioni-strojevi.poslar.eu | teretni program, građevina, flote |
| moto | **Poslar Moto** | motocikli.poslar.eu | motocikli, skuteri, quadovi |
| marine | **Poslar Nautika** | nautika.poslar.eu | jet ski, brodice, vanbrodski i ugradbeni motori |
| air | **Poslar Klima serviser** | klima-serviser.poslar.eu | klime, dizalice topline, ventilacija (rad na terenu) |
| aqua | **Poslar Vodoinstalater** | vodoinstalater.poslar.eu | vodoinstalacije, bojleri (rad na terenu) |
| tow | **Poslar Vučna služba** | vucna-sluzba.poslar.eu | vuča i pomoć na cesti |
| deal | **Poslar Auto plac** | auto-plac.poslar.eu | prodaja rabljenih vozila |

Logo i ikona: `npm run brand` piše `public/brand/poslar-logo.svg` i `poslar-mark.svg` (font Saira Condensed Bold iz `scripts/assets`), a `npm run icons` ikone aplikacije u `public/icons`.

Zajedničko svima:
- radni nalog po fazama;
- stavke s cijenama koje vidi samo voditelj;
- inspekcija sa semaforom;
- zapisnik s potpisom;
- fotografije s datumom, GPS-om i otiskom datoteke (SHA-256);
- odobrenje stranke putem poveznice;
- zaključavanje naloga i poruke „Trebam pomoć”;
- samoregistracija s probnim razdobljem i Super Admin panel.

Svaki paket ima i svoju karticu na nalogu i svoju stranicu u izborniku.

## Prvo pokretanje

Potrebno: Node.js 20+ i **novi** Supabase projekt. Ne koristite projekt servisa Šabić.

1. **Supabase:** na [supabase.com](https://supabase.com) → New project, regija *West EU (Ireland)* ili *Central EU (Frankfurt)* — Vercel regiju u `vercel.json` uskladite s bazom.
2. **Ključevi:** kopirajte `.env.example` u `.env.local` i upišite:
   - `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API);
   - `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → service_role, **tajno**);
   - `SUPABASE_DB_URL` (gumb **Connect** → **Session pooler**, bez lozinke) i `SUPABASE_DB_PASSWORD` (lozinka baze);
   - po želji `SUPER_ADMIN_EMAIL` i `SUPER_ADMIN_PASSWORD` (vaš račun za `/admin`).
3. **Instalacija i baza:**
   ```bash
   npm install
   npm run db:migrate   # tablice, sigurnosna pravila (RLS), spremišta za datoteke
   npm run db:seed      # demo radionice s podacima i fotografijama
   npm run dev
   ```
4. **Otvaranje:** http://localhost:3000. Za drugi proizvod na istom računalu koristite poddomenu: `http://gear.localhost:3000`, `http://wheel.localhost:3000` itd.

**Jedan račun za testiranje svega:** `demo@demo.xfiles.hr` (lozinka `Demo2026!` ili vaš `DEMO_PASSWORD`). Otvara **Demo centar** sa svih jedanaest zanata: jednim dodirom ulazite kao voditelj ili radnik bilo koje demo radionice. U aplikaciji traka **Demo** na vrhu prebacuje ulogu (voditelj ⇄ radnik) ili vraća u Demo centar. Prebacivanje radi samo između demo računa (oznaka koju postavlja seed).

Pojedinačni demo računi, s istom lozinkom:
- `vlasnik.volt@demo.xfiles.hr`: voditelj servisa (vidi cijene, naplatu, poslovanje);
- `radnik.volt@demo.xfiles.hr`: radnik (vidi naloge, ne vidi iznose).

Isto vrijedi za `gear`, `body`, `wheel`, `fleet`, `moto` i `air`. Seed na kraju ispiše i poveznice za odobrenje stranke.

`npm run db:seed` vraća demo podatke na početno stanje, s današnjim datumima. Računi ostaju isti, pa se nitko ne odjavljuje.

**Testiranje na mobitelu:** koristite https adresu (Vercel). Na običnoj `http://192.168.x.x` adresi mobitel ne dopušta GPS, diktiranje ni kopiranje, a svaki dodir ide do baze u Irskoj preko vašeg računala, pa je sporije nego u stvarnosti.

## Naredbe

| Naredba | Što radi |
|---|---|
| `npm run dev` | razvojni server |
| `npm run build` | produkcijski build |
| `npm run type-check` | provjera tipova |
| `npm run db:migrate` | primjenjuje nove migracije (`-- --all` ponovno sve, sigurno je) |
| `npm run db:seed` | briše i ponovno stvara samo demo radionice |
| `npm run db:test` | 66 sigurnosnih testova baze na lokalnom Postgresu (PGlite), bez Supabasea, uključujući izravne napade preko API-ja |
| `npm run icons` | ponovno generira ikone aplikacije za svih 7 proizvoda |

## Objava (Vercel)

1. `npx vercel` pa `npx vercel --prod` (regija `dub1` — Dublin, uz bazu u eu-west-1 — je u `vercel.json`).
2. U Vercelu, Settings → Environment Variables, upišite iste varijable kao u `.env.local`, osim `SUPABASE_DB_URL` i demo varijabli. `NEXT_PUBLIC_APP_URL` postavite na pravu adresu.
3. Domene: dodajte `poslar.eu` i po želji poddomene zanata (`automehanicar.poslar.eu` …) na isti projekt. Na poddomeni aplikacija sama bira zanat; na `poslar.eu` ga određuje prijavljena radionica.
4. U Supabaseu, Authentication → URL Configuration, dodajte te domene.
5. **Prije javne samoregistracije:** u Supabaseu postavite vlastiti SMTP (Authentication → Emails → SMTP, npr. Resend) i uključite *Confirm email*. Zatim u Vercelu postavite `REGISTRATION_EMAIL_CONFIRM=1`. Bez vlastitog SMTP-a Supabase šalje e-mail samo članovima tima, pa potvrda ne bi stigla radionicama.

## Kako je složeno

- **`config/tenant.config.ts`** i **`config/packages/*`**: sve po čemu se paketi razlikuju:
  - boja;
  - nazivi (Mušterija ili Tvrtka, km ili motosati);
  - vrste objekata;
  - nazivi faza;
  - kontrolne liste i inspekcije;
  - predlošci poslova s cijenama;
  - moduli.

  Baza pamti samo koji paket radionica ima.
- **`supabase/migrations`:**
  - `0001` zajedničke tablice;
  - `0002` tablice paketa (`volt_*`, `gear_*`, `body_*`, `wheel_*`, `fleet_*`, `moto_*`);
  - `0003` spremišta;
  - `0004` registracija;
  - `0005` pravila pristupa (RLS);
  - `0006` AI Kopilot (povijest razgovora i potrošnja);
  - `0007` pojačana zaštita nakon neovisne analize:
    - naplata i zaključavanje samo za voditelja, i pri unosu i pri izmjeni;
    - brojeve naloga uvijek dodjeljuje baza;
    - poruke i povijest naloga ne mogu se krivotvoriti;
    - odluka mušterije sprema se odjednom i cijela;
    - ograničenje broja registracija;
  - `0008` paket Air;
  - `0009` terenski sloj: lokacije, termini i posjeti, servisni planovi, uređaji i evidencija F-plina.
- **Izolacija radionica:** svaki red ima `tenant_id`, a veze među tablicama idu preko `(id, tenant_id)`. Zato ni greška u kodu ne može povezati podatke dviju radionica. Pravila pristupa rade u samoj bazi, ne samo u sučelju.
- **Novac:**
  - cijene (`job_line_prices`), privatni iznosi, cjenici i računi flota vidljivi su **samo voditelju**, i to na razini baze;
  - radnik ne može označiti plaćeno ni zaključati ili otključati nalog;
  - zaključani nalog ne dopušta izmjenu stavki;
  - radnik vidi je li nalog plaćen (bez iznosa), da zna smije li predati vozilo. To je namjerno.
- **Zaključavanje radionice:** Super Admin (`/admin`) može isključiti radionicu ili produljiti probu. Isključena radionica ili istekla proba odmah ne vidi ništa, a podaci ostaju sačuvani.
- **Rad na terenu** (paket Air; za Volt, Gear i Wheel uključuje se kao modul „Rad na terenu”). Izrađen je prema analizi vodećih alata; odluke i izvori su u [docs/terenski-sloj.md](docs/terenski-sloj.md).
  - Klijent ima lokacije (adresa, upute za ulaz, osoba na licu mjesta), a uređaji su na lokaciji.
  - Početna stranica je raspored dana, s filtrom po tehničaru, „Rutom dana” i popisom „Nezakazano”.
  - Na posjetu vode tri dodira:
    - **Na putu:** otvara WhatsApp ili SMS s procjenom dolaska;
    - **Stigao:** sprema vrijeme i GPS;
    - **Završio:** nalog prelazi u „Odrađeno”.

    Poruke idu s mobitela tehničara, bez plaćenih API-ja.
  - Izvještaj za klijenta je javna poveznica `/r/<token>` bez prijave. Sadrži vremena, GPS, fotografije prije i poslije s otiskom, nalaze i zapis o plinu. Nema cijena ni uputa za ulaz. Voditelj može izdati novu poveznicu.
  - Servisni planovi: klijent se pojavi na popisu mjesec dana prije roka, uz podsjetnik i gumb „Zakaži”. Kad se nalog završi, plan se sam pomakne za interval.
  - F-plin (Air): t CO₂e, SK 1 i rokovi provjere propuštanja računaju se iz natpisne pločice. Stranica prikazuje i kontrolu u roku mjesec dana nakon popravka, dnevnik s certifikatom servisera i godišnji zbroj po radnoj tvari. Pravila su pomoć; za obrasce vrijedi važeći propis.
- **Instalacija na mobitel (PWA):** manifest po domeni (ime i ikona proizvoda), service worker sa stranicom za rad bez veze, puni zaslon na Androidu i iPhoneu.
- **Pitaj Poslara** (Kopilot, gumb na radnom nalogu):
  - Izrađuje uputu u četiri dijela: dijagnostika, protokol, specifikacije i obvezne fotografije. Uz to odgovara na glasovna ili pisana pitanja.
  - Podaci naloga slažu se na serveru s pravima prijavljenog korisnika. U njima su vozilo ili uređaj, stavke, nalazi, kodovi i podaci radionice poput momenata pritezanja i potvrđenih uzroka iz arhive. Za terenski nalog šalje se i vrsta objekta te obveze vezane uz F-plin.
  - Ime, telefon, OIB i registracija mušterije, adresa i upute za ulaz, kao ni cijene, ne šalju se AI-ju.
  - Ista uputa za nepromijenjen nalog dolazi iz povijesti, odmah i bez novog troška.
  - Dnevni limit po radionici zadaje `AI_DAILY_LIMIT`, a potrošnja se vidi u `/admin`.
  - Za rad treba `ANTHROPIC_API_KEY`. Bez ključa gumb objašnjava da Poslar još ne odgovara na pitanja.
