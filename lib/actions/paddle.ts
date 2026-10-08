'use server';

import { redirect } from 'next/navigation';
import { paddleConfig, portalUrl } from '@/lib/paddle';
import { requireOwner } from '@/lib/session';

// "Kartica i računi": Paddle's page for the card and its invoices.
export async function openCardPortal() {
  const ctx = await requireOwner();
  const cfg = paddleConfig();
  const customer = ctx.tenant.paddle_customer_id;
  if (!cfg || !customer) redirect('/app/settings/pretplata');
  const url = await portalUrl(cfg, customer, ctx.tenant.paddle_subscription_id ?? null);
  redirect(url ?? '/app/settings/pretplata?kartica=greska');
}
