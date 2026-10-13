// Unit notes are a reward: they open once every case of the unit the learner can play has at least
// NOTES_STARS stars. Once earned they stay open, even if cases are added to the unit later.
// Draft (unverified) notes only show with Settings → "Show draft cases"; then, and in dev mode
// (?dev=1), they open without being earned so the content owner can review them.
import { useEffect, useState } from 'react';
import type { ModuleSummary } from '../content/types';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { useDevMode } from './dev';

export const NOTES_STARS = 2;

export interface NotesProgress {
  /** cases with at least NOTES_STARS stars */
  done: number;
  total: number;
  complete: boolean;
}

export function notesProgress(
  mod: Pick<ModuleSummary, 'cases'>,
  bestStars: Record<string, number>,
  showDrafts: boolean,
): NotesProgress {
  const cases = mod.cases.filter((c) => !c.draft || showDrafts);
  const done = cases.filter((c) => (bestStars[c.id] ?? 0) >= NOTES_STARS).length;
  return { done, total: cases.length, complete: cases.length > 0 && done === cases.length };
}

export type NotesAccess =
  /** the unit has no notes, or only draft notes the learner can't see */
  | { state: 'none' }
  | { state: 'locked'; progress: NotesProgress }
  /** earned: the learner got there; preview: dev mode or reviewing draft notes */
  | { state: 'open'; how: 'earned' | 'preview'; progress: NotesProgress };

export function useUnitNotes(systemId: string, mod: ModuleSummary) {
  const key = `${systemId}/${mod.id}`;
  const showDrafts = useSettings((s) => s.showDrafts);
  const dev = useDevMode();
  const bestStars = useProgress((s) => s.bestStars);
  const stored = useProgress((s) => s.notesUnlocked.includes(key));
  const unlockNotes = useProgress((s) => s.unlockNotes);
  const progress = notesProgress(mod, bestStars, showDrafts);
  const earned = stored || progress.complete;
  // true on the screen where the last case tipped it over (e.g. that case's debrief)
  const [fresh] = useState(() => progress.complete && !stored);
  useEffect(() => {
    if (progress.complete && !stored) unlockNotes(key);
  }, [progress.complete, stored, unlockNotes, key]);

  let access: NotesAccess;
  if (!mod.notes || (mod.notes.draft && !showDrafts)) access = { state: 'none' };
  else if (earned) access = { state: 'open', how: 'earned', progress };
  else if (dev || mod.notes.draft) access = { state: 'open', how: 'preview', progress };
  else access = { state: 'locked', progress };
  return { key, access, fresh: fresh && access.state === 'open' };
}

/** "Short label: the rest" shows the label in bold, so a list can be scanned by its labels. */
export function splitLabel(text: string): [string, string] | undefined {
  const m = /^([^:.]{1,55}):\s+(.+)$/s.exec(text);
  return m ? [m[1]!, m[2]!] : undefined;
}
