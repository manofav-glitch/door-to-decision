// Zod schemas for everything under /content. These define what an author may write in YAML;
// the compiler (compile.ts) turns validated YAML into the JSON the app and engine use.
// This file holds NO clinical facts — only the shape of content.
import { z } from 'zod';
import { ACTORS, MOODS, parseActor, SCENES } from '../art/registry.ts';

const Id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-_]*$/, 'use lower-case letters, digits, "-" or "_" (no spaces)');
const Text = z.string().min(1);

/** Verification tag carried by every clinical item. Only the content owner sets verified: true. */
export const Check = z
  .strictObject({
    source: z.union([Id, z.array(Id).min(1)]),
    verified: z.boolean(),
    reviewedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date as YYYY-MM-DD').optional(),
    todo: Text.optional(),
  })
  .refine((c) => !c.verified || c.reviewedOn, {
    message: 'verified: true needs reviewedOn: YYYY-MM-DD',
  });

export const VITALS = ['hr', 'sbp', 'dbp', 'rr', 'spo2', 'gcs', 'temp'] as const;
export const VitalKey = z.enum(VITALS);
const VitalNumbers = z.strictObject({
  hr: z.number().optional(),
  sbp: z.number().optional(),
  dbp: z.number().optional(),
  rr: z.number().optional(),
  spo2: z.number().optional(),
  gcs: z.number().optional(),
  temp: z.number().optional(),
});

// ---------- conditions & branching ----------

export type Condition =
  | { flag: string }
  | { notFlag: string }
  | { setting: string }
  | { vital: (typeof VITALS)[number]; below?: number; above?: number }
  | { meter: 'patient'; below?: number; above?: number }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ flag: Id }),
    z.strictObject({ notFlag: Id }),
    z.strictObject({ setting: Id }),
    z.strictObject({ vital: VitalKey, below: z.number().optional(), above: z.number().optional() }),
    z.strictObject({
      meter: z.literal('patient'),
      below: z.number().optional(),
      above: z.number().optional(),
    }),
    z.strictObject({ all: z.array(Condition).min(1) }),
    z.strictObject({ any: z.array(Condition).min(1) }),
    z.strictObject({ not: Condition }),
  ]),
);

/** `next: node-id`, or a list checked top to bottom: `- { if: {...}, to: a }` … `- { to: fallback }`. */
export const Next = z.union([
  Id,
  z
    .array(z.strictObject({ if: Condition.optional(), to: Id }))
    .min(1)
    .refine((l) => l[l.length - 1]!.if === undefined, {
      message: 'the last entry of a conditional next must have no "if" (the fallback)',
    }),
]);
export type Next = z.infer<typeof Next>;

export const Effects = z.strictObject({
  minutes: z.number().min(0).optional(),
  ...VitalNumbers.shape, // deltas, e.g. sbp: -25
  setVitals: VitalNumbers.optional(), // absolute values, e.g. { hr: 36 }
  addFlags: z.array(Id).optional(),
  removeFlags: z.array(Id).optional(),
  patient: z.number().optional(), // Patient meter delta (meter runs 0–100)
  milestone: z.union([Id, z.array(Id)]).optional(), // stamps the clock, e.g. ecg, stemi-dx
});
export type Effects = z.infer<typeof Effects>;

// ---------- panels ----------

export const Bubble = z.strictObject({
  who: z.enum(['patient', 'doctor', 'nurse', 'relative', 'paramedic', 'senior', 'narrator']),
  text: Text,
});
export const Panel = z.strictObject({
  scene: z.enum(SCENES),
  // "name" or "name:mood", e.g. patient:pain
  actors: z
    .array(
      z.string().refine((a) => parseActor(a) !== undefined, {
        message: `use one of ${ACTORS.join(', ')}, optionally with :${MOODS.join(' / :')}`,
      }),
    )
    .optional(),
  caption: Text.optional(), // "{clock}" is replaced by the case clock, e.g. "{clock} · Triage"
  bubbles: z.array(Bubble).optional(),
  sfx: Text.optional(),
  image: z.string().optional(), // file in content/assets, e.g. ecg/cp-01-ecg-1.svg
  alt: Text.optional(), // description of the picture for screen readers
});
export type Panel = z.infer<typeof Panel>;

