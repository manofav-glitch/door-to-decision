# Arrhythmias module — outline for the owner's approval

Status: DRAFT plan, 2026-10-05. Nothing here is built. Every clinical item will be drafted
`verified: false` until the owner checks it.

Sources read: the owner's notes in `notes/arrhythmias/` (SVT; Atrial Fibrillation; Bradyarrhythmias &
AV Block; Inherited Channelopathies). Cases will cite the guidelines those notes rest on, paraphrased:
ESC 2019 SVT, ACC/AHA/HRS 2015 SVT, ESC/EACTS 2024 AF, ACC/AHA 2023 AF, ACC/AHA/HRS 2018 bradycardia,
ESC 2021 pacing, AHA 2020 ACLS (bradycardia), ESC 2022 ventricular arrhythmias/SCD, plus REVERT 2015,
RACE II, INVICTUS, RAFF-2. Figures marked "project source figure / personal study copy" in the notes
are not used.

Where it lives: Cardiovascular → **Arrhythmias** (new module beside Chest Pain), case ids `arr-NN`.

---

## 1. Proposed cases (12), in two batches

Each line: story the learner sees → hidden diagnosis → the decisions → the traps.

### Batch A — tachycardias (well covered by the notes)

| # | Story | Hidden truth | Key decisions | Traps (harmful picks) |
|---|---|---|---|---|
| arr-01 | 26F, heart "switched on" while studying, HR 186 | AVNRT | 12-lead *during* tachycardia → modified Valsalva (REVERT) → adenosine 6 mg rapid proximal push + flush → 12 mg → post-conversion ECG for delta wave → ablation referral | slow adenosine in a hand vein; DC shock in a stable patient; diagnosing from the post-conversion strip |
| arr-02 | 22M, gym, "fast and irregular", broad complexes, rate ~240 | Pre-excited AF (WPW) | recognise FBI rhythm → synchronised DCCV (procainamide/ibutilide usually not on the shelf in India) → delta wave after → EP referral | adenosine, diltiazem/verapamil, beta-blocker, digoxin, IV amiodarone → VF |
| arr-03 | 68M, palpitations since this morning, known hypertension + diabetes | Acute AF with fast ventricular rate, onset clearly < 24 h | stability → find a driver → rate control (metoprolol vs diltiazem) → cardioversion window (ESC 2024: 24 h) → **CHA₂DS₂-VA calculator** → anticoagulate 4 weeks after any cardioversion | cardioverting AF of uncertain onset; amiodarone as "rate control" (it cardioverts); no OAC after DCCV |
| arr-04 | 32F, breathless, palpitations, mid-diastolic murmur | AF in rheumatic mitral stenosis, pulmonary oedema | rate control with a beta-blocker (atrial kick matters) → echo → **VKA, not a DOAC** (INVICTUS) → penicillin prophylaxis, valve referral | DOAC; diltiazem in pulmonary oedema; fluids; ignoring the murmur |
| arr-05 | 59M, regular 150, "SVT" on triage | Atrial flutter 2:1 | adenosine unmasks flutter waves (not a cure) → rate control / DCCV → anticoagulation as for AF → flutter ablation referral | treating it as AVNRT and repeating adenosine; flecainide without an AV-nodal blocker (1:1 flutter) |
| arr-06 | 64M, prior MI, regular broad-complex tachycardia, BP 112 | Monomorphic VT | when in doubt treat as VT → sync DCCV or amiodarone/procainamide → look for ischaemia, K⁺/Mg²⁺ | verapamil/adenosine for "SVT with aberrancy" |

### Batch B — bradycardias, toxins, channelopathies

| # | Story | Hidden truth | Key decisions | Traps |
|---|---|---|---|---|
| arr-07 | 74M, dizzy spells, HR 32, broad escape | Complete heart block, infranodal (Lev disease) | atropine may fail → transcutaneous pacing (pads, mA, **check a pulse for mechanical capture**, analgesia) → isoprenaline/adrenaline bridge → transvenous wire → permanent pacing regardless of symptoms | trusting electrical capture on the monitor; repeating atropine; discharge because "he feels fine now" |
| arr-08 | 70F, AF on digoxin + new verapamil, vomiting, slow *regular* pulse | Digoxin toxicity (regularised AF) with hyperkalaemia | recognise regularised AF → stop drugs → K⁺ → DigiFab (availability!) → atropine/pacing as bridge | calling it "good rate control"; giving more digoxin; pacing without fixing the potassium |
| arr-09 | 35M farmer, sweating, drooling, pinpoint pupils, HR 42 | Organophosphate poisoning | **toxicological atropine**: 1–2 mg, double every 5 min to atropinisation (dry chest, HR > 80, SBP > 80) → pralidoxime | "cardiac" 0.5–1 mg atropine and waiting; pacing; stopping atropine for tachycardia |
| arr-10 | 30M, fever, collapsed at home, type 1 coved ST in V1–V2 | Brugada unmasked by fever | ECG with **high precordial leads** → treat fever → avoid sodium-channel blockers → if VF storm: isoprenaline, not amiodarone → ICD discussion → family ECGs | flecainide; amiodarone in storm; "just a fever" discharge |
| arr-11 | 58F on azithromycin + ondansetron, vomiting, collapses with torsades | Acquired long QT, torsades | defibrillate if pulseless → **magnesium 2 g IV** → K⁺ to 4.5–5 → stop the drugs → raise the rate (isoprenaline acceptable here, or pacing) | amiodarone; procainamide; ignoring the drug list |
| arr-12 | 27F, 3 weeks postpartum, faints when the alarm rings | Congenital LQT2 | measure QT by hand → **Schwartz score calculator** → nadolol/propranolol (not metoprolol) → potassium → family screening | isoprenaline in congenital LQTS; switching to metoprolol; "it's a seizure" |

