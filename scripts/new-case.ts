// npm run new-case -- <system> <module> <name> "<title>"
// e.g. npm run new-case -- cvs chest-pain cp-03 "62F, sudden tearing back pain"
// Creates the case from the template, lists it in module.yaml, then validates and draws its graph.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { compileContent, ContentError } from '../src/content/compile.ts';
import { caseGraph } from '../src/content/graph.ts';
import { scaffoldCase, ScaffoldError } from '../src/content/scaffold.ts';

const [system, module, name, ...titleWords] = process.argv.slice(2);
if (!system || !module || !name || titleWords.length === 0) {
  console.error('Usage: npm run new-case -- <system> <module> <name> "<title>"');
  console.error('  e.g. npm run new-case -- cvs chest-pain cp-03 "62F, sudden tearing back pain"');
  process.exit(1);
}

try {
  const root = process.cwd();
  const file = scaffoldCase(root, { system, module, name, title: titleWords.join(' ') });
  console.log(`✓ Created ${file} and added "${name}" to module.yaml`);
  const c = compileContent(root);
  const id = `${system}-${name}`;
  mkdirSync(join(root, 'docs', 'graphs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'graphs', `${id}.md`), caseGraph(c.cases[id]!));
  console.log(`✓ Content still valid; drew docs/graphs/${id}.md`);
  console.log(
    `Next: fill in the TODOs in ${file} (see docs/CONTENT_GUIDE.md), then npm run validate.`,
  );
} catch (e) {
  if (e instanceof ScaffoldError) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
  if (e instanceof ContentError) {
    console.error(`✗ The new case was created, but content has problems:\n${e.message}`);
    process.exit(1);
  }
  throw e;
}
