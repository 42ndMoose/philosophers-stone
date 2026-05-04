
const DEFAULT_GATE_WEIGHTS = {
  G1_counter_consideration: 0.8,
  G2_non_strawman: 1.0,
  G3_self_correction: 1.1,
  G4_contradiction_handling: 1.2,
  G5_reality_contact: 1.25,
  G6_non_self_sealing: 1.1,
};

const DEFAULT_SCOPE_WEIGHTS = {
  thought: 0.4,
  stance: 0.6,
  worldview_fragment: 0.8,
  full_profile_import: 1.0,
};

const DEFAULT_SCOPE_STRENGTH_WEIGHTS = {
  low: 0.75,
  medium: 0.9,
  high: 1.0,
};

const DEFAULT_STRENGTH_WEIGHTS = {
  weak: 0.25,
  moderate: 0.5,
  strong: 0.85,
};

const DEFAULT_LOCAL_Y_SIGNAL_WEIGHTS = {
  positive: {
    counter_consideration: 1.15,
    self_correction: 1.25,
    reality_contact: 1.25,
    coherence: 1.1,
    error_awareness: 1.15,
    revision_openness: 1.2,
    non_strawman_fairness: 1.0,
    legacy_positive: 1.0,
  },
  negative: {
    false_certainty: 0.5,
    self_sealing: 1.3,
    contradiction_evasion: 1.2,
    reality_detachment: 1.2,
    dogmatic_closure: 0.95,
    collapse_marker: 1.4,
    strawman_dependence: 0.4,
    broad_motive_attribution: 0.25,
    legacy_negative: 1.0,
  },
};

const DEFAULT_GATE_TO_LOCAL_SIGNAL_MAP = {
  positive: {
    G1_counter_consideration: "counter_consideration",
    G2_non_strawman: "non_strawman_fairness",
    G3_self_correction: "self_correction",
    G4_contradiction_handling: "coherence",
    G5_reality_contact: "reality_contact",
    G6_non_self_sealing: "revision_openness",
  },
  negative: {
    G1_counter_consideration: "dogmatic_closure",
    G2_non_strawman: "strawman_dependence",
    G3_self_correction: "false_certainty",
    G4_contradiction_handling: "contradiction_evasion",
    G5_reality_contact: "reality_detachment",
    G6_non_self_sealing: "self_sealing",
  },
};

const AXIS_LABELS = {
  empathyPracticality: { positive: "empathy", negative: "practicality" },
  wisdomKnowledge: { positive: "wisdom", negative: "knowledge" },
  epistemicStability: { positive: "stability", negative: "instability" },
};

const DEFAULT_EMPTY_PROFILE_STATE = () => ({
  core_principles: [],
  core_boundaries: [],
  meta_epistemic_markers: [],
  risk_notes: [],
  risk_events: [],
  gate_snapshot: createEmptyGateStateMap(),
});

const DIMENSION_CONSIDERATION_DIMENSIONS = ["empathy", "practicality", "wisdom", "knowledge"];

const DIMENSION_CONSIDERATION_STATUS_PRIORITY = {
  not_evidenced_here: 0,
  acknowledged: 1,
  directly_engaged: 2,
  tradeoff_engaged: 3,
  explicitly_deprioritized: 4,
  explicitly_rejected: 5,
};

const DIMENSION_CONSIDERATION_BASIS_TYPES = new Set([
  "direct_statement",
  "real_tradeoff",
  "stated_constraint",
  "explicit_dismissal",
  "explicit_exclusion",
  "none",
]);

const PROFILE_TARGET_FRAMES = new Set([
  "authorial_endorsement",
  "self_description",
  "described_subject",
  "cautionary_example",
  "quoted_view",
  "mixed_or_ambiguous",
]);

const SELF_MERGING_PROFILE_TARGET_FRAMES = new Set([
  "authorial_endorsement",
  "self_description",
  "mixed_or_ambiguous",
]);

const SIGNAL_ATTRIBUTION_TARGETS = new Set([
  "self",
  "described_other",
  "criticized_system",
  "quoted_view",
  "mixed",
  "unclear",
]);

const STRUCTURED_RISK_STATUSES = new Set(["active", "softened", "cleared"]);

const STRUCTURED_RISK_TYPES = new Set([
  "false_certainty",
  "contradiction",
  "self_sealing",
  "reality_detachment",
  "dogmatic_closure",
  "contradiction_evasion",
  "strawman_dependence",
  "broad_motive_attribution",
  "collapse_marker",
  "other",
]);

const GATE_NAME_LIST = Object.keys(DEFAULT_GATE_WEIGHTS);

const GATE_UPDATE_LOCAL_DIRECTIONS = new Set(["positive", "negative", "neutral"]);
const GATE_UPDATE_PROPOSED_EFFECTS = new Set(["reopen", "reinforce", "soften", "reverse", "no_change"]);
const CLAIM_COMMITMENT_TYPES = new Set(["asserted", "conditional", "hypothetical", "quoted", "illustrative"]);
const CLAIM_SCOPE_EFFECTS = new Set(["none", "contained", "widened"]);
const SCOPE_CLAIMED_LEVELS = new Set(["narrow", "moderate", "broad"]);
const SCOPE_EXPANSION_TYPES = new Set(["none", "contained", "widened"]);

function defaultDimensionConsiderationField() {
  return {
    status: "not_evidenced_here",
    confidence: 0,
    basis_type: "none",
    evidence_spans: [],
  };
}

function defaultScopeProfileField(claimedScope = "moderate") {
  return {
    claimed_scope: SCOPE_CLAIMED_LEVELS.has(claimedScope) ? claimedScope : "moderate",
    scope_complete_for_text: null,
    scope_expansion: "none",
    unresolved_scope_gaps: [],
    relevant_gates: [],
    irrelevant_gates: [],
  };
}

function cloneJSON(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanString(value) {
  return String(value || "").trim();
}

function cleanStringList(items = []) {
  return (Array.isArray(items) ? items : [items])
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        return cleanString(
          item.normalized ||
            item.text ||
            item.value ||
            item.note ||
            item.reason ||
            item.principle ||
            item.boundary,
        );
      }
      return "";
    })
    .filter(Boolean);
}

function dedupeLatestFirst(items = []) {
  const seen = new Set();
  const out = [];
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const value = cleanString(items[i]);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function normalizeEvidenceSpan(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanString(item)).filter(Boolean).join(" | ");
  }
  return cleanString(value);
}

