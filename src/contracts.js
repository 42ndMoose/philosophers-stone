
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

function formatRiskEventsSection(items = []) {
  const events = Array.isArray(items) ? items : [];
  if (!events.length) return "Profiler memory: structured risk events: none";
  const lines = ["Profiler memory: structured risk events"];
  for (const event of events.slice(-8)) {
    if (!event || typeof event !== "object") continue;
    const risk = String(event.risk || event.type || "unknown").trim() || "unknown";
    const status = String(event.status || "active").trim() || "active";
    const riskId = String(event.risk_id || event.id || "").trim();
    const introducedBy = event.introduced_by && typeof event.introduced_by === "object" ? event.introduced_by : {};
    const evidence = String(introducedBy.evidence_span || event.evidence_span || "").trim();
    const requirements = Array.isArray(event.repair_requirements) ? event.repair_requirements.join(", ") : "";
    const clearance = event.clearance && typeof event.clearance === "object" ? event.clearance : null;
    const clearanceText = clearance
      ? ` | clearance: ${String(clearance.cleared_by_entry_id || "unknown")} @ ${Number(clearance.confidence_score_0_to_1 || 0).toFixed(2)}`
      : "";
    lines.push(
      `- ${riskId ? `${riskId} | ` : ""}${risk} | status: ${status}${requirements ? ` | repair_requirements: ${requirements}` : ""}${evidence ? ` | evidence: ${evidence}` : ""}${clearanceText}`
    );
  }
  return lines.join("\n");
}

const GATE_SNAPSHOT_ORDER = [
  "G1_counter_consideration",
  "G2_non_strawman",
  "G3_self_correction",
  "G4_contradiction_handling",
  "G5_reality_contact",
  "G6_non_self_sealing",
];

const GATE_STATUS_TO_SCORE = {
  dormant: 0,
  lean_positive: 0.2,
  established_positive: 0.55,
  strong_positive: 0.85,
  lean_negative: -0.2,
  established_negative: -0.55,
  strong_negative: -0.85,
};

function createDormantGateSnapshot() {
  return Object.fromEntries(
    GATE_SNAPSHOT_ORDER.map((gate) => [
      gate,
      {
        score: 0,
        status: "dormant",
        positive_events: 0,
        negative_events: 0,
        last_event_at: null,
        last_evidence_span: null,
      },
    ]),
  );
}

function inferGateSnapshotFromMetaMarkers(memory = {}) {
  const markers = normalizeList(memory.meta_epistemic_markers || []);
  const snapshot = createDormantGateSnapshot();
  let sawGateMarker = false;

  for (const marker of markers) {
    const match = String(marker || "").trim().match(/^(G[1-6]_[^:]+)\s*:\s*([a-z_]+)$/i);
    if (!match) continue;
    const gate = String(match[1] || "").trim();
    const status = String(match[2] || "").trim().toLowerCase();
    if (!GATE_SNAPSHOT_ORDER.includes(gate)) continue;
    if (!Object.prototype.hasOwnProperty.call(GATE_STATUS_TO_SCORE, status)) continue;
    snapshot[gate] = {
      ...snapshot[gate],
      status,
      score: GATE_STATUS_TO_SCORE[status],
    };
    sawGateMarker = true;
  }

  return sawGateMarker ? snapshot : null;
}

function hasProfilerMemoryContent(memory = {}) {
  if (!memory || typeof memory !== "object") return false;
  return [
    "core_principles",
    "core_boundaries",
    "meta_epistemic_markers",
    "risk_notes",
    "gate_snapshot",
    "gateStates",
    "gate_states",
  ].some((key) => Object.prototype.hasOwnProperty.call(memory, key));
}

