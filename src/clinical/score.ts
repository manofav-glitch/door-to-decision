// Additive point scores (HEART, TIMI, GRACE …). Pure arithmetic over a point table from
// content/codex/scores/*.yaml — no clinical numbers live here.
import type { ScoreAnswer, ScoreDef, ScoreItem } from '../content/schema.ts';

export interface ItemResult {
  id: string;
  label: string;
  /** what was chosen, e.g. "45–64" or "Highly suspicious" */
  answer: string;
  points: number;
}

export interface ScoreResult {
  total: number;
  items: ItemResult[];
  band?: { label: string; risk?: string };
  risk?: { label: string; value: string };
  /** false while any item is unanswered (total counts answered items only) */
  complete: boolean;
}

export class ScoreError extends Error {}

/** Index of the bin a numeric value falls in (value < below; the last bin catches the rest). */
export function binIndex(item: Extract<ScoreItem, { type: 'number' }>, value: number): number {
  const i = item.bins.findIndex((b) => b.below === undefined || value < b.below);
  return i === -1 ? item.bins.length - 1 : i;
}

/** Points and a readable label for one item's answer; undefined if unanswered. */
export function itemResult(
  item: ScoreItem,
  answer: ScoreAnswer | undefined,
): ItemResult | undefined {
  if (answer === undefined) return undefined;
  const base = { id: item.id, label: item.label };
  switch (item.type) {
    case 'choice': {
      const opt = item.options.find((o) => o.id === answer);
      if (!opt) throw new ScoreError(`"${String(answer)}" is not an option of ${item.id}`);
      return { ...base, answer: opt.label, points: opt.points };
    }
    case 'yesno':
      if (typeof answer !== 'boolean') throw new ScoreError(`${item.id} needs yes/no`);
      return { ...base, answer: answer ? 'Yes' : 'No', points: answer ? item.points : 0 };
    case 'number': {
      let i: number;
      let shown: string;
      if (typeof answer === 'number') {
        if (!Number.isFinite(answer)) throw new ScoreError(`${item.id} needs a number`);
        i = binIndex(item, answer);
        shown = `${answer} ${item.unit} (${item.bins[i]!.label})`;
      } else if (typeof answer === 'object' && answer.bin < item.bins.length) {
        i = answer.bin;
        shown = item.bins[i]!.label;
      } else throw new ScoreError(`${item.id} needs a number or a bin`);
      return { ...base, answer: shown, points: item.bins[i]!.points };
    }
  }
}

/** Convert a value entered in one of an item's alternative units into its base unit. */
export function toBaseUnit(
  item: Extract<ScoreItem, { type: 'number' }>,
  value: number,
  unit: string,
): number {
  if (unit === item.unit) return value;
  const alt = item.altUnits.find((u) => u.unit === unit);
  if (!alt) throw new ScoreError(`${item.id} has no unit "${unit}"`);
  return value / alt.perBaseUnit;
}

/** The last row whose `from` is at or below the total. */
export function fromLookup<T extends { from: number }>(rows: T[], total: number): T {
  let hit = rows[0]!;
  for (const r of rows) if (total >= r.from) hit = r;
  return hit;
}

export function scoreResult(
  def: ScoreDef,
  answers: Record<string, ScoreAnswer | undefined>,
): ScoreResult {
  const items: ItemResult[] = [];
  for (const item of def.items) {
    const r = itemResult(item, answers[item.id]);
    if (r) items.push(r);
  }
  const total = items.reduce((sum, i) => sum + i.points, 0);
  const band = def.bands && fromLookup(def.bands, total);
  const row = def.riskTable && fromLookup(def.riskTable.rows, total);
  return {
    total,
    items,
    band: band && { label: band.label, risk: band.risk },
    risk: row && def.riskTable && { label: def.riskTable.label, value: row.risk },
    complete: items.length === def.items.length,
  };
}

/** Category used to judge "close enough": the band label, else the risk-table value. */
export function category(r: ScoreResult): string {
  return r.band?.label ?? r.risk?.value ?? String(r.total);
}
