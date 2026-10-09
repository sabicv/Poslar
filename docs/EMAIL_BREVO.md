# E-pošta na poslar.eu i Brevo

Dva odvojena posla, oba na istoj domeni:

1. **Sandučić** `podrska@poslar.eu`: tu primaš i odgovaraš na poštu (kao Gmail).
   Brevo to ne radi, Brevo samo šalje.
2. **Brevo** šalje poštu iz Poslara: nova lozinka, potvrda registracije,
   obavijesti voditelju (80 % i 100 % potrošnje, zahtjevi, paket za knjigovođu).

Domena je kod **Spaceshipa** (spaceship.com). Svi DNS zapisi upisuju se tamo:
Spaceship → Launchpad → Domain Manager → `poslar.eu` → **Advanced DNS**.

Važno za DNS:
- Smije postojati **samo jedan** SPF zapis (TXT koji počinje s `v=spf1`) i **samo jedan**
  DMARC zapis (`_dmarc`). Kad dva servisa traže svoj SPF, spajaš ih u jedan (korak 3).
- Postojeće A i CNAME zapise za `@` i `www` (Vercel) ne diraj.
- U polje Host/Name Spaceship traži samo dio ispred domene: `@` za samu domenu,
  `_dmarc` za `_dmarc.poslar.eu`, `brevo1._domainkey` za `brevo1._domainkey.poslar.eu`.

## 1. Sandučić podrska@poslar.eu

Izaberi jedno:

**A) Zoho Mail, besplatno (preporuka za početak).** Do 5 adresa, 5 GB po adresi,
web i aplikacija za mobitel. Besplatni paket nema IMAP (Outlook, Apple Mail),
samo Zohovu aplikaciju.
1. Otvori [zoho.com/mail](https://www.zoho.com/mail/) → Pricing → **Forever Free** → Sign up.
   Ako te pita za regiju podataka, odaberi **EU**.
2. „Sign up with a domain I already own” → `poslar.eu`. Prva adresa: `podrska`.
3. Zoho traži dokaz da je domena tvoja: TXT zapis (`zoho-verification=…`). Upiši ga
   u Spaceship (Host `@`, Type TXT) i klikni Verify.
4. Zoho zatim pokaže **MX** zapise. Za EU obično:
   `mx.zoho.eu` (prioritet 10), `mx2.zoho.eu` (20), `mx3.zoho.eu` (50). Upiši sva tri, Host `@`.
5. Zoho pokaže i **DKIM** (TXT, Host npr. `zmail._domainkey`). Upiši ga i potvrdi u Zohu.
6. SPF i DMARC iz Zohovih uputa **ne upisuj još**, spajaju se s Brevom u koraku 3.
7. Po želji dodaj aliase (Zoho → Admin → Users → Email alias): `info@poslar.eu`,
   `vedran@poslar.eu`. Sve stiže u isti sandučić.

**B) Spacemail (Spaceshipov sandučić, plaća se).** Najjednostavnije jer je kod istog
registrara i Spaceship sam upiše MX i SPF. Spaceship → Spacemail → kupi za `poslar.eu`
→ napravi `podrska`. Na koraku 3 u SPF umjesto Zohovog `include` ostavi onaj koji je
upisao Spaceship.

