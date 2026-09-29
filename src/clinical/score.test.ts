// Test vectors for the risk scores, run against the point tables in content/codex/scores.
// If the content owner corrects a table, update the matching vectors here.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileContent } from '../content/compile.ts';
import type { ScoreAnswer, ScoreDef } from '../content/schema.ts';
import { binIndex, fromLookup, itemResult, scoreResult, ScoreError, toBaseUnit } from './score.ts';

const codex = compileContent(join(import.meta.dirname, '../..')).codex;
const def = (id: string): ScoreDef => {
  const s = codex.find((c) => c.id === id)?.score;
  if (!s) throw new Error(`no score ${id}`);
  return s;
};

describe('HEART (Six 2008; bands Backus 2013)', () => {
  const heart = def('heart');
  const score = (history: string, ecg: string, age: number, rf: string, trop: string) =>
    scoreResult(heart, { history, ecg, age, 'risk-factors': rf, troponin: trop });

  it.each([
    ['all zero', ['slight', 'normal', 30, 'none', 'normal'], 0, 'Low'],
    ['3 = top of low', ['moderate', 'nonspecific', 50, 'none', 'normal'], 3, 'Low'],
    ['4 = bottom of moderate', ['moderate', 'nonspecific', 50, 'one-two', 'normal'], 4, 'Moderate'],
    ['6 = top of moderate', ['high', 'nonspecific', 50, 'one-two', 'one-three'], 6, 'Moderate'],
    ['7 = bottom of high', ['high', 'st-deviation', 50, 'one-two', 'one-three'], 7, 'High'],
    ['10 = maximum', ['high', 'st-deviation', 80, 'three-plus', 'over-three'], 10, 'High'],
  ] as const)('%s', (_name, [h, e, a, r, t], total, band) => {
    const res = score(h, e, a, r, t);
    expect(res.total).toBe(total);
    expect(res.band?.label).toBe(band);
    expect(res.complete).toBe(true);
  });

  it('age bins at 44/45 and 64/65', () => {
    const age = heart.items.find((i) => i.id === 'age')!;
    expect([44, 45, 64, 65].map((a) => itemResult(age, a)!.points)).toEqual([0, 1, 1, 2]);
  });

  it('reports incomplete answers and rejects unknown options', () => {
    expect(scoreResult(heart, { history: 'slight' }).complete).toBe(false);
    expect(() => scoreResult(heart, { history: 'very' })).toThrow(ScoreError);
  });
});

describe('TIMI for UA/NSTEMI (Antman 2000)', () => {
  const timi = def('timi-ua-nstemi');
  const ids = timi.items.map((i) => i.id);
  const withYes = (n: number) =>
    Object.fromEntries(ids.map((id, i) => [id, i < n])) as Record<string, ScoreAnswer>;

  it.each([
    [0, '4.7%'],
    [1, '4.7%'],
    [2, '8.3%'],
    [3, '13.2%'],
    [4, '19.9%'],
    [5, '26.2%'],
    [6, '40.9%'],
    [7, '40.9%'],
  ])('score %i → %s', (n, risk) => {
    const res = scoreResult(timi, withYes(n));
    expect(res.total).toBe(n);
    expect(res.risk?.value).toBe(risk);
  });

  it('has exactly 7 one-point items', () => {
    expect(timi.items).toHaveLength(7);
    expect(timi.items.every((i) => i.type === 'yesno' && i.points === 1)).toBe(true);
  });
});

describe('GRACE in-hospital mortality (Granger 2003)', () => {
  const grace = def('grace-in-hospital');
  const item = (id: string) => {
    const it = grace.items.find((i) => i.id === id);
    if (it?.type !== 'number') throw new Error(id);
    return it;
  };
  const pts = (id: string, v: number) => itemResult(item(id), v)!.points;

  it('worked example: 65 y, SBP 120, HR 80, creatinine 1.0, Killip I, ST deviation, raised enzymes = 150', () => {
    const res = scoreResult(grace, {
      killip: 'i',
      sbp: 120,
      hr: 80,
      age: 65,
      creatinine: 1.0,
      arrest: false,
      'st-deviation': true,
      enzymes: true,
    });
    expect(res.total).toBe(150);
    expect(res.risk?.value).toBe('3.9%');
    expect(res.band?.label).toBe('High');
  });

  it('lowest possible total', () => {
    const res = scoreResult(grace, {
      killip: 'i',
      sbp: 210,
      hr: 40,
      age: 25,
      creatinine: 0.3,
      arrest: false,
      'st-deviation': false,
      enzymes: false,
    });
    expect(res.total).toBe(1);
    expect(res.risk?.value).toBe('0.2% or less');
    expect(res.band?.label).toBe('Low');
  });

  it('bin edges go to the higher bin', () => {
    expect([pts('sbp', 79), pts('sbp', 80), pts('sbp', 199), pts('sbp', 200)]).toEqual([
      58, 53, 10, 0,
    ]);
    expect([pts('hr', 49), pts('hr', 50), pts('hr', 199), pts('hr', 200)]).toEqual([0, 3, 38, 46]);
    expect([pts('age', 29), pts('age', 30), pts('age', 89), pts('age', 90)]).toEqual([
      0, 8, 91, 100,
    ]);
    expect([pts('creatinine', 3.99), pts('creatinine', 4.0)]).toEqual([21, 28]);
  });

  it('category boundaries 108/109 and 140/141', () => {
    const band = (t: number) => fromLookup(grace.bands!, t).label;
    expect([108, 109, 140, 141].map(band)).toEqual(['Low', 'Intermediate', 'Intermediate', 'High']);
  });

  it('nomogram boundaries', () => {
    const risk = (t: number) => fromLookup(grace.riskTable!.rows, t).risk;
    expect([69, 70, 249, 250].map(risk)).toEqual(['0.2% or less', '0.3%', '44%', '52% or more']);
  });

  it('accepts creatinine in µmol/L', () => {
    const c = item('creatinine');
    expect(toBaseUnit(c, 88.4, 'µmol/L')).toBeCloseTo(1.0);
    expect(binIndex(c, toBaseUnit(c, 353.6, 'µmol/L'))).toBe(c.bins.length - 1); // 4.0 mg/dL
    expect(() => toBaseUnit(c, 1, 'mmol/L')).toThrow(ScoreError);
  });
});
