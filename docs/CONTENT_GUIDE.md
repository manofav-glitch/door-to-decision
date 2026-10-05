# Content guide: writing cases for Door to Decision

This guide is for the content owner. You don't need to know any programming: cases are plain text
files in YAML format, and the app checks them for you. When something is wrong, `npm run validate`
tells you the file, the line number and what to fix.

---

## 1. Where things live

```
content/
  systems.yaml                 organ systems on the Home screen
  references.yaml              every source you cite (guidelines, papers)
  benchmarks.yaml              time targets (door-to-ECG …) and the monitor's red-alert ranges
  cvs/chest-pain/
    module.yaml                the module: title, hospital settings, list of cases in order
    cases/cp-01.yaml …         one file per case
  codex/
    anatomy/ pathology/ drugs/ scores/ ecg/    one file per Codex card
  assets/ecg/
    cp-01-ecg-1.ecg.yaml       settings for a drawn ECG  →  cp-01-ecg-1.svg (made by npm run ecg)
  assets/art/
    credits.yaml               who made each folder of pictures, and with what
    cp-01/01-arrival-1.png …   your original illustrations (not uploaded to GitHub: too big)
  assets/panels/cp-01/*.webp   small web copies the app uses (made by npm run art)
docs/
  art/cp-01-prompts.md         the ChatGPT prompts used for case 1's pictures
  CLINICAL_REVIEW.md           your checklist of unverified items (npm run review)
  graphs/                      a branching map of each case (npm run graph)
  templates/case.yaml          the starting point for a new case
```

**Rule of thumb:** clinical _facts_ (doses, thresholds, time targets, score points) live in drug cards,
`benchmarks.yaml` and score cards. Cases _refer_ to them, so fixing a dose in one place fixes it everywhere.

---

## 2. Your everyday loop

| What you want                                       | Command (run in the Terminal, in the project folder)                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| See the app while you edit (it reloads as you save) | `npm run dev`, then open the address it prints                                                          |
| Check everything                                    | `npm run validate`                                                                                      |
| See a case's branches as a flowchart                | `npm run graph` → open `docs/graphs/<case>.md` (GitHub shows it as a diagram)                           |
| Get your list of things to verify                   | `npm run review` → `docs/CLINICAL_REVIEW.md`                                                            |
| Start a new case                                    | `npm run new-case -- cvs chest-pain cp-03 "62F, sudden tearing back pain"` (or ask Claude: `/new-case`) |
| Redraw ECGs after changing their settings           | `npm run ecg`                                                                                           |

**Dev mode:** add `?dev=1` to the app's address (e.g. `https://…/door-to-decision/?dev=1`). You'll see
each step's name, a **Jump to step** picker and the hidden state (vitals, flags, clock, meters). Jumps are
not saved. `?dev=0` turns it off.

**Draft cases:** a case with anything unverified is a _draft_. While you run `npm run dev`, drafts show
by default; on the live site they're hidden unless **Settings → Show draft cases** is on.

---

## 3. YAML in two minutes

```yaml
# anything after a # is a comment: the app ignores it
title: '58M, heavy chest, cold sweat' # text: use quotes if it contains : or #
difficulty: 2 # a number
flags: [rv_infarct, diabetic] # a list on one line
keyPoints: # …or a list over several lines
  - 'First point.'
  - 'Second point.'
patient: { age: 58, sex: M, weightKg: 70 } # a small group on one line
```

**Indentation matters:** use 2 spaces per level, never tabs. If validate says something odd about a
line, check its indentation against the lines above.

---

## 4. A case file, top to bottom

```yaml
id: cvs-cp-03 # <system>-<file name>; must match
title: '62F, sudden tearing back pain' # the presentation, never the diagnosis
difficulty: 2 # 1–3
minutes: 10 # rough play time
settings: [pci-capable, non-pci] # optional; defined in module.yaml
patient: { age: 62, sex: F, weightKg: 60 }
initial:
  clock: '22:40' # wall clock at arrival
  vitals: { hr: 104, sbp: 168, dbp: 96, rr: 22, spo2: 96, gcs: 15, temp: 36.9 }
  flags: [dissection] # hidden truths the story can branch on
timeTargets: # which targets from benchmarks.yaml count, per setting
  default: [door-to-ecg]
check: { source: esc-acs-2023, verified: false, todo: '…' }
start: arrival # the first step
nodes: # the steps (see section 5)
  arrival: …
debrief:
  diagnosis: '…' # revealed at the end
  keyPoints: ['…']
  pitfalls: ['…']
  unlocks: [rca-territory, aspirin] # Codex card ids
  refs: [esc-acs-2023] # reference ids
  check: { source: …, verified: false }
```

