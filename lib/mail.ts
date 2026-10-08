import 'server-only';

// A plain e-mail from the app through Brevo's API (BREVO_API_KEY and the
// sender MAIL_FROM, a sender verified in Brevo). Not set: nothing is sent
// and nothing breaks. Sign-in mail (new password) goes through Supabase.
// Attachments (the accountant's package) and a reply-to (the workshop, so
// an answer goes to it and not to Poslar) are optional.
export async function sendMail(
  to: string,
  subject: string,
  text: string,
  options: { attachments?: { name: string; data: Uint8Array | string }[]; replyTo?: string | null } = {}
): Promise<boolean> {
  const key = process.env.BREVO_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!key || !from || !to) return false;
  try {
    // BREVO_API_URL only for tests (a local stand-in).
    const res = await fetch(process.env.BREVO_API_URL?.trim() || 'https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: process.env.MAIL_FROM_NAME?.trim() || 'Poslar', email: from },
        to: [{ email: to }],
        subject,
        textContent: text,
        ...(options.replyTo ? { replyTo: { email: options.replyTo } } : {}),
        ...(options.attachments?.length ? { attachment: options.attachments.map((a) => ({ name: a.name, content: Buffer.from(a.data).toString('base64') })) } : {}),
      }),
      signal: AbortSignal.timeout(options.attachments?.length ? 15000 : 6000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
