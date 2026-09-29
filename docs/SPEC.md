You are the lead engineer on a new app. I'm an emergency medicine resident (DNB, India): I own the clinical content, you own the engineering. I'm a clinician, not a professional developer — keep the architecture simple, explain commands briefly, and ask before adding dependencies.

# 0. FIRST ACTIONS — before any app code
1. Save this entire message verbatim to docs/SPEC.md.
2. Create a concise CLAUDE.md at the repo root (≤120 lines): summary, stack, commands, folder map, the non-negotiable rules below (especially CLINICAL CONTENT RULES), and a pointer to docs/SPEC.md.
3. Plan Phase 0 and Phase 1 only: file tree, content schema draft, key components, risks, questions for me. Write no app code until I approve.

# 1. PRODUCT
- Working title: "Door to Decision".
- A minimalist, decision-based, comic-panel learning game for Emergency Medicine, organised by organ system. The learner is the ED doctor: panels tell the story → the learner decides → the patient responds (vitals, events) → a debrief explains why.
- Every case teaches four layers together: clinical decisions, pathophysiology, applied anatomy, pharmacology (drug, dose, route, contraindications) — plus validated risk scores.
- Start: Cardiovascular → Chest Pain module (HEART, TIMI, GRACE). Other systems will be added later purely by adding content files; the engine must not need changes.
- Users: EM/critical-care residents and interns, on phones (commute/breaks, often offline) and laptops (longer sessions, teaching).

# 2. PLATFORM & STACK
- One codebase: responsive, mobile-first, installable PWA that works offline after first load and feels native in a laptop browser.
- Vite + React + TypeScript (strict); Tailwind CSS with design tokens as CSS variables; hash-based routing (GitHub Pages friendly); Zod for content validation; Vitest; vite-plugin-pwa; a small persisted store (e.g., Zustand + localStorage) for progress and settings.
- Deploy to GitHub Pages via GitHub Actions.
- No backend, accounts, analytics, ads, or runtime AI/API calls. No runtime CDNs — self-host fonts.
- Fast on a low-end Android phone on slow 4G: lazy-load cases and assets; SVG/WebP only.

# 3. INFORMATION ARCHITECTURE
System (cvs) → Module (chest-pain) → Case (cp-01) → Nodes → Panels.
Codex (knowledge layer): anatomy, pathology, drugs, scores, ECG patterns, references — unlocked by cases, browsable anytime.

# 4. GAME MECHANICS
- Node types (extensible): story (panels, tap to continue) · choice (single best) · multiselect (e.g., initial investigations/treatments, with a max) · order (drag to prioritise) · calculator (learner scores HEART/TIMI/GRACE by tapping components, then sees the correct breakdown) · dose (weight-based entry with tolerance) · ecg (view ECG; answer or tap leads/territory) · ending.
- Hidden patient state: vitals (HR, SBP/DBP, RR, SpO2, GCS, temp), a case clock (minutes), hidden flags (e.g., rv_infarct). Options apply effects (vital deltas, minutes, flags, meters) and can branch on flags/state.
- Persistent monitor HUD (HR, BP, SpO2, RR, clock); abnormal values turn accent-red; subtle ECG sweep line.
- Every option is graded best / acceptable / suboptimal / harmful, with a one-line consequence and a teaching point.
- Three meters: Patient (outcome), Time (vs benchmarks such as door-to-ECG and door-to-needle/balloon — values live in content), Safety (harmful actions). End grade: 1–3 stars.
- Modes: Learn (feedback after each decision) and Exam (feedback only at debrief).
- Decisions are final within a run; after the debrief: Replay and Show ideal path.
- Critical errors trigger a consequence sequence and end the case with teaching — never shaming.
- Debrief: diagnosis reveal, decision timeline vs ideal path, key points, pitfalls, unlocked Codex cards, references.
- Setting toggle where relevant: "PCI-capable centre" vs "Non-PCI hospital" (fibrinolysis + transfer / pharmaco-invasive — common in India). Same patient, different correct pathway.
- Case titles never reveal the diagnosis — use the presentation ("58M, heavy chest, cold sweat").
- Mistakes deck: every suboptimal/harmful choice is logged with its teaching point for a later Revise mode.

