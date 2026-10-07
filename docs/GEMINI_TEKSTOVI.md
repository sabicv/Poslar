# Poslar: tekstovi prezentacije za doradu

Ovaj dokument pošalji Geminiju u cijelosti (priloži datoteku ili zalijepi sve).
Odjeljak 1 je zadatak, 2 do 7 su činjenice, pravila i izgled stranica, 8 su svi tekstovi s oznakama, a 9 je format odgovora.
Gemini vraća samo promijenjene tekstove, s istim oznakama, a Claude ih unosi u aplikaciju.

---

## 1. Zadatak

Ti si iskusan pisac prodajnih tekstova za poslovne aplikacije i dobro poznaješ hrvatske obrtnike:
automehaničare, autoelektričare, vulkanizere, limare, klima servisere, vodoinstalatere, vučne službe, auto placeve.

Poboljšaj tekstove javne stranice aplikacije **Poslar** (poslar.eu): naslovnicu, cijene, česta pitanja,
stranice svih 11 zanata i kratke opise zanata. Cilj: majstor u 10 sekundi shvati što dobiva,
povjeruje da je napravljeno baš za njegov posao i isproba aplikaciju.

Kako radiš:
1. Pročitaj odjeljke 2 do 7. To su činjenice i pravila, ne mijenjaj ih.
2. Prođi sve tekstove u odjeljku 8.
3. Svaki tekst koji obećava nešto s popisa u odjeljku 4 obavezno prepravi.
4. Ostale tekstove poboljšaj samo kad stvarno imaš bolje rješenje. Dobar tekst ostavi.
5. Vrati odgovor točno u formatu iz odjeljka 9.

---

## 2. Što je Poslar

- **Ime:** Poslar, od "posao" i nastavka "-ar" (kao stolar, limar): majstor svakog posla. Poslar je krovno ime
  aplikacije i ime pomoćnika u njoj. Zanati se zovu bez imena Poslar: "Autoelektričar", ne "Poslar Autoelektričar".
- **Pomoćnik Poslar** ima dva lica:
  - **Poslar na telefonu:** javlja se kad se majstor ne javi. Prepozna mušteriju po broju, zapiše kvar
    i hitnost, ponudi slobodan termin i otvori nalog. Majstor termin potvrđuje porukom.
  - **Pitaj Poslara:** na svakom nalogu daje uputu za posao (koraci, specifikacije, sigurnost)
    i odgovara na pitanja majstora.
- **Logo:** plava podloga, riječ "Poslar" narančasta s bijelim obrubom, kvadratić s kvačicom (posao gotov).
  Boje aplikacije: crna, plava, narančasta i bijela.
- **Kome:** obrti i male firme od 1 do 10 ljudi, 11 zanata (popis u odjeljku 8).
  Majstori su često mlađi, vole aute, motore, F1 i drift. Ton je energičan i konkretan, nikako uredski.
- **Slogan:** "Manje administracije. Više odrađenog posla."
- **Kako se dolazi do aplikacije:** 30 dana besplatno na pravim poslovima, bez kartice;
  ili otvoreni demo s izmišljenim podacima, bez prijave, traje 24 sata.
  Radi u pregledniku i instalira se na početni zaslon mobitela (Android i iPhone), bez trgovine aplikacija.
- **Konkurencija u Hrvatskoj:** programi za autoservis stoje oko 50 do 60 € mjesečno s PDV-om, po korisniku,
  bez telefona i bez AI-ja.

---

## 3. Što aplikacija stvarno radi (smiješ obećati)

- Radni nalog kroz faze (prijem, dijagnostika, popravak, gotovo, preuzeto), za radionicu i za teren.
- Diktiranje glasom u svim poljima.
- **Slikanje:** fotografiraš prometnu dozvolu ili natpisnu pločicu, AI upiše vlasnika, registraciju, VIN, model, godinu.
- Fotografije uz nalog s vremenom i mjestom snimanja. Zapisnik s potpisom mušterije.
- Kontrolne liste sa semaforom (zeleno, žuto, crveno) i obaveznom fotografijom.
- Ponuda i odobrenje: mušterija dobije poveznicu na WhatsApp i odobri rad i cijenu jednim dodirom. Ostaje zapis vremena i iznosa.
- Gotovi predlošci poslova i cjenik (vlastite cijene, satnica), na nalog se dodaju jednim dodirom.
- Računi; uz svaki račun i e-Račun (XML). Mjesečni paket za knjigovođu: knjiga računa za Excel i svi e-Računi.
- **Fiskalizacija:** aplikacija sama ne fiskalizira. Fiskalni račun izdaješ na svojoj blagajni, a broj upišeš
  na nalog. "Računi danas" daje popis za prepis u blagajnu.
- Podsjetnici za servis: aplikacija pamti rokove i svaki tjedan pokaže kome ističe; poruku na WhatsApp šalješ jednim dodirom.
- QR samoprijem na vratima radionice (paketi Standard i Premium): mušterija sama upiše ili izgovori registraciju, kvar i broj.
- Raspored i kalendar termina; rad na terenu: adresa, navigacija (otvara Google Karte), poruka mušteriji "Na putu", izvještaj za klijenta.
- Mušterije, vozila i uređaji s cijelom poviješću; pretraga po registraciji, imenu, telefonu, broju naloga.
- Arhiva i Poslovanje (promet, za naplatu, statistika) samo za vlasnika. **Radnici ne vide cijene ni promet.**
- Uvoz postojećih mušterija i vozila iz Excel ili CSV tablice.
- Izvoz svih podataka u svakom trenutku.
- Podrška preko WhatsAppa.
- Podaci na poslužiteljima u EU (Irska), u skladu s GDPR-om.
- Posebnosti po zanatu: opisane na stranicama zanata (odjeljak 8), npr. DTC kodovi i parazitska potrošnja za
  autoelektričare, hotel za gume s QR pozicijama za vulkanizere, karton F-plinova za klima servisere.

---

## 4. Što aplikacija još NE radi (ne smiješ obećati)

Ove tvrdnje su sada na stranici i treba ih prepraviti ili maknuti:

1. **Više poslovnica s jednog računa** (MAIN.scenes.4 i PRICING.plans.premium.4): ne postoji. Jedna radionica = jedan račun.
2. **Dnevni sažetak posla i prometa koji sam stiže vlasniku** (MAIN.scenes.2): ne postoji.
   Vlasnik sve vidi u aplikaciji kad je otvori.
3. **AI prepoznaje stare papirnate naloge i račune** (MAIN.scenes.5, FAQ.4.a): ne postoji. Uvoz radi iz Excel ili CSV tablice.
4. **Aplikacija sama šalje poruke mušterijama** (npr. TRADE.gear.pains.1.a, TRADE.gear.pains.3.a,
   TRADE.fleet.pains.1.a, TRADE.body.pains.3.a): ne šalje sama. Aplikacija poruku pripremi,
   majstor je šalje jednim dodirom sa svog WhatsAppa. Piši "jednim dodirom", ne "automatski šalje".
5. **"Jednim klikom pošalji paket izravno knjigovođi"** (MAIN.pains.4.a): paket se preuzme jednim dodirom,
   a knjigovođi ga šalješ sam (e-mail, WhatsApp).
6. **Fiskalizacija** u aplikaciji: ne postoji (vidi odjeljak 3).
7. **Plaćanje karticom** u aplikaciji: još ne postoji (plaćanje pretplate uplatnicom; kartice uskoro).
8. **Rad bez interneta:** ne postoji.

---

## 5. Cijene i paketi (činjenice, ne mijenjaj brojke)

Cijene su s PDV-om. Okrugle brojke: Vedran ne želi cijene poput 39 € ili 49,99 €.

| Paket | Puna cijena | Osnivačka cijena | Ljudi | Uključeno |
|---|---|---|---|---|
| Basic | 40 € / mj | 30 € / mj | voditelj + 2 radnika | sve osnovno, 150 slikanja i 100 pitanja Poslaru mjesečno |
| Standard | 70 € / mj | 50 € / mj | do 5 radnika | sve iz Basica + QR samoprijem, 300 slikanja, 200 pitanja |
| Premium | 120 € / mj | 90 € / mj | do 10 radnika | sve iz Standarda, 600 slikanja, 400 pitanja |

- **Osnivačka cijena:** prvih 50 radionica, zaključana na 24 mjeseca.
- **Poslar na telefonu:** planiran u svim paketima, s uključenim pozivima mjesečno (Basic 100, Standard 200, Premium 400).
  Poziv traje najviše jednu minutu. Kad se pozivi potroše, pozivatelj čuje da će ga majstor nazvati.
  Ovo još čeka konačnu potvrdu, zato u tekstu ne naglašavaj broj poziva, samo da je telefon uključen.
- Popust za ugovor na 24 mjeseca vjerojatno otpada (osnivačka cijena ga zamjenjuje). Napiši tekst cijena tako da radi bez njega
  (PRICING.yearly, FAQ.10.a).
- Tekstovi PRICING.plans u odjeljku 8 su stari (minute, doplata za telefon). Prepiši ih prema ovoj tablici.
- Rečenica "Košta manje od jednog radnog sata mjesečno" smije ostati: satnica u radionicama je oko 40 € i više.
- Mogućnost sufinanciranja pretplate iz EU fondova i nacionalnih sredstava: smije ostati.
- Za 10 i više radnika: ponuda po dogovoru.

---

## 6. Pravila pisanja

- Obraćanje s **"ti"** na cijeloj javnoj stranici. (U aplikaciji je "Vi", ali to ovdje ne pišeš.)
- **Rečenice do 10 riječi.** Kratko, jasno, kao da majstor priča majstoru.
- **Konkretni problemi iz radionice**, ne općenite fraze. Npr. "Prepisuješ VIN od 17 znakova", a ne "Uštedi vrijeme".
- **Prirodni hrvatski**, bez prevedenih fraza i anglizama ("game changer", "riješenje za sve tvoje potrebe", "digitalna transformacija").
- **Bez duge crtice (—).** Umjesto nje točka, zarez ili dvotočka.
- Riječi iz radionice: mušterija (u dokumentima "klijent"), nalog, majstor, radnik, termin, registracija.
- Ime Poslar se sklanja: Poslara, Poslaru, Poslarom. "Pitaj Poslara", "Poslar na telefonu".
- **Iskrenost:** Poslar na telefonu kaže pozivatelju da se javlja automatski; nikad ne piši da je to čovjek ili tajnica.
  Ne izmišljaj statistike, postotke ni recenzije.
- Ne koristi riječi "AI asistent" ni "virtualni asistent" za Poslara. AI smiješ spomenuti kod slikanja dokumenata.
- **Duljina:** svaki tekst ima broj znakova (zn.). Naslovi i gumbi neka ostanu približno iste duljine
  (najviše oko 20 % dulji), jer ih slaže izgled stranice. Duži opisi smiju se skratiti.

---

## 7. Kako su stranice složene

