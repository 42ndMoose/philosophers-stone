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

const STORAGE_KEY = "philosophers-stone-workspace-v2";
const BUTTON_RESET_MS = 1500;

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
  statEmpathy: document.getElementById("statEmpathy"),
  statPracticality: document.getElementById("statPracticality"),
  statWisdom: document.getElementById("statWisdom"),
  statKnowledge: document.getElementById("statKnowledge"),
  statStability: document.getElementById("statStability"),
  statStabilityDelta: document.getElementById("statStabilityDelta"),
  coordX: document.getElementById("coordX"),
  coordY: document.getElementById("coordY"),
  coordZ: document.getElementById("coordZ"),
  profileEntriesList: document.getElementById("profileEntriesList"),
  copyProfilerAssessmentBtn: document.getElementById(
    "copyProfilerAssessmentBtn",
  ),
  visualizerFrame: document.getElementById("visualizerFrame"),
  refreshVisualizerBtn: document.getElementById("refreshVisualizerBtn"),
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

const profiler = new EpistemicProfiler({ rejectBalancedNonPole: false });

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
};

function formatPercent(value) {
  return `${Number(value).toFixed(1)}%`;
}

function formatCoord(value) {
  const cleaned = Math.abs(Number(value) || 0) < 5e-7 ? 0 : Number(value) || 0;
  const out = cleaned.toFixed(3);
  return out === "-0.000" ? "0.000" : out;
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
    )
      return;
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
    )
      return;

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

function buildPacket() {
  return buildLLMPacket({
    profileText: state.profileText,
    name: state.name,
    additionalInfo: state.additionalInfo,
    avatar: getAvatarTitle(state.selectedAvatarId),
    principlesByLayer: state.canon.principles,
    boundariesByLayer: state.canon.boundaries,
  });
}

