const { test, expect } = require("@playwright/test");

test("NS-2 gates quiet audio without compressing loud or cancelling stereo", async ({ page }) => {
  await page.goto("/guitarra.html", { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async () => {
    const sampleRate = 48000, length = sampleRate;
    const sine = amplitude => Float32Array.from({ length }, (_, i) =>
      Math.sin(2 * Math.PI * 1000 * i / sampleRate) * (typeof amplitude === "function" ? amplitude(i / sampleRate) : amplitude));
    const rms = (data, start = .4, end = .55) => {
      const first = Math.round(start * sampleRate), last = Math.round(end * sampleRate);
      let sum = 0;
      for (let i = first; i < last; i++) sum += data[i] * data[i];
      return Math.sqrt(sum / (last - first));
    };
    const render = async (channels, threshold = 50, on = true, pedal = "ns2") => {
      ctx = new OfflineAudioContext(channels.length, length, sampleRate);
      enabled[pedal] = on; values[pedal] = threshold;
      const buffer = ctx.createBuffer(channels.length, length, sampleRate);
      channels.forEach((data, index) => buffer.copyToChannel(data, index));
      const source = ctx.createBufferSource(), stage = makeStage(pedal);
      source.buffer = buffer; source.connect(stage.input); stage.output.connect(ctx.destination); source.start();
      const output = await ctx.startRendering();
      return Array.from({ length: channels.length }, (_, index) => output.getChannelData(index));
    };
    const input = sine(time => time >= .2 && time < .6 ? .25 : .0005);
    const [gated] = await render([input]);
    const [bypassed] = await render([input], 50, false);
    const nearThreshold = sine(.003);
    const [lowThreshold] = await render([nearThreshold], 0);
    const [highThreshold] = await render([nearThreshold], 100);
    const loud = sine(.25), silent = new Float32Array(length);
    const inverted = Float32Array.from(loud, sample => -sample);
    const stereo = await render([loud, inverted]);
    const leftOnly = await render([loud, silent]);
    const [compressed] = await render([loud], 50, true, "cs3");
    const step = Float32Array.from({ length }, (_, i) => i < .3 * sampleRate ? .05 : .0001);
    const [smooth] = await render([step]);
    let bypassError = 0, gainStep = 0, lastGain = 0, minGain = Infinity, maxGain = -Infinity, finite = true;
    for (let i = 0; i < length; i++) {
      bypassError = Math.max(bypassError, Math.abs(bypassed[i] - input[i]));
      const gain = smooth[i] / step[i];
      if (i) gainStep = Math.max(gainStep, Math.abs(gain - lastGain));
      lastGain = gain;
      minGain = Math.min(minGain, gain); maxGain = Math.max(maxGain, gain);
      finite &&= [gated[i], smooth[i], stereo[0][i], stereo[1][i], leftOnly[0][i], leftOnly[1][i]].every(Number.isFinite);
    }
    return {
      quietRatio: rms(gated, .08, .18) / rms(input, .08, .18),
      loudRatio: rms(gated) / rms(input),
      releasedRatio: rms(gated, .85, .95) / rms(input, .85, .95),
      lowThresholdRatio: rms(lowThreshold) / rms(nearThreshold),
      highThresholdRatio: rms(highThreshold) / rms(nearThreshold),
      stereoRatios: stereo.map(channel => rms(channel) / rms(loud)),
      leftOnlyRatio: rms(leftOnly[0]) / rms(loud),
      silentRight: Math.max(...leftOnly[1].map(Math.abs)),
      compressorRatio: rms(compressed) / rms(loud),
      bypassError, gainStep, minGain, maxGain, finite
    };
  });

  expect(result.finite).toBeTruthy();
  expect(result.quietRatio).toBeLessThan(.01);
  expect(result.releasedRatio).toBeLessThan(.01);
  expect(result.loudRatio).toBeCloseTo(1, 3);
  expect(result.lowThresholdRatio).toBeCloseTo(1, 3);
  expect(result.highThresholdRatio).toBeLessThan(.01);
  for (const ratio of result.stereoRatios) expect(ratio).toBeCloseTo(1, 3);
  expect(result.leftOnlyRatio).toBeCloseTo(1, 3);
  expect(result.silentRight).toBe(0);
  expect(result.compressorRatio).toBeLessThan(.8);
  expect(result.bypassError).toBeLessThan(1e-7);
  expect(result.gainStep).toBeLessThan(.01);
  expect(result.minGain).toBeGreaterThanOrEqual(-.001);
  expect(result.maxGain).toBeLessThanOrEqual(1.001);
});
