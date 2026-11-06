const { test, expect } = require("@playwright/test");
const { wav, downloadBytes } = require("../helpers/audio");
const { createHash } = require("node:crypto");

const PROJECT_KEY = "nichodev-mixmaster-project-v1";


function audioClip(id, start, sourceStart, sourceEnd, values = {}) {
  return { id, type: "audio", audioId: "asset-a", name: id, start, sourceStart, sourceEnd, gain: 1, envelope: [{ x: 0, y: .8 }, { x: 1, y: .8 }], ...values };
}

function backup(clips = [], seconds = 1) {
  return {
    app: "nichodev-mixmaster", formatVersion: 1,
    project: {
      tracks: [{ id: "track-a", name: "TESTE MIXMASTER", type: "audio", volume: 1, pan: 0, tone: 1, delay: 0, reverb: 0, muted: false, solo: false, clips }],
      selected: clips.map(clip => clip.id), selectedTrackId: "track-a", playhead: 0, bpm: 120, master: 1
    },
    assets: clips.some(clip => clip.type === "audio") ? [{ id: "asset-a", mimeType: "audio/wav", dataBase64: wav(seconds).toString("base64") }] : []
  };
}

async function upload(page, value) {
  await page.locator("#projectFile").setInputFiles({
    name: "projeto.nichodev.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(value))
  });
}

async function restore(page, value) {
  await upload(page, value);
  await expect(page.locator(".track-name").first()).toHaveText(value.project.tracks[0].name);
  await expect(page.locator(".audio-clip")).toHaveCount(value.project.tracks.flatMap(track => track.clips).length);
}

async function savedProject(page) {
  await page.clock.fastForward(250);
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), PROJECT_KEY);
}

async function storedAudioCount(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("nichodev-mixmaster-v1", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, count = db.transaction("audio").objectStore("audio").count();
      count.onsuccess = () => { db.close(); resolve(count.result); };
      count.onerror = () => { db.close(); reject(count.error); };
    };
  }));
}

test.beforeEach(async ({ page }) => {
  page.on("dialog", dialog => dialog.accept());
  await page.clock.install();
  await page.goto("/mixmaster.html");
  await expect(page.locator(".track-row")).toHaveCount(1);
});

