// Dev-only page (#/dev/art): every actor in every mood, every scene, and the monitor showing each
// rhythm the ECG drawer knows, for reviewing the art.
import { PanelArt } from '../art/PanelArt';
import { ACTORS, MOODS, SCENES } from '../art/registry';
import type { EcgSpec } from '../content/schema';
import type { VitalLimits } from '../content/types';

const LIMITS: VitalLimits = {
  hr: { low: 60, high: 100 },
  sbp: { low: 90, high: 180 },
  dbp: { low: 50, high: 110 },
  rr: { low: 12, high: 20 },
  spo2: { low: 94, high: 100 },
  gcs: { low: 15, high: 15 },
  temp: { low: 36, high: 38 },
};

// Sample rhythms (not clinical content: drawing checks only)
const broad = { q: 0, r: 1.2, s: 0.5, t: -0.4 };
const RHYTHMS: [string, number, Partial<EcgSpec>][] = [
  ['sinus', 78, { rhythm: { kind: 'sinus', rate: 78 } }],
  ['SVT', 186, { rhythm: { kind: 'svt', rate: 186 } }],
  ['AF', 130, { rhythm: { kind: 'af', rate: 130 } }],
  ['flutter 2:1', 150, { rhythm: { kind: 'flutter', conduction: 2 } }],
  ['pre-excited AF', 230, { rhythm: { kind: 'pre-excited-af', rate: 230 }, qrs: 140 }],
  ['VT', 170, { rhythm: { kind: 'vt', rate: 170 }, qrs: 170, leads: { II: broad } }],
  ['torsades', 230, { rhythm: { kind: 'torsades', rate: 230 }, qrs: 150, leads: { II: broad } }],
  ['VF', 0, { rhythm: { kind: 'vf' } }],
  ['Mobitz I', 60, { rhythm: { kind: 'av-block', type: 'mobitz1', atrialRate: 80 } }],
  ['Mobitz II', 60, { rhythm: { kind: 'av-block', type: 'mobitz2', atrialRate: 80 } }],
  [
    'complete block, wide escape',
    32,
    {
      rhythm: { kind: 'av-dissociation', atrialRate: 85, ventricularRate: 32 },
      qrs: 160,
      leads: { II: broad },
    },
  ],
  [
    'regularised AF',
    45,
    { rhythm: { kind: 'av-dissociation', atrialRate: 0, ventricularRate: 45, atrial: 'af' } },
  ],
  [
    'paced, capture',
    70,
    { rhythm: { kind: 'paced', rate: 70, capture: 'full' }, leads: { II: broad } },
  ],
  [
    'paced, no capture',
    30,
    { rhythm: { kind: 'paced', rate: 70, capture: 'none', escapeRate: 30 }, leads: { II: broad } },
  ],
  ['asystole', 0, { rhythm: { kind: 'asystole', atrialRate: 40 } }],
];
const spec = (extra: Partial<EcgSpec>): EcgSpec => ({
  title: 'sample',
  layout: 'strip',
  rhythm: { kind: 'sinus', rate: 70 },
  rhythmLead: 'II',
  voltage: 1,
  leads: {},
  check: { source: 'sample', verified: false },
  ...extra,
});

export function ArtSheet() {
  return (
    <main>
      <h1 className="mb-4 text-2xl font-bold">Art sheet</h1>
      <h2 className="mb-2 text-lg font-bold">Cast × moods</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ACTORS.flatMap((a) =>
          MOODS.map((m) => (
            <figure key={`${a}:${m}`} className="panel overflow-hidden">
              <PanelArt scene="corridor" actors={[`${a}:${m}`]} />
              <figcaption className="border-t-2 border-ink px-2 py-1 text-xs">
                {a} · {m}
              </figcaption>
            </figure>
          )),
        )}
      </div>
      <h2 className="mb-2 text-lg font-bold">Monitor rhythms</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {RHYTHMS.map(([name, hr, extra]) => (
          <figure key={name} className="panel overflow-hidden">
            <PanelArt
              scene="monitor"
              ctx={{
                vitals: { hr, sbp: 100, dbp: 60, rr: 18, spo2: 96, gcs: 15, temp: 36.8 },
                limits: LIMITS,
                rhythm: spec(extra),
              }}
            />
            <figcaption className="border-t-2 border-ink px-2 py-1 text-xs">{name}</figcaption>
          </figure>
        ))}
      </div>
      <h2 className="mb-2 text-lg font-bold">Scenes</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {SCENES.map((s) => (
          <figure key={s} className="panel overflow-hidden">
            <PanelArt
              scene={s}
              actors={
                s === 'resus-bay'
                  ? ['patient-supine:pain', 'nurse:worried', 'doctor']
                  : ['patient', 'nurse']
              }
              ctx={{
                vitals: { hr: 36, sbp: 78, dbp: 48, rr: 20, spo2: 95, gcs: 15, temp: 36.8 },
                limits: LIMITS,
              }}
            />
            <figcaption className="border-t-2 border-ink px-2 py-1 text-xs">{s}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
