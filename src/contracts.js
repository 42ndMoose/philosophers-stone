
function normalizeList(items = []) {
  return (Array.isArray(items) ? items : [items])
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        return String(
          item.text ||
            item.value ||
            item.normalized ||
            item.principle ||
            item.boundary ||
            item.note ||
            "",
        ).trim();
      }
      return "";
    })
    .filter(Boolean);
}

function formatSimpleListSection(title, items = []) {
  const clean = normalizeList(items);
  if (!clean.length) return `${title}: none`;
  return [title, ...clean.map((item) => `- ${item}`)].join("\n");
}

function formatProfilerMemorySection(memory = {}) {
  const corePrinciples = normalizeList(memory.core_principles || []);
  const coreBoundaries = normalizeList(memory.core_boundaries || []);
  const metaMarkers = normalizeList(memory.meta_epistemic_markers || []);
  const riskNotes = normalizeList(memory.risk_notes || []);

  return [
    formatSimpleListSection("Profiler memory: principles", corePrinciples),
    formatSimpleListSection("Profiler memory: boundaries", coreBoundaries),
    formatSimpleListSection("Profiler memory: meta-epistemic markers", metaMarkers),
    formatSimpleListSection("Profiler memory: risk notes", riskNotes),
  ].join("\n\n");
}

