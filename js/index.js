"use strict";

const startButton = document.getElementById("startBtn");
const selectButton = document.querySelector('a[href="guitarra.html"]');

function createStartToneWavUrl() {
  const sampleRate = 44100;
  const duration = 0.31;
  const sampleCount = Math.ceil(sampleRate * duration);
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + sampleCount * bytesPerSample);
  const view = new DataView(buffer);

  const writeText = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * bytesPerSample, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * bytesPerSample, true);

  const notes = [
    { frequency: 440, start: 0, duration: 0.09 },
    { frequency: 660, start: 0.105, duration: 0.16 }
  ];

  for (let i = 0; i < sampleCount; i += 1) {
    const time = i / sampleRate;
    let sample = 0;

    for (const note of notes) {
      const noteTime = time - note.start;
      if (noteTime < 0 || noteTime > note.duration) continue;

      const attack = Math.min(1, noteTime / 0.004);
      const release = Math.min(1, (note.duration - noteTime) / 0.025);
      const envelope = Math.max(0, Math.min(attack, release));
      const phase = 2 * Math.PI * note.frequency * noteTime;
      const tone = Math.sin(phase) * 0.72
        + Math.sin(phase * 3) * 0.19
        + Math.sin(phase * 5) * 0.09;
      sample += tone * envelope * 0.42;
    }

    const clipped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * bytesPerSample, Math.round(clipped * 32767), true);
  }

  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function playSelectSound(audio) {
  // Harmônicos ricos e um ataque curto dão ao acorde um timbre metálico de cordas.
  const real = new Float32Array([0, 0, 0, 0, 0, 0, 0]);
  const imaginary = new Float32Array([0, 1, 0.58, 0.36, 0.23, 0.14, 0.08]);
  const guitarWave = audio.createPeriodicWave(real, imaginary);
  const strumStart = audio.currentTime + 0.015;
  const chord = [196, 246.94, 293.66, 392];

  chord.forEach((frequency, index) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = strumStart + index * 0.025;
    const end = start + 0.48;

    oscillator.setPeriodicWave(guitarWave);
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.985, start + 0.16);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.075, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(end);
  });

  // Ruído filtrado bem curto simula o ataque da palheta nas cordas.
  const noiseBuffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.045), audio.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i += 1) {
    noiseData[i] = Math.random() * 2 - 1;
  }
  const pick = audio.createBufferSource();
  const pickFilter = audio.createBiquadFilter();
  const pickGain = audio.createGain();
  pick.buffer = noiseBuffer;
  pickFilter.type = "highpass";
  pickFilter.frequency.value = 1800;
  pickGain.gain.setValueAtTime(0.035, strumStart);
  pickGain.gain.exponentialRampToValueAtTime(0.0001, strumStart + 0.04);
  pick.connect(pickFilter);
  pickFilter.connect(pickGain);
  pickGain.connect(audio.destination);
  pick.start(strumStart);
}

function navigateWithStartSound(button) {
  if (!button) return;

  button.addEventListener("click", (event) => {
    event.preventDefault();
    const destination = button.href;
    let soundUrl;
    let navigationStarted = false;

    const navigate = () => {
      if (navigationStarted) return;
      navigationStarted = true;
      if (soundUrl) URL.revokeObjectURL(soundUrl);
      window.location.href = destination;
    };

    try {
      soundUrl = createStartToneWavUrl();
      const sound = new Audio(soundUrl);
      sound.volume = 0.55;
      sound.addEventListener("ended", () => window.setTimeout(navigate, 80), { once: true });

      // play() é chamado diretamente no gesto do usuário; não depende de
      // AudioContext.resume() nem de uma resposta de rede na primeira visita.
      const playback = sound.play();
      if (playback && typeof playback.catch === "function") {
        playback.catch((error) => {
          console.error("Não foi possível tocar o som do START:", error);
          navigate();
        });
      }

      window.setTimeout(navigate, 1500);
    } catch (error) {
      console.error("Não foi possível iniciar o som do START:", error);
      navigate();
    }
  });
}

function navigateWithSound(button, playSound, soundDuration, soundName) {
  if (!button) return;

  button.addEventListener("click", (event) => {
    event.preventDefault();
    const destination = button.href;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      window.location.href = destination;
      return;
    }

    let audio;
    let navigationStarted = false;
    let resumeTimeout;

    const navigate = () => {
      if (navigationStarted) return;
      navigationStarted = true;
      window.clearTimeout(resumeTimeout);
      if (audio && audio.state !== "closed") audio.close().catch(() => {});
      window.location.href = destination;
    };

    const playAndNavigate = () => {
      if (navigationStarted) return;
      try {
        playSound(audio);
        window.setTimeout(navigate, soundDuration);
      } catch (error) {
        console.error(`Não foi possível tocar o som de ${soundName}:`, error);
        navigate();
      }
    };

    try {
      audio = new AudioContextClass();

      if (audio.state === "running") {
        playAndNavigate();
        return;
      }

      // O resume é chamado dentro do clique. Aguarde o navegador liberar o
      // contexto antes de agendar as notas, especialmente na primeira visita.
      resumeTimeout = window.setTimeout(() => {
        console.error(`O áudio de ${soundName} não foi liberado a tempo.`);
        navigate();
      }, 2000);

      audio.resume().then(() => {
        if (audio.state === "running") {
          window.clearTimeout(resumeTimeout);
          playAndNavigate();
        } else {
          navigate();
        }
      }).catch((error) => {
        console.error(`Não foi possível ativar o áudio de ${soundName}:`, error);
        navigate();
      });
    } catch (error) {
      console.error(`Não foi possível iniciar o áudio de ${soundName}:`, error);
      navigate();
    }
  });
}

navigateWithStartSound(startButton);
navigateWithSound(selectButton, playSelectSound, 650, "SELECT");
