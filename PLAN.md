# Poslar: plan rada po stadijima

Svaki stadij završava testovima, spremanjem (commit) i porukom Vedranu.
Deploy: `npx vercel deploy --prod` iz mape x-files-saas.

## Stadij 1: Hitni popravci (prije AI ključa)
- [x] Diktiranje: dijelovi izgovorenog se nižu (telefon, registracija, ime), ne brišu
- [x] Mikrofon u svim poljima gdje ima smisla (km, OIB, godište, VIN, adresa, polja u modulima)
- [x] Gumbi za slikanje uvijek vidljivi, kompaktni (ikona kamere); bez ključa kratka poruka
- [x] Bez dugih crtica (—) u tekstovima aplikacije
- [ ] Večeras: provjera pravog čitanja slika s ključem

## Stadij 2: TaktIX identitet (zamijenjen: Poslar, stadij 13)
- [x] Ime TaktiX, slogan „Manje administracije. Više odrađenog posla.”
- [x] Logo po Vedranovom nacrtu: metronom s narančastom strelicom, natpis TaktiX; nova ikona aplikacije (PWA)
- [x] Glavna boja svijetlo plava, grafitna pozadina, jasni rubovi kartica
- [x] Boje zanata: Volt žuta, Gear F1 crvena, Body petrolej, Wheel brončana, Fleet narančasta, Moto Kawasaki zelena, Air ledeno tirkizna
- [x] Ikone zanata: tamna pločica, svijetleći znak; naslovi u užem sportskom fontu

## Stadij 3: Prodajna početna stranica
- [x] Dvije grupe: Radionica (i Fleet) i Teren
- [ ] Fotografije iz rada: Vedran dodaje foto-1.jpg … foto-10.jpg u public/landing
- [x] Prave snimke aplikacije (naslov i 3 koraka), automatski iz dema
- [x] „Stari način / Tvoj način”
- [x] Probni prikaz bez registracije (izgovori kvar, vidi nalog, poruku i račun)
- [x] Cijene: Basic 30 €, Standard 50 €, Premium 90 € s PDV-om; 10 % popusta uz 24 mjeseca
- [x] Kraća registracija; gumb za instalaciju na mobitel

## Stadij 3b: Tri nova zanimanja
- [x] Aqua Files (vodoinstalater, Teren): tlačna proba sa zapisnikom, podaci bojlera i kotla, servisni planovi, bojleri sa starom anodom
- [x] Tow Files (vučna služba, nova grupa Cesta): poziv, tko plaća i broj slučaja, navigacija, koraci s vremenom i GPS-om, plac i ležarina
- [x] Deal Files (trgovac rabljenim vozilima, nova grupa Prodaja): otkup, oglas, rezervacija, prodaja, dani na placu, zarada samo za vlasnika, probne vožnje
- [x] Demo radionice za sva tri (Split, Karlovac, Osijek)
- [ ] Kasnije za Deal: kupoprodajni ugovor i račun po posebnom postupku (marža), uz knjigovođu

## Stadij 4: Toranj (Vedranova upravljačka ploča)
- [x] Radionice: paket, status, proba, plaćeno do, napomene, upis uplate, filtri, traženje
- [x] Podrška: „Javi problem” iz aplikacije, odgovori iz tornja, točka na Postavkama za novi odgovor
- [x] Greške: automatsko hvatanje grešaka iz preglednika, servera i spremanja
- [x] Analiza: prihod, radionice po paketu i zanatu, aktivnost, AI potrošnja, tko se gasi
- [x] Kvote za slikanje i Kopilot po paketu (Basic 150/100, Standard 300/200, Premium 600/400), broj radnika po paketu
- [x] Toranj otvoren za Vedranov račun (ulaz: /admin ili Postavke → Toranj)

