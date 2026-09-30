// Accessibility regression checks that don't need a browser:
//  - WCAG AA contrast for the colour tokens, in light and dark themes
//  - every panel and ECG in every case has a text description
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { describePanel } from '../src/components/player/PanelView.tsx';
import { compileContent } from '../src/content/compile.ts';

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');

function tokens(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]),
  );
}
const light = tokens(css.match(/:root \{([^}]*)\}/)![1]!);
const dark = tokens(css.match(/:root\[data-theme='dark'\] \{([^}]*)\}/)![1]!);

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

describe('colour contrast (WCAG AA)', () => {
  for (const [name, t] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    it(`${name}: text colours on both backgrounds are ≥ 4.5:1`, () => {
      for (const fg of ['ink', 'grey-1', 'alarm'])
        for (const bg of ['paper', 'paper-2'])
          expect(contrast(t[fg]!, t[bg]!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: borders and line art (grey-2) are ≥ 3:1 against paper`, () => {
      expect(contrast(t['grey-2']!, t.paper!)).toBeGreaterThanOrEqual(3);
    });
    it(`${name}: primary buttons (paper on ink) are ≥ 4.5:1`, () => {
      expect(contrast(t.paper!, t.ink!)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('text alternatives in content', () => {
  const { cases } = compileContent(process.cwd());
  it('every panel has a description and non-empty bubbles', () => {
    for (const c of Object.values(cases))
      for (const [id, node] of Object.entries(c.nodes))
        for (const p of node.panels ?? []) {
          expect(describePanel(p).length, `${c.id}/${id}`).toBeGreaterThan(5);
          for (const b of p.bubbles ?? [])
            expect(b.text.trim().length, `${c.id}/${id}`).toBeGreaterThan(0);
        }
  });
  it('every ECG has a meaningful alt text', () => {
    for (const c of Object.values(cases))
      for (const [id, node] of Object.entries(c.nodes))
        if (node.type === 'ecg' || node.type === 'ecg-leads')
          expect(node.alt.length, `${c.id}/${id}`).toBeGreaterThan(40);
  });
});