**Naslovnica (poslar.eu), redom:**
1. Zaglavlje: logo, "Za tvoj zanat", "Cijene", "Prijava", gumb CTA_HEADER.
2. Vrh: MAIN.eyebrow (mala oznaka), MAIN.title (veliki naslov), MAIN.subtitle, gumbi CTA_TRIAL i CTA_DEMO,
   MAIN.pickLabel s ikonama svih zanata, uz to slika mobitela s pravim nalogom.
3. Tri stupa: MAIN.pillars.
4. Prizori iz radnog tjedna: MAIN.scenesTitle i MAIN.scenes (kartice).
5. Mobitel i laptop: MAIN.devicesTitle, MAIN.devicesText, slika aplikacije na laptopu.
6. "Zvuči ti poznato?": MAIN.pains (pitanje i odgovor).
7. "I još puno toga": MAIN.extras, svaka se otvori na + (problem, rješenje).
8. Zanati: MAIN.tradesTitle, MAIN.tradesSubtitle, kartica svakog zanata s TRADE_LINES.
9. Cijene: PRICING (prekidač mjesečno i ugovor, tri paketa s popisom PRICING.plans).
10. Česta pitanja: FAQ.
11. Kraj: MAIN.finalTitle, MAIN.finalSub, gumbi, MAIN.finalAsk (WhatsApp), podnožje i MAIN.madeIn.

**Stranica zanata (poslar.eu/zanat/...), redom:**
eyebrow, title, subtitle, gumbi, slika mobitela s nalogom koji je dogovorio Poslar na telefonu;
"Poslar na djelu" (agent); "Prizor iz radionice" (scene); "Poznate situacije" (pains);
"Ključne mogućnosti" (features); "Gotovi normativi radova" (jobs); zatim cijene, česta pitanja i kraj kao na naslovnici.

**Stranica /isprobaj (otvoreni demo):** naslov "Isprobaj demo verziju", rečenica ispod i popis zanata s TRADE_LINES.
**Stranica /register:** naslov i rečenica ispod (oznake PAGE.* na kraju odjeljka 8).

---

---

## 8. Svi tekstovi s oznakama

### 8a. Naslovnica, cijene, česta pitanja i stranice zanata

#### Gumbi

- `CTA_HEADER` (17 zn.): 30 dana besplatno
- `CTA_TRIAL` (52 zn.): Isprobaj u radionici ili na terenu 30 dana besplatno   [dio "u radionici ili na terenu" mijenja se po zanatu: u radionici / na terenu / na cesti / na placu]
- `CTA_DEMO` (44 zn.): Isprobaj demo verziju s izmišljenim podacima

#### Naslovnica: vrh

- `MAIN.eyebrow` (51 zn.): Operativni sustav za radionice i majstore na terenu
- `MAIN.title` (55 zn.): Dok su ti ruke u poslu, pozivi i papiri više ne čekaju.
- `MAIN.subtitle` (144 zn.): Poslar preuzima pozive, ugovara termine i priprema radne naloge dok ti radiš. Sve kontroliraš s mobitela: čisto, uredno i bez gubljenja vremena.
- `MAIN.pickLabel` (21 zn.): Odaberi svoju struku:
- `MAIN.pillars.1.title` (18 zn.): Poslar na telefonu
- `MAIN.pillars.1.text` (77 zn.): Odgovara na pozive mušterija i slaže raspored dok si pod autom ili na terenu.
- `MAIN.pillars.2.title` (24 zn.): Bez ručne administracije
- `MAIN.pillars.2.text` (63 zn.): Radni nalozi, računi i paketi za knjigovođu nastaju automatski.
- `MAIN.pillars.3.title` (16 zn.): Potpuna kontrola
- `MAIN.pillars.3.text` (75 zn.): Pregled svih radova, slika i prometa na tvom mobitelu, gdje god se nalazio.

#### Naslovnica: prizori iz radnog tjedna

- `MAIN.scenesTitle` (29 zn.): Prizori iz tvog radnog tjedna
- `MAIN.scenes.1.title` (49 zn.): Telefon zvoni, a ti si pod dizalicom ili u gužvi.
- `MAIN.scenes.1.text` (148 zn.): Poslar se javi umjesto tebe, provjeri kalendar, ponudi slobodan termin i otvori radni nalog s registracijom. Ti ga samo potvrdiš kad oslobodiš ruke.
- `MAIN.scenes.2.title` (53 zn.): Na godišnjem si odmoru, a radionica radi bez zastoja.
- `MAIN.scenes.2.text` (196 zn.): S plaže imaš uvid u svaki radni nalog i priloženu fotografiju. Poslar raspoređuje pozive, radnici prate zadatke u aplikaciji, a tebi na kraju dana stigne sažeti pregled obavljenog posla i prometa.
- `MAIN.scenes.3.title` (42 zn.): Šalješ mlađeg radnika na složeniji zahvat.
- `MAIN.scenes.3.text` (184 zn.): Poslar ga vodi korak po korak kroz kontrolnu listu kako ništa ne bi ostalo preskočeno. Ti na mobitelu odmah vidiš fotografije i rezultat, bez potrebe za stalnim telefonskim provjerama.
- `MAIN.scenes.4.title` (37 zn.): Širiš posao i otvaraš novu radionicu.
- `MAIN.scenes.4.text` (168 zn.): Vodi više lokacija s jednog računa. Svaka radionica ima svoje radnike, naloge i financijski pregled, a ti upravljaš cjelinom bez razapinjanja na dva mjesta istovremeno.
- `MAIN.scenes.5.title` (47 zn.): Prelaženje na novi sustav u samo jedno popodne.
- `MAIN.scenes.5.text` (166 zn.): Jednostavno uvezi bazu mušterija iz imenika ili Excela. Stare papirnate naloge i račune samo fotografiraj: AI ih sam prepoznaje i razvrstava u povijest svakog vozila.

#### Naslovnica: mobitel i laptop

- `MAIN.devicesTitle` (34 zn.): Mobitel na terenu. Laptop u uredu.
- `MAIN.devicesText` (181 zn.): Aplikacija je napravljena za mobitel. Na tabletu i laptopu je još preglednija: cijeli nalog, grafovi i raspored na jednom ekranu. Podaci su isti na svim uređajima i odmah usklađeni.

#### Naslovnica: "Zvuči ti poznato?"

- `MAIN.painsTitle` (17 zn.): Zvuči ti poznato?
- `MAIN.pains.1.q` (50 zn.): Završavaš radni dan, a tek te čeka pisanje računa?
- `MAIN.pains.1.a` (75 zn.): Izradi i pošalji čist račun ili ponudu izravno s terena u nekoliko sekundi.
- `MAIN.pains.2.q` (70 zn.): Gubiš vrijeme tražeći što je točno rađeno na vozilu prije godinu dana?
- `MAIN.pains.2.a` (91 zn.): Unesi registraciju i u sekundi otvori kompletnu povijest svih servisa i ugrađenih dijelova.
- `MAIN.pains.3.q` (74 zn.): Mušterija prigovara da niste tako dogovorili ili da je cijena neočekivana?
- `MAIN.pains.3.a` (96 zn.): Svaki rad i cijenu mušterija odobrava unaprijed putem WhatsAppa uz točan zapis vremena i iznosa.
- `MAIN.pains.4.q` (77 zn.): Knjigovođa te potkraj mjeseca stalno traži papire i računovodstvene fascikle?
- `MAIN.pains.4.a` (95 zn.): Jednim klikom pošalji kompletan mjesečni paket sa svim računima i tablicama izravno knjigovođi.

#### Naslovnica: "I još puno toga" (otvara se na +)

- `MAIN.extrasTitle` (15 zn.): I još puno toga
- `MAIN.extrasHint` (42 zn.): Dodirni + i vidi kako to izgleda u praksi.
- `MAIN.extras.1.title` (42 zn.): Podsjetnici mušterijama za redoviti servis
- `MAIN.extras.1.problem` (55 zn.): Mušterija zaboravi servis. Javi se tek kad nešto stane.
- `MAIN.extras.1.solution` (168 zn.): Poslar pamti rok servisa za svako vozilo i uređaj. Svaki tjedan vidiš kome ističe. Jednim dodirom šalješ poruku na WhatsApp. Mušterija se vraća tebi, a ne konkurenciji.
- `MAIN.extras.2.title` (29 zn.): QR prijava na ulazu radionice
- `MAIN.extras.2.problem` (69 zn.): Ujutro troje ljudi čeka na vratima. Ti pišeš registracije na papirić.
- `MAIN.extras.2.solution` (146 zn.): Mušterija skenira QR kod na vratima. Sama upiše registraciju, kvar i broj mobitela, ili ih izgovori. Nalog te čeka u Prijemu. Ti ga samo potvrdiš.
- `MAIN.extras.3.title` (42 zn.): Unaprijed pripremljeni cjenici i normativi
- `MAIN.extras.3.problem` (75 zn.): Za isti posao svaki put smišljaš cijenu. Mušterije dobiju različite iznose.
- `MAIN.extras.3.solution` (166 zn.): Gotovi predlošci poslova za tvoju struku, sa stavkama i cijenama. Prilagodiš ih jednom, po svom. Na nalogu ih dodaš jednim dodirom. Isti posao uvijek ima istu cijenu.
- `MAIN.extras.4.title` (45 zn.): Skeniranje prometne dozvole i pločica uređaja
- `MAIN.extras.4.problem` (62 zn.): Prepisuješ VIN od 17 znakova. Jedna greška i stigne krivi dio.
- `MAIN.extras.4.solution` (128 zn.): Slikaj prometnu dozvolu ili natpisnu pločicu. AI upiše vlasnika, registraciju, VIN, model i godinu. Ti samo provjeriš i spremiš.
- `MAIN.extras.5.title` (15 zn.): Slanje e-Računa
- `MAIN.extras.5.problem` (61 zn.): Tvrtke od 2026. traže e-Račun. Obični PDF više nije dovoljan.
- `MAIN.extras.5.solution` (123 zn.): Uz svaki izdani račun Poslar složi i e-Račun datoteku. Knjigovođa je dobije u mjesečnom paketu. Ništa ne prepisuješ dvaput.

#### Naslovnica: zanati i kraj stranice

- `MAIN.tradesTitle` (25 zn.): Prilagođeno tvojoj struci
- `MAIN.tradesSubtitle` (79 zn.): Svaki zanat ima svoje specifične izazove. Poslar ima rješenje za svaki od njih.
- `MAIN.finalTitle` (34 zn.): Isprobaj na prvom sljedećem poslu.
- `MAIN.finalSub` (73 zn.): Stekni prednost pred konkurencijom i digitaliziraj posao po svojoj mjeri.
- `MAIN.finalAsk` (22 zn.): Pitaj nas na WhatsAppu
- `MAIN.madeIn` (21 zn.): Razvijeno u Hrvatskoj

#### Jedna rečenica po zanatu (ispod naziva zanata)

