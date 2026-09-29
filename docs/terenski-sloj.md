# Terenski sloj — analiza konkurencije i odluke

*Rujan 2026.* Terenski sloj namijenjen je radu na adresi klijenta: klime, dizalice topline, a kasnije i solari, struja i vodovod. Prvi paket koji ga koristi je **Air Files**. Radionički paketi (Volt, Gear, Wheel) mogu ga uključiti kao modul „Rad na terenu” za mobilni servis.

## Što najbolje rade vodeći alati

| Alat | Najjača značajka | Što preuzimamo | Što ne preuzimamo |
|---|---|---|---|
| **Jobber** | Jednostavnost; SMS „na putu” s poveznicom; portal klijenta; ponavljajući poslovi; optimizacija rute (od 2025.) | Poruku „Na putu” s procjenom dolaska, ponavljajući servis i rutu dana | Online plaćanje i marketinške automatizacije |
| **Housecall Pro** | Brz mobilni rad; servisni planovi (članstva); GPS | Jedan veliki gumb za sljedeći korak; servisne planove bez naplate članarine | Naplatu članstava i praćenje tehničara uživo |
| **ServiceTitan** | Uređaj vezan uz lokaciju s punom poviješću; cjenik s ponudama u tri razine; članstva | Lokaciju → uređaje → povijest; tri razine već imamo kroz Hitno / Preporučeno / Po želji uz odobrenje putem poveznice | Poslovni sloj za velike tvrtke, složeno raspoređivanje, financiranje |
| **ServiceM8** | Kartice poslova, obrasci i imovina bez viška | Kontrolne liste s pragovima (isti mehanizam kao DVI), fotografije uz posao | — |
| **Fergus** | Evidencija vremena i usklađenost | Vrijeme dolaska i odlaska s GPS-om kao dokaz | Obrasce zaštite na radu (kasnije, po potrebi) |

**Praznina koju nitko od njih ne pokriva za Hrvatsku: F-plinovi.** Američki alati prate rashladne tvari prema EPA pravilima. Za EU i HR vrijede:
- **Uredba (EU) 2024/573:** obvezne provjere propuštanja ovise o tonama CO₂-ekvivalenta:
  - od 5 t svakih 12 mjeseci;
  - od 50 t svakih 6 mjeseci;
  - od 500 t svaka 3 mjeseca;
  - sa sustavom za otkrivanje propuštanja razmak se udvostručuje;
  - nakon popravka propuštanja obavezna je kontrolna provjera u roku od mjesec dana;
  - zapisi se čuvaju 5 godina.
- **Hrvatska:** servisna kartica **SK 1** za opremu s 3 kg ili više plina, te godišnje izvješće o količinama.

**X-Files to računa automatski iz natpisne pločice.** To je naš argument za prodaju. Točne obrasce i rokove radionica potvrđuje prema važećem propisu.

## Odluke — što je ušlo

1. **Lokacije.** Klijent ima više adresa (stan, kuća, apartman, ured), a uređaji su na lokaciji. Uz lokaciju pamtimo upute za ulaz (kat, šifra, ključ, pas) i osobu na licu mjesta. GPS lokacije aplikacija sama nauči pri prvom dolasku, bez plaćenog servisa za geokodiranje.
2. **Raspored dana.** Tjedni pregled, posjeti po vremenu i filtar po tehničaru. Uz to „Ruta dana” (svi otvoreni posjeti u Google Mapsu) i popis „Nezakazano”. Za terenski paket to je početna stranica.
3. **Tri dodira na terenu:**
   - **Na putu:** otvara WhatsApp ili SMS s porukom i procjenom dolaska; dovoljno je poslati;
   - **Stigao:** bilježi vrijeme i GPS;
   - **Završio:** nalog prelazi u „Odrađeno”.
   Bez plaćenih SMS API-ja: poruka ide s mobitela tehničara.
