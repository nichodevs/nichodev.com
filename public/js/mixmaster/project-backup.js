import { PITCHES, clipEnd } from "./project-model.js?v=1";
import { loadBlob } from "./project-store.js?v=1";

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler um áudio do projeto."));
    reader.readAsDataURL(blob);
  });
}
function base64ToBlob(value, mimeType) {
  const binary = atob(value), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
}

export async function createProjectBackup(state) {
  const project = { tracks: JSON.parse(JSON.stringify(state.tracks)), selected: [...state.selected], selectedTrackId: state.selectedTrackId, playhead: state.playhead, bpm: state.bpm, master: state.master };
  const audioIds = [...new Set(project.tracks.flatMap(track => track.clips.filter(clip => clip.type !== "midi").map(clip => clip.audioId).filter(Boolean)))];
  let totalBytes = 0; const assets = [];
  for (const assetId of audioIds) {
    const blob = await loadBlob(assetId);
    if (!blob) throw new Error("Um áudio deste projeto não está disponível no armazenamento local.");
    totalBytes += blob.size;
    if (totalBytes > 150 * 1024 * 1024) throw new Error("O backup excede 150 MB de áudio. Exporte uma mixagem WAV ou divida o projeto em partes menores.");
    assets.push({ id: assetId, mimeType: blob.type || "application/octet-stream", dataBase64: await blobToBase64(blob) });
  }
  return { app: "nichodev-mixmaster", formatVersion: 1, exportedAt: new Date().toISOString(), project, assets };
}

export function validateProjectBackup(backup) {
  const validId = value => typeof value === "string" && value.trim().length > 0;
  const inRange = (value, min, max = Infinity) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
  const invalid = message => { throw new Error(message); };
  if (backup?.app !== "nichodev-mixmaster" || backup?.formatVersion !== 1 || !Array.isArray(backup?.project?.tracks) || !backup.project.tracks.length || !Array.isArray(backup.assets)) invalid("O arquivo não é um backup MIXMASTER compatível.");
  const project = backup.project, trackIds = new Set(), clipIds = new Set(), referencedIds = new Set();
  const maxTimeline = 24 * 60 * 60; // Bound imported timelines before creating ruler marks in the DOM.
  if (!inRange(project.playhead ?? 0, 0, maxTimeline) || !inRange(project.bpm ?? 120, 40, 240) || !inRange(project.master ?? .8, 0, 1)) invalid("O backup contém controles de projeto inválidos.");
  for (const track of project.tracks) {
    if (!track || !validId(track.id) || trackIds.has(track.id) || typeof track.name !== "string" || !["audio", "midi"].includes(track.type) || !Array.isArray(track.clips)) invalid("O backup contém uma faixa inválida ou repetida.");
    trackIds.add(track.id);
    for (const [key, min, max] of [["volume", 0, 1], ["pan", -1, 1], ["tone", 0, 1], ["delay", 0, 1], ["reverb", 0, 1]]) if (!inRange(track[key], min, max)) invalid("O backup contém controles de faixa inválidos.");
    if ((track.muted !== undefined && typeof track.muted !== "boolean") || (track.solo !== undefined && typeof track.solo !== "boolean")) invalid("O backup contém controles de faixa inválidos.");
    for (const clip of track.clips) {
      if (!clip || !validId(clip.id) || clipIds.has(clip.id) || !["audio", "midi"].includes(clip.type) || !inRange(clip.start, 0, maxTimeline) || (clip.name !== undefined && typeof clip.name !== "string") || (clip.gain !== undefined && !inRange(clip.gain, 0, 1.5))) invalid("O backup contém um clipe inválido ou repetido.");
      clipIds.add(clip.id);
      if (clip.envelope !== undefined) {
        if (!Array.isArray(clip.envelope)) invalid("O backup contém um envelope inválido.");
        let previousX = -1;
        for (const point of clip.envelope) {
          if (!point || !inRange(point.x, 0, 1) || !inRange(point.y, 0, 1) || point.x < previousX) invalid("O backup contém um envelope inválido.");
          previousX = point.x;
        }
      }
      if (clip.waveformPeaks !== undefined && (!Array.isArray(clip.waveformPeaks) || clip.waveformPeaks.some(pair => !Array.isArray(pair) || pair.length !== 2 || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1]) || pair[0] > pair[1]))) invalid("O backup contém uma forma de onda inválida.");
      if (clip.type === "midi") {
        if (!inRange(clip.duration, Number.MIN_VALUE, maxTimeline) || !Array.isArray(clip.notes ?? [])) invalid("O backup contém uma região MIDI inválida.");
        for (const note of clip.notes || []) if (!note || !Number.isInteger(note.step) || note.step < 0 || note.step > 15 || !Number.isInteger(note.pitch) || note.pitch < 0 || note.pitch >= PITCHES.length || (note.velocity !== undefined && !inRange(note.velocity, 0, 1))) invalid("O backup contém uma nota MIDI inválida.");
      } else {
        if (!validId(clip.audioId) || !inRange(clip.sourceStart, 0) || !inRange(clip.sourceEnd, 0) || clip.sourceEnd <= clip.sourceStart) invalid("O backup contém limites de áudio inválidos.");
        referencedIds.add(clip.audioId);
      }
      if (!inRange(clipEnd(clip), 0, maxTimeline)) invalid("O backup excede o limite de 24 horas da linha do tempo.");
    }
  }
  if (project.selected !== undefined && (!Array.isArray(project.selected) || new Set(project.selected).size !== project.selected.length || project.selected.some(clipId => !clipIds.has(clipId)))) invalid("O backup contém uma seleção inválida.");
  if (project.selectedTrackId != null && !trackIds.has(project.selectedTrackId)) invalid("O backup contém uma faixa selecionada inválida.");
  let totalBytes = 0;
  const assetMap = new Map();
  for (const asset of backup.assets) {
    if (!asset || !validId(asset.id) || assetMap.has(asset.id) || typeof asset.dataBase64 !== "string" || !asset.dataBase64.length || asset.dataBase64.length > 210 * 1024 * 1024 || (asset.mimeType !== undefined && typeof asset.mimeType !== "string")) invalid("O backup contém um áudio inválido ou repetido.");
    const blob = base64ToBlob(asset.dataBase64, asset.mimeType);
    totalBytes += blob.size;
    if (totalBytes > 150 * 1024 * 1024) invalid("O backup excede 150 MB de áudio.");
    assetMap.set(asset.id, blob);
  }
  for (const audioId of referencedIds) if (!assetMap.has(audioId)) invalid("O backup não contém todos os áudios usados pelo projeto.");
  return { project, assetMap, referencedIds };
}
