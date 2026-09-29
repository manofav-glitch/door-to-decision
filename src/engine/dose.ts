// Turns a dose rule from a drug card into the expected dose for a patient.
// The numbers come from content; this only does the arithmetic.
import type { DoseRule } from '../content/schema.ts';

export interface DoseRange {
  min: number;
  max: number;
  unit: string;
  /** how it was worked out, e.g. "70 kg × 70–100 units/kg" */
  working: string;
}

type Patient = { age: number; weightKg: number };

const fmt = (n: number) =>
  Number.isInteger(n)
    ? n.toLocaleString('en-IN')
    : n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const span = (min: number, max: number) => (min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`);
const range = (r: number | { min: number; max: number }) =>
  typeof r === 'number' ? { min: r, max: r } : r;

export function expectedDose(rule: DoseRule, patient: Patient): DoseRange {
  let min: number;
  let max: number;
  let working: string;

  if (rule.fixed !== undefined) {
    ({ min, max } = range(rule.fixed));
    working = `fixed dose ${span(min, max)} ${rule.unit}`;
  } else if (rule.perKg !== undefined) {
    const r = range(rule.perKg);
    min = r.min * patient.weightKg;
    max = r.max * patient.weightKg;
    working = `${fmt(patient.weightKg)} kg × ${span(r.min, r.max)} ${rule.unit}/kg`;
    if (rule.maxDose !== undefined && max > rule.maxDose) {
      max = rule.maxDose;
      min = Math.min(min, rule.maxDose);
      working += `, capped at ${fmt(rule.maxDose)} ${rule.unit}`;
    }
  } else {
    const bands = rule.bands!;
    const band =
      bands.find((b) => b.belowKg === undefined || patient.weightKg < b.belowKg) ??
      bands[bands.length - 1]!;
    min = max = band.dose;
    working =
      band.belowKg === undefined
        ? `weight band ${fmt(patient.weightKg)} kg (top band) → ${fmt(band.dose)} ${rule.unit}`
        : `weight band ${fmt(patient.weightKg)} kg (< ${fmt(band.belowKg)} kg) → ${fmt(band.dose)} ${rule.unit}`;
  }

  if (rule.ageAdjust && patient.age >= rule.ageAdjust.fromAge) {
    min *= rule.ageAdjust.factor;
    max *= rule.ageAdjust.factor;
    working += `, × ${rule.ageAdjust.factor} for age ≥ ${rule.ageAdjust.fromAge}`;
  }
  return { min, max, unit: rule.unit, working };
}
