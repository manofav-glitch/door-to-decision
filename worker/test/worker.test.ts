// The payment Worker against fake Google, Razorpay and Firestore servers: who can ask for a payment
// page, and that only a genuine Razorpay "paid" message adds exactly one year.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAID_DAYS, PRICE_RUPEES } from '../../src/lib/price.ts';
import { b64url } from '../src/base64.ts';
import worker from '../src/index.ts';

const ORIGIN = 'https://manofav-glitch.github.io';
const APP = `${ORIGIN}/door-to-decision/`;
const PROJECT = 'door-to-decision';
const DAY = 86_400_000;
const RSA = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
const rsaKeys = () =>
  crypto.subtle.generateKey(
    { ...RSA, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ['sign', 'verify'],
  ) as Promise<CryptoKeyPair>;

let google: CryptoKeyPair; // signs the fake sign-in tokens
let stranger: CryptoKeyPair; // a key Google never published
let env: Env;

beforeAll(async () => {
  [google, stranger] = await Promise.all([rsaKeys(), rsaKeys()]);
  const sa = await rsaKeys();
  const der = (await crypto.subtle.exportKey('pkcs8', sa.privateKey)) as ArrayBuffer;
  const pkcs8 = btoa(String.fromCharCode(...new Uint8Array(der)));
  env = {
    FIREBASE_PROJECT_ID: PROJECT,
    ALLOWED_ORIGINS: 'https://manofav-glitch.github.io,http://localhost:5180',
    RAZORPAY_KEY_ID: 'rzp_test_key',
    RAZORPAY_KEY_SECRET: 'key-secret',
    RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
    FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
      project_id: PROJECT,
      client_email: 'worker@door-to-decision.iam.gserviceaccount.com',
      private_key: `-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----\n`,
    }),
  };
});

async function idToken(claims: Record<string, unknown> = {}, key = google.privateKey, kid = 'k1') {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', kid }))}.${b64url(
    JSON.stringify({
      aud: PROJECT,
      iss: `https://securetoken.google.com/${PROJECT}`,
      sub: 'user-1',
      email: 'doc@example.com',
      name: 'Dr Test',
      iat: now - 10,
      auth_time: now - 10,
      exp: now + 3600,
      ...claims,
    }),
  )}`;
  return `${unsigned}.${b64url(await crypto.subtle.sign(RSA, key, new TextEncoder().encode(unsigned)))}`;
}

// ---- fake servers ----
type Doc = { name: string; fields: Record<string, Record<string, unknown>> };
let db: Map<string, Doc>;
let links: Record<string, unknown>[];
const docName = (path: string) => `projects/${PROJECT}/databases/(default)/documents/${path}`;
const field = (path: string, k: string) => {
  const v = db.get(docName(path))?.fields[k];
  return v && Object.values(v)[0];
};

beforeEach(() => {
  db = new Map();
  links = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    if (url.startsWith('https://www.googleapis.com/service_accounts/')) {
      const jwk = await crypto.subtle.exportKey('jwk', google.publicKey);
      return Response.json(
        { keys: [{ ...jwk, kid: 'k1', alg: 'RS256', use: 'sig' }] },
        { headers: { 'Cache-Control': 'public, max-age=3600' } },
      );
    }
    if (url === 'https://oauth2.googleapis.com/token')
      return Response.json({ access_token: 'access', expires_in: 3600 });
    if (url === 'https://api.razorpay.com/v1/payment_links') {
      links.push(body);
      const id = `plink_${links.length}`;
      return Response.json({ id, short_url: `https://rzp.io/i/${id}` });
    }
    const fs = 'https://firestore.googleapis.com/v1/';
    if (url.startsWith(fs)) {
      const path = url.slice(fs.length);
      if (!init.method || init.method === 'GET') {
        const doc = db.get(path);
        return doc ? Response.json(doc) : new Response('{}', { status: 404 });
      }
      if (path.endsWith(':beginTransaction')) return Response.json({ transaction: 'tx' });
      if (path.endsWith(':rollback')) return Response.json({});
      if (path.endsWith(':batchGet'))
        return Response.json(
          (body.documents as string[]).map((n) =>
            db.has(n) ? { found: db.get(n) } : { missing: n },
          ),
        );
      if (path.endsWith(':commit')) {
        type W = { update?: Doc; currentDocument?: { exists: boolean }; delete?: string };
        const writes = body.writes as W[];
        if (writes.some((w) => w.currentDocument?.exists === false && db.has(w.update!.name)))
          return Response.json({ error: { status: 'ALREADY_EXISTS' } }, { status: 409 });
        for (const w of writes)
          if (w.update) db.set(w.update.name, w.update);
          else if (w.delete) db.delete(w.delete);
        return Response.json({});
      }
    }
    throw new Error(`unexpected fetch ${url}`);
  });
});
afterEach(() => vi.unstubAllGlobals());

