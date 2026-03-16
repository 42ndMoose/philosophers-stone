import { buildLLMPacket } from './contracts.js';
import { AVATARS, getAvatarById, pickAvatarFromPoint } from './avatars.js';
import { EpistemicProfiler } from './profiler.js';

const STORAGE_KEY = 'philosophers-stone-workspace-v1';

const els = {
  profileText: document.getElementById('profileText'),
  llmOutput: document.getElementById('llmOutput'),
  copyPacketBtn: document.getElementById('copyPacketBtn'),
  copyStatus: document.getElementById('copyStatus'),
  togglePacketPreviewBtn: document.getElementById('togglePacketPreviewBtn'),
  packetPreviewWrap: document.getElementById('packetPreviewWrap'),
  packetPreview: document.getElementById('packetPreview'),
  refreshPacketBtn: document.getElementById('refreshPacketBtn'),
  compileBtn: document.getElementById('compileBtn'),
  compileStatus: document.getElementById('compileStatus'),
  avatarGrid: document.getElementById('avatarGrid'),
  profileName: document.getElementById('profileName'),
  profileAge: document.getElementById('profileAge'),
  canonInput: document.getElementById('canonInput'),
  canonType: document.getElementById('canonType'),
  addCanonBtn: document.getElementById('addCanonBtn'),
  principlesList: document.getElementById('principlesList'),
  boundariesList: document.getElementById('boundariesList'),
  exportProfileBtn: document.getElementById('exportProfileBtn'),
  importProfileBtn: document.getElementById('importProfileBtn'),
  importProfileInput: document.getElementById('importProfileInput'),
  resetWorkspaceBtn: document.getElementById('resetWorkspaceBtn'),
  statEmpathy: document.getElementById('statEmpathy'),
  statPracticality: document.getElementById('statPracticality'),
  statWisdom: document.getElementById('statWisdom'),
  statKnowledge: document.getElementById('statKnowledge'),
  statStability: document.getElementById('statStability'),
  statAvatar: document.getElementById('statAvatar'),
  coordX: document.getElementById('coordX'),
  coordY: document.getElementById('coordY'),
  coordZ: document.getElementById('coordZ'),
  diagnosticsBox: document.getElementById('diagnosticsBox'),
  notesList: document.getElementById('notesList'),
  visualizerFrame: document.getElementById('visualizerFrame'),
  refreshVisualizerBtn: document.getElementById('refreshVisualizerBtn'),
};

const state = {
  profileText: '',
  llmOutput: '',
  name: '',
  age: '',
  selectedAvatarId: null,
  manualAvatar: false,
  principles: [
    'Do not confuse evidence extraction with final scoring.',
    'Keep canon lean and reusable.',
  ],
  boundaries: [
    'Do not output final x, y, z from the LLM stage.',
    'Do not treat one text dump as final philosophical truth.',
  ],
  latestCompile: null,
};

function formatPercent(value) {
  return `${Number(value).toFixed(1)}%`;
}

function formatCoord(value) {
  const cleaned = Math.abs(Number(value) || 0) < 5e-7 ? 0 : Number(value) || 0;
  const out = cleaned.toFixed(3);
  return out === '-0.000' ? '0.000' : out;
}

function getAvatarTitle(id) {
  return getAvatarById(id)?.title || 'Unassigned';
}

function serializeState() {
  return JSON.stringify(state);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, serializeState());
}

function hydrateState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    Object.assign(state, parsed);
  } catch {
    // ignore broken local state
  }
}

function autoResizeTextarea(textarea, maxRows = 22) {
  const style = getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight) || 21;
  textarea.style.height = 'auto';
  const maxHeight = lineHeight * maxRows + 28;
  textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
}

function renderAvatars() {
  els.avatarGrid.innerHTML = '';
  for (const avatar of AVATARS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `avatar-btn${state.selectedAvatarId === avatar.id ? ' is-selected' : ''}`;
    btn.dataset.avatarId = avatar.id;
    btn.innerHTML = `
      <img src="${avatar.src}" alt="${avatar.title}" />
      <span>${avatar.title}</span>
    `;
    btn.addEventListener('click', () => {
      state.selectedAvatarId = avatar.id;
      state.manualAvatar = true;
      renderAvatars();
      updateStatsAvatar();
      saveState();
    });
    els.avatarGrid.appendChild(btn);
  }
}

