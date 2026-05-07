import fs from "node:fs";

const files = {
  contracts: "src/contracts.js",
  profiler: "src/profiler.js",
};

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content, "utf8");
}

function replaceOnce(content, needle, replacement, label) {
  if (!content.includes(needle)) {
    if (content.includes(replacement.trim())) return content;
    throw new Error(`Could not find patch target: ${label}`);
  }
  return content.replace(needle, replacement);
}

function insertBefore(content, needle, insertion, label) {
  if (content.includes(insertion.trim())) return content;
  if (!content.includes(needle)) throw new Error(`Could not find insertion target: ${label}`);
  return content.replace(needle, `${insertion}${needle}`);
}

function patchContracts() {
  let content = read(files.contracts);

  content = replaceOnce(
    content,
    `Outside-target failures go in local_y_* with target = criticized_system | described_other | quoted_view | mixed | unclear, not in self semantic y.\nSilence is neutral. Do not infer failure from absence. Missing caveats, missing examples, or missing discussion of context may be unresolved_scope_gaps, but they are not y_negative, failed_gates, active risks, or negative gate events unless the text positively shows closure, reality-detachment, contradiction, or refusal of correction.\n\nEVIDENCE RULES`,
    `Outside-target failures go in local_y_* with target = criticized_system | described_other | quoted_view | mixed | unclear, not in self semantic y.\nSilence is neutral. Do not infer failure from absence. Missing caveats, missing examples, or missing discussion of context may be unresolved_scope_gaps, but they are not y_negative, failed_gates, active risks, or negative gate events unless the text positively shows closure, reality-detachment, contradiction, or refusal of correction.\n\nCOMMITMENT LAYER\nDo not collapse surface utterance, authorial belief, and durable profile memory into one thing.\nAlways distinguish:\n1. surface_claim: what the sentence literally or rhetorically expresses.\n2. authorial_commitment: how strongly the packet evidences that the author actually endorses the claim.\n3. durable_profile_update: whether the evidence is strong enough to update persistent canon, principles, boundaries, gates, or risks.\n\nFor terse, joking, slogan-like, quoted, fictional, ironic, test-style, or context-poor utterances, keep authorial_commitment_confidence low unless the packet clearly says the author endorses the stance.\nDo not create new durable principles or boundaries from a single ambiguous slogan-like utterance.\nIf the surface wording itself shows closure, dismissal, or false certainty, you may report that at the surface-utterance level, but do not treat it as durable author belief unless authorial commitment is evidenced.\nIf authorial commitment is weak or ambiguous, prefer profile_target_frame = mixed_or_ambiguous and set durable_profile_update_confidence below 0.45.\nIf the text is explicitly submitted as the author's actual belief or self-description, authorial_commitment_confidence may be high.\n\nFor example, "vegans gotta go." by itself may have a lower-half surface utterance diagnostic, but it should not create an anti-vegan persistent boundary unless literal authorial endorsement is explicit or strongly supported by context.\n\nEVIDENCE RULES`,
    "contracts commitment layer",
  );

  content = replaceOnce(
    content,
    `  "profile_target_frame": "authorial_endorsement | self_description | described_subject | cautionary_example | quoted_view | mixed_or_ambiguous",\n  "statement_modes": [],\n  "profile": ["short display summary only"],`,
    `  "profile_target_frame": "authorial_endorsement | self_description | described_subject | cautionary_example | quoted_view | mixed_or_ambiguous",\n  "statement_modes": [],\n  "intent_profile": {\n    "surface_claim": "literal or rhetorical claim expressed by the text, if any",\n    "surface_claim_confidence": 0.0,\n    "authorial_commitment_confidence": 0.0,\n    "durable_profile_update_confidence": 0.0,\n    "possible_nonliteral_reading": false,\n    "nonliteral_reading_type": "joke | irony | quote | fiction | test_prompt | unclear | none",\n    "notes": []\n  },\n  "profile": ["short display summary only"],`,
    "contracts intent_profile schema",
  );

  write(files.contracts, content);
}

