import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileContent, ContentError, webpSize } from './compile.ts';

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

  describe('harder options (shuffleOptions units)', () => {
    const MOD = 'content/demo/basics/module.yaml';
    function compileWith(moduleEdit: (s: string) => string) {
      const dir = mkdtempSync(join(tmpdir(), 'd2d-'));
      cpSync(FIXTURE, dir, { recursive: true });
      const p = join(dir, MOD);
      writeFileSync(p, moduleEdit(readFileSync(p, 'utf8')));
      return compileContent(dir);
    }
    it('passes the unit setting to its cases (off by default)', () => {
      expect(compileContent(FIXTURE).cases['demo-c-01']!.shuffleOptions).toBe(false);
      expect(compileWith((s) => s + 'shuffleOptions: true\n').cases['demo-c-01']!.shuffleOptions).toBe(true);
    });
    it('only warns about a give-away best answer in units that shuffle', () => {
      const longBest = (dir: string) => {
        const p = join(dir, CASE);
        writeFileSync(p, readFileSync(p, 'utf8').replace('{ label: Test,', '{ label: Test with a long careful explanation of every step,'));
        return compileContent(dir);
      };
      const giveaway = (c: ReturnType<typeof compileContent>) =>
        c.warnings.filter((w) => w.message.includes('gives itself away')).length;
      const plain = mkdtempSync(join(tmpdir(), 'd2d-'));
      cpSync(FIXTURE, plain, { recursive: true });
      expect(giveaway(longBest(plain))).toBe(0);
      const shuffledDir = mkdtempSync(join(tmpdir(), 'd2d-'));
      cpSync(FIXTURE, shuffledDir, { recursive: true });
      writeFileSync(join(shuffledDir, MOD), readFileSync(join(shuffledDir, MOD), 'utf8') + 'shuffleOptions: true\n');
      expect(giveaway(longBest(shuffledDir))).toBe(1);
    });
  });

  describe('unit notes', () => {
    const NOTES = 'content/demo/basics/notes.yaml';
    const good = `
intro: Everything in one place.
sections:
  - heading: First things
    check: { source: ref-a, verified: true, reviewedOn: 2026-10-13 }
    blocks:
      - text: A paragraph.
      - points: [One, Two]
      - warn: Never do this.
      - table: { head: [Drug, Dose], rows: [[X, 1 unit]] }
      - ecg: ecg/demo.svg
        alt: A demo strip.
        caption: Look at the rate.
      - cards: [drug-x]
refs: [ref-a]
`;
    /** Fixture copy with notes.yaml (and a demo ECG image); returns the dir. */
    function withNotes(yaml: string) {
      const dir = mkdtempSync(join(tmpdir(), 'd2d-'));
      cpSync(FIXTURE, dir, { recursive: true });
      writeFileSync(join(dir, NOTES), yaml);
      mkdirSync(join(dir, 'content/assets/ecg'), { recursive: true });
      writeFileSync(join(dir, 'content/assets/ecg/demo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
      return dir;
    }
    const messages = (yaml: string) => {
      try {
        compileContent(withNotes(yaml));
        return [];
      } catch (e) {
        if (e instanceof ContentError) return e.problems.map((p) => p.message);
        throw e;
      }
    };

    it('compiles notes, resolves Codex links and lists the ECG as an asset', () => {
      const c = compileContent(withNotes(good));
      const n = c.notes['demo/basics']!;
      expect(n.title).toBe('Basics notes');
      expect(n.draft).toBe(false);
      expect(n.sections[0]!.blocks[5]!.cards).toEqual([{ id: 'drug-x', kind: 'drugs', title: 'Drug X' }]);
      expect(n.refs.map((r) => r.id)).toEqual(['ref-a']);
      expect(c.notesAssets['demo/basics']).toEqual(['ecg/demo.svg']);
      expect(c.index.systems[0]!.modules[0]!.notes).toEqual({
        title: 'Basics notes',
        headings: ['First things'],
        draft: false,
      });
      expect(c.checks.some((x) => x.file.endsWith('notes.yaml') && x.where === 'sections.0')).toBe(true);
    });

    it('a unit without notes.yaml has no notes', () => {
      expect(compileContent(FIXTURE).index.systems[0]!.modules[0]!.notes).toBeUndefined();
    });

    it('an unverified section makes the notes a draft and joins the review list', () => {
      const c = compileContent(withNotes(good.replace('verified: true, reviewedOn: 2026-10-13', 'verified: false')));
      expect(c.notes['demo/basics']!.draft).toBe(true);
      expect(c.checks.filter((x) => !x.verified && x.file.endsWith('notes.yaml'))).toHaveLength(1);
    });

    it('reports broken links, missing pictures and malformed blocks', () => {
      expect(messages(good.replace('cards: [drug-x]', 'cards: [nope]'))).toContain('no codex card with id "nope"');
      expect(messages(good.replace('refs: [ref-a]', 'refs: [ref-z]'))).toContain('unknown reference "ref-z"');
      expect(messages(good.replace('ecg: ecg/demo.svg', 'ecg: ecg/gone.svg'))).toContain(
        'image content/assets/ecg/gone.svg does not exist',
      );
      expect(messages(good.replace('[[X, 1 unit]]', '[[X]]'))).toContain('row has 1 cells but the table has 2 columns');
      expect(messages(good.replace('- text: A paragraph.', '- { text: A, warn: B }'))).toContain(
        'each block needs exactly one of: text, points, warn, table, ecg, cards',
      );
      expect(messages(good.replace('        alt: A demo strip.\n', ''))).toContain(
        'an ecg block needs alt: (what the ECG shows)',
      );
    });
  });

  describe('illustrations', () => {
    /** Fixture copy whose first panel uses art: pics/p1; `files` are written relative to content/assets. */
    function withArt(files: Record<string, string | Buffer>) {
      const dir = mkdtempSync(join(tmpdir(), 'd2d-'));
      cpSync(FIXTURE, dir, { recursive: true });
      const p = join(dir, CASE);
      writeFileSync(p, readFileSync(p, 'utf8').replace('{ scene: triage-desk,', '{ scene: triage-desk, art: pics/p1,'));
      for (const [f, text] of Object.entries(files)) {
        const out = join(dir, 'content/assets', f);
        mkdirSync(join(out, '..'), { recursive: true });
        writeFileSync(out, text);
      }
      return dir;
    }
    /** Just enough of a lossless WebP header for the size check, padded to `bytes`. */
    const fakeWebp = (w: number, h: number, bytes = 30) => {
      const b = Buffer.alloc(Math.max(bytes, 30));
      b.write('RIFF', 0, 'ascii');
      b.write('WEBPVP8L', 8, 'ascii');
      b[20] = 0x2f;
      b.writeUInt32LE(((h - 1) << 14) | (w - 1), 21);
      return b;
    };
    const credits = '- { folder: pics, madeWith: Test tool, madeBy: Tester, date: 2026-10-01 }\n';
    const messages = (dir: string) => {
      try {
        compileContent(dir);
        return [];
      } catch (e) {
        if (e instanceof ContentError) return e.problems.map((p) => p.message);
        throw e;
      }
    };

    it('adds a credited picture to the case assets and counts its size', () => {
      const c = compileContent(withArt({ 'art/credits.yaml': credits, 'panels/pics/p1.webp': fakeWebp(800, 400, 1234) }));
      expect(c.caseAssets['demo-c-01']).toContain('panels/pics/p1.webp');
      expect(c.index.systems[0]!.modules[0]!.cases[0]!.artBytes).toBe(1234);
      expect(c.cases['demo-c-01']!.artSizes).toEqual({ 'pics/p1': [800, 400] });
    });

    it('reads picture sizes from WebP headers, and rejects other files', () => {
      expect(webpSize(fakeWebp(609, 297))).toEqual([609, 297]);
      expect(webpSize(Buffer.from('not a picture at all, just some text'))).toBeUndefined();
      expect(messages(withArt({ 'art/credits.yaml': credits, 'panels/pics/p1.webp': 'x'.repeat(40) }))).toContain(
        'content/assets/panels/pics/p1.webp is not a WebP picture: run npm run art',
      );
    });

    it('reports a missing picture', () => {
      expect(messages(withArt({ 'art/credits.yaml': credits }))).toContain(
        'picture content/assets/panels/pics/p1.webp is missing: put the original in content/assets/art/pics/p1.png and run npm run art',
      );
    });

    it('requires a credits entry for the folder', () => {
      expect(messages(withArt({ 'panels/pics/p1.webp': fakeWebp(8, 8) }))).toContain(
        'add "pics" to content/assets/art/credits.yaml (who made these pictures, and with what)',
      );
    });

    it('warns about pictures no panel uses', () => {
      const c = compileContent(
        withArt({ 'art/credits.yaml': credits, 'panels/pics/p1.webp': fakeWebp(8, 8), 'panels/pics/old.webp': fakeWebp(8, 8) }),
      );
      expect(c.warnings.map((w) => w.message)).toContain(
        'no panel uses this picture (add art: pics/old to a panel, or delete the file)',
      );
    });

    it('rejects an art name with an extension', () => {
      const dir = withArt({});
      const p = join(dir, CASE);
      writeFileSync(p, readFileSync(p, 'utf8').replace('art: pics/p1,', 'art: pics/p1.png,'));
      expect(messages(dir)).toContain('use folder/name, e.g. cp-01/01-arrival-1 (no extension)');
    });
  });

  describe('monitor rhythm', () => {
    const ecg = (title: string, verified: boolean) =>
      `title: ${title}\nlayout: strip\nrhythm: { kind: svt, rate: 180 }\ncheck: { source: ref-a, verified: ${verified}${verified ? ', reviewedOn: 2026-10-05' : ''} }\n`;
    function withRhythm(files: Record<string, string>, edit: (s: string) => string) {
      const dir = mkdtempSync(join(tmpdir(), 'd2d-'));
      cpSync(FIXTURE, dir, { recursive: true });
      // the fixture's empty assets/ecg folder isn't in git, so create it (CI checks out a fresh copy)
      mkdirSync(join(dir, 'content/assets/ecg'), { recursive: true });
      for (const [f, text] of Object.entries(files)) writeFileSync(join(dir, 'content/assets', f), text);
      const p = join(dir, CASE);
      writeFileSync(p, edit(readFileSync(p, 'utf8')));
      return dir;
    }
    const startOnSvt = (s: string) => s.replace('  clock: "23:50"', '  clock: "23:50"\n  rhythm: ecg/svt.svg');

    it('keeps the ECG spec of every rhythm the case can show, and counts its check', () => {
      const c = compileContent(withRhythm({ 'ecg/svt.ecg.yaml': ecg('SVT', true) }, startOnSvt));
      const kase = c.cases['demo-c-01']!;
      expect(kase.rhythms['ecg/svt.svg']!.rhythm).toEqual({ kind: 'svt', rate: 180 });
      expect(kase.imageChecks['ecg/svt.svg']).toBeDefined();
    });

    it('an unverified rhythm drawing makes the case a draft', () => {
      const c = compileContent(withRhythm({ 'ecg/svt.ecg.yaml': ecg('SVT', false) }, startOnSvt));
      expect(c.cases['demo-c-01']!.unverifiedCount).toBe(2);
    });

    it('reports a rhythm with no ECG drawing', () => {
      try {
        compileContent(withRhythm({}, startOnSvt));
        throw new Error('expected a content error');
      } catch (e) {
        if (!(e instanceof ContentError)) throw e;
        expect(e.problems.map((p) => p.message)).toContain(
          'rhythm ecg/svt.svg is not a drawn ECG (needs content/assets/ecg/svt.ecg.yaml)',
        );
      }
    });
  });

  it('lets a dose question ask for a shock energy from a procedure card', () => {
    const dir = mkdtempSync(join(tmpdir(), 'd2d-'));
    cpSync(FIXTURE, dir, { recursive: true });
    mkdirSync(join(dir, 'content/codex/procedures'), { recursive: true });
    writeFileSync(
      join(dir, 'content/codex/procedures/sync-shock.yaml'),
      [
        'id: sync-shock',
        'title: Synchronised shock',
        'summary: A test procedure.',
        'doses:',
        '  - { id: flutter, label: Flutter, route: synchronised, text: "70–120 J", rule: { unit: J, fixed: { min: 70, max: 120 } }, check: { source: ref-a, verified: true, reviewedOn: 2026-01-01 } }',
        'check: { source: ref-a, verified: true, reviewedOn: 2026-01-01 }',
        '',
      ].join('\n'),
    );
    const p = join(dir, CASE);
    writeFileSync(p, readFileSync(p, 'utf8').replace('drug: drug-x', 'drug: sync-shock').replace('dose: per-kg', 'dose: flutter'));
    const c = compileContent(dir);
    expect(c.cases['demo-c-01']!.doses['sync-shock/flutter']!.rule.unit).toBe('J');
    expect(c.codex.find((x) => x.id === 'sync-shock')!.kind).toBe('procedures');
  });
});
