# Poslar na telefonu (Vapi)

## Kako radi

1. Mušterija zove vlasnika na mobitel.
2. Vlasnik se ne javi, odbije ili je zauzet: mobitel preusmjeri poziv na Poslarov broj radionice.
3. Javi se Poslar, u ime radionice, i kaže da se javlja automatski. Ako je mušterija u evidenciji, prepozna je
   po broju i zna njezina vozila i otvorene naloge.
4. Poslar pita što treba, uzme slobodne termine iz radnog vremena radionice
   (Postavke → Poslar na telefonu) i ponudi dva ili tri.
5. Kad se dogovore, Poslar upiše nalog u Prijem: termin, ime, broj, registraciju ili adresu, opis.
   Na nalogu piše „Dogovorio Poslar na telefonu”, a na Nalozima se upali točkica.
6. Vlasnik otvori nalog i dodirne „Potvrdi termin na WhatsApp”. Ako je Brevo API podešen,
   vlasnik dobije i e-mail „Novi termin”.
7. Nakon poziva sažetak i cijeli razgovor stoje u Postavke → Poslar na telefonu → Zadnji pozivi,
   a sažetak i na nalogu.

Vapi i pružatelji glasa naplaćuju po minuti razgovora. Grubo računaj 0,10 do 0,30 $ po minuti
ukupno; točan iznos vidiš u Vapiju nakon prvih poziva. Toranj pokazuje minute po radionici,
pa Poslara na telefonu možeš naplaćivati kao doplatu.

## 1. Broj telefona

Vapijevi besplatni brojevi su američki. Preusmjeravanje s hrvatskog mobitela na američki broj
operater naplaćuje kao međunarodni poziv, pa treba **hrvatski broj**:

1. Kupi hrvatski broj kod Twilija (twilio.com → Phone Numbers → Buy, država Hrvatska).
   Twilio za hrvatske brojeve traži podatke i dokument tvrtke (Regulatory Bundle); odobrenje traje nekoliko dana.
2. U Vapiju: Phone Numbers → Import → Twilio, upiši Account SID i Auth Token iz Twilija i odaberi broj.

## 2. Asistent u Vapiju

Vapi → Assistants → Create Assistant (Blank).

- **Model:** kad je `OPENROUTER_API_KEY` postavljen, Poslar na svaki poziv sam stavi Claude Haiku (`AI_VAPI_MODEL`, inače `anthropic/claude-haiku-4.5`). Ključ ostaje u Poslaru. Bez ključa vrijedi model koji odabereš ovdje (npr. OpenAI gpt-4o).
- **Transcriber** (razumijevanje govora): onaj koji podržava hrvatski (npr. Azure ili Google, jezik `hr-HR`).
- **Voice:** Azure `hr-HR-SreckoNeural` (muški; Poslar je „on”, pa u prošlom vremenu kaže „upisao sam”),
  ili ElevenLabs višejezični glas. Poslušaj par rečenica pa odaberi.
- **Izgovor imena:** hrvatski glas čita „Poslar” kako piše, s naglaskom na prvom slogu, kao „stolar”.
  Provjeri probnim razgovorom u Vapiju. Ako ga izgovori krivo, javi: pozdrav i upute mogu ime
  pisati onako kako glas treba izgovoriti (npr. „Póslar”), a u aplikaciji ostaje „Poslar”.
- **First Message:** `{{pozdrav}}`
- **Max duration:** 5 minuta.
- **Recording:** za početak isključi. Ako ga uključiš, u prvu poruku dodaj „Razgovor se snima.”

**System Prompt** (zalijepi cijelo):

```
Ti si Poslar. Javljaš se na telefon radionice {{radionica}} ({{zanat}}) kad majstor ne može.
Danas je {{danas}}. Radno vrijeme: {{radno_vrijeme}}.
O pozivatelju: {{pozivatelj}}
Rezervacije telefonom moguće: {{rezervacije}}.

Kako razgovaraš:
- Standardni hrvatski jezik, kratke rečenice, ljubazno. Pozivatelju se obraćaš s "Vi".
- Ime ti je Poslar. Ne zovi se asistentom, robotom ni umjetnom inteligencijom.
- U pozdravu si rekao da se javljaš automatski. Ne glumi čovjeka: ako pitaju, reci da nisi čovjek nego Poslar, program koji prima pozive za majstora.
- Jedno pitanje odjednom.

Što radiš:
1. Saznaj što treba (kvar ili usluga) i {{sto_pitati}}.
2. Ako treba doći: pozovi alat slobodni_termini i ponudi dva ili tri termina. Ako pozivatelj želi određeni dan, pošalji ga u polju dan (GGGG-MM-DD).
3. Kad pozivatelj izabere termin: pitaj ime i prezime ako ga ne znaš, pa pozovi rezerviraj_termin s točnom vrijednošću "termin" iz popisa.
4. Na kraju ponovi dan i sat i reci da će majstor poslati potvrdu porukom.
5. Ako pita je li vozilo ili posao gotov: pozovi stanje_naloga.
6. Ako rezervacije nisu moguće ("ne") ili nema slobodnog termina: uzmi ime i kratku poruku i reci da će majstor nazvati.

Nikad:
- Ne izmišljaj cijene, dijagnoze ni rokove. Za cijenu reci da će je majstor javiti nakon pregleda.
- Ne obećavaj termin koji alat nije vratio.
- Ne čitaj naglas oznake ni datume u obliku 2026-10-07T07:00; termin izgovori kao u opisu.
```

## 3. Alati (Tools)

