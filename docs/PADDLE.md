# Plaćanje karticom (Paddle)

Paddle je "Merchant of Record": on naplaćuje karticu, obračunava PDV i šalje račun radionici. Tebi isplaćuje zaradu. Poslar ne vidi podatke kartice.

Dok ključevi nisu upisani, aplikacija radi kao i sada: plaća se općom uplatnicom, a uplatu upisuješ u Tornju.

Kad je sve upisano:

- Postavke → Pretplata dobiva gumb "Plati karticom" za svaki paket (osnivačka cijena za prvih 50 radionica sama se bira);
- zaključani ekran ("Pretplata nije plaćena") dobiva "Karticom, odmah otključano";
- svaka uplata sama produži "Plaćeno do" i upiše se u Toranj (napomena "Kartica (Paddle)");
- radionica koja plaća karticom vidi "Kartica i računi" (Paddleova stranica za promjenu kartice i preuzimanje računa).

Promjenu paketa radionica radi sama gumbom "Prilagodi plan" (na kartici trenutačne pretplate). Viši paket naplaćuje razliku odmah; niži ide od sljedeće naplate, bez povrata. Ako kartica nije spojena, i dalje šalju "Želim …".

## 1. Prvo sandbox (probni novac)

1. Otvori sandbox-vendors.paddle.com i napravi račun.
2. Catalog → Products → New product: "Poslar".
3. U proizvodu dodaj cijene (Prices), sve mjesečne (Billing period: monthly), u EUR, porez "included in price":

| Cijena | Iznos | Varijabla u Vercelu |
|---|---|---|
| Basic | 40 € | `PADDLE_PRICE_BASIC` |
| Standard | 70 € | `PADDLE_PRICE_STANDARD` |
| Premium | 120 € | `PADDLE_PRICE_PREMIUM` |
| Basic osnivačka | 30 € | `PADDLE_PRICE_BASIC_FOUNDER` |
| Standard osnivačka | 50 € | `PADDLE_PRICE_STANDARD_FOUNDER` |
| Premium osnivačka | 90 € | `PADDLE_PRICE_PREMIUM_FOUNDER` |

   Svaka cijena ima ID oblika `pri_01h…`. Taj ID ide u varijablu.

4. Developer Tools → Authentication:
   - "Client-side tokens" → New: token oblika `test_…`. Ide u `PADDLE_CLIENT_TOKEN`.
   - "API keys" → New: ide u `PADDLE_API_KEY` (nikad u chat).
5. Developer Tools → Notifications → New destination:
   - URL: `https://poslar.eu/api/paddle` (ili trenutna adresa aplikacije)
   - Events: `subscription.created`, `subscription.updated`, `subscription.activated`, `subscription.canceled`, `transaction.completed`
   - Nakon spremanja otvori destinaciju i kopiraj "Secret key". Ide u `PADDLE_WEBHOOK_SECRET`.
6. Checkout → Checkout settings → Default payment link: upiši adresu aplikacije (npr. `https://poslar.eu/app/settings/pretplata`).
7. U Vercel upiši sve varijable i napravi deploy (`npx vercel deploy --prod`).

## 2. Probna uplata

1. U aplikaciji: Postavke → Pretplata → "Plati karticom".
2. Probna kartica: 4242 4242 4242 4242, bilo koji datum u budućnosti, CVC 100.
3. Za nekoliko sekundi "Plaćeno do" se pomakne za mjesec dana, a u Tornju se pojavi uplata.

## 3. Prava naplata

1. Na vendors.paddle.com napravi pravi račun i prođi provjeru (Paddle traži podatke o tebi i stranicu s cijenama i uvjetima: poslar.eu, /uvjeti, /privatnost).
2. Ponovi korake 2 do 7 na pravom računu (novi ID-jevi cijena, `live_…` token, novi API ključ i secret).
3. Zamijeni varijable u Vercelu i napravi deploy.

## Varijable u Vercelu

| Naziv | Odakle |
|---|---|
| `PADDLE_CLIENT_TOKEN` | korak 1.4 (`test_…` u sandboxu, `live_…` uživo) |
| `PADDLE_API_KEY` | korak 1.4 |
| `PADDLE_WEBHOOK_SECRET` | korak 1.5 |
| `PADDLE_PRICE_BASIC`, `PADDLE_PRICE_STANDARD`, `PADDLE_PRICE_PREMIUM` | korak 1.3 |
| `PADDLE_PRICE_BASIC_FOUNDER`, `PADDLE_PRICE_STANDARD_FOUNDER`, `PADDLE_PRICE_PREMIUM_FOUNDER` | korak 1.3 (može i bez njih: tada svi plaćaju punu cijenu karticom) |
