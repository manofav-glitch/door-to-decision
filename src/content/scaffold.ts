// Creates a new case file from docs/templates/case.yaml and lists it in the module.
// Used by `npm run new-case` and the /new-case Claude skill.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export class ScaffoldError extends Error {}

export interface NewCase {
  system: string; // e.g. cvs
  module: string; // e.g. chest-pain
  name: string; // file name, e.g. cp-03
  title: string; // presentation, e.g. "62F, sudden tearing back pain"
}

const NAME = /^[a-z0-9][a-z0-9-]*$/;

/** Writes the case file and updates module.yaml. Returns the new file's path relative to root. */
export function scaffoldCase(root: string, c: NewCase): string {
  for (const [k, v] of Object.entries({ system: c.system, module: c.module, name: c.name }))
    if (!NAME.test(v)) throw new ScaffoldError(`${k} "${v}" must be lower-case letters, digits and "-"`);
  if (!c.title.trim()) throw new ScaffoldError('a title is needed (the presentation, not the diagnosis)');
  if (c.title.includes('"')) throw new ScaffoldError('the title cannot contain double quotes');

  const modDir = join(root, 'content', c.system, c.module);
  const modFile = join(modDir, 'module.yaml');
  if (!existsSync(modFile)) throw new ScaffoldError(`no module at content/${c.system}/${c.module}/module.yaml`);
  const caseFile = join(modDir, 'cases', `${c.name}.yaml`);
  if (existsSync(caseFile)) throw new ScaffoldError(`content/${c.system}/${c.module}/cases/${c.name}.yaml already exists`);

  const id = `${c.system}-${c.name}`;
  const template = readFileSync(join(root, 'docs', 'templates', 'case.yaml'), 'utf8');
  writeFileSync(caseFile, template.replaceAll('{{ID}}', id).replaceAll('{{TITLE}}', c.title.trim()));

  // add the case to `cases:` in module.yaml (flow list `[a, b]` or block list `- a`)
  const mod = readFileSync(modFile, 'utf8');
  const flow = /^cases:\s*\[([^\]]*)\]/m;
  let updated: string;
  if (flow.test(mod))
    updated = mod.replace(flow, (_, items: string) => {
      const list = items.split(',').map((x) => x.trim()).filter(Boolean);
      return `cases: [${[...list, c.name].join(', ')}]`;
    });
  else if (/^cases:\s*$/m.test(mod)) updated = mod.replace(/^cases:\s*$((?:\n\s+-[^\n]*)*)/m, (m) => `${m}\n  - ${c.name}`);
  else throw new ScaffoldError('could not find `cases:` in module.yaml; add the case there by hand');
  writeFileSync(modFile, updated);
  return relative(root, caseFile);
}
