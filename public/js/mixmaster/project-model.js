export const PITCHES = ["C5", "B4", "A4", "G4", "F4", "E4", "D4", "C4"];
export const FREQUENCIES = [523.25, 493.88, 440, 392, 349.23, 329.63, 293.66, 261.63];

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const CHIP_MIDI = Array.from({ length: 49 }, (_, row) => 84 - row);
export const CHIP_PITCHES = CHIP_MIDI.map(note => NOTE_NAMES[note % 12] + (Math.floor(note / 12) - 1));
export const CHIP_FREQUENCIES = CHIP_MIDI.map(note => 440 * 2 ** ((note - 69) / 12));
export const CHIP_DRUMS = ["Bumbo", "Caixa", "Chimbal"];
export const RECORDED_INSTRUMENTS = {
  piano: "Piano acústico",
  guitar: "Guitarra limpa",
  bass: "Baixo elétrico",
  acousticDrums: "Bateria acústica"
};
export const CHIP_INSTRUMENTS = {
  pulse25: "Pulso 25%",
  pulse50: "Pulso 50%",
  pulse12: "Pulso 12,5%",
  triangle: "Triângulo",
  pluck: "Pluck",
  pad: "Pad",
  noise: "Ruído / bateria",
  ...RECORDED_INSTRUMENTS
};

export const isDrumInstrument = instrument => instrument === "noise" || instrument === "acousticDrums";

export function pitchesFor(clip) {
  const instrument = clip?.instrument;
  if (typeof instrument !== "string" || !Object.hasOwn(CHIP_INSTRUMENTS, instrument)) return PITCHES;
  return isDrumInstrument(instrument) ? CHIP_DRUMS : CHIP_PITCHES;
}

export const durationOf = clip => clip.type === "midi" ? clip.duration : Math.max(0, clip.sourceEnd - clip.sourceStart);
export const clipEnd = clip => clip.start + durationOf(clip);