## Stadij 5: Cjenik i predlošci
- [x] Postavke → Cjenik i predlošci: satnica, vlastita cijena na svakoj stavci predloška (samo vlasnik), skrivanje predložaka koje radionica ne radi, vraćanje izvornog
- [x] „Spremi kao predložak” iz naloga; ručni novi predložak
- [x] +10 najčešćih poslova za Volt, Gear, Body, Wheel, Fleet, Moto i Air (Aqua, Tow i Deal već imaju 11 do 12)
- [x] Cijene se primjenjuju i kad predložak doda radnik; nova stavka rada kreće od satnice

## Stadij 6: Arhiva u Poslovanju
- [x] Poslovanje → Arhiva (samo vlasnik): zatvoreni nalozi, razdoblje (i od do), plaćeno/neplaćeno, zbroj za odabir
- [x] Traženje: registracija (s razmacima ili bez), VIN, ime, telefon, OIB, broj naloga, broj računa (12/2026)
- [x] Iznos i broj računa na svakom nalogu; popis za Excel (CSV)
- [x] Gumb Arhiva na Nalozima vodi vlasnika u Poslovanje; radnici zadržavaju svoju arhivu bez iznosa

## Stadij 7: QR samoprijem (Standard i Premium)
- [x] Mušterija skenira QR, slika prometnu (ili upiše), dodirne čest kvar ili ga izgovori; nalog stiže u Prijem s oznakom „S vrata” i točkicom na Nalozima
- [x] Terenski zanati: umjesto registracije adresa, nalog na terenu s tom lokacijom
- [x] Zaštita od lažnih prijava: skriveno polje, najmanje vrijeme, ograničenje po uređaju i po radionici, isti telefon u 30 min je ista prijava, novi kod gasi stare plakate
- [x] Postavke → QR samoprijem: kod, uključivanje, novi kod, plakat A4 za ispis
- [x] Standard i Premium; na probi i u demu svi

## Stadij 8: Podsjetnici
- [x] Poslovanje → Podsjetnici (samo vlasnik), s brojem na kartici i obavijesti na Nalozima
- [x] Gume: 1. 10. do 15. 12. zimske, 1. 3. do 15. 5. ljetne; gume koje čuvamo i tko je lani mijenjao kod nas
- [x] Dospio servis: godinu dana od zadnjeg servisa (predložak ili tekst stavke), i po servisnom planu vozila
- [x] Servisni planovi terenskih zanata i rokovi flote (tehnički, tahograf…) na istom popisu
- [x] WhatsApp jednim dodirom s gotovom porukom i potpisom; „Ne treba” miče s popisa; poslano se pamti (gume do kraja sezone, servis 60 dana)

## Stadij 9: Spremno za prodaju i online rast
Redoslijed je dogovoren. (V) = Vedran, ostalo radi Claude.

1. Fiskalizacija i e-račun
   - [x] Račun nosi način plaćanja (gotovina, kartica, na račun), vrijeme, tko ga je izdao i oznaku poslovnog prostora i naplatnog uređaja (broj 12/PP1/1, redom po prostoru i uređaju)
   - [x] Postavke → Račun: oznaka poslovnog prostora i naplatnog uređaja; e-račun XML i knjiga računa nose način plaćanja; Arhiva traži 12/PP1/1
   - [ ] (V) S knjigovođom potvrditi pravila za 2026. i odabrati posrednika za fiskalizaciju i e-račune (koji ima API za softver)
   - [ ] (V) FINA demo certifikat za testiranje
   - [ ] Spajanje na odabranog posrednika, test u njihovom testnom okruženju
2. Naplata pretplate
   - [x] Postavke → Pretplata: paket, cijena, plaćeno do, AI potrošnja, „Želim ovaj paket”, uplatnica s barkodom za mobilno bankarstvo (IBAN Poslara, HR00 i poziv na broj radionice)
   - [x] Traka vlasniku 7 dana prije isteka, 7 dana počeka, zatim zaključavanje s uplatnicom; radionica bez „plaćeno do” se ne zaključava; Toranj pokazuje poziv na broj
   - [ ] (V) U Vercel upisati POSLAR_IBAN, POSLAR_PAYEE_NAME, POSLAR_PAYEE_STREET, POSLAR_PAYEE_CITY, SUPPORT_PHONE, SUPPORT_EMAIL (stari nazivi TAKTIX_* i dalje rade)
   - [ ] (V) Račune za pretplatu Poslar izdaje u svom programu dok se ne spoji posrednik; barkod provjeriti skeniranjem u svojoj banci
   - [ ] (V) Stripe račun za plaćanje karticom; zatim plaćanje karticom u aplikaciji
