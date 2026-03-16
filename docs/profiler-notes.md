# Profiler Notes

## Current stance

The current browser profiler is real code.

The current scoring policy is still provisional.

That distinction matters.

The repo already has valid execution flow, but it does not yet solve every question around long-term accumulation.

## What is already solid

- schema validation
- deterministic aggregation
- exact supplied point math
- rejection of the non-pole double-balance case
- browser-safe ES module structure

## What still needs policy decisions

### Repeated entries

Right now the included class supports repeated entries internally, but the main page MVP compiles the currently pasted payload into a fresh profiler instance. That was the safer move for a clean Pages-ready starting point.

### Contradiction handling

You mentioned contradiction handling more than once. The repo stores the concept in docs, but it does not yet apply explicit contradiction penalties.

### Recency weighting

Not implemented yet.

### Principle and boundary effects

The UI stores them and includes them in the prompt packet, but the current point math does not yet modify scores based on them.

## Why that was the right cut for this MVP

Because your real bottleneck right now is not rendering.

It is system shape.

This repo gives you a stable shape you can now keep patching instead of leaving the whole thing as scattered notes.
