import { CHIP_FREQUENCIES, CHIP_MIDI, FREQUENCIES, PITCHES, pitchesFor, RECORDED_INSTRUMENTS } from "./project-model.js?v=3";

// Each WAV packs 750 ms per recorded root, in the order below.
const sampleSlot = .75;
const sampleRoots = {
  piano: [36, 48, 60, 66, 72, 78, 84],
  guitar: [36, 45, 52, 61, 67, 74, 80, 85],
  bass: [37, 42, 48, 54, 60, 66, 72],
  acousticDrums: [0, 1, 2]
};
const sampleBanks = new Map();

function loadSampleBank(ctx, instrument) {
  if (!sampleBanks.has(instrument)) {
    const bank = { buffer: null };
    bank.ready = (async () => {
      try {
        const url = new URL(`../../assets/chip-lab/${instrument}.wav`, import.meta.url);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        bank.buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        if (bank.buffer.duration + 1 / bank.buffer.sampleRate < sampleSlot * sampleRoots[instrument].length) {
          throw new Error("Banco incompleto");
        }
      } catch (error) {
        sampleBanks.delete(instrument);
        throw new Error(`Não foi possível carregar ${RECORDED_INSTRUMENTS[instrument]}. Tente novamente.`, { cause: error });
      }
    })();
    sampleBanks.set(instrument, bank);
  }
  return sampleBanks.get(instrument).ready;
}

export async function prepareMidiSamples(ctx, clips) {
  const instruments = new Set(clips.filter(clip => clip.type === "midi").map(clip => clip.instrument));
  await Promise.all([...instruments]
    .filter(instrument => Object.hasOwn(sampleRoots, instrument))
    .map(instrument => loadSampleBank(ctx, instrument)));
}

const pulseWidths = { pulse25: .25, pulse50: .5, pulse12: .125 };
const pulseWaves = new WeakMap();
const drumBuffers = new WeakMap();
const melodicEnvelope = { level: .25, attack: .08, release: .76, sustain: 1 };
const pluckEnvelope = { level: .28, attack: .035, release: .42, sustain: .09 };
const padEnvelope = { level: .13, attack: .38, release: .65, sustain: .86 };
const drumEnvelopes = [
  { level: .45, attack: .025, release: .54, sustain: .15, maxDuration: .22 },
  { level: .38, attack: .02, release: .55, sustain: .10, maxDuration: .18 },
  { level: .29, attack: .025, release: .38, sustain: .08, maxDuration: .07 }
];

function pulseWave(ctx, instrument) {
  let waves = pulseWaves.get(ctx);
  if (!waves) pulseWaves.set(ctx, waves = new Map());
  if (!waves.has(instrument)) {
    const real = new Float32Array(33), imaginary = new Float32Array(real.length);
    const duty = pulseWidths[instrument];
    for (let harmonic = 1; harmonic < real.length; harmonic++) {
      const angle = Math.PI * harmonic;
      real[harmonic] = 2 * Math.sin(angle * duty) / angle;
    }
    waves.set(instrument, ctx.createPeriodicWave(real, imaginary));
  }
  return waves.get(instrument);
}

function noiseBuffers(ctx) {
  if (drumBuffers.has(ctx)) return drumBuffers.get(ctx);
  const length = Math.ceil(ctx.sampleRate * drumEnvelopes[1].maxDuration);
  const snare = ctx.createBuffer(1, length, ctx.sampleRate);
  const hat = ctx.createBuffer(1, length, ctx.sampleRate);
  const snareSamples = snare.getChannelData(0), hatSamples = hat.getChannelData(0);
  // Repeatable samples keep the preview and WAV export consistent.
  let seed = 0x3a8f129d, previous = 0, body = 0;
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const white = seed / 2147483648 - 1, time = i / ctx.sampleRate;
    body = .7 * body + .3 * white;
    snareSamples[i] = .7 * body + .25 * Math.sin(2 * Math.PI * 178 * time) * Math.exp(-35 * time);
    hatSamples[i] = (white - previous) * .5;
    previous = white;
  }
  const buffers = [snare, hat];
  drumBuffers.set(ctx, buffers);
  return buffers;
}

