// Access token for Google APIs from the Firebase service-account key (.secrets/firebase-admin.json,
// git-ignored). Signs a JWT with node:crypto, so no extra dependency is needed.
import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

const KEY_FILE = join(import.meta.dirname, '..', '..', '.secrets', 'firebase-admin.json');

export function serviceAccount(): ServiceAccount {
  if (!existsSync(KEY_FILE))
    throw new Error(
      `No service-account key at ${KEY_FILE}.\n` +
        'Firebase console → Settings → Service accounts → Generate new private key; save it there.',
    );
  return JSON.parse(readFileSync(KEY_FILE, 'utf8')) as ServiceAccount;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

export async function accessToken(scopes: string[]): Promise<string> {
  const sa = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: scopes.join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Google token request failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** fetch with the bearer token; throws with the response text on failure */
export async function google(token: string, url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${url} → ${res.status}\n${text}`);
  return text ? JSON.parse(text) : undefined;
}

export const DATASTORE = 'https://www.googleapis.com/auth/datastore';
export const CLOUD = 'https://www.googleapis.com/auth/cloud-platform';
export const FIREBASE = 'https://www.googleapis.com/auth/firebase';
