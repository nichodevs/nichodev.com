"use strict";

const startButton = document.getElementById("startBtn");

if (startButton) {
  startButton.addEventListener("click", async (event) => {
    // O som tem um pequeno intervalo para tocar antes da navegação.
    event.preventDefault();
    const destination = startButton.href;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      window.location.href = destination;
      return;
    }

    let audio;
    try {
      audio = new AudioContextClass();
      // Inicie a retomada durante a ativação do clique, mas não espere a
      // Promise: o som precisa ser agendado imediatamente para funcionar
      // também na primeira interação em navegadores com autoplay bloqueado.
      if (audio.state !== "running") {
        const resumePromise = audio.resume();
        resumePromise.catch((error) => {
          console.error("Não foi possível ativar o áudio do START:", error);
        });
      }

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

      window.setTimeout(() => {
        if (audio && audio.state !== "closed") audio.close();
        window.location.href = destination;
      }, 350);
    } catch (error) {
      console.error("Não foi possível tocar o som do START:", error);
      if (audio && audio.state !== "closed") audio.close().catch(() => {});
      window.location.href = destination;
    }
  });
}
