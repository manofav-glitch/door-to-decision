// npm run ecg — draws stylised, original teaching ECGs as SVG from content/assets/ecg/*.ecg.yaml.
// The drawing itself lives in src/art/ecgDraw.ts (rhythms, wave shapes, layout).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { EcgSpec } from '../src/content/schema.ts';
import { drawEcg } from '../src/art/ecgDraw.ts';

const dir = join(process.cwd(), 'content', 'assets', 'ecg');
for (const f of readdirSync(dir).filter((f) => f.endsWith('.ecg.yaml'))) {
  const spec = EcgSpec.parse(parse(readFileSync(join(dir, f), 'utf8')));
  const out = f.replace(/\.ecg\.yaml$/, '.svg');
  const svg = drawEcg(spec);
  writeFileSync(join(dir, out), svg);
  console.log(`drew content/assets/ecg/${out} (${(svg.length / 1024).toFixed(0)} KB)`);
}
