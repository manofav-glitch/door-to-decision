// Dev-mode tools under the decision sheet: jump to any step and inspect the hidden state.
import { useState } from 'react';
import type { CompiledCase } from '../../content/types';
import { clockAt, timeResults, type RunState } from '../../engine/engine';

export function DevPanel({
  c,
  run,
  onJump,
}: {
  c: CompiledCase;
  run: RunState;
  onJump: (nodeId: string) => void;
}) {
  const ids = Object.keys(c.nodes);
  const [target, setTarget] = useState(run.nodeId);
  const time = timeResults(c, run);
  const row = (k: string, v: React.ReactNode) => (
    <tr key={k} className="border-b border-grey-2 align-top">
      <th className="py-1 pr-3 text-left font-semibold whitespace-nowrap">{k}</th>
      <td className="py-1 break-words">{v}</td>
    </tr>
  );
  return (
    <details className="mt-4 border-2 border-dashed border-grey-1 p-2 text-sm" open>
      <summary className="flex min-h-11 cursor-pointer items-center font-bold tracking-wider text-grey-1 uppercase">
        Dev tools
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="dev-jump">
          Jump to step
        </label>
        <select
          id="dev-jump"
          className="panel min-h-11 min-w-0 flex-1 px-2"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          {ids.map((id) => (
            <option key={id} value={id}>
              {id} ({c.nodes[id]!.type})
            </option>
          ))}
        </select>
        <button type="button" className="btn" onClick={() => onJump(target)}>
          Jump
        </button>
      </div>
      <table className="mt-2 w-full">
        <tbody>
          {row('Step', `${run.nodeId} (${c.nodes[run.nodeId]!.type})`)}
          {row('Setting', run.setting ?? '—')}
          {row('Clock', `${clockAt(c, run.minutes)} (+${run.minutes} min)`)}
          {row(
            'Vitals',
            `HR ${run.vitals.hr} · BP ${run.vitals.sbp}/${run.vitals.dbp} · RR ${run.vitals.rr} · SpO₂ ${run.vitals.spo2} · GCS ${run.vitals.gcs} · T ${run.vitals.temp}`,
          )}
          {row('Flags', run.flags.length ? run.flags.join(', ') : '—')}
          {row(
            'Milestones',
            Object.entries(run.milestones)
              .map(([k, v]) => `${k} @${v}`)
              .join(', '),
          )}
          {row('Patient meter', run.patient)}
          {row('Safety events', run.safetyEvents)}
          {row(
            'Time targets',
            time.length
              ? time
                  .map(
                    (t) => `${t.label}: ${t.actualMin ?? '—'}/${t.targetMin}${t.met ? ' ✓' : ''}`,
                  )
                  .join('; ')
              : '—',
          )}
          {row('Path', run.path.join(' → '))}
        </tbody>
      </table>
    </details>
  );
}
