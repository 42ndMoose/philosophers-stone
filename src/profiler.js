
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

const DEFAULT_SIGNAL_TYPES = {
  positive: new Set([
    "counter_consideration",
    "self_correction",
    "reality_contact",
    "coherence",
    "error_awareness",
    "revision_openness",
    "non_strawman_fairness",
    "legacy_positive",
  ]),
  negative: new Set([
    "false_certainty",
    "self_sealing",
    "contradiction_evasion",
    "reality_detachment",
    "dogmatic_closure",
    "collapse_marker",
    "strawman_dependence",
    "broad_motive_attribution",
    "legacy_negative",
  ]),
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

const DEFAULT_SOFT_NEGATIVE_SIGNAL_TYPES = new Set([
  "false_certainty",
  "dogmatic_closure",
  "strawman_dependence",
  "broad_motive_attribution",
  "legacy_negative",
]);

const DEFAULT_EMPTY_PROFILE_STATE = () => ({
  core_principles: [],
  core_boundaries: [],
  meta_epistemic_markers: [],
  risk_notes: [],
});

const AXIS_LABELS = {
  empathyPracticality: { positive: "empathy", negative: "practicality" },
  wisdomKnowledge: { positive: "wisdom", negative: "knowledge" },
  epistemicStability: { positive: "stability", negative: "instability" },
};

const DENSE_GRID_KEYS = [
  "empathy",
  "practicality",
  "wisdom",
  "knowledge",
  "x_integration",
  "z_integration",
  "y_positive",
  "y_negative",
];

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

function createEmptyGateStateMap() {
  return Object.fromEntries(
    Object.keys(DEFAULT_GATE_WEIGHTS).map((gate) => [
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

function normalizeEvidenceSpan(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanString(item)).filter(Boolean).join(" | ");
  }
  return cleanString(value);
}

function strengthToSupport(strength = "moderate") {
  const normalized = cleanString(strength).toLowerCase();
  return DEFAULT_STRENGTH_WEIGHTS[normalized] ?? DEFAULT_STRENGTH_WEIGHTS.moderate;
}

function normalizeSemanticBucket(bucket = {}) {
  return {
    support: Math.max(0, Math.min(1, Number(bucket?.support ?? 0) || 0)),
    confidence: Math.max(0, Math.min(1, Number(bucket?.confidence ?? 0) || 0)),
    evidence_spans: Array.isArray(bucket?.evidence_spans)
      ? bucket.evidence_spans.map((item) => cleanString(item)).filter(Boolean)
      : [],
  };
}

function emptySemanticGrid() {
  return Object.fromEntries(DENSE_GRID_KEYS.map((key) => [key, normalizeSemanticBucket()]));
}

function mergeMaxBucket(target, source) {
  const currentValue = (target.support || 0) * (target.confidence || 0);
  const nextValue = (source.support || 0) * (source.confidence || 0);
  if (nextValue > currentValue) return source;
  if (!target.evidence_spans?.length && source.evidence_spans?.length) return source;
  return target;
}

export class EpistemicProfiler {
  constructor(options = {}) {
    this.config = {
      strengthWeights: { ...DEFAULT_STRENGTH_WEIGHTS },
      scopeWeights: { ...DEFAULT_SCOPE_WEIGHTS },
      scopeStrengthWeights: { ...DEFAULT_SCOPE_STRENGTH_WEIGHTS },
      gateWeights: { ...DEFAULT_GATE_WEIGHTS },
      localYSignalWeights: cloneJSON(DEFAULT_LOCAL_Y_SIGNAL_WEIGHTS),
      contradictionPenaltyScale: 0.22,
      positiveGateInfluence: 0.08,
      negativeGateInfluence: 0.12,
      yIntegrationBonusWeight: 0.35,
      yAsymmetryPenaltyWeight: 0.22,
      yAsymmetryDeadZone: 0.18,
      activeWorldviewThreshold: 0.12,
      epsilon: 1e-9,
      summaryAxisFloor: 0.04,
      rejectInvalidTriggeredGateEvents: true,
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
    return strengthToSupport(strength);
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
    const gateCount = Array.isArray(payload.triggered_gate_events)
      ? payload.triggered_gate_events.length
      : 0;
    const principleCount = Array.isArray(payload?.local_extraction?.principles)
      ? payload.local_extraction.principles.length
      : 0;
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
          strength: cleanString(item.strength).toLowerCase() || "moderate",
          confidence: EpistemicProfiler.clamp(Number(item.confidence ?? 1), 0, 1),
          evidence_span: normalizeEvidenceSpan(item.evidence_span || item.excerpt || item.reason),
        };
      })
      .filter(Boolean);
  }

  normalizeSignalList(items = [], fallbackPolarity = "positive") {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        return {
          ...item,
          polarity: cleanString(item.polarity).toLowerCase() || fallbackPolarity,
          signal_type:
            cleanString(item.signal_type || item.type || item.signal).toLowerCase() ||
            `legacy_${fallbackPolarity}`,
          strength: cleanString(item.strength).toLowerCase() || "moderate",
          confidence: EpistemicProfiler.clamp(Number(item.confidence ?? 1), 0, 1),
          evidence_span: normalizeEvidenceSpan(item.evidence_span || item.excerpt || item.reason),
        };
      })
      .filter(Boolean);
  }

  normalizeGateEvents(items = []) {
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
        strength: cleanString(item.strength).toLowerCase() || "moderate",
        confidence: EpistemicProfiler.clamp(Number(item.confidence ?? 1), 0.5, 1),
        novelty: EpistemicProfiler.clamp(Number(item.novelty ?? 1), 0, 1),
        evidence_span: normalizeEvidenceSpan(item.evidence_span || item.reason),
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
    ];

    const out = {};
    for (const key of keys) {
      out[key] = Array.isArray(input?.[key]) ? input[key] : [];
    }
    return out;
  }

  normalizeSemanticGrid(input = {}) {
    const out = emptySemanticGrid();
    for (const key of DENSE_GRID_KEYS) {
      out[key] = normalizeSemanticBucket(input?.[key]);
    }
    return out;
  }

  fallbackSemanticGridFromLegacy(payload = {}) {
    const out = emptySemanticGrid();
    const axisEvents = payload.axis_events || {};
    const localYPositive = this.normalizeSignalList(payload.local_y_positive_signals || [], "positive");
    const localYNegative = this.normalizeSignalList(payload.local_y_negative_signals || [], "negative");

    const absorbPole = (bucketName, items = []) => {
      for (const item of items) {
        const support = strengthToSupport(item.strength);
        const candidate = normalizeSemanticBucket({
          support,
          confidence: item.confidence,
          evidence_spans: [item.evidence_span].filter(Boolean),
        });
        out[bucketName] = mergeMaxBucket(out[bucketName], candidate);
      }
    };

    const absorbIntegration = (bucketName, items = []) => {
      for (const item of items) {
        const support = strengthToSupport(item.strength);
        const candidate = normalizeSemanticBucket({
          support,
          confidence: item.confidence,
          evidence_spans: [item.evidence_span].filter(Boolean),
        });
        out[bucketName] = mergeMaxBucket(out[bucketName], candidate);
      }
    };

    absorbPole(
      "empathy",
      (axisEvents.x_pole_evidence || []).filter((item) => cleanString(item.pole).toLowerCase() === "empathy"),
    );
    absorbPole(
      "practicality",
      (axisEvents.x_pole_evidence || []).filter((item) => cleanString(item.pole).toLowerCase() === "practicality"),
    );
    absorbPole(
      "wisdom",
      (axisEvents.z_pole_evidence || []).filter((item) => cleanString(item.pole).toLowerCase() === "wisdom"),
    );
    absorbPole(
      "knowledge",
      (axisEvents.z_pole_evidence || []).filter((item) => cleanString(item.pole).toLowerCase() === "knowledge"),
    );
    absorbIntegration("x_integration", axisEvents.x_integration_events || []);
    absorbIntegration("z_integration", axisEvents.z_integration_events || []);

    for (const signal of localYPositive) {
      const candidate = normalizeSemanticBucket({
        support: strengthToSupport(signal.strength),
        confidence: signal.confidence,
        evidence_spans: [signal.evidence_span].filter(Boolean),
      });
      out.y_positive = mergeMaxBucket(out.y_positive, candidate);
    }

    for (const signal of localYNegative) {
      const candidate = normalizeSemanticBucket({
        support: strengthToSupport(signal.strength),
        confidence: signal.confidence,
        evidence_spans: [signal.evidence_span].filter(Boolean),
      });
      out.y_negative = mergeMaxBucket(out.y_negative, candidate);
    }

    return out;
  }

  normalizePayload(payload = {}) {
    if (!payload || typeof payload !== "object") {
      throw new Error("LLM payload must be an object");
    }

    const display_profile_lines = cleanStringList(payload.profile || []);
    const notes = cleanStringList(payload.notes || []);
    const analysis_scope = this.inferScope(payload);
    const scope_strength = this.inferScopeStrength(analysis_scope, payload);

    const axis_events = {
      x_pole_evidence: this.normalizeAxisEventList(payload?.axis_events?.x_pole_evidence || []),
      x_integration_events: this.normalizeAxisEventList(payload?.axis_events?.x_integration_events || []),
      z_pole_evidence: this.normalizeAxisEventList(payload?.axis_events?.z_pole_evidence || []),
      z_integration_events: this.normalizeAxisEventList(payload?.axis_events?.z_integration_events || []),
    };

    const local_y_positive_signals = this.normalizeSignalList(
      payload.local_y_positive_signals || [],
      "positive",
    );

    const local_y_negative_signals = this.normalizeSignalList(
      payload.local_y_negative_signals || [],
      "negative",
    );

    const local_extraction = this.normalizeLocalExtraction(payload.local_extraction || {});
    const profile_update_signals = this.normalizeProfileUpdateSignals(
      payload.profile_update_signals || {},
    );

    const normalizedGateResult = this.normalizeGateEvents(payload.triggered_gate_events || []);
    const triggered_gate_events = normalizedGateResult.accepted;

    const explicitSemanticGrid = this.normalizeSemanticGrid(payload.semantic_grid || {});
    const fallbackGrid = this.fallbackSemanticGridFromLegacy({
      axis_events,
      local_y_positive_signals,
      local_y_negative_signals,
    });

    const semantic_grid = emptySemanticGrid();
    for (const key of DENSE_GRID_KEYS) {
      const explicitValue = (explicitSemanticGrid[key].support || 0) * (explicitSemanticGrid[key].confidence || 0);
      semantic_grid[key] = explicitValue > 0 ? explicitSemanticGrid[key] : fallbackGrid[key];
    }

    return {
      model: cleanString(payload.model) || "epistemic_octahedron_interpreter_v2",
      profiler_mode: cleanString(payload.profiler_mode) || "dense_support_v1",
      display_profile_lines,
      notes,
      analysis_scope,
      scope_strength,
      statement_modes: cleanStringList(payload.statement_modes || []),
      semantic_grid,
      axis_events,
      local_y_positive_signals,
      local_y_negative_signals,
      triggered_gate_events,
      local_extraction,
      profile_update_signals,
      invalidGateEvents: normalizedGateResult.rejected,
    };
  }

  addLLMOutput(payload) {
    const entry = this.normalizePayload(payload);

    if (entry.invalidGateEvents?.length) {
      const messages = entry.invalidGateEvents
        .map((item) => {
          const gate = cleanString(item?.gate || item?.raw?.gate) || "unknown gate";
          const direction = cleanString(item?.direction || item?.raw?.direction) || "missing direction";
          const reason = cleanString(item?.reason).replace(/_/g, " ") || "invalid gate event";
          return `${gate}: ${reason}${direction ? ` (${direction})` : ""}`;
        })
        .join("; ");
      if (this.config.rejectInvalidTriggeredGateEvents) {
        throw new Error(`Invalid triggered_gate_events detected: ${messages}`);
      }
      entry.notes.push(`invalid gate events ignored: ${messages}`);
    }

    const semanticHasSupport = DENSE_GRID_KEYS.some(
      (key) =>
        (entry.semantic_grid?.[key]?.support || 0) > 0 &&
        (entry.semantic_grid?.[key]?.confidence || 0) > 0,
    );

    const hasSignals =
      semanticHasSupport ||
      entry.axis_events.x_pole_evidence.length ||
      entry.axis_events.x_integration_events.length ||
      entry.axis_events.z_pole_evidence.length ||
      entry.axis_events.z_integration_events.length ||
      entry.local_y_positive_signals.length ||
      entry.local_y_negative_signals.length ||
      entry.triggered_gate_events.length ||
      entry.local_extraction.principles.length ||
      entry.local_extraction.boundaries.length;

    if (!hasSignals) {
      throw new Error(
        "LLM payload must contain usable dense-grid support, structured signals, or extraction content.",
      );
    }

    entry.fallback_profile_line = this.buildFallbackProfileLine(entry);
    entry.addedAt = new Date().toISOString();

    this.state.entries.push(entry);
    this.mergeEntryIntoPersistentState(entry);
    return entry;
  }

  mergeEntryIntoPersistentState(entry) {
    this.mergePrinciplesAndBoundaries(entry);
    this.mergeRiskNotes(entry);
    this.mergeGateEvents(entry);
    this.refreshMetaEpistemicMarkers();
  }

  mergePrinciplesAndBoundaries(entry) {
    const profileState = this.state.profileState;
    const nextPrinciples = [
      ...profileState.core_principles,
      ...cleanStringList(entry.local_extraction.principles),
      ...cleanStringList(entry.profile_update_signals.new_principles),
      ...cleanStringList(entry.profile_update_signals.refined_principles),
    ];
    const nextBoundaries = [
      ...profileState.core_boundaries,
      ...cleanStringList(entry.local_extraction.boundaries),
      ...cleanStringList(entry.profile_update_signals.new_boundaries),
      ...cleanStringList(entry.profile_update_signals.refined_boundaries),
    ];

    profileState.core_principles = dedupeLatestFirst(nextPrinciples).slice(0, 24);
    profileState.core_boundaries = dedupeLatestFirst(nextBoundaries).slice(0, 24);
  }

  mergeRiskNotes(entry) {
    const profileState = this.state.profileState;
    const riskNotes = [];

    for (const signal of entry.local_y_negative_signals) {
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

    profileState.risk_notes = dedupeLatestFirst([...profileState.risk_notes, ...riskNotes]).slice(0, 18);
  }

  mergeGateEvents(entry) {
    const scopeWeight = this.scopeWeight(entry.analysis_scope);
    const scopeStrengthWeight = this.scopeStrengthWeight(entry.scope_strength);

    for (const event of entry.triggered_gate_events) {
      const gateState = this.state.gateStates[event.gate];
      if (!gateState) continue;

      const sign = event.direction === "negative" ? -1 : 1;
      const strengthValue = this.strengthWeight(event.strength);
      const gateWeight = this.gateWeight(event.gate);
      const confidence = EpistemicProfiler.clamp(Number(event.confidence ?? 1), 0.5, 1);
      const novelty = EpistemicProfiler.clamp(Number(event.novelty ?? 1), 0, 1);
      const baseDelta =
        sign * strengthValue * scopeWeight * scopeStrengthWeight * gateWeight * confidence * novelty;
      const delta = EpistemicProfiler.clamp(baseDelta, -1, 1);

      const oldScore = Number(gateState.score) || 0;
      const sameDirection = oldScore === 0 || Math.sign(oldScore) === Math.sign(delta);
      const multiplier = sameDirection ? 1 - Math.abs(oldScore) : 1 + 0.5 * Math.abs(oldScore);
      const newScore = EpistemicProfiler.clamp(oldScore + delta * multiplier, -1, 1);

      gateState.score = newScore;
      gateState.status = EpistemicProfiler.gateStatusFromScore(newScore);
      gateState.last_event_at = entry.addedAt;
      gateState.last_evidence_span = event.evidence_span || null;
      if (sign > 0) gateState.positive_events += 1;
      else gateState.negative_events += 1;
    }
  }

  refreshMetaEpistemicMarkers() {
    const markers = [];
    for (const [gate, data] of Object.entries(this.state.gateStates)) {
      if (data.status === "dormant") continue;
      markers.push(`${gate}: ${data.status}`);
    }
    this.state.profileState.meta_epistemic_markers = dedupeLatestFirst(markers).slice(0, 18);
  }

  localYSignalWeight(signal) {
    const polarity = cleanString(signal?.polarity).toLowerCase();
    const signalType = cleanString(signal?.signal_type).toLowerCase();
    if (!DEFAULT_SIGNAL_TYPES[polarity]?.has(signalType)) return 1;
    const bucket = this.config.localYSignalWeights?.[polarity] || {};
    return Number(bucket?.[signalType]) || 1;
  }

  isSoftNegativeSignal(signal) {
    const signalType = cleanString(signal?.signal_type).toLowerCase();
    return DEFAULT_SOFT_NEGATIVE_SIGNAL_TYPES.has(signalType);
  }

  contradictionPenaltyForEntry(entry) {
    let penalty = 0;
    const scopeWeight = this.scopeWeight(entry.analysis_scope);
    const contradictionWeights = { low: 0.12, medium: 0.24, high: 0.4 };

    for (const contradiction of entry.local_extraction.contradictions || []) {
      const severity = cleanString(contradiction?.severity).toLowerCase();
      penalty += (contradictionWeights[severity] ?? contradictionWeights.medium) * scopeWeight;
    }

    const introducedCount = Array.isArray(entry.profile_update_signals.introduced_contradictions)
      ? entry.profile_update_signals.introduced_contradictions.length
      : 0;
    const resolvedCount = Array.isArray(entry.profile_update_signals.resolved_contradictions)
      ? entry.profile_update_signals.resolved_contradictions.length
      : 0;
    penalty += introducedCount * 0.12 * scopeWeight;
    penalty -= resolvedCount * 0.06 * scopeWeight;

    return Math.max(0, penalty);
  }

  buildFallbackProfileLine(entry) {
    const grid = entry.semantic_grid || {};
    const values = {
      empathy: (grid.empathy?.support || 0) * (grid.empathy?.confidence || 0),
      practicality: (grid.practicality?.support || 0) * (grid.practicality?.confidence || 0),
      wisdom: (grid.wisdom?.support || 0) * (grid.wisdom?.confidence || 0),
      knowledge: (grid.knowledge?.support || 0) * (grid.knowledge?.confidence || 0),
      y_positive: (grid.y_positive?.support || 0) * (grid.y_positive?.confidence || 0),
      y_negative: (grid.y_negative?.support || 0) * (grid.y_negative?.confidence || 0),
    };

    const xDrive = values.empathy - values.practicality;
    const zDrive = values.wisdom - values.knowledge;
    const yDrive = values.y_positive - values.y_negative;
    const parts = [];

    if (Math.abs(yDrive) > this.config.summaryAxisFloor) {
      parts.push(
        `${EpistemicProfiler.formatSigned(yDrive)} ${yDrive >= 0 ? "stability" : "instability"}`,
      );
    }
    if (Math.abs(xDrive) > this.config.summaryAxisFloor) {
      parts.push(`+${Math.abs(xDrive).toFixed(2)} ${xDrive >= 0 ? "empathy" : "practicality"}`);
    }
    if (Math.abs(zDrive) > this.config.summaryAxisFloor) {
      parts.push(`+${Math.abs(zDrive).toFixed(2)} ${zDrive >= 0 ? "wisdom" : "knowledge"}`);
    }

    if (!parts.length) return null;
    return `${parts.join(" ")} | synthesized from dense support`;
  }

  aggregateDenseSemantics() {
    let empathy = 0;
    let practicality = 0;
    let wisdom = 0;
    let knowledge = 0;
    let xIntegration = 0;
    let zIntegration = 0;
    let yPositive = 0;
    let yNegative = 0;
    let contradictionPenalty = 0;
    let sourceCount = 0;

    for (const entry of this.state.entries) {
      const scopeWeight = this.scopeWeight(entry.analysis_scope);
      const scopeStrengthWeight = this.scopeStrengthWeight(entry.scope_strength);
      const entryWeight = scopeWeight * scopeStrengthWeight;
      const grid = entry.semantic_grid || emptySemanticGrid();

      const take = (key) => {
        const bucket = grid[key] || {};
        const value = (Number(bucket.support) || 0) * (Number(bucket.confidence) || 0) * entryWeight;
        if (value > 0) sourceCount += 1;
        return value;
      };

      empathy += take("empathy");
      practicality += take("practicality");
      wisdom += take("wisdom");
      knowledge += take("knowledge");
      xIntegration += take("x_integration");
      zIntegration += take("z_integration");
      yPositive += take("y_positive");
      yNegative += take("y_negative");
      contradictionPenalty += this.contradictionPenaltyForEntry(entry);
    }

    const xIntegrationResolved = EpistemicProfiler.clamp(xIntegration, 0, 1);
    const zIntegrationResolved = EpistemicProfiler.clamp(zIntegration, 0, 1);

    const xDrive = empathy - practicality;
    const zDrive = wisdom - knowledge;
    const xRaw = xDrive * (1 - xIntegrationResolved);
    const zRaw = zDrive * (1 - zIntegrationResolved);

    const integrationBonus =
      Math.min(empathy, practicality) * xIntegrationResolved +
      Math.min(wisdom, knowledge) * zIntegrationResolved;

    const xAsymmetryPenalty =
      Math.max(0, Math.abs(xDrive) - this.config.yAsymmetryDeadZone) * (1 - xIntegrationResolved);
    const zAsymmetryPenalty =
      Math.max(0, Math.abs(zDrive) - this.config.yAsymmetryDeadZone) * (1 - zIntegrationResolved);

    const localYBase =
      yPositive -
      yNegative +
      this.config.yIntegrationBonusWeight * integrationBonus -
      this.config.yAsymmetryPenaltyWeight * (xAsymmetryPenalty + zAsymmetryPenalty) -
      contradictionPenalty * this.config.contradictionPenaltyScale;

    const gateWeightsTotal = Object.values(this.config.gateWeights).reduce((sum, value) => sum + value, 0);
    let weightedPositiveScoreSum = 0;
    let weightedNegativeScoreSum = 0;
    let weightedPositiveGateWeight = 0;
    let weightedNegativeGateWeight = 0;
    let weightedCoveredSum = 0;
    let gateEventCount = 0;

    for (const [gate, data] of Object.entries(this.state.gateStates)) {
      const weight = this.gateWeight(gate);
      if (data.positive_events || data.negative_events) weightedCoveredSum += weight;
      gateEventCount += data.positive_events + data.negative_events;
      if (data.score > 0) {
        weightedPositiveScoreSum += weight * data.score;
        weightedPositiveGateWeight += weight;
      } else if (data.score < 0) {
        weightedNegativeScoreSum += weight * Math.abs(data.score);
        weightedNegativeGateWeight += weight;
      }
    }

    const weightedMeanPositiveGateScores =
      weightedPositiveGateWeight > 0 ? weightedPositiveScoreSum / weightedPositiveGateWeight : 0;
    const weightedMeanNegativeGateScores =
      weightedNegativeGateWeight > 0 ? weightedNegativeScoreSum / weightedNegativeGateWeight : 0;

    const persistentGateBonus = this.config.positiveGateInfluence * weightedMeanPositiveGateScores;
    const persistentGatePenalty = this.config.negativeGateInfluence * weightedMeanNegativeGateScores;

    const yRaw = EpistemicProfiler.clamp(
      localYBase + persistentGateBonus - persistentGatePenalty,
      -1,
      1,
    );

    return {
      empathy,
      practicality,
      wisdom,
      knowledge,
      xIntegration,
      zIntegration,
      yPositive,
      yNegative,
      xDrive,
      zDrive,
      xRaw,
      zRaw,
      integrationBonus,
      xAsymmetryPenalty,
      zAsymmetryPenalty,
      localYBase,
      yRaw,
      contradictionPenalty,
      persistentGateBonus,
      persistentGatePenalty,
      yCoverage: gateWeightsTotal > 0 ? weightedCoveredSum / gateWeightsTotal : 0,
      gateEventCount,
      sourceCount,
    };
  }

  getSemanticProfile() {
    const dense = this.aggregateDenseSemantics();

    const empathyPracticality = {
      axis: "empathyPracticality",
      raw: dense.xRaw,
      positiveTotal: dense.empathy,
      negativeTotal: dense.practicality,
      integrationTotal: dense.xIntegration,
      poleMagnitude: dense.empathy + dense.practicality,
      poleDelta: dense.xDrive,
      sourceCount: dense.sourceCount,
    };

    const wisdomKnowledge = {
      axis: "wisdomKnowledge",
      raw: dense.zRaw,
      positiveTotal: dense.wisdom,
      negativeTotal: dense.knowledge,
      integrationTotal: dense.zIntegration,
      poleMagnitude: dense.wisdom + dense.knowledge,
      poleDelta: dense.zDrive,
      sourceCount: dense.sourceCount,
    };

    const epistemicStability = {
      axis: "epistemicStability",
      raw: dense.yRaw,
      y_estimate: dense.yRaw,
      y_coverage: dense.yCoverage,
      local_y_base: dense.localYBase,
      positiveSum: dense.yPositive,
      negativeSum: dense.yNegative,
      contradictionPenalty: dense.contradictionPenalty,
      persistent_gate_bonus: dense.persistentGateBonus,
      persistent_gate_penalty: dense.persistentGatePenalty,
      xAsymmetryPenalty: dense.xAsymmetryPenalty,
      zAsymmetryPenalty: dense.zAsymmetryPenalty,
      integrationBonus: dense.integrationBonus,
      gateEventCount: dense.gateEventCount,
    };

    const a = empathyPracticality.raw;
    const b = wisdomKnowledge.raw;
    const s = epistemicStability.y_estimate;
    const yCoverage = epistemicStability.y_coverage;

    return {
      model: "epistemic_octahedron_profiler_v7",
      semantics: {
        a,
        b,
        s,
        yEstimate: s,
        yCoverage,
      },
      uiLike: {
        empathyPercent: (a + 1) * 50,
        practicalityPercent: 100 - (a + 1) * 50,
        wisdomPercent: (b + 1) * 50,
        knowledgePercent: 100 - (b + 1) * 50,
        stabilityPercent: s * 100,
        coveragePercent: yCoverage * 100,
      },
      diagnostics: {
        dense,
        empathyPracticality,
        wisdomKnowledge,
        epistemicStability,
        gateStates: cloneJSON(this.state.gateStates),
        profileState: cloneJSON(this.state.profileState),
      },
    };
  }

  static projectSemanticTriple(a, s, b, options = {}) {
    const epsilon = options.epsilon ?? 1e-9;
    const threshold = options.activeWorldviewThreshold ?? 0.12;
    const xSemantic = EpistemicProfiler.clamp(Number(a) || 0, -1, 1);
    const ySemantic = EpistemicProfiler.clamp(Number(s) || 0, -1, 1);
    const zSemantic = EpistemicProfiler.clamp(Number(b) || 0, -1, 1);
    const magnitude = Math.abs(xSemantic) + Math.abs(ySemantic) + Math.abs(zSemantic);

    if (magnitude <= epsilon) {
      return {
        point: { x: 0, y: 0, z: 0 },
        debug: {
          xSemantic,
          ySemantic,
          zSemantic,
          magnitude,
          activeWorldviewThresholdMet: false,
          surfaceEquationSatisfied: true,
          projectionMode: "origin",
        },
      };
    }

    if (magnitude <= 1) {
      const point = { x: xSemantic, y: ySemantic, z: zSemantic };
      const manhattan = Math.abs(point.x) + Math.abs(point.y) + Math.abs(point.z);
      return {
        point,
        debug: {
          xSemantic,
          ySemantic,
          zSemantic,
          magnitude,
          manhattan,
          activeWorldviewThresholdMet: magnitude >= threshold,
          surfaceEquationSatisfied: Math.abs(manhattan - 1) <= 1e-6,
          projectionMode: "interior_semantic_hold",
        },
      };
    }

    const point = {
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
        surfaceEquationSatisfied: Math.abs(manhattan - 1) <= 1e-6,
        projectionMode: "surface_projection",
      },
    };
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

    return `+${Math.abs(numeric).toFixed(2)} ${label}`;
  }

  axisActivityText(axisSummary = {}, axisKey) {
    const threshold = Number(this.config.summaryAxisFloor ?? 0.04);
    const raw = Number(axisSummary?.raw) || 0;
    if (Math.abs(raw) >= threshold) return null;

    const positiveTotal = Number(axisSummary?.positiveTotal) || 0;
    const negativeTotal = Number(axisSummary?.negativeTotal) || 0;
    const integrationTotal = Number(axisSummary?.integrationTotal) || 0;
    const sourceCount = Number(axisSummary?.sourceCount) || 0;
    if (sourceCount <= 0) return null;

    const labels = AXIS_LABELS[axisKey];
    const hasPositive = positiveTotal > this.config.epsilon;
    const hasNegative = negativeTotal > this.config.epsilon;
    const hasIntegration = integrationTotal > this.config.epsilon;
    const axisTag = axisKey === "wisdomKnowledge" ? "z" : "x";

    if (hasPositive && hasNegative) {
      return `[${axisTag} active: ${labels.positive}/${labels.negative} tension present]`;
    }
    if (hasIntegration) {
      return `[${axisTag} active: integration without signed drift]`;
    }
    if (hasPositive) {
      return `[${axisTag} active: ${labels.positive} present]`;
    }
    if (hasNegative) {
      return `[${axisTag} active: ${labels.negative} present]`;
    }

    return null;
  }

  buildAggregateProfileLine(semantics = {}, diagnostics = {}) {
    const parts = [];
    const yText = this.axisText(semantics.s, "epistemicStability");
    const xText = this.axisText(semantics.a, "empathyPracticality");
    const zText = this.axisText(semantics.b, "wisdomKnowledge");
    const xActivityText = this.axisActivityText(
      diagnostics.empathyPracticality,
      "empathyPracticality",
    );
    const zActivityText = this.axisActivityText(
      diagnostics.wisdomKnowledge,
      "wisdomKnowledge",
    );

    if (yText) parts.push(yText);
    if (xText) parts.push(xText);
    if (zText) parts.push(zText);
    if (!xText && xActivityText) parts.push(xActivityText);
    if (!zText && zActivityText) parts.push(zActivityText);

    if (!parts.length) {
      return "0.00 null-state | no active worldview threshold met";
    }

    return `${parts.join(" ")} | compiled aggregate`;
  }

  buildSupportingNotes() {
    const semanticProfile = this.getSemanticProfile();
    const notes = [];

    const projectionMode =
      semanticProfile?.diagnostics?.projectionDebug?.projectionMode ||
      semanticProfile?.diagnostics?.projection_mode ||
      "";
    if (projectionMode === "interior_semantic_hold") {
      notes.push(
        "Point retained in semantic interior because total semantic activation did not warrant surface saturation.",
      );
    }

    return dedupeLatestFirst([
      ...this.state.entries.flatMap((entry) => entry.notes || []),
      ...this.state.profileState.risk_notes,
      ...notes,
    ]);
  }

  computePoint() {
    const semanticProfile = this.getSemanticProfile();
    const { a, b, s, yCoverage } = semanticProfile.semantics;
    const projection = EpistemicProfiler.projectSemanticTriple(a, s, b, {
      epsilon: this.config.epsilon,
      activeWorldviewThreshold: this.config.activeWorldviewThreshold,
    });

    semanticProfile.diagnostics.projectionDebug = cloneJSON(projection.debug);

    const finalized = {
      model: semanticProfile.model,
      profile: [
        this.buildAggregateProfileLine(semanticProfile.semantics, semanticProfile.diagnostics),
      ],
      notes: this.buildSupportingNotes(),
      data: {
        point: { ...projection.point },
        params: {
          semantics: { ...semanticProfile.semantics },
          uiLike: { ...semanticProfile.uiLike },
        },
        diagnostics: {
          ...cloneJSON(semanticProfile.diagnostics),
          supportingEntryProfiles: this.state.entries.map((entry) => ({
            addedAt: entry.addedAt,
            profile: cloneJSON(entry.display_profile_lines || []),
            fallback_profile_line: entry.fallback_profile_line || null,
            scope: entry.analysis_scope,
          })),
        },
        math: {
          formulas: {
            xDrive: String.raw`x_{drive} = empathy - practicality`,
            zDrive: String.raw`z_{drive} = wisdom - knowledge`,
            xRaw: String.raw`x_{raw} = x_{drive} \times (1 - \operatorname{clamp}(x_{integration}, 0, 1))`,
            zRaw: String.raw`z_{raw} = z_{drive} \times (1 - \operatorname{clamp}(z_{integration}, 0, 1))`,
            yEstimate:
              String.raw`y = \operatorname{clamp}(y_{positive} - y_{negative} + w_i \times integrationBonus - w_a \times unresolvedAsymmetry - contradictionPenalty \times c + gateBonus - gatePenalty, -1, 1)`,
            interiorRule:
              String.raw`|a| + |s| + |b| \le 1 \Rightarrow point = (a,s,b)`,
            surfaceRule:
              String.raw`|a| + |s| + |b| > 1 \Rightarrow (x,y,z) = \frac{(a,s,b)}{|a| + |s| + |b|}`,
            originRule:
              String.raw`|a| + |s| + |b| = 0 \Rightarrow (x,y,z) = (0,0,0)`,
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
            projectionMode: projection.debug.projectionMode,
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
