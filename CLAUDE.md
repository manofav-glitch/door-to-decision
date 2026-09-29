# Door to Decision

Minimalist, decision-based, comic-panel learning game for Emergency Medicine, organised by organ system.
The learner is the ED doctor: panels tell the story → learner decides → patient responds (vitals, events) →
debrief explains why. Each case teaches clinical decisions, pathophysiology, applied anatomy, pharmacology and
validated risk scores. First module: Cardiovascular → Chest Pain (HEART, TIMI, GRACE).

**Full spec: `docs/SPEC.md` (the owner's original brief, verbatim). Read the relevant section before working.**

## Who's who
- Owner: EM resident (DNB, India). Owns ALL clinical content. Clinician, not a developer.
- Claude: lead engineer. Keep architecture simple, explain commands briefly, ask before adding dependencies.
- Separate from the Expo app in `~/Desktop/EM app` — do not touch that repo.

## Stack
Vite + React + TypeScript (strict) · Tailwind CSS (tokens as CSS variables) · hash routing (GitHub Pages) ·
Zod (content validation) · Vitest · vite-plugin-pwa · Zustand + localStorage (progress, settings) ·
YAML content compiled at build time · GitHub Actions → GitHub Pages.
No backend, accounts, analytics, ads, runtime AI/API calls, or runtime CDNs. Fonts self-hosted. SVG/WebP only.

## Commands
- `npm run dev` — local dev server (`-- --port 5180 --strictPort` to pin the port)
- `npm run preview` — serve the production build (after `npm run build`); this is how to test the PWA/offline
- `npm run build` — production build (fails on invalid content)
- `npm run lint` / `npm run format` / `npm test`
- `npm run validate` — (Phase 4) content checks: schema, broken `next`, unreachable nodes, dead ends, missing IDs/assets
- `npm run graph` — (Phase 4) Mermaid flowchart per case → `docs/graphs/`
- `npm run review` — (Phase 4) checklist of every unverified clinical value → `docs/CLINICAL_REVIEW.md`
- Dev mode: append `?dev=1` (node IDs, jump-to-node, state inspector)

## Folder map (✓ = exists; rest planned; update when it changes)
- ✓ `docs/` — SPEC.md, CLINICAL_REVIEW.md (generated), CONTENT_GUIDE.md, graphs/ (generated)
- `content/` — ALL clinical content as YAML: `systems.yaml`, `references.yaml`, `benchmarks.yaml`,
  `<system>/<module>/module.yaml`, `<system>/<module>/cases/*.yaml`, `codex/{anatomy,pathology,drugs,scores,ecg}/`, `assets/`
- `src/engine/` — pure TS game engine (state, effects, conditions, navigation). No React, no clinical facts.
- `src/clinical/` — pure, unit-tested score functions (HEART, TIMI, GRACE)
- `src/content/` — Zod schemas + build-time YAML compiler
- ✓ `src/components/` (Layout, Disclaimer gate, ThemeSync), ✓ `src/screens/` (Home, Settings, SystemPlaceholder), ✓ `src/store/settings.ts`, `src/art/` (SVG characters/scenes/props)
- ✓ `scripts/make-icons.mjs` — dependency-free generator for `public/icon*.{svg,png}`
- ✓ `.github/workflows/deploy.yml` — lint+test+build on every push/PR; deploys `main` to Pages (`BASE_PATH=/<repo>/`)
- `scripts/` — validate, graph, review (Phase 4)

## Architecture rules
- The engine is content-agnostic: new systems/modules/cases are added by adding content files only.
- Hierarchy: System → Module → Case → Nodes → Panels. Codex (anatomy, pathology, drugs, scores, ECG) is unlocked by cases and browsable anytime.
- Node types: story, choice, multiselect, order, calculator, dose, ecg, ending (extensible).
- Options are graded best / acceptable / suboptimal / harmful, with a one-line consequence and a teaching point.
- Hidden patient state: vitals, case clock, flags. Meters: Patient, Time, Safety. End grade 1–3 stars. Modes: Learn / Exam.
- Case titles never reveal the diagnosis. Setting toggle (PCI-capable vs non-PCI) changes the correct pathway.

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
- Art is code-drawn SVG line art only (no AI, stock or copyrighted images); one consistent stroke width.
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
- Claude's preview tool can't launch this project from the Expo session; run Vite directly and open http://localhost:5180.

## Status
Phase 0 deployed: https://manofav-glitch.github.io/door-to-decision/ (repo github.com/manofav-glitch/door-to-decision,
public; Pages source = GitHub Actions). Service worker + precache verified on the live site; owner's phone
install + airplane-mode test PASSED 2026-09-29 → Phase 0 done. Owner pushes with a GitHub token (no `gh` CLI on this Mac). Phase 1 awaits go-ahead.