---

## 5. The steps (node types)

Every step has a name (`arrival`, `first-move` …: lower-case, dashes) and a `type`. Most steps can also
have `panels:` (comic panels shown above the question) and `onEnter:` (effects applied when the step is
reached, e.g. vitals changing as a complication starts).

### story: panels, then Continue

```yaml
arrival:
  type: story
  panels:
    - scene: triage-desk
      actors: [patient:pain, nurse]
      caption: '{clock} · Triage'
      bubbles:
        - { who: patient, text: "It's like a weight on my chest." }
  next: first-move
```

### choice: one answer

```yaml
first-move:
  type: choice
  check: { source: esc-acs-2023, verified: false }
  prompt: 'Your first move?'
  options:
    - label: '12-lead ECG now'
      grade: best # best | acceptable | suboptimal | harmful
      consequence: 'The ECG is done at 4 minutes.' # one line: what happens
      teaching: 'ECG within 10 minutes in suspected ACS.' # one line: why
      effects: { minutes: 4, milestone: ecg }
      next: ecg-1
```

Every option needs its own `next:`.

### ecg: a choice with an ECG picture

Same as `choice`, plus `image: ecg/cp-01-ecg-1.svg` and `alt:` (a description of the tracing for
screen readers).

### ecg-leads: tap the leads

```yaml
ste-leads:
  type: ecg-leads
  check: { … }
  image: ecg/cp-01-ecg-1.svg # must be a drawn 12-lead (has a .ecg.yaml)
  alt: '…'
  prompt: 'Tap every lead that shows ST elevation.'
  answer: [II, III, aVF]
  correct: { consequence: '…', teaching: '…' } # exactly right (graded best)
  partial: { consequence: '…', teaching: '…' } # ≥ half found, ≤ 1 extra (acceptable)
  wrong: { consequence: '…', teaching: '…' } # anything else (suboptimal)
  next: ecg-1
```

### multiselect: pick several

```yaml
treatment:
  type: multiselect
  check: { … }
  prompt: 'Initial treatment. Choose up to 5.'
  max: 5 # (min defaults to 1)
  options:
    - id: aspirin # optional short name (defaults to o1, o2 …); shown in dev tools and logs
      label: 'Aspirin, loading dose'
      grade: best
      consequence: '…'
      teaching: '…'
      missedEffects: { patient: -10 } # applied if a *best* option is NOT picked
  next: dose-ufh # one next for the whole step (can be conditional)
```

Best options the learner misses show as **Missed** in feedback.

### dose: type a dose

```yaml
dose-tnk:
  type: dose
  check: { … }
  prompt: 'Tenecteplase: he is 58 and weighs 70 kg. Dose in mg?'
  drug: tenecteplase # codex/drugs/tenecteplase.yaml
  dose: stemi # the dose id inside that card (it must have a rule:)
  tolerancePct: 0 # how far outside the correct range still counts as correct
  correct: { consequence: '…', teaching: '…', effects: { milestone: lysis } }
  under: { consequence: '…', teaching: '…' } # graded suboptimal
  over: { consequence: '…', teaching: '…' } # graded harmful
  next: chb-alarm
```

The correct answer is worked out from the drug card and the case's patient (weight, age), so it's never
typed into the case.

### calculator: work out a score

```yaml
heart-score:
  type: calculator
  check: { … }
  prompt: 'Work out his HEART score.'
  score: heart # codex/scores/heart.yaml
  answers: # the right answer for every item, from the case facts
    history: slight
    ecg: normal
    age: 44 # number items take the value; the app finds the bin
    risk-factors: one-two
    troponin: normal
  correct: { consequence: '…', teaching: '…' } # every item right (best)
  close: { consequence: '…', teaching: '…' } # right band (acceptable)
  wrong: { consequence: '…', teaching: '…' } # wrong band (suboptimal)
  next: plan
```

### ending

```yaml
end-good:
  type: ending
  outcome: good # good | fair | critical
  panels: […]
  summary: 'What happened to the patient, in two sentences.'
```

A **critical** ending always gives 1 star. Write it as teaching, never blame.

---

## 6. Grades, meters and stars

- **Grades:** best · acceptable · suboptimal · harmful. Each **harmful** pick is counted as a _safety
  event_ automatically.
- **Patient meter** (0–100) starts at 100; change it with `effects: { patient: -15 }`.
- **Time meter:** time targets from `benchmarks.yaml` (see section 9).
- **Stars:** start at 3; lose one for any harmful pick; lose one for a missed time target or a Patient
  meter below 70; a critical ending is always 1.
