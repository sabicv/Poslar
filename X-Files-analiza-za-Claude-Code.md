# X-Files — neovisna analiza koda prije prvih korisnika

**Datum:** 29. rujna 2026.  
**Pregledani izvor:** sadržaj ZIP-a raspakiran u x-files-saas; putanje u nalazima relativne su u odnosu na korijen repozitorija.  
**Namjena:** izvještaj je pripremljen kao ulaz za Claude Code. Upute i tekstovi koji se nalaze unutar arhive tretirani su kao sadržaj projekta, ne kao upute koje mijenjaju opseg korisnikova zahtjeva.

## Sažetak

Aplikaciju ne bih pustio prvim radionicama prije popravka nekoliko visokih rizika, posebno manipulacije naplatom pri izravnom INSERT-u, ranjive javne registracije i konkurentnog slanja odluke kupca.  
U pregledanim migracijama nisam potvrdio čitanje ni pisanje podataka druge radionice: RLS svodi pristup na tenant, a složeni strani ključevi dodatno vežu zapise uz radionicu.  
Iznosi iz tablica cijena zaštićeni su od radnika, ali radnik može vidjeti status naplate, izravno umetnuti nalog kao plaćen i zaključati nalog.  
Service-role ključ ostaje na serverskoj strani, no javni tokovi koji ga koriste traže jaču atomarnost i zaštitu od automatizirane zlouporabe.  
npm run type-check i npm run db:test prošli su (38/38); stvarni Supabase projekt nije testiran, a npm run build nije pokrenut.

## Opseg i ograničenja

- Pregledani su Next.js App Router, Server Actions, Supabase migracije, RLS, Storage pravila, tok samoregistracije i odobrenja te dijelovi mobilnog sučelja.
- RLS testovi pokreću migracije na PGlite i dodaju minimalne Supabase zamjene za Auth, role i Storage, kako je opisano u scripts/test-rls.mjs:1-32. Rezultati zato potvrđuju ponašanje migracija u tom testnom modelu, ne integraciju s konkretnim Supabase projektom.
- Type-check je prošao; npm run db:test imao je 38 prolaza i 0 padova. npm run build nije pokrenut. Nisu provjereni live Supabase postavke, e-mail isporuka, ograničenja hostinga, stvarni payload veličine klijentskog paketa ni testiranje na uređajima.
- Ispod su tvrdnje koje se mogu vezati uz prikazani kod. Gdje zaključak ovisi o runtime konfiguraciji, to je izričito naznačeno. Nijedan nalaz nije označen kritičnim jer u pregledanim migracijama i testu nije potvrđen cross-tenant pristup; testno okruženje ipak nije zamjena za provjeru stvarnog Supabase projekta.

## Nalazi