- `TRADE_LINES.gear` (75 zn.): Servisni plan po kilometraži, inspekcija u 50 točaka i evidencija dijelova.
- `TRADE_LINES.volt` (64 zn.): Baza DTC kodova, mjerenje parazitske potrošnje i dnevnik modula.
- `TRADE_LINES.body` (80 zn.): Interaktivna mapa oštećenja, recepture boja u gramima i zapisnici za osiguranje.
- `TRADE_LINES.wheel` (76 zn.): Hotel za gume s QR pozicijama, dubina šare u 3 točke i sezonski podsjetnici.
- `TRADE_LINES.fleet` (72 zn.): Praćenje po motosatima i kilometrima, zakonski rokovi i terenski nalozi.
- `TRADE_LINES.moto` (75 zn.): Zapisnik oštećenja s potpisom, konzervacija za zimu i evidencija skladišta.
- `TRADE_LINES.marine` (70 zn.): Nautički karton po HIN broju, konzervacija motora i vođenje zimovnika.
- `TRADE_LINES.air` (70 zn.): Dnevni raspored s navigacijom, karton F-plinova i izvještaji s terena.
- `TRADE_LINES.aqua` (84 zn.): Zapisnik tlačne probe s fotodokumentacijom, evidencija bojlera i hitne intervencije.
- `TRADE_LINES.tow` (67 zn.): Točne GPS lokacije, slikanje oštećenja pri utovaru i vođenje depoa.
- `TRADE_LINES.deal` (71 zn.): Brojač dana na placu, kartica troškova pripreme i izračun čiste zarade.

#### Cijene

- `PRICING.title` (43 zn.): Košta manje od jednog radnog sata mjesečno.
- `PRICING.subtitle` (106 zn.): Kreni odmah: 30 dana besplatno na svojim poslovima. Ili prvo 24 sata isprobaj demo s izmišljenim podacima.
- `PRICING.monthly` (8 zn.): Mjesečno
- `PRICING.yearly` (35 zn.): Ugovor na 24 mjeseca (10 % popusta)
- `PRICING.funding` (73 zn.): Mogućnost sufinanciranja pretplate iz EU fondova i nacionalnih sredstava.
- `PRICING.best` (14 zn.): Najčešći izbor
- `PRICING.vat` (35 zn.): Sve istaknute cijene uključuju PDV.
- `PRICING.plans.basic.1` (23 zn.): Voditelj i do 2 radnika
- `PRICING.plans.basic.2` (40 zn.): Radni nalozi, fotodokumentacija i računi
- `PRICING.plans.basic.3` (41 zn.): Odobrenje ponuda i cijena putem WhatsAppa
- `PRICING.plans.basic.4` (30 zn.): Automatski paket za knjigovođu
- `PRICING.plans.basic.5` (45 zn.): 150 skeniranja i 100 pitanja Poslaru mjesečno
- `PRICING.plans.basic.6` (50 zn.): Poslar na telefonu: uz doplatu, 100 minuta za 25 €
- `PRICING.plans.standard.1` (23 zn.): Voditelj i do 5 radnika
- `PRICING.plans.standard.2` (35 zn.): Sve funkcionalnosti iz Basic paketa
- `PRICING.plans.standard.3` (36 zn.): QR sustav prijave na ulazu radionice
- `PRICING.plans.standard.4` (58 zn.): Poslar na telefonu: uključeno 60 minuta razgovora mjesečno
- `PRICING.plans.standard.5` (45 zn.): 300 skeniranja i 200 pitanja Poslaru mjesečno
- `PRICING.plans.premium.1` (24 zn.): Voditelj i do 10 radnika
- `PRICING.plans.premium.2` (38 zn.): Sve funkcionalnosti iz Standard paketa
- `PRICING.plans.premium.3` (59 zn.): Poslar na telefonu: uključeno 150 minuta razgovora mjesečno
- `PRICING.plans.premium.4` (41 zn.): Upravljanje s više poslovnica / radionica
- `PRICING.plans.premium.5` (45 zn.): 600 skeniranja i 400 pitanja Poslaru mjesečno

#### Česta pitanja

- `FAQ.1.q` (33 zn.): Treba li mi računalo u radionici?
- `FAQ.1.a` (182 zn.): Ne treba. Aplikacija je u potpunosti prilagođena radu na mobitelu (Android i iPhone). Ako imaš tablet ili laptop, na njima je sve još preglednije, a podaci su isti na svim uređajima.
- `FAQ.2.q` (41 zn.): Kako funkcionira besplatni probni period?
- `FAQ.2.a` (317 zn.): Odmah otvaraš svoju radionicu i 30 dana radiš besplatno na pravim poslovima. Ako želiš prvo razgledati, otvori demo s izmišljenim primjerima iz tvoje struke: traje 24 sata, a nakon toga nastavljaš 30 dana besplatno ili jednostavno odustaješ. Unos bankovne kartice za vrijeme trajanja besplatnog perioda nije potreban.
- `FAQ.3.q` (34 zn.): Što točno radi Poslar na telefonu?
- `FAQ.3.a` (185 zn.): Poslar preuzima pozive kada se ne stigneš javiti. Javi se u ime tvoje radionice, prikupi osnovne informacije od mušterije, ponudi slobodan termin iz tvog kalendara i otvori radni nalog.
- `FAQ.4.q` (49 zn.): Kako prebaciti postojeću bazu klijenata i vozila?
- `FAQ.4.a` (176 zn.): Imenik iz mobitela ili Excel tablicu uvezeš u par klikova. Stare papirnate naloge ili račune dovoljno je fotografirati: AI prepoznaje podatke i sam ih dodaje u povijest vozila.
- `FAQ.5.q` (52 zn.): Vide li moji radnici cijene, zaradu i ukupan promet?
- `FAQ.5.a` (113 zn.): Ne. Radnici vide samo svoje radne naloge, zadatke i tehničke opise, bez pristupa financijskim podacima i maržama.
- `FAQ.6.q` (46 zn.): Gdje se čuvaju moji podaci i jesam li siguran?
- `FAQ.6.a` (172 zn.): Svi podaci pohranjeni su na sigurnim poslužiteljima unutar Europske unije u skladu s GDPR uredbom. Pristup podacima imaš isključivo ti i ovlaštene osobe iz tvoje radionice.
- `FAQ.7.q` (40 zn.): Što iz aplikacije dobiva moj knjigovođa?
- `FAQ.7.a` (147 zn.): Na kraju mjeseca aplikacija generira jedinstveni paket koji sadrži sve izdane račune u strukturiranoj Excel tablici te datoteke spremne za e-Račun.
- `FAQ.8.q` (39 zn.): Kako je riješeno pitanje fiskalizacije?
- `FAQ.8.a` (139 zn.): Fiskalni račun trenutno izdaješ na svojoj blagajni, a u aplikaciju jednostavno upišeš njegov broj radi potpune evidencije po radnom nalogu.
- `FAQ.9.q` (46 zn.): Je li za rad potrebna stalna internetska veza?
- `FAQ.9.a` (140 zn.): Da, potrebna je internetska veza. Sustav je optimiziran tako da troši minimalno podataka i radi stabilno čak i na slabijem mobilnom signalu.
- `FAQ.10.q` (27 zn.): Postoji li ugovorna obveza?
- `FAQ.10.a` (193 zn.): Ne, ako plaćaš mjesečno: otkazuješ u bilo kojem trenutku, bez otkaznog roka. Uz ugovor na 24 mjeseca dobivaš 10 % popusta. Prije odlaska jednostavnim klikom preuzmeš svu svoju arhivu i podatke.
- `FAQ.11.q` (40 zn.): Što ako mi zatreba pomoć pri korištenju?
- `FAQ.11.a` (109 zn.): Naša podrška dostupna ti je izravno putem WhatsAppa ili telefonskog poziva. Pomažemo ti u podešavanju i radu.

#### Stranice zanata: nazivi odjeljaka

- `TRADE_SECTION.agent` (15 zn.): Poslar na djelu
- `TRADE_SECTION.scene` (19 zn.): Prizor iz radionice
- `TRADE_SECTION.pains` (17 zn.): Poznate situacije
- `TRADE_SECTION.features` (18 zn.): Ključne mogućnosti
- `TRADE_SECTION.jobs` (23 zn.): Gotovi normativi radova

#### Stranica zanata: gear (poslar.eu/zanat/automehanicar)

- `TRADE.gear.eyebrow` (26 zn.): Automehanika i opći servis
- `TRADE.gear.title` (58 zn.): Ti si pod dizalicom. Poslar preuzima poziv i slaže termin.
- `TRADE.gear.subtitle` (88 zn.): Pozivi, radni nalozi, servisni planovi i računi. Sve teče glatko dok su ti ruke u poslu.
- `TRADE.gear.agent` (162 zn.): Mušterija zove radi malog servisa. Poslar provjerava kalendar, ponudi prvi slobodan termin i otvori nalog s brojem registracije. Na tebi je samo da potvrdiš unos.
- `TRADE.gear.scene` (147 zn.): Mlađi radnik radi veliki servis. Poslar ga vodi kroz svaki korak zahvata, dok inspekcija u 50 točaka jamči da nijedan detalj ne ostane nepregledan.
- `TRADE.gear.pains.1.q` (41 zn.): Koliko je pređeno od zadnje izmjene ulja?
- `TRADE.gear.pains.1.a` (101 zn.): Servisni plan bilježi kilometre i datume te sam šalje podsjetnik klijentu kad dođe vrijeme za servis.
- `TRADE.gear.pains.2.q` (53 zn.): Mušterija sumnja da je zamjena kočnica bila potrebna?
- `TRADE.gear.pains.2.a` (104 zn.): Priloži fotografiju potrošenih diskova uz stavku naloga. Klijent odobrava rad jednim klikom na mobitelu.
- `TRADE.gear.pains.3.q` (66 zn.): Zaboraviš javiti mušterijama da se približava sezona izmjene guma?
- `TRADE.gear.pains.3.a` (79 zn.): Sustav automatski priprema popis klijenata i šalje im poruke s ponudom termina.
- `TRADE.gear.features.1.title` (22 zn.): Inspekcija u 50 točaka
- `TRADE.gear.features.1.text` (94 zn.): Jasne oznake stanja (zeleno, žuto, crveno) uz obaveznu fotografiju oštećenja ili istrošenosti.
- `TRADE.gear.features.2.title` (20 zn.): Servisni plan vozila
- `TRADE.gear.features.2.text` (92 zn.): Automatizirano praćenje izmjene ulja, filtera i remenja po prijeđenim kilometrima i vremenu.
- `TRADE.gear.features.3.title` (22 zn.): Upravljanje dijelovima
- `TRADE.gear.features.3.text` (78 zn.): Kataloški brojevi, dobavljači, nabavne cijene i jamstva vezani uz radni nalog.
- `TRADE.gear.features.4.title` (30 zn.): Unaprijed pripremljeni poslovi
- `TRADE.gear.features.4.text` (61 zn.): Otvaranje standardnih servisnih radova jednim dodirom ekrana.
- `TRADE.gear.features.5.title` (14 zn.): Dodatni moduli
- `TRADE.gear.features.5.text` (58 zn.): Ugrađena evidencija za hotel guma i terenske intervencije.
- `TRADE.gear.jobs.1` (11 zn.): Mali servis
- `TRADE.gear.jobs.2` (13 zn.): Veliki servis
- `TRADE.gear.jobs.3` (29 zn.): Izmjena seta razvodnog remena
- `TRADE.gear.jobs.4` (24 zn.): Zamjena prednjih kočnica
- `TRADE.gear.jobs.5` (19 zn.): Zamjena seta spojke
- `TRADE.gear.jobs.6` (20 zn.): Servis klima uređaja
- `TRADE.gear.jobs.7` (28 zn.): Priprema za tehnički pregled
- `TRADE.gear.jobs.8` (27 zn.): Zamjena prednjih amortizera

