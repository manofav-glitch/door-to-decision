// Vite plugin exposing compiled content as virtual modules:
//   virtual:content          — index (systems, modules, case summaries, codex titles, version) + loaders
//   virtual:content/case/<id> — one case (lazy chunk) with its image URLs
//   virtual:content/codex    — all codex cards (lazy chunk)
//   virtual:content/notes/<system>/<module> — one unit's notes (lazy chunk) with its image URLs
// Invalid content throws, which fails `vite build` and shows the error overlay in `vite dev`.
//
// Paid access (docs/plans/paid-access-plan.md): in a build with VITE_ACCOUNTS_LIVE=true, cases, notes and
// codex cards of units that aren't `free` are left out of the public bundle. Their pictures still ship (as
// *-assets modules); their text is written to paid-content/ for scripts/upload-paid.ts and fetched at run
// time from Firestore by src/lib/paid.ts. Dev and builds without the switch bundle everything, as before.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';
import { compileContent, type Compiled } from './compile.ts';

const INDEX = 'virtual:content';
const CODEX = 'virtual:content/codex';
const CASE = 'virtual:content/case/';
const NOTES = 'virtual:content/notes/';
const CASE_ASSETS = 'virtual:content/case-assets/';
const NOTES_ASSETS = 'virtual:content/notes-assets/';

/** Firestore document ids for paid content (no slashes allowed) */
export const paidDocId = {
  case: (id: string) => `case--${id}`,
  notes: (key: string) => `notes--${key.replace('/', '--')}`,
  codex: () => 'codex',
};

/** which cases, notes and codex cards are free (in the public bundle) */
export function freeContent(c: Compiled) {
  const freeModules = new Set(
    c.index.systems.flatMap((s) => s.modules.filter((m) => m.free).map((m) => `${s.id}/${m.id}`)),
  );
  const cases = new Set(
    Object.values(c.cases)
      .filter((k) => freeModules.has(`${k.system}/${k.module}`))
      .map((k) => k.id),
  );
  const notes = new Set(Object.keys(c.notes).filter((key) => freeModules.has(key)));
  const cards = new Set<string>();
  for (const id of cases) for (const u of c.cases[id]!.debrief.unlocks) cards.add(u.id);
  for (const key of notes)
    for (const s of c.notes[key]!.sections)
      for (const b of s.blocks) for (const card of b.cards ?? []) cards.add(card.id);
  return { cases, notes, cards };
}

