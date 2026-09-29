// The game engine: pure functions over (compiled case, run state, learner input).
// No React, no storage, no clinical facts — every number that matters comes from the case.
import type { Condition, Effects, Grade, Next, Node, NodeOf, Option } from '../content/schema.ts';
import type { CompiledCase } from '../content/types.ts';
import { expectedDose, type DoseRange } from './dose.ts';

export type VitalKey = 'hr' | 'sbp' | 'dbp' | 'rr' | 'spo2' | 'gcs' | 'temp';
export type Vitals = Record<VitalKey, number>;
const VITAL_KEYS: VitalKey[] = ['hr', 'sbp', 'dbp', 'rr', 'spo2', 'gcs', 'temp'];

/** Physical bounds only, so effects can't produce impossible numbers. Not clinical thresholds. */
const BOUNDS: Record<VitalKey, [number, number]> = {
  hr: [0, 250],
  sbp: [0, 300],
  dbp: [0, 200],
  rr: [0, 70],
  spo2: [0, 100],
  gcs: [3, 15],
  temp: [25, 45],
};

export type Input =
  | { kind: 'continue' }
  | { kind: 'pick'; optionId: string }
  | { kind: 'multi'; optionIds: string[] }
  | { kind: 'dose'; value: number };

export interface Pick {
  optionId: string;
  label: string;
  grade: Grade;
  consequence: string;
  teaching: string;
  /** multiselect: a best option the learner did not choose */
  missed?: boolean;
}

export interface LogEntry {
  nodeId: string;
  type: 'choice' | 'ecg' | 'multiselect' | 'dose';
  prompt: string;
  atMinutes: number;
  picks: Pick[];
  dose?: { value: number; expected: DoseRange };
}

export interface RunState {
  caseId: string;
  setting: string | null;
  nodeId: string;
  vitals: Vitals;
  minutes: number;
  flags: string[];
  patient: number;
  safetyEvents: number;
  milestones: Record<string, number>;
  log: LogEntry[];
  inputs: Input[];
  ended: boolean;
}

export class EngineError extends Error {}

// ---------- starting & moving ----------

export function startRun(c: CompiledCase, setting: string | null): RunState {
  if (c.settings.length && !c.settings.some((s) => s.id === setting))
    throw new EngineError(`Case ${c.id} needs a setting: ${c.settings.map((s) => s.id).join(', ')}`);
  const state: RunState = {
    caseId: c.id,
    setting: c.settings.length ? setting : null,
    nodeId: c.start,
    vitals: { ...c.initial.vitals },
    minutes: 0,
    flags: [...c.initial.flags],
    patient: 100,
    safetyEvents: 0,
    milestones: { door: 0 },
    log: [],
    inputs: [],
    ended: false,
  };
  return enter(c, state, c.start);
}

export function currentNode(c: CompiledCase, s: RunState): Node {
  const node = c.nodes[s.nodeId];
  if (!node) throw new EngineError(`No node "${s.nodeId}"`);
  return node;
}

export function visibleOptions(s: RunState, node: Node): Option[] {
  if (!('options' in node)) return [];
  return node.options.filter((o) => !o.showIf || test(o.showIf, s));
}

export interface ActResult {
  state: RunState;
  /** what the learner did and how it's graded (for Learn-mode feedback) */
  picks: Pick[];
  dose?: { value: number; expected: DoseRange; outcome: 'correct' | 'under' | 'over' };
}

