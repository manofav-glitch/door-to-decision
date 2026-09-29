// npm run graph — writes a Mermaid flowchart per case to docs/graphs/<case>.md
// (GitHub shows these as diagrams). Pass case ids to limit: npm run graph -- cvs-cp-01
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileContent, ContentError } from '../src/content/compile.ts';
import { caseGraph } from '../src/content/graph.ts';

try {
  const { cases } = compileContent(process.cwd());
  const only = process.argv.slice(2);
  const dir = join(process.cwd(), 'docs', 'graphs');
  mkdirSync(dir, { recursive: true });
  for (const c of Object.values(cases)) {
    if (only.length && !only.includes(c.id)) continue;
    writeFileSync(join(dir, `${c.id}.md`), caseGraph(c));
    console.log(`drew docs/graphs/${c.id}.md (${Object.keys(c.nodes).length} nodes)`);
  }
} catch (e) {
  if (e instanceof ContentError) {
    console.error(`✗ Fix content problems first:\n${e.message}`);
    process.exit(1);
  }
  throw e;
}
