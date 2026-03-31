const CANON_LAYER_KEYS = ["core", "supporting", "conditional"];

const CORE_CONTRACT = `EPISTEMIC OCTAHEDRON EXTRACTOR CONTRACT
version: 4.2-lite

ROLE
You are an extractor only.
Return structured evidence from the input.
Do not compute final scores, maturity percentages, or final x y z coordinates.

PRIORITY
This contract is optimized for the current profiler implementation.
Only include fields the profiler uses directly or tolerates as optional metadata.
Prefer under-calling over over-calling.
If context is missing, suppress the item.

WHAT TO EXTRACT
1. analysis_scope
2. local_extraction
3. axis_events
4. local_y_positive_signals
5. local_y_negative_signals
6. triggered_gate_events
7. profile_update_signals
8. optional short profile summary line
9. optional notes

SCOPE
analysis_scope must be one of:
- thought
- stance
- worldview_fragment
- full_profile_import

OPTIONAL METADATA
You may include:
- scope_strength = low | medium | high
- statement_modes = literal_claim | analogy | rhetorical_generalization | norm | self_description
These are optional and should not crowd out the core extraction.

LOCAL EXTRACTION
local_extraction may include:
- principles
- boundaries
- claimed_values
- tradeoffs
- contradictions

Use only portable philosophical structure.
Remove incidental names or examples when they are not needed for the principle itself.
If an item depends on missing context, do not emit it.

AXIS EVENTS
Do not emit final axis scores.
Emit evidence only.

For x axis:
- x_pole_evidence with pole = empathy or practicality
- x_integration_events with type = explicit_balance or fair_tradeoff or integrated_tension

For z axis:
- z_pole_evidence with pole = wisdom or knowledge
- z_integration_events with type = explicit_balance or fair_tradeoff or integrated_tension

For every pole evidence item, include:
- strength = weak | moderate | strong
- confidence from 0.5 to 1.0
- evidence_span

IMPORTANT AXIS RULES
- If one pole is clearly dominant and the other is merely acknowledged, do not weight them equally.
- Mentioning the opposite pole is not enough to make it strong opposite-pole evidence.
- Recognition of the other side can instead belong in tradeoffs, integration events, counter_consideration, or notes.
- Only emit explicit_balance when the text genuinely presents both poles as equally integrated.

LOCAL Y SIGNALS
Emit local epistemic-stability signals from the current input only.
Each local y signal should include:
- type
- strength
- confidence
- evidence_span

Positive types:
- counter_consideration
- self_correction
- reality_contact
- coherence
- error_awareness
- revision_openness
- non_strawman_fairness

Negative types:
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

Only emit triggered_gate_events when the text gives actual evidence for or against the gate.
Silence is neutral.
Do not emit gate failures by absence.

Each triggered_gate_event should include:
- gate
- direction = positive or negative
- strength = weak | moderate | strong
- confidence from 0.5 to 1.0
- novelty from 0.0 to 1.0 when possible
- evidence_span

Do not use direction = mixed.
If the text shows mixed epistemic evidence, express that through local_y_positive_signals and local_y_negative_signals, not through an invalid gate direction.

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

Use canon memory as context for update signals, not as something to parrot back.

OPTIONAL PROFILE SUMMARY
profile is optional display text only.
If included, keep it to one or two short plain-language lines.
Do not put numeric axis values, percentages, coordinates, or projection math in it.

OPTIONAL NOTES
notes is optional.
Use it for short cautions or clarification that do not belong in structured fields.

DO NOT INCLUDE
- final coordinates
- maturity percentages
- projection math
- canonUpdate
- geometry explanations
- null state or peak-maturity explanations
- any extra top-level field not listed below

REQUIRED JSON SHAPE
{
  "model": "epistemic_octahedron_interpreter_v2",
  "analysis_scope": "thought | stance | worldview_fragment | full_profile_import",
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
  "profile": [],
  "notes": []
}

OPTIONAL TOP-LEVEL FIELDS
- scope_strength
- statement_modes

FINAL INSTRUCTION
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

function formatSimpleListSection(title, items = []) {
  const clean = normalizeList(items);
  if (!clean.length) {
    return `${title}: none`;
  }
  return [title, ...clean.map((item) => `- ${item}`)].join("\n");
}

function formatProfilerMemorySection(memory = {}) {
  const corePrinciples = normalizeList(memory.core_principles || memory.corePrinciples || []);
  const coreBoundaries = normalizeList(memory.core_boundaries || memory.coreBoundaries || []);
  const metaMarkers = normalizeList(
    memory.meta_epistemic_markers || memory.metaEpistemicMarkers || [],
  );
  const riskNotes = normalizeList(memory.risk_notes || memory.riskNotes || []);

  return [
    formatSimpleListSection("Profiler memory: core principles", corePrinciples),
    formatSimpleListSection("Profiler memory: core boundaries", coreBoundaries),
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

export {
  CANON_LAYER_KEYS,
  createEmptyLayeredCanon,
  normalizeLayeredCanon,
  hasAnyLayeredItems,
};

export function buildLLMPacket({
  profileText = "",
  principlesByLayer = {},
  boundariesByLayer = {},
  profilerMemory = {},
} = {}) {
  const cleanProfileText = String(profileText || "").trim();
  const sections = [
    "SYSTEM FRAME",
    "You are reading one extractor contract and one schema for the Epistemic Octahedron pipeline.",
    "Return JSON only.",
    "",
    "CANON MEMORY",
    formatLayeredSection("Principles by layer", principlesByLayer),
    formatLayeredSection("Boundaries by layer", boundariesByLayer),
    "",
    "PROFILER MEMORY",
    formatProfilerMemorySection(profilerMemory),
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
