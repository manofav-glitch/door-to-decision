# Heart Failure module — outline for the owner's approval

Status: DRAFT plan v2, 2026-10-13, rebuilt on the owner's note. Nothing is built until the owner approves
(one phase at a time).

Sources read: the owner's note `notes/hf.pdf` (Heart Failure, built on the 2026 ESC heart failure
guideline, the 2026 Universal Definition, 2022 AHA/ACC/HFSA, and the trials DOSE-AHF, ADVOR, CLOROTIC,
CARRESS-HF, STRONG-HF, 3CPO, DAPA-HF, EMPEROR, PARADIGM-HF, IABP-SHOCK II, ECLS-SHOCK, DanGer Shock,
INVICTUS) and the SCAPE section of `notes/htn.pdf` (hypertensive emergencies). The 2026 ESC guideline
appeared after Claude's training data, so its content comes from the owner's note and must be checked
by the owner; the full citation goes in references.yaml with a todo. Figures marked "personal study
copy" (Tintinalli) are not used. Everything drafted `verified: false`.

Where it lives: Cardiovascular → **Heart Failure** (third module), case ids `hf-NN`.

## 0. Ground rules taken from the note

- ESC 2026 language: **HFrEF = LVEF under 50%, HFpEF = 50% or more** (HFmrEF abolished);
  **"decompensated HF"** for the acute presentation.
- Every case starts with two questions: **warm or cold** (perfusion) and **wet or dry** (congestion),
  and a hunt for the trigger (**CHAMPIT**: ACS, Hypertensive emergency, Arrhythmia, Mechanical cause,
  PE, Infection, Tamponade).
- Decongestion algorithm: furosemide 20–40 mg IV if diuretic-naive, or 1–2.5 × the home oral daily dose;
  at 2 hours spot urine sodium under 50–70 mmol/L, or urine output under 100–150 ml/h over 6 hours, means
  double the dose; then acetazolamide 500 mg IV (ADVOR), a thiazide, or a higher-dose MRA. A creatinine rise
  with improving congestion and good perfusion is not a reason to stop. The endpoint is euvolaemia.
- Before discharge: the four pillars (ARNI/ACE-I/ARB, beta-blocker, MRA, SGLT2 inhibitor), started early
  and up-titrated fast (STRONG-HF), review in 1–2 weeks.
- India layer from the note: patients a decade younger, ischaemic in 72%, only about half on full
  treatment; rheumatic valve disease, peripartum cardiomyopathy, anaemia, thyrotoxicosis, TB constriction
  and cor pulmonale also present as "heart failure", so echo before reflex drugs.

## 1. Proposed cases (10), in two batches

### Batch A — the decompensated patient

| # | Story | Hidden truth | Key decisions | Traps (harmful picks) |
|---|---|---|---|---|
| hf-01 | 66M, woke up drowning, BP 210/120, sats 82% | SCAPE: hypertensive flash pulmonary oedema (warm–wet, redistribution) | sit up → CPAP/NIV straight away → **high-dose nitrate**: 400–800 mcg sublingual every 3–5 min, infusion from about 100 mcg/min escalated fast → furosemide only for real overload → wean the nitrate as BP falls | morphine; a big furosemide dose as the main treatment; delaying NIV for an ABG; starting a beta-blocker |
| hf-02 | 74F, known HFrEF on furosemide 40 mg, a week of swelling after an NSAID for her knee | Warm–wet decompensation | IV furosemide 1–2.5 × home dose → **urine sodium at 2 h** is low → double the dose → add **acetazolamide** → creatinine rises while she improves: carry on → keep her beta-blocker | stopping the beta-blocker and pillars by reflex; stopping diuresis for the creatinine; sending her home because she "feels better" |
| hf-03 | 58M, dilated cardiomyopathy, cold, confused, BP 82/60, lactate 5, wet lungs | Cold–wet: cardiogenic shock without ACS | recognise hypoperfusion (not just hypotension) → **dobutamine** for output, **noradrenaline** for pressure → cautious diuresis once perfused → early call to a shock team / transfer | nitrate; big fluid bolus with wet lungs; adrenaline first; an inotrope for a warm patient |
| hf-04 | 81F, breathless and confused for 3 days, AF at 130, crackles; also COPD | HFpEF decompensated by AF (an "is it really HF?" case) | NT-proBNP with **age-adjusted** cut-offs (and AF raises it) → **lung ultrasound** B-lines → rate control (beta-blocker; not diltiazem if EF is low) → diuresis → anticoagulation by CHA₂DS₂-VA | treating it as COPD with nebulisers alone; diltiazem before knowing the EF; ruling HF out on a clear chest X-ray |
| hf-05 | 45M, two days after an inferior MI, sudden breathlessness, a new loud murmur | Acute mitral regurgitation from papillary muscle rupture (the M in CHAMPIT) | bedside echo → NIV, afterload reduction if BP allows → **balloon pump as a bridge** → emergency surgery | diuretic alone; missing the murmur; calling it "flash oedema" and sending him to the ward |