// ---------- risk scores (point tables live in content/codex/scores) ----------

const ScoreOption = z.strictObject({ id: Id, label: Text, points: z.number() });
const ScoreBin = z.strictObject({
  below: z.number().optional(), // value < below falls in this bin; last bin omits it
  points: z.number(),
  label: Text, // e.g. "45–64"
});
const ascendingBins = (bins: { below?: number }[]) =>
  bins.every((b, i) =>
    i === bins.length - 1
      ? b.below === undefined
      : b.below !== undefined && (i === 0 || b.below > bins[i - 1]!.below!),
  );
export const ScoreItem = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('choice'),
    id: Id,
    label: Text,
    hint: Text.optional(),
    options: z.array(ScoreOption).min(2),
  }),
  z.strictObject({
    type: z.literal('yesno'),
    id: Id,
    label: Text,
    hint: Text.optional(),
    points: z.number(),
  }),
  z.strictObject({
    type: z.literal('number'),
    id: Id,
    label: Text,
    hint: Text.optional(),
    unit: Text,
    // other units the calculator accepts: value in base unit = entered value / perBaseUnit
    altUnits: z.array(z.strictObject({ unit: Text, perBaseUnit: z.number() })).default([]),
    bins: z.array(ScoreBin).min(2).refine(ascendingBins, {
      message: 'bins go from lowest to highest `below`; only the last bin omits below',
    }),
  }),
]);
export type ScoreItem = z.infer<typeof ScoreItem>;

const ascendingFrom = (rows: { from: number }[]) =>
  rows.every((r, i) => i === 0 || r.from > rows[i - 1]!.from);
const fromMsg = { message: 'rows go from lowest to highest `from`' };
const BandRows = z
  .array(z.strictObject({ from: z.number(), label: Text, risk: Text.optional() }))
  .min(1)
  .refine(ascendingFrom, fromMsg);
const RiskRows = z
  .array(z.strictObject({ from: z.number(), risk: Text }))
  .min(1)
  .refine(ascendingFrom, fromMsg);

export const ScoreDef = z
  .strictObject({
    items: z.array(ScoreItem).min(1),
    // categories on the total, e.g. low / moderate / high
    bands: BandRows.optional(),
    bandsSource: Id.optional(), // if the bands come from a different source than the score
    // finer lookup on the total, e.g. GRACE nomogram
    riskTable: z
      .strictObject({ label: Text, rows: RiskRows, note: Text.optional() })
      .optional(),
    check: Check,
  })
  .refine((d) => d.bands || d.riskTable, { message: 'a score needs bands and/or a riskTable' })
  .refine((d) => new Set(d.items.map((i) => i.id)).size === d.items.length, {
    message: 'item ids must be unique',
  });
export type ScoreDef = z.infer<typeof ScoreDef>;

/** An answer to one score item: option id (choice), yes/no, a number, or a chosen bin. */
export const ScoreAnswer = z.union([
  z.string(),
  z.boolean(),
  z.number(),
  z.strictObject({ bin: z.number().int().min(0) }),
]);
export type ScoreAnswer = z.infer<typeof ScoreAnswer>;

// ---------- nodes ----------

export const GRADES = ['best', 'acceptable', 'suboptimal', 'harmful'] as const;
export const Grade = z.enum(GRADES);
export type Grade = z.infer<typeof Grade>;

export const Option = z.strictObject({
  id: Id.optional(), // defaults to its position: o1, o2, …
  label: Text,
  grade: Grade,
  consequence: Text, // one line: what happens to the patient
  teaching: Text, // one line: why
  effects: Effects.optional(),
  showIf: Condition.optional(),
  next: Next.optional(), // choice/ecg nodes: required on every option
  // multiselect only: applied if a `best` option is NOT picked
  missedEffects: Effects.optional(),
});
export type Option = z.infer<typeof Option>;

const nodeBase = {
  panels: z.array(Panel).optional(),
  onEnter: Effects.optional(), // applied when the node is reached
  check: Check.optional(),
};