3. Prvi koraci nakon registracije
   - [x] Kartica „Prvi koraci” na Nalozima (samo vlasnik nove radionice): podaci radionice, radnik („Radim sam”), prvi nalog, prvi račun (Deal: prvi otkup); nestaje kad je sve gotovo ili kad je vlasnik zatvori
   - [x] „Pogledaj primjer naloga”: izmišljena mušterija i nalog s prvim predloškom; ne troši broj računa; „Obriši primjer” ga miče i kad je zatvoren
4. Lijevak u Tornju
   - [x] Pregled → Lijevak: radionice registrirane u zadnjih 90 dana, koliko ih je otvorilo prvi nalog, 10 naloga i više, plaća; postotak od prethodnog koraka
5. Preporuka
   - [x] Postavke → „Preporučite Poslar”: vlastita poveznica, slanje na WhatsApp, koliko se registriralo i koliko plaća
   - [x] Registracija preko poveznice pamti tko je preporučio; prva uplata nove radionice (upis u Tornju) daje preporučitelju mjesec gratis, jednom, s bilješkom; Toranj pokazuje „Preporuka: …”
   - [x] Vlasnik ne može sam sebi upisati preporuku ni označiti radionicu kao demo (demo se ne naplaćuje)
6. WhatsApp za pomoć
   - [x] Gumb s gotovom porukom: početna stranica („Pitaj na WhatsAppu”, broj u podnožju i u čestim pitanjima), registracija, prijava, Postavke → Pomoć (s imenom radionice i pozivom na broj), zaključan ekran (s razlogom)
   - [x] Bez upisanog broja ništa se ne prikazuje
   - [ ] (V) U Vercel upisati SUPPORT_PHONE (broj s WhatsAppom)
7. Video upute
   - [x] Toranj → Upute: 10 tema (prvi dan, aplikacija na mobitelu, novi nalog, rad na nalogu, račun, radnici, cjenik, QR, podsjetnici, knjigovođa); zalijepiš YouTube poveznicu, spremiš; prazno polje miče video
   - [x] U aplikaciji: popis u Postavke → Pomoć (radnik ne vidi teme samo za voditelja) i gumb „Video” uz Prve korake, Novi nalog, Račun, Tim, Cjenik, QR samoprijem, Podsjetnike i Za knjigovođu; bez poveznice ništa se ne prikazuje
   - [ ] (V) Snimiti kratke video upute (1 do 2 minute, mobitelom) i staviti ih na YouTube kao „Neizlistano”
8. Pravni dio
   - [x] Nacrti: /uvjeti (uvjeti korištenja), /privatnost (politika privatnosti), /obrada-podataka (ugovor o obradi podataka, čl. 28. GDPR-a); podaci pružatelja iz Vercela; samo provjerene činjenice (podaci u Irskoj, AI samo na zahtjev, bez kolačića za praćenje, fiskalizacija se još radi na blagajni)
   - [x] Poveznice: registracija (kvačica), podnožje početne stranice, Postavke; QR stranica i odobrenje kažu mušteriji tko dobiva podatke
   - [x] Registracija pamti kad su uvjeti prihvaćeni i koju verziju; sažeci IP adresa brišu se nakon 30 dana, riješene greške nakon 12 mjeseci
   - [ ] (V) Pravnik pregleda sva tri teksta prije prodaje (posebno rokove: 12 mjeseci čuvanja, brisanje na zahtjev u 30 dana, obavijest o povredi u 48 sati)
   - [ ] (V) U Vercel upisati POSLAR_OIB (i POSLAR_PAYEE_NAME, ulicu i grad); bez njih stranice pokazuju samo „Poslar”
   - [ ] (V) Prihvatiti ugovore o obradi podataka kod Supabasea, Vercela i Anthropica (u njihovim postavkama)
   - [ ] (V) Jednom mjesečno u Tornju obrisati radionice kojima je pretplata istekla prije više od 12 mjeseci
