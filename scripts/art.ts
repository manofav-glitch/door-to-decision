// Turns the owner's illustrations into small web pictures for the app:
//   content/assets/art/<folder>/<name>.png|jpg|jpeg|webp   originals (kept out of git: too big)
//   → content/assets/panels/<folder>/<name>.webp            at most 800 px, same shape, committed
// A panel shows one with `art: <folder>/<name>`. Pictures already up to date are skipped
// (delete a .webp to remake it).
// Run: npm run art (also runs before `npm run dev` and `npm run build`).
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const SIZE = 800; // px; sharp on phones (≈ 330 css px × 2.5) and on laptops (3 panels a row)
const QUALITY = 72;
const ORIGINAL = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const root = join(import.meta.dirname, '..');
const srcDir = join(root, 'content', 'assets', 'art');
const outDir = join(root, 'content', 'assets', 'panels');

interface Job {
  src: string;
  out: string;
}
const jobs: Job[] = [];
const folders = existsSync(srcDir)
  ? readdirSync(srcDir).filter((d) => statSync(join(srcDir, d)).isDirectory())
  : [];
for (const folder of folders) {
  // name → newest original (a re-made picture may come back as .png when the old one was .webp)
  const newest = new Map<string, string>();
  for (const f of readdirSync(join(srcDir, folder))) {
    const ext = extname(f).toLowerCase();
    if (!ORIGINAL.has(ext)) continue;
    const name = f.slice(0, -ext.length);
    const file = join(srcDir, folder, f);
    const prev = newest.get(name);
    if (prev) {
      console.log(`Two originals for ${folder}/${name}; using the newer one.`);
      if (statSync(prev).mtimeMs >= statSync(file).mtimeMs) continue;
    }
    newest.set(name, file);
  }
  for (const [name, src] of newest) {
    const out = join(outDir, folder, `${name}.webp`);
    if (existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) continue;
    jobs.push({ src, out });
  }
}

if (jobs.length === 0) {
  console.log('Pictures are up to date.');
} else {
  const { default: sharp } = await import('sharp');
  for (const { src, out } of jobs) {
    mkdirSync(join(out, '..'), { recursive: true });
    const { width = 0, height = 0 } = await sharp(src).metadata();
    const long = Math.max(width, height);
    // Small originals (e.g. cut from a ChatGPT sheet) are enlarged up to 2× and sharpened, which keeps
    // the ink lines crisp on phones. It can't add detail: a full-size original is still better.
    const target = Math.min(SIZE, long * 2);
    let img = sharp(src).rotate().resize(target, target, { fit: 'inside', kernel: 'lanczos3' }); // keeps the shape: square or wide
    if (target > long) img = img.sharpen({ sigma: 1, m1: 0.6, m2: 2.5 });
    const info = await img.webp({ quality: QUALITY, effort: 6 }).toFile(out);
    const note = target > long ? `  (enlarged from ${long} px)` : '';
    console.log(
      `${relative(root, out)}  ${info.width}×${info.height}  ${Math.round(info.size / 1024)} KB${note}`,
    );
  }
}
