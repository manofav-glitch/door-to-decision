import { beforeEach, describe, expect, it } from 'vitest';
import type { RunResult } from '../src/engine/engine.ts';
import { cardKey, MASTERED_AFTER, reviseDeck, useProgress } from '../src/store/progress.ts';

const mistake = (nodeId: string, label: string) => ({
  optionId: label,
  label,
  grade: 'suboptimal' as const,
  consequence: 'c',
  teaching: 't',
  nodeId,
  prompt: `Q ${nodeId}`,
});
const result = (...m: ReturnType<typeof mistake>[]): RunResult => ({
  outcome: 'good',
  stars: 2,
  patient: 90,
  safetyEvents: 0,
  time: [],
  mistakes: m,
});
const play = (caseId: string, r: RunResult) => {
  const s = useProgress.getState();
  s.begin({ caseId, setting: 'non-pci', mode: 'learn', contentVersion: 'x' });
  useProgress.getState().finish(caseId, r, []);
};

describe('Revise deck', () => {
  beforeEach(() =>
    useProgress.setState({ mistakes: [], reviseStreak: {}, active: {}, finished: {} }),
  );

  it('makes one card per question, keeping the run setting', () => {
    play('c1', result(mistake('multi', 'A'), mistake('multi', 'B'), mistake('first', 'X')));
    const deck = reviseDeck(useProgress.getState().mistakes, {});
    expect(deck.map((d) => [d.nodeId, d.mistakes.length, d.setting])).toEqual([
      ['multi', 2, 'non-pci'],
      ['first', 1, 'non-pci'],
    ]);
  });

  it(`a card leaves after ${MASTERED_AFTER} correct answers in a row; a wrong answer resets`, () => {
    play('c1', result(mistake('first', 'X')));
    const key = cardKey('c1', 'first');
    const { revise } = useProgress.getState();
    revise(key, true);
    revise(key, false);
    revise(key, true);
    expect(useProgress.getState().mistakes).toHaveLength(1);
    revise(key, true);
    expect(useProgress.getState().mistakes).toHaveLength(0);
    expect(useProgress.getState().reviseStreak[key]).toBeUndefined();
  });

  it('a fresh mistake on the same question resets its streak', () => {
    play('c1', result(mistake('first', 'X')));
    const key = cardKey('c1', 'first');
    useProgress.getState().revise(key, true);
    play('c1', result(mistake('first', 'Y')));
    expect(useProgress.getState().reviseStreak[key]).toBeUndefined();
    expect(reviseDeck(useProgress.getState().mistakes, {})[0]!.mistakes).toHaveLength(2);
  });

  it('clearDeck and dropCard', () => {
    play('c1', result(mistake('a', 'X'), mistake('b', 'Y')));
    useProgress.getState().dropCard(cardKey('c1', 'a'));
    expect(useProgress.getState().mistakes.map((m) => m.nodeId)).toEqual(['b']);
    useProgress.getState().clearDeck();
    expect(useProgress.getState().mistakes).toEqual([]);
  });
});

describe('presenter mode', () => {
  beforeEach(() =>
    useProgress.setState({
      mistakes: [],
      reviseStreak: {},
      active: {},
      finished: {},
      bestStars: {},
      plays: {},
      unlocked: [],
    }),
  );
  it("doesn't change the presenter's stars, unlocks or mistakes deck", () => {
    useProgress
      .getState()
      .begin({ caseId: 'c1', setting: null, mode: 'present', contentVersion: 'x' });
    useProgress.getState().finish('c1', result(mistake('first', 'X')), ['card']);
    const s = useProgress.getState();
    expect(s.mistakes).toEqual([]);
    expect(s.bestStars).toEqual({});
    expect(s.unlocked).toEqual([]);
    expect(s.finished.c1?.mode).toBe('present'); // the debrief still works
    expect(s.active.c1).toBeUndefined();
  });
});
