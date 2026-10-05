// Stylised, original teaching ECGs drawn as SVG from an EcgSpec (content/assets/ecg/*.ecg.yaml).
// Each lead is a sum of simple bumps (P, Q, R, S, T, plus optional delta wave, r′ and U wave) in
// millivolts, laid on a rhythm: a list of P waves, QRS beats and an optional atrial or ventricular
// baseline (fibrillation, flutter, VF). Not a physiological simulator. Used by scripts/draw-ecg.ts.
import type { EcgSpec } from '../content/schema.ts';
import {
  ecgSize,
  GRID,
  LEFT_MM,
  MM_PER_MV,
  MM_PER_S,
  PX,
  ROW_MM,
  STANDARD_LEADS as STANDARD,
  TOP_MM,
} from './ecgLayout.ts';

export interface Shape {
  p: number;
  q: number;
  r: number;
  s: number;
  t: number;
  st: number;
  pr: number;
  /** slurred upstroke before the R wave (pre-excitation) */
  delta: number;
  /** second R wave after the S (RBBB, pseudo-r′, Brugada) */
  rp: number;
  /** U wave after the T */
  u: number;
  /** 0–1: splits the T wave into two humps (notched/bifid T) */
  notch: number;
  /** T-wave width factor: < 1 narrow and peaked, > 1 broad */
  tw: number;
}

const ZERO = { delta: 0, rp: 0, u: 0, notch: 0, tw: 1 };

// Generic normal morphology per standard lead (mV). Specs override per lead.
export const NORMAL: Record<string, Shape> = {
  I: { p: 0.1, q: 0.05, r: 0.7, s: 0.1, t: 0.25, st: 0, pr: 0, ...ZERO },
  II: { p: 0.15, q: 0.05, r: 1.0, s: 0.15, t: 0.35, st: 0, pr: 0, ...ZERO },
  III: { p: 0.05, q: 0.05, r: 0.5, s: 0.2, t: 0.15, st: 0, pr: 0, ...ZERO },
  aVR: { p: -0.1, q: 0, r: 0.1, s: 0.7, t: -0.25, st: 0, pr: 0, ...ZERO },
  aVL: { p: 0.05, q: 0.05, r: 0.4, s: 0.2, t: 0.1, st: 0, pr: 0, ...ZERO },
  aVF: { p: 0.1, q: 0.05, r: 0.7, s: 0.15, t: 0.25, st: 0, pr: 0, ...ZERO },
  V1: { p: 0.05, q: 0, r: 0.2, s: 1.0, t: 0.05, st: 0, pr: 0, ...ZERO },
  V2: { p: 0.05, q: 0, r: 0.4, s: 1.4, t: 0.5, st: 0, pr: 0, ...ZERO },
  V3: { p: 0.05, q: 0, r: 0.7, s: 0.9, t: 0.5, st: 0, pr: 0, ...ZERO },
  V4: { p: 0.05, q: 0.05, r: 1.2, s: 0.5, t: 0.45, st: 0, pr: 0, ...ZERO },
  V5: { p: 0.05, q: 0.05, r: 1.3, s: 0.3, t: 0.35, st: 0, pr: 0, ...ZERO },
  V6: { p: 0.05, q: 0.05, r: 1.0, s: 0.15, t: 0.3, st: 0, pr: 0, ...ZERO },
};

const DT = 0.004;
const SECONDS = 10;

const g = (x: number, sd: number) => Math.exp(-(x * x) / (2 * sd * sd));
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Seeded pseudo-random numbers, so a drawing never changes between runs. */
const seeded = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;

export interface Beat {
  t: number;
  /** amplitude multiplier (alternans, torsades twisting) */
  amp: number;
  /** QRS width multiplier on top of the spec's QRS width */
  width: number;
  /** extra pre-excitation on this beat, 0–1 (pre-excited AF varies beat to beat) */
  delta: number;
  /** draws a short PR-segment shift before this beat (only when it follows its own P wave) */
  conducted: boolean;
  /** T-wave multiplier (torsades twists the T with the QRS; alternans leaves it alone) */
  tAmp: number;
}

