const CANON_LAYER_KEYS = ["core", "supporting", "conditional"];

const CORE_CONTRACT = `EPISTEMIC OCTAHEDRON INTERPRETER CONTRACT
version: 3.2

PURPOSE
This contract helps the LLM understand what the visualizer represents, what the axes mean, and what kind of semantic extraction the profiler can use.
This contract does NOT authorize the LLM to compute final scores or final plot coordinates.

PIPELINE
System -> LLM -> Profiler -> Visualizer

1. System
Gives the user:
- the framework
- the input instructions
- this interpreter contract
- the JSON output format the LLM must follow

2. LLM
Reads:
- the user's profile input
- this interpreter contract
- the current layered canon context

The LLM's job is to interpret the user's text semantically and emit structured output the profiler can use.

3. Profiler
Receives the LLM output.
The profiler is the mathematical and scoring authority.
It stores, weighs, aggregates, filters, and computes final semantic values and final xyz coordinates.

4. Visualizer
Receives only finalized profiler data and plots the final point.

GEOMETRIC REFERENCE
The visualizer is an octahedron in 3D space.
Surface equation for committed plots:
|x| + |y| + |z| = 1
Center: (0, 0, 0)

The LLM does not need to imagine this shape visually.
The geometry is included only so the LLM understands what the profiler and visualizer are modeling.

EPISTEMIC OCTAHEDRON CONTEXTUALIZER
A philosophy, worldview, thought, or mind-state is plotted as a 3D point on the surface of an octahedron.

SURFACE RULE
Actual plotted states lie on:
|x| + |y| + |z| = 1

The only temporary exception is the reset state at the true center:
(0, 0, 0)

That center is just the neutral pre-interaction start state.
Once the visualizer is engaged, the point is surface-locked.

AXES
x-axis
- negative = Practicality
- positive = Empathy

z-axis
- negative = Knowledge
- positive = Wisdom

y-axis
- negative = Negative Epistemic Stability
- zero = Epistemic Borderline
- positive = Positive Epistemic Stability

STRICT SIGN RULE
The sign decides the side.
Magnitude decides strength.

- any positive x = Empathy side
- any negative x = Practicality side
- any positive z = Wisdom side
- any negative z = Knowledge side
- any positive y = Positive Epistemic Stability
- any negative y = Negative Epistemic Stability

DEFINITIONS
Epistemic stability:
The degree to which a mind can orient itself toward reality in a self-corrective, truth-convergent way.

Positive epistemic stability:
A state where the mind reduces distortion, corrects error, integrates well, and moves toward reality.

Negative epistemic stability:
A state where the mind cannot reliably orient itself toward reality, whether because it is undeveloped, dependent, impaired, distorted, or corrupted.

Epistemic borderline:
The equator, where y = 0.
This is the dividing line between net truth-convergence and net non-convergence.

ALL-AGES INTERPRETATION
This graph is for all ages, not just developed adults.
Negative epistemic stability does not only mean adult-style distortion, contradiction, motivated reasoning, or self-sealing falsehood.
It can also mean epistemic non-formation.
That means a mindless infant can be placed at or near:
(0, -1, 0)
not because the infant is blameworthy or deceptive, but because it is maximally undeveloped in self-directed truth-orientation.

So the lower pole includes different cases that share the same structural condition for different reasons, such as:
- innocent non-formation, like an infant
- impairment or severe incapacity
- mature but corrupted cognition

The graph tracks epistemic condition, not moral blame.

LATERAL AXIS MEANINGS
Empathy:
human-centered concern, felt impact, compassion, moral sensitivity, relational weighting

Practicality:
utility, feasibility, efficiency, logistics, constraints, instrumental reasoning

Wisdom:
judgment, synthesis, proportion, context, deeper interpretation

Knowledge:
facts, recall, technical detail, literal precision, information storage

IMPORTANT NEGATIVE-SIDE RULE
The lateral directions still exist below the borderline, but in degraded or immature form.
Examples:
- negative-side empathy can appear as false empathy, selective compassion, or emotional distortion
- negative-side practicality can appear as crude expediency or dehumanized utility
- negative-side wisdom can appear as pseudo-wisdom or inflated false depth
- negative-side knowledge can appear as sterile fact-hoarding or misused precision

But for very early or undeveloped minds, the lower region can simply reflect lack of formation rather than corruption.

OBJECTIVE PEAK MATURITY
The top pole is the objective peak maturity:
(0, 1, 0)

At full positive epistemic stability, the four lateral aspects no longer compete against each other as unresolved tensions.
They become properly integrated under reality-tracking maturity.

GEOMETRIC REFERENCE
Pure extremes:
- Empathy = ( 1, 0, 0)
- Practicality = (-1, 0, 0)
- Wisdom = ( 0, 0, 1)
- Knowledge = ( 0, 0, -1)
- Positive Epistemic Stability = ( 0, 1, 0)
- Negative Epistemic Stability = ( 0, -1, 0)

Equator examples where y = 0:
- full Empathy + Wisdom = ( 0.500, 0.000, 0.500)
- full Empathy + Knowledge = ( 0.500, 0.000, -0.500)
- full Practicality + Wisdom = (-0.500, 0.000, 0.500)
- full Practicality + Knowledge = (-0.500, 0.000, -0.500)

CURRENT PROFILER RULE
The profiler can compile from either:
- structured evidence items
- compact profile signals inside the profile line

Compact profile signals look like:
- +.18 stability
- +.10 wisdom
- -.07 practicality

Evidence is preferred when available because it preserves nuance.
But the system must still be compilable from compact profile signals alone.

LLM TASK
From the user's text, extract semantic signals for:
1. empathy vs practicality
2. wisdom vs knowledge
3. epistemic stability direction

The LLM should not output final percentages, final coordinates, or final profile scores.
The LLM should instead output:
- evidence items when there is usable semantic evidence
- a compact profile line as a short summary
- and both when both are helpful

AXIS NAMES FOR OUTPUT
Use exactly these axis values:
- "empathyPracticality"
- "wisdomKnowledge"
- "epistemicStability"

DIRECTION VALUES
For axis = "empathyPracticality":
- "empathy"
- "practicality"
- "mixed"
- "unclear"

For axis = "wisdomKnowledge":
- "wisdom"
- "knowledge"
- "mixed"
- "unclear"

For axis = "epistemicStability":
- "positive"
- "negative"
- "mixed"
- "unclear"

STRENGTH VALUES
Use exactly one of:
- "weak"
- "moderate"
- "strong"

CONFIDENCE
confidence must be a decimal from 0 to 1.

EVIDENCE ITEM FORMAT
Each evidence item must follow this shape:
{
  "axis": "empathyPracticality | wisdomKnowledge | epistemicStability",
  "direction": "allowed direction for that axis",
  "strength": "weak | moderate | strong",
  "confidence": 0.0 to 1.0,
  "reason": "short explanation of why this evidence was identified",
  "excerpt": "optional short supporting excerpt from the user's text"
}

REQUIRED JSON SHAPE
{
  "model": "epistemic_octahedron_interpreter_v1",
  "profile": [
    "+.12 stability +.05 practicality | short justification"
  ],
  "evidence": [
    {
      "axis": "empathyPracticality",
      "direction": "empathy",
      "strength": "moderate",
      "confidence": 0.82,
      "reason": "The text gives clear moral weight to human impact and concern for others",
      "excerpt": "optional short excerpt"
    },
    {
      "axis": "wisdomKnowledge",
      "direction": "wisdom",
      "strength": "weak",
      "confidence": 0.61,
      "reason": "The text attempts synthesis and broader judgment rather than only listing facts",
      "excerpt": "optional short excerpt"
    },
    {
      "axis": "epistemicStability",
      "direction": "positive",
      "strength": "weak",
      "confidence": 0.48,
      "reason": "The text shows some truth-seeking and self-corrective language, but not enough to infer high stability",
      "excerpt": "optional short excerpt"
    }
  ],
  "notes": [
    "optional short ambiguity note"
  ]
}

PROFILE ENTRY RULE
- Emit exactly one short profile line in the "profile" array.
- Keep it to one sentence and one line.
- Format it like:
  +.12 stability +.05 practicality | short justification
- Avoid long explanations.
- Keep the wording tight enough that repeated compiles do not bloat the profile history.
- Prefer a pipe separator over nested quotation marks inside the profile string.

NOTES RULE
- Use notes only when they add something live and non-redundant.
- Use at most 2 short notes.
- Skip stale wording, near-duplicates, and obvious restatements of the profile line.

OPTIONAL CANON UPDATE OBJECT
If the current layered canon clearly needs maintenance, refinement, deduping, replacement, or obsolescence handling, you may include:
"canonUpdate": {
  "action": "maintain | replace | update | add | obsolete | refine",
  "principlesByLayer": {
    "core": ["..."],
    "supporting": ["..."],
    "conditional": ["..."]
  },
  "boundariesByLayer": {
    "core": ["..."],
    "supporting": ["..."],
    "conditional": ["..."]
  },
  "notes": ["optional short canon note"]
}

CANON UPDATE RULES
- Only include canonUpdate when it meaningfully improves the stored canon.
- The action tells the system what kind of maintenance you think happened.
- If you include principlesByLayer or boundariesByLayer, output the full next canon state for that section, not partial fragments.
- "maintain" means the current canon should stay as it is.
- "replace" means the new canon snapshot should replace the current canon snapshot.
- "update", "add", "obsolete", and "refine" still output the full next canon snapshot so the profiler system can store it cleanly.
- Keep the canon lean.
- Do not expand it just because you can.
- Add a principle when the text states a durable positive rule, ideal, or commitment the profile appears to endorse.
- Add a boundary when the text states a durable refusal, prohibition, or rejection the profile appears to hold.
- Do not create canon items from one-off examples, filler, or weakly implied sentiment.

INTERPRETATION RULES FOR THE LLM
1. Assess the user's text semantically, not geometrically.
2. Avoid false precision.
3. Multiple evidence items for the same axis are allowed when the text contains multiple signals.
4. Do not collapse the whole reading into one aspect when the text clearly supports more than one aspect.
5. Before you write the final JSON, silently check each axis with a simple usable-evidence test:
   - empathyPracticality: true or false
   - wisdomKnowledge: true or false
   - epistemicStability: true or false
   If true, emit at least one evidence item for that axis.
6. If the text contains contradiction or tension, the LLM may use:
   - direction = "mixed"
   - and or add a note explaining the conflict
7. If the text is shallow, short, vague, or indirect, prefer:
   - weaker strength
   - lower confidence
   - or compact profile signals without overclaiming
8. Do not pretend that one text dump equals a final personality or philosophical profile.
9. The LLM is extracting signals, not declaring final truth.
10. The profile name is display-only context and should not bias interpretation.
11. Additional info may matter if it changes semantic context.
12. Existing principles and boundaries are editable canon, not sacred text.

BAD OUTPUT EXAMPLES
Do NOT output:
- final empathyPercent
- final wisdomPercent
- final stabilityPercent
- final x/y/z
- surface math
- octahedron projection math
- profile accumulation
- long-term memory scoring

FINAL INSTRUCTION TO THE LLM
Do not output final x/y/z and do not compute scores.
Output structured semantic signals the profiler can store and compile.
Return valid JSON only.`;