function createEmptyGateStateMap() {
  return Object.fromEntries(
    GATE_NAME_LIST.map((gate) => [
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

function collectTextSnippets(value) {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  const out = [];
  for (const key of ["normalized", "evidence_span", "claim_a", "claim_b", "reason", "note"]) {
    if (typeof value[key] === "string" && value[key].trim()) out.push(value[key]);
  }
  if (Array.isArray(value.evidence_spans)) {
    for (const item of value.evidence_spans) {
      if (typeof item === "string" && item.trim()) out.push(item);
    }
  }
  return out;
}

function semanticGridField(value = {}) {
  return {
    support: EpistemicProfiler.clamp(Number(value.support ?? 0), 0, 1),
    confidence: EpistemicProfiler.clamp(Number(value.confidence ?? 0), 0, 1),
    evidence_spans: cleanStringList(value.evidence_spans || []),
  };
}

function normalizeDimensionConsiderationField(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const status = cleanString(raw.status).toLowerCase();
  const basisType = cleanString(raw.basis_type).toLowerCase();
  return {
    status:
      Object.prototype.hasOwnProperty.call(DIMENSION_CONSIDERATION_STATUS_PRIORITY, status)
        ? status
        : "not_evidenced_here",
    confidence: EpistemicProfiler.clamp(Number(raw.confidence ?? 0), 0, 1),
    basis_type: DIMENSION_CONSIDERATION_BASIS_TYPES.has(basisType) ? basisType : "none",
    evidence_spans: cleanStringList(raw.evidence_spans || []),
  };
}

function dimensionCritiqueLooksLikeDistortedFormOnly(field = {}, dimension = "") {
  const status = cleanString(field?.status).toLowerCase();
  if (!["explicitly_deprioritized", "explicitly_rejected"].includes(status)) return false;

  const text = cleanStringList([
    field?.basis_type,
    ...(Array.isArray(field?.evidence_spans) ? field.evidence_spans : []),
  ]).join(" ").toLowerCase();
  if (!text) return false;

  const normalizedDimension = cleanString(dimension).toLowerCase();
  const explicitWholeDimensionRejection = new RegExp(
    `\b(reject|rejects|rejected|dismiss|dismisses|dismissed|deny|denies|denied|deprioritize|deprioritizes|deprioritized|against|without|no need for)\s+(all\s+)?${normalizedDimension}\b|\b${normalizedDimension}\b\s+(is|are)\s+(worthless|bad|false|unnecessary|irrelevant|harmful|inferior)`,
    "i",
  ).test(text);
  if (explicitWholeDimensionRejection) return false;

  return /\b(excess|excessive|distorted|distortion|misapplied|misapplication|detached|ungoverned|unbalanced|one-sided|defective|misused|abused|weaponized|performative|surface|comfort|feel-good|momentary|without\s+judg(?:e)?ment|without\s+truth|without\s+practical|without\s+wisdom|becomes\s+defective|becomes\s+indulgence|in_excess|qualified)\b/i.test(text);
}

function sanitizeDimensionConsiderationField(field = {}, dimension = "") {
  const normalized = normalizeDimensionConsiderationField(field);
  if (dimensionCritiqueLooksLikeDistortedFormOnly(normalized, dimension)) {
    return {
      ...normalized,
      status: "tradeoff_engaged",
      downgraded_from_status: cleanString(normalized.status).toLowerCase(),
      downgrade_reason: "criticized_distorted_or_excessive_form_not_dimension_itself",
    };
  }
  return normalized;
}

function normalizeProfileTargetFrame(value) {
  const frame = cleanString(value).toLowerCase();
  return PROFILE_TARGET_FRAMES.has(frame) ? frame : "authorial_endorsement";
}

function defaultAttributionTarget(frame, direction = "neutral") {
  const normalizedFrame = normalizeProfileTargetFrame(frame);
  const normalizedDirection = cleanString(direction).toLowerCase();
  if (normalizedFrame === "self_description") return "self";
  if (normalizedFrame === "described_subject" || normalizedFrame === "cautionary_example") return "described_other";
  if (normalizedFrame === "quoted_view") return "quoted_view";
  if (normalizedFrame === "mixed_or_ambiguous") return "mixed";
  if (normalizedDirection === "positive") return "self";
  if (normalizedDirection === "negative") return "unclear";
  return "unclear";
}

function normalizeAttributionTarget(value, { frame = "authorial_endorsement", direction = "neutral" } = {}) {
  const target = cleanString(value).toLowerCase();
  if (SIGNAL_ATTRIBUTION_TARGETS.has(target)) return target;
  return defaultAttributionTarget(frame, direction);
}

function attributionCountsAsSelf(target) {
  return target === "self" || target === "mixed";
}

function signalTargetsSelf(signal = {}, { frame = "authorial_endorsement", direction = "neutral" } = {}) {
  const target = normalizeAttributionTarget(signal?.target || signal?.signal_target, {
    frame,
    direction,
  });
  return attributionCountsAsSelf(target);
}

function signalTargetsProfiledReferent(signal = {}, { frame = "authorial_endorsement", direction = "neutral" } = {}) {
  const normalizedFrame = normalizeProfileTargetFrame(frame);
  const target = normalizeAttributionTarget(signal?.target || signal?.signal_target, {
    frame: normalizedFrame,
    direction,
  });

  if (target === "mixed") return true;
  if (normalizedFrame === "described_subject" || normalizedFrame === "cautionary_example") {
    return target === "described_other";
  }
  if (normalizedFrame === "quoted_view") return target === "quoted_view";
  return target === "self";
}

function entryHasSelfTargetedNegativeEvidence(entry = {}) {
  const frame = normalizeProfileTargetFrame(entry?.profile_target_frame);
  const negativeSignals = Array.isArray(entry?.local_y_negative_signals) ? entry.local_y_negative_signals : [];
  const negativeGateEvents = Array.isArray(entry?.triggered_gate_events) ? entry.triggered_gate_events : [];
  const contradictions = Array.isArray(entry?.local_extraction?.contradictions) ? entry.local_extraction.contradictions : [];
  const introducedContradictions = Array.isArray(entry?.profile_update_signals?.introduced_contradictions)
    ? entry.profile_update_signals.introduced_contradictions
    : [];

  if (contradictions.length || introducedContradictions.length) return true;
  if (negativeSignals.some((signal) => signalTargetsProfiledReferent(signal, { frame, direction: "negative" }))) return true;
  if (
    negativeGateEvents.some(
      (event) =>
        cleanString(event?.direction).toLowerCase() === "negative" &&
        signalTargetsProfiledReferent(event, { frame, direction: "negative" }),
    )
  ) {
    return true;
  }
  return false;
}

function normalizeGateUpdateProposal(item) {
  if (!item || typeof item !== "object") return null;
  const gate = cleanString(item.gate);
  if (!gate || !GATE_NAME_LIST.includes(gate)) return null;
  const localDirectionRaw = cleanString(item.local_direction).toLowerCase();
  const proposedEffectRaw = cleanString(item.proposed_effect).toLowerCase();
  const local_direction = GATE_UPDATE_LOCAL_DIRECTIONS.has(localDirectionRaw) ? localDirectionRaw : "neutral";
  const proposed_effect = GATE_UPDATE_PROPOSED_EFFECTS.has(proposedEffectRaw) ? proposedEffectRaw : "no_change";
  const rawConfidence = item.confidence_score_0_to_1 ?? item.confidence ?? 0;
  const normalizedConfidence = typeof rawConfidence === "string" ? rawConfidence.trim().toLowerCase() : "";
  const numericConfidence = normalizedConfidence === "high" ? 0.85 : (normalizedConfidence === "medium" || normalizedConfidence === "moderate") ? 0.5 : normalizedConfidence === "low" ? 0.25 : Number(rawConfidence);
  const confidence = EpistemicProfiler.clamp(Number.isFinite(numericConfidence) ? numericConfidence : 0, 0, 1);
  const evidence_span = normalizeEvidenceSpan(item.evidence_span_text || item.evidence_span || item.evidence_spans || "");
  const reason = cleanString(item.reason || item.note || item.rationale || "");
  return {
    gate,
    local_direction,
    proposed_effect,
    confidence,
    evidence_span,
    reason,
  };
}

function normalizeRiskType(value = "") {
  const raw = cleanString(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!raw) return "other";
  if (raw === "false_certainty" || raw === "certainty_risk") return "false_certainty";
  if (raw === "contradiction_introduced" || raw === "introduced_contradiction") return "contradiction";
  return STRUCTURED_RISK_TYPES.has(raw) ? raw : raw;
}

function normalizeRiskStatus(value = "active") {
  const raw = cleanString(value).toLowerCase();
  return STRUCTURED_RISK_STATUSES.has(raw) ? raw : "active";
}

function riskDisplayLabel(risk = "") {
  return normalizeRiskType(risk).replace(/_/g, " ");
}

function normalizeRiskEvent(item, { frame = "authorial_endorsement", entryId = null } = {}) {
  if (!item || typeof item !== "object") {
    const risk = normalizeRiskType(item);
    if (!risk || risk === "other") return null;
    return {
      risk,
      status: "active",
      target: normalizeAttributionTarget("self", { frame, direction: "negative" }),
      confidence: 0.75,
      evidence_span: "",
      repair_requirements: [],
      addresses_risk_id: null,
      source_entry_id: entryId,
      note: "",
    };
  }

  const risk = normalizeRiskType(item.risk || item.type || item.signal_type || item.name || item.value);
  if (!risk) return null;
  const status = normalizeRiskStatus(item.status || item.direction || "active");
  const direction = status === "active" ? "negative" : "positive";
  const rawConfidence = item.confidence_score_0_to_1 ?? item.confidence ?? 0;
  const normalizedConfidence = typeof rawConfidence === "string" ? rawConfidence.trim().toLowerCase() : "";
  const numericConfidence =
    normalizedConfidence === "high"
      ? 0.85
      : (normalizedConfidence === "medium" || normalizedConfidence === "moderate")
        ? 0.5
        : normalizedConfidence === "low"
          ? 0.25
          : Number(rawConfidence);
  return {
    risk,
    status,
    target: normalizeAttributionTarget(item.target || item.signal_target, { frame, direction }),
    confidence: EpistemicProfiler.clamp(Number.isFinite(numericConfidence) ? numericConfidence : 0, 0, 1),
    evidence_span: normalizeEvidenceSpan(item.evidence_span_text || item.evidence_span || item.evidence_spans || item.reason || ""),
    repair_requirements: cleanStringList(item.repair_requirements || item.requirements || []),
    addresses_risk_id: cleanString(item.addresses_risk_id || item.risk_id || item.source_risk_id || "") || null,
    source_entry_id: cleanString(item.source_entry_id || entryId || "") || null,
    note: cleanString(item.note || item.reason || item.rationale || ""),
  };
}

function riskEventTargetsProfiledReferent(event = {}, { frame = "authorial_endorsement" } = {}) {
  const status = normalizeRiskStatus(event.status || "active");
  const direction = status === "active" ? "negative" : "positive";
  return signalTargetsProfiledReferent(event, { frame, direction });
}

function makeRiskId(entryId = "entry", risk = "other", index = 0) {
  return `${cleanString(entryId) || "entry"}:risk:${normalizeRiskType(risk)}:${index + 1}`;
}

function riskNoteType(note = "") {
  const normalized = cleanString(note).toLowerCase();
  const match = normalized.match(/^risk:\s*([^|(]+)/);
  if (!match) return "";
  return normalizeRiskType(match[1]);
}

const REPAIR_STOPWORDS = new Set([
  "about", "above", "after", "again", "against", "also", "been", "being", "between", "both",
  "could", "does", "from", "have", "into", "itself", "made", "must", "only", "over", "prior",
  "should", "that", "their", "there", "these", "this", "those", "through", "when", "where",
  "which", "with", "without", "would", "because", "while", "than", "then", "they", "them",
  "first", "principle", "principles", "mature", "maturity", "person", "soul",
]);

function normalizeRepairText(value = "") {
  return cleanString(value).toLowerCase();
}

function collectProfileUpdateTexts(updateSignals = {}) {
  const out = [];
  for (const key of [
    "new_principles",
    "refined_principles",
    "new_boundaries",
    "refined_boundaries",
    "resolved_contradictions",
    "introduced_contradictions",
    "cleared_gates",
    "failed_gates",
    "retractions",
    "restatements",
  ]) {
    out.push(...cleanStringList(updateSignals?.[key] || []));
  }
  return out;
}

function collectEntryRepairTexts(entry = {}) {
  const updateSignals = entry?.profile_update_signals || {};
  return cleanStringList([
    ...cleanStringList(updateSignals.retractions || []),
    ...cleanStringList(updateSignals.resolved_contradictions || []),
    ...cleanStringList(updateSignals.restatements || []),
    ...cleanStringList(updateSignals.refined_principles || []),
    ...cleanStringList(updateSignals.refined_boundaries || []),
    ...cleanStringList(entry?.notes || []),
  ]);
}

function entryHasExplicitRepairSignals(entry = {}) {
  const updateSignals = entry?.profile_update_signals || {};
  return Boolean(
    cleanStringList(updateSignals.retractions || []).length ||
      cleanStringList(updateSignals.resolved_contradictions || []).length ||
      cleanStringList(updateSignals.restatements || []).length
  );
}

function repairTokens(text = "") {
  return new Set(
    normalizeRepairText(text)
      .replace(/[^a-z0-9_ -]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !REPAIR_STOPWORDS.has(token))
  );
}

function repairOverlapCount(a = "", b = "") {
  const left = repairTokens(a);
  const right = repairTokens(b);
  let count = 0;
  for (const token of left) if (right.has(token)) count += 1;
  return count;
}

function collectEntryNegativeTexts(entry = {}) {
  const out = [];
  const frame = normalizeProfileTargetFrame(entry?.profile_target_frame);
  for (const signal of Array.isArray(entry?.local_y_negative_signals) ? entry.local_y_negative_signals : []) {
    if (!signalTargetsProfiledReferent(signal, { frame, direction: "negative" })) continue;
    out.push(signal.evidence_span, signal.reason, signal.note, signal.signal_type);
  }
  for (const event of Array.isArray(entry?.triggered_gate_events) ? entry.triggered_gate_events : []) {
    const direction = cleanString(event?.direction).toLowerCase();
    if (direction !== "negative") continue;
    if (!signalTargetsProfiledReferent(event, { frame, direction: "negative" })) continue;
    out.push(event.evidence_span, event.reason, event.note, event.gate);
  }
  for (const contradiction of Array.isArray(entry?.local_extraction?.contradictions) ? entry.local_extraction.contradictions : []) {
    out.push(...collectTextSnippets(contradiction));
  }
  for (const contradiction of Array.isArray(entry?.profile_update_signals?.introduced_contradictions) ? entry.profile_update_signals.introduced_contradictions : []) {
    out.push(...collectTextSnippets(contradiction));
  }
  const gridNegative = entry?.semantic_grid?.y_negative;
  if (gridNegative && Number(gridNegative.support || 0) > 0) {
    out.push(...cleanStringList(gridNegative.evidence_spans || []));
  }
  return cleanStringList(out);
}

function repairEntryAddressesPriorNegative(priorEntry = {}, repairEntry = {}) {
  if (!entryHasExplicitRepairSignals(repairEntry)) return false;
  const repairText = collectEntryRepairTexts(repairEntry).join(" ");
  if (!repairText) return false;
  const negativeText = collectEntryNegativeTexts(priorEntry).join(" ");
  if (!negativeText) return false;

  const repairLooksRelevant =
    /\b(retract|retraction|retracted|resolved|addressed|restated|restatement|spoke too strongly|too strongly|over-strong|overstrong|immunity|correction|revise|revision|re-examin|reopen|unfalsifiable|not automatically|not.*corruption|stable enough|answerable to reality|sealed|immune|firm enough|open enough)\b/i.test(repairText);
  const priorLooksRepairable =
    /\b(contradiction|false certainty|self[- ]?sealing|closure|closed|corruption|re-examin|reopen|question|challenge|objection|first principle|settled foundation|sealed|immune|unfalsifiable|refus|resist|disagreement)\b/i.test(negativeText);

  return repairLooksRelevant && (priorLooksRepairable || repairOverlapCount(repairText, negativeText) >= 2);
}

function entryHasRepairableNegativeMaterial(entry = {}) {
  return collectEntryNegativeTexts(entry).length > 0 || entryHasSelfTargetedNegativeEvidence(entry);
}

function shouldClearPersistentRiskNote(note = "", entry = {}) {
  if (!entryHasExplicitRepairSignals(entry)) return false;
  const normalizedNote = normalizeRepairText(note);
  const repairText = collectEntryRepairTexts(entry).join(" ");
  if (!repairText) return false;

  if (
    /\brisk:\s*contradiction\b/.test(normalizedNote) &&
    /\b(resolved|addressed|restated|spoke too strongly|firm enough|open enough|closure|renewal|re-examin|correction|revision)\b/i.test(repairText)
  ) {
    return true;
  }

  if (
    /\brisk:\s*false certainty\b/.test(normalizedNote) &&
    /\b(spoke too strongly|too strongly|over-strong|overstrong|immunity|immune|re-examin|correction|revise|answerable to reality|unfalsifiable|not automatically|not.*corruption|sealed|open enough|firmness and openness|firm yet open)\b/i.test(repairText)
  ) {
    return true;
  }

  return false;
}

function shouldSupersedePersistentBoundary(boundary = "", entry = {}) {
  if (!entryHasExplicitRepairSignals(entry)) return false;
  const normalizedBoundary = normalizeRepairText(boundary);
  const repairText = collectEntryRepairTexts(entry).join(" ");
  if (!repairText) return false;

  const closureBoundary =
    /\b(reopening settled|persistent questioning|persistent disagreement after evident truth|closure on foundations|sealed foundations|refusal to listen)\b/i.test(normalizedBoundary);
  const repairAgainstClosure =
    /\b(spoke too strongly|too strongly|over-strong|overstrong|immunity|immune|re-examin|not automatically|not.*corruption|unfalsifiable|answerable to reality|serious correction|firm enough.*open|open enough.*true|firmness and openness|firm yet open|sealed)\b/i.test(repairText);

  return closureBoundary && repairAgainstClosure;
}


export class EpistemicProfiler {
  constructor(options = {}) {
    this.config = {
      strengthWeights: { ...DEFAULT_STRENGTH_WEIGHTS },
      scopeWeights: { ...DEFAULT_SCOPE_WEIGHTS },
      scopeStrengthWeights: { ...DEFAULT_SCOPE_STRENGTH_WEIGHTS },
      gateWeights: { ...DEFAULT_GATE_WEIGHTS },
      localYSignalWeights: cloneJSON(DEFAULT_LOCAL_Y_SIGNAL_WEIGHTS),
      axisSaturation: {
        empathyPracticality: 2.5,
        wisdomKnowledge: 2.5,
        epistemicStability: 2.5,
      },
      integrationInfluence: 0.35,
      contradictionPenaltyScale: 0.22,
      positiveGateInfluence: 0.18,
      negativeGateInfluence: 0.5,
      semanticRedundancyFloor: 1.0,
      semanticRedundancyPower: 1.0,
      semanticLateralRedundancyFloor: 1.0,
      semanticIntegrationRedundancyFloor: 1.0,
      semanticYRedundancyFloor: 1.0,
      semanticRestatementPenalty: 1.0,
      semanticHighSimilarityThreshold: 0.72,
      semanticRedundancyDampingEnabled: false,
      gateScoreDampingEnabled: false,
      directPeakOnScopeCompletion: true,
      underSpecifiedPositiveXSeedScale: 0.25,
      underSpecifiedPositiveZSeedScale: 0.35,
      underSpecifiedNegativeXSeedScale: 0.15,
      underSpecifiedNegativeZSeedScale: 0.2,
      underSpecifiedSeedCap: 0.12,
      rejectInvalidTriggeredGateEvents: true,
      epsilon: 1e-9,
      summaryAxisFloor: 0.04,
      scopeExpansionPenaltyScale: 0.45,
      scopePeakAxisTolerance: 0.05,
      scopePeakStabilityThreshold: 0.9,
      scopePeakIntegrationThreshold: 0.22,
      scopePeakRelevantGateCoverageThreshold: 1.0,
      scopePeakAbsoluteGateCoverageThreshold: 0.5,
      scopePeakHighAbsoluteGateCoverageBypassThreshold: 0.65,
      scopePeakCoreGateNames: ["G1_counter_consideration", "G5_reality_contact"],
      scopePeakStabilizerGateNames: ["G3_self_correction", "G4_contradiction_handling", "G6_non_self_sealing"],
      scopePeakRequireCoreGates: true,
      scopePeakRequireStabilizerGate: true,
      scopePeakRequiresNoNegative: true,
      scopePeakStrongDimensionCoverageThreshold: 0.85,
      scopePeakStrongClaimedScopeWeights: { narrow: 0.88, moderate: 0.9, broad: 0.92 },
      scopePeakSoftLiftFloor: 0.82,
      scopePeakSoftLiftCeiling: 0.96,
      scopePeakLateralCompressionStrength: 0.35,
      scopePeakMinimumRawStabilityForSoftLift: 0.62,
      scopePeakMinimumRawStabilityForSnap: 0.72,
      scopePeakScopeTypeWeights: { thought: 0.2, stance: 0.35, worldview_fragment: 0.7, full_profile_import: 1.0 },
      scopePeakScopeStrengthWeights: { low: 0.35, medium: 0.65, high: 1.0 },
      scopeCompleteAsymmetryPenaltyMultiplier: 0.35,
      contextualAxisAnchorEnabled: true,
      contextualAxisAnchorActiveEntryOnly: true,
      contextualAxisAnchorPoleSupportThreshold: 0.75,
      contextualAxisAnchorPoleConfidenceThreshold: 0.7,
      contextualAxisAnchorIntegrationSupportThreshold: 0.8,
      contextualAxisAnchorIntegrationConfidenceThreshold: 0.75,
      contextualAxisAnchorYPositiveThreshold: 0.6,
      contextualAxisAnchorCompressionStrength: 0.85,
      semanticOverflowCeiling: 3,
      nearZeroProjectionGuard: 0.12,
      nearZeroProjectionGuardNegativeEvidenceThreshold: 0.25,
      peakPersistenceGuardEnabled: true,
      peakPersistenceGuardTolerance: 1e-6,
      autoGateSupportEnabled: true,
      autoGateSupportMinConfidence: 0.6,
      absenceBasedNegativeEvidenceGuardEnabled: true,
      ...options,
    };
    this.reset();
  }

  reset() {
    this.state = {
      entries: [],
      gateStates: createEmptyGateStateMap(),
      profileState: DEFAULT_EMPTY_PROFILE_STATE(),
      finalized: null,
    };
  }

  static clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  static formatSigned(value, digits = 2) {
    const num = Number(value);
    if (!Number.isFinite(num)) return `+${(0).toFixed(Math.max(0, digits))}`;
    const sign = num >= 0 ? "+" : "-";
    return `${sign}${Math.abs(num).toFixed(digits)}`;
  }

  static gateStatusFromScore(score) {
    const value = Number(score) || 0;
    if (Math.abs(value) < 0.15) return "dormant";
    if (value >= 0.75) return "strong_positive";
    if (value >= 0.4) return "established_positive";
    if (value >= 0.15) return "lean_positive";
    if (value <= -0.75) return "strong_negative";
    if (value <= -0.4) return "established_negative";
    return "lean_negative";
  }

  static axisDirectionFromProfileLabel(label = "") {
    const normalized = cleanString(label).toLowerCase();
    const map = {
      empathy: { axis: "empathyPracticality", direction: "empathy", sign: 1 },
      practicality: { axis: "empathyPracticality", direction: "practicality", sign: -1 },
      wisdom: { axis: "wisdomKnowledge", direction: "wisdom", sign: 1 },
      knowledge: { axis: "wisdomKnowledge", direction: "knowledge", sign: -1 },
      stability: { axis: "epistemicStability", direction: "positive", sign: 1 },
      instability: { axis: "epistemicStability", direction: "negative", sign: -1 },
    };
    return map[normalized] || null;
  }

  static parseCompactProfileSignals(lines = []) {
    const values = Array.isArray(lines) ? lines : [lines];
    const signals = [];
    for (const rawLine of values) {
      const line = cleanString(rawLine);
      if (!line) continue;
      const regex = /([+-](?:\d+(?:\.\d+)?|\.\d+))\s+(stability|instability|empathy|practicality|wisdom|knowledge)\b/gi;
      for (const match of line.matchAll(regex)) {
        const signedNumber = Number(match[1]);
        const labelInfo = EpistemicProfiler.axisDirectionFromProfileLabel(match[2]);
        if (!labelInfo || !Number.isFinite(signedNumber)) continue;
        signals.push({
          axis: labelInfo.axis,
          direction: labelInfo.direction,
          label: String(match[2]).toLowerCase(),
          value: EpistemicProfiler.clamp(signedNumber * labelInfo.sign, -1, 1),
          source: line,
        });
      }
    }
    return signals;
  }

  strengthWeight(strength) {
    const normalized = this.normalizeStrengthLabel(strength);
    return this.config.strengthWeights[normalized] ?? this.config.strengthWeights.moderate;
  }

  normalizeStrengthLabel(value) {
    const normalized = cleanString(value).toLowerCase();
    if (["weak", "moderate", "strong"].includes(normalized)) return normalized;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      if (numeric >= 0.75) return "strong";
      if (numeric >= 0.4) return "moderate";
      return "weak";
    }
    return "moderate";
  }

  normalizeUnitIntervalScore(value, fallback = 0) {
    if (typeof value === "string") {
      const normalized = cleanString(value).toLowerCase();
      if (normalized === "low") return 0.25;
      if (normalized === "medium" || normalized === "moderate") return 0.5;
      if (normalized === "high") return 0.85;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? EpistemicProfiler.clamp(numeric, 0, 1) : fallback;
  }

  scopeWeight(scope) {
    const normalized = cleanString(scope).toLowerCase();
    return this.config.scopeWeights[normalized] ?? this.config.scopeWeights.stance;
  }

  scopeStrengthWeight(scopeStrength) {
    const normalized = cleanString(scopeStrength).toLowerCase();
    return this.config.scopeStrengthWeights[normalized] ?? this.config.scopeStrengthWeights.low;
  }

  gateWeight(gate) {
    return this.config.gateWeights[gate] ?? 1;
  }

  inferScope(payload = {}) {
    const explicit = cleanString(payload.analysis_scope).toLowerCase();
    if (this.config.scopeWeights[explicit]) return explicit;
    const evidenceCount = Array.isArray(payload.evidence) ? payload.evidence.length : 0;
    const gateCount = Array.isArray(payload.triggered_gate_events) ? payload.triggered_gate_events.length : 0;
    const principleCount = Array.isArray(payload?.local_extraction?.principles) ? payload.local_extraction.principles.length : 0;
    if (evidenceCount + gateCount + principleCount >= 6) return "full_profile_import";
    if (evidenceCount + gateCount + principleCount >= 3) return "worldview_fragment";
    if (evidenceCount + gateCount + principleCount >= 1) return "stance";
    return "thought";
  }

  inferScopeStrength(scope, payload = {}) {
    const explicit = cleanString(payload.scope_strength).toLowerCase();
    if (["low", "medium", "high"].includes(explicit)) return explicit;
    const score =
      (Array.isArray(payload.evidence) ? payload.evidence.length : 0) +
      (Array.isArray(payload.triggered_gate_events) ? payload.triggered_gate_events.length : 0) +
      cleanStringList(payload?.profile || []).length;
    if (score >= 6) return "high";
    if (score >= 3) return "medium";
    return "low";
  }

  normalizeAxisEventList(items = []) {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        return {
          ...item,
          strength: this.normalizeStrengthLabel(item.strength_label ?? item.strength),
          confidence: this.normalizeUnitIntervalScore(item.confidence_score_0_to_1 ?? item.confidence, 1),
          evidence_span: normalizeEvidenceSpan(item.evidence_span_text || item.evidence_span || item.excerpt || item.reason),
        };
      })
      .filter(Boolean);
  }

  normalizeSignalList(items = [], fallbackPolarity = "positive", profileTargetFrame = "authorial_endorsement") {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const polarity = cleanString(item.polarity).toLowerCase() || fallbackPolarity;
        return {
          ...item,
          polarity,
          target: normalizeAttributionTarget(item.target || item.signal_target, {
            frame: profileTargetFrame,
            direction: polarity,
          }),
          signal_type:
            cleanString(item.signal_type || item.type || item.signal).toLowerCase() ||
            `legacy_${fallbackPolarity}`,
          strength: this.normalizeStrengthLabel(item.strength_label ?? item.strength),
          confidence: this.normalizeUnitIntervalScore(item.confidence_score_0_to_1 ?? item.confidence, 1),
          evidence_span: normalizeEvidenceSpan(item.evidence_span_text || item.evidence_span || item.excerpt || item.reason),
        };
      })
      .filter(Boolean);
  }

  normalizeGateEvents(items = [], profileTargetFrame = "authorial_endorsement") {
    if (!Array.isArray(items)) return { accepted: [], rejected: [] };
    const accepted = [];
    const rejected = [];
    for (const item of items) {
      if (!item || typeof item !== "object") {
        rejected.push({ reason: "non_object_gate_event", raw: item });
        continue;
      }
      const gate = cleanString(item.gate);
      if (!gate || !(gate in this.state.gateStates)) {
        rejected.push({ reason: "unknown_gate", raw: item });
        continue;
      }
      const direction = cleanString(item.direction).toLowerCase();
      if (!["positive", "negative"].includes(direction)) {
        rejected.push({ reason: "invalid_gate_direction", raw: item, gate, direction });
        continue;
      }
      accepted.push({
        gate,
        direction,
        target: normalizeAttributionTarget(item.target || item.signal_target, {
          frame: profileTargetFrame,
          direction,
        }),
        strength: this.normalizeStrengthLabel(item.strength_label ?? item.strength),
        confidence: EpistemicProfiler.clamp(this.normalizeUnitIntervalScore(item.confidence_score_0_to_1 ?? item.confidence, 1), 0.5, 1),
        novelty: this.normalizeUnitIntervalScore(item.novelty_score_0_to_1 ?? item.novelty, 1),
        evidence_span: normalizeEvidenceSpan(item.evidence_span_text || item.evidence_span || item.reason),
        scope: cleanString(item.scope),
      });
    }
    return { accepted, rejected };
  }

  normalizeLocalExtraction(input = {}) {
    const extraction = input && typeof input === "object" ? input : {};
    const pickList = (key) => (Array.isArray(extraction[key]) ? extraction[key] : []);
    return {
      principles: pickList("principles"),
      boundaries: pickList("boundaries"),
      claimed_values: pickList("claimed_values"),
      tradeoffs: pickList("tradeoffs"),
      contradictions: pickList("contradictions"),
    };
  }

  normalizeProfileUpdateSignals(input = {}) {
    const keys = [
      "new_principles",
      "refined_principles",
      "new_boundaries",
      "refined_boundaries",
      "resolved_contradictions",
      "introduced_contradictions",
      "cleared_gates",
      "failed_gates",
      "retractions",
      "restatements",
      "cleared_risks",
      "softened_risks",
    ];
    const out = {};
    for (const key of keys) out[key] = Array.isArray(input?.[key]) ? input[key] : [];
    return out;
  }

  normalizeSemanticGrid(input = {}) {
    const base = input && typeof input === "object" ? input : {};
    return {
      empathy: semanticGridField(base.empathy),
      practicality: semanticGridField(base.practicality),
      wisdom: semanticGridField(base.wisdom),
      knowledge: semanticGridField(base.knowledge),
      x_integration: semanticGridField(base.x_integration),
      z_integration: semanticGridField(base.z_integration),
      y_positive: semanticGridField(base.y_positive),
      y_negative: semanticGridField(base.y_negative),
    };
  }

  normalizeDimensionConsideration(input = {}) {
    const base = input && typeof input === "object" ? input : {};
    return Object.fromEntries(
      DIMENSION_CONSIDERATION_DIMENSIONS.map((dimension) => [
        dimension,
        sanitizeDimensionConsiderationField(base[dimension], dimension),
      ]),
    );
  }

  normalizeLegacyEvidence(evidence = []) {
    const xPole = [];
    const zPole = [];
    const xIntegration = [];
    const zIntegration = [];
    const localYPositiveSignals = [];
    const localYNegativeSignals = [];
    for (const item of Array.isArray(evidence) ? evidence : []) {
      if (!item || typeof item !== "object") continue;
      const axis = cleanString(item.axis);
      const direction = cleanString(item.direction).toLowerCase();
      const strength = this.normalizeStrengthLabel(item.strength_label ?? item.strength);
      const confidence = this.normalizeUnitIntervalScore(item.confidence_score_0_to_1 ?? item.confidence, 1);
      const evidenceSpan = normalizeEvidenceSpan(item.evidence_span_text || item.excerpt || item.reason);
      if (axis === "empathyPracticality") {
        if (direction === "empathy" || direction === "practicality") {
          xPole.push({ pole: direction, strength, confidence, evidence_span: evidenceSpan });
        } else if (direction === "mixed") {
          xIntegration.push({ type: "integrated_tension", strength, confidence, evidence_span: evidenceSpan });
        }
      }
      if (axis === "wisdomKnowledge") {
        if (direction === "wisdom" || direction === "knowledge") {
          zPole.push({ pole: direction, strength, confidence, evidence_span: evidenceSpan });
        } else if (direction === "mixed") {
          zIntegration.push({ type: "integrated_tension", strength, confidence, evidence_span: evidenceSpan });
        }
      }
      if (axis === "epistemicStability") {
        const target = direction === "negative" ? localYNegativeSignals : localYPositiveSignals;
        if (direction === "positive" || direction === "negative") {
          target.push({
            signal_type: direction === "positive" ? "legacy_positive" : "legacy_negative",
            polarity: direction,
            strength,
            confidence,
            evidence_span: evidenceSpan,
          });
        }
      }
    }
    return {
      axis_events: {
        x_pole_evidence: xPole,
        x_integration_events: xIntegration,
        z_pole_evidence: zPole,
        z_integration_events: zIntegration,
      },
      local_y_positive_signals: localYPositiveSignals,
      local_y_negative_signals: localYNegativeSignals,
    };
  }

  normalizeCompactSignals(profile = []) {
    const compactSignals = EpistemicProfiler.parseCompactProfileSignals(profile);
    const axis_events = {
      x_pole_evidence: [],
      x_integration_events: [],
      z_pole_evidence: [],
      z_integration_events: [],
    };
    const local_y_positive_signals = [];
    let local_y_negative_signals = [];
    for (const signal of compactSignals) {
      const magnitude = Math.abs(Number(signal.value) || 0);
      const strength = magnitude >= 0.75 ? "strong" : magnitude >= 0.4 ? "moderate" : "weak";
      const confidence = EpistemicProfiler.clamp(magnitude, 0.35, 1);
      if (signal.axis === "empathyPracticality") {
        axis_events.x_pole_evidence.push({ pole: signal.direction, strength, confidence, evidence_span: signal.source });
      } else if (signal.axis === "wisdomKnowledge") {
        axis_events.z_pole_evidence.push({ pole: signal.direction, strength, confidence, evidence_span: signal.source });
      } else if (signal.axis === "epistemicStability") {
        const target = signal.direction === "negative" ? local_y_negative_signals : local_y_positive_signals;
        target.push({
          signal_type: signal.direction === "negative" ? "legacy_negative" : "legacy_positive",
          polarity: signal.direction,
          strength,
          confidence,
          evidence_span: signal.source,
        });
      }
    }
    return { compactSignals, axis_events, local_y_positive_signals, local_y_negative_signals };
  }

  normalizeRiskEvents(items = [], profileTargetFrame = "authorial_endorsement", entryId = null) {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => normalizeRiskEvent(item, { frame: profileTargetFrame, entryId }))
      .filter((event) => event && riskEventTargetsProfiledReferent(event, { frame: profileTargetFrame }));
  }

  normalizeRiskUpdateSignals(updateSignals = {}, profileTargetFrame = "authorial_endorsement", entryId = null) {
    const out = [];
    for (const item of cleanStringList(updateSignals.cleared_risks || [])) {
      out.push(normalizeRiskEvent({ risk: item, status: "cleared", confidence_score_0_to_1: 0.85, target: "self" }, { frame: profileTargetFrame, entryId }));
    }
    for (const item of cleanStringList(updateSignals.softened_risks || [])) {
      out.push(normalizeRiskEvent({ risk: item, status: "softened", confidence_score_0_to_1: 0.65, target: "self" }, { frame: profileTargetFrame, entryId }));
    }
    return out.filter((event) => event && riskEventTargetsProfiledReferent(event, { frame: profileTargetFrame }));
  }

  normalizeGateUpdateProposals(items = []) {
    if (!Array.isArray(items)) return [];
    return items.map((item) => normalizeGateUpdateProposal(item)).filter(Boolean);
  }

  gateHasScoreableSupport(gate, { triggered_gate_events = [], gate_update_proposals = [], profile_target_frame = "authorial_endorsement" } = {}) {
    const normalizedGate = cleanString(gate);
    if (!GATE_NAME_LIST.includes(normalizedGate)) return false;
    const frame = normalizeProfileTargetFrame(profile_target_frame);

    for (const event of Array.isArray(triggered_gate_events) ? triggered_gate_events : []) {
      if (cleanString(event?.gate) !== normalizedGate) continue;
      const direction = cleanString(event?.direction).toLowerCase() || "neutral";
      if (!signalTargetsProfiledReferent(event, { frame, direction })) continue;
      return true;
    }

    for (const proposal of Array.isArray(gate_update_proposals) ? gate_update_proposals : []) {
      if (cleanString(proposal?.gate) !== normalizedGate) continue;
      const localDirection = cleanString(proposal?.local_direction).toLowerCase();
      const proposedEffect = cleanString(proposal?.proposed_effect).toLowerCase();
      if (localDirection === "neutral" || proposedEffect === "no_change") continue;
      return true;
    }

    return false;
  }

  autoGateSupportTarget(profileTargetFrame = "authorial_endorsement") {
    return defaultAttributionTarget(profileTargetFrame, "positive");
  }

  integrationEventStrengthValue(event = {}) {
    const strength = this.normalizeStrengthLabel(event?.strength_label ?? event?.strength);
    return this.strengthWeight(strength);
  }

  collectAutoGateEvidenceText({ semantic_grid = {}, local_y_positive_signals = [], axis_events = {}, local_extraction = {}, claim_commitments = [] } = {}) {
    const out = [];
    const add = (value) => {
      if (Array.isArray(value)) {
        for (const item of value) add(item);
        return;
      }
      if (typeof value === "string") {
        const text = cleanString(value);
        if (text) out.push(text);
        return;
      }
      if (value && typeof value === "object") {
        for (const key of ["evidence_span", "evidence_span_text", "claim", "reason", "note", "text", "value"]) {
          if (typeof value[key] === "string") add(value[key]);
        }
        if (Array.isArray(value.evidence_spans)) add(value.evidence_spans);
      }
    };

    for (const field of Object.values(semantic_grid || {})) add(field?.evidence_spans || []);
    add(local_y_positive_signals || []);
    add(axis_events?.x_integration_events || []);
    add(axis_events?.z_integration_events || []);
    add(axis_events?.x_pole_evidence || []);
    add(axis_events?.z_pole_evidence || []);
    add(local_extraction?.principles || []);
    add(local_extraction?.claimed_values || []);
    add(local_extraction?.tradeoffs || []);
    add(claim_commitments || []);
    return dedupeLatestFirst(out);
  }

  hasProfiledNegativePressureFromParts({ semantic_grid = {}, local_y_negative_signals = [], risk_events = [], triggered_gate_events = [], profile_target_frame = "authorial_endorsement" } = {}) {
    const frame = normalizeProfileTargetFrame(profile_target_frame);
    const negativeGrid = semantic_grid?.y_negative || {};
    const negativeGridMass = Number(negativeGrid.support || 0) * Number(negativeGrid.confidence || 0);
    if (negativeGridMass >= Number(this.config.nearZeroProjectionGuardNegativeEvidenceThreshold ?? 0.25)) return true;

    if ((local_y_negative_signals || []).some((signal) => signalTargetsProfiledReferent(signal, { frame, direction: "negative" }))) {
      return true;
    }

    if ((risk_events || []).some((event) => normalizeRiskStatus(event?.status || "active") === "active" && riskEventTargetsProfiledReferent(event, { frame }))) {
      return true;
    }

    return (triggered_gate_events || []).some((event) => {
      const direction = cleanString(event?.direction).toLowerCase();
      return direction === "negative" && signalTargetsProfiledReferent(event, { frame, direction });
    });
  }


  collectNegativeEvidenceText(value = {}) {
    const out = [];
    const add = (item) => {
      if (Array.isArray(item)) {
        for (const sub of item) add(sub);
        return;
      }
      if (typeof item === "string") {
        const text = cleanString(item);
        if (text) out.push(text);
        return;
      }
      if (item && typeof item === "object") {
        for (const key of ["evidence_span", "evidence_span_text", "reason", "note", "rationale", "claim", "text", "value"]) {
          if (typeof item[key] === "string") add(item[key]);
        }
        if (Array.isArray(item.evidence_spans)) add(item.evidence_spans);
        if (Array.isArray(item.repair_requirements)) add(item.repair_requirements);
      }
    };
    add(value);
    return dedupeLatestFirst(out);
  }

  evidenceTextHasOnlyAbsenceCues(text = "") {
    const normalized = cleanString(text).toLowerCase();
    if (!normalized) return false;
    const absenceCue = /\b(no|without|lack(?:s|ing)?|limited|low|missing|not|absence(?:[- ]?based)?|omits?|does not|did not)\b[\s\S]{0,110}\b(discussion|engagement|engage|reference|consideration|context|contexts|consequence|consequences|feasibility|incentive|incentives|outcome|outcomes|qualification|qualifier|qualifiers|openness|testability|counter[- ]?consideration|nuance|nuances|exception|exceptions|factual|empirical|real[- ]?world|specific impact|practical outcome|tradeoff|tradeoffs|evidence|facts|examples)\b/i;
    const assertionCue = /\b(strong assertion|absolute framing|broad application|normative claim|strong normative claim|broad claim)\b[\s\S]{0,100}\b(without|no|lack|lacking|limited|omits?|not)\b/i;
    return absenceCue.test(normalized) || assertionCue.test(normalized) || /\bnot[_ ]evidenced[_ ]here\b/i.test(normalized);
  }

  evidenceTextHasExplicitClosureOrDetachment(text = "") {
    const normalized = cleanString(text).toLowerCase();
    if (!normalized) return false;
    return /\b(perfect in every way|immune(?:\s+from|\s+to)?\s+(challenge|correction|objection|revision)|cannot be wrong|can't be wrong|could not be wrong|no serious objection|nothing (?:could|can|would) change|beyond question|unquestionable|unfalsifiable|refus(?:e|es|ed|ing)\s+(?:to\s+)?(?:consider|engage|listen|revise|correct)|will not reconsider|no need to (?:re[- ]?)?examin|disagreement proves|any disagreement|facts do(?:es)? not matter|facts don't matter|reality do(?:es)? not matter|reality doesn't matter|ignore (?:evidence|facts|consequences|reality)|no need for evidence|evidence is irrelevant|outcomes? do(?:es)? not matter|consequences? do(?:es)? not matter)\b/i.test(normalized);
  }


  evidenceTextHasExplicitFalseCertaintyCue(text = "") {
    const normalized = cleanString(text).toLowerCase();
    if (!normalized) return false;
    return this.evidenceTextHasExplicitClosureOrDetachment(normalized) ||
      /\b(perfect(?:\s+in\s+every\s+way)?|infallible|always\s+right|cannot\s+be\s+wrong|can't\s+be\s+wrong|could\s+not\s+be\s+wrong|undeniable|unquestionable|no\s+exceptions?|with\s+absolute\s+certainty|for\s+a\s+fact|no\s+serious\s+objection|nothing\s+(?:could|can|would)\s+change|immune\s+(?:from|to)\s+(?:challenge|correction|objection|revision))\b/i.test(normalized);
  }

  negativeEvidenceRejectionReason(value = {}) {
    const type = normalizeRiskType(value?.risk || value?.type || value?.signal_type || value?.gate || "");
    const text = this.collectNegativeEvidenceText(value).join(" ");
    if ((type === "false_certainty" || cleanString(value?.gate) === "G3_self_correction") && !this.evidenceTextHasExplicitFalseCertaintyCue(text)) {
      return "false_certainty_requires_closure_or_infallibility_not_strong_moral_judgment";
    }
    return "absence_or_missing_context_is_neutral";
  }

  evidenceLooksAbsenceOnly(value = {}) {
    const texts = this.collectNegativeEvidenceText(value);
    if (!texts.length) return false;
    const joined = texts.join(" ");
    if (this.evidenceTextHasExplicitClosureOrDetachment(joined)) return false;
    return texts.some((text) => this.evidenceTextHasOnlyAbsenceCues(text));
  }

  shouldRejectAbsenceBasedNegativeSignal(signal = {}) {
    if (this.config.absenceBasedNegativeEvidenceGuardEnabled === false) return false;
    const signalType = cleanString(signal.signal_type || signal.type).toLowerCase();
    if (!["false_certainty", "self_sealing", "dogmatic_closure", "reality_detachment", "contradiction_evasion"].includes(signalType)) return false;
    if (signalType === "false_certainty" && !this.evidenceTextHasExplicitFalseCertaintyCue(this.collectNegativeEvidenceText(signal).join(" "))) return true;
    return this.evidenceLooksAbsenceOnly(signal);
  }

  shouldRejectAbsenceBasedRiskEvent(event = {}) {
    if (this.config.absenceBasedNegativeEvidenceGuardEnabled === false) return false;
    if (normalizeRiskStatus(event.status || "active") !== "active") return false;
    const risk = normalizeRiskType(event.risk || event.type);
    if (!["false_certainty", "self_sealing", "dogmatic_closure", "reality_detachment", "contradiction_evasion"].includes(risk)) return false;
    if (risk === "false_certainty" && !this.evidenceTextHasExplicitFalseCertaintyCue(this.collectNegativeEvidenceText(event).join(" "))) return true;
    return this.evidenceLooksAbsenceOnly(event);
  }

  shouldRejectAbsenceBasedNegativeGateEvent(event = {}) {
    if (this.config.absenceBasedNegativeEvidenceGuardEnabled === false) return false;
    const direction = cleanString(event.direction).toLowerCase();
    if (direction !== "negative") return false;
    const gate = cleanString(event.gate);
    if (!["G1_counter_consideration", "G3_self_correction", "G5_reality_contact", "G6_non_self_sealing"].includes(gate)) return false;
    if (gate === "G3_self_correction" && !this.evidenceTextHasExplicitFalseCertaintyCue(this.collectNegativeEvidenceText(event).join(" "))) return true;
    return this.evidenceLooksAbsenceOnly(event);
  }

  shouldRejectAbsenceBasedNegativeGateProposal(proposal = {}) {
    if (this.config.absenceBasedNegativeEvidenceGuardEnabled === false) return false;
    const localDirection = cleanString(proposal.local_direction).toLowerCase();
    const proposedEffect = cleanString(proposal.proposed_effect).toLowerCase();
    if (localDirection !== "negative" || proposedEffect === "no_change") return false;
    const gate = cleanString(proposal.gate);
    if (!["G1_counter_consideration", "G3_self_correction", "G5_reality_contact", "G6_non_self_sealing"].includes(gate)) return false;
    return this.evidenceLooksAbsenceOnly(proposal);
  }

  sanitizeProfileUpdateSignalsForRejectedGateEvidence(profileUpdateSignals = {}, rejectedGateEvidence = []) {
    const out = cloneJSON(profileUpdateSignals || {});
    const rejectedGates = new Set((rejectedGateEvidence || []).map((item) => cleanString(item.gate)).filter(Boolean));
    if (!rejectedGates.size) return out;
    out.failed_gates = cleanStringList(out.failed_gates || []).filter((gate) => !rejectedGates.has(gate));
    return out;
  }

  sanitizeAbsenceBasedNegativeEvidence({
    local_y_negative_signals = [],
    risk_events = [],
    triggered_gate_events = [],
    gate_update_proposals = [],
    profile_update_signals = {},
  } = {}) {
    const diagnostics = [];
    const rejectedGateEvidence = [];

    const filteredNegativeSignals = (Array.isArray(local_y_negative_signals) ? local_y_negative_signals : []).filter((signal) => {
      const reject = this.shouldRejectAbsenceBasedNegativeSignal(signal);
      if (reject) diagnostics.push({ artifact: "local_y_negative_signal", action: "ignored", type: cleanString(signal.signal_type || signal.type), evidence_span: normalizeEvidenceSpan(signal.evidence_span || signal.evidence_span_text || signal.reason || signal.note), reason: this.negativeEvidenceRejectionReason(signal) });
      return !reject;
    });

    const filteredRiskEvents = (Array.isArray(risk_events) ? risk_events : []).filter((event) => {
      const reject = this.shouldRejectAbsenceBasedRiskEvent(event);
      if (reject) diagnostics.push({ artifact: "risk_event", action: "ignored", risk: normalizeRiskType(event.risk || event.type), evidence_span: normalizeEvidenceSpan(event.evidence_span || event.evidence_span_text || event.reason || event.note), reason: this.negativeEvidenceRejectionReason(event) });
      return !reject;
    });

    const filteredGateEvents = (Array.isArray(triggered_gate_events) ? triggered_gate_events : []).filter((event) => {
      const reject = this.shouldRejectAbsenceBasedNegativeGateEvent(event);
      if (reject) {
        rejectedGateEvidence.push({ gate: cleanString(event.gate), source: "triggered_gate_event" });
        diagnostics.push({ artifact: "triggered_gate_event", action: "ignored", gate: cleanString(event.gate), direction: cleanString(event.direction).toLowerCase(), evidence_span: normalizeEvidenceSpan(event.evidence_span || event.evidence_span_text || event.reason || event.note), reason: "negative_gate_requires_positive_evidence_of_failure_not_absence" });
      }
      return !reject;
    });

    const filteredGateProposals = (Array.isArray(gate_update_proposals) ? gate_update_proposals : []).filter((proposal) => {
      const reject = this.shouldRejectAbsenceBasedNegativeGateProposal(proposal);
      if (reject) {
        rejectedGateEvidence.push({ gate: cleanString(proposal.gate), source: "gate_update_proposal" });
        diagnostics.push({ artifact: "gate_update_proposal", action: "ignored", gate: cleanString(proposal.gate), local_direction: cleanString(proposal.local_direction).toLowerCase(), evidence_span: normalizeEvidenceSpan(proposal.evidence_span || proposal.evidence_span_text || proposal.reason || proposal.note), reason: "negative_gate_proposal_requires_positive_evidence_of_failure_not_absence" });
      }
      return !reject;
    });

    return {
      local_y_negative_signals: filteredNegativeSignals,
      risk_events: filteredRiskEvents,
      triggered_gate_events: filteredGateEvents,
      gate_update_proposals: filteredGateProposals,
      profile_update_signals: this.sanitizeProfileUpdateSignalsForRejectedGateEvidence(profile_update_signals, rejectedGateEvidence),
      diagnostics,
    };
  }

  inferAutoSupportedGateEvents({
    triggered_gate_events = [],
    gate_update_proposals = [],
    profile_target_frame = "authorial_endorsement",
    axis_events = {},
    local_extraction = {},
    semantic_grid = {},
    local_y_positive_signals = [],
    local_y_negative_signals = [],
    risk_events = [],
    claim_commitments = [],
  } = {}) {
    const diagnostics = [];
    if (this.config.autoGateSupportEnabled === false) return { events: [], diagnostics };

    const target = this.autoGateSupportTarget(profile_target_frame);
    const minConfidence = Number(this.config.autoGateSupportMinConfidence ?? 0.6);
    const hasNegativePressure = this.hasProfiledNegativePressureFromParts({
      semantic_grid,
      local_y_negative_signals,
      risk_events,
      triggered_gate_events,
      profile_target_frame,
    });
    const events = [];
    const hasSupport = (gate) => this.gateHasScoreableSupport(gate, {
      triggered_gate_events: [...triggered_gate_events, ...events],
      gate_update_proposals,
      profile_target_frame,
    });

    const integrationEvents = [
      ...(Array.isArray(axis_events?.x_integration_events) ? axis_events.x_integration_events : []),
      ...(Array.isArray(axis_events?.z_integration_events) ? axis_events.z_integration_events : []),
    ];
    const qualifyingIntegration = integrationEvents
      .filter((event) => {
        const type = cleanString(event?.type).toLowerCase();
        const confidence = Number(event?.confidence ?? event?.confidence_score_0_to_1 ?? 0);
        return ["fair_tradeoff", "integrated_tension", "explicit_balance"].includes(type) &&
          this.integrationEventStrengthValue(event) >= this.strengthWeight("moderate") &&
          confidence >= minConfidence;
      })
      .sort((a, b) => Number(b.confidence ?? 0) - Number(a.confidence ?? 0));

    const tradeoffs = cleanStringList(local_extraction?.tradeoffs || []);
    if (!hasNegativePressure && !hasSupport("G4_contradiction_handling") && tradeoffs.length && qualifyingIntegration.length) {
      const best = qualifyingIntegration[0];
      const strength = this.normalizeStrengthLabel(best.strength || best.strength_label || "moderate");
      const confidence = EpistemicProfiler.clamp(Number(best.confidence ?? best.confidence_score_0_to_1 ?? 0.7), minConfidence, 1);
      const evidence = normalizeEvidenceSpan(best.evidence_span || best.evidence_span_text || tradeoffs[0]);
      events.push({
        gate: "G4_contradiction_handling",
        direction: "positive",
        target,
        strength,
        confidence,
        novelty: 0.65,
        evidence_span: evidence || tradeoffs[0] || "auto-supported tradeoff/integration evidence",
        scope: "auto_supported_from_extractor_fields",
        auto_supported: true,
        auto_support_reason: "tradeoffs_plus_moderate_or_strong_integration_event",
      });
      diagnostics.push({
        gate: "G4_contradiction_handling",
        action: "added_triggered_gate_event",
        reason: "local_extraction.tradeoffs plus moderate/strong fair_tradeoff or integrated_tension event",
        evidence_span: evidence || tradeoffs[0] || "",
      });
    }

    const evidenceTexts = this.collectAutoGateEvidenceText({
      semantic_grid,
      local_y_positive_signals,
      axis_events,
      local_extraction,
      claim_commitments,
    });
    const evidenceText = evidenceTexts.join(" ");
    const materialRealityContact = /\b(consequence|consequences|constraint|constraints|feasibility|feasible|incentive|incentives|causal|cause|mechanism|mechanisms|outcome|outcomes|health|material|social outcome|transition condition|transitioning|automation|skilled|training|train)\b/i.test(evidenceText);
    const epistemicRealityContact = /\b(answerable\s+to\s+(truth|reality)|reality[- ]?testing|test(?:ed|ing)?\s+against\s+(truth|reality)|belief\s+is\s+(true|false)|belief\s+was\s+(true|false)|false\s+belief|carrying\s+error|rescue\s+me\s+from\s+carrying\s+error|rescue\s+.*\berror\b|refin(?:e|ing)\s+.*\bbelief|correction\s+by\s+(truth|reality))\b/i.test(evidenceText);
    const yPositiveMass = Number(semantic_grid?.y_positive?.support || 0) * Number(semantic_grid?.y_positive?.confidence || 0);
    const zIntegrationMass = Number(semantic_grid?.z_integration?.support || 0) * Number(semantic_grid?.z_integration?.confidence || 0);
    const realityContactIsMaterial = materialRealityContact || (epistemicRealityContact && (yPositiveMass >= 0.45 || zIntegrationMass >= 0.45));

    if (!hasNegativePressure && !hasSupport("G5_reality_contact") && realityContactIsMaterial) {
      const matchingEvidence = evidenceTexts.find((text) =>
        /\b(answerable\s+to\s+(truth|reality)|belief\s+is\s+(true|false)|carrying\s+error|rescue\s+.*\berror\b|consequence|constraint|feasibility|incentive|causal|mechanism|outcome|health|transitioning|automation|training|skilled)\b/i.test(text)
      ) || evidenceTexts[0] || "auto-supported reality-contact evidence";
      events.push({
        gate: "G5_reality_contact",
        direction: "positive",
        target,
        strength: materialRealityContact ? "strong" : "moderate",
        confidence: materialRealityContact ? 0.75 : 0.7,
        novelty: 0.65,
        evidence_span: matchingEvidence,
        scope: "auto_supported_from_extractor_fields",
        auto_supported: true,
        auto_support_reason: materialRealityContact ? "material_reality_contact_present" : "epistemic_reality_contact_present",
      });
      diagnostics.push({
        gate: "G5_reality_contact",
        action: "added_triggered_gate_event",
        reason: materialRealityContact ? "material reality-contact evidence present in extractor fields" : "epistemic reality-contact evidence present in extractor fields",
        evidence_span: matchingEvidence,
      });
    }

    return { events, diagnostics };
  }


inferClaimedScopeLevel(analysisScope = "stance") {
  const normalized = cleanString(analysisScope).toLowerCase();
  if (normalized === "thought" || normalized === "stance") return "narrow";
  if (normalized === "full_profile_import") return "broad";
  return "moderate";
}

normalizeClaimCommitments(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const raw = item && typeof item === "object" ? item : { claim: item };
      const claim = cleanString(raw.claim || raw.text || raw.normalized || raw.value);
      if (!claim) return null;
      const commitment = cleanString(raw.commitment).toLowerCase();
      const scopeEffect = cleanString(raw.scope_effect).toLowerCase();
      return {
        claim,
        commitment: CLAIM_COMMITMENT_TYPES.has(commitment) ? commitment : "asserted",
        scope_effect: CLAIM_SCOPE_EFFECTS.has(scopeEffect) ? scopeEffect : "none",
        evidence_span: normalizeEvidenceSpan(raw.evidence_span || raw.reason || raw.excerpt),
      };
    })
    .filter(Boolean);
}

normalizeScopeProfile(value = {}, analysisScope = "stance", claimCommitments = []) {
  const raw = value && typeof value === "object" ? value : {};
  const claimedScope = cleanString(raw.claimed_scope).toLowerCase();
  const inferredExpansion = Array.isArray(claimCommitments) && claimCommitments.some((item) => item.scope_effect === "widened")
    ? "widened"
    : Array.isArray(claimCommitments) && claimCommitments.some((item) => item.scope_effect === "contained")
      ? "contained"
      : "none";
  const scopeExpansion = cleanString(raw.scope_expansion).toLowerCase();
  const normalizeGateList = (items = []) =>
    [...new Set(cleanStringList(items).filter((gate) => GATE_NAME_LIST.includes(gate)))];
  return {
    claimed_scope: SCOPE_CLAIMED_LEVELS.has(claimedScope) ? claimedScope : this.inferClaimedScopeLevel(analysisScope),
    scope_complete_for_text:
      typeof raw.scope_complete_for_text === "boolean" ? raw.scope_complete_for_text : null,
    scope_expansion: SCOPE_EXPANSION_TYPES.has(scopeExpansion) ? scopeExpansion : inferredExpansion,
    unresolved_scope_gaps: cleanStringList(raw.unresolved_scope_gaps || []),
    relevant_gates: normalizeGateList(raw.relevant_gates || []),
    irrelevant_gates: normalizeGateList(raw.irrelevant_gates || []),
  };
}

reconcileScopeProfile(scopeProfile = {}, { triggered_gate_events = [], gate_update_proposals = [], profile_target_frame = "authorial_endorsement" } = {}) {
  const profile = scopeProfile && typeof scopeProfile === "object" ? cloneJSON(scopeProfile) : defaultScopeProfileField();
  const declaredRelevant = new Set(cleanStringList(profile.relevant_gates || []).filter((gate) => GATE_NAME_LIST.includes(gate)));
  const declaredIrrelevant = new Set(cleanStringList(profile.irrelevant_gates || []).filter((gate) => GATE_NAME_LIST.includes(gate)));
  const supported = new Set();

  for (const event of Array.isArray(triggered_gate_events) ? triggered_gate_events : []) {
    const gate = cleanString(event?.gate);
    if (!GATE_NAME_LIST.includes(gate)) continue;
    const direction = cleanString(event?.direction).toLowerCase() || "neutral";
    if (!signalTargetsProfiledReferent(event, { frame: profile_target_frame, direction })) continue;
    supported.add(gate);
  }

  for (const proposal of Array.isArray(gate_update_proposals) ? gate_update_proposals : []) {
    const gate = cleanString(proposal?.gate);
    if (!GATE_NAME_LIST.includes(gate)) continue;
    const localDirection = cleanString(proposal?.local_direction).toLowerCase();
    const proposedEffect = cleanString(proposal?.proposed_effect).toLowerCase();
    if (localDirection === "neutral" || proposedEffect === "no_change") continue;
    supported.add(gate);
  }

  // The extractor may sometimes list a gate as "relevant" without emitting a
  // scoreable event/proposal for it. Keep the profiler deterministic: unsupported
  // declarations are diagnostics only, not coverage/peak evidence.
  const unsupportedRelevant = [...declaredRelevant].filter((gate) => !supported.has(gate));
  const relevant = new Set([...supported]);
  const irrelevant = new Set([...declaredIrrelevant, ...unsupportedRelevant]);

  if (!relevant.size && !irrelevant.size) {
    for (const gate of GATE_NAME_LIST) {
      irrelevant.add(gate);
    }
  }

  profile.relevant_gates = GATE_NAME_LIST.filter((gate) => relevant.has(gate));
  profile.irrelevant_gates = GATE_NAME_LIST.filter((gate) => irrelevant.has(gate) && !relevant.has(gate));
  profile.gate_support_diagnostics = {
    declaredRelevantGates: GATE_NAME_LIST.filter((gate) => declaredRelevant.has(gate)),
    supportedRelevantGates: GATE_NAME_LIST.filter((gate) => relevant.has(gate)),
    unsupportedRelevantGates: GATE_NAME_LIST.filter((gate) => unsupportedRelevant.includes(gate)),
  };
  return profile;
}

  normalizePayload(payload = {}) {
    if (!payload || typeof payload !== "object") {
      throw new Error("LLM payload must be an object");
    }
    const display_profile_lines = cleanStringList(payload.profile || []);
    const notes = cleanStringList(payload.notes || []);
    const analysis_scope = this.inferScope(payload);
    const scope_strength = this.inferScopeStrength(analysis_scope, payload);
    const profile_target_frame = normalizeProfileTargetFrame(payload.profile_target_frame);
    const legacy = this.normalizeLegacyEvidence(payload.evidence || []);
    const compact = this.normalizeCompactSignals(display_profile_lines);
    const axis_events = {
      x_pole_evidence: [
        ...legacy.axis_events.x_pole_evidence,
        ...this.normalizeAxisEventList(payload?.axis_events?.x_pole_evidence || []),
        ...compact.axis_events.x_pole_evidence,
      ],
      x_integration_events: [
        ...legacy.axis_events.x_integration_events,
        ...this.normalizeAxisEventList(payload?.axis_events?.x_integration_events || []),
      ],
      z_pole_evidence: [
        ...legacy.axis_events.z_pole_evidence,
        ...this.normalizeAxisEventList(payload?.axis_events?.z_pole_evidence || []),
        ...compact.axis_events.z_pole_evidence,
      ],
      z_integration_events: [
        ...legacy.axis_events.z_integration_events,
        ...this.normalizeAxisEventList(payload?.axis_events?.z_integration_events || []),
      ],
    };
    const local_y_positive_signals = [
      ...this.normalizeSignalList(legacy.local_y_positive_signals, "positive", profile_target_frame),
      ...this.normalizeSignalList(payload.local_y_positive_signals || [], "positive", profile_target_frame),
      ...this.normalizeSignalList(compact.local_y_positive_signals, "positive", profile_target_frame),
    ];
    let local_y_negative_signals = [
      ...this.normalizeSignalList(legacy.local_y_negative_signals, "negative", profile_target_frame),
      ...this.normalizeSignalList(payload.local_y_negative_signals || [], "negative", profile_target_frame),
      ...this.normalizeSignalList(compact.local_y_negative_signals, "negative", profile_target_frame),
    ];
    const local_extraction = this.normalizeLocalExtraction(payload.local_extraction || {});
    let profile_update_signals = this.normalizeProfileUpdateSignals(payload.profile_update_signals || {});
    let structured_risk_events = [
      ...this.normalizeRiskEvents(payload.risk_events || [], profile_target_frame),
      ...this.normalizeRiskUpdateSignals(profile_update_signals, profile_target_frame),
    ];
    let normalizedGateResult = this.normalizeGateEvents(payload.triggered_gate_events || [], profile_target_frame);
    let gate_update_proposals = this.normalizeGateUpdateProposals(payload.gate_update_proposals || []);
    const absenceNegativeEvidenceGuard = this.sanitizeAbsenceBasedNegativeEvidence({
      local_y_negative_signals,
      risk_events: structured_risk_events,
      triggered_gate_events: normalizedGateResult.accepted,
      gate_update_proposals,
      profile_update_signals,
    });
    local_y_negative_signals = absenceNegativeEvidenceGuard.local_y_negative_signals;
    structured_risk_events = absenceNegativeEvidenceGuard.risk_events;
    normalizedGateResult = {
      ...normalizedGateResult,
      accepted: absenceNegativeEvidenceGuard.triggered_gate_events,
    };
    gate_update_proposals = absenceNegativeEvidenceGuard.gate_update_proposals;
    profile_update_signals = absenceNegativeEvidenceGuard.profile_update_signals;

    const claim_commitments = this.normalizeClaimCommitments(payload.claim_commitments || []);
    const autoGateSupport = this.inferAutoSupportedGateEvents({
      triggered_gate_events: normalizedGateResult.accepted,
      gate_update_proposals,
      profile_target_frame,
      axis_events,
      local_extraction,
      semantic_grid: this.normalizeSemanticGrid(payload.semantic_grid || {}),
      local_y_positive_signals,
      local_y_negative_signals,
      risk_events: structured_risk_events,
      claim_commitments,
    });
    const triggered_gate_events = [
      ...normalizedGateResult.accepted,
      ...autoGateSupport.events,
    ];
    const scope_profile = this.reconcileScopeProfile(
      this.normalizeScopeProfile(payload.scope_profile || {}, analysis_scope, claim_commitments),
      { triggered_gate_events, gate_update_proposals, profile_target_frame },
    );
    return {
      model: cleanString(payload.model) || "epistemic_octahedron_interpreter_v3",
      profiler_mode: cleanString(payload.profiler_mode) || "dense_support_v2",
      display_profile_lines,
      notes,
      analysis_scope,
      scope_strength,
      profile_target_frame,
      statement_modes: cleanStringList(payload.statement_modes || []),
      semantic_grid: this.normalizeSemanticGrid(payload.semantic_grid || {}),
      dimension_consideration: this.normalizeDimensionConsideration(payload.dimension_consideration || {}),
      claim_commitments,
      scope_profile,
      axis_events,
      local_y_positive_signals,
      local_y_negative_signals,
      triggered_gate_events,
      gate_update_proposals,
      auto_gate_support_diagnostics: autoGateSupport.diagnostics,
      absence_negative_evidence_diagnostics: absenceNegativeEvidenceGuard.diagnostics,
      local_extraction,
      profile_update_signals,
      risk_events: structured_risk_events,
      compactSignals: compact.compactSignals,
      invalidGateEvents: normalizedGateResult.rejected,
    };
  }

  getGateSnapshot(source = this.state.gateStates) {
    const out = {};
    for (const gate of GATE_NAME_LIST) {
      const raw = source?.[gate] && typeof source[gate] === "object" ? source[gate] : {};
      const score = EpistemicProfiler.clamp(Number(raw.score || 0), -1, 1);
      out[gate] = {
        score,
        status: cleanString(raw.status) || EpistemicProfiler.gateStatusFromScore(score),
        positive_events: Number(raw.positive_events || 0),
        negative_events: Number(raw.negative_events || 0),
        last_event_at: raw.last_event_at || null,
        last_evidence_span: raw.last_evidence_span || null,
      };
    }
    return cloneJSON(out);
  }

  getProfilerMemoryForPacket() {
    return {
      ...cloneJSON(this.state.profileState),
      gate_snapshot: this.getGateSnapshot(),
      gateStates: this.getGateSnapshot(),
      gate_states: this.getGateSnapshot(),
    };
  }

  isSelfMergingFrame(frame) {
    return SELF_MERGING_PROFILE_TARGET_FRAMES.has(normalizeProfileTargetFrame(frame));
  }

  getAggregationEntries() {
    const mergeable = this.state.entries.filter((entry) => this.isSelfMergingFrame(entry.profile_target_frame));
    return mergeable.length ? mergeable : this.state.entries.slice();
  }

  getAggregationFrameDiagnostics(entries = this.getAggregationEntries()) {
    const counts = {};
    for (const entry of this.state.entries) {
      const frame = normalizeProfileTargetFrame(entry.profile_target_frame);
      counts[frame] = (counts[frame] || 0) + 1;
    }
    const selectedEntries = new Set(entries);
    const excluded = this.state.entries.filter((entry) => !selectedEntries.has(entry));
    return {
      mode: this.state.entries.length && entries.length < this.state.entries.length ? "self_profile_priority" : "all_entries",
      counts,
      selectedCount: entries.length,
      excludedCount: excluded.length,
      excludedFrames: dedupeLatestFirst(excluded.map((entry) => normalizeProfileTargetFrame(entry.profile_target_frame))),
    };
  }

  shouldMergeEntryIntoPersistentProfile(entry = {}) {
    return this.isSelfMergingFrame(entry.profile_target_frame);
  }

  applyGateEventsToState(gateStates, entry) {
    const scopeWeight = this.scopeWeight(entry.analysis_scope) * this.scopeStrengthWeight(entry.scope_strength);
    const frame = normalizeProfileTargetFrame(entry.profile_target_frame);
    const explicitRepair = entryHasExplicitRepairSignals(entry);

    for (const event of entry.triggered_gate_events) {
      const direction = cleanString(event?.direction).toLowerCase() || "neutral";
      if (!signalTargetsProfiledReferent(event, { frame, direction })) continue;
      const gateState = gateStates[event.gate];
      if (!gateState) continue;
      const sign = event.direction === "negative" ? -1 : 1;

      if (sign > 0 && explicitRepair && Number(gateState.negative_events || 0) > 0) {
        gateState.score = Math.max(0, Number(gateState.score) || 0);
        gateState.negative_events = Math.max(0, Number(gateState.negative_events || 0) - 1);
      }

      const strengthValue = this.strengthWeight(event.strength);
      const gateWeight = this.gateWeight(event.gate);
      const confidence = EpistemicProfiler.clamp(Number(event.confidence ?? 1), 0.5, 1);
      const novelty = EpistemicProfiler.clamp(Number(event.novelty ?? 1), 0, 1);
      const repairMultiplier = sign > 0 && explicitRepair ? 1.15 : 1;
      const baseDelta = sign * strengthValue * scopeWeight * gateWeight * confidence * novelty * repairMultiplier;
      const delta = EpistemicProfiler.clamp(baseDelta, -1, 1);
      const oldScore = Number(gateState.score) || 0;
      const sameDirection = oldScore === 0 || Math.sign(oldScore) === Math.sign(delta);
      const multiplier = this.config.gateScoreDampingEnabled === false
        ? 1
        : sameDirection
          ? 1 - Math.abs(oldScore)
          : 1 + 0.5 * Math.abs(oldScore);
      const newScore = EpistemicProfiler.clamp(oldScore + delta * multiplier, -1, 1);
      gateState.score = newScore;
      gateState.status = EpistemicProfiler.gateStatusFromScore(newScore);
      gateState.last_event_at = entry.addedAt;
      gateState.last_evidence_span = event.evidence_span || null;
      if (sign > 0) gateState.positive_events += 1;
      else gateState.negative_events += 1;
    }

    for (const proposal of entry.gate_update_proposals || []) {
      const gate = cleanString(proposal?.gate);
      if (!GATE_NAME_LIST.includes(gate)) continue;
      const localDirection = cleanString(proposal?.local_direction).toLowerCase();
      const proposedEffect = cleanString(proposal?.proposed_effect).toLowerCase();
      if (localDirection !== "positive" || !["reopen", "reverse"].includes(proposedEffect)) continue;
      const gateState = gateStates[gate];
      if (!gateState) continue;
      if (Number(gateState.negative_events || 0) > 0) {
        gateState.score = Math.max(0, Number(gateState.score) || 0);
        gateState.negative_events = Math.max(0, Number(gateState.negative_events || 0) - 1);
        gateState.status = EpistemicProfiler.gateStatusFromScore(gateState.score);
        gateState.last_event_at = entry.addedAt;
        gateState.last_evidence_span = proposal.evidence_span || proposal.reason || gateState.last_evidence_span || null;
      }
    }
  }

  computeGateStateMap(entries = this.getAggregationEntries()) {
    const gateStates = createEmptyGateStateMap();
    for (const entry of entries) this.applyGateEventsToState(gateStates, entry);
    return gateStates;
  }

  dimensionConsiderationHasSignals(entry = {}) {
    const consideration = entry.dimension_consideration || {};
    return DIMENSION_CONSIDERATION_DIMENSIONS.some((dimension) => {
      const field = consideration[dimension];
      if (!field || typeof field !== "object") return false;
      return cleanString(field.status).toLowerCase() !== "not_evidenced_here" || (Array.isArray(field.evidence_spans) && field.evidence_spans.length > 0);
    });
  }

  aggregateDimensionConsideration(entries = this.getAggregationEntries()) {
    const byDimension = {};
    let coveredCount = 0;

    for (const dimension of DIMENSION_CONSIDERATION_DIMENSIONS) {
      let bestScore = -1;
      let bestField = defaultDimensionConsiderationField();
      const seenStatuses = [];

      entries.forEach((entry, index) => {
        const field = sanitizeDimensionConsiderationField(entry?.dimension_consideration?.[dimension], dimension);
        const status = cleanString(field.status).toLowerCase();
        const scopeMultiplier = this.scopeWeight(entry.analysis_scope) * this.scopeStrengthWeight(entry.scope_strength);
        const priority = DIMENSION_CONSIDERATION_STATUS_PRIORITY[status] ?? 0;
        const score = priority * 10 + Number(field.confidence || 0) * scopeMultiplier + index * 1e-6;
        if (status !== "not_evidenced_here") seenStatuses.push(status);
        if (score > bestScore) {
          bestScore = score;
          bestField = {
            status,
            confidence: Number(field.confidence || 0),
            basis_type: cleanString(field.basis_type).toLowerCase() || "none",
            evidence_spans: cleanStringList(field.evidence_spans || []),
          };
        }
      });

      const record = {
        ...bestField,
        seen_statuses: dedupeLatestFirst(seenStatuses),
      };
      byDimension[dimension] = record;
      if (record.status !== "not_evidenced_here") coveredCount += 1;
    }

    const bucketed = {
      explicitly_rejected: [],
      explicitly_deprioritized: [],
      tradeoff_engaged: [],
      directly_engaged: [],
      acknowledged: [],
      not_evidenced_here: [],
    };

    for (const [dimension, field] of Object.entries(byDimension)) {
      const bucket = bucketed[field.status] || bucketed.not_evidenced_here;
      bucket.push(dimension);
    }

    return {
      byDimension,
      coveredCount,
      totalDimensions: DIMENSION_CONSIDERATION_DIMENSIONS.length,
      coverageRatio: DIMENSION_CONSIDERATION_DIMENSIONS.length > 0 ? coveredCount / DIMENSION_CONSIDERATION_DIMENSIONS.length : 0,
      explicitlyRejected: bucketed.explicitly_rejected,
      explicitlyDeprioritized: bucketed.explicitly_deprioritized,
      tradeoffEngaged: bucketed.tradeoff_engaged,
      directlyEngaged: bucketed.directly_engaged,
      acknowledged: bucketed.acknowledged,
      notEvidencedHere: bucketed.not_evidenced_here,
    };
  }

  addLLMOutput(payload) {
    const entry = this.normalizePayload(payload);
    if (entry.invalidGateEvents?.length && this.config.rejectInvalidTriggeredGateEvents) {
      const messages = entry.invalidGateEvents
        .map((item) => {
          const gate = cleanString(item?.gate || item?.raw?.gate) || "unknown gate";
          const direction = cleanString(item?.direction || item?.raw?.direction) || "missing direction";
          const reason = cleanString(item?.reason).replace(/_/g, " ") || "invalid gate event";
          return `${gate}: ${reason}${direction ? ` (${direction})` : ""}`;
        })
        .join("; ");
      throw new Error(`Invalid triggered_gate_events detected: ${messages}`);
    }
    entry.entry_id = cleanString(payload.entry_id || payload.id || entry.entry_id) || `entry_${this.state.entries.length + 1}`;
    entry.risk_events = [
      ...(Array.isArray(entry.risk_events) ? entry.risk_events : []),
    ].map((event, index) => ({
      ...event,
      source_entry_id: event.source_entry_id || entry.entry_id,
      risk_id: event.risk_id || (event.status === "active" ? makeRiskId(entry.entry_id, event.risk, index) : null),
    }));

    const hasSignals =
      entry.risk_events.length ||
      Object.values(entry.semantic_grid || {}).some((value) => Number(value.support) > 0) ||
      entry.axis_events.x_pole_evidence.length ||
      entry.axis_events.x_integration_events.length ||
      entry.axis_events.z_pole_evidence.length ||
      entry.axis_events.z_integration_events.length ||
      entry.local_y_positive_signals.length ||
      entry.local_y_negative_signals.length ||
      entry.triggered_gate_events.length ||
      entry.local_extraction.principles.length ||
      entry.local_extraction.boundaries.length ||
      this.dimensionConsiderationHasSignals(entry) ||
      entry.compactSignals.length;
    if (!hasSignals) {
      throw new Error("LLM payload must contain usable structured signals or extraction content.");
    }
    entry.fallback_profile_line = this.buildFallbackProfileLine(entry);
    entry.addedAt = new Date().toISOString();
    this.state.entries.push(entry);
    this.mergeEntryIntoPersistentState(entry);
    return entry;
  }

  mergeEntryIntoPersistentState(entry) {
    this.mergePrinciplesAndBoundaries(entry);
    if (this.shouldMergeEntryIntoPersistentProfile(entry)) {
      this.mergeRiskEvents(entry);
      this.mergeRiskNotes(entry);
      this.mergeGateEvents(entry);
      this.refreshMetaEpistemicMarkers();
    }
  }

  mergePrinciplesAndBoundaries(entry) {
    const profileState = this.state.profileState;
    const existingPrinciples = cleanStringList(profileState.core_principles || []);
    const existingBoundaries = cleanStringList(profileState.core_boundaries || []);

    const cleanedExistingBoundaries = existingBoundaries.filter((boundary) =>
      !shouldSupersedePersistentBoundary(boundary, entry),
    );

    const nextPrinciples = [
      ...existingPrinciples,
      ...cleanStringList(entry.local_extraction.principles),
      ...cleanStringList(entry.profile_update_signals.new_principles),
      ...cleanStringList(entry.profile_update_signals.refined_principles),
    ];
    const nextBoundaries = [
      ...cleanedExistingBoundaries,
      ...cleanStringList(entry.local_extraction.boundaries),
      ...cleanStringList(entry.profile_update_signals.new_boundaries),
      ...cleanStringList(entry.profile_update_signals.refined_boundaries),
    ];
    profileState.core_principles = dedupeLatestFirst(nextPrinciples).slice(0, 24);
    profileState.core_boundaries = dedupeLatestFirst(nextBoundaries).slice(0, 24);
  }

  shouldPersistRiskSignal(entry, signal) {
    if (!signal || typeof signal !== "object") return false;
    if (!this.shouldMergeEntryIntoPersistentProfile(entry)) return false;
    const frame = normalizeProfileTargetFrame(entry.profile_target_frame);
    const direction = cleanString(signal.polarity).toLowerCase() || "negative";
    return signalTargetsProfiledReferent(signal, { frame, direction });
  }

  shouldMergeGateEvent(entry, event) {
    if (!event || typeof event !== "object") return false;
    if (!this.shouldMergeEntryIntoPersistentProfile(entry)) return false;
    const frame = normalizeProfileTargetFrame(entry.profile_target_frame);
    const direction = cleanString(event.direction).toLowerCase() || "neutral";
    return signalTargetsProfiledReferent(event, { frame, direction });
  }

  buildLegacyRiskEventsFromEntry(entry) {
    const events = [];
    const frame = normalizeProfileTargetFrame(entry.profile_target_frame);
    let index = 0;
    for (const signal of entry.local_y_negative_signals || []) {
      if (!this.shouldPersistRiskSignal(entry, signal)) continue;
      const risk = normalizeRiskType(signal.signal_type || signal.type || "other");
      events.push({
        risk_id: makeRiskId(entry.entry_id, risk, index++),
        risk,
        status: "active",
        target: normalizeAttributionTarget(signal.target, { frame, direction: "negative" }),
        confidence: Number(signal.confidence || 0),
        introduced_by: {
          entry_id: entry.entry_id,
          evidence_span: normalizeEvidenceSpan(signal.evidence_span || signal.evidence_span_text || ""),
        },
        repair_requirements: this.defaultRepairRequirementsForRisk(risk),
        clearance: null,
        source: "local_y_negative_signal",
      });
    }
    for (const contradiction of entry.local_extraction.contradictions || []) {
      const risk = "contradiction";
      events.push({
        risk_id: makeRiskId(entry.entry_id, risk, index++),
        risk,
        status: "active",
        target: "self",
        confidence: 0.75,
        introduced_by: {
          entry_id: entry.entry_id,
          evidence_span: collectTextSnippets(contradiction).join(" | "),
        },
        repair_requirements: this.defaultRepairRequirementsForRisk(risk),
        clearance: null,
        source: "local_contradiction",
      });
    }
    for (const item of entry.profile_update_signals.introduced_contradictions || []) {
      const risk = "contradiction";
      events.push({
        risk_id: makeRiskId(entry.entry_id, risk, index++),
        risk,
        status: "active",
        target: "self",
        confidence: 0.75,
        introduced_by: {
          entry_id: entry.entry_id,
          evidence_span: collectTextSnippets(item).join(" | ") || cleanString(item),
        },
        repair_requirements: this.defaultRepairRequirementsForRisk(risk),
        clearance: null,
        source: "introduced_contradiction",
      });
    }
    return events;
  }

  defaultRepairRequirementsForRisk(risk = "") {
    const normalized = normalizeRiskType(risk);
    if (normalized === "false_certainty") return ["retraction", "answerable_to_reality", "non_self_sealing"];
    if (normalized === "contradiction") return ["resolve_tension", "restate_position", "coherence_check"];
    if (normalized === "self_sealing" || normalized === "dogmatic_closure") return ["allow_counterevidence", "non_self_sealing", "reopen_or_revise"];
    if (normalized === "reality_detachment") return ["reality_contact", "consequence_check", "constraint_check"];
    return ["relevant_repair", "restate_position"];
  }

  mergeRiskEvents(entry) {
    const profileState = this.state.profileState;
    const existing = Array.isArray(profileState.risk_events) ? cloneJSON(profileState.risk_events) : [];
    const incoming = [
      ...(Array.isArray(entry.risk_events) ? entry.risk_events : []),
      ...this.buildLegacyRiskEventsFromEntry(entry),
    ];

    const byId = new Map();
    for (const event of existing) {
      if (!event || typeof event !== "object") continue;
      const risk = normalizeRiskType(event.risk || event.type);
      const risk_id = cleanString(event.risk_id || event.id) || makeRiskId(event?.introduced_by?.entry_id || "legacy", risk, byId.size);
      byId.set(risk_id, {
        ...event,
        risk_id,
        risk,
        status: normalizeRiskStatus(event.status || "active"),
        repair_requirements: cleanStringList(event.repair_requirements || []),
      });
    }

    const findOpenRisk = (risk, addressesRiskId = null) => {
      if (addressesRiskId && byId.has(addressesRiskId)) return byId.get(addressesRiskId);
      const normalizedRisk = normalizeRiskType(risk);
      const candidates = [...byId.values()].filter((event) =>
        normalizeRiskType(event.risk) === normalizedRisk && normalizeRiskStatus(event.status) !== "cleared"
      );
      return candidates.length ? candidates[candidates.length - 1] : null;
    };

    for (const raw of incoming) {
      const event = normalizeRiskEvent(raw, { frame: entry.profile_target_frame, entryId: entry.entry_id });
      if (!event || !riskEventTargetsProfiledReferent(event, { frame: entry.profile_target_frame })) continue;
      const status = normalizeRiskStatus(event.status);
      if (status === "active") {
        const risk_id = cleanString(raw.risk_id || event.risk_id) || makeRiskId(entry.entry_id, event.risk, byId.size);
        byId.set(risk_id, {
          risk_id,
          risk: event.risk,
          status: "active",
          target: event.target,
          confidence: event.confidence,
          introduced_by: {
            entry_id: entry.entry_id,
            evidence_span: event.evidence_span || raw?.introduced_by?.evidence_span || "",
          },
          repair_requirements: cleanStringList(event.repair_requirements || raw.repair_requirements || this.defaultRepairRequirementsForRisk(event.risk)),
          clearance: null,
          source: raw.source || "structured_risk_event",
        });
        continue;
      }

      const targetRisk = findOpenRisk(event.risk, event.addresses_risk_id);
      if (!targetRisk) continue;
      const clearanceConfidence = Number(event.confidence || 0);
      const resolvedStatus = status === "cleared" && clearanceConfidence >= 0.75 ? "cleared" : "softened";
      targetRisk.status = resolvedStatus;
      targetRisk.clearance = {
        cleared_by_entry_id: entry.entry_id,
        confidence_score_0_to_1: clearanceConfidence,
        evidence_span: event.evidence_span,
        note: event.note,
      };
      byId.set(targetRisk.risk_id, targetRisk);
    }

    // Backward-compatible bridge for older extractor packets that repair via
    // retractions/resolved_contradictions/restatements but do not yet emit risk_events.
    if (entryHasExplicitRepairSignals(entry)) {
      for (const event of byId.values()) {
        if (normalizeRiskStatus(event.status) === "cleared") continue;
        if (!shouldClearPersistentRiskNote(`risk: ${riskDisplayLabel(event.risk)}`, entry)) continue;
        event.status = "cleared";
        event.clearance = {
          cleared_by_entry_id: entry.entry_id,
          confidence_score_0_to_1: 0.8,
          evidence_span: collectEntryRepairTexts(entry).join(" | "),
          note: "cleared_by_legacy_repair_fields",
        };
      }
    }

    profileState.risk_events = [...byId.values()].slice(-30);
  }

  riskNoteClearedByStructuredState(note = "") {
    const risk = riskNoteType(note);
    if (!risk) return false;
    const events = Array.isArray(this.state.profileState.risk_events) ? this.state.profileState.risk_events : [];
    const matching = events.filter((event) => normalizeRiskType(event.risk) === risk);
    return matching.length > 0 && matching.every((event) => normalizeRiskStatus(event.status) === "cleared");
  }

  structuredRiskNotes() {
    const events = Array.isArray(this.state.profileState.risk_events) ? this.state.profileState.risk_events : [];
    return events
      .filter((event) => normalizeRiskStatus(event.status) !== "cleared")
      .map((event) => {
        const status = normalizeRiskStatus(event.status);
        return `risk: ${riskDisplayLabel(event.risk)}${status === "softened" ? " (softened)" : ""}`;
      });
  }

  mergeRiskNotes(entry) {
    const profileState = this.state.profileState;
    const existingRiskNotes = cleanStringList(profileState.risk_notes || []).filter((note) =>
      !shouldClearPersistentRiskNote(note, entry) && !this.riskNoteClearedByStructuredState(note),
    );
    const riskNotes = [];
    for (const signal of entry.local_y_negative_signals) {
      if (!this.shouldPersistRiskSignal(entry, signal)) continue;
      const label = cleanString(signal.signal_type).replace(/_/g, " ");
      if (!label) continue;
      riskNotes.push(`risk: ${label}`);
    }
    for (const contradiction of entry.local_extraction.contradictions) {
      const type = cleanString(contradiction?.contradiction_type).replace(/_/g, " ");
      const severity = cleanString(contradiction?.severity).toLowerCase();
      riskNotes.push(`risk: ${type || "contradiction"}${severity ? ` (${severity})` : ""}`);
    }
    for (const item of entry.profile_update_signals.introduced_contradictions) {
      const note = cleanString(item?.reason || item?.normalized || item);
      if (note) riskNotes.push(`risk: contradiction introduced | ${note}`);
    }
    profileState.risk_notes = dedupeLatestFirst([
      ...existingRiskNotes,
      ...riskNotes,
      ...this.structuredRiskNotes(),
    ]).slice(0, 18);
  }

  mergeGateEvents(entry) {
    const filteredEntry = {
      ...entry,
      triggered_gate_events: (Array.isArray(entry.triggered_gate_events) ? entry.triggered_gate_events : []).filter((event) =>
        this.shouldMergeGateEvent(entry, event),
      ),
    };
    this.applyGateEventsToState(this.state.gateStates, filteredEntry);
  }

  refreshMetaEpistemicMarkers() {
    const markers = [];
    for (const [gate, data] of Object.entries(this.state.gateStates)) {
      if (data.status === "dormant") continue;
      markers.push(`${gate}: ${data.status}`);
    }
    this.state.profileState.meta_epistemic_markers = dedupeLatestFirst(markers).slice(0, 18);
    this.state.profileState.gate_snapshot = this.getGateSnapshot(this.state.gateStates);
  }

  contradictionPenaltyForEntry(entry) {
    let penalty = 0;
    const scopeWeight = this.scopeWeight(entry.analysis_scope) * this.scopeStrengthWeight(entry.scope_strength);
    const contradictionWeights = { low: 0.12, medium: 0.24, high: 0.4 };
    for (const contradiction of entry.local_extraction.contradictions || []) {
      const severity = cleanString(contradiction?.severity).toLowerCase();
      penalty += (contradictionWeights[severity] ?? contradictionWeights.medium) * scopeWeight;
    }
    const introducedCount = Array.isArray(entry.profile_update_signals.introduced_contradictions) ? entry.profile_update_signals.introduced_contradictions.length : 0;
    const resolvedCount = Array.isArray(entry.profile_update_signals.resolved_contradictions) ? entry.profile_update_signals.resolved_contradictions.length : 0;
    penalty += introducedCount * 0.12 * scopeWeight;
    penalty -= resolvedCount * 0.06 * scopeWeight;
    return Math.max(0, penalty);
  }

  localYSignalWeight(signal) {
    const polarity = cleanString(signal?.polarity).toLowerCase();
    const signalType = cleanString(signal?.signal_type).toLowerCase();
    const bucket = this.config.localYSignalWeights?.[polarity] || {};
    return Number(bucket?.[signalType]) || 1;
  }

  semanticSupportBucket(value) {
    const amount = Number(value) || 0;
    if (amount >= 0.75) return "strong";
    if (amount >= 0.4) return "moderate";
    if (amount > this.config.epsilon) return "weak";
    return "none";
  }

  buildSemanticFingerprint(entry = {}) {
    const tokens = new Set();
    const grid = entry.semantic_grid || {};
    for (const key of ["empathy", "practicality", "wisdom", "knowledge", "x_integration", "z_integration", "y_positive", "y_negative"]) {
      const field = grid[key] || {};
      const bucket = this.semanticSupportBucket(field.support);
      if (bucket !== "none") tokens.add(`grid:${key}:${bucket}`);
    }

    for (const dimension of DIMENSION_CONSIDERATION_DIMENSIONS) {
      const status = cleanString(entry?.dimension_consideration?.[dimension]?.status).toLowerCase();
      if (status && status !== "not_evidenced_here") tokens.add(`dimension:${dimension}:${status}`);
    }

    for (const item of entry.axis_events?.x_pole_evidence || []) {
      const pole = cleanString(item.pole).toLowerCase();
      if (pole) tokens.add(`x_pole:${pole}`);
    }
    for (const item of entry.axis_events?.z_pole_evidence || []) {
      const pole = cleanString(item.pole).toLowerCase();
      if (pole) tokens.add(`z_pole:${pole}`);
    }
    for (const item of entry.axis_events?.x_integration_events || []) {
      const kind = cleanString(item.type).toLowerCase() || "integrated_tension";
      tokens.add(`x_integration:${kind}`);
    }
    for (const item of entry.axis_events?.z_integration_events || []) {
      const kind = cleanString(item.type).toLowerCase() || "integrated_tension";
      tokens.add(`z_integration:${kind}`);
    }

    for (const signal of entry.local_y_positive_signals || []) {
      const target = normalizeAttributionTarget(signal.target, {
        frame: entry.profile_target_frame,
        direction: "positive",
      });
      if (!attributionCountsAsSelf(target)) continue;
      const signalType = cleanString(signal.signal_type || signal.type).toLowerCase();
      if (signalType) tokens.add(`y_positive:${signalType}`);
    }
    for (const signal of entry.local_y_negative_signals || []) {
      const target = normalizeAttributionTarget(signal.target, {
        frame: entry.profile_target_frame,
        direction: "negative",
      });
      if (!attributionCountsAsSelf(target)) continue;
      const signalType = cleanString(signal.signal_type || signal.type).toLowerCase();
      if (signalType) tokens.add(`y_negative:${signalType}`);
    }

    for (const event of entry.triggered_gate_events || []) {
      const target = normalizeAttributionTarget(event.target, {
        frame: entry.profile_target_frame,
        direction: cleanString(event.direction).toLowerCase(),
      });
      if (!attributionCountsAsSelf(target)) continue;
      const gate = cleanString(event.gate);
      const direction = cleanString(event.direction).toLowerCase();
      if (gate && direction) tokens.add(`gate:${gate}:${direction}`);
    }

    for (const item of entry.local_extraction?.tradeoffs || []) {
      const text = cleanString(item?.normalized || item);
      if (!text) continue;
      const normalized = text.toLowerCase();
      if (normalized.includes("empathy") && normalized.includes("practicality")) tokens.add("tradeoff:empathy_practicality");
      if (normalized.includes("wisdom") && normalized.includes("knowledge")) tokens.add("tradeoff:wisdom_knowledge");
    }

    return Array.from(tokens).sort();
  }

  jaccardTokenSimilarity(tokensA = [], tokensB = []) {
    const left = new Set(Array.isArray(tokensA) ? tokensA : []);
    const right = new Set(Array.isArray(tokensB) ? tokensB : []);
    if (!left.size && !right.size) return 0;
    let intersection = 0;
    for (const token of left) {
      if (right.has(token)) intersection += 1;
    }
    const union = new Set([...left, ...right]).size;
    return union > 0 ? intersection / union : 0;
  }

  semanticTokenCategory(token = "") {
    const value = cleanString(token).toLowerCase();
    if (!value) return "other";
    if (
      value.startsWith("grid:empathy:") ||
      value.startsWith("grid:practicality:") ||
      value.startsWith("grid:wisdom:") ||
      value.startsWith("grid:knowledge:") ||
      value.startsWith("dimension:empathy:") ||
      value.startsWith("dimension:practicality:") ||
      value.startsWith("dimension:wisdom:") ||
      value.startsWith("dimension:knowledge:") ||
      value.startsWith("x_pole:") ||
      value.startsWith("z_pole:")
    ) {
      return "lateral";
    }
    if (
      value.startsWith("grid:x_integration:") ||
      value.startsWith("grid:z_integration:") ||
      value.startsWith("x_integration:") ||
      value.startsWith("z_integration:") ||
      value.startsWith("tradeoff:")
    ) {
      return "integration";
    }
    if (
      value.startsWith("grid:y_positive:") ||
      value.startsWith("grid:y_negative:") ||
      value.startsWith("y_positive:") ||
      value.startsWith("y_negative:") ||
      value.startsWith("gate:")
    ) {
      return "y";
    }
    return "other";
  }

  tokensByCategory(tokens = []) {
    const buckets = {
      lateral: [],
      integration: [],
      y: [],
      other: [],
    };
    for (const token of Array.isArray(tokens) ? tokens : []) {
      buckets[this.semanticTokenCategory(token)].push(token);
    }
    return buckets;
  }

  semanticNoveltyMultiplier(maxSimilarity = 0, { floor = this.config.semanticRedundancyFloor, power = this.config.semanticRedundancyPower } = {}) {
    const normalizedFloor = EpistemicProfiler.clamp(Number(floor ?? 0.08), 0, 1);
    const normalizedPower = Math.max(0.1, Number(power ?? 2.0));
    const noveltyStrength = Math.pow(Math.max(0, 1 - maxSimilarity), normalizedPower);
    return EpistemicProfiler.clamp(normalizedFloor + noveltyStrength * (1 - normalizedFloor), normalizedFloor, 1);
  }

  novelTokenRatio(tokens = [], priorUnion = new Set()) {
    const arr = Array.isArray(tokens) ? tokens : [];
    if (!arr.length) return 0;
    let novelCount = 0;
    for (const token of arr) {
      if (!priorUnion.has(token)) novelCount += 1;
    }
    return novelCount / arr.length;
  }

  categoryNoveltyMultiplier({
    maxSimilarity = 0,
    tokenCount = 0,
    novelRatio = 0,
    category = "other",
    hadPrior = false,
  } = {}) {
    if (this.config.semanticRedundancyDampingEnabled === false) return 1;
    if (!hadPrior || tokenCount <= 0) return 1;
    const floorMap = {
      lateral: Number(this.config.semanticLateralRedundancyFloor ?? 0.02),
      integration: Number(this.config.semanticIntegrationRedundancyFloor ?? 0.04),
      y: Number(this.config.semanticYRedundancyFloor ?? 0.08),
      other: Number(this.config.semanticRedundancyFloor ?? 0.08),
    };
    const floor = EpistemicProfiler.clamp(floorMap[category] ?? floorMap.other, 0, 1);
    const base = this.semanticNoveltyMultiplier(maxSimilarity, { floor });
    const noveltyRatioPower = Math.max(0.1, Number(this.config.semanticRedundancyPower ?? 2.0));
    const ratioDriven = EpistemicProfiler.clamp(
      floor + Math.pow(Math.max(0, novelRatio), noveltyRatioPower) * (1 - floor),
      floor,
      1,
    );
    let multiplier = Math.min(base, ratioDriven);
    const highSimilarityThreshold = Number(this.config.semanticHighSimilarityThreshold ?? 0.72);
    if (novelRatio <= this.config.epsilon && maxSimilarity >= highSimilarityThreshold) {
      multiplier *= Number(this.config.semanticRestatementPenalty ?? 0.35);
    }
    return EpistemicProfiler.clamp(multiplier, 0, 1);
  }

  buildSemanticNoveltyDiagnostics(entries = this.getAggregationEntries()) {
    const diagnostics = [];
    const priorFingerprints = [];
    const priorUnion = new Set();
    const priorUnionByCategory = {
      lateral: new Set(),
      integration: new Set(),
      y: new Set(),
      other: new Set(),
    };
    for (const entry of entries) {
      const fingerprint = this.buildSemanticFingerprint(entry);
      const categorized = this.tokensByCategory(fingerprint);
      let maxSimilarity = 0;
      for (const prior of priorFingerprints) {
        maxSimilarity = Math.max(maxSimilarity, this.jaccardTokenSimilarity(fingerprint, prior.fingerprint));
      }
      const hadPrior = priorFingerprints.length > 0;
      const overallNovelRatio = this.novelTokenRatio(fingerprint, priorUnion);
      const overallMultiplier = hadPrior
        ? this.categoryNoveltyMultiplier({
            maxSimilarity,
            tokenCount: fingerprint.length,
            novelRatio: overallNovelRatio,
            category: "other",
            hadPrior,
          })
        : 1;
      const lateralNovelRatio = this.novelTokenRatio(categorized.lateral, priorUnionByCategory.lateral);
      const integrationNovelRatio = this.novelTokenRatio(categorized.integration, priorUnionByCategory.integration);
      const yNovelRatio = this.novelTokenRatio(categorized.y, priorUnionByCategory.y);
      const record = {
        addedAt: entry.addedAt || null,
        profile_target_frame: normalizeProfileTargetFrame(entry.profile_target_frame),
        tokenCount: fingerprint.length,
        maxSimilarity,
        overallNovelRatio,
        semanticContributionMultiplier: overallMultiplier,
        lateralContributionMultiplier: hadPrior
          ? this.categoryNoveltyMultiplier({
              maxSimilarity,
              tokenCount: categorized.lateral.length,
              novelRatio: lateralNovelRatio,
              category: "lateral",
              hadPrior,
            })
          : 1,
        integrationContributionMultiplier: hadPrior
          ? this.categoryNoveltyMultiplier({
              maxSimilarity,
              tokenCount: categorized.integration.length,
              novelRatio: integrationNovelRatio,
              category: "integration",
              hadPrior,
            })
          : 1,
        yContributionMultiplier: hadPrior
          ? this.categoryNoveltyMultiplier({
              maxSimilarity,
              tokenCount: categorized.y.length,
              novelRatio: yNovelRatio,
              category: "y",
              hadPrior,
            })
          : 1,
        novelTokenRatios: {
          lateral: lateralNovelRatio,
          integration: integrationNovelRatio,
          y: yNovelRatio,
        },
      };
      diagnostics.push(record);
      priorFingerprints.push({ entry, fingerprint, record });
      for (const token of fingerprint) priorUnion.add(token);
      for (const category of Object.keys(priorUnionByCategory)) {
        for (const token of categorized[category] || []) priorUnionByCategory[category].add(token);
      }
    }
    return diagnostics;
  }

  semanticContribution(entry, options = {}) {
    const scopeMultiplier = this.scopeWeight(entry.analysis_scope) * this.scopeStrengthWeight(entry.scope_strength);
    const globalMultiplier = EpistemicProfiler.clamp(Number(options.contributionMultiplier ?? 1), 0, 1);
    const lateralMultiplier = EpistemicProfiler.clamp(Number(options.lateralContributionMultiplier ?? globalMultiplier), 0, 1);
    const integrationMultiplier = EpistemicProfiler.clamp(Number(options.integrationContributionMultiplier ?? globalMultiplier), 0, 1);
    const yMultiplier = EpistemicProfiler.clamp(Number(options.yContributionMultiplier ?? globalMultiplier), 0, 1);
    const out = {
      empathy: 0,
      practicality: 0,
      wisdom: 0,
      knowledge: 0,
      x_integration: 0,
      z_integration: 0,
      y_positive: 0,
      y_negative: 0,
    };
    const grid = entry.semantic_grid || {};
    const frame = normalizeProfileTargetFrame(entry.profile_target_frame);
    const allowGridNegativeY = entryHasSelfTargetedNegativeEvidence(entry);
    const multipliersByKey = {
      empathy: lateralMultiplier,
      practicality: lateralMultiplier,
      wisdom: lateralMultiplier,
      knowledge: lateralMultiplier,
      x_integration: integrationMultiplier,
      z_integration: integrationMultiplier,
      y_positive: yMultiplier,
      y_negative: yMultiplier,
    };
    for (const key of Object.keys(out)) {
      if (key === "y_negative" && !allowGridNegativeY) continue;
      const field = grid[key] || { support: 0, confidence: 0 };
      const keyMultiplier = multipliersByKey[key] ?? globalMultiplier;
      out[key] += Number(field.support || 0) * Number(field.confidence || 0) * scopeMultiplier * keyMultiplier;
    }

    for (const item of entry.axis_events.x_pole_evidence || []) {
      const value = this.strengthWeight(item.strength) * Number(item.confidence || 0) * scopeMultiplier * lateralMultiplier;
      if (cleanString(item.pole).toLowerCase() === "empathy") out.empathy = Math.max(out.empathy, value);
      if (cleanString(item.pole).toLowerCase() === "practicality") out.practicality = Math.max(out.practicality, value);
    }
    for (const item of entry.axis_events.z_pole_evidence || []) {
      const value = this.strengthWeight(item.strength) * Number(item.confidence || 0) * scopeMultiplier * lateralMultiplier;
      if (cleanString(item.pole).toLowerCase() === "wisdom") out.wisdom = Math.max(out.wisdom, value);
      if (cleanString(item.pole).toLowerCase() === "knowledge") out.knowledge = Math.max(out.knowledge, value);
    }
    for (const item of entry.axis_events.x_integration_events || []) {
      const value = this.strengthWeight(item.strength) * Number(item.confidence || 0) * scopeMultiplier * integrationMultiplier;
      out.x_integration = Math.max(out.x_integration, value);
    }
    for (const item of entry.axis_events.z_integration_events || []) {
      const value = this.strengthWeight(item.strength) * Number(item.confidence || 0) * scopeMultiplier * integrationMultiplier;
      out.z_integration = Math.max(out.z_integration, value);
    }
    for (const signal of entry.local_y_positive_signals || []) {
      if (!signalTargetsProfiledReferent(signal, { frame, direction: "positive" })) continue;
      const value = this.strengthWeight(signal.strength) * Number(signal.confidence || 0) * scopeMultiplier * this.localYSignalWeight(signal) * yMultiplier;
      out.y_positive = Math.max(out.y_positive, value);
    }
    for (const signal of entry.local_y_negative_signals || []) {
      if (!signalTargetsProfiledReferent(signal, { frame, direction: "negative" })) continue;
      const value = this.strengthWeight(signal.strength) * Number(signal.confidence || 0) * scopeMultiplier * this.localYSignalWeight(signal) * yMultiplier;
      out.y_negative = Math.max(out.y_negative, value);
    }
    return out;
  }

  buildRepairDiagnostics(entries = this.getAggregationEntries()) {
    return entries.map((entry, index) => {
      const laterRepairs = entries.slice(index + 1).filter((candidate) =>
        repairEntryAddressesPriorNegative(entry, candidate),
      );
      const repairedByLaterEntry = laterRepairs.length > 0 && entryHasRepairableNegativeMaterial(entry);
      return {
        repairedByLaterEntry,
        repairCount: laterRepairs.length,
        negativeMultiplier: repairedByLaterEntry ? 0 : 1,
        contradictionMultiplier: repairedByLaterEntry ? 0 : 1,
        repairedBy: laterRepairs.map((candidate) => candidate.addedAt || null),
      };
    });
  }

  aggregateSemanticGrid(entries = this.getAggregationEntries()) {
    const totals = {
      empathy: 0,
      practicality: 0,
      wisdom: 0,
      knowledge: 0,
      x_integration: 0,
      z_integration: 0,
      y_positive: 0,
      y_negative: 0,
    };
    let contradictionPenalty = 0;
    const semanticNovelty = this.buildSemanticNoveltyDiagnostics(entries);
    const repairDiagnostics = this.buildRepairDiagnostics(entries);

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const noveltyInfo = semanticNovelty[index] || { semanticContributionMultiplier: 1 };
      const repairInfo = repairDiagnostics[index] || {
        negativeMultiplier: 1,
        contradictionMultiplier: 1,
      };
      const part = this.semanticContribution(entry, {
        contributionMultiplier: noveltyInfo.semanticContributionMultiplier,
        lateralContributionMultiplier: noveltyInfo.lateralContributionMultiplier,
        integrationContributionMultiplier: noveltyInfo.integrationContributionMultiplier,
        yContributionMultiplier: noveltyInfo.yContributionMultiplier,
      });
      part.y_negative *= repairInfo.negativeMultiplier;

      for (const key of Object.keys(totals)) totals[key] += part[key];
      contradictionPenalty += this.contradictionPenaltyForEntry(entry) * repairInfo.contradictionMultiplier;
    }
    return { totals, contradictionPenalty, semanticNovelty, repairDiagnostics };
  }


