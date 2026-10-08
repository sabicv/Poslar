// Automatske poruke mušterijama (WhatsApp Business, Meta Cloud API). Each
// one is a template approved by Meta under exactly this name and language,
// with the body text below ({{1}}… are filled per message). docs/WHATSAPP.md
// tells how to submit them. Category: Utility (about the customer's own job).

export type WaKind = 'confirm' | 'reminder' | 'ready' | 'stage';

export interface WaTemplate {
  name: string;
  label: string;
  // What the owner reads in Postavke.
  hint: string;
  body: string;
}

export const WA_LANGUAGE = 'hr';

export const WA_TEMPLATES: Record<WaKind, WaTemplate> = {
  confirm: {
    name: 'poslar_potvrda_termina',
    label: 'Potvrda termina',
    hint: 'Kad dodirnete „Potvrdi termin” u nalogu.',
    body: 'Poštovani, {{1}} potvrđuje Vaš termin: {{2}}. Mjesto: {{3}}. Ako trebate drugi termin, odgovorite na ovu poruku.',
  },
  reminder: {
    name: 'poslar_podsjetnik_termina',
    label: 'Podsjetnik dan prije',
    hint: 'Navečer prije termina, samo jednom.',
    body: 'Podsjetnik: sutra, {{1}}, imate termin kod {{2}}. Mjesto: {{3}}. Ako ne možete doći, odgovorite na ovu poruku.',
  },
  ready: {
    name: 'poslar_posao_gotov',
    label: 'Posao je gotov',
    hint: 'Kad nalog prijeđe u „Gotovo”.',
    body: 'Poštovani, {{1}} javlja da je posao gotov: {{2}}. Možete doći u radno vrijeme. Hvala na povjerenju!',
  },
  stage: {
    name: 'poslar_faza_popravka',
    label: 'Faze popravka (limar)',
    hint: 'Kad popravak krene u novu fazu (limarija, lakiranje…).',
    body: 'Poštovani, {{1}} javlja: popravak vozila {{2}} je u fazi {{3}}. Javit ćemo Vam kad bude gotovo.',
  },
};

// Every kind on unless the owner switched it off (settings.whatsapp).
export function waEnabled(settings: unknown, kind: WaKind): boolean {
  const s = (settings as { whatsapp?: Partial<Record<WaKind, boolean>> } | null)?.whatsapp;
  return s?.[kind] !== false;
}