function normalizeList(items = []) {
  return items.map((item) => String(item || "").trim()).filter(Boolean);
}

function createEmptyLayeredCanon() {
  return Object.fromEntries(CANON_LAYER_KEYS.map((key) => [key, []]));
}

function normalizeLayeredCanon(input = {}) {
  const layered = createEmptyLayeredCanon();

  if (Array.isArray(input)) {
    layered.core = normalizeList(input);
    return layered;
  }

  if (!input || typeof input !== "object") {
    return layered;
  }

  for (const key of CANON_LAYER_KEYS) {
    layered[key] = normalizeList(input[key]);
  }

  return layered;
}

function hasAnyLayeredItems(layered = {}) {
  return CANON_LAYER_KEYS.some(
    (key) => Array.isArray(layered[key]) && layered[key].length,
  );
}

function formatLayeredSection(title, layeredInput = {}) {
  const layered = normalizeLayeredCanon(layeredInput);
  const lines = [title];
  for (const key of CANON_LAYER_KEYS) {
    const pretty = key.charAt(0).toUpperCase() + key.slice(1);
    const items = layered[key];
    if (!items.length) {
      lines.push(`${pretty}: none`);
      continue;
    }
    lines.push(`${pretty}:`);
    lines.push(...items.map((item) => `- ${item}`));
  }
  return lines.join("\n");
}