**Not proposed yet (your notes don't cover them):** VF/pulseless VT cardiac arrest (ALS), hyperkalaemia
as its own case, paediatric SVT. They can be added later from guidelines (drafted unverified with
`needs-source`) or from more notes.

## 2. Codex cards to add

- **ECG cards:** AVNRT, pre-excited AF / WPW, atrial flutter, AF, monomorphic VT, VT-vs-SVT criteria
  (Brugada, Vereckei), Mobitz I, Mobitz II, complete heart block, regularised AF, Brugada type 1 and high
  leads, long QT (how to measure), torsades.
- **Drug cards:** adenosine, metoprolol IV, esmolol, diltiazem (exists — extend), digoxin, amiodarone,
  procainamide, flecainide, magnesium sulphate, atropine (cardiac vs organophosphate), isoprenaline,
  adrenaline infusion, digoxin Fab, pralidoxime, warfarin/VKA, a DOAC card, nadolol/propranolol.
  Each with Indian availability notes from your notes (landiolol not marketed → esmolol; procainamide and
  ibutilide often unavailable; ajmaline not marketed; quinidine supply unreliable; DigiFab hard to get;
  check isoprenaline is on the crash trolley).
- **Procedure cards:** synchronised cardioversion (energies), transcutaneous pacing, modified Valsalva.
- **Score cards (calculators):** CHA₂DS₂-VA (ESC 2024), HAS-BLED, Schwartz score (LQTS).
- **Pathology cards:** AVNRT/AVRT, WPW, AF, flutter, heart block, Brugada, LQTS, organophosphate toxicity.

## 3. What the app has to learn (my work, before the cases)

1. **ECG drawer — new rhythms:** narrow regular tachycardia with pseudo-r′; delta wave; pre-excited AF
   (irregular, broad, varying beat to beat); flutter waves 2:1 and variable; monomorphic VT; Mobitz I and
   II; 2:1; complete block with a broad escape; regularised AF; torsades; Brugada type 1 with high-lead
   labels; long QT with notched T; paced beats (capture and loss of capture).
2. **A rhythm on the monitor:** the case holds a current rhythm that decisions change (e.g. adenosine →
   a pause → sinus), and the monitor close-up draws that strip live, as it already does with the numbers.
3. **Shocks and pacing as decisions:** choose sync vs unsync, energy in joules, pacing current in mA —
   graded from procedure cards, like doses are graded from drug cards.
4. **New calculators:** CHA₂DS₂-VA, HAS-BLED, Schwartz.

## 4. Things in the notes I want you to look at

- **Atropine:** the bradycardia note says the AHA 2020 bradycardia algorithm is "unchanged from 2015";
  the first dose actually changed from 0.5 mg to 1 mg in 2020 (ERC still uses 0.5 mg). I'll use 1 mg
  unless you say otherwise.
- **Adenosine sequence:** your notes use 6 → 12 → 12 mg (ACC/AHA); ESC/UK practice often uses 6 → 12 → 18 mg.
  Which do you teach?
- **Cardioversion energies for SVT/VT:** the notes give 150–200 J for AF only. I'll need your numbers for
  SVT, flutter and VT, or I'll draft them from the guidelines as unverified.
- **Trials dated 2025–2026** in the AF and channelopathy notes (CHAMPION-AF, BRAVE, the J-wave consensus,
  LEFT-BUNDLE-CRT): I can't verify these, but no proposed case depends on them.
- **Calcium in digoxin toxicity with hyperkalaemia** isn't covered in the notes — tell me your teaching.

## 5. Order of work, each step waiting for your OK

1. You approve or edit this outline (cases, order, the questions above).
2. I build the app features (§3) and show you the new ECGs.
3. Batch A cases (6), drafted unverified → you play and verify.
4. Batch B cases (6) → same.
5. Picture prompts per case, same ChatGPT workflow.
