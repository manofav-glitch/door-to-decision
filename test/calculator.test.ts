// Calculator nodes, exercised on cp-02's HEART step (correct answer: total 1, Low).
import { describe, expect, it } from 'vitest';
import { compileContent } from '../src/content/compile.ts';
import { act, replay, type Input } from '../src/engine/engine.ts';

const c = compileContent(process.cwd()).cases['cvs-cp-02']!;
// arrival → ECG → normal ECG → history → hs-troponin → result → HEART step
const toCalc: Input[] = [
  { kind: 'continue' },
  { kind: 'pick', optionId: 'o1' },
  { kind: 'pick', optionId: 'o1' },
  { kind: 'continue' },
  { kind: 'pick', optionId: 'o1' },
  { kind: 'continue' },
];
const at = replay(c, null, toCalc);
const calc = (answers: Record<string, unknown>) =>
  act(c, at, { kind: 'calc', answers: answers as Record<string, string> });
const right = {
  history: 'slight',
  ecg: 'normal',
  age: { bin: 0 },
  'risk-factors': 'one-two',
  troponin: 'normal',
};

describe('calculator node', () => {
  it('reaches the HEART step', () => expect(at.nodeId).toBe('heart-score'));

  it('all items right → best, with both breakdowns', () => {
    const r = calc(right);
    expect(r.picks[0]!.grade).toBe('best');
    expect(r.calc?.yours.total).toBe(1);
    expect(r.calc?.correct.total).toBe(1);
    expect(r.calc?.correct.items.find((i) => i.id === 'age')?.answer).toMatch(/44 years/);
    expect(r.state.nodeId).toBe('plan');
  });

  it('a slip within the same band → acceptable', () => {
    const r = calc({ ...right, history: 'moderate' });
    expect(r.picks[0]!.grade).toBe('acceptable');
    expect(r.calc?.yours.band?.label).toBe('Low');
  });

  it('a different band → suboptimal, with its time cost', () => {
    const r = calc({ ...right, history: 'high', ecg: 'st-deviation' });
    expect(r.calc?.yours.band?.label).toBe('Moderate');
    expect(r.picks[0]!.grade).toBe('suboptimal');
    expect(r.state.minutes).toBe(at.minutes + 10);
  });

  it('refuses incomplete or invalid answers', () => {
    expect(() => calc({ history: 'slight' })).toThrow(/every item/);
    expect(() => calc({ ...right, ecg: 'weird' })).toThrow(/not an option/);
  });
});
