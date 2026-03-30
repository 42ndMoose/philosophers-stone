import {
  CANON_LAYER_KEYS,
  buildLLMPacket,
  buildProfilerAssessmentPacket,
  createEmptyLayeredCanon,
  hasAnyLayeredItems,
  normalizeLayeredCanon,
} from "./contracts.js";
import { AVATARS, getAvatarById, pickAvatarFromPoint } from "./avatars.js";
import { EpistemicProfiler } from "./profiler.js";

const STORAGE_KEY = "philosophers-stone-workspace-v5";
const BUTTON_RESET_MS = 1500;
const DIAMOND_RANGE_PERCENT = 34;

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
  canonLayer: document.getElementById("canonLayer"),
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
    principles: Object.fromEntries(
      CANON_LAYER_KEYS.map((key) => [
        key,
        document.getElementById(`principlesList-${key}`),
      ]),
    ),
    boundaries: Object.fromEntries(
      CANON_LAYER_KEYS.map((key) => [
        key,
        document.getElementById(`boundariesList-${key}`),
      ]),
    ),
  },
};

const profiler = new EpistemicProfiler();

function buildEmptyCanonState() {
  return {
    principles: createEmptyLayeredCanon(),
    boundaries: createEmptyLayeredCanon(),
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

function cloneCanon(canon = buildEmptyCanonState()) {
  return {
    principles: normalizeLayeredCanon(canon.principles),
    boundaries: normalizeLayeredCanon(canon.boundaries),
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
  return {
    principles: normalizeLayeredCanon(input?.principles),
    boundaries: normalizeLayeredCanon(input?.boundaries),
  };
}

function migrateState(parsed = {}) {
  const migrated = {
    profileText: String(parsed.profileText || ""),
    llmOutput: String(parsed.llmOutput || ""),
    name: String(parsed.name || ""),
    additionalInfo: String(parsed.additionalInfo || parsed.age || ""),
    selectedAvatarId: parsed.selectedAvatarId || null,
    manualAvatar: Boolean(parsed.manualAvatar),
    canon: buildEmptyCanonState(),
    latestCompile: parsed.latestCompile || null,
    compiledPayloads: Array.isArray(parsed.compiledPayloads)
      ? parsed.compiledPayloads
      : [],
    avatarPickerOpen: false,
    mathOpen: Boolean(parsed.mathOpen),
  };

  if (parsed.canon) {
    migrated.canon = ensureCanonShape(parsed.canon);
  } else {
    migrated.canon = {
      principles: normalizeLayeredCanon(parsed.principles || []),
      boundaries: normalizeLayeredCanon(parsed.boundaries || []),
    };
  }

  return migrated;
}

function hydrateState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    Object.assign(state, migrateState(parsed));
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

function makeCanonItem(text, type, layerKey, index) {
  const li = document.createElement("li");
  li.className = "canon-item";
  li.draggable = true;
  li.dataset.type = type;
  li.dataset.layerKey = layerKey;
  li.dataset.index = String(index);
  li.innerHTML = `
    <span class="drag-pill">⋮⋮</span>
    <div>${text}</div>
    <button type="button" class="delete-item-btn" aria-label="Delete item">×</button>
  `;

  li.addEventListener("dragstart", () => {
    li.classList.add("is-dragging");
  });

  li.addEventListener("dragend", () => {
    li.classList.remove("is-dragging");
    document
      .querySelectorAll(".canon-list")
      .forEach((list) => list.classList.remove("is-drop-target"));
  });

  li.querySelector(".delete-item-btn").addEventListener("click", () => {
    state.canon[type][layerKey].splice(index, 1);
    renderCanonLists();
    renderPacketPreview();
    saveState();
  });

  return li;
}

function attachDropBehavior(listEl, type, layerKey) {
  listEl.addEventListener("dragover", (event) => {
    const dragging = document.querySelector(".canon-item.is-dragging");
    if (!dragging) return;
    if (
      dragging.dataset.type !== type ||
      dragging.dataset.layerKey !== layerKey
    ) {
      return;
    }
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
    if (
      dragging.dataset.type !== type ||
      dragging.dataset.layerKey !== layerKey
    ) {
      return;
    }

    event.preventDefault();

    const sourceIndex = Number(dragging.dataset.index);
    const bucket = state.canon[type][layerKey];
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
    for (const layerKey of CANON_LAYER_KEYS) {
      const listEl = els.canonLists[type][layerKey];
      listEl.innerHTML = "";

      const items = state.canon[type][layerKey];
      items.forEach((text, index) => {
        listEl.appendChild(makeCanonItem(text, type, layerKey, index));
      });
    }
  }
}

function getLatestProfilerMemory() {
  return state.latestCompile?.result?.finalized?.data?.diagnostics?.profileState || {};
}

function buildPacket() {
  return buildLLMPacket({
    profileText: state.profileText,
    principlesByLayer: state.canon.principles,
    boundariesByLayer: state.canon.boundaries,
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
  return items
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        return String(
          item.text || item.value || item.principle || item.boundary || "",
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
    (Array.isArray(payload.local_y_positive_signals)
      ? payload.local_y_positive_signals.length
      : 0) +
    (Array.isArray(payload.local_y_negative_signals)
      ? payload.local_y_negative_signals.length
      : 0) +
    (Array.isArray(payload.triggered_gate_events)
      ? payload.triggered_gate_events.length
      : 0) +
    (Array.isArray(localExtraction.principles) ? localExtraction.principles.length : 0) +
    (Array.isArray(localExtraction.boundaries) ? localExtraction.boundaries.length : 0) +
    (Array.isArray(localExtraction.claimed_values)
      ? localExtraction.claimed_values.length
      : 0) +
    (Array.isArray(localExtraction.tradeoffs) ? localExtraction.tradeoffs.length : 0) +
    (Array.isArray(localExtraction.contradictions)
      ? localExtraction.contradictions.length
      : 0) +
    (Array.isArray(profileUpdates.new_principles)
      ? profileUpdates.new_principles.length
      : 0) +
    (Array.isArray(profileUpdates.new_boundaries)
      ? profileUpdates.new_boundaries.length
      : 0) +
    (Array.isArray(profileUpdates.cleared_gates)
      ? profileUpdates.cleared_gates.length
      : 0) +
    (Array.isArray(profileUpdates.failed_gates)
      ? profileUpdates.failed_gates.length
      : 0)
  );
}

function payloadHasScorableSignals(payload = {}) {
  if (!payload || typeof payload !== "object") return false;
  return countStructuredSignals(payload) > 0;
}

function setListCount(element, count, singularLabel, pluralLabel) {
  if (!element) return;
  const resolvedPluralLabel =
    pluralLabel ||
    (singularLabel.endsWith("y")
      ? `${singularLabel.slice(0, -1)}ies`
      : `${singularLabel}s`);
  const label = count === 1 ? singularLabel : resolvedPluralLabel;
  element.textContent = `${count} ${label}`;
}

function mergeUnique(base = [], extra = []) {
  const seen = new Set(base.map((item) => item.toLowerCase()));
  const merged = [...base];
  for (const item of extra) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

function mergeLayeredCanon(
  base = createEmptyLayeredCanon(),
  extra = createEmptyLayeredCanon(),
) {
  const next = createEmptyLayeredCanon();
  for (const layerKey of CANON_LAYER_KEYS) {
    next[layerKey] = mergeUnique(base[layerKey] || [], extra[layerKey] || []);
  }
  return next;
}

function layerFromFlatList(items = []) {
  const layered = createEmptyLayeredCanon();
  layered.core = cleanStringList(items);
  return layered;
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
      if (depth === 0) {
        return { start: openIndex, end: i + 1 };
      }
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
  const profileText = profileBlock
    ? raw.slice(profileBlock.start + 1, profileBlock.end - 1)
    : raw;
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
  const profile_update_signals =
    parseLooseObjectByKey(repaired, "profile_update_signals") || {};
  const triggered_gate_events =
    parseLooseArrayByKey(repaired, "triggered_gate_events") || [];
  const local_y_positive_signals =
    parseLooseArrayByKey(repaired, "local_y_positive_signals") || [];
  const local_y_negative_signals =
    parseLooseArrayByKey(repaired, "local_y_negative_signals") || [];
  const canonUpdate =
    parseLooseObjectByKey(repaired, "canonUpdate") ||
    parseLooseObjectByKey(repaired, "canon_update") ||
    parseLooseObjectByKey(repaired, "canonOptimization") ||
    parseLooseObjectByKey(repaired, "canon_optimization");

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
    canonUpdate;

  if (!hasAnything) {
    return null;
  }

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

  if (canonUpdate) {
    if (canonUpdate.action || canonUpdate.mode) {
      payload.canonUpdate = canonUpdate;
    } else {
      payload.canonOptimization = canonUpdate;
    }
  }

  return payload;
}

function extractCanonFromText(rawText = "") {
  const lines = String(rawText || "").split("\n");
  let section = "";
  const principles = [];
  const boundaries = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^principles?\b\s*:?$/i.test(trimmed)) {
      section = "principles";
      continue;
    }
    if (/^boundaries?\b\s*:?$/i.test(trimmed)) {
      section = "boundaries";
      continue;
    }
    const item = trimmed.replace(/^[-*\d.)\s]+/, "").trim();
    if (!item) continue;
    if (section === "principles") principles.push(item);
    if (section === "boundaries") boundaries.push(item);
  }

  return {
    principles: layerFromFlatList(principles),
    boundaries: layerFromFlatList(boundaries),
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
    profile_update_signals:
      parsed.profile_update_signals || parsed.profileUpdateSignals || {},
    local_y_positive_signals:
      parsed.local_y_positive_signals || parsed.localYPositiveSignals || [],
    local_y_negative_signals:
      parsed.local_y_negative_signals || parsed.localYNegativeSignals || [],
    triggered_gate_events:
      parsed.triggered_gate_events || parsed.triggeredGateEvents || [],
    canonUpdate: parsed.canonUpdate || parsed.canon_update,
    canonOptimization:
      parsed.canonOptimization || parsed.canon_optimization || undefined,
    principlesByLayer: parsed.principlesByLayer || parsed.principles_by_layer,
    boundariesByLayer: parsed.boundariesByLayer || parsed.boundaries_by_layer,
    principles: parsed.principles,
    boundaries: parsed.boundaries,
    canonUpdates: parsed.canonUpdates || parsed.canon_updates,
    updates: parsed.updates,
  };
}

function parseLLMOutput(raw) {
  const parsed =
    tryParseJSON(raw) || tryParseJSON(repairLikelyPayload(raw)) || parseLoosePayload(raw);
  const canonFromText = extractCanonFromText(raw);

  if (parsed && typeof parsed === "object") {
    return {
      payload: normalizeParsedPayload(parsed),
      canonFromText,
    };
  }

  const profile = extractLooseProfileItems(raw);
  return {
    payload: {
      model: "epistemic_octahedron_interpreter_v2",
      profile,
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
  const canonUpdate =
    payload.canonUpdate ||
    payload.canon_update ||
    payload.canonPlan ||
    payload.canon_plan ||
    payload.canonOptimization ||
    payload.canon_optimization ||
    payload.canonOptimizationResult ||
    {};

  const action = String(canonUpdate.action || canonUpdate.mode || "")
    .trim()
    .toLowerCase();

  const explicitPrinciples = normalizeLayeredCanon(
    canonUpdate.principlesByLayer ||
      canonUpdate.principles_by_layer ||
      canonUpdate.principles ||
      [],
  );
  const explicitBoundaries = normalizeLayeredCanon(
    canonUpdate.boundariesByLayer ||
      canonUpdate.boundaries_by_layer ||
      canonUpdate.boundaries ||
      [],
  );

  if (hasAnyLayeredItems(explicitPrinciples) || hasAnyLayeredItems(explicitBoundaries)) {
    return {
      mode: action === "maintain" ? "maintain" : "replace",
      canon: {
        principles: explicitPrinciples,
        boundaries: explicitBoundaries,
      },
      notes: cleanStringList(canonUpdate.notes || []),
    };
  }

  if (action === "maintain") {
    return {
      mode: "maintain",
      canon: buildEmptyCanonState(),
      notes: cleanStringList(canonUpdate.notes || []),
    };
  }

  const updates = payload.canonUpdates || payload.canon_updates || payload.updates || {};
  return {
    mode: "merge",
    canon: {
      principles: normalizeLayeredCanon(
        payload.principlesByLayer ||
          payload.principles_by_layer ||
          updates.principlesByLayer ||
          updates.principles_by_layer ||
          layerFromFlatList([
            ...(payload.principles || []),
            ...(updates.principles || []),
            ...(updates.addPrinciples || []),
            ...(updates.add_principles || []),
          ]),
      ),
      boundaries: normalizeLayeredCanon(
        payload.boundariesByLayer ||
          payload.boundaries_by_layer ||
          updates.boundariesByLayer ||
          updates.boundaries_by_layer ||
          layerFromFlatList([
            ...(payload.boundaries || []),
            ...(updates.boundaries || []),
            ...(updates.addBoundaries || []),
            ...(updates.add_boundaries || []),
          ]),
      ),
    },
    notes: [],
  };
}

function applyCanonUpdate(targetCanon, extracted) {
  const nextCanon = cloneCanon(targetCanon);
  if (!extracted || extracted.mode === "maintain") return nextCanon;

  if (extracted.mode === "replace") {
    return cloneCanon(extracted.canon);
  }

  nextCanon.principles = mergeLayeredCanon(
    nextCanon.principles,
    extracted.canon.principles,
  );
  nextCanon.boundaries = mergeLayeredCanon(
    nextCanon.boundaries,
    extracted.canon.boundaries,
  );
  return nextCanon;
}

function rebuildFromCompiledPayloads() {
  profiler.reset();
  let workingCanon = cloneCanon(state.canon);
  let previousStability = null;
  let lastPayload = null;
  let lastResult = null;
  let stabilityDelta = null;

  for (const payload of state.compiledPayloads) {
    profiler.addLLMOutput(payload);
    lastResult = profiler.computePoint();
    lastPayload = payload;

    const extracted = extractCanonFromPayload(payload);
    workingCanon = applyCanonUpdate(workingCanon, extracted);

    const nextStability = Number(lastResult.finalized?.data?.params?.uiLike?.stabilityPercent);
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

function renderProfileEntries(profileLines = [], notes = []) {
  els.profileEntriesList.innerHTML = "";
  els.profileNotesList.innerHTML = "";

  const cleanProfile = cleanStringList(profileLines);
  const cleanNotes = cleanStringList(notes);

  setListCount(els.profileEntriesCount, cleanProfile.length, "entry");
  setListCount(els.profileNotesCount, cleanNotes.length, "note");

  if (!cleanProfile.length) {
    const li = document.createElement("li");
    li.textContent = "No compiled profile line yet.";
    els.profileEntriesList.appendChild(li);
  } else {
    for (const line of cleanProfile) {
      const li = document.createElement("li");
      li.appendChild(decorateProfileLine(line));
      els.profileEntriesList.appendChild(li);
    }
  }

  if (!cleanNotes.length) {
    const li = document.createElement("li");
    li.textContent = "No notes yet.";
    els.profileNotesList.appendChild(li);
  } else {
    for (const note of cleanNotes) {
      const li = document.createElement("li");
      const div = document.createElement("div");
      div.className = "profile-entry-note";
      div.textContent = note;
      li.appendChild(div);
      els.profileNotesList.appendChild(li);
    }
  }
}

function postPointToVisualizer(finalized) {
  if (!finalized || typeof finalized !== "object") return;
  els.visualizerFrame.contentWindow?.postMessage(
    { type: "set-profile", data: finalized },
    "*",
  );
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

function renderAxisBar(fillEl, axisValue, stabilityValue) {
  const tone = getStabilityTone(stabilityValue);
  const normalizedStability = EpistemicProfiler.clamp(
    ((Number(stabilityValue) || 0) + 1) / 2,
    0,
    1,
  );
  const spanWidth = normalizedStability * 100;
  const slack = 100 - spanWidth;
  const axis = EpistemicProfiler.clamp(Number(axisValue) || 0, -1, 1);
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

  return [
    "stored_params = {",
    `  a: ${formatSigned(semantics.a)},`,
    `  b: ${formatSigned(semantics.b)},`,
    `  s: ${formatSigned(semantics.s)},`,
    `  yCoverage: ${formatPercent((semantics.yCoverage || 0) * 100)},`,
    `  empathyPercent: ${formatPercent(uiLike.empathyPercent ?? 50)},`,
    `  practicalityPercent: ${formatPercent(uiLike.practicalityPercent ?? 50)},`,
    `  wisdomPercent: ${formatPercent(uiLike.wisdomPercent ?? 50)},`,
    `  knowledgePercent: ${formatPercent(uiLike.knowledgePercent ?? 50)},`,
    `  stabilityPercent: ${formatPercent(uiLike.stabilityPercent ?? 0)},`,
    `  coveragePercent: ${formatPercent(uiLike.coveragePercent ?? 0)},`,
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
    renderProfileEntries([], []);
    return;
  }

  const finalizedData = result.finalized?.data || {};
  const semantics = finalizedData.params?.semantics || { a: 0, b: 0, s: 0 };
  const point = finalizedData.point || result.point || { x: 0, y: 0, z: 0 };

  renderAxisBar(els.statBarEP, semantics.a, semantics.s);
  renderAxisBar(els.statBarWK, semantics.b, semantics.s);
  renderTopView(point);
  renderSideView(point);
  renderMathPanel(result);
  renderProfileEntries(result.finalized?.profile || [], result.finalized?.notes || []);

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

function compilePayload() {
  const previousCompile = state.latestCompile;
  const raw = sanitizeJSONInput(state.llmOutput);
  if (!raw) {
    throw new Error("Paste LLM output before compiling.");
  }

  const { payload, canonFromText } = parseLLMOutput(raw);
  const extractedCanon = extractCanonFromPayload(payload);
  const mergedTextCanon = {
    mode: "merge",
    canon: canonFromText,
  };

  const hadScorableSignals = payloadHasScorableSignals(payload);
  const hadCanonSignals =
    hasAnyLayeredItems(extractedCanon?.canon?.principles) ||
    hasAnyLayeredItems(extractedCanon?.canon?.boundaries) ||
    hasAnyLayeredItems(canonFromText?.principles) ||
    hasAnyLayeredItems(canonFromText?.boundaries) ||
    extractedCanon?.mode === "maintain";

  let result = previousCompile?.result || null;
  let stabilityDelta = null;

  if (hadScorableSignals) {
    profiler.addLLMOutput(payload);
    result = profiler.computePoint();
    state.compiledPayloads.push(payload);

    const previousStability = Number(
      previousCompile?.result?.finalized?.data?.params?.uiLike?.stabilityPercent,
    );
    const nextStability = Number(
      result?.finalized?.data?.params?.uiLike?.stabilityPercent,
    );
    stabilityDelta =
      Number.isFinite(previousStability) && Number.isFinite(nextStability)
        ? nextStability - previousStability
        : null;

    state.latestCompile = {
      payload,
      result,
      stabilityDelta,
      compiledAt: new Date().toISOString(),
    };
  } else if (!hadCanonSignals) {
    throw new Error(
      "LLM payload must contain usable evidence, structured signals, compact profile signals, or a canon update.",
    );
  }

  state.canon = applyCanonUpdate(state.canon, extractedCanon);
  state.canon = applyCanonUpdate(state.canon, mergedTextCanon);

  renderCanonLists();
  renderPacketPreview();
  renderCompile();
  saveState();

  return {
    didCompile: hadScorableSignals,
    didCanonUpdate: hadCanonSignals,
  };
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
  a.download = `${(state.name || "philosophers-stone-profile")
    .replace(/\s+/g, "-")
    .toLowerCase()}.json`;
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

function bind() {
  for (const type of ["principles", "boundaries"]) {
    for (const layerKey of CANON_LAYER_KEYS) {
      attachDropBehavior(els.canonLists[type][layerKey], type, layerKey);
    }
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
    els.togglePacketPreviewBtn.textContent = hidden
      ? "Show hidden packet"
      : "Hide hidden packet";
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
      if (outcome.didCompile && outcome.didCanonUpdate) {
        setCompileStatus("Compiled aggregate and updated canon.", "is-success");
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
    const layerKey = els.canonLayer.value;
    if (!value) return;

    state.canon[type][layerKey].push(value);
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
      setCompileStatus(
        "Paste failed. Clipboard permissions may be blocked.",
        "is-error",
      );
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
