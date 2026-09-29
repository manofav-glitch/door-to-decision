// Geometry of the stylised 12-lead drawings, shared by the drawing script (scripts/draw-ecg.ts),
// the content compiler, and the tap-the-lead hotspots, so the three always agree.

export const PX = 4; // px per mm
export const MM_PER_S = 25;
export const MM_PER_MV = 10;
export const ROW_MM = 30;
export const LEFT_MM = 10;
export const TOP_MM = 6;

export const STANDARD_LEADS = [
  'I',
  'II',
  'III',
  'aVR',
  'aVL',
  'aVF',
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V6',
];
/** Conventional 3 × 4 layout: each inner array is one column, top to bottom. */
export const GRID = [
  ['I', 'II', 'III'],
  ['aVR', 'aVL', 'aVF'],
  ['V1', 'V2', 'V3'],
  ['V4', 'V5', 'V6'],
];

export interface LeadBox {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EcgLayout {
  width: number;
  height: number;
  /** the 12 lead cells (not the rhythm strip), in reading order */
  leads: LeadBox[];
}

export function ecgSize(layout: '12-lead' | 'strip') {
  const rows = layout === '12-lead' ? 4 : 1;
  return { width: (LEFT_MM + 250 + 4) * PX, height: (TOP_MM + rows * ROW_MM + 8) * PX, rows };
}

/** Where each lead sits in a 12-lead drawing. `labels` renames leads (e.g. V1R…V6R). */
export function ecgLayout(labels: string[] = STANDARD_LEADS): EcgLayout {
  const { width, height } = ecgSize('12-lead');
  const leads: LeadBox[] = [];
  for (let r = 0; r < 3; r++)
    GRID.forEach((col, c) => {
      const std = col[r]!;
      leads.push({
        label: labels[STANDARD_LEADS.indexOf(std)]!,
        x: (LEFT_MM + c * 62.5) * PX,
        y: (TOP_MM + r * ROW_MM) * PX,
        w: 62.5 * PX,
        h: ROW_MM * PX,
      });
    });
  return { width, height, leads };
}
