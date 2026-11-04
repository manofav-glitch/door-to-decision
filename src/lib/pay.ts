// Paying through Razorpay (docs/plans/paid-access-plan.md, step 3). The payment Worker (worker/) makes a
// Razorpay payment page for the signed-in person; after paying, Razorpay sends them back here and tells
// the Worker, which records the paid year in Firestore. Card and UPI details never touch this app.
import { idToken } from './account';

const PAY_URL = import.meta.env.VITE_PAY_URL as string | undefined;

/** false until the payment Worker's address is in .env (the unlock button then says "Payments open soon") */
export const payEnabled = Boolean(PAY_URL);

const RETURN_KEY = 'd2d.payReturn';

/** Opens Razorpay's payment page in this tab. Throws a plain-language Error if it can't. */
export async function startPayment(): Promise<void> {
  const token = await idToken();
  if (!token) throw new Error('Sign in first.');
  let res: Response;
  try {
    res = await fetch(`${PAY_URL}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnUrl: location.origin + location.pathname }),
    });
  } catch {
    throw new Error('No internet connection. Paying needs to be online.');
  }
  if (res.status === 401)
    throw new Error('Your sign-in has expired. Sign out, sign in again and retry.');
  if (!res.ok) throw new Error('Could not open the payment page. Please try again in a minute.');
  const { url } = (await res.json()) as { url: string };
  try {
    sessionStorage.setItem(RETURN_KEY, location.hash); // to come back to the same screen
  } catch {
    // no storage: they'll land on the home screen instead
  }
  location.assign(url);
}

/**
 * Razorpay sends people back with `?razorpay_payment_link_status=…` on the address. Swap that for the
 * payment screen before the router starts. Called once at start-up.
 */
export function handlePaymentReturn() {
  const status = new URLSearchParams(location.search).get('razorpay_payment_link_status');
  if (status === null) return;
  history.replaceState(
    null,
    '',
    `${location.pathname}#/unlocked?status=${encodeURIComponent(status)}`,
  );
}

/** the screen they were on before paying (router path), or home; forgotten once read */
export function takeReturnPath(): string {
  try {
    const hash = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return hash?.replace(/^#/, '') || '/';
  } catch {
    return '/';
  }
}
