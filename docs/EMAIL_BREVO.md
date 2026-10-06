# E-pošta preko Breva

Aplikacija sama ne šalje e-poštu. Šalje je Supabase (prijava, nova lozinka), a Brevo je
pošiljatelj. Dok ovo nije složeno, „Zaboravili ste lozinku?” vodi na WhatsApp, a novu
lozinku daješ u Tornju (Radionice → Uredi → Ljudi i lozinke → Nova lozinka).

Najbolje je složiti ovo nakon domene, s adresom npr. `podrska@poslar.hr`.
Poruke s Gmail adrese preko Breva često završe u neželjenoj pošti ili ne stignu.

## 1. Brevo

1. brevo.com → besplatan račun (300 poruka dnevno, dovoljno za početak).
2. Senders, Domains & Dedicated IPs → Domains → dodaj domenu i upiši DNS zapise
   koje Brevo pokaže (kod registrara domene). Pričekaj da piše „Authenticated”.
3. Senders → dodaj pošiljatelja: ime `Poslar`, adresa `podrska@poslar.hr`.
4. SMTP & API → SMTP → Generate a new SMTP key. Zapiši:
   server `smtp-relay.brevo.com`, port `587`, login (piše tamo) i ključ.
   Ključ nikome ne šalji i ne lijepi ga u chat.

## 2. Supabase

1. Authentication → URL Configuration:
   - Site URL: adresa aplikacije (npr. `https://poslar.hr`)
   - Redirect URLs: dodaj `https://poslar.hr/**`
2. Authentication → Emails → SMTP Settings → Enable custom SMTP:
   - Sender email `podrska@poslar.hr`, sender name `Poslar`
   - Host `smtp-relay.brevo.com`, port `587`
   - Username: login iz Breva, Password: SMTP ključ iz Breva
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

## 3. Uključi u aplikaciji

1. Vercel → Environment Variables: `AUTH_EMAIL` = `1`
2. `npx vercel deploy --prod`
3. Probaj: Prijava → „Zaboravili ste lozinku?” → svoj e-mail → poveznica iz poruke →
   nova lozinka → ulaziš u aplikaciju.

Kasnije, kad sve radi: `REGISTRATION_EMAIL_CONFIRM` = `1` u Vercelu. Tada nova radionica
prvo potvrdi e-mail. To štiti od lažnih registracija.
