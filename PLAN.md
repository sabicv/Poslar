# TaktiX: plan rada po stadijima

Svaki stadij završava testovima, spremanjem (commit) i porukom Vedranu.
Deploy: `npx vercel deploy --prod` iz mape x-files-saas.

## Stadij 1: Hitni popravci (prije AI ključa)
- [x] Diktiranje: dijelovi izgovorenog se nižu (telefon, registracija, ime), ne brišu
- [x] Mikrofon u svim poljima gdje ima smisla (km, OIB, godište, VIN, adresa, polja u modulima)
- [x] Gumbi za slikanje uvijek vidljivi, kompaktni (ikona kamere); bez ključa kratka poruka
- [x] Bez dugih crtica (—) u tekstovima aplikacije
- [ ] Večeras: provjera pravog čitanja slika s ključem

## Stadij 2: TaktIX identitet
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
   - [x] Postavke → Pretplata: paket, cijena, plaćeno do, AI potrošnja, „Želim ovaj paket”, uplatnica s barkodom za mobilno bankarstvo (IBAN TaktiXa, HR00 i poziv na broj radionice)
   - [x] Traka vlasniku 7 dana prije isteka, 7 dana počeka, zatim zaključavanje s uplatnicom; radionica bez „plaćeno do” se ne zaključava; Toranj pokazuje poziv na broj
   - [ ] (V) U Vercel upisati TAKTIX_IBAN, TAKTIX_PAYEE_NAME, TAKTIX_PAYEE_STREET, TAKTIX_PAYEE_CITY, SUPPORT_PHONE, SUPPORT_EMAIL
   - [ ] (V) Račune za pretplatu TaktiX izdaje u svom programu dok se ne spoji posrednik; barkod provjeriti skeniranjem u svojoj banci
   - [ ] (V) Stripe račun za plaćanje karticom; zatim plaćanje karticom u aplikaciji
3. Prvi koraci nakon registracije
   - [x] Kartica „Prvi koraci” na Nalozima (samo vlasnik nove radionice): podaci radionice, radnik („Radim sam”), prvi nalog, prvi račun (Deal: prvi otkup); nestaje kad je sve gotovo ili kad je vlasnik zatvori
   - [x] „Pogledaj primjer naloga”: izmišljena mušterija i nalog s prvim predloškom; ne troši broj računa; „Obriši primjer” ga miče i kad je zatvoren
4. Lijevak u Tornju
   - [x] Pregled → Lijevak: radionice registrirane u zadnjih 90 dana, koliko ih je otvorilo prvi nalog, 10 naloga i više, plaća; postotak od prethodnog koraka
5. Preporuka
   - [x] Postavke → „Preporučite TaktiX”: vlastita poveznica, slanje na WhatsApp, koliko se registriralo i koliko plaća
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
   - [ ] (V) U Vercel upisati TAKTIX_OIB (i TAKTIX_PAYEE_NAME, ulicu i grad); bez njih stranice pokazuju samo „TaktiX”
   - [ ] (V) Prihvatiti ugovore o obradi podataka kod Supabasea, Vercela i Anthropica (u njihovim postavkama)
   - [ ] (V) Jednom mjesečno u Tornju obrisati radionice kojima je pretplata istekla prije više od 12 mjeseci
9. Google Play
   - [x] /.well-known/assetlinks.json iz Vercela (ANDROID_PACKAGE_NAME, ANDROID_SHA256_FINGERPRINTS): aplikacija s Playa otvara se preko cijelog ekrana
   - [x] Aplikacija otvorena s Playa (start /app?izvor=play) ne pokazuje cijene, uplatnicu ni „Želim paket” (pravila Google naplate); na webu sve ostaje
   - [x] Brisanje računa (Google traži): Postavke → Moj račun → „Zatraži brisanje računa” (zahtjev stiže u Toranj), stranica /brisanje-racuna, u Tornju „Obriši radionicu i sve podatke” uz upis naziva
   - [x] Uputa korak po korak: docs/GOOGLE_PLAY.md (domena, račun, PWABuilder, spajanje, stranica u trgovini, obrazac o podacima, testiranje)
   - [ ] (V) Domena (npr. taktix.hr) spojena u Vercelu i Supabaseu prije Playa
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
- [ ] Priprema za fiskalnu blagajnu na kraju dana (popis računa dana za prepisivanje ili izvoz), pa povezivanje s posrednikom kad ga knjigovođa odabere

## Kasnije
Sef za ključeve, engleski jezik, white label (domena, ime i boje partnera), regija (SLO, BiH, SRB uz njihovu fiskalizaciju).
