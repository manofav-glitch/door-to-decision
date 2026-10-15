// Cuts one ChatGPT comic sheet (panels in a grid, cream gutters) into separate originals, and
// optionally wires them into a case:
//   node scripts/cut-sheet.ts <sheet> <folder> <cols> <name1,name2,...> [case.yaml]
// → content/assets/art/<folder>/<name>.png, in reading order (extra grid cells, e.g. a blank last
// one, are ignored). With a case file, `art: <folder>/<name>` is added under each non-monitor
// `- scene:` line in order; a name of `-` skips that panel (it stays line art).
// Then run `npm run art` to make the web pictures.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LIGHT = 215; // every channel at least this → cream paper
// share of light pixels that makes a row/column a gutter; lower it with --gutter=0.45 when a sheet's
// gutters come out darker (a crop then shows a cream strip and border line at its edge)
const gutterArg = process.argv.find((a) => a.startsWith('--gutter='));
const GUTTER = gutterArg ? Number(gutterArg.slice('--gutter='.length)) : 0.85;
const MIN_PANEL = 60; // px; shorter runs are borders or noise
const INSET = 5; // px trimmed inside each panel to drop its dark border

const [sheet, folder, colsArg, namesArg, caseFile] = process.argv
  .slice(2)
  .filter((a) => !a.startsWith('--'));
if (!sheet || !folder || !colsArg || !namesArg) {
  console.error('Usage: node scripts/cut-sheet.ts <sheet> <folder> <cols> <names> [case.yaml]');
  process.exit(1);
}
const cols = Number(colsArg);
const names = namesArg.split(',');
const root = join(import.meta.dirname, '..');

const { default: sharp } = await import('sharp');
const { data, info } = await sharp(sheet).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const light = (x: number, y: number) => {
  const i = (y * W + x) * C;
  return [0, 1, 2].every((c) => (data[i + c] ?? 0) >= LIGHT);
};

// Runs of non-gutter lines along one axis, judged over part of the other axis
function bands(length: number, span: number, isLight: (a: number, b: number) => boolean) {
  const out: [number, number][] = [];
  let start = -1;
  for (let a = 0; a <= length; a++) {
    let n = 0;
    if (a < length) for (let b = 0; b < span; b++) if (isLight(a, b)) n++;
    const gutter = a === length || n / span >= GUTTER;
    if (!gutter && start < 0) start = a;
    if (gutter && start >= 0) {
      if (a - start >= MIN_PANEL) out.push([start, a - 1]);
      start = -1;
    }
  }
  return out;
}
// Rows judged on the left column only (the blank last cell would hide the gutters on the right);
// columns judged on the top 60%.
const rows = bands(H, Math.floor(W / cols), (y, x) => light(x, y));
const colBands = bands(W, Math.floor(H * 0.6), (x, y) => light(x, y));
console.log(`${W}x${H} rows ${JSON.stringify(rows)} cols ${JSON.stringify(colBands)}`);
if (colBands.length !== cols) throw new Error(`Found ${colBands.length} columns, expected ${cols}`);
if (rows.length * cols < names.length)
  throw new Error(`Only ${rows.length * cols} cells for ${names.length} names`);

const dir = join(root, 'content', 'assets', 'art', folder);
mkdirSync(dir, { recursive: true });
for (const [i, name] of names.entries()) {
  if (name === '-') continue;
  const row = rows[Math.floor(i / cols)];
  const col = colBands[i % cols];
  if (!row || !col) continue;
  const [y0, y1] = row;
  const [x0, x1] = col;
  const left = x0 + INSET;
  const top = y0 + INSET;
  const width = x1 - x0 + 1 - 2 * INSET;
  const height = y1 - y0 + 1 - 2 * INSET;
  await sharp(sheet)
    .extract({ left, top, width, height })
    .png()
    .toFile(join(dir, `${name}.png`));
  console.log(`${name} ${width} ${height}`);
}

if (caseFile) {
  const lines = readFileSync(caseFile, 'utf8').split('\n');
  const out: string[] = [];
  let next = 0;
  for (const [i, line] of lines.entries()) {
    out.push(line);
    const m = /^(\s*)- scene: (\S+)/.exec(line);
    if (!m || m[2] === 'monitor') continue;
    const name = names[next++];
    if (name === undefined) throw new Error(`More scenes than names (line ${i + 1})`);
    if (name === '-') continue;
    if (/^\s*art:/.test(lines[i + 1] ?? '')) throw new Error(`Line ${i + 2} already has art`);
    out.push(`${m[1]}  art: ${folder}/${name}`);
  }
  if (next !== names.length) throw new Error(`${names.length} names but ${next} scenes`);
  writeFileSync(caseFile, out.join('\n'));
  console.log(`wired ${names.filter((n) => n !== '-').length}`);
}