export interface Rhythm {
  p: number[];
  qrs: Beat[];
  baseline: 'none' | 'af' | 'flutter' | 'vf';
  /** flutter wave rate (/min) */
  flutterRate: number;
  /** pacing spike times */
  spikes: number[];
}

const beat = (t: number, extra: Partial<Beat> = {}): Beat => ({
  t,
  amp: 1,
  width: 1,
  delta: 0,
  conducted: false,
  tAmp: 1,
  ...extra,
});
const every = (start: number, rate: number) => {
  const step = 60 / rate;
  return Array.from({ length: Math.ceil(SECONDS / step) + 1 }, (_, k) => start + k * step);
};

export function rhythmOf(spec: EcgSpec): Rhythm {
  const r = spec.rhythm;
  const base: Rhythm = { p: [], qrs: [], baseline: 'none', flutterRate: 300, spikes: [] };
  switch (r.kind) {
    case 'sinus': {
      const qrs = every(0.3, r.rate);
      const pr = (r.pr ?? 160) / 1000;
      return {
        ...base,
        qrs: qrs.map((t, k) =>
          beat(t, { conducted: true, amp: k % 2 === 1 ? 1 - (r.alternans ?? 0) : 1 }),
        ),
        p: qrs.map((t) => t - pr),
      };
    }
    case 'af': {
      // irregularly irregular: intervals 0.6–1.4 × the mean
      const rand = seeded(7);
      const mean = 60 / r.rate;
      const qrs: Beat[] = [];
      for (let t = 0.25; t < SECONDS + 0.2; t += mean * (0.6 + 0.8 * rand())) qrs.push(beat(t));
      return { ...base, qrs, baseline: 'af' };
    }
    case 'av-dissociation': {
      const qrs = every(0.55, r.ventricularRate).map((t) => beat(t));
      if (r.atrial === 'af') return { ...base, qrs, baseline: 'af' };
      return { ...base, qrs, p: every(0.12, r.atrialRate) };
    }
    case 'svt':
      return { ...base, qrs: every(0.25, r.rate).map((t) => beat(t)) };
    case 'flutter': {
      const fr = r.atrialRate ?? 300;
      const qrs: Beat[] = [];
      if (r.conduction === 'variable') {
        const rand = seeded(11);
        for (
          let t = 0.3;
          t < SECONDS + 0.2;
          t += ((rand() < 0.5 ? 2 : rand() < 0.7 ? 3 : 4) * 60) / fr
        )
          qrs.push(beat(t));
      } else every(0.3, fr / r.conduction).forEach((t) => qrs.push(beat(t)));
      // the T wave is lost in the flutter waves
      return {
        ...base,
        qrs: qrs.map((b) => ({ ...b, tAmp: 0.3 })),
        baseline: 'flutter',
        flutterRate: fr,
      };
    }
    case 'av-block': {
      const pr = (r.pr ?? 200) / 1000;
      const p = every(0.15, r.atrialRate);
      const qrs: Beat[] = [];
      if (r.type === 'mobitz1') {
        // 4:3 Wenckebach: PR lengthens by shrinking steps, the 4th P is dropped
        const steps = [0, 0.1, 0.15];
        p.forEach((tp, k) => {
          const i = k % 4;
          if (i < 3) qrs.push(beat(tp + pr + steps[i]!, { conducted: true }));
        });
      } else {
        const drop = r.type === '2:1' ? (k: number) => k % 2 === 1 : (k: number) => k % 4 === 3;
        p.forEach((tp, k) => {
          if (!drop(k)) qrs.push(beat(tp + pr, { conducted: true }));
        });
      }
      return { ...base, p, qrs };
    }
    case 'vt': {
      const qrs = every(0.25, r.rate).map((t) => beat(t));
      return { ...base, qrs, p: r.atrialRate ? every(0.1, r.atrialRate) : [] };
    }
    case 'torsades': {
      // amplitude swells and shrinks, flipping polarity, over a ~2.4 s cycle
      const rand = seeded(5);
      const qrs: Beat[] = [];
      for (let t = 0.3; t < SECONDS + 0.2; t += (60 / r.rate) * (0.9 + 0.2 * rand())) {
        const amp = Math.sin((2 * Math.PI * t) / 2.4) * 1.1 + 0.15;
        qrs.push(beat(t, { amp, tAmp: amp }));
      }
      return { ...base, qrs };
    }
    case 'vf':
      return { ...base, baseline: 'vf' };
    case 'pre-excited-af': {
      const rand = seeded(3);
      const mean = 60 / r.rate;
      const qrs: Beat[] = [];
      for (let t = 0.25; t < SECONDS + 0.2; t += mean * (0.55 + 0.9 * rand()))
        qrs.push(beat(t, { delta: 0.4 + 0.6 * rand(), width: 0.8 + 0.6 * rand() }));
      return { ...base, qrs, baseline: 'af' };
    }
    case 'paced': {
      const spikes = every(0.4, r.rate);
      const rand = seeded(9);
      const qrs: Beat[] = [];
      spikes.forEach((t) => {
        const captured = r.capture === 'full' || (r.capture === 'intermittent' && rand() < 0.5);
        if (captured) qrs.push(beat(t + 0.04, { width: 2.2 }));
      });
      if (r.capture !== 'full' && r.escapeRate)
        every(1.1, r.escapeRate).forEach((t) => qrs.push(beat(t, { width: 1.6 })));
      return { ...base, qrs, spikes, p: r.atrialRate ? every(0.15, r.atrialRate) : [] };
    }
    case 'asystole':
      return { ...base, p: r.atrialRate ? every(0.2, r.atrialRate) : [] };
  }
}

