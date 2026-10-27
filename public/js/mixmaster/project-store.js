const DB_NAME = "nichodev-mixmaster-v1";
const PROJECT_KEY = "nichodev-mixmaster-project-v1";

let db;
export const blobs = new Map(), temporaryAudio = new Set();

export function openDB() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    if (!indexedDB) return reject(new Error("Armazenamento local indisponível."));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("audio");
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onerror = () => reject(request.error);
  });
}

export async function storeBlob(key, blob) {
  blobs.set(key, blob); temporaryAudio.add(key);
  try {
    if (!db) await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("audio", "readwrite");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Gravação local cancelada."));
      tx.objectStore("audio").put(blob, key);
    });
    temporaryAudio.delete(key);
    return true;
  } catch {
    return false;
  }
}

export function loadBlob(key) {
  if (blobs.has(key)) return Promise.resolve(blobs.get(key));
  return new Promise((resolve, reject) => { const request = db.transaction("audio").objectStore("audio").get(key); request.onsuccess = () => { if (request.result) blobs.set(key, request.result); resolve(request.result); }; request.onerror = () => reject(request.error); });
}

export function readProjectMetadata() {
  return JSON.parse(localStorage.getItem(PROJECT_KEY) || "null");
}

export function persistProject(state) {
  try {
    // Keep volatile takes recoverable in this tab without autosaving missing audio references.
    const tracks = state.tracks.map(track => ({ ...track, clips: track.clips.filter(clip => clip.type === "midi" || (clip.audioId && !temporaryAudio.has(clip.audioId))) }));
    localStorage.setItem(PROJECT_KEY, JSON.stringify({ tracks, selectedTrackId: state.selectedTrackId, playhead: state.playhead, bpm: state.bpm, master: state.master }));
    return !state.tracks.some(track => track.clips.some(clip => temporaryAudio.has(clip.audioId)));
  } catch { return false; }
}

export async function getStoredAudioKeys() {
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const request = db.transaction("audio").objectStore("audio").getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function deleteStoredAudioKeys(keys) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("audio", "readwrite");
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    for (const key of keys) tx.objectStore("audio").delete(key);
  });
}

export async function storeBackupAudio(assetMap, newAudioIds) {
  // Commit all imported audio together so a quota error leaves no partial backup.
  await new Promise((resolve, reject) => {
    const tx = db.transaction("audio", "readwrite");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("Não foi possível salvar os áudios do backup."));
    tx.onabort = () => reject(tx.error || new Error("A importação dos áudios foi cancelada."));
    try {
      for (const [oldId, newId] of newAudioIds) tx.objectStore("audio").put(assetMap.get(oldId), newId);
    } catch (error) { tx.abort(); reject(error); }
  });
  for (const [oldId, newId] of newAudioIds) blobs.set(newId, assetMap.get(oldId));
}

export async function clearProjectStorage() {
  if (!db) await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("audio", "readwrite");
    tx.objectStore("audio").clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Não foi possível limpar os áudios."));
  });
  localStorage.removeItem(PROJECT_KEY);
}
