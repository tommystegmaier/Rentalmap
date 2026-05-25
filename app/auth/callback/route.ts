import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Whitelist of paths we'll redirect to after auth. `to` is just the last
// segment (no slashes) — this keeps the redirect URL Supabase-friendly and
// avoids the "Invalid path" auth error from unencoded slashes.
const TO_PATHS = new Set(['reset-password', 'landlord', 'tenant']);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const to = searchParams.get('to');
  const next = to && TO_PATHS.has(to) ? `/${to}` : '/';

  if (code) {
    const supabase = createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    if (data.user) {
      await supabase.rpc('accept_pending_invitations', { uid: data.user.id });
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
