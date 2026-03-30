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

export class EpistemicProfiler {
  constructor(options = {}) {
    this.config = {
      strengthWeights: { ...DEFAULT_STRENGTH_WEIGHTS },
      scopeWeights: { ...DEFAULT_SCOPE_WEIGHTS },
      gateWeights: { ...DEFAULT_GATE_WEIGHTS },
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
      epsilon: 1e-9,
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
    if (!Number.isFinite(num)) return `+.${"0".repeat(Math.max(0, digits))}`;
    const sign = num >= 0 ? "+" : "-";
    return `${sign}${Math.abs(num).toFixed(digits)}`;
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

  static signFromDirection(axis, direction) {
    const map = {
      empathyPracticality: {
        empathy: 1,
        practicality: -1,
        mixed: 0,
        unclear: 0,
      },
      wisdomKnowledge: {
        wisdom: 1,
        knowledge: -1,
        mixed: 0,
        unclear: 0,
      },
      epistemicStability: {
        positive: 1,
        negative: -1,
        mixed: 0,
        unclear: 0,
      },
    };

    if (!map[axis]) {
      throw new Error(`Unknown axis: ${axis}`);
    }
    if (!(direction in map[axis])) {
      throw new Error(`Invalid direction "${direction}" for axis "${axis}"`);
    }
    return map[axis][direction];
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

  static parseCompactProfileSignals(lines = []) {
    const values = Array.isArray(lines) ? lines : [lines];
    const signals = [];

    for (const rawLine of values) {
      const line = cleanString(rawLine);
      if (!line) continue;

      const regex = /([+-](?:\d+(?:\.\d+)?|\.\d+))\s+(stability|instability|empathy|practicality|wisdom|knowledge)\b/gi;
      for (const match of line.matchAll(regex)) {
        const magnitude = Math.abs(Number(match[1]));
        const labelInfo = EpistemicProfiler.axisDirectionFromProfileLabel(match[2]);
        if (!labelInfo || !Number.isFinite(magnitude)) continue;

        signals.push({
          axis: labelInfo.axis,
          direction: labelInfo.direction,
          label: String(match[2]).toLowerCase(),
          value: EpistemicProfiler.clamp(magnitude * labelInfo.sign, -1, 1),
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
        const strength = cleanString(item.strength).toLowerCase() || "moderate";
        const confidence = EpistemicProfiler.clamp(Number(item.confidence ?? 1), 0, 1);
        return {
          ...item,
          strength,
          confidence,
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
        const strength = cleanString(item.strength).toLowerCase() || "moderate";
        const confidence = EpistemicProfiler.clamp(Number(item.confidence ?? 1), 0, 1);
        return {
          ...item,
          polarity: cleanString(item.polarity).toLowerCase() || fallbackPolarity,
          signal_type: cleanString(item.signal_type).toLowerCase() || `legacy_${fallbackPolarity}`,
          strength,
          confidence,
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

  normalizeLegacyEvidence(evidence = [], scope) {
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
      scope,
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

  gateEventsFromProfileUpdates(profile_update_signals = {}) {
    const out = [];
    for (const item of Array.isArray(profile_update_signals.cleared_gates)
      ? profile_update_signals.cleared_gates
      : []) {
      const gate = cleanString(item?.gate || item?.name || item);
      if (!(gate in this.state.gateStates)) continue;
      out.push({
        gate,
        direction: "positive",
        strength: cleanString(item?.strength).toLowerCase() || "moderate",
        confidence: EpistemicProfiler.clamp(Number(item?.confidence ?? 0.8), 0.5, 1),
        novelty: EpistemicProfiler.clamp(Number(item?.novelty ?? 1), 0, 1),
        evidence_span: normalizeEvidenceSpan(item?.evidence_span || item?.reason),
      });
    }
    for (const item of Array.isArray(profile_update_signals.failed_gates)
      ? profile_update_signals.failed_gates
      : []) {
      const gate = cleanString(item?.gate || item?.name || item);
      if (!(gate in this.state.gateStates)) continue;
      out.push({
        gate,
        direction: "negative",
        strength: cleanString(item?.strength).toLowerCase() || "moderate",
        confidence: EpistemicProfiler.clamp(Number(item?.confidence ?? 0.8), 0.5, 1),
        novelty: EpistemicProfiler.clamp(Number(item?.novelty ?? 1), 0, 1),
        evidence_span: normalizeEvidenceSpan(item?.evidence_span || item?.reason),
      });
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
        `${EpistemicProfiler.formatSigned(sign * this.strengthWeight(strongestY.strength) * (Number(strongestY.confidence) || 1))} ${
          strongestY.polarity === "negative" ? "instability" : "stability"
        }`,
      );
    }
    if (strongestX) {
      const sign = strongestX.pole === "practicality" ? -1 : 1;
      parts.push(
        `${EpistemicProfiler.formatSigned(sign * this.strengthWeight(strongestX.strength) * (Number(strongestX.confidence) || 1))} ${strongestX.pole}`,
      );
    }
    if (strongestZ) {
      const sign = strongestZ.pole === "knowledge" ? -1 : 1;
      parts.push(
        `${EpistemicProfiler.formatSigned(sign * this.strengthWeight(strongestZ.strength) * (Number(strongestZ.confidence) || 1))} ${strongestZ.pole}`,
      );
    }

    if (!parts.length) return null;
    return `${parts.slice(0, 3).join(" ")} | synthesized from structured extraction`;
  }

  normalizePayload(payload = {}) {
    if (!payload || typeof payload !== "object") {
      throw new Error("LLM payload must be an object");
    }

    const profile = cleanStringList(payload.profile || []);
    const notes = cleanStringList(payload.notes || []);
    const analysis_scope = this.inferScope(payload);
    const scope_strength = this.inferScopeStrength(analysis_scope, payload);

    const legacy = this.normalizeLegacyEvidence(payload.evidence || [], analysis_scope);
    const compact = this.normalizeCompactSignals(profile);

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

    const triggered_gate_events = [
      ...this.normalizeGateEvents(payload.triggered_gate_events || []),
      ...this.gateEventsFromProfileUpdates(profile_update_signals),
    ];

    return {
      model: cleanString(payload.model) || "epistemic_octahedron_interpreter_v2",
      profile,
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
        'LLM payload must contain usable structured signals, compact profile signals, or extraction content.',
      );
    }

    if (!entry.profile.length) {
      const fallback = this.buildFallbackProfileLine(entry);
      if (fallback) entry.profile = [fallback];
    }

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
      if (note) riskNotes.push(`risk: contradiction introduced${note ? ` | ${note}` : ""}`);
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
      if (sign > 0) {
        gateState.positive_events += 1;
      } else {
        gateState.negative_events += 1;
      }
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

    for (const entry of this.state.entries) {
      const scopeWeight = this.scopeWeight(entry.analysis_scope);

      for (const item of entry.axis_events[poleKey] || []) {
        const value = this.axisContributionValue(item, scopeWeight);
        if (cleanString(item.pole).toLowerCase() === positivePole) positiveTotal += value;
        if (cleanString(item.pole).toLowerCase() === negativePole) negativeTotal += value;
        sourceCount += 1;
      }

      for (const item of entry.axis_events[integrationKey] || []) {
        integrationTotal += this.axisContributionValue(item, scopeWeight);
        sourceCount += 1;
      }

      for (const signal of entry.compactSignals || []) {
        if (signal.axis !== axisKey) continue;
        const weight = Math.abs(Number(signal.value) || 0) * this.config.compactSignalScale;
        if (weight <= 0) continue;
        if ((Number(signal.value) || 0) >= 0) positiveTotal += weight;
        else negativeTotal += weight;
        sourceCount += 1;
      }
    }

    const poleMagnitude = positiveTotal + negativeTotal;
    const poleDelta = positiveTotal - negativeTotal;
    const saturation = this.config.axisSaturation[axisKey] ?? 2.5;
    const integrationRatio = poleMagnitude + integrationTotal > 0
      ? integrationTotal / (poleMagnitude + integrationTotal)
      : 0;
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
    let negativeSum = 0;
    let contradictionPenalty = 0;
    let positiveSignalCount = 0;
    let negativeSignalCount = 0;

    for (const entry of this.state.entries) {
      const scopeWeight = this.scopeWeight(entry.analysis_scope);
      contradictionPenalty += this.contradictionPenaltyForEntry(entry);

      for (const signal of entry.local_y_positive_signals || []) {
        positiveSum += this.axisContributionValue(signal, scopeWeight);
        positiveSignalCount += 1;
      }
      for (const signal of entry.local_y_negative_signals || []) {
        negativeSum += this.axisContributionValue(signal, scopeWeight);
        negativeSignalCount += 1;
      }
    }

    const saturation = this.config.axisSaturation.epistemicStability ?? 2.5;
    const local_y_base = EpistemicProfiler.clamp(
      (positiveSum - negativeSum - contradictionPenalty * this.config.contradictionPenaltyScale) /
        saturation,
      -1,
      1,
    );

    const gateWeightsTotal = Object.values(this.config.gateWeights).reduce((sum, value) => sum + value, 0);
    let weightedPositiveScoreSum = 0;
    let weightedNegativeScoreSum = 0;
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
      } else if (data.score < 0) {
        weightedNegativeScoreSum += weight * Math.abs(data.score);
      }
    }

    const weightedMeanPositiveGateScores = gateWeightsTotal > 0
      ? weightedPositiveScoreSum / gateWeightsTotal
      : 0;
    const weightedMeanNegativeGateScores = gateWeightsTotal > 0
      ? weightedNegativeScoreSum / gateWeightsTotal
      : 0;

    const persistent_gate_bonus =
      this.config.positiveGateInfluence * weightedMeanPositiveGateScores;
    const persistent_gate_penalty =
      this.config.negativeGateInfluence * weightedMeanNegativeGateScores;

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
      negativeSum,
      contradictionPenalty,
      persistent_gate_bonus,
      persistent_gate_penalty,
      weightedMeanPositiveGateScores,
      weightedMeanNegativeGateScores,
      positiveSignalCount,
      negativeSignalCount,
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
      model: "epistemic_octahedron_profiler_v4",
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

  computePoint() {
    const semanticProfile = this.getSemanticProfile();
    const { a, b, s, yCoverage } = semanticProfile.semantics;
    const projection = EpistemicProfiler.projectSemanticTriple(a, s, b, {
      epsilon: this.config.epsilon,
    });

    const stackedProfile = this.state.entries.flatMap((entry) => entry.profile || []);
    const stackedNotes = this.state.entries.flatMap((entry) => entry.notes || []);
    const finalized = {
      model: semanticProfile.model,
      profile: dedupeLatestFirst(stackedProfile),
      notes: dedupeLatestFirst([
        ...stackedNotes,
        ...this.state.profileState.risk_notes,
      ]),
      data: {
        point: { ...projection.point },
        params: {
          semantics: { ...semanticProfile.semantics },
          uiLike: { ...semanticProfile.uiLike },
        },
        diagnostics: cloneJSON(semanticProfile.diagnostics),
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
            originRule:
              String.raw`|a| + |s| + |b| = 0 \Rightarrow (x,y,z) = (0,0,0)`,
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