4. **Izvještaj za vlasnika koji nije bio kod kuće.** Javna poveznica bez prijave sadrži:
   - dolazak i odlazak;
   - potvrdu lokacije GPS-om;
   - fotografije prije i poslije, s otiskom SHA-256 kao dokazom da nisu mijenjane;
   - nalaze kontrolne liste i zapis o plinu.

   Cijene nisu u izvještaju. Voditelj jednim dodirom može poništiti staru poveznicu.
5. **Servisni planovi.** Interval po uređaju. Mjesec dana prije roka klijent se sam pojavi na popisu, uz poruku za WhatsApp i gumb „Zakaži” koji popuni nalog. Završetkom naloga plan se sam pomakne za jedan interval.
6. **Evidencija F-plina (Air):**
   - radna tvar, punjenje i t CO₂e;
   - obveze (SK 1, rok provjere);
   - dnevnik intervencija s certifikatom servisera;
   - godišnji zbroj po radnoj tvari;
   - popis provjera propuštanja koje dolaze, uključujući kontrolu nakon popravka.
7. **Kalkulator dopune plina** za duljinu instalacije. Formula je deterministička, a vrijednosti iz uputa proizvođača. AI ne računa brojeve koji idu na račun.
8. **AI Kopilot** za terenski nalog dobiva i vrstu objekta, uređaj te obveze vezane uz F-plin. Adresu i upute za ulaz ne dobiva, jer mogu sadržavati šifre.

## Odluke — što je namjerno izostavljeno (jednostavnost)

- Kalendar s povlačenjem mišem. Termin se mijenja u dva dodira („Promijeni termin”), a na mobitelu je to brže.
- Praćenje tehničara uživo. Troši bateriju i otvara pitanja privatnosti; dovoljni su GPS pri dolasku i vremena.
- Optimizacija rute putem plaćenog API-ja. Ruta dana ide redom termina. Optimizacija dolazi kasnije ako je piloti zatraže.
- Online rezervacija, zalihe po vozilu, naplata članarina i automatsko slanje poruka putem WhatsApp Business API-ja. Ovo zadnje je plaćeno i treba odobrene predloške; to je sljedeći korak nakon pilota.

## Izvori

- [Housecall Pro vs Jobber vs ServiceTitan](https://fieldservicesoftware.io/comparisons/housecall-pro-vs-jobber-vs-servicetitan/)
- [Jobber — On My Way poruke](https://help.getjobber.com/hc/en-us/articles/7448087796631-On-My-Way-Text-Messages-in-the-Jobber-App) · [Jobber — raspored i ponavljajući poslovi](https://www.getjobber.com/features/scheduling/)
- [ServiceTitan vs Housecall Pro](https://www.servicetitan.com/comparison/servicetitan-vs-housecall-pro) · [Praćenje HVAC opreme](https://toolsinthewild.com/hvac/equipment-tracking-software/)
- [ServiceM8 značajke](https://www.servicem8.com/us/features-field-service-management) · [Fergus vs ServiceM8](https://www.selecthub.com/field-service-software/fergus-vs-servicem8/)
- [Uredba (EU) 2024/573 (EUR-Lex)](https://eur-lex.europa.eu/eli/reg/2024/573/oj/eng) · [EU F-gas compliance 2026](https://refrigerationstore.eu/gas/eu-f-gas-compliance-2026-certification-leak-checks-record-keeping/)
- [Ministarstvo — službeni obrasci (ozonski sloj i F-plinovi)](https://mzozt.gov.hr/o-ministarstvu-1065/djelokrug/uprava-za-klimatsku-tranziciju-1879/zastita-ozonskog-sloja-i-fluorirani-staklenicki-plinovi/sluzbeni-obrasci/1952) · [Evidencije i obrasci za servisere klima uređaja](https://klimatizacija.hr/evidencije-i-obrasci-instalatere-i-servisere-klima-uredaja/)
