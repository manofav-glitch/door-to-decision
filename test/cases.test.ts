// Plays every real case in /content, in every setting:
//  - the ideal path must reach a good ending with 3 stars and all time targets met;
//  - hundreds of random playthroughs must all reach an ending without errors;
//  - together they must visit every node (no branch is untestable).
import { describe, expect, it } from 'vitest';
import { compileContent } from '../src/content/compile.ts';
import {
  act,
  currentNode,
  doseFor,
  idealRun,
  result,
  startRun,
  visibleOptions,
  type Input,
  type RunState,
} from '../src/engine/engine.ts';
import type { CompiledCase } from '../src/content/types.ts';

const { cases } = compileContent(process.cwd());

// Small deterministic PRNG so failures are reproducible.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function randomInput(c: CompiledCase, s: RunState, rand: () => number): Input {
  const node = currentNode(c, s);
  const pickFrom = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  switch (node.type) {
    case 'story':
      return { kind: 'continue' };
    case 'choice':
    case 'ecg':
      return { kind: 'pick', optionId: pickFrom(visibleOptions(s, node)).id! };
    case 'multiselect': {
      const opts = [...visibleOptions(s, node)].sort(() => rand() - 0.5);
      const n = node.min + Math.floor(rand() * (Math.min(node.max, opts.length) - node.min + 1));
      return { kind: 'multi', optionIds: opts.slice(0, n).map((o) => o.id!) };
    }
    case 'dose': {
      const e = doseFor(c, node);
      return { kind: 'dose', value: pickFrom([e.min, e.max, e.min * 0.5, e.max * 1.5]) };
    }
    case 'ending':
      throw new Error('ended');
  }
}

for (const c of Object.values(cases)) {
  const settings = c.settings.length ? c.settings.map((s) => s.id) : [null];
  describe(`${c.id}`, () => {
    for (const setting of settings) {
      it(`ideal path is a 3-star good ending (${setting ?? 'no setting'})`, () => {
        const s = idealRun(c, setting);
        const r = result(c, s);
        expect(r.outcome).toBe('good');
        expect(r.time.filter((t) => !t.met)).toEqual([]);
        expect(r.safetyEvents).toBe(0);
        expect(r.stars).toBe(3);
      });
    }

    it('random playthroughs all end, and together visit every node', () => {
      const visited = new Set<string>();
      const endings = new Set<string>();
      const rand = rng(42);
      for (let run = 0; run < 400; run++) {
        const setting = settings[run % settings.length]!;
        let s = startRun(c, setting);
        visited.add(s.nodeId);
        for (let step = 0; !s.ended; step++) {
          expect(step, 'run did not end').toBeLessThan(200);
          s = act(c, s, randomInput(c, s, rand)).state;
          visited.add(s.nodeId);
        }
        endings.add(s.nodeId);
        const r = result(c, s);
        expect(r.stars).toBeGreaterThanOrEqual(1);
      }
      expect([...Object.keys(c.nodes)].filter((n) => !visited.has(n))).toEqual([]);
      expect(endings.size).toBeGreaterThan(1);
    });
  });
}
