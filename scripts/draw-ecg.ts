// npm run ecg — draws stylised, original teaching ECGs as SVG from content/assets/ecg/*.ecg.yaml.
// Each lead is a sum of simple bumps (P, Q, R, S, T) plus an ST offset, in millivolts.
// Not a physiological simulator; Phase 3 grows this into the parameter-driven 12-lead renderer.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { EcgSpec } from '../src/content/schema.ts';

type Shape = { p: number; q: number; r: number; s: number; t: number; st: number };

// Generic normal morphology per standard lead (mV). Specs override per lead.
const NORMAL: Record<string, Shape> = {
  I: { p: 0.1, q: 0.05, r: 0.7, s: 0.1, t: 0.25, st: 0 },
  II: { p: 0.15, q: 0.05, r: 1.0, s: 0.15, t: 0.35, st: 0 },
  III: { p: 0.05, q: 0.05, r: 0.5, s: 0.2, t: 0.15, st: 0 },
  aVR: { p: -0.1, q: 0, r: 0.1, s: 0.7, t: -0.25, st: 0 },
  aVL: { p: 0.05, q: 0.05, r: 0.4, s: 0.2, t: 0.1, st: 0 },
  aVF: { p: 0.1, q: 0.05, r: 0.7, s: 0.15, t: 0.25, st: 0 },
  V1: { p: 0.05, q: 0, r: 0.2, s: 1.0, t: 0.05, st: 0 },
  V2: { p: 0.05, q: 0, r: 0.4, s: 1.4, t: 0.5, st: 0 },
  V3: { p: 0.05, q: 0, r: 0.7, s: 0.9, t: 0.5, st: 0 },
  V4: { p: 0.05, q: 0.05, r: 1.2, s: 0.5, t: 0.45, st: 0 },
  V5: { p: 0.05, q: 0.05, r: 1.3, s: 0.3, t: 0.35, st: 0 },
  V6: { p: 0.05, q: 0.05, r: 1.0, s: 0.15, t: 0.3, st: 0 },
};
const STANDARD = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
// Conventional 3×4 layout: columns of leads, top to bottom.
const GRID = [
  ['I', 'II', 'III'],
  ['aVR', 'aVL', 'aVF'],
  ['V1', 'V2', 'V3'],
  ['V4', 'V5', 'V6'],
];

const PX = 4; // px per mm
const MM_PER_S = 25;
const MM_PER_MV = 10;
const ROW_MM = 30;
const LEFT_MM = 10;
const TOP_MM = 6;
const DT = 0.004;

const g = (x: number, sd: number) => Math.exp(-(x * x) / (2 * sd * sd));
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function beatTimes(spec: EcgSpec) {
  const r = spec.rhythm;
  if (r.kind === 'sinus') {
    const rr = 60 / r.rate;
    const qrs = Array.from({ length: Math.ceil(10 / rr) + 1 }, (_, k) => 0.3 + k * rr);
    return { qrs, p: qrs.map((t) => t - 0.16) };
  }
  const pp = 60 / r.atrialRate;
  const rr = 60 / r.ventricularRate;
  return {
    qrs: Array.from({ length: Math.ceil(10 / rr) + 1 }, (_, k) => 0.55 + k * rr),
    p: Array.from({ length: Math.ceil(10 / pp) + 1 }, (_, k) => 0.12 + k * pp),
  };
}

function voltage(sh: Shape, t: number, beats: { qrs: number[]; p: number[] }) {
  let v = 0;
  for (const tp of beats.p) if (Math.abs(t - tp) < 0.1) v += sh.p * g(t - tp, 0.022);
  for (const tq of beats.qrs) {
    const x = t - tq;
    if (x < -0.1 || x > 0.6) continue;
    v += -sh.q * g(x + 0.022, 0.008) + sh.r * g(x, 0.01) - sh.s * g(x - 0.024, 0.01);
    v += sh.st * smooth(0.035, 0.06, x) * (1 - smooth(0.22, 0.4, x));
    v += sh.t * g(x - 0.28, 0.05);
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
  beats: ReturnType<typeof beatTimes>,
) {
  const pts: [number, number][] = [];
  for (let t = t0; t <= t1 + 1e-9; t += DT) {
    const x = (x0mm + (t - t0) * MM_PER_S) * PX;
    const y = (baseMm - voltage(sh, t, beats) * MM_PER_MV) * PX;
    pts.push([x, y]);
  }
  const s = simplify(pts, 0.35);
  return `M${s.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}`;
}

function draw(spec: EcgSpec): string {
  const labels = spec.labels ?? STANDARD;
  const nameOf = (std: string) => labels[STANDARD.indexOf(std)]!;
  const shapeOf = (label: string, std: string): Shape => ({
    ...(NORMAL[std] ?? NORMAL.II!),
    ...(spec.leads[label] as Partial<Shape> | undefined),
  });
  const beats = beatTimes(spec);
  const rows = spec.layout === '12-lead' ? 4 : 1;
  const wMm = LEFT_MM + 250 + 4;
  const hMm = TOP_MM + rows * ROW_MM + 8;
  const W = wMm * PX;
  const H = hMm * PX;

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
        paths.push(trace(shapeOf(label, std), c * 2.5, c * 2.5 + 2.5, x0, rowBase(r), beats));
        text.push(`<text x="${(x0 + 1.5) * PX}" y="${(rowBase(r) - 13) * PX}">${label}</text>`);
        if (c > 0) paths.push(`M${x0 * PX},${(rowBase(r) - 4) * PX}v${8 * PX}`);
      });
    }
  }
  const stripRow = rows - 1;
  const stripStd = STANDARD.includes(spec.rhythmLead) ? spec.rhythmLead : 'II';
  paths.push(cal(rowBase(stripRow)));
  paths.push(trace(shapeOf(spec.rhythmLead, stripStd), 0, 10, LEFT_MM, rowBase(stripRow), beats));
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

const dir = join(process.cwd(), 'content', 'assets', 'ecg');
for (const f of readdirSync(dir).filter((f) => f.endsWith('.ecg.yaml'))) {
  const spec = EcgSpec.parse(parse(readFileSync(join(dir, f), 'utf8')));
  const out = f.replace(/\.ecg\.yaml$/, '.svg');
  const svg = draw(spec);
  writeFileSync(join(dir, out), svg);
  console.log(`drew content/assets/ecg/${out} (${(svg.length / 1024).toFixed(0)} KB)`);
}