export interface Morphology {
  /** QRS width multiplier (spec qrs ms / 90) */
  w: number;
  /** T-wave centre after the QRS (s) */
  tAt: number;
}

export function morphologyOf(spec: EcgSpec): Morphology {
  return { w: (spec.qrs ?? 90) / 90, tAt: 0.28 + ((spec.qt ?? 390) - 390) / 1000 };
}

export function voltage(sh: Shape, t: number, rh: Rhythm, m: Morphology): number {
  let v = 0;
  for (const tp of rh.p) if (Math.abs(t - tp) < 0.1) v += sh.p * g(t - tp, 0.022);
  const atrialScale = Math.abs(sh.p) / 0.1;
  if (rh.baseline === 'af')
    v +=
      atrialScale *
      (0.035 * Math.sin(2 * Math.PI * 6.3 * t) + 0.025 * Math.sin(2 * Math.PI * 8.9 * t + 1));
  if (rh.baseline === 'flutter') {
    // sawtooth: slow descent then a quick return, negative in the inferior leads (sh.p > 0)
    const phase = (t * rh.flutterRate) / 60;
    const f = phase - Math.floor(phase);
    const saw = f < 0.75 ? 1 - f / 0.75 : (f - 0.75) / 0.25;
    v -= Math.sign(sh.p || 1) * atrialScale * 0.26 * (saw - 0.5);
  }
  if (rh.baseline === 'vf') {
    const k = (sh.r + sh.s) / 1.15;
    v +=
      k *
      (0.45 * Math.sin(2 * Math.PI * 4.7 * t) +
        0.3 * Math.sin(2 * Math.PI * 6.1 * t + 0.7) +
        0.2 * Math.sin(2 * Math.PI * 3.3 * t + 2) * Math.sin(2 * Math.PI * 0.4 * t));
  }
  for (const ts of rh.spikes) if (Math.abs(t - ts) < 0.01) v += 1.4 * g(t - ts, 0.002);

  const tEnd = Math.max(0.6, m.tAt + 0.32);
  for (const b of rh.qrs) {
    const x = t - b.t;
    if (x < -0.15 || x > tEnd) continue;
    const w = m.w * b.width;
    // broad complexes are wider and rounder, not just stretched spikes (identical to before at w ≤ 1)
    const f = w > 1 ? w * (1 + 0.6 * (w - 1)) : w;
    if (b.conducted && rh.p.length && rh.baseline === 'none')
      v += sh.pr * smooth(-0.13, -0.11, x) * (1 - smooth(-0.06, -0.04, x));
    const delta = sh.delta + b.delta * 0.35;
    if (delta) v += b.amp * delta * smooth(-0.06 * w, -0.01 * w, x) * (1 - smooth(0, 0.01 * w, x));
    v +=
      b.amp *
      (-sh.q * g(x + 0.022 * w, 0.008 * f) +
        sh.r * g(x, 0.01 * f) -
        sh.s * g(x - 0.024 * w, 0.01 * f) +
        sh.rp * g(x - 0.05 * w, 0.011 * f));
    const stFrom = 0.035 + 0.04 * (w - 1);
    v += sh.st * smooth(stFrom, stFrom + 0.025, x) * (1 - smooth(m.tAt - 0.06, m.tAt + 0.12, x));
    const tSd = 0.05 * sh.tw * Math.max(1, 0.7 + 0.3 * w);
    if (sh.notch) {
      v += b.tAmp * sh.t * (1 - sh.notch * 0.35) * g(x - m.tAt + 0.045, tSd * 0.7);
      v += b.tAmp * sh.t * (1 - sh.notch * 0.35) * g(x - m.tAt - 0.045, tSd * 0.7);
    } else v += b.tAmp * sh.t * g(x - m.tAt, tSd);
    if (sh.u) v += sh.u * g(x - m.tAt - 0.17, 0.035);
  }
  return v;
}