export function contentPlugin(root: string): Plugin {
  const contentDir = join(root, 'content');
  let cached: Compiled | undefined;
  const get = () => (cached ??= compileContent(root));
  let split = false;
  const paidModule = join(root, 'src', 'lib', 'paid.ts');

  const reload = (server: ViteDevServer) => {
    cached = undefined;
    for (const mod of server.moduleGraph.idToModuleMap.values())
      if (mod.id?.startsWith('\0' + INDEX)) server.moduleGraph.invalidateModule(mod);
    server.ws.send({ type: 'full-reload' });
  };

  return {
    name: 'd2d-content',
    config(_, { mode, command }) {
      const env = loadEnv(mode, root, 'VITE_');
      // VITE_SPLIT_IN_DEV=true (in the git-ignored .env.local) tests the paid flow on the dev server
      split =
        env.VITE_ACCOUNTS_LIVE === 'true' &&
        (command === 'build' || env.VITE_SPLIT_IN_DEV === 'true');
    },
    resolveId(id) {
      if (
        id === INDEX ||
        id === CODEX ||
        id.startsWith(CASE) ||
        id.startsWith(NOTES) ||
        id.startsWith(CASE_ASSETS) ||
        id.startsWith(NOTES_ASSETS)
      )
        return '\0' + id;
    },
    buildStart() {
      if (!split) return;
      // write the paid text for scripts/upload-paid.ts (git-ignored; never deployed with the site)
      const c = get();
      const free = freeContent(c);
      const out = join(root, 'paid-content');
      rmSync(out, { recursive: true, force: true });
      mkdirSync(out, { recursive: true });
      const docs: Record<string, unknown> = {};
      for (const [id, data] of Object.entries(c.cases))
        if (!free.cases.has(id)) docs[paidDocId.case(id)] = data;
      for (const [key, data] of Object.entries(c.notes))
        if (!free.notes.has(key)) docs[paidDocId.notes(key)] = data;
      docs[paidDocId.codex()] = c.codex.filter((card) => !free.cards.has(card.id));
      for (const [docId, data] of Object.entries(docs))
        writeFileSync(join(out, `${docId}.json`), JSON.stringify(data));
      writeFileSync(
        join(out, 'manifest.json'),
        JSON.stringify({ version: c.index.version, docs: Object.keys(docs) }, null, 1),
      );
    },
    load(id) {
      if (!id.startsWith('\0' + INDEX)) return;
      const c = get();
      const free = split ? freeContent(c) : undefined;
      const v = JSON.stringify(c.index.version);
      if (id === '\0' + INDEX) {
        const j = JSON.stringify;
        const loaders = Object.keys(c.cases)
          .map((cid) =>
            !free || free.cases.has(cid)
              ? `  ${j(cid)}: () => import(${j(CASE + cid)}),`
              : `  ${j(cid)}: () => Promise.all([import(${j(CASE_ASSETS + cid)}), fetchPaid(${j(paidDocId.case(cid))}, ${v})]).then(([m, d]) => ({ default: d, assets: m.assets })),`,
          )
          .join('\n');
        const notesLoaders = Object.keys(c.notes)
          .map((key) =>
            !free || free.notes.has(key)
              ? `  ${j(key)}: () => import(${j(NOTES + key)}),`
              : `  ${j(key)}: () => Promise.all([import(${j(NOTES_ASSETS + key)}), fetchPaid(${j(paidDocId.notes(key))}, ${v})]).then(([m, d]) => ({ default: d, assets: m.assets })),`,
          )
          .join('\n');
        return [
          ...(free ? [`import { fetchPaid } from ${j(paidModule)};`] : []),
          `export const index = ${j(c.index)};`,
          `export const paidSplit = ${Boolean(free)};`,
          `export const caseLoaders = {\n${loaders}\n};`,
          `export const notesLoaders = {\n${notesLoaders}\n};`,
          free
            ? `export const loadCodex = () => Promise.all([import(${j(CODEX)}), fetchPaid(${j(paidDocId.codex())}, ${v}).catch(() => [])]).then(([m, p]) => ({ default: [...m.default, ...p] }));`
            : `export const loadCodex = () => import(${j(CODEX)});`,
        ].join('\n');
      }
      if (id === '\0' + CODEX)
        return `export default ${JSON.stringify(free ? c.codex.filter((card) => free.cards.has(card.id)) : c.codex)};`;
      let data: unknown;
      let assets: string[];
      if (id.startsWith('\0' + CASE_ASSETS) || id.startsWith('\0' + NOTES_ASSETS)) {
        // a paid case's or unit's pictures only; its text comes from Firestore
        assets = id.startsWith('\0' + CASE_ASSETS)
          ? (c.caseAssets[id.slice(('\0' + CASE_ASSETS).length)] ?? [])
          : (c.notesAssets[id.slice(('\0' + NOTES_ASSETS).length)] ?? []);
        data = null;
      } else if (id.startsWith('\0' + NOTES)) {
        const key = id.slice(('\0' + NOTES).length);
        data = c.notes[key];
        if (!data) throw new Error(`No notes for "${key}"`);
        assets = c.notesAssets[key] ?? [];
      } else {
        const caseId = id.slice(('\0' + CASE).length);
        data = c.cases[caseId];
        if (!data) throw new Error(`Unknown case "${caseId}"`);
        assets = c.caseAssets[caseId] ?? [];
      }
      const imports = assets.map(
        (a, i) => `import a${i} from ${JSON.stringify(join(contentDir, 'assets', a) + '?url')};`,
      );
      const map = assets.map((a, i) => `${JSON.stringify(a)}: a${i}`).join(', ');
      return [
        ...imports,
        `export const assets = { ${map} };`,
        `export default ${JSON.stringify(data)};`,
      ].join('\n');
    },
    configureServer(server) {
      server.watcher.add(contentDir);
      const onChange = (file: string) => {
        if (file.startsWith(contentDir) && /\.(ya?ml|svg|webp)$/.test(file)) reload(server);
      };
      server.watcher.on('change', onChange);
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}