# 5. VISUAL DESIGN — MINIMALIST COMIC
- Ink on paper: off-white paper, near-black ink, ONE accent (clinical red) reserved for danger/alarms, greys for everything else. Full dark mode (night shifts). Respect prefers-reduced-motion.
- Comic grammar: square panels, bold borders, clean gutters; caption boxes (time/place); speech bubbles with tails; sparing SFX lettering (e.g., monitor alarm).
- Art is code-drawn SVG line art only — no AI-generated, stock or copyrighted images. Build a small reusable library: minimalist characters (patient, doctor, nurse, relative; expression via eyebrows/mouth only) and scenes/props (triage desk, resus bay, trolley, monitor, ECG machine, cath-lab door, ambulance bay), one consistent stroke width. Panels compose scenes from data (e.g., scene: resus-bay, actors: [patient-supine, nurse]).
- Phone: vertical panel flow, one beat at a time, choices in a thumb-reach bottom sheet. Laptop: 2–3 panels per row with choices beside them; keys 1–6 choose, Space/Enter continue.
- Type: one clean UI font + one hand-lettered bubble font, both self-hosted; ≥16px body text on phones.
- ECG viewer: images from content with pinch-zoom and a 12-lead hotspot overlay. Later phase: a stylised synthetic 12-lead renderer driven by parameters (rate, rhythm, per-lead ST/T changes).
- Accessibility: WCAG AA contrast, ≥44px tap targets, full keyboard play, alt text for every panel.

# 6. SCREENS
Home (system grid; CVS active, others "coming soon") → System → Module → Case list (stars, difficulty, minutes; no spoilers) → Setting + mode picker → Case player → Debrief → Codex (Anatomy | Pathology | Drugs | Scores | ECG; searchable; scores usable as standalone calculators) → Settings/About (theme, text size, reduce motion, show draft cases, reset progress, content version, disclaimer).
Disclaimer on first launch and in About: "For education only. Not a clinical decision tool. Verify with current guidelines and local protocols."