test("CHIP LAB separa presets, toca o loop e insere quatro clipes MIDI editáveis", async ({ page }) => {
  await page.addInitScript(() => {
    const createBufferSource = AudioContext.prototype.createBufferSource;
    window.chipPreview = [];
    AudioContext.prototype.createBufferSource = function () {
      const source = createBufferSource.call(this);
      const { start, stop } = source;
      let preview;
      source.start = function (...args) {
        if (this.loop) {
          let peak = 0;
          for (const sample of this.buffer.getChannelData(0)) peak = Math.max(peak, Math.abs(sample));
          preview = { duration: this.loopEnd, peak, stopped: false };
          window.chipPreview.push(preview);
        }
        return start.apply(this, args);
      };
      source.stop = function (...args) {
        if (preview) preview.stopped = true;
        return stop.apply(this, args);
      };
      return source;
    };
  });
  await page.reload();
  const original = backup([audioClip("clip-a", 0, 0, 1)]);
  original.project.bpm = 100;
  original.project.playhead = 3;
  await restore(page, original);
  const before = await savedProject(page);
  const chipTab = page.locator('[data-tab="chip"]');
  await page.getByRole("button", { name: /CHIP LAB.*Criar loop 8-bit/ }).click();
  await expect(page.locator("#chipTitle")).toBeFocused();
  await expect(page.locator(".chip-step")).toHaveCount(64);
  for (const label of ["Tela de Título", "Corrida Pixel", "Fase Noturna"]) {
    await page.locator("#chipPreset").selectOption({ label });
    expect((await page.locator(".chip-step.has-note").allTextContents()).every(text => /^[A-G](?:#?\d)?$|^H$/.test(text))).toBe(true);
  }
  await expect(page.locator("#chipBpm")).toHaveValue("120");
  const melodyStep = page.locator('.chip-step[data-lane="0"][data-step="0"]');
  await expect(melodyStep).toHaveText("A4");
  await melodyStep.click();
  await page.locator("#chipNote").selectOption({ label: "D5" });
  await expect(melodyStep).toHaveText("D5");
  await melodyStep.click();
  await expect(melodyStep).toHaveAttribute("aria-pressed", "false");
  await melodyStep.press("Enter");
  await expect(melodyStep).toHaveText("D5");
  await expect(melodyStep).toHaveAttribute("aria-pressed", "true");
  await page.locator("#chipInstrument").selectOption("triangle");
  await expect(melodyStep).toHaveText("D5");
  await expect(page.locator("#chipBpm")).toHaveValue("120");
  await page.locator("#chipPlay").click();
  await expect.poll(() => page.evaluate(() => window.chipPreview.length)).toBe(1);
  const preview = await page.evaluate(() => window.chipPreview[0]);
  expect(preview.duration).toBe(2);
  expect(preview.peak).toBeGreaterThan(.02);
  await page.locator('[data-tab="edit"]').click();
  await expect.poll(() => page.evaluate(() => window.chipPreview[0].stopped)).toBe(true);
  await chipTab.click();
  await expect(melodyStep).toHaveText("D5");

  await page.locator("#chipInsert").click();
  await expect(page.locator(".midi-clip")).toHaveCount(4);
  const after = await savedProject(page);
  expect(after.tracks.slice(0, 1)).toEqual(before.tracks);
  expect(after.bpm).toBe(100);
  const clips = after.tracks.slice(1).map(track => track.clips[0]);
  expect(clips.map(clip => clip.instrument)).toEqual(["triangle", "pulse50", "triangle", "noise"]);
  for (const clip of clips) {
    expect(clip.start).toBe(3);
    expect(clip.duration).toBeCloseTo(2.4, 8);
    expect(clip.notes.length).toBeGreaterThan(0);
  }
  await page.locator("#undoButton").click();
  await expect(page.locator(".midi-clip")).toHaveCount(0);
  expect((await savedProject(page)).tracks).toEqual(before.tracks);
  await page.locator("#redoButton").click();
  await expect(page.locator(".midi-clip")).toHaveCount(4);
  await page.locator('[data-tab="midi"]').click();
  const note = page.getByRole("button", { name: "D5, passo 1", exact: true });
  await expect(note).toHaveAttribute("aria-pressed", "true");
  await note.click();
  await expect(note).toHaveAttribute("aria-pressed", "false");
  await page.locator("#undoButton").click();
  await expect(note).toHaveAttribute("aria-pressed", "true");

  const wavFile = await downloadBytes(page, "#exportButton");
  const byteRate = wavFile.readUInt32LE(28);
  let peak = 0;
  for (let offset = 44 + byteRate * 3; offset + 2 <= wavFile.length; offset += 2) {
    peak = Math.max(peak, Math.abs(wavFile.readInt16LE(offset)));
  }
  expect(peak).toBeGreaterThan(100);
  const exported = JSON.parse((await downloadBytes(page, "#exportProjectButton")).toString("utf8"));
  expect(exported.project.tracks.slice(1).map(track => track.clips[0])).toEqual(clips);
  await page.reload();
  await expect(page.locator(".midi-clip")).toHaveCount(4);
  expect((await savedProject(page)).tracks.slice(1).map(track => track.clips[0])).toEqual(clips);
  await upload(page, exported);
  await expect(page.locator("#projectStatus")).toContainText("Backup restaurado");
  expect((await savedProject(page)).tracks.slice(1).map(track => track.clips[0])).toEqual(clips);
  exported.project.tracks[4].clips[0].instrument = "constructor";
  await upload(page, exported);
  await expect(page.locator("#projectStatus")).toContainText("timbre MIDI inválido");
  expect((await savedProject(page)).tracks.slice(1).map(track => track.clips[0])).toEqual(clips);
});

test("CHIP LAB mantém as gravações na prévia, nos clipes MIDI e no WAV", async ({ page }) => {
  const instruments = ["piano", "guitar", "bass", "acousticDrums"];
  const requests = [];
  page.on("request", request => {
    if (request.url().includes("/assets/chip-lab/") && request.url().endsWith(".wav")) {
      requests.push(new URL(request.url()).pathname.split("/").pop());
    }
  });
  await page.addInitScript(() => {
    window.recordedPreviewPeak = 0;
    window.recordedTimelineVoices = 0;
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = create.call(this);
      const start = source.start.bind(source);
      source.start = (...args) => {
        if (source.loop) {
          for (const sample of source.buffer.getChannelData(0)) {
            window.recordedPreviewPeak = Math.max(window.recordedPreviewPeak, Math.abs(sample));
          }
        } else {
          window.recordedTimelineVoices++;
        }
        return start(...args);
      };
      return source;
    };
  });
  await page.reload();
  await page.locator("#openChipLab").click();
  for (const [lane, instrument] of instruments.entries()) {
    await page.locator(`.chip-step[data-lane="${lane}"][data-step="1"]`).click();
    const row = page.locator(`.chip-step[data-lane="${lane}"]`);
    const notes = await row.allTextContents();
    await expect(page.locator('#chipInstrument optgroup[label="Clássicos 8-bit"] option').first()).toBeAttached();
    await page.locator("#chipInstrument").selectOption(instrument);
    expect(await row.allTextContents()).toEqual(notes);
  }
  expect(requests).toEqual([]);
  await page.locator("#chipPlay").click();
  await expect(page.locator("#chipStatus")).toContainText("Ouvindo");
  expect(await page.evaluate(() => window.recordedPreviewPeak)).toBeGreaterThan(.04);
  expect(requests.sort()).toEqual(instruments.map(name => name + ".wav").sort());
  await page.locator("#chipInsert").click();
  await expect(page.locator(".midi-clip")).toHaveCount(4);
  const project = await savedProject(page);
  expect(project.tracks.slice(1).map(track => track.clips[0].instrument)).toEqual(instruments);
  await page.locator("#playButton").click();
  await expect.poll(() => page.evaluate(() => window.recordedTimelineVoices)).toBeGreaterThan(20);
  await page.locator("#stopButton").click();
  const exported = JSON.parse((await downloadBytes(page, "#exportProjectButton")).toString("utf8"));
  expect(exported.assets).toEqual([]);
  await page.reload();
  await expect(page.locator(".midi-clip")).toHaveCount(4);
  await upload(page, exported);
  await expect(page.locator("#projectStatus")).toContainText("Backup restaurado");
  expect((await savedProject(page)).tracks).toEqual(project.tracks);

  const recordings = new Set();
  for (let lane = 0; lane < instruments.length; lane++) {
    const solo = page.locator(".track-row").nth(lane + 1).locator('[data-action="solo"]');
    await solo.click();
    const file = await downloadBytes(page, "#exportButton");
    expect(file.toString("ascii", 0, 4)).toBe("RIFF");
    let peak = 0;
    for (let offset = 44; offset + 2 <= file.length; offset += 2) {
      peak = Math.max(peak, Math.abs(file.readInt16LE(offset)));
    }
    expect(peak).toBeGreaterThan(500);
    recordings.add(createHash("sha256").update(file).digest("hex"));
    await solo.click();
  }
  expect(recordings.size).toBe(4);
});

test("CHIP LAB mantém a grade navegável em tela estreita", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const shortcut = page.getByRole("button", { name: /CHIP LAB.*Criar loop 8-bit/ });
  await expect(shortcut).toBeInViewport();
  await shortcut.click();
  await expect(page.locator("#chipTitle")).toBeInViewport();
  const scroll = page.locator(".chip-grid-scroll");
  expect(await scroll.evaluate(grid => grid.scrollWidth)).toBeGreaterThan(await scroll.evaluate(grid => grid.clientWidth));
  const melody = page.getByRole("button", { name: "Melodia, passo 1, A4" });
  await melody.press("End");
  const lastStep = page.getByRole("button", { name: "Melodia, passo 16, pausa" });
  await expect(lastStep).toBeFocused();
  expect(await scroll.evaluate(grid => grid.scrollLeft)).toBeGreaterThan(0);
  await page.locator("#chipNote").selectOption({ label: "A4" });
  const note = page.getByRole("button", { name: "Melodia, passo 16, A4" });
  await expect(note).toHaveAttribute("aria-pressed", "true");
  await note.press("Delete");
  await expect(lastStep).toBeFocused();
  await page.locator("#chipInsert").click();
  await expect(page.locator(".midi-clip")).toHaveCount(4);
});

test("backup inválido preserva o projeto e não grava áudios parciais", async ({ page }) => {
  const original = backup();
  original.project.tracks[0].name = "PROJETO PRESERVADO";
  await restore(page, original);
  const before = await savedProject(page);
  const mutations = [
    value => { delete value.project.tracks[0].clips; },
    value => { value.project.tracks.push({ ...value.project.tracks[0], clips: [] }); },
    value => { value.project.tracks[0].volume = null; },
    value => { value.project.playhead = Number.MAX_VALUE; },
    value => { value.project.tracks[0].clips[0].start = Number.MAX_VALUE; },
    value => { value.project.tracks[0].clips.push({ ...value.project.tracks[0].clips[0] }); },
    value => { value.project.tracks[0].clips[0].sourceStart = -1; },
    value => { value.project.tracks[0].clips[0].sourceEnd = 2; },
    value => { value.project.tracks[0].clips[0].envelope = [{ x: .8, y: .5 }, { x: .2, y: .5 }]; },
    value => { value.project.tracks[0].clips[0].envelope[0].y = 2; },
    value => { value.project.selected = ["missing"]; },
    value => { value.assets = []; },
    value => { value.assets.push({ ...value.assets[0] }); },
    value => { value.assets[0].dataBase64 = "!!!"; },
    value => { value.project.tracks[0].clips[0] = { id: "midi-a", type: "midi", start: 0, duration: 1, notes: [{ step: 16, pitch: 0, velocity: .8 }] }; value.project.selected = ["midi-a"]; },
    value => {
      value.project.tracks[0].clips.push(audioClip("clip-b", 1, 0, 1, { audioId: "asset-b" }));
      value.assets.push({ id: "asset-b", mimeType: "audio/wav", dataBase64: Buffer.from("not audio").toString("base64") });
    }
  ];
  for (const mutate of mutations) {
    const invalid = backup([audioClip("clip-a", 0, 0, 1)]);
    mutate(invalid);
    await upload(page, invalid);
    await expect(page.locator("#projectStatus")).toContainText("Não foi possível importar o backup");
    expect(await savedProject(page)).toEqual(before);
    await expect(page.locator(".track-name")).toHaveText("PROJETO PRESERVADO");
  }
  expect(await storedAudioCount(page)).toBe(0);
  await page.reload();
  await expect(page.locator(".track-name")).toHaveText("PROJETO PRESERVADO");
});

test("falha de armazenamento mantém a estrutura anterior do projeto", async ({ page }) => {
  const original = backup();
  original.project.tracks[0].name = "PROJETO PRESERVADO";
  await restore(page, original);
  const before = await savedProject(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    let writes = 0;
    IDBObjectStore.prototype.put = function (...args) {
      if (++writes === 2) throw new DOMException("Sem espaço", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  const value = backup([audioClip("clip-a", 0, 0, 1), audioClip("clip-b", 1, 0, 1, { audioId: "asset-b" })]);
  value.assets.push({ ...value.assets[0], id: "asset-b" });
  await upload(page, value);
  await expect(page.locator("#projectStatus")).toContainText("Não foi possível importar o backup");
  expect(await savedProject(page)).toEqual(before);
  expect(await storedAudioCount(page)).toBe(0);
});

test("dividir preserva a interpolação e o nível após o último ponto do envelope", async ({ page }) => {
  const cases = [
    { name: "FADE LINEAR", playhead: 5, envelope: [{ x: 0, y: 0 }, { x: 1, y: 1 }], left: [{ x: 0, y: 0 }, { x: 1, y: .5 }], right: [{ x: 0, y: .5 }, { x: 1, y: 1 }] },
    { name: "NÍVEL FINAL", playhead: 8, envelope: [{ x: .2, y: .25 }, { x: .6, y: .75 }], left: [{ x: 0, y: .25 }, { x: .25, y: .25 }, { x: .75, y: .75 }, { x: 1, y: .75 }], right: [{ x: 0, y: .75 }, { x: 1, y: .75 }] }
  ];
  for (const scenario of cases) {
    const value = backup([audioClip("clip-a", 0, 0, 10, { envelope: scenario.envelope })], 10);
    value.project.tracks[0].name = scenario.name;
    value.project.playhead = scenario.playhead;
    await restore(page, value);
    await page.locator("#splitButton").click();
    await expect(page.locator(".audio-clip")).toHaveCount(2);
    const clips = (await savedProject(page)).tracks[0].clips;
    for (const [actual, expected] of [[clips[0].envelope, scenario.left], [clips[1].envelope, scenario.right]]) {
      expect(actual).toHaveLength(expected.length);
      expected.forEach((point, index) => {
        expect(actual[index].x).toBeCloseTo(point.x, 8);
        expect(actual[index].y).toBeCloseTo(point.y, 8);
      });
    }
    expect(clips[0].sourceEnd).toBe(scenario.playhead);
    expect(clips[1].sourceStart).toBe(scenario.playhead);
  }
});

test("juntar aplica ganho e envelope uma vez e mantém o resultado no backup", async ({ page }) => {
  const value = backup([
    audioClip("clip-a", 0, 0, 1, { gain: .5 }),
    audioClip("clip-b", 1, 1, 2, { gain: .75 })
  ], 2);
  await restore(page, value);
  await page.locator("#joinButton").click();
  await expect(page.locator(".audio-clip")).toHaveCount(1);
  const clip = (await savedProject(page)).tracks[0].clips[0];
  expect(clip.envelope).toEqual([{ x: 0, y: 1 }, { x: 1, y: 1 }]);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportProjectButton").click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const merged = Buffer.from(exported.assets[0].dataBase64, "base64"), rate = merged.readUInt32LE(24), channels = merged.readUInt16LE(22);
  expect(merged.readUInt16LE(20)).toBe(3);
  const sampleAt = seconds => merged.readFloatLE(44 + Math.floor(seconds * rate) * channels * 4);
  expect(sampleAt(.25)).toBeCloseTo(.2, 3);
  expect(sampleAt(1.25)).toBeCloseTo(.3, 3);
});

test("reprodução no meio do clipe começa no envelope correto e usa o tempo restante", async ({ page }) => {
  await page.addInitScript(() => {
    const gainEvents = new WeakMap();
    const createGain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      const node = createGain.call(this), events = [];
      for (const method of ["setValueAtTime", "linearRampToValueAtTime"]) {
        const original = node.gain[method].bind(node.gain);
        node.gain[method] = (...args) => { events.push({ method, value: args[0], time: args[1] }); return original(...args); };
      }
      gainEvents.set(node, events);
      return node;
    };
    window.mixmasterPlayback = [];
    const createSource = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = createSource.call(this), connect = source.connect.bind(source), start = source.start.bind(source);
      let output;
      source.connect = (destination, ...args) => { output = destination; return connect(destination, ...args); };
      source.start = (...args) => { window.mixmasterPlayback.push({ start: args[0], offset: args[1], duration: args[2], events: gainEvents.get(output) }); return start(...args); };
      return source;
    };
  });
  await page.reload();
  await expect(page.locator(".track-row")).toHaveCount(1);
  const value = backup([audioClip("clip-a", 0, 0, 10, { envelope: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })], 10);
  value.project.playhead = 5;
  await restore(page, value);
  await page.locator("#playButton").click();
  await expect.poll(() => page.evaluate(() => window.mixmasterPlayback.length)).toBe(1);
  const playback = await page.evaluate(() => window.mixmasterPlayback[0]);
  expect(playback.offset).toBe(5);
  expect(playback.duration).toBeCloseTo(5, 4);
  const ramps = playback.events.filter(event => event.method === "linearRampToValueAtTime");
  expect(ramps[0].value).toBeCloseTo(.5, 5);
  expect(ramps.at(-1).value).toBe(1);
  expect(ramps.at(-1).time - playback.start).toBeCloseTo(5, 4);
  await page.locator("#stopButton").click();
});


test("áudio sem IndexedDB permanece recuperável e não é anunciado como salvo", async ({ page }) => {
  await page.addInitScript(() => {
    indexedDB.open = () => { throw new DOMException("Bloqueado", "SecurityError"); };
  });
  await page.reload();
  await expect(page.locator(".track-row")).toHaveCount(1);
  await page.locator("#audioFiles").setInputFiles({ name: "temporario.wav", mimeType: "audio/wav", buffer: wav() });
  await expect(page.locator(".audio-clip")).toHaveCount(1);
  await expect(page.locator("#recoverAudio")).toBeVisible();
  const saved = await savedProject(page);
  expect(saved.tracks[0].clips).toHaveLength(0);
  await expect(page.locator("#projectStatus")).toContainText("temporário");
  expect(await downloadBytes(page, "#recoverAudio")).toEqual(wav());
});

test("gravação sem quota mantém o áudio e oferece download de recuperação", async ({ page }) => {
  await page.evaluate(bytes => {
    IDBObjectStore.prototype.put = () => { throw new DOMException("Sem espaço", "QuotaExceededError"); };
    const context = new AudioContext(), destination = context.createMediaStreamDestination();
    navigator.mediaDevices.getUserMedia = async () => destination.stream;
    window.MediaRecorder = class {
      static isTypeSupported() { return false; }
      state = "inactive";
      mimeType = "audio/wav";
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.ondataavailable({ data: new Blob([new Uint8Array(bytes)], { type: this.mimeType }) });
        queueMicrotask(() => this.onstop());
      }
    };
  }, [...wav()]);
  await page.locator("#recordButton").click();
  await expect(page.locator("#recordButton")).toHaveClass(/recording/);
  await page.locator("#recordButton").click();
  await expect(page.locator("#recoverAudio")).toBeVisible();
  await expect(page.locator("#recordButton")).toBeEnabled();
  expect(await downloadBytes(page, "#recoverAudio")).toEqual(wav());
  expect((await savedProject(page)).tracks[0].clips).toHaveLength(0);
  expect(await storedAudioCount(page)).toBe(0);
});

test("união preserva picos acima de um após salvar e reabrir", async ({ page }) => {
  await page.addInitScript(() => {
    window.decodedMixSamples = [];
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = async function (...args) {
      const buffer = await decode.apply(this, args);
      window.decodedMixSamples.push(buffer.getChannelData(0)[Math.floor(buffer.sampleRate * .25)]);
      return buffer;
    };
  });
  await page.reload();
  const value = backup([
    audioClip("clip-a", 0, 0, 1, { gain: 1.5, envelope: [{ x: 0, y: 1 }, { x: 1, y: 1 }] }),
    audioClip("clip-b", 0, 0, 1, { gain: 1.5, envelope: [{ x: 0, y: 1 }, { x: 1, y: 1 }] })
  ]);
  await restore(page, value);
  await page.locator("#joinButton").click();
  await expect(page.locator(".audio-clip")).toHaveCount(1);
  const exported = JSON.parse((await downloadBytes(page, "#exportProjectButton")).toString("utf8"));
  const data = Buffer.from(exported.assets[0].dataBase64, "base64");
  expect(data.readUInt16LE(20)).toBe(3);
  const savedSample = data.readFloatLE(44 + Math.floor(data.readUInt32LE(24) * .25) * data.readUInt16LE(22) * 4);
  // Browser resampling can slightly change the source level; reopening must preserve the stored sample.
  expect(savedSample).toBeCloseTo(1.5, 3);
  await savedProject(page);
  await page.reload();
  await expect(page.locator(".audio-clip")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.decodedMixSamples.at(-1))).toBeCloseTo(savedSample, 6);
});