### Batch B — special hearts and the way home

| # | Story | Hidden truth | Key decisions | Traps |
|---|---|---|---|---|
| hf-06 | 29F, 3 weeks after delivery, breathless lying flat, swollen legs | Peripartum cardiomyopathy (LVEF 30%) | exclude PE and pre-eclampsia → echo → postpartum treatment (beta-1-selective blocker, ACE-I compatible with breastfeeding, diuretic) → anticoagulate at LVEF under 30% → bromocriptine only with anticoagulation (contested) → counselling on future pregnancy | "postpartum anaemia/anxiety"; an ARNI/MRA/SGLT2 inhibitor if still pregnant (contraindicated: in pregnancy hydralazine–nitrate) |
| hf-07 | 79M, breathless and two faints on the stairs, slow-rising pulse, ejection systolic murmur | Severe aortic stenosis with heart failure | careful diuresis → **nitrate only cautiously** (abrupt afterload fall can collapse him) → valve team: TAVI or surgery | standard SCAPE-dose nitrate; ignoring the faints; big fluid boluses |
| hf-08 | 60M, chronic lung disease, swollen legs and belly, raised JVP, clear lung fields | Right heart failure (cor pulmonale / pulmonary hypertension) | **principles invert**: preload kept cautiously, correct hypoxia, hypercapnia and acidosis, noradrenaline early to protect coronary perfusion, inodilator only with a pressor | aggressive diuresis and nitrates (collapse); intubating carelessly; treating it as liver disease |
| hf-09 | 70M, HFrEF on ramipril, spironolactone and dapagliflozin, weak, potassium 6.4, creatinine up | Hyperkalaemia on heart failure medicines | treat the potassium (as in arr-14) → **stop the MRA above 5.5**, keep the rest → potassium binder where available → restart plan; CKD is not a reason to withhold the pillars | stopping every HF drug for good; insulin without glucose |
| hf-10 | 62M, day 4 on the ward after decompensated HFrEF, wants to go home | Discharge: residual congestion and the four pillars | check for **residual congestion** (JVP, B-lines, oedema) → start/increase all four pillars before discharge (generic ACE-I + MRA + SGLT2 inhibitor if an ARNI is unaffordable) → daily weights → **review within 1–2 weeks** (STRONG-HF) | discharge on diuretics alone; adding one drug per month; discharging on weight loss alone |

## 2. Optional extras, not in the note (drafted from guidelines if wanted)

- **Wet beriberi** (high-output failure from thiamine deficiency; IV thiamine) — common in India.
- **Fulminant myocarditis** (young, troponin, VT; early transfer for mechanical support) — the note
  mentions it only under ECMO.
- **Cardiac amyloidosis** (HFpEF with thick walls and low voltages; beta-blocker, digoxin and diltiazem
  poorly tolerated) — in the note; more of a diagnosis case than an ED one.

## 3. Questions for the owner

1. Approve these 10 cases (or change them)?
2. Add any of the three extras?
3. Follow the 2026 ESC heart failure guideline as summarised in your note (HFrEF under 50%), with the
   other European rules as before?
4. Your hypertension note: shall I keep it for a separate **Hypertensive emergencies** module later
   (dissection, stroke/ICH, pre-eclampsia, malignant hypertension)? For now only its SCAPE section is used.