const call = (path: string, init: RequestInit) =>
  worker.fetch(new Request(`https://pay.example.workers.dev${path}`, init), env);

const pay = async (token?: string, origin = ORIGIN, returnUrl = `${APP}#/s/cvs/heart-failure`) =>
  call('/pay', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ returnUrl }),
  });

async function hookSignature(body: string, secret = 'webhook-secret') {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

function paidEvent(linkId: string, amount = PRICE_RUPEES * 100, event = 'payment_link.paid') {
  return JSON.stringify({
    entity: 'event',
    event,
    contains: ['payment_link', 'order', 'payment'],
    payload: {
      payment_link: {
        entity: {
          id: linkId,
          status: 'paid',
          amount,
          amount_paid: amount,
          currency: 'INR',
          notes: null,
        },
      },
      payment: { entity: { id: 'pay_1', status: 'captured', amount, notes: [] } },
    },
  });
}

const hook = async (body: string, signature?: string) =>
  call('/razorpay-webhook', {
    method: 'POST',
    headers: { 'X-Razorpay-Signature': signature ?? (await hookSignature(body)) },
    body,
  });

const until = () => Date.parse(String(field('entitlements/user-1', 'expiresAt')));

// ---- tests ----
describe('POST /pay', () => {
  it('answers only the app’s own sites', async () => {
    expect((await pay(await idToken(), 'https://evil.example')).status).toBe(403);
    const pre = await call('/pay', { method: 'OPTIONS', headers: { Origin: ORIGIN } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('turns away missing, forged, expired and other-project sign-ins', async () => {
    expect((await pay()).status).toBe(401);
    expect((await pay(await idToken({}, stranger.privateKey))).status).toBe(401);
    expect((await pay(await idToken({ exp: Math.floor(Date.now() / 1000) - 3600 }))).status).toBe(
      401,
    );
    expect((await pay(await idToken({ aud: 'someone-else' }))).status).toBe(401);
    expect((await pay(await idToken({}, google.privateKey, 'unknown-kid'))).status).toBe(401);
    expect(links).toHaveLength(0);
  });

  it('won’t send people back to another site', async () => {
    expect((await pay(await idToken(), ORIGIN, 'https://evil.example/')).status).toBe(400);
  });

  it('makes one payment page for the price, and reuses it if they tap again', async () => {
    const res = await pay(await idToken());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://rzp.io/i/plink_1' });
    expect(links[0]).toMatchObject({
      amount: PRICE_RUPEES * 100,
      currency: 'INR',
      accept_partial: false,
      notes: { uid: 'user-1' },
      callback_url: APP, // the #/screen part is dropped: Razorpay adds its own query string
      customer: { name: 'Dr Test', email: 'doc@example.com' },
    });
    expect(field('links/plink_1', 'uid')).toBe('user-1');

    expect(await (await pay(await idToken())).json()).toEqual({ url: 'https://rzp.io/i/plink_1' });
    expect(links).toHaveLength(1);
  });
});

describe('POST /razorpay-webhook', () => {
  beforeEach(async () => {
    await pay(await idToken()); // creates plink_1 for user-1
  });

  it('ignores messages that aren’t signed by Razorpay', async () => {
    const body = paidEvent('plink_1');
    expect((await hook(body, await hookSignature(body, 'guessed'))).status).toBe(401);
    expect((await hook(body, 'not-hex')).status).toBe(401);
    expect(field('entitlements/user-1', 'expiresAt')).toBeUndefined();
  });

  it('adds a year once, however many times Razorpay sends the same payment', async () => {
    expect((await hook(paidEvent('plink_1'))).status).toBe(200);
    const first = until();
    expect(first).toBeGreaterThan(Date.now() + PAID_DAYS * DAY - 60_000);
    expect(first).toBeLessThanOrEqual(Date.now() + PAID_DAYS * DAY);
    expect(field('payments/plink_1', 'uid')).toBe('user-1');
    expect(db.has(docName('pending/user-1'))).toBe(false);

    expect((await hook(paidEvent('plink_1'))).status).toBe(200);
    expect(until()).toBe(first);
  });

  it('renewing adds the year to the end of the running one', async () => {
    const running = Date.now() + 100 * DAY;
    db.set(docName('entitlements/user-1'), {
      name: docName('entitlements/user-1'),
      fields: { expiresAt: { timestampValue: new Date(running).toISOString() } },
    });
    await hook(paidEvent('plink_1'));
    expect(until()).toBe(running + PAID_DAYS * DAY);
  });

  it('doesn’t unlock for less than the price, or for other events', async () => {
    expect((await hook(paidEvent('plink_1', 100))).status).toBe(200);
    expect((await hook(paidEvent('plink_1', undefined, 'payment_link.expired'))).status).toBe(200);
    expect(field('entitlements/user-1', 'expiresAt')).toBeUndefined();
  });
});