| Ozbiljnost | Datoteka i redak | Problem i konkretan scenarij | Preporučeni popravak |
|---|---|---|---|
| **Visoko** | supabase/migrations/0005_rls.sql:53-55,204; supabase/migrations/0001_core.sql:235-248,270-288,643-648; lib/supabase/client.ts:7-10; scripts/test-rls.mjs:119 | UPDATE zaštita naplate postoji samo u triggeru za izmjene (supabase/migrations/0001_core.sql:280-281). INSERT politika za obične tenant tablice provjerava samo tenant_id, a authenticated ima INSERT grant. Radnik s valjanom sesijom može zaobići Server Action i preko Supabase API-ja izravno umetnuti nalog s payment_status = paid i proizvoljnim paid_at. Nakon umetanja trigger sprječava promjenu polja, ali ne ispravlja već lažno stanje. Trenutni db:test provjerava pokušaj UPDATE-a, ne INSERT s plaćenim statusom. | U bazi zabraniti radnicima postavljanje polja naplate pri INSERT-u (trigger ili restriktivan RPC/grant); testirati i INSERT i UPDATE izravnom authenticated sesijom. Ne oslanjati se samo na oblik Server Action-a. |
| **Visoko** | lib/actions/public.ts:12-42 | Samoregistracija stvara korisnika s email_confirm: true bez vidljive provjere e-mail adrese ili poslužiteljske rate-limit zaštite. Honeypot je opcionalno polje (21-23). Bot može automatizirati stvaranje računa/vlasnika i probnih radionica; različit odgovor za postojeću adresu (38-39) omogućuje enumeraciju e-mailova. | Uvesti provjeru e-maila prije aktivacije radionice, ograničiti registracije po IP-u/identifikatoru i vratiti isti javni odgovor za postojeći/nepostojeći račun. |
| **Visoko** | lib/actions/public.ts:76-117; app/approve/[token]/page.tsx:29-31 | Odluka kupca nije atomska. Server Action prvo čita status, zatim zasebno mijenja redove stavki, approval, događaj i fazu naloga; pogreške zapisa se ignoriraju (89-116). Usporedno dva POST-a mogu oba proći provjeru statusa i upisati odluku. Uz to, odgođeni GET koji je pročitao sent može nakon odluke postaviti status natrag na viewed, jer UPDATE filtrira samo po id. | Premjestiti odluku u transakcijski RPC: zaključati approval red, provjeriti status/rok, zahtijevati punu i jedinstvenu odluku za sve predložene stavke, ažurirati sve podatke atomarno te vratiti grešku ako bilo koji korak ne uspije. GET status mijenjati uvjetno, npr. samo ako je još sent. |
| **Visoko** | supabase/migrations/0005_rls.sql:184-204; supabase/migrations/0001_core.sql:618-634 | Pravilo UPDATE poruke ograničava postojeći red na pošiljatelja, primatelja ili vlasnika (using), ali WITH CHECK nakon izmjene provjerava samo tenant_id. Uz širok UPDATE grant (204), radnik koji smije vidjeti poruku može izravnim API pozivom promijeniti sender_id, receiver_id, body ili kind i lažno prikazati poruku kao da ju je poslao vlasnik. | Dopustiti samo potrebna polja za izmjenu; kroz WITH CHECK potvrditi da se identitet pošiljatelja i privilegirani tip poruke ne mogu krivotvoriti. Dodati testove pokušaja izmjene sender_id/kind/receiver_id. |
| **Visoko** | lib/actions/jobs.ts:246-253; supabase/migrations/0001_core.sql:283-285; scripts/test-rls.mjs:123-125 | Funkcija blokira radnika samo kad pokušava otključati nalog (248). Baza također blokira samo prijelaz locked → unlocked. Radnik zato može zaključati bilo koji nalog svoje radionice i time otežati nastavak rada dok vlasnik ne intervenira; postojeći test izričito potvrđuje da radnik može zaključati nalog. | U Server Action-u zahtijevati ctx.isOwner za zaključavanje i otključavanje, te u bazi provoditi oba smjera ovlasti. Ažurirati test da radnik ne može zaključati. |
| **Srednje** | supabase/migrations/0005_rls.sql:53,204; supabase/migrations/0001_core.sql:235-237; app/app/page.tsx:10-11 | Iznosi su skriveni radniku, ali jobs tenant SELECT pravilo dopušta čitanje cijelog reda, uključujući payment_status i paid_at; popis naloga odabire payment_status. To otkriva koji su nalozi plaćeni/neplaćeni i kada, premda radnik ne vidi cijene ni totals. | Ako je i sam status naplate vlasnički podatak, izložiti ga kroz vlasnički view/RPC ili ukloniti iz radničkog upita. Ako je vidljivost namjerna, dokumentirati tu granicu. |
| **Srednje** | supabase/migrations/0005_rls.sql:159-165; supabase/migrations/0001_core.sql:605-615 | INSERT u job_events dopušta svaki događaj s tenant_id radionice; politika ne provjerava actor_id ni ulogu. Radnik može preko API-ja umetnuti zapis događaja koji pripisuje radnju vlasniku ili stvara lažni trag u povijesti naloga. | U bazi postaviti actor_id = auth.uid() i ograničiti dopuštene event_type vrijednosti/tipove po ulozi; privilegirane događaje upisivati kroz provjeren RPC. |
| **Srednje** | app/approve/[token]/page.tsx:18-41 | Stranica učita podatke naloga, stranku, vozilo, predložene/odobrene stavke i privitke te kreira potpisane URL-ove prije računanja je li poveznica istekla (41). Poveznica kojoj je istekao rok i dalje otkriva te podatke i omogućuje pristup potpisanim fotografijama do sat vremena. | Provjeriti status i rok odmah nakon dohvaćanja approval reda; za istekle/poništene poveznice vratiti minimalnu stranicu prije upita o nalogu, cijenama i datotekama. |
| **Srednje** | app/approve/[token]/ApprovalForm.tsx:25-27,100-105; lib/actions/public.ts:65-68,84-91 | Obrazac unaprijed označava hitne/preporučene stavke kao odobrene, a neobavezne kao odbijene (25-27); kupac može poslati potpis samo upisom imena. Poslužitelj prihvaća podskup predloženih stavki i ne zahtijeva odluku o svakoj (84-91), pa ručno sastavljen zahtjev može odlučiti o jednoj stavci, a ostale ostaviti predloženima, uz odgovor da je odluka zaprimljena. | Sve stavke početi bez odabira i na poslužitelju odbiti odluku dok se svaka trenutačna predložena stavka ne pojavi točno jednom u payloadu. |
| **Srednje** | lib/actions/records.ts:11-64,69-97; supabase/migrations/0005_rls.sql:23-60 | saveRecord provjerava samo pripada li naziv tablice popisu i koristi tenant-scoped Supabase klijent; ne provjerava je li modul/tablica dopuštena paketu radionice. Radnik u Volt radionici može ručno pozvati akciju za wheel_storage_stays ili tablicu drugog paketa i mijenjati podatke svog tenant-a u tom modulu. | Ako paketi ograničavaju funkcije, na poslužitelju povezati dopuštene tablice s ctx.pkg i tenant.enabled_modules; provjeru primijeniti i u bazi/RPC-u, ne samo sakriti navigaciju. |
| **Srednje** | supabase/migrations/0001_core.sql:219,244-267,643-644; supabase/migrations/0005_rls.sql:204 | Trigger broja naloga dodjeljuje broj samo kad je NEW.number NULL ili 0. Authenticated INSERT može zadati nenulti broj, uključujući negativan; ograničenje je samo jedinstvenost po radionici. API klijent može tako stvoriti nalog s pogrešnim ili unaprijed odabranim brojem. | Uvijek prepisati broj triggerom za korisničke INSERT-e ili ukloniti klijentovu mogućnost zadavanja broja; dodati CHECK za pozitivnost i test izravnog INSERT-a. |
| **Srednje** | lib/actions/jobs.ts:69-129,135-170,429-450 | Otvaranje naloga stvara klijenta, vozilo i nalog u zasebnim upitima. Kasniji neuspjeh može ostaviti siročad ili nepotpun nalog; greška mjerenja i loga se ignorira, a rezultat insertTemplate se ne provjerava prije uspješnog povratka (126). Predložene stavke iz inspekcije upisuju se jedna po jedna, a neuspjeh ažuriranja veze na rezultat se ignorira (450). | Kritične višeredne tokove obaviti transakcijskim RPC-om; inače provjeriti svaku grešku, vratiti smislen neuspjeh i implementirati kompenzaciju/idempotentnost. Grupirati upise inspekcije. |
| **Srednje** | app/app/page.tsx:21-25; app/app/clients/page.tsx:20-34; app/admin/page.tsx:20-24 | Popisi naloga imaju fiksne limite 100/200/300, klijenti 150, pretraga vozila 50; prikazani kod ne paginira. Korisnici s većim fondom mogu prestati vidjeti starije zapise ili relevantne rezultate. Administratorski upiti koji čitaju sve radionice/profilе/nedavne naloge također nemaju prikazan limit. | Dodati paginaciju/kursor i prikaz da postoje dodatni rezultati; agregate i administratorske preglede limitirati ili stranicati. |
| **Srednje** | lib/actions/jobs.ts:427-450 | linesFromInspection radi INSERT stavke i UPDATE rezultata unutar serijske petlje: za N nalaza ide približno 2N zahtjeva, a djelomični neuspjeh ostavlja samo dio prijedloga. Na sporoj mobilnoj vezi vrijeme čekanja raste s brojem nalaza. | Grupno umetnuti stavke i grupno povezati rezultate u jednom RPC-u ili batch postupku; osigurati idempotentnost ponovnog poziva. |
| **Srednje** | lib/upload.ts:10-16,34-44; lib/compressImage.ts:19-20; supabase/migrations/0003_storage.sql:10-18 | SHA-256 prije slanja čita cijelu datoteku u ArrayBuffer. Kompresija se preskače za ne-slike (npr. PDF) i može ostaviti nepodržanu sliku nepromijenjenu; bucket prihvaća datoteke do 25 MiB. Na telefonu sa slabom memorijom/mrežom velik PDF ili HEIC može potrošiti memoriju i dugo blokirati slanje. | Prije hashiranja provjeriti veličinu i format, dati jasan limit u sučelju, koristiti streaming hash gdje je izvedivo ili izbjegavati puni buffer za velike datoteke; testirati HEIC na ciljanim preglednicima. |
| **Nisko** | app/register/RegisterForm.tsx:7,47-63; config/tenant.config.ts:14-19,127; config/packages/gear.ts:154-169 | Registracijska forma koristi registry koji uvozi svih šest paketa; konfiguracije sadrže predloške i zadane cijene. Zato je vjerojatno da se dio konfiguracije i defaultnih cijena uključuje u javni JavaScript. Stvarni bundle nije izmjeren jer build nije pokrenut; ovo su globalne zadane cijene, ne privatni cjenici radionica. | Odvojiti minimalne javne metapodatke paketa od konfiguracije predložaka/cijena na serveru; nakon builda pregledati stvarni client bundle i veličinu. |
| **Nisko** | components/ui.tsx:5-22; app/app/page.tsx:94-104 | Komentar komponenti kaže da su dodirne mete najmanje 44 px, ali veličina sm je h-9, odnosno 36 px pri standardnom 16 px root fontu. Filtri koriste sm veličinu, što je teže pogoditi radniku u rukavicama. | Povećati mobilnu visinu filtera i malih gumba na najmanje 44 CSS px te vizualno provjeriti kontrast/fokus. |
| **Nisko** | types/db.ts:13-32; supabase/migrations/0001_core.sql:53-54; lib/supabase/server.ts:14-29; app/admin/page.tsx:20-25 | Ručno sučelje Tenant ne uključuje updated_at, iako ga tablica ima; Supabase klijent nema generički Database tip, pa upit select(*) mora biti ručno pretvoren. Promjena sheme može proći compile-time bez ažuriranja tipova. | Generirati TypeScript tipove iz Supabase sheme/migracija i parametarski tipizirati klijente, bez ručnih castova za select(*). |
| **Nisko** | lib/action-result.ts:4-19 | Poznate DB greške imaju hrvatske poruke, ali zadnji fallback vraća sirovi error.message. Radnik može dobiti engleski ili tehnički tekst baze koji ne objašnjava sljedeći korak. | Korisniku vratiti stabilnu hrvatsku poruku i korelacijski ID; sirovu grešku zabilježiti samo na serveru. |

