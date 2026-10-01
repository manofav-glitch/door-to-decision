# Door to Decision

Decision-based comic-panel EM learning game by organ system: panels → learner decides → patient responds → debrief.
Cases teach decisions, pathophysiology, anatomy, pharmacology and risk scores. First module: Cardiovascular → Chest Pain.

**Full spec: `docs/SPEC.md` (the owner's original brief, verbatim). Read the relevant section before working.**

## Who's who
- Owner: EM resident (DNB, India). Owns ALL clinical content. Clinician, not a developer.
- Claude: lead engineer. Keep architecture simple, explain commands briefly, ask before adding dependencies.
  Separate from the Expo app in `~/Desktop/EM app` — do not touch that repo.

## Stack
Vite + React + TS (strict) · Tailwind (tokens as CSS vars) · hash routing · Zod · Vitest · vite-plugin-pwa · Zustand +
localStorage · YAML content compiled at build time · GitHub Actions → GitHub Pages.
No backend, accounts, analytics, ads, runtime AI/API calls, or runtime CDNs. Fonts self-hosted. SVG/WebP only.

## Commands
- `npm run dev` — local dev server (`-- --port 5180 --strictPort` to pin the port)
- `npm run preview` — serve the production build (after `npm run build`); this is how to test the PWA/offline
- `npm run build` — production build (fails on invalid content)
- `npm run lint` / `npm run format` / `npm test`
- `npm run validate` — content checks with file:line: schema, broken `next`, unreachable nodes, dead ends, unset flags, missing refs/unlocks/doses/assets
- `npm run review` — checklist of every unverified clinical item → `docs/CLINICAL_REVIEW.md` (regenerate after content edits)
- `npm run ecg` — redraw ECG SVGs from `content/assets/ecg/*.ecg.yaml`
- `npm run art` — owner's illustrations `content/assets/art/<folder>/*.png` (git-ignored) → WebP ≤ 800 px, shape kept, in `content/assets/panels/` (committed); runs before dev/build, skips up-to-date ones
- `npm run graph` — Mermaid flowchart per case → `docs/graphs/<id>.md` (bold = ideal path, red dashed = harmful)
- `npm run new-case -- <system> <module> <name> "<title>"` — scaffold from `docs/templates/case.yaml`, list in module.yaml, validate + graph (Claude skill: `/new-case`)
- Dev mode: `?dev=1` (before or after the `#`; `?dev=0` off; kept per tab in sessionStorage): step ids, jump-to-step (run then stops saving), state inspector. Works on the live site.

## Folder map (update when it changes)
- `docs/` — SPEC.md, CONTENT_GUIDE.md (owner's plain-language authoring guide — keep in sync with the schema), CLINICAL_REVIEW.md + graphs/ (generated), templates/case.yaml
- `content/` — ALL clinical content as YAML: `systems.yaml`, `references.yaml` (incl. `needs-source` placeholder),
  `benchmarks.yaml` (time targets, HUD vital limits), `cvs/chest-pain/{module.yaml,cases/cp-NN.yaml}`,
  `codex/{anatomy,pathology,drugs,scores,ecg}/*.yaml` (id = file name), `assets/ecg/*.ecg.yaml` → `*.svg`,
  `assets/art/credits.yaml` (required for every art folder) + originals, `assets/panels/<folder>/*.webp`
- `src/content/` — `schema.ts` (Zod: the authoring format), `compile.ts` (YAML → validated JSON, cross-checks),
  `vite-plugin.ts` (virtual modules; each case and the codex are lazy chunks), `client.ts` (browser loaders/hooks), `types.ts`
- `src/engine/` — pure TS: `engine.ts` (state, effects, conditions, branching, grading, stars, ideal path, replay), `dose.ts`. No React, no clinical facts.
- `src/screens/` — Home (+ Revise banner), System, Module (case list), CaseSetup (setting + mode, resume), Player, Debrief, Revise (mistakes deck), Codex (tabs + search), CodexCard (with standalone calculator for scores), Settings
- `src/components/` — Layout, Disclaimer, ThemeSync, ui.tsx (badges, chips, stars), ScoreParts.tsx (CalcForm, ScoreBreakdown, ScoreCalculator), `player/` (Hud, PanelView, EcgFigure with zoom view + lead hotspots, Sheet incl. LeadGrid)
- `src/store/` — `settings.ts`, `progress.ts` (v2; runs saved as inputs and replayed; stars, unlocks, mistakes deck + Revise streaks: a card leaves after 2 correct in a row)
- `src/clinical/score.ts` — generic additive-score arithmetic (items: choice / yesno / number-with-bins; bands; riskTable). Point tables live in `content/codex/scores/*.yaml` (heart, timi-ua-nstemi, grace-in-hospital); vectors in `score.test.ts`
- `src/art/` — code-drawn SVG line art: `registry.ts` (scene/actor/mood names; actors in YAML as `patient:pain`), `cast.tsx` (7 busts incl. patient on trolley; moods via brows + mouth), `scenes.tsx` (10 scenes + actor placement; monitor shows live vitals), `PanelArt.tsx`, `ecgLayout.ts` (12-lead geometry shared by draw script, compiler and lead hotspots). Dev-only art sheet at `#/dev/art`
- `scripts/` — validate.ts (errors + style warnings), review.ts, graph.ts, new-case.ts, draw-ecg.ts, art.ts (sharp) (run by Node's built-in TS support), make-icons.mjs; logic lives in `src/content/{compile,graph,scaffold}.ts`
- `src/lib/offline.ts` — illustration caching (cache `d2d-art`, shared with the SW runtime route in vite.config.ts): case prefetch while playing, "Save pictures" on CaseSetup, "Save all cases" in Settings
- `.claude/skills/new-case/` — the /new-case project skill
- `test/` — `cases.test.ts` plays every real case (ideal path = 3 stars; 400 random runs must visit every node); `calculator.test.ts`, `leads.test.ts`, `authoring.test.ts` (graph, scaffold, warnings); `fixtures/mini/` for compiler/engine tests; art tests in `src/art/art.test.tsx`
- `.github/workflows/deploy.yml` — lint+test+build on every push/PR; deploys `main` to Pages (`BASE_PATH=/<repo>/`)

## Architecture rules
- The engine is content-agnostic: new systems/modules/cases are added by adding content files only.
- Hierarchy: System → Module → Case → Nodes → Panels. Codex (anatomy, pathology, drugs, scores, ECG) is unlocked by cases and browsable anytime.
- Node types built: story, choice, ecg, ecg-leads (tap the leads), multiselect, dose, calculator, ending. Planned: order. Add a type = schema + engine `act`/`idealInput` + a Sheet view.
- Options are graded best / acceptable / suboptimal / harmful, with a one-line consequence and a teaching point.
- Hidden patient state: vitals, case clock, flags. Meters: Patient, Time, Safety. End grade 1–3 stars. Modes: Learn / Exam / Present
  (presenter: `data-present` on <html> scales rem to 137.5%; panels one click at a time; answers locked in, then Reveal shows
  every option's grade; the HUD waits for Reveal; F = full screen; present runs don't touch stars, unlocks or the mistakes deck).
- Case titles never reveal the diagnosis. Setting toggle (PCI-capable vs non-PCI) changes the correct pathway.
- Harmful picks count as safety events automatically. Stars: 3, −1 for any harmful pick, −1 for a missed time target or Patient < 70; critical ending = 1. These game rules live in the engine, not content.
- A case is a draft if ANY check it depends on is unverified (its own, doses it asks, scores it uses, time targets, HUD limits, ECG drawings).
- Calculator grading: every item's points right = best; same band (or risk row) = acceptable; different band = suboptimal. Number-item bins: a value on an edge goes to the higher bin (`value < below`).
- Codex: every card is always browsable; cards unlocked by cases get a "✓ Unlocked" mark.
- Style warnings (non-blocking, in compile.ts): spoiler words in titles, choice/ecg with no best option, consequence/teaching > 220 chars.
- When the schema changes, update docs/CONTENT_GUIDE.md and docs/templates/case.yaml in the same commit.
- Lead-tap grading: exact set = best; ≥ half found and ≤ 1 extra = acceptable; else suboptimal.
- Accessibility: axe (WCAG 2.1 A/AA) clean on every screen in both themes (checked 2026-09-30); `test/a11y.test.ts` guards token
  contrast and text alternatives. Tap targets ≥ 44 px (checkbox rows are whole-row labels). Heavy screens are React.lazy chunks;
  fonts are woff2-only @font-face in index.css. Install (precache) ≈ 435 KB compressed; .webp illustrations are NOT precached.
- Art: ONE stroke width via `.art` (non-scaling); props grey, people ink, red only for alarms. Panels are ≥ square and grow downwards (grid + aspect spacer); grids use `minmax(0,1fr)` so long bubble text can't widen them.

## CLINICAL CONTENT RULES — NON-NEGOTIABLE
1. Clinical facts (doses, thresholds, score point tables, time targets, contraindications) live ONLY in `/content`. Never hard-code them in components, engine, or tests' expected clinical values outside score test vectors.
2. Every clinical item carries `source` (guideline/paper + year), `verified: true|false`, `reviewedOn`.
3. Claude may DRAFT clinical content, always `verified: false`. **Only the owner sets `verified: true`.** Never flip it.
4. Unverified items show an "UNVERIFIED" badge. Release builds hide any case containing unverified items unless Settings → "Show draft cases" is on.
5. If a clinical fact is uncertain: leave a `TODO` with `verified: false`. Never guess silently.
6. MI terminology: Fifth Universal Definition of MI (per owner's brief) — primary / secondary / procedure-related MI; sex-specific troponin 99th-percentile limits; MINOCA = "myocardial injury with non-obstructive coronary arteries". Do NOT use the 2018 Type 1–5 classification.
7. Never copy text or images from textbooks, UpToDate, LITFL, guidelines or journals — paraphrase and cite.
8. Reflect Indian drug availability (e.g. both tenecteplase and streptokinase get drug cards).
9. Scores: HEART (Six 2008; Backus 2010/2013); TIMI for UA/NSTEMI (Antman 2000); GRACE = in-hospital mortality point score (Granger 2003), labelled exactly that — never mix with the 6-month or GRACE 2.0 scores. ≥6 test vectors per score incl. band boundaries.
10. Disclaimer (first launch + About): "For education only. Not a clinical decision tool. Verify with current guidelines and local protocols."

## Design rules
- Ink on paper: off-white paper, near-black ink, ONE accent (clinical red) reserved for danger/alarms, greys otherwise. Full dark mode. Respect `prefers-reduced-motion`.
- Art: code-drawn SVG, one stroke width. Owner's decision 2026-10-01 (overrides SPEC): panels may use the owner's AI illustrations
  (`art:`; bubbles below; tails follow `actors` left→right; line art = fallback). No text in pictures; ECGs/monitors stay code.
- Phone: vertical panel flow, choices in a thumb-reach bottom sheet. Laptop: 2–3 panels per row; keys 1–6 choose, Space/Enter continue.
- Type: one UI font + one hand-lettered bubble font, self-hosted; ≥16px body on phones.
- Accessibility: WCAG AA, ≥44px tap targets, full keyboard play, alt text on every panel.
- Performance: fast on low-end Android over slow 4G; lazy-load cases and assets.

## Working rules
- One phase at a time (0 Scaffold+deploy → 1 Engine+slice → 2 Scores+Codex → 3 Art → 4 Authoring tools → 5 Chest-pain module → 6 Polish). Start each with a short plan; wait for the owner's OK.
- Small commits with clear messages after each working step.
- Before saying "done": lint, tests, validate, production build; play changed screens at 360 px and 1440 px; then give exact test steps (commands + what to tap).
- Ask before adding any dependency; prefer fewer.
- Keep this file current when structure or conventions change.

## Conventions / gotchas
- Tailwind v4: custom CSS must live in `@layer base/components`; unlayered CSS beats utilities (broke `bg-ink` once).
- Tokens are CSS variables in `src/index.css`; theme/text-size/reduce-motion are `data-*` attributes on `<html>` set by `ThemeSync`.
- `showDrafts` defaults to ON in dev builds, OFF in deployed builds (persisted per device).
- Vite `base` comes from env `BASE_PATH` (set by the deploy workflow). Hash routing means no server rewrites needed.
- Fonts: Inter (UI) + Patrick Hand (bubbles), Latin subset only, via `@fontsource`, bundled and precached.
- Claude's preview tool can't launch this project from the Expo session; run Vite directly and open http://localhost:5180 (or the owner's `npm run dev` on 5173).
- In-app browser: screenshots can be stale under viewport emulation (confirm with DOM checks); clicks miss when a large viewport
  is scaled down (use the keyboard or 360 px); it can't register service workers, so check offline on a real phone.
- `src/content/*` and `src/engine/*` import siblings with `.ts` extensions so Node can run them directly (scripts, tests).
- YAML anchors (`&name` / `*name`) are used in cp-01 to reuse conditional `next:` lists.

## Status
- Live at https://manofav-glitch.github.io/door-to-decision/ (public repo github.com/manofav-glitch/door-to-decision; Pages via
  GitHub Actions). Owner's token is in the Mac keychain, so `git push` works.
- Phases 0–6 done 2026-09-29…30 (PageSpeed mobile 98/100/100/100). Pending: owner's low-end Android check (incl. ECG pinch-zoom).
- Verification: at the owner's explicit instruction (over a recommendation to keep open TODOs unverified) all 202 items in
  cp-01…11 were marked verified 2026-09-30. Old TODO notes kept; `npm run review` lists them (incl. cp-10/11 Fifth UDMI
  wording) plus `needs-source` items. New content is still drafted verified: false.
- Illustrations 2026-10-01: pipeline + offline saving built. The owner only has ChatGPT sheets (no full-size files): Claude cuts
  them (cp-01 square ~300 px; cp-02…06 wide ~490–620 px); `npm run art` enlarges ≤2× + sharpens. Next: cp-07…11.
