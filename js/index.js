"use strict";

const startButton = document.getElementById("startBtn");
const selectButton = document.querySelector('a[href="guitarra.html"]');

function playStartSound(audio) {
  const notes = [
    { frequency: 440, start: 0, duration: 0.08 },
    { frequency: 660, start: 0.09, duration: 0.12 }
  ];

  for (const note of notes) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime + note.start;
    const end = start + note.duration;

    oscillator.type = "square";
    oscillator.frequency.value = note.frequency;
    gain.gain.setValueAtTime(0.12, start);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(end);
  }
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

navigateWithSound(startButton, playStartSound, 350, "START");
navigateWithSound(selectButton, playSelectSound, 650, "SELECT");
