// What every Server Action returns, so client components can show one toast.
export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export function fail(error: unknown): { ok: false; error: string } {
  if (typeof error === 'string') return { ok: false, error };
  const message = (error as { message?: string } | null)?.message ?? '';
  // Messages raised by our own triggers are already in Croatian.
  if (/zaključan|voditelj|Samo /.test(message)) return { ok: false, error: message };
  if (/row-level security|permission denied/i.test(message)) return { ok: false, error: 'Nemate ovlasti za tu radnju.' };
  if (/duplicate key/i.test(message)) return { ok: false, error: 'Takav zapis već postoji.' };
  if (/violates check constraint "volt_intervention_backup_required"/.test(message)) {
    return { ok: false, error: 'Za programiranje i remap prvo spremite backup originalne datoteke.' };
  }
  if (/violates check constraint "volt_intervention_compliance_required"/.test(message)) {
    return { ok: false, error: 'Potvrdite da se ne uklanjaju sustavi za ispušne plinove.' };
  }
  // "wheel_tire_sets_width_check" → the column travels along in brackets,
  // so a form can name the field in its own words ("Provjerite polje „Širina”").
  const check = /violates check constraint "([a-z0-9_]+)"/i.exec(message);
  if (check) {
    const table = /relation "([a-z0-9_]+)"/i.exec(message)?.[1];
    const column = table && check[1].startsWith(`${table}_`) ? check[1].slice(table.length + 1).replace(/_check$/, '') : null;
    return { ok: false, error: column ? `Neki podatak nije ispravan (${column}).` : 'Neki podatak nije ispravan.' };
  }
  if (/foreign key/i.test(message)) return { ok: false, error: 'Zapis je povezan s drugim podacima.' };
  // Anything else is a bug: it goes to the tower's error list, and the
  // user gets a plain sentence.
  console.error('[action]', message);
  void import('./errors').then((m) => m.logError({ source: 'action', message, stack: (error as { stack?: string } | null)?.stack ?? null })).catch(() => {});
  return { ok: false, error: 'Nešto nije uspjelo. Pokušajte ponovno, a ako se ponovi, javite voditelju.' };
}
