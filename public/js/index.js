"use strict";

fetch('/api/community/session').then(response=>response.ok?response.json():null).then(data=>{
  if(!data?.publicRelease)return;
  const root=document.getElementById('communityAccess'),link=document.createElement('a');
  link.className='btn';link.href='/comunidade/';link.textContent='COMUNIDADE';link.setAttribute('aria-label','Abrir comunidade de áudio');
  root.append(link);root.hidden=false;
}).catch(()=>{});

const startButton = document.getElementById("startBtn");
const selectButton = document.querySelector('a[href="guitarra.html"]');
const mixmasterButton = document.querySelector('a[href="mixmaster.html"]');

let menuAudioContext = null;
const primedMenuSounds = new WeakMap();

function getMenuAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!menuAudioContext || menuAudioContext.state === "closed") {
    menuAudioContext = new AudioContextClass();
  }
  return menuAudioContext;
}

function startMenuSoundOnPointerDown(button, playSound) {
  button.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    try {
      const audio = getMenuAudioContext();
      if (!audio) return;

      // Solicite a retomada e crie os osciladores durante o gesto físico.
      const resumePromise = audio.state === "running"
        ? Promise.resolve()
        : audio.resume();
      const primed = { audio, resumePromise, soundStarted: false };
      primedMenuSounds.set(button, primed);
      resumePromise.then(() => {
        if (audio.state === "running" && !primed.soundStarted) {
          playSound(audio);
          primed.soundStarted = true;
        }
      }).catch((error) => {
        console.error("Não foi possível preparar o áudio do menu:", error);
      });
    } catch (error) {
      console.error("Não foi possível iniciar o som no pointerdown:", error);
    }
  }, { passive: true });
}

function playStartSound(audio) {
  const notes = [
    { frequency: 440, start: 0.015, duration: 0.16 },
    { frequency: 660, start: 0.17, duration: 0.24 }
  ];

  for (const note of notes) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime + note.start;
    const end = start + note.duration;

    oscillator.type = "square";
    oscillator.frequency.value = note.frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.008);
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


function playMixMasterSound(audio) {
  // Fundamental grave e harmônicos reforçados para continuar audível em caixas pequenas.
  const filter = audio.createBiquadFilter();
  const output = audio.createGain();
  filter.type = "lowpass";
  filter.frequency.value = 1050;
  filter.Q.value = 0.7;
  output.gain.value = 0.9;
  filter.connect(output);
  output.connect(audio.destination);

  const notes = [
    { frequency: 82.41, start: 0.01, duration: 0.42, volume: 0.28, type: "triangle" },
    { frequency: 164.82, start: 0.012, duration: 0.34, volume: 0.12, type: "sawtooth" },
    { frequency: 246.94, start: 0.014, duration: 0.25, volume: 0.055, type: "triangle" }
  ];

  for (const note of notes) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime + note.start;
    const end = start + note.duration;
    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(note.frequency * 1.025, start);
    oscillator.frequency.exponentialRampToValueAtTime(note.frequency, start + 0.06);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(note.volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(filter);
    oscillator.start(start);
    oscillator.stop(end);
  }

  const attack = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.04), audio.sampleRate);
  const samples = attack.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
  const pick = audio.createBufferSource();
  const pickFilter = audio.createBiquadFilter();
  const pickGain = audio.createGain();
  pick.buffer = attack;
  pickFilter.type = "lowpass";
  pickFilter.frequency.value = 850;
  pickGain.gain.setValueAtTime(0.045, audio.currentTime + 0.01);
  pickGain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.05);
  pick.connect(pickFilter);
  pickFilter.connect(pickGain);
  pickGain.connect(output);
  pick.start(audio.currentTime + 0.01);
}
function navigateWithSound(button, playSound, soundDuration, soundName) {
  if (!button) return;

  startMenuSoundOnPointerDown(button, playSound);

  button.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const destination = button.href;
    let audio;
    let resumePromise;
    let navigationStarted = false;
    let resumeTimeout;

    const navigate = () => {
      if (navigationStarted) return;
      navigationStarted = true;
      window.clearTimeout(resumeTimeout);
      if (audio && audio.state !== "closed") audio.close().catch(() => {});
      window.location.href = destination;
    };

    try {
      const primed = primedMenuSounds.get(button);
      primedMenuSounds.delete(button);

      if (primed) {
        ({ audio, resumePromise } = primed);
      } else {
        // Teclado e tecnologias assistivas podem gerar click sem pointerdown.
        audio = getMenuAudioContext();
        if (!audio) {
          navigate();
          return;
        }
        resumePromise = audio.state === "running"
          ? Promise.resolve()
          : audio.resume();
        resumePromise.then(() => {
          if (audio.state === "running") playSound(audio);
        }).catch((error) => {
          console.error(`Não foi possível preparar o áudio de ${soundName}:`, error);
        });
      }

      resumeTimeout = window.setTimeout(() => {
        console.error(`O áudio de ${soundName} não foi liberado a tempo.`);
        navigate();
      }, 2000);

      resumePromise.then(() => {
        if (audio.state === "running") {
          window.clearTimeout(resumeTimeout);
          window.setTimeout(navigate, soundDuration);
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

navigateWithSound(startButton, playStartSound, 550, "START");
navigateWithSound(selectButton, playSelectSound, 650, "SELECT");
navigateWithSound(mixmasterButton, playMixMasterSound, 600, "MIX/MASTER");
