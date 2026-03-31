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
});


const DEFAULT_AXIS_TIE_BREAK_INFLUENCE = 0.35;

const AXIS_TIE_BREAK_KEYWORDS = {
  empathyPracticality: {
    positive: [
      ["empathy", 2.0],
      ["compassion", 1.8],
      ["kindness", 1.4],
      ["comfort", 1.2],
      ["feelings", 1.1],
      ["relational", 1.1],
      ["care", 1.0],
      ["mercy", 1.2],
      ["humane", 1.2],
      ["fairness", 0.8],
      ["bullied", 1.0],
      ["harm", 0.8],
      ["protect", 0.6],
    ],
    negative: [
      ["practical", 1.8],
      ["practicality", 2.0],
      ["health", 1.7],
      ["health failure", 2.0],
      ["outcome", 1.2],
      ["outcomes", 1.2],
      ["feasible", 1.1],
      ["feasibility", 1.3],
      ["logistics", 1.2],
      ["consequence", 1.3],
      ["consequences", 1.3],
      ["long-term", 1.3],
      ["utility", 1.1],
      ["viability", 1.4],
      ["survival", 1.5],
      ["reality", 1.0],
      ["teachable", 0.9],
      ["criticism", 0.7],
    ],
  },
  wisdomKnowledge: {
    positive: [
      ["wisdom", 2.0],
      ["synthesis", 1.7],
      ["proportion", 1.4],
      ["context", 1.2],
      ["judgment", 1.3],
      ["insight", 1.2],
      ["broader", 1.0],
      ["all things considered", 1.8],
      ["coexist", 1.1],
      ["dialogue", 0.9],
      ["mature", 0.9],
      ["integrated", 1.2],
      ["collective conscience", 1.0],
      ["conscience", 0.7],
    ],
    negative: [
      ["knowledge", 2.0],
      ["literal", 1.2],
      ["observation", 1.1],
      ["facts", 1.2],
      ["fact", 1.2],
      ["data", 1.1],
      ["precision", 1.0],
      ["technical", 1.1],
      ["information", 1.2],
      ["pattern", 1.0],
      ["patterns", 1.0],
      ["detail", 0.9],
      ["details", 0.9],
    ],
  },
};

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

function escapeRegex(text) {
  return String(text || "").replace(/[-\/\^$*+?.()|[\]{}]/g, "\\$&");
}

