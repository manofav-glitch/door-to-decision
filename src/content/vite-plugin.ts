// Vite plugin exposing compiled content as virtual modules:
//   virtual:content          — index (systems, modules, case summaries, codex titles, version) + loaders
//   virtual:content/case/<id> — one case (lazy chunk) with its image URLs
//   virtual:content/codex    — all codex cards (lazy chunk)
// Invalid content throws, which fails `vite build` and shows the error overlay in `vite dev`.
import { join } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { compileContent, type Compiled } from './compile.ts';

const INDEX = 'virtual:content';
const CODEX = 'virtual:content/codex';
const CASE = 'virtual:content/case/';

export function contentPlugin(root: string): Plugin {
  const contentDir = join(root, 'content');
  let cached: Compiled | undefined;
  const get = () => (cached ??= compileContent(root));

  const reload = (server: ViteDevServer) => {
    cached = undefined;
    for (const mod of server.moduleGraph.idToModuleMap.values())
      if (mod.id?.startsWith('\0' + INDEX)) server.moduleGraph.invalidateModule(mod);
    server.ws.send({ type: 'full-reload' });
  };

  return {
    name: 'd2d-content',
    resolveId(id) {
      if (id === INDEX || id === CODEX || id.startsWith(CASE)) return '\0' + id;
    },
    load(id) {
      if (!id.startsWith('\0' + INDEX)) return;
      const c = get();
      if (id === '\0' + INDEX) {
        const loaders = Object.keys(c.cases)
          .map((cid) => `  ${JSON.stringify(cid)}: () => import(${JSON.stringify(CASE + cid)}),`)
          .join('\n');
        return [
          `export const index = ${JSON.stringify(c.index)};`,
          `export const caseLoaders = {\n${loaders}\n};`,
          `export const loadCodex = () => import(${JSON.stringify(CODEX)});`,
        ].join('\n');
      }
      if (id === '\0' + CODEX) return `export default ${JSON.stringify(c.codex)};`;
      const caseId = id.slice(('\0' + CASE).length);
      const data = c.cases[caseId];
      if (!data) throw new Error(`Unknown case "${caseId}"`);
      const assets = c.caseAssets[caseId] ?? [];
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
