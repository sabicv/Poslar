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
- [ ] Radionice: paket, status, proba, plaćeno do, napomene
- [ ] Podrška: „Javi problem” iz aplikacije, odgovori iz tornja
- [ ] Greške: automatsko hvatanje grešaka iz aplikacije i servera
- [ ] Analiza: prihod, radionice po paketu i zanatu, aktivnost, AI potrošnja, tko se gasi
- [ ] Kvote za slikanje i Kopilot po paketu

## Stadij 5: Cjenik i predlošci
- [ ] Postavke → Cjenik: satnica, vlastiti predlošci s cijenama
- [ ] „Spremi kao predložak” iz naloga; ručni novi predložak
- [ ] +10 najčešćih poslova po zanatu

## Stadij 6: Arhiva u Poslovanju
- [ ] Zatvoreni nalozi, razdoblje, plaćeno/neplaćeno, traženje, iznos i broj računa

## Stadij 7: QR samoprijem (Standard i Premium)
- [ ] Mušterija skenira QR, slika prometnu, izgovori kvar; nalog stiže majstoru
- [ ] Zaštita od lažnih prijava; QR plakat za ispis

## Stadij 8: Podsjetnici
- [ ] Zimske/ljetne gume, dospio servis: popis i WhatsApp jednim dodirom

## Kasnije
Fiskalizacija (s knjigovođom i posrednikom), sef za ključeve, Google Play, engleski jezik.
