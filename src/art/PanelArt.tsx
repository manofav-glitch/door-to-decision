// Composes one panel's drawing from data: scene props + actors in their places.
import { CAST } from './cast';
import { parseActor, sceneLabel, type Scene } from './registry';
import { placeActors, SCENE_ART, type SceneContext } from './scenes';

export const ART_W = 400;
export const ART_H = 240;

/** Horizontal position (0–1) of each actor, used to point speech-bubble tails. */
export function actorPositions(scene: Scene, actors: string[] = []): Record<string, number> {
  const refs = actors.map(parseActor).filter((a) => a !== undefined);
  const slots = placeActors(
    SCENE_ART[scene],
    refs.map((r) => r.name),
  );
  const out: Record<string, number> = {};
  refs.forEach((r, i) => {
    const key = r.name === 'patient-supine' ? 'patient' : r.name;
    out[key] ??= (slots[i]!.x - (r.name === 'patient-supine' ? 80 * slots[i]!.s : 0)) / ART_W;
  });
  return out;
}

export function PanelArt({
  scene,
  actors = [],
  ctx = {},
}: {
  scene: Scene;
  actors?: string[];
  ctx?: SceneContext;
}) {
  const def = SCENE_ART[scene];
  const refs = actors.map(parseActor).filter((a) => a !== undefined);
  const slots = placeActors(
    def,
    refs.map((r) => r.name),
  );
  // supine patients first (further back), then busts
  const order = refs
    .map((r, i) => ({ r, slot: slots[i]! }))
    .sort((a, b) => Number(b.r.name === 'patient-supine') - Number(a.r.name === 'patient-supine'));

  return (
    <svg
      viewBox={`0 0 ${ART_W} ${ART_H}`}
      className="art block w-full"
      aria-hidden="true"
      focusable="false"
    >
      {def?.back?.(ctx)}
      {!def && (
        <text x={ART_W / 2} y={60} textAnchor="middle" className="art-label">
          {sceneLabel(scene)}
        </text>
      )}
      {!def?.noActors &&
        order.map(({ r, slot }, i) => {
          const Figure = CAST[r.name];
          return (
            <g key={i} transform={`translate(${slot.x} ${ART_H}) scale(${slot.s})`}>
              <Figure mood={r.mood} />
            </g>
          );
        })}
      {def?.front?.(ctx)}
    </svg>
  );
}