9. Google Play
   - [x] /.well-known/assetlinks.json iz Vercela (ANDROID_PACKAGE_NAME, ANDROID_SHA256_FINGERPRINTS): aplikacija s Playa otvara se preko cijelog ekrana
   - [x] Aplikacija otvorena s Playa (start /app?izvor=play) ne pokazuje cijene, uplatnicu ni „Želim paket” (pravila Google naplate); na webu sve ostaje
   - [x] Brisanje računa (Google traži): Postavke → Moj račun → „Zatraži brisanje računa” (zahtjev stiže u Toranj), stranica /brisanje-racuna, u Tornju „Obriši radionicu i sve podatke” uz upis naziva
   - [x] Uputa korak po korak: docs/GOOGLE_PLAY.md (domena, račun, PWABuilder, spajanje, stranica u trgovini, obrazac o podacima, testiranje)
   - [ ] (V) Domena poslar.eu spojena u Vercelu i Supabaseu prije Playa (docs/DOMENA.md)
   - [ ] (V) Račun za razvojne programere, paket iz PWABuildera, otisci u Vercel, zatvoreno testiranje s testerima (najmanje 12 kroz 14 dana)
10. Pred betu (nalazi s Vedranova testiranja)
   - [x] Lozinke: Toranj → Uredi → Ljudi i lozinke → Nova lozinka (s WhatsAppom); Postavke → Promijeni lozinku; prijava → „Zaboravili ste lozinku?” (WhatsApp, a nakon Breva poveznica e-poštom)
   - [x] Brisanje naloga, mušterije, vozila i lokacije: jasno pitanje „Da, obriši / Odustani” umjesto drugog dodira u 3 sekunde; nalog ili mušterija s izdanim računom se ne briše (broj računa ne smije nestati); slike se brišu i iz spremišta
   - [x] Predlošci abecedno (hrvatski poredak), mušterije po prezimenu sa slovima kao razdjelnicima, arhiva po datumu zatvaranja (najnoviji gore)
   - [x] Red „Dodaj stavku / predložak / Spremi kao predložak” na mobitelu u dva retka, bez preklapanja
   - [x] Mikrofon više ne upisuje dvaput kad Android ponovno pošalje iste riječi
   - [ ] (V) Brevo i e-pošta: docs/EMAIL_BREVO.md, zatim AUTH_EMAIL=1 u Vercelu

## Stadij 10: AI telefon i jasni nazivi
- [x] Nazivi zanata: TaktiX Autoelektričar, Automehaničar, Limar i lakirer, Vulkanizer, Kamioni i strojevi, Moto i nautika, Klima serviser, Vodoinstalater, Vučna služba, Auto plac; ispod ikone na mobitelu piše TaktiX
- [x] AI telefon (Vapi): poziv koji vlasnik ne preuzme (ne javi se, odbije, zauzet) preuzima AI; prepozna mušteriju po broju, ponudi slobodne termine iz radnog vremena, upiše nalog u Prijem s terminom („AI telefon”, točkica na Nalozima), kaže stanje otvorenih naloga
- [x] Postavke → AI telefon: radno vrijeme po danima, trajanje termina, poslova u isto vrijeme, najranije za; kodovi za preusmjeravanje; zadnji pozivi sa sažetkom i cijelim razgovorom
- [x] Nalog: kartica Termin (pomicanje termina), „Dogovorio AI telefon” sa sažetkom, „Potvrdi termin na WhatsApp”; e-mail vlasniku o novom terminu (Brevo API)
- [x] Toranj → Radionice → Uredi → AI telefon: Vapi broj radionice; minute i pozivi ovaj mjesec (za doplatu)
- [x] Hrvatski blagdani zatvoreni; isti termin se ne daje dvaput; ponovljen poziv alata ne radi dupli nalog
- [ ] (V) Vapi račun, hrvatski broj (Twilio), asistent, alati i spajanje po docs/VAPI.md
- [ ] (V) Cijena AI telefona kao doplate (Toranj pokazuje minute)