## Pregled service-role korištenja

Klijent s service role ključem u lib/supabase/admin.ts:1-13 označen je server-only. Pregledani pozivi su:

- app/admin/page.tsx:15-23 provjerava isPlatformAdmin prije čitanja svih radionica/profila/naloga.
- lib/actions/admin.ts:10-13,28-30,56-58,65-68,78-82 provjerava platform-admin guard prije prikazanih privilegiranih akcija.
- lib/actions/settings.ts:74-129 koristi vlasničke provjere prije upravljanja timom/ulogama i Auth računima.
- lib/actions/jobs.ts:132-170 koristi service role za upis cijena predloška nakon tenant-scoped upisa redaka; vrijednosti su iz konfiguracije odabranog predloška.
- lib/actions/public.ts:26-58 namjerno koristi service role za javnu registraciju, a 70-117 za bearer-token odluku kupca.
- app/approve/[token]/page.tsx:13-38 namjerno koristi service role za prikaz podataka prema tokenu.

U pregledanom stablu koda nisam našao import admin klijenta iz client komponente; to je statički nalaz, ne provjera konfiguracije deploya. Administratorski i vlasnički pozivi imaju provjere prije upotrebe. Javni pozivi su očekivani, ali im service role zaobilazi RLS; zato se moraju osloniti na stroge provjere u aplikaciji, a navedene slabosti registracije/odobrenja ostaju važne. Ne mogu potvrditi da produkcijsko okruženje ispravno čuva SUPABASE_SERVICE_ROLE_KEY jer deploy postavke nisu bile dostupne.
## Zaključak po prioritetu