const CORE_CONTRACT = `EPISTEMIC OCTAHEDRON INTERPRETER CONTRACT
version: 6.1

PURPOSE
The LLM is an extractor and canon optimizer only.
It does not compute final scores, maturity percentages, or final x y z coordinates.
The profiler later converts semantic values into the octahedron surface where |x| + |y| + |z| = 1.

CONTEXT DISCIPLINE
Use only the text inside this packet.
Do not browse the web.
Do not call tools.
Do not import outside facts or context.
If the input mentions named entities, politics, history, science, or current events, extract only what the user text itself supports.

AXIS DEFINITIONS
- x negative = practicality
- x positive = empathy
- z negative = knowledge
- z positive = wisdom
- y negative = negative epistemic stability
- y positive = positive epistemic stability

Operational meanings:
- empathy / practicality = orientation toward persons versus functional demands
- wisdom / knowledge = orientation toward deep judgment versus information, accumulation, or technical grasp
- epistemic stability = coherence, reality-tracking, self-correction, and resistance to delusion under reflection or pressure

Model distinctions:
- the upper vertex is objective peak philosophical maturity
- the lower vertex is epistemic collapse
- the origin is a pre-philosophical null state
- non-asymmetry by absence is not the same as non-asymmetry by reflective integration

INTERPRETIVE ROLE
Your job is to fill a dense evidence grid.
You are not deciding the final plot.
You are not choosing the final dominant aspect.
You are not awarding maturity.
You are reporting how much support the text gives to each bucket.

PRIMARY PROFILER GRID
Always return profiler_mode = "dense_support_v1".
Always return semantic_grid.
The semantic_grid is primary for the profiler.
The other human-readable fields should remain consistent with it.

Grid buckets:
- empathy
- practicality
- wisdom
- knowledge
- x_integration
- z_integration
- y_positive
- y_negative

For every semantic_grid bucket, return:
- support from 0.0 to 1.0
- confidence from 0.0 to 1.0
- evidence_spans as an array of short text spans, which may be empty

Interpretation rules for the grid:
- support = how much the text itself supports that bucket
- confidence = how sure you are that the extraction is correct
- no evidence means support 0.0 and an empty evidence_spans array
- wording nuance belongs in this extraction layer, not in later calculator heuristics
- be conservative with short or slogan-like inputs

Bucket meanings:
- empathy = support for person-centered concern, care, mercy, humane regard, or relational priority
- practicality = support for function, feasibility, consequence, logistics, viability, survival, or operational demands
- wisdom = support for judgment, proportion, synthesis, mature framing, or wider orientation
- knowledge = support for information, fact-accumulation, technical grasp, literal precision, or observational detail
- x_integration = support that empathy and practicality are being handled together rather than merely one-sided
- z_integration = support that wisdom and knowledge are being handled together rather than merely one-sided
- y_positive = support for coherence, self-correction, counter-consideration, reality contact, or non-self-sealing stability
- y_negative = support for false certainty, contradiction evasion, reality detachment, dogmatic closure, self-sealing, or collapse markers

EXTRACTION DISCIPLINE
1. Extract portable philosophical structure, not final verdicts.
2. Prefer under-calling over over-calling.
3. Use evidence spans whenever possible.
4. Only emit triggered gate events when the text gives actual evidence for or against a gate.
5. Silence is neutral. Do not emit gate failures by absence.
6. Do not compute the final plot.
7. Do not let display labels or prior canon wording bias extraction.
8. Use canon memory as context, not as something to parrot back.
9. If evidence is too thin for a gate event, leave the gate empty and keep the support in semantic_grid or local signals instead.
10. Do not infer rich structure from generic low-depth wording.
11. Pole buckets are strict. Populate empathy, practicality, wisdom, or knowledge only when the text itself directly indicates that axis meaning.
12. Generic coexistence, pluralism, civility, harmony, unity, or balance language does not by itself populate empathy, practicality, wisdom, or knowledge.
13. A bare coexistence claim may justify a weak x_integration signal and a weak y_positive signal when the text supports compatibility across opposition.
14. Do not populate z_integration unless the text actually shows handling of the wisdom/knowledge tension.
15. Do not infer y_negative unless the text itself gives negative epistemic evidence.
16. Do not trigger G2_non_strawman from a bare coexistence claim unless the text actually characterizes another view fairly enough to show contact with it.
17. Acknowledging two sides is weaker than integrating them.

SCOPE CLASSIFICATION
Always classify the input as one of:
- thought
- stance
- worldview_fragment
- full_profile_import

scope_strength may be:
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

AXIS EVENTS
Do not emit final x or z scores.
Emit evidence instead.

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

LOCAL Y SIGNALS
Each local y signal should include:
- type
- strength
- confidence
- evidence_span

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

Each triggered_gate_event should include:
- gate
- direction = positive or negative only
- strength = weak | moderate | strong
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

SUGGESTED OPTIMIZATION
Look at three things:
- current profile principles and boundaries
- principles and boundaries created from this input
- existing suggested optimization, if any

Then output concise suggested optimization in canonOptimization.
These are suggestions only, not mandatory replacements.
They should compress, merge, or sharpen wording without losing important meaning.

PROFILE SUMMARY LINE
The profile array is display text only.
Keep it plain-language.
Do not put numeric axis values, percentages, coordinates, or projection math in it.

REQUIRED JSON SHAPE
{
  "model": "epistemic_octahedron_interpreter_v2",
  "profiler_mode": "dense_support_v1",
  "analysis_scope": "thought | stance | worldview_fragment | full_profile_import",
  "scope_strength": "low | medium | high",
  "statement_modes": [],
  "profile": [
    "short display summary only"
  ],
  "semantic_grid": {
    "empathy": { "support": 0.0, "confidence": 0.0, "evidence_spans": [] },
    "practicality": { "support": 0.0, "confidence": 0.0, "evidence_spans": [] },
    "wisdom": { "support": 0.0, "confidence": 0.0, "evidence_spans": [] },
    "knowledge": { "support": 0.0, "confidence": 0.0, "evidence_spans": [] },
    "x_integration": { "support": 0.0, "confidence": 0.0, "evidence_spans": [] },
    "z_integration": { "support": 0.0, "confidence": 0.0, "evidence_spans": [] },
    "y_positive": { "support": 0.0, "confidence": 0.0, "evidence_spans": [] },
    "y_negative": { "support": 0.0, "confidence": 0.0, "evidence_spans": [] }
  },
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
  "canonOptimization": {
    "principles": [],
    "boundaries": [],
    "notes": []
  },
  "notes": []
}

FINAL INSTRUCTION
Return valid JSON only.`;

