// Which units this person can open (docs/plans/paid-access-plan.md). Locks only apply in builds where paid
// units load from Firestore (paidSplit); local dev and builds without the launch switch open everything.
import { paidSplit } from 'virtual:content';
import { index } from '../content/client';
import { isPaid, useAccount } from './account';

export const PRICE = '₹356';

/** true if a unit with this `free` flag is locked for the current person */
export function useLocked(free: boolean): boolean {
  const paidUntil = useAccount((s) => s.paidUntil);
  return paidSplit && !free && !isPaid(paidUntil);
}

/** true if a codex card needs the unlock: it's listed in the index but wasn't in the codex the app loaded */
export function useCodexLocked(cardId: string, loadedIds: Set<string> | undefined): boolean {
  const paidUntil = useAccount((s) => s.paidUntil);
  return (
    paidSplit &&
    !isPaid(paidUntil) &&
    loadedIds !== undefined &&
    !loadedIds.has(cardId) &&
    index.codex.some((c) => c.id === cardId)
  );
}