/** Ramer–Douglas–Peucker: drop points that don't change the drawn line. */
function simplify(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0]!, pts[pts.length - 1]!];
  let worst = 0;
  let idx = 0;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const d =
      Math.abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > worst) [worst, idx] = [d, i];
  }
  if (worst <= eps) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
}

function trace(
  sh: Shape,
  t0: number,
  t1: number,
  x0mm: number,
  baseMm: number,
  rh: Rhythm,
  m: Morphology,
  scale = 1,
) {
  const pts: [number, number][] = [];
  for (let t = t0; t <= t1 + 1e-9; t += DT) {
    const x = (x0mm + (t - t0) * MM_PER_S) * PX;
    const y = (baseMm - voltage(sh, t, rh, m) * scale * MM_PER_MV) * PX;
    pts.push([x, y]);
  }
  const s = simplify(pts, 0.35);
  return `M${s.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}`;
}

export function drawEcg(spec: EcgSpec): string {
  const labels = spec.labels ?? STANDARD;
  const nameOf = (std: string) => labels[STANDARD.indexOf(std)]!;
  const shapeOf = (label: string, std: string): Shape => ({
    ...(NORMAL[std] ?? NORMAL.II!),
    ...(spec.leads[label] as Partial<Shape> | undefined),
  });
  const rh = rhythmOf(spec);
  const m = morphologyOf(spec);
  const { width: W, height: H, rows } = ecgSize(spec.layout);
  const wMm = W / PX;
  const hMm = H / PX;

  const grid: string[] = [];
  for (let x = 0; x <= wMm; x++)
    grid.push(`<path d="M${x * PX},0V${H}" class="${x % 5 ? 'm' : 'M'}"/>`);
  for (let y = 0; y <= hMm; y++)
    grid.push(`<path d="M0,${y * PX}H${W}" class="${y % 5 ? 'm' : 'M'}"/>`);

  const paths: string[] = [];
  const text: string[] = [];
  const cal = (baseMm: number) =>
    `M${2 * PX},${baseMm * PX}h${2 * PX}v${-10 * PX}h${5 * PX}v${10 * PX}h${2 * PX}`;
  const rowBase = (r: number) => TOP_MM + r * ROW_MM + ROW_MM * 0.6;

  if (spec.layout === '12-lead') {
    for (let r = 0; r < 3; r++) {
      paths.push(cal(rowBase(r)));
      GRID.forEach((col, c) => {
        const std = col[r]!;
        const label = nameOf(std);
        const x0 = LEFT_MM + c * 62.5;
        paths.push(
          trace(shapeOf(label, std), c * 2.5, c * 2.5 + 2.5, x0, rowBase(r), rh, m, spec.voltage),
        );
        text.push(`<text x="${(x0 + 1.5) * PX}" y="${(rowBase(r) - 13) * PX}">${label}</text>`);
        if (c > 0) paths.push(`M${x0 * PX},${(rowBase(r) - 4) * PX}v${8 * PX}`);
      });
    }
  }
  const stripRow = rows - 1;
  const stripStd = STANDARD.includes(spec.rhythmLead) ? spec.rhythmLead : 'II';
  paths.push(cal(rowBase(stripRow)));
  paths.push(
    trace(
      shapeOf(spec.rhythmLead, stripStd),
      0,
      10,
      LEFT_MM,
      rowBase(stripRow),
      rh,
      m,
      spec.voltage,
    ),
  );
  text.push(
    `<text x="${(LEFT_MM + 1.5) * PX}" y="${(rowBase(stripRow) - 13) * PX}">${spec.rhythmLead}</text>`,
  );
  text.push(
    `<text class="note" x="${W - 6}" y="${H - 8}" text-anchor="end">Stylised teaching drawing · not a real patient recording · 25 mm/s · 10 mm/mV</text>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${spec.title.replace(/"/g, '')}">
<style>.m{stroke:#ece7da;stroke-width:.6}.M{stroke:#d3ccba;stroke-width:1.1}.tr{fill:none;stroke:#1a1915;stroke-width:1.6;stroke-linejoin:round}text{font:600 13px system-ui,sans-serif;fill:#1a1915}.note{font:400 11px system-ui,sans-serif;fill:#6b675d}</style>
<rect width="${W}" height="${H}" fill="#fbf9f3"/>
<g>${grid.join('')}</g>
<path class="tr" d="${paths.join('')}"/>
${text.join('\n')}
</svg>
`;
}

/**
 * A few seconds of one lead as an SVG path, for the bedside monitor: x from x0 to x1, baseline y0,
 * pxPerMv up (negative y). Uses the spec's rhythm lead, so it matches the printed strip.
 */
export function monitorTrace(
  spec: EcgSpec,
  box: { x0: number; x1: number; y0: number; pxPerMv: number; seconds: number; from?: number },
): string {
  const std = STANDARD.includes(spec.rhythmLead) ? spec.rhythmLead : 'II';
  const sh: Shape = {
    ...(NORMAL[std] ?? NORMAL.II!),
    ...(spec.leads[spec.rhythmLead] as Partial<Shape> | undefined),
  };
  const rh = rhythmOf(spec);
  const m = morphologyOf(spec);
  const from = box.from ?? 1;
  const pts: [number, number][] = [];
  const step = 0.008;
  for (let t = 0; t <= box.seconds + 1e-9; t += step) {
    const x = box.x0 + (t / box.seconds) * (box.x1 - box.x0);
    const v = Math.max(-2.2, Math.min(2.2, voltage(sh, from + t, rh, m) * spec.voltage));
    pts.push([x, box.y0 - v * box.pxPerMv]);
  }
  const s = simplify(pts, 0.25);
  return `M${s.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}`;
}
