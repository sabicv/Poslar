import 'server-only';

// A plain e-mail from the app through Brevo's API (BREVO_API_KEY and the
// sender MAIL_FROM, a sender verified in Brevo). Not set: nothing is sent
// and nothing breaks. Sign-in mail (new password) goes through Supabase.
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.BREVO_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!key || !from || !to) return false;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { name: process.env.MAIL_FROM_NAME?.trim() || 'Poslar', email: from }, to: [{ email: to }], subject, textContent: text }),
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
