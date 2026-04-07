
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

const GRID_KEYS = [
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

function compactEvidenceSpans(values = [], limit = 4) {
  const clean = dedupeLatestFirst(
    (Array.isArray(values) ? values : [values])
      .flatMap((item) => (Array.isArray(item) ? item : [item]))
      .map((item) => normalizeEvidenceSpan(item))
      .filter(Boolean),
  );
  return clean.slice(0, limit);
}

function normalizeGridBucket(input) {
  const raw = input && typeof input === "object" && !Array.isArray(input)
    ? input
    : typeof input === "number"
      ? { support: input }
      : {};

  const support = Number(
    raw.support ?? raw.value ?? raw.score ?? raw.magnitude ?? raw.weight ?? 0,
  );
  const confidence = Number(raw.confidence ?? raw.certainty ?? (support > 0 ? 1 : 0));
  const evidence_spans = compactEvidenceSpans(
    raw.evidence_spans || raw.evidenceSpans || raw.spans || raw.evidence_span || raw.reason,
  );

  return {
    support: EpistemicProfiler.clamp(Number.isFinite(support) ? support : 0, 0, 1),
    confidence: EpistemicProfiler.clamp(Number.isFinite(confidence) ? confidence : 0, 0, 1),
    evidence_spans,
  };
}

function hasGridBucketValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "number") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value !== "object") return false;
  return ["support", "value", "score", "magnitude", "weight", "confidence", "evidence_spans", "evidenceSpans", "spans", "evidence_span", "reason"].some(
    (key) => value[key] !== undefined,
  );
}

function emptySemanticGrid() {
  return Object.fromEntries(
    GRID_KEYS.map((key) => [key, { support: 0, confidence: 0, evidence_spans: [] }]),
  );
}

function bucketAliases(key) {
  const aliases = {
    empathy: ["empathy"],
    practicality: ["practicality"],
    wisdom: ["wisdom"],
    knowledge: ["knowledge"],
    x_integration: ["x_integration", "xIntegration", "x_balance", "xBalance"],
    z_integration: ["z_integration", "zIntegration", "z_balance", "zBalance"],
    y_positive: ["y_positive", "yPositive", "positive_y", "positiveY"],
    y_negative: ["y_negative", "yNegative", "negative_y", "negativeY"],
  };
  return aliases[key] || [key];
}

