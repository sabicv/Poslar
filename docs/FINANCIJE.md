# Poslar: financijska analiza i telefon (7. 10. 2026.)

Stanje razgovora i prijedlozi. Ništa od ovoga još nije u kodu, čeka Vedranovu konačnu odluku.

Pretpostavke u cijelom dokumentu:
- Cijene su s PDV-om (25 %), kako piše na stranici. Tebi ostaje cijena / 1,25.
- Paddle: 5 % + 0,50 $ (oko 0,45 €) po uplati, mjesečna naplata.
- 1 $ ≈ 0,90 €.
- Porez na tvoj dohodak nije uračunat (knjigovođa).

**Ispravak ranije računice:** u prvoj analizi Paddlea (Standard 50 € → 47,50 €) nisam odbio PDV.
Ispravno je: 50 € → 40 € bez PDV-a → oko 37 € nakon Paddlea.

---

## 1. Što je odlučeno

- Vercel Pro i Supabase Pro tek s prvom pretplatom. Do tada besplatni paketi.
- Nema selidbe na Cloudflare ili vlastiti server. Nema promjene AI pružatelja (slike su već smanjene na 1600 px / 500 kB).
- Google Play, žig i odvjetnik: kasnije.
- Domena poslar.eu kupljena (5 € godišnje). Brevo račun postoji.
- Telefon: jedan zajednički Twilio broj za sve radionice, ako probni poziv pokaže da hrvatski operateri šalju broj koji je preusmjerio poziv (ForwardedFrom). Ako proradi, telefon je u svim paketima, ne kao dodatak.
- Vedran kupuje Twilio broj i otvara sve račune za potpuni test (popis u odjeljku 8).

## 2. Cijena jednog poziva

| Dio | Cijena |
|---|---|
| Twilio dolazni poziv, hrvatski Local broj | 0,03 $ po započetoj minuti |
| Vapi platforma | 0,05 $/min, po sekundi |
| Prepoznavanje govora (Azure, hr-HR) | oko 0,01 $/min |
| Jezični model (brzi, jeftini) | oko 0,01 $/min |
| Glas (Azure, Srećko) | oko 0,01 $/min |

0,32 $/min vrijedi samo za besplatni (toll-free) broj. Njega ne uzimamo.

| Vrsta poziva | Trajanje | Cijena |
|---|---|---|
| Termin, mušterija u bazi | oko 35 s | oko 7 centi |
| Termin, nova mušterija | oko 50 s | oko 9 centi |
| Stanje naloga, poruka, "nazovite me" | 15 do 25 s | oko 5 centi |
| Bez AI-ja (pozivi potrošeni, vlastiti radnik, ponovljeni poziv) | 5 do 10 s | oko 3 centa |
| **Prosjek za računicu** | | **oko 8 centi** |

Kako cijenu dalje spustiti:
1. Kratki razgovori (cilj 40 s, najviše 60 s), jedan ponuđeni termin.
2. Bez AI-ja za brojeve vlastitih radnika i za isti broj koji zove opet unutar 10 minuta.
3. Kasnije, s 50 i više radionica: vlastiti telefonski sustav bez Vapija. Poziv bi pao na oko 4 do 5 centi.

## 3. Što Poslar radi kad poziv nije za termin

Svaki poziv završi jednim od četiri ishoda, a vlasnik ih vidi u Prijemu i u "Zadnji pozivi":
**Termin** (prijedlog, majstor potvrđuje porukom), **Nazvati**, **Poruka**, **Odgovoreno**.

| Situacija | Što Poslar radi | Ishod |
|---|---|---|
| Pita je li auto gotov | Provjeri nalog po broju pozivatelja, kaže fazu, nikad cijenu | Odgovoreno |
| Pita radno vrijeme ili adresu | Odgovori iz postavki radionice | Odgovoreno |
| Pita cijenu | "Cijenu javlja majstor nakon pregleda." Ponudi povratni poziv | Nazvati |
| Ne zove zbog vozila (dobavljač, prodaja, privatno) | Uzme ime i jednu rečenicu | Poruka |
| Želi razgovarati s majstorom ili radnikom | Odmah prihvati: "Majstor će Vas nazvati čim može." Pita je li hitno | Nazvati (hitno ili obično) |
| Ne razumije izraz ili kvar | Ne mora razumjeti: zapiše riječi pozivatelja doslovno, majstor čita. Dijagnozu nikad ne nagađa | Termin ili Nazvati |
| Loša veza, buka, ne razumije ni nakon ponavljanja | "Zapisao sam, majstor će Vas nazvati." | Nazvati |
| Hitno (ne pali, na cesti, curi voda) | Označi hitno, za vuču uzme lokaciju, vlasnik dobije obavijest odmah | Termin ili Nazvati, hitno |

