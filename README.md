# X-Files

Jedna aplikacija za radionice, šest proizvoda. Svaka radionica ima točno jedan paket, a paket se prepoznaje po domeni:

| Paket | Domena | Za koga |
|---|---|---|
| **Volt Files** | voltfiles.hr | autoelektrika, dijagnostika, elektronika |
| **Gear Files** | gearfiles.hr | automehanika i opći servis |
| **Body Files** | bodyfiles.hr | limarija, lakirnica, procjena štete |
| **Wheel Files** | wheelfiles.hr | vulkanizeri, geometrija, hotel za gume |
| **Fleet Files** | fleetfiles.hr | teretni program, građevina, flote |
| **Moto Files** | motofiles.hr | motocikli, quadovi, nautika |

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
   npm run db:seed      # 6 demo radionica s podacima i fotografijama
   npm run dev
   ```
4. **Otvaranje:** http://localhost:3000. Za drugi proizvod na istom računalu koristite poddomenu: `http://gear.localhost:3000`, `http://wheel.localhost:3000` itd.

**Demo računi** (lozinka `Demo2026!` ili vaš `DEMO_PASSWORD`):
- `vlasnik.volt@demo.xfiles.hr`: voditelj servisa (vidi cijene, naplatu, poslovanje);
- `radnik.volt@demo.xfiles.hr`: radnik (vidi naloge, ne vidi iznose).

Isto vrijedi za `gear`, `body`, `wheel`, `fleet` i `moto`. Seed na kraju ispiše i poveznice za odobrenje stranke.

## Naredbe

| Naredba | Što radi |
|---|---|
| `npm run dev` | razvojni server |
| `npm run build` | produkcijski build |
| `npm run type-check` | provjera tipova |
| `npm run db:migrate` | primjenjuje nove migracije (`-- --all` ponovno sve, sigurno je) |
| `npm run db:seed` | briše i ponovno stvara samo demo radionice |
| `npm run db:test` | 59 sigurnosnih testova baze na lokalnom Postgresu (PGlite), bez Supabasea, uključujući izravne napade preko API-ja |
| `npm run icons` | ponovno generira ikone aplikacije za svih 6 proizvoda |

## Objava (Vercel)

1. `npx vercel` pa `npx vercel --prod` (regija `dub1` — Dublin, uz bazu u eu-west-1 — je u `vercel.json`).
2. U Vercelu, Settings → Environment Variables, upišite iste varijable kao u `.env.local`, osim `SUPABASE_DB_URL` i demo varijabli. `NEXT_PUBLIC_APP_URL` postavite na pravu adresu.
3. Domene: dodajte `voltfiles.hr`, `gearfiles.hr` i ostale na isti projekt. Aplikacija sama bira proizvod po domeni. Za adrese koje nisu domena proizvoda vrijedi `NEXT_PUBLIC_DEFAULT_PACKAGE`.
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
    - ograničenje broja registracija.
- **Izolacija radionica:** svaki red ima `tenant_id`, a veze među tablicama idu preko `(id, tenant_id)`. Zato ni greška u kodu ne može povezati podatke dviju radionica. Pravila pristupa rade u samoj bazi, ne samo u sučelju.
- **Novac:**
  - cijene (`job_line_prices`), privatni iznosi, cjenici i računi flota vidljivi su **samo voditelju**, i to na razini baze;
  - radnik ne može označiti plaćeno ni zaključati ili otključati nalog;
  - zaključani nalog ne dopušta izmjenu stavki;
  - radnik vidi je li nalog plaćen (bez iznosa), da zna smije li predati vozilo. To je namjerno.
- **Zaključavanje radionice:** Super Admin (`/admin`) može isključiti radionicu ili produljiti probu. Isključena radionica ili istekla proba odmah ne vidi ništa, a podaci ostaju sačuvani.
- **Instalacija na mobitel (PWA):** manifest po domeni (ime i ikona proizvoda), service worker sa stranicom za rad bez veze, puni zaslon na Androidu i iPhoneu.
- **AI Kopilot** (gumb na radnom nalogu):
  - Izrađuje uputu u četiri dijela: dijagnostika, protokol, specifikacije i obvezne fotografije. Uz to odgovara na glasovna ili pisana pitanja.
  - Podaci naloga slažu se na serveru s pravima prijavljenog korisnika. U njima su vozilo, stavke, nalazi, kodovi i podaci radionice poput momenata pritezanja i potvrđenih uzroka iz arhive.
  - Ime, telefon, OIB i registracija mušterije, kao ni cijene, ne šalju se AI-ju.
  - Ista uputa za nepromijenjen nalog dolazi iz povijesti, odmah i bez novog troška.
  - Dnevni limit po radionici zadaje `AI_DAILY_LIMIT`, a potrošnja se vidi u `/admin`.
  - Za rad treba `ANTHROPIC_API_KEY`. Bez ključa gumb objašnjava da Kopilot nije uključen.
