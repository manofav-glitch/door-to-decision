// npm run validate — checks all content (schema, links, reachability, dead ends, references,
// codex unlocks, doses, assets) and prints problems with file:line. Exit code 1 if anything is wrong.
import { compileContent, ContentError } from '../src/content/compile.ts';

try {
  const c = compileContent(process.cwd());
  const cases = Object.values(c.cases);
  const unverified = c.checks.filter((x) => !x.verified).length;
  console.log(
    `✓ Content OK (version ${c.index.version}): ${cases.length} case(s), ${c.codex.length} codex card(s), ` +
      `${c.checks.length} clinical item(s), ${unverified} unverified.`,
  );
  for (const k of cases)
    console.log(
      `  ${k.id}  ${Object.keys(k.nodes).length} nodes  ${k.draft ? `DRAFT (${k.unverifiedCount} unverified)` : 'verified'}`,
    );
} catch (e) {
  if (e instanceof ContentError) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
  throw e;
}