Prebacivanje poziva na čovjeka ne radimo: majstorov mobitel se već nije javio, a prebacivanje na drugi broj
plaća se kao odlazni poziv. Kasnije moguće kao opcija (broj ureda).

Prepoznavanje govora dobiva popis stručnih riječi po zanatu (marke, dijelovi, kvarovi), pa bolje razumije
"alternator", "turbina", "kvačilo".

## 4. Poziv od jedne minute

1. "Dobar dan, [radionica]. Ovdje Poslar, javljam se automatski. Što trebate?" (5 s)
2. Pozivatelj opiše kvar. (10 do 15 s)
3. Hitnost: procijeni iz opisa, pita samo kad nije jasno. (0 do 3 s)
4. Podaci:
   - Mušterija u bazi: ništa ne pita. Ako ima dva vozila: "Golf ili Octavia?"
   - Nova mušterija: ime i registracija (terenski zanati: adresa). Broj već imamo. (10 s)
5. Jedan termin: "Prvi slobodan je utorak u 8. Odgovara?" (6 s)
6. "Upisano. Majstor potvrđuje porukom. Doviđenja." (4 s)

Na 55. sekundi: "Zapisao sam, majstor će Vas nazvati." Nalog se otvori s onim što je zapisano.
Riječ "automatski" ostaje: EU zakon o umjetnoj inteligenciji traži da pozivatelj zna da ne razgovara s čovjekom.

## 5. Koliko poziva treba radionici

Procjena, dok proba ne pokaže prave brojke. Aplikacija bilježi svaki poziv, pa nakon prvog mjeseca znamo točno.
Poslar preuzima samo pozive na koje se majstor ne javi. 22 radna dana.

| Radionica | Poziva dnevno | Propušteno | Poslaru mjesečno | Minuta (oko 40 s) |
|---|---|---|---|---|
| Mali obrt, 1 do 3 čovjeka (Basic) | 8 do 15 | 30 do 40 % | 55 do 130, obično oko 80 | oko 55 |
| Srednja, do 5 ljudi (Standard) | 15 do 25 | 25 do 35 % | 80 do 190, obično oko 130 | oko 90 |
| Veća, do 10, s nekim na prijemu (Premium) | 25 do 40 | 15 do 25 % | 80 do 220, obično oko 150 | oko 100 |

Razlike po zanatu:
- Klima serviser, vodoinstalater: oko 30 do 50 % više (rad na terenu, vožnja).
- Vučna služba: noćni i hitni pozivi, duži (lokacija). Ovdje je Poslar najvrjedniji.
- Auto plac: puno kratkih upita ("je li auto još dostupan?").

Prijedlog uključenih poziva: **Basic 100, Standard 200, Premium 400** mjesečno (oko 70 / 135 / 270 minuta).
Kad se potroše: snimljena poruka "Majstor će Vas nazvati" i bilješka "Nazvati" u Prijemu, oko 3 centa po pozivu.

## 6. Tržište: koliko traže drugi

| Proizvod | Cijena | Što dobiješ |
|---|---|---|
| Service Manager (aplikacije.hr) | 40 € + PDV = 50 €/mj | program za autoservis, bez telefona |
| Auto-servis (micro-process.hr) | 48 € + PDV = 60 €/mj | nalozi, računi, blagajna, bez telefona |
| Serwizz | 40 €/mj **po korisniku** | radni nalozi, bez telefona |
| Jobber (SAD) | 49 / 139 / 199 $/mj, 1 korisnik, dodatni 29 $ | terenske usluge, bez AI telefona |
| AI recepcija za autoservise (SAD) | 29 do 79 $/mj za 60 do 150 min, tipično 200 do 500 $ | samo telefon |

**Zaključak:** naš Basic (30 € s PDV-om) jeftiniji je od svakog hrvatskog programa za jednog korisnika.
Uz to nudimo više radnika, AI i telefon. Cijene su preniske za ono što dajemo.

## 7. Cijene: računica po paketu

Tipična potrošnja: Basic 40 slika + 30 pitanja + 70 poziva; Standard 80 + 60 + 110; Premium 150 + 120 + 160.
Najgori slučaj: sve kvote i svi uključeni pozivi potrošeni. Ostali troškovi (prostor, e-mail) oko 0,50 €.

**Sadašnje cijene 30 / 50 / 90 €**

| Paket | Tebi nakon PDV-a i Paddlea | Tipični trošak | Ostaje tipično | Ostaje u najgorem slučaju |
|---|---|---|---|---|
| Basic 30 € | 22,05 € | 7,30 € | **oko 15 €** | oko 10 € |
| Standard 50 € | 37,05 € | 11,60 € | **oko 25 €** | oko 13 € |
| Premium 90 € | 67,05 € | 17,80 € | **oko 49 €** | oko 19 € |

