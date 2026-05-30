// Shared WebAuthn (passkey) server config + small encoding helpers.
//
// Relying-Party (RP) ID must be the registrable domain (no scheme, no port).
// We derive it from the request host so it works across preview/prod domains,
// but allow an explicit override via env for custom-domain setups.

export interface RpConfig {
  rpID: string;
  rpName: string;
  origin: string;
}

export function getRpConfig(request: Request): RpConfig {
  const host = request.headers.get('host') ?? 'localhost';
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const rpID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID ?? host.split(':')[0];
  const origin = process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN ?? `${proto}://${host}`;
  return { rpID, rpName: 'It Rents', origin };
}

// COSE public keys are stored as base64url text in Postgres.
export function publicKeyToString(key: Uint8Array): string {
  return Buffer.from(key).toString('base64url');
}

export function publicKeyFromString(str: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(str, 'base64url');
  // Copy into a fresh ArrayBuffer-backed view (not SharedArrayBuffer) so the
  // type matches what @simplewebauthn/server expects.
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}

// Short-lived cookies hold the per-ceremony challenge between the two
// round-trips (options -> verify). httpOnly so client JS can't touch them.
export const REG_CHALLENGE_COOKIE = 'webauthn_reg_challenge';
export const AUTH_CHALLENGE_COOKIE = 'webauthn_auth_challenge';

export const challengeCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 300,
};
