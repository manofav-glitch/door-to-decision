// Build-time content compiler: reads /content YAML, validates it with Zod, cross-checks every link,
// and returns compiled JSON. Any problem is collected with file:line and the whole build fails.
// Runs in Node (vite plugin, scripts, tests) — never shipped to the browser.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { LineCounter, parseDocument, type Document } from 'yaml';
import type { z } from 'zod';
import {
  ArtCredits,
  BenchmarksFile,
  Case,
  CodexCard,
  EcgSpec,
  ModuleFile,
  ReferencesFile,
  SystemsFile,
  type Condition,
  type Effects,
  type Next,
  type Node,
} from './schema.ts';
import { itemResult, ScoreError } from '../clinical/score.ts';
import { ecgLayout, type EcgLayout } from '../art/ecgLayout.ts';
import {
  CODEX_KINDS,
  type CaseSummary,
  type Check,
  type CheckEntry,
  type CodexEntry,
  type CompiledCase,
  type ContentIndex,
  type ModuleSummary,
  type Reference,
  type ResolvedDose,
  type ResolvedScore,
  type SystemSummary,
} from './types.ts';

export interface ContentProblem {
  file: string;
  line?: number;
  where?: string;
  message: string;
}

export interface Compiled {
  index: ContentIndex;
  cases: Record<string, CompiledCase>;
  codex: CodexEntry[];
  checks: CheckEntry[];
  /** every file read, for watching */
  files: string[];
  /** case id -> asset paths (relative to content/assets) */
  caseAssets: Record<string, string[]>;
  ecgSpecs: Record<string, { file: string; spec: z.infer<typeof EcgSpec> }>;
  references: Reference[];
  /** style hints that don't block the build */
  warnings: ContentProblem[];
}

export class ContentError extends Error {
  problems: ContentProblem[];
  constructor(problems: ContentProblem[]) {
    super(formatProblems(problems));
    this.problems = problems;
  }
}

export function formatProblems(problems: ContentProblem[]): string {
  const lines = problems.map(
    (p) =>
      `  ${p.file}${p.line ? `:${p.line}` : ''}${p.where ? `  [${p.where}]` : ''}\n      ${p.message}`,
  );
  return `Content has ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n${lines.join('\n')}`;
}

type Path = (string | number)[];

interface Loaded<T> {
  file: string;
  data: T;
  lineOf: (path: Path) => number | undefined;
}

