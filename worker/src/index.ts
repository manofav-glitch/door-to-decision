// Payment Worker (docs/plans/paid-access-plan.md, step 3).
//   POST /pay               signed-in app user → a Razorpay payment page for one year of every unit
//   POST /razorpay-webhook  Razorpay says a payment link was paid → adds a year to entitlements/{uid}
// Firestore records it keeps (closed to browsers by /firestore.rules):
//   links/{plinkId}     who each payment link belongs to and what it charges
//   pending/{uid}       the person's open payment link, reused if they tap Unlock again
//   payments/{plinkId}  one per completed payment, so a repeated webhook can't add a second year
import { PAID_DAYS, PRICE_RUPEES } from '../../src/lib/price.ts';
import { AuthError, verifyIdToken } from './auth.ts';
import { Firestore, int, str, time } from './firestore.ts';
import { createPaymentLink, verifyWebhook } from './razorpay.ts';

const AMOUNT = PRICE_RUPEES * 100; // paise
const LINK_LIFETIME = 2 * 3600; // seconds a payment page stays open
const REUSE_MARGIN = 15 * 60_000; // reuse an open payment page only if it has this long left
const MAX_BODY = 100_000; // bytes; Razorpay events are a few kB

const log = (message: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ message, ...data }));
const logError = (message: string, data: Record<string, unknown> = {}) =>
  console.error(JSON.stringify({ message, ...data }));

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/pay') return pay(request, env);
    if (pathname === '/razorpay-webhook' && request.method === 'POST') {
      try {
        return await webhook(request, env);
      } catch (e) {
        // a non-2xx answer makes Razorpay send the event again later (for up to 24 hours)
        logError('webhook failed', { error: String(e) });
        return new Response('Try again', { status: 500 });
      }
    }
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function pay(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  if (!allowed.includes(origin)) return new Response('Forbidden', { status: 403 });
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method' }, 405, cors);

  try {
    const token = /^Bearer (.+)$/.exec(request.headers.get('Authorization') ?? '')?.[1];
    if (!token) return json({ error: 'sign-in' }, 401, cors);
    const user = await verifyIdToken(token, env.FIREBASE_PROJECT_ID);

    const { returnUrl } = (await request.json().catch(() => ({}))) as { returnUrl?: unknown };
    let back: URL;
    try {
      back = new URL(String(returnUrl));
    } catch {
      return json({ error: 'return-url' }, 400, cors);
    }
    // only send people back to the app they came from
    if (back.origin !== origin) return json({ error: 'return-url' }, 400, cors);
    back.search = '';
    back.hash = '';

    const db = new Firestore(env.FIREBASE_SERVICE_ACCOUNT);
    const pending = await db.get(`pending/${user.uid}`);
    if (
      pending &&
      int(pending, 'amount') === AMOUNT &&
      str(pending, 'returnUrl') === back.href &&
      (time(pending, 'expiresAt') ?? 0) > Date.now() + REUSE_MARGIN
    ) {
      log('pay: reused link', { uid: user.uid, link: str(pending, 'linkId') });
      return json({ url: str(pending, 'url') }, 200, cors);
    }

    const expireBy = Math.floor(Date.now() / 1000) + LINK_LIFETIME;
    const link = await createPaymentLink(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET, {
      amount: AMOUNT,
      referenceId: `${user.uid.slice(0, 28)}-${Date.now().toString(36)}`,
      description: `Door to Decision: every unit for ${PAID_DAYS} days`,
      customer: {
        ...(user.name && { name: user.name }),
        ...(user.email && { email: user.email }),
      },
      notes: { uid: user.uid },
      callbackUrl: back.href,
      expireBy,
    });
    await db.commit([
      db.set(`links/${link.id}`, {
        uid: user.uid,
        email: user.email,
        amount: AMOUNT,
        createdAt: new Date(),
      }),
      db.set(`pending/${user.uid}`, {
        linkId: link.id,
        url: link.short_url,
        amount: AMOUNT,
        returnUrl: back.href,
        expiresAt: new Date(expireBy * 1000),
      }),
    ]);
    log('pay: new link', { uid: user.uid, link: link.id });
    return json({ url: link.short_url }, 200, cors);
  } catch (e) {
    if (e instanceof AuthError) return json({ error: 'sign-in' }, 401, cors);
    logError('pay failed', { error: String(e) });
    return json({ error: 'server' }, 500, cors);
  }
}

interface PaidEvent {
  event?: string;
  payload?: {
    payment_link?: {
      entity?: {
        id?: string;
        status?: string;
        amount_paid?: number;
        currency?: string;
        notes?: Record<string, string> | null | [];
      };
    };
    payment?: { entity?: { id?: string } };
  };
}

async function webhook(request: Request, env: Env): Promise<Response> {
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY)
    return new Response('Too large', { status: 413 });
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY) return new Response('Too large', { status: 413 });
  const signature = request.headers.get('X-Razorpay-Signature');
  if (!(await verifyWebhook(body, signature, env.RAZORPAY_WEBHOOK_SECRET))) {
    logError('webhook: bad signature');
    return new Response('Bad signature', { status: 401 });
  }

  const event = JSON.parse(new TextDecoder().decode(body)) as PaidEvent;
  // Only payment_link.paid unlocks. Anything else is acknowledged so Razorpay doesn't resend it.
  if (event.event !== 'payment_link.paid') return new Response('Ignored');
  const link = event.payload?.payment_link?.entity;
  const linkId = link?.id;
  if (!linkId || link.status !== 'paid') return new Response('Ignored');

  const db = new Firestore(env.FIREBASE_SERVICE_ACCOUNT);
  const record = await db.get(`links/${linkId}`);
  // The link record is written when the link is made; the uid in the link's notes is a fallback in
  // case that write failed after Razorpay had already made the link.
  const notes = link.notes && !Array.isArray(link.notes) ? link.notes : {};
  const uid = str(record, 'uid') ?? notes.uid ?? null;
  const expected = int(record, 'amount') ?? AMOUNT;
  if (!uid) {
    logError('webhook: link has no user', { link: linkId });
    return new Response('Unknown link'); // resending won't help; grant by hand (scripts/grant.ts)
  }
  if (link.currency !== 'INR' || (link.amount_paid ?? 0) < expected) {
    logError('webhook: amount too low', { link: linkId, paid: link.amount_paid, expected });
    return new Response('Amount mismatch');
  }

  const tx = await db.beginTransaction();
  const [current, already] = await db.getAll([`entitlements/${uid}`, `payments/${linkId}`], tx);
  if (already) {
    await db.rollback(tx);
    log('webhook: already counted', { uid, link: linkId });
    return new Response('Already counted');
  }
  const from = Math.max(Date.now(), time(current, 'expiresAt') ?? 0); // renewing adds to a running year
  const expiresAt = new Date(from + PAID_DAYS * 86_400_000);
  const email = str(record, 'email') ?? str(current, 'email');
  await db.commit(
    [
      db.set(
        `payments/${linkId}`,
        {
          uid,
          email,
          amount: link.amount_paid ?? expected,
          paymentId: event.payload?.payment?.entity?.id ?? null,
          paidAt: new Date(),
        },
        true,
      ),
      db.set(`entitlements/${uid}`, {
        expiresAt,
        email,
        source: 'razorpay',
        lastPayment: linkId,
      }),
      db.remove(`pending/${uid}`),
    ],
    tx,
  );
  log('webhook: unlocked', { uid, link: linkId, until: expiresAt.toISOString() });
  return new Response('OK');
}
