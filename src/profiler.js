export class EpistemicProfiler {
  constructor(options = {}) {
    this.config = {
      strengthWeights: {
        weak: 0.33,
        moderate: 0.66,
        strong: 1.0,
      },
      axisWeights: {
        empathyPracticality: 1.0,
        wisdomKnowledge: 1.0,
        epistemicStability: 1.0,
      },
      axisSaturation: {
        empathyPracticality: 2.5,
        wisdomKnowledge: 2.5,
        epistemicStability: 2.5,
      },
      epsilon: 1e-9,
      rejectBalancedNonPole: true,
      ...options,
    };

    this.state = {
      entries: [],
      finalized: null,
    };
  }

  static clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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

  static formatSigned(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "+.00";
    const sign = num >= 0 ? "+" : "-";
    return `${sign}${Math.abs(num).toFixed(2)}`;
  }

  static compactProfileLine(item = {}) {
    if (!item || typeof item !== "object") return null;

    const axisLabelMap = {
      empathyPracticality: {
        empathy: "empathy",
        practicality: "practicality",
      },
      wisdomKnowledge: {
        wisdom: "wisdom",
        knowledge: "knowledge",
      },
      epistemicStability: {
        positive: "stability",
        negative: "instability",
      },
    };

    const label = axisLabelMap[item.axis]?.[item.direction];
    if (!label) return null;

    const confidence = EpistemicProfiler.clamp(Number(item.confidence), 0, 1);
    if (!Number.isFinite(confidence)) return null;

    const strengthWeight = {
      weak: 0.33,
      moderate: 0.66,
      strong: 1.0,
    }[item.strength];
    if (!strengthWeight) return null;

    const signed =
      (item.direction === "negative" ||
      item.direction === "practicality" ||
      item.direction === "knowledge"
        ? -1
        : 1) *
      confidence *
      strengthWeight;

    const reason = String(item.reason || "")
      .trim()
      .replace(/\s+/g, " ");
    if (!reason) return null;

    return `${EpistemicProfiler.formatSigned(signed)} ${label} "${reason}"`;
  }

  strengthWeight(strength) {
    const weight = this.config.strengthWeights[strength];
    if (typeof weight !== "number") {
      throw new Error(`Invalid strength: ${strength}`);
    }
    return weight;
  }

  validateEvidenceItem(item, index = 0) {
    if (!item || typeof item !== "object") {
      throw new Error(`Evidence item at index ${index} must be an object`);
    }

    const required = ["axis", "direction", "strength", "confidence", "reason"];
    for (const key of required) {
      if (!(key in item)) {
        throw new Error(`Evidence item at index ${index} is missing "${key}"`);
      }
    }

    const validAxes = [
      "empathyPracticality",
      "wisdomKnowledge",
      "epistemicStability",
    ];

    if (!validAxes.includes(item.axis)) {
      throw new Error(`Invalid axis at index ${index}: ${item.axis}`);
    }

    if (typeof item.confidence !== "number" || Number.isNaN(item.confidence)) {
      throw new Error(`confidence at index ${index} must be a number`);
    }

    item.confidence = EpistemicProfiler.clamp(item.confidence, 0, 1);

    if (typeof item.reason !== "string" || !item.reason.trim()) {
      throw new Error(`reason at index ${index} must be a non-empty string`);
    }

    if ("excerpt" in item && typeof item.excerpt !== "string") {
      throw new Error(`excerpt at index ${index} must be a string if provided`);
    }

    EpistemicProfiler.signFromDirection(item.axis, item.direction);
  }

  addLLMOutput(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("LLM payload must be an object");
    }

    if (!Array.isArray(payload.evidence)) {
      throw new Error('LLM payload must contain an "evidence" array');
    }

    payload.evidence.forEach((item, index) =>
      this.validateEvidenceItem(item, index),
    );

    const profile = Array.isArray(payload.profile)
      ? payload.profile.map((item) => String(item || "").trim()).filter(Boolean)
      : [];

    const entry = {
      model: payload.model || null,
      profile,
      evidence: payload.evidence.map((item) => ({ ...item })),
      notes: Array.isArray(payload.notes)
        ? payload.notes.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
      addedAt: new Date().toISOString(),
    };

    if (!entry.profile.length) {
      const bestEvidence = [...entry.evidence]
        .filter(
          (item) =>
            EpistemicProfiler.signFromDirection(item.axis, item.direction) !==
            0,
        )
        .sort((a, b) => {
          const weightA = this.strengthWeight(a.strength) * a.confidence;
          const weightB = this.strengthWeight(b.strength) * b.confidence;
          return weightB - weightA;
        })[0];
      const fallback = EpistemicProfiler.compactProfileLine(bestEvidence);
      if (fallback) entry.profile = [fallback];
    }

    this.state.entries.push(entry);
    return entry;
  }

  getAllEvidence() {
    return this.state.entries.flatMap((entry) => entry.evidence);
  }

  aggregateAxis(axis) {
    const all = this.getAllEvidence().filter((item) => item.axis === axis);
    const saturation = this.config.axisSaturation[axis] ?? 2.5;

    let signedSum = 0;
    let weightSum = 0;

    for (const item of all) {
      const directionSign = EpistemicProfiler.signFromDirection(
        axis,
        item.direction,
      );
      const strengthWeight = this.strengthWeight(item.strength);
      const axisWeight = this.config.axisWeights[axis] ?? 1.0;
      const contributionWeight = strengthWeight * item.confidence * axisWeight;

      signedSum += directionSign * contributionWeight;
      weightSum += contributionWeight;
    }

    if (Math.abs(signedSum) <= this.config.epsilon) {
      return {
        axis,
        raw: 0,
        signedSum,
        weightSum,
        saturation,
        evidenceCount: all.length,
      };
    }

    const raw = EpistemicProfiler.clamp(signedSum / saturation, -1, 1);

    return {
      axis,
      raw,
      signedSum,
      weightSum,
      saturation,
      evidenceCount: all.length,
    };
  }

  getSemanticProfile() {
    const empathyPracticality = this.aggregateAxis("empathyPracticality");
    const wisdomKnowledge = this.aggregateAxis("wisdomKnowledge");
    const epistemicStability = this.aggregateAxis("epistemicStability");

    const a = empathyPracticality.raw;
    const b = wisdomKnowledge.raw;
    const s = epistemicStability.raw;

    return {
      model: "epistemic_octahedron_profiler_v2",
      semantics: { a, b, s },
      uiLike: {
        empathyPercent: (a + 1) * 50,
        practicalityPercent: 100 - (a + 1) * 50,
        wisdomPercent: (b + 1) * 50,
        knowledgePercent: 100 - (b + 1) * 50,
        stabilityPercent: s * 100,
      },
      diagnostics: {
        empathyPracticality,
        wisdomKnowledge,
        epistemicStability,
      },
    };
  }

  static computePointFromABS(a, b, s, options = {}) {
    const epsilon = options.epsilon ?? 1e-9;
    const rejectBalancedNonPole = options.rejectBalancedNonPole ?? true;

    a = EpistemicProfiler.clamp(a, -1, 1);
    b = EpistemicProfiler.clamp(b, -1, 1);
    s = EpistemicProfiler.clamp(s, -1, 1);

    const lateralBudget = 1 - Math.abs(s);
    const sumAB = Math.abs(a) + Math.abs(b);

    let x;
    let y;
    let z;

    if (Math.abs(Math.abs(s) - 1) <= epsilon) {
      x = 0;
      y = s >= 0 ? 1 : -1;
      z = 0;
    } else if (sumAB > epsilon) {
      x = (a / sumAB) * lateralBudget;
      y = s;
      z = (b / sumAB) * lateralBudget;
    } else {
      if (rejectBalancedNonPole) {
        throw new Error(
          "Non-pole double-balance cannot be represented on the octahedron surface",
        );
      }

      x = 0;
      y = s;
      z = 0;
    }

    const manhattan = Math.abs(x) + Math.abs(y) + Math.abs(z);

    return {
      point: { x, y, z },
      debug: {
        a,
        b,
        s,
        lateralBudget,
        sumAB,
        manhattan,
        surfaceEquationSatisfied: Math.abs(manhattan - 1) <= 1e-6,
      },
    };
  }

  computePoint() {
    const semanticProfile = this.getSemanticProfile();
    const { a, b, s } = semanticProfile.semantics;

    const result = EpistemicProfiler.computePointFromABS(a, b, s, {
      epsilon: this.config.epsilon,
      rejectBalancedNonPole: this.config.rejectBalancedNonPole,
    });

    const stackedProfile = this.state.entries.flatMap(
      (entry) => entry.profile || [],
    );
    const stackedNotes = this.state.entries.flatMap(
      (entry) => entry.notes || [],
    );

    const finalized = {
      model: semanticProfile.model,
      profile: [...new Set(stackedProfile)],
      notes: [...new Set(stackedNotes)],
      data: {
        point: { ...result.point },
      },
    };

    this.state.finalized = finalized;

    return {
      ...result,
      semanticProfile,
      finalized,
    };
  }

  reset() {
    this.state.entries = [];
    this.state.finalized = null;
  }
}
