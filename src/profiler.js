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

  static axisDirectionFromProfileLabel(label = "") {
    const normalized = String(label || "").trim().toLowerCase();
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

    const strengthWeight = { weak: 0.33, moderate: 0.66, strong: 1.0 }[
      item.strength
    ];
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

    return `${EpistemicProfiler.formatSigned(signed)} ${label} | ${reason.replaceAll('"', "'")}`;
  }

  static parseCompactProfileSignals(lines = []) {
    const values = Array.isArray(lines) ? lines : [lines];
    const signals = [];

    for (const rawLine of values) {
      const line = String(rawLine || "").trim();
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

    const evidence = Array.isArray(payload.evidence) ? payload.evidence : [];
    evidence.forEach((item, index) => this.validateEvidenceItem(item, index));

    const profile = Array.isArray(payload.profile)
      ? payload.profile.map((item) => String(item || "").trim()).filter(Boolean)
      : [];

    const compactSignals = EpistemicProfiler.parseCompactProfileSignals(profile);

    if (!evidence.length && !compactSignals.length) {
      throw new Error(
        'LLM payload must contain a usable "evidence" array or compact profile signals like +.18 stability +.10 wisdom.',
      );
    }

    const entry = {
      model: payload.model || null,
      profile,
      evidence: evidence.map((item) => ({ ...item })),
      compactSignals: compactSignals.map((item) => ({ ...item })),
      notes: Array.isArray(payload.notes)
        ? payload.notes.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
      addedAt: new Date().toISOString(),
    };

    if (!entry.profile.length) {
      if (entry.evidence.length) {
        const bestEvidence = [...entry.evidence]
          .filter(
            (item) => EpistemicProfiler.signFromDirection(item.axis, item.direction) !== 0,
          )
          .sort((a, b) => {
            const weightA = this.strengthWeight(a.strength) * a.confidence;
            const weightB = this.strengthWeight(b.strength) * b.confidence;
            return weightB - weightA;
          })[0];

        const fallback = EpistemicProfiler.compactProfileLine(bestEvidence);
        if (fallback) entry.profile = [fallback];
      } else if (entry.compactSignals.length) {
        const bestSignal = [...entry.compactSignals].sort(
          (a, b) => Math.abs(b.value) - Math.abs(a.value),
        )[0];
        if (bestSignal) {
          entry.profile = [
            `${EpistemicProfiler.formatSigned(bestSignal.value)} ${bestSignal.label} "parsed from compact profile signal"`,
          ];
        }
      }
    }

    this.state.entries.push(entry);
    return entry;
  }

  getAllEvidence() {
    return this.state.entries.flatMap((entry) => entry.evidence);
  }

  getAllCompactSignals() {
    return this.state.entries.flatMap((entry) => entry.compactSignals || []);
  }

  aggregateAxis(axis) {
    const evidence = this.getAllEvidence().filter((item) => item.axis === axis);
    const compactSignals = this.getAllCompactSignals().filter(
      (item) => item.axis === axis,
    );
    const saturation = this.config.axisSaturation[axis] ?? 2.5;
    const axisWeight = this.config.axisWeights[axis] ?? 1.0;

    let evidenceSignedSum = 0;
    let evidenceWeightSum = 0;
    for (const item of evidence) {
      const directionSign = EpistemicProfiler.signFromDirection(axis, item.direction);
      const strengthWeight = this.strengthWeight(item.strength);
      const contributionWeight = strengthWeight * item.confidence * axisWeight;
      evidenceSignedSum += directionSign * contributionWeight;
      evidenceWeightSum += contributionWeight;
    }

    let compactSignedSum = 0;
    let compactWeightSum = 0;
    for (const item of compactSignals) {
      const value = Number(item.value);
      if (!Number.isFinite(value)) continue;
      compactSignedSum += value * axisWeight;
      compactWeightSum += Math.abs(value) * axisWeight;
    }

    const signedSum = evidenceSignedSum + compactSignedSum;
    const weightSum = evidenceWeightSum + compactWeightSum;
    const raw = Math.abs(signedSum) <= this.config.epsilon
      ? 0
      : EpistemicProfiler.clamp(signedSum / saturation, -1, 1);

    return {
      axis,
      raw,
      signedSum,
      weightSum,
      saturation,
      evidenceCount: evidence.length,
      compactCount: compactSignals.length,
      evidenceSignedSum,
      compactSignedSum,
      evidenceWeightSum,
      compactWeightSum,
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
      model: "epistemic_octahedron_profiler_v3",
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

  static uniqueLatestFirst(items = []) {
    const seen = new Set();
    const out = [];
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const value = String(items[i] || "").trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
    return out;
  }

  computePoint() {
    const semanticProfile = this.getSemanticProfile();
    const { a, b, s } = semanticProfile.semantics;

    const result = EpistemicProfiler.computePointFromABS(a, b, s, {
      epsilon: this.config.epsilon,
      rejectBalancedNonPole: this.config.rejectBalancedNonPole,
    });

    const stackedProfile = this.state.entries.flatMap((entry) => entry.profile || []);
    const stackedNotes = this.state.entries.flatMap((entry) => entry.notes || []);
    const entryCount = this.state.entries.length;
    const evidenceCount = this.getAllEvidence().length;
    const compactSignalCount = this.getAllCompactSignals().length;

    const finalized = {
      model: semanticProfile.model,
      profile: EpistemicProfiler.uniqueLatestFirst(stackedProfile),
      notes: EpistemicProfiler.uniqueLatestFirst(stackedNotes),
      data: {
        point: { ...result.point },
        params: {
          semantics: { ...semanticProfile.semantics },
          uiLike: { ...semanticProfile.uiLike },
        },
        diagnostics: {
          empathyPracticality: { ...semanticProfile.diagnostics.empathyPracticality },
          wisdomKnowledge: { ...semanticProfile.diagnostics.wisdomKnowledge },
          epistemicStability: {
            ...semanticProfile.diagnostics.epistemicStability,
          },
        },
        math: {
          formulas: {
            axisAggregation:
              String.raw`raw_{axis} = \operatorname{clamp}\left(\frac{\sum signed\_evidence + \sum compact\_signals\_when\_no\_evidence}{saturation}, -1, 1\right)`,
            projection:
              String.raw`x = \frac{a}{|a| + |b|}(1-|s|),\quad y = s,\quad z = \frac{b}{|a| + |b|}(1-|s|)`,
            poleRule:
              String.raw`|s| = 1 \Rightarrow (x,y,z) = (0, \operatorname{sign}(s), 0)`,
            surfaceRule: String.raw`|x| + |y| + |z| = 1`,
          },
          values: {
            a,
            b,
            s,
            lateralBudget: result.debug.lateralBudget,
            sumAB: result.debug.sumAB,
            x: result.point.x,
            y: result.point.y,
            z: result.point.z,
            manhattan: result.debug.manhattan,
          },
          sources: {
            entryCount,
            evidenceCount,
            compactSignalCount,
          },
        },
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