export function act(c: CompiledCase, prev: RunState, input: Input): ActResult {
  if (prev.ended) throw new EngineError('The case has ended');
  const s: RunState = structuredClone(prev);
  s.inputs.push(input);
  const node = currentNode(c, s);

  switch (node.type) {
    case 'story':
      expect(input, 'continue');
      return { state: goto(c, s, node.next), picks: [] };

    case 'choice':
    case 'ecg': {
      const pick = expect(input, 'pick');
      const option = visibleOptions(s, node).find((o) => o.id === pick.optionId);
      if (!option) throw new EngineError(`Option "${pick.optionId}" is not available here`);
      const p = toPick(option);
      applyGrade(s, p);
      applyEffects(s, option.effects);
      log(s, node, [p]);
      return { state: goto(c, s, option.next!), picks: [p] };
    }

    case 'multiselect': {
      const multi = expect(input, 'multi');
      const visible = visibleOptions(s, node);
      const chosen = new Set(multi.optionIds);
      if (chosen.size < node.min || chosen.size > node.max)
        throw new EngineError(`Choose between ${node.min} and ${node.max} options`);
      for (const id of chosen)
        if (!visible.some((o) => o.id === id)) throw new EngineError(`Option "${id}" is not available here`);
      const picks: Pick[] = [];
      for (const o of visible) {
        if (chosen.has(o.id!)) {
          const p = toPick(o);
          applyGrade(s, p);
          applyEffects(s, o.effects);
          picks.push(p);
        } else if (o.grade === 'best') {
          applyEffects(s, o.missedEffects);
          picks.push({ ...toPick(o), grade: 'suboptimal', missed: true });
        }
      }
      log(s, node, picks);
      return { state: goto(c, s, node.next), picks };
    }

    case 'dose': {
      const { value } = expect(input, 'dose');
      if (!Number.isFinite(value) || value < 0) throw new EngineError('Enter a dose as a number');
      const expected = doseFor(c, node);
      const tol = node.tolerancePct / 100;
      const outcome =
        value < expected.min * (1 - tol) ? 'under' : value > expected.max * (1 + tol) ? 'over' : 'correct';
      const o = node[outcome];
      const defaultGrade: Record<typeof outcome, Grade> = { correct: 'best', under: 'suboptimal', over: 'harmful' };
      const p: Pick = {
        optionId: outcome,
        label: `${formatNumber(value)} ${expected.unit}`,
        grade: o.grade ?? defaultGrade[outcome],
        consequence: o.consequence,
        teaching: o.teaching,
      };
      applyGrade(s, p);
      applyEffects(s, o.effects);
      log(s, node, [p], { value, expected });
      return { state: goto(c, s, o.next ?? node.next), picks: [p], dose: { value, expected, outcome } };
    }

    case 'ending':
      throw new EngineError('The case has ended');
  }
}

export function doseFor(c: CompiledCase, node: NodeOf<'dose'>): DoseRange {
  const d = c.doses[`${node.drug}/${node.dose}`];
  if (!d) throw new EngineError(`Missing dose ${node.drug}/${node.dose}`);
  return expectedDose(d.rule, c.patient);
}

/** Rebuild a run from its saved inputs (used for resume and the debrief). */
export function replay(c: CompiledCase, setting: string | null, inputs: Input[]): RunState {
  let s = startRun(c, setting);
  for (const input of inputs) s = act(c, s, input).state;
  return s;
}

// ---------- ideal path ----------

/** The input an expert would give at the current node. */
export function idealInput(c: CompiledCase, s: RunState): Input {
  const node = currentNode(c, s);
  switch (node.type) {
    case 'story':
      return { kind: 'continue' };
    case 'choice':
    case 'ecg': {
      const opts = visibleOptions(s, node);
      const best = opts.find((o) => o.grade === 'best') ?? opts.find((o) => o.grade === 'acceptable') ?? opts[0]!;
      return { kind: 'pick', optionId: best.id! };
    }
    case 'multiselect': {
      const opts = visibleOptions(s, node);
      const ids = opts.filter((o) => o.grade === 'best').map((o) => o.id!);
      for (const o of opts) if (ids.length < node.min && o.grade === 'acceptable') ids.push(o.id!);
      return { kind: 'multi', optionIds: ids.slice(0, node.max) };
    }
    case 'dose': {
      const e = doseFor(c, node);
      return { kind: 'dose', value: e.min === e.max ? e.min : (e.min + e.max) / 2 };
    }
    case 'ending':
      throw new EngineError('The case has ended');
  }
}

export function idealRun(c: CompiledCase, setting: string | null, maxSteps = 500): RunState {
  let s = startRun(c, setting);
  for (let i = 0; !s.ended; i++) {
    if (i > maxSteps) throw new EngineError('Ideal path does not reach an ending (loop?)');
    s = act(c, s, idealInput(c, s)).state;
  }
  return s;
}

// ---------- result ----------

/** Game rule (not clinical): a patient meter below this costs a star. */
export const PATIENT_STAR_THRESHOLD = 70;

export interface TimeResult {
  id: string;
  label: string;
  targetMin: number;
  actualMin: number | null;
  met: boolean;
}

export interface RunResult {
  outcome: 'good' | 'fair' | 'critical';
  stars: 1 | 2 | 3;
  patient: number;
  safetyEvents: number;
  time: TimeResult[];
  mistakes: (Pick & { nodeId: string; prompt: string })[];
}

export function timeResults(c: CompiledCase, s: RunState): TimeResult[] {
  const targets = c.timeTargets[s.setting ?? 'default'] ?? c.timeTargets.default ?? [];
  return targets.map((t) => {
    const from = s.milestones[t.from];
    const to = s.milestones[t.to];
    const actual = from !== undefined && to !== undefined ? to - from : null;
    return { id: t.id, label: t.label, targetMin: t.targetMin, actualMin: actual, met: actual !== null && actual <= t.targetMin };
  });
}

