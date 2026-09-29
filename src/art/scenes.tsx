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

export const SCENE_ART: Partial<Record<Scene, SceneDef>> = {
  'resus-bay': {
    back: ResusBack,
    bed: { x: 212, s: 0.95 },
    besideBed: [
      { x: 352, s: 0.9 },
      { x: 46, s: 0.8 },
    ],
  },
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
export function placeActors(def: SceneDef | undefined, names: string[]): Slot[] {
  const supine = names.map((n) => n === 'patient-supine');
  if (supine.some(Boolean)) {
    const bed = def?.bed ?? { x: 212, s: 0.9 };
    const beside = def?.besideBed ?? [
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
