# WhatsApp poruke mušterijama (Meta Cloud API)

Poslar šalje mušterijama poruke s jednog zajedničkog broja, u ime radionice:

- potvrdu termina, kad majstor dodirne „Potvrdi termin”,
- podsjetnik navečer prije termina,
- „posao je gotov”, kad nalog prijeđe u Gotovo,
- faze popravka, za limare.

Mušterija može odgovoriti. Tekst i slike stižu u nalog na koji se poruka odnosi.

Dok ništa od ovoga nije upisano, aplikacija radi kao i sada: majstor šalje istu poruku jednim dodirom sa svog WhatsAppa.

Okvirni trošak: oko 2 centa po poruci (Meta naplaćuje „utility” poruke). Odgovori mušterije unutar 24 sata su besplatni.

## 1. Meta račun i broj

1. Otvori business.facebook.com i napravi Business portfolio „Poslar”.
2. Otvori developers.facebook.com, pa My Apps, Create App, tip „Business”. Ime: Poslar.
3. U aplikaciji dodaj proizvod WhatsApp.
4. WhatsApp → API Setup → Add phone number. Upiši Poslar broj (Twilio broj ili drugi koji prima SMS ili poziv za potvrdu). Ime za prikaz: Poslar.
5. Business Settings → Payment methods: dodaj karticu za plaćanje poruka.

## 2. Trajni ključ (token)

1. Business Settings → Users → System users → Add. Ime: poslar-server, uloga Admin.
2. Assign assets: tvoja aplikacija (Full control) i WhatsApp račun (Full control).
3. Generate new token: aplikacija Poslar, trajanje „Never”, dozvole `whatsapp_business_messaging` i `whatsapp_business_management`.
4. Spremi token. Ide u Vercel kao `WHATSAPP_TOKEN` (nikad u chat).
5. Iz WhatsApp → API Setup prepiši „Phone number ID”. Ide u Vercel kao `WHATSAPP_PHONE_ID`.
6. App Settings → Basic → App Secret. Ide u Vercel kao `WHATSAPP_APP_SECRET`.

## 3. Predlošci poruka

WhatsApp Manager → Message templates → Create template. Za svaki:

- Category: **Utility**
- Language: **Croatian (hr)**
- Name i Body točno kako piše ovdje (varijable {{1}}, {{2}}, {{3}} ostaju kako jesu)

| Name | Body |
|---|---|
| `poslar_potvrda_termina` | Poštovani, {{1}} potvrđuje Vaš termin: {{2}}. Mjesto: {{3}}. Ako trebate drugi termin, odgovorite na ovu poruku. |
| `poslar_podsjetnik_termina` | Podsjetnik: sutra, {{1}}, imate termin kod {{2}}. Mjesto: {{3}}. Ako ne možete doći, odgovorite na ovu poruku. |
| `poslar_posao_gotov` | Poštovani, {{1}} javlja da je posao gotov: {{2}}. Možete doći u radno vrijeme. Hvala na povjerenju! |
| `poslar_faza_popravka` | Poštovani, {{1}} javlja: popravak vozila {{2}} je u fazi {{3}}. Javit ćemo Vam kad bude gotovo. |

Primjeri za varijable (Meta ih traži pri prijavi):

- {{1}}: Autoservis Kovač
- {{2}}: četvrtak, 15. listopada u 9:00 (za podsjetnik: 9:00; za „gotovo”: Škoda Octavia ZG-1234-AB; za fazu: ZG-1234-AB)
- {{3}}: Put Supavla 21, Split (za fazu: lakiranje)

Odobrenje obično traje od nekoliko minuta do jednog dana. Tekstovi u aplikaciji su u `config/whatsapp.ts`. Ako Meta traži izmjenu, isti tekst se mijenja i tamo.

## 4. Webhook (odgovori mušterija)

1. U Vercel dodaj `WHATSAPP_VERIFY_TOKEN`: bilo koji dugi niz znakova koji sam smisliš.
2. Deploy (`npx vercel deploy --prod`).
3. developers.facebook.com → aplikacija → WhatsApp → Configuration → Webhook → Edit:
   - Callback URL: `https://poslar.eu/api/whatsapp` (ili trenutna adresa aplikacije)
   - Verify token: isti kao `WHATSAPP_VERIFY_TOKEN`
4. Webhook fields: uključi **messages**.

## 5. Provjera

1. U aplikaciji otvori nalog s terminom i svojim brojem kao mušterijom.
2. Dodirni „Potvrdi termin na WhatsApp”. Poruka stiže s Poslar broja, a ispod gumba piše „Potvrda poslana”.
3. Odgovori na poruku slikom. Slika se pojavi u nalogu, među datotekama.
4. Postavke → Poruke mušterijama: svaku poruku radionica može isključiti.

## Varijable u Vercelu

| Naziv | Odakle |
|---|---|
| `WHATSAPP_TOKEN` | korak 2.3 |
| `WHATSAPP_PHONE_ID` | korak 2.5 |
| `WHATSAPP_APP_SECRET` | korak 2.6 |
| `WHATSAPP_VERIFY_TOKEN` | korak 4.1 |
| `CRON_SECRET` | za podsjetnike navečer (isti dnevni zadatak kao dnevni sažetak) |