#### Stranica zanata: volt (poslar.eu/zanat/autoelektricar)

- `TRADE.volt.eyebrow` (41 zn.): Autoelektrika, dijagnostika i elektronika
- `TRADE.volt.title` (48 zn.): Greška na autu? Rješenje je već u tvojoj arhivi.
- `TRADE.volt.subtitle` (91 zn.): Kodovi grešaka, mjerenja i zahvati na modulima. Sve ostaje zapisano i pretraživo u sekundi.
- `TRADE.volt.agent` (160 zn.): Mušterija zove i objašnjava da auto ujutro teško pali. Poslar pita koje se lampice pale na kontrolnoj ploči, bilježi simptome i zakazuje termin za dijagnostiku.
- `TRADE.volt.scene` (190 zn.): Radnik dijagnosticira kompleksan kvar. Pred sobom ima očitan DTC kod, popis mogućih uzroka i tvoje ranije riješene slučajeve na tom modelu. Rješava problem bez zvanja i prekidanja tvog rada.
- `TRADE.volt.pains.1.q` (60 zn.): Koji si specifičan kvar lani riješio na istom modelu vozila?
- `TRADE.volt.pains.1.a` (81 zn.): Unesi DTC kod u tražilicu i odmah otvori svoje stare bilješke s točnim rješenjem.
- `TRADE.volt.pains.2.q` (49 zn.): Kako dokazati koliku struju auto vuče dok miruje?
- `TRADE.volt.pains.2.a` (105 zn.): Modul za mjerenje parazitske potrošnje izbacuje čitljiv grafički prikaz pada struje spreman za mušteriju.
- `TRADE.volt.pains.3.q` (69 zn.): Gdje ti je ostala sigurnosna kopija kodiranja s prošlotjednog modula?
- `TRADE.volt.pains.3.a` (77 zn.): Dnevnik zahvata automatski čuva sve izmjene i backup datoteke uz broj šasije.
- `TRADE.volt.features.1.title` (15 zn.): Baza DTC kodova
- `TRADE.volt.features.1.text` (78 zn.): Povezivanje tvorničkih grešaka s tvojom vlastitom arhivom uspješnih popravaka.
- `TRADE.volt.features.2.title` (20 zn.): Parazitska potrošnja
- `TRADE.volt.features.2.text` (63 zn.): Mjerenje i grafički prikaz pražnjenja akumulatora kroz vrijeme.
- `TRADE.volt.features.3.title` (27 zn.): Dnevnik zahvata na modulima
- `TRADE.volt.features.3.text` (71 zn.): Bilježenje kodiranja, adaptacija i pohrana sigurnosnih kopija (backup).
- `TRADE.volt.features.4.title` (19 zn.): Evidencija ključeva
- `TRADE.volt.features.4.text` (48 zn.): Zapisnik programiranja ključeva i imobilizatora.
- `TRADE.volt.features.5.title` (18 zn.): Testiranje sustava
- `TRADE.volt.features.5.text` (66 zn.): Zapisnici ispitanosti akumulatora, alternatora i sustava punjenja.
- `TRADE.volt.jobs.1` (23 zn.): Električna dijagnostika
- `TRADE.volt.jobs.2` (27 zn.): Test akumulatora i punjenja
- `TRADE.volt.jobs.3` (29 zn.): Mjerenje parazitske potrošnje
- `TRADE.volt.jobs.4` (20 zn.): Programiranje ključa
- `TRADE.volt.jobs.5` (29 zn.): Kodiranje upravljačkog modula
- `TRADE.volt.jobs.6` (19 zn.): Zamjena alternatora
- `TRADE.volt.jobs.7` (28 zn.): Zamjena pokretača (anlasera)
- `TRADE.volt.jobs.8` (24 zn.): Ugradnja parking senzora

#### Stranica zanata: body (poslar.eu/zanat/limar-lakirer)

- `TRADE.body.eyebrow` (40 zn.): Autolimarija, lakirnica i procjena šteta
- `TRADE.body.title` (66 zn.): Oštećenja, fotografije i zapisnik. Osiguranje dobiva sve na dlanu.
- `TRADE.body.subtitle` (92 zn.): Od zaprimanja do izlaska iz komore. Svaka faza je dokumentirana, a svaki gram boje izbrojan.
- `TRADE.body.agent` (169 zn.): Klijent zove radi ogrebotine i udubljenja na vratima. Poslar prikuplja osnovne podatke o oštećenju i dogovara termin za procjenu štete dok ti nastavljaš rad u radionici.
- `TRADE.body.scene` (165 zn.): Upravljaš radovima u limariji i lakirnici. U svakom trenutku na mobitelu vidiš u kojoj se točno fazi nalazi koje vozilo, od pripreme i kitanja do komore i poliranja.
- `TRADE.body.pains.1.q` (58 zn.): Kako dokazati točnu potrošnju i recepturu zamiješane boje?
- `TRADE.body.pains.1.a` (68 zn.): Zapisuj šifru boje i točnu recepturu u gramima za svaki radni nalog.
- `TRADE.body.pains.2.q` (65 zn.): Osiguravajuća kuća traži dodatne dokaze oštećenja prije popravka?
- `TRADE.body.pains.2.a` (94 zn.): Izvezi službeni zapisnik s fotografijama „prije, tijekom i poslije” radova u jednom dokumentu.
- `TRADE.body.pains.3.q` (67 zn.): Mušterija te stalno zove i pita kad je auto spreman za preuzimanje?
- `TRADE.body.pains.3.a` (88 zn.): Prati vozilo po fazama rada i automatski obavijesti klijenta čim auto izađe s poliranja.
- `TRADE.body.features.1.title` (27 zn.): Interaktivna mapa oštećenja
- `TRADE.body.features.1.text` (89 zn.): Dodirni oštećeni dio na vizualnom modelu vozila, dodaj operaciju i predviđene radne sate.
- `TRADE.body.features.2.title` (20 zn.): Evidencija lakirnice
- `TRADE.body.features.2.text` (61 zn.): Pohrana šifri boja, receptura i utroška materijala u gramima.
- `TRADE.body.features.3.title` (23 zn.): Zapisnici za osiguranja
- `TRADE.body.features.3.text` (78 zn.): Automatsko generiranje dokumentacije s fotografijama prije i poslije popravka.
- `TRADE.body.features.4.title` (20 zn.): Praćenje proizvodnje
- `TRADE.body.features.4.text` (56 zn.): Kontrola protoka vozila kroz limarske i lakirerske faze.
- `TRADE.body.features.5.title` (20 zn.): Standardni normativi
- `TRADE.body.features.5.text` (71 zn.): Brzo otvaranje radnih naloga za najčešće limarske i lakirerske zahvate.
- `TRADE.body.jobs.1` (27 zn.): Popravak plastičnog branika
- `TRADE.body.jobs.2` (25 zn.): Lakiranje jednog elementa
- `TRADE.body.jobs.3` (26 zn.): Popravak i lakiranje vrata
- `TRADE.body.jobs.4` (27 zn.): Zamjena prednjeg blatobrana
- `TRADE.body.jobs.5` (31 zn.): Spot repair (lokalno lakiranje)
- `TRADE.body.jobs.6` (31 zn.): PDR popravak udubljenja od tuče
- `TRADE.body.jobs.7` (31 zn.): Poliranje i restauracija farova
- `TRADE.body.jobs.8` (27 zn.): Nanošenje keramičke zaštite

#### Stranica zanata: wheel (poslar.eu/zanat/vulkanizer)

- `TRADE.wheel.eyebrow` (55 zn.): Vulkanizerske usluge, geometrija kotača i hotel za gume
- `TRADE.wheel.title` (46 zn.): Prebrodi sezonsku gužvu bez kaosa na telefonu.
- `TRADE.wheel.subtitle` (90 zn.): Termini, hotel za gume i obavijesti mušterijama. Ti mijenjaš gume, sustav vodi sve ostalo.
- `TRADE.wheel.agent` (160 zn.): U listopadu telefon zvoni bez prestanka. Dok ti radiš na dizalici s udarnim odvrtačem, Poslar samostalno puni kalendar sat po sat i raspoređuje termine zamjene.
- `TRADE.wheel.scene` (111 zn.): Radnik preuzima set guma iz skladišta. Skenira QR kod s naljepnice i odmah zna točnu lokaciju u hotelu za gume.
- `TRADE.wheel.pains.1.q` (63 zn.): Gubiš vrijeme tražeći gdje su odložene gume određenog klijenta?
- `TRADE.wheel.pains.1.a` (71 zn.): QR naljepnica točno označava regal, policu i poziciju u hotelu za gume.
- `TRADE.wheel.pains.2.q` (63 zn.): Mušterija tvrdi da su joj gume prošle sezone imale dublju šaru?
- `TRADE.wheel.pains.2.a` (84 zn.): Prijemni zapisnik bilježi dubinu šare u tri točke, DOT broj i zatečeno stanje felgi.
- `TRADE.wheel.pains.3.q` (76 zn.): Kako na vrijeme obavijestiti sve klijente da rezerviraju termin prije gužve?
- `TRADE.wheel.pains.3.a` (75 zn.): Pošalji grupni sezonski podsjetnik na WhatsApp jednim klikom iz aplikacije.
- `TRADE.wheel.features.1.title` (13 zn.): Hotel za gume
- `TRADE.wheel.features.1.text` (81 zn.): Sustav označavanja QR kodovima uz točan raspored (sektor, regal, polica, mjesto).
- `TRADE.wheel.features.2.title` (18 zn.): Karton stanja guma
- `TRADE.wheel.features.2.text` (69 zn.): Unos dubine šare u 3 točke, DOT oznake i pregled oštećenja naplataka.
- `TRADE.wheel.features.3.title` (17 zn.): Geometrija kotača
- `TRADE.wheel.features.3.text` (85 zn.): Pohrana parametara prije i poslije podešavanja te evidencija momenta pritezanja (Nm).
- `TRADE.wheel.features.4.title` (30 zn.): Sezonske SMS/WhatsApp kampanje
- `TRADE.wheel.features.4.text` (71 zn.): Automatizirano slanje obavijesti pred početak ljetne ili zimske sezone.
- `TRADE.wheel.features.5.title` (18 zn.): Mobilni vulkanizer
- `TRADE.wheel.features.5.text` (65 zn.): Nalozi i evidencija radova na terenu ili za vozne parkove tvrtki.
- `TRADE.wheel.jobs.1` (21 zn.): Sezonska zamjena guma
- `TRADE.wheel.jobs.2` (21 zn.): Balansiranje 4 kotača
- `TRADE.wheel.jobs.3` (25 zn.): Krpanje gume (čep/zakrpa)
- `TRADE.wheel.jobs.4` (26 zn.): Geometrija kotača (optika)
- `TRADE.wheel.jobs.5` (30 zn.): Čuvanje guma u hotelu (sezona)
- `TRADE.wheel.jobs.6` (19 zn.): Montaža 4 nove gume
- `TRADE.wheel.jobs.7` (26 zn.): Programiranje TPMS senzora
- `TRADE.wheel.jobs.8` (15 zn.): Zamjena ventila

