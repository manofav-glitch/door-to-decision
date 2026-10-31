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

/** true when the build has a Firebase project to sign in to */
export const accountsEnabled = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

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
}

export const useAccount = create<AccountState>()(() => ({
  status: accountsEnabled ? 'loading' : 'off',
  user: null,
  error: null,
}));

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
