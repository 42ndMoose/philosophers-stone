
import {
  buildLLMPacket,
  buildProfilerAssessmentPacket,
  flattenLayeredCanon,
} from "./contracts.js";
import { AVATARS, getAvatarById, pickAvatarFromPoint } from "./avatars.js";
import { EpistemicProfiler } from "./profiler.js";

const STORAGE_KEY = "philosophers-stone-workspace-v5";
const BUTTON_RESET_MS = 1500;
const DIAMOND_RANGE_PERCENT = 34;
const MAX_CANON_ITEMS = 12;

const NOTE_TOOLTIP_MAP = {
  "G1 counter consideration": "Recognizes a real opposing consideration instead of pretending there is none.",
  "G2 non strawman": "Represents the opposing side fairly enough to avoid caricature.",
  "G3 self correction": "Shows willingness to revise or admit being wrong when warranted.",
  "G4 contradiction handling": "Faces contradiction honestly instead of hiding or hand-waving it.",
  "G5 reality contact": "Keeps contact with reality, constraints, tradeoffs, and consequences.",
  "G6 non self sealing": "Avoids making the view unfalsifiable or closed against correction.",
  "strawman dependence": "Leans on caricaturing the opposing side instead of addressing it fairly.",
  "broad motive attribution": "Attributes sweeping motives to large groups without enough support.",
  "false certainty": "Speaks with unwarranted certainty despite limited evidence or nuance.",
  "dogmatic closure": "Closes discussion prematurely instead of remaining open to correction.",
  "reality detachment": "Reasoning drifts away from observable constraints or consequences.",
  "contradiction evasion": "Avoids or hides internal tension instead of confronting it.",
  "counter consideration": "Shows awareness that real opposing considerations exist.",
  "self correction": "Shows willingness to correct or revise oneself.",
  "reality contact": "Shows tethering to real-world outcomes, constraints, or consequences.",
  "non strawman fairness": "Represents the opposing side in recognizable rather than distorted terms.",
};

const els = {
  profileText: document.getElementById("profileText"),
  llmOutput: document.getElementById("llmOutput"),
  pasteLlmOutputBtn: document.getElementById("pasteLlmOutputBtn"),
  copyPacketBtn: document.getElementById("copyPacketBtn"),
  togglePacketPreviewBtn: document.getElementById("togglePacketPreviewBtn"),
  packetPreviewWrap: document.getElementById("packetPreviewWrap"),
  packetPreview: document.getElementById("packetPreview"),
  refreshPacketBtn: document.getElementById("refreshPacketBtn"),
  compileBtn: document.getElementById("compileBtn"),
  compileStatus: document.getElementById("compileStatus"),
  avatarGrid: document.getElementById("avatarGrid"),
  selectedAvatarBtn: document.getElementById("selectedAvatarBtn"),
  toggleAvatarGridBtn: document.getElementById("toggleAvatarGridBtn"),
  profileName: document.getElementById("profileName"),
  profileAdditionalInfo: document.getElementById("profileAdditionalInfo"),
  canonInput: document.getElementById("canonInput"),
  canonType: document.getElementById("canonType"),
  addCanonBtn: document.getElementById("addCanonBtn"),
  exportProfileBtn: document.getElementById("exportProfileBtn"),
  importProfileBtn: document.getElementById("importProfileBtn"),
  importProfileInput: document.getElementById("importProfileInput"),
  resetWorkspaceBtn: document.getElementById("resetWorkspaceBtn"),
  profileEntriesList: document.getElementById("profileEntriesList"),
  copyProfilerAssessmentBtn: document.getElementById("copyProfilerAssessmentBtn"),
  visualizerFrame: document.getElementById("visualizerFrame"),
  refreshVisualizerBtn: document.getElementById("refreshVisualizerBtn"),
  toggleMathBtn: document.getElementById("toggleMathBtn"),
  mathWrap: document.getElementById("mathWrap"),
  mathDump: document.getElementById("mathDump"),
  statBarEP: document.getElementById("statBarEP"),
  statBarWK: document.getElementById("statBarWK"),
  topViewDot: document.getElementById("topViewDot"),
  sideViewLine: document.getElementById("sideViewLine"),
  profileNotesList: document.getElementById("profileNotesList"),
  profileEntriesCount: document.getElementById("profileEntriesCount"),
  profileNotesCount: document.getElementById("profileNotesCount"),
  canonLists: {
    principles: document.getElementById("principlesList"),
    boundaries: document.getElementById("boundariesList"),
  },
};

const profiler = new EpistemicProfiler();

function buildEmptyCanonState() {
  return {
    principles: [],
    boundaries: [],
  };
}

const state = {
  profileText: "",
  llmOutput: "",
  name: "",
  additionalInfo: "",
  selectedAvatarId: null,
  manualAvatar: false,
  canon: buildEmptyCanonState(),
  latestCompile: null,
  compiledPayloads: [],
  avatarPickerOpen: false,
  mathOpen: false,
};