inferRelevantGatesFromEntry(entry = {}) {
  const frame = normalizeProfileTargetFrame(entry.profile_target_frame);
  const fromTriggered = Array.isArray(entry.triggered_gate_events)
    ? entry.triggered_gate_events
        .filter((item) => {
          const direction = cleanString(item?.direction).toLowerCase() || "neutral";
          return signalTargetsProfiledReferent(item, { frame, direction });
        })
        .map((item) => cleanString(item?.gate))
    : [];
  const fromProposals = Array.isArray(entry.gate_update_proposals)
    ? entry.gate_update_proposals
        .filter((item) => cleanString(item?.local_direction).toLowerCase() !== "neutral")
        .map((item) => cleanString(item?.gate))
    : [];
  return [...new Set([...fromTriggered, ...fromProposals].filter((gate) => GATE_NAME_LIST.includes(gate)))];
}

inferScopeCompleteForEntry(entry = {}) {
  const explicit = entry?.scope_profile?.scope_complete_for_text;
  if (typeof explicit === "boolean") return explicit;

  const consideration = entry.dimension_consideration || {};
  const dimensionsCovered = DIMENSION_CONSIDERATION_DIMENSIONS.every((dimension) => {
    const status = cleanString(consideration?.[dimension]?.status).toLowerCase();
    return status && status !== "not_evidenced_here";
  });

  const xIntegration = (entry.axis_events?.x_integration_events || []).length > 0 ||
    Number(entry.semantic_grid?.x_integration?.support || 0) * Number(entry.semantic_grid?.x_integration?.confidence || 0) >= 0.3;
  const zIntegration = (entry.axis_events?.z_integration_events || []).length > 0 ||
    Number(entry.semantic_grid?.z_integration?.support || 0) * Number(entry.semantic_grid?.z_integration?.confidence || 0) >= 0.3;
  const frame = normalizeProfileTargetFrame(entry?.profile_target_frame);
  const positiveY = (entry.local_y_positive_signals || []).some((signal) =>
    signalTargetsProfiledReferent(signal, { frame, direction: "positive" })
  ) || Number(entry.semantic_grid?.y_positive?.support || 0) * Number(entry.semantic_grid?.y_positive?.confidence || 0) >= 0.3;
  const selfNegativeSignals = (entry.local_y_negative_signals || []).some((signal) =>
    signalTargetsProfiledReferent(signal, { frame, direction: "negative" })
  );
  const selfNegativeGateEvents = (entry.triggered_gate_events || []).some((event) =>
    cleanString(event?.direction).toLowerCase() === "negative" &&
    signalTargetsProfiledReferent(event, { frame, direction: "negative" })
  );
  const negativeY = selfNegativeSignals || selfNegativeGateEvents ||
    Array.isArray(entry?.local_extraction?.contradictions) && entry.local_extraction.contradictions.length > 0 ||
    Array.isArray(entry?.profile_update_signals?.introduced_contradictions) && entry.profile_update_signals.introduced_contradictions.length > 0;

  return dimensionsCovered && xIntegration && zIntegration && positiveY && !negativeY;
}

