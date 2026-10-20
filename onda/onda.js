(() => {
  "use strict";
  const stage = document.getElementById("waveStage");
  const canvas = document.getElementById("soundWave");
  const cursor = document.querySelector(".wave-cursor");
  if (!stage || !canvas) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = { x: 0.5, targetX: 0.5, strength: 0, targetStrength: 0 };
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let frame = 0;
  let time = 0;
  let lastTime = 0;

  function resize() {
    const bounds = stage.getBoundingClientRect();
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = bounds.width;
    height = bounds.height;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    draw();
  }

  function setPointer(clientX, clientY, active = true) {
    const bounds = stage.getBoundingClientRect();
    pointer.targetX = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    pointer.targetStrength = active ? 1 : 0;
    if (cursor) {
      cursor.style.left = (pointer.targetX * 100) + "%";
      cursor.style.top = Math.max(8, Math.min(92, ((clientY - bounds.top) / bounds.height) * 100)) + "%";
    }
  }

  function draw() {
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    const centerY = height / 2;
    const pointerX = pointer.x * width;
    const colors = ["#c66bff", "#ff62cf", "#8f73ff"];

    for (let layer = 0; layer < colors.length; layer++) {
      context.beginPath();
      const amplitude = height * (0.13 + layer * 0.045);
      const frequency = 0.012 + layer * 0.002;
      const phase = time * (0.0013 + layer * 0.00022) + layer * 1.7;
      for (let x = 0; x <= width; x += 2) {
        const distance = (x - pointerX) / Math.max(width * 0.19, 1);
        const influence = pointer.strength * Math.exp(-(distance * distance));
        const ripple = Math.sin(x * frequency - phase) * amplitude;
        const interaction = Math.sin(x * 0.035 - phase * 2.8) * amplitude * influence * 1.55;
        const y = centerY + ripple + interaction;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = colors[layer];
      context.globalAlpha = 0.9 - layer * 0.18;
      context.lineWidth = layer === 0 ? 2.5 : 1.6;
      context.shadowColor = colors[layer];
      context.shadowBlur = 12 + pointer.strength * 13;
      context.stroke();
    }
    context.globalAlpha = 1;
    context.shadowBlur = 0;
  }

  function animate(now) {
    const delta = lastTime ? Math.min(now - lastTime, 40) : 16;
    lastTime = now;
    if (!reducedMotion.matches) time += delta;
    pointer.x += (pointer.targetX - pointer.x) * 0.12;
    pointer.strength += (pointer.targetStrength - pointer.strength) * 0.08;
    draw();
    frame = window.requestAnimationFrame(animate);
  }

  stage.addEventListener("pointermove", event => setPointer(event.clientX, event.clientY));
  stage.addEventListener("pointerenter", event => setPointer(event.clientX, event.clientY));
  stage.addEventListener("pointerleave", () => { pointer.targetStrength = 0; });
  stage.addEventListener("pointerdown", event => {
    stage.focus({ preventScroll: true });
    setPointer(event.clientX, event.clientY);
  });
  stage.addEventListener("keydown", event => {
    const amount = event.shiftKey ? 0.1 : 0.04;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      pointer.targetX = Math.max(0, Math.min(1, pointer.targetX + (event.key === "ArrowRight" ? amount : -amount)));
      pointer.targetStrength = 1;
      if (cursor) cursor.style.left = (pointer.targetX * 100) + "%";
    }
  });
  stage.addEventListener("keyup", event => {
    if (event.key.startsWith("Arrow")) pointer.targetStrength = 0.35;
  });
  window.addEventListener("blur", () => { pointer.targetStrength = 0; });
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
  else window.addEventListener("resize", resize);
  reducedMotion.addEventListener?.("change", () => { lastTime = 0; });
  resize();
  frame = window.requestAnimationFrame(animate);
  window.addEventListener("pagehide", () => window.cancelAnimationFrame(frame), { once: true });
})();