## Stadij 11: Nova početna stranica i probni dan
- [x] Početna i 10 stranica zanata (/zanat/automehanicar …) Vedranovim tekstom; sav tekst u config/landing.ts
- [x] „Isprobaj 24 sata” samo u zaglavlju, na vrhu i na kraju; cijene s prekidačem mjesečno / ugovor
- [x] Probni dan: registracija otvara radionicu napunjenu primjerima zanata (kopija uzorne radionice uzorak-<zanat>, datumi pomaknuti na danas)
- [x] Traka „Probni period: preostalo još N h · Pređite na prave poslove”
- [x] Nakon 24 sata: „Krenite 30 dana besplatno” (primjeri se brišu, upisano ostaje) ili recenzija i brisanje radionice
- [x] Toranj → Pregled: „Nakon probnog dana” (ocjene, tekst, smije li se objaviti) i popis onih koji žele obavijesti
- [x] Uzorne radionice: `node scripts/seed.mjs --uzorak` (bez prijave); demo radionice ostaju za prezentacije
- [x] U svakoj demo i uzornoj radionici poziv koji je preuzeo AI tajnik (prema „AI tajnik na djelu”); nove snimke za svih 10 zanata
- [x] Odluka: ugovor na 24 mjeseca (10 %), uz napomenu o sufinanciranju iz EU i nacionalnih sredstava

## Stadij 12: Vedranove primjedbe (5. 10.)
- [x] Dva ulaza: glavni „Isprobaj u radionici / na terenu 30 dana besplatno” (prazna radionica) i „Isprobaj demo verziju s izmišljenim podacima” (24 h s primjerima)
- [x] AI tajnik: Standard 60 min, Premium 150 min, Basic samo doplata (100 min za 25 €); poziv najviše 4 min; kad minute nestanu kratka poruka; e-mail na 80 % i 100 %; u Tornju polje minuta
- [x] Kalendar: odabrani dan ide u novi nalog, „Zakaži termin za [dan]”, Raspored i za radioničke zanate, termin za kasnije u radionici, nedovršeni unos samo u svojoj radionici (12 h)
- [x] Nalog: datumi primljeno, gotovo, preuzeto, plaćeno; mjerenje (test akumulatora, parazitska potrošnja, geometrija) predlaže stavku
- [x] Novi logo (plavi metronom, narančasta strelica iz sredine), nove boje: Moto plava, Limar narančasta, Kamioni siva, Vučna neon žuta
- [x] Fotografije na početnoj i stranicama zanata, pravi ekrani u mobitelu i laptopu; „Mobitel na terenu. Laptop u uredu.”
- [ ] Mjerenje → stavka i za ostale zanate (Vedran bira koje radnje i cijene)
- [x] Priprema za fiskalnu blagajnu na kraju dana: Poslovanje → Računi danas (popis i CSV za prepisivanje)
- [ ] Povezivanje s fiskalnim posrednikom kad ga knjigovođa odabere

## Stadij 13: Poslar (7. 10.)
- [x] Novo ime Poslar umjesto TaktiX i starih naziva (X-Files, … Files); zanati „Poslar Autoelektričar” …, poddomene <zanat>.poslar.eu
- [x] Logo: plava pilula, „Poslar” narančasto s bijelim obrubom (Saira Condensed), vlastiti znak kvadratić s kvačicom (jedna bijela linija); ikona aplikacije isti znak na plavom
- [x] Telefonski agent se javlja kao Poslar („ovdje Poslar … javljam se automatski”), ne kao asistent ni AI; u aplikaciji „Poslar na telefonu”
- [x] (V) Domena poslar.eu zakupljena (7. 10.)
- [ ] (V) Spojiti poslar.eu (docs/DOMENA.md); po želji i poslar.hr i .com; profili na mrežama; prijava žiga (DZIV ili EUIPO)
- [x] Kopilot postaje „Pitaj Poslara”: odgovara Poslar, bez riječi AI i asistent; u pravnim tekstovima piše da radi uz umjetnu inteligenciju
- [ ] (V) U Vercelu po želji preimenovati TAKTIX_* u POSLAR_* (stari nazivi rade)
- [ ] Demo prijava demo@demo.xfiles.hr → nova domena (nakon deploya, uz ponovno punjenje demo radionica)

