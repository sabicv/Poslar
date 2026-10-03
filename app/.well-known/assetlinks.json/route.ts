// Digital Asset Links: lets the TaktiX Android app from Google Play (a
// Trusted Web Activity) open this site full screen, without the browser
// bar. Set in Vercel: ANDROID_PACKAGE_NAME (e.g. hr.taktix.app) and
// ANDROID_SHA256_FINGERPRINTS, comma-separated (the upload key and Google
// Play's app signing key, both from Play Console → App integrity).
// Without them the list is empty and the app shows a browser bar.
export const dynamic = 'force-dynamic';

const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim();
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? '')
    .split(',')
    .map((f) => f.trim().toUpperCase())
    .filter((f) => FINGERPRINT.test(f));
  const statements =
    packageName && /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(packageName) && fingerprints.length
      ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: fingerprints } }]
      : [];
  return Response.json(statements, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