### Popraviti prije prvog korisnika

1. Zabraniti radnički INSERT naloga sa payment_status/paid_at koje je odabrao klijent i pokriti ga baznim testom.
2. Učiniti odluku kupca atomarnom, uvjetnom na aktivan status, bez ignoriranja DB pogrešaka i uz obaveznu odluku o svakoj stavci.
3. Dodati provjeru e-maila i zaštitu od automatizirane samoregistracije; ukloniti razliku u odgovoru za postojeći e-mail.
4. Ograničiti izmjene job_messages i job_events tako da radnik ne može krivotvoriti autora ili povijest.
5. Ograničiti zaključavanje naloga na vlasnika i u akciji i u bazi.
6. Ne prikazivati podatke kupca i potpisane datoteke nakon isteka approval poveznice.
7. Potvrditi namjeru oko pristupa paketnim modulima; ako je paket granica prava, prije prodaje provesti backend provjeru.
8. Za produkcijski release testirati RLS/Storage na stvarnom Supabase projektu s odvojenim owner/worker računima. PGlite test nije dokaz produkcijske konfiguracije.

### Može nakon prvih korisnika, uz praćenje

- Paginacija popisa i administratorskih pregleda prije nego radionice dođu do fiksnih limita.
- Batchiranje inspekcijskih prijedloga i optimizacija upload-a za velike dokumente nakon mjerenja na ciljanim uređajima.
- Razdvajanje javnog package registryja od cijena predložaka nakon mjerenja stvarne veličine bundlea.
- Generiranje DB tipova i ujednačavanje poruka grešaka.
- Povećanje malih mobilnih dodirnih meta prije šireg korištenja s rukavicama; postojeći glavni mobilni izbornik i osnovni vizualni stil već su prilagođeni mobitelu.

