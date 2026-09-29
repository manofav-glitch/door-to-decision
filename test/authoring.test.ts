// Authoring tools: branching graphs, the new-case scaffold, and style warnings.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileContent } from '../src/content/compile.ts';
import { caseGraph, conditionText } from '../src/content/graph.ts';
import { scaffoldCase, ScaffoldError } from '../src/content/scaffold.ts';

const ROOT = process.cwd();
const FIXTURE = join(ROOT, 'test/fixtures/mini');

function tempCopy(from: string, parts: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'd2d-'));
  for (const p of parts) cpSync(join(from, p), join(dir, p), { recursive: true });
  return dir;
}

describe('graph', () => {
  const c = compileContent(FIXTURE).cases['demo-c-01']!;
  const md = caseGraph(c);

  it('draws every node and a Mermaid block', () => {
    expect(md).toContain('```mermaid\nflowchart TD');
    for (const id of Object.keys(c.nodes)) expect(md).toContain(`n_${id.replace(/-/g, '_')}`);
  });
  it('marks endings, harmful arrows and the ideal path', () => {
    expect(md).toMatch(/n_end_bad\[\[.*\]\]:::critical/);
    expect(md).toMatch(/linkStyle \d+ stroke:#c62828/);
    expect(md).toMatch(/linkStyle \d+ stroke-width:4px/);
    expect(md).toContain('**big:** intro → first → multi → dose → end-good');
  });
  it('labels conditional branches', () => {
    expect(md).toContain('if sbp #lt; 80');
    expect(conditionText({ all: [{ setting: 'big' }, { notFlag: 'x' }] })).toBe('big and not x');
  });
  it('draws the real cases without errors', () => {
    for (const k of Object.values(compileContent(ROOT).cases))
      expect(caseGraph(k)).toContain('## Ideal path');
  });
});

describe('new-case scaffold', () => {
  it('creates a case that compiles and lists it in the module', () => {
    const dir = tempCopy(ROOT, ['content', 'docs/templates']);
    const file = scaffoldCase(dir, {
      system: 'cvs',
      module: 'chest-pain',
      name: 'cp-99',
      title: '62F, back pain',
    });
    expect(file).toBe('content/cvs/chest-pain/cases/cp-99.yaml');
    expect(readFileSync(join(dir, 'content/cvs/chest-pain/module.yaml'), 'utf8')).toMatch(
      /cases: \[cp-01, cp-02, cp-99\]/,
    );
    const k = compileContent(dir).cases['cvs-cp-99']!;
    expect(k.title).toBe('62F, back pain');
    expect(k.draft).toBe(true);
  });
  it('handles block-style case lists', () => {
    const dir = tempCopy(ROOT, ['content', 'docs/templates']);
    const mod = join(dir, 'content/cvs/chest-pain/module.yaml');
    writeFileSync(
      mod,
      readFileSync(mod, 'utf8').replace(/cases: \[.*\]/, 'cases:\n  - cp-01\n  - cp-02'),
    );
    scaffoldCase(dir, { system: 'cvs', module: 'chest-pain', name: 'cp-98', title: 'x' });
    expect(readFileSync(mod, 'utf8')).toContain('  - cp-02\n  - cp-98');
    expect(compileContent(dir).cases['cvs-cp-98']).toBeDefined();
  });
  it('refuses duplicates, bad names and unknown modules', () => {
    const dir = tempCopy(ROOT, ['content', 'docs/templates']);
    const make =
      (name: string, module = 'chest-pain', title = 'x') =>
      () =>
        scaffoldCase(dir, { system: 'cvs', module, name, title });
    expect(make('cp-01')).toThrow(ScaffoldError);
    expect(make('CP 3')).toThrow(/lower-case/);
    expect(make('cp-5', 'dyspnoea')).toThrow(/no module/);
    expect(make('cp-6', 'chest-pain', 'say "hi"')).toThrow(/double quotes/);
  });
});

describe('style warnings', () => {
  const warningsAfter = (edit: (s: string) => string) => {
    const dir = tempCopy(FIXTURE, ['content']);
    const f = join(dir, 'content/demo/basics/cases/c-01.yaml');
    writeFileSync(f, edit(readFileSync(f, 'utf8')));
    return compileContent(dir).warnings.map((w) => w.message);
  };
  it('none for the fixture', () => expect(compileContent(FIXTURE).warnings).toEqual([]));
  it('flags a title that gives away the diagnosis', () => {
    expect(
      warningsAfter((s) => s.replace('"Test patient"', '"Inferior STEMI in a 60M"')).join(),
    ).toMatch(/give away/);
    expect(warningsAfter((s) => s.replace('"Test patient"', '"Speedy recovery"'))).toEqual([]);
  });
  it('flags a choice without a best option, and long lines', () => {
    const w = warningsAfter((s) =>
      s.replace(
        'grade: best, consequence: ok, teaching: good',
        `grade: acceptable, consequence: ok, teaching: "${'x'.repeat(300)}"`,
      ),
    );
    expect(w.join('\n')).toMatch(/no option is graded best/);
    expect(w.join('\n')).toMatch(/300 characters/);
  });
});
