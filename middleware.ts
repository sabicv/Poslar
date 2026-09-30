import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Refreshes the Supabase session cookie on every page request and sends
// signed-out visitors of /app and /admin to the login page.
export async function middleware(request: NextRequest) {
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

  const { pathname } = request.nextUrl;
  const isProtected = pathname === '/app' || pathname.startsWith('/app/') || pathname === '/admin' || pathname.startsWith('/admin/');
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/app' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icons/|sw.js|offline.html|manifest.webmanifest|favicon.ico|approve/|api/approve/|r/|racun/).*)'],
};
