import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Browsers cap persistent cookies at 400 days. Without an explicit maxAge,
// Supabase auth cookies are session-only and die when the browser/PWA closes —
// which forces tenants to re-log-in constantly.
const ONE_YEAR_PLUS = 60 * 60 * 24 * 400;

function withPersistentMaxAge(options: CookieOptions): CookieOptions {
  return { ...options, maxAge: options.maxAge ?? ONE_YEAR_PLUS };
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Supabase isn't configured yet — let pages render so the user sees setup hints.
    return response;
  }

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          const persistent = withPersistentMaxAge(options);
          request.cookies.set({ name, value, ...persistent });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value, ...persistent });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage =
    path.startsWith('/login') ||
    path.startsWith('/signup') ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/reset-password') ||
    path.startsWith('/welcome') ||
    path.startsWith('/invite') ||
    path.startsWith('/auth');
  const isPublic = path === '/' || path.startsWith('/_next') || path.startsWith('/icons') || path.startsWith('/api/cron') || path.startsWith('/api/stripe/webhook');

  if (!user && !isAuthPage && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  if (user && (path === '/' || path === '/login' || path === '/signup')) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const url = request.nextUrl.clone();
    url.pathname = profile?.role === 'landlord' ? '/landlord' : '/tenant';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