## Stadij 14: Financije i telefon (u tijeku, 7. 10.)
- [x] Analiza troškova, poziva i cijena: docs/FINANCIJE.md
- [x] Odluke: Vercel Pro i Supabase Pro s prvom pretplatom; bez Cloudflarea i vlastitog servera; Play, žig i odvjetnik kasnije
- [x] Telefon: jedan zajednički Twilio broj, radionica po broju koji je preusmjerio poziv; ako proradi, telefon u svim paketima
- [ ] (V) Računi za potpuni test: domena spojena, Anthropic, e-mail, Twilio Local broj, Vapi, Paddle sandbox
- [x] Cijene prihvaćene, ali okrugle (Vedran ne želi 39, 49,99): prijedlog 40/70/120, osnivačka 30/50/90 za prvih 50 radionica
- [x] Potvrđeno (7. i 8. 10.): 40/70/120 i osnivačka 30/50/90 za prvih 50 radionica, 24 mjeseca; bez popusta za ugovor; uključeni pozivi 100/200/400 (stadij 15); e-mail na 80 % i 100 %; glas: preporuka muški (Srećko, docs/VAPI.md), odluka kod postavljanja Vapija
- [x] Odluka: „Poslar” izlazi iz naziva zanata (Autoelektričar, Automehaničar …); Poslar je krovno ime i AI pomoćnik
- [x] Boje: Crna radionica, plavi gumbi iz loga, narančaste ikone zanata; svijetla tema s jačim kontrastom (provedeno u stadiju 15)
- [x] Nakon odluka (kreni): telefon u pakete, „Rezerviraj termin”, tjedni backup i mjerač prostora, zajednički broj, Paddle (sve u stadiju 15; probni poziv i tekstovi naslovnice ondje)

