// Razorpay Payment Links (https://razorpay.com/docs/api/payments/payment-links/create-standard/) and the
// webhook signature check (https://razorpay.com/docs/webhooks/validate-test/).
import { utf8 } from './base64.ts';

export interface LinkRequest {
  amount: number; // paise
  referenceId: string; // unique, at most 40 characters
  description: string;
  customer: { name?: string; email?: string };
  notes: Record<string, string>;
  callbackUrl: string;
  expireBy: number; // seconds since 1970, at least 15 minutes ahead
}

export async function createPaymentLink(
  keyId: string,
  keySecret: string,
  r: LinkRequest,
): Promise<{ id: string; short_url: string }> {
  const res = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: r.amount,
      currency: 'INR',
      accept_partial: false,
      description: r.description,
      reference_id: r.referenceId,
      customer: r.customer,
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: r.notes,
      callback_url: r.callbackUrl,
      callback_method: 'get',
      expire_by: r.expireBy,
    }),
  });
  if (!res.ok) throw new Error(`Razorpay payment link: ${res.status} ${await res.text()}`);
  return (await res.json()) as { id: string; short_url: string };
}

/**
 * true if `signature` (the X-Razorpay-Signature header, hex) is the HMAC-SHA256 of the raw body with the
 * webhook secret. crypto.subtle.verify compares in constant time.
 */
export async function verifyWebhook(
  body: ArrayBuffer,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    utf8(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const sig = Uint8Array.from(signature.match(/../g)!, (h) => parseInt(h, 16));
  return crypto.subtle.verify('HMAC', key, sig, body);
}