function makeCanonItem(text, type, index) {
  const li = document.createElement('li');
  li.className = 'canon-item';
  li.draggable = true;
  li.dataset.type = type;
  li.dataset.index = String(index);
  li.innerHTML = `
    <span class="drag-pill">⋮⋮</span>
    <div>${text}</div>
    <button type="button" class="delete-item-btn" aria-label="Delete item">×</button>
  `;

  li.addEventListener('dragstart', () => {
    li.classList.add('is-dragging');
  });

  li.addEventListener('dragend', () => {
    li.classList.remove('is-dragging');
    document.querySelectorAll('.canon-list').forEach((list) => list.classList.remove('is-drop-target'));
  });

  li.querySelector('.delete-item-btn').addEventListener('click', () => {
    state[type].splice(index, 1);
    renderCanonLists();
    saveState();
  });

  return li;
}

function attachDropBehavior(listEl, type) {
  listEl.addEventListener('dragover', (event) => {
    event.preventDefault();
    listEl.classList.add('is-drop-target');
  });

  listEl.addEventListener('dragleave', () => {
    listEl.classList.remove('is-drop-target');
  });

  listEl.addEventListener('drop', (event) => {
    event.preventDefault();
    listEl.classList.remove('is-drop-target');

    const dragging = document.querySelector('.canon-item.is-dragging');
    if (!dragging) return;

    const sourceType = dragging.dataset.type;
    const sourceIndex = Number(dragging.dataset.index);
    const [moved] = state[sourceType].splice(sourceIndex, 1);
    if (!moved) return;

    const items = [...listEl.querySelectorAll('.canon-item:not(.is-dragging)')];
    const after = items.find((item) => {
      const rect = item.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });

    const targetIndex = after ? Number(after.dataset.index) : state[type].length;
    state[type].splice(targetIndex, 0, moved);
    renderCanonLists();
    saveState();
  });
}

function renderCanonLists() {
  els.principlesList.innerHTML = '';
  els.boundariesList.innerHTML = '';

  state.principles.forEach((text, index) => {
    els.principlesList.appendChild(makeCanonItem(text, 'principles', index));
  });
  state.boundaries.forEach((text, index) => {
    els.boundariesList.appendChild(makeCanonItem(text, 'boundaries', index));
  });
}

function buildPacket() {
  return buildLLMPacket({
    profileText: state.profileText,
    name: state.name,
    age: state.age,
    avatar: getAvatarTitle(state.selectedAvatarId),
    principles: state.principles,
    boundaries: state.boundaries,
  });
}

function renderPacketPreview() {
  els.packetPreview.textContent = buildPacket();
}

function pulseCopyStatus(message) {
  els.copyStatus.textContent = message;
  els.copyStatus.classList.add('is-live');
  window.clearTimeout(pulseCopyStatus.timer);
  pulseCopyStatus.timer = window.setTimeout(() => {
    els.copyStatus.textContent = '';
    els.copyStatus.classList.remove('is-live');
  }, 1600);
}

async function copyPacket() {
  const packet = buildPacket();
  await navigator.clipboard.writeText(packet);
  pulseCopyStatus('Copied');
}