function normalizeCanonText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function canonKey(value) {
  return normalizeCanonText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(a|an|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensOf(text) {
  return canonKey(text).split(" ").filter(Boolean);
}

function nearDuplicateCanon(a, b) {
  const keyA = canonKey(a);
  const keyB = canonKey(b);
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  if (keyA.includes(keyB) || keyB.includes(keyA)) return true;
  const aTokens = new Set(tokensOf(a));
  const bTokens = new Set(tokensOf(b));
  const overlap = [...aTokens].filter((token) => bTokens.has(token)).length;
  const minSize = Math.min(aTokens.size, bTokens.size) || 1;
  return overlap / minSize >= 0.85;
}

function preferCanonWording(currentText, nextText) {
  const current = normalizeCanonText(currentText);
  const next = normalizeCanonText(nextText);
  if (!current) return next;
  if (!next) return current;
  if (next.length < current.length && nearDuplicateCanon(current, next)) return next;
  return current;
}

function canonicalizeCanonList(items = [], maxItems = MAX_CANON_ITEMS) {
  const out = [];
  for (const raw of items) {
    const text = normalizeCanonText(raw);
    if (!text) continue;
    const existingIndex = out.findIndex((item) => nearDuplicateCanon(item, text));
    if (existingIndex >= 0) {
      out[existingIndex] = preferCanonWording(out[existingIndex], text);
      continue;
    }
    out.push(text);
  }
  return out.slice(0, maxItems);
}

function canonicalizeCanonState(canon = buildEmptyCanonState()) {
  return {
    principles: canonicalizeCanonList(canon.principles),
    boundaries: canonicalizeCanonList(canon.boundaries),
  };
}

function flattenCanonInput(input) {
  if (Array.isArray(input)) return input.map(normalizeCanonText).filter(Boolean);
  return flattenLayeredCanon(input).map(normalizeCanonText).filter(Boolean);
}

function formatPercent(value) {
  return `${Number(value).toFixed(1)}%`;
}

function formatCoord(value) {
  const cleaned = Math.abs(Number(value) || 0) < 5e-7 ? 0 : Number(value) || 0;
  const out = cleaned.toFixed(3);
  return out === "-0.000" ? "0.000" : out;
}

function formatSigned(value, digits = 3) {
  const num = Number(value) || 0;
  const sign = num >= 0 ? "+" : "-";
  return `${sign}${Math.abs(num).toFixed(digits)}`;
}

function getAvatarTitle(id) {
  return getAvatarById(id)?.title || "Unassigned";
}

function cloneCanon(canon = buildEmptyCanonState()) {
  return {
    principles: [...(canon.principles || [])],
    boundaries: [...(canon.boundaries || [])],
  };
}

function createExportableState() {
  return {
    ...state,
    canon: cloneCanon(state.canon),
  };
}

function serializeState() {
  return JSON.stringify(createExportableState());
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, serializeState());
}

function ensureCanonShape(input) {
  return canonicalizeCanonState({
    principles: flattenCanonInput(input?.principles),
    boundaries: flattenCanonInput(input?.boundaries),
  });
}

function migrateState(parsed = {}) {
  return {
    profileText: String(parsed.profileText || ""),
    llmOutput: String(parsed.llmOutput || ""),
    name: String(parsed.name || ""),
    additionalInfo: String(parsed.additionalInfo || parsed.age || ""),
    selectedAvatarId: parsed.selectedAvatarId || null,
    manualAvatar: Boolean(parsed.manualAvatar),
    canon: ensureCanonShape(
      parsed.canon || {
        principles: parsed.principles || [],
        boundaries: parsed.boundaries || [],
      },
    ),
    latestCompile: parsed.latestCompile || null,
    compiledPayloads: Array.isArray(parsed.compiledPayloads) ? parsed.compiledPayloads : [],
    avatarPickerOpen: false,
    mathOpen: Boolean(parsed.mathOpen),
  };
}

function hydrateState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    Object.assign(state, migrateState(JSON.parse(raw)));
  } catch {
    // ignore broken local state
  }
}

function autoResizeTextarea(textarea, maxRows = 22) {
  const style = getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight) || 21;
  textarea.style.height = "auto";
  const maxHeight = lineHeight * maxRows + 28;
  textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
}

function setButtonFeedback(button, nextText) {
  const original = button.dataset.originalText || button.textContent;
  button.dataset.originalText = original;
  button.textContent = nextText;
  window.clearTimeout(button._feedbackTimer);
  button._feedbackTimer = window.setTimeout(() => {
    button.textContent = original;
  }, BUTTON_RESET_MS);
}

function renderAvatars() {
  const selectedAvatar = getAvatarById(state.selectedAvatarId) || AVATARS[0];
  els.selectedAvatarBtn.innerHTML = `<img src="${selectedAvatar.src}" alt="${selectedAvatar.title}" />`;
  els.avatarGrid.innerHTML = "";

  for (const avatar of AVATARS) {
    if (avatar.id === selectedAvatar.id) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar-btn avatar-option-btn";
    btn.dataset.avatarId = avatar.id;
    btn.innerHTML = `<img src="${avatar.src}" alt="${avatar.title}" />`;
    btn.addEventListener("click", () => {
      state.selectedAvatarId = avatar.id;
      state.manualAvatar = true;
      state.avatarPickerOpen = false;
      renderAvatars();
      renderPacketPreview();
      saveState();
    });
    els.avatarGrid.appendChild(btn);
  }

  const isOpen = Boolean(state.avatarPickerOpen);
  els.avatarGrid.classList.toggle("hidden", !isOpen);
  els.toggleAvatarGridBtn.setAttribute("aria-expanded", String(isOpen));
}

function makeCanonItem(text, type, index) {
  const li = document.createElement("li");
  li.className = "canon-item";
  li.draggable = true;
  li.dataset.type = type;
  li.dataset.index = String(index);
  li.innerHTML = `
    <span class="drag-pill">⋮⋮</span>
    <div>${text}</div>
    <button type="button" class="delete-item-btn" aria-label="Delete item">×</button>
  `;

  li.addEventListener("dragstart", () => li.classList.add("is-dragging"));
  li.addEventListener("dragend", () => {
    li.classList.remove("is-dragging");
    document.querySelectorAll(".canon-list").forEach((list) => list.classList.remove("is-drop-target"));
  });

  li.querySelector(".delete-item-btn").addEventListener("click", () => {
    state.canon[type].splice(index, 1);
    state.canon = canonicalizeCanonState(state.canon);
    renderCanonLists();
    renderPacketPreview();
    saveState();
  });

  return li;
}