#### Stranica zanata: fleet (poslar.eu/zanat/kamioni-strojevi)

- `TRADE.fleet.eyebrow` (57 zn.): Teretni program, građevinska mehanizacija i vozni parkovi
- `TRADE.fleet.title` (60 zn.): Nijedan rok ne promakne. Ni periodični pregled, ni tahograf.
- `TRADE.fleet.subtitle` (100 zn.): Motosati, kilometri i zakonske obveze. Potpuna evidencija za tegljače, prikolice, bagere i traktore.
- `TRADE.fleet.agent` (148 zn.): Voditelj prijevozne tvrtke zove radi redovnog servisa kamiona. Poslar preuzima podatke o vozilu, provjerava raspored i rezervira termin u radionici.
- `TRADE.fleet.scene` (151 zn.): Servisna ekipa je na terenu kod radnog stroja. Radni nalog sadrži točnu GPS lokaciju, popis radova i digitalni potpis strojara ili vozača po završetku.
- `TRADE.fleet.pains.1.q` (67 zn.): Kako izbjeći propuste oko atesta, tahografa ili tehničkog pregleda?
- `TRADE.fleet.pains.1.a` (75 zn.): Sustav automatski šalje upozorenja o zakonskim rokovima tjednima unaprijed.
- `TRADE.fleet.pains.2.q` (92 zn.): Kako precizno voditi servis kad se dio mehanizacije mjeri u kilometrima, a dio u motosatima?
- `TRADE.fleet.pains.2.a` (88 zn.): Poslar vodi dvostruku evidenciju i sam izračunava dospijeće servisa „što prije nastupi”.
- `TRADE.fleet.pains.3.q` (81 zn.): Kamion i prikolica stigli su skupa, ali zahtijevaju odvojenu povijest održavanja?
- `TRADE.fleet.pains.3.a` (73 zn.): Sustav vodi zasebne kartone za vučna i priključna vozila ili radne alate.
- `TRADE.fleet.features.1.title` (18 zn.): Servisni intervali
- `TRADE.fleet.features.1.text` (56 zn.): Praćenje dospijeća po radnim satima (mth) i kilometraži.
- `TRADE.fleet.features.2.title` (24 zn.): Odvojena povijest vozila
- `TRADE.fleet.features.2.text` (74 zn.): Zasebni kartoni za tegljače, prikolice, građevinske strojeve i priključke.
- `TRADE.fleet.features.3.title` (31 zn.): Upozorenja o zakonskim rokovima
- `TRADE.fleet.features.3.text` (75 zn.): Automatsko praćenje kalendara za tahograf, kalibracije i tehničke preglede.
- `TRADE.fleet.features.4.title` (21 zn.): Terenski radni nalozi
- `TRADE.fleet.features.4.text` (78 zn.): GPS lokacija kvara, evidencija utrošenog vremena i digitalni potpis korisnika.
- `TRADE.fleet.features.5.title` (15 zn.): Zapisnik stanja
- `TRADE.fleet.features.5.text` (64 zn.): Detaljan pregled opreme i zatečenog stanja prije početka radova.
- `TRADE.fleet.jobs.1` (23 zn.): Preventivni servis PM-A
- `TRADE.fleet.jobs.2` (21 zn.): Prošireni servis PM-B
- `TRADE.fleet.jobs.3` (32 zn.): Terenska dijagnostika i popravak
- `TRADE.fleet.jobs.4` (36 zn.): Priprema teretnog vozila za tehnički
- `TRADE.fleet.jobs.5` (34 zn.): Pregled kočionog sustava prikolice
- `TRADE.fleet.jobs.6` (33 zn.): Zamjena obloga kočnica po osovini
- `TRADE.fleet.jobs.7` (39 zn.): Redoviti servis radnog stroja (250 mth)
- `TRADE.fleet.jobs.8` (37 zn.): Izrada i zamjena hidrauličnog crijeva

#### Stranica zanata: moto (poslar.eu/zanat/motocikli)

- `TRADE.moto.eyebrow` (28 zn.): Motocikli, skuteri i quadovi
- `TRADE.moto.title` (61 zn.): Sezona kreće naglo. Ti stigneš sve prije prvog sunčanog dana.
- `TRADE.moto.subtitle` (98 zn.): Zaprimanje s potpisom, konzervacija za zimu i skladište motocikala. Jedan sustav za cijelu sezonu.
- `TRADE.moto.agent` (165 zn.): Prvi topli dan i telefon zvoni bez prestanka, svi žele dekonzervaciju odjednom. Poslar slaže termine po redu i otvara nalog s registracijom dok ti radiš na dizalici.
- `TRADE.moto.scene` (161 zn.): Preko zime garaža je puna motocikala na čuvanju. Skladišni modul ti točno pokazuje gdje je koji motocikl i u kojoj je fazi konzervacije, bez listanja bilježnice.
- `TRADE.moto.pains.1.q` (76 zn.): Vlasnik tvrdi da je ogrebotina na oklopu nastala kod tebe tijekom zimovanja?
- `TRADE.moto.pains.1.a` (91 zn.): Prijemni zapisnik ima fotografije zatečenog stanja i digitalni potpis klijenta pri predaji.
- `TRADE.moto.pains.2.q` (57 zn.): Gubiš vrijeme tražeći gdje je u garaži odloženi motocikl?
- `TRADE.moto.pains.2.a` (78 zn.): Skladišni modul povezuje registraciju s točnim mjestom i trenutnom fazom rada.
- `TRADE.moto.pains.3.q` (75 zn.): Kupac polovnog motocikla traži dokaz da je lanac i vilica servisirana lani?
- `TRADE.moto.pains.3.a` (76 zn.): Kompletan karton vozila vodi se po VIN-u i kilometraži, pretraživ u sekundi.
- `TRADE.moto.features.1.title` (17 zn.): Prijemni zapisnik
- `TRADE.moto.features.1.text` (68 zn.): Evidencija oklopa i prateće opreme uz fotografije i potpis klijenta.
- `TRADE.moto.features.2.title` (29 zn.): Konzervacija i dekonzervacija
- `TRADE.moto.features.2.text` (70 zn.): Unaprijed definirane kontrolne liste radova za zimski i ljetni period.
- `TRADE.moto.features.3.title` (22 zn.): Upravljanje skladištem
- `TRADE.moto.features.3.text` (61 zn.): Evidencija smještaja svakog motocikla u garaži ili zimovniku.
- `TRADE.moto.features.4.title` (13 zn.): Karton vozila
- `TRADE.moto.features.4.text` (49 zn.): Pretraga po VIN-u, serijskom broju i kilometraži.
- `TRADE.moto.features.5.title` (21 zn.): Prilagođeni normativi
- `TRADE.moto.features.5.text` (63 zn.): Pripremljeni radni zadaci za lanac, kočnice, vilicu i variomat.
- `TRADE.moto.jobs.1` (21 zn.): Mali servis motocikla
- `TRADE.moto.jobs.2` (23 zn.): Veliki servis motocikla
- `TRADE.moto.jobs.3` (20 zn.): Konzervacija za zimu
- `TRADE.moto.jobs.4` (30 zn.): Dekonzervacija i probna vožnja
- `TRADE.moto.jobs.5` (25 zn.): Zamjena lanca i zupčanika
- `TRADE.moto.jobs.6` (29 zn.): Servis prednje ovjesne vilice
- `TRADE.moto.jobs.7` (24 zn.): Zamjena kočionih pločica
- `TRADE.moto.jobs.8` (25 zn.): Servis variomata i remena

#### Stranica zanata: marine (poslar.eu/zanat/nautika)

- `TRADE.marine.eyebrow` (49 zn.): Plovila, jet-skiji, vanbrodski i unutarnji motori
- `TRADE.marine.title` (52 zn.): Zimovanje bez papirnatog kaosa. Proljeće bez stresa.
- `TRADE.marine.subtitle` (106 zn.): Zaprimanje s potpisom, konzervacija motora i vođenje zimovnika. Za plovila, jet-skije i vanbrodske motore.
- `TRADE.marine.agent` (148 zn.): S prvim sunčanim danima u ožujku svi klijenti zovu u isto vrijeme radi dekonzervacije. Poslar samostalno slaže termine i organizira kalendar radova.
- `TRADE.marine.scene` (156 zn.): Tijekom zimskih mjeseci poslovanje je pod potpunom kontrolom. Skladišni modul točno prikazuje gdje je smješteno koje plovilo i u kojoj je fazi konzervacije.
- `TRADE.marine.pains.1.q` (66 zn.): Vlasnik tvrdi da je ogrebotina na trupu nastala tijekom zimovanja?
- `TRADE.marine.pains.1.a` (94 zn.): Prijemni zapisnik sadrži fotografije zatečenog stanja i digitalni potpis klijenta pri predaji.
- `TRADE.marine.pains.2.q` (74 zn.): Gubiš vrijeme tražeći gdje se u zimovniku nalazi skinuti vanbrodski motor?
- `TRADE.marine.pains.2.a` (75 zn.): Skladišni modul povezuje serijski broj motora s točnim mjestom u skladištu.
- `TRADE.marine.pains.3.q` (59 zn.): Kada je na plovilu zadnji put mijenjan impeler ili cinkovi?
- `TRADE.marine.pains.3.a` (78 zn.): Kompletan karton motora vodi se po HIN broju, serijskom broju i radnim satima.
- `TRADE.marine.features.1.title` (17 zn.): Prijemni zapisnik
- `TRADE.marine.features.1.text` (67 zn.): Detaljna evidencija trupa i prateće opreme uz fotografije i potpis.
- `TRADE.marine.features.2.title` (29 zn.): Konzervacija i dekonzervacija
- `TRADE.marine.features.2.text` (70 zn.): Unaprijed definirane kontrolne liste radova za zimski i ljetni period.
- `TRADE.marine.features.3.title` (15 zn.): Nautički karton
- `TRADE.marine.features.3.text` (59 zn.): Pretraga po HIN broju, serijskom broju motora i motosatima.
- `TRADE.marine.features.4.title` (22 zn.): Upravljanje zimovnikom
- `TRADE.marine.features.4.text` (61 zn.): Evidencija smještaja plovila, jet-skija i vanbrodskih motora.
- `TRADE.marine.features.5.title` (21 zn.): Prilagođeni normativi
- `TRADE.marine.features.5.text` (70 zn.): Pripremljeni radni zadaci za impeler, anode i antivegetativnu zaštitu.
- `TRADE.marine.jobs.1` (31 zn.): Konzervacija vanbrodskog motora
- `TRADE.marine.jobs.2` (26 zn.): Dekonzervacija i test rada
- `TRADE.marine.jobs.3` (22 zn.): Konzervacija jet-skija
- `TRADE.marine.jobs.4` (34 zn.): Godišnji servis vanbrodskog motora
- `TRADE.marine.jobs.5` (29 zn.): Zamjena impelera i pumpe vode
- `TRADE.marine.jobs.6` (13 zn.): Zamjena anoda
- `TRADE.marine.jobs.7` (34 zn.): Nanošenje antivegetativnog premaza
- `TRADE.marine.jobs.8` (38 zn.): Prijem i pregled trupa prije zimovanja