function extractGateSnapshot(memory = {}, explicitGateSnapshot = null) {
  if (explicitGateSnapshot && typeof explicitGateSnapshot === "object") return explicitGateSnapshot;
  if (!memory || typeof memory !== "object") return null;
  const directSnapshot = memory.gate_snapshot || memory.gateStates || memory.gate_states || null;
  if (directSnapshot && typeof directSnapshot === "object") return directSnapshot;
  const inferredSnapshot = inferGateSnapshotFromMetaMarkers(memory);
  if (inferredSnapshot) return inferredSnapshot;
  if (hasProfilerMemoryContent(memory)) return createDormantGateSnapshot();
  return null;
}

function formatGateSnapshotSection(gateSnapshot = null) {
  const snapshot = gateSnapshot && typeof gateSnapshot === "object" ? gateSnapshot : null;
  if (!snapshot) return "Profiler gate snapshot: none";

  const lines = [
    "Profiler gate snapshot",
    "Read-only prior gate state from the profiler. Use it as context, not as proof about the current text.",
  ];

  for (const gate of GATE_SNAPSHOT_ORDER) {
    const raw = snapshot[gate] && typeof snapshot[gate] === "object" ? snapshot[gate] : {};
    const status = String(raw.status || "dormant").trim() || "dormant";
    const score = Number(raw.score || 0);
    const positiveEvents = Number(raw.positive_events || 0);
    const negativeEvents = Number(raw.negative_events || 0);
    const lastEvidenceSpan = String(raw.last_evidence_span || "").trim() || "none";
    lines.push(
      `- ${gate} | status: ${status} | score: ${score.toFixed(3)} | positive_events: ${positiveEvents} | negative_events: ${negativeEvents} | last_evidence_span: ${lastEvidenceSpan}`
    );
  }

  return lines.join("\n");
}

function formatProfilerMemorySection(memory = {}, explicitGateSnapshot = null) {
  const corePrinciples = normalizeList(memory.core_principles || []);
  const coreBoundaries = normalizeList(memory.core_boundaries || []);
  const metaMarkers = normalizeList(memory.meta_epistemic_markers || []);
  const riskNotes = normalizeList(memory.risk_notes || []);
  const riskEvents = Array.isArray(memory.risk_events) ? memory.risk_events : [];
  const gateSnapshot = extractGateSnapshot(memory, explicitGateSnapshot);

  return [
    formatSimpleListSection("Profiler memory: principles", corePrinciples),
    formatSimpleListSection("Profiler memory: boundaries", coreBoundaries),
    formatSimpleListSection("Profiler memory: meta-epistemic markers", metaMarkers),
    formatSimpleListSection("Profiler memory: risk notes", riskNotes),
    formatRiskEventsSection(riskEvents),
    formatGateSnapshotSection(gateSnapshot),
  ].join("\n\n");
}