## Što je dobro napravljeno

- Tenant RLS politike vežu standardne tablice uz auth_tenant_id(), a poslovi imaju složene FK-ove koji sprječavaju povezivanje klijenta/vozila iz druge radionice: supabase/migrations/0005_rls.sql:53-60; supabase/migrations/0001_core.sql:244-248.
- Cjenici, iznosi redaka, privatni iznosi i fleet fakture imaju owner-only pravilo; pogled job_totals koristi security_invoker: supabase/migrations/0005_rls.sql:74-81; supabase/migrations/0001_core.sql:363-375. Test potvrđuje da radnik ne vidi cijene ni totals: scripts/test-rls.mjs:114-118.
- Storage bucket s radnim datotekama je privatan, a politike ograničavaju prvi direktorij na tenant i owner direktorij na vlasnika: supabase/migrations/0003_storage.sql:10-18,27-63; scripts/test-rls.mjs:146-150.
- RLS test prolazi izolaciju druge radionice i cross-tenant FK pokušaje: scripts/test-rls.mjs:133-150.
- Admin klijent je označen server-only: lib/supabase/admin.ts:1-13. U pregledanim pozivima administrativne i timske akcije imaju provjere uloge/vlasnika: lib/actions/admin.ts:11-13; lib/actions/settings.ts:74-105. Ovo ne uklanja rizike u javnim pozivima opisane u nalazima.
- Sesija provjerava Supabase korisnika, tenant status i ulogu, a requireWorkshop/requireOwner centraliziraju preusmjeravanje i zaštitu: lib/session.ts:36-91. Server Actions pregledanih tokova pozivaju requireWorkshop.
- Navigacija ima mobilni prikaz i safe-area podršku, a osnovni stil podržava tamnu i svijetlu temu te vidljivi fokus: components/AppShell.tsx:108-153; app/globals.css:8-36,73-76.
- Service worker koristi network-first za navigaciju i ne predmemorira privatne stranice kao offline sadržaj: public/sw.js:1-45.
- Auth/workshop dohvat koristi React cache uz napomenu da se rezultat dijeli unutar zahtjeva, a javna approval ruta je force-dynamic: lib/session.ts:36-45; app/approve/[token]/page.tsx:8-9. Primjeri izmjena naloga ciljano pozivaju revalidatePath: lib/actions/jobs.ts:128-129,232-253. Iz samog koda nisam potvrdio cross-request cache curenje; ponašanje navigacije i revalidacije nije testirano u browseru.

## Uputa za predaju Claude Code-u

Pregledaj ovaj izvještaj zajedno s navedenim datotekama u repozitoriju. Najprije potvrdi visoke nalaze na aktualnom kodu, zatim implementiraj popravke iz odjeljka “Popraviti prije prvog korisnika”. Ne slabi RLS radi prolaska kroz Server Actions: zaštite za naplatu, ovlasti poruka/događaja i zaključavanje moraju vrijediti i pri izravnom Supabase API pozivu. Dodaj ili proširi db:test za konkretne napadačke scenarije iz izvještaja, pa pokreni type-check, db:test i build. Ako kod potvrdi drukčije ponašanje, zabilježi odstupanje i ažuriraj nalaz umjesto da slijepo primijeniš preporuku.