test("transporte para no fim e exportação ignora cursor além do projeto", async ({ page }) => {
  await page.addInitScript(() => {
    window.mixAudioTime = 0;
    Object.defineProperty(AudioContext.prototype, "currentTime", { get() { return window.mixAudioTime; } });
  });
  await page.reload();
  await restore(page, backup([audioClip("clip-a", 0, 0, 1)]));
  await page.locator("#playButton").click();
  await expect(page.locator("#playButton")).toHaveClass(/playing/);
  await page.evaluate(() => { window.mixAudioTime = 1.1; });
  await page.clock.fastForward(100);
  await expect(page.locator("#playButton")).not.toHaveClass(/playing/);
  const value = backup([audioClip("clip-a", 0, 0, 1)]);
  value.project.playhead = 700;
  await restore(page, value);
  const file = await downloadBytes(page, "#exportButton");
  expect(file.readUInt16LE(20)).toBe(1);
  const seconds = file.readUInt32LE(40) / file.readUInt32LE(28);
  expect(seconds).toBeCloseTo(1, 3);
});

test("MIDI usa a mesma duração e envelope na prévia e no WAV", async ({ page }) => {
  await page.addInitScript(() => {
    window.mixNotes = [];
    for (const [Context, kind] of [[AudioContext, "live"], [OfflineAudioContext, "offline"]]) {
      const create = Context.prototype.createOscillator;
      Context.prototype.createOscillator = function () {
        const source = create.call(this), start = source.start.bind(source), stop = source.stop.bind(source);
        let at;
        source.start = time => { at = time; start(time); };
        source.stop = (...args) => { if (args.length) window.mixNotes.push({ kind, duration: args[0] - at }); stop(...args); };
        return source;
      };
    }
  });
  await page.reload();
  for (const bpm of [60, 240]) {
    const value = backup([{ id: "midi-a", type: "midi", name: "NOTA", start: 0, duration: 1, notes: [{ step: 0, pitch: 0, velocity: .8 }] }]);
    value.project.bpm = bpm;
    value.project.tracks[0].type = "midi";
    await restore(page, value);
    await page.evaluate(() => { window.mixNotes = []; });
    await page.locator("#playButton").click();
    await expect.poll(() => page.evaluate(() => window.mixNotes.length)).toBe(1);
    await page.locator("#stopButton").click();
    await downloadBytes(page, "#exportButton");
    const notes = await page.evaluate(() => window.mixNotes);
    expect(notes.map(note => note.kind)).toEqual(["live", "offline"]);
    expect(notes[0].duration).toBeCloseTo(60 / bpm / 4, 6);
    expect(notes[1].duration).toBeCloseTo(notes[0].duration, 6);
  }
});

