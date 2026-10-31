import { useState } from 'react';
import { PRICE } from '../lib/access';
import { signIn, useAccount } from '../lib/account';

/** Shown on locked units, cases, notes and codex cards: sign in, then unlock (or renew) for a year. */
export function UnlockPanel() {
  const { status, user, paidUntil, error } = useAccount();
  const [now] = useState(Date.now);
  const expired = paidUntil !== null && paidUntil <= now;
  return (
    <section className="panel mb-6 p-4" aria-labelledby="unlock-heading">
      <h2 id="unlock-heading" className="mb-2 text-lg font-bold">
        {expired ? 'Your year of access has ended' : 'Unlock every unit'}
      </h2>
      <p className="mb-3">
        {expired
          ? `It ended on ${new Date(paidUntil).toLocaleDateString()}. Renew for another year to keep playing every unit.`
          : `Chest Pain is free. ${PRICE} unlocks every other unit for a year, including new units added during that year, on any device signed in with the same Google account.`}
      </p>
      {status === 'loading' ? (
        <p className="text-grey-1">Checking sign-in…</p>
      ) : !user ? (
        <button className="panel min-h-11 px-4 font-semibold" onClick={() => void signIn()}>
          Sign in with Google
        </button>
      ) : (
        <>
          {/* payment arrives in step 3 of the plan (Razorpay through the Cloudflare Worker) */}
          <button className="panel min-h-11 px-4 font-semibold" disabled aria-disabled>
            {expired ? `Renew for ${PRICE}` : `Unlock for ${PRICE} a year`}
          </button>
          <p className="mt-2 text-sm text-grey-1">Payments open soon.</p>
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
