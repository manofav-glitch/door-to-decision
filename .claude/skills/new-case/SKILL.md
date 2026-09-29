---
name: new-case
description: Scaffold a new Door to Decision case from the template, list it in its module, then validate and draw its branching graph. Use when the content owner asks for a new case (e.g. "/new-case", "start a new case", "add cp-03").
---

# /new-case: scaffold a case

You are helping the content owner (an EM clinician) start a new case. Follow the project rules in
`CLAUDE.md`, especially the CLINICAL CONTENT RULES: anything clinical you draft stays `verified: false`,
cites a source from `content/references.yaml` (or `needs-source` plus a `todo`), and only the owner ever
sets `verified: true`.

## 1. Get four things (ask only for what the owner hasn't said)
- **system**: folder under `content/` (e.g. `cvs`). It must exist and be listed in `content/systems.yaml`.
- **module**: folder under the system (e.g. `chest-pain`) with a `module.yaml`.
- **name**: the file name, lower-case with dashes, following the module's pattern (e.g. `cp-03`).
  The case id becomes `<system>-<name>` (e.g. `cvs-cp-03`).
- **title**: the *presentation* only, never the diagnosis (e.g. "62F, sudden tearing back pain").

If the system or module doesn't exist yet, stop and ask; creating one is a separate, bigger step.

## 2. Scaffold
Run:

```bash
npm run new-case -- <system> <module> <name> "<title>"
```

This copies `docs/templates/case.yaml`, adds the case to `cases:` in `module.yaml`, validates all content,
and writes `docs/graphs/<id>.md`. If it fails, read the message; it names the file and line.

## 3. Fill it in (only if the owner asks you to draft)
- Read `docs/CONTENT_GUIDE.md` for the format, and an existing case (e.g. `cp-01.yaml`) for style.
- Replace every `TODO`. Keep consequences and teaching points to one short line.
- Every choice step needs at least one `best` option; critical errors lead to a `critical` ending
  with teaching, never shaming.
- Clinical facts (doses, thresholds, time targets) go in drug cards / benchmarks, not in the case text.
- All drafted clinical items: `verified: false`, with a `source` and, if unsure, a `todo`.

## 4. Check
```bash
npm run validate && npm run graph && npm test && npm run review
```
Fix every error; look at the warnings. Then tell the owner:
- the file path and the graph path (`docs/graphs/<id>.md`)
- how to play it (`npm run dev`, then Cardiovascular → module → the new case; drafts show in dev)
- that `docs/CLINICAL_REVIEW.md` now lists the new case's unverified items.

Commit with a clear message only when the owner is happy.
