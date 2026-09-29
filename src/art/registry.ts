// Names of the scenes, actors and moods a panel can use. Content refers to these by name,
// e.g. `scene: resus-bay`, `actors: [patient-supine:pain, nurse:worried]`.
export const SCENES = [
  'ambulance-bay',
  'triage-desk',
  'resus-bay',
  'monitor',
  'ecg-machine',
  'cath-lab-door',
  'corridor',
  'ward',
] as const;

export const ACTORS = [
  'patient',
  'patient-supine',
  'doctor',
  'nurse',
  'relative',
  'paramedic',
  'senior',
] as const;

/** Expressions, drawn with eyebrows and mouth only. */
export const MOODS = ['neutral', 'pain', 'worried', 'relieved', 'alarmed'] as const;

export type Scene = (typeof SCENES)[number];
export type Actor = (typeof ACTORS)[number];
export type Mood = (typeof MOODS)[number];

export interface ActorRef {
  name: Actor;
  mood: Mood;
}

/** "patient:pain" → { name: 'patient', mood: 'pain' }; undefined if not valid. */
export function parseActor(ref: string): ActorRef | undefined {
  const [name, mood = 'neutral', extra] = ref.split(':');
  if (extra !== undefined) return undefined;
  if (!(ACTORS as readonly string[]).includes(name!)) return undefined;
  if (!(MOODS as readonly string[]).includes(mood)) return undefined;
  return { name: name as Actor, mood: mood as Mood };
}

export const sceneLabel = (s: Scene) => s.replace(/-/g, ' ');
export const actorLabel: Record<Actor, string> = {
  patient: 'the patient',
  'patient-supine': 'the patient lying on a trolley',
  doctor: 'you, the ED doctor',
  nurse: 'a nurse',
  relative: 'a relative',
  paramedic: 'a paramedic',
  senior: 'the senior doctor',
};
export const moodLabel: Record<Mood, string> = {
  neutral: '',
  pain: 'in pain',
  worried: 'looking worried',
  relieved: 'looking relieved',
  alarmed: 'looking alarmed',
};
