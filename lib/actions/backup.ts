'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { fail, type ActionResult } from '@/lib/action-result';
import { backupLink, runBackup } from '@/lib/backup';
import { isPlatformAdmin } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

// Toranj: a copy now, and a short-lived link to download one.
export async function backupNow(): Promise<ActionResult<{ name: string; rows: number }>> {
  if (!(await isPlatformAdmin())) return fail('Samo administrator platforme.');
  try {
    const r = await runBackup(createAdminClient());
    revalidatePath('/admin/prostor');
    return { ok: true, data: { name: r.name, rows: r.rows } };
  } catch (error) {
    return fail(error);
  }
}

export async function downloadBackup(formData: FormData) {
  if (!(await isPlatformAdmin())) redirect('/app');
  const url = await backupLink(createAdminClient(), String(formData.get('name') ?? ''));
  redirect(url ?? '/admin/prostor');
}