function buildProfilerAssessment() {
  const semanticProfile = state.latestCompile?.result?.semanticProfile;
  const point = state.latestCompile?.result?.point;

  return buildProfilerAssessmentPacket({
    name: state.name,
    additionalInfo: state.additionalInfo,
    avatar: getAvatarTitle(state.selectedAvatarId),
    profileEntries: state.latestCompile?.result?.finalized?.profile || [],
    notes: state.latestCompile?.result?.finalized?.notes || [],
    principlesByLayer: state.canon.principles,
    boundariesByLayer: state.canon.boundaries,
    computed: {
      point,
      uiLike: semanticProfile?.uiLike,
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

function hasAnyCanon(canon = buildEmptyCanonState()) {
  return (
    hasAnyLayeredItems(canon.principles) || hasAnyLayeredItems(canon.boundaries)
  );
}

function layerFromFlatList(items = []) {
  const layered = createEmptyLayeredCanon();
  layered.core = cleanStringList(items);
  return layered;
}

function extractCanonFromPayload(payload = {}) {
  const optimization =
    payload.canonOptimization ||
    payload.canon_optimization ||
    payload.canonOptimizationResult ||
    {};

  const optimizedPrinciples = normalizeLayeredCanon(
    optimization.principlesByLayer ||
      optimization.principles_by_layer ||
      optimization.principles ||
      [],
  );
  const optimizedBoundaries = normalizeLayeredCanon(
    optimization.boundariesByLayer ||
      optimization.boundaries_by_layer ||
      optimization.boundaries ||
      [],
  );

  if (
    hasAnyLayeredItems(optimizedPrinciples) ||
    hasAnyLayeredItems(optimizedBoundaries)
  ) {
    return {
      mode: "replace",
      canon: {
        principles: optimizedPrinciples,
        boundaries: optimizedBoundaries,
      },
      notes: cleanStringList(optimization.notes || []),
    };
  }

  const updates =
    payload.canonUpdates || payload.canon_updates || payload.updates || {};

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

function parseLLMOutput(raw) {
  try {
    const payload = JSON.parse(raw);
    return { payload, canonFromText: buildEmptyCanonState() };
  } catch {
    const textCanon = extractCanonFromText(raw);
    return {
      payload: {
        model: "epistemic_octahedron_interpreter_v1",
        profile: String(raw)
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 20),
        evidence: [],
        notes: ["Compiled from plain text dump without explicit evidence."],
        principlesByLayer: textCanon.principles,
        boundariesByLayer: textCanon.boundaries,
      },
      canonFromText: textCanon,
    };
  }
}

function applyCanonUpdate(targetCanon, extracted) {
  const nextCanon = cloneCanon(targetCanon);
  if (!extracted) return nextCanon;

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

    const nextStability = Number(
      lastResult.semanticProfile.uiLike.stabilityPercent,
    );
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

  const cleanProfile = cleanStringList(profileLines);
  const cleanNotes = cleanStringList(notes);

  if (!cleanProfile.length && !cleanNotes.length) {
    const li = document.createElement("li");
    li.textContent = "No profile entry yet.";
    els.profileEntriesList.appendChild(li);
    return;
  }

  for (const line of cleanProfile) {
    const li = document.createElement("li");
    li.appendChild(decorateProfileLine(line));
    els.profileEntriesList.appendChild(li);
  }

  for (const note of cleanNotes) {
    const li = document.createElement("li");
    const div = document.createElement("div");
    div.className = "profile-entry-note";
    div.textContent = note;
    li.appendChild(div);
    els.profileEntriesList.appendChild(li);
  }
}

function postPointToVisualizer(finalized) {
  if (!finalized || typeof finalized !== "object") return;
  els.visualizerFrame.contentWindow?.postMessage(
    { type: "set-profile", data: finalized },
    "*",
  );
}

function renderStabilityDelta() {
  const delta = Number(state.latestCompile?.stabilityDelta);
  if (!Number.isFinite(delta)) {
    els.statStabilityDelta.textContent = "—";
    return;
  }

  const sign = delta >= 0 ? "+" : "";
  els.statStabilityDelta.textContent = `${sign}${delta.toFixed(1)}%`;
}

function renderCompile() {
  const result = state.latestCompile?.result;
  if (!result) {
    els.statEmpathy.textContent = "50.0%";
    els.statPracticality.textContent = "50.0%";
    els.statWisdom.textContent = "50.0%";
    els.statKnowledge.textContent = "50.0%";
    els.statStability.textContent = "0.0%";
    els.coordX.textContent = "0.000";
    els.coordY.textContent = "0.000";
    els.coordZ.textContent = "0.000";
    renderProfileEntries([], []);
    renderStabilityDelta();
    return;
  }

  const { point, semanticProfile, finalized } = result;
  const uiLike = semanticProfile.uiLike;

  els.statEmpathy.textContent = formatPercent(uiLike.empathyPercent);
  els.statPracticality.textContent = formatPercent(uiLike.practicalityPercent);
  els.statWisdom.textContent = formatPercent(uiLike.wisdomPercent);
  els.statKnowledge.textContent = formatPercent(uiLike.knowledgePercent);
  els.statStability.textContent = formatPercent(uiLike.stabilityPercent);
  renderStabilityDelta();
  els.coordX.textContent = formatCoord(point.x);
  els.coordY.textContent = formatCoord(point.y);
  els.coordZ.textContent = formatCoord(point.z);
  renderProfileEntries(finalized.profile, finalized.notes);

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
  postPointToVisualizer(finalized);
}

function compilePayload() {
  const previousCompile = state.latestCompile;
  const raw = sanitizeJSONInput(state.llmOutput);
  if (!raw) {
    throw new Error("Paste LLM output before compiling.");
  }

  const { payload, canonFromText } = parseLLMOutput(raw);
  profiler.addLLMOutput(payload);
  const result = profiler.computePoint();

  const extractedCanon = extractCanonFromPayload(payload);
  const mergedTextCanon = {
    mode: "merge",
    canon: canonFromText,
  };

  state.canon = applyCanonUpdate(state.canon, extractedCanon);
  state.canon = applyCanonUpdate(state.canon, mergedTextCanon);

  state.compiledPayloads.push(payload);

  const previousStability = Number(
    previousCompile?.result?.semanticProfile?.uiLike?.stabilityPercent,
  );
  const nextStability = Number(
    result?.semanticProfile?.uiLike?.stabilityPercent,
  );
  const stabilityDelta =
    Number.isFinite(previousStability) && Number.isFinite(nextStability)
      ? nextStability - previousStability
      : null;

  state.latestCompile = {
    payload,
    result,
    stabilityDelta,
    compiledAt: new Date().toISOString(),
  };

  renderCanonLists();
  renderPacketPreview();
  renderCompile();
  saveState();
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
    renderPacketPreview();
    saveState();
  };

  els.profileName.addEventListener("input", syncProfileName);
  els.profileName.addEventListener("blur", () => {
    els.profileName.textContent = els.profileName.textContent.trim();
    syncProfileName();
  });

  els.profileAdditionalInfo.addEventListener("input", () => {
    state.additionalInfo = els.profileAdditionalInfo.value;
    renderPacketPreview();
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

  els.compileBtn.addEventListener("click", () => {
    try {
      compilePayload();
      setCompileStatus("Compiled and merged into profile.", "is-success");
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
  els.importProfileBtn.addEventListener("click", () =>
    els.importProfileInput.click(),
  );
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