## Stadij 15: Izlazak na tržište (7. 10.)
Vedranova odluka: stranica opisuje cijeli proizvod; sve ispod mora biti gotovo prije nego nova stranica ide van. Sve stoji dok ne definiramo troškove (7. 10.).
- [x] Boje (crna radionica, plavi gumbi u plavoj iz loga, narančaste ikone zanata s narančastim obrubom; svijetla tema s jačim kontrastom), zanati bez imena Poslar, nove cijene
- [x] Rezerviraj termin (8. 10.): poveznica radionice /termin/…, mušterija sama odabere slobodan termin (prva 3 dana, „Još termina” do 14 dana), nalog u Prijem s oznakom „Rezervirao online”; vlasnik u Postavke → Rezerviraj termin: prekidač, kopiraj, pošalji na WhatsApp, QR; isti kalendar kao Poslar na telefonu; demo posjetitelj može isprobati u svojoj probnoj radionici
- [ ] (V) Poveznicu staviti u WhatsApp Business automatski odgovor, Google profil i poruku na sekretarici
- [x] Više radionica pod jednim vlasnikom (8. 10.): Premium pokriva do 3 radionice (Vedranova odluka), radnici, slikanja, pitanja i minute zajednički; Postavke → Radionice (dodaj, otvori), prebacivanje dodirom na naziv na vrhu, Poslovanje → „Sve radionice”; podružnica plaća kroz glavnu (pretplata se kopira, Toranj je ne broji u prihod); svaka radionica svoje naloge, mušterije, račune i radnike
- [x] Dnevni sažetak vlasniku e-mailom (8. 10.): svaku večer u 19 h (ljeti; zimi 18 h) jedan e-mail po vlasniku sa svim radionicama: novi nalozi i odakle, preuzeto i promet, naplaćeno, pozivi Poslara, za naplatu, sutrašnji termini; miran dan bez e-maila; Postavke → Dnevni sažetak (prekidač, „Pošalji današnji sada”)
- [ ] (V) U Vercelu dodati CRON_SECRET (bilo koji dugi niz znakova); bez njega se dnevni zadaci ne pokreću. Brevo ključ (BREVO_API_KEY, MAIL_FROM) mora biti postavljen
- [x] Uvoz starih papirnatih naloga i računa slikom (8. 10.): Mušterije → Uvoz → „Stari nalozi i računi na papiru?”; više slika odjednom, Poslar pročita i rukom pisano (mušterija, registracija, datum, km, posao, stavke), kune preračuna po 7,53450; vlasnik provjeri i spremi: nalog ide u povijest kao preuzet i plaćen, sa slikom papira, bez broja računa; troši jedno slikanje po papiru
- [ ] (V) Za čitanje slika i papira treba ANTHROPIC_API_KEY u Vercelu (s kreditom)
- [x] Automatske poruke preko WhatsApp Business (Meta Cloud API, odluka 7. 10., kod gotov 8. 10.): oko 0,024 $ po poruci, dvosmjerno, s istog Poslar broja, bez kvote; bez provjerene tvrtke do 250 mušterija dnevno. SMS otpada. Besplatno uvijek: jedan dodir s majstorovog WhatsAppa
- [x] Kad majstor dodirne „Potvrdi termin”, Poslar sam pošalje potvrdu mušteriji na WhatsApp (8. 10.): uz to podsjetnik navečer prije termina (jednom; nov termin, nov podsjetnik), „posao je gotov” kad nalog prijeđe u Gotovo (radionice), faze popravka za limare; odgovori i slike mušterije stižu u nalog; Postavke → Poruke mušterijama (svaka poruka uklj./isklj.); demo i primjeri nikad ne šalju; bez ključeva sve ostaje kao prije (jedan dodir s majstorovog WhatsAppa). Upute: docs/WHATSAPP.md
- [x] Paket za knjigovođu sam ode e-mailom (8. 10.): Poslovanje → Za knjigovođu: e-mail knjigovođe, „Pošalji knjigovođi” za odabrani mjesec, i sam svakog 2. u mjesecu za prošli mjesec (jednom); ZIP s knjigom računa (CSV) i e-Računima (XML), odgovor knjigovođe ide radionici
- [x] WhatsApp: podsjetnik dan prije termina; obavijest mušteriji kad nalog ili faza proizvodnje krene dalje; slike koje mušterija pošalje stižu na nalog (8. 10., vidi gore)
- [ ] (V) Meta: račun, broj, 4 predloška i webhook po docs/WHATSAPP.md; u Vercel WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN
- [x] Plaćanje karticom (Paddle) (8. 10.): Pretplata → „Plati karticom” po paketu (osnivačka cijena sama), zaključani ekran „Karticom, odmah otključano”, webhook pomiče „Plaćeno do” i upisuje uplatu u Toranj (jednom), „Kartica i računi” (Paddleov portal); podružnica plaća kroz glavnu; bez ključeva ostaje samo uplatnica. Upute: docs/PADDLE.md
- [ ] (V) Paddle sandbox po docs/PADDLE.md (proizvod, 6 cijena, ključevi, webhook), probna uplata 4242…, zatim pravi račun
- [x] Telefon u pakete (pozivi umjesto minuta: 100/200/400, poziv do 60 s), zajednički broj po ForwardedFrom (vlasnik upiše mobitel koji preusmjerava; poziv bez prepoznate radionice ide u Greške za probni poziv; docs/VAPI.md dio 6), tjedna sigurnosna kopija baze (ZIP u privatnoj mapi, zadnjih 8, preuzimanje u Tornju), mjerač prostora (Toranj → Prostor i kopije) (8. 10.)
- [ ] (V) Probni poziv na zajednički broj s A1, HT i Telemacha (docs/VAPI.md dio 6); u Vercel POSLAR_PHONE_NUMBER i VAPI_SHARED_NUMBER_ID; na Supabase Pro SUPABASE_PLAN=pro
- [ ] Novi tekstovi iz Geminija (docs/GEMINI_TEKSTOVI.md) uneseni

