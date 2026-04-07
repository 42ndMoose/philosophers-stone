
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
});

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
      underSpecifiedPositiveXSeedScale: 0.25,
      underSpecifiedPositiveZSeedScale: 0.35,
      underSpecifiedNegativeXSeedScale: 0.15,
      underSpecifiedNegativeZSeedScale: 0.2,
      underSpecifiedSeedCap: 0.12,
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

  normalizePayload(payload = {}) {
    if (!payload || typeof payload !== "object") {
      throw new Error("LLM payload must be an object");
    }
    const display_profile_lines = cleanStringList(payload.profile || []);
    const notes = cleanStringList(payload.notes || []);
    const analysis_scope = this.inferScope(payload);
    const scope_strength = this.inferScopeStrength(analysis_scope, payload);
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
    return {
      model: cleanString(payload.model) || "epistemic_octahedron_interpreter_v2",
      profiler_mode: cleanString(payload.profiler_mode) || "dense_support_v1",
      display_profile_lines,
      notes,
      analysis_scope,
      scope_strength,
      statement_modes: cleanStringList(payload.statement_modes || []),
      semantic_grid: this.normalizeSemanticGrid(payload.semantic_grid || {}),
      axis_events,
      local_y_positive_signals,
      local_y_negative_signals,
      triggered_gate_events,
      local_extraction,
      profile_update_signals,
      compactSignals: compact.compactSignals,
      invalidGateEvents: normalizedGateResult.rejected,
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
    const hasSignals =
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
    const scopeWeight = this.scopeWeight(entry.analysis_scope) * this.scopeStrengthWeight(entry.scope_strength);
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

  semanticContribution(entry) {
    const scopeMultiplier = this.scopeWeight(entry.analysis_scope) * this.scopeStrengthWeight(entry.scope_strength);
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
    for (const key of Object.keys(out)) {
      const field = grid[key] || { support: 0, confidence: 0 };
      out[key] += Number(field.support || 0) * Number(field.confidence || 0) * scopeMultiplier;
    }

    const axisMap = {
      x_pole_evidence: { positive: "empathy", negative: "practicality" },
      z_pole_evidence: { positive: "wisdom", negative: "knowledge" },
    };

    for (const item of entry.axis_events.x_pole_evidence || []) {
      const value = this.strengthWeight(item.strength) * Number(item.confidence || 0) * scopeMultiplier;
      if (cleanString(item.pole).toLowerCase() === "empathy") out.empathy = Math.max(out.empathy, value);
      if (cleanString(item.pole).toLowerCase() === "practicality") out.practicality = Math.max(out.practicality, value);
    }
    for (const item of entry.axis_events.z_pole_evidence || []) {
      const value = this.strengthWeight(item.strength) * Number(item.confidence || 0) * scopeMultiplier;
      if (cleanString(item.pole).toLowerCase() === "wisdom") out.wisdom = Math.max(out.wisdom, value);
      if (cleanString(item.pole).toLowerCase() === "knowledge") out.knowledge = Math.max(out.knowledge, value);
    }
    for (const item of entry.axis_events.x_integration_events || []) {
      const value = this.strengthWeight(item.strength) * Number(item.confidence || 0) * scopeMultiplier;
      out.x_integration = Math.max(out.x_integration, value);
    }
    for (const item of entry.axis_events.z_integration_events || []) {
      const value = this.strengthWeight(item.strength) * Number(item.confidence || 0) * scopeMultiplier;
      out.z_integration = Math.max(out.z_integration, value);
    }
    for (const signal of entry.local_y_positive_signals || []) {
      const value = this.strengthWeight(signal.strength) * Number(signal.confidence || 0) * scopeMultiplier * this.localYSignalWeight(signal);
      out.y_positive = Math.max(out.y_positive, value);
    }
    for (const signal of entry.local_y_negative_signals || []) {
      const value = this.strengthWeight(signal.strength) * Number(signal.confidence || 0) * scopeMultiplier * this.localYSignalWeight(signal);
      out.y_negative = Math.max(out.y_negative, value);
    }
    return out;
  }

  aggregateSemanticGrid() {
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
    for (const entry of this.state.entries) {
      const part = this.semanticContribution(entry);
      for (const key of Object.keys(totals)) totals[key] += part[key];
      contradictionPenalty += this.contradictionPenaltyForEntry(entry);
    }
    return { totals, contradictionPenalty };
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

    let a = xPoleMass <= this.config.epsilon ? 0 :
      EpistemicProfiler.clamp(
        (xPoleDelta * (1 - xIntegrationRatio * this.config.integrationInfluence)) /
          (this.config.axisSaturation.empathyPracticality || 2.5),
        -1,
        1,
      );

    let b = zPoleMass <= this.config.epsilon ? 0 :
      EpistemicProfiler.clamp(
        (zPoleDelta * (1 - zIntegrationRatio * this.config.integrationInfluence)) /
          (this.config.axisSaturation.wisdomKnowledge || 2.5),
        -1,
        1,
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

  aggregateYFromDense(totals, contradictionPenalty, lateral) {
    const PY = totals.y_positive;
    const NY = totals.y_negative;

    const integrationBonus = lateral.xBalance * lateral.IX + lateral.zBalance * lateral.IZ;
    const unresolvedPenalty =
      Math.abs(lateral.xPoleDelta) * (1 - lateral.IX) * 0.35 +
      Math.abs(lateral.zPoleDelta) * (1 - lateral.IZ) * 0.35;

    const localBase = EpistemicProfiler.clamp(
      (PY - NY + integrationBonus - unresolvedPenalty - contradictionPenalty * this.config.contradictionPenaltyScale) /
        (this.config.axisSaturation.epistemicStability || 2.5),
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

    let s = EpistemicProfiler.clamp(
      localBase +
        this.config.positiveGateInfluence * weightedMeanPositiveGateScores -
        this.config.negativeGateInfluence * weightedMeanNegativeGateScores,
      -1,
      1,
    );

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
      gateEventCount,
      seedInfo,
    };
  }

  getSemanticProfile() {
    const { totals, contradictionPenalty } = this.aggregateSemanticGrid();
    const lateral = this.aggregateLateralFromDense(totals);
    const yData = this.aggregateYFromDense(totals, contradictionPenalty, lateral);

    let a = lateral.a;
    let b = lateral.b;
    let s = yData.s;

    if (yData.seedInfo) {
      if (Math.abs(a) <= this.config.epsilon) a = yData.seedInfo.a;
      if (Math.abs(b) <= this.config.epsilon) b = yData.seedInfo.b;
    }

    return {
      model: "epistemic_octahedron_profiler_v7",
      semantics: {
        a,
        b,
        s,
        yEstimate: s,
        yCoverage: yData.yCoverage,
      },
      uiLike: {
        empathyPercent: (a + 1) * 50,
        practicalityPercent: 100 - (a + 1) * 50,
        wisdomPercent: (b + 1) * 50,
        knowledgePercent: 100 - (b + 1) * 50,
        stabilityPercent: s * 100,
        coveragePercent: yData.yCoverage * 100,
      },
      diagnostics: {
        totals,
        contradictionPenalty,
        lateral,
        epistemicStability: yData,
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

  buildSupportingNotes() {
    const semanticProfile = this.getSemanticProfile();
    const notes = [];
    const seedInfo = semanticProfile.diagnostics?.epistemicStability?.seedInfo;
    if (seedInfo) {
      notes.push(`deterministic fallback applied: ${seedInfo.reason}`);
    }
    for (const entry of this.state.entries) {
      notes.push(...cleanStringList(entry.notes || []));
    }
    notes.push(...this.state.profileState.risk_notes);
    return dedupeLatestFirst(notes);
  }

  computePoint() {
    const semanticProfile = this.getSemanticProfile();
    const { a, b, s, yCoverage } = semanticProfile.semantics;
    const projection = EpistemicProfiler.projectSemanticTriple(a, s, b, { epsilon: this.config.epsilon });
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
          })),
        },
        math: {
          formulas: {
            axisAggregation:
              String.raw`a = clamp(((E - P) * (1 - \rho_x \lambda_I))/\sigma_x, -1, 1),\quad b = clamp(((W - K) * (1 - \rho_z \lambda_I))/\sigma_z, -1, 1)`,
            yEstimate:
              String.raw`s = clamp((Y^+ - Y^- + B_I - P_U - \alpha C)/\sigma_y + \beta G^+ - \gamma G^-, -1, 1)`,
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