test("excluir faixa interrompe suas fontes e desconecta o áudio", async ({ page }) => {
  await page.addInitScript(() => {
    window.mixSources = [];
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = create.call(this), stop = source.stop.bind(source), disconnect = source.disconnect.bind(source);
      const record = { stopped: false, disconnected: false };
      source.stop = (...args) => { record.stopped = true; stop(...args); };
      source.disconnect = (...args) => { record.disconnected = true; disconnect(...args); };
      window.mixSources.push(record);
      return source;
    };
  });
  await page.reload();
  const value = backup([audioClip("clip-a", 0, 0, 3)], 3);
  value.project.tracks.push({ ...value.project.tracks[0], id: "track-b", name: "VAZIA", clips: [] });
  await restore(page, value);
  await page.locator("#playButton").click();
  await expect.poll(() => page.evaluate(() => window.mixSources.length)).toBe(1);
  await page.locator(".track-row").first().locator('[data-action="remove-track"]').click();
  await expect(page.locator(".track-row")).toHaveCount(1);
  expect(await page.evaluate(() => window.mixSources[0])).toEqual({ stopped: true, disconnected: true });
});

test("limpeza preserva undo e outra aba e libera áudio sem referências", async ({ page }) => {
  const value = backup([audioClip("clip-a", 0, 0, 1), audioClip("clip-b", 3, 0, 1, { audioId: "asset-b" })]);
  value.assets.push({ ...value.assets[0], id: "asset-b" });
  await restore(page, value);
  await savedProject(page);
  const other = await page.context().newPage();
  await other.goto("/mixmaster.html");
  await expect(other.locator(".audio-clip")).toHaveCount(2);
  await page.locator('[data-clip-id="clip-a"]').click({ position: { x: 8, y: 35 } });
  await page.locator("#deleteButton").click();
  await savedProject(page);
  expect(await storedAudioCount(page)).toBe(2);
  await page.locator("#undoButton").click();
  await expect(page.locator(".audio-clip")).toHaveCount(2);
  await page.locator("#redoButton").click();
  await expect(page.locator(".audio-clip")).toHaveCount(1);
  for (let i = 0; i < 42; i++) await page.locator(".audio-clip").click();
  await savedProject(page);
  expect(await storedAudioCount(page)).toBe(2);
  await other.close();
  await expect.poll(() => page.evaluate(async () => (await navigator.locks.query()).held.filter(lock => lock.name.startsWith("nichodev-mixmaster-tab-")).length)).toBe(1);
  await page.locator(".audio-clip").click();
  await savedProject(page);
  await expect.poll(() => storedAudioCount(page)).toBe(1);
});