export function compileContent(root: string): Compiled {
  const contentDir = join(root, 'content');
  const problems: ContentProblem[] = [];
  const warnings: ContentProblem[] = [];
  const files: string[] = [];
  const rel = (f: string) => relative(root, f);

  function load<S extends z.ZodType>(file: string, schema: S): Loaded<z.output<S>> | undefined {
    files.push(file);
    if (!existsSync(file)) {
      problems.push({ file: rel(file), message: 'file is missing' });
      return undefined;
    }
    const lc = new LineCounter();
    const doc = parseDocument(readFileSync(file, 'utf8'), { lineCounter: lc, prettyErrors: true });
    if (doc.errors.length) {
      for (const e of doc.errors)
        problems.push({ file: rel(file), line: e.linePos?.[0].line, message: e.message });
      return undefined;
    }
    const lineOf = (path: Path) => lineOfPath(doc, lc, path);
    const parsed = schema.safeParse(doc.toJS());
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path as Path;
        let message = issue.message;
        if (issue.code === 'unrecognized_keys')
          message = `unknown field(s): ${issue.keys.join(', ')} — check spelling`;
        problems.push({ file: rel(file), line: lineOf(path), where: path.join('.'), message });
      }
      return undefined;
    }
    return { file: rel(file), data: parsed.data, lineOf };
  }

  // ---- shared files ----
  const systems = load(join(contentDir, 'systems.yaml'), SystemsFile);
  const refsFile = load(join(contentDir, 'references.yaml'), ReferencesFile);
  const bench = load(join(contentDir, 'benchmarks.yaml'), BenchmarksFile);

  const refs = new Map<string, Reference>();
  for (const r of refsFile?.data ?? []) {
    if (refs.has(r.id)) problems.push({ file: refsFile!.file, message: `duplicate reference id "${r.id}"` });
    refs.set(r.id, r);
  }
  const targets = new Map((bench?.data.timeTargets ?? []).map((t) => [t.id, t]));
  // illustrations: credits are only required once a panel uses art
  const creditsFile = join(contentDir, 'assets', 'art', 'credits.yaml');
  const credits = existsSync(creditsFile) ? load(creditsFile, ArtCredits) : undefined;
  const creditedArt = new Set((credits?.data ?? []).map((c) => c.folder));
  const usedArt = new Set<string>();

  // every check's source must be a known reference
  const checks: CheckEntry[] = [];
  function collectChecks(loaded: Loaded<unknown>) {
    walkChecks(loaded.data, [], (check, path, owner) => {
      const source = Array.isArray(check.source) ? check.source : [check.source];
      for (const s of source)
        if (!refs.has(s))
          problems.push({
            file: loaded.file,
            line: loaded.lineOf([...path, 'check', 'source']),
            where: path.join('.'),
            message: `unknown reference "${s}" — add it to content/references.yaml`,
          });
      checks.push({
        file: loaded.file,
        line: loaded.lineOf([...path, 'check']) ?? 0,
        where: path.join('.') || '(whole file)',
        what: describe(owner),
        source,
        verified: check.verified,
        reviewedOn: check.reviewedOn,
        todo: check.todo,
      });
    });
  }
  if (bench) collectChecks(bench);

  // ---- ECG drawing specs ----
  const ecgSpecs: Compiled['ecgSpecs'] = {};
  const ecgDir = join(contentDir, 'assets', 'ecg');
  for (const f of listFiles(ecgDir, '.ecg.yaml')) {
    const loaded = load(f, EcgSpec);
    if (!loaded) continue;
    collectChecks(loaded);
    ecgSpecs[`ecg/${basename(f, '.ecg.yaml')}.svg`] = { file: loaded.file, spec: loaded.data };
  }

  // ---- codex ----
  const codex: CodexEntry[] = [];
  const codexById = new Map<string, CodexEntry>();
  for (const kind of CODEX_KINDS) {
    for (const f of listFiles(join(contentDir, 'codex', kind), '.yaml')) {
      const loaded = load(f, CodexCard);
      if (!loaded) continue;
      const card = loaded.data;
      if (card.id !== basename(f, '.yaml'))
        problems.push({ file: loaded.file, line: loaded.lineOf(['id']), message: `id "${card.id}" must match the file name "${basename(f, '.yaml')}"` });
      if (codexById.has(card.id))
        problems.push({ file: loaded.file, message: `codex id "${card.id}" is used twice` });
      for (const r of card.refs)
        if (!refs.has(r)) problems.push({ file: loaded.file, line: loaded.lineOf(['refs']), message: `unknown reference "${r}"` });
      const doseIds = new Set<string>();
      for (const d of card.doses) {
        if (doseIds.has(d.id)) problems.push({ file: loaded.file, message: `dose id "${d.id}" is used twice` });
        doseIds.add(d.id);
      }
      if (kind === 'scores' && !card.score)
        problems.push({ file: loaded.file, message: 'cards in codex/scores need a score: section' });
      if (kind !== 'scores' && card.score)
        problems.push({ file: loaded.file, line: loaded.lineOf(['score']), message: 'only cards in codex/scores may have a score:' });
      if (card.score?.bandsSource && !refs.has(card.score.bandsSource))
        problems.push({ file: loaded.file, line: loaded.lineOf(['score', 'bandsSource']), message: `unknown reference "${card.score.bandsSource}"` });
      collectChecks(loaded);
      const draft =
        !card.check.verified ||
        card.doses.some((d) => !d.check.verified) ||
        (card.score !== undefined && !card.score.check.verified);
      const entry: CodexEntry = {
        ...card,
        kind,
        draft,
        refDetails: card.refs.map((r) => refs.get(r)).filter((r): r is Reference => !!r),
      };
      codex.push(entry);
      codexById.set(card.id, entry);
    }
  }

  // ---- systems → modules → cases ----
  const cases: Record<string, CompiledCase> = {};
  const caseAssets: Record<string, string[]> = {};
  const systemSummaries: SystemSummary[] = [];

  for (const sys of systems?.data ?? []) {
    const modules: ModuleSummary[] = [];
    const sysDir = join(contentDir, sys.id);
    const moduleDirs = existsSync(sysDir)
      ? readdirSync(sysDir).filter((d) => statSync(join(sysDir, d)).isDirectory())
      : [];
    if (sys.status === 'active' && moduleDirs.length === 0)
      problems.push({ file: systems!.file, message: `system "${sys.id}" is active but content/${sys.id}/ has no modules` });

    for (const modDir of moduleDirs) {
      const mod = load(join(sysDir, modDir, 'module.yaml'), ModuleFile);
      if (!mod) continue;
      if (mod.data.id !== modDir)
        problems.push({ file: mod.file, line: mod.lineOf(['id']), message: `id "${mod.data.id}" must match the folder name "${modDir}"` });
      const caseDir = join(sysDir, modDir, 'cases');
      const onDisk = listFiles(caseDir, '.yaml').map((f) => basename(f, '.yaml'));
      for (const name of onDisk)
        if (!mod.data.cases.includes(name))
          problems.push({ file: mod.file, line: mod.lineOf(['cases']), message: `case file ${name}.yaml exists but is not listed under cases:` });

      const summaries: CaseSummary[] = [];
      mod.data.cases.forEach((name, i) => {
        const file = join(caseDir, `${name}.yaml`);
        if (!existsSync(file)) {
          problems.push({ file: mod.file, line: mod.lineOf(['cases', i]), message: `listed case "${name}" has no file cases/${name}.yaml` });
          return;
        }
        const loaded = load(file, Case);
        if (!loaded) return;
        const before = problems.length;
        const compiled = compileCase(loaded, {
          system: sys.id,
          module: mod.data.id,
          name,
          settings: mod.data.settings,
          refs,
          targets,
          vitalLimits: bench?.data.vitalLimits,
          codexById,
          contentDir,
          ecgSpecs,
          creditedArt,
          usedArt,
          problems,
          warnings,
        });
        if (!compiled || problems.length > before) return;
        const checksBefore = checks.length;
        collectChecks(loaded);
        const own = checks.slice(checksBefore);
        const depChecks: Check[] = [
          ...Object.values(compiled.doses).map((d) => d.check),
          ...Object.values(compiled.scores).map((x) => x.def.check),
          ...Object.values(compiled.imageChecks),
          ...Object.values(compiled.timeTargets).flat().map((t) => t.check),
          ...(bench ? [bench.data.vitalLimits.check] : []),
        ];
        compiled.unverifiedCount =
          own.filter((c) => !c.verified).length + depChecks.filter((c) => !c.verified).length;
        compiled.draft = compiled.unverifiedCount > 0;
        if (cases[compiled.id])
          problems.push({ file: loaded.file, message: `case id "${compiled.id}" is used twice` });
        cases[compiled.id] = compiled;
        caseAssets[compiled.id] = collectAssets(compiled);
        const artBytes = caseAssets[compiled.id]!
          .filter((a) => a.startsWith('panels/'))
          .reduce((sum, a) => sum + statSync(join(contentDir, 'assets', a)).size, 0);
        summaries.push({
          id: compiled.id,
          file: name,
          title: compiled.title,
          difficulty: compiled.difficulty,
          minutes: compiled.minutes,
          draft: compiled.draft,
          settings: compiled.settings,
          artBytes,
        });
      });
      modules.push({ id: mod.data.id, title: mod.data.title, blurb: mod.data.blurb, cases: summaries });
    }
    systemSummaries.push({ id: sys.id, name: sys.name, status: sys.status, blurb: sys.blurb, modules });
  }

  // pictures nobody uses (e.g. renamed, or an old version) would still ship with the app
  const panelsDir = join(contentDir, 'assets', 'panels');
  for (const folder of existsSync(panelsDir) ? readdirSync(panelsDir) : []) {
    for (const f of listFiles(join(panelsDir, folder), '.webp')) {
      const art = `${folder}/${basename(f, '.webp')}`;
      if (usedArt.has(art)) files.push(f);
      else warnings.push({ file: rel(f), message: `no panel uses this picture (add art: ${art} to a panel, or delete the file)` });
    }
  }

  if (problems.length) throw new ContentError(problems);

  const hash = createHash('sha256');
  for (const f of [...files].sort()) if (existsSync(f)) hash.update(readFileSync(f));
  const index: ContentIndex = {
    version: hash.digest('hex').slice(0, 8),
    systems: systemSummaries,
    codex: codex.map((c) => ({ id: c.id, kind: c.kind, title: c.title, draft: c.draft })),
  };
  return {
    index,
    cases,
    codex,
    checks,
    files,
    caseAssets,
    ecgSpecs,
    references: [...refs.values()],
    warnings,
  };
}

