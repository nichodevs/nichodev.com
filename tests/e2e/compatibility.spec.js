const { test, expect } = require("@playwright/test");
const { wav, downloadBytes } = require("../helpers/audio");

const PROJECT_KEY = "nichodev-mixmaster-project-v1";

test("navega entre ferramentas, volta pelo menu e pelo histórico", async ({ page }) => {
  await page.goto("/");
  for (const [name, path, heading] of [
    ["Abrir estúdio de voz", "/voz.html", /estúdio de voz/i],
    ["Abrir Guitar FX LAB", "/guitarra.html", /guitar fx lab/i],
    ["Abrir MIXMASTER", "/mixmaster.html", /mixmaster/i],
    ["Baixar a suite Nichodev VST3", "/downloads.html", /download vst3/i]
  ]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(path.replace(".", "\\.") + "$"));
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await page.locator('a[href="index.html"]').first().click();
    await expect(page).toHaveURL(/\/index\.html$/);
  }
  await page.locator(".sound-wave-link").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/onda de gratidão/i);
  await page.goBack();
  await expect(page.getByRole("link", { name: "Abrir MIXMASTER" })).toBeVisible();
});

test("MIXMASTER importa WAV, produz sinal e interrompe a reprodução", async ({ page }) => {
  await page.goto("/mixmaster.html");
  await expect(page.locator(".track-row")).toHaveCount(1);
  await page.locator("#audioFiles").setInputFiles({ name: "sinal.wav", mimeType: "audio/wav", buffer: wav(4, 440) });
  await expect(page.locator(".audio-clip")).toHaveCount(1);
  await page.locator("#playButton").click();
  await expect(page.locator("#playButton")).toHaveClass(/playing/);
  await expect.poll(() => page.locator("#audioMeter i").evaluate(el => parseFloat(el.style.width))).toBeGreaterThan(10);
  await expect(page.locator("#timeReadout")).not.toHaveText("00:00.00");
  await page.locator("#stopButton").click();
  await expect(page.locator("#playButton")).not.toHaveClass(/playing/);
  await expect(page.locator("#timeReadout")).toHaveText("00:00.00");
  await expect.poll(() => page.locator("#audioMeter i").evaluate(el => parseFloat(el.style.width))).toBeLessThanOrEqual(3);
});

test("MIXMASTER restaura IndexedDB em outra página e importa o backup sem mudar o áudio", async ({ page, context }) => {
  const audio = wav(4, 440);
  await page.goto("/mixmaster.html");
  await expect(page.locator(".track-row")).toHaveCount(1);
  await page.locator("#audioFiles").setInputFiles({ name: "persistente.wav", mimeType: "audio/wav", buffer: audio });
  await expect(page.locator(".audio-clip")).toHaveCount(1);
  await expect(page.locator("#projectStatus")).toHaveText("Projeto salvo neste navegador");
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), PROJECT_KEY);
  expect(saved.tracks[0].clips[0].sourceEnd).toBeCloseTo(4, 4);
  await page.close();

  const restored = await context.newPage();
  await restored.goto("/mixmaster.html");
  await expect(restored.locator("#projectStatus")).toContainText("Projeto restaurado · 1 clipe(s) de áudio");
  await expect(restored.locator(".clip-label")).toHaveText("persistente.wav");
  await restored.locator("#playButton").click();
  await expect.poll(() => restored.locator("#audioMeter i").evaluate(el => parseFloat(el.style.width))).toBeGreaterThan(10);
  await restored.locator("#stopButton").click();

  const bytes = await downloadBytes(restored, "#exportProjectButton"), backup = JSON.parse(bytes.toString());
  expect(backup.assets).toHaveLength(1);
  expect(Buffer.from(backup.assets[0].dataBase64, "base64")).toEqual(audio);
  restored.on("dialog", dialog => dialog.accept());
  await restored.locator("#projectFile").setInputFiles({ name: "restaurar.nichodev.json", mimeType: "application/json", buffer: bytes });
  await expect(restored.locator("#projectStatus")).toContainText("Backup restaurado");
  await expect(restored.locator(".audio-clip")).toHaveCount(1);
  const roundTrip = JSON.parse((await downloadBytes(restored, "#exportProjectButton")).toString());
  expect(Buffer.from(roundTrip.assets[0].dataBase64, "base64")).toEqual(audio);
});

test("MIXMASTER oferece recuperação quando IndexedDB está indisponível", async ({ page }) => {
  await page.addInitScript(() => {
    indexedDB.open = () => { throw new DOMException("Bloqueado para teste", "SecurityError"); };
  });
  await page.goto("/mixmaster.html");
  await expect(page.locator(".track-row")).toHaveCount(1);
  const audio = wav(1, 440);
  await page.locator("#audioFiles").setInputFiles({ name: "temporario.wav", mimeType: "audio/wav", buffer: audio });
  await expect(page.locator(".audio-clip")).toHaveCount(1);
  await expect(page.locator("#projectStatus")).toContainText("temporário");
  await expect(page.locator("#recoverAudio")).toBeVisible();
  expect(await downloadBytes(page, "#recoverAudio")).toEqual(audio);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), PROJECT_KEY);
  expect(saved.tracks[0].clips).toHaveLength(0);
});

test("Guitar FX importa WAV e reproduz pelo player com pedais", async ({ page }) => {
  await page.goto("/guitarra.html");
  const chooser = page.waitForEvent("filechooser");
  await page.locator('label[for="audioFile"]').click();
  await (await chooser).setFiles({ name: "guitarra.wav", mimeType: "audio/wav", buffer: wav(4, 440) });
  await expect(page.locator("#playFile")).toBeEnabled();
  await page.locator("#playFile").click();
  await expect(page.locator("#inputStatus")).toContainText("Reproduzindo com pedais");
  await expect.poll(() => page.locator("#audioSource").evaluate(el => el.currentTime)).toBeGreaterThan(.1);
  expect(await page.locator("#audioSource").evaluate(el => el.paused)).toBe(false);
  await page.locator("#stopFile").click();
  expect(await page.locator("#audioSource").evaluate(el => el.paused)).toBe(true);
  await expect(page.locator("#inputStatus")).toHaveText("Reprodução parada.");
});

test("Voice Studio importa WAV e inicia e para a prévia com efeitos", async ({ page }) => {
  await page.goto("/voz.html");
  await page.locator(".audio-panel > summary").click();
  await page.locator("#audioFile").setInputFiles({ name: "voz.wav", mimeType: "audio/wav", buffer: wav(4, 440) });
  await expect(page.locator("#recordingState")).toHaveText("Arquivo importado e pronto para processar.");
  await page.locator("#effectPreviewBtn").click();
  await expect(page.locator("#previewStatus")).toContainText("Reproduzindo com efeitos");
  const started = await page.evaluate(() => Tone.getContext().rawContext.currentTime);
  await expect.poll(() => page.evaluate(() => Tone.getContext().rawContext.currentTime)).toBeGreaterThan(started + .05);
  await page.locator("#stopPreviewBtn").click();
  await expect(page.locator("#previewStatus")).toHaveText("Prévia parada.");
  await expect(page.locator("#stopPreviewBtn")).toBeDisabled();
});
