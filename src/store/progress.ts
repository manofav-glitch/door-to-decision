// Per-device progress: active (resumable) runs, finished runs, best stars, unlocked codex cards,
// and the mistakes deck. Runs are stored as the learner's inputs and rebuilt with the engine.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Grade } from '../content/schema';
import type { Input, RunResult } from '../engine/engine';

export type Mode = 'learn' | 'exam';

export interface SavedRun {
  caseId: string;
  setting: string | null;
  mode: Mode;
  inputs: Input[];
  contentVersion: string;
}

export interface Mistake {
  caseId: string;
  nodeId: string;
  prompt: string;
  label: string;
  grade: Grade;
  teaching: string;
  missed?: boolean;
  /** hospital setting of the run, so Revise shows the same options */
  setting?: string | null;
  at: string;
}

/** One Revise card per question (case + step), gathering every mistake made there. */
export interface ReviseCard {
  key: string;
  caseId: string;
  nodeId: string;
  prompt: string;
  setting?: string | null;
  mistakes: Mistake[];
  streak: number;
}

/** Correct answers in a row needed for a card to leave the deck. */
export const MASTERED_AFTER = 2;

export const cardKey = (caseId: string, nodeId: string) => `${caseId}|${nodeId}`;

export function reviseDeck(mistakes: Mistake[], streaks: Record<string, number>): ReviseCard[] {
  const cards = new Map<string, ReviseCard>();
  for (const m of mistakes) {
    const key = cardKey(m.caseId, m.nodeId);
    const card = cards.get(key) ?? {
      key,
      caseId: m.caseId,
      nodeId: m.nodeId,
      prompt: m.prompt,
      setting: m.setting,
      mistakes: [],
      streak: streaks[key] ?? 0,
    };
    card.mistakes.push(m);
    cards.set(key, card);
  }
  return [...cards.values()];
}

interface ProgressState {
  bestStars: Record<string, number>;
  plays: Record<string, number>;
  active: Record<string, SavedRun>;
  finished: Record<string, SavedRun>;
  unlocked: string[];
  mistakes: Mistake[];
  /** Revise: correct answers in a row per card key */
  reviseStreak: Record<string, number>;
  begin: (run: Omit<SavedRun, 'inputs'>) => void;
  record: (caseId: string, inputs: Input[]) => void;
  finish: (caseId: string, result: RunResult, unlocks: string[]) => void;
  /** Record a Revise answer; a card leaves the deck after MASTERED_AFTER correct in a row. */
  revise: (key: string, correct: boolean) => void;
  clearDeck: () => void;
  /** remove one card (e.g. its question no longer exists) */
  dropCard: (key: string) => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      bestStars: {},
      plays: {},
      active: {},
      finished: {},
      unlocked: [],
      mistakes: [],
      reviseStreak: {},
      begin: (run) =>
        set((s) => ({ active: { ...s.active, [run.caseId]: { ...run, inputs: [] } } })),
      record: (caseId, inputs) =>
        set((s) => {
          const run = s.active[caseId];
          return run ? { active: { ...s.active, [caseId]: { ...run, inputs } } } : {};
        }),
      finish: (caseId, result, unlocks) =>
        set((s) => {
          const run = s.active[caseId];
          if (!run) return {};
          const { [caseId]: _done, ...active } = s.active;
          void _done;
          const at = new Date().toISOString();
          const fresh: Mistake[] = result.mistakes.map((m) => ({
            caseId,
            nodeId: m.nodeId,
            prompt: m.prompt,
            label: m.label,
            grade: m.grade,
            teaching: m.teaching,
            missed: m.missed,
            setting: run.setting,
            at,
          }));
          const key = (m: Mistake) => `${m.caseId}|${m.nodeId}|${m.label}`;
          const freshKeys = new Set(fresh.map(key));
          return {
            active,
            finished: { ...s.finished, [caseId]: run },
            bestStars: {
              ...s.bestStars,
              [caseId]: Math.max(s.bestStars[caseId] ?? 0, result.stars),
            },
            plays: { ...s.plays, [caseId]: (s.plays[caseId] ?? 0) + 1 },
            unlocked: [...new Set([...s.unlocked, ...unlocks])],
            mistakes: [...s.mistakes.filter((m) => !freshKeys.has(key(m))), ...fresh],
            // a fresh mistake on a question resets its Revise streak
            reviseStreak: Object.fromEntries(
              Object.entries(s.reviseStreak).filter(
                ([k]) => !fresh.some((m) => cardKey(m.caseId, m.nodeId) === k),
              ),
            ),
          };
        }),
      revise: (key, correct) =>
        set((s) => {
          const streak = correct ? (s.reviseStreak[key] ?? 0) + 1 : 0;
          if (streak >= MASTERED_AFTER) {
            const { [key]: _gone, ...rest } = s.reviseStreak;
            void _gone;
            return {
              reviseStreak: rest,
              mistakes: s.mistakes.filter((m) => cardKey(m.caseId, m.nodeId) !== key),
            };
          }
          return { reviseStreak: { ...s.reviseStreak, [key]: streak } };
        }),
      clearDeck: () => set({ mistakes: [], reviseStreak: {} }),
      dropCard: (key) =>
        set((s) => ({ mistakes: s.mistakes.filter((m) => cardKey(m.caseId, m.nodeId) !== key) })),
    }),
    {
      name: 'd2d.progress',
      version: 2,
      // v1 → v2: add Revise streaks
      migrate: (old) => ({ reviseStreak: {}, ...(old as object) }) as ProgressState,
    },
  ),
);
