const { test, expect } = require("@playwright/test");

const PROJECT_KEY = "nichodev-mixmaster-project-v1";

function wav(seconds = 1) {
  const rate = 8000, samples = rate * seconds, buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) buffer.writeInt16LE(16384, 44 + i * 2);
  return buffer;
}

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
  const sampleAt = seconds => merged.readInt16LE(44 + Math.floor(seconds * rate) * channels * 2) / 32768;
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
