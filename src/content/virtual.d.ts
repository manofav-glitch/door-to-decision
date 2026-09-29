declare module 'virtual:content' {
  import type { CompiledCase, ContentIndex } from './types';
  export const index: ContentIndex;
  export const caseLoaders: Record<
    string,
    () => Promise<{ default: CompiledCase; assets: Record<string, string> }>
  >;
  export const loadCodex: () => Promise<{ default: import('./types').CodexEntry[] }>;
}
