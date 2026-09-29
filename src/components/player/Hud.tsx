import type { VitalLimits } from '../../content/types';
import type { Vitals } from '../../engine/engine';

interface Props {
  vitals: Vitals;
  limits: VitalLimits;
  clock: string;
  minutes: number;
}

/** Persistent monitor strip: HR, BP, SpO2, RR and the case clock. Abnormal values turn red. */
export function Hud({ vitals, limits, clock, minutes }: Props) {
  const off = (k: keyof VitalLimits) => vitals[k] < limits[k].low || vitals[k] > limits[k].high;
  const cell = (label: string, value: string, alarm: boolean, unit?: string) => (
    <div className="flex min-w-0 flex-col items-start leading-tight">
      <span className="text-[0.6875rem] font-semibold tracking-wider text-grey-1 uppercase">
        {label}
      </span>
      <span className={`text-lg font-bold tabular-nums ${alarm ? 'text-alarm' : ''}`}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-semibold">{unit}</span>}
        {alarm && <span className="sr-only"> (abnormal)</span>}
      </span>
    </div>
  );
  return (
    <div
      className="relative overflow-hidden border-b-[3px] border-ink bg-paper"
      role="group"
      aria-label="Patient monitor"
    >
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-3 px-4 py-1.5 sm:justify-start sm:gap-10">
        {cell('HR', String(vitals.hr), off('hr'))}
        {cell('BP', `${vitals.sbp}/${vitals.dbp}`, off('sbp') || off('dbp'))}
        {cell('SpO₂', String(vitals.spo2), off('spo2'), '%')}
        {cell('RR', String(vitals.rr), off('rr'))}
        <div className="flex flex-col items-end leading-tight sm:ml-auto">
          <span className="text-[0.6875rem] font-semibold tracking-wider text-grey-1 uppercase">
            Clock
          </span>
          <span className="text-lg font-bold tabular-nums">{clock}</span>
          <span className="sr-only">{minutes} minutes since arrival</span>
        </div>
      </div>
      <svg
        aria-hidden="true"
        className="absolute right-0 bottom-0 left-0 h-2 w-full"
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
      >
        <g className="sweep">
          <polyline
            points="0,6 40,6 44,6 46,1 48,8 50,6 100,6"
            fill="none"
            stroke="var(--grey-2)"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
    </div>
  );
}
