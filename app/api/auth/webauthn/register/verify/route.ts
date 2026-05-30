import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { createClient } from '@/lib/supabase/server';
import {
  getRpConfig,
  publicKeyToString,
  REG_CHALLENGE_COOKIE,
} from '@/lib/webauthn';

// Step 2 of passkey registration. Verifies the attestation and stores the
// credential against the signed-in user.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const expectedChallenge = cookies().get(REG_CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Challenge expired — try again.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { rpID, origin } = getRpConfig(request);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed' },
      { status: 400 },
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Could not verify passkey' }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;

  const { error } = await supabase.from('user_passkeys').insert({
    user_id: user.id,
    credential_id: credential.id,
    public_key: publicKeyToString(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports?.join(',') ?? null,
    device_label: typeof body.label === 'string' ? body.label.slice(0, 60) : null,
  });

  if (error) {
    // Unique violation = this credential is already enrolled.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This device is already set up.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(REG_CHALLENGE_COOKIE);
  return res;
}
