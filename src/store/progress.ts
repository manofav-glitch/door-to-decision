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
  at: string;
}

interface ProgressState {
  bestStars: Record<string, number>;
  plays: Record<string, number>;
  active: Record<string, SavedRun>;
  finished: Record<string, SavedRun>;
  unlocked: string[];
  mistakes: Mistake[];
  begin: (run: Omit<SavedRun, 'inputs'>) => void;
  record: (caseId: string, inputs: Input[]) => void;
  finish: (caseId: string, result: RunResult, unlocks: string[]) => void;
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
          };
        }),
    }),
    { name: 'd2d.progress', version: 1 },
  ),
);
