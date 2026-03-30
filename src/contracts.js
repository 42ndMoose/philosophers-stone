const CANON_LAYER_KEYS = ["core", "supporting", "conditional"];

const CORE_CONTRACT = `EPISTEMIC OCTAHEDRON INTERPRETER CONTRACT
version: 4.0

PURPOSE
This contract tells the LLM what the Epistemic Octahedron models and what kind of extraction the profiler can use.
The LLM is an extractor only.
It does not compute final scores, final maturity percentages, or final x y z coordinates.

PIPELINE
System -> LLM -> Profiler -> Visualizer

1. System
Provides:
- the user's current text
- this interpreter contract
- the current layered canon
- the JSON output shape

2. LLM
Reads the text semantically.
It extracts portable structure.
It does not do final scoring.

3. Profiler
Receives structured extraction.
The profiler stores, weighs, merges, filters, and computes semantic params and the final projected point.

4. Visualizer
Receives only finalized profiler data.

GEOMETRIC REFERENCE
Active worldview positions are projected onto the octahedron surface:
|x| + |y| + |z| = 1

Axis signs are fixed:
- x < 0 = Practicality
- x > 0 = Empathy
- z < 0 = Knowledge
- z > 0 = Wisdom
- y < 0 = Negative Epistemic Stability
- y = 0 = Epistemic Borderline
- y > 0 = Positive Epistemic Stability

NULL STATE AND COLLAPSE
The coordinate origin (0, 0, 0) is the pre-philosophical null state.
It represents no active worldview strong enough to plot on the surface.
One example is infancy, but the idea is broader than age.

The lower vertex (0, -1, 0) is epistemic collapse.
It is not the same thing as the null state.
It is an active negative condition.

The upper vertex (0, 1, 0) is objective peak philosophical maturity.
That means the four lateral tensions have been considered and integrated under positive epistemic stability.

CORE SEMANTIC DIMENSIONS
Empathy:
- human concern
- relational weighting
- felt impact
- moral sensitivity

Practicality:
- feasibility
- logistics
- instrumental constraints
- utility under pressure

Wisdom:
- judgment
- synthesis
- proportion
- context-sensitive understanding

Knowledge:
- facts
- literal precision
- technical detail
- information grasp

Epistemic stability:
- reality contact
- coherence
- self-correction
- resistance to self-sealing distortion

LLM EXTRACTION RULES
1. Extract structure, not final verdicts.
2. Prefer under-calling over over-calling.
3. Every meaningful extraction should carry evidence_span when possible.
4. Only emit triggered gate events when the text gives actual evidence for or against a gate.
5. Silence is neutral. Do not output gate statuses for absence.
6. Do not emit final percentages, maturity scores, or coordinates.
7. The current profile name is display-only context and should not bias interpretation.
8. The canon is editable memory, not sacred text.

SCOPE CLASSIFICATION
Always classify the input as one of:
- thought
- stance
- worldview_fragment
- full_profile_import

Also emit scope_strength as:
- low
- medium
- high

STATEMENT MODES
You may emit one or more of:
- literal_claim
- analogy
- rhetorical_generalization
- norm
- self_description

LOCAL EXTRACTION
local_extraction may include:
- principles
- boundaries
- claimed_values
- tradeoffs
- contradictions

Each extracted item should be normalized and supported by an evidence span when possible.

AXIS EVENTS
Do not emit final x or z scores.
Emit evidence instead.

For x axis:
- x_pole_evidence with pole = empathy or practicality
- x_integration_events with type = explicit_balance or fair_tradeoff or integrated_tension

For z axis:
- z_pole_evidence with pole = wisdom or knowledge
- z_integration_events with type = explicit_balance or fair_tradeoff or integrated_tension

LOCAL Y SIGNALS
Emit local epistemic-stability signals from the current input only.

Positive signal types may include:
- counter_consideration
- self_correction
- reality_contact
- coherence
- error_awareness
- revision_openness
- non_strawman_fairness

Negative signal types may include:
- false_certainty
- self_sealing
- contradiction_evasion
- reality_detachment
- dogmatic_closure
- collapse_marker
- strawman_dependence
- broad_motive_attribution

META-EPISTEMIC GATES
Use only these six gates:
- G1_counter_consideration
- G2_non_strawman
- G3_self_correction
- G4_contradiction_handling
- G5_reality_contact
- G6_non_self_sealing

Only emit triggered_gate_events when the text gives real evidence.
Each event must include:
- gate
- direction = positive or negative
- strength = weak moderate or strong
- confidence from 0.5 to 1.0
- novelty from 0.0 to 1.0 when possible
- evidence_span

PROFILE UPDATE SIGNALS
profile_update_signals may include:
- new_principles
- refined_principles
- new_boundaries
- refined_boundaries
- resolved_contradictions
- introduced_contradictions
- cleared_gates
- failed_gates
- retractions
- restatements

OPTIONAL CANON UPDATE
If the current canon clearly needs maintenance, refinement, replacement, or dedupe, you may include canonUpdate.
If you include principlesByLayer or boundariesByLayer, output the full next state for that section.
Keep the canon lean.

REQUIRED JSON SHAPE
{
  "model": "epistemic_octahedron_interpreter_v2",
  "analysis_scope": "thought | stance | worldview_fragment | full_profile_import",
  "scope_strength": "low | medium | high",
  "statement_modes": [],
  "profile": [
    "+.18 stability -.08 practicality | short justification"
  ],
  "local_extraction": {
    "principles": [],
    "boundaries": [],
    "claimed_values": [],
    "tradeoffs": [],
    "contradictions": []
  },
  "axis_events": {
    "x_pole_evidence": [],
    "x_integration_events": [],
    "z_pole_evidence": [],
    "z_integration_events": []
  },
  "local_y_positive_signals": [],
  "local_y_negative_signals": [],
  "triggered_gate_events": [],
  "profile_update_signals": {
    "new_principles": [],
    "refined_principles": [],
    "new_boundaries": [],
    "refined_boundaries": [],
    "resolved_contradictions": [],
    "introduced_contradictions": [],
    "cleared_gates": [],
    "failed_gates": [],
    "retractions": [],
    "restatements": []
  },
  "notes": [],
  "canonUpdate": {
    "action": "maintain | replace | update | add | obsolete | refine",
    "principlesByLayer": {
      "core": [],
      "supporting": [],
      "conditional": []
    },
    "boundariesByLayer": {
      "core": [],
      "supporting": [],
      "conditional": []
    },
    "notes": []
  }
}

BAD OUTPUT
Do not output:
- final empathyPercent
- final practicalityPercent
- final wisdomPercent
- final knowledgePercent
- final stabilityPercent
- final x y z
- surface projection math
- mandatory gate verdicts by absence

FINAL INSTRUCTION
Return valid JSON only.
Extract portable worldview structure.
Do not compute the final plot.`;

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
    lines.push(`Coverage: ${uiLike.coveragePercent ?? "n/a"}`);
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
    "Interpret the user text semantically and return JSON only.",
    "You may include canonUpdate when the current canon clearly needs maintenance.",
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
    "Use this snapshot to describe the compiled philosophy, not the wider system.",
    "",
    "TASK",
    "Write a concise overview of the profile's philosophy from the compiled point and supporting profile lines.",
    "Use additional info only when it materially changes interpretation.",
    "Treat the name as display-only.",
    "Do not invent biography.",
    "",
    "GEOMETRY REFERENCE",
    "The plotted point lies on the octahedron surface where |x| + |y| + |z| = 1 whenever the worldview is active enough to project.",
    "x negative = Practicality, x positive = Empathy.",
    "z negative = Knowledge, z positive = Wisdom.",
    "y negative = Negative Epistemic Stability, y positive = Positive Epistemic Stability.",
    "The origin is reserved for the pre-philosophical null state.",
    "",
    "PROFILE SNAPSHOT",
    `Name: ${String(name || "").trim() || "unspecified"}`,
    "Name handling: display-only, do not let it bias judgment.",
    `Additional info: ${String(additionalInfo || "").trim() || "none"}`,
    `Avatar: ${String(avatar || "").trim() || "auto"}`,
    formatComputedSection(computed),
    cleanEntries.length
      ? `Supporting profile entries:\n${cleanEntries.map((item) => `- ${item}`).join("\n")}`
      : "Supporting profile entries: none",
    cleanNotes.length
      ? `Supporting notes:\n${cleanNotes.map((item) => `- ${item}`).join("\n")}`
      : "Supporting notes: none",
    "",
    "OUTPUT",
    "Return plain prose only.",
    "Keep it concise, specific, and grounded in the snapshot.",
  ];

  return sections.join("\n");
}
