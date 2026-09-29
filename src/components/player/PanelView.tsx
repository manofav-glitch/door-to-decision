import { actorPositions, PanelArt } from '../../art/PanelArt';
import { actorLabel, moodLabel, parseActor } from '../../art/registry';
import type { SceneContext } from '../../art/scenes';
import type { Panel } from '../../content/schema';

const STAFF = new Set(['doctor', 'nurse', 'senior', 'paramedic']);

/** Text description of the drawing, used when the author didn't write `alt:`. */
export function describePanel(panel: Panel): string {
  const who = (panel.actors ?? [])
    .map(parseActor)
    .filter((a) => a !== undefined)
    .map((a) => [actorLabel[a.name], moodLabel[a.mood]].filter(Boolean).join(' '));
  const place = panel.scene.replace(/-/g, ' ');
  return who.length ? `${place}: ${who.join(', ')}.` : `${place}.`;
}

/** One comic panel: caption and bubbles above, line-art scene along the bottom edge. */
export function PanelView({
  panel,
  clock,
  assets,
  ctx,
  index = 0,
}: {
  panel: Panel;
  clock: string;
  assets: Record<string, string>;
  ctx?: SceneContext;
  index?: number;
}) {
  const caption = panel.caption?.replaceAll('{clock}', clock);
  const positions = actorPositions(panel.scene, panel.actors);
  const side = (who: string) => {
    const x = positions[who];
    if (x !== undefined) return x < 0.5 ? 'left' : 'right';
    return STAFF.has(who) ? 'right' : 'left';
  };
  return (
    <figure
      className="panel panel-in grid grid-cols-[minmax(0,1fr)]"
      style={{ animationDelay: `${index * 140}ms` }}
    >
      {/* At least square; grows downwards (never sideways) when the text needs more room. */}
      <div aria-hidden="true" className="col-start-1 row-start-1 aspect-square" />
      <div className="col-start-1 row-start-1 flex min-w-0 flex-col gap-3 p-3 pb-0">
        <div className="relative z-10 flex items-start justify-between gap-2">
          {caption ? <span className="caption-box">{caption}</span> : <span />}
          {panel.sfx && (
            <span className="sfx" aria-label={`Sound: ${panel.sfx}`}>
              {panel.sfx}
            </span>
          )}
        </div>
        {panel.image && assets[panel.image] && (
          <img
            src={assets[panel.image]}
            alt={panel.alt ?? ''}
            className="relative w-full border-2 border-ink"
          />
        )}
        <div className="relative z-10 flex flex-col gap-4">
          {panel.bubbles?.map((b, i) => {
            if (b.who === 'narrator')
              return (
                <p key={i} className="caption-box normal-case">
                  {b.text}
                </p>
              );
            const s = side(b.who);
            return (
              <p
                key={i}
                className="bubble"
                data-side={s}
                style={{ alignSelf: s === 'right' ? 'flex-end' : 'flex-start' }}
              >
                <span className="mb-0.5 block font-[family-name:var(--font-ui)] text-[0.6875rem] font-bold tracking-wider text-grey-1 uppercase">
                  {b.who === 'doctor' ? 'You' : b.who}
                </span>
                {b.text}
              </p>
            );
          })}
        </div>
        <div className="-mx-3 mt-auto" role="img" aria-label={panel.alt ?? describePanel(panel)}>
          <PanelArt scene={panel.scene} actors={panel.actors} ctx={ctx} />
        </div>
      </div>
    </figure>
  );
}
