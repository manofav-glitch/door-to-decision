// Scenes: background (and optional foreground) props drawn in grey behind the cast, plus where
// actors stand. Art space is a 400 × 240 box; busts are anchored on the bottom edge.
import type { VitalLimits } from '../content/types';
import type { Vitals } from '../engine/engine';
import type { Scene } from './registry';

export interface SceneContext {
  vitals?: Vitals;
  limits?: VitalLimits;
}

export interface Slot {
  x: number;
  s: number;
}

export interface SceneDef {
  back?: (ctx: SceneContext) => React.ReactNode;
  front?: (ctx: SceneContext) => React.ReactNode;
  /** where a patient lying on a trolley goes */
  bed?: Slot;
  /** bust positions when a bed is present, in order of use */
  besideBed?: Slot[];
  /** true for close-ups with no people (the monitor) */
  noActors?: boolean;
}

// ---------- scenes ----------

function ResusBack() {
  return (
    <g className="prop">
      {/* curtain on its rail */}
      <path d="M0 12 L130 12" />
      <path d="M10 12 Q4 60 10 110 Q16 160 10 240 M34 12 Q28 70 34 120 Q40 180 34 240 M58 12 Q54 64 60 118 Q66 176 60 240 M82 12 Q80 50 84 90" />
      {/* wall monitor */}
      <rect x="288" y="18" width="92" height="58" rx="4" />
      <path d="M296 50 h16 l4 -12 l5 22 l4 -10 h14 l4 -12 l5 22 l4 -10 h16" />
      <path d="M334 76 L334 90" />
      {/* oxygen outlet */}
      <rect x="236" y="54" width="18" height="12" rx="2" />
      <path d="M245 66 Q246 92 232 104" />
    </g>
  );
}

function TriageBack() {
  return (
    <g className="prop">
      <rect x="150" y="10" width="100" height="28" rx="3" />
      <text x="200" y="29" textAnchor="middle" className="art-label">
        TRIAGE
      </text>
      {/* queue-number display and a wall clock */}
      <rect x="22" y="22" width="46" height="26" rx="3" />
      <circle cx="350" cy="40" r="17" />
      <path d="M350 40 L350 29 M350 40 L358 44" />
    </g>
  );
}
function TriageFront() {
  // the counter, drawn in front of the people behind it
  return (
    <g>
      <path d="M-2 200 L402 200 L402 242 L-2 242 Z" className="fill-paper" />
      <g className="prop">
        <path d="M-2 208 L402 208" />
        {/* BP machine and a clipboard on the counter */}
        <rect x="300" y="178" width="44" height="22" rx="3" className="fill-paper" />
        <path d="M312 186 h20 M344 190 Q364 190 360 206" />
        <rect x="46" y="186" width="30" height="14" className="fill-paper" />
      </g>
    </g>
  );
}

function AmbulanceBack() {
  return (
    <g className="prop">
      {/* hospital entrance sign */}
      <rect x="14" y="12" width="118" height="26" rx="3" />
      <text x="73" y="30" textAnchor="middle" className="art-label">
        EMERGENCY
      </text>
      {/* ambulance, rear view */}
      <rect x="248" y="34" width="146" height="176" rx="8" />
      <path d="M321 34 L321 210 M248 132 L394 132 M248 140 L394 140" />
      <rect x="260" y="48" width="50" height="46" rx="3" />
      <rect x="332" y="48" width="50" height="46" rx="3" />
      <path d="M288 26 h66 v8 h-66 Z" />
      <text x="321" y="160" textAnchor="middle" className="art-label">
        AMBULANCE
      </text>
      <circle cx="272" cy="214" r="14" />
      <circle cx="370" cy="214" r="14" />
    </g>
  );
}

/** Close-up of the bedside monitor, showing the patient's current numbers. */
function MonitorBack({ vitals, limits }: SceneContext) {
  const off = (k: keyof Vitals) =>
    !!(vitals && limits && (vitals[k] < limits[k].low || vitals[k] > limits[k].high));
  const hr = vitals?.hr;
  // ECG trace with one complex per beat across a 6-second sweep
  const beats = hr ? Math.max(1, Math.min(12, Math.round((hr / 60) * 6))) : 0;
  const w = 200 / Math.max(beats, 1);
  let trace = 'M52 78';
  for (let i = 0; i < beats; i++) {
    const x = 52 + i * w;
    trace += ` L${x + w * 0.35} 78 l4 -4 l4 4 l6 0 l3 -34 l4 44 l3 -10 l${w * 0.35 - 24} 0`;
  }
  trace += ' L252 78';
  const num = (alarm: boolean) => (alarm ? 'art-num art-alarm' : 'art-num');
  const anyAlarm = off('hr') || off('sbp') || off('dbp') || off('spo2');
  return (
    <g>
      <rect x="28" y="10" width="344" height="224" rx="12" className="fill-paper" />
      <rect x="42" y="24" width="316" height="190" rx="4" />
      <path d={trace} className={off('hr') ? 'stroke-alarm' : ''} />
      <path
        d="M52 170 Q72 146 90 168 Q110 150 128 168 Q148 146 166 168 Q186 150 204 168 Q224 146 252 168"
        className="prop"
      />
      <text x="268" y="48" className="art-text">
        HR
      </text>
      <text x="350" y="84" textAnchor="end" className={num(off('hr'))}>
        {hr ?? '--'}
      </text>
      <text x="268" y="112" className="art-text">
        NIBP
      </text>
      <text x="350" y="140" textAnchor="end" className={num(off('sbp') || off('dbp'))}>
        {vitals ? `${vitals.sbp}/${vitals.dbp}` : '--/--'}
      </text>
      <text x="268" y="166" className="art-text">
        SpO₂
      </text>
      <text x="350" y="200" textAnchor="end" className={num(off('spo2'))}>
        {vitals?.spo2 ?? '--'}
      </text>
      {anyAlarm && (
        <g className="stroke-alarm">
          <path d="M62 36 L76 60 L48 60 Z" className="fill-paper" />
          <path d="M62 44 L62 52 M62 56 L62 56.5" />
        </g>
      )}
    </g>
  );
}

