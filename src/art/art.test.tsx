import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ecgLayout, ecgSize } from './ecgLayout';
import { actorPositions, PanelArt } from './PanelArt';
import { ACTORS, MOODS, parseActor, SCENES } from './registry';
import { SCENE_ART } from './scenes';

const vitals = { hr: 36, sbp: 78, dbp: 48, rr: 20, spo2: 95, gcs: 15, temp: 36.8 };
const lim = { low: 0, high: 999 };
const limits = {
  hr: { low: 60, high: 100 },
  sbp: { low: 90, high: 180 },
  dbp: lim,
  rr: lim,
  spo2: lim,
  gcs: lim,
  temp: lim,
};

describe('art', () => {
  it('every scene has a drawing', () => {
    for (const s of SCENES) expect(SCENE_ART[s]?.back, s).toBeTypeOf('function');
  });

  it('renders every actor in every mood', () => {
    for (const a of ACTORS)
      for (const m of MOODS) {
        const svg = renderToStaticMarkup(<PanelArt scene="corridor" actors={[`${a}:${m}`]} />);
        expect(svg).toMatch(/^<svg/);
        expect(svg.length).toBeGreaterThan(500);
      }
  });

  it('renders every scene with a crowd and a trolley', () => {
    for (const s of SCENES)
      expect(() =>
        renderToStaticMarkup(
          <PanelArt
            scene={s}
            actors={['patient-supine:pain', 'nurse', 'doctor', 'senior']}
            ctx={{ vitals, limits }}
          />,
        ),
      ).not.toThrow();
  });

  it('the monitor shows live numbers and marks abnormal ones', () => {
    const svg = renderToStaticMarkup(<PanelArt scene="monitor" ctx={{ vitals, limits }} />);
    expect(svg).toContain('>36<');
    expect(svg).toContain('78/48');
    expect(svg).toContain('art-alarm');
    const calm = renderToStaticMarkup(
      <PanelArt scene="monitor" ctx={{ vitals: { ...vitals, hr: 80, sbp: 120 }, limits }} />,
    );
    expect(calm).not.toContain('art-alarm');
  });

  it('parses actor references with moods', () => {
    expect(parseActor('patient:pain')).toEqual({ name: 'patient', mood: 'pain' });
    expect(parseActor('nurse')).toEqual({ name: 'nurse', mood: 'neutral' });
    expect(parseActor('nurse:happy')).toBeUndefined();
    expect(parseActor('surgeon')).toBeUndefined();
  });

  it('points bubbles at speakers: left actor < right actor', () => {
    const p = actorPositions('triage-desk', ['patient', 'nurse']);
    expect(p.patient!).toBeLessThan(0.5);
    expect(p.nurse!).toBeGreaterThan(0.5);
  });
});

describe('ECG layout', () => {
  it('matches the drawing size and puts 12 leads in a 3 × 4 grid', () => {
    const l = ecgLayout();
    expect({ width: l.width, height: l.height }).toEqual({
      width: ecgSize('12-lead').width,
      height: ecgSize('12-lead').height,
    });
    expect(l.leads.map((x) => x.label)).toEqual([
      'I',
      'aVR',
      'V1',
      'V4',
      'II',
      'aVL',
      'V2',
      'V5',
      'III',
      'aVF',
      'V3',
      'V6',
    ]);
    for (const b of l.leads) {
      expect(b.x + b.w).toBeLessThanOrEqual(l.width);
      expect(b.y + b.h).toBeLessThanOrEqual(l.height);
    }
  });

  it('renames leads for right-sided ECGs', () => {
    const labels = [
      'I',
      'II',
      'III',
      'aVR',
      'aVL',
      'aVF',
      'V1R',
      'V2R',
      'V3R',
      'V4R',
      'V5R',
      'V6R',
    ];
    expect(ecgLayout(labels).leads.find((l) => l.label === 'V4R')).toBeDefined();
  });
});
