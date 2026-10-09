import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { PLAY_COOKIE } from '@/config/play';

// Refreshes the Supabase session cookie on every page request and sends
// signed-out visitors of /app and /admin to the login page. A launch from
// the Google Play app marks the browser as that app (config/play.ts).
export async function middleware(request: NextRequest) {
  const fromPlay = request.nextUrl.searchParams.get('izvor') === 'play' || (request.headers.get('referer') ?? '').startsWith('android-app://');
  // The page rendered for this very request already knows it.
  if (fromPlay) request.cookies.set(PLAY_COOKIE, '1');
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const markPlay = (r: NextResponse) => {
    if (fromPlay) r.cookies.set(PLAY_COOKIE, '1', { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', httpOnly: true });
    return r;
  };

  const { pathname } = request.nextUrl;
  const isProtected = pathname === '/app' || pathname.startsWith('/app/') || pathname === '/admin' || pathname.startsWith('/admin/');
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/app' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return markPlay(NextResponse.redirect(url));
  }

  return markPlay(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icons/|sw.js|offline.html|manifest.webmanifest|favicon.ico|\\.well-known/|approve/|api/approve/|api/vapi|r/|racun/|q/|api/q/|termin/|api/cron/|api/whatsapp|api/paddle|api/health).*)'],
};