test("Excluir funciona com múltiplos clipes e desfazer restaura ambos", async ({ page }) => {
  await restore(page, backup([audioClip("clip-a", 0, 0, 1), audioClip("clip-b", 1, 0, 1)]));
  await expect(page.locator("#deleteButton")).toBeEnabled();
  await expect(page.locator("#duplicateButton")).toBeDisabled();
  await page.locator("#deleteButton").click();
  await expect(page.locator(".audio-clip")).toHaveCount(0);
  await page.locator("#undoButton").click();
  await expect(page.locator(".audio-clip")).toHaveCount(2);
});

test("mudar BPM mantém a região MIDI inteira na prévia e no arquivo", async ({ page }) => {
  const value = backup([{ id: "midi-a", type: "midi", name: "COMPASSO", start: 0, duration: 2,
    notes: Array.from({ length: 16 }, (_, step) => ({ step, pitch: 0, velocity: .8 })) }]);
  value.project.tracks[0].type = "midi";
  await restore(page, value);
  await page.locator("#playButton").click();
  await page.locator("#bpmInput").fill("60");
  await page.locator("#bpmInput").press("Tab");
  await expect(page.locator("#playButton")).toHaveClass(/playing/);
  expect((await savedProject(page)).tracks[0].clips[0].duration).toBe(4);
  const file = await downloadBytes(page, "#exportButton"), rate = file.readUInt32LE(24), channels = file.readUInt16LE(22);
  expect(file.readUInt32LE(40) / file.readUInt32LE(28)).toBeCloseTo(4, 3);
  let latePeak = 0;
  for (let i = Math.floor(3.8 * rate); i < Math.floor(3.9 * rate); i++) latePeak = Math.max(latePeak, Math.abs(file.readInt16LE(44 + i * channels * 2)) / 32768);
  expect(latePeak).toBeGreaterThan(.01);
  await page.locator("#stopButton").click();
});


