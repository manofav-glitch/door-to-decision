// The free/paid split (docs/plans/paid-access-plan.md): only units marked `free` may ship in the public
// bundle, and every paid case must still have a Firestore document id.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileContent } from './compile.ts';
import { freeContent, paidDocId } from './vite-plugin.ts';

const compiled = compileContent(join(import.meta.dirname, '..', '..'));
const free = freeContent(compiled);
const freeModules = compiled.index.systems.flatMap((s) =>
  s.modules.filter((m) => m.free).map((m) => `${s.id}/${m.id}`),
);

describe('free/paid split', () => {
  it('has exactly one free unit: Chest Pain', () => {
    expect(freeModules).toEqual(['cvs/chest-pain']);
  });

  it('puts only free-unit cases in the public bundle', () => {
    for (const id of free.cases) expect(compiled.cases[id]!.module).toBe('chest-pain');
    const chestPain = Object.values(compiled.cases).filter((c) => c.module === 'chest-pain');
    expect(free.cases.size).toBe(chestPain.length);
  });

  it('keeps paid units out', () => {
    for (const c of Object.values(compiled.cases))
      if (c.module !== 'chest-pain') expect(free.cases.has(c.id)).toBe(false);
    for (const key of Object.keys(compiled.notes))
      if (key !== 'cvs/chest-pain') expect(free.notes.has(key)).toBe(false);
  });

  it('makes every codex card a free case unlocks available without paying', () => {
    for (const id of free.cases)
      for (const u of compiled.cases[id]!.debrief.unlocks) expect(free.cards.has(u.id)).toBe(true);
  });

  it('gives paid content Firestore-safe document ids', () => {
    expect(paidDocId.case('cvs-hf-01')).toBe('case--cvs-hf-01');
    expect(paidDocId.notes('cvs/heart-failure')).toBe('notes--cvs--heart-failure');
    for (const key of Object.keys(compiled.notes)) expect(paidDocId.notes(key)).not.toContain('/');
  });
});