#### Stranica zanata: air (poslar.eu/zanat/klima-serviser)

- `TRADE.air.eyebrow` (55 zn.): Klima uređaji, dizalice topline i ventilacijski sustavi
- `TRADE.air.title` (56 zn.): Ti montiraš na terenu. Poslar puni tvoj dnevni raspored.
- `TRADE.air.subtitle` (81 zn.): Raspored rada, evidencija F-plinova i slikovni izvještaji. Sve dostupno s terena.
- `TRADE.air.agent` (152 zn.): U srpnju na +35 °C telefon zvoni bez prestanka. Poslar preuzima pozive, bilježi adresu, provjerava lokacije i ugovara termine prema tvom planu kretanja.
- `TRADE.air.scene` (163 zn.): Više terenskih timova radi na terenu. Svaki monter na mobitelu ima svoj dnevni raspored i navigaciju. Ti iz ureda ili vozila pratiš završene izvještaje sa slikama.
- `TRADE.air.pains.1.q` (62 zn.): Koliko je radnog medija dopunjeno u sustav na prošlom servisu?
- `TRADE.air.pains.1.a` (85 zn.): Karton opreme automatski bilježi F-plinove i ispitivanja propusnosti uz svaki uređaj.
- `TRADE.air.pains.2.q` (63 zn.): Vlasnik objekta nije bio prisutan tijekom radova i traži dokaz?
- `TRADE.air.pains.2.a` (94 zn.): Slikovni izvještaj sa satnicom i GPS lokacijom šalje se izravno na njegov e-mail ili WhatsApp.
- `TRADE.air.pains.3.q` (65 zn.): Ne stigneš ručno voditi evidenciju o dospijeću godišnjih servisa?
- `TRADE.air.pains.3.a` (81 zn.): Sustav sam prepoznaje objekte kojima se bliži rok servisa i priprema podsjetnike.
- `TRADE.air.features.1.title` (23 zn.): Pametni dnevni raspored
- `TRADE.air.features.1.text` (88 zn.): Ugrađena navigacija i slanje automatske obavijesti klijentu „Na putu sam” jednim klikom.
- `TRADE.air.features.2.title` (27 zn.): Terenski slikovni izvještaj
- `TRADE.air.features.2.text` (72 zn.): Izrada izvještaja s fotografijama prije i poslije čišćenja ili ugradnje.
- `TRADE.air.features.3.title` (20 zn.): Evidencija F-plinova
- `TRADE.air.features.3.text` (64 zn.): Vođenje baze radnih medija i evidencije provjere zabrtvljenosti.
- `TRADE.air.features.4.title` (31 zn.): Automatski godišnji podsjetnici
- `TRADE.air.features.4.text` (58 zn.): Pravovremeno obavještavanje klijenata o redovitom servisu.
- `TRADE.air.features.5.title` (29 zn.): Podrška za kompleksne sustave
- `TRADE.air.features.5.text` (71 zn.): Kartoni za split sustave, multi-split, dizalice topline i rekuperatore.
- `TRADE.air.jobs.1` (30 zn.): Redoviti godišnji servis klime
- `TRADE.air.jobs.2` (31 zn.): Montaža split sustava do 3,5 kW
- `TRADE.air.jobs.3` (28 zn.): Dopuna rashladnog medija R32
- `TRADE.air.jobs.4` (35 zn.): Tlačna proba i provjera propusnosti
- `TRADE.air.jobs.5` (41 zn.): Dubinsko kemijsko čišćenje i dezinfekcija
- `TRADE.air.jobs.6` (38 zn.): Dijagnostika i servis dizalice topline
- `TRADE.air.jobs.7` (26 zn.): Servis multi-split sustava
- `TRADE.air.jobs.8` (30 zn.): Čišćenje i servis rekuperatora

#### Stranica zanata: aqua (poslar.eu/zanat/vodoinstalater)

- `TRADE.aqua.eyebrow` (55 zn.): Vodoinstalacije, grijanje, bojleri i hitne intervencije
- `TRADE.aqua.title` (49 zn.): Curi voda? Poslar odmah daje prvu uputu klijentu.
- `TRADE.aqua.subtitle` (82 zn.): Hitni pozivi, tlačne probe i servisi bojlera. Potpuna organizacija terenskog rada.
- `TRADE.aqua.agent` (158 zn.): Klijent zove u panici zbog puknuća cijevi. Poslar ga smireno uputi kako zatvoriti glavni ventil, prikupi adresu i odmah ti otvara nalog za hitnu intervenciju.
- `TRADE.aqua.scene` (161 zn.): Pomoćnik samostalno izvodi tlačnu probu cjevovoda. Preko aplikacije fotografira manometar i generira službeni zapisnik bez potrebe za naknadnim pisanjem u uredu.
- `TRADE.aqua.pains.1.q` (79 zn.): Zaboraviš kad je na kojem objektu potrebno zamijeniti zaštitnu anodu u bojleru?
- `TRADE.aqua.pains.1.a` (68 zn.): Sustav vodi bazu ugrađenih uređaja i upozorava na dospijeće servisa.
- `TRADE.aqua.pains.2.q` (70 zn.): Investitor ili nadzorni inženjer traži službeni zapisnik tlačne probe?
- `TRADE.aqua.pains.2.a` (92 zn.): Generiraj digitalni zapisnik s fotografijom manometra i parametrima tlaka spreman za slanje.
- `TRADE.aqua.pains.3.q` (79 zn.): Dolaziš na objekt i ne znaš gdje se nalazi glavni ventil ili specifični vodovi?
- `TRADE.aqua.pains.3.a` (90 zn.): Napomene o pristupu i fotografije izvedenog stanja pod žbukom vezane su uz adresu objekta.
- `TRADE.aqua.features.1.title` (21 zn.): Zapisnik tlačne probe
- `TRADE.aqua.features.1.text` (82 zn.): Automatska izrada dokumenta s fotografijom manometra i početnim i završnim tlakom.
- `TRADE.aqua.features.2.title` (24 zn.): Protokol za hitne pozive
- `TRADE.aqua.features.2.text` (70 zn.): Automatsko slanje osnovnih uputa klijentu u slučaju poplave ili kvara.
- `TRADE.aqua.features.3.title` (24 zn.): Karton objekta i uređaja
- `TRADE.aqua.features.3.text` (76 zn.): Pohrana podataka o instalacijama, bojlerima, kotlovima i pristupnim šiframa.
- `TRADE.aqua.features.4.title` (24 zn.): Planer redovitih servisa
- `TRADE.aqua.features.4.text` (54 zn.): Pravovremeno zakazivanje servisa bojlera i kotlovnica.
- `TRADE.aqua.features.5.title` (19 zn.): Terenska navigacija
- `TRADE.aqua.features.5.text` (60 zn.): Brzo pokretanje rute i slanje obavijesti klijentu o dolasku.
- `TRADE.aqua.jobs.1` (29 zn.): Detekcija i lociranje curenja
- `TRADE.aqua.jobs.2` (48 zn.): Redoviti servis plinskog ili električnog bojlera
- `TRADE.aqua.jobs.3` (15 zn.): Zamjena bojlera
- `TRADE.aqua.jobs.4` (21 zn.): Servis plinskog kotla
- `TRADE.aqua.jobs.5` (31 zn.): Popravak ugradbenog vodokotlića
- `TRADE.aqua.jobs.6` (29 zn.): Zamjena mješalice ili slavine
- `TRADE.aqua.jobs.7` (22 zn.): Tlačna proba cjevovoda
- `TRADE.aqua.jobs.8` (44 zn.): Odzračivanje i balansiranje sustava grijanja

#### Stranica zanata: tow (poslar.eu/zanat/vucna-sluzba)

- `TRADE.tow.eyebrow` (41 zn.): Vuča vozila, asistencija i pomoć na cesti
- `TRADE.tow.title` (60 zn.): Poziv u tri ujutro. Lokacija i navigacija spremni u sekundi.
- `TRADE.tow.subtitle` (87 zn.): Brzo preuzimanje lokacije, fotografije pri utovaru, obračun kilometara i vođenje depoa.
- `TRADE.tow.agent` (162 zn.): Dok voziš ili spavaš, Poslar preuzima poziv vozača u kvaru, zabilježi točnu GPS lokaciju, marku vozila i broj predmeta asistencije te ti priprema rute za polazak.
- `TRADE.tow.scene` (175 zn.): Noćna smjena odrađuje intervenciju. Vozač vučnog vozila ima sve podatke i fotografije utovarenog vozila na mobitelu, dok ured ima uvid u status intervencije u realnom vremenu.
- `TRADE.tow.pains.1.q` (86 zn.): Kako se zaštititi od lažnih tvrdnji da je oštećenje na vozilu nastalo tijekom utovara?
- `TRADE.tow.pains.1.a` (91 zn.): Obavezni foto-zapisnik s vremenskom oznakom prije podizanja na navoz rješava sve prigovore.
- `TRADE.tow.pains.2.q` (84 zn.): Osiguravajuća kuća ili asistencija traži detaljan izvještaj o vremenu i kilometraži?
- `TRADE.tow.pains.2.a` (89 zn.): Svi koraci (polazak, dolazak, utovar, dostava) bilježe se automatski i slažu u izvještaj.
- `TRADE.tow.pains.3.q` (65 zn.): Zaboraviš koliko je dana pojedino vozilo smješteno na tvom depou?
- `TRADE.tow.pains.3.a` (75 zn.): Automatski brojač dana na depou samostalno obračunava točan iznos ležarine.
- `TRADE.tow.features.1.title` (22 zn.): Sustav za hitne pozive
- `TRADE.tow.features.1.text` (79 zn.): Preuzimanje točne lokacije pozivatelja i pokretanje navigacije u jednom dodiru.
- `TRADE.tow.features.2.title` (25 zn.): Slikovni zapisnik utovara
- `TRADE.tow.features.2.text` (72 zn.): Brzo fotografiranje stanja vozila prije podizanja radi zaštite od šteta.
- `TRADE.tow.features.3.title` (28 zn.): Praćenje koraka intervencije
- `TRADE.tow.features.3.text` (63 zn.): Zapis vremena polaska, dolaska na lokaciju, utovara i istovara.
- `TRADE.tow.features.4.title` (25 zn.): Izvještaji za asistencije
- `TRADE.tow.features.4.text` (73 zn.): Automatska priprema podataka s brojem predmeta, kilometražom i ležarinom.
- `TRADE.tow.features.5.title` (18 zn.): Upravljanje depoom
- `TRADE.tow.features.5.text` (60 zn.): Pregled parkiranih vozila i brojač dana za obračun ležarine.
- `TRADE.tow.jobs.1` (23 zn.): Gradski prijevoz vozila
- `TRADE.tow.jobs.2` (16 zn.): Međugradska vuča
- `TRADE.tow.jobs.3` (35 zn.): Terenska asistencija i dovoz goriva
- `TRADE.tow.jobs.4` (26 zn.): Izvlačenje vozila s terena
- `TRADE.tow.jobs.5` (27 zn.): Ležarina na depou (po danu)
- `TRADE.tow.jobs.6` (22 zn.): Rad noću ili blagdanom
- `TRADE.tow.jobs.7` (35 zn.): Utovar vozila s blokiranim kotačima
- `TRADE.tow.jobs.8` (24 zn.): Prijevoz radnih strojeva

