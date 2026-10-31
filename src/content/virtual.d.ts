declare module 'virtual:content' {
  import type { CompiledCase, ContentIndex } from './types';
  export const index: ContentIndex;
  /** true in builds where paid units load from Firestore (docs/plans/paid-access-plan.md) */
  export const paidSplit: boolean;
  export const caseLoaders: Record<
    string,
    () => Promise<{ default: CompiledCase; assets: Record<string, string> }>
  >;
  export const notesLoaders: Record<
    string,
    () => Promise<{ default: import('./types').CompiledNotes; assets: Record<string, string> }>
  >;
  export const loadCodex: () => Promise<{ default: import('./types').CodexEntry[] }>;
}