- **Ideal path:** the app follows the `best` option at every step (the first `acceptable` one if no best).
  Every case must reach a **good** ending with 3 stars this way, in every setting; the tests check this.

---

## 7. Effects: what a decision does to the patient

```yaml
effects:
  minutes: 5 # the clock moves on
  sbp: -25 # changes: hr, sbp, dbp, rr, spo2, gcs, temp
  setVitals: { hr: 36 } # set exactly, e.g. a sudden complete heart block
  addFlags: [nitrate_given] # remember something for later branching
  removeFlags: [in_pain]
  patient: -15 # Patient meter
  milestone: ecg # stamp the clock (for time targets); only the first stamp counts
```

---

## 8. Branching

`next:` can be one step, or a list checked **top to bottom**, where the first match wins:

```yaml
next:
  - { if: { flag: beta_blocker_given }, to: end-beta-blocker }
  - { if: { setting: pci-capable }, to: reperfusion-pci }
  - { to: reperfusion-nonpci } # the last one must have no "if" (the fallback)
```

Conditions you can use:

| Condition                                                 | Means                                    |
| --------------------------------------------------------- | ---------------------------------------- |
| `{ flag: x }` / `{ notFlag: x }`                          | a flag is / isn't set                    |
| `{ setting: non-pci }`                                    | the hospital setting chosen at the start |
| `{ vital: sbp, below: 90 }` / `{ vital: hr, above: 120 }` | current vitals                           |
| `{ meter: patient, below: 70 }`                           | the Patient meter                        |
| `{ all: [ …, … ] }` / `{ any: [ …, … ] }` / `{ not: … }`  | combine them                             |

**Show an option only sometimes:** `showIf: { setting: non-pci }` on the option. This is how the same
patient gets different correct answers at a PCI-capable centre and a non-PCI hospital.

**Reusing a list:** name it with `&name` the first time and repeat it with `*name`:

```yaml
next: &outcome
  - { if: { meter: patient, below: 70 }, to: end-fair }
  - { to: end-good }
…
next: *outcome
```

Validate catches: a `next` pointing to a step that doesn't exist; steps nothing leads to; steps that can
never reach an ending; flags that are checked but never set.

---

## 9. Time targets and settings

`benchmarks.yaml` defines targets as _from one milestone to another_:

```yaml
- id: dx-to-lysis
  label: 'STEMI diagnosis to fibrinolytic bolus'
  from: stemi-dx
  to: lysis
  targetMin: 10
  check: { source: esc-acs-2023, verified: false }
```

`door` is stamped automatically at arrival. Options stamp the others with `milestone:`. In a case, list
which targets count: `timeTargets: { pci-capable: [door-to-ecg, dx-to-wire], non-pci: [...] }` (or
`default:` for cases without settings).

Hospital **settings** are defined once in `module.yaml` (id, label, description) and chosen per case
with `settings: [pci-capable, non-pci]`.

---

## 10. Panels: scenes, characters, moods

```yaml
- scene: resus-bay
  actors: [patient-supine:pain, nurse:alarmed, doctor]
  caption: '{clock} · Resus bay' # {clock} = the case clock
  sfx: 'BEEP · BEEP · BEEP' # optional sound lettering (drawn in red)
  bubbles:
    - { who: nurse, text: "His pressure's crashed!" }
    - { who: narrator, text: 'Pressing on the chest wall reproduces the pain.' }
  alt: '…' # optional; a description is generated if left out
```

- **Scenes:** `triage-desk`, `ambulance-bay`, `resus-bay`, `monitor` (close-up showing the patient's
  current numbers, alarms in red), `ecg-machine`, `cath-lab-door`, `corridor`, `ward`.
- **Characters:** `patient`, `patient-supine` (on a trolley), `doctor` (the learner, shown as "You"),
  `nurse`, `senior`, `relative`, `paramedic`. They stand left to right in the order you list them.
- **Moods:** add `:pain`, `:worried`, `:relieved` or `:alarmed` (default neutral).
- **Bubbles:** `who` is one of the characters or `narrator` (a caption box). Tails point at the speaker.

To see every character and scene: run `npm run dev` and open `…/#/dev/art`.

### Illustrations (pictures instead of line drawings)

A panel can show one of your pictures instead of the line drawing. The caption goes above it and the
bubbles below it, so no face is covered.

1. Save the picture (one panel per file; square or wide, ideally about 1024 px across) as
   `content/assets/art/<case>/<name>.png`, e.g. `content/assets/art/cp-01/01-arrival-1.png`.
   `.jpg` and `.webp` work too. To replace a picture, save the new one under the same name.
