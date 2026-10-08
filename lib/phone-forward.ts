import 'server-only';
import { internationalDigits } from '@/lib/contact';

// Zajednički Poslar broj: which mobile forwarded the call. Carriers pass it
// on as Twilio's ForwardedFrom or a SIP Diversion header, and Vapi has put
// provider details in more than one place, so every field with such a
// name is looked at. Only the forwarding number is used, never the caller.

const KEYS = /^(forwarded_?from|diversion|x-?forwarded-?from|original_?called(_?number)?)$/i;

// "<sip:+385912345678@…>;reason=no-answer" or "+385 91 234 5678" → digits.
function digitsIn(value: string): string | null {
  const m = /\+?\d[\d\s/-]{6,}\d/.exec(value);
  return m ? internationalDigits(m[0]) : null;
}

export function forwardedFrom(payload: unknown, depth = 0): string | null {
  if (!payload || typeof payload !== 'object' || depth > 7) return null;
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (KEYS.test(key)) {
      const v = Array.isArray(value) ? value[0] : value;
      if (typeof v === 'string') {
        const d = digitsIn(v);
        if (d) return d;
      }
    }
  }
  for (const value of Object.values(payload as Record<string, unknown>)) {
    const found = forwardedFrom(value, depth + 1);
    if (found) return found;
  }
  return null;
}

// The shared number, when Poslar runs one (POSLAR_PHONE_NUMBER for people,
// VAPI_SHARED_NUMBER_ID for Vapi).
export function sharedNumber(): { number: string; id: string | null } | null {
  const number = process.env.POSLAR_PHONE_NUMBER?.trim();
  return number ? { number, id: process.env.VAPI_SHARED_NUMBER_ID?.trim() || null } : null;
}