# 7. CONTENT ARCHITECTURE — the engine is content-agnostic
- All case and Codex content lives in /content as YAML (human-editable, comments allowed), compiled and Zod-validated at build time; invalid content fails the build.
- Suggested layout:
    content/systems.yaml, references.yaml, benchmarks.yaml
    content/cvs/chest-pain/module.yaml
    content/cvs/chest-pain/cases/cp-01.yaml ...
    content/codex/{anatomy,pathology,drugs,scores,ecg}/*.yaml
    content/assets/ecg/*
- Example case shape (refine in your plan; it must stay readable for a non-programmer):
    id: cvs-cp-01
    title: "58M, heavy chest, cold sweat"
    settings: [pci-capable, non-pci]
    patient: { age: 58, sex: M, weightKg: 70 }
    initial:
      vitals: { hr: 52, sbp: 96, dbp: 60, rr: 20, spo2: 95 }
      flags: [rv_infarct]
    start: triage
    nodes:
      triage:
        type: story
        panels:
          - scene: triage-desk
            caption: "02:10 · Triage"
            bubbles: [{ who: patient, text: "It feels like a weight on my chest." }]
        next: first-move
      first-move:
        type: choice
        prompt: "Your first move?"
        options:
          - { label: "12-lead ECG now", grade: best, effects: { minutes: 3 }, next: ecg-1 }
          - { label: "Sublingual nitrate", grade: harmful, effects: { minutes: 2, sbp: -25, safety: -1 }, next: hypotension }
    debrief: { diagnosis: "...", keyPoints: [...], unlocks: [...], refs: [...] }

# 8. CLINICAL CONTENT RULES — NON-NEGOTIABLE
- Clinical facts (doses, thresholds, score point tables, time targets, contraindications) live ONLY in /content, never hard-coded in components.
- Every clinical item carries: source (guideline/paper + year), verified: true|false, reviewedOn.
- You may DRAFT clinical content, always with verified: false. Only I set verified: true.
- Unverified items show an "UNVERIFIED" badge. Release builds hide any case containing unverified items unless "Show draft cases" is on in Settings.
- npm run review → docs/CLINICAL_REVIEW.md: checklist of every unverified clinical value (file, field, value, source) for me to verify.
- MI terminology follows the Fifth Universal Definition of MI (ESC/ACC/AHA/WHF, August 2026): primary / secondary / procedure-related MI; sex-specific troponin 99th-percentile limits; MINOCA = "myocardial injury with non-obstructive coronary arteries". Do NOT use the 2018 Type 1–5 classification. If unsure of details, leave a TODO with verified: false.
- Never copy text or images from textbooks, UpToDate, LITFL, guidelines or journals; paraphrase and cite.
- Reflect Indian drug availability where relevant (e.g., both tenecteplase and streptokinase have drug cards).

# 9. RISK SCORES
- Pure, fully unit-tested TypeScript functions in src/clinical/, with point tables in content/codex/scores/:
    HEART (Six 2008; validation Backus 2010/2013): History, ECG, Age, Risk factors, Troponin → 0–10, low/moderate/high bands.
    TIMI for UA/NSTEMI (Antman 2000): 7 binary items → 14-day risk. (TIMI for STEMI is a different score — later.)
    GRACE: the in-hospital mortality point score (Granger 2003), labelled exactly that. Do NOT mix it with the 6-month post-discharge score, the admission-to-6-month score, or GRACE 2.0.
- ≥6 test vectors per score, including band boundaries. Calculator UI shows points per item and the band with its source.

# 10. AUTHORING & DEV TOOLS
- npm run validate: schema, broken `next` links, unreachable nodes, dead ends (every path must reach an ending), missing unlock/reference IDs, missing assets.
- npm run graph: a Mermaid flowchart per case in docs/graphs/ so I can see the branching.
- npm run review: see section 8.
- Dev mode (?dev=1): node IDs, jump-to-node, live state inspector.
- A project skill /new-case that scaffolds a case from a template, then runs validate and graph.
- docs/CONTENT_GUIDE.md: how I write a case, in plain language, with the template.

# 11. PHASES — one at a time: plan → my OK → build → test → commit
- Phase 0 — Scaffold + deploy: setup, lint/format/test, light/dark tokens, routing, placeholder screens, PWA (manifest, icons, offline), GitHub Actions → Pages. Done = installable on my phone from the live URL and opens offline.
- Phase 1 — Engine + vertical slice: content compiler + schemas; engine as pure TS (state, effects, conditions, navigation) with tests; case player (panels, bubbles, choice sheet, HUD); debrief; progress saving; ONE complete case (cp-01 below), drafted with verified: false. Done = I can play cp-01 through every branch on phone and laptop.
- Phase 2 — Scores + Codex: HEART/TIMI/GRACE + tests, calculator node, Codex screens and cards.
- Phase 3 — Comic art system: SVG character/scene library, panel layouts and transitions, ECG viewer with hotspots.
- Phase 4 — Authoring tools: validate, graph, review, dev mode, /new-case, CONTENT_GUIDE.md.
- Phase 5 — Chest-pain module: cases below, Learn/Exam modes, stars, mistakes deck + Revise mode.
- Phase 6 — Polish: accessibility audit, mobile Lighthouse ≥90, low-end Android check, presenter mode for teaching (large text, reveal-on-click).

# 12. FIRST CASE (cp-01) — draft all clinical specifics with verified: false
58M, diabetic smoker, 45 min retrosternal heaviness with diaphoresis; HR 52, BP 96/60, SpO2 95%. Hidden truth: inferior STEMI with RV involvement (proximal RCA).
Beats: triage → first move (ECG within 10 min vs distractors, incl. the nitrate trap) → ECG: inferior ST elevation with reciprocal change → identify territory/culprit artery → right-sided leads (V4R) → initial treatment multiselect (antiplatelets, anticoagulant, oxygen only if hypoxic, cautious fluid for hypotension; nitrates and IV beta-blocker harmful here) → weight-based dose node → reperfusion by setting (primary PCI vs fibrinolysis + transfer, with contraindication checklist) → bradycardia/AV-block complication branch → ending → debrief.
Unlocks: RCA territory & coronary dominance, RV infarction physiology, MI classification (5th UDMI), nitrate contraindications, antiplatelet/anticoagulant/fibrinolytic cards.

# 13. CHEST-PAIN CASES TO FOLLOW
Low-risk chest pain → HEART + serial hs-troponin → safe discharge · NSTE-ACS → TIMI + GRACE → timing of invasive strategy · Anterior STEMI (proximal LAD) with cardiogenic-shock branch · Aortic dissection mimicking inferior STEMI (antithrombotic/lysis trap) · STEMI at a non-PCI hospital → lysis → failed reperfusion → rescue PCI · PE presenting as chest pain · High-risk ECG patterns (posterior MI, de Winter, Wellens) · Pericarditis vs STEMI; tamponade · Young woman with SCAD (primary MI) · Troponin-positive but not ACS (AF with RVR / sepsis) → myocardial injury vs secondary MI.

# 14. WORKING RULES FOR YOU
- One phase at a time; begin each with a short plan and wait for my OK.
- Small commits with clear messages after each working step.
- Before saying "done": run lint, tests, validate and a production build; if you have a browser/preview tool, play the changed screens at 360 px and 1440 px widths; then tell me exactly how to test (commands + what to tap).
- Ask before adding any dependency; prefer fewer.
- Keep CLAUDE.md current when structure or conventions change.
- If a clinical fact is uncertain, leave a TODO with verified: false — never guess silently.
