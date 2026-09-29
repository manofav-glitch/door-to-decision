import { actorLabel, sceneLabel } from '../../art/registry';
import type { Panel } from '../../content/schema';

const STAFF = new Set(['doctor', 'nurse', 'senior', 'paramedic']);

/** One comic panel. Phase 1 art is a placeholder: the scene name as a faint label. */
export function PanelView({ panel, clock, assets }: { panel: Panel; clock: string; assets: Record<string, string> }) {
  const caption = panel.caption?.replaceAll('{clock}', clock);
  const alt =
    panel.alt ??
    `${sceneLabel(panel.scene)}${panel.actors?.length ? ` with ${panel.actors.map((a) => actorLabel[a]).join(', ')}` : ''}.`;
  return (
    <figure className="panel relative flex aspect-square flex-col gap-3 p-3">
      <div role="img" aria-label={`Scene: ${alt}`} className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="text-center text-sm font-bold tracking-[0.25em] text-grey-2 uppercase select-none">
          {sceneLabel(panel.scene)}
        </span>
      </div>
      <div className="relative flex items-start justify-between gap-2">
        {caption ? <span className="caption-box">{caption}</span> : <span />}
        {panel.sfx && (
          <span className="sfx" aria-label={`Sound: ${panel.sfx}`}>
            {panel.sfx}
          </span>
        )}
      </div>
      {panel.image && assets[panel.image] && (
        <img src={assets[panel.image]} alt={panel.alt ?? ''} className="relative w-full border-2 border-ink" />
      )}
      <div className="relative mt-auto flex flex-col gap-4 pb-2">
        {panel.bubbles?.map((b, i) => {
          if (b.who === 'narrator') return <p key={i} className="caption-box normal-case">{b.text}</p>;
          const side = STAFF.has(b.who) ? 'right' : 'left';
          return (
            <p key={i} className="bubble" data-side={side} style={{ alignSelf: side === 'right' ? 'flex-end' : 'flex-start' }}>
              <span className="mb-0.5 block font-[family-name:var(--font-ui)] text-[0.6875rem] font-bold tracking-wider text-grey-1 uppercase">
                {b.who === 'doctor' ? 'You' : b.who}
              </span>
              {b.text}
            </p>
          );
        })}
      </div>
    </figure>
  );
}
