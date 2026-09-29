// Browser-side access to compiled content. Cases and codex load lazily (separate chunks).
import { useEffect, useState } from 'react';
import { caseLoaders, index, loadCodex } from 'virtual:content';
import type { CaseSummary, CodexEntry, CompiledCase } from './types';

export { index };

export interface LoadedCase {
  data: CompiledCase;
  assets: Record<string, string>;
}

export function findCase(caseId: string) {
  for (const system of index.systems)
    for (const mod of system.modules)
      for (const c of mod.cases) if (c.id === caseId) return { system, module: mod, summary: c };
  return undefined;
}

type Loadable<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'missing' } | { status: 'error'; error: string };

function useLoad<T>(key: string, load: () => Promise<T | undefined>): Loadable<T> {
  const [state, setState] = useState<{ key: string; value: Loadable<T> }>({ key, value: { status: 'loading' } });
  useEffect(() => {
    let live = true;
    load().then(
      (v) => live && setState({ key, value: v === undefined ? { status: 'missing' } : { status: 'ready', value: v } }),
      (e: unknown) => live && setState({ key, value: { status: 'error', error: String(e) } }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the key changes
  }, [key]);
  return state.key === key ? state.value : { status: 'loading' };
}

export function useCase(caseId: string): Loadable<LoadedCase> {
  return useLoad(`case:${caseId}`, async () => {
    const loader = caseLoaders[caseId];
    if (!loader) return undefined;
    const m = await loader();
    return { data: m.default, assets: m.assets };
  });
}

let codexCache: Promise<CodexEntry[]> | undefined;
export function useCodex(): Loadable<CodexEntry[]> {
  return useLoad('codex', () => (codexCache ??= loadCodex().then((m) => m.default)));
}

export const isPlayable = (c: Pick<CaseSummary, 'draft'>, showDrafts: boolean) => !c.draft || showDrafts;
