import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileContent } from '../content/compile.ts';
import type { CompiledCase } from '../content/types.ts';
import { expectedDose } from './dose.ts';
import {
  act,
  clockAt,
  EngineError,
  idealRun,
  replay,
  result,
  startRun,
  type Input,
  type RunState,
} from './engine.ts';

const kase = compileContent(join(import.meta.dirname, '../../test/fixtures/mini')).cases['demo-c-01']!;

function play(c: CompiledCase, setting: string, inputs: Input[]): RunState {
  return replay(c, setting, inputs);
}
const go: Input = { kind: 'continue' };
const pick = (optionId: string): Input => ({ kind: 'pick', optionId });

describe('engine', () => {
  it('starts at the start node with initial state', () => {
    const s = startRun(kase, 'big');
    expect(s.nodeId).toBe('intro');
    expect(s.vitals.hr).toBe(80);
    expect(s.flags).toEqual(['secret']);
    expect(s.patient).toBe(100);
  });

  it('requires a valid setting when the case has settings', () => {
    expect(() => startRun(kase, null)).toThrow(EngineError);
    expect(() => startRun(kase, 'huge')).toThrow(EngineError);
  });

  it('applies effects and stamps milestones once', () => {
    const s = play(kase, 'big', [go, pick('o1')]);
    expect(s.nodeId).toBe('multi');
    expect(s.minutes).toBe(5);
    expect(s.milestones.tested).toBe(5);
  });

  it('hides options by setting', () => {
    expect(() => play(kase, 'small', [go, pick('o3')])).toThrow(/not available/);
    expect(play(kase, 'big', [go, pick('o3')]).nodeId).toBe('multi');
  });

  it('branches on vitals and counts harmful choices as safety events', () => {
    const s = play(kase, 'big', [go, pick('o2'), go]);
    expect(s.vitals.sbp).toBe(70);
    expect(s.safetyEvents).toBe(1);
    expect(s.nodeId).toBe('end-bad');
    expect(s.ended).toBe(true);
    const r = result(kase, s);
    expect(r.outcome).toBe('critical');
    expect(r.stars).toBe(1);
  });

  it('grades multiselect picks and logs missed best options', () => {
    const r = act(kase, play(kase, 'big', [go, pick('o1')]), { kind: 'multi', optionIds: ['b'] });
    expect(r.picks.map((p) => [p.optionId, p.grade, !!p.missed])).toEqual([
      ['a', 'suboptimal', true],
      ['b', 'best', false],
    ]);
    expect(r.state.patient).toBe(90); // missedEffects
    expect(r.state.nodeId).toBe('dose');
  });

  it('enforces multiselect limits', () => {
    const s = play(kase, 'big', [go, pick('o1')]);
    expect(() => act(kase, s, { kind: 'multi', optionIds: [] })).toThrow(/between 1 and 2/);
    expect(() => act(kase, s, { kind: 'multi', optionIds: ['a', 'b', 'c'] })).toThrow(/between 1 and 2/);
  });

  it('grades doses against the drug card rule with tolerance', () => {
    // 60 kg × 10–20 units/kg = 600–1200, ±10%
    const at = play(kase, 'big', [go, pick('o1'), { kind: 'multi', optionIds: ['a', 'b'] }]);
    const dose = (value: number) => act(kase, at, { kind: 'dose', value });
    expect(dose(900).dose?.outcome).toBe('correct');
    expect(dose(541).dose?.outcome).toBe('correct');
    expect(dose(539).dose?.outcome).toBe('under');
    expect(dose(1320).dose?.outcome).toBe('correct');
    expect(dose(1321).dose?.outcome).toBe('over');
    expect(dose(1321).picks[0]!.grade).toBe('harmful');
    expect(dose(1321).state.nodeId).toBe('end-fair'); // patient 100 → 60 < 70
    expect(dose(900).state.nodeId).toBe('end-good');
  });

  it('scores stars from safety, time and patient', () => {
    const perfect = play(kase, 'big', [go, pick('o1'), { kind: 'multi', optionIds: ['a', 'b'] }, { kind: 'dose', value: 900 }]);
    expect(result(kase, perfect)).toMatchObject({ outcome: 'good', stars: 3, safetyEvents: 0 });
    expect(result(kase, perfect).time[0]).toMatchObject({ actualMin: 5, met: true });

    const slow = play(kase, 'big', [go, pick('o3'), { kind: 'multi', optionIds: ['a', 'b'] }, { kind: 'dose', value: 900 }]);
    expect(result(kase, slow).time[0]).toMatchObject({ actualMin: 20, met: false });
    expect(result(kase, slow).stars).toBe(2);
  });

  it('computes the ideal path per setting', () => {
    const s = idealRun(kase, 'small');
    expect(s.nodeId).toBe('end-good');
    expect(s.log.map((e) => e.picks.filter((p) => !p.missed).map((p) => p.optionId))).toEqual([
      ['o1'],
      ['a', 'b'],
      ['correct'],
    ]);
  });

  it('replays saved inputs to the same state', () => {
    const inputs: Input[] = [go, pick('o1'), { kind: 'multi', optionIds: ['a'] }];
    const s = play(kase, 'big', inputs);
    expect(s.inputs).toEqual(inputs);
    expect(replay(kase, 'big', s.inputs)).toEqual(s);
  });

  it('does not mutate the previous state', () => {
    const s = startRun(kase, 'big');
    const copy = structuredClone(s);
    act(kase, s, go);
    expect(s).toEqual(copy);
  });

  it('formats the case clock across midnight', () => {
    expect(clockAt(kase, 0)).toBe('23:50');
    expect(clockAt(kase, 15)).toBe('00:05');
  });
});

describe('expectedDose', () => {
  const p = { age: 58, weightKg: 70 };
  it('fixed and ranged fixed doses', () => {
    expect(expectedDose({ unit: 'mg', fixed: 300 }, p)).toMatchObject({ min: 300, max: 300 });
    expect(expectedDose({ unit: 'mg', fixed: { min: 150, max: 300 } }, p)).toMatchObject({ min: 150, max: 300 });
  });
  it('per-kg with cap', () => {
    expect(expectedDose({ unit: 'units', perKg: 60, maxDose: 4000 }, p)).toMatchObject({ min: 4000, max: 4000 });
    expect(expectedDose({ unit: 'units', perKg: { min: 70, max: 100 } }, p)).toMatchObject({ min: 4900, max: 7000 });
  });
  it('weight bands, including boundaries and the top band', () => {
    const rule = { unit: 'mg', bands: [{ belowKg: 60, dose: 1 }, { belowKg: 70, dose: 2 }, { dose: 3 }] };
    expect(expectedDose(rule, { age: 50, weightKg: 59.9 }).min).toBe(1);
    expect(expectedDose(rule, { age: 50, weightKg: 60 }).min).toBe(2);
    expect(expectedDose(rule, { age: 50, weightKg: 70 }).min).toBe(3);
  });
  it('age adjustment', () => {
    const rule = { unit: 'mg', fixed: 40, ageAdjust: { fromAge: 75, factor: 0.5 } };
    expect(expectedDose(rule, { age: 74, weightKg: 70 }).min).toBe(40);
    expect(expectedDose(rule, { age: 75, weightKg: 70 }).min).toBe(20);
  });
});
