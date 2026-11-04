import { accountsEnabled, isPaid, signIn, signOut, useAccount } from '../lib/account';

/** Sign in with Google, or show who is signed in. Hidden when the build has no Firebase project. */
export function AccountPanel() {
  const { status, user, error, paidUntil } = useAccount();
  if (!accountsEnabled) return null;
  return (
    <section aria-labelledby="account-heading" className="panel mb-6 p-4">
      <h2 id="account-heading" className="mb-2 text-xl font-bold">
        Account
      </h2>
      {status === 'loading' ? (
        <p className="text-grey-1">Checking sign-in…</p>
      ) : user ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0">
            Signed in as <span className="font-semibold break-all">{user.email ?? user.name}</span>
          </p>
          <button className="panel min-h-11 px-3" onClick={() => void signOut()}>
            Sign out
          </button>
          {isPaid(paidUntil) && (
            <p className="w-full text-sm text-grey-1">
              All units unlocked until {new Date(paidUntil!).toLocaleDateString()}.
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="mb-3">
            Sign in with your Google account to unlock all units on any device.
          </p>
          <button className="panel min-h-11 px-4 font-semibold" onClick={() => void signIn()}>
            Sign in with Google
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-alarm">
          {error}
        </p>
      )}
    </section>
  );
}
