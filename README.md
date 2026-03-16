# Philosopher's Stone

A static GitHub Pages repo for the **Epistemic Octahedron** pipeline.

## What is in here

- `index.html` → main system page
  - Discord-like expanding input box for raw profile text
  - hidden interpreter contract + schema wrapper with copy button
  - paste area for LLM JSON output
  - deterministic profiler compile button
  - profile editor with 10 default avatars, name, age, import/export
  - draggable principles and boundaries lists
  - embedded visualizer preview
- `visualizer.html` → standalone octahedron visualizer
- `src/profiler.js` → provisional deterministic profiler code
- `src/contracts.js` → cleaned core interpreter contract and prompt packet builder
- `docs/` → cleaned architecture notes

## GitHub Pages setup

1. Create a new repo, preferably named `philosophers-stone`.
2. Upload everything in this folder to the repo root.
3. On GitHub, open **Settings → Pages**.
4. Set **Build and deployment** to **Deploy from a branch**.
5. Choose the `main` branch and `/ (root)`.
6. Save.

This repo is build-free, so GitHub Pages can serve it directly.

## Current behavior

The profiler uses the provisional deterministic aggregation logic you supplied.

### Current point math

```js
a = (empathyPercent / 100) * 2 - 1
b = (wisdomPercent / 100) * 2 - 1
s = clamp(stabilityPercent / 100, -1, 1)

lateralBudget = 1 - Math.abs(s)
sumAB = Math.abs(a) + Math.abs(b)

if (Math.abs(s) === 1) {
  x = 0
  y = s
  z = 0
} else if (sumAB > 0) {
  x = (a / sumAB) * lateralBudget
  y = s
  z = (b / sumAB) * lateralBudget
} else {
  throw new Error("Non-pole double-balance cannot be represented on the octahedron surface")
}
```

## Important limitation

This package gives you a strong MVP, not a finalized theory of longitudinal accumulation.

The current repo already handles:

- one canonical contract
- one canonical evidence schema
- browser-side prompt wrapping
- deterministic evidence aggregation
- direct point injection into the visualizer
- profile import/export
- draggable principles and boundaries
- auto-avatar selection from compiled point

What still remains genuinely provisional:

- repeated-entry accumulation policy
- contradiction penalties
- recency weighting
- depth vs direction split
- explicit principle/boundary effects on scoring
- richer canon-update pipeline

## Suggested next step

Wire the main page so the profiler can accumulate multiple pasted LLM outputs into a persistent timeline instead of replacing the last compile state.