2. Add `art:` to the panel, folder and name without the extension, and list the characters
   **left to right as they appear in the picture** (bubble tails follow that order):
   ```yaml
   - scene: triage-desk
     art: cp-01/01-arrival-1
     actors: [patient:pain, nurse]
   ```
3. The first time you use a new folder, add it to `content/assets/art/credits.yaml` (who made the
   pictures and with which tool).
4. Run `npm run art` (it also runs on its own before `npm run dev`). It makes the small web copy in
   `content/assets/panels/`; that copy is what goes to GitHub, so keep your originals backed up.

Keep `scene:` and `actors:` accurate: they are the fallback drawing (if a picture can't load) and the
description screen readers hear. Pictures must have no text in them; the app adds the words. The monitor
close-ups and ECGs stay drawn, because they show live numbers.

---

## 11. Clinical checks and verification (the important bit)

Every clinical item carries a `check:`:

```yaml
check:
  source: esc-acs-2023 # or a list: [esc-acs-2023, kinch-1994]
  verified: false # only YOU change this to true
  reviewedOn: 2026-10-01 # required once verified is true
  todo: 'Confirm the dose band.' # optional note for the review list
```

- Steps with clinical content (choice, ecg, ecg-leads, multiselect, dose, calculator), the case itself,
  the debrief, every drug dose, score, time target and ECG drawing have one.
- `source` must be an id from `references.yaml`. No source yet? Use `needs-source` and a `todo`.
- **Workflow:** `npm run review` → open `docs/CLINICAL_REVIEW.md` → for each item, open the file at the
  line shown, check it against the source, then set `verified: true` and `reviewedOn: <today>`.
- A case stays a **draft** (hidden on the live site) until _everything it depends on_ is verified,
  including the drug doses it asks for, the scores it uses, its time targets and its ECG drawings.
- MI wording follows the Fifth Universal Definition (primary / secondary / procedure-related MI;
  MINOCA = myocardial injury with non-obstructive coronary arteries). Never copy text from textbooks or
  guidelines: paraphrase and cite.

---

## 12. Codex cards

### A drug card (`codex/drugs/<id>.yaml`, the id must match the file name)

```yaml
id: tenecteplase
title: Tenecteplase (TNK)
summary: 'One or two sentences.'
doses:
  - id: stemi
    label: 'STEMI, single bolus'
    route: IV bolus
    text: 'How it reads on the card.'
    rule: # needed only if a dose step asks for it
      unit: mg
      bands: # by weight, lightest first; the last band has no belowKg
        - { belowKg: 60, dose: 30 }
        - { dose: 50 }
      ageAdjust: { fromAge: 75, factor: 0.5 } # optional
    check: { source: esc-acs-2023, verified: false }
sections:
  - { heading: Contraindications, body: '…' }
india: 'Availability note for India.'
refs: [esc-acs-2023]
check: { source: esc-acs-2023, verified: false }
```

Dose rules use exactly one of: `fixed: 300` or `fixed: { min: 150, max: 300 }`;
`perKg: { min: 70, max: 100 }` (optional `maxDose:`); or `bands:` as above.

### Anatomy / pathology / ECG cards

The same layout without `doses:`: `id`, `title`, `summary`, `sections`, `refs`, `check`.

### A score card (`codex/scores/<id>.yaml`)

```yaml
score:
  items:
    - type: choice # tap one option
      id: history
      label: History
      options:
        - { id: slight, label: 'Slightly suspicious', points: 0 }
    - type: number # a value that falls into bins
      id: age
      label: Age
      unit: years
      bins: # value < below → this bin; the last bin has no below
        - { below: 45, points: 0, label: 'Under 45' }
        - { points: 2, label: '65 or over' }
    - { type: yesno, id: aspirin, label: 'Aspirin in the last 7 days', points: 1 }
  bands: # categories on the total (from = lowest total in the band)
    - { from: 0, label: Low, risk: '…' }
  riskTable: # optional finer lookup, e.g. GRACE nomogram
    label: 'In-hospital mortality'
    rows: [{ from: 0, risk: '0.2%' }]
  check: { … }
```

The score's test cases live in `src/clinical/score.test.ts`: if you correct a table, tell Claude so the
matching tests are updated.

### references.yaml

```yaml
- id: esc-acs-2023
  citation: 'Byrne RA, et al. 2023 ESC Guidelines for … Eur Heart J. 2023;44:3720–3826.'
  year: 2023
  url: https://doi.org/… # optional
  todo: '…' # optional
```

---

## 13. Drawing an ECG

Create `content/assets/ecg/<name>.ecg.yaml`, then run `npm run ecg` to make `<name>.svg`.

```yaml
title: '12-lead ECG, first recording'
layout: 12-lead # or strip (one 10-second rhythm strip)
rhythm: { kind: sinus, rate: 52 } # or { kind: av-dissociation, atrialRate: 80, ventricularRate: 36 }
labels: [I, II, III, aVR, aVL, aVF, V1R, V2R, V3R, V4R, V5R, V6R] # optional: rename leads
rhythmLead: II
leads: # override the normal shape of any lead (millivolts; 1 mV = 10 mm)
  III: { q: 0.15, r: 0.6, s: 0.03, st: 0.35, t: 0.5 } # st = ST elevation (negative = depression)
  aVL: { st: -0.2, t: -0.15 }
check: { source: …, verified: false, todo: 'Check the drawing shows what the case says.' }
```

Parts you can set per lead: `p`, `q`, `r`, `s`, `t` (wave heights), `st` (ST shift), `pr` (PR-segment
shift), `delta` (pre-excitation slur), `rp` (a second R, as in RBBB or Brugada), `u` (U wave), `notch`
(0–1, a notched T) and `tw` (T width: 0.5 = narrow and peaked, 1.5 = broad). For the whole ECG: `qrs`
(QRS width in ms, default 90) and `qt` (QT in ms, default 390).

Rhythms (`rhythm: { kind: … }`):

| kind | settings | for |
|---|---|---|
| `sinus` | `rate`, `pr` (ms, default 160), `alternans` | normal, sinus brady/tachy, first-degree block, WPW (short `pr` + `delta`) |
| `af` | `rate` | atrial fibrillation |
| `svt` | `rate` | regular narrow tachycardia with no visible P (AVNRT/AVRT) |
| `flutter` | `conduction` (2, 3, 4… or `variable`), `atrialRate` (default 300) | atrial flutter |
| `av-block` | `type` (`mobitz1`, `mobitz2`, `2:1`), `atrialRate`, `pr` | second-degree block |
| `av-dissociation` | `atrialRate`, `ventricularRate`, `atrial: af` | complete heart block; regularised AF (digoxin) |
| `vt` | `rate`, `atrialRate` (shows AV dissociation) | VT (set `qrs: 160`); also slow broad rhythms |
| `torsades` | `rate` | polymorphic VT / torsades |
| `vf` | — | ventricular fibrillation |
| `pre-excited-af` | `rate` | AF down an accessory pathway (set `qrs: 140`) |
| `paced` | `rate`, `capture` (`full`, `intermittent`, `none`), `escapeRate`, `atrialRate` | pacing, loss of capture |
| `asystole` | `atrialRate` (P waves only) | asystole, P-wave asystole |

Always look at the result: open the case in `npm run dev`.

---

## 14. When validate complains

| Message                                         | What to do                                            |
| ----------------------------------------------- | ----------------------------------------------------- |
| `unknown field(s): promt — check spelling`      | a typo in a field name                                |
| `Invalid option: expected one of "best"\|…`     | a grade or type is misspelt                           |
| `goes to "x", which is not a node in this case` | a `next:` points to a step name that doesn't exist    |
| `node "x" can never be reached from start`      | nothing leads to this step: link it, or delete it     |
| `dead end: no path from "x" reaches an ending`  | this step (or a loop) never reaches an ending         |
| `flag "x" is checked but never set`             | a condition uses a flag no option adds (often a typo) |
| `every option needs a next:`                    | a choice/ecg option is missing `next:`                |
| `unknown reference "x"`                         | add it to `references.yaml`, or fix the id            |
| `drug card "x" has no dose with id "y"`         | check the dose `id` in the drug card                  |
| `verified: true needs reviewedOn: YYYY-MM-DD`   | add today's date                                      |
| `id must be "cvs-cp-03"`                        | the case id must be `<system>-<file name>`            |
| Warning: `title may give away the diagnosis`    | reword the title as a presentation                    |
| Warning: `keep … to one short line`             | shorten the consequence or teaching point             |

If a message is unclear, paste it to Claude.

---

## 15. House-style checklist for a new case

- [ ] Title describes the presentation, not the diagnosis.
- [ ] Every decision has at least one `best` option; harmful options have a clear, kind teaching point.
- [ ] Consequences and teaching points are one short line each.
- [ ] Clinical numbers live in drug cards / benchmarks / scores, not in case text.
- [ ] Every clinical item has a `check:` with a real `source` (or `needs-source` + `todo`).
- [ ] If the case uses settings, it makes sense in each one (check `npm run graph`: bold = ideal path).
- [ ] The debrief unlocks the relevant Codex cards and cites its references.
- [ ] `npm run validate`, `npm test` and `npm run review` run clean.
