import type { EmailOtpType } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Links from Supabase e-mails land here (new password, confirming the
// address). A token from the Croatian template works on any device; a code
// (the default template) only in the browser that asked for it. Signed in,
// the person goes on to `next`; a used or expired link goes back to ask again.
const TYPES: EmailOtpType[] = ['recovery', 'email', 'signup', 'email_change', 'invite', 'magiclink'];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = params.get('next') ?? '/app';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/app';
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;
  const code = params.get('code');
  const supabase = await createServerSupabaseClient();

  let ok = false;
  if (tokenHash && type && TYPES.includes(type)) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }
  redirect(ok ? safeNext : safeNext === '/nova-lozinka' ? '/zaboravljena-lozinka?istekla=1' : '/login');
}
