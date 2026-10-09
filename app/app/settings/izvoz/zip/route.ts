import { NextResponse } from 'next/server';
import { exportWorkshop } from '@/lib/export';
import { requireOwner } from '@/lib/session';

export const maxDuration = 60;

export async function GET(request: Request) {
  const ctx = await requireOwner();
  try {
    const url = await exportWorkshop(ctx.supabase, ctx.tenant.id, ctx.tenant.name);
    return NextResponse.redirect(url, { status: 303, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('export', e);
    return NextResponse.redirect(new URL('/app/settings/izvoz?greska=1', request.url), 303);
  }
}