export class EpistemicProfiler {
  constructor(options = {}) {
    this.config = {
      strengthWeights: { ...DEFAULT_STRENGTH_WEIGHTS },
      scopeWeights: { ...DEFAULT_SCOPE_WEIGHTS },
      scopeStrengthWeights: { ...DEFAULT_SCOPE_STRENGTH_WEIGHTS },
      gateWeights: { ...DEFAULT_GATE_WEIGHTS },
      axisSaturation: {
        empathyPracticality: 2.5,
        wisdomKnowledge: 2.5,
        epistemicStability: 2.5,
      },
      integrationSaturation: 1.0,
      integrationBonusWeight: 0.7,
      unresolvedAsymmetryPenaltyWeight: 0.45,
      unresolvedAsymmetryDeadzone: 0.08,
      positiveGateInfluence: 0.16,
      negativeGateInfluence: 0.28,
      contradictionPenaltyScale: 1.0,
      rejectInvalidTriggeredGateEvents: true,
      epsilon: 1e-9,
      summaryAxisFloor: 0.04,
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

  static saturate(value, scale = 1) {
    const numeric = Math.max(0, Number(value) || 0);
    const safeScale = Math.max(1e-9, Number(scale) || 1);
    return numeric <= 0 ? 0 : numeric / (numeric + safeScale);
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
    const normalized = cleanString(strength).toLowerCase();
    return this.config.strengthWeights[normalized] ?? this.config.strengthWeights.moderate;
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
    const evidenceCount = Array.isArray(payload.triggered_gate_events)
      ? payload.triggered_gate_events.length
      : 0;
    const principleCount = Array.isArray(payload?.local_extraction?.principles)
      ? payload.local_extraction.principles.length
      : 0;
    const semanticGridCount = this.hasSemanticGridData(payload.semantic_grid || payload.semanticGrid)
      ? 1
      : 0;
    const total = evidenceCount + principleCount + semanticGridCount;
    if (total >= 6) return "full_profile_import";
    if (total >= 3) return "worldview_fragment";
    if (total >= 1) return "stance";
    return "thought";
  }

  inferScopeStrength(scope, payload = {}) {
    const explicit = cleanString(payload.scope_strength).toLowerCase();
    if (["low", "medium", "high"].includes(explicit)) return explicit;
    const profileCount = cleanStringList(payload.profile || []).length;
    const gateCount = Array.isArray(payload.triggered_gate_events) ? payload.triggered_gate_events.length : 0;
    const semanticGridCount = this.hasSemanticGridData(payload.semantic_grid || payload.semanticGrid) ? 2 : 0;
    const score = profileCount + gateCount + semanticGridCount;
    if (score >= 6) return "high";
    if (score >= 3) return "medium";
    return "low";
  }

  hasSemanticGridData(input = {}) {
    if (!input || typeof input !== "object") return false;
    return GRID_KEYS.some((key) => {
      const value = bucketAliases(key).map((alias) => input?.[alias]).find((candidate) => hasGridBucketValue(candidate));
      if (!hasGridBucketValue(value)) return false;
      const bucket = normalizeGridBucket(value);
      return bucket.support > 0 || bucket.confidence > 0 || bucket.evidence_spans.length > 0;
    });
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
          signal_type: cleanString(item.signal_type || item.type || item.signal).toLowerCase() || `legacy_${fallbackPolarity}`,
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
    for (const key of keys) out[key] = Array.isArray(input?.[key]) ? input[key] : [];
    return out;
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
      const strength = cleanString(item.strength).toLowerCase() || "moderate";
      const confidence = EpistemicProfiler.clamp(Number(item.confidence ?? 1), 0, 1);
      const evidenceSpan = normalizeEvidenceSpan(item.excerpt || item.reason);

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
    const local_y_negative_signals = [];

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

  payloadHasStructuredScorableSignals(payload = {}) {
    const axisEvents = payload.axis_events || {};
    const localExtraction = payload.local_extraction || {};
    const extractionKeys = ["principles", "boundaries", "claimed_values", "tradeoffs", "contradictions"];

    return Boolean(
      this.hasSemanticGridData(payload.semantic_grid || payload.semanticGrid) ||
      (Array.isArray(payload.evidence) && payload.evidence.length) ||
      (Array.isArray(payload.triggered_gate_events) && payload.triggered_gate_events.length) ||
      (Array.isArray(payload.local_y_positive_signals) && payload.local_y_positive_signals.length) ||
      (Array.isArray(payload.local_y_negative_signals) && payload.local_y_negative_signals.length) ||
      (Array.isArray(axisEvents.x_pole_evidence) && axisEvents.x_pole_evidence.length) ||
      (Array.isArray(axisEvents.x_integration_events) && axisEvents.x_integration_events.length) ||
      (Array.isArray(axisEvents.z_pole_evidence) && axisEvents.z_pole_evidence.length) ||
      (Array.isArray(axisEvents.z_integration_events) && axisEvents.z_integration_events.length) ||
      extractionKeys.some((key) => Array.isArray(localExtraction[key]) && localExtraction[key].length)
    );
  }

  bucketFromWeightedItems(items = []) {
    const normalized = Array.isArray(items) ? items : [items];
    const weightedSupport = normalized.reduce(
      (sum, item) => sum + this.strengthWeight(item?.strength) * EpistemicProfiler.clamp(Number(item?.confidence ?? 1), 0, 1),
      0,
    );
    const confidence = normalized.length
      ? EpistemicProfiler.clamp(
          normalized.reduce((sum, item) => sum + EpistemicProfiler.clamp(Number(item?.confidence ?? 1), 0, 1), 0) /
            normalized.length,
          0,
          1,
        )
      : 0;
    return {
      support: EpistemicProfiler.clamp(weightedSupport, 0, 1),
      confidence,
      evidence_spans: compactEvidenceSpans(normalized.map((item) => item?.evidence_span)),
    };
  }

  deriveSemanticGridFromStructured({ axis_events = {}, local_y_positive_signals = [], local_y_negative_signals = [] } = {}) {
    const xPole = Array.isArray(axis_events.x_pole_evidence) ? axis_events.x_pole_evidence : [];
    const zPole = Array.isArray(axis_events.z_pole_evidence) ? axis_events.z_pole_evidence : [];
    const xIntegration = Array.isArray(axis_events.x_integration_events) ? axis_events.x_integration_events : [];
    const zIntegration = Array.isArray(axis_events.z_integration_events) ? axis_events.z_integration_events : [];

    return {
      empathy: this.bucketFromWeightedItems(xPole.filter((item) => cleanString(item.pole).toLowerCase() === "empathy")),
      practicality: this.bucketFromWeightedItems(xPole.filter((item) => cleanString(item.pole).toLowerCase() === "practicality")),
      wisdom: this.bucketFromWeightedItems(zPole.filter((item) => cleanString(item.pole).toLowerCase() === "wisdom")),
      knowledge: this.bucketFromWeightedItems(zPole.filter((item) => cleanString(item.pole).toLowerCase() === "knowledge")),
      x_integration: this.bucketFromWeightedItems(xIntegration),
      z_integration: this.bucketFromWeightedItems(zIntegration),
      y_positive: this.bucketFromWeightedItems(local_y_positive_signals),
      y_negative: this.bucketFromWeightedItems(local_y_negative_signals),
    };
  }

  normalizeSemanticGrid(input = {}, derived = {}) {
    const out = emptySemanticGrid();
    for (const key of GRID_KEYS) {
      const aliases = bucketAliases(key);
      const explicitValue = aliases
        .map((alias) => input?.[alias])
        .find((candidate) => hasGridBucketValue(candidate));
      out[key] = hasGridBucketValue(explicitValue)
        ? normalizeGridBucket(explicitValue)
        : normalizeGridBucket(derived?.[key] || {});
    }
    return out;
  }

  buildFallbackProfileLine(entry) {
    const grid = entry.semantic_grid || emptySemanticGrid();
    const y = grid.y_positive.support - grid.y_negative.support;
    const x = grid.empathy.support - grid.practicality.support;
    const z = grid.wisdom.support - grid.knowledge.support;
    const parts = [];
    if (Math.abs(y) > this.config.epsilon) {
      parts.push(`${EpistemicProfiler.formatSigned(y)} ${y >= 0 ? "stability" : "instability"}`);
    }
    if (Math.abs(x) > this.config.epsilon) {
      parts.push(`${EpistemicProfiler.formatSigned(x)} ${x >= 0 ? "empathy" : "practicality"}`);
    }
    if (Math.abs(z) > this.config.epsilon) {
      parts.push(`${EpistemicProfiler.formatSigned(z)} ${z >= 0 ? "wisdom" : "knowledge"}`);
    }
    return parts.length ? `${parts.join(" ")} | synthesized from dense support grid` : null;
  }

  normalizePayload(payload = {}) {
    if (!payload || typeof payload !== "object") {
      throw new Error("LLM payload must be an object");
    }

    const display_profile_lines = cleanStringList(payload.profile || []);
    const notes = cleanStringList(payload.notes || []);
    const analysis_scope = this.inferScope(payload);
    const scope_strength = this.inferScopeStrength(analysis_scope, payload);

    const legacy = this.normalizeLegacyEvidence(payload.evidence || []);
    const structuredScorableSignalsPresent = this.payloadHasStructuredScorableSignals(payload);
    const compact = structuredScorableSignalsPresent
      ? {
          compactSignals: [],
          axis_events: { x_pole_evidence: [], x_integration_events: [], z_pole_evidence: [], z_integration_events: [] },
          local_y_positive_signals: [],
          local_y_negative_signals: [],
        }
      : this.normalizeCompactSignals(display_profile_lines);

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
      ...legacy.local_y_positive_signals,
      ...this.normalizeSignalList(payload.local_y_positive_signals || [], "positive"),
      ...compact.local_y_positive_signals,
    ];

    const local_y_negative_signals = [
      ...legacy.local_y_negative_signals,
      ...this.normalizeSignalList(payload.local_y_negative_signals || [], "negative"),
      ...compact.local_y_negative_signals,
    ];

    const local_extraction = this.normalizeLocalExtraction(payload.local_extraction || {});
    const profile_update_signals = this.normalizeProfileUpdateSignals(payload.profile_update_signals || {});
    const normalizedGateResult = this.normalizeGateEvents(payload.triggered_gate_events || []);
    const triggered_gate_events = normalizedGateResult.accepted;
    const invalidGateEvents = normalizedGateResult.rejected;
    const derivedGrid = this.deriveSemanticGridFromStructured({ axis_events, local_y_positive_signals, local_y_negative_signals });
    const semantic_grid = this.normalizeSemanticGrid(payload.semantic_grid || payload.semanticGrid || {}, derivedGrid);

    return {
      model: cleanString(payload.model) || "epistemic_octahedron_interpreter_v2",
      profiler_mode: cleanString(payload.profiler_mode || payload.profilerMode) || (this.hasSemanticGridData(payload.semantic_grid || payload.semanticGrid) ? "dense_support_v1" : "legacy_structured_v1"),
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
      compactSignals: compact.compactSignals,
      legacyEvidence: Array.isArray(payload.evidence) ? cloneJSON(payload.evidence) : [],
      invalidGateEvents,
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

    const gridHasSupport = GRID_KEYS.some((key) => {
      const bucket = entry.semantic_grid?.[key];
      return (bucket?.support || 0) > 0 || (bucket?.confidence || 0) > 0 || (bucket?.evidence_spans || []).length > 0;
    });

    const hasSignals =
      gridHasSupport ||
      entry.legacyEvidence.length ||
      entry.compactSignals.length ||
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
      throw new Error("LLM payload must contain usable semantic_grid support, structured signals, compact profile signals, or extraction content.");
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
      if (label) riskNotes.push(`risk: ${label}`);
    }

    for (const contradiction of entry.local_extraction.contradictions) {
      const type = cleanString(contradiction?.contradiction_type).replace(/_/g, " ");
      const severity = cleanString(contradiction?.severity).toLowerCase();
      riskNotes.push(`risk: ${type || "contradiction"}${severity ? ` (${severity})` : ""}`);
    }

    for (const event of entry.triggered_gate_events || []) {
      if (event.direction === "negative") riskNotes.push(`risk: ${event.gate}`);
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
      const evidenceMultiplier = cleanString(event.evidence_span) ? 1 : 0.85;
      const baseDelta = sign * strengthValue * scopeWeight * scopeStrengthWeight * gateWeight * confidence * novelty * evidenceMultiplier;
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

  getAllEvidence() {
    return this.state.entries.flatMap((entry) => entry.legacyEvidence || []);
  }

  getAllCompactSignals() {
    return this.state.entries.flatMap((entry) => entry.compactSignals || []);
  }

  contradictionPenaltyForEntry(entry) {
    let penalty = 0;
    const scopeFactor = this.scopeWeight(entry.analysis_scope) * this.scopeStrengthWeight(entry.scope_strength);
    const contradictionWeights = { low: 0.08, medium: 0.16, high: 0.3 };

    for (const contradiction of entry.local_extraction.contradictions || []) {
      const severity = cleanString(contradiction?.severity).toLowerCase();
      penalty += (contradictionWeights[severity] ?? contradictionWeights.medium) * scopeFactor;
    }

    const introducedCount = Array.isArray(entry.profile_update_signals.introduced_contradictions)
      ? entry.profile_update_signals.introduced_contradictions.length
      : 0;
    const resolvedCount = Array.isArray(entry.profile_update_signals.resolved_contradictions)
      ? entry.profile_update_signals.resolved_contradictions.length
      : 0;

    penalty += introducedCount * 0.08 * scopeFactor;
    penalty -= resolvedCount * 0.04 * scopeFactor;
    return Math.max(0, penalty);
  }

  computeDenseSupportTotals() {
    const totals = Object.fromEntries(GRID_KEYS.map((key) => [key, 0]));
    const counts = Object.fromEntries(GRID_KEYS.map((key) => [key, 0]));
    const evidence_spans = Object.fromEntries(GRID_KEYS.map((key) => [key, []]));

    for (const entry of this.state.entries) {
      const scopeFactor = this.scopeWeight(entry.analysis_scope) * this.scopeStrengthWeight(entry.scope_strength);
      for (const key of GRID_KEYS) {
        const bucket = entry.semantic_grid?.[key] || { support: 0, confidence: 0, evidence_spans: [] };
        const value = bucket.support * bucket.confidence * scopeFactor;
        totals[key] += value;
        if (value > this.config.epsilon) counts[key] += 1;
        evidence_spans[key].push(...(bucket.evidence_spans || []));
      }
    }

    return {
      totals,
      counts,
      evidence_spans: Object.fromEntries(
        GRID_KEYS.map((key) => [key, compactEvidenceSpans(evidence_spans[key])]),
      ),
      entryCount: this.state.entries.length,
    };
  }

  aggregateLateralAxis(axisKey, supportSummary = this.computeDenseSupportTotals()) {
    const positiveKey = axisKey === "empathyPracticality" ? "empathy" : "wisdom";
    const negativeKey = axisKey === "empathyPracticality" ? "practicality" : "knowledge";
    const integrationKey = axisKey === "empathyPracticality" ? "x_integration" : "z_integration";

    const positiveTotal = Number(supportSummary.totals[positiveKey]) || 0;
    const negativeTotal = Number(supportSummary.totals[negativeKey]) || 0;
    const integrationTotal = Number(supportSummary.totals[integrationKey]) || 0;
    const saturation = this.config.axisSaturation[axisKey] ?? 2.5;
    const integrationRatio = EpistemicProfiler.saturate(integrationTotal, this.config.integrationSaturation);
    const poleDelta = positiveTotal - negativeTotal;
    const poleMagnitude = positiveTotal + negativeTotal;
    const balanceTotal = Math.min(positiveTotal, negativeTotal);
    const resolvedBalance = balanceTotal * integrationRatio;
    const unresolvedAsymmetry = Math.abs(poleDelta) * (1 - integrationRatio);
    const moderatedDelta = poleDelta * (1 - integrationRatio);
    const raw = poleMagnitude <= this.config.epsilon ? 0 : EpistemicProfiler.clamp(moderatedDelta / saturation, -1, 1);

    return {
      axis: axisKey,
      raw,
      positiveTotal,
      negativeTotal,
      integrationTotal,
      integrationRatio,
      balanceTotal,
      resolvedBalance,
      unresolvedAsymmetry,
      poleMagnitude,
      poleDelta,
      moderatedDelta,
      saturation,
      sourceCount:
        (supportSummary.counts[positiveKey] || 0) +
        (supportSummary.counts[negativeKey] || 0) +
        (supportSummary.counts[integrationKey] || 0),
      explicitPoleWeightCount: 0,
      defaultedPoleWeightCount: 0,
      explicitBalanceCount: 0,
      defaultWeightedBalance: false,
      tieBreakApplied: false,
      tieBreakBias: 0,
      tieBreakDelta: 0,
      tieBreakPositiveScore: 0,
      tieBreakNegativeScore: 0,
      evidence_spans: {
        positive: supportSummary.evidence_spans[positiveKey] || [],
        negative: supportSummary.evidence_spans[negativeKey] || [],
        integration: supportSummary.evidence_spans[integrationKey] || [],
      },
    };
  }

  aggregateY(supportSummary, xSummary, zSummary) {
    const positiveSum = Number(supportSummary.totals.y_positive) || 0;
    const negativeSum = Number(supportSummary.totals.y_negative) || 0;
    const integrationBonus =
      this.config.integrationBonusWeight * (xSummary.resolvedBalance + zSummary.resolvedBalance);

    const asymmetryDeadzone = Number(this.config.unresolvedAsymmetryDeadzone ?? 0);
    const xPenaltyBase = Math.max(0, (Number(xSummary.unresolvedAsymmetry) || 0) - asymmetryDeadzone);
    const zPenaltyBase = Math.max(0, (Number(zSummary.unresolvedAsymmetry) || 0) - asymmetryDeadzone);
    const unresolvedAsymmetryPenalty =
      this.config.unresolvedAsymmetryPenaltyWeight * (xPenaltyBase + zPenaltyBase);

    let contradictionPenalty = 0;
    for (const entry of this.state.entries) {
      contradictionPenalty += this.contradictionPenaltyForEntry(entry);
    }

    const saturation = this.config.axisSaturation.epistemicStability ?? 2.5;
    const local_y_base = EpistemicProfiler.clamp(
      (positiveSum - negativeSum + integrationBonus - unresolvedAsymmetryPenalty - contradictionPenalty * this.config.contradictionPenaltyScale) /
        saturation,
      -1,
      1,
    );

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

    const weightedMeanPositiveGateScores = weightedPositiveGateWeight > 0 ? weightedPositiveScoreSum / weightedPositiveGateWeight : 0;
    const weightedMeanNegativeGateScores = weightedNegativeGateWeight > 0 ? weightedNegativeScoreSum / weightedNegativeGateWeight : 0;
    const persistent_gate_bonus = this.config.positiveGateInfluence * weightedMeanPositiveGateScores;
    const persistent_gate_penalty = this.config.negativeGateInfluence * weightedMeanNegativeGateScores;
    const y_estimate = EpistemicProfiler.clamp(local_y_base + persistent_gate_bonus - persistent_gate_penalty, -1, 1);

    const gateCoverage = gateWeightsTotal > 0 ? weightedCoveredSum / gateWeightsTotal : 0;
    const gridCoverage = ((supportSummary.counts.y_positive > 0 ? 1 : 0) + (supportSummary.counts.y_negative > 0 ? 1 : 0) + (supportSummary.counts.x_integration > 0 ? 1 : 0) + (supportSummary.counts.z_integration > 0 ? 1 : 0)) / 4;
    const y_coverage = EpistemicProfiler.clamp(Math.max(gateCoverage, gridCoverage), 0, 1);

    return {
      axis: "epistemicStability",
      raw: y_estimate,
      y_estimate,
      y_coverage,
      local_y_base,
      positiveSum,
      negativeSum,
      contradictionPenalty,
      integrationBonus,
      unresolvedAsymmetryPenalty,
      asymmetryDeadzone,
      xPenaltyBase,
      zPenaltyBase,
      persistent_gate_bonus,
      persistent_gate_penalty,
      weightedMeanPositiveGateScores,
      weightedMeanNegativeGateScores,
      gateCoverage,
      gridCoverage,
      positiveSignalCount: supportSummary.counts.y_positive || 0,
      negativeSignalCount: supportSummary.counts.y_negative || 0,
      gateEventCount,
      evidence_spans: {
        positive: supportSummary.evidence_spans.y_positive || [],
        negative: supportSummary.evidence_spans.y_negative || [],
      },
    };
  }

  getSemanticProfile() {
    const supportSummary = this.computeDenseSupportTotals();
    const empathyPracticality = this.aggregateLateralAxis("empathyPracticality", supportSummary);
    const wisdomKnowledge = this.aggregateLateralAxis("wisdomKnowledge", supportSummary);
    const epistemicStability = this.aggregateY(supportSummary, empathyPracticality, wisdomKnowledge);

    const a = empathyPracticality.raw;
    const b = wisdomKnowledge.raw;
    const s = epistemicStability.y_estimate;
    const yCoverage = epistemicStability.y_coverage;

    return {
      model: "epistemic_octahedron_profiler_v7_1",
      semantics: { a, b, s, yEstimate: s, yCoverage },
      uiLike: {
        empathyPercent: (a + 1) * 50,
        practicalityPercent: 100 - (a + 1) * 50,
        wisdomPercent: (b + 1) * 50,
        knowledgePercent: 100 - (b + 1) * 50,
        stabilityPercent: s * 100,
        coveragePercent: yCoverage * 100,
      },
      diagnostics: {
        empathyPracticality,
        wisdomKnowledge,
        epistemicStability,
        semanticGrid: cloneJSON(supportSummary),
        gateStates: cloneJSON(this.state.gateStates),
        profileState: cloneJSON(this.state.profileState),
      },
    };
  }

  static projectSemanticTriple(a, s, b, options = {}) {
    const epsilon = options.epsilon ?? 1e-9;
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
      },
    };
  }

  axisText(value, axisKey) {
    const numeric = Number(value) || 0;
    const threshold = Number(this.config.summaryAxisFloor ?? 0.04);
    if (Math.abs(numeric) < threshold) return null;
    const labels = AXIS_LABELS[axisKey];
    const label = numeric >= 0 ? labels.positive : labels.negative;
    if (axisKey === "epistemicStability") return `${EpistemicProfiler.formatSigned(numeric)} ${label}`;
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

    if (hasPositive && hasNegative && hasIntegration) {
      return `[${axisTag} active: ${labels.positive}/${labels.negative} tension handled]`;
    }
    if (hasPositive && hasNegative) {
      return `[${axisTag} active: ${labels.positive}/${labels.negative} both present]`;
    }
    if (hasPositive) return `[${axisTag} active: ${labels.positive} present]`;
    if (hasNegative) return `[${axisTag} active: ${labels.negative} present]`;
    if (hasIntegration) return `[${axisTag} active: integrated tension]`;
    return null;
  }

  buildAggregateProfileLine(semantics = {}, diagnostics = {}) {
    const parts = [];
    const yText = this.axisText(semantics.s, "epistemicStability");
    const xText = this.axisText(semantics.a, "empathyPracticality");
    const zText = this.axisText(semantics.b, "wisdomKnowledge");
    const xActivityText = this.axisActivityText(diagnostics.empathyPracticality, "empathyPracticality");
    const zActivityText = this.axisActivityText(diagnostics.wisdomKnowledge, "wisdomKnowledge");

    if (yText) parts.push(yText);
    if (xText) parts.push(xText);
    if (zText) parts.push(zText);
    if (!xText && xActivityText) parts.push(xActivityText);
    if (!zText && zActivityText) parts.push(zActivityText);

    if (!parts.length) return "0.00 null-state | no active worldview threshold met";
    return `${parts.join(" ")} | compiled aggregate`;
  }

  buildSupportingNotes() {
    return dedupeLatestFirst([
      ...this.state.entries.flatMap((entry) => entry.notes || []),
      ...this.state.profileState.risk_notes,
    ]);
  }

  computePoint() {
    const semanticProfile = this.getSemanticProfile();
    const { a, b, s, yCoverage } = semanticProfile.semantics;
    const projection = EpistemicProfiler.projectSemanticTriple(a, s, b, { epsilon: this.config.epsilon });

    const denseTotals = semanticProfile.diagnostics.semanticGrid?.totals || {};
    const finalized = {
      model: semanticProfile.model,
      profile: [this.buildAggregateProfileLine(semanticProfile.semantics, semanticProfile.diagnostics)],
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
            scope_strength: entry.scope_strength,
            profiler_mode: entry.profiler_mode,
          })),
        },
        math: {
          formulas: {
            axisAggregation: String.raw`a = \operatorname{clamp}\left(\frac{(E - P) \cdot (1 - I_x)}{S_x}, -1, 1\right),\quad b = \operatorname{clamp}\left(\frac{(W - K) \cdot (1 - I_z)}{S_z}, -1, 1\right)`,
            integrationSaturation: String.raw`I_x = \frac{X_{integration}}{X_{integration} + k},\quad I_z = \frac{Z_{integration}}{Z_{integration} + k}`,
            yEstimate: String.raw`y_{local} = \operatorname{clamp}\left(\frac{Y_{+} - Y_{-} + \alpha(B_x I_x + B_z I_z) - \beta(|E-P|(1-I_x) + |W-K|(1-I_z)) - C}{S_y}, -1, 1\right)`,
            yFinal: String.raw`y_{estimate} = \operatorname{clamp}(y_{local} + gate_{bonus} - gate_{penalty}, -1, 1)`,
            yCoverage: String.raw`y_{coverage} = \max(gate\_coverage, grid\_coverage)`,
            projection: String.raw`(x,y,z) = \frac{(a,s,b)}{|a| + |s| + |b|}\;\text{when}\;|a| + |s| + |b| > 0`,
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
            empathySupport: denseTotals.empathy || 0,
            practicalitySupport: denseTotals.practicality || 0,
            wisdomSupport: denseTotals.wisdom || 0,
            knowledgeSupport: denseTotals.knowledge || 0,
            xIntegrationSupport: denseTotals.x_integration || 0,
            zIntegrationSupport: denseTotals.z_integration || 0,
            yPositiveSupport: denseTotals.y_positive || 0,
            yNegativeSupport: denseTotals.y_negative || 0,
            semanticMagnitude: projection.debug.magnitude,
            projectedManhattan: projection.debug.manhattan ?? 0,
          },
          sources: {
            entryCount: this.state.entries.length,
            evidenceCount: this.getAllEvidence().length,
            compactSignalCount: this.getAllCompactSignals().length,
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
