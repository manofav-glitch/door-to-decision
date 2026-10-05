import { describe, expect, it } from 'vitest';
import { EcgSpec } from '../content/schema';
import { drawEcg, rhythmOf } from './ecgDraw';

const strip = (rhythm: object, extra: object = {}) =>
  EcgSpec.parse({
    title: 't',
    layout: 'strip',
    rhythm,
    check: { source: 'x', verified: false },
    ...extra,
  });
const inTen = (ts: number[]) => ts.filter((t) => t >= 0 && t <= 10).length;

describe('ECG rhythms', () => {
  it('draws the same picture every time', () => {
    const s = strip({ kind: 'pre-excited-af', rate: 220 }, { qrs: 140 });
    expect(drawEcg(s)).toBe(drawEcg(s));
  });

  it('Mobitz I drops one P in every four; 2:1 drops every other P', () => {
    const w = rhythmOf(strip({ kind: 'av-block', type: 'mobitz1', atrialRate: 80 }));
    // first two Wenckebach cycles: 8 P waves, 6 QRS complexes
    expect(w.qrs.filter((b) => b.t < w.p[8]!).length).toBe(6);
    const twoToOne = rhythmOf(strip({ kind: 'av-block', type: '2:1', atrialRate: 80 }));
    expect(twoToOne.qrs.length / twoToOne.p.length).toBeCloseTo(0.5, 1);
  });

  it('Mobitz I lengthens the PR before the dropped beat; Mobitz II keeps it fixed', () => {
    const pr = (kind: 'mobitz1' | 'mobitz2') => {
      const r = rhythmOf(strip({ kind: 'av-block', type: kind, atrialRate: 80 }));
      return r.qrs.slice(0, 3).map((b) => +(b.t - r.p.filter((p) => p < b.t).at(-1)!).toFixed(3));
    };
    const [a, b, c] = pr('mobitz1');
    expect(a! < b! && b! < c!).toBe(true);
    expect(new Set(pr('mobitz2')).size).toBe(1);
  });

  it('2:1 flutter at 300 gives a ventricular rate of 150', () => {
    const r = rhythmOf(strip({ kind: 'flutter', conduction: 2 }));
    expect(inTen(r.qrs.map((b) => b.t))).toBeGreaterThanOrEqual(24);
    expect(inTen(r.qrs.map((b) => b.t))).toBeLessThanOrEqual(26);
  });

  it('VF has no QRS complexes; asystole has none either', () => {
    expect(rhythmOf(strip({ kind: 'vf' })).qrs).toHaveLength(0);
    expect(rhythmOf(strip({ kind: 'asystole', atrialRate: 40 })).qrs).toHaveLength(0);
  });

  it('pacing without capture shows spikes but no paced beats', () => {
    const none = rhythmOf(strip({ kind: 'paced', rate: 70, capture: 'none' }));
    expect(none.spikes.length).toBeGreaterThan(10);
    expect(none.qrs).toHaveLength(0);
    const full = rhythmOf(strip({ kind: 'paced', rate: 70, capture: 'full' }));
    expect(full.qrs).toHaveLength(full.spikes.length);
  });

  it('regularised AF: fibrillating baseline over a regular, slow escape', () => {
    const r = rhythmOf(
      strip({ kind: 'av-dissociation', atrialRate: 0, ventricularRate: 45, atrial: 'af' }),
    );
    expect(r.baseline).toBe('af');
    const gaps = r.qrs.slice(1).map((b, i) => +(b.t - r.qrs[i]!.t).toFixed(4));
    expect(new Set(gaps).size).toBe(1);
  });
});
