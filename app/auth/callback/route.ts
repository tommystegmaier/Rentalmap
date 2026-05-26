import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Whitelist of paths we'll redirect to after auth. `to` is just the last
// segment (no slashes) — this keeps the redirect URL Supabase-friendly and
// avoids the "Invalid path" auth error from unencoded slashes.
const TO_PATHS = new Set(['reset-password', 'landlord', 'tenant', 'welcome']);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const to = searchParams.get('to');
  const next = to && TO_PATHS.has(to) ? `/${to}` : '/';

  const supabase = createClient();
  let userId: string | null = null;

  // Preferred path: token_hash + type. Works for server-initiated emails
  // (invites, password resets) because it doesn't require a PKCE
  // code_verifier cookie — which never exists for admin-API invites and
  // was causing "Link expired" on the welcome screen.
  if (tokenHash && type) {
    const { data } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (data.user) userId = data.user.id;
  } else if (code) {
    // Legacy PKCE path — kept for browser-initiated magic links where the
    // code_verifier cookie does exist.
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    if (data.user) userId = data.user.id;
  }

  if (userId) {
    await supabase.rpc('accept_pending_invitations', { uid: userId });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