function keywordWeightFromText(value, weightedTerms = []) {
  const hay = ` ${String(value || "").toLowerCase()} `;
  let total = 0;
  for (const [term, weight] of weightedTerms) {
    const pattern = new RegExp(`\\b${escapeRegex(term)}\\b`, "g");
    const matches = hay.match(pattern);
    if (matches?.length) total += matches.length * Number(weight || 0);
  }
  return total;
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

function pickNormalizedText(item) {
  return cleanString(
    item?.normalized || item?.text || item?.value || item?.note || item?.reason || item,
  );
}

export class EpistemicProfiler {
  constructor(options = {}) {
    this.config = {
      strengthWeights: { ...DEFAULT_STRENGTH_WEIGHTS },
      scopeWeights: { ...DEFAULT_SCOPE_WEIGHTS },
      gateWeights: { ...DEFAULT_GATE_WEIGHTS },
      localYSignalWeights: cloneJSON(DEFAULT_LOCAL_Y_SIGNAL_WEIGHTS),
      axisSaturation: {
        empathyPracticality: 2.5,
        wisdomKnowledge: 2.5,
        epistemicStability: 2.5,
      },
      compactSignalScale: 0.65,
      integrationInfluence: 0.35,
      positiveGateInfluence: 0.35,
      negativeGateInfluence: 0.45,
      contradictionPenaltyScale: 0.22,
      softNegativeSignalScale: 0.4,
      hardNegativeSignalScale: 1.0,
      gateDerivedSignalScale: 1.0,
      gateToLocalSignalMap: cloneJSON(DEFAULT_GATE_TO_LOCAL_SIGNAL_MAP),
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
      practicality: {
        axis: "empathyPracticality",
        direction: "practicality",
        sign: -1,
      },
      wisdom: { axis: "wisdomKnowledge", direction: "wisdom", sign: 1 },
      knowledge: { axis: "wisdomKnowledge", direction: "knowledge", sign: -1 },
      stability: {
        axis: "epistemicStability",
        direction: "positive",
        sign: 1,
      },
      instability: {
        axis: "epistemicStability",
        direction: "negative",
        sign: -1,
      },
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
      const hasExplicitStrength = cleanString(item.strength).length > 0;
      const hasExplicitConfidence = item.confidence !== undefined && item.confidence !== null && `${item.confidence}` !== "";
      return {
        ...item,
        strength: cleanString(item.strength).toLowerCase() || "moderate",
        confidence: EpistemicProfiler.clamp(Number(item.confidence ?? 1), 0, 1),
        evidence_span: normalizeEvidenceSpan(item.evidence_span || item.excerpt || item.reason),
        _strength_explicit: hasExplicitStrength,
        _confidence_explicit: hasExplicitConfidence,
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
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const gate = cleanString(item.gate);
        if (!gate || !(gate in this.state.gateStates)) return null;
        const direction = cleanString(item.direction).toLowerCase();
        if (!["positive", "negative"].includes(direction)) return null;
        return {
          gate,
          direction,
          strength: cleanString(item.strength).toLowerCase() || "moderate",
          confidence: EpistemicProfiler.clamp(Number(item.confidence ?? 1), 0.5, 1),
          novelty: EpistemicProfiler.clamp(Number(item.novelty ?? 1), 0, 1),
          evidence_span: normalizeEvidenceSpan(item.evidence_span || item.reason),
          scope: cleanString(item.scope),
        };
      })
      .filter(Boolean);
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
          xIntegration.push({
            type: "integrated_tension",
            strength,
            confidence,
            evidence_span: evidenceSpan,
          });
        }
      }

      if (axis === "wisdomKnowledge") {
        if (direction === "wisdom" || direction === "knowledge") {
          zPole.push({ pole: direction, strength, confidence, evidence_span: evidenceSpan });
        } else if (direction === "mixed") {
          zIntegration.push({
            type: "integrated_tension",
            strength,
            confidence,
            evidence_span: evidenceSpan,
          });
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
        axis_events.x_pole_evidence.push({
          pole: signal.direction,
          strength,
          confidence,
          evidence_span: signal.source,
        });
      } else if (signal.axis === "wisdomKnowledge") {
        axis_events.z_pole_evidence.push({
          pole: signal.direction,
          strength,
          confidence,
          evidence_span: signal.source,
        });
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

    return {
      compactSignals,
      axis_events,
      local_y_positive_signals,
      local_y_negative_signals,
    };
  }

  gateEventsFromProfileUpdates(profile_update_signals = {}, explicitGateEvents = []) {
    const out = [];
    const explicitKeys = new Set(
      (Array.isArray(explicitGateEvents) ? explicitGateEvents : [])
        .map((item) => {
          const gate = cleanString(item?.gate);
          const direction = cleanString(item?.direction).toLowerCase();
          return gate && direction ? `${gate}::${direction}` : "";
        })
        .filter(Boolean),
    );

    const buildFallbackEvent = (item, direction) => {
      const gate = cleanString(item?.gate || item?.name || item);
      if (!(gate in this.state.gateStates)) return null;
      if (explicitKeys.has(`${gate}::${direction}`)) return null;
      return {
        gate,
        direction,
        strength: cleanString(item?.strength).toLowerCase() || "weak",
        confidence: EpistemicProfiler.clamp(Number(item?.confidence ?? 0.65), 0.5, 1),
        novelty: EpistemicProfiler.clamp(Number(item?.novelty ?? 0.5), 0, 1),
        evidence_span: normalizeEvidenceSpan(item?.evidence_span || item?.reason),
      };
    };

    for (const item of Array.isArray(profile_update_signals.cleared_gates)
      ? profile_update_signals.cleared_gates
      : []) {
      const event = buildFallbackEvent(item, "positive");
      if (event) out.push(event);
    }
    for (const item of Array.isArray(profile_update_signals.failed_gates)
      ? profile_update_signals.failed_gates
      : []) {
      const event = buildFallbackEvent(item, "negative");
      if (event) out.push(event);
    }
    return out;
  }

  payloadHasStructuredScorableSignals(payload = {}) {
    const axisEvents = payload.axis_events || {};
    const localExtraction = payload.local_extraction || {};
    const extractionKeys = [
      "principles",
      "boundaries",
      "claimed_values",
      "tradeoffs",
      "contradictions",
    ];

    return Boolean(
      (Array.isArray(payload.evidence) && payload.evidence.length) ||
        (Array.isArray(payload.triggered_gate_events) && payload.triggered_gate_events.length) ||
        (Array.isArray(payload.local_y_positive_signals) && payload.local_y_positive_signals.length) ||
        (Array.isArray(payload.local_y_negative_signals) && payload.local_y_negative_signals.length) ||
        (Array.isArray(axisEvents.x_pole_evidence) && axisEvents.x_pole_evidence.length) ||
        (Array.isArray(axisEvents.x_integration_events) && axisEvents.x_integration_events.length) ||
        (Array.isArray(axisEvents.z_pole_evidence) && axisEvents.z_pole_evidence.length) ||
        (Array.isArray(axisEvents.z_integration_events) && axisEvents.z_integration_events.length) ||
        extractionKeys.some((key) => Array.isArray(localExtraction[key]) && localExtraction[key].length),
    );
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

  deriveGateBackfilledLocalSignals(entry) {
    const out = { positive: [], negative: [] };
    const seen = {
      positive: new Set(
        (entry.local_y_positive_signals || [])
          .map((signal) => cleanString(signal?.signal_type).toLowerCase())
          .filter(Boolean),
      ),
      negative: new Set(
        (entry.local_y_negative_signals || [])
          .map((signal) => cleanString(signal?.signal_type).toLowerCase())
          .filter(Boolean),
      ),
    };

    for (const event of entry.triggered_gate_events || []) {
      const polarity = cleanString(event?.direction).toLowerCase();
      if (!["positive", "negative"].includes(polarity)) continue;
      const mappedSignal =
        this.config.gateToLocalSignalMap?.[polarity]?.[event.gate] ||
        DEFAULT_GATE_TO_LOCAL_SIGNAL_MAP?.[polarity]?.[event.gate];
      const signalType = cleanString(mappedSignal).toLowerCase();
      if (!signalType || seen[polarity].has(signalType)) continue;

      if (polarity === "negative" && entry.local_y_negative_signals?.length) {
        continue;
      }

      const confidence = EpistemicProfiler.clamp(
        Number(event.confidence ?? 1) * Number(this.config.gateDerivedSignalScale ?? 1),
        0,
        1,
      );

      out[polarity].push({
        polarity,
        signal_type: signalType,
        strength: cleanString(event.strength).toLowerCase() || "moderate",
        confidence,
        evidence_span: normalizeEvidenceSpan(event.evidence_span),
        derived_from_gate: event.gate,
      });
      seen[polarity].add(signalType);
    }

    return out;
  }

  buildFallbackProfileLine(entry) {
    const parts = [];
    const strongestY = [...entry.local_y_positive_signals, ...entry.local_y_negative_signals]
      .sort((a, b) => {
        const aValue = this.strengthWeight(a.strength) * (Number(a.confidence) || 1);
        const bValue = this.strengthWeight(b.strength) * (Number(b.confidence) || 1);
        return bValue - aValue;
      })[0];

    const strongestX = entry.axis_events.x_pole_evidence
      .slice()
      .sort((a, b) => {
        const aValue = this.strengthWeight(a.strength) * (Number(a.confidence) || 1);
        const bValue = this.strengthWeight(b.strength) * (Number(b.confidence) || 1);
        return bValue - aValue;
      })[0];

    const strongestZ = entry.axis_events.z_pole_evidence
      .slice()
      .sort((a, b) => {
        const aValue = this.strengthWeight(a.strength) * (Number(a.confidence) || 1);
        const bValue = this.strengthWeight(b.strength) * (Number(b.confidence) || 1);
        return bValue - aValue;
      })[0];

    if (strongestY) {
      const sign = strongestY.polarity === "negative" ? -1 : 1;
      parts.push(
        `${EpistemicProfiler.formatSigned(
          sign * this.strengthWeight(strongestY.strength) * (Number(strongestY.confidence) || 1),
        )} ${strongestY.polarity === "negative" ? "instability" : "stability"}`,
      );
    }
    if (strongestX) {
      const sign = strongestX.pole === "practicality" ? -1 : 1;
      parts.push(
        `${EpistemicProfiler.formatSigned(
          sign * this.strengthWeight(strongestX.strength) * (Number(strongestX.confidence) || 1),
        )} ${strongestX.pole}`,
      );
    }
    if (strongestZ) {
      const sign = strongestZ.pole === "knowledge" ? -1 : 1;
      parts.push(
        `${EpistemicProfiler.formatSigned(
          sign * this.strengthWeight(strongestZ.strength) * (Number(strongestZ.confidence) || 1),
        )} ${strongestZ.pole}`,
      );
    }

    if (!parts.length) return null;
    return `${parts.slice(0, 3).join(" ")} | synthesized from structured extraction`;
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
          axis_events: {
            x_pole_evidence: [],
            x_integration_events: [],
            z_pole_evidence: [],
            z_integration_events: [],
          },
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
    const profile_update_signals = this.normalizeProfileUpdateSignals(
      payload.profile_update_signals || {},
    );

    const explicitGateEvents = this.normalizeGateEvents(payload.triggered_gate_events || []);
    const triggered_gate_events = [
      ...explicitGateEvents,
      ...this.gateEventsFromProfileUpdates(profile_update_signals, explicitGateEvents),
    ];

    return {
      model: cleanString(payload.model) || "epistemic_octahedron_interpreter_v2",
      display_profile_lines,
      notes,
      analysis_scope,
      scope_strength,
      statement_modes: cleanStringList(payload.statement_modes || []),
      axis_events,
      local_y_positive_signals,
      local_y_negative_signals,
      triggered_gate_events,
      local_extraction,
      profile_update_signals,
      compactSignals: compact.compactSignals,
      legacyEvidence: Array.isArray(payload.evidence) ? cloneJSON(payload.evidence) : [],
    };
  }

  addLLMOutput(payload) {
    const entry = this.normalizePayload(payload);

    const hasSignals =
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
      throw new Error(
        "LLM payload must contain usable structured signals, compact profile signals, or extraction content.",
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
      riskNotes.push(
        `risk: ${type || "contradiction"}${severity ? ` (${severity})` : ""}`,
      );
    }

    for (const item of entry.profile_update_signals.introduced_contradictions) {
      const note = cleanString(item?.reason || item?.normalized || item);
      if (note) riskNotes.push(`risk: contradiction introduced | ${note}`);
    }

    profileState.risk_notes = dedupeLatestFirst([
      ...profileState.risk_notes,
      ...riskNotes,
    ]).slice(0, 18);
  }

  mergeGateEvents(entry) {
    const scopeWeight = this.scopeWeight(entry.analysis_scope);

    for (const event of entry.triggered_gate_events) {
      const gateState = this.state.gateStates[event.gate];
      if (!gateState) continue;

      const sign = event.direction === "negative" ? -1 : 1;
      const strengthValue = this.strengthWeight(event.strength);
      const gateWeight = this.gateWeight(event.gate);
      const confidence = EpistemicProfiler.clamp(Number(event.confidence ?? 1), 0.5, 1);
      const novelty = EpistemicProfiler.clamp(Number(event.novelty ?? 1), 0, 1);
      const baseDelta = sign * strengthValue * scopeWeight * gateWeight * confidence * novelty;
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


 axisContributionValue(item, scopeWeight) {
   const strength = this.strengthWeight(item?.strength);
   const confidence = EpistemicProfiler.clamp(Number(item?.confidence ?? 1), 0, 1);
   return strength * confidence * scopeWeight;
 }

 entryAxisTieBreakBias(entry, axisKey) {
   const keywordSet = AXIS_TIE_BREAK_KEYWORDS[axisKey];
   if (!keywordSet) {
     return { bias: 0, positiveScore: 0, negativeScore: 0, snippets: 0 };
   }

   const snippets = [];
   snippets.push(...cleanStringList(entry.display_profile_lines || []));
   snippets.push(...cleanStringList(entry.notes || []));

   for (const key of ["principles", "boundaries", "claimed_values", "tradeoffs", "contradictions"]) {
     for (const item of entry.local_extraction?.[key] || []) {
       snippets.push(...collectTextSnippets(item));
     }
   }

   const poleKey = axisKey === "empathyPracticality" ? "x_pole_evidence" : "z_pole_evidence";
   const integrationKey = axisKey === "empathyPracticality" ? "x_integration_events" : "z_integration_events";
   for (const item of entry.axis_events?.[poleKey] || []) {
     snippets.push(...collectTextSnippets(item));
   }
   for (const item of entry.axis_events?.[integrationKey] || []) {
     snippets.push(...collectTextSnippets(item));
   }

   const corpus = snippets.filter(Boolean).join("\n");
   if (!corpus.trim()) {
     return { bias: 0, positiveScore: 0, negativeScore: 0, snippets: 0 };
   }

   const positiveScore = keywordWeightFromText(corpus, keywordSet.positive);
   const negativeScore = keywordWeightFromText(corpus, keywordSet.negative);
   const total = positiveScore + negativeScore;
   const bias = total > 0 ? (positiveScore - negativeScore) / total : 0;
   return {
     bias: EpistemicProfiler.clamp(bias, -1, 1),
     positiveScore,
     negativeScore,
     snippets: snippets.length,
   };
 }

  aggregateLateralAxis(axisKey) {
    const poleKey = axisKey === "empathyPracticality" ? "x_pole_evidence" : "z_pole_evidence";
    const integrationKey =
      axisKey === "empathyPracticality" ? "x_integration_events" : "z_integration_events";
    const positivePole = axisKey === "empathyPracticality" ? "empathy" : "wisdom";
    const negativePole = axisKey === "empathyPracticality" ? "practicality" : "knowledge";

    let positiveTotal = 0;
    let negativeTotal = 0;
    let integrationTotal = 0;
    let sourceCount = 0;
    let explicitPoleWeightCount = 0;
    let defaultedPoleWeightCount = 0;
    let explicitBalanceCount = 0;
    let tieBiasAccumulator = 0;
    let tieBiasWeight = 0;
    let tieBreakPositiveScore = 0;
    let tieBreakNegativeScore = 0;

    for (const entry of this.state.entries) {
      const scopeWeight = this.scopeWeight(entry.analysis_scope);
      let entryHasPositive = false;
      let entryHasNegative = false;

      for (const item of entry.axis_events[poleKey] || []) {
        const value = this.axisContributionValue(item, scopeWeight);
        const pole = cleanString(item.pole).toLowerCase();
        if (pole === positivePole) {
          positiveTotal += value;
          entryHasPositive = true;
        }
        if (pole === negativePole) {
          negativeTotal += value;
          entryHasNegative = true;
        }
        if (item._strength_explicit || item._confidence_explicit) explicitPoleWeightCount += 1;
        else defaultedPoleWeightCount += 1;
        sourceCount += 1;
      }

      for (const item of entry.axis_events[integrationKey] || []) {
        integrationTotal += this.axisContributionValue(item, scopeWeight);
        if (cleanString(item.type).toLowerCase() === "explicit_balance") explicitBalanceCount += 1;
        sourceCount += 1;
      }

      for (const signal of entry.compactSignals || []) {
        if (signal.axis !== axisKey) continue;
        const value = Number(signal.value);
        if (!Number.isFinite(value)) continue;
        const weight = Math.abs(value) * this.config.compactSignalScale;
        if (weight <= 0) continue;
        if (value >= 0) positiveTotal += weight;
        else negativeTotal += weight;
        sourceCount += 1;
      }

      if (entryHasPositive && entryHasNegative) {
        const tieBreak = this.entryAxisTieBreakBias(entry, axisKey);
        if (Math.abs(tieBreak.bias) > this.config.epsilon) {
          tieBiasAccumulator += tieBreak.bias * scopeWeight;
          tieBiasWeight += scopeWeight;
          tieBreakPositiveScore += tieBreak.positiveScore;
          tieBreakNegativeScore += tieBreak.negativeScore;
        }
      }
    }

    const poleMagnitude = positiveTotal + negativeTotal;
    const saturation = this.config.axisSaturation[axisKey] ?? 2.5;
    const integrationRatio = poleMagnitude + integrationTotal > 0
      ? integrationTotal / (poleMagnitude + integrationTotal)
      : 0;

    let poleDelta = positiveTotal - negativeTotal;
    const defaultWeightedBalance =
      poleMagnitude > this.config.epsilon &&
      positiveTotal > this.config.epsilon &&
      negativeTotal > this.config.epsilon &&
      Math.abs(poleDelta) <= this.config.epsilon &&
      explicitPoleWeightCount === 0;

    let tieBreakApplied = false;
    let tieBreakBias = 0;
    let tieBreakDelta = 0;
    if (defaultWeightedBalance && explicitBalanceCount === 0 && tieBiasWeight > this.config.epsilon) {
      tieBreakBias = EpistemicProfiler.clamp(tieBiasAccumulator / tieBiasWeight, -1, 1);
      tieBreakDelta =
        tieBreakBias * poleMagnitude * (this.config.axisTieBreakInfluence ?? DEFAULT_AXIS_TIE_BREAK_INFLUENCE);
      if (Math.abs(tieBreakDelta) > this.config.epsilon) {
        poleDelta += tieBreakDelta;
        tieBreakApplied = true;
      }
    }

    const moderatedDelta = poleDelta * (1 - integrationRatio * this.config.integrationInfluence);
    const raw = poleMagnitude <= this.config.epsilon
      ? 0
      : EpistemicProfiler.clamp(moderatedDelta / saturation, -1, 1);

    return {
      axis: axisKey,
      raw,
      positiveTotal,
      negativeTotal,
      integrationTotal,
      integrationRatio,
      poleMagnitude,
      poleDelta,
      moderatedDelta,
      saturation,
      sourceCount,
      explicitPoleWeightCount,
      defaultedPoleWeightCount,
      explicitBalanceCount,
      defaultWeightedBalance,
      tieBreakApplied,
      tieBreakBias,
      tieBreakDelta,
      tieBreakPositiveScore,
      tieBreakNegativeScore,
    };
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

  aggregateY() {
    let positiveSum = 0;
    let softNegativeSum = 0;
    let hardNegativeSum = 0;
    let contradictionPenalty = 0;
    let positiveSignalCount = 0;
    let negativeSignalCount = 0;
    let derivedPositiveSignalCount = 0;
    let derivedNegativeSignalCount = 0;

    for (const entry of this.state.entries) {
      const scopeWeight = this.scopeWeight(entry.analysis_scope);
      contradictionPenalty += this.contradictionPenaltyForEntry(entry);

      const derivedSignals = this.deriveGateBackfilledLocalSignals(entry);
      const positiveSignals = [
        ...(entry.local_y_positive_signals || []),
        ...(derivedSignals.positive || []),
      ];
      const negativeSignals = [
        ...(entry.local_y_negative_signals || []),
        ...(derivedSignals.negative || []),
      ];

      derivedPositiveSignalCount += (derivedSignals.positive || []).length;
      derivedNegativeSignalCount += (derivedSignals.negative || []).length;

      for (const signal of positiveSignals) {
        positiveSum +=
          this.axisContributionValue(signal, scopeWeight) * this.localYSignalWeight(signal);
        positiveSignalCount += 1;
      }
      for (const signal of negativeSignals) {
        const weightedValue =
          this.axisContributionValue(signal, scopeWeight) * this.localYSignalWeight(signal);
        if (this.isSoftNegativeSignal(signal)) {
          softNegativeSum += weightedValue;
        } else {
          hardNegativeSum += weightedValue;
        }
        negativeSignalCount += 1;
      }
    }

    const effectiveNegativeSum =
      softNegativeSum * Number(this.config.softNegativeSignalScale ?? 1) +
      hardNegativeSum * Number(this.config.hardNegativeSignalScale ?? 1);

    const saturation = this.config.axisSaturation.epistemicStability ?? 2.5;
    const local_y_base = EpistemicProfiler.clamp(
      (positiveSum - effectiveNegativeSum - contradictionPenalty * this.config.contradictionPenaltyScale) /
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
      if (data.positive_events || data.negative_events) {
        weightedCoveredSum += weight;
      }
      gateEventCount += data.positive_events + data.negative_events;
      if (data.score > 0) {
        weightedPositiveScoreSum += weight * data.score;
        weightedPositiveGateWeight += weight;
      } else if (data.score < 0) {
        weightedNegativeScoreSum += weight * Math.abs(data.score);
        weightedNegativeGateWeight += weight;
      }
    }

    const weightedMeanPositiveGateScores = weightedPositiveGateWeight > 0
      ? weightedPositiveScoreSum / weightedPositiveGateWeight
      : 0;
    const weightedMeanNegativeGateScores = weightedNegativeGateWeight > 0
      ? weightedNegativeScoreSum / weightedNegativeGateWeight
      : 0;

    const persistent_gate_bonus = this.config.positiveGateInfluence * weightedMeanPositiveGateScores;
    const persistent_gate_penalty = this.config.negativeGateInfluence * weightedMeanNegativeGateScores;

    const y_estimate = EpistemicProfiler.clamp(
      local_y_base + persistent_gate_bonus - persistent_gate_penalty,
      -1,
      1,
    );

    const y_coverage = gateWeightsTotal > 0 ? weightedCoveredSum / gateWeightsTotal : 0;

    return {
      axis: "epistemicStability",
      raw: y_estimate,
      y_estimate,
      y_coverage,
      local_y_base,
      positiveSum,
      softNegativeSum,
      hardNegativeSum,
      negativeSum: effectiveNegativeSum,
      contradictionPenalty,
      persistent_gate_bonus,
      persistent_gate_penalty,
      weightedMeanPositiveGateScores,
      weightedMeanNegativeGateScores,
      positiveSignalCount,
      negativeSignalCount,
      derivedPositiveSignalCount,
      derivedNegativeSignalCount,
      gateEventCount,
    };
  }

  getSemanticProfile() {
    const empathyPracticality = this.aggregateLateralAxis("empathyPracticality");
    const wisdomKnowledge = this.aggregateLateralAxis("wisdomKnowledge");
    const epistemicStability = this.aggregateY();

    const a = empathyPracticality.raw;
    const b = wisdomKnowledge.raw;
    const s = epistemicStability.y_estimate;
    const yCoverage = epistemicStability.y_coverage;

    return {
      model: "epistemic_octahedron_profiler_v6",
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
      return `[${axisTag} active: ${labels.positive}/${labels.negative} balance]`;
    }
    if (hasPositive) {
      return `[${axisTag} active: ${labels.positive} present]`;
    }
    if (hasNegative) {
      return `[${axisTag} active: ${labels.negative} present]`;
    }
    if (hasIntegration) {
      return `[${axisTag} active: integrated tension]`;
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
  const axisNotes = [];
  for (const axis of [semanticProfile.diagnostics?.empathyPracticality, semanticProfile.diagnostics?.wisdomKnowledge]) {
    if (!axis) continue;
    if (axis.defaultWeightedBalance) {
      const label = axis.axis === "empathyPracticality" ? "X" : "Z";
      if (axis.tieBreakApplied) {
        axisNotes.push(
          `${label} axis tie-broken from under-specified opposing poles using local extraction text.`,
        );
      } else {
        axisNotes.push(
          `${label} axis opposing poles arrived with equal default weights and no explicit balance weighting.`,
        );
      }
    }
  }
  return dedupeLatestFirst([
    ...this.state.entries.flatMap((entry) => entry.notes || []),
    ...this.state.profileState.risk_notes,
    ...axisNotes,
  ]);
}

  computePoint() {
    const semanticProfile = this.getSemanticProfile();
    const { a, b, s, yCoverage } = semanticProfile.semantics;
    const projection = EpistemicProfiler.projectSemanticTriple(a, s, b, {
      epsilon: this.config.epsilon,
    });

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
            axisAggregation:
              String.raw`axis\_raw = \operatorname{clamp}\left(\frac{(positive\_pole - negative\_pole) \times (1 - integration\_ratio \times integration\_influence)}{saturation}, -1, 1\right)`,
            yEstimate:
              String.raw`y\_{estimate} = \operatorname{clamp}(local\_y\_base + persistent\_gate\_bonus - persistent\_gate\_penalty, -1, 1)`,
            yCoverage:
              String.raw`y\_{coverage} = \frac{\sum gate\_weights\_{covered}}{\sum gate\_weights\_{all}}`,
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
