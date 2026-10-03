import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

// Reading a photo (registration card, nameplate, tyre) into form fields.
// Used by the app (/api/scan) and the door QR page (/api/q/scan). Nothing
// is stored: the photo goes to the model and the answer back to the form.

const MODEL = process.env.AI_SCAN_MODEL || 'claude-sonnet-5';

export const SCAN_PROMPTS: Record<string, string> = {
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
  plocica: `Na slici je natpisna pločica uređaja (klima, dizalica topline, ventilacija, bojler, plinski kotao, pumpa, stroj, motor).
Vrati JSON (null ako nema ili nije čitljivo):
{"make": proizvođač, "model": oznaka modela, "serial": serijski broj,
 "refrigerant": radna tvar (npr. "R32", "R410A"), "charge_kg": količina punjenja u kg kao broj,
 "cooling_kw": snaga hlađenja u kW kao broj, "heating_kw": snaga grijanja u kW kao broj,
 "capacity_l": volumen spremnika u litrama kao broj, "power_kw": snaga grijača ili kotla u kW kao broj,
 "pressure_bar": najveći radni tlak u bar kao broj,
 "year": godina proizvodnje kao broj}`,
  guma: `Na slici je bok automobilske gume.
Vrati JSON (null ako nema ili nije čitljivo):
{"brand": proizvođač, "model": naziv modela gume,
 "width": širina u mm (npr. 205), "aspect": visinski omjer (npr. 55), "rim_diameter": promjer naplatka u inčima (npr. 16),
 "load_index": indeks nosivosti (npr. "91"), "speed_index": indeks brzine (npr. "V"),
 "dot_week": tjedan proizvodnje iz DOT oznake (prve dvije od zadnje 4 znamenke), "dot_year": godina proizvodnje kao četveroznamenkasti broj,
 "season": "winter" ako piše M+S sa simbolom planine/pahulje ili je zimska, "summer" ako je ljetna, "all_season" za cjelogodišnju, inače null}`,
};

export type ScanOutcome = { status: number; body: Record<string, unknown> };

export function parseScanRequest(body: { kind?: string; image?: string }): { prompt: string; mediaType: string; data: string } | ScanOutcome {
  const prompt = SCAN_PROMPTS[body.kind ?? ''];
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image ?? '');
  if (!prompt || !match) return { status: 400, body: { error: 'Neispravna slika.' } };
  if (match[2].length > 7_000_000) return { status: 413, body: { error: 'Slika je prevelika.' } };
  return { prompt, mediaType: match[1], data: match[2] };
}

// onUsage runs as soon as the model has answered: the photo was read and paid for.
export async function readPhoto(
  req: { prompt: string; mediaType: string; data: string },
  onUsage: (usage: { model: string; input: number; output: number }) => Promise<void>
): Promise<ScanOutcome> {
  if (!process.env.ANTHROPIC_API_KEY) return { status: 503, body: { error: 'Čitanje slika još nije uključeno.' } };
  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: req.mediaType as 'image/jpeg', data: req.data } },
            { type: 'text', text: `${req.prompt}\nOdgovori samo JSON objektom, bez ikakvog drugog teksta. Ne izmišljaj: ono što ne vidiš jasno vrati kao null.` },
          ],
        },
      ],
    });
    await onUsage({ model: message.model, input: message.usage.input_tokens, output: message.usage.output_tokens });
    const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const found = /\{[\s\S]*\}/.exec(text);
    if (!found) return { status: 422, body: { error: 'Na slici nije pronađen tekst. Slikajte bliže i oštrije.' } };
    const data = JSON.parse(found[0]) as Record<string, unknown>;
    const filled = Object.values(data).filter((v) => v !== null && v !== '').length;
    if (!filled) return { status: 422, body: { error: 'Ništa nije pročitano. Slikajte bliže, ravno i bez odsjaja.' } };
    return { status: 200, body: { data } };
  } catch (error) {
    const status = (error as { status?: number }).status;
    const message = String((error as { message?: string }).message ?? '');
    if (status === 401) return { status: 503, body: { error: 'Čitanje slika nije ispravno spojeno (API ključ). Javite administratoru.' } };
    if (/credit balance|billing/i.test(message)) return { status: 503, body: { error: 'Na AI računu nema kredita. Javite administratoru.' } };
    if (status === 429 || status === 529) return { status: 503, body: { error: 'Servis je trenutno zauzet. Pokušajte za minutu.' } };
    return { status: 502, body: { error: 'Čitanje slike nije uspjelo. Pokušajte ponovno.' } };
  }
}

export function scanJson(outcome: ScanOutcome): Response {
  return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
