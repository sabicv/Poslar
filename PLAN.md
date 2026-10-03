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
- [ ] Zimske/ljetne gume, dospio servis: popis i WhatsApp jednim dodirom

## Kasnije
Fiskalizacija (s knjigovođom i posrednikom), sef za ključeve, Google Play, engleski jezik.
