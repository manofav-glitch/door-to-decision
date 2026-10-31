// Loads a paid case, unit's notes or the paid codex cards from Firestore (docs/plans/paid-access-plan.md).
// Firestore's security rules let only signed-in users with a running paid year read paid/{docId}.
// Each document holds the compiled JSON as one string (avoids Firestore's limits on nested arrays).
// Downloads are kept in Cache Storage per content version, so paid units still work offline.
import { firestoreDocs, idToken, isPaid, useAccount } from './account';

/** Thrown when the content is paid and this person can't open it yet. */
export class LockedError extends Error {
  reason: 'sign-in' | 'unlock';
  constructor(reason: 'sign-in' | 'unlock') {
    super(reason === 'sign-in' ? 'Sign in to open this unit.' : 'Unlock all units to open this.');
    this.reason = reason;
  }
}

const CACHE = 'd2d-paid';
const cacheKey = (version: string, docId: string) =>
  new Request(`${location.origin}/__paid/${version}/${docId}`);

async function fromCache(version: string, docId: string): Promise<unknown> {
  try {
    const hit = await (await caches.open(CACHE)).match(cacheKey(version, docId));
    return hit ? await hit.json() : undefined;
  } catch {
    return undefined; // no Cache Storage (e.g. private window)
  }
}

async function toCache(version: string, docId: string, data: unknown) {
  try {
    const cache = await caches.open(CACHE);
    // drop downloads from older content versions
    for (const req of await cache.keys())
      if (!new URL(req.url).pathname.startsWith(`/__paid/${version}/`)) await cache.delete(req);
    await cache.put(cacheKey(version, docId), new Response(JSON.stringify(data)));
  } catch {
    // caching is a bonus; the content still opens
  }
}

export async function fetchPaid(docId: string, version: string): Promise<unknown> {
  const paid = isPaid(useAccount.getState().paidUntil);
  if (paid) {
    const cached = await fromCache(version, docId);
    if (cached !== undefined) return cached;
  }
  const token = await idToken();
  if (!token) throw new LockedError('sign-in');
  const res = await fetch(`${firestoreDocs}/paid/${docId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 403 || res.status === 401) throw new LockedError('unlock');
  if (!res.ok)
    throw new Error(`Could not load this content (${res.status}). Check your connection.`);
  const doc = (await res.json()) as { fields?: { json?: { stringValue?: string } } };
  const text = doc.fields?.json?.stringValue;
  if (!text) throw new Error('This content is missing. Please try again later.');
  const data: unknown = JSON.parse(text);
  void toCache(version, docId, data);
  return data;
}
