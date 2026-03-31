
const SIGNAL_GUIDANCE = `EPISTEMIC OCTAHEDRON EXTRACTOR CONTRACT
version: 5.0

PURPOSE
The LLM is an extractor only.
It does not compute final scores, maturity percentages, or coordinates.

OUTPUT DISCIPLINE
Return valid JSON only.
Prefer under-calling over over-calling.
Extract portable philosophical structure, not incidental surface dressing.

REQUIRED TOP-LEVEL FIELDS
- model
- analysis_scope
- local_extraction
- axis_events
- local_y_positive_signals
- local_y_negative_signals
- triggered_gate_events
- profile_update_signals

OPTIONAL TOP-LEVEL FIELDS
- scope_strength
- statement_modes
- profile
- notes
- canonOptimization

SCOPE
analysis_scope must be one of:
- thought
- stance
- worldview_fragment
- full_profile_import

scope_strength may be:
- low
- medium
- high

STATEMENT MODES
statement_modes may include:
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

AXIS EVENTS
Do not emit final x or z values.
Emit evidence only.

For x axis:
- x_pole_evidence with pole = empathy or practicality
- x_integration_events with type = explicit_balance or fair_tradeoff or integrated_tension

For z axis:
- z_pole_evidence with pole = wisdom or knowledge
- z_integration_events with type = explicit_balance or fair_tradeoff or integrated_tension

Every pole evidence item must include:
- pole
- strength = weak | moderate | strong
- confidence from 0.5 to 1.0
- evidence_span

IMPORTANT
Acknowledging the opposite pole is not the same as emphasizing it.
If one pole is primary and the other is only acknowledged, counterweighted, or mentioned in passing:
- weight the primary pole stronger
- weight the acknowledged pole weaker
Do not output equal opposite-pole emphasis unless the text genuinely presents both poles as equally integrated.

LOCAL Y SIGNALS
Every local y signal should include:
- type
- strength
- confidence
- evidence_span

Positive types may include:
- counter_consideration
- self_correction
- reality_contact
- coherence
- error_awareness
- revision_openness
- non_strawman_fairness

Negative types may include:
- false_certainty
- self_sealing
- contradiction_evasion
- reality_detachment
- dogmatic_closure
- collapse_marker
- strawman_dependence
- broad_motive_attribution

TRIGGERED GATE EVENTS
Use only these gates:
- G1_counter_consideration
- G2_non_strawman
- G3_self_correction
- G4_contradiction_handling
- G5_reality_contact
- G6_non_self_sealing

Each triggered_gate_event must include:
- gate
- direction = positive or negative
- strength = weak | moderate | strong
- confidence from 0.5 to 1.0
- novelty from 0.0 to 1.0 when possible
- evidence_span

Do not use direction = mixed.
If the evidence is mixed, express that through local_y_positive_signals and local_y_negative_signals instead.

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

PROFILE SUMMARY LINE
profile is display text only.
Keep it concise.
Do not put numbers, percentages, coordinates, or projection math in it.

OPTIONAL CANON OPTIMIZATION
If you can clearly improve canon memory without losing important meaning, you may include:

"canonOptimization": {
  "action": "maintain | merge | replace",
  "principles": [],
  "boundaries": [],
  "notes": []
}

Rules for canonOptimization:
- keep it lean
- merge duplicates
- shorten wording when meaning is preserved
- prefer fewer, cleaner items
- do not omit important distinctions
- do not invent canon items not supported by the current input plus current canon memory

FINAL INSTRUCTION
Return valid JSON only.`;

function normalizeList(items = []) {
  return (Array.isArray(items) ? items : [items])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function flattenLayeredCanon(input = {}) {
  if (Array.isArray(input)) return normalizeList(input);
  if (!input || typeof input !== "object") return [];
  return normalizeList([
    ...(input.core || []),
    ...(input.supporting || []),
    ...(input.conditional || []),
  ]);
}

function formatSimpleListSection(title, items = []) {
  const clean = normalizeList(items);
  if (!clean.length) return `${title}: none`;
  return [title, ...clean.map((item) => `- ${item}`)].join("\n");
}

function formatProfilerMemorySection(memory = {}) {
  const corePrinciples = normalizeList(
    memory.core_principles || memory.corePrinciples || [],
  );
  const coreBoundaries = normalizeList(
    memory.core_boundaries || memory.coreBoundaries || [],
  );
  const metaMarkers = normalizeList(
    memory.meta_epistemic_markers || memory.metaEpistemicMarkers || [],
  );
  const riskNotes = normalizeList(memory.risk_notes || memory.riskNotes || []);

  return [
    formatSimpleListSection("Profiler memory: principles", corePrinciples),
    formatSimpleListSection("Profiler memory: boundaries", coreBoundaries),
    formatSimpleListSection("Profiler memory: meta-epistemic markers", metaMarkers),
    formatSimpleListSection("Profiler memory: risk notes", riskNotes),
  ].join("\n\n");
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

export function buildLLMPacket({
  profileText = "",
  principles = [],
  boundaries = [],
  principlesByLayer = {},
  boundariesByLayer = {},
  profilerMemory = {},
} = {}) {
  const cleanProfileText = String(profileText || "").trim();
  const canonPrinciples = normalizeList([
    ...flattenLayeredCanon(principlesByLayer),
    ...normalizeList(principles),
  ]);
  const canonBoundaries = normalizeList([
    ...flattenLayeredCanon(boundariesByLayer),
    ...normalizeList(boundaries),
  ]);

  const sections = [
    "SYSTEM FRAME",
    "You are reading one extractor contract and one schema for the Epistemic Octahedron pipeline.",
    "Interpret the user text semantically and return JSON only.",
    "",
    "CANON MEMORY",
    formatSimpleListSection("Principles", canonPrinciples),
    formatSimpleListSection("Boundaries", canonBoundaries),
    "",
    "PROFILER MEMORY",
    formatProfilerMemorySection(profilerMemory),
    "",
    "USER PROFILE INPUT",
    cleanProfileText || "[no profile text provided]",
    "",
    SIGNAL_GUIDANCE,
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

  const sections = [
    "SYSTEM FRAME",
    "You are reading a finalized profiler snapshot from the Epistemic Octahedron pipeline.",
    "Use this snapshot to describe the compiled philosophy, not the wider system.",
    "",
    "TASK",
    "Write a concise overview of the profile's philosophy from the compiled point and supporting lines.",
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
      ? `Supporting profile lines:\n${cleanEntries.map((item) => `- ${item}`).join("\n")}`
      : "Supporting profile lines: none",
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

export const CANON_LAYER_KEYS = ["core", "supporting", "conditional"];
export { flattenLayeredCanon };
