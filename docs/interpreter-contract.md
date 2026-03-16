# Core Interpreter Contract

This file mirrors the canonical contract stored in `src/contracts.js`.

The app uses one main interpreter contract, one main JSON schema, and one main prompt-packet builder.

That is deliberate.

You wanted a single stable source of truth for what the LLM is supposed to read.

## Main rule

The LLM does **not** compute final scores or final x, y, z.

It only emits semantic evidence fields.

## Canonical axis names

- `empathyPracticality`
- `wisdomKnowledge`
- `epistemicStability`

## Canonical strength values

- `weak`
- `moderate`
- `strong`

## Canonical directions

### `empathyPracticality`

- `empathy`
- `practicality`
- `mixed`
- `unclear`

### `wisdomKnowledge`

- `wisdom`
- `knowledge`
- `mixed`
- `unclear`

### `epistemicStability`

- `positive`
- `negative`
- `mixed`
- `unclear`

## Required JSON shell

```json
{
  "model": "epistemic_octahedron_interpreter_v1",
  "evidence": [],
  "notes": []
}
```

## Optional future extension

The older canon-update ideas from the worldview-analysis notes are still useful, but they are better treated as an **optional extension** instead of the core contract itself.

That keeps the primary pipeline cleaner.