## Stadij 16: Mobitel na prvom mjestu (Geminijev UI/UX zadatak, 8. 10.)
- [x] Gumbi, polja i poveznice najmanje 48 px; oznake (badge) ravne, bez ruba, nisu gumbi; imena se ne skraćuju s „…”
- [x] Nalog: traka faza na vrhu (Prijem, U radu, Gotovo, Preuzeto, „Sada: …”, naplata); kartice kao traka koja se vrti prstom, bez „Više”; donja traka: Faza, „Dalje: …” / „Označi: …” / „Označi plaćeno”, Pitaj Poslara
- [x] Diktiranje pokraj naslova polja, ispod polja „Spremljeno u 23:20”; „Više polja” unutar kartice
- [x] Nalozi: Svi, U radu, Za naplatu, Arhiva + prekidači Hitno i Moji nalozi; kartica: „Dogovorio Poslar”, „Termin …”, „Rok …”
- [x] Proizvodnja (limar): na mobitelu jedna faza, kartice faza s brojem, povlačenje lijevo i desno, „Dalje: …” na svakoj kartici; na računalu sve faze
- [x] Poslovanje: isto razdoblje na Pregledu i Arhivi (6 izbora), „Izvezi CSV” pokraj pretrage, brojke jedna ispod druge na mobitelu
- [x] Naslovnica: „Započni 30 dana besplatno”, „Otvori demo bez prijave”, ista boja gumba na svim stranicama, isti blok „Zvuči ti poznato?”, 6 mogućnosti po zanatu (+ Pitaj Poslara), bez usamljene kartice u retku
- [x] Geminijevi tekstovi, prvi dio (naslovnica, cijene, česta pitanja, 5 zanata), s ispravcima: „Poslar AI asistencija” → „Poslar na telefonu”, „AI očitavanja” → „pitanja Poslaru”, „potvrdan” → „potvrđen”; TRADE.wheel.pains.2.a nije uzet (ne odgovara pitanju)
- [ ] Ostatak Geminijevih tekstova (ostali zanati)

## Stadij 17: Novi zanati (odluka 8. 10., iza stadija 15)
Novi zanat koji stane u radionicu ili teren je opis: kvarovi, predlošci s cijenama, check-liste s mjerenjima, ikona, tekst stranice, demo podaci. Oko jedan dan po zanatu, plus tekstovi za Geminija.
- [x] Auto kozmetika i poliranje (radionica): registracija, slike prije i poslije, paketi, mjerenje laka, obnova keramike
- [x] Električar (teren): zapisnik mjerenja instalacije (izolacija, petlja, RCD), solari, punjači za auto
- [x] Servis kućanskih aparata (radionica i teren): uređaj sa serijskim brojem, očitavanje pločice, čekanje dijela
- [x] Bravar, hitno otvaranje vrata (teren): noćni i vikend dodatak, provjera osobne, Poslar na telefonu
- [x] Zajednički modul za nove zanate: servisni plan, povijest uređaja, „Dospijeva” na stranici modula
- [x] Migracije 0035 i 0036 na živoj bazi, demo i uzorne radionice za 4 nova zanata (9. 10.)
- [ ] Geminijevi tekstovi za 4 nova zanata
- [ ] Tjedni posjeti na adresi (servisni plan danas najmanje mjesečno)
- [ ] Održavanje bazena (teren, tjedno): mjerenja pH i klora
- [ ] Čišćenje apartmana i ureda (teren, tjedno): smjene između gostiju
- [ ] Kasnije, manje tržište: deratizacija, dimnjačar, garažna vrata, majstor za sve, okućnice i vrtovi, održavanje objekata
- [ ] Kasnije, poseban modul: gradnja i adaptacije (ponuda po m², radovi danima, avansi, situacije)

## Kasnije
Sef za ključeve, engleski jezik, white label (domena, ime i boje partnera), regija (SLO, BiH, SRB uz njihovu fiskalizaciju).
