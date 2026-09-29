// Links that open the phone's own apps — no paid API, works on every phone.

// "091 234 5678" / "+385 91…" / "00385…" → "385912345678" for wa.me.
export function internationalDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `385${digits.slice(1)}`;
  return digits.length >= 8 ? digits : null;
}

export function whatsappLink(phone: string | null | undefined, message: string): string {
  const digits = internationalDigits(phone);
  return `https://wa.me/${digits ?? ''}?text=${encodeURIComponent(message)}`;
}

export function smsLink(phone: string | null | undefined, message: string): string {
  const digits = internationalDigits(phone);
  return `sms:${digits ? `+${digits}` : ''}?body=${encodeURIComponent(message)}`;
}

export interface Place {
  address: string;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
}

const placeQuery = (p: Place) => [p.address, p.city].filter(Boolean).join(', ');

export function googleMapsLink(p: Place): string {
  const destination = p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : placeQuery(p);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

export function wazeLink(p: Place): string {
  return p.lat != null && p.lng != null
    ? `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(placeQuery(p))}&navigate=yes`;
}

// The day's visits in order, as one Google Maps route (up to 9 stops in between).
export function dayRouteLink(places: Place[]): string | null {
  if (places.length === 0) return null;
  const stops = places.slice(0, 10).map((p) => (p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : placeQuery(p)));
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}${
    waypoints.length ? `&waypoints=${encodeURIComponent(waypoints.join('|'))}` : ''
  }&travelmode=driving`;
}
