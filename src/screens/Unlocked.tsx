import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { refreshPaid, signIn, useAccount } from '../lib/account';
import { takeReturnPath } from '../lib/pay';

const POLL = 3000; // ms between checks for the paid year
const PATIENCE = 45_000; // after this, explain that confirmation can take a few minutes
const GIVE_UP = 10 * 60_000; // stop checking by itself (the app also checks at every start)

/** Where Razorpay sends people back to after paying: waits for the Worker to record the paid year. */
export function Unlocked() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { status, user, paidUntil } = useAccount();
  // the year on record before this payment (a renewal already has one)
  const [before] = useState(() => useAccount.getState().paidUntil ?? 0);
  const [slow, setSlow] = useState(false);
  const done = paidUntil !== null && paidUntil > before;
  const finished = params.get('status') === 'paid';

  useEffect(() => {
    if (done || !user) return;
    const poll = setInterval(() => void refreshPaid(), POLL);
    const patience = setTimeout(() => setSlow(true), PATIENCE);
    const stop = setTimeout(() => clearInterval(poll), GIVE_UP);
    return () => {
      clearInterval(poll);
      clearTimeout(patience);
      clearTimeout(stop);
    };
  }, [done, user]);

  return (
    <main className="max-w-xl">
      <section className="panel p-4" aria-live="polite">
        {done ? (
          <>
            <h1 className="mb-2 text-2xl font-bold">Everything is unlocked</h1>
            <p className="mb-4">
              Every unit is open until{' '}
              <span className="font-semibold">{new Date(paidUntil).toLocaleDateString()}</span>, on
              any device signed in as <span className="break-all">{user?.email}</span>. Thank you!
            </p>
            <button
              className="panel min-h-11 px-4 font-semibold"
              onClick={() => navigate(takeReturnPath(), { replace: true })}
            >
              Continue
            </button>
          </>
        ) : status === 'ready' && !user ? (
          <>
            <h1 className="mb-2 text-2xl font-bold">Sign in to finish</h1>
            <p className="mb-4">Sign in with the Google account you paid with.</p>
            <button className="panel min-h-11 px-4 font-semibold" onClick={() => void signIn()}>
              Sign in with Google
            </button>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-2xl font-bold">
              {finished ? 'Payment received' : 'Checking your payment'}
            </h1>
            <p className="mb-3">Unlocking your units. This usually takes a few seconds…</p>
            {slow && (
              <>
                <p className="mb-3">
                  Razorpay hasn’t confirmed the payment to us yet. That can take a few minutes. You
                  can keep using the app: the units unlock by themselves once it arrives.
                </p>
                <p className="mb-4 text-sm text-grey-1">
                  If no money left your account, the payment didn’t go through and you can try again
                  from any locked unit.
                </p>
                <button className="panel min-h-11 px-4" onClick={() => void refreshPaid()}>
                  Check again
                </button>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
