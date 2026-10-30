"use strict";

document.querySelectorAll('a[href="index.html"], a[href="/index.html"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const destination = link.href;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      window.location.href = destination;
      return;
    }

    let audio;
    let navigationStarted = false;
    let fallbackTimer;

    const navigate = () => {
      if (navigationStarted) return;
      navigationStarted = true;
      window.clearTimeout(fallbackTimer);
      if (audio && audio.state !== "closed") audio.close().catch(() => {});
      window.location.href = destination;
    };

    try {
      audio = new AudioContextClass();
      const resumePromise = audio.state === "running"
        ? Promise.resolve()
        : audio.resume();

      resumePromise.then(() => {
        if (audio.state !== "running") {
          navigate();
          return;
        }

        // Dois tons descendentes em registro grave formam o retorno sonoro.
        const notes = [
          { frequency: 146.83, start: 0, duration: 0.18 },
          { frequency: 110, start: 0.16, duration: 0.24 }
        ];

        notes.forEach((note) => {
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();
          const start = audio.currentTime + note.start;
          const end = start + note.duration;

          oscillator.type = "triangle";
          oscillator.frequency.value = note.frequency;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, end);
          oscillator.connect(gain);
          gain.connect(audio.destination);
          oscillator.start(start);
          oscillator.stop(end);
        });

        window.setTimeout(navigate, 450);
      }).catch((error) => {
        console.error("Não foi possível tocar o som de voltar:", error);
        navigate();
      });

      fallbackTimer = window.setTimeout(navigate, 2000);
    } catch (error) {
      console.error("Não foi possível iniciar o som de voltar:", error);
      navigate();
    }
  });
});

