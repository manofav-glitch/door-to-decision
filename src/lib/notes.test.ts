import { describe, expect, it } from 'vitest';
import { NOTES_STARS, notesProgress } from './notes.ts';

const mod = {
  cases: [
    { id: 'a', draft: false },
    { id: 'b', draft: false },
    { id: 'c', draft: true },
  ] as Parameters<typeof notesProgress>[0]['cases'],
};

describe('unit notes progress', () => {
  it(`counts cases with ${NOTES_STARS}+ stars among the cases the learner can play`, () => {
    expect(notesProgress(mod, { a: 3, b: 1 }, false)).toEqual({
      done: 1,
      total: 2,
      complete: false,
    });
    expect(notesProgress(mod, { a: 3, b: 2 }, false)).toEqual({
      done: 2,
      total: 2,
      complete: true,
    });
  });
  it('includes draft cases when they are shown', () => {
    expect(notesProgress(mod, { a: 3, b: 2 }, true)).toEqual({
      done: 2,
      total: 3,
      complete: false,
    });
  });
  it('a unit with nothing playable never unlocks', () => {
    expect(notesProgress({ cases: [] }, {}, false).complete).toBe(false);
  });
});

describe('earned notes', () => {
  it('are stored once and stay earned', async () => {
    const { useProgress } = await import('../store/progress.ts');
    useProgress.getState().unlockNotes('cvs/arrhythmias');
    useProgress.getState().unlockNotes('cvs/arrhythmias');
    expect(useProgress.getState().notesUnlocked).toEqual(['cvs/arrhythmias']);
  });
});