#### Stranica zanata: deal (poslar.eu/zanat/auto-plac)

- `TRADE.deal.eyebrow` (42 zn.): Otkup, priprema i prodaja rabljenih vozila
- `TRADE.deal.title` (57 zn.): Svaki auto na placu: dani, uloženi trošak i čista zarada.
- `TRADE.deal.subtitle` (84 zn.): Od otkupa do prodaje. Potpuni financijski pregled ulaganja u svako vozilo na lageru.
- `TRADE.deal.agent` (160 zn.): Kupac zove kasno navečer za auto iz oglasa. Poslar provjerava je li vozilo slobodno ili rezervirano, daje osnovne informacije i ugovara termin za razgledavanje.
- `TRADE.deal.scene` (182 zn.): Vodiš jedan ili više auto placeva. U svakom trenutku na mobitelu vidiš koliko dana pojedini auto stoji na skladištu, koliko je uloženo u njegovu pripremu i kolika je očekivana marža.
- `TRADE.deal.pains.1.q` (76 zn.): Auto stoji na placu 90 dana, a nemaš točan pregled koliko te do sada koštao?
- `TRADE.deal.pains.1.a` (95 zn.): Svako vozilo ima svoju karticu u koju ulaze nabavna cijena, svi dijelovi, poliranje i popravci.
- `TRADE.deal.pains.2.q` (96 zn.): Netko ode na probnu vožnju, a ti nemaš zabilježeno tko je upravljao vozilom u slučaju prekršaja?
- `TRADE.deal.pains.2.a` (85 zn.): Digitalni zapisnik probne vožnje sa slikom vozačke dozvole izrađuje se u par sekundi.
- `TRADE.deal.pains.3.q` (80 zn.): Krivo procijeniš zaradu jer nisi uračunao sitne troškove pripreme prije prodaje?
- `TRADE.deal.pains.3.a` (102 zn.): Sustav automatski oduzima sve troškove servisa i ulaganja od prodajne cijene i prikazuje čistu zaradu.
- `TRADE.deal.features.1.title` (25 zn.): Financijski karton vozila
- `TRADE.deal.features.1.text` (80 zn.): Praćenje broja dana na lageru, nabavne cijene i svih dodatnih troškova pripreme.
- `TRADE.deal.features.2.title` (20 zn.): Interni radni nalozi
- `TRADE.deal.features.2.text` (99 zn.): Otvaranje naloga za vlastitu radionicu ili vanjske partnere (servis, poliranje, kemijsko čišćenje).
- `TRADE.deal.features.3.title` (22 zn.): Zapisnik probne vožnje
- `TRADE.deal.features.3.text` (61 zn.): Slikanje dokumenta vozača i evidencija vremena probne vožnje.
- `TRADE.deal.features.4.title` (13 zn.): Status vozila
- `TRADE.deal.features.4.text` (68 zn.): Pregled slobodnih, rezerviranih i prodanih vozila u realnom vremenu.
- `TRADE.deal.features.5.title` (28 zn.): Zaštićeni financijski podaci
- `TRADE.deal.features.5.text` (67 zn.): Izračun čiste zarade i marže vidljiv je isključivo vlasniku računa.
- `TRADE.deal.jobs.1` (32 zn.): Ulazni pregled vozila pri otkupu
- `TRADE.deal.jobs.2` (29 zn.): Pripremni servis pred prodaju
- `TRADE.deal.jobs.3` (29 zn.): Kemijsko čišćenje i poliranje
- `TRADE.deal.jobs.4` (28 zn.): Zamjena seta guma za prodaju
- `TRADE.deal.jobs.5` (38 zn.): Priprema dokumentacije za registraciju
- `TRADE.deal.jobs.6` (38 zn.): Otklanjanje sitnih limarskih oštećenja
- `TRADE.deal.jobs.7` (19 zn.): Zamjena akumulatora
- `TRADE.deal.jobs.8` (28 zn.): Ispitivanje i punjenje klime

### 8b. Zanati u aplikaciji

Nazivi i kratki opisi zanata. Ispod svakog zanata su i podaci iz aplikacije, samo da bolje razumiješ zanat.

#### Zanat: Automehaničar (gear)

- `PAKET.gear.short` (13 zn.): Automehaničar
- `PAKET.gear.tagline` (26 zn.): Automehanika i opći servis   [opis zanata: Google i Demo centar]
- `PAKET.gear.modulePage` (13 zn.): Servisni plan   [naziv stranice zanata u izborniku aplikacije]
- `PAKET.gear.moduleTab` (17 zn.): Servis i dijelovi   [naziv kartice zanata na nalogu]

Samo za razumijevanje zanata (u aplikaciji, ne prepravljati):

- Simptomi pri prijemu: Redovni servis; Kočnice škripe / slabo koče; Lupa ovjes; Curi ulje ili tekućina; Lampica motora; Klima ne hladi; Priprema za tehnički; Zamjena guma
- Gotovi poslovi u aplikaciji: Mali servis; Veliki servis; Remen razvoda komplet; Kočnice naprijed; Kočnice straga; Klima servis; Kvačilo; Priprema za tehnički; Amortizeri naprijed; Rame ovjesa; Kraj spone; Pomoćni remen; Vodena pumpa; Ispušni lonac; Kočiona tekućina; Rashladna tekućina; Svjećice; Ulje mjenjača
- Kontrolne liste: Inspekcija u 50 točaka; Završna kontrola
- Oprema koja se bilježi: Ključevi; Dokumenti vozila; Servisna knjižica; Rezervni kotač

#### Zanat: Autoelektričar (volt)

- `PAKET.volt.short` (14 zn.): Autoelektričar
- `PAKET.volt.tagline` (41 zn.): Autoelektrika, dijagnostika i elektronika   [opis zanata: Google i Demo centar]
- `PAKET.volt.modulePage` (18 zn.): Kodovi i slučajevi   [naziv stranice zanata u izborniku aplikacije]
- `PAKET.volt.moduleTab` (12 zn.): Dijagnostika   [naziv kartice zanata na nalogu]

Samo za razumijevanje zanata (u aplikaciji, ne prepravljati):

- Simptomi pri prijemu: Akumulator se prazni; Ne pali / verglanje; Lampica na armaturi; Ne puni (alternator); Svjetla ili signalizacija; Podizači, centralno, komfor; Ključ / imobilizator; Klima ne radi; Naknadna ugradnja opreme
- Gotovi poslovi u aplikaciji: Dijagnostika elektrike; Test akumulatora i punjenja; Mjerenje parazitske potrošnje; Programiranje ključa; Kodiranje / adaptacija modula; Zamjena akumulatora; Zamjena alternatora; Zamjena anlasera; Zamjena grijača; Žarulje i svjetla; Podešavanje svjetala; Popravak instalacije; Podizač stakla; Centralno zaključavanje; Parking senzori
- Kontrolne liste: Dijagnostički protokol; Prije zapisa u modul; Parazitska potrošnja
- Oprema koja se bilježi: Ključevi; Daljinski; Dokumenti vozila; Punjač / kabel

#### Zanat: Limar i lakirer (body)

- `PAKET.body.short` (15 zn.): Limar i lakirer
- `PAKET.body.tagline` (40 zn.): Autolimarija, lakirnica i procjena štete   [opis zanata: Google i Demo centar]
- `PAKET.body.modulePage` (11 zn.): Proizvodnja   [naziv stranice zanata u izborniku aplikacije]
- `PAKET.body.moduleTab` (15 zn.): Oštećenja i lak   [naziv kartice zanata na nalogu]

Samo za razumijevanje zanata (u aplikaciji, ne prepravljati):

- Simptomi pri prijemu: Sudar; Parkiranje; Tuča; Divljač; Vandalizam; Korozija; Poliranje / zaštita
- Gotovi poslovi u aplikaciji: Poliranje vozila; PDR: udubljenje bez lakiranja; Lakiranje jednog dijela; Popravak branika; Lakiranje branika; Popravak i lakiranje vrata; Zamjena blatobrana; Ogrebotina (spot repair); Vjetrobransko staklo; Poliranje farova; Sanacija hrđe; Keramička zaštita; Retrovizor
- Kontrolne liste: Prije lakiranja; Završna kontrola
- Oprema koja se bilježi: Ključevi; Dokumenti vozila; Europsko izvješće o nezgodi; Polica osiguranja

#### Zanat: Vulkanizer (wheel)

- `PAKET.wheel.short` (10 zn.): Vulkanizer
- `PAKET.wheel.tagline` (39 zn.): Vulkanizeri, geometrija i hotel za gume   [opis zanata: Google i Demo centar]
- `PAKET.wheel.modulePage` (13 zn.): Hotel za gume   [naziv stranice zanata u izborniku aplikacije]
- `PAKET.wheel.moduleTab` (12 zn.): Gume i hotel   [naziv kartice zanata na nalogu]

Samo za razumijevanje zanata (u aplikaciji, ne prepravljati):

- Simptomi pri prijemu: Sezonska zamjena; Balansiranje; Krpanje gume; Geometrija; Nove gume; Vibracije u volanu; Vuče u stranu
- Gotovi poslovi u aplikaciji: Sezonska zamjena; Balansiranje 4 kotača; Krpanje gume; Geometrija; Čuvanje guma (sezona); Nove gume (4); Sezonska zamjena SUV / kombi; TPMS senzor; Ventili; Ravnanje felge; Popravak alu felge; Niskoprofilne / run-flat gume; Guma motocikla; Punjenje dušikom; Zbrinjavanje starih guma
- Kontrolne liste: Zaprimanje na čuvanje; Sezonska zamjena
- Oprema koja se bilježi: Ključ sigurnosnih vijaka; Kapice; Rezervni kotač

#### Zanat: Kamioni i strojevi (fleet)

- `PAKET.fleet.short` (18 zn.): Kamioni i strojevi
- `PAKET.fleet.tagline` (34 zn.): Teretni program, građevina i flote   [opis zanata: Google i Demo centar]
- `PAKET.fleet.modulePage` (17 zn.): Rokovi i zahtjevi   [naziv stranice zanata u izborniku aplikacije]
- `PAKET.fleet.moduleTab` (13 zn.): Flota i teren   [naziv kartice zanata na nalogu]