computeScopeDiagnostics(entries = this.getAggregationEntries(), gateStates = this.state.gateStates) {
  const activeEntry = entries.length ? entries[entries.length - 1] : null;
  if (!activeEntry) {
    return {
      activeEntryAddedAt: null,
      claimedScope: "narrow",
      scopeCompleteForText: false,
      scopeExpansion: "none",
      unresolvedScopeGaps: [],
      relevantGates: [],
      irrelevantGates: [],
      relevantGateCoverage: 1,
      scopeExpansionPressure: 0,
      claimCommitmentCounts: {},
    };
  }

  const claimCommitmentCounts = {};
  for (const item of activeEntry.claim_commitments || []) {
    const key = cleanString(item?.commitment).toLowerCase() || "asserted";
    claimCommitmentCounts[key] = (claimCommitmentCounts[key] || 0) + 1;
  }

  const relevantGates = activeEntry.scope_profile?.relevant_gates?.length
    ? [...new Set(cleanStringList(activeEntry.scope_profile.relevant_gates).filter((gate) => GATE_NAME_LIST.includes(gate)))]
    : this.inferRelevantGatesFromEntry(activeEntry);
  const irrelevantGates = (activeEntry.scope_profile?.irrelevant_gates?.length
    ? [...new Set(cleanStringList(activeEntry.scope_profile.irrelevant_gates).filter((gate) => GATE_NAME_LIST.includes(gate)))]
    : GATE_NAME_LIST.filter((gate) => !relevantGates.includes(gate)))
    .filter((gate) => !relevantGates.includes(gate));

  const activeFrame = normalizeProfileTargetFrame(activeEntry.profile_target_frame);
  const activeTriggeredRelevant = new Set(
    (activeEntry.triggered_gate_events || [])
      .filter((event) => {
        const direction = cleanString(event?.direction).toLowerCase() || "neutral";
        return signalTargetsProfiledReferent(event, { frame: activeFrame, direction });
      })
      .map((event) => cleanString(event?.gate))
      .filter((gate) => GATE_NAME_LIST.includes(gate))
  );
  const activeProposalRelevant = new Set(
    (activeEntry.gate_update_proposals || [])
      .filter((proposal) => {
        const gate = cleanString(proposal?.gate);
        const localDirection = cleanString(proposal?.local_direction).toLowerCase();
        const proposedEffect = cleanString(proposal?.proposed_effect).toLowerCase();
        return GATE_NAME_LIST.includes(gate) && localDirection !== "neutral" && proposedEffect !== "no_change";
      })
      .map((proposal) => cleanString(proposal?.gate))
  );

  let relevantGateCoverage = 0;
  if (relevantGates.length) {
    const relevantTotalWeight = relevantGates.reduce((sum, gate) => sum + this.gateWeight(gate), 0);
    const coveredWeight = relevantGates.reduce((sum, gate) => {
      const data = gateStates?.[gate];
      const coveredByState = !!(data && (data.positive_events || data.negative_events));
      const coveredByActiveEntry = activeTriggeredRelevant.has(gate) || activeProposalRelevant.has(gate);
      return coveredByState || coveredByActiveEntry ? sum + this.gateWeight(gate) : sum;
    }, 0);
    relevantGateCoverage = relevantTotalWeight > 0 ? coveredWeight / relevantTotalWeight : 1;
  }

  const scopeCompleteForText = this.inferScopeCompleteForEntry(activeEntry);
  const unresolvedScopeGaps = cleanStringList(activeEntry.scope_profile?.unresolved_scope_gaps || []);
  let scopeExpansionPressure = 0;
  const scopeExpansion = cleanString(activeEntry.scope_profile?.scope_expansion).toLowerCase() || "none";
  if (!scopeCompleteForText) {
    if (scopeExpansion === "widened") {
      scopeExpansionPressure += 0.2;
    } else if (scopeExpansion === "contained") {
      scopeExpansionPressure += 0.08;
    }
    scopeExpansionPressure += unresolvedScopeGaps.length * 0.08;
    if (relevantGates.length) scopeExpansionPressure += (1 - relevantGateCoverage) * 0.2;
  }

  return {
    activeEntryAddedAt: activeEntry.addedAt || null,
    activeAnalysisScope: cleanString(activeEntry.analysis_scope).toLowerCase() || "stance",
    activeScopeStrength: cleanString(activeEntry.scope_strength).toLowerCase() || "low",
    claimedScope: cleanString(activeEntry.scope_profile?.claimed_scope).toLowerCase() || this.inferClaimedScopeLevel(activeEntry.analysis_scope),
    scopeCompleteForText,
    scopeExpansion,
    unresolvedScopeGaps,
    relevantGates,
    irrelevantGates,
    relevantGateCoverage,
    scopeGateDiagnostics: {
      declaredRelevantGates: cleanStringList(activeEntry.scope_profile?.gate_support_diagnostics?.declaredRelevantGates || []),
      supportedRelevantGates: cleanStringList(activeEntry.scope_profile?.gate_support_diagnostics?.supportedRelevantGates || relevantGates),
      unsupportedRelevantGates: cleanStringList(activeEntry.scope_profile?.gate_support_diagnostics?.unsupportedRelevantGates || []),
    },
    scopeExpansionPressure: EpistemicProfiler.clamp(scopeExpansionPressure, 0, 1),
    claimCommitmentCounts,
  };
}

