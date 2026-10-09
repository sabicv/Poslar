# Praćenje dostupnosti (UptimeRobot)

Besplatni [UptimeRobot](https://uptimerobot.com) javlja na e-poštu ili Telegram kad poslar.eu ne odgovara. To nije jamstvo dostupnosti (SLA) u uvjetima: samo rano upozorenje da stranica ne radi.

## Što pratiti

1. Otvorite [UptimeRobot](https://uptimerobot.com) i napravite račun.
2. Add New Monitor → **HTTPS**.
3. URL: `https://www.poslar.eu/api/health`
4. Interval: 5 minuta (besplatni plan).
5. Keyword (nije obavezno): `ok` — odgovor je `{"ok":true,...}`.
6. Alert Contacts: Vaša e-pošta, po želji Telegram.

Ne stavljajte `/` (naslovnicu): ona može biti sporija zbog slika. `/api/health` ne dira bazu i ne traži prijavu.

## Što ne obećavati

U uvjetima piše radno vrijeme podrške i da neprekidnu dostupnost ne jamčimo. Monitor je za Vas, ne za kupca.
