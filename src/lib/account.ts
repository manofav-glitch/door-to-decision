// Google sign-in through Firebase Authentication (docs/plans/paid-access-plan.md).
// The Firebase web config is public by design (it identifies the project; security comes from
// Firestore rules), so it is read from VITE_FIREBASE_* variables in the committed .env file.
// Without that config, sign-in is switched off and the app works exactly as before.
// The Firebase SDK is imported on demand so the first page load stays small.
import type { Auth, User } from 'firebase/auth';
import { create } from 'zustand';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

const hasConfig = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

/**
 * true when sign-in is shown: always in local dev; on the live site only once VITE_ACCOUNTS_LIVE=true
 * (set when paid unlocking works, so nobody meets a sign-in that does nothing yet).
 */
export const accountsEnabled =
  hasConfig && (import.meta.env.DEV || import.meta.env.VITE_ACCOUNTS_LIVE === 'true');

export interface Account {
  uid: string;
  name: string | null;
  email: string | null;
  photo: string | null;
}

interface AccountState {
  /** 'off': no Firebase config; 'loading': checking for a saved sign-in; 'ready': known either way */
  status: 'off' | 'loading' | 'ready';
  user: Account | null;
  error: string | null;
  /** end of the paid year (ms since 1970), or null if never paid; remembered on the device for offline use */
  paidUntil: number | null;
}

const PAID_KEY = 'd2d.paidUntil';

function savedPaidUntil(): number | null {
  try {
    const v = JSON.parse(localStorage.getItem(PAID_KEY) ?? 'null') as { until?: number } | null;
    return typeof v?.until === 'number' ? v.until : null;
  } catch {
    return null;
  }
}

export const useAccount = create<AccountState>()(() => ({
  status: accountsEnabled ? 'loading' : 'off',
  user: null,
  error: null,
  paidUntil: accountsEnabled ? savedPaidUntil() : null,
}));

/** true while the paid year is running */
export const isPaid = (paidUntil: number | null, now = Date.now()) =>
  paidUntil !== null && paidUntil > now;

export const firestoreDocs = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;

let authPromise: Promise<Auth> | null = null;

function getAuthOnce(): Promise<Auth> {
  authPromise ??= (async () => {
    const [{ initializeApp }, { getAuth, onAuthStateChanged }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]);
    const auth = getAuth(initializeApp(config));
    onAuthStateChanged(auth, (u: User | null) => {
      useAccount.setState({
        status: 'ready',
        user: u && { uid: u.uid, name: u.displayName, email: u.email, photo: u.photoURL },
      });
      if (u) void refreshPaid();
      else {
        useAccount.setState({ paidUntil: null });
        localStorage.removeItem(PAID_KEY);
      }
    });
    return auth;
  })();
  return authPromise;
}

/** Restore a saved sign-in, if there is one. Called once at start-up. */
export function initAccount() {
  if (!accountsEnabled) return;
  getAuthOnce().catch(() =>
    useAccount.setState({ status: 'ready', error: 'Could not reach the sign-in service.' }),
  );
}

/** Plain-language message for the errors people actually hit. */
function message(code: string): string | null {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null; // they changed their mind: say nothing
    case 'auth/network-request-failed':
      return 'No internet connection. Sign-in needs to be online.';
    case 'auth/unauthorized-domain':
      return 'Sign-in is not set up for this web address yet.';
    default:
      return 'Sign-in did not work. Please try again.';
  }
}

export async function signIn() {
  useAccount.setState({ error: null });
  try {
    const auth = await getAuthOnce();
    const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } =
      await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      // installed apps and some phone browsers block pop-ups: fall back to a full-page redirect
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        await signInWithRedirect(auth, provider);
      } else throw e;
    }
  } catch (e) {
    useAccount.setState({ error: message((e as { code?: string }).code ?? '') });
  }
}

export async function signOut() {
  const auth = await getAuthOnce();
  const { signOut: out } = await import('firebase/auth');
  await out(auth);
}

/** The signed-in user's Firebase ID token (for Firestore requests), or null if signed out. */
export async function idToken(): Promise<string | null> {
  if (!accountsEnabled) return null;
  const auth = await getAuthOnce();
  await auth.authStateReady();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

/** Read entitlements/{uid} (written only by the payment Worker) and remember the end of the paid year. */
export async function refreshPaid() {
  const token = await idToken();
  const uid = useAccount.getState().user?.uid;
  if (!token || !uid) return;
  try {
    const res = await fetch(`${firestoreDocs}/entitlements/${uid}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) {
      useAccount.setState({ paidUntil: null });
      localStorage.removeItem(PAID_KEY);
      return;
    }
    if (!res.ok) return; // keep what we had (e.g. offline)
    const doc = (await res.json()) as { fields?: { expiresAt?: { timestampValue?: string } } };
    const ts = doc.fields?.expiresAt?.timestampValue;
    const until = ts ? Date.parse(ts) : null;
    useAccount.setState({ paidUntil: until });
    localStorage.setItem(PAID_KEY, JSON.stringify({ uid, until }));
  } catch {
    // offline: keep the remembered value
  }
}