// ---------------------------------------------------------------------------------------------

interface CaseContext {
  system: string;
  module: string;
  name: string;
  settings: { id: string; label: string; description: string }[];
  refs: Map<string, Reference>;
  targets: Map<string, CompiledCase['timeTargets'][string][number]>;
  vitalLimits: z.infer<typeof BenchmarksFile>['vitalLimits'] | undefined;
  codexById: Map<string, CodexEntry>;
  contentDir: string;
  ecgSpecs: Compiled['ecgSpecs'];
  /** folders listed in content/assets/art/credits.yaml */
  creditedArt: Set<string>;
  /** filled in: every art name the case uses */
  usedArt: Set<string>;
  problems: ContentProblem[];
  warnings: ContentProblem[];
}

function compileCase(loaded: Loaded<Case>, ctx: CaseContext): CompiledCase | undefined {
  const c = loaded.data;
  const err = (path: Path, message: string) =>
    ctx.problems.push({ file: loaded.file, line: loaded.lineOf(path), where: path.join('.'), message });

  const warn = (path: Path, message: string) =>
    ctx.warnings.push({ file: loaded.file, line: loaded.lineOf(path), where: path.join('.'), message });
  styleWarnings(c, warn);

  const expectedId = `${ctx.system}-${ctx.name}`;
  if (c.id !== expectedId) err(['id'], `id must be "${expectedId}" (system + file name)`);

  // settings
  const settingIds = new Set(ctx.settings.map((s) => s.id));
  for (const [i, s] of (c.settings ?? []).entries())
    if (!settingIds.has(s)) err(['settings', i], `unknown setting "${s}" — define it in module.yaml`);
  const caseSettings = ctx.settings.filter((s) => c.settings?.includes(s.id));

  // nodes: fill option ids, check links
  const nodes: Record<string, Node> = {};
  const flagsSet = new Set<string>(c.initial.flags);
  const flagsRead: { flag: string; path: Path }[] = [];
  const settingsRead: { setting: string; path: Path }[] = [];
  const milestones = new Set<string>(['door']);
  const doses: Record<string, ResolvedDose> = {};
  const scores: Record<string, ResolvedScore> = {};
  const leadLayouts: Record<string, EcgLayout> = {};
  const imageChecks: Record<string, Check> = {};
  const artSizes: Record<string, [number, number]> = {};
  const rhythms: Record<string, EcgSpec> = {};
  // every `rhythm:` (initial state and effects) must name a drawn ECG; its check joins the case's checks
  const noteRhythms = (value: unknown, path: Path): void => {
    if (Array.isArray(value)) value.forEach((v, i) => noteRhythms(v, [...path, i]));
    else if (value && typeof value === 'object')
      for (const [k, v] of Object.entries(value)) {
        if (k === 'rhythm' && typeof v === 'string') {
          const spec = ctx.ecgSpecs[v];
          if (!spec) err([...path, k], `rhythm ${v} is not a drawn ECG (needs content/assets/${v.replace(/\.svg$/, '.ecg.yaml')})`);
          else {
            rhythms[v] = spec.spec;
            imageChecks[v] = spec.spec.check;
          }
        } else noteRhythms(v, [...path, k]);
      }
  };
  noteRhythms(c.initial, ['initial']);
  noteRhythms(c.nodes, ['nodes']);

  const noteEffects = (e: Effects | undefined) => {
    if (!e) return;
    e.addFlags?.forEach((f) => flagsSet.add(f));
    const m = e.milestone;
    if (m) (Array.isArray(m) ? m : [m]).forEach((x) => milestones.add(x));
  };
  const noteCondition = (cond: Condition | undefined, path: Path) => {
    if (!cond) return;
    walkCondition(cond, (leaf) => {
      if ('flag' in leaf) flagsRead.push({ flag: leaf.flag, path });
      if ('notFlag' in leaf) flagsRead.push({ flag: leaf.notFlag, path });
      if ('setting' in leaf) settingsRead.push({ setting: leaf.setting, path });
    });
  };
  const noteNext = (next: Next | undefined, path: Path) => {
    if (next && typeof next !== 'string') next.forEach((n, i) => noteCondition(n.if, [...path, i, 'if']));
  };
  const checkImage = (img: string, path: Path) => {
    if (!existsSync(join(ctx.contentDir, 'assets', img)))
      err(path, `image content/assets/${img} does not exist`);
    const spec = ctx.ecgSpecs[img];
    if (spec) imageChecks[img] = spec.spec.check;
  };
  const checkArt = (art: string, path: Path) => {
    const file = join(ctx.contentDir, 'assets', 'panels', `${art}.webp`);
    if (existsSync(file)) {
      const size = webpSize(readFileSync(file));
      if (size) artSizes[art] = size;
      else err(path, `content/assets/panels/${art}.webp is not a WebP picture: run npm run art`);
    } else
      err(path, `picture content/assets/panels/${art}.webp is missing: put the original in content/assets/art/${art}.png and run npm run art`);
    const folder = art.split('/')[0]!;
    if (!ctx.creditedArt.has(folder))
      err(path, `add "${folder}" to content/assets/art/credits.yaml (who made these pictures, and with what)`);
    ctx.usedArt.add(art);
  };

  for (const [id, node] of Object.entries(c.nodes)) {
    const p: Path = ['nodes', id];
    noteEffects(node.onEnter);
    node.panels?.forEach((panel, i) => {
      if (panel.image) checkImage(panel.image, [...p, 'panels', i, 'image']);
      if (panel.art) checkArt(panel.art, [...p, 'panels', i, 'art']);
    });
    if (node.type === 'ecg' || node.type === 'ecg-leads') checkImage(node.image, [...p, 'image']);
    if (node.type === 'ecg-leads') {
      for (const k of ['correct', 'partial', 'wrong'] as const) {
        noteEffects(node[k].effects);
        noteNext(node[k].next, [...p, k, 'next']);
      }
      const spec = ctx.ecgSpecs[node.image]?.spec;
      if (!spec || spec.layout !== '12-lead')
        err([...p, 'image'], 'tap-the-lead needs a 12-lead drawing made from a .ecg.yaml file');
      else {
        const layout = ecgLayout(spec.labels);
        leadLayouts[node.image] = layout;
        const labels = layout.leads.map((l) => l.label);
        node.answer.forEach((a, i) => {
          if (!labels.includes(a))
            err([...p, 'answer', i], `"${a}" is not a lead on this ECG (${labels.join(', ')})`);
        });
      }
    }
    if ('next' in node) noteNext(node.next, [...p, 'next']);

    if (node.type === 'choice' || node.type === 'ecg' || node.type === 'multiselect') {
      const ids = new Set<string>();
      node.options = node.options.map((o, i) => {
        const oid = o.id ?? `o${i + 1}`;
        if (ids.has(oid)) err([...p, 'options', i, 'id'], `option id "${oid}" is used twice`);
        ids.add(oid);
        noteEffects(o.effects);
        noteEffects(o.missedEffects);
        noteCondition(o.showIf, [...p, 'options', i, 'showIf']);
        noteNext(o.next, [...p, 'options', i, 'next']);
        if (node.type === 'multiselect' && o.next)
          err([...p, 'options', i, 'next'], 'multiselect options cannot have their own next — put next on the node');
        if (node.type !== 'multiselect' && !o.next)
          err([...p, 'options', i], 'every option needs a next:');
        if (node.type !== 'multiselect' && o.missedEffects)
          err([...p, 'options', i, 'missedEffects'], 'missedEffects only applies to multiselect options');
        return { ...o, id: oid };
      });
      if (node.type === 'multiselect' && node.max > node.options.length)
        err([...p, 'max'], `max (${node.max}) is more than the number of options`);
      if (node.type === 'multiselect' && node.min > node.max) err([...p, 'min'], 'min is more than max');
    }
    if (node.type === 'dose') {
      for (const k of ['correct', 'under', 'over'] as const) {
        noteEffects(node[k].effects);
        noteNext(node[k].next, [...p, k, 'next']);
      }
      const card = ctx.codexById.get(node.drug);
      const dose = card?.doses.find((d) => d.id === node.dose);
      // a dose node asks for a drug dose, or an energy/current from a procedure card (shock in J, pacing in mA)
      if (!card || (card.kind !== 'drugs' && card.kind !== 'procedures'))
        err([...p, 'drug'], `no drug card content/codex/drugs/${node.drug}.yaml (or procedure card in codex/procedures)`);
      else if (!dose) err([...p, 'dose'], `${card.kind === 'drugs' ? 'drug' : 'procedure'} card "${node.drug}" has no dose with id "${node.dose}"`);
      else if (!dose.rule) err([...p, 'dose'], `dose "${node.dose}" on "${node.drug}" needs a rule: to be asked in a dose node`);
      else
        doses[`${node.drug}/${node.dose}`] = {
          drugId: card.id,
          drugTitle: card.title,
          label: dose.label,
          route: dose.route,
          text: dose.text,
          rule: dose.rule,
          check: dose.check,
        };
    }
    if (node.type === 'calculator') {
      for (const k of ['correct', 'close', 'wrong'] as const) {
        noteEffects(node[k].effects);
        noteNext(node[k].next, [...p, k, 'next']);
      }
      const card = ctx.codexById.get(node.score);
      if (!card?.score) err([...p, 'score'], `no score card content/codex/scores/${node.score}.yaml`);
      else {
        scores[card.id] = { id: card.id, title: card.title, def: card.score, refs: card.refDetails };
        for (const item of card.score.items) {
          const a = node.answers[item.id];
          if (a === undefined) err([...p, 'answers'], `missing the answer for "${item.id}"`);
          else
            try {
              itemResult(item, a);
            } catch (e) {
              if (!(e instanceof ScoreError)) throw e;
              err([...p, 'answers', item.id], e.message);
            }
        }
        for (const k of Object.keys(node.answers))
          if (!card.score.items.some((i) => i.id === k))
            err([...p, 'answers', k], `"${k}" is not an item of ${card.id}`);
      }
    }
    nodes[id] = node;
  }

  // graph: links, reachability, every node can reach an ending
  if (!nodes[c.start]) err(['start'], `start node "${c.start}" does not exist`);
  const edges = new Map<string, string[]>();
  for (const [id, node] of Object.entries(nodes)) {
    const out: { to: string; path: Path }[] = [];
    const add = (next: Next | undefined, path: Path) => {
      if (!next) return;
      if (typeof next === 'string') out.push({ to: next, path });
      else next.forEach((n, i) => out.push({ to: n.to, path: [...path, i, 'to'] }));
    };
    if ('next' in node) add(node.next, ['nodes', id, 'next']);
    if ('options' in node) node.options.forEach((o, i) => add(o.next, ['nodes', id, 'options', i, 'next']));
    if (node.type === 'dose')
      for (const k of ['correct', 'under', 'over'] as const) add(node[k].next, ['nodes', id, k, 'next']);
    if (node.type === 'calculator')
      for (const k of ['correct', 'close', 'wrong'] as const) add(node[k].next, ['nodes', id, k, 'next']);
    if (node.type === 'ecg-leads')
      for (const k of ['correct', 'partial', 'wrong'] as const) add(node[k].next, ['nodes', id, k, 'next']);
    for (const o of out) if (!nodes[o.to]) err(o.path, `goes to "${o.to}", which is not a node in this case`);
    edges.set(id, out.map((o) => o.to).filter((t) => nodes[t]));
  }
  if (nodes[c.start]) {
    const reached = new Set<string>();
    const stack = [c.start];
    while (stack.length) {
      const n = stack.pop()!;
      if (reached.has(n)) continue;
      reached.add(n);
      stack.push(...(edges.get(n) ?? []));
    }
    for (const id of Object.keys(nodes))
      if (!reached.has(id)) err(['nodes', id], `node "${id}" can never be reached from start`);
  }
  const canEnd = new Set(Object.keys(nodes).filter((id) => nodes[id]!.type === 'ending'));
  if (canEnd.size === 0) err(['nodes'], 'the case has no ending node');
  for (let changed = true; changed; ) {
    changed = false;
    for (const [id, out] of edges)
      if (!canEnd.has(id) && out.some((t) => canEnd.has(t))) {
        canEnd.add(id);
        changed = true;
      }
  }
  for (const id of Object.keys(nodes))
    if (!canEnd.has(id)) err(['nodes', id], `dead end: no path from "${id}" reaches an ending`);

  // flags/settings used in conditions must exist
  for (const { flag, path } of flagsRead)
    if (!flagsSet.has(flag)) err(path, `flag "${flag}" is checked but never set (initial.flags or addFlags)`);
  for (const { setting, path } of settingsRead)
    if (!c.settings?.includes(setting)) err(path, `setting "${setting}" is not one of this case's settings`);

  // time targets
  const timeTargets: CompiledCase['timeTargets'] = {};
  for (const [setting, ids] of Object.entries(c.timeTargets ?? {})) {
    if (setting !== 'default' && !c.settings?.includes(setting))
      err(['timeTargets', setting], `"${setting}" is not one of this case's settings (or use "default")`);
    timeTargets[setting] = [];
    ids.forEach((tid, i) => {
      const t = ctx.targets.get(tid);
      if (!t) return err(['timeTargets', setting, i], `unknown time target "${tid}" — see benchmarks.yaml`);
      for (const m of [t.from, t.to])
        if (!milestones.has(m))
          err(['timeTargets', setting, i], `time target "${tid}" needs milestone "${m}", but no option stamps it`);
      timeTargets[setting]!.push(t);
    });
  }

  // debrief links
  const unlocks = c.debrief.unlocks.flatMap((u, i) => {
    const card = ctx.codexById.get(u);
    if (!card) {
      err(['debrief', 'unlocks', i], `no codex card with id "${u}"`);
      return [];
    }
    return [{ id: card.id, kind: card.kind, title: card.title }];
  });
  const refList = c.debrief.refs.flatMap((r, i) => {
    const ref = ctx.refs.get(r);
    if (!ref) {
      err(['debrief', 'refs', i], `unknown reference "${r}"`);
      return [];
    }
    return [ref];
  });

  if (!ctx.vitalLimits) return undefined;
  const { check: _limitsCheck, ...vitalLimits } = ctx.vitalLimits;
  void _limitsCheck;
  return {
    ...c,
    nodes,
    system: ctx.system,
    module: ctx.module,
    settings: caseSettings,
    timeTargets,
    vitalLimits: vitalLimits as CompiledCase['vitalLimits'],
    doses,
    scores,
    leadLayouts,
    debrief: { ...c.debrief, unlocks, refs: refList },
    draft: true,
    unverifiedCount: 0,
    imageChecks,
    artSizes,
    rhythms,
  };
}

