// Dev-only page (#/dev/art): every actor in every mood, and every scene, for reviewing the art.
import { PanelArt } from '../art/PanelArt';
import { ACTORS, MOODS, SCENES } from '../art/registry';

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
                limits: {
                  hr: { low: 60, high: 100 },
                  sbp: { low: 90, high: 180 },
                  dbp: { low: 50, high: 110 },
                  rr: { low: 12, high: 20 },
                  spo2: { low: 94, high: 100 },
                  gcs: { low: 15, high: 15 },
                  temp: { low: 36, high: 38 },
                },
              }}
            />
            <figcaption className="border-t-2 border-ink px-2 py-1 text-xs">{s}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
