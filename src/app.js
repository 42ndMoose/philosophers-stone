
import {
  buildLLMPacket,
  buildProfilerAssessmentPacket,
} from "./contracts.js";
import { AVATARS, getAvatarById, pickAvatarFromPoint } from "./avatars.js";
import { EpistemicProfiler } from "./profiler.js";

const STORAGE_KEY = "philosophers-stone-workspace-v5";
const BUTTON_RESET_MS = 1500;
const DIAMOND_RANGE_PERCENT = 34;

const GATE_DEFINITIONS = {
  G1_counter_consideration: "Recognizes a real opposing consideration instead of pretending none exists.",
  G2_non_strawman: "Represents the opposing side fairly enough to stay in contact with reality.",
  G3_self_correction: "Allows that the speaker could be wrong and open to revision.",
  G4_contradiction_handling: "Faces contradiction honestly instead of dodging or hand-waving it.",
  G5_reality_contact: "Stays tethered to real constraints, outcomes, and lived consequences.",
  G6_non_self_sealing: "Avoids making the argument unfalsifiable or closed against correction.",
};

const SIGNAL_DEFINITIONS = {
  counter_consideration: "Shows awareness of a real competing consideration.",
  self_correction: "Shows willingness to revise or correct oneself.",
  reality_contact: "Stays grounded in real constraints, outcomes, or consequences.",
  coherence: "The argument holds together internally.",
  error_awareness: "Shows awareness of possible mistakes or limits.",
  revision_openness: "Shows openness to changing position when warranted.",
  non_strawman_fairness: "Represents the opposing view in recognizable terms before criticizing it.",
  false_certainty: "Presents certainty without enough room for correction.",
  self_sealing: "Frames the view so criticism cannot really count against it.",
  contradiction_evasion: "Dodges contradiction rather than dealing with it.",
  reality_detachment: "Loses contact with real-world constraint or consequence.",
  dogmatic_closure: "Closes inquiry too quickly.",
  collapse_marker: "Shows strong epistemic breakdown or reality-collapse markers.",
  strawman_dependence: "Leans on a caricature of the opposing side.",
  broad_motive_attribution: "Assigns sweeping motives too broadly without enough grounding.",
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
    principles: {
      items: document.getElementById("principlesList"),
      suggested: document.getElementById("principlesSuggestedList"),
    },
    boundaries: {
      items: document.getElementById("boundariesList"),
      suggested: document.getElementById("boundariesSuggestedList"),
    },
  },
};

const profiler = new EpistemicProfiler();