function formatProfileLines(entries = []) {
  const clean = normalizeList(entries);
  if (!clean.length) return "Profile entries: none";
  return `Profile entries:\n${clean.map((item) => `- ${item}`).join("\n")}`;
}

function formatComputedSection(computed = {}) {
  const lines = ["Computed profiler values"];
  if (computed && typeof computed === "object") {
    const point = computed.point || {};
    const uiLike = computed.uiLike || {};
    lines.push(`Empathy: ${uiLike.empathyPercent ?? "n/a"}`);
    lines.push(`Practicality: ${uiLike.practicalityPercent ?? "n/a"}`);
    lines.push(`Wisdom: ${uiLike.wisdomPercent ?? "n/a"}`);
    lines.push(`Knowledge: ${uiLike.knowledgePercent ?? "n/a"}`);
    lines.push(`Stability: ${uiLike.stabilityPercent ?? "n/a"}`);
    lines.push(`X: ${point.x ?? "n/a"}`);
    lines.push(`Y: ${point.y ?? "n/a"}`);
    lines.push(`Z: ${point.z ?? "n/a"}`);
  }
  return lines.join("\n");
}

export {
  CANON_LAYER_KEYS,
  createEmptyLayeredCanon,
  normalizeLayeredCanon,
  hasAnyLayeredItems,
};