function EcgMachineBack() {
  return (
    <g className="prop">
      {/* cart with screen and paper, leads trailing to the left */}
      <rect x="300" y="60" width="84" height="56" rx="4" />
      <path d="M308 90 h12 l3 -10 l4 18 l3 -8 h14 l3 -10 l4 18 l3 -8 h22" />
      <path d="M312 116 L312 132 L372 132 L372 116 M318 132 Q324 150 316 164" />
      <path d="M296 120 L388 120 M306 120 L306 226 M378 120 L378 226" />
      <circle cx="306" cy="230" r="6" />
      <circle cx="378" cy="230" r="6" />
      <path d="M300 104 Q240 110 220 150 M300 110 Q250 130 250 168 M300 98 Q210 96 186 140" />
    </g>
  );
}

function CathLabBack() {
  return (
    <g className="prop">
      <rect x="138" y="10" width="124" height="26" rx="3" />
      <text x="200" y="28" textAnchor="middle" className="art-label">
        CATH LAB
      </text>
      <rect x="272" y="14" width="46" height="18" rx="3" />
      <text x="295" y="27" textAnchor="middle" className="art-label" style={{ fontSize: 9 }}>
        X-RAY
      </text>
      {/* double doors with round windows */}
      <path d="M124 240 L124 46 L276 46 L276 240 M200 46 L200 240" />
      <circle cx="162" cy="100" r="18" />
      <circle cx="238" cy="100" r="18" />
      <rect x="182" y="140" width="10" height="36" rx="2" />
      <rect x="208" y="140" width="10" height="36" rx="2" />
    </g>
  );
}

function CorridorBack() {
  return (
    <g className="prop">
      <path d="M0 0 L150 84 L250 84 L400 0 M0 240 L150 150 L250 150 L400 240 M150 84 L150 150 M250 84 L250 150" />
      <path d="M186 20 h28 M190 44 h20 M193 62 h14" />
      <path d="M40 60 L40 214 L96 184 L96 92 Z M360 60 L360 214 L304 184 L304 92 Z" />
    </g>
  );
}

function WardBack() {
  return (
    <g className="prop">
      <rect x="36" y="26" width="104" height="82" rx="2" />
      <path d="M88 26 L88 108 M36 67 L140 67" />
      <path d="M20 16 L156 16 M24 16 Q18 64 26 120 M150 16 Q156 64 148 120" />
      {/* drip stand */}
      <path d="M360 30 L360 236 M346 236 L374 236 M350 30 L370 30" />
      <rect x="352" y="36" width="16" height="26" rx="3" />
      <path d="M360 62 Q360 120 330 150" />
    </g>
  );
}

export const SCENE_ART: Record<Scene, SceneDef> = {
  'resus-bay': {
    back: ResusBack,
    bed: { x: 212, s: 0.95 },
    besideBed: [
      { x: 352, s: 0.9 },
      { x: 46, s: 0.8 },
    ],
  },
  'triage-desk': { back: TriageBack, front: TriageFront },
  'ambulance-bay': {
    back: AmbulanceBack,
    bed: { x: 170, s: 0.9 },
    besideBed: [
      { x: 46, s: 0.8 },
      { x: 330, s: 0.8 },
    ],
  },
  monitor: { back: MonitorBack, noActors: true },
  'ecg-machine': {
    back: EcgMachineBack,
    bed: { x: 150, s: 0.9 },
    besideBed: [
      { x: 330, s: 0.8 },
      { x: 40, s: 0.75 },
    ],
  },
  'cath-lab-door': {
    back: CathLabBack,
    bed: { x: 200, s: 0.9 },
    besideBed: [
      { x: 352, s: 0.85 },
      { x: 48, s: 0.8 },
    ],
  },
  corridor: { back: CorridorBack },
  ward: { back: WardBack },
};

// ---------- actor placement ----------

const SPREAD: Record<number, Slot[]> = {
  1: [{ x: 200, s: 1 }],
  2: [
    { x: 120, s: 1 },
    { x: 282, s: 1 },
  ],
  3: [
    { x: 76, s: 0.9 },
    { x: 200, s: 0.9 },
    { x: 324, s: 0.9 },
  ],
};

/** Left-to-right positions for busts (in listed order) and for a supine patient. */
export function placeActors(def: SceneDef, names: string[]): Slot[] {
  const supine = names.map((n) => n === 'patient-supine');
  if (supine.some(Boolean)) {
    const bed = def.bed ?? { x: 212, s: 0.9 };
    const beside = def.besideBed ?? [
      { x: 352, s: 0.85 },
      { x: 46, s: 0.8 },
    ];
    let b = 0;
    return names.map((_, i) => (supine[i] ? bed : (beside[b++] ?? { x: 340, s: 0.8 })));
  }
  const n = Math.min(names.length, 4);
  const slots =
    SPREAD[n] ?? Array.from({ length: n }, (_, i) => ({ x: 50 + (300 * i) / (n - 1), s: 0.8 }));
  return names.map((_, i) => slots[Math.min(i, slots.length - 1)]!);
}
