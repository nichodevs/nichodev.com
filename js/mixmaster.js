"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const els = {
    list: $("trackList"), ruler: $("ruler"), playhead: $("playhead"), timeline: $("timeline"),
    status: $("projectStatus"), time: $("timeReadout"), meter: $("audioMeter").firstElementChild,
    audioFiles: $("audioFiles"), record: $("recordButton"), play: $("playButton"), stop: $("stopButton"), recordingMonitor: $("recordingMonitor"), recordingWaveform: $("recordingWaveform"), recordingTime: $("recordingTime"),
    selection: $("selectionLabel"), piano: $("pianoRoll"), envelope: $("envelopeCanvas")
  };
  const DB_NAME = "nichodev-mixmaster-v1";
  const PROJECT_KEY = "nichodev-mixmaster-project-v1";
  const PITCHES = ["C5", "B4", "A4", "G4", "F4", "E4", "D4", "C4"];
  const FREQUENCIES = [523.25, 493.88, 440, 392, 349.23, 329.63, 293.66, 261.63];
  const state = { tracks: [], selected: [], selectedTrackId: null, playhead: 0, zoom: 16, bpm: 120, tab: "edit", master: .8, playing: false };
  let db, audioContext, masterNode, meterFrame, playStartedAt = 0, playOffset = 0, activeSources = [];
  let recorder, recorderStream, recordingSource, recordingAnalyser, recordingSilencer, recordingFrame = 0, recordingStartedAt = 0, lastWaveformSampleAt = 0, liveWaveformPeaks = [], recordChunks = [], undoStack = [], redoStack = [], saveTimer;
  let projectReady = Promise.resolve(), recordingSetup = false, recordingFinalizing = false;
  let recordingClip = null, recordingTrack = null, lastClipWaveformUpdate = 0;
  const buffers = new Map(), blobs = new Map(), routeNodes = new Map();
  const id = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const durationOf = clip => clip.type === "midi" ? clip.duration : Math.max(0, clip.sourceEnd - clip.sourceStart);
  const clipEnd = clip => clip.start + durationOf(clip);
  const currentTracks = () => state.tracks;
  const selectedClip = () => state.selected.length === 1 ? findClip(state.selected[0]) : null;
  const activeTrack = () => selectedClip()?.track || state.tracks.find(track => track.id === state.selectedTrackId) || null;
  function findClip(clipId) {
    for (const track of state.tracks) {
      const clip = track.clips.find(item => item.id === clipId);
      if (clip) return { track, clip };
    }
    return null;
  }
  function audioCtx() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error("Este navegador não oferece suporte ao Web Audio.");
    if (!audioContext) {
      audioContext = new Ctx();
      masterNode = audioContext.createGain();
      masterNode.gain.value = state.master;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      masterNode.connect(analyser);
      analyser.connect(audioContext.destination);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const meter = () => {
        analyser.getByteFrequencyData(data);
        const peak = data.reduce((max, value) => Math.max(max, value), 0);
        els.meter.style.width = `${Math.max(3, peak / 255 * 100)}%`;
        meterFrame = requestAnimationFrame(meter);
      };
      meter();
      for (const track of state.tracks) createTrackRoute(track);
    }
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }
  function impulse(ctx, seconds) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.7);
    }
    return buffer;
  }
  function createTrackRoute(track) {
    const ctx = audioContext;
    const volume = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const filter = ctx.createBiquadFilter();
    const dry = ctx.createGain();
    const delay = ctx.createDelay(1.2);
    const feedback = ctx.createGain();
    const delayWet = ctx.createGain();
    const reverbWet = ctx.createGain();
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 1.8);
    filter.type = "lowpass";
    filter.connect(dry); dry.connect(masterNode);
    filter.connect(delay); delay.connect(delayWet); delayWet.connect(masterNode);
    delay.connect(feedback); feedback.connect(delay);
    filter.connect(reverb); reverb.connect(reverbWet); reverbWet.connect(masterNode);
    volume.connect(pan); pan.connect(filter);
    const nodes = { volume, pan, filter, delay, feedback, delayWet, reverbWet, reverb };
    routeNodes.set(track.id, nodes);
    updateRoute(track);
    return nodes;
  }
  function updateRoute(track) {
    const nodes = routeNodes.get(track.id) || (audioContext ? createTrackRoute(track) : null);
    if (!nodes) return;
    const soloExists = state.tracks.some(item => item.solo);
    nodes.volume.gain.setTargetAtTime(track.muted || (soloExists && !track.solo) ? 0 : track.volume, audioContext.currentTime, .015);
    nodes.pan.pan.setTargetAtTime(track.pan, audioContext.currentTime, .015);
    nodes.filter.frequency.setTargetAtTime(500 + track.tone * 19500, audioContext.currentTime, .02);
    nodes.delay.delayTime.setTargetAtTime(.24, audioContext.currentTime, .02);
    nodes.feedback.gain.setTargetAtTime(.18, audioContext.currentTime, .02);
    nodes.delayWet.gain.setTargetAtTime(track.delay, audioContext.currentTime, .02);
    nodes.reverbWet.gain.setTargetAtTime(track.reverb, audioContext.currentTime, .02);
    masterNode.gain.setTargetAtTime(state.master, audioContext.currentTime, .02);
  }
  function freshTrack(name, type = "audio") {
    return { id: id(), name, type, volume: .82, pan: 0, tone: 1, delay: 0, reverb: 0, muted: false, solo: false, clips: [] };
  }
  function snapshot() {
    return JSON.stringify({ tracks: state.tracks, selected: state.selected, selectedTrackId: state.selectedTrackId, playhead: state.playhead, bpm: state.bpm, master: state.master });
  }
  function checkpoint() {
    undoStack.push(snapshot());
    if (undoStack.length > 40) undoStack.shift();
    redoStack.length = 0;
    updateUndoButtons();
  }
  function restoreSnapshot(value) {
    const parsed = JSON.parse(value);
    state.tracks = parsed.tracks || [];
    state.selected = parsed.selected || [];
    state.selectedTrackId = parsed.selectedTrackId || null;
    state.playhead = parsed.playhead || 0;
    state.bpm = parsed.bpm || 120;
    state.master = parsed.master ?? .8;
    $("bpmInput").value = state.bpm;
    $("masterVolume").value = Math.round(state.master * 100);
    for (const track of state.tracks) if (audioContext) { if (!routeNodes.has(track.id)) createTrackRoute(track); else updateRoute(track); }
    saveProject(); render();
  }
  function updateUndoButtons() { $("undoButton").disabled = !undoStack.length; $("redoButton").disabled = !redoStack.length; }
  function persistProjectNow() {
    clearTimeout(saveTimer); saveTimer = null;
    try {
      localStorage.setItem(PROJECT_KEY, JSON.stringify({ tracks: state.tracks, selectedTrackId: state.selectedTrackId, playhead: state.playhead, bpm: state.bpm, master: state.master }));
      return true;
    } catch { return false; }
  }
  function saveProject() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      els.status.textContent = persistProjectNow() ? "Projeto salvo neste navegador" : "Não foi possível salvar o projeto neste navegador";
    }, 180);
  }
  function openDB() {
    return new Promise((resolve, reject) => {
      if (!indexedDB) return reject(new Error("Armazenamento local indisponível."));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("audio");
      request.onsuccess = () => { db = request.result; resolve(db); };
      request.onerror = () => reject(request.error);
    });
  }
  function storeBlob(key, blob) {
    blobs.set(key, blob);
    if (!db) return Promise.resolve();
    return new Promise((resolve, reject) => { const tx = db.transaction("audio", "readwrite"); tx.objectStore("audio").put(blob, key); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  }
  function loadBlob(key) {
    if (blobs.has(key)) return Promise.resolve(blobs.get(key));
    return new Promise((resolve, reject) => { const request = db.transaction("audio").objectStore("audio").get(key); request.onsuccess = () => { if (request.result) blobs.set(key, request.result); resolve(request.result); }; request.onerror = () => reject(request.error); });
  }
  async function decodeBlob(blob) {
    const ctx = audioCtx();
    return ctx.decodeAudioData(await blob.arrayBuffer());
  }
  async function loadProject() {
    try {
      await openDB();
      const saved = JSON.parse(localStorage.getItem(PROJECT_KEY) || "null");
      if (saved?.tracks?.length) {
        state.tracks = saved.tracks;
        state.selectedTrackId = saved.selectedTrackId || state.tracks[0]?.id || null;
        state.playhead = 0; // Sempre abrir o cursor no início do projeto.
        state.bpm = saved.bpm || 120;
        state.master = saved.master ?? .8;
        $("bpmInput").value = state.bpm;
        $("masterVolume").value = Math.round(state.master * 100);
        let restored = 0;
        for (const track of state.tracks) for (const clip of track.clips) if (clip.type !== "midi") {
          const blob = await loadBlob(clip.audioId);
          if (blob) { buffers.set(clip.audioId, await decodeBlob(blob)); restored++; }
        }
        els.status.textContent = `Projeto restaurado · ${restored} clipe(s) de áudio`;
      } else {
        state.tracks = [freshTrack("FAIXA 1")];
        els.status.textContent = "Projeto novo · importe um áudio, grave ou crie faixas";
      }
    } catch (error) {
      if (!state.tracks.length) state.tracks = [freshTrack("FAIXA 1")];
      els.status.textContent = `Armazenamento local indisponível: ${error.message}`;
    }
    render();
  }
  function totalDuration() {
    return Math.max(12, ...state.tracks.flatMap(track => track.clips.map(clipEnd)), state.playhead + 3);
  }
  function render() {
    document.documentElement.style.setProperty("--mix-scale", `${state.zoom}px`);
    const width = Math.max(800, Math.ceil(totalDuration() / 10) * 10 * state.zoom);
    els.ruler.style.width = `${width}px`;
    els.ruler.parentElement.style.width = `${width}px`;
    els.ruler.replaceChildren();
    for (let seconds = 0; seconds <= width / state.zoom; seconds += 10) {
      const mark = document.createElement("span"); mark.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; mark.style.left = `${seconds * state.zoom + 4}px`; els.ruler.append(mark);
    }
    els.list.replaceChildren();
    for (const track of state.tracks) renderTrack(track, width);
    positionPlayhead();
    renderSelection(); renderPiano(); renderEnvelope(); updateUndoButtons();
  }
  function renderTrack(track, width) {
    const row = document.createElement("div"); row.className = `track-row${track.id === state.selectedTrackId ? " active-track-row" : ""}`; row.dataset.trackId = track.id; row.setAttribute("aria-selected", String(track.id === state.selectedTrackId));
    const controls = document.createElement("div"); controls.className = `track-controls${track.id === state.selectedTrackId ? " active-track" : ""}`;
    controls.innerHTML = `<div class="track-info"><button class="track-name" type="button" title="Duplo clique para renomear">${esc(track.name)}</button><small class="track-type">${track.type === "midi" ? "SINTETIZADOR MIDI" : "ÁUDIO"}</small></div><div class="track-buttons"><button type="button" data-action="mute" aria-label="Silenciar faixa" class="${track.muted ? "on" : ""}">M</button><button type="button" data-action="solo" aria-label="Ouvir faixa solo" class="${track.solo ? "on" : ""}">S</button><button type="button" data-action="remove-track" aria-label="Excluir faixa">×</button></div><input class="track-volume" type="range" min="0" max="100" value="${Math.round(track.volume * 100)}" aria-label="Volume da faixa"><input class="track-pan" type="range" min="-100" max="100" value="${Math.round(track.pan * 100)}" aria-label="Pan da faixa">`;
    const lane = document.createElement("div"); lane.className = "track-lane"; lane.style.width = `${width}px`; lane.dataset.trackId = track.id;
    for (const clip of track.clips) renderClip(track, clip, lane);
    controls.addEventListener("click", event => { if (!event.target.closest("[data-action],input")) { state.selectedTrackId = track.id; renderSelection(); renderPiano(); } });
    controls.addEventListener("dblclick", event => { if (event.target.closest(".track-name")) { const name = prompt("Nome da faixa:", track.name); if (name?.trim()) { checkpoint(); track.name = name.trim().slice(0, 40); saveProject(); render(); } } });
    controls.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "remove-track") { if (state.tracks.length < 2) { setStatus("O projeto precisa manter ao menos uma faixa."); return; } checkpoint(); state.tracks = state.tracks.filter(item => item.id !== track.id); state.selected = state.selected.filter(clipId => !track.clips.some(clip => clip.id === clipId)); if (state.selectedTrackId === track.id) state.selectedTrackId = state.tracks[0]?.id || null; routeNodes.delete(track.id); }
      if (action === "mute" || action === "solo") { checkpoint(); track[action === "mute" ? "muted" : "solo"] = !track[action === "mute" ? "muted" : "solo"]; state.tracks.forEach(updateRoute); }
      saveProject(); render();
    }));
    controls.querySelector(".track-volume").addEventListener("input", event => { track.volume = Number(event.target.value) / 100; updateRoute(track); saveProject(); });
    controls.querySelector(".track-pan").addEventListener("input", event => { track.pan = Number(event.target.value) / 100; updateRoute(track); saveProject(); });
    lane.addEventListener("pointerdown", event => {
      if (event.target.closest(".audio-clip")) return;
      state.selectedTrackId = track.id; const rect = lane.getBoundingClientRect(); state.playhead = Math.max(0, (event.clientX - rect.left + lane.scrollLeft) / state.zoom); positionPlayhead(); renderSelection(); renderPiano(); saveProject();
    });
    lane.addEventListener("dragover", event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); });
    lane.addEventListener("drop", event => { event.preventDefault(); const files = [...event.dataTransfer.files].filter(file => file.type.startsWith("audio/")); if (files.length) importFiles(files, track); });
    row.append(controls, lane); els.list.append(row);
  }
  function renderClip(track, clip, lane) {
    const block = document.createElement("div");
    block.className = `audio-clip${state.selected.includes(clip.id) ? " selected" : ""}${clip.type === "midi" ? " midi-clip" : ""}`;
    block.dataset.clipId = clip.id; block.style.left = `${clip.start * state.zoom}px`; block.style.width = `${Math.max(38, durationOf(clip) * state.zoom)}px`;
    if (clip.type === "midi") {
      block.innerHTML = `<span class="clip-label">${esc(clip.name || "MIDI")}</span>`;
      for (const note of clip.notes || []) { const bar = document.createElement("i"); bar.className = "midi-note"; bar.style.left = `${4 + note.step / 16 * 92}%`; bar.style.top = `${13 + note.pitch * 5}px`; bar.style.width = "3%"; block.append(bar); }
    } else {
      const canvas = document.createElement("canvas"); canvas.width = Math.min(12000, Math.max(80, Math.round(durationOf(clip) * 10))); canvas.height = 140; block.append(canvas);
      const title = document.createElement("span"); title.className = "clip-label"; title.textContent = clip.name; block.append(title);
      drawWaveform(canvas, buffers.get(clip.audioId), clip);
    }
    block.addEventListener("pointerdown", event => {
      if (event.button !== 0) return; event.stopPropagation();
      const multi = event.ctrlKey || event.metaKey; state.selectedTrackId = track.id; state.selected = multi ? state.selected.includes(clip.id) ? state.selected.filter(value => value !== clip.id) : [...state.selected, clip.id] : [clip.id]; renderSelection(); checkpoint();
      const startX = event.clientX, initial = clip.start; block.setPointerCapture(event.pointerId);
      const move = moveEvent => { const delta = (moveEvent.clientX - startX) / state.zoom; clip.start = Math.max(0, initial + delta); block.style.left = `${clip.start * state.zoom}px`; positionPlayhead(); };
      const up = () => { block.removeEventListener("pointermove", move); block.removeEventListener("pointerup", up); saveProject(); render(); };
      block.addEventListener("pointermove", move); block.addEventListener("pointerup", up, { once: true });
    });
    lane.append(block);
  }
  function drawStoredWaveform(ctx, peaks, width, height) {
    if (!peaks?.length) return false;
    let maxMagnitude = 0;
    for (const peak of peaks) maxMagnitude = Math.max(maxMagnitude, Math.abs(peak[0]), Math.abs(peak[1]));
    const scale = maxMagnitude > .0001 ? Math.min(24, .92 / maxMagnitude) : 1;
    const center = height / 2;
    ctx.fillStyle = "#7846b8";
    for (let x = 0; x < width; x++) {
      const from = Math.floor(x * peaks.length / width), to = Math.max(from + 1, Math.floor((x + 1) * peaks.length / width));
      let min = 1, max = -1;
      for (let i = from; i < to && i < peaks.length; i++) { min = Math.min(min, peaks[i][0]); max = Math.max(max, peaks[i][1]); }
      const top = center - Math.min(.92, Math.max(0, max * scale)) * center;
      const bottom = center - Math.max(-.92, Math.min(0, min * scale)) * center;
      const barHeight = Math.max(2, Math.abs(bottom - top));
      ctx.fillRect(x, Math.min(top, bottom), 1, barHeight);
    }
    return true;
  }
  function compressWaveformPeaks(peaks, limit = 1800) {
    if (!peaks?.length) return [];
    if (peaks.length <= limit) return peaks.map(point => [point[0], point[1]]);
    const compact = [];
    for (let i = 0; i < limit; i++) {
      const from = Math.floor(i * peaks.length / limit), to = Math.max(from + 1, Math.floor((i + 1) * peaks.length / limit));
      let min = 1, max = -1;
      for (let j = from; j < to; j++) { min = Math.min(min, peaks[j][0]); max = Math.max(max, peaks[j][1]); }
      compact.push([min, max]);
    }
    return compact;
  }
  function buildWaveformPeaks(buffer, limit = 1800) {
    if (!buffer?.length) return [];
    const samples = buffer.getChannelData(0), bucketSize = Math.max(1, Math.ceil(samples.length / limit)), peaks = [];
    for (let start = 0; start < samples.length; start += bucketSize) {
      let min = 1, max = -1;
      for (let i = start; i < Math.min(samples.length, start + bucketSize); i++) { min = Math.min(min, samples[i]); max = Math.max(max, samples[i]); }
      peaks.push([min, max]);
    }
    return peaks;
  }
  function sliceWaveformPeaks(peaks, from, to) {
    if (!peaks?.length) return peaks;
    const start = Math.max(0, Math.min(peaks.length - 1, Math.floor(from * peaks.length)));
    const end = Math.max(start + 1, Math.min(peaks.length, Math.ceil(to * peaks.length)));
    return peaks.slice(start, end);
  }
  function drawWaveform(canvas, buffer, clip) {
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const w = canvas.width, h = canvas.height; ctx.clearRect(0, 0, w, h);
    if (drawStoredWaveform(ctx, clip.waveformPeaks, w, h)) return;
    if (!buffer) { ctx.fillStyle = "#111"; ctx.font = "12px sans-serif"; ctx.fillText("ÁUDIO", 6, 18); return; }
    const channel = buffer.getChannelData(0); const start = Math.floor(clip.sourceStart * buffer.sampleRate), end = Math.floor(clip.sourceEnd * buffer.sampleRate); const span = Math.max(1, end - start), step = Math.ceil(span / w);
    ctx.fillStyle = "#111";
    for (let x = 0; x < w; x++) { let min = 1, max = -1; for (let j = 0; j < step && start + x * step + j < end; j++) { const sample = channel[start + x * step + j] || 0; min = Math.min(min, sample); max = Math.max(max, sample); } const y1 = (1 - max) * h / 2, y2 = (1 - min) * h / 2; ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1)); }
  }
  function positionPlayhead() { const px = state.playhead * state.zoom; els.playhead.style.left = `${px}px`; els.time.textContent = `${String(Math.floor(state.playhead / 60)).padStart(2, "0")}:${String(Math.floor(state.playhead % 60)).padStart(2, "0")}.${String(Math.floor(state.playhead % 1 * 100)).padStart(2, "0")}`; }
  function renderSelection() {
    for (const row of els.list.querySelectorAll(".track-row")) { const active = row.dataset.trackId === state.selectedTrackId; row.classList.toggle("active-track-row", active); row.setAttribute("aria-selected", String(active)); }
    const one = selectedClip();
    els.selection.textContent = one ? `${one.track.name} / ${one.clip.name || "CLIPE"}` : state.selected.length ? `${state.selected.length} CLIPES SELECIONADOS` : "NENHUM CLIPE SELECIONADO";
    const canTrimAtPlayhead = Boolean(one && one.clip.type !== "midi" && state.playhead > one.clip.start + .025 && state.playhead < clipEnd(one.clip) - .025);
    $("splitButton").disabled = !canTrimAtPlayhead; $("trimStartButton").disabled = !canTrimAtPlayhead; $("trimEndButton").disabled = !canTrimAtPlayhead;
    for (const buttonId of ["duplicateButton", "deleteButton"]) $(buttonId).disabled = !one;
    $("joinButton").disabled = state.selected.length < 2;
    $("clipGain").disabled = !one || one.clip.type === "midi";
    if (one && one.clip.type !== "midi") { $("clipGain").value = Math.round((one.clip.gain ?? 1) * 100); $("clipGainValue").textContent = `${Math.round((one.clip.gain ?? 1) * 100)}%`; }
    const track = activeTrack();
    $("inspectorTrack").textContent = track?.name || "MASTER";
    $("toneControl").value = Math.round((track?.tone ?? 1) * 100);
    $("delayControl").value = Math.round((track?.delay ?? 0) * 100);
    $("reverbControl").value = Math.round((track?.reverb ?? 0) * 100);
    $("toneValue").textContent = `${$("toneControl").value}%`; $("delayValue").textContent = `${$("delayControl").value}%`; $("reverbValue").textContent = `${$("reverbControl").value}%`;
  }
  function renderPiano() {
    els.piano.replaceChildren();
    const midi = selectedClip();
    if (!midi || midi.clip.type !== "midi") { els.piano.textContent = "Selecione uma faixa MIDI para editar as notas."; return; }
    for (let pitch = 0; pitch < PITCHES.length; pitch++) {
      const label = document.createElement("span"); label.className = "piano-key"; label.textContent = PITCHES[pitch]; els.piano.append(label);
      for (let step = 0; step < 16; step++) {
        const button = document.createElement("button"); button.type = "button"; button.className = `${step % 4 === 0 ? "beat " : ""}${midi.clip.notes?.some(note => note.step === step && note.pitch === pitch) ? "note-on" : ""}`; button.setAttribute("aria-label", `${PITCHES[pitch]}, passo ${step + 1}`); button.title = `${PITCHES[pitch]} · passo ${step + 1}`;
        button.addEventListener("click", () => { checkpoint(); midi.clip.notes ||= []; const index = midi.clip.notes.findIndex(note => note.step === step && note.pitch === pitch); if (index >= 0) midi.clip.notes.splice(index, 1); else midi.clip.notes.push({ step, pitch, velocity: .8 }); midi.clip.duration = Math.max(midi.clip.duration, 60 / state.bpm * 4); saveProject(); render(); });
        els.piano.append(button);
      }
    }
  }
  function renderEnvelope() {
    const canvas = els.envelope, ctx = canvas.getContext("2d"); if (!ctx) return;
    const { width: w, height: h } = canvas; ctx.clearRect(0, 0, w, h); ctx.fillStyle = "#fbfbfb"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#ddd"; ctx.lineWidth = 1; for (let i = 0; i <= 4; i++) { const y = i * h / 4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = "#8bbd00"; ctx.lineWidth = 3; const item = selectedClip(); const points = item?.clip.envelope || [{ x: 0, y: .8 }, { x: 1, y: .8 }];
    ctx.beginPath(); points.forEach((point, index) => { const x = point.x * w, y = (1 - point.y) * h; index ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.fillStyle = "#111"; for (const point of points) { ctx.beginPath(); ctx.arc(point.x * w, (1 - point.y) * h, 5, 0, Math.PI * 2); ctx.fill(); }
  }
  let draggingPoint = -1;
  els.envelope.addEventListener("pointerdown", event => { const item = selectedClip(); if (!item || item.clip.type === "midi") return; const rect = els.envelope.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)); const y = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height)); item.clip.envelope ||= [{ x: 0, y: .8 }, { x: 1, y: .8 }]; let closest = -1, distance = .05; item.clip.envelope.forEach((point, index) => { const d = Math.hypot(point.x - x, point.y - y); if (d < distance) { distance = d; closest = index; } }); checkpoint(); if (closest < 0) { item.clip.envelope.push({ x, y }); item.clip.envelope.sort((a, b) => a.x - b.x); closest = item.clip.envelope.findIndex(point => point.x === x && point.y === y); } draggingPoint = closest; els.envelope.setPointerCapture(event.pointerId); moveEnvelopePoint(event); });
  els.envelope.addEventListener("pointermove", event => { if (draggingPoint >= 0) moveEnvelopePoint(event); });
  els.envelope.addEventListener("pointerup", () => { if (draggingPoint >= 0) { draggingPoint = -1; saveProject(); renderEnvelope(); } });
  function moveEnvelopePoint(event) { const item = selectedClip(); if (!item) return; const rect = els.envelope.getBoundingClientRect(); const points = item.clip.envelope; const point = points[draggingPoint]; if (!point) return; point.x = Math.max(draggingPoint ? points[draggingPoint - 1].x + .01 : 0, Math.min(draggingPoint < points.length - 1 ? points[draggingPoint + 1].x - .01 : 1, (event.clientX - rect.left) / rect.width)); point.y = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height)); renderEnvelope(); }
  function setStatus(message) { els.status.textContent = message; }
  async function addTrack() { await projectReady; checkpoint(); const track = freshTrack(`FAIXA ${state.tracks.length + 1}`); state.tracks.push(track); state.selectedTrackId = track.id; if (audioContext && track.type !== "midi") createTrackRoute(track); saveProject(); render(); setStatus("Nova faixa de áudio criada"); }
  async function addMidiTrack() { await projectReady; checkpoint(); const track = freshTrack(`MIDI ${state.tracks.filter(item => item.type === "midi").length + 1}`, "midi"); track.clips.push({ id: id(), type: "midi", name: "REGIÃO MIDI", start: state.playhead, duration: 60 / state.bpm * 4, notes: [] }); state.tracks.push(track); state.selectedTrackId = track.id; state.selected = [track.clips[0].id]; saveProject(); render(); setStatus("Faixa MIDI criada · clique na grade para desenhar notas"); }
  async function importFiles(files, targetTrack) {
    await projectReady;
    const valid = [...files].filter(file => file.type.startsWith("audio/"));
    if (!valid.length) { setStatus("Escolha um arquivo de áudio compatível."); return; }
    setStatus(`Importando ${valid.length} arquivo(s)…`);
    for (const file of valid) {
      try {
        const blob = file.slice(0, file.size, file.type); const audioBuffer = await decodeBlob(blob); const key = id(); await storeBlob(key, blob); buffers.set(key, audioBuffer);
        let track = targetTrack || state.tracks.find(item => item.id === state.selectedTrackId && item.type === "audio") || state.tracks.find(item => item.type === "audio") || null;
        if (!track) { track = freshTrack(`FAIXA ${state.tracks.length + 1}`); state.tracks.push(track); }
        checkpoint(); const start = Math.max(0, state.playhead);
        const clip = { id: id(), type: "audio", audioId: key, name: file.name.slice(0, 60), start, sourceStart: 0, sourceEnd: audioBuffer.duration, gain: 1, envelope: [{ x: 0, y: .8 }, { x: 1, y: .8 }] };
        track.clips.push(clip); state.selected = [clip.id]; setStatus(`Importado: ${file.name}`);
      } catch (error) { setStatus(`Não foi possível abrir ${file.name}: ${error.message}`); }
    }
    saveProject(); render();
  }
  function startLiveWaveform(stream) {
    try {
      const ctx = audioCtx();
      recordingSource = ctx.createMediaStreamSource(stream);
      recordingAnalyser = ctx.createAnalyser(); recordingAnalyser.fftSize = 1024;
      recordingSilencer = ctx.createGain(); recordingSilencer.gain.value = 0;
      recordingSource.connect(recordingAnalyser); recordingAnalyser.connect(recordingSilencer); recordingSilencer.connect(ctx.destination);
      lastWaveformSampleAt = 0; liveWaveformPeaks = []; els.recordingMonitor.hidden = false;
      const samples = new Uint8Array(recordingAnalyser.fftSize), canvas = els.recordingWaveform, draw = canvas.getContext("2d");
      const paint = () => {
        if (!recordingAnalyser || !draw) return;
        const ratio = window.devicePixelRatio || 1, width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
        if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
        draw.setTransform(ratio, 0, 0, ratio, 0, 0); draw.clearRect(0, 0, width, height);
        drawAnalyserWaveform(draw, recordingAnalyser, samples, width, height);
        const elapsed = (performance.now() - recordingStartedAt) / 1000;
        els.recordingTime.textContent = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}.${String(Math.floor(elapsed % 1 * 100)).padStart(2, "0")}`;
        updateRecordingClipWaveform(elapsed); recordingFrame = requestAnimationFrame(paint);
      };
      paint();
    } catch (error) { console.error("Falha na forma de onda ao vivo:", error); els.recordingMonitor.hidden = false; els.recordingTime.textContent = "ERRO NA VISUALIZAÇÃO"; }
  }
  function updateRecordingClipWaveform(elapsed) {
    if (!recordingClip || !recordingTrack || performance.now() - lastClipWaveformUpdate < 180) return;
    lastClipWaveformUpdate = performance.now(); recordingClip.sourceEnd = Math.max(.05, elapsed);
    recordingClip.waveformPeaks = compressWaveformPeaks(liveWaveformPeaks, 900);
    const block = els.list.querySelector('[data-clip-id="' + recordingClip.id + '"]'); if (!block) return;
    block.style.width = Math.min(100000, Math.max(38, elapsed * state.zoom)) + 'px';
    const canvas = block.querySelector('canvas'), context = canvas?.getContext('2d'); if (!canvas || !context) return;
    const width = Math.min(12000, Math.max(80, Math.round(elapsed * 10))); if (canvas.width !== width) canvas.width = width;
    context.clearRect(0, 0, canvas.width, canvas.height); drawStoredWaveform(context, recordingClip.waveformPeaks, canvas.width, canvas.height);
  }
  function drawAnalyserWaveform(ctx, analyser, samples, width, height) {
    analyser.getByteTimeDomainData(samples);
    const now = performance.now();
    if (now - lastWaveformSampleAt >= 45) {
      let min = 1, max = -1;
      for (const sample of samples) { const value = (sample - 128) / 128; min = Math.min(min, value); max = Math.max(max, value); }
      liveWaveformPeaks.push([min, max]); lastWaveformSampleAt = now;
    }
    ctx.fillStyle = "#7846b8"; drawStoredWaveform(ctx, liveWaveformPeaks, width, height);
  }
  function stopLiveWaveform() {
    if (recordingFrame) cancelAnimationFrame(recordingFrame);
    recordingFrame = 0;
    for (const node of [recordingSource, recordingAnalyser, recordingSilencer]) { try { node?.disconnect(); } catch {} }
    recordingSource = recordingAnalyser = recordingSilencer = null;
    els.recordingMonitor.hidden = true;
  }
  async function startRecording() {
    if (recordingSetup || recordingFinalizing) return;
    recordingSetup = true;
    try {
      await projectReady;
      const recordingStart = 0;
      stopPlayback(true);
      state.playhead = recordingStart; positionPlayhead(); renderSelection(); saveProject();
      const recordingContext = audioCtx();
      if (recordingContext.state === "suspended") await recordingContext.resume();
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("A gravação requer um navegador compatível e uma conexão segura (HTTPS).");
      recorderStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const mime = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(recorderStream, mime ? { mimeType: mime } : undefined); recordChunks = [];
      recorder.ondataavailable = event => { if (event.data.size) recordChunks.push(event.data); };
      recorder.onstop = async () => {
        recordingFinalizing = true;
        els.record.disabled = true; els.play.disabled = true;
        setStatus("Finalizando gravação e preparando a forma de onda…");
        const targetTrack = recordingTrack;
        const targetClip = recordingClip;
        const capturedPeaks = compressWaveformPeaks(liveWaveformPeaks);
        const elapsed = Math.max(.05, (performance.now() - (recordingStartedAt || performance.now())) / 1000);
        stopLiveWaveform();
        const blob = new Blob(recordChunks, { type: recorder.mimeType || "audio/webm" });
        recorderStream?.getTracks().forEach(track => track.stop()); recorderStream = null;
        els.record.disabled = true;
        try {
          if (!blob.size) throw new Error("O navegador não entregou dados de áudio desta gravação.");
          const key = id();
          await storeBlob(key, blob);
          let buffer = null;
          try { buffer = await decodeBlob(blob); } catch (decodeError) { console.error("Não foi possível decodificar a gravação:", decodeError); }
          if (buffer) buffers.set(key, buffer);
          const decodedPeaks = buildWaveformPeaks(buffer);
          const liveHasSignal = capturedPeaks.some(([min, max]) => Math.max(Math.abs(min), Math.abs(max)) > .003);
          const savedPeaks = compressWaveformPeaks(decodedPeaks.length ? decodedPeaks : (liveHasSignal ? capturedPeaks : []));
          if (!savedPeaks.length) for (let i = 0; i < 160; i++) savedPeaks.push([-.015, .015]);
          let track = state.tracks.find(item => item.id === targetTrack?.id && item.type === "audio") || targetTrack || state.tracks.find(item => item.type === "audio") || freshTrack("VOZ 1");
          if (!state.tracks.some(item => item.id === track.id)) state.tracks.push(track);
          track.type = "audio";
          track.clips ||= [];
          const clip = targetClip || { id: id(), type: "audio", start: recordingStart, sourceStart: 0, gain: 1, envelope: [{ x: 0, y: .8 }, { x: 1, y: .8 }] };
          Object.assign(clip, { type: "audio", audioId: key, name: "Gravação " + new Date().toLocaleTimeString("pt-BR"), start: recordingStart, sourceStart: 0, sourceEnd: Math.max(.05, buffer?.duration || elapsed), waveformPeaks: savedPeaks });
          if (!track.clips.some(item => item.id === clip.id)) track.clips.push(clip);
          state.selectedTrackId = track.id; state.selected = [clip.id]; state.playhead = recordingStart;
          const saved = persistProjectNow();
          render();
          recordingClip = recordingTrack = null; liveWaveformPeaks = [];
          setStatus(!saved
            ? "Gravação aparece na faixa, mas o navegador não conseguiu salvar o projeto localmente"
            : buffer ? "Gravação salva na faixa e pronta para reprodução" : "Forma de onda salva; o navegador não conseguiu decodificar o áudio para reprodução");
        } catch (error) {
          const track = targetTrack || freshTrack("VOZ 1");
          const clip = targetClip || { id: id(), type: "audio", start: recordingStart, sourceStart: 0, gain: 1, envelope: [{ x: 0, y: .8 }, { x: 1, y: .8 }] };
          if (!state.tracks.some(item => item.id === track.id)) state.tracks.push(track);
          track.clips ||= [];
          Object.assign(clip, { type: "audio", name: "Gravação recuperada", start: recordingStart, sourceStart: 0, sourceEnd: elapsed, waveformPeaks: capturedPeaks });
          if (!track.clips.some(item => item.id === clip.id)) track.clips.push(clip);
          state.selectedTrackId = track.id; state.selected = [clip.id]; state.playhead = recordingStart;
          const saved = persistProjectNow();
          try { render(); } catch (renderError) { console.error("Falha ao redesenhar a faixa gravada:", renderError); }
          setStatus("A faixa foi preservada" + (saved ? "" : " apenas nesta sessão") + ", mas houve erro ao finalizar o áudio: " + error.message);
        } finally {
          recordingClip = recordingTrack = null; liveWaveformPeaks = [];
          recordingFinalizing = false;
          els.record.disabled = false; els.play.disabled = false;
          els.record.classList.remove("recording"); els.record.innerHTML = "●<small>REC</small>";
        }
      };
      state.playhead = recordingStart; positionPlayhead(); saveProject();
      recorder.start(250); recordingStartedAt = performance.now(); lastWaveformSampleAt = 0; liveWaveformPeaks = []; startLiveWaveform(recorderStream);
      recordingTrack = state.tracks.find(item => item.id === state.selectedTrackId && item.type === "audio") || state.tracks.find(item => item.type === "audio");
      if (!recordingTrack) { recordingTrack = freshTrack('VOZ ' + (state.tracks.filter(item => item.name.startsWith('VOZ')).length + 1)); state.tracks.push(recordingTrack); }
      checkpoint(); recordingClip = { id: id(), type: "audio", audioId: "", name: "GRAVANDO…", start: recordingStart, sourceStart: 0, sourceEnd: .05, gain: 1, waveformPeaks: [], envelope: [{ x: 0, y: .8 }, { x: 1, y: .8 }] };
      recordingTrack.clips.push(recordingClip); state.selectedTrackId = recordingTrack.id; state.selected = [recordingClip.id]; lastClipWaveformUpdate = 0; render();
      els.play.disabled = true; els.record.classList.add("recording"); els.record.innerHTML = "■<small>PARAR REC</small>"; setStatus("Gravando na faixa selecionada a partir de 0:00… clique em PARAR REC para finalizar"); recordingSetup = false; recordingFinalizing = false;
    } catch (error) {
      recordingSetup = false;
      if (recorder?.state === "recording") {
        setStatus("Houve um erro na interface; salvando o áudio capturado antes de parar…");
        stopRecording();
      } else {
        recorderStream?.getTracks().forEach(track => track.stop()); recorderStream = null;
        stopLiveWaveform(); els.record.disabled = false; els.play.disabled = false;
        setStatus(error.message || "Não foi possível acessar o microfone.");
      }
    }
  }
  function stopRecording() {
    if (recorder?.state === "recording" && !recordingFinalizing) {
      recordingFinalizing = true;
      els.record.disabled = true; els.play.disabled = true;
      recorder.stop();
      els.record.classList.remove("recording"); els.record.innerHTML = "●<small>REC</small>";
      setStatus("Finalizando gravação…");
    }
  }
  function envelopeAt(points, x) { if (!points?.length) return .8; const right = points.findIndex(point => point.x >= x); if (right <= 0) return points[0].y; const a = points[right - 1], b = points[right]; if (!b) return points.at(-1).y; const t = (x - a.x) / (b.x - a.x); return a.y + (b.y - a.y) * t; }
  function scheduleEnvelope(param, clip, start, duration) { const points = clip.envelope || [{ x: 0, y: .8 }, { x: 1, y: .8 }]; param.setValueAtTime(0, start); param.linearRampToValueAtTime((clip.gain ?? 1) * points[0].y, start + .005); for (const point of points.slice(1)) param.linearRampToValueAtTime((clip.gain ?? 1) * point.y, start + Math.max(.01, point.x * duration)); }
  function scheduleMidi(track, clip, when, offset = 0, destination) {
    const ctx = audioContext, output = destination || routeNodes.get(track.id)?.volume;
    if (!output) return;
    const stepDuration = 60 / state.bpm / 4;
    for (const note of clip.notes || []) {
      const at = clip.start + note.step * stepDuration;
      if (at < offset) continue;
      const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = "square"; osc.frequency.value = FREQUENCIES[note.pitch] || 440; gain.gain.setValueAtTime(0, when + at - offset); gain.gain.linearRampToValueAtTime((note.velocity || .7) * .25, when + at - offset + .012); gain.gain.setValueAtTime((note.velocity || .7) * .25, when + at - offset + stepDuration * .75); gain.gain.linearRampToValueAtTime(0, when + at - offset + stepDuration * .95); osc.connect(gain); gain.connect(output); osc.start(when + at - offset); osc.stop(when + at - offset + stepDuration); activeSources.push(osc);
    }
  }
  async function play() {
    try {
      await projectReady;
      const ctx = audioCtx();
      if (ctx.state === "suspended") await ctx.resume();
      stopPlayback(false); state.playing = true; playOffset = state.playhead; playStartedAt = ctx.currentTime; activeSources = [];
      const soloExists = state.tracks.some(track => track.solo);
      for (const track of state.tracks) {
        if (!track.muted && (!soloExists || track.solo)) { if (!routeNodes.has(track.id)) createTrackRoute(track); updateRoute(track); }
        if (track.muted || (soloExists && !track.solo)) continue;
        for (const clip of track.clips) {
          if (clipEnd(clip) <= playOffset) continue;
          if (clip.type === "midi") { scheduleMidi(track, clip, ctx.currentTime, playOffset); continue; }
          const buffer = buffers.get(clip.audioId), route = routeNodes.get(track.id); if (!buffer || !route) continue;
          const source = ctx.createBufferSource(), clipGain = ctx.createGain(); source.buffer = buffer;
          const timelineOffset = Math.max(0, playOffset - clip.start), audioOffset = clip.sourceStart + timelineOffset, duration = Math.min(clip.sourceEnd, buffer.duration) - audioOffset, at = ctx.currentTime + Math.max(0, clip.start - playOffset);
          const audibleDuration = Math.min(duration, clipEnd(clip) - Math.max(playOffset, clip.start));
          scheduleEnvelope(clipGain.gain, clip, ctx.currentTime + Math.max(0, clip.start - playOffset), Math.max(.01, durationOf(clip)));
          source.connect(clipGain); clipGain.connect(route.volume);
          if (audibleDuration > 0) { source.start(at, audioOffset, audibleDuration); activeSources.push(source); }
        }
      }
      els.play.classList.add("playing"); setStatus("Reproduzindo mix");
      const tick = () => { if (!state.playing) return; state.playhead = playOffset + audioContext.currentTime - playStartedAt; positionPlayhead(); if (state.playhead >= totalDuration()) stopPlayback(true); else requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    } catch (error) { setStatus(error.message); }
  }
  async function resetProject() {
    await projectReady;
    if (recorder?.state === "recording" || recordingFinalizing) { setStatus("Pare a gravação antes de resetar o projeto."); return; }
    if (!confirm("Isso apagará as faixas, gravações e áudios salvos deste projeto neste navegador. Não será possível desfazer. Continuar?")) return;
    stopPlayback(true);
    try {
      if (!db) await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction("audio", "readwrite");
        tx.objectStore("audio").clear();
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error("Não foi possível limpar os áudios."));
      });
      localStorage.removeItem(PROJECT_KEY);
    } catch (error) {
      setStatus(`Não foi possível resetar o projeto: ${error.message}`);
      return;
    }
    for (const nodes of routeNodes.values()) for (const node of Object.values(nodes)) { try { node.disconnect(); } catch {} }
    routeNodes.clear(); buffers.clear(); blobs.clear();
    undoStack.length = 0; redoStack.length = 0;
    state.tracks = [freshTrack("FAIXA 1")]; state.selected = []; state.selectedTrackId = state.tracks[0].id;
    state.playhead = 0; state.zoom = 16; state.bpm = 120; state.master = .8;
    $("bpmInput").value = "120"; $("masterVolume").value = "80"; $("masterValue").textContent = "80%"; $("zoomControl").value = "16";
    if (audioContext) createTrackRoute(state.tracks[0]);
    setTab("edit"); saveProject(); render(); updateUndoButtons();
    setStatus("Projeto resetado · comece com uma faixa vazia");
  }
  function stopPlayback(reset = false) {
    if (state.playing) { state.playing = false; for (const source of activeSources) { try { source.stop(); } catch {} } activeSources = []; els.play.classList.remove("playing"); saveProject(); }
    if (reset) { state.playhead = 0; positionPlayhead(); }
  }
  function trimEnvelope(points, from, to) {
    const source = points?.length ? points : [{ x: 0, y: .8 }, { x: 1, y: .8 }];
    const startY = envelopeAt(source, from), endY = envelopeAt(source, to);
    return [{ x: 0, y: startY }, ...source.filter(point => point.x > from && point.x < to).map(point => ({ x: (point.x - from) / (to - from), y: point.y })), { x: 1, y: endY }];
  }
  function trimClipStart() {
    const item = selectedClip(); if (!item || item.clip.type === "midi") return;
    const { track, clip } = item, amount = state.playhead - clip.start, duration = durationOf(clip);
    if (amount <= .025 || amount >= duration - .025) return;
    checkpoint(); const fraction = amount / duration;
    clip.sourceStart += amount; clip.start = state.playhead; clip.envelope = trimEnvelope(clip.envelope, fraction, 1); clip.waveformPeaks = sliceWaveformPeaks(clip.waveformPeaks, fraction, 1);
    saveProject(); render(); setStatus("Início do áudio recortado no cursor");
  }
  function trimClipEnd() {
    const item = selectedClip(); if (!item || item.clip.type === "midi") return;
    const { clip } = item, amount = state.playhead - clip.start, duration = durationOf(clip);
    if (amount <= .025 || amount >= duration - .025) return;
    checkpoint(); const fraction = amount / duration;
    clip.sourceEnd = clip.sourceStart + amount; clip.envelope = trimEnvelope(clip.envelope, 0, fraction); clip.waveformPeaks = sliceWaveformPeaks(clip.waveformPeaks, 0, fraction);
    saveProject(); render(); setStatus("Final do áudio recortado no cursor");
  }
  function splitClip() {
    const item = selectedClip(); if (!item || item.clip.type === "midi") return;
    const { track, clip } = item; const splitAt = state.playhead;
    if (splitAt <= clip.start + .025 || splitAt >= clipEnd(clip) - .025) { setStatus("Mova o cursor para dentro do clipe para dividi-lo."); return; }
    checkpoint(); const leftDuration = splitAt - clip.start; const originalEnd = clip.sourceEnd; const left = { ...clip, sourceEnd: clip.sourceStart + leftDuration, envelope: clip.envelope?.filter(point => point.x < leftDuration / durationOf(clip)).map(point => ({ ...point, x: point.x / (leftDuration / durationOf(clip)) })) }; const right = { ...clip, id: id(), start: splitAt, sourceStart: clip.sourceStart + leftDuration, sourceEnd: originalEnd, envelope: clip.envelope?.filter(point => point.x >= leftDuration / durationOf(clip)).map(point => ({ ...point, x: (point.x - leftDuration / durationOf(clip)) / (1 - leftDuration / durationOf(clip)) })) }; const waveformSplit = leftDuration / durationOf(clip); left.waveformPeaks = sliceWaveformPeaks(clip.waveformPeaks, 0, waveformSplit); right.waveformPeaks = sliceWaveformPeaks(clip.waveformPeaks, waveformSplit, 1); left.envelope ||= [{ x: 0, y: .8 }, { x: 1, y: .8 }]; right.envelope ||= [{ x: 0, y: .8 }, { x: 1, y: .8 }]; const index = track.clips.indexOf(clip); track.clips.splice(index, 1, left, right); state.selected = [left.id, right.id]; saveProject(); render(); setStatus("Clipe dividido em dois");
  }
  function duplicateClip() { const item = selectedClip(); if (!item) return; checkpoint(); const copy = JSON.parse(JSON.stringify(item.clip)); copy.id = id(); copy.start = clipEnd(item.clip) + .12; copy.name = `${item.clip.name} (cópia)`; item.track.clips.push(copy); state.selected = [copy.id]; saveProject(); render(); }
  function deleteSelected() { if (!state.selected.length) return; checkpoint(); for (const track of state.tracks) track.clips = track.clips.filter(clip => !state.selected.includes(clip.id)); state.selected = []; saveProject(); render(); setStatus("Clipe(s) excluído(s)"); }
  function mergeBuffers(items) {
    const ctx = audioCtx(); const start = Math.min(...items.map(item => item.clip.start)), end = Math.max(...items.map(item => clipEnd(item.clip))); const channels = Math.max(...items.map(item => buffers.get(item.clip.audioId)?.numberOfChannels || 1)); const output = ctx.createBuffer(channels, Math.ceil((end - start) * ctx.sampleRate), ctx.sampleRate);
    for (const { clip } of items) {
      const input = buffers.get(clip.audioId); if (!input) continue;
      const srcOffset = Math.floor(clip.sourceStart * input.sampleRate); const length = Math.min(Math.floor(durationOf(clip) * ctx.sampleRate), Math.ceil(clipEnd(clip) - start) * ctx.sampleRate - Math.floor((clip.start - start) * ctx.sampleRate)); const destOffset = Math.floor((clip.start - start) * ctx.sampleRate);
      for (let channel = 0; channel < channels; channel++) { const src = input.getChannelData(Math.min(channel, input.numberOfChannels - 1)), dest = output.getChannelData(channel); for (let i = 0; i < length && destOffset + i < dest.length; i++) { const t = i / Math.max(1, length - 1); dest[destOffset + i] += src[srcOffset + i] * (clip.gain ?? 1) * envelopeAt(clip.envelope, t); } }
    }
    return { buffer: output, start, end };
  }
  async function joinSelected() {
    const items = state.selected.map(findClip).filter(Boolean); if (items.length < 2 || items.some(item => item.clip.type !== "audio") || items.some(item => item.track.id !== items[0].track.id)) { setStatus("Selecione pelo menos dois clipes de áudio da mesma faixa."); return; }
    checkpoint(); setStatus("Juntando clipes…"); const merged = mergeBuffers(items); const blob = encodeWav(merged.buffer); const key = id(); await storeBlob(key, blob); buffers.set(key, merged.buffer); const track = items[0].track; const clip = { id: id(), type: "audio", audioId: key, name: "Clipe unido", start: merged.start, sourceStart: 0, sourceEnd: merged.buffer.duration, gain: 1, envelope: [{ x: 0, y: .8 }, { x: 1, y: .8 }] }; track.clips = track.clips.filter(value => !state.selected.includes(value.id)); track.clips.push(clip); state.selected = [clip.id]; saveProject(); render(); setStatus("Clipes unidos em um novo áudio");
  }
  function encodeWav(buffer) {
    const channels = Math.min(2, buffer.numberOfChannels), samples = buffer.length, bytes = 44 + samples * channels * 2, out = new ArrayBuffer(bytes), view = new DataView(out);
    const write = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
    write(0, "RIFF"); view.setUint32(4, bytes - 8, true); write(8, "WAVE"); write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, samples * channels * 2, true);
    const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel)); let offset = 44;
    for (let i = 0; i < samples; i++) for (let channel = 0; channel < channels; channel++) { const sample = Math.max(-1, Math.min(1, data[channel][i])); view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2; }
    return new Blob([out], { type: "audio/wav" });
  }
  async function exportMix() {
    const duration = totalDuration(); if (duration > 600) { setStatus("A exportação está limitada a 10 minutos por projeto."); return; }
    const sampleRate = audioContext?.sampleRate || 44100, Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!Offline) { setStatus("A exportação WAV não é suportada neste navegador."); return; }
    setStatus("Renderizando a mixagem WAV…"); const offline = new Offline(2, Math.ceil((duration + 1) * sampleRate), sampleRate), master = offline.createGain(); master.gain.value = state.master; master.connect(offline.destination);
    const soloExists = state.tracks.some(track => track.solo);
    for (const track of state.tracks) {
      if (track.muted || (soloExists && !track.solo)) continue;
      const volume = offline.createGain(); volume.gain.value = track.volume; const pan = offline.createStereoPanner(); pan.pan.value = track.pan; const filter = offline.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 500 + track.tone * 19500; volume.connect(pan); pan.connect(filter); filter.connect(master);
      if (track.reverb > 0) { const wet = offline.createGain(); const trackReverb = offline.createConvolver(); trackReverb.buffer = impulse(offline, 1.8); wet.gain.value = track.reverb; filter.connect(trackReverb); trackReverb.connect(wet); wet.connect(master); }
      if (track.delay > 0) { const delay = offline.createDelay(1.2), wet = offline.createGain(), feedback = offline.createGain(); delay.delayTime.value = .24; wet.gain.value = track.delay; feedback.gain.value = .18; filter.connect(delay); delay.connect(wet); wet.connect(master); delay.connect(feedback); feedback.connect(delay); }
      for (const clip of track.clips) {
        if (clip.type === "midi") { for (const note of clip.notes || []) { const at = clip.start + note.step * (60 / state.bpm / 4), osc = offline.createOscillator(), gain = offline.createGain(); osc.type = "square"; osc.frequency.value = FREQUENCIES[note.pitch] || 440; gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime((note.velocity || .7) * .25, at + .012); gain.gain.setValueAtTime(.0001, at + .11); osc.connect(gain); gain.connect(volume); osc.start(at); osc.stop(at + .13); } continue; }
        const sourceBuffer = buffers.get(clip.audioId); if (!sourceBuffer) continue; const source = offline.createBufferSource(), clipGain = offline.createGain(); source.buffer = sourceBuffer; scheduleEnvelope(clipGain.gain, clip, clip.start, durationOf(clip)); source.connect(clipGain); clipGain.connect(volume); source.start(clip.start, clip.sourceStart, durationOf(clip));
      }
    }
    try { const rendered = await offline.startRendering(); const blob = encodeWav(rendered); const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = "mixmaster-export.wav"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); setStatus("Mixagem exportada como WAV estéreo"); }
    catch (error) { setStatus(`Erro ao exportar: ${error.message}`); }
  }
  function setTab(tab) { state.tab = tab; document.querySelectorAll("[data-tab]").forEach(button => button.classList.toggle("selected", button.dataset.tab === tab)); document.querySelectorAll("[data-panel]").forEach(panel => { panel.hidden = panel.dataset.panel !== tab; }); if (tab === "midi") renderPiano(); if (tab === "envelope") renderEnvelope(); }

  $("newTrackButton").addEventListener("click", addTrack);
  $("newMidiButton").addEventListener("click", addMidiTrack);
  $("audioFiles").addEventListener("change", event => { importFiles(event.target.files); event.target.value = ""; });
  els.record.addEventListener("click", () => recorder?.state === "recording" ? stopRecording() : startRecording());
  els.play.addEventListener("click", () => state.playing ? stopPlayback(false) : play());
  els.stop.addEventListener("click", () => { stopPlayback(true); setStatus("Reprodução parada"); });
  $("splitButton").addEventListener("click", splitClip);
  $("trimStartButton").addEventListener("click", trimClipStart);
  $("trimEndButton").addEventListener("click", trimClipEnd);
  $("duplicateButton").addEventListener("click", duplicateClip);
  $("deleteButton").addEventListener("click", deleteSelected);
  $("joinButton").addEventListener("click", joinSelected);
  $("exportButton").addEventListener("click", exportMix);
  $("resetProjectButton").addEventListener("click", resetProject);
  $("zoomControl").addEventListener("input", event => { state.zoom = Number(event.target.value); render(); });
  $("bpmInput").addEventListener("change", event => { state.bpm = Math.max(40, Math.min(240, Number(event.target.value) || 120)); event.target.value = state.bpm; saveProject(); render(); });
  $("masterVolume").addEventListener("input", event => { state.master = Number(event.target.value) / 100; $("masterValue").textContent = `${event.target.value}%`; if (audioContext) masterNode.gain.setTargetAtTime(state.master, audioContext.currentTime, .02); saveProject(); });
  $("clipGain").addEventListener("input", event => { const item = selectedClip(); if (!item) return; item.clip.gain = Number(event.target.value) / 100; $("clipGainValue").textContent = `${event.target.value}%`; saveProject(); });
  for (const [control, property, scale] of [["toneControl", "tone", .01], ["delayControl", "delay", .01], ["reverbControl", "reverb", .01]]) $(control).addEventListener("input", event => { const track = activeTrack(); if (!track) return; track[property] = Number(event.target.value) * scale; $(control.replace("Control", "Value")).textContent = `${event.target.value}%`; updateRoute(track); saveProject(); });
  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => setTab(button.dataset.tab)));
  $("undoButton").addEventListener("click", () => { if (!undoStack.length) return; redoStack.push(snapshot()); restoreSnapshot(undoStack.pop()); setStatus("Ação desfeita"); updateUndoButtons(); });
  $("redoButton").addEventListener("click", () => { if (!redoStack.length) return; undoStack.push(snapshot()); restoreSnapshot(redoStack.pop()); setStatus("Ação refeita"); updateUndoButtons(); });
  window.addEventListener("keydown", event => { if (event.target.matches("input,textarea,select")) return; if (event.code === "Space") { event.preventDefault(); state.playing ? stopPlayback(false) : play(); } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); $("undoButton").click(); } if (event.key === "Delete" || event.key === "Backspace") deleteSelected(); });
  window.addEventListener("beforeunload", () => { stopPlayback(); if (recorder?.state === "recording") stopRecording(); if (meterFrame) cancelAnimationFrame(meterFrame); });
  projectReady = loadProject();
})();