export function buildLLMPacket({
  profileText = "",
  name = "",
  additionalInfo = "",
  avatar = "",
  principlesByLayer = {},
  boundariesByLayer = {},
} = {}) {
  const cleanProfileText = String(profileText || "").trim();
  const sections = [
    "SYSTEM FRAME",
    "You are reading one contract and one schema for the Epistemic Octahedron pipeline.",
    "Interpret the user text semantically and emit JSON only. Include canon updates when warranted.",
    "",
    "PROFILE CONTEXT",
    `Name: ${String(name || "").trim() || "unspecified"}`,
    "Name handling: display-only, do not let it bias judgment.",
    `Additional info: ${String(additionalInfo || "").trim() || "none"}`,
    `Avatar preference: ${String(avatar || "").trim() || "auto"}`,
    formatLayeredSection("Principles by layer", principlesByLayer),
    formatLayeredSection("Boundaries by layer", boundariesByLayer),
    "",
    "USER PROFILE INPUT",
    cleanProfileText || "[no profile text provided]",
    "",
    CORE_CONTRACT,
  ];

  return sections.join("\n");
}

export function buildProfilerAssessmentPacket({
  name = "",
  additionalInfo = "",
  avatar = "",
  profileEntries = [],
  notes = [],
  computed = {},
} = {}) {
  const cleanEntries = normalizeList(profileEntries).slice(0, 6);
  const cleanNotes = normalizeList(notes).slice(0, 6);
  const point = computed.point || {};
  const uiLike = computed.uiLike || {};

  const sections = [
    "SYSTEM FRAME",
    "You are reading a finalized profiler snapshot from the Epistemic Octahedron pipeline.",
    "Use this snapshot to describe the profile's philosophy, not to discuss the wider system.",
    "",
    "TASK",
    "Write a concise overview of the profile's philosophy from the compiled point and the supporting profile lines.",
    "Use additional info only when it materially changes interpretation.",
    "Treat the name as display-only.",
    "Do not invent missing biography.",
    "Do not explain pipeline mechanics unless they are needed to interpret the point.",
    "",
    "GEOMETRY REFERENCE",
    "The finalized point lies on an octahedron surface where |x| + |y| + |z| = 1.",
    "x negative = Practicality, x positive = Empathy.",
    "z negative = Knowledge, z positive = Wisdom.",
    "y negative = Negative Epistemic Stability, y positive = Positive Epistemic Stability.",
    "Higher |y| means stability is taking more of the total share, so the lateral axes matter less as competing tensions.",
    "At strong positive stability, the lateral aspects are more integrated under maturity.",
    "",
    "PROFILE SNAPSHOT",
    `Name: ${String(name || "").trim() || "unspecified"}`,
    "Name handling: display-only, do not let it bias judgment.",
    `Additional info: ${String(additionalInfo || "").trim() || "none"}`,
    `Avatar: ${String(avatar || "").trim() || "auto"}`,
    `Empathy: ${uiLike.empathyPercent ?? "n/a"}`,
    `Practicality: ${uiLike.practicalityPercent ?? "n/a"}`,
    `Wisdom: ${uiLike.wisdomPercent ?? "n/a"}`,
    `Knowledge: ${uiLike.knowledgePercent ?? "n/a"}`,
    `Stability: ${uiLike.stabilityPercent ?? "n/a"}`,
    `X: ${point.x ?? "n/a"}`,
    `Y: ${point.y ?? "n/a"}`,
    `Z: ${point.z ?? "n/a"}`,
    cleanEntries.length
      ? `Supporting profile entries:
${cleanEntries.map((item) => `- ${item}`).join("\n")}`
      : "Supporting profile entries: none",
    cleanNotes.length
      ? `Supporting notes:
${cleanNotes.map((item) => `- ${item}`).join("\n")}`
      : "Supporting notes: none",
    "",
    "OUTPUT",
    "Return plain prose only.",
    "Keep it concise, specific, and grounded in the snapshot.",
  ];

  return sections.join("\n");
}