// ---------- style warnings (never block the build) ----------

/** Words that give away a diagnosis if they appear in a case title. Editorial, not clinical. */
const SPOILERS = [
  'stemi', 'nstemi', 'nste-acs', 'acs', 'mi', 'infarct', 'infarction', 'angina', 'dissection',
  'pe', 'embolism', 'embolus', 'pericarditis', 'tamponade', 'scad', 'wellens', 'de winter',
  'takotsubo', 'pneumothorax', 'aneurysm', 'heart block',
];
export const MAX_LINE = 220; // characters: roughly what fits in a feedback card without scrolling

function styleWarnings(c: Case, warn: (path: Path, message: string) => void) {
  const title = c.title.toLowerCase();
  const hit = SPOILERS.find((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(title));
  if (hit) warn(['title'], `the title may give away the diagnosis ("${hit}"); describe the presentation instead`);
  for (const [id, node] of Object.entries(c.nodes)) {
    const p: Path = ['nodes', id];
    if ((node.type === 'choice' || node.type === 'ecg') && !node.options.some((o) => o.grade === 'best'))
      warn(p, 'no option is graded best; the ideal path will use the first acceptable one');
    const lines: { text: string; path: Path }[] = [];
    if ('options' in node)
      node.options.forEach((o, i) => {
        lines.push({ text: o.consequence, path: [...p, 'options', i, 'consequence'] });
        lines.push({ text: o.teaching, path: [...p, 'options', i, 'teaching'] });
      });
    for (const k of ['correct', 'under', 'over', 'close', 'wrong', 'partial'] as const) {
      const o = (node as Record<string, unknown>)[k] as { consequence?: string; teaching?: string } | undefined;
      if (o?.consequence) lines.push({ text: o.consequence, path: [...p, k, 'consequence'] });
      if (o?.teaching) lines.push({ text: o.teaching, path: [...p, k, 'teaching'] });
    }
    for (const l of lines)
      if (l.text.length > MAX_LINE)
        warn(l.path, `${l.text.length} characters: keep consequences and teaching points to one short line (≤ ${MAX_LINE})`);
  }
}

function collectAssets(c: CompiledCase): string[] {
  const out = new Set<string>();
  for (const node of Object.values(c.nodes)) {
    node.panels?.forEach((p) => {
      if (p.image) out.add(p.image);
      if (p.art) out.add(`panels/${p.art}.webp`);
    });
    if (node.type === 'ecg' || node.type === 'ecg-leads') out.add(node.image);
  }
  return [...out];
}

/** Width and height from a WebP file's header (lossy VP8, lossless VP8L or extended VP8X). */
export function webpSize(b: Buffer): [number, number] | undefined {
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP')
    return undefined;
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  }
  if (chunk === 'VP8X') return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
  return undefined;
}