function attachDropBehavior(listEl, type) {
  listEl.addEventListener("dragover", (event) => {
    const dragging = document.querySelector(".canon-item.is-dragging");
    if (!dragging || dragging.dataset.type !== type) return;
    event.preventDefault();
    listEl.classList.add("is-drop-target");
  });

  listEl.addEventListener("dragleave", () => listEl.classList.remove("is-drop-target"));

  listEl.addEventListener("drop", (event) => {
    const dragging = document.querySelector(".canon-item.is-dragging");
    listEl.classList.remove("is-drop-target");
    if (!dragging || dragging.dataset.type !== type) return;
    event.preventDefault();

    const sourceIndex = Number(dragging.dataset.index);
    const bucket = state.canon[type];
    const [moved] = bucket.splice(sourceIndex, 1);
    if (!moved) return;

    const items = [...listEl.querySelectorAll(".canon-item:not(.is-dragging)")];
    const after = items.find((item) => {
      const rect = item.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    const targetIndex = after ? Number(after.dataset.index) : bucket.length;
    bucket.splice(targetIndex, 0, moved);
    renderCanonLists();
    renderPacketPreview();
    saveState();
  });
}

function renderCanonLists() {
  for (const type of ["principles", "boundaries"]) {
    const listEl = els.canonLists[type];
    listEl.innerHTML = "";
    const items = state.canon[type];
    items.forEach((text, index) => {
      listEl.appendChild(makeCanonItem(text, type, index));
    });
  }
}

function getLatestProfilerMemory() {
  return state.latestCompile?.result?.finalized?.data?.diagnostics?.profileState || {};
}

function buildPacket() {
  return buildLLMPacket({
    profileText: state.profileText,
    principles: state.canon.principles,
    boundaries: state.canon.boundaries,
    profilerMemory: getLatestProfilerMemory(),
  });
}

function getLatestFinalizedData() {
  return state.latestCompile?.result?.finalized?.data || {};
}

function buildProfilerAssessment() {
  const finalizedData = getLatestFinalizedData();
  return buildProfilerAssessmentPacket({
    name: state.name,
    additionalInfo: state.additionalInfo,
    avatar: getAvatarTitle(state.selectedAvatarId),
    profileEntries: state.latestCompile?.result?.finalized?.profile || [],
    notes: state.latestCompile?.result?.finalized?.notes || [],
    computed: {
      point: finalizedData.point,
      uiLike: finalizedData.params?.uiLike,
    },
  });
}

function renderPacketPreview() {
  els.packetPreview.textContent = buildPacket();
}

async function copyTextToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

function sanitizeJSONInput(raw) {
  return String(raw || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function setCompileStatus(message, kind = "") {
  els.compileStatus.textContent = message;
  els.compileStatus.classList.remove("is-error", "is-success");
  if (kind) els.compileStatus.classList.add(kind);
}

function cleanStringList(items = []) {
  return (Array.isArray(items) ? items : [items])
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        return String(
          item.text ||
            item.value ||
            item.principle ||
            item.boundary ||
            item.normalized ||
            item.reason ||
            "",
        ).trim();
      }
      return "";
    })
    .filter(Boolean);
}

function countStructuredSignals(payload = {}) {
  const axisEvents = payload.axis_events || {};
  const localExtraction = payload.local_extraction || {};
  const profileUpdates = payload.profile_update_signals || {};

  return (
    (Array.isArray(payload.evidence) ? payload.evidence.length : 0) +
    EpistemicProfiler.parseCompactProfileSignals(cleanStringList(payload.profile || [])).length +
    (Array.isArray(axisEvents.x_pole_evidence) ? axisEvents.x_pole_evidence.length : 0) +
    (Array.isArray(axisEvents.x_integration_events) ? axisEvents.x_integration_events.length : 0) +
    (Array.isArray(axisEvents.z_pole_evidence) ? axisEvents.z_pole_evidence.length : 0) +
    (Array.isArray(axisEvents.z_integration_events) ? axisEvents.z_integration_events.length : 0) +
    (Array.isArray(payload.local_y_positive_signals) ? payload.local_y_positive_signals.length : 0) +
    (Array.isArray(payload.local_y_negative_signals) ? payload.local_y_negative_signals.length : 0) +
    (Array.isArray(payload.triggered_gate_events) ? payload.triggered_gate_events.length : 0) +
    (Array.isArray(localExtraction.principles) ? localExtraction.principles.length : 0) +
    (Array.isArray(localExtraction.boundaries) ? localExtraction.boundaries.length : 0) +
    (Array.isArray(localExtraction.claimed_values) ? localExtraction.claimed_values.length : 0) +
    (Array.isArray(localExtraction.tradeoffs) ? localExtraction.tradeoffs.length : 0) +
    (Array.isArray(localExtraction.contradictions) ? localExtraction.contradictions.length : 0) +
    (Array.isArray(profileUpdates.new_principles) ? profileUpdates.new_principles.length : 0) +
    (Array.isArray(profileUpdates.new_boundaries) ? profileUpdates.new_boundaries.length : 0) +
    (Array.isArray(profileUpdates.cleared_gates) ? profileUpdates.cleared_gates.length : 0) +
    (Array.isArray(profileUpdates.failed_gates) ? profileUpdates.failed_gates.length : 0)
  );
}

function payloadHasScorableSignals(payload = {}) {
  return payload && typeof payload === "object" && countStructuredSignals(payload) > 0;
}

function setListCount(element, count, singularLabel, pluralLabel) {
  if (!element) return;
  const resolvedPluralLabel =
    pluralLabel || (singularLabel.endsWith("y") ? `${singularLabel.slice(0, -1)}ies` : `${singularLabel}s`);
  const label = count === 1 ? singularLabel : resolvedPluralLabel;
  element.textContent = `${count} ${label}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprintPayload(payload = {}) {
  return stableStringify({
    model: payload.model,
    analysis_scope: payload.analysis_scope,
    scope_strength: payload.scope_strength,
    statement_modes: payload.statement_modes || [],
    profile: payload.profile || [],
    local_extraction: payload.local_extraction || {},
    axis_events: payload.axis_events || {},
    local_y_positive_signals: payload.local_y_positive_signals || [],
    local_y_negative_signals: payload.local_y_negative_signals || [],
    triggered_gate_events: payload.triggered_gate_events || [],
    profile_update_signals: payload.profile_update_signals || {},
    notes: payload.notes || [],
    canonOptimization: payload.canonOptimization || payload.canonUpdate || null,
  });
}

function tryParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function findBalancedRange(text, openIndex, openChar, closeChar) {
  if (openIndex < 0 || text[openIndex] !== openChar) return null;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = openIndex; i < text.length; i += 1) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\" && inString) {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === openChar) {
      depth += 1;
      continue;
    }
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return { start: openIndex, end: i + 1 };
    }
  }
  return null;
}

function extractBlockByKey(text, key, openChar, closeChar) {
  const keyIndex = text.indexOf(`"${key}"`);
  if (keyIndex < 0) return null;
  const colonIndex = text.indexOf(":", keyIndex);
  if (colonIndex < 0) return null;
  const openIndex = text.indexOf(openChar, colonIndex);
  if (openIndex < 0) return null;
  return findBalancedRange(text, openIndex, openChar, closeChar);
}

function extractLooseProfileItems(raw) {
  const profileBlock = extractBlockByKey(raw, "profile", "[", "]");
  const profileText = profileBlock ? raw.slice(profileBlock.start + 1, profileBlock.end - 1) : raw;
  const trimmed = profileText.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/\s*"\s*,\s*"\s*/)
    .map((item) => item.trim().replace(/^"/, "").replace(/"$/, "").trim())
    .filter(Boolean);
}

function repairLikelyPayload(raw) {
  const profileBlock = extractBlockByKey(raw, "profile", "[", "]");
  if (!profileBlock) return raw;
  const items = extractLooseProfileItems(raw);
  if (!items.length) return raw;
  return `${raw.slice(0, profileBlock.start)}${JSON.stringify(items)}${raw.slice(profileBlock.end)}`;
}

function parseLooseArrayByKey(raw, key) {
  const block = extractBlockByKey(raw, key, "[", "]");
  if (!block) return null;
  return tryParseJSON(raw.slice(block.start, block.end));
}

function parseLooseObjectByKey(raw, key) {
  const block = extractBlockByKey(raw, key, "{", "}");
  if (!block) return null;
  return tryParseJSON(raw.slice(block.start, block.end));
}

function parseLoosePayload(raw) {
  const repaired = repairLikelyPayload(raw);
  const modelMatch = repaired.match(/"model"\s*:\s*"([^"]+)"/);
  const profile = extractLooseProfileItems(repaired);
  const evidence = parseLooseArrayByKey(repaired, "evidence") || [];
  const notes = parseLooseArrayByKey(repaired, "notes") || [];
  const axis_events = parseLooseObjectByKey(repaired, "axis_events") || {};
  const local_extraction = parseLooseObjectByKey(repaired, "local_extraction") || {};
  const profile_update_signals = parseLooseObjectByKey(repaired, "profile_update_signals") || {};
  const triggered_gate_events = parseLooseArrayByKey(repaired, "triggered_gate_events") || [];
  const local_y_positive_signals = parseLooseArrayByKey(repaired, "local_y_positive_signals") || [];
  const local_y_negative_signals = parseLooseArrayByKey(repaired, "local_y_negative_signals") || [];
  const canonOptimization =
    parseLooseObjectByKey(repaired, "canonOptimization") ||
    parseLooseObjectByKey(repaired, "canon_optimization") ||
    parseLooseObjectByKey(repaired, "canonUpdate") ||
    parseLooseObjectByKey(repaired, "canon_update");

  const hasAnything =
    profile.length ||
    evidence.length ||
    notes.length ||
    triggered_gate_events.length ||
    countStructuredSignals({
      axis_events,
      local_extraction,
      profile_update_signals,
      local_y_positive_signals,
      local_y_negative_signals,
    }) ||
    canonOptimization;

  if (!hasAnything) return null;

  const payload = {
    model: modelMatch?.[1] || "epistemic_octahedron_interpreter_v2",
    profile,
    evidence,
    notes: cleanStringList(notes),
    axis_events,
    local_extraction,
    profile_update_signals,
    triggered_gate_events,
    local_y_positive_signals,
    local_y_negative_signals,
  };
  if (canonOptimization) payload.canonOptimization = canonOptimization;
  return payload;
}

function normalizeParsedPayload(parsed = {}) {
  return {
    ...parsed,
    model: parsed.model || "epistemic_octahedron_interpreter_v2",
    profile: cleanStringList(parsed.profile || []),
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
    notes: cleanStringList(parsed.notes || []),
    analysis_scope: parsed.analysis_scope || parsed.analysisScope,
    scope_strength: parsed.scope_strength || parsed.scopeStrength,
    statement_modes: Array.isArray(parsed.statement_modes)
      ? parsed.statement_modes
      : Array.isArray(parsed.statementModes)
        ? parsed.statementModes
        : [],
    axis_events: parsed.axis_events || parsed.axisEvents || {},
    local_extraction: parsed.local_extraction || parsed.localExtraction || {},
    profile_update_signals: parsed.profile_update_signals || parsed.profileUpdateSignals || {},
    local_y_positive_signals: parsed.local_y_positive_signals || parsed.localYPositiveSignals || [],
    local_y_negative_signals: parsed.local_y_negative_signals || parsed.localYNegativeSignals || [],
    triggered_gate_events: parsed.triggered_gate_events || parsed.triggeredGateEvents || [],
    canonOptimization:
      parsed.canonOptimization ||
      parsed.canon_optimization ||
      parsed.canonUpdate ||
      parsed.canon_update ||
      undefined,
  };
}

function parseLLMOutput(raw) {
  const parsed = tryParseJSON(raw) || tryParseJSON(repairLikelyPayload(raw)) || parseLoosePayload(raw);
  if (parsed && typeof parsed === "object") {
    return { payload: normalizeParsedPayload(parsed) };
  }
  return {
    payload: {
      model: "epistemic_octahedron_interpreter_v2",
      profile: extractLooseProfileItems(raw),
      evidence: [],
      notes: [],
      axis_events: {},
      local_extraction: {},
      profile_update_signals: {},
      local_y_positive_signals: [],
      local_y_negative_signals: [],
      triggered_gate_events: [],
    },
  };
}

function extractCanonFromPayload(payload = {}) {
  const optimization = payload.canonOptimization || payload.canonUpdate || {};
  const action = String(optimization.action || optimization.mode || "").trim().toLowerCase();

  const explicitPrinciples = flattenCanonInput(
    optimization.principles || optimization.principlesByLayer || optimization.principles_by_layer || [],
  );
  const explicitBoundaries = flattenCanonInput(
    optimization.boundaries || optimization.boundariesByLayer || optimization.boundaries_by_layer || [],
  );

  if (explicitPrinciples.length || explicitBoundaries.length) {
    return {
      mode: action === "replace" ? "replace" : action === "maintain" ? "maintain" : "merge",
      canon: canonicalizeCanonState({
        principles: explicitPrinciples,
        boundaries: explicitBoundaries,
      }),
      notes: cleanStringList(optimization.notes || []),
    };
  }

  const localExtraction = payload.local_extraction || {};
  const profileUpdates = payload.profile_update_signals || {};

  const fallback = canonicalizeCanonState({
    principles: cleanStringList([
      ...(localExtraction.principles || []),
      ...(profileUpdates.new_principles || []),
      ...(profileUpdates.refined_principles || []),
    ]),
    boundaries: cleanStringList([
      ...(localExtraction.boundaries || []),
      ...(profileUpdates.new_boundaries || []),
      ...(profileUpdates.refined_boundaries || []),
    ]),
  });

  return {
    mode: action === "maintain" ? "maintain" : "merge",
    canon: fallback,
    notes: [],
  };
}

function applyCanonUpdate(targetCanon, extracted) {
  const nextCanon = cloneCanon(targetCanon);
  if (!extracted || extracted.mode === "maintain") return canonicalizeCanonState(nextCanon);
  if (extracted.mode === "replace") return canonicalizeCanonState(extracted.canon);

  return canonicalizeCanonState({
    principles: [...nextCanon.principles, ...(extracted.canon.principles || [])],
    boundaries: [...nextCanon.boundaries, ...(extracted.canon.boundaries || [])],
  });
}

function rebuildFromCompiledPayloads() {
  profiler.reset();
  let previousStability = null;
  let lastPayload = null;
  let lastResult = null;
  let stabilityDelta = null;

  for (const payload of state.compiledPayloads) {
    profiler.addLLMOutput(payload);
    lastResult = profiler.computePoint();
    lastPayload = payload;
    const nextStability = Number(lastResult.finalized?.data?.params?.uiLike?.stabilityPercent);
    stabilityDelta =
      Number.isFinite(previousStability) && Number.isFinite(nextStability)
        ? nextStability - previousStability
        : null;
    previousStability = nextStability;
  }

  if (lastResult) {
    const profileState = lastResult.finalized?.data?.diagnostics?.profileState || {};
    const extractedCanon = state.compiledPayloads.reduce((acc, payload) => applyCanonUpdate(acc, extractCanonFromPayload(payload)), buildEmptyCanonState());
    state.canon = canonicalizeCanonState({
      principles: [...extractedCanon.principles, ...(profileState.core_principles || [])],
      boundaries: [...extractedCanon.boundaries, ...(profileState.core_boundaries || [])],
    });
  } else {
    state.canon = canonicalizeCanonState(state.canon);
  }

  if (!lastPayload || !lastResult) {
    state.latestCompile = null;
    return;
  }

  state.latestCompile = {
    payload: lastPayload,
    payloadFingerprint: fingerprintPayload(lastPayload),
    result: lastResult,
    stabilityDelta,
    compiledAt: new Date().toISOString(),
  };
}

function summarizePayloadEntry(payload = {}) {
  const profile = cleanStringList(payload.profile || []);
  const notes = cleanStringList(payload.notes || []);
  const principles = cleanStringList(payload?.local_extraction?.principles || []);
  const boundaries = cleanStringList(payload?.local_extraction?.boundaries || []);
  const tradeoffs = cleanStringList(payload?.local_extraction?.tradeoffs || []);

  const summary = profile[0] || principles[0] || boundaries[0] || tradeoffs[0] || "Compiled worldview fragment.";
  let justification = notes[0] || "";

  if (!justification) {
    const positives = payload.local_y_positive_signals || [];
    const negatives = payload.local_y_negative_signals || [];
    const xPole = payload?.axis_events?.x_pole_evidence?.[0];
    const zPole = payload?.axis_events?.z_pole_evidence?.[0];
    const parts = [];
    if (xPole?.pole) parts.push(`x leans ${xPole.pole}`);
    if (zPole?.pole) parts.push(`z leans ${zPole.pole}`);
    if (positives.length) parts.push(`y support: ${positives[0].type || positives[0].signal_type}`);
    if (negatives.length) parts.push(`risk: ${negatives[0].type || negatives[0].signal_type}`);
    justification = parts.join(" | ");
  }

  return {
    summary,
    justification,
  };
}

function decorateProfileLine(line) {
  const wrapper = document.createElement("div");
  wrapper.className = "profile-entry-line";
  const parts = String(line || "").split(/([+-](?:\d+(?:\.\d+)?|\.\d+))/g).filter(Boolean);
  for (const part of parts) {
    if (/^[+-](?:\d+(?:\.\d+)?|\.\d+)$/.test(part)) {
      const span = document.createElement("span");
      span.className = `profile-entry-value ${part.startsWith("-") ? "negative" : "positive"}`;
      span.textContent = part;
      wrapper.appendChild(span);
    } else {
      wrapper.appendChild(document.createTextNode(part));
    }
  }
  return wrapper;
}

function canonicalTooltipKey(label = "") {
  return String(label || "").trim().replace(/_/g, " ").replace(/\s+/g, " ");
}

function buildTooltipSpan(label, displayText = null) {
  const span = document.createElement("span");
  span.className = "note-label-with-tip";
  span.textContent = displayText || label;
  const tip = NOTE_TOOLTIP_MAP[canonicalTooltipKey(label)] || NOTE_TOOLTIP_MAP[canonicalTooltipKey(displayText || label)];
  if (tip) {
    span.title = tip;
    span.dataset.tip = tip;
  }
  return span;
}

function renderNoteLine(note) {
  const div = document.createElement("div");
  div.className = "profile-entry-note";
  const text = String(note || "").trim();
  if (!text) return div;

  const gateMatch = text.match(/^(G\d_[^:]+):\s*(.+)$/);
  if (gateMatch) {
    div.appendChild(buildTooltipSpan(gateMatch[1], gateMatch[1].replace(/_/g, " ")));
    div.appendChild(document.createTextNode(`: ${gateMatch[2]}`));
    return div;
  }

  const riskMatch = text.match(/^risk:\s*([^|]+)\|\s*(.+)$/i);
  if (riskMatch) {
    div.appendChild(document.createTextNode("risk: "));
    div.appendChild(buildTooltipSpan(riskMatch[1].trim(), riskMatch[1].trim()));
    div.appendChild(document.createTextNode(` | ${riskMatch[2]}`));
    return div;
  }

  div.textContent = text;
  return div;
}

function buildLatestNotes() {
  const finalizedNotes = cleanStringList(state.latestCompile?.result?.finalized?.notes || []);
  const gateStates = state.latestCompile?.result?.finalized?.data?.diagnostics?.gateStates || {};
  const gateLines = Object.entries(gateStates)
    .filter(([, value]) => value && value.status && value.status !== "dormant")
    .map(([gate, value]) => `${gate}: ${value.status}`);
  return [...finalizedNotes, ...gateLines];
}

function renderProfileEntries() {
  els.profileEntriesList.innerHTML = "";
  els.profileNotesList.innerHTML = "";

  const historyEntries = state.compiledPayloads.map((payload) => summarizePayloadEntry(payload));
  const latestNotes = buildLatestNotes();

  setListCount(els.profileEntriesCount, historyEntries.length, "entry");
  setListCount(els.profileNotesCount, latestNotes.length, "note");

  if (!historyEntries.length) {
    const li = document.createElement("li");
    li.textContent = "No profile entry yet.";
    els.profileEntriesList.appendChild(li);
  } else {
    historyEntries.forEach((entry) => {
      const li = document.createElement("li");
      const summary = document.createElement("div");
      summary.className = "profile-entry-summary";
      summary.textContent = entry.summary;
      li.appendChild(summary);

      if (entry.justification) {
        const why = document.createElement("div");
        why.className = "profile-entry-note";
        why.textContent = entry.justification;
        li.appendChild(why);
      }
      els.profileEntriesList.appendChild(li);
    });
  }

  if (!latestNotes.length) {
    const li = document.createElement("li");
    li.textContent = "No notes yet.";
    els.profileNotesList.appendChild(li);
  } else {
    latestNotes.forEach((note) => {
      const li = document.createElement("li");
      li.appendChild(renderNoteLine(note));
      els.profileNotesList.appendChild(li);
    });
  }
}

function postPointToVisualizer(finalized) {
  if (!finalized || typeof finalized !== "object") return;
  els.visualizerFrame.contentWindow?.postMessage({ type: "set-profile", data: finalized }, "*");
}

function getStabilityTone(stability) {
  if (stability > 0.02) return "positive";
  if (stability < -0.02) return "negative";
  return "neutral";
}

function applyToneClass(element, tone) {
  element.classList.remove("tone-positive", "tone-neutral", "tone-negative");
  element.classList.add(`tone-${tone}`);
}

function renderAxisBar(fillEl, pointAxis, pointY) {
  const y = EpistemicProfiler.clamp(Number(pointY) || 0, -1, 1);
  const tone = getStabilityTone(y);
  const spanWidth = Math.abs(y) * 100;
  const slack = 100 - spanWidth;
  const lateralBudget = Math.max(1 - Math.abs(y), 0);
  const axisNormalized =
    lateralBudget > 1e-9 ? EpistemicProfiler.clamp((Number(pointAxis) || 0) / lateralBudget, -1, 1) : 0;
  const left = slack <= 0 ? 0 : ((axisNormalized + 1) / 2) * slack;

  applyToneClass(fillEl, tone);
  fillEl.style.width = `${spanWidth}%`;
  fillEl.style.left = `${left}%`;
  fillEl.style.opacity = spanWidth <= 0 ? "0" : "1";
}

function renderTopView(point = { x: 0, z: 0 }) {
  const x = EpistemicProfiler.clamp(Number(point.x) || 0, -1, 1);
  const z = EpistemicProfiler.clamp(Number(point.z) || 0, -1, 1);
  els.topViewDot.style.left = `${50 + x * DIAMOND_RANGE_PERCENT}%`;
  els.topViewDot.style.top = `${50 - z * DIAMOND_RANGE_PERCENT}%`;
}

function renderSideView(point = { y: 0 }) {
  const y = EpistemicProfiler.clamp(Number(point.y) || 0, -1, 1);
  els.sideViewLine.style.top = `${50 - y * DIAMOND_RANGE_PERCENT}%`;
}

function buildMathDump(result) {
  const finalizedData = result?.finalized?.data || {};
  const point = finalizedData.point || { x: 0, y: 0, z: 0 };
  const params = finalizedData.params || {};
  const semantics = params.semantics || { a: 0, b: 0, s: 0, yCoverage: 0 };
  const uiLike = params.uiLike || {};
  const diagnostics = finalizedData.diagnostics || {};
  const math = finalizedData.math || {};

  return [
    "semantic_params = {",
    `  a: ${formatSigned(semantics.a)},`,
    `  b: ${formatSigned(semantics.b)},`,
    `  s: ${formatSigned(semantics.s)},`,
    `  yCoverage: ${formatPercent((semantics.yCoverage || 0) * 100)},`,
    `  empathyPercent: ${formatPercent(uiLike.empathyPercent ?? 50)},`,
    `  practicalityPercent: ${formatPercent(uiLike.practicalityPercent ?? 50)},`,
    `  wisdomPercent: ${formatPercent(uiLike.wisdomPercent ?? 50)},`,
    `  knowledgePercent: ${formatPercent(uiLike.knowledgePercent ?? 50)},`,
    `  stabilityPercent: ${formatPercent(uiLike.stabilityPercent ?? 0)},`,
    `  coveragePercent: ${formatPercent(uiLike.coveragePercent ?? 0)}`,
    "}",
    "",
    "projected_surface_point = {",
    `  x: ${formatCoord(point.x)},`,
    `  y: ${formatCoord(point.y)},`,
    `  z: ${formatCoord(point.z)}`,
    "}",
    "",
    "latex = [",
    `  ${JSON.stringify(math.formulas?.axisAggregation || "")},`,
    `  ${JSON.stringify(math.formulas?.yEstimate || "")},`,
    `  ${JSON.stringify(math.formulas?.yCoverage || "")},`,
    `  ${JSON.stringify(math.formulas?.projection || "")},`,
    `  ${JSON.stringify(math.formulas?.originRule || "")},`,
    `  ${JSON.stringify(math.formulas?.surfaceRule || "")}`,
    "]",
    "",
    "diagnostics = " + JSON.stringify(diagnostics, null, 2),
    "",
    "sources = " + JSON.stringify(math.sources || {}, null, 2),
  ].join("\n");
}

function renderMathPanel(result) {
  els.mathDump.textContent = result ? buildMathDump(result) : "No stored profiler params yet.";
  els.mathWrap.classList.toggle("hidden", !state.mathOpen);
  els.toggleMathBtn.textContent = state.mathOpen ? "Hide math" : "Show math";
  els.toggleMathBtn.setAttribute("aria-expanded", String(state.mathOpen));
}

function renderEmptyStats() {
  renderAxisBar(els.statBarEP, 0, 0);
  renderAxisBar(els.statBarWK, 0, 0);
  renderTopView({ x: 0, z: 0 });
  renderSideView({ y: 0 });
}

function renderCompile() {
  const result = state.latestCompile?.result;
  if (!result) {
    renderEmptyStats();
    renderMathPanel(null);
    renderProfileEntries();
    return;
  }

  const finalizedData = result.finalized?.data || {};
  const point = finalizedData.point || result.point || { x: 0, y: 0, z: 0 };

  renderAxisBar(els.statBarEP, point.x, point.y);
  renderAxisBar(els.statBarWK, point.z, point.y);
  renderTopView(point);
  renderSideView(point);
  renderMathPanel(result);
  renderProfileEntries();

  if (!state.manualAvatar) {
    const picked = pickAvatarFromPoint(point);
    if (picked) {
      state.selectedAvatarId = picked.id;
      if (!state.name.trim()) {
        state.name = picked.title;
        els.profileName.textContent = state.name;
      }
    }
  }

  renderAvatars();
  postPointToVisualizer(result.finalized);
}

function exportProfile() {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          state: createExportableState(),
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(state.name || "philosophers-stone-profile").replace(/\s+/g, "-").toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importProfile(file) {
  if (!file) return;
  const text = await file.text();
  const parsed = JSON.parse(text);
  Object.assign(state, migrateState(parsed.state || parsed));
  rebuildFromCompiledPayloads();
  renderAll();
  saveState();
}

function resetWorkspace() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function renderAll() {
  els.profileText.value = state.profileText || "";
  els.llmOutput.value = state.llmOutput || "";
  els.profileName.textContent = state.name || "";
  els.profileAdditionalInfo.value = state.additionalInfo || "";
  autoResizeTextarea(els.profileText);
  renderAvatars();
  renderCanonLists();
  renderPacketPreview();
  renderCompile();
}

function compilePayload() {
  const previousCompile = state.latestCompile;
  const raw = sanitizeJSONInput(state.llmOutput);
  if (!raw) throw new Error("Paste LLM output before compiling.");

  const { payload } = parseLLMOutput(raw);
  const payloadFingerprint = fingerprintPayload(payload);
  if (payloadFingerprint && payloadFingerprint === previousCompile?.payloadFingerprint) {
    return { duplicate: true, didCompile: false, didCanonUpdate: false };
  }

  const extractedCanon = extractCanonFromPayload(payload);
  const hadScorableSignals = payloadHasScorableSignals(payload);
  const hadCanonSignals =
    extractedCanon.mode === "maintain" ||
    (extractedCanon.canon?.principles?.length || 0) > 0 ||
    (extractedCanon.canon?.boundaries?.length || 0) > 0;

  let result = previousCompile?.result || null;
  let stabilityDelta = null;

  if (hadScorableSignals) {
    profiler.addLLMOutput(payload);
    result = profiler.computePoint();
    state.compiledPayloads.push(payload);

    const previousStability = Number(previousCompile?.result?.finalized?.data?.params?.uiLike?.stabilityPercent);
    const nextStability = Number(result?.finalized?.data?.params?.uiLike?.stabilityPercent);
    stabilityDelta =
      Number.isFinite(previousStability) && Number.isFinite(nextStability)
        ? nextStability - previousStability
        : null;

    state.latestCompile = {
      payload,
      payloadFingerprint,
      result,
      stabilityDelta,
      compiledAt: new Date().toISOString(),
    };
  } else if (!hadCanonSignals) {
    throw new Error(
      "LLM payload must contain usable evidence, structured signals, compact profile signals, or canon optimization.",
    );
  }

  state.canon = applyCanonUpdate(state.canon, extractedCanon);
  const profileState = state.latestCompile?.result?.finalized?.data?.diagnostics?.profileState || {};
  state.canon = canonicalizeCanonState({
    principles: [...state.canon.principles, ...(profileState.core_principles || [])],
    boundaries: [...state.canon.boundaries, ...(profileState.core_boundaries || [])],
  });

  renderCanonLists();
  renderPacketPreview();
  renderCompile();
  saveState();

  return {
    duplicate: false,
    didCompile: hadScorableSignals,
    didCanonUpdate: hadCanonSignals,
  };
}

function bind() {
  attachDropBehavior(els.canonLists.principles, "principles");
  attachDropBehavior(els.canonLists.boundaries, "boundaries");

  els.profileText.addEventListener("input", () => {
    state.profileText = els.profileText.value;
    autoResizeTextarea(els.profileText);
    renderPacketPreview();
    saveState();
  });

  els.llmOutput.addEventListener("input", () => {
    state.llmOutput = els.llmOutput.value;
    saveState();
  });

  const syncProfileName = () => {
    state.name = els.profileName.textContent.trim();
    saveState();
  };

  els.profileName.addEventListener("input", syncProfileName);
  els.profileName.addEventListener("blur", () => {
    els.profileName.textContent = els.profileName.textContent.trim();
    syncProfileName();
  });

  els.profileAdditionalInfo.addEventListener("input", () => {
    state.additionalInfo = els.profileAdditionalInfo.value;
    saveState();
  });

  els.copyPacketBtn.addEventListener("click", async () => {
    try {
      await copyTextToClipboard(buildPacket());
      setButtonFeedback(els.copyPacketBtn, "Copied");
    } catch {
      setButtonFeedback(els.copyPacketBtn, "Copy failed");
    }
  });

  els.copyProfilerAssessmentBtn.addEventListener("click", async () => {
    try {
      await copyTextToClipboard(buildProfilerAssessment());
      setButtonFeedback(els.copyProfilerAssessmentBtn, "Copied");
    } catch {
      setButtonFeedback(els.copyProfilerAssessmentBtn, "Copy failed");
    }
  });

  els.togglePacketPreviewBtn.addEventListener("click", () => {
    const hidden = els.packetPreviewWrap.classList.toggle("hidden");
    els.togglePacketPreviewBtn.textContent = hidden ? "Show hidden packet" : "Hide hidden packet";
    els.togglePacketPreviewBtn.setAttribute("aria-expanded", String(!hidden));
    if (!hidden) renderPacketPreview();
  });

  els.refreshPacketBtn.addEventListener("click", renderPacketPreview);

  els.toggleMathBtn.addEventListener("click", () => {
    state.mathOpen = !state.mathOpen;
    renderMathPanel(state.latestCompile?.result || null);
    saveState();
  });

  els.compileBtn.addEventListener("click", () => {
    try {
      const outcome = compilePayload();
      if (outcome.duplicate) {
        setCompileStatus("Same payload already compiled. Duplicate entry skipped.", "is-success");
      } else if (outcome.didCompile && outcome.didCanonUpdate) {
        setCompileStatus("Compiled aggregate and refreshed canon.", "is-success");
      } else if (outcome.didCompile) {
        setCompileStatus("Compiled aggregate and merged into profile.", "is-success");
      } else {
        setCompileStatus("Canon updated.", "is-success");
      }
    } catch (error) {
      setCompileStatus(error.message || "Compile failed.", "is-error");
    }
  });

  els.addCanonBtn.addEventListener("click", () => {
    const value = els.canonInput.value.trim();
    const type = els.canonType.value;
    if (!value) return;
    state.canon[type] = canonicalizeCanonList([...(state.canon[type] || []), value]);
    els.canonInput.value = "";
    renderCanonLists();
    renderPacketPreview();
    saveState();
  });

  els.exportProfileBtn.addEventListener("click", exportProfile);
  els.importProfileBtn.addEventListener("click", () => els.importProfileInput.click());
  els.importProfileInput.addEventListener("change", async (event) => {
    try {
      await importProfile(event.target.files?.[0]);
      setCompileStatus("Profile imported.", "is-success");
    } catch (error) {
      setCompileStatus(error.message || "Import failed.", "is-error");
    } finally {
      event.target.value = "";
    }
  });

  els.resetWorkspaceBtn.addEventListener("click", resetWorkspace);

  els.pasteLlmOutputBtn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      state.llmOutput = String(text || "").trim();
      els.llmOutput.value = state.llmOutput;
      saveState();
      setCompileStatus("Pasted latest output.", "is-success");
    } catch {
      setCompileStatus("Paste failed. Clipboard permissions may be blocked.", "is-error");
    }
  });

  const toggleAvatarPicker = () => {
    state.avatarPickerOpen = !state.avatarPickerOpen;
    renderAvatars();
    saveState();
  };

  els.toggleAvatarGridBtn.addEventListener("click", toggleAvatarPicker);
  els.selectedAvatarBtn.addEventListener("click", toggleAvatarPicker);

  document.addEventListener("click", (event) => {
    if (!state.avatarPickerOpen) return;
    const target = event.target;
    if (
      els.avatarGrid.contains(target) ||
      els.toggleAvatarGridBtn.contains(target) ||
      els.selectedAvatarBtn.contains(target)
    ) {
      return;
    }
    state.avatarPickerOpen = false;
    renderAvatars();
    saveState();
  });

  els.refreshVisualizerBtn.addEventListener("click", () => {
    const finalized = state.latestCompile?.result?.finalized;
    if (finalized) postPointToVisualizer(finalized);
  });

  els.visualizerFrame.addEventListener("load", () => {
    const finalized = state.latestCompile?.result?.finalized;
    if (finalized) postPointToVisualizer(finalized);
  });
}

hydrateState();
rebuildFromCompiledPayloads();
renderAll();
bind();