test("falha ao carregar um módulo informa como recuperar a abertura", async ({ page }) => {
  await page.route("**/js/mixmaster/project-backup.js*", route => route.abort());
  await page.goto("/mixmaster.html");
  await expect(page.locator("#projectStatus")).toContainText("Não foi possível abrir o MIXMASTER. Recarregue a página.");
});

test("falha ao salvar metadados avisa ao sair e oferece backup sem limpar o aviso", async ({ page }) => {
  await restore(page, backup());
  await savedProject(page);
  await page.evaluate(() => {
    window.originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "nichodev-mixmaster-project-v1") throw new DOMException("Sem quota", "QuotaExceededError");
      return window.originalSetItem.call(this, key, value);
    };
  });
  await page.locator("#newTrackButton").click();
  await page.clock.fastForward(250);
  await expect(page.locator("#saveWarning")).toBeVisible();
  const leaving = () => page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event); return event.defaultPrevented;
  });
  expect(await leaving()).toBe(true);
  const recovered = JSON.parse((await downloadBytes(page, "#backupUnsavedButton")).toString());
  expect(recovered.project.tracks).toHaveLength(2);
  await expect(page.locator("#saveWarning")).toBeVisible();
  expect(await leaving()).toBe(true);
  await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });
  expect(await leaving()).toBe(false);
  await expect(page.locator("#saveWarning")).toBeHidden();
  expect((await savedProject(page)).tracks).toHaveLength(2);
});

