# Architecture

## Pipeline

System → LLM → Profiler → Visualizer

### System

Provides the visible workspace and the hidden prompt packet.

The main page currently does five jobs:

1. stores the user's raw profile text
2. wraps it with the interpreter contract and JSON schema
3. stores editable profile metadata
4. stores principles and boundaries
5. accepts pasted LLM JSON for compile

### LLM

The LLM stage is intentionally narrow.

It should:

- interpret text semantically
- emit evidence JSON only
- avoid final scoring
- avoid final x, y, z

### Profiler

The profiler is the mathematical authority.

The current implementation already supports:

- evidence validation
- direction-to-sign mapping
- strength weighting
- confidence weighting
- axis aggregation
- semantic profile output
- x, y, z computation using the supplied formula

### Visualizer

The visualizer only plots final x, y, z.

In this repo, `visualizer.html` also accepts `postMessage` events from `index.html` so the main page can drive the point preview live.

## Ten default avatars

The repo uses ten symbolic defaults:

1. Positive Stability
2. Negative Stability
3. Empathy
4. Practicality
5. Wisdom
6. Knowledge
7. Empathy + Wisdom
8. Empathy + Knowledge
9. Practicality + Wisdom
10. Practicality + Knowledge

The auto-picker uses the compiled point to choose among them when the user has not picked one manually.

## Why the contract is hidden on the main page

You asked for a minimalist visible UI while still keeping one canonical instruction source.

So the workspace keeps the contract out of sight by default, but the **Copy LLM packet** action still wraps the visible user text with the full contract and schema every time.