**C) Samo prosljeđivanje na postojeći Gmail.** Ako ne želiš novi sandučić:
[ImprovMX](https://improvmx.com) (besplatno) prosljeđuje `podrska@poslar.eu` na tvoj Gmail
(upišeš njihova dva MX zapisa i SPF `include:spf.improvmx.com`). Za odgovaranje s te
adrese, u Gmailu: Postavke → Računi → „Pošalji poruku kao” → `podrska@poslar.eu`, SMTP
`smtp-relay.brevo.com`, port 587, login i SMTP ključ iz Breva (korak 2.4). Takve poruke
troše Brevovih 300 dnevno.

Provjera: s nekog drugog e-maila pošalji poruku na `podrska@poslar.eu`. Mora stići.

## 2. Brevo

1. Brevo → gore desno ime računa → **Senders, Domains & Dedicated IPs** → **Domains** →
   **Add a domain** → `poslar.eu`. Na pitanje kako želiš potvrditi, odaberi ručni unos
   („Authenticate the domain yourself”), ne automatski.
2. Brevo pokaže 3 do 4 zapisa. Upiši ih u Spaceship **točno** kako pišu:
   - **Brevo code**: TXT, Host `@`, vrijednost `brevo-code:…`
   - **DKIM**: dva CNAME zapisa, Host `brevo1._domainkey` i `brevo2._domainkey`
     (u starijem prikazu jedan TXT `mail._domainkey`)
   - **DMARC**: ne upisuj Brevov ako ga upisuješ u koraku 3 (smije biti samo jedan)
   Klikni **Authenticate this email domain**. Kad piše „Authenticated”, domena je spremna.
   DNS ponekad treba sat-dva; ako ne prođe odmah, pokušaj kasnije.
3. **Senders** → **Add a sender**: ime `Poslar`, adresa `podrska@poslar.eu`. Brevo pošalje
   kod na tu adresu, zato sandučić iz koraka 1 mora raditi prije ovoga.
4. **SMTP & API** → kartica **SMTP** → **Generate a new SMTP key** (ime npr. `supabase`).
   Zapiši: server `smtp-relay.brevo.com`, port `587`, **Login** (oblik `…@smtp-brevo.com`) i ključ.
5. **SMTP & API** → kartica **API Keys** → **Generate a new API key** (ime npr. `poslar-vercel`).
   Ključ počinje s `xkeysib-`. Ovaj ide u Vercel (korak 4), SMTP ključ ide u Supabase.
6. **Security → Authorised IPs**: ako je uključeno blokiranje nepoznatih IP adresa,
   **isključi ga**. Vercel šalje s promjenjivih adresa i Brevo bi odbio poruke iz Poslara.

Ključeve nikome ne šalji i ne lijepi ih u chat. Upisuješ ih samo u Supabase i Vercel.

## 3. SPF i DMARC (jedan zapis svaki)

U Spaceshipu, Host `@`, Type TXT, **jedan** zapis:

| Sandučić | SPF vrijednost |
|---|---|
| Zoho (A) | `v=spf1 include:zohomail.eu include:spf.brevo.com ~all` |
| Spacemail (B) | `v=spf1 include:<Spaceshipov> include:spf.brevo.com ~all` |
| ImprovMX (C) | `v=spf1 include:spf.improvmx.com include:spf.brevo.com ~all` |

Ako već postoji TXT s `v=spf1`, **uredi** ga, ne dodaj drugi.
Kod Spacemaila umjesto `<Spaceshipov>` prepiši `include` koji je Spaceship sam upisao.

DMARC: Host `_dmarc`, Type TXT:

```
v=DMARC1; p=none; rua=mailto:podrska@poslar.eu
```

`p=none` znači da se zasad samo prati. Kad mjesec dana sve stiže, promijeni u `p=quarantine`.

Provjera: [mxtoolbox.com/SuperTool.aspx](https://mxtoolbox.com/SuperTool.aspx) → `spf:poslar.eu`,
pa `dmarc:poslar.eu`. Oba moraju biti zelena, bez „multiple records”.

## 4. Vercel

Vercel → projekt x-files → Settings → Environment Variables (Production):

| Varijabla | Vrijednost |
|---|---|
| `BREVO_API_KEY` | API ključ iz koraka 2.5 (`xkeysib-…`) |
| `MAIL_FROM` | `podrska@poslar.eu` |
| `MAIL_FROM_NAME` | `Poslar` |
| `SUPPORT_EMAIL` | `podrska@poslar.eu` (naslovnica, Pomoć, uvjeti, privatnost) |
| `AUTH_EMAIL` | `1` (uključi tek kad je Supabase iz koraka 5 složen) |

Zatim `npx vercel deploy --prod`. Nove vrijednosti vrijede tek od novog deploya.

## 5. Supabase (prijava i nova lozinka)

1. Authentication → URL Configuration:
   - Site URL: `https://www.poslar.eu`
   - Redirect URLs: dodaj `https://www.poslar.eu/**` i `https://poslar.eu/**`
2. Authentication → Emails → **SMTP Settings** → Enable custom SMTP:
   - Sender email `podrska@poslar.eu`, sender name `Poslar`
   - Host `smtp-relay.brevo.com`, port `587`
   - Username: **Login** iz koraka 2.4, Password: **SMTP ključ** iz koraka 2.4
3. Authentication → Rate Limits: „emails per hour” podigni npr. na 100.
4. Authentication → Emails → Templates. Zamijeni ova dva predloška:

**Reset Password**

Subject: `Poslar: nova lozinka`

```html
<h2>Nova lozinka</h2>
<p>Zatražena je nova lozinka za Vaš račun u Poslaru. Ako ste to bili Vi, dodirnite:</p>
<p><a href="{{ .SiteURL }}/auth/potvrda?token_hash={{ .TokenHash }}&type=recovery&next=/nova-lozinka">Postavi novu lozinku</a></p>
<p>Poveznica vrijedi ograničeno vrijeme i samo jednom. Ako niste tražili novu lozinku, zanemarite ovu poruku.</p>
<p>Poslar</p>
```

**Confirm signup** (za kasnije, kad uključiš potvrdu e-maila pri registraciji)

Subject: `Poslar: potvrdite e-mail`

```html
<h2>Dobro došli u Poslar</h2>
<p>Potvrdite e-mail i radionica je spremna:</p>
<p><a href="{{ .SiteURL }}/auth/potvrda?token_hash={{ .TokenHash }}&type=email&next=/app">Potvrdi e-mail</a></p>
<p>Ako se niste registrirali, zanemarite ovu poruku.</p>
<p>Poslar</p>
```

## 6. Provjera

1. Prijava → „Zaboravili ste lozinku?” → svoj e-mail → poruka od `Poslar <podrska@poslar.eu>`
   → poveznica → nova lozinka → ulaziš u aplikaciju.
2. Poruku otvori u Gmailu → tri točkice → **Prikaži izvornik**. SPF, DKIM i DMARC moraju
   pisati **PASS**. Ako neki piše FAIL, provjeri korak 3.
3. [mail-tester.com](https://www.mail-tester.com): pošalji poruku na adresu koju pokaže
   (npr. iz Zoha). Ocjena 9/10 ili više je dobra.
4. Brevo → Transactional → Logs: vidiš svaku poruku koju je Poslar poslao i je li stigla.

Kasnije, kad sve radi: `REGISTRATION_EMAIL_CONFIRM` = `1` u Vercelu. Tada nova radionica
prvo potvrdi e-mail. To štiti od lažnih registracija.

Brevo besplatno: 300 poruka dnevno. Za početak je dovoljno. Toranj tu potrošnju ne
pokazuje, pa je gledaj u Brevo → Usage and plan.