test("espaço preserva botões e só controla transporte no contexto do editor", async ({ page }) => {
  await page.locator("#newMidiButton").focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".track-row")).toHaveCount(2);
  await expect(page.locator("#playButton")).not.toHaveClass(/playing/);
  await page.locator("#timeline").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#playButton")).toHaveClass(/playing/);
  await page.locator("#stopButton").click();
  await page.locator("#newMidiButton").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".track-row")).toHaveCount(3);
});

test("ajustes de som têm uma etapa por gesto e preservam a edição anterior", async ({ page }) => {
  await restore(page, backup([audioClip("clip-a", 0, 0, 1)]));
  await page.locator("#newTrackButton").click();
  const baseline = await savedProject(page);
  for (const [selector, read] of [
    ["#masterVolume", state => state.master],
    ["#clipGain", state => state.tracks[0].clips[0].gain],
    ["#toneControl", state => state.tracks[0].tone],
    ["#delayControl", state => state.tracks[0].delay],
    ["#reverbControl", state => state.tracks[0].reverb],
    [".track-volume", state => state.tracks[0].volume],
    [".track-pan", state => state.tracks[0].pan]
  ]) {
    await page.locator(".audio-clip").click();
    const control = page.locator(selector).first();
    const before = read(await savedProject(page));
    await control.evaluate(el => {
      el.focus();
      for (const value of ["30", "40"]) { el.value = value; el.dispatchEvent(new Event("input", { bubbles: true })); }
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(read(await savedProject(page))).toBeCloseTo(.4);
    await page.locator("#undoButton").click();
    expect(read(await savedProject(page))).toBe(before);
    await expect(page.locator(".track-row")).toHaveCount(baseline.tracks.length);
    await page.locator("#redoButton").click();
    expect(read(await savedProject(page))).toBeCloseTo(.4);
    await page.locator("#undoButton").click();
    expect(read(await savedProject(page))).toBe(before);
    if (selector === "#masterVolume") await expect(page.locator("#masterValue")).toHaveText(Math.round(before * 100) + "%");
  }
});

test("English CHIP LAB loads recorded instruments and adds their MIDI to the shared project", async ({ page }) => {
  await page.goto("/en/mixmaster.html");
  await page.locator('[data-tab="chip"]').click();
  await expect(page.locator(".chip-step")).toHaveCount(64);
  await expect(page.locator("#chipInstrument optgroup").first()).toHaveAttribute("label", "8-bit Classics");
  await page.locator("#chipInstrument").selectOption({ label: "Acoustic piano" });

  const sample = page.waitForResponse(response => response.url().endsWith("/assets/chip-lab/piano.wav"));
  await page.locator("#chipPlay").click();
  expect((await sample).ok()).toBe(true);
  await expect(page.locator("#chipStatus")).toHaveText("Playing loop preview.");
  await page.locator("#chipInsert").click();
  await expect(page.locator(".midi-clip")).toHaveCount(4);
  const wav = await downloadBytes(page, "#exportButton");
  expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
  expect(wav.length).toBeGreaterThan(44);
  await page.getByRole("link", { name: "Português", exact: true }).click();
  await expect(page).toHaveURL(/\/mixmaster\.html$/);
  await expect(page.locator(".midi-clip")).toHaveCount(4);
});
