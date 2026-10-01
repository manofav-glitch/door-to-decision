import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Panel } from '../../content/schema';
import { artUrlsOf } from '../../lib/offline';
import { artAsset, PanelView } from './PanelView';

const panel: Panel = {
  scene: 'triage-desk',
  art: 'cp-01/01-arrival-1',
  actors: ['patient:pain', 'nurse'],
  caption: '{clock} · Triage',
  bubbles: [{ who: 'patient', text: 'Heavy chest.' }],
};

describe('PanelView', () => {
  it('shows the illustration with a description, and bubbles below it pointing up', () => {
    const html = renderToStaticMarkup(
      <PanelView
        panel={panel}
        clock="02:10"
        assets={{ [artAsset(panel.art!)]: '/assets/a.webp' }}
      />,
    );
    expect(html).toContain('src="/assets/a.webp"');
    expect(html).toContain('alt="triage desk: the patient in pain, a nurse."');
    expect(html).not.toContain('<svg');
    expect(html.indexOf('<img')).toBeLessThan(html.indexOf('class="bubble"'));
    expect(html).toContain('data-tail="up"');
    expect(html).toContain('02:10 · Triage');
  });

  it('points each tail at the speaker, using the actors listed left to right', () => {
    const p: Panel = {
      ...panel,
      actors: ['nurse:worried', 'patient-supine:pain', 'senior'],
      bubbles: [
        { who: 'senior', text: 'Pads on.' },
        { who: 'nurse', text: 'Rate 28!' },
        { who: 'patient', text: 'Faint…' },
      ],
    };
    const html = renderToStaticMarkup(
      <PanelView panel={p} clock="02:10" assets={{ [artAsset(panel.art!)]: '/a.webp' }} />,
    );
    const sides = [...html.matchAll(/data-side="(\w+)"/g)].map((m) => m[1]);
    expect(sides).toEqual(['right', 'left', 'left']);
  });

  it('falls back to the line drawing when the picture is not in the build', () => {
    const html = renderToStaticMarkup(<PanelView panel={panel} clock="02:10" assets={{}} />);
    expect(html).toContain('<svg');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('data-tail');
  });
});

describe('artUrlsOf', () => {
  it('lists only illustrations, as absolute URLs', () => {
    const urls = artUrlsOf(
      {
        'ecg/cp-01-ecg-1.svg': '/assets/ecg.svg',
        'panels/cp-01/a.webp': '/d2d/assets/a.webp',
        'panels/cp-01/tiny.webp': 'data:image/webp;base64,AAAA',
      },
      'https://example.org/d2d/#/play/x',
    );
    expect(urls).toEqual(['https://example.org/d2d/assets/a.webp']);
  });
});
