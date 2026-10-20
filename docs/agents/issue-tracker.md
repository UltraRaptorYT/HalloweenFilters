# Issue tracker: Local Markdown

Issues and specs for this repo live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- A `Status:` line near the top of each issue file records its current state
- Comments append to the bottom under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a file under `.scratch/<feature-slug>/`.

## When a skill says "fetch the relevant ticket"

Read the referenced path or issue file.

## Wayfinding operations

- **Map**: `.scratch/<effort>/map.md`, with Notes / Decisions-so-far / Fog
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, with a `Type:` line (`research`/`prototype`/`grilling`/`task`) and a `Status:` line (`claimed`/`resolved`)
- **Blocking**: `Blocked by: NN, NN`; the ticket is unblocked when each listed file is resolved
- **Frontier**: scan for open, unblocked, unclaimed files; first by number wins
- **Claim**: set `Status: claimed` and save before work
- **Resolve**: append an `## Answer`, set `Status: resolved`, then add a context pointer to `map.md`
