// Firestore over its REST API as the Firebase service account (which bypasses the security rules in
// /firestore.rules). The key is the FIREBASE_SERVICE_ACCOUNT secret; the access token is signed here with
// Web Crypto, the same way scripts/lib/google.ts does it with node:crypto.
import { b64url, utf8 } from './base64.ts';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

type Value =
  | { stringValue: string }
  | { integerValue: string }
  | { timestampValue: string }
  | { nullValue: null };

export interface Doc {
  name: string;
  fields?: Record<string, Value>;
}

export type Fields = Record<string, string | number | Date | null>;

const SCOPE = 'https://www.googleapis.com/auth/datastore';

// An access token lasts an hour, so one is reused across requests until shortly before it runs out.
let cached: { email: string; token: string; until: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.email === sa.client_email && cached.until > Date.now() + 60_000)
    return cached.token;
  const der = Uint8Array.from(
    atob(sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '')),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, utf8(unsigned));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token request failed: ${res.status} ${await res.text()}`);
  const { access_token, expires_in } = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cached = { email: sa.client_email, token: access_token, until: Date.now() + expires_in * 1000 };
  return access_token;
}

export function toFields(data: Fields): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const [k, v] of Object.entries(data))
    out[k] =
      v === null
        ? { nullValue: null }
        : v instanceof Date
          ? { timestampValue: v.toISOString() }
          : typeof v === 'number'
            ? { integerValue: String(Math.round(v)) }
            : { stringValue: v };
  return out;
}

export const str = (doc: Doc | null | undefined, k: string): string | null => {
  const v = doc?.fields?.[k];
  return v && 'stringValue' in v ? v.stringValue : null;
};
export const int = (doc: Doc | null | undefined, k: string): number | null => {
  const v = doc?.fields?.[k];
  return v && 'integerValue' in v ? Number(v.integerValue) : null;
};
/** a timestamp field as ms since 1970 */
export const time = (doc: Doc | null | undefined, k: string): number | null => {
  const v = doc?.fields?.[k];
  return v && 'timestampValue' in v ? Date.parse(v.timestampValue) : null;
};

export type Write =
  | {
      update: { name: string; fields: Record<string, Value> };
      currentDocument?: { exists: boolean };
    }
  | { delete: string };

export class Firestore {
  readonly project: string;
  private sa: ServiceAccount;

  constructor(serviceAccountJson: string) {
    this.sa = JSON.parse(serviceAccountJson) as ServiceAccount;
    this.project = this.sa.project_id;
  }

  private get root() {
    return `projects/${this.project}/databases/(default)/documents`;
  }

  /** full document name for a path like `entitlements/abc` */
  name(path: string) {
    return `${this.root}/${path}`;
  }

  private async call(url: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`https://firestore.googleapis.com/v1/${url}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${await accessToken(this.sa)}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private async json<T>(url: string, body: unknown): Promise<T> {
    const res = await this.call(url, { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) throw new FirestoreError(`${url} → ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }

  async get(path: string): Promise<Doc | null> {
    const res = await this.call(this.name(path));
    if (res.status === 404) return null;
    if (!res.ok) throw new FirestoreError(`GET ${path} → ${res.status} ${await res.text()}`);
    return (await res.json()) as Doc;
  }

  async beginTransaction(): Promise<string> {
    return (await this.json<{ transaction: string }>(`${this.root}:beginTransaction`, {}))
      .transaction;
  }

  async rollback(transaction: string): Promise<void> {
    await this.json(`${this.root}:rollback`, { transaction });
  }

  /** reads several documents inside a transaction; missing ones come back as null */
  async getAll(paths: string[], transaction: string): Promise<(Doc | null)[]> {
    const rows = await this.json<{ found?: Doc; missing?: string }[]>(`${this.root}:batchGet`, {
      documents: paths.map((p) => this.name(p)),
      transaction,
    });
    return paths.map((p) => rows.find((r) => r.found?.name === this.name(p))?.found ?? null);
  }

  /** applies all writes together, or none of them */
  async commit(writes: Write[], transaction?: string): Promise<void> {
    await this.json(`${this.root}:commit`, transaction ? { writes, transaction } : { writes });
  }

  set(path: string, data: Fields, mustBeNew = false): Write {
    return {
      update: { name: this.name(path), fields: toFields(data) },
      ...(mustBeNew && { currentDocument: { exists: false } }),
    };
  }

  remove(path: string): Write {
    return { delete: this.name(path) };
  }
}

export class FirestoreError extends Error {}
