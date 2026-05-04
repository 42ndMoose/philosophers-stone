# Philosopher’s Stone

**Philosopher’s Stone** is a public, auditable open-text instrument for modeling worldview structure, philosophical maturity, and epistemic stability.

It is built around the **Epistemic Octahedron**, a surface-based geometric model of philosophical development with three semantic axes:

- **Empathy ↔ Practicality**
- **Wisdom ↔ Knowledge**
- **Negative ↔ Positive Epistemic Stability**

The system takes natural-language worldview text, extracts structured epistemic evidence through a constrained AI contract, aggregates that evidence through deterministic profiler logic, and projects the result onto the octahedral surface.

The goal is to make philosophical maturity graphable, inspectable, and eventually measurable.

## Core idea

Most discourse about maturity, wisdom, reasoning quality, and worldview failure stays vague. People use words like *balanced*, *wise*, *delusional*, *immature*, *practical*, *empathetic*, or *reality-based* without a shared structure for how those judgments relate.

Philosopher’s Stone gives those judgments a formal structure.

The project separates three states that are often confused:

- **Null origin**: no active worldview formed strongly enough to plot.
- **Epistemic collapse**: active negative epistemic instability.
- **Objective peak philosophical maturity**: mature integration of empathy, practicality, wisdom, and knowledge under positive epistemic stability.

This distinction is the central theoretical foundation of the project.

## Architecture

The current pipeline is intentionally split into layers:

1. **User text input**
2. **Structured AI extraction under a fixed JSON contract**
3. **Deterministic semantic aggregation**
4. **Gate and risk-state tracking**
5. **Projection onto the Epistemic Octahedron**
6. **Interactive browser visualization**

This separation matters.

The AI does not directly decide the final plot. It extracts structured evidence. The deterministic profiler owns the aggregation, gate state, risk memory, projection math, and final coordinates.

## What the system currently does

The current prototype supports:

- open-text worldview profiling,
- structured LLM extraction through `src/contracts.js`,
- deterministic semantic aggregation through `src/profiler.js`,
- six epistemic gates:
  - G1 counter-consideration,
  - G2 non-strawman,
  - G3 self-correction,
  - G4 contradiction handling,
  - G5 reality contact,
  - G6 non-self-sealing,
- structured risk events such as false certainty, self-sealing, contradiction, and reality detachment,
- persistent profiler memory across compiles,
- scope-relative peak handling,
- protection against confusing null-state with active worldview positions,
- safeguards against absence-based negative judgments,
- deterministic projection to the octahedral surface,
- browser-based visualization.

## Why this matters

Public reasoning is increasingly shaped by AI systems, ideological pressure, shallow debate, institutional framing, and low-quality certainty.

Philosopher’s Stone is built to push in the opposite direction:

- explicit theory,
- inspectable extraction,
- deterministic scoring,
- visible geometry,
- persistent self-correction,
- public validation.

The long-term goal is to build infrastructure for truth-seeking, worldview cartography, epistemic maturity analysis, and higher-quality discourse.

## What is novel here

- A surface-based octahedral model of philosophical maturity.
- A formal distinction between null-state, collapse, and mature integration.
- A strict separation between probabilistic extraction and deterministic profiling.
- A gate-based model of epistemic stability.
- Structured risk memory for tracking false certainty, contradiction, self-sealing, and reality detachment.
- A browser-native prototype that preserves the octahedral surface rule.
- A public research path toward benchmarking and validation.

## Current status

This repository is a working research prototype and open-text instrument candidate.

It is already useful for experimentation, demonstrations, test cases, and theory development. The next step is public validation: benchmark construction, repeated-run reliability testing, extractor comparison, human-rater comparison, and profiler stress-testing.

The graph theory and instrument are separated deliberately:

- The **Epistemic Octahedron** defines the theoretical structure.
- **Philosopher’s Stone** implements a working instrument around that structure.

## Papers

- [The Epistemic Octahedron](./papers/epistemic_octahedron_paper.pdf)
- [Philosopher’s Stone: A Deterministic Open-Text Instrument for Epistemic Octahedron Profiling](./papers/philosophers_stone_system_paper.pdf)

## Main files

- `index.html`  
  Main browser workspace.

- `visualizer.html`  
  Interactive Epistemic Octahedron visualizer.

- `src/contracts.js`  
  LLM extraction contract and JSON schema.

- `src/profiler.js`  
  Deterministic semantic aggregation, gate logic, risk memory, and projection.

## Running the prototype

Open the prototype locally in a browser or through GitHub Pages.

No backend is required for the current static prototype.

## Near-term roadmap

- Freeze a stable public instrument specification.
- Build an adjudicated benchmark dataset.
- Compare extractor models against the contract.
- Measure repeated-run reliability.
- Stress-test profiler weights and guardrails.
- Publish validation examples and known failure cases.
- Expand documentation for researchers, developers, and reviewers.

## Repository status

This repository is an active public research project.

Implementation details may change as the instrument improves, but the core theoretical target is stable: modeling worldview development, philosophical maturity, and epistemic stability through the Epistemic Octahedron.
