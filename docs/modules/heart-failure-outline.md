# Heart Failure module — outline for the owner's approval

Status: DRAFT plan, 2026-10-13. Nothing is built until the owner approves (one phase at a time).

Sources: no owner notes for this topic yet (`notes/heart-failure/` doesn't exist). Unless the owner sends
notes, cases are drafted from the European guidelines, as for Arrhythmias: ESC 2021 heart failure
guidelines with the 2023 focused update, the ESC/HFA position papers on acute HF and peripartum
cardiomyopathy, ESC 2018 pregnancy guidelines, ESC 2021 valvular, and the trials behind them (e.g.
3CPO for non-invasive ventilation, ADVOR for adding acetazolamide, STRONG-HF for fast up-titration). Everything drafted
`verified: false`.

Where it lives: Cardiovascular → **Heart Failure** (third module beside Chest Pain and Arrhythmias),
case ids `hf-NN`. Reuses the engine as is; likely new Codex cards (furosemide, GTN infusion, CPAP/NIV,
sacubitril–valsartan, SGLT2 inhibitors, spironolactone, bromocriptine, thiamine, dobutamine exists).

## 1. Proposed cases (10), in two batches

Each line: story the learner sees → hidden truth → the decisions → the traps (harmful picks).

### Batch A — acute heart failure in the ED

| # | Story | Hidden truth | Key decisions | Traps |
|---|---|---|---|---|
| hf-01 | 66M, woke up drowning, BP 210/120, sats 82% | Hypertensive acute pulmonary oedema (flash) | sit up, oxygen → CPAP/NIV early → high-dose IV nitrate (bolus then infusion) → IV furosemide → find the trigger | large fluid bolus; routine morphine; delaying NIV for an ABG; furosemide alone with no nitrate |
| hf-02 | 74F, known HFrEF, legs and belly swelling for a week, BP 128/76 | Decompensated chronic HFrEF, "warm and wet", NSAID + salt trigger | IV furosemide at 1–2.5× her oral dose → check response (urine sodium at 2 h, urine output) → double or add a second diuretic → keep beta-blocker and the other pillars | stopping the beta-blocker by reflex; panicking at a small creatinine rise; under-dosing furosemide |
| hf-03 | 58M, dilated cardiomyopathy, cold, confused, BP 78/50, lactate 5 | Cardiogenic shock without ACS ("cold and wet") | recognise hypoperfusion → noradrenaline for pressure, dobutamine for output → cautious diuresis → early specialist / mechanical support discussion | nitrates; big fluid boluses with wet lungs; beta-blocker for the tachycardia |
| hf-04 | 45M, two days after an inferior MI, sudden breathlessness, new loud murmur | Acute mitral regurgitation from papillary muscle rupture | bedside echo → afterload reduction (nitrate if BP allows), NIV → emergency surgery referral | calling it "just pulmonary oedema" and giving only diuretics; missing the murmur |
| hf-05 | 29F, 3 weeks after delivery, breathless lying flat, swollen legs | Peripartum cardiomyopathy | echo (low EF) → standard acute HF treatment adjusted for breastfeeding → consider bromocriptine (with anticoagulation) → counselling about future pregnancy | "postpartum anaemia/anxiety"; ACE inhibitor choice while breastfeeding (enalapril is preferred); missing a PE |

### Batch B — causes, mimics and the way home

| # | Story | Hidden truth | Key decisions | Traps |
|---|---|---|---|---|
| hf-06 | 40M, heavy drinker, poor diet, breathless, warm hands, bounding pulse | Wet beriberi: high-output failure from thiamine deficiency | recognise high output → **IV thiamine** → dramatic response | diuretics alone; glucose before thiamine; vasopressors |
| hf-07 | 79M, breathless on exertion and fainting, ejection systolic murmur | Severe aortic stenosis with heart failure | careful diuresis → **avoid vasodilators and big nitrate doses** → valve referral (TAVI or surgery) | GTN infusion → hypotension; ignoring the syncope |
| hf-08 | 24M, flu-like illness a week ago, breathless, troponin high, VT runs | Acute myocarditis (fulminant course) | ECG, troponin, echo → treat arrhythmias and shock → early transfer to a centre with mechanical support → no NSAIDs, avoid exercise for months | labelling it ACS and giving lytic; discharging a 'young fit' patient |
| hf-09 | 70F, HFpEF, AF, kidney disease, potassium 6.4 on spironolactone + ramipril | Hyperkalaemia on HF medicines | treat the potassium → pause the MRA, not everything → restart plan, and potassium binders where available | stopping all HF drugs for good; missing the ECG |
| hf-10 | 62M, admitted with HFrEF, now euvolaemic, going home | Discharge and the four pillars | start/up-titrate: ACE inhibitor/ARNI, beta-blocker, MRA, SGLT2 inhibitor (STRONG-HF: fast up-titration) → daily weights, salt and fluid advice, early review within 1–2 weeks | discharging on diuretics alone; waiting months to add each drug; NSAIDs |

## 2. Questions for the owner

1. Do you have notes on heart failure? If so, put them in `notes/heart-failure/` and I'll use them as I did for Arrhythmias.
2. European guidelines throughout (ESC 2021 + 2023 update), as for Arrhythmias?
3. Are these 10 cases right? Anything to add (e.g. HFpEF exacerbation, right heart failure/cor pulmonale, thyrotoxic HF, anaemia, rheumatic heart disease in pregnancy) or drop?