**Prijedlog 39 / 69 / 119 €**

| Paket | Tebi nakon PDV-a i Paddlea | Tipični trošak | Ostaje tipično | Ostaje u najgorem slučaju |
|---|---|---|---|---|
| Basic 39 € | 28,80 € | 7,30 € | **oko 21 €** | oko 16 € |
| Standard 69 € | 51,30 € | 11,60 € | **oko 40 €** | oko 27 € |
| Premium 119 € | 88,80 € | 17,80 € | **oko 71 €** | oko 40 € |

Basic 39 € i dalje je manje od jednog radnog sata (rečenica s naslovnice ostaje točna).

**Osnivačka cijena (prijedlog):** prvih 50 radionica plaća 29 / 49 / 89 €, zaključano na 24 mjeseca.
To su gotovo sadašnje cijene. Daje razlog da se prijave sada, a ti dobivaš prve preporuke i recenzije.
Ugovor na 24 mjeseca (−10 %) tada vrijedi samo uz punu cijenu.

## 8. Fiksni troškovi i scenariji

Fiksno od prve pretplate: Vercel Pro 20 $ + Supabase Pro 25 $ + zajednički broj oko 8 $ = **oko 50 € mjesečno**.
Sa 100 i više radionica oko 80 do 100 € (veća baza).

Mjesečna zarada prije tvog poreza, mješavina 50 % Basic, 35 % Standard, 15 % Premium:

| Radionica | Sadašnje cijene | Predložene cijene |
|---|---|---|
| 10 | oko 190 € | oko 300 € |
| 50 | oko 1.120 € | oko 1.700 € |
| 150 | oko 3.450 € | oko 5.200 € |

Dvije do tri radionice pokrivaju fiksne troškove.
Troškovi dovođenja mušterija nisu uračunati: preporuka = 1 besplatan mjesec preporučitelju (jednokratno),
affiliate 20 do 30 € jednokratno, terenski partner 10 % kroz prvih 12 mjeseci.

## 9. Računi za potpuni test (Vedran)

| # | Što | Cijena | Napomena |
|---|---|---|---|
| 1 | Spojiti poslar.eu (docs/DOMENA.md) | 0 € | prvo, sve ostalo koristi adresu |
| 2 | Anthropic API kredit i ključ | 10 $ jednom | Vercel: ANTHROPIC_API_KEY |
| 3 | E-mail podrska@poslar.eu, Brevo domena | 0 € | DNS kod registrara |
| 4 | Twilio račun, hrvatski **Local** broj | oko 20 $ za start | privatna osoba: osobna + dokaz adrese, broj s područja adrese; odobrenje par dana |
| 5 | Vapi račun i kredit | 10 do 20 $ | asistenta složiti tek po novim uputama |
| 6 | Paddle sandbox | 0 € | pravi račun kad domena proradi |

## 10. Otvorene odluke

1. Cijene: ostati na 30 / 50 / 90 ili prijeći na 39 / 69 / 119 s osnivačkom cijenom 29 / 49 / 89?
2. Uključeni pozivi 100 / 200 / 400 mjesečno?
3. Poruka kad se pozivi potroše: "Majstor će Vas nazvati" i bilješka u Prijemu?
4. Glas: Srećko (Azure, jeftin) ili ElevenLabs (ljepši, 3 do 4 puta skuplji glas)?
5. Probni poziv za zajednički broj, čim stigne Twilio broj.

Nakon odluka, u kodu (kad Vedran kaže "kreni"): telefon u pakete s brojem poziva, poveznica
"Rezerviraj termin", tjedni backup i mjerač prostora u Tornju, novi tekst naslovnice (na odobrenje),
zajednički broj prema ForwardedFrom, plaćanje preko Paddlea.

## Izvori

- Twilio, hrvatski brojevi i cijene: https://www.twilio.com/en-us/guidelines/hr/regulatory, https://www.twilio.com/en-us/voice/pricing/hr
- Twilio, ForwardedFrom ovisi o operateru: https://www.twilio.com/docs/voice/api/call-resource
- Vapi cijene: https://www.layer3labs.io/guides/vapi-pricing
- Hrvatski programi za autoservis: https://aplikacije.hr/program-za-automehanicare/, https://www.micro-process.hr/auto-servis/, https://www.getserwizz.com/hr/industrije/auto
- Jobber: https://costbench.com/software/field-service-management/jobber/
- AI recepcija, cijene: https://report.spegiti.com/industries/auto-repair