Vapi → Tools → Create Tool → Function, tri puta. Svakom alatu:
Server URL `https://TVOJA-DOMENA/api/vapi`, a kao tajnu (secret) isti niz kao `VAPI_SERVER_SECRET`.
Zatim ih u asistentu dodaj pod Tools.

**slobodni_termini**: „Vraća slobodne termine radionice.”

```json
{ "type": "object", "properties": { "dan": { "type": "string", "description": "Željeni dan GGGG-MM-DD, samo ako ga pozivatelj spomene" } } }
```

**rezerviraj_termin**: „Upisuje dogovoreni termin kao nalog u radionici.”

```json
{
  "type": "object",
  "required": ["termin", "ime_prezime", "opis"],
  "properties": {
    "termin": { "type": "string", "description": "Točna vrijednost termin iz alata slobodni_termini" },
    "ime_prezime": { "type": "string", "description": "Ime i prezime pozivatelja" },
    "opis": { "type": "string", "description": "Kratak opis kvara ili posla, riječima pozivatelja" },
    "registracija": { "type": "string", "description": "Registracija vozila, ako je ima" },
    "adresa": { "type": "string", "description": "Adresa na koju majstor dolazi (rad na terenu)" },
    "mjesto": { "type": "string", "description": "Mjesto ili grad (rad na terenu)" },
    "telefon": { "type": "string", "description": "Broj za kontakt, samo ako je drugačiji od broja s kojeg zove" }
  }
}
```

**stanje_naloga**: „Kaže stanje otvorenih naloga pozivatelja (po broju s kojeg zove).”

```json
{ "type": "object", "properties": {} }
```

## 4. Spajanje

1. Vercel → Environment Variables:
   - `VAPI_SERVER_SECRET`: izmisli dugačak niz (barem 32 znaka, slova i brojke). Nikome ga ne šalji.
   - `VAPI_ASSISTANT_ID`: ID asistenta iz Vapija (Assistants → tvoj asistent → ID).
   - po želji `BREVO_API_KEY` i `MAIL_FROM` (e-mail vlasniku o novom terminu)
2. `npx vercel deploy --prod`
3. Vapi → Phone Numbers → tvoj broj:
   - **Assistant: ostavi prazno** (tada Vapi pita našu aplikaciju koja je radionica i tko zove)
   - Server URL `https://TVOJA-DOMENA/api/vapi`, Secret isti kao `VAPI_SERVER_SECRET`
4. U asistentu (Advanced → Server URL) isto: `https://TVOJA-DOMENA/api/vapi` i Secret,
   a pod Server Messages uključi `end-of-call-report` i `tool-calls`.
5. Toranj → Radionice → Uredi → **Poslar na telefonu**: Vapi ID broja (Phone Numbers → ID) i sam broj
   (npr. `+385 1 234 5678`) → Spremi.
6. Vlasnik u aplikaciji: Postavke → Poslar na telefonu → radno vrijeme, trajanje termina, koliko poslova odjednom.
7. Vlasnik na mobitelu upiše kodove za preusmjeravanje (pišu u Postavke → Poslar na telefonu) i nazove ih.

## 5. Prvi probni poziv

Za probu spoji broj na demo radionicu (npr. Autoelektričar). Nazovi vlasnikov mobitel s drugog broja,
odbij poziv i razgovaraj s Poslarom. Provjeri:

- je li te pozdravio imenom radionice i ponudio termine iz radnog vremena;
- je li se nalog pojavio u Prijemu s oznakom „Poslar” i terminom;
- je li poziv sa sažetkom u Postavke → Poslar na telefonu → Zadnji pozivi.

Ako nešto ne radi, u Vapiju otvori Call Logs i pošalji mi što piše (bez ključeva i tajni).

## 6. Zajednički Poslar broj (jedan broj za sve radionice)

Umjesto broja po radionici, sve radionice preusmjeravaju na jedan Poslar broj. Radionica se prepoznaje po mobitelu **koji je preusmjerio** poziv (nikad po onome tko zove). To radi samo ako operater pošalje taj broj (Twilio ga zove ForwardedFrom, u SIP-u je to Diversion).

1. U Vapiju uvezi Poslar broj (kao u koraku 1) i postavi Server URL i Secret kao u koraku 4.3.
2. Vercel → Environment Variables:
   - `POSLAR_PHONE_NUMBER`: broj kako ga vlasnici vide, npr. `+385 1 555 0000`
   - `VAPI_SHARED_NUMBER_ID`: Vapi ID tog broja (Phone Numbers → ID)
3. `npx vercel deploy --prod`
4. Vlasnik u aplikaciji: Postavke → Poslar na telefonu → upiše mobitel s kojeg preusmjerava → Spremi. Tada vidi kodove sa zajedničkim brojem.
5. Probni poziv (A1, HT, Telemach): nazovi taj mobitel s drugog broja i odbij poziv.
   - Javi li se Poslar imenom radionice: radi.
   - Javi li se "Ovaj broj još nije povezan s radionicom": operater nije poslao broj. U Tornju → Greške piše "poziv bez radionice" i koja polja je Vapi poslao. Pošalji mi to.

Radionica koja ima svoj broj (Toranj → Radionice → Poslar na telefonu) i dalje radi po svom broju.

Paketi broje **pozive** (Basic 100, Standard 200, Premium 400 mjesečno), a jedan poziv traje najviše 60 sekundi. U asistentu u Vapiju neka u uputama stoji da razgovor bude kratak: kvar, ime, broj, termin, kraj.
