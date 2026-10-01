import { useState } from 'react';
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

/** The art name a panel's picture is stored under in the case's asset map. */
export const artAsset = (art: string) => `panels/${art}.webp`;

/**
 * One comic panel. With an illustration (`art:`): caption, picture, then bubbles below so no face is covered.
 * Otherwise: caption and bubbles above, line-art scene along the bottom edge. If the picture can't load
 * (e.g. offline before it was saved), the line art is used instead.
 */
export function PanelView(props: {
  panel: Panel;
  clock: string;
  assets: Record<string, string>;
  ctx?: SceneContext;
  index?: number;
}) {
  const { panel, assets } = props;
  const src = panel.art ? assets[artAsset(panel.art)] : undefined;
  const [failed, setFailed] = useState<string>();
  if (src && failed !== src)
    return <IllustratedPanel {...props} src={src} onError={() => setFailed(src)} />;
  return <DrawnPanel {...props} />;
}

function Header({ panel, clock }: { panel: Panel; clock: string }) {
  const caption = panel.caption?.replaceAll('{clock}', clock);
  if (!caption && !panel.sfx) return null;
  return (
    <div className="relative z-10 flex items-start justify-between gap-2">
      {caption ? <span className="caption-box">{caption}</span> : <span />}
      {panel.sfx && (
        <span className="sfx" aria-label={`Sound: ${panel.sfx}`}>
          {panel.sfx}
        </span>
      )}
    </div>
  );
}

function Bubbles({
  panel,
  side,
  tail,
}: {
  panel: Panel;
  side: (who: string) => 'left' | 'right';
  tail?: 'up';
}) {
  if (!panel.bubbles?.length) return null;
  return (
    <div className="relative z-10 flex flex-col gap-4">
      {panel.bubbles.map((b, i) => {
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
            data-tail={tail}
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
  );
}

function PanelImage({ panel, assets }: { panel: Panel; assets: Record<string, string> }) {
  if (!panel.image || !assets[panel.image]) return null;
  return (
    <img
      src={assets[panel.image]}
      alt={panel.alt ?? ''}
      className="relative w-full border-2 border-ink"
    />
  );
}

const staffSide = (who: string) => (STAFF.has(who) ? 'right' : 'left');

/** Illustrated panels list their actors left to right as drawn, so a speaker's place in the list sets the tail. */
function listedSide(panel: Panel) {
  const order = (panel.actors ?? [])
    .map((a) => parseActor(a)?.name)
    .map((n) => (n === 'patient-supine' ? 'patient' : n));
  return (who: string): 'left' | 'right' => {
    const i = order.indexOf(who as (typeof order)[number]);
    if (i < 0 || order.length < 2) return staffSide(who);
    return i / (order.length - 1) <= 0.5 ? 'left' : 'right';
  };
}

function IllustratedPanel({
  panel,
  clock,
  assets,
  index = 0,
  src,
  onError,
}: {
  panel: Panel;
  clock: string;
  assets: Record<string, string>;
  index?: number;
  src: string;
  onError: () => void;
}) {
  return (
    <figure
      className="panel panel-in flex min-w-0 flex-col gap-3 p-3"
      style={{ animationDelay: `${index * 140}ms` }}
    >
      <Header panel={panel} clock={clock} />
      <img
        src={src}
        alt={panel.alt ?? describePanel(panel)}
        width={800}
        height={800}
        decoding="async"
        onError={onError}
        className="block aspect-square w-full border-2 border-ink bg-paper-2 object-cover"
      />
      <PanelImage panel={panel} assets={assets} />
      <Bubbles panel={panel} side={listedSide(panel)} tail="up" />
    </figure>
  );
}

function DrawnPanel({
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
  const positions = actorPositions(panel.scene, panel.actors);
  const side = (who: string) => {
    const x = positions[who];
    if (x !== undefined) return x < 0.5 ? 'left' : 'right';
    return staffSide(who);
  };
  return (
    <figure
      className="panel panel-in grid grid-cols-[minmax(0,1fr)]"
      style={{ animationDelay: `${index * 140}ms` }}
    >
      {/* At least square; grows downwards (never sideways) when the text needs more room. */}
      <div aria-hidden="true" className="col-start-1 row-start-1 aspect-square" />
      <div className="col-start-1 row-start-1 flex min-w-0 flex-col gap-3 p-3 pb-0">
        <Header panel={panel} clock={clock} />
        <PanelImage panel={panel} assets={assets} />
        <Bubbles panel={panel} side={side} />
        <div className="-mx-3 mt-auto" role="img" aria-label={panel.alt ?? describePanel(panel)}>
          <PanelArt scene={panel.scene} actors={panel.actors} ctx={ctx} />
        </div>
      </div>
    </figure>
  );
}
