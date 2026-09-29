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
  if (/violates check constraint/i.test(message)) return { ok: false, error: 'Neki podatak nije ispravan.' };
  if (/foreign key/i.test(message)) return { ok: false, error: 'Zapis je povezan s drugim podacima.' };
  // Anything else stays in the server log; the user gets a plain sentence.
  console.error('[action]', message);
  return { ok: false, error: 'Nešto nije uspjelo. Pokušajte ponovno, a ako se ponovi, javite voditelju.' };
}