export function result(c: CompiledCase, s: RunState): RunResult {
  const node = currentNode(c, s);
  if (node.type !== 'ending') throw new EngineError('The case has not ended');
  const time = timeResults(c, s);
  let stars = 3;
  if (s.safetyEvents > 0) stars--;
  if (time.some((t) => !t.met) || s.patient < PATIENT_STAR_THRESHOLD) stars--;
  if (node.outcome === 'critical') stars = 1;
  const mistakes = s.log.flatMap((e) =>
    e.picks
      .filter((p) => p.grade === 'suboptimal' || p.grade === 'harmful')
      .map((p) => ({ ...p, nodeId: e.nodeId, prompt: e.prompt })),
  );
  return {
    outcome: node.outcome,
    stars: Math.max(1, stars) as 1 | 2 | 3,
    patient: s.patient,
    safetyEvents: s.safetyEvents,
    time,
    mistakes,
  };
}

// ---------- clock ----------

export function clockAt(c: CompiledCase, minutes: number): string {
  const [h, m] = c.initial.clock.split(':').map(Number) as [number, number];
  const total = (h * 60 + m + Math.round(minutes)) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ---------- internals ----------

export function test(cond: Condition, s: RunState): boolean {
  if ('flag' in cond) return s.flags.includes(cond.flag);
  if ('notFlag' in cond) return !s.flags.includes(cond.notFlag);
  if ('setting' in cond) return s.setting === cond.setting;
  if ('all' in cond) return cond.all.every((x) => test(x, s));
  if ('any' in cond) return cond.any.some((x) => test(x, s));
  if ('not' in cond) return !test(cond.not, s);
  const v = 'vital' in cond ? s.vitals[cond.vital] : s.patient;
  if (cond.below !== undefined && !(v < cond.below)) return false;
  if (cond.above !== undefined && !(v > cond.above)) return false;
  return true;
}

export function resolveNext(next: Next, s: RunState): string {
  if (typeof next === 'string') return next;
  for (const n of next) if (!n.if || test(n.if, s)) return n.to;
  throw new EngineError('No branch matched'); // unreachable: compiler requires a fallback
}

export function applyEffects(s: RunState, e: Effects | undefined): void {
  if (!e) return;
  s.minutes += e.minutes ?? 0;
  for (const k of VITAL_KEYS) {
    const delta = e[k];
    if (delta !== undefined) s.vitals[k] += delta;
    const set = e.setVitals?.[k];
    if (set !== undefined) s.vitals[k] = set;
    const [lo, hi] = BOUNDS[k];
    s.vitals[k] = Math.min(hi, Math.max(lo, s.vitals[k]));
  }
  if (s.vitals.dbp >= s.vitals.sbp) s.vitals.dbp = Math.max(0, s.vitals.sbp - 10);
  for (const f of e.addFlags ?? []) if (!s.flags.includes(f)) s.flags.push(f);
  if (e.removeFlags) s.flags = s.flags.filter((f) => !e.removeFlags!.includes(f));
  s.patient = Math.min(100, Math.max(0, s.patient + (e.patient ?? 0)));
  const ms = e.milestone === undefined ? [] : Array.isArray(e.milestone) ? e.milestone : [e.milestone];
  for (const m of ms) if (s.milestones[m] === undefined) s.milestones[m] = s.minutes;
}

function enter(c: CompiledCase, s: RunState, nodeId: string): RunState {
  const node = c.nodes[nodeId];
  if (!node) throw new EngineError(`No node "${nodeId}"`);
  s.nodeId = nodeId;
  applyEffects(s, node.onEnter);
  if (node.type === 'ending') s.ended = true;
  return s;
}

function goto(c: CompiledCase, s: RunState, next: Next): RunState {
  return enter(c, s, resolveNext(next, s));
}

function applyGrade(s: RunState, p: Pick) {
  if (p.grade === 'harmful') s.safetyEvents++;
}

function toPick(o: Option): Pick {
  return { optionId: o.id!, label: o.label, grade: o.grade, consequence: o.consequence, teaching: o.teaching };
}

function log(s: RunState, node: Node, picks: Pick[], dose?: LogEntry['dose']) {
  if (node.type === 'story' || node.type === 'ending') return;
  s.log.push({ nodeId: s.nodeId, type: node.type, prompt: node.prompt, atMinutes: s.minutes, picks, dose });
}

function expect<K extends Input['kind']>(input: Input, kind: K): Extract<Input, { kind: K }> {
  if (input.kind !== kind) throw new EngineError(`Expected a ${kind} input, got ${input.kind}`);
  return input as Extract<Input, { kind: K }>;
}

export function formatNumber(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