const CORE_CONTRACT = `EPISTEMIC OCTAHEDRON EXTRACTOR CONTRACT v7.0

ROLE
Extract structured evidence only. Do not compute final coordinates, maturity percentages, or projection math. Use only this packet. Return JSON only.

AXES
x: practicality(-) / empathy(+). z: knowledge(-) / wisdom(+). y: negative epistemic stability(-) / positive epistemic stability(+).
Null origin means no active worldview yet. Once profiler memory shows an active worldview, weak or cancelling current text is underdetermined refinement, not a return to null.

TARGETING
Profile only the intended target. Use profile_target_frame to separate authorial self, described subject, criticized system, quoted view, or mixed target.
If profile_target_frame = authorial_endorsement, the profiled target is the author's stance even when that stance criticizes a system, person, ideology, or group. Use criticized_system only for epistemic qualities belonging to the criticized object itself.
semantic_grid.y_positive and semantic_grid.y_negative are for the profiled target only.
Do not place criticized-system/person/group failure in semantic_grid.y_negative; y_negative requires a defect in the profiled reasoning itself.
Outside-target failures go in local_y_* with target = criticized_system | described_other | quoted_view | mixed | unclear, not in self semantic y.
Silence is neutral. Do not infer failure from absence. Missing caveats, missing examples, or missing discussion of context may be unresolved_scope_gaps, but they are not y_negative, failed_gates, active risks, or negative gate events unless the text positively shows closure, reality-detachment, contradiction, or refusal of correction.

EVIDENCE RULES
Use support/confidence 0..1 and evidence_spans. Conservative if uncertain.
Use dimension_consideration for empathy, practicality, wisdom, knowledge with status only from: directly_engaged, acknowledged, tradeoff_engaged, explicitly_deprioritized, explicitly_rejected, not_evidenced_here.
Criticizing an excessive or distorted form of a dimension is not rejection of that dimension.
A text may be peak-eligible within its own claimed scope if it covers the scope it opens, integrates the relevant dimensions, and shows no self-targeted negative epistemic pressure. A scope-relative peak certifies only the submitted referent, not a whole person/worldview unless analysis_scope = full_profile_import.

GATES
Allowed gates only: G1_counter_consideration, G2_non_strawman, G3_self_correction, G4_contradiction_handling, G5_reality_contact, G6_non_self_sealing.
Use GATE_EMISSION_POLICY below. triggered_gate_events require clear positive/negative evidence. gate_update_proposals are for weak but material evidence, state-aware reads, reopen/soften/reverse/reinforce cases, or materially present gates not strong enough for a direct event. No neutral triggered events.
When current text repairs prior closure, false certainty, or contradiction, emit retractions/resolved_contradictions/restatements so the profiler can clear active stale risk.
Relevant gates are only gates materially evidenced by the current text. Irrelevant untouched gates are not hidden defects. Do not assign self-failure when failure belongs to an outside target. A negative gate requires positive evidence of a reasoning failure; do not emit negative G5/G6, failed_gates, or active reality_detachment/self_sealing merely because the stance did not mention every caveat, exception, outcome, or openness marker.

GATE_EMISSION_POLICY
{
  "consistency": {
    "relevant_gates_must_be_supported_by": ["triggered_gate_events", "gate_update_proposals"],
    "do_not_silently_drop_material_gate": true,
    "if_clear_evidence": "emit triggered_gate_event",
    "if_weak_but_material_evidence": "emit gate_update_proposal",
    "if_thematically_related_only": "omit from relevant_gates"
  },
  "gates": {
    "G1_counter_consideration": {
      "trigger_when": ["real counter-consideration", "qualified or non-absolute framing", "category/boundary distinction"],
      "proposal_when": ["weak but material qualification"]
    },
    "G2_non_strawman": {
      "trigger_when": ["opposing concern is represented fairly enough for real contact", "criticized view is distinguished from a weaker caricature"],
      "proposal_when": ["partial fairness toward opposing concern"]
    },
    "G3_self_correction": {
      "trigger_when": ["positive: author revises own framing", "positive: acknowledges overstatement/error", "positive: states what would change the view", "negative: self-targeted false certainty, perfection claim, or refusal of fallibility/correction"],
      "proposal_when": ["positive repair/revision is present but partial/implicit", "negative false-certainty risk is present but weak/implicit"],
      "risk_link": "active self-targeted false_certainty should normally emit G3 negative, or at least a G3 negative gate_update_proposal"
    },
    "G4_contradiction_handling": {
      "trigger_when": ["explicitly handles/resolves a tension, contradiction, or tradeoff", "local_extraction.tradeoffs is nonempty AND axis_events.x_integration_events or z_integration_events contains fair_tradeoff/integrated_tension with strength_label moderate|strong"],
      "proposal_when": ["tradeoff is present but resolution is partial, implicit, or low confidence"],
      "do_not_trigger_when": ["tradeoff is merely mentioned but not handled"]
    },
    "G5_reality_contact": {
      "trigger_when": ["consequences", "constraints", "feasibility", "incentives", "causal mechanisms", "health/material/social outcomes", "transition conditions"],
      "proposal_when": ["real-world contact is present but weakly developed"],
      "note": "statistics are not required"
    },
    "G6_non_self_sealing": {
      "trigger_when": ["positive: testability", "positive: openness to serious correction", "positive: refusal to treat disagreement as automatic corruption", "positive: view remains answerable to reality", "negative: view is sealed from correction or treats its own certainty as immune to challenge"],
      "proposal_when": ["positive non-self-sealing posture is present but partial/implicit", "negative self-sealing posture is present but partial/implicit"]
    }
  }
}

RISK EVENTS
risk_events are structured memory updates for active, softened, or cleared epistemic risks. They are not gates. Use them only for risks in the profiled reasoning itself.
Do not erase historical risk evidence. A cleared risk should preserve the original risk record while adding clearance evidence.
Use status active for a newly detected risk, softened for partially repaired risk, and cleared only when the repair is strong enough. Suggested confidence interpretation: below 0.50 = do not clear, 0.50-0.74 = softened, 0.75-1.00 = cleared.
Use repair_requirements to state what would repair an active risk, such as retraction, answerable_to_reality, non_self_sealing, resolve_tension, or coherence_check.

OUTPUT ENUMS
analysis_scope: thought | stance | worldview_fragment | full_profile_import
scope_strength: low | medium | high
profile_target_frame: authorial_endorsement | self_description | described_subject | cautionary_example | quoted_view | mixed_or_ambiguous
strength_label: weak | moderate | strong
target: self | described_other | criticized_system | quoted_view | mixed | unclear
risk status: active | softened | cleared
claim commitment: asserted | conditional | hypothetical | quoted | illustrative
scope_effect/scope_expansion: none | contained | widened

REQUIRED JSON SHAPE
{
  "model": "epistemic_octahedron_interpreter_v3",
  "profiler_mode": "dense_support_v2",
  "analysis_scope": "thought | stance | worldview_fragment | full_profile_import",
  "scope_strength": "low | medium | high",
  "profile_target_frame": "authorial_endorsement | self_description | described_subject | cautionary_example | quoted_view | mixed_or_ambiguous",
  "statement_modes": [],
  "profile": ["short display summary only"],
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
  "dimension_consideration": {
    "empathy": { "status": "not_evidenced_here", "confidence": 0.0, "basis_type": "none", "evidence_spans": [] },
    "practicality": { "status": "not_evidenced_here", "confidence": 0.0, "basis_type": "none", "evidence_spans": [] },
    "wisdom": { "status": "not_evidenced_here", "confidence": 0.0, "basis_type": "none", "evidence_spans": [] },
    "knowledge": { "status": "not_evidenced_here", "confidence": 0.0, "basis_type": "none", "evidence_spans": [] }
  },
  "claim_commitments": [],
  "scope_profile": {
    "claimed_scope": "narrow | moderate | broad",
    "scope_complete_for_text": true,
    "scope_expansion": "none | contained | widened",
    "unresolved_scope_gaps": [],
    "relevant_gates": [],
    "irrelevant_gates": []
  },
  "local_extraction": {
    "principles": [],
    "boundaries": [],
    "claimed_values": [],
    "tradeoffs": [],
    "contradictions": []
  },
  "axis_events": {
    "x_pole_evidence": [
      { "pole": "empathy | practicality", "strength_label": "weak | moderate | strong", "confidence_score_0_to_1": 0.0, "evidence_span_text": "" }
    ],
    "x_integration_events": [
      { "type": "explicit_balance | fair_tradeoff | integrated_tension", "strength_label": "weak | moderate | strong", "confidence_score_0_to_1": 0.0, "evidence_span_text": "" }
    ],
    "z_pole_evidence": [
      { "pole": "wisdom | knowledge", "strength_label": "weak | moderate | strong", "confidence_score_0_to_1": 0.0, "evidence_span_text": "" }
    ],
    "z_integration_events": [
      { "type": "explicit_balance | fair_tradeoff | integrated_tension", "strength_label": "weak | moderate | strong", "confidence_score_0_to_1": 0.0, "evidence_span_text": "" }
    ]
  },
  "local_y_positive_signals": [
    { "type": "counter_consideration", "strength_label": "weak | moderate | strong", "confidence_score_0_to_1": 0.0, "target": "self | described_other | criticized_system | quoted_view | mixed | unclear", "evidence_span_text": "" }
  ],
  "local_y_negative_signals": [
    { "type": "false_certainty", "strength_label": "weak | moderate | strong", "confidence_score_0_to_1": 0.0, "target": "self | described_other | criticized_system | quoted_view | mixed | unclear", "evidence_span_text": "" }
  ],
  "risk_events": [
    { "risk": "false_certainty | contradiction | self_sealing | reality_detachment | dogmatic_closure | contradiction_evasion | other", "status": "active | softened | cleared", "target": "self | described_other | criticized_system | quoted_view | mixed | unclear", "confidence_score_0_to_1": 0.0, "addresses_risk_id": "", "evidence_span_text": "", "repair_requirements": [] }
  ],
  "triggered_gate_events": [
    { "gate": "G1_counter_consideration", "direction": "positive | negative", "strength_label": "weak | moderate | strong", "confidence_score_0_to_1": 0.0, "novelty_score_0_to_1": 0.0, "target": "self | described_other | criticized_system | quoted_view | mixed | unclear", "evidence_span_text": "" }
  ],
  "gate_update_proposals": [
    { "gate": "G1_counter_consideration", "local_direction": "positive | negative | neutral", "proposed_effect": "reopen | reinforce | soften | reverse | no_change", "confidence_score_0_to_1": 0.0, "evidence_span_text": "", "reason": "" }
  ],
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
    "restatements": [],
    "cleared_risks": [],
    "softened_risks": []
  },
  "canonOptimization": {
    "principles": [],
    "boundaries": [],
    "notes": []
  },
  "notes": []
}

FINAL INSTRUCTION
Return valid JSON only. Use a json code block whenever possible.`;

