const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { account, openCommunity, phrase } = require("../helpers/community");
const { downloadBytes } = require("../helpers/audio");
const { defaults } = require("../../community/char-format");

test.use({
  serviceWorkers: "allow",
  viewport: { width: 390, height: 844 },
  launchOptions: { args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--use-file-for-fake-audio-capture=" + path.resolve(__dirname, "../../public/assets/chip-lab/piano.wav")
  ] }
});

test.skip(({ browserName }) => browserName !== "chromium", "The test microphone is provided by Chromium");

test("the PWA opens the existing community and records an exportable WAV", async ({ context, page }) => {
  const community = await openCommunity();
  try {
    const client = community.client();
    await account(client, "pwa_tester");
    const saved = await client("/char", { method: "PUT", body: { design: { ...defaults, name: "PWA NICO" }, revision: 0 } });
    expect(saved.status).toBe(200);

    await page.goto(community.origin + "/comunidade/");
    const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute("href");
    const manifest = await (await context.request.get(community.origin + manifestUrl)).json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/comunidade/");
    for (const icon of manifest.icons) {
      const response = await context.request.get(community.origin + icon.src);
      const bytes = await response.body();
      expect(response.ok()).toBe(true);
      expect(bytes.readUInt32BE(16) + "x" + bytes.readUInt32BE(20)).toBe(icon.sizes);
    }
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain("/pwa-worker.js");

    await page.getByRole("button", { name: /ENTRAR \/ CRIAR CONTA/ }).click();
    await page.locator("#accountUser").fill("pwa_tester");
    await page.locator("#accountPassword").fill(phrase);
    await page.locator("#accountSubmit").click();
    await expect(page.locator("#accountLabel")).toContainText("pwa_tester");
    await page.locator("#headerChar").click();
    await expect(page.locator("#nicoPreview")).toBeVisible();
    await expect(page.locator("#nicoName")).toHaveText("PWA NICO");

    await page.getByRole("link", { name: "MIXMASTER", exact: true }).click();
    await expect(page).toHaveURL(community.origin + "/mixmaster.html");
    const record = page.locator("#recordButton");
    await record.click();
    await expect(record).toHaveClass(/recording/);
    await expect(page.locator("#recordingTime")).toHaveText(/^00:0[1-9][.]/);
    await record.click();
    await expect(page.locator("#projectStatus")).toContainText("Gravação salva");
    const wav = await downloadBytes(page, "#exportButton");
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    expect(wav.subarray(8, 12).toString()).toBe("WAVE");
    expect(wav.subarray(44).some(byte => byte !== 0)).toBe(true);

    await page.locator('[data-tab="chip"]').click();
    await page.locator("#chipPlay").click();
    await expect(page.locator("#chipStatus")).toContainText("Ouvindo");
    await page.locator("#chipInsert").click();
    await expect(page.locator(".midi-clip")).toHaveCount(4);

    await context.setOffline(true);
    await page.goto(community.origin + manifest.start_url);
    await expect(page.getByRole("heading", { name: "Conecte-se à internet para usar o Nichodev." })).toBeVisible();
    expect(await page.evaluate(() => caches.keys())).toEqual([]);
    await context.setOffline(false);
    await page.getByRole("link", { name: "Tentar novamente" }).click();
    await expect(page.locator("#accountLabel")).toContainText("pwa_tester");
  } finally {
    await community.close();
  }
});