export function buildLLMPacket({
  profileText = "",
  currentPrinciples = [],
  currentBoundaries = [],
  suggestedPrinciples = [],
  suggestedBoundaries = [],
  profilerMemory = {},
} = {}) {
  const cleanProfileText = String(profileText || "").trim();
  const sections = [
    "SYSTEM FRAME",
    "You are reading one contract and one schema for the Epistemic Octahedron pipeline.",
    "Interpret the user text semantically and return JSON only.",
    "",
    "CURRENT PROFILE CANON",
    formatSimpleListSection("Current principles", currentPrinciples),
    formatSimpleListSection("Current boundaries", currentBoundaries),
    "",
    "CURRENT SUGGESTED OPTIMIZATION",
    formatSimpleListSection("Suggested principles", suggestedPrinciples),
    formatSimpleListSection("Suggested boundaries", suggestedBoundaries),
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

function sliderPercentFromAxis(axisValue) {
  const value = Number(axisValue) || 0;
  return (value + 1) * 50;
}

function formatPercent(value) {
  const num = Number(value) || 0;
  return `${num.toFixed(1)}%`;
}

function formatCoord(value) {
  const num = Number(value) || 0;
  return num.toFixed(3).replace("-0.000", "0.000");
}

function formatComputedSection(computed = {}) {
  const point = computed.point || {};
  const x = Number(point.x) || 0;
  const y = Number(point.y) || 0;
  const z = Number(point.z) || 0;
  const coveragePercent = Number(computed.coveragePercent);

  const empathy = sliderPercentFromAxis(x);
  const practicality = 100 - empathy;
  const wisdom = sliderPercentFromAxis(z);
  const knowledge = 100 - wisdom;
  const stability = Math.abs(y) * 100;
  const lines = [
    "Computed profiler values",
    "These percentages are derived directly from the plotted point.",
    "Lateral percentages are stability-percent dependent because higher |Y| compresses lateral movement on the surface.",
    `Empathy percentage: ${formatPercent(empathy)}`,
    `Practicality percentage: ${formatPercent(practicality)}`,
    `Wisdom percentage: ${formatPercent(wisdom)}`,
    `Knowledge percentage: ${formatPercent(knowledge)}`,
    `Epistemic stability percentage: ${formatPercent(stability)} (${y >= 0 ? "positive" : "negative"} direction)`,
  ];
  if (Number.isFinite(coveragePercent)) {
    lines.push(`Coverage percentage: ${formatPercent(coveragePercent)}`);
  }
  lines.push(`X: ${formatCoord(x)}`);
  lines.push(`Y: ${formatCoord(y)}`);
  lines.push(`Z: ${formatCoord(z)}`);
  return lines.join("\n");
}

export function buildProfilerAssessmentPacket({
  name = "",
  additionalInfo = "",
  computed = {},
} = {}) {
  const sections = [
    "SYSTEM FRAME",
    "You are reading a finalized profiler snapshot from the Epistemic Octahedron pipeline.",
    "Use this snapshot to describe the compiled philosophy, not the wider system.",
    "",
    "TASK",
    "Write a concise overview of the profile's philosophy from the plotted point and the supplied context.",
    "Do not explain implementation mechanics.",
    "Treat the name as display-only.",
    "Do not invent biography.",
    "Use plain language and low jargon.",
    "Tell the reader at least one thing they may not notice immediately from the coordinates alone.",
    "Connect the interpretation to what the profile seems to care about most.",
    "",
    "GEOMETRY REFERENCE",
    "The plotted point lies on the octahedron surface where |x| + |y| + |z| = 1 whenever the worldview is active enough to project.",
    "x negative = Practicality, x positive = Empathy.",
    "z negative = Knowledge, z positive = Wisdom.",
    "y negative = Negative Epistemic Stability, y positive = Positive Epistemic Stability.",
    "Epistemic collapse is the lower vertex: maximal active negative epistemic stability.",
    "Objective peak philosophical maturity is the upper vertex: all four lateral tensions considered without passive destabilization by asymmetry.",
    "The epistemic borderline is y = 0: net 0 convergence between positive and negative epistemic stability.",
    "",
    "DEFINITIONS",
    "Empathy / Practicality\t- Ethical and situational orientation toward persons versus functional demands",
    "Wisdom / Knowledge\t- Orientation toward deep judgment versus information, accumulation, or technical grasp",
    "Negative / Positive epistemic stability\t- Degree of reality-tracking, coherence, maturity, resistance to delusion, and ability to self-correct",
    "Epistemic stability is the degree to which an individual’s worldview is able to remain coherent, reality-tracking, self-corrective, and non-delusional under internal reflection and external pressure.",
    "Objective peak philosophical maturity is the state represented by the upper vertex of the Epistemic Octahedron, in which the individual has fully considered empathy, practicality, wisdom, and knowledge, understands the possibility of epistemic failure or collapse, and is not passively destabilized by asymmetry among them.",
    "The most important philosophical move in this framework is the distinction between two very different kinds of balance.",
    "At the lower vertex, the four horizontal dimensions are balanced because none has yet been actively integrated into a developed worldview. In the limiting case, this may describe a pre-philosophical null state, of which infancy is one example: a being that has not yet formed a philosophy capable of reflective positioning. This lower balance is therefore not maturity. It is undifferentiated or pre-differentiated balance.",
    "At the upper vertex, the four horizontal dimensions are also balanced, but for the opposite reason. Here they are balanced because they have been encountered, processed, and integrated. This is reflective balance rather than empty balance.",
    "The model therefore rejects the idea that all symmetry is equal. Two people may appear balanced in crude terms while actually occupying opposite ends of philosophical development. One may be unformed. The other may be highly formed. The octahedron distinguishes them cleanly.",
    "Proposition 1. If two states display equal lateral balance but opposite vertical endpoints, then they are structurally non-equivalent. The lower balance is balance by absence, whereas the upper balance is balance by integration.",
    "This proposition is what allows the graph to encode both infancy and philosophical culmination without contradiction.",
    "The lower half of the Epistemic Octahedron should not be treated as a single pathology. It houses several related but non-identical conditions. These may include:",
    "- undeveloped worldview or pre-philosophical nullity,",
    "- distorted reality-tracking,",
    "- immaturity,",
    "- delusion,",
    "- epistemic collapse,",
    "- negative epistemic stability.",
    "These are connected because each reflects some failure of mature epistemic organization, but they should not be collapsed into one label. The graph allows them to occupy different regions in the lower half depending on lateral asymmetry.",
    "Passive ignorance on controversial matters does not by itself imply the lower vertex. If a worldview is active but merely uninformed, hesitant, or underdeveloped, the more appropriate placement is near the equatorial region or only modestly within the lower half. Deeper descent is reserved for cases in which passivity is bound up with stronger epistemic failure, such as distortion, refusal of correction, or false certainty.",
    "The lower vertex can represent a null-balanced pre-philosophical state, but this does not mean every human being must traverse the lower half in the same way. The model is not a claim that development requires literal passage through every negatively stable region.",
    "",
    "PROFILE SNAPSHOT",
    `Name: ${String(name || "").trim() || "unspecified"}`,
    `Additional info: ${String(additionalInfo || "").trim() || "none"}`,
    formatComputedSection(computed),
    "",
    "OUTPUT",
    "Return plain prose only.",
    "Keep it concise, specific, grounded in the coordinates, and readable to a non-technical person.",
    "Start off with what popular philosophical term(s) this profile may associate with the set xyz, by making sense of the definitions. take any additional info into consideration, if any.",
  ];
  return sections.join("\n");
}
