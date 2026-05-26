import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Browser cap. Without this, auth cookies are session-only and die on PWA close.
const ONE_YEAR_PLUS = 60 * 60 * 24 * 400;

function withPersistentMaxAge(options: CookieOptions): CookieOptions {
  return { ...options, maxAge: options.maxAge ?? ONE_YEAR_PLUS };
}

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...withPersistentMaxAge(options) });
          } catch {
            // Server Components cannot set cookies; middleware handles refresh.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // ignore
          }
        },
      },
    },
  );
}

export function createServiceRoleClient() {
  // Use the plain supabase-js client (no cookie store) so the service role key
  // is the only credential sent. Using createServerClient here caused it to
  // forward the tenant's session cookie as an Authorization header, which
  // triggered RLS as the tenant instead of bypassing it.
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
