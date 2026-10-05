// Shapes of the compiled content the app and engine consume (produced by compile.ts).
import type { Case, CodexCard, DoseRule, EcgSpec, Node, ScoreDef } from './schema.ts';
import type { z } from 'zod';
import type { EcgLayout } from '../art/ecgLayout.ts';
import type { Check as CheckSchema, BenchmarksFile, ReferencesFile } from './schema.ts';

export type Check = z.infer<typeof CheckSchema>;
export type Reference = z.infer<typeof ReferencesFile>[number];
export type TimeTarget = z.infer<typeof BenchmarksFile>['timeTargets'][number];
export type VitalLimits = Omit<z.infer<typeof BenchmarksFile>['vitalLimits'], 'check'>;

export type CodexKind = 'anatomy' | 'pathology' | 'drugs' | 'procedures' | 'scores' | 'ecg';
export const CODEX_KINDS: CodexKind[] = ['anatomy', 'pathology', 'drugs', 'procedures', 'scores', 'ecg'];

export interface ResolvedDose {
  drugId: string;
  drugTitle: string;
  label: string;
  route: string;
  text: string;
  rule: DoseRule;
  check: Check;
}

export interface ResolvedScore {
  id: string;
  title: string;
  def: ScoreDef;
  refs: Reference[];
}

export interface HospitalSetting {
  id: string;
  label: string;
  description: string;
}

export interface CompiledCase extends Omit<Case, 'settings' | 'timeTargets' | 'debrief'> {
  system: string;
  module: string;
  settings: HospitalSetting[];
  /** setting id (or "default") -> time targets that apply */
  timeTargets: Record<string, TimeTarget[]>;
  vitalLimits: VitalLimits;
  /** "drug/dose" -> resolved dose used by dose nodes */
  doses: Record<string, ResolvedDose>;
  /** score id -> point table used by calculator nodes */
  scores: Record<string, ResolvedScore>;
  debrief: Omit<Case['debrief'], 'unlocks' | 'refs'> & {
    unlocks: { id: string; kind: CodexKind; title: string }[];
    refs: Reference[];
  };
  /** true if any clinical item this case depends on is unverified */
  draft: boolean;
  unverifiedCount: number;
  /** lead positions for ecg-leads nodes, keyed by image path */
  leadLayouts: Record<string, EcgLayout>;
  /** checks of the ECG drawings used, keyed by image path */
  imageChecks: Record<string, Check>;
  /** illustration width and height in px, keyed by art name (e.g. cp-01/01-arrival-1) */
  artSizes: Record<string, [number, number]>;
  /** ECG specs the monitor can show (initial.rhythm and every `rhythm:` effect), keyed by image path */
  rhythms: Record<string, EcgSpec>;
}

export interface CaseSummary {
  id: string;
  file: string;
  title: string;
  difficulty: number;
  minutes: number;
  draft: boolean;
  settings: HospitalSetting[];
  /** total size of the case's illustrations (bytes), for "save for offline" */
  artBytes: number;
}

export interface ModuleSummary {
  id: string;
  title: string;
  blurb?: string;
  cases: CaseSummary[];
}

export interface SystemSummary {
  id: string;
  name: string;
  status: 'active' | 'soon';
  blurb?: string;
  modules: ModuleSummary[];
}

export interface CodexEntry extends CodexCard {
  kind: CodexKind;
  draft: boolean;
  refDetails: Reference[];
}

export interface ContentIndex {
  version: string;
  systems: SystemSummary[];
  codex: { id: string; kind: CodexKind; title: string; draft: boolean }[];
}

/** One clinical item for the owner's review list. */
export interface CheckEntry {
  file: string;
  line: number;
  where: string;
  what: string;
  source: string[];
  verified: boolean;
  reviewedOn?: string;
  todo?: string;
}

export type { Node };
