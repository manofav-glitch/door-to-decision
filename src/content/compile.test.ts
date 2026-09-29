import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileContent, ContentError } from './compile.ts';

const FIXTURE = join(import.meta.dirname, '../../test/fixtures/mini');
const CASE = 'content/demo/basics/cases/c-01.yaml';

/** Copy the fixture, apply an edit to one file, compile, and return the problems. */
function problemsAfter(file: string, edit: (s: string) => string) {
  const dir = mkdtempSync(join(tmpdir(), 'd2d-'));
  cpSync(FIXTURE, dir, { recursive: true });
  const p = join(dir, file);
  writeFileSync(p, edit(readFileSync(p, 'utf8')));
  try {
    compileContent(dir);
  } catch (e) {
    if (e instanceof ContentError) return e.problems;
    throw e;
  }
  return [];
}

describe('compileContent', () => {
  it('compiles the fixture', () => {
    const c = compileContent(FIXTURE);
    const kase = c.cases['demo-c-01']!;
    expect(kase.settings.map((s) => s.id)).toEqual(['big', 'small']);
    expect(kase.doses['drug-x/per-kg']!.rule.unit).toBe('units');
    expect(kase.debrief.unlocks).toEqual([{ id: 'drug-x', kind: 'drugs', title: 'Drug X' }]);
    // option ids default to position
    const first = kase.nodes.first!;
    expect(first.type === 'choice' && first.options.map((o) => o.id)).toEqual(['o1', 'o2', 'o3']);
    expect(c.index.version).toMatch(/^[0-9a-f]{8}$/);
    expect(c.index.systems.map((s) => s.status)).toEqual(['active', 'soon']);
  });

  it('marks a case as draft when any item is unverified, and lists it for review', () => {
    const c = compileContent(FIXTURE);
    expect(c.cases['demo-c-01']!.draft).toBe(true);
    expect(c.cases['demo-c-01']!.unverifiedCount).toBe(1);
    const unverified = c.checks.filter((x) => !x.verified);
    expect(unverified).toHaveLength(1);
    expect(unverified[0]).toMatchObject({ where: 'nodes.multi', what: 'Pick up to 2', todo: 'check me' });
    expect(unverified[0]!.line).toBeGreaterThan(0);
  });

  it('reports a bad grade with file and line', () => {
    const [p] = problemsAfter(CASE, (s) => s.replace('grade: harmful, consequence: bad', 'grade: terrible, consequence: bad'));
    expect(p!.file).toBe(CASE);
    expect(p!.line).toBe(27);
    expect(p!.message).toMatch(/expected one of/);
  });

  it('catches broken next links', () => {
    const ps = problemsAfter(CASE, (s) => s.replace('next: crash', 'next: crsh'));
    expect(ps.map((p) => p.message)).toContain('goes to "crsh", which is not a node in this case');
  });

  it('catches unreachable nodes and dead ends', () => {
    const ps = problemsAfter(CASE, (s) =>
      s.replace('end-bad: { type', 'orphan: { type: story, panels: [{ scene: ward }], next: orphan }\n  end-bad: { type'),
    );
    const msgs = ps.map((p) => p.message);
    expect(msgs).toContain('node "orphan" can never be reached from start');
    expect(msgs).toContain('dead end: no path from "orphan" reaches an ending');
  });

  it('catches flags that are read but never set', () => {
    const ps = problemsAfter(CASE, (s) => s.replace('{ if: { flag: gave_c }', '{ if: { flag: gave_d }'));
    expect(ps.map((p) => p.message)).toContain('flag "gave_d" is checked but never set (initial.flags or addFlags)');
  });

  it('catches unknown references, codex unlocks and doses', () => {
    const ps = problemsAfter(CASE, (s) =>
      s.replace('unlocks: [drug-x]', 'unlocks: [drug-y]').replace('refs: [ref-a]', 'refs: [ref-b]').replace('dose: per-kg', 'dose: per-lb'),
    );
    const msgs = ps.map((p) => p.message);
    expect(msgs).toContain('no codex card with id "drug-y"');
    expect(msgs).toContain('unknown reference "ref-b"');
    expect(msgs).toContain('drug card "drug-x" has no dose with id "per-lb"');
  });

  it('refuses verified: true without a review date', () => {
    const ps = problemsAfter(CASE, (s) => s.replace('verified: false, todo: "check me"', 'verified: true'));
    expect(ps.map((p) => p.message)).toContain('verified: true needs reviewedOn: YYYY-MM-DD');
  });

  it('catches misspelt fields', () => {
    const ps = problemsAfter(CASE, (s) => s.replace('prompt: "First?"', 'promt: "First?"'));
    expect(ps.map((p) => p.message)).toContain('unknown field(s): promt — check spelling');
  });
});
