import Anthropic from '@anthropic-ai/sdk';
import { getWorkshop } from '@/lib/session';

// POST { kind: 'prometna' | 'plocica' | 'guma', image: 'data:image/jpeg;base64,…' }
// → the text read from the photo as fields the forms understand. Nothing is
// stored: the photo goes to the model and the answer straight back to the form.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = process.env.AI_SCAN_MODEL || 'claude-sonnet-5';

const PROMPTS: Record<string, string> = {
  prometna: `Na slici je hrvatska prometna dozvola (EU potvrda o registraciji) ili slična isprava vozila.
Pročitaj i vrati JSON s ovim ključevima (null ako polje ne postoji ili se ne može pouzdano pročitati):
{"identifier": registarska oznaka (polje A) u obliku "ZG-1234-AB",
 "year": godina prve registracije (polje B) kao broj,
 "last_name": prezime ili naziv tvrtke vlasnika/korisnika (C.1.1 ili C.2.1),
 "first_name": ime (C.1.2 ili C.2.2), null za tvrtku,
 "company_name": naziv ako je vlasnik tvrtka (d.o.o., obrt…), inače null,
 "address": ulica i broj (C.1.3 ili C.2.3), "city": mjesto,
 "oib": OIB ako piše (11 znamenki),
 "make": marka (D.1), "model": trgovački naziv/model (D.3),
 "vin": identifikacijski broj vozila (E), 17 znakova,
 "fuel": jedno od "petrol","diesel","hybrid","plugin","electric","lpg","cng" (P.3), "power_kw": snaga u kW (P.2) kao broj}`,
  plocica: `Na slici je natpisna pločica uređaja (klima, dizalica topline, ventilacija, stroj, motor).
Vrati JSON (null ako nema ili nije čitljivo):
{"make": proizvođač, "model": oznaka modela, "serial": serijski broj,
 "refrigerant": radna tvar (npr. "R32", "R410A"), "charge_kg": količina punjenja u kg kao broj,
 "cooling_kw": snaga hlađenja u kW kao broj, "heating_kw": snaga grijanja u kW kao broj,
 "year": godina proizvodnje kao broj}`,
  guma: `Na slici je bok automobilske gume.
Vrati JSON (null ako nema ili nije čitljivo):
{"brand": proizvođač, "model": naziv modela gume,
 "width": širina u mm (npr. 205), "aspect": visinski omjer (npr. 55), "rim_diameter": promjer naplatka u inčima (npr. 16),
 "load_index": indeks nosivosti (npr. "91"), "speed_index": indeks brzine (npr. "V"),
 "dot_week": tjedan proizvodnje iz DOT oznake (prve dvije od zadnje 4 znamenke), "dot_year": godina proizvodnje kao četveroznamenkasti broj,
 "season": "winter" ako piše M+S sa simbolom planine/pahulje ili je zimska, "summer" ako je ljetna, "all_season" za cjelogodišnju, inače null}`,
};

// Whether the camera buttons can read yet (true once the AI key is set).
export async function GET() {
  return json({ enabled: Boolean(process.env.ANTHROPIC_API_KEY) });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const state = await getWorkshop();
  if (state.kind !== 'active') return json({ error: 'Prijavite se ponovno.' }, 401);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Čitanje slika još nije uključeno.' }, 503);

  let body: { kind?: string; image?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Neispravan zahtjev.' }, 400);
  }
  const prompt = PROMPTS[body.kind ?? ''];
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image ?? '');
  if (!prompt || !match) return json({ error: 'Neispravna slika.' }, 400);
  if (match[2].length > 7_000_000) return json({ error: 'Slika je prevelika.' }, 413);

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: match[1] as 'image/jpeg', data: match[2] } },
            { type: 'text', text: `${prompt}\nOdgovori samo JSON objektom, bez ikakvog drugog teksta. Ne izmišljaj: ono što ne vidiš jasno vrati kao null.` },
          ],
        },
      ],
    });
    const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const found = /\{[\s\S]*\}/.exec(text);
    if (!found) return json({ error: 'Na slici nije pronađen tekst. Slikajte bliže i oštrije.' }, 422);
    const data = JSON.parse(found[0]) as Record<string, unknown>;
    const filled = Object.values(data).filter((v) => v !== null && v !== '').length;
    if (!filled) return json({ error: 'Ništa nije pročitano. Slikajte bliže, ravno i bez odsjaja.' }, 422);
    return json({ data });
  } catch (error) {
    const status = (error as { status?: number }).status;
    const message = String((error as { message?: string }).message ?? '');
    if (status === 401) return json({ error: 'Čitanje slika nije ispravno spojeno (API ključ). Javite administratoru.' }, 503);
    if (/credit balance|billing/i.test(message)) return json({ error: 'Na AI računu nema kredita. Javite administratoru.' }, 503);
    if (status === 429 || status === 529) return json({ error: 'Servis je trenutno zauzet. Pokušajte za minutu.' }, 503);
    return json({ error: 'Čitanje slike nije uspjelo. Pokušajte ponovno.' }, 502);
  }
}
