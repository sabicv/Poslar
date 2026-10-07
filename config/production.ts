// The body shop's production stages, in order (body_production_phases.phase).
// Shared by the job's module tab, the production board and its quick
// "next stage" action.
export const BODY_PHASES = {
  disassembly: 'Rastavljanje',
  bodywork: 'Limarija',
  prep: 'Priprema',
  paint: 'Lakiranje',
  assembly: 'Sastavljanje',
  polish: 'Poliranje',
  quality: 'Kontrola',
  wash: 'Pranje',
} as const;

export type BodyPhase = keyof typeof BODY_PHASES;
export const BODY_PHASE_ORDER = Object.keys(BODY_PHASES) as BodyPhase[];

// The stage after this one; null after the last. No stage yet: the first.
export function nextBodyPhase(current: string | null): BodyPhase | null {
  if (!current) return BODY_PHASE_ORDER[0];
  const i = BODY_PHASE_ORDER.indexOf(current as BodyPhase);
  return i >= 0 && i < BODY_PHASE_ORDER.length - 1 ? BODY_PHASE_ORDER[i + 1] : null;
}
