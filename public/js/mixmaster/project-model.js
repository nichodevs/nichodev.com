export const PITCHES = ["C5", "B4", "A4", "G4", "F4", "E4", "D4", "C4"];
export const FREQUENCIES = [523.25, 493.88, 440, 392, 349.23, 329.63, 293.66, 261.63];

export const durationOf = clip => clip.type === "midi" ? clip.duration : Math.max(0, clip.sourceEnd - clip.sourceStart);
export const clipEnd = clip => clip.start + durationOf(clip);
