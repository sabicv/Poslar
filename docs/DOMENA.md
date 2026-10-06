# Spajanje domene poslar.eu

Radiš jednom. Traje 15 minuta, plus čekanje da DNS proradi.

## 1. Vercel

1. Vercel → projekt x-files → Settings → Domains → **Add Domain** → upiši `poslar.eu`.
2. Vercel ponudi i `www.poslar.eu` s preusmjeravanjem na `poslar.eu`. Prihvati.
3. Vercel pokaže DNS zapise (obično **A** za `@` i **CNAME** za `www`). Ostavi tu karticu otvorenu.

## 2. Registrar (gdje si kupio domenu)

1. Otvori DNS postavke domene `poslar.eu`.
2. Obriši postojeće A zapise za `@` (to je parkirna stranica registrara).
3. Dodaj zapise iz Vercela, točno kako pišu.
4. Pričekaj da Vercel pokaže **Valid Configuration**. Obično nekoliko minuta, ponekad do 48 sati.
   HTTPS (lokot) Vercel složi sam.

## 3. Adresa u aplikaciji

1. Vercel → Settings → Environment Variables → `NEXT_PUBLIC_APP_URL` = `https://poslar.eu`
   (Production). Na nju vode poveznice koje šalješ mušterijama (odobrenje, račun, QR).
2. Supabase → Authentication → URL Configuration:
   - Site URL: `https://poslar.eu`
   - Redirect URLs: dodaj `https://poslar.eu/**` (staru vercel.app adresu ostavi).
3. `npx vercel deploy --prod`. Nova adresa ulazi u poveznice tek s novim deployem.

## 4. Provjera

1. Otvori `https://poslar.eu`: naslovnica s logom Poslar.
2. Prijavi se. Na novoj adresi prijava treba jednom ponovno.
3. Na mobitelu otvori `poslar.eu` i dodaj aplikaciju na početni zaslon. Staru ikonu makni.

## Što ostaje kako je

- Stara adresa (x-files-delta.vercel.app) radi i dalje. Poveznice koje su mušterije
  već dobile (odobrenja, računi) rade.
- Poddomene zanata (`automehanicar.poslar.eu` …) nisu potrebne. Ako ih jednom dodaš
  u Vercel, aplikacija ih sama prepozna i pokaže taj zanat.

## Kasnije: e-mail podrska@poslar.eu

1. Kod registrara uključi prosljeđivanje (forwarding) s `podrska@poslar.eu` na svoj e-mail, ako ga nudi.
2. Brevo → Senders, Domains & Dedicated IPs → Domains → Add → `poslar.eu`.
   Brevo pokaže DNS zapise (SPF, DKIM, DMARC). Upiši ih kod registrara.
3. Dalje po `docs/EMAIL_BREVO.md`, s adresom `podrska@poslar.eu`.
4. Vercel: `SUPPORT_EMAIL` = `podrska@poslar.eu` (pokazuje se na naslovnici i u Pomoći).