const StoryNode = z.strictObject({
  type: z.literal('story'),
  ...nodeBase,
  panels: z.array(Panel).min(1),
  next: Next,
});
const ChoiceNode = z.strictObject({
  type: z.literal('choice'),
  ...nodeBase,
  check: Check,
  prompt: Text,
  options: z.array(Option).min(2),
});
const EcgNode = z.strictObject({
  type: z.literal('ecg'),
  ...nodeBase,
  check: Check,
  image: z.string(),
  alt: Text,
  prompt: Text,
  options: z.array(Option).min(2),
});
const MultiNode = z.strictObject({
  type: z.literal('multiselect'),
  ...nodeBase,
  check: Check,
  prompt: Text,
  min: z.number().int().min(0).default(1),
  max: z.number().int().min(1),
  options: z.array(Option).min(2),
  next: Next,
});
const DoseOutcome = z.strictObject({
  grade: Grade.optional(),
  consequence: Text,
  teaching: Text,
  effects: Effects.optional(),
  next: Next.optional(),
});
const DoseNode = z.strictObject({
  type: z.literal('dose'),
  ...nodeBase,
  check: Check,
  prompt: Text,
  drug: Id, // codex/drugs/<drug>.yaml
  dose: Id, // id of a dose inside that drug card
  tolerancePct: z.number().min(0).max(50).default(0),
  correct: DoseOutcome,
  under: DoseOutcome,
  over: DoseOutcome,
  next: Next,
});
const CalcOutcome = DoseOutcome;
const CalculatorNode = z.strictObject({
  type: z.literal('calculator'),
  ...nodeBase,
  check: Check,
  prompt: Text,
  score: Id, // codex/scores/<score>.yaml
  answers: z.record(Id, ScoreAnswer), // the correct answer for every item, from the case facts
  correct: CalcOutcome, // every item right (default grade best)
  close: CalcOutcome, // same band, some items wrong (default acceptable)
  wrong: CalcOutcome, // different band (default suboptimal)
  next: Next,
});
const EndingNode = z.strictObject({
  type: z.literal('ending'),
  ...nodeBase,
  outcome: z.enum(['good', 'fair', 'critical']),
  summary: Text,
});

export const Node = z.discriminatedUnion('type', [
  StoryNode,
  ChoiceNode,
  EcgNode,
  MultiNode,
  DoseNode,
  CalculatorNode,
  EndingNode,
]);
export type Node = z.infer<typeof Node>;
export type NodeOf<T extends Node['type']> = Extract<Node, { type: T }>;

// ---------- case ----------

export const Case = z.strictObject({
  id: Id,
  title: Text, // presentation only — never the diagnosis
  difficulty: z.number().int().min(1).max(3),
  minutes: z.number().int().min(1), // rough play time
  settings: z.array(Id).min(1).optional(),
  patient: z.strictObject({
    age: z.number().int(),
    sex: z.enum(['M', 'F']),
    weightKg: z.number(),
  }),
  initial: z.strictObject({
    clock: z.string().regex(/^\d{2}:\d{2}$/, 'clock as HH:MM'),
    vitals: z.strictObject({
      hr: z.number(),
      sbp: z.number(),
      dbp: z.number(),
      rr: z.number(),
      spo2: z.number(),
      gcs: z.number(),
      temp: z.number(),
    }),
    flags: z.array(Id).default([]),
  }),
  timeTargets: z.record(Id, z.array(Id)).optional(), // setting -> benchmark ids
  check: Check, // the presentation / vitals as a whole
  start: Id,
  nodes: z.record(Id, Node),
  debrief: z.strictObject({
    diagnosis: Text,
    keyPoints: z.array(Text).min(1),
    pitfalls: z.array(Text).default([]),
    unlocks: z.array(Id).default([]),
    refs: z.array(Id).default([]),
    check: Check,
  }),
});
export type Case = z.infer<typeof Case>;

// ---------- shared files ----------

export const SystemsFile = z.array(
  z.strictObject({
    id: Id,
    name: Text,
    status: z.enum(['active', 'soon']),
    blurb: Text.optional(),
  }),
);

