import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { TradeLanding } from '@/components/landing/TradeLanding';
import { tradeBySlug } from '@/config/landing';
import { PACKAGES } from '@/config/tenant.config';
import { isPlayApp } from '@/lib/play';
import { getAuth } from '@/lib/session';

// One page per trade: /zanat/automehanicar, /zanat/vodoinstalater …
// Rendered per request, like the home page: the header knows who is signed
// in and the Google Play app goes straight to /app.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const trade = tradeBySlug((await params).slug);
  if (!trade) return {};
  return { title: { absolute: PACKAGES[trade.id].product }, description: trade.subtitle };
}

export default async function TradePage({ params }: { params: Promise<{ slug: string }> }) {
  if (await isPlayApp()) redirect('/app');
  const trade = tradeBySlug((await params).slug);
  if (!trade) notFound();
  const { user } = await getAuth();
  return <TradeLanding trade={trade} signedIn={Boolean(user)} ownDomain={false} />;
}