Samo za razumijevanje zanata (u aplikaciji, ne prepravljati):

- Simptomi pri prijemu: Planski servis (PM); Vozilo stoji; Kočnice / zrak; Hidraulika; Elektrika; Tahograf; Tehnički pregled; Terenska intervencija
- Gotovi poslovi u aplikaciji: PM-A; Terenska intervencija; Priprema za tehnički; Pregled prikolice; PM-B; Kočnice jedne osovine; Tahograf; AdBlue sustav; Sušač zraka; Guma kamiona; Svjetla prikolice; Podmazivanje; Servis radnog stroja (250 mth); Hidraulična cijev
- Kontrolne liste: Dnevni pregled vozača; PM-A; Priključak / prikolica
- Oprema koja se bilježi: Ključevi; Kartica tahografa; Dokumenti vozila; Vatrogasni aparat; Trokut i prva pomoć

#### Zanat: Moto (moto)

- `PAKET.moto.short` (4 zn.): Moto
- `PAKET.moto.tagline` (28 zn.): Motocikli, skuteri i quadovi   [opis zanata: Google i Demo centar]
- `PAKET.moto.modulePage` (9 zn.): Skladište   [naziv stranice zanata u izborniku aplikacije]
- `PAKET.moto.moduleTab` (18 zn.): Sezona i skladište   [naziv kartice zanata na nalogu]

Samo za razumijevanje zanata (u aplikaciji, ne prepravljati):

- Simptomi pri prijemu: Redovni servis; Konzervacija (zimovanje); Dekonzervacija; Ne pali; Gubi snagu; Pregrijava se; Električni kvar; Skladištenje
- Gotovi poslovi u aplikaciji: Mali servis motocikla; Konzervacija motocikla; Dekonzervacija motocikla; Veliki servis motocikla; Lanac i zupčanici; Kočione pločice; Servis prednje vilice; Guma motocikla; Akumulator motocikla; Servis variomata (skuter)
- Kontrolne liste: Konzervacija motocikla; Dekonzervacija
- Oprema koja se bilježi: Kaciga; Bočni kofer; Top case; Ključ; Daljinski alarma; Punjač / održavač; Cerada; Prekidač za slučaj pada

#### Zanat: Nautika (marine)

- `PAKET.marine.short` (7 zn.): Nautika
- `PAKET.marine.tagline` (38 zn.): Plovila, vanbrodski i unutarnji motori   [opis zanata: Google i Demo centar]
- `PAKET.marine.modulePage` (9 zn.): Skladište   [naziv stranice zanata u izborniku aplikacije]
- `PAKET.marine.moduleTab` (16 zn.): Sezona i plovilo   [naziv kartice zanata na nalogu]

Samo za razumijevanje zanata (u aplikaciji, ne prepravljati):

- Simptomi pri prijemu: Redovni servis; Konzervacija (zimovanje); Dekonzervacija; Ne pali; Gubi snagu; Pregrijava se; Električni kvar; Skladištenje
- Gotovi poslovi u aplikaciji: Konzervacija vanbrodskog motora; Dekonzervacija; Konzervacija jet-skija; Godišnji servis vanbrodskog motora; Impeler; Antivegetativna zaštita; Zamjena anoda
- Kontrolne liste: Konzervacija vanbrodskog motora; Dekonzervacija
- Oprema koja se bilježi: Ključ; Daljinski alarma; Punjač / održavač; Cerada; Prsluk za spašavanje; Sidro; Prekidač za slučaj pada

#### Zanat: Klima serviser (air)

- `PAKET.air.short` (14 zn.): Klima serviser
- `PAKET.air.tagline` (47 zn.): Klime, dizalice topline i ventilacija na terenu   [opis zanata: Google i Demo centar]
- `PAKET.air.modulePage` (16 zn.): Servisni planovi   [naziv stranice zanata u izborniku aplikacije]
- `PAKET.air.moduleTab` (15 zn.): Uređaj i F-plin   [naziv kartice zanata na nalogu]

Samo za razumijevanje zanata (u aplikaciji, ne prepravljati):

- Simptomi pri prijemu: Godišnji servis; Slabo hladi; Ne grije; Curi voda; Neugodan miris; Greška na displeju; Buka ili vibracije; Ne pali; Montaža novog uređaja
- Gotovi poslovi u aplikaciji: Godišnji servis klime (1 unutarnja); Dodatna unutarnja jedinica; Izlazak na teren; Dopuna plina R32; Montaža klime do 3,5 kW; Servis dizalice topline; Provjera propuštanja (F-plin); Servis multi-split (do 3 unutarnje); Dubinsko čišćenje unutarnje jedinice; Odčepljenje odvoda kondenzata; Demontaža s povratom plina; Premještanje klime; Montaža klime od 5 do 7 kW; Pumpa kondenzata; Elektronika unutarnje jedinice; Motor ventilatora; Servis rekuperatora
- Kontrolne liste: Godišnji servis klima uređaja; Montaža i puštanje u rad; Servis dizalice topline; Provjera propuštanja (F-plin)

#### Zanat: Vodoinstalater (aqua)

- `PAKET.aqua.short` (14 zn.): Vodoinstalater
- `PAKET.aqua.tagline` (45 zn.): Vodoinstalacije, bojleri i grijanje na terenu   [opis zanata: Google i Demo centar]
- `PAKET.aqua.modulePage` (16 zn.): Servisni planovi   [naziv stranice zanata u izborniku aplikacije]
- `PAKET.aqua.moduleTab` (21 zn.): Uređaj i tlačna proba   [naziv kartice zanata na nalogu]

Samo za razumijevanje zanata (u aplikaciji, ne prepravljati):

- Simptomi pri prijemu: Curi voda; Začepljen odvod; Bojler ne grije; Servis bojlera; Servis plinskog kotla; Pao tlak u grijanju; WC kotlić curi; Zamjena slavine; Nova instalacija
- Gotovi poslovi u aplikaciji: Izlazak na intervenciju; Hitno noću ili vikendom; Sat rada; Traženje curenja; Servis bojlera; Zamjena bojlera; Servis plinskog kotla; Odčepljenje odvoda; Popravak WC kotlića; Zamjena mješalice; Tlačna proba; Odzračivanje grijanja
- Kontrolne liste: Servis bojlera; Servis plinskog kotla; Traženje curenja; Završetak radova

#### Zanat: Vučna služba (tow)

- `PAKET.tow.short` (12 zn.): Vučna služba
- `PAKET.tow.tagline` (28 zn.): Vuča vozila i pomoć na cesti   [opis zanata: Google i Demo centar]
- `PAKET.tow.modulePage` (13 zn.): Pozivi i plac   [naziv stranice zanata u izborniku aplikacije]
- `PAKET.tow.moduleTab` (12 zn.): Poziv i vuča   [naziv kartice zanata na nalogu]

Samo za razumijevanje zanata (u aplikaciji, ne prepravljati):

- Simptomi pri prijemu: Ne pali; Prometna nezgoda; Pukla guma; Prazan akumulator; Nestalo goriva; Ključevi zaključani u vozilu; Izvlačenje iz jarka; Prijevoz vozila; Premještanje vozila (pauk)
- Gotovi poslovi u aplikaciji: Vuča u gradu; Vuča izvan grada; Vuča s autoceste; Pokretanje vozila; Zamjena kotača na cesti; Otključavanje vozila; Dovoz goriva; Izvlačenje vitlom; Čekanje na mjestu; Noćni ili vikend dodatak; Ležarina
- Kontrolne liste: Preuzimanje vozila; Predaja vozila
- Oprema koja se bilježi: Ključevi; Prometna dozvola; Rezervni kotač; Stvari u vozilu

#### Zanat: Auto plac (deal)

- `PAKET.deal.short` (9 zn.): Auto plac
- `PAKET.deal.tagline` (42 zn.): Otkup, priprema i prodaja rabljenih vozila   [opis zanata: Google i Demo centar]
- `PAKET.deal.modulePage` (17 zn.): Vozila na prodaju   [naziv stranice zanata u izborniku aplikacije]
- `PAKET.deal.moduleTab` (15 zn.): Otkup i prodaja   [naziv kartice zanata na nalogu]

Samo za razumijevanje zanata (u aplikaciji, ne prepravljati):

- Simptomi pri prijemu: Otkup od privatne osobe; Staro za novo; Uvoz; Servis prije prodaje; Poliranje i čišćenje; Popravak limarije; Priprema za tehnički; Slikanje za oglas
- Gotovi poslovi u aplikaciji: Pregled pri otkupu; Servis prije prodaje; Dubinsko čišćenje i poliranje; Slikanje i oglas; Tehnički pregled; Registracija; Komplet guma; Kočnice naprijed; Udubljenje bez lakiranja; Lakiranje elementa; Prijevoz vozila
- Kontrolne liste: Pregled pri otkupu; Spremno za prodaju
- Oprema koja se bilježi: Ključevi; Prometna dozvola; Servisna knjižica; Rezervni kotač; Druge gume

### 8c. Ostale stranice

#### Otvoreni demo (/isprobaj)

- `PAGE.isprobaj.title` (21 zn.): Isprobaj demo verziju
- `PAGE.isprobaj.subtitle` (102 zn.): Radionica puna primjera iz tvoje struke. Bez prijave i bez lozinke. Demo traje 24 sata, onda se briše.
- `PAGE.isprobaj.pick` (20 zn.): Odaberi svoju struku
- `PAGE.isprobaj.note` (63 zn.): Podaci u demu su izmišljeni. Ne upisuj prave podatke mušterija.

#### Registracija (/register)

- `PAGE.register.title` (33 zn.): Isprobaj Poslar 30 dana besplatno
- `PAGE.register.subtitle` (79 zn.): Otvori svoju radionicu i odmah radi na pravim poslovima. Kartica nije potrebna.

#### Slogan

- `BRAND.tagline` (43 zn.): Manje administracije. Više odrađenog posla.   [slogan i opis za Google; promjenu predloži samo u dijelu A]

---

## 9. Format odgovora

Odgovori u dva dijela:

**Dio A: komentar** (najviše 15 redaka): najvažnije promjene i zašto, te prijedlozi koji nisu tekst
(npr. novi odjeljak, drugačiji redoslijed). Ne prepravljaj činjenice iz odjeljaka 2 do 5.

**Dio B: tekstovi**, u jednom bloku koda, samo promijenjeni tekstovi, svaki u svom retku:

```
OZNAKA: novi tekst
```

Primjer:

```
MAIN.title: Dok si pod autom, Poslar se javlja na telefon.
TRADE.gear.pains.1.a: Servisni plan pamti kilometre i datume. Podsjetnik šalješ jednim dodirom.
```

- Oznake prepiši točno kako pišu, bez navodnika i bez broja znakova.
- Ne izmišljaj nove oznake. Novi tekst za koji nema oznake opiši u dijelu A.
- Ako tekst treba maknuti, napiši `OZNAKA: (makni)`.
