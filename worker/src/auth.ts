// Checks a Firebase ID token (the app's Google sign-in) without the Firebase Admin SDK: the token is a
// JWT signed by Google, verified against Google's published keys as described in Firebase's
// "Verify ID tokens using a third-party JWT library" guide.
import { fromB64url, utf8 } from './base64.ts';

const KEYS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const RSA = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
const SKEW = 60; // seconds of clock difference tolerated

export class AuthError extends Error {}

export interface SignedInUser {
  uid: string;
  email: string | null;
  name: string | null;
}

// Google's keys rotate every few hours; they are cached for as long as Google's Cache-Control allows.
let keys: { fetched: number; until: number; byKid: Map<string, CryptoKey> } | null = null;

async function publicKey(kid: string): Promise<CryptoKey | undefined> {
  const now = Date.now();
  const stale = !keys || keys.until < now;
  const unknownKid = keys && !keys.byKid.has(kid) && now - keys.fetched > 60_000;
  if (stale || unknownKid) {
    const res = await fetch(KEYS_URL);
    if (!res.ok) throw new Error(`Google sign-in keys: ${res.status}`);
    const maxAge = Number(
      /max-age=(\d+)/.exec(res.headers.get('Cache-Control') ?? '')?.[1] ?? 3600,
    );
    const { keys: list } = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
    const byKid = new Map<string, CryptoKey>();
    for (const k of list)
      byKid.set(
        k.kid,
        await crypto.subtle.importKey('jwk', { kty: k.kty, n: k.n, e: k.e }, RSA, false, [
          'verify',
        ]),
      );
    keys = { fetched: now, until: now + maxAge * 1000, byKid };
  }
  return keys?.byKid.get(kid);
}

export async function verifyIdToken(token: string, projectId: string): Promise<SignedInUser> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('malformed token');
  const [head, body, sig] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = JSON.parse(new TextDecoder().decode(fromB64url(head)));
    claims = JSON.parse(new TextDecoder().decode(fromB64url(body)));
  } catch {
    throw new AuthError('malformed token');
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new AuthError('bad header');
  const key = await publicKey(header.kid);
  if (!key) throw new AuthError('unknown key');
  const ok = await crypto.subtle.verify(RSA, key, fromB64url(sig), utf8(`${head}.${body}`));
  if (!ok) throw new AuthError('bad signature');

  const now = Date.now() / 1000;
  const num = (k: string) => (typeof claims[k] === 'number' ? (claims[k] as number) : NaN);
  if (claims.aud !== projectId) throw new AuthError('wrong project');
  if (claims.iss !== `https://securetoken.google.com/${projectId}`)
    throw new AuthError('wrong issuer');
  if (!(num('exp') > now - SKEW)) throw new AuthError('expired');
  if (!(num('iat') <= now + SKEW)) throw new AuthError('issued in the future');
  if (!(num('auth_time') <= now + SKEW)) throw new AuthError('signed in in the future');
  const sub = claims.sub;
  if (typeof sub !== 'string' || sub.length === 0 || sub.length > 128)
    throw new AuthError('no user');
  return {
    uid: sub,
    email: typeof claims.email === 'string' ? claims.email : null,
    name: typeof claims.name === 'string' ? claims.name : null,
  };
}