function playVoice(ctx, source, output, onSource, { start, duration, velocity }, envelope, offset) {
  const gain = ctx.createGain(), peak = velocity * envelope.level;
  const end = start + duration;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + duration * envelope.attack);
  gain.gain.linearRampToValueAtTime(peak * envelope.sustain, start + duration * envelope.release);
  gain.gain.linearRampToValueAtTime(0, end);
  source.connect(gain);
  gain.connect(output);
  if (offset === undefined) source.start(start);
  else source.start(start, offset);
  source.stop(end);
  onSource(source, gain);
}

function scheduleRecordedNote(ctx, instrument, pitch, time, output, onSource) {
  const note = instrument === "acousticDrums" ? pitch : CHIP_MIDI[pitch];
  const roots = sampleRoots[instrument];
  const root = roots.reduce((nearest, candidate) => Math.abs(candidate - note) < Math.abs(nearest - note) ? candidate : nearest);
  const rate = 2 ** ((note - root) / 12);
  const source = ctx.createBufferSource();
  source.buffer = sampleBanks.get(instrument).buffer;
  source.playbackRate.value = rate;
  const duration = Math.min(time.duration, sampleSlot / rate);
  const envelope = { level: .42, attack: .015, release: .86, sustain: 1 };
  playVoice(ctx, source, output, onSource, { ...time, duration }, envelope, roots.indexOf(root) * sampleSlot);
}

function scheduleDrum(ctx, pitch, time, output, onSource) {
  const envelope = drumEnvelopes[pitch], duration = Math.min(time.duration, envelope.maxDuration);
  let source;
  if (pitch === 0) {
    source = ctx.createOscillator();
    source.frequency.setValueAtTime(145, time.start);
    source.frequency.exponentialRampToValueAtTime(48, time.start + Math.min(.075, duration * .65));
  } else {
    source = ctx.createBufferSource();
    source.buffer = noiseBuffers(ctx)[pitch - 1];
  }
  playVoice(ctx, source, output, onSource, { ...time, duration }, envelope);
}

function scheduleChipNote(ctx, instrument, pitch, time, output, onSource) {
  if (instrument === "noise") {
    scheduleDrum(ctx, pitch, time, output, onSource);
    return;
  }
  const oscillator = ctx.createOscillator();
  oscillator.frequency.value = CHIP_FREQUENCIES[pitch];
  if (Object.hasOwn(pulseWidths, instrument)) oscillator.setPeriodicWave(pulseWave(ctx, instrument));
  else oscillator.type = instrument === "pluck" ? "sawtooth" : "triangle";

  if (instrument === "pad") {
    oscillator.detune.value = -8;
    const layer = ctx.createOscillator();
    layer.frequency.value = oscillator.frequency.value;
    layer.detune.value = 8;
    playVoice(ctx, oscillator, output, onSource, time, padEnvelope);
    playVoice(ctx, layer, output, onSource, time, padEnvelope);
    return;
  }
  const envelope = instrument === "pluck" ? pluckEnvelope : melodicEnvelope;
  playVoice(ctx, oscillator, output, onSource, time, envelope);
}

export function scheduleMidiNotes(ctx,clip,bpm,when,offset,output,onSource=()=>{}){
  const stepDuration=60/bpm/4;
  const pitches = pitchesFor(clip), instrument = pitches === PITCHES ? null : clip.instrument;
  for(const note of clip.notes||[]){
    const at=clip.start+note.step*stepDuration;
    if(at<offset)continue;
    if (instrument) {
      const duration = Math.min(stepDuration, clip.duration - note.step * stepDuration);
      const velocity = note.velocity ?? .7;
      if (!(duration > 0) || !(velocity > 0) || !Number.isInteger(note.pitch) || note.pitch < 0 || note.pitch >= pitches.length) continue;
      const schedule = Object.hasOwn(sampleRoots, instrument) ? scheduleRecordedNote : scheduleChipNote;
      schedule(ctx, instrument, note.pitch, { start: when + at - offset, duration, velocity }, output, onSource);
      continue;
    }
    const osc=ctx.createOscillator(),gain=ctx.createGain(),start=when+at-offset;
    osc.type="square";osc.frequency.value=FREQUENCIES[note.pitch]||440;
    gain.gain.setValueAtTime(0,start);
    gain.gain.linearRampToValueAtTime((note.velocity??.7)*.25,start+.012);
    gain.gain.setValueAtTime((note.velocity??.7)*.25,start+stepDuration*.75);
    gain.gain.linearRampToValueAtTime(0,start+stepDuration*.95);
    osc.connect(gain);gain.connect(output);osc.start(start);osc.stop(start+stepDuration);
    onSource(osc,gain);
  }
}