function createCanonItem(text, pinned = false, id = null) {
  return {
    id: id || (globalThis.crypto?.randomUUID?.() || `canon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
    text: String(text || "").trim(),
    pinned: Boolean(pinned),
  };
}

function canonKey(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildEmptyCanonBucket() {
  return { items: [], suggested: [] };
}

function buildEmptyCanonState() {
  return {
    principles: buildEmptyCanonBucket(),
    boundaries: buildEmptyCanonBucket(),
  };
}

function normalizeCanonItems(items = []) {
  const out = [];
  const seen = new Set();
  for (const item of Array.isArray(items) ? items : [items]) {
    const obj = item && typeof item === "object" && !Array.isArray(item)
      ? createCanonItem(item.text || item.value || item.normalized || "", item.pinned, item.id)
      : createCanonItem(item);
    if (!obj.text) continue;
    const key = canonKey(obj.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(obj);
  }
  return out;
}

function normalizeCanonBucket(input) {
  const bucket = buildEmptyCanonBucket();
  if (Array.isArray(input)) {
    bucket.items = normalizeCanonItems(input);
    return bucket;
  }
  if (!input || typeof input !== "object") return bucket;
  if (Array.isArray(input.items) || Array.isArray(input.suggested)) {
    bucket.items = normalizeCanonItems(input.items || []);
    bucket.suggested = normalizeCanonItems(input.suggested || []);
    return bucket;
  }
  const flattened = [
    ...(Array.isArray(input.core) ? input.core : []),
    ...(Array.isArray(input.supporting) ? input.supporting : []),
    ...(Array.isArray(input.conditional) ? input.conditional : []),
  ];
  bucket.items = normalizeCanonItems(flattened);
  return bucket;
}

function normalizeCanonState(input) {
  return {
    principles: normalizeCanonBucket(input?.principles),
    boundaries: normalizeCanonBucket(input?.boundaries),
  };
}

function cloneCanon(canon = buildEmptyCanonState()) {
  return {
    principles: {
      items: normalizeCanonItems(canon.principles?.items || canon.principles || []),
      suggested: normalizeCanonItems(canon.principles?.suggested || []),
    },
    boundaries: {
      items: normalizeCanonItems(canon.boundaries?.items || canon.boundaries || []),
      suggested: normalizeCanonItems(canon.boundaries?.suggested || []),
    },
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

function canonTextList(type, section = "items") {
  return (state.canon[type]?.[section] || []).map((item) => item.text);
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

function migrateState(parsed = {}) {
  return {
    profileText: String(parsed.profileText || ""),
    llmOutput: String(parsed.llmOutput || ""),
    name: String(parsed.name || ""),
    additionalInfo: String(parsed.additionalInfo || parsed.age || ""),
    selectedAvatarId: parsed.selectedAvatarId || null,
    manualAvatar: Boolean(parsed.manualAvatar),
    canon: normalizeCanonState(parsed.canon || {
      principles: parsed.principles || [],
      boundaries: parsed.boundaries || [],
    }),
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

function sortCanonItems(type) {
  const bucket = state.canon[type].items;
  const pinned = bucket.filter((item) => item.pinned);
  const unpinned = bucket.filter((item) => !item.pinned);
  state.canon[type].items = [...pinned, ...unpinned];
}

function makeCanonItemElement(type, section, item, index) {
  const li = document.createElement("li");
  li.className = `canon-item${item.pinned ? " is-pinned" : ""}`;
  li.draggable = !item.pinned;
  li.dataset.type = type;
  li.dataset.section = section;
  li.dataset.index = String(index);
  li.innerHTML = `
    <span class="drag-pill">${item.pinned ? "📌" : "⋮⋮"}</span>
    <div class="canon-item-text">${item.text}</div>
    <div class="canon-item-actions">
      <button type="button" class="pin-item-btn${item.pinned ? " active" : ""}" aria-label="${item.pinned ? "Unpin item" : "Pin item"}" title="${item.pinned ? "Unpin item" : "Pin item"}">📌</button>
      <button type="button" class="delete-item-btn" aria-label="Delete item" title="Delete item"${item.pinned ? " disabled" : ""}>×</button>
    </div>
  `;

  li.addEventListener("dragstart", () => {
    if (item.pinned) return;
    li.classList.add("is-dragging");
  });

  li.addEventListener("dragend", () => {
    li.classList.remove("is-dragging");
    document.querySelectorAll(".canon-list").forEach((list) => list.classList.remove("is-drop-target"));
  });

  li.querySelector(".delete-item-btn").addEventListener("click", () => {
    if (item.pinned) return;
    state.canon[type][section].splice(index, 1);
    renderCanonLists();
    renderPacketPreview();
    saveState();
  });

  li.querySelector(".pin-item-btn").addEventListener("click", () => {
    if (section === "suggested") {
      state.canon[type].suggested.splice(index, 1);
      state.canon[type].items.unshift(createCanonItem(item.text, true));
      sortCanonItems(type);
    } else {
      state.canon[type].items[index].pinned = !state.canon[type].items[index].pinned;
      sortCanonItems(type);
    }
    renderCanonLists();
    renderPacketPreview();
    saveState();
  });

  return li;
}

function attachDropBehavior(listEl, type, section) {
  listEl.addEventListener("dragover", (event) => {
    const dragging = document.querySelector(".canon-item.is-dragging");
    if (!dragging) return;
    if (dragging.dataset.type !== type || dragging.dataset.section !== section) return;
    event.preventDefault();
    listEl.classList.add("is-drop-target");
  });

  listEl.addEventListener("dragleave", () => {
    listEl.classList.remove("is-drop-target");
  });

  listEl.addEventListener("drop", (event) => {
    const dragging = document.querySelector(".canon-item.is-dragging");
    listEl.classList.remove("is-drop-target");
    if (!dragging) return;
    if (dragging.dataset.type !== type || dragging.dataset.section !== section) return;
    event.preventDefault();

    const bucket = state.canon[type][section];
    const sourceIndex = Number(dragging.dataset.index);
    const [moved] = bucket.splice(sourceIndex, 1);
    if (!moved) return;

    const candidates = [...listEl.querySelectorAll(".canon-item:not(.is-dragging):not(.is-pinned)")];
    const after = candidates.find((item) => {
      const rect = item.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    const targetIndex = after ? Number(after.dataset.index) : bucket.length;
    bucket.splice(targetIndex, 0, moved);
    sortCanonItems(type);
    renderCanonLists();
    renderPacketPreview();
    saveState();
  });
}

function renderCanonLists() {
  for (const type of ["principles", "boundaries"]) {
    sortCanonItems(type);
    const itemsEl = els.canonLists[type].items;
    const suggestedEl = els.canonLists[type].suggested;
    itemsEl.innerHTML = "";
    suggestedEl.innerHTML = "";

    state.canon[type].items.forEach((item, index) => {
      itemsEl.appendChild(makeCanonItemElement(type, "items", item, index));
    });

    state.canon[type].suggested.forEach((item, index) => {
      suggestedEl.appendChild(makeCanonItemElement(type, "suggested", item, index));
    });
  }
}

function getLatestProfilerMemory() {
  return state.latestCompile?.result?.finalized?.data?.diagnostics?.profileState || {};
}

function buildPacket() {
  return buildLLMPacket({
    profileText: state.profileText,
    currentPrinciples: canonTextList("principles", "items"),
    currentBoundaries: canonTextList("boundaries", "items"),
    suggestedPrinciples: canonTextList("principles", "suggested"),
    suggestedBoundaries: canonTextList("boundaries", "suggested"),
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
    computed: {
      point: finalizedData.point,
      params: finalizedData.params,
      coveragePercent: finalizedData.params?.uiLike?.coveragePercent,
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
          item.text || item.value || item.principle || item.boundary || item.normalized || "",
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
    (Array.isArray(profileUpdates.new_boundaries) ? profileUpdates.new_boundaries.length : 0)
  );
}

function payloadHasScorableSignals(payload = {}) {
  return payload && typeof payload === "object" && countStructuredSignals(payload) > 0;
}

function setListCount(element, count, singularLabel, pluralLabel) {
  if (!element) return;
  const resolvedPluralLabel = pluralLabel || (singularLabel.endsWith("y") ? `${singularLabel.slice(0, -1)}ies` : `${singularLabel}s`);
  element.textContent = `${count} ${count === 1 ? singularLabel : resolvedPluralLabel}`;
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
    if (char === openChar) depth += 1;
    else if (char === closeChar) {
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
    null;

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

  return {
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
    canonOptimization,
  };
}

function extractCanonFromText(rawText = "") {
  const lines = String(rawText || "").split("\n");
  let section = "";
  const principles = [];
  const boundaries = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^principles?\b\s*:?$/i.test(trimmed)) { section = "principles"; continue; }
    if (/^boundaries?\b\s*:?$/i.test(trimmed)) { section = "boundaries"; continue; }
    const item = trimmed.replace(/^[-*\d.)\s]+/, "").trim();
    if (!item) continue;
    if (section === "principles") principles.push(item);
    if (section === "boundaries") boundaries.push(item);
  }
  return {
    principles: { items: normalizeCanonItems(principles), suggested: [] },
    boundaries: { items: normalizeCanonItems(boundaries), suggested: [] },
  };
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
    canonOptimization: parsed.canonOptimization || parsed.canon_optimization || parsed.canonUpdate || parsed.canon_update || undefined,
  };
}

function parseLLMOutput(raw) {
  const parsed = tryParseJSON(raw) || tryParseJSON(repairLikelyPayload(raw)) || parseLoosePayload(raw);
  const canonFromText = extractCanonFromText(raw);
  if (parsed && typeof parsed === "object") {
    return { payload: normalizeParsedPayload(parsed), canonFromText };
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
    canonFromText,
  };
}

function extractCanonFromPayload(payload = {}) {
  const profileUpdates = payload.profile_update_signals || {};
  const localExtraction = payload.local_extraction || {};
  const optim = payload.canonOptimization || {};

  const explicitPrinciples = [
    ...cleanStringList(profileUpdates.new_principles || []),
    ...cleanStringList(profileUpdates.refined_principles || []),
  ];
  const explicitBoundaries = [
    ...cleanStringList(profileUpdates.new_boundaries || []),
    ...cleanStringList(profileUpdates.refined_boundaries || []),
  ];

  const fallbackPrinciples = cleanStringList(localExtraction.principles || []);
  const fallbackBoundaries = cleanStringList(localExtraction.boundaries || []);

  return {
    canon: {
      principles: {
        items: normalizeCanonItems(explicitPrinciples.length ? explicitPrinciples : fallbackPrinciples),
        suggested: normalizeCanonItems(optim.principles || optim.suggestedPrinciples || []),
      },
      boundaries: {
        items: normalizeCanonItems(explicitBoundaries.length ? explicitBoundaries : fallbackBoundaries),
        suggested: normalizeCanonItems(optim.boundaries || optim.suggestedBoundaries || []),
      },
    },
    notes: cleanStringList(optim.notes || []),
  };
}

function mergeCanonItems(baseItems = [], newItems = []) {
  const out = [...normalizeCanonItems(baseItems)];
  const seen = new Set(out.map((item) => canonKey(item.text)));
  for (const item of normalizeCanonItems(newItems)) {
    const key = canonKey(item.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function applyCanonUpdate(targetCanon, extracted) {
  const next = cloneCanon(targetCanon);
  if (!extracted || !extracted.canon) return next;
  for (const type of ["principles", "boundaries"]) {
    next[type].items = mergeCanonItems(next[type].items, extracted.canon[type].items || []);
    next[type].suggested = normalizeCanonItems(extracted.canon[type].suggested || []);
  }
  return next;
}

function rebuildFromCompiledPayloads() {
  profiler.reset();
  let workingCanon = buildEmptyCanonState();
  let previousStability = null;
  let lastPayload = null;
  let lastResult = null;
  let stabilityDelta = null;

  for (const payload of state.compiledPayloads) {
    profiler.addLLMOutput(payload);
    lastResult = profiler.computePoint();
    lastPayload = payload;

    workingCanon = applyCanonUpdate(workingCanon, extractCanonFromPayload(payload));

    const nextStability = Number(lastResult.finalized?.data?.point?.y);
    stabilityDelta =
      Number.isFinite(previousStability) && Number.isFinite(nextStability)
        ? nextStability - previousStability
        : null;
    previousStability = nextStability;
  }

  state.canon = workingCanon;
  if (!lastPayload || !lastResult) {
    state.latestCompile = null;
    return;
  }
  state.latestCompile = {
    payload: lastPayload,
    result: lastResult,
    stabilityDelta,
    compiledAt: new Date().toISOString(),
    rawLLMOutput: state.latestCompile?.rawLLMOutput || "",
  };
}

function decorateProfileLine(line) {
  const wrapper = document.createElement("div");
  wrapper.className = "profile-entry-line";
  const parts = String(line || "")
    .split(/([+-](?:\d+(?:\.\d+)?|\.\d+))/g)
    .filter(Boolean);
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

function prettyLabel(value = "") {
  return String(value || "").replace(/^G\d_/, "").replace(/_/g, " ").trim();
}

function summarizeAxisLean(poleEvidence = [], integrationEvents = [], positivePole, negativePole, axisTag) {
  const scoreFor = (pole) =>
    (Array.isArray(poleEvidence) ? poleEvidence : [])
      .filter((item) => String(item.pole || "").toLowerCase() === pole)
      .reduce((sum, item) => {
        const strength = { weak: 0.25, moderate: 0.5, strong: 0.85 }[String(item.strength || "moderate").toLowerCase()] || 0.5;
        const confidence = Math.max(0, Math.min(1, Number(item.confidence ?? 1)));
        return sum + strength * confidence;
      }, 0);

  const positive = scoreFor(positivePole);
  const negative = scoreFor(negativePole);
  const integration = (Array.isArray(integrationEvents) ? integrationEvents : []).length;
  const delta = positive - negative;
  if (positive <= 0 && negative <= 0 && integration <= 0) return null;
  if (Math.abs(delta) < 0.08 && integration > 0) return `${axisTag} balanced`;
  if (Math.abs(delta) < 0.08 && positive > 0 && negative > 0) return `${axisTag} balanced`;
  return `${axisTag} leans ${delta >= 0 ? positivePole : negativePole}`;
}

function summarizeCompileEntry(payload = {}) {
  const summary = cleanStringList(payload.profile || [])[0] || cleanStringList(payload?.local_extraction?.principles || [])[0] || "Compiled philosophy entry.";
  const axisEvents = payload.axis_events || {};
  const detailParts = [];

  const xText = summarizeAxisLean(axisEvents.x_pole_evidence, axisEvents.x_integration_events, "empathy", "practicality", "x");
  const zText = summarizeAxisLean(axisEvents.z_pole_evidence, axisEvents.z_integration_events, "wisdom", "knowledge", "z");

  if (xText) detailParts.push(xText);
  if (zText) detailParts.push(zText);

  const positiveSignal = (payload.local_y_positive_signals || [])[0];
  const negativeSignal = (payload.local_y_negative_signals || [])[0];
  const positiveGate = (payload.triggered_gate_events || []).find((item) => item.direction === "positive");
  const negativeGate = (payload.triggered_gate_events || []).find((item) => item.direction === "negative");

  if (positiveSignal) detailParts.push(`y support: ${prettyLabel(positiveSignal.type || positiveSignal.signal_type)}`);
  else if (positiveGate) detailParts.push(`y support: ${prettyLabel(positiveGate.gate)}`);

  if (negativeSignal) detailParts.push(`risk: ${prettyLabel(negativeSignal.type || negativeSignal.signal_type)}`);
  else if (negativeGate) detailParts.push(`risk: ${prettyLabel(negativeGate.gate)}`);

  return { summary, detail: detailParts.join(" | ") };
}

function noteDefinitionFromText(text = "") {
  for (const [gate, definition] of Object.entries(GATE_DEFINITIONS)) {
    if (text.includes(gate) || text.toLowerCase().includes(prettyLabel(gate))) return definition;
  }
  for (const [signal, definition] of Object.entries(SIGNAL_DEFINITIONS)) {
    if (text.toLowerCase().includes(signal.replace(/_/g, " "))) return definition;
    if (text.toLowerCase().includes(signal)) return definition;
  }
  return "";
}

function buildProfileNotes() {
  const result = state.latestCompile?.result;
  const payload = state.latestCompile?.payload || {};
  const notes = [];

  for (const signal of payload.local_y_negative_signals || []) {
    notes.push({
      text: `risk: ${prettyLabel(signal.type || signal.signal_type)} | ${signal.evidence_span || ""}`.trim(),
      tooltip: SIGNAL_DEFINITIONS[String(signal.type || signal.signal_type || "").toLowerCase()] || "",
    });
  }

  for (const event of payload.triggered_gate_events || []) {
    notes.push({
      text: `${event.gate} ${event.direction} | ${event.evidence_span || ""}`.trim(),
      tooltip: GATE_DEFINITIONS[event.gate] || "",
    });
  }

  const gateStates = result?.finalized?.data?.diagnostics?.gateStates || {};
  for (const [gate, data] of Object.entries(gateStates)) {
    if (!data || data.status === "dormant") continue;
    notes.push({
      text: `${gate}: ${data.status} | ${data.last_evidence_span || ""}`.trim(),
      tooltip: GATE_DEFINITIONS[gate] || "",
    });
  }

  for (const note of cleanStringList(result?.finalized?.notes || [])) {
    notes.push({ text: note, tooltip: noteDefinitionFromText(note) });
  }

  const deduped = [];
  const seen = new Set();
  for (const note of notes) {
    const key = canonKey(note.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(note);
  }
  return deduped;
}

function renderProfileEntries() {
  els.profileEntriesList.innerHTML = "";
  els.profileNotesList.innerHTML = "";

  const entries = state.compiledPayloads.map((payload) => summarizeCompileEntry(payload));
  const notes = buildProfileNotes();

  setListCount(els.profileEntriesCount, entries.length, "entry");
  setListCount(els.profileNotesCount, notes.length, "note");

  if (!entries.length) {
    const li = document.createElement("li");
    li.textContent = "No compiled profile entry yet.";
    els.profileEntriesList.appendChild(li);
  } else {
    entries.forEach((entry) => {
      const li = document.createElement("li");
      const summaryDiv = document.createElement("div");
      summaryDiv.className = "profile-entry-summary";
      summaryDiv.textContent = entry.summary;
      li.appendChild(summaryDiv);
      if (entry.detail) {
        const detailDiv = document.createElement("div");
        detailDiv.className = "profile-entry-note";
        detailDiv.textContent = entry.detail;
        li.appendChild(detailDiv);
      }
      els.profileEntriesList.appendChild(li);
    });
  }

  if (!notes.length) {
    const li = document.createElement("li");
    li.textContent = "No notes yet.";
    els.profileNotesList.appendChild(li);
  } else {
    notes.forEach((note) => {
      const li = document.createElement("li");
      const div = document.createElement("div");
      div.className = "profile-entry-note";
      div.textContent = note.text;
      if (note.tooltip) div.title = note.tooltip;
      li.appendChild(div);
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

function renderAxisBar(fillEl, axisPointValue, projectedYValue) {
  const tone = getStabilityTone(projectedYValue);
  const spanWidth = EpistemicProfiler.clamp(Math.abs(Number(projectedYValue) || 0), 0, 1) * 100;
  const slack = 100 - spanWidth;
  const axis = EpistemicProfiler.clamp(Number(axisPointValue) || 0, -1, 1);
  const left = slack <= 0 ? 0 : ((axis + 1) / 2) * slack;
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
  const projectedPercentages = math.values?.projectedPercentages || {
    empathy: ((Number(point.x) || 0) + 1) * 50,
    practicality: 100 - (((Number(point.x) || 0) + 1) * 50),
    wisdom: ((Number(point.z) || 0) + 1) * 50,
    knowledge: 100 - (((Number(point.z) || 0) + 1) * 50),
    stability: Math.abs(Number(point.y) || 0) * 100,
    coverage: uiLike.coveragePercent ?? 0,
  };
  return [
    "semantic_params = {",
    `  a: ${formatSigned(semantics.a)},`,
    `  b: ${formatSigned(semantics.b)},`,
    `  s: ${formatSigned(semantics.s)},`,
    `  yCoverage: ${formatPercent((semantics.yCoverage || 0) * 100)}`,
    "}",
    "",
    "semantic_percentages = {",
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
    "projected_percentages = {",
    `  empathyPercent: ${formatPercent(projectedPercentages.empathy ?? 50)},`,
    `  practicalityPercent: ${formatPercent(projectedPercentages.practicality ?? 50)},`,
    `  wisdomPercent: ${formatPercent(projectedPercentages.wisdom ?? 50)},`,
    `  knowledgePercent: ${formatPercent(projectedPercentages.knowledge ?? 50)},`,
    `  stabilityPercent: ${formatPercent(projectedPercentages.stability ?? 0)},`,
    `  coveragePercent: ${formatPercent(projectedPercentages.coverage ?? 0)}`,
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

  if (!state.selectedAvatarId) {
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

function compilePayload() {
  const previousCompile = state.latestCompile;
  const raw = sanitizeJSONInput(state.llmOutput);
  if (!raw) throw new Error("Paste LLM output before compiling.");
  if (previousCompile?.rawLLMOutput && previousCompile.rawLLMOutput === raw) {
    throw new Error("That exact JSON has already been compiled.");
  }

  const { payload, canonFromText } = parseLLMOutput(raw);
  const hadScorableSignals = payloadHasScorableSignals(payload);
  if (!hadScorableSignals && !canonFromText.principles.items.length && !canonFromText.boundaries.items.length) {
    throw new Error("LLM payload must contain usable evidence, structured signals, or canon suggestions.");
  }

  let result = previousCompile?.result || null;
  let stabilityDelta = null;

  if (hadScorableSignals) {
    profiler.addLLMOutput(payload);
    result = profiler.computePoint();
    state.compiledPayloads.push(payload);

    const previousY = Number(previousCompile?.result?.finalized?.data?.point?.y);
    const nextY = Number(result?.finalized?.data?.point?.y);
    stabilityDelta =
      Number.isFinite(previousY) && Number.isFinite(nextY)
        ? nextY - previousY
        : null;

    state.latestCompile = {
      payload,
      result,
      stabilityDelta,
      compiledAt: new Date().toISOString(),
      rawLLMOutput: raw,
    };
  }

  state.canon = applyCanonUpdate(state.canon, extractCanonFromPayload(payload));
  state.canon = applyCanonUpdate(state.canon, { canon: canonFromText });

  renderCanonLists();
  renderPacketPreview();
  renderCompile();
  saveState();

  return { didCompile: hadScorableSignals };
}

function exportProfile() {
  const blob = new Blob(
    [JSON.stringify({ exportedAt: new Date().toISOString(), state: createExportableState() }, null, 2)],
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
  const parsed = JSON.parse(await file.text());
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

function bind() {
  for (const type of ["principles", "boundaries"]) {
    attachDropBehavior(els.canonLists[type].items, type, "items");
    attachDropBehavior(els.canonLists[type].suggested, type, "suggested");
  }

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
      compilePayload();
      setCompileStatus("Compiled aggregate and merged into profile.", "is-success");
    } catch (error) {
      setCompileStatus(error.message || "Compile failed.", "is-error");
    }
  });

  els.addCanonBtn.addEventListener("click", () => {
    const value = els.canonInput.value.trim();
    const type = els.canonType.value;
    if (!value) return;
    state.canon[type].items.push(createCanonItem(value));
    sortCanonItems(type);
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
    ) return;
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
