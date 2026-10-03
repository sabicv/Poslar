import 'server-only';
import { cookies } from 'next/headers';
import { PLAY_COOKIE } from '@/config/play';

// Inside the Google Play app: no prices, payment slip or plan requests.
export async function isPlayApp(): Promise<boolean> {
  return (await cookies()).get(PLAY_COOKIE)?.value === '1';
}