export const ModuleFile = z.strictObject({
  id: Id,
  title: Text,
  blurb: Text.optional(),
  settings: z
    .array(z.strictObject({ id: Id, label: Text, description: Text }))
    .default([]),
  cases: z.array(z.string()).min(1), // case file names in play order, e.g. cp-01
});

export const ReferencesFile = z.array(
  z.strictObject({
    id: Id,
    citation: Text,
    year: z.number().int(),
    url: z.string().url().optional(),
    todo: Text.optional(),
  }),
);

const Limit = z.strictObject({ low: z.number(), high: z.number() });

export const BenchmarksFile = z.strictObject({
  timeTargets: z.array(
    z.strictObject({
      id: Id,
      label: Text,
      from: Id, // milestone ("door" = arrival)
      to: Id,
      targetMin: z.number().min(0),
      check: Check,
    }),
  ),
  vitalLimits: z.strictObject({
    check: Check,
    hr: Limit,
    sbp: Limit,
    dbp: Limit,
    rr: Limit,
    spo2: Limit,
    gcs: Limit,
    temp: Limit,
  }),
});

// Dose rules: exactly one of fixed / perKg / bands.
const Range = z.union([z.number(), z.strictObject({ min: z.number(), max: z.number() })]);
export const DoseRule = z
  .strictObject({
    unit: Text, // mg, units, million units …
    fixed: Range.optional(),
    perKg: Range.optional(),
    maxDose: z.number().optional(), // cap for perKg
    bands: z
      .array(z.strictObject({ belowKg: z.number().optional(), dose: z.number() }))
      .min(1)
      .optional(),
    ageAdjust: z.strictObject({ fromAge: z.number(), factor: z.number() }).optional(),
  })
  .refine((r) => [r.fixed, r.perKg, r.bands].filter((x) => x !== undefined).length === 1, {
    message: 'a dose needs exactly one of fixed, perKg or bands',
  })
  .refine(
    (r) =>
      !r.bands ||
      r.bands.every((b, i, all) =>
        i === all.length - 1
          ? true
          : b.belowKg !== undefined && (i === 0 || b.belowKg > all[i - 1]!.belowKg!),
      ),
    { message: 'bands must go from lightest to heaviest; only the last band may omit belowKg' },
  );
export type DoseRule = z.infer<typeof DoseRule>;

export const CodexCard = z.strictObject({
  id: Id,
  title: Text,
  summary: Text,
  sections: z.array(z.strictObject({ heading: Text, body: Text })).default([]),
  doses: z
    .array(
      z.strictObject({
        id: Id,
        label: Text, // e.g. "Loading dose, STEMI"
        route: Text,
        rule: DoseRule.optional(), // needed if a dose node asks for it
        text: Text, // how it reads on the card
        check: Check,
      }),
    )
    .default([]),
  india: Text.optional(), // availability note for India
  score: ScoreDef.optional(), // required for cards in codex/scores/
  refs: z.array(Id).default([]),
  check: Check,
});
export type CodexCard = z.infer<typeof CodexCard>;

// Stylised ECG drawings (scripts/draw-ecg.ts turns these into SVG).
const LeadShape = z.strictObject({
  p: z.number().optional(),
  q: z.number().optional(),
  r: z.number().optional(),
  s: z.number().optional(),
  t: z.number().optional(),
  st: z.number().optional(),
});
export const EcgSpec = z.strictObject({
  title: Text,
  layout: z.enum(['12-lead', 'strip']),
  rhythm: z.union([
    z.strictObject({ kind: z.literal('sinus'), rate: z.number() }),
    z.strictObject({
      kind: z.literal('av-dissociation'),
      atrialRate: z.number(),
      ventricularRate: z.number(),
    }),
  ]),
  labels: z.array(Text).length(12).optional(), // e.g. right-sided V1R…V6R
  rhythmLead: Text.default('II'),
  leads: z.record(z.string(), LeadShape).default({}),
  check: Check,
});
export type EcgSpec = z.infer<typeof EcgSpec>;
