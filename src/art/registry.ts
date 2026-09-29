// Names of the scenes and actors a panel can use. Content refers to these by name;
// Phase 3 replaces the placeholder rendering with SVG line art for each.
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

export type Scene = (typeof SCENES)[number];
export type Actor = (typeof ACTORS)[number];

export const sceneLabel = (s: Scene) => s.replace(/-/g, ' ');
export const actorLabel: Record<Actor, string> = {
  patient: 'patient',
  'patient-supine': 'patient lying on a trolley',
  doctor: 'you, the ED doctor',
  nurse: 'nurse',
  relative: 'relative',
  paramedic: 'paramedic',
  senior: 'senior doctor',
};
