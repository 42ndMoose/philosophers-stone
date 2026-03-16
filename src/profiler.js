// Real code for: LLM evidence JSON -> profiler state -> final xyz
// Also includes a direct percent-to-point helper using the exact formula.

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
      epsilon: 1e-9,
      rejectBalancedNonPole: true,
      ...options,
    };

    this.state = {
      entries: [],
      principles: [],
      boundaries: [],
      parameters: {},
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

  strengthWeight(strength) {
    const weight = this.config.strengthWeights[strength];
    if (typeof weight !== 'number') {
      throw new Error(`Invalid strength: ${strength}`);
    }
    return weight;
  }

  validateEvidenceItem(item, index = 0) {
    if (!item || typeof item !== 'object') {
      throw new Error(`Evidence item at index ${index} must be an object`);
    }

    const required = ['axis', 'direction', 'strength', 'confidence', 'reason'];
    for (const key of required) {
      if (!(key in item)) {
        throw new Error(`Evidence item at index ${index} is missing "${key}"`);
      }
    }

    const validAxes = [
      'empathyPracticality',
      'wisdomKnowledge',
      'epistemicStability',
    ];

    if (!validAxes.includes(item.axis)) {
      throw new Error(`Invalid axis at index ${index}: ${item.axis}`);
    }

    if (typeof item.confidence !== 'number' || Number.isNaN(item.confidence)) {
      throw new Error(`confidence at index ${index} must be a number`);
    }

    item.confidence = EpistemicProfiler.clamp(item.confidence, 0, 1);

    if (typeof item.reason !== 'string' || !item.reason.trim()) {
      throw new Error(`reason at index ${index} must be a non-empty string`);
    }

    if ('excerpt' in item && typeof item.excerpt !== 'string') {
      throw new Error(`excerpt at index ${index} must be a string if provided`);
    }

    EpistemicProfiler.signFromDirection(item.axis, item.direction);
  }

  addLLMOutput(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('LLM payload must be an object');
    }

    if (!Array.isArray(payload.evidence)) {
      throw new Error('LLM payload must contain an "evidence" array');
    }

    payload.evidence.forEach((item, i) => this.validateEvidenceItem(item, i));

    const entry = {
      model: payload.model || null,
      evidence: payload.evidence.map((item) => ({ ...item })),
      notes: Array.isArray(payload.notes) ? [...payload.notes] : [],
      principles: Array.isArray(payload.principles) ? [...payload.principles] : [],
      boundaries: Array.isArray(payload.boundaries) ? [...payload.boundaries] : [],
      parameters: payload.parameters && typeof payload.parameters === 'object' ? { ...payload.parameters } : {},
      addedAt: new Date().toISOString(),
    };

    if (entry.principles.length) {
      this.state.principles = [...entry.principles];
    }
    if (entry.boundaries.length) {
      this.state.boundaries = [...entry.boundaries];
    }
    if (Object.keys(entry.parameters).length) {
      this.state.parameters = { ...entry.parameters };
    }

    this.state.entries.push(entry);
    return entry;
  }

  getAllEvidence() {
    return this.state.entries.flatMap((entry) => entry.evidence);
  }

  aggregateAxis(axis) {
    const all = this.getAllEvidence().filter((item) => item.axis === axis);

    let signedSum = 0;
    let weightSum = 0;

    for (const item of all) {
      const directionSign = EpistemicProfiler.signFromDirection(axis, item.direction);
      const strengthWeight = this.strengthWeight(item.strength);
      const axisWeight = this.config.axisWeights[axis] ?? 1.0;
      const contributionWeight = strengthWeight * item.confidence * axisWeight;

      signedSum += directionSign * contributionWeight;
      weightSum += contributionWeight;
    }

    if (weightSum <= this.config.epsilon) {
      return {
        axis,
        raw: 0,
        weightSum: 0,
        evidenceCount: all.length,
      };
    }

    const raw = EpistemicProfiler.clamp(signedSum / weightSum, -1, 1);

    return {
      axis,
      raw,
      weightSum,
      evidenceCount: all.length,
    };
  }

  getSemanticProfile() {
    const ep = this.aggregateAxis('empathyPracticality');
    const wk = this.aggregateAxis('wisdomKnowledge');
    const es = this.aggregateAxis('epistemicStability');

    const a = ep.raw;
    const b = wk.raw;
    const s = es.raw;

    return {
      model: 'epistemic_octahedron_profiler_v1',
      semantics: {
        a,
        b,
        s,
      },
      uiLike: {
        empathyPercent: (a + 1) * 50,
        practicalityPercent: 100 - (a + 1) * 50,
        wisdomPercent: (b + 1) * 50,
        knowledgePercent: 100 - (b + 1) * 50,
        stabilityPercent: s * 100,
      },
      diagnostics: {
        empathyPracticality: ep,
        wisdomKnowledge: wk,
        epistemicStability: es,
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
        throw new Error('Non-pole double-balance cannot be represented on the octahedron surface');
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

  static computePointFromPercents(empathyPercent, wisdomPercent, stabilityPercent, options = {}) {
    const a = (empathyPercent / 100) * 2 - 1;
    const b = (wisdomPercent / 100) * 2 - 1;
    const s = EpistemicProfiler.clamp(stabilityPercent / 100, -1, 1);

    return EpistemicProfiler.computePointFromABS(a, b, s, options);
  }

  computePoint() {
    const profile = this.getSemanticProfile();
    const { a, b, s } = profile.semantics;

    const result = EpistemicProfiler.computePointFromABS(a, b, s, {
      epsilon: this.config.epsilon,
      rejectBalancedNonPole: this.config.rejectBalancedNonPole,
    });

    const finalized = {
      model: profile.model,
      principles: [...this.state.principles],
      boundaries: [...this.state.boundaries],
      parameters: { ...this.state.parameters },
      data: {
        point: { ...result.point },
      },
    };

    this.state.finalized = finalized;

    return {
      ...result,
      semanticProfile: profile,
      finalized,
    };
  }

  reset() {
    this.state.entries = [];
    this.state.principles = [];
    this.state.boundaries = [];
    this.state.parameters = {};
    this.state.finalized = null;
  }
}