applyScopeRelativePeakAdjustment({ a = 0, b = 0, s = 0, lateral = {}, totals = {}, dimensionConsideration = {}, scopeDiagnostics = {}, yData = {} } = {}) {
  const rawA = Number(a) || 0;
  const rawB = Number(b) || 0;
  const rawS = Number(s) || 0;
  let adjustedA = rawA;
  let adjustedB = rawB;
  let adjustedS = rawS;

  const integrationThreshold = Number(this.config.scopePeakIntegrationThreshold ?? 0.22);
  const relevantCoverageThreshold = Number(this.config.scopePeakRelevantGateCoverageThreshold ?? 0);
  const strongDimensionCoverageThreshold = Number(this.config.scopePeakStrongDimensionCoverageThreshold ?? 0.85);
  const requireNoNegative = Boolean(this.config.scopePeakRequiresNoNegative);

  const selfSemanticNegative = Number(totals.y_negative || 0);
  const selfGateNegative = Number(yData.weightedMeanNegativeGateScores || 0);
  const noNegativePressure = !requireNoNegative || (
    selfSemanticNegative <= this.config.epsilon &&
    selfGateNegative <= this.config.epsilon
  );

  const dimensionCoverageRatio = Number(dimensionConsideration.coverageRatio || 0);
  const fullDimensionCoverage = dimensionCoverageRatio >= strongDimensionCoverageThreshold;
  const rejectedDimensions = cleanStringList(dimensionConsideration.explicitlyRejected || []);
  const deprioritizedDimensions = cleanStringList(dimensionConsideration.explicitlyDeprioritized || []);
  const noRejectedOrDeprioritizedDimensions = rejectedDimensions.length === 0 && deprioritizedDimensions.length === 0;
  const scopeComplete = Boolean(scopeDiagnostics.scopeCompleteForText);
  const noScopeGaps = Array.isArray(scopeDiagnostics.unresolvedScopeGaps) && scopeDiagnostics.unresolvedScopeGaps.length === 0;
  const rawRelevantCoverage = Number(scopeDiagnostics.relevantGateCoverage);
  const relevantCoverage = Number.isFinite(rawRelevantCoverage) ? rawRelevantCoverage : 0;
  const relevantCoverageOK = relevantCoverage >= relevantCoverageThreshold;
  const absoluteGateCoverage = EpistemicProfiler.clamp(Number(yData.yCoverage || 0), 0, 1);
  const configuredAbsoluteGateCoverageThreshold = Number(this.config.scopePeakAbsoluteGateCoverageThreshold ?? 0);
  const highAbsoluteGateCoverageBypassThreshold = Number(this.config.scopePeakHighAbsoluteGateCoverageBypassThreshold ?? 1);
  const positiveGateNames = new Set(cleanStringList(yData.positiveGateNames || []));
  const coreGateNames = cleanStringList(this.config.scopePeakCoreGateNames || []);
  const stabilizerGateNames = cleanStringList(this.config.scopePeakStabilizerGateNames || []);
  const requireCoreGates = this.config.scopePeakRequireCoreGates !== false;
  const requireStabilizerGate = this.config.scopePeakRequireStabilizerGate !== false;
  const coreGatesSatisfied = !requireCoreGates || !coreGateNames.length || coreGateNames.every((gate) => positiveGateNames.has(gate));
  const stabilizerGateSatisfied = !requireStabilizerGate || !stabilizerGateNames.length || stabilizerGateNames.some((gate) => positiveGateNames.has(gate));
  const highAbsoluteGateCoverageBypass = absoluteGateCoverage >= highAbsoluteGateCoverageBypassThreshold;
  const peakGateStructureOK = coreGatesSatisfied && (stabilizerGateSatisfied || highAbsoluteGateCoverageBypass);
  const totalGateWeight = Object.values(this.config.gateWeights || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  const gateSetWeight = (gates = []) => gates.reduce(
    (sum, gate) => sum + Math.max(0, Number(this.config.gateWeights?.[gate] || 0)),
    0,
  );
  const minimumStabilizerGateWeight = stabilizerGateNames.length
    ? Math.min(...stabilizerGateNames.map((gate) => Math.max(0, Number(this.config.gateWeights?.[gate] || 0))))
    : 0;
  const minimumPeakGateSetCoverage = totalGateWeight > 0
    ? (gateSetWeight(coreGateNames) + (requireStabilizerGate ? minimumStabilizerGateWeight : 0)) / totalGateWeight
    : 0;
  const effectiveAbsoluteGateCoverageThreshold = peakGateStructureOK
    ? Math.min(configuredAbsoluteGateCoverageThreshold, minimumPeakGateSetCoverage)
    : configuredAbsoluteGateCoverageThreshold;
  const absoluteGateCoverageOK = absoluteGateCoverage + this.config.epsilon >= effectiveAbsoluteGateCoverageThreshold;
  const integrationStrength = Math.min(Number(lateral.IX || 0), Number(lateral.IZ || 0));
  const integrationStrong = integrationStrength >= integrationThreshold;

  const completionEligible =
    scopeComplete &&
    noScopeGaps &&
    fullDimensionCoverage &&
    noRejectedOrDeprioritizedDimensions &&
    noNegativePressure &&
    relevantCoverageOK &&
    absoluteGateCoverageOK &&
    peakGateStructureOK &&
    integrationStrong;

  const stabilityComponent = EpistemicProfiler.clamp((rawS + 1) / 2, 0, 1);
  const integrationComponent = EpistemicProfiler.clamp(
    integrationThreshold > 0 ? integrationStrength / integrationThreshold : integrationStrength,
    0,
    1,
  );
  const coverageComponent = EpistemicProfiler.clamp(dimensionCoverageRatio, 0, 1);
  const gateCoverageComponent = EpistemicProfiler.clamp(relevantCoverage, 0, 1);
  const absoluteGateCoverageComponent = EpistemicProfiler.clamp(absoluteGateCoverage, 0, 1);
  const maturityCompletionScore = completionEligible
    ? 1
    : EpistemicProfiler.clamp(
        0.32 * stabilityComponent +
        0.23 * integrationComponent +
        0.22 * coverageComponent +
        0.13 * gateCoverageComponent +
        0.10 * absoluteGateCoverageComponent,
        0,
        1,
      );

  let compressionApplied = 0;
  let softLiftApplied = 0;
  let peakSnapped = false;
  let overflowReserve = 0;
  const directPeakOnCompletion = this.config.directPeakOnScopeCompletion !== false;
  const peakEligibleInScope = directPeakOnCompletion && completionEligible;

  if (peakEligibleInScope) {
    overflowReserve = Math.abs(rawA) + Math.abs(rawB);
    compressionApplied = overflowReserve > this.config.epsilon ? 1 : 0;
    adjustedA = 0;
    adjustedB = 0;
    adjustedS = 1;
    softLiftApplied = Math.max(0, adjustedS - rawS);
    peakSnapped = true;
  }

  return {
    a: adjustedA,
    b: adjustedB,
    s: EpistemicProfiler.clamp(adjustedS, -Number(this.config.semanticOverflowCeiling ?? 3), Number(this.config.semanticOverflowCeiling ?? 3)),
    peakEligibleInScope,
    completionEligible,
    maturityCompletionScore,
    compressionApplied,
    softLiftApplied,
    peakSnapped,
    overflowReserve,
    noRejectedOrDeprioritizedDimensions,
    rejectedDimensions,
    deprioritizedDimensions,
    relevantCoverage,
    relevantCoverageThreshold,
    absoluteGateCoverage,
    absoluteGateCoverageThreshold: effectiveAbsoluteGateCoverageThreshold,
    configuredAbsoluteGateCoverageThreshold,
    minimumPeakGateSetCoverage,
    highAbsoluteGateCoverageBypassThreshold,
    coreGateNames,
    stabilizerGateNames,
    coreGatesSatisfied,
    stabilizerGateSatisfied,
    highAbsoluteGateCoverageBypass,
    peakGateStructureOK,
    positiveGateNames: Array.from(positiveGateNames),
    integrationStrength,
  };
}

  aggregateLateralFromDense(totals) {
    const E = totals.empathy;
    const P = totals.practicality;
    const W = totals.wisdom;
    const K = totals.knowledge;
    const IX = EpistemicProfiler.clamp(totals.x_integration, 0, 1);
    const IZ = EpistemicProfiler.clamp(totals.z_integration, 0, 1);

    const xPoleDelta = E - P;
    const zPoleDelta = W - K;

    const xPoleMass = E + P;
    const zPoleMass = W + K;

    const xIntegrationRatio = xPoleMass > this.config.epsilon ? IX / (xPoleMass + IX) : 0;
    const zIntegrationRatio = zPoleMass > this.config.epsilon ? IZ / (zPoleMass + IZ) : 0;

    const semanticOverflowCeiling = Number(this.config.semanticOverflowCeiling ?? 3);
    let a = xPoleMass <= this.config.epsilon ? 0 :
      EpistemicProfiler.clamp(
        (xPoleDelta * (1 - xIntegrationRatio * this.config.integrationInfluence)) /
          (this.config.axisSaturation.empathyPracticality || 2.5),
        -semanticOverflowCeiling,
        semanticOverflowCeiling,
      );

    let b = zPoleMass <= this.config.epsilon ? 0 :
      EpistemicProfiler.clamp(
        (zPoleDelta * (1 - zIntegrationRatio * this.config.integrationInfluence)) /
          (this.config.axisSaturation.wisdomKnowledge || 2.5),
        -semanticOverflowCeiling,
        semanticOverflowCeiling,
      );

    return {
      a,
      b,
      xPoleDelta,
      zPoleDelta,
      xPoleMass,
      zPoleMass,
      xBalance: Math.min(E, P),
      zBalance: Math.min(W, K),
      IX,
      IZ,
    };
  }

  semanticFieldMeetsThreshold(field = {}, { support = 0, confidence = 0 } = {}) {
    return Number(field?.support || 0) >= support && Number(field?.confidence || 0) >= confidence;
  }

  dimensionStatusCountsAsIntegrated(field = {}) {
    const status = cleanString(field?.status).toLowerCase();
    return ["tradeoff_engaged", "directly_engaged", "acknowledged"].includes(status);
  }

  computeAxisIntegrationAnchorForEntry(entry = {}, axis = "x") {
    if (!this.config.contextualAxisAnchorEnabled) {
      return { active: false, axis, strength: 0, reason: "disabled" };
    }
    if (!entry || typeof entry !== "object") {
      return { active: false, axis, strength: 0, reason: "missing_entry" };
    }
    if (entryHasSelfTargetedNegativeEvidence(entry)) {
      return { active: false, axis, strength: 0, reason: "self_targeted_negative_evidence" };
    }

    const grid = entry.semantic_grid || {};
    const consideration = entry.dimension_consideration || {};
    const supportThreshold = Number(this.config.contextualAxisAnchorPoleSupportThreshold ?? 0.75);
    const confidenceThreshold = Number(this.config.contextualAxisAnchorPoleConfidenceThreshold ?? 0.7);
    const integrationSupportThreshold = Number(this.config.contextualAxisAnchorIntegrationSupportThreshold ?? 0.8);
    const integrationConfidenceThreshold = Number(this.config.contextualAxisAnchorIntegrationConfidenceThreshold ?? 0.75);
    const yPositiveThreshold = Number(this.config.contextualAxisAnchorYPositiveThreshold ?? 0.6);

    const poleKeys = axis === "z" ? ["wisdom", "knowledge"] : ["empathy", "practicality"];
    const integrationKey = axis === "z" ? "z_integration" : "x_integration";
    const poleFields = poleKeys.map((key) => grid[key] || {});
    const considerationFields = poleKeys.map((key) => consideration[key] || {});

    const polesSupported = poleFields.every((field) =>
      this.semanticFieldMeetsThreshold(field, { support: supportThreshold, confidence: confidenceThreshold }),
    );
    const integrationSupported = this.semanticFieldMeetsThreshold(grid[integrationKey] || {}, {
      support: integrationSupportThreshold,
      confidence: integrationConfidenceThreshold,
    });
    const dimensionsIntegrated = considerationFields.every((field) => this.dimensionStatusCountsAsIntegrated(field));
    const yPositive = Number(grid.y_positive?.support || 0) * Number(grid.y_positive?.confidence || 0);
    const yPositiveSupported = yPositive >= yPositiveThreshold * confidenceThreshold;

    if (!(polesSupported && integrationSupported && dimensionsIntegrated && yPositiveSupported)) {
      return {
        active: false,
        axis,
        strength: 0,
        reason: "thresholds_not_met",
        polesSupported,
        integrationSupported,
        dimensionsIntegrated,
        yPositiveSupported,
      };
    }

    const poleScore = poleFields.reduce(
      (sum, field) => sum + Number(field.support || 0) * Number(field.confidence || 0),
      0,
    ) / poleFields.length;
    const integrationScore = Number(grid[integrationKey]?.support || 0) * Number(grid[integrationKey]?.confidence || 0);
    const strength = EpistemicProfiler.clamp((poleScore + integrationScore + yPositive) / 3, 0, 1);

    return {
      active: true,
      axis,
      strength,
      reason: "strong_structured_axis_integration_anchor",
      poleKeys,
      integrationKey,
      poleScore,
      integrationScore,
      yPositive,
    };
  }

  computeContextualAxisIntegrationAnchors(entries = this.getAggregationEntries()) {
    const sourceEntries = this.config.contextualAxisAnchorActiveEntryOnly === false
      ? entries
      : (entries.length ? [entries[entries.length - 1]] : []);
    const anchors = {
      x: { active: false, axis: "x", strength: 0, reason: "no_anchor" },
      z: { active: false, axis: "z", strength: 0, reason: "no_anchor" },
    };

    for (const entry of sourceEntries) {
      for (const axis of ["x", "z"]) {
        const candidate = this.computeAxisIntegrationAnchorForEntry(entry, axis);
        if (candidate.active && Number(candidate.strength || 0) > Number(anchors[axis].strength || 0)) {
          anchors[axis] = candidate;
        }
      }
    }
    return anchors;
  }

  applyContextualAxisIntegrationAnchors(lateral = {}, anchors = {}) {
    const out = { ...lateral };
    const compressionStrength = EpistemicProfiler.clamp(
      Number(this.config.contextualAxisAnchorCompressionStrength ?? 0.85),
      0,
      1,
    );

    const applyAxis = (axis) => {
      const anchor = anchors?.[axis];
      if (!anchor?.active) return;
      const strength = EpistemicProfiler.clamp(Number(anchor.strength || 0), 0, 1);
      const factor = EpistemicProfiler.clamp(1 - compressionStrength * strength, 0, 1);
      if (axis === "x") {
        out.rawA = Number(lateral.a || 0);
        out.rawXPoleDelta = Number(lateral.xPoleDelta || 0);
        out.a = Number(lateral.a || 0) * factor;
        out.xPoleDelta = Number(lateral.xPoleDelta || 0) * factor;
        out.xContextualAnchorCompressionFactor = factor;
      } else {
        out.rawB = Number(lateral.b || 0);
        out.rawZPoleDelta = Number(lateral.zPoleDelta || 0);
        out.b = Number(lateral.b || 0) * factor;
        out.zPoleDelta = Number(lateral.zPoleDelta || 0) * factor;
        out.zContextualAnchorCompressionFactor = factor;
      }
    };

    applyAxis("x");
    applyAxis("z");
    return out;
  }

  aggregateYFromDense(totals, contradictionPenalty, lateral, gateStates = this.state.gateStates, scopeDiagnostics = null) {
    const PY = totals.y_positive;
    const NY = totals.y_negative;

    const integrationBonus = lateral.xBalance * lateral.IX + lateral.zBalance * lateral.IZ;
    const scopeCompleteMultiplier = Boolean(scopeDiagnostics?.scopeCompleteForText)
      ? Number(this.config.scopeCompleteAsymmetryPenaltyMultiplier ?? 0.18)
      : 1;
    const unresolvedPenalty =
      (
        Math.abs(lateral.xPoleDelta) * (1 - lateral.IX) * 0.35 +
        Math.abs(lateral.zPoleDelta) * (1 - lateral.IZ) * 0.35
      ) * scopeCompleteMultiplier;

    const semanticOverflowCeiling = Number(this.config.semanticOverflowCeiling ?? 3);
    const localBase = EpistemicProfiler.clamp(
      (PY - NY + integrationBonus - unresolvedPenalty - contradictionPenalty * this.config.contradictionPenaltyScale) /
        (this.config.axisSaturation.epistemicStability || 2.5),
      -semanticOverflowCeiling,
      semanticOverflowCeiling,
    );

    const gateWeightsTotal = Object.values(this.config.gateWeights).reduce((sum, value) => sum + value, 0);
    let weightedPositiveScoreSum = 0;
    let weightedNegativeScoreSum = 0;
    let weightedPositiveGateWeight = 0;
    let weightedNegativeGateWeight = 0;
    let weightedCoveredSum = 0;
    let gateEventCount = 0;
    const coveredGateNames = [];
    const positiveGateNames = [];
    const negativeGateNames = [];

    for (const [gate, data] of Object.entries(gateStates)) {
      const weight = this.gateWeight(gate);
      if (data.positive_events || data.negative_events) {
        weightedCoveredSum += weight;
        coveredGateNames.push(gate);
      }
      gateEventCount += data.positive_events + data.negative_events;
      if (data.score > 0) {
        weightedPositiveScoreSum += weight * data.score;
        weightedPositiveGateWeight += weight;
        positiveGateNames.push(gate);
      } else if (data.score < 0) {
        weightedNegativeScoreSum += weight * Math.abs(data.score);
        weightedNegativeGateWeight += weight;
        negativeGateNames.push(gate);
      }
    }

    const weightedMeanPositiveGateScores = weightedPositiveGateWeight > 0 ? weightedPositiveScoreSum / weightedPositiveGateWeight : 0;
    const weightedMeanNegativeGateScores = weightedNegativeGateWeight > 0 ? weightedNegativeScoreSum / weightedNegativeGateWeight : 0;

    let s = EpistemicProfiler.clamp(
      localBase +
        this.config.positiveGateInfluence * weightedMeanPositiveGateScores -
        this.config.negativeGateInfluence * weightedMeanNegativeGateScores,
      -semanticOverflowCeiling,
      semanticOverflowCeiling,
    );

    const scopeExpansionPressure = Number(scopeDiagnostics?.scopeExpansionPressure || 0);
    if (scopeExpansionPressure > this.config.epsilon) {
      s = EpistemicProfiler.clamp(
        s - scopeExpansionPressure * Number(this.config.scopeExpansionPenaltyScale || 0.45),
        -semanticOverflowCeiling,
        semanticOverflowCeiling,
      );
    }

    // Deterministic anti-degeneracy seed:
    // A non-null active philosophy should not collapse into a pure vertical-only semantic state
    // unless the text truly supports a vertex. This seed is small and only fires when the dense
    // extraction leaves all four lateral poles at zero while active y/integration is present.
    const lateralPoleMass = totals.empathy + totals.practicality + totals.wisdom + totals.knowledge;
    const activeMass = PY + NY + totals.x_integration + totals.z_integration + weightedMeanPositiveGateScores + weightedMeanNegativeGateScores;
    let seedInfo = null;
    if (activeMass > this.config.epsilon && lateralPoleMass <= this.config.epsilon) {
      if (s > this.config.epsilon) {
        const xSeed = Math.min(this.config.underSpecifiedSeedCap, totals.x_integration * this.config.underSpecifiedPositiveXSeedScale);
        const zSeed = Math.min(
          this.config.underSpecifiedSeedCap,
          Math.max(totals.z_integration * this.config.underSpecifiedPositiveZSeedScale, Math.abs(s) * 0.2),
        );
        if (xSeed > this.config.epsilon || zSeed > this.config.epsilon) {
          seedInfo = { a: xSeed, b: zSeed, reason: "under_specified_positive_active_seed" };
        }
      } else if (s < -this.config.epsilon) {
        const xSeed = -Math.min(this.config.underSpecifiedSeedCap, totals.x_integration * this.config.underSpecifiedNegativeXSeedScale);
        const zSeed = -Math.min(
          this.config.underSpecifiedSeedCap,
          Math.max(totals.z_integration * this.config.underSpecifiedNegativeZSeedScale, Math.abs(s) * 0.2),
        );
        if (Math.abs(xSeed) > this.config.epsilon || Math.abs(zSeed) > this.config.epsilon) {
          seedInfo = { a: xSeed, b: zSeed, reason: "under_specified_negative_active_seed" };
        }
      }
    }

    return {
      s,
      yCoverage: gateWeightsTotal > 0 ? weightedCoveredSum / gateWeightsTotal : 0,
      localBase,
      integrationBonus,
      unresolvedPenalty,
      weightedMeanPositiveGateScores,
      weightedMeanNegativeGateScores,
      coveredGateNames,
      positiveGateNames,
      negativeGateNames,
      gateEventCount,
      seedInfo,
      scopeExpansionPressure: Number(scopeDiagnostics?.scopeExpansionPressure || 0),
    };
  }

  getSemanticProfile() {
    const aggregationEntries = this.getAggregationEntries();
    const aggregationGateStates = this.computeGateStateMap(aggregationEntries);
    const { totals, contradictionPenalty, semanticNovelty, repairDiagnostics } = this.aggregateSemanticGrid(aggregationEntries);
    const rawLateral = this.aggregateLateralFromDense(totals);
    const contextualAxisAnchors = this.computeContextualAxisIntegrationAnchors(aggregationEntries);
    const lateral = this.applyContextualAxisIntegrationAnchors(rawLateral, contextualAxisAnchors);
    const dimensionConsideration = this.aggregateDimensionConsideration(aggregationEntries);
    const scopeDiagnostics = this.computeScopeDiagnostics(aggregationEntries, aggregationGateStates);
    const yData = this.aggregateYFromDense(totals, contradictionPenalty, lateral, aggregationGateStates, scopeDiagnostics);

    let a = lateral.a;
    let b = lateral.b;
    let s = yData.s;

    if (yData.seedInfo) {
      if (Math.abs(a) <= this.config.epsilon) a = yData.seedInfo.a;
      if (Math.abs(b) <= this.config.epsilon) b = yData.seedInfo.b;
    }

    const scopeAdjusted = this.applyScopeRelativePeakAdjustment({
      a,
      b,
      s,
      lateral,
      totals,
      dimensionConsideration,
      scopeDiagnostics,
      yData,
    });
    a = scopeAdjusted.a;
    b = scopeAdjusted.b;
    s = scopeAdjusted.s;

    const frameDiagnostics = this.getAggregationFrameDiagnostics(aggregationEntries);

    return {
      model: "epistemic_octahedron_profiler_v12",
      semantics: {
        a,
        b,
        s,
        yEstimate: s,
        yCoverage: yData.yCoverage,
        peakEligibleInScope: scopeAdjusted.peakEligibleInScope,
        completionEligible: scopeAdjusted.completionEligible,
        maturityCompletionScore: scopeAdjusted.maturityCompletionScore,
        compressionApplied: scopeAdjusted.compressionApplied,
        softLiftApplied: scopeAdjusted.softLiftApplied,
        peakSnapped: scopeAdjusted.peakSnapped,
        overflowReserve: scopeAdjusted.overflowReserve,
        scopeRelativePeak: scopeAdjusted.peakEligibleInScope,
        wholeWorldviewCertified: aggregationEntries.some((entry) => cleanString(entry.analysis_scope).toLowerCase() === "full_profile_import"),
        noRejectedOrDeprioritizedDimensions: scopeAdjusted.noRejectedOrDeprioritizedDimensions,
        rejectedDimensions: scopeAdjusted.rejectedDimensions,
        deprioritizedDimensions: scopeAdjusted.deprioritizedDimensions,
        relevantGateCoverage: scopeAdjusted.relevantCoverage,
        relevantGateCoverageThreshold: scopeAdjusted.relevantCoverageThreshold,
        absoluteGateCoverage: scopeAdjusted.absoluteGateCoverage,
        absoluteGateCoverageThreshold: scopeAdjusted.absoluteGateCoverageThreshold,
        peakGateStructureOK: scopeAdjusted.peakGateStructureOK,
        coreGatesSatisfied: scopeAdjusted.coreGatesSatisfied,
        stabilizerGateSatisfied: scopeAdjusted.stabilizerGateSatisfied,
        highAbsoluteGateCoverageBypass: scopeAdjusted.highAbsoluteGateCoverageBypass,
        positivePeakGateNames: scopeAdjusted.positiveGateNames,
        integrationStrength: scopeAdjusted.integrationStrength,
        contextualAxisAnchors,
      },
      uiLike: {
        empathyPercent: (a + 1) * 50,
        practicalityPercent: 100 - (a + 1) * 50,
        wisdomPercent: (b + 1) * 50,
        knowledgePercent: 100 - (b + 1) * 50,
        stabilityPercent: s * 100,
        coveragePercent: yData.yCoverage * 100,
        dimensionConsiderationCoveragePercent: dimensionConsideration.coverageRatio * 100,
      },
      diagnostics: {
        totals,
        contradictionPenalty,
        lateral,
        epistemicStability: yData,
        dimensionConsideration,
        semanticNovelty,
        repairDiagnostics,
        contextualAxisAnchors,
        rawLateral,
        scopeDiagnostics,
        aggregationFrames: frameDiagnostics,
        aggregationGateStates: cloneJSON(aggregationGateStates),
        gateStates: cloneJSON(this.state.gateStates),
        gateSnapshotForPacket: this.getGateSnapshot(),
        profileState: cloneJSON(this.state.profileState),
      },
    };
  }

  static projectSemanticTriple(a, s, b, options = {}) {
    const epsilon = options.epsilon ?? 1e-9;
    const semanticOverflowCeiling = Number(options.semanticOverflowCeiling ?? 3);
    const forcePeak = Boolean(options.forcePeak || false);
    const nearZeroProjectionGuard = Number(options.nearZeroProjectionGuard ?? 0.12);
    const bypassLowSignalGuard = Boolean(options.bypassLowSignalGuard || false);
    const allowNullProjection = options.allowNullProjection !== false;
    const fallbackSurfacePoint =
      options.fallbackSurfacePoint && typeof options.fallbackSurfacePoint === "object"
        ? options.fallbackSurfacePoint
        : null;

    const xSemantic = EpistemicProfiler.clamp(Number(a) || 0, -semanticOverflowCeiling, semanticOverflowCeiling);
    const ySemantic = EpistemicProfiler.clamp(Number(s) || 0, -semanticOverflowCeiling, semanticOverflowCeiling);
    const zSemantic = EpistemicProfiler.clamp(Number(b) || 0, -semanticOverflowCeiling, semanticOverflowCeiling);
    const magnitude = Math.abs(xSemantic) + Math.abs(ySemantic) + Math.abs(zSemantic);

    if (magnitude <= epsilon) {
      if (!allowNullProjection && fallbackSurfacePoint) {
        const point = {
          x: Number(fallbackSurfacePoint.x) || 0,
          y: Number(fallbackSurfacePoint.y) || 0,
          z: Number(fallbackSurfacePoint.z) || 0,
        };
        const manhattan = Math.abs(point.x) + Math.abs(point.y) + Math.abs(point.z);
        return {
          point,
          debug: {
            xSemantic,
            ySemantic,
            zSemantic,
            magnitude,
            manhattan,
            activeWorldviewThresholdMet: true,
            activeWorldviewVectorCanceled: true,
            persistedPreviousSurfacePoint: true,
            underdeterminedLowSignal: true,
            nearZeroProjectionGuard,
            bypassLowSignalGuard,
            allowNullProjection,
            surfaceEquationSatisfied: Math.abs(manhattan - 1) <= 1e-6,
          },
        };
      }

      return {
        point: { x: 0, y: 0, z: 0 },
        debug: {
          xSemantic,
          ySemantic,
          zSemantic,
          magnitude,
          activeWorldviewThresholdMet: false,
          underdeterminedLowSignal: true,
          nearZeroProjectionGuard,
          bypassLowSignalGuard,
          allowNullProjection,
          surfaceEquationSatisfied: true,
        },
      };
    }

    if (allowNullProjection && !forcePeak && !bypassLowSignalGuard && magnitude < nearZeroProjectionGuard) {
      return {
        point: { x: 0, y: 0, z: 0 },
        debug: {
          xSemantic,
          ySemantic,
          zSemantic,
          magnitude,
          activeWorldviewThresholdMet: false,
          underdeterminedLowSignal: true,
          nearZeroProjectionGuard,
          bypassLowSignalGuard,
          allowNullProjection,
          surfaceEquationSatisfied: true,
        },
      };
    }

    const point = forcePeak
      ? { x: 0, y: 1, z: 0 }
      : {
          x: xSemantic / magnitude,
          y: ySemantic / magnitude,
          z: zSemantic / magnitude,
        };
    const manhattan = Math.abs(point.x) + Math.abs(point.y) + Math.abs(point.z);
    return {
      point,
      debug: {
        xSemantic,
        ySemantic,
        zSemantic,
        magnitude,
        manhattan,
        activeWorldviewThresholdMet: true,
        forcePeak,
        underdeterminedLowSignal: magnitude < nearZeroProjectionGuard && !bypassLowSignalGuard,
        nearZeroProjectionGuard,
        bypassLowSignalGuard,
        allowNullProjection,
        surfaceEquationSatisfied: Math.abs(manhattan - 1) <= 1e-6,
      },
    };
  }

  buildFallbackProfileLine(entry) {
    const parts = [];
    const strongestPositiveY = (entry.local_y_positive_signals || []).slice().sort((a, b) => {
      const av = this.strengthWeight(a.strength) * (Number(a.confidence) || 1);
      const bv = this.strengthWeight(b.strength) * (Number(b.confidence) || 1);
      return bv - av;
    })[0];
    const strongestNegativeY = (entry.local_y_negative_signals || []).slice().sort((a, b) => {
      const av = this.strengthWeight(a.strength) * (Number(a.confidence) || 1);
      const bv = this.strengthWeight(b.strength) * (Number(b.confidence) || 1);
      return bv - av;
    })[0];
    if (strongestPositiveY && !strongestNegativeY) {
      parts.push(`+${(this.strengthWeight(strongestPositiveY.strength) * (Number(strongestPositiveY.confidence) || 1)).toFixed(2)} stability`);
    } else if (strongestNegativeY) {
      parts.push(`-${(this.strengthWeight(strongestNegativeY.strength) * (Number(strongestNegativeY.confidence) || 1)).toFixed(2)} instability`);
    }
    const grid = entry.semantic_grid || {};
    if (grid.empathy?.support || grid.practicality?.support) {
      const lean = (grid.empathy.support * grid.empathy.confidence) >= (grid.practicality.support * grid.practicality.confidence) ? "empathy" : "practicality";
      parts.push(`x active: ${lean}`);
    }
    if (grid.wisdom?.support || grid.knowledge?.support) {
      const lean = (grid.wisdom.support * grid.wisdom.confidence) >= (grid.knowledge.support * grid.knowledge.confidence) ? "wisdom" : "knowledge";
      parts.push(`z active: ${lean}`);
    }
    return parts.length ? `${parts.join(" ")} | synthesized from structured extraction` : null;
  }

  axisText(value, axisKey) {
    const numeric = Number(value) || 0;
    const threshold = Number(this.config.summaryAxisFloor ?? 0.04);
    if (Math.abs(numeric) < threshold) return null;
    const labels = AXIS_LABELS[axisKey];
    const label = numeric >= 0 ? labels.positive : labels.negative;
    if (axisKey === "epistemicStability") {
      return `${EpistemicProfiler.formatSigned(numeric)} ${label}`;
    }
    return `${EpistemicProfiler.formatSigned(numeric)} ${label}`;
  }

  buildAggregateProfileLine(semantics = {}) {
    const parts = [];
    const yText = this.axisText(semantics.s, "epistemicStability");
    const xText = this.axisText(semantics.a, "empathyPracticality");
    const zText = this.axisText(semantics.b, "wisdomKnowledge");
    if (yText) parts.push(yText);
    if (xText) parts.push(xText);
    if (zText) parts.push(zText);
    if (!parts.length) return "0.00 null-state | no active worldview threshold met";
    return `${parts.join(" ")} | compiled aggregate`;
  }

  buildSupportingNotes(semanticProfile = this.getSemanticProfile()) {
    const notes = [];
    const seedInfo = semanticProfile.diagnostics?.epistemicStability?.seedInfo;
    if (seedInfo) {
      notes.push(`deterministic fallback applied: ${seedInfo.reason}`);
    }
    const frameInfo = semanticProfile.diagnostics?.aggregationFrames;
    if (frameInfo) {
      notes.push(`aggregation mode: ${frameInfo.mode}`);
      if (frameInfo.excludedCount > 0) notes.push(`aggregation excluded entries: ${frameInfo.excludedCount}`);
      for (const frame of frameInfo.excludedFrames || []) {
        notes.push(`aggregation excluded frame: ${frame}`);
      }
    }
    const consideration = semanticProfile.diagnostics?.dimensionConsideration;
    if (consideration) {
      notes.push(`dimension consideration coverage: ${consideration.coveredCount}/${consideration.totalDimensions}`);
      for (const dimension of consideration.explicitlyDeprioritized || []) {
        notes.push(`dimension consideration: ${dimension} explicitly deprioritized`);
      }
      for (const dimension of consideration.explicitlyRejected || []) {
        notes.push(`dimension consideration: ${dimension} explicitly rejected`);
      }
    }
    for (const entry of this.state.entries) {
      notes.push(...cleanStringList(entry.notes || []));
    }
    notes.push(...this.state.profileState.risk_notes);
    return dedupeLatestFirst(notes);
  }

  determinateSelfNegativeEvidenceScore(entry = {}) {
    if (!entry || typeof entry !== "object") return 0;
    const frame = normalizeProfileTargetFrame(entry.profile_target_frame);
    let score = 0;

    const gridNegative = entry?.semantic_grid?.y_negative;
    if (gridNegative) {
      score = Math.max(
        score,
        Number(gridNegative.support || 0) * Number(gridNegative.confidence || 0),
      );
    }

    for (const signal of entry.local_y_negative_signals || []) {
      if (!signalTargetsProfiledReferent(signal, { frame, direction: "negative" })) continue;
      const weighted =
        this.strengthWeight(signal.strength) *
        Number(signal.confidence || 0) *
        this.localYSignalWeight(signal);
      score = Math.max(score, weighted);
    }

    for (const event of entry.triggered_gate_events || []) {
      if (cleanString(event?.direction).toLowerCase() !== "negative") continue;
      if (!signalTargetsProfiledReferent(event, { frame, direction: "negative" })) continue;
      score = Math.max(score, this.strengthWeight(event.strength) * Number(event.confidence || 0));
    }

    for (const riskEvent of entry.risk_events || []) {
      if (!riskEventTargetsProfiledReferent(riskEvent, { frame })) continue;
      const status = normalizeRiskStatus(riskEvent.status || "active");
      if (status !== "active") continue;
      score = Math.max(score, Number(riskEvent.confidence || 0));
    }

    if (Array.isArray(entry?.local_extraction?.contradictions) && entry.local_extraction.contradictions.length > 0) {
      score = Math.max(score, 0.75);
    }
    if (
      Array.isArray(entry?.profile_update_signals?.introduced_contradictions) &&
      entry.profile_update_signals.introduced_contradictions.length > 0
    ) {
      score = Math.max(score, 0.75);
    }

    return EpistemicProfiler.clamp(score, 0, 1);
  }

  hasDeterminateSelfNegativeEvidence(entries = this.getAggregationEntries()) {
    const threshold = Number(this.config.nearZeroProjectionGuardNegativeEvidenceThreshold ?? 0.25);
    return (Array.isArray(entries) ? entries : []).some(
      (entry) => this.determinateSelfNegativeEvidenceScore(entry) >= threshold,
    );
  }

  isExactPeakPoint(point = {}) {
    const tolerance = Number(this.config.peakPersistenceGuardTolerance ?? 1e-6);
    const x = Number(point?.x) || 0;
    const y = Number(point?.y) || 0;
    const z = Number(point?.z) || 0;
    return Math.abs(x) <= tolerance && Math.abs(z) <= tolerance && y >= 1 - tolerance;
  }

  entryHasActiveProfiledRisk(entry = {}) {
    const frame = normalizeProfileTargetFrame(entry?.profile_target_frame);
    return (Array.isArray(entry?.risk_events) ? entry.risk_events : []).some((event) => {
      if (!riskEventTargetsProfiledReferent(event, { frame })) return false;
      return normalizeRiskStatus(event.status || "active") === "active";
    });
  }

  entryHasPeakBreakingEvidence(entry = {}) {
    if (!entry || typeof entry !== "object") {
      return { hasBreakingEvidence: false, reasons: [] };
    }

    const reasons = [];
    const frame = normalizeProfileTargetFrame(entry.profile_target_frame);
    const negativeEvidenceScore = this.determinateSelfNegativeEvidenceScore(entry);
    const negativeEvidenceThreshold = Number(this.config.nearZeroProjectionGuardNegativeEvidenceThreshold ?? 0.25);
    if (negativeEvidenceScore >= negativeEvidenceThreshold) {
      reasons.push(`self_targeted_negative_evidence:${negativeEvidenceScore.toFixed(3)}`);
    }

    const negativeGateEvents = (Array.isArray(entry.triggered_gate_events) ? entry.triggered_gate_events : []).filter((event) => {
      const direction = cleanString(event?.direction).toLowerCase();
      return direction === "negative" && signalTargetsProfiledReferent(event, { frame, direction: "negative" });
    });
    if (negativeGateEvents.length) {
      reasons.push("negative_gate_event");
    }

    if (this.entryHasActiveProfiledRisk(entry)) {
      reasons.push("active_profiled_risk");
    }

    if (Array.isArray(entry?.local_extraction?.contradictions) && entry.local_extraction.contradictions.length) {
      reasons.push("local_contradiction");
    }

    const updates = entry.profile_update_signals || {};
    if (cleanStringList(updates.introduced_contradictions || []).length) {
      reasons.push("introduced_contradiction");
    }
    if (cleanStringList(updates.failed_gates || []).length) {
      reasons.push("failed_gate");
    }

    const rejected = [];
    const deprioritized = [];
    const consideration = entry.dimension_consideration || {};
    for (const dimension of DIMENSION_CONSIDERATION_DIMENSIONS) {
      const field = sanitizeDimensionConsiderationField(consideration?.[dimension], dimension);
      const status = cleanString(field.status).toLowerCase();
      if (status === "explicitly_rejected") rejected.push(dimension);
      if (status === "explicitly_deprioritized") deprioritized.push(dimension);
    }
    if (rejected.length) reasons.push(`dimension_rejected:${rejected.join(",")}`);
    if (deprioritized.length) reasons.push(`dimension_deprioritized:${deprioritized.join(",")}`);

    return {
      hasBreakingEvidence: reasons.length > 0,
      reasons,
      negativeEvidenceScore,
    };
  }

  peakPersistenceDropAssessment(semanticProfile = {}, aggregationEntries = this.getAggregationEntries()) {
    const activeEntry = Array.isArray(aggregationEntries) && aggregationEntries.length
      ? aggregationEntries[aggregationEntries.length - 1]
      : null;
    const entryBreak = this.entryHasPeakBreakingEvidence(activeEntry);
    const scopeDiagnostics = semanticProfile?.diagnostics?.scopeDiagnostics || {};
    const scopeExpansion = cleanString(scopeDiagnostics.scopeExpansion).toLowerCase() || "none";
    const unresolvedScopeGaps = cleanStringList(scopeDiagnostics.unresolvedScopeGaps || []);
    const relevantCoverage = Number(scopeDiagnostics.relevantGateCoverage);
    const relevantCoverageThreshold = Number(semanticProfile?.semantics?.relevantGateCoverageThreshold ?? 1);
    const scopeIncomplete = scopeDiagnostics.scopeCompleteForText === false;
    const unsupportedRelevantGates = cleanStringList(scopeDiagnostics.scopeGateDiagnostics?.unsupportedRelevantGates || []);
    const expansionPressure = Number(scopeDiagnostics.scopeExpansionPressure || 0);
    const unresolvedExpansion =
      scopeExpansion === "widened" &&
      (
        scopeIncomplete ||
        unresolvedScopeGaps.length > 0 ||
        unsupportedRelevantGates.length > 0 ||
        expansionPressure > this.config.epsilon ||
        (Number.isFinite(relevantCoverage) && relevantCoverage + this.config.epsilon < relevantCoverageThreshold)
      );

    const reasons = [...entryBreak.reasons];
    if (unresolvedExpansion) {
      reasons.push("unresolved_scope_expansion");
    }

    return {
      allowDrop: reasons.length > 0,
      reasons,
      activeEntryAddedAt: activeEntry?.addedAt || null,
      entryBreak,
      scope: {
        scopeExpansion,
        scopeCompleteForText: scopeDiagnostics.scopeCompleteForText ?? null,
        unresolvedScopeGaps,
        unsupportedRelevantGates,
        relevantCoverage: Number.isFinite(relevantCoverage) ? relevantCoverage : null,
        relevantCoverageThreshold,
        scopeExpansionPressure: expansionPressure,
        unresolvedExpansion,
      },
    };
  }

  computePeakPersistenceGuard({ semanticProfile = {}, projection = {}, aggregationEntries = this.getAggregationEntries() } = {}) {
    if (!this.config.peakPersistenceGuardEnabled) {
      return { active: false, reason: "disabled" };
    }

    const previousPoint = this.state.finalized?.data?.point || null;
    const previousWasPeak = this.isExactPeakPoint(previousPoint);
    const currentProjectedPoint = projection?.point || {};
    const currentIsPeak = this.isExactPeakPoint(currentProjectedPoint);
    const dropAssessment = this.peakPersistenceDropAssessment(semanticProfile, aggregationEntries);
    const shouldPreservePeak = previousWasPeak && !currentIsPeak && !dropAssessment.allowDrop;

    return {
      active: previousWasPeak,
      previousWasPeak,
      currentIsPeak,
      shouldPreservePeak,
      dropAllowed: dropAssessment.allowDrop,
      dropReasons: dropAssessment.reasons,
      previousPoint: previousPoint ? {
        x: Number(previousPoint.x) || 0,
        y: Number(previousPoint.y) || 0,
        z: Number(previousPoint.z) || 0,
      } : null,
      currentProjectedPoint: {
        x: Number(currentProjectedPoint.x) || 0,
        y: Number(currentProjectedPoint.y) || 0,
        z: Number(currentProjectedPoint.z) || 0,
      },
      rawSemantics: {
        a: Number(semanticProfile?.semantics?.a) || 0,
        b: Number(semanticProfile?.semantics?.b) || 0,
        s: Number(semanticProfile?.semantics?.s) || 0,
      },
      dropAssessment,
      reason: shouldPreservePeak
        ? "prior_peak_preserved_no_breaking_evidence"
        : previousWasPeak && !currentIsPeak && dropAssessment.allowDrop
          ? "prior_peak_drop_allowed_by_breaking_evidence"
          : previousWasPeak && currentIsPeak
            ? "prior_peak_still_peak"
            : "no_prior_peak",
    };
  }

  applyPeakPersistenceToSemanticProfile(semanticProfile = {}, peakPersistenceGuard = {}) {
    if (!peakPersistenceGuard.shouldPreservePeak) return semanticProfile;

    const previousSemantics = cloneJSON(semanticProfile.semantics || {});
    const previousUiLike = cloneJSON(semanticProfile.uiLike || {});
    semanticProfile.semantics = {
      ...semanticProfile.semantics,
      a: 0,
      b: 0,
      s: 1,
      yEstimate: 1,
      peakPersistedFromPriorPeak: true,
      peakPersistenceReason: peakPersistenceGuard.reason,
      prePeakPersistenceSemantics: previousSemantics,
    };
    semanticProfile.uiLike = {
      ...semanticProfile.uiLike,
      empathyPercent: 50,
      practicalityPercent: 50,
      wisdomPercent: 50,
      knowledgePercent: 50,
      stabilityPercent: 100,
      prePeakPersistenceUiLike: previousUiLike,
    };
    semanticProfile.diagnostics = {
      ...semanticProfile.diagnostics,
      peakPersistenceGuard,
    };
    return semanticProfile;
  }

  computePoint() {
    const semanticProfile = this.getSemanticProfile();
    const aggregationEntries = this.getAggregationEntries();
    let { a, b, s, yCoverage } = semanticProfile.semantics;
    const previousSurfacePoint = this.state.finalized?.data?.point || null;
    const previousSurfaceMagnitude = previousSurfacePoint
      ? Math.abs(Number(previousSurfacePoint.x) || 0) +
        Math.abs(Number(previousSurfacePoint.y) || 0) +
        Math.abs(Number(previousSurfacePoint.z) || 0)
      : 0;
    const hasPreviousSurfacePoint = Math.abs(previousSurfaceMagnitude - 1) <= 1e-6;
    const hasDeterminateSelfNegativeEvidence = this.hasDeterminateSelfNegativeEvidence(aggregationEntries);
    const allowNullProjection =
      !hasPreviousSurfacePoint && aggregationEntries.length <= 1 && !hasDeterminateSelfNegativeEvidence;
    let projection = EpistemicProfiler.projectSemanticTriple(a, s, b, {
      epsilon: this.config.epsilon,
      semanticOverflowCeiling: this.config.semanticOverflowCeiling,
      nearZeroProjectionGuard: this.config.nearZeroProjectionGuard,
      bypassLowSignalGuard: hasDeterminateSelfNegativeEvidence,
      forcePeak: Boolean(semanticProfile.semantics?.peakEligibleInScope),
      allowNullProjection,
      fallbackSurfacePoint: hasPreviousSurfacePoint ? previousSurfacePoint : null,
    });

    const peakPersistenceGuard = this.computePeakPersistenceGuard({
      semanticProfile,
      projection,
      aggregationEntries,
    });

    if (peakPersistenceGuard.shouldPreservePeak) {
      const prePersistenceProjection = cloneJSON(projection);
      this.applyPeakPersistenceToSemanticProfile(semanticProfile, peakPersistenceGuard);
      a = 0;
      b = 0;
      s = 1;
      projection = {
        point: { x: 0, y: 1, z: 0 },
        debug: {
          ...(prePersistenceProjection.debug || {}),
          peakPersistenceGuard: {
            ...peakPersistenceGuard,
            prePersistenceProjection: prePersistenceProjection.point || null,
          },
          persistedPreviousPeak: true,
          surfaceEquationSatisfied: true,
          manhattan: 1,
        },
      };
    } else {
      semanticProfile.diagnostics = {
        ...semanticProfile.diagnostics,
        peakPersistenceGuard,
      };
      projection = {
        ...projection,
        debug: {
          ...(projection.debug || {}),
          peakPersistenceGuard,
        },
      };
    }

    const projectedMagnitude =
      Math.abs(Number(projection.point.x) || 0) +
      Math.abs(Number(projection.point.y) || 0) +
      Math.abs(Number(projection.point.z) || 0);
    const aggregateProfileLine = this.buildAggregateProfileLine(semanticProfile.semantics, semanticProfile.diagnostics);
    const profileLine =
      aggregateProfileLine.startsWith("0.00 null-state") && projectedMagnitude > this.config.epsilon
        ? "active worldview | compiled aggregate below summary axis floor"
        : aggregateProfileLine;

    const finalized = {
      model: semanticProfile.model,
      profile: [profileLine],
      notes: this.buildSupportingNotes(semanticProfile),
      data: {
        point: { ...projection.point },
        params: {
          semantics: { ...semanticProfile.semantics },
          uiLike: { ...semanticProfile.uiLike },
        },
        diagnostics: {
          ...cloneJSON(semanticProfile.diagnostics),
          lowSignalProjectionGuard: {
            hasDeterminateSelfNegativeEvidence,
            negativeEvidenceThreshold: Number(this.config.nearZeroProjectionGuardNegativeEvidenceThreshold ?? 0.25),
          },
          supportingEntryProfiles: this.state.entries.map((entry) => ({
            addedAt: entry.addedAt,
            profile: cloneJSON(entry.display_profile_lines || []),
            fallback_profile_line: entry.fallback_profile_line || null,
            scope: entry.analysis_scope,
            profile_target_frame: normalizeProfileTargetFrame(entry.profile_target_frame),
            merged_into_cumulative_profile: aggregationEntries.includes(entry),
            dimension_consideration: cloneJSON(entry.dimension_consideration || {}),
            triggered_gate_events: cloneJSON(entry.triggered_gate_events || []),
            gate_update_proposals: cloneJSON(entry.gate_update_proposals || []),
            auto_gate_support_diagnostics: cloneJSON(entry.auto_gate_support_diagnostics || []),
          })),
        },
        math: {
          formulas: {
            axisAggregation:
              String.raw`a = clamp(((E - P) * (1 - \rho_x \lambda_I))/\sigma_x, -1, 1),\quad b = clamp(((W - K) * (1 - \rho_z \lambda_I))/\sigma_z, -1, 1)`,
            yEstimate:
              String.raw`s = clamp((Y^+ - Y^- + B_I - P_U - \alpha C)/\sigma_y + \beta G^+ - \gamma G^-, -1, 1)`,
            yCoverage:
              String.raw`y_{coverage} = \frac{\sum w_g^{covered}}{\sum w_g^{all}}`,
            projection:
              String.raw`(x,y,z) = \frac{(a,s,b)}{|a| + |s| + |b|}\;\text{when}\;|a| + |s| + |b| > 0`,
            originRule: String.raw`|a| + |s| + |b| = 0 \Rightarrow (x,y,z) = (0,0,0)`,
            surfaceRule: String.raw`|x| + |y| + |z| = 1\;\text{for active worldview positions}`,
          },
          values: {
            a,
            b,
            s,
            yCoverage,
            x: projection.point.x,
            y: projection.point.y,
            z: projection.point.z,
            semanticMagnitude: projection.debug.magnitude,
            projectedManhattan: projection.debug.manhattan ?? 0,
            semanticPercentages: {
              empathy: semanticProfile.uiLike.empathyPercent,
              practicality: semanticProfile.uiLike.practicalityPercent,
              wisdom: semanticProfile.uiLike.wisdomPercent,
              knowledge: semanticProfile.uiLike.knowledgePercent,
              stability: semanticProfile.uiLike.stabilityPercent,
              coverage: semanticProfile.uiLike.coveragePercent,
            },
            projectedPercentages: {
              empathy: (projection.point.x + 1) * 50,
              practicality: 100 - (projection.point.x + 1) * 50,
              wisdom: (projection.point.z + 1) * 50,
              knowledge: 100 - (projection.point.z + 1) * 50,
              stability: Math.abs(projection.point.y) * 100,
              coverage: semanticProfile.uiLike.coveragePercent,
            },
          },
          sources: {
            entryCount: this.state.entries.length,
            gateEventCount: semanticProfile.diagnostics.epistemicStability.gateEventCount,
            principleCount: this.state.profileState.core_principles.length,
            boundaryCount: this.state.profileState.core_boundaries.length,
          },
        },
      },
    };
    this.state.finalized = finalized;
    return {
      point: projection.point,
      debug: projection.debug,
      semanticProfile,
      finalized,
    };
  }
}