function patchProfiler() {
  let content = read(files.profiler);

  content = replaceOnce(
    content,
    `function normalizeProfileTargetFrame(value) {\n  const frame = cleanString(value).toLowerCase();\n  return PROFILE_TARGET_FRAMES.has(frame) ? frame : "authorial_endorsement";\n}\n\nfunction defaultAttributionTarget`,
    `function normalizeProfileTargetFrame(value) {\n  const frame = cleanString(value).toLowerCase();\n  return PROFILE_TARGET_FRAMES.has(frame) ? frame : "authorial_endorsement";\n}\n\nfunction defaultAuthorialCommitmentConfidence(frame = "authorial_endorsement", claimCommitments = []) {\n  const normalizedFrame = normalizeProfileTargetFrame(frame);\n  const commitments = Array.isArray(claimCommitments) ? claimCommitments : [];\n  const hasAssertedClaim = commitments.some((item) => cleanString(item?.commitment).toLowerCase() === "asserted");\n\n  if (normalizedFrame === "self_description") return 0.9;\n  if (normalizedFrame === "authorial_endorsement") return hasAssertedClaim ? 0.65 : 0.55;\n  if (normalizedFrame === "mixed_or_ambiguous") return 0.25;\n  if (normalizedFrame === "quoted_view" || normalizedFrame === "cautionary_example") return 0.05;\n  if (normalizedFrame === "described_subject") return 0.05;\n  return 0.25;\n}\n\nfunction normalizeIntentProfile(value = {}, { frame = "authorial_endorsement", claimCommitments = [] } = {}) {\n  const raw = value && typeof value === "object" ? value : {};\n  const possibleNonliteral = Boolean(\n    raw.possible_nonliteral_reading ??\n      raw.possibleNonliteralReading ??\n      raw.surface_only ??\n      raw.surfaceOnly ??\n      false,\n  );\n  const defaultCommitment = defaultAuthorialCommitmentConfidence(frame, claimCommitments);\n  const rawAuthorialCommitment =\n    raw.authorial_commitment_confidence ??\n    raw.authorialCommitmentConfidence ??\n    raw.commitment_confidence ??\n    raw.commitmentConfidence ??\n    defaultCommitment;\n  const authorialCommitment = EpistemicProfiler.clamp(Number(rawAuthorialCommitment), 0, 1);\n  const rawDurableCommitment =\n    raw.durable_profile_update_confidence ??\n    raw.durableProfileUpdateConfidence ??\n    raw.durable_commitment_confidence ??\n    raw.durableCommitmentConfidence ??\n    (possibleNonliteral ? Math.min(authorialCommitment, 0.25) : authorialCommitment);\n\n  return {\n    surface_claim: cleanString(raw.surface_claim || raw.surfaceClaim || raw.claim || ""),\n    surface_claim_confidence: EpistemicProfiler.clamp(\n      Number(raw.surface_claim_confidence ?? raw.surfaceClaimConfidence ?? 0),\n      0,\n      1,\n    ),\n    authorial_commitment_confidence: authorialCommitment,\n    durable_profile_update_confidence: EpistemicProfiler.clamp(Number(rawDurableCommitment), 0, 1),\n    possible_nonliteral_reading: possibleNonliteral,\n    nonliteral_reading_type: cleanString(raw.nonliteral_reading_type || raw.nonliteralReadingType || "none").toLowerCase() || "none",\n    notes: cleanStringList(raw.notes || []),\n  };\n}\n\nfunction entryAuthorialCommitmentConfidence(entry = {}) {\n  return EpistemicProfiler.clamp(Number(entry?.intent_profile?.authorial_commitment_confidence ?? 1), 0, 1);\n}\n\nfunction entryDurableProfileUpdateConfidence(entry = {}) {\n  return EpistemicProfiler.clamp(\n    Number(entry?.intent_profile?.durable_profile_update_confidence ?? entry?.intent_profile?.authorial_commitment_confidence ?? 1),\n    0,\n    1,\n  );\n}\n\nfunction defaultAttributionTarget`,
    "profiler commitment helpers",
  );

  content = replaceOnce(
    content,
    `    const claim_commitments = this.normalizeClaimCommitments(payload.claim_commitments || []);\n    const autoGateSupport = this.inferAutoSupportedGateEvents({`,
    `    const claim_commitments = this.normalizeClaimCommitments(payload.claim_commitments || []);\n    const intent_profile = normalizeIntentProfile(payload.intent_profile || payload.intent || {}, {\n      frame: profile_target_frame,\n      claimCommitments: claim_commitments,\n    });\n    const autoGateSupport = this.inferAutoSupportedGateEvents({`,
    "profiler normalize intent_profile",
  );

  content = replaceOnce(
    content,
    `      profile_target_frame,\n      statement_modes: cleanStringList(payload.statement_modes || []),\n      semantic_grid: this.normalizeSemanticGrid(payload.semantic_grid || {}),`,
    `      profile_target_frame,\n      statement_modes: cleanStringList(payload.statement_modes || []),\n      intent_profile,\n      semantic_grid: this.normalizeSemanticGrid(payload.semantic_grid || {}),`,
    "profiler return intent_profile",
  );

  content = replaceOnce(
    content,
    `  shouldMergeEntryIntoPersistentProfile(entry = {}) {\n    return this.isSelfMergingFrame(entry.profile_target_frame);\n  }`,
    `  shouldMergeEntryIntoPersistentProfile(entry = {}) {\n    if (!this.isSelfMergingFrame(entry.profile_target_frame)) return false;\n    const threshold = Number(this.config.authorialCommitmentProfileMergeThreshold ?? 0.45);\n    return entryAuthorialCommitmentConfidence(entry) + this.config.epsilon >= threshold;\n  }\n\n  shouldMergeEntryIntoDurableCanon(entry = {}) {\n    if (!this.shouldMergeEntryIntoPersistentProfile(entry)) return false;\n    const threshold = Number(this.config.durableProfileUpdateThreshold ?? 0.55);\n    return entryDurableProfileUpdateConfidence(entry) + this.config.epsilon >= threshold;\n  }`,
    "profiler persistent merge threshold",
  );

  content = replaceOnce(
    content,
    `  mergeEntryIntoPersistentState(entry) {\n    this.mergePrinciplesAndBoundaries(entry);\n    if (this.shouldMergeEntryIntoPersistentProfile(entry)) {`,
    `  mergeEntryIntoPersistentState(entry) {\n    if (this.shouldMergeEntryIntoDurableCanon(entry)) {\n      this.mergePrinciplesAndBoundaries(entry);\n    }\n    if (this.shouldMergeEntryIntoPersistentProfile(entry)) {`,
    "profiler durable canon merge guard",
  );

  content = insertBefore(
    content,
    `  hasDeterminateSelfNegativeEvidence(entries = this.getAggregationEntries()) {`,
    `  authorialCommitmentScore(entry = {}) {\n    return entryAuthorialCommitmentConfidence(entry);\n  }\n\n  durableProfileUpdateScore(entry = {}) {\n    return entryDurableProfileUpdateConfidence(entry);\n  }\n\n`,
    "profiler commitment score methods",
  );

  content = replaceOnce(
    content,
    `  hasDeterminateSelfNegativeEvidence(entries = this.getAggregationEntries()) {\n    const threshold = Number(this.config.nearZeroProjectionGuardNegativeEvidenceThreshold ?? 0.25);\n    return (Array.isArray(entries) ? entries : []).some(\n      (entry) => this.determinateSelfNegativeEvidenceScore(entry) >= threshold,\n    );\n  }`,
    `  hasDeterminateSelfNegativeEvidence(entries = this.getAggregationEntries()) {\n    const threshold = Number(this.config.nearZeroProjectionGuardNegativeEvidenceThreshold ?? 0.25);\n    const commitmentThreshold = Number(this.config.authorialCommitmentProjectionThreshold ?? 0.45);\n    return (Array.isArray(entries) ? entries : []).some(\n      (entry) =>\n        this.authorialCommitmentScore(entry) + this.config.epsilon >= commitmentThreshold &&\n        this.determinateSelfNegativeEvidenceScore(entry) >= threshold,\n    );\n  }`,
    "profiler projection commitment guard",
  );

  content = replaceOnce(
    content,
    `          lowSignalProjectionGuard: {\n            hasDeterminateSelfNegativeEvidence,\n            negativeEvidenceThreshold: Number(this.config.nearZeroProjectionGuardNegativeEvidenceThreshold ?? 0.25),\n          },`,
    `          lowSignalProjectionGuard: {\n            hasDeterminateSelfNegativeEvidence,\n            negativeEvidenceThreshold: Number(this.config.nearZeroProjectionGuardNegativeEvidenceThreshold ?? 0.25),\n            authorialCommitmentProjectionThreshold: Number(this.config.authorialCommitmentProjectionThreshold ?? 0.45),\n            activeEntryAuthorialCommitmentScore: aggregationEntries.length\n              ? this.authorialCommitmentScore(aggregationEntries[aggregationEntries.length - 1])\n              : 0,\n          },`,
    "profiler low signal diagnostics",
  );

  content = replaceOnce(
    content,
    `            scope: entry.analysis_scope,\n            profile_target_frame: normalizeProfileTargetFrame(entry.profile_target_frame),\n            merged_into_cumulative_profile: aggregationEntries.includes(entry),`,
    `            scope: entry.analysis_scope,\n            profile_target_frame: normalizeProfileTargetFrame(entry.profile_target_frame),\n            intent_profile: cloneJSON(entry.intent_profile || {}),\n            merged_into_cumulative_profile: aggregationEntries.includes(entry),`,
    "profiler supporting profile diagnostics",
  );

  write(files.profiler, content);
}

patchContracts();
patchProfiler();
console.log("Applied commitment-layer fix to src/contracts.js and src/profiler.js");