function walkCondition(cond: Condition, visit: (leaf: Condition) => void) {
  if ('all' in cond) cond.all.forEach((c) => walkCondition(c, visit));
  else if ('any' in cond) cond.any.forEach((c) => walkCondition(c, visit));
  else if ('not' in cond) walkCondition(cond.not, visit);
  else visit(cond);
}

function walkChecks(value: unknown, path: Path, visit: (c: Check, path: Path, owner: Record<string, unknown>) => void) {
  if (Array.isArray(value)) value.forEach((v, i) => walkChecks(v, [...path, i], visit));
  else if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.check && typeof obj.check === 'object' && 'verified' in obj.check) visit(obj.check as Check, path, obj);
    for (const [k, v] of Object.entries(obj)) if (k !== 'check') walkChecks(v, [...path, k], visit);
  }
}

function describe(owner: Record<string, unknown>): string {
  for (const k of ['prompt', 'text', 'label', 'title', 'diagnosis', 'summary']) {
    const v = owner[k];
    if (typeof v === 'string') return v.length > 90 ? v.slice(0, 87) + '…' : v;
  }
  if ('hr' in owner && 'sbp' in owner) return 'Monitor "abnormal" ranges (turn red on the HUD)';
  return '(see file)';
}

function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext) && !(ext === '.yaml' && f.endsWith('.ecg.yaml')))
    .sort()
    .map((f) => join(dir, f));
}

function lineOfPath(doc: Document, lc: LineCounter, path: Path): number | undefined {
  for (let n = path.length; n >= 0; n--) {
    const node = doc.getIn(path.slice(0, n), true) as { range?: [number, number, number] } | undefined;
    if (node && typeof node === 'object' && node.range) return lc.linePos(node.range[0]).line;
  }
  return undefined;
}