export function buildLLMPacket({
  profileText = "",
  currentPrinciples = [],
  currentBoundaries = [],
  suggestedPrinciples = [],
  suggestedBoundaries = [],
  profilerMemory = {},
  gateSnapshot = null,
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
    formatProfilerMemorySection(profilerMemory, gateSnapshot),
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

function formatSignedCoord(value) {
  const num = Number(value) || 0;
  const fixed = num.toFixed(3).replace("-0.000", "0.000");
  if (fixed === "0.000") return fixed;
  return num > 0 ? `+${fixed}` : fixed;
}

function formatComputedSection(computed = {}) {
  const params = computed.params || {};
  const semantics = params.semantics || {};
  const uiLike = params.uiLike || {};
  const point = computed.point || {};
  const x = Number(point.x) || 0;
  const y = Number(point.y) || 0;
  const z = Number(point.z) || 0;
  const coveragePercent = Number.isFinite(Number(computed.coveragePercent))
    ? Number(computed.coveragePercent)
    : Number(uiLike.coveragePercent);

  const projectedEmpathy = sliderPercentFromAxis(x);
  const projectedPracticality = 100 - projectedEmpathy;
  const projectedWisdom = sliderPercentFromAxis(z);
  const projectedKnowledge = 100 - projectedWisdom;
  const projectedStability = Math.abs(y) * 100;
  const hasSemanticReadout = [semantics.a, semantics.b, semantics.s].some((value) =>
    Number.isFinite(Number(value)),
  );

  const lines = ["Computed profiler values"];

  if (hasSemanticReadout) {
    lines.push("Semantic layer before surface projection");
    lines.push(`a: ${formatSignedCoord(semantics.a)}`);
    lines.push(`b: ${formatSignedCoord(semantics.b)}`);
    lines.push(`s: ${formatSignedCoord(semantics.s)}`);
    lines.push(
      `Empathy semantic percentage: ${formatPercent(
        uiLike.empathyPercent ?? sliderPercentFromAxis(semantics.a),
      )}`,
    );
    lines.push(
      `Practicality semantic percentage: ${formatPercent(
        uiLike.practicalityPercent ?? (100 - sliderPercentFromAxis(semantics.a)),
      )}`,
    );
    lines.push(
      `Wisdom semantic percentage: ${formatPercent(
        uiLike.wisdomPercent ?? sliderPercentFromAxis(semantics.b),
      )}`,
    );
    lines.push(
      `Knowledge semantic percentage: ${formatPercent(
        uiLike.knowledgePercent ?? (100 - sliderPercentFromAxis(semantics.b)),
      )}`,
    );
    lines.push(
      `Epistemic stability semantic percentage: ${formatPercent(
        Math.abs(Number(uiLike.stabilityPercent ?? ((Number(semantics.s) || 0) * 100))),
      )} (${(Number(semantics.s) || 0) >= 0 ? "positive" : "negative"} direction)`,
    );
    if (Number.isFinite(Number(semantics.yCoverage))) {
      lines.push(`Gate coverage percentage: ${formatPercent((Number(semantics.yCoverage) || 0) * 100)}`);
    }
    lines.push("");
  }

  lines.push("Projected surface point");
  lines.push("These projected percentages are derived from the plotted point after surface normalization.");
  lines.push(
    "Lateral projected percentages compress toward 50% as |Y| increases because the active worldview is being projected onto the octahedron surface.",
  );
  lines.push(`Empathy projected percentage: ${formatPercent(projectedEmpathy)}`);
  lines.push(`Practicality projected percentage: ${formatPercent(projectedPracticality)}`);
  lines.push(`Wisdom projected percentage: ${formatPercent(projectedWisdom)}`);
  lines.push(`Knowledge projected percentage: ${formatPercent(projectedKnowledge)}`);
  lines.push(
    `Epistemic stability projected percentage: ${formatPercent(projectedStability)} (${y >= 0 ? "positive" : "negative"} direction)`,
  );
  if (Number.isFinite(coveragePercent)) {
    lines.push(`Gate coverage percentage: ${formatPercent(coveragePercent)}`);
  }
  lines.push(`X: ${formatCoord(x)}`);
  lines.push(`Y: ${formatCoord(y)}`);
  lines.push(`Z: ${formatCoord(z)}`);
  return lines.join("\n");
}


export function getGateSnapshotFromMemory(profilerMemory = {}) {
  return extractGateSnapshot(profilerMemory) || null;
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
    "The coordinate origin is the pre-philosophical null state: no active worldview has formed strongly enough to be plotted on the surface.",
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
    "The most important philosophical move in this framework is the distinction between the null origin, the lower vertex, and the upper vertex.",
    "At the coordinate origin, the horizontal dimensions are not in active tension because no worldview has yet formed strongly enough to be plotted on the surface. This is pre-philosophical nullity, not maturity and not pathology.",
    "At the lower vertex, the worldview is active but maximally negatively stable. This is epistemic collapse, not empty balance and not the null state.",
    "At the upper vertex, the horizontal dimensions are balanced because they have been encountered, processed, and integrated. This is reflective balance rather than undeveloped absence.",
    "The model therefore rejects the idea that all symmetry is equal. Two states can look laterally balanced while being structurally different because one may be null, one collapsed, and one maturely integrated.",
    "The lower half of the Epistemic Octahedron should not be treated as a single pathology. It houses several related but non-identical conditions. These may include:",
    "- distorted reality-tracking,",
    "- immaturity,",
    "- delusion,",
    "- false certainty,",
    "- negative epistemic stability.",
    "These are connected because each reflects some failure of mature epistemic organization, but they should not be collapsed into one label. The graph allows them to occupy different regions in the lower half depending on lateral asymmetry.",
    "Passive ignorance on controversial matters does not by itself imply the lower vertex. If a worldview is active but merely uninformed, hesitant, or underdeveloped, the more appropriate placement is near the equatorial region or only modestly within the lower half. Deeper descent is reserved for cases in which passivity is bound up with stronger epistemic failure, such as distortion, refusal of correction, or false certainty.",
    "Development does not require literal passage through every negatively stable region. The origin is a reference point for non-activated worldview, while empirical plotting may begin near the equator or in the lower positive range once a worldview becomes active enough to plot.",
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