function sanitizeJSONInput(raw) {
  return String(raw || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function setCompileStatus(message, kind = '') {
  els.compileStatus.textContent = message;
  els.compileStatus.classList.remove('is-error', 'is-success');
  if (kind) els.compileStatus.classList.add(kind);
}

function updateStatsAvatar() {
  els.statAvatar.textContent = getAvatarTitle(state.selectedAvatarId);
}

function renderNotes(notes = []) {
  els.notesList.innerHTML = '';
  const items = Array.isArray(notes) && notes.length ? notes : ['No notes yet.'];
  items.forEach((note) => {
    const li = document.createElement('li');
    li.textContent = note;
    els.notesList.appendChild(li);
  });
}

function postPointToVisualizer(point) {
  const payload = { type: 'set-point', point };
  els.visualizerFrame.contentWindow?.postMessage(payload, '*');
}

function renderCompile(result, payload) {
  const { point, semanticProfile, debug } = result;
  const uiLike = semanticProfile.uiLike;

  els.statEmpathy.textContent = formatPercent(uiLike.empathyPercent);
  els.statPracticality.textContent = formatPercent(uiLike.practicalityPercent);
  els.statWisdom.textContent = formatPercent(uiLike.wisdomPercent);
  els.statKnowledge.textContent = formatPercent(uiLike.knowledgePercent);
  els.statStability.textContent = formatPercent(uiLike.stabilityPercent);
  els.coordX.textContent = formatCoord(point.x);
  els.coordY.textContent = formatCoord(point.y);
  els.coordZ.textContent = formatCoord(point.z);
  els.diagnosticsBox.textContent = JSON.stringify(
    {
      semantics: semanticProfile.semantics,
      uiLike: semanticProfile.uiLike,
      diagnostics: semanticProfile.diagnostics,
      debug,
    },
    null,
    2,
  );
  renderNotes(payload.notes);

  if (!state.manualAvatar) {
    const picked = pickAvatarFromPoint(point);
    if (picked) {
      state.selectedAvatarId = picked.id;
      if (!state.name.trim()) state.name = picked.title;
      els.profileName.value = state.name;
    }
  }

  renderAvatars();
  updateStatsAvatar();
  postPointToVisualizer(point);
}

function compilePayload() {
  const raw = sanitizeJSONInput(state.llmOutput);
  if (!raw) {
    throw new Error('Paste LLM JSON before compiling.');
  }

  const payload = JSON.parse(raw);
  const profiler = new EpistemicProfiler();
  profiler.addLLMOutput(payload);
  const result = profiler.computePoint();

  state.latestCompile = {
    payload,
    result,
    compiledAt: new Date().toISOString(),
  };

  renderCompile(result, payload);
  saveState();
  return result;
}

function exportProfile() {
  const blob = new Blob([
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        state,
      },
      null,
      2,
    ),
  ], { type: 'application/json' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(state.name || 'philosophers-stone-profile').replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importProfile(file) {
  if (!file) return;
  const text = await file.text();
  const parsed = JSON.parse(text);
  Object.assign(state, parsed.state || parsed);
  renderAll();
  saveState();
}

function resetWorkspace() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function renderAll() {
  els.profileText.value = state.profileText || '';
  els.llmOutput.value = state.llmOutput || '';
  els.profileName.value = state.name || '';
  els.profileAge.value = state.age || '';
  autoResizeTextarea(els.profileText);
  renderAvatars();
  renderCanonLists();
  renderPacketPreview();
  updateStatsAvatar();

  if (state.latestCompile?.result && state.latestCompile?.payload) {
    renderCompile(state.latestCompile.result, state.latestCompile.payload);
  } else {
    renderNotes([]);
  }
}

function bind() {
  attachDropBehavior(els.principlesList, 'principles');
  attachDropBehavior(els.boundariesList, 'boundaries');

  els.profileText.addEventListener('input', () => {
    state.profileText = els.profileText.value;
    autoResizeTextarea(els.profileText);
    renderPacketPreview();
    saveState();
  });

  els.llmOutput.addEventListener('input', () => {
    state.llmOutput = els.llmOutput.value;
    saveState();
  });

  els.profileName.addEventListener('input', () => {
    state.name = els.profileName.value;
    renderPacketPreview();
    saveState();
  });

  els.profileAge.addEventListener('input', () => {
    state.age = els.profileAge.value;
    renderPacketPreview();
    saveState();
  });

  els.copyPacketBtn.addEventListener('click', async () => {
    try {
      await copyPacket();
    } catch {
      pulseCopyStatus('Copy failed');
    }
  });

  els.togglePacketPreviewBtn.addEventListener('click', () => {
    const hidden = els.packetPreviewWrap.classList.toggle('hidden');
    els.togglePacketPreviewBtn.textContent = hidden ? 'Show hidden packet' : 'Hide hidden packet';
    els.togglePacketPreviewBtn.setAttribute('aria-expanded', String(!hidden));
    if (!hidden) renderPacketPreview();
  });

  els.refreshPacketBtn.addEventListener('click', renderPacketPreview);

  els.compileBtn.addEventListener('click', () => {
    try {
      compilePayload();
      setCompileStatus('Compiled and sent to the visualizer.', 'is-success');
    } catch (error) {
      setCompileStatus(error.message || 'Compile failed.', 'is-error');
    }
  });

  els.addCanonBtn.addEventListener('click', () => {
    const value = els.canonInput.value.trim();
    const type = els.canonType.value;
    if (!value) return;
    state[type].push(value);
    els.canonInput.value = '';
    renderCanonLists();
    renderPacketPreview();
    saveState();
  });

  els.exportProfileBtn.addEventListener('click', exportProfile);
  els.importProfileBtn.addEventListener('click', () => els.importProfileInput.click());
  els.importProfileInput.addEventListener('change', async (event) => {
    try {
      await importProfile(event.target.files?.[0]);
      setCompileStatus('Profile imported.', 'is-success');
    } catch (error) {
      setCompileStatus(error.message || 'Import failed.', 'is-error');
    } finally {
      event.target.value = '';
    }
  });

  els.resetWorkspaceBtn.addEventListener('click', resetWorkspace);

  els.refreshVisualizerBtn.addEventListener('click', () => {
    const point = state.latestCompile?.result?.point;
    if (point) postPointToVisualizer(point);
  });

  els.visualizerFrame.addEventListener('load', () => {
    const point = state.latestCompile?.result?.point;
    if (point) postPointToVisualizer(point);
  });
}

hydrateState();
renderAll();
bind();
