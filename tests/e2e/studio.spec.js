const { test, expect } = require("@playwright/test");

const studioPages = [
  { path: "/", heading: /nichodev\.com/i },
  { path: "/voz.html", heading: /estúdio de voz/i },
  { path: "/guitarra.html", heading: /guitar fx lab/i },
  { path: "/mixmaster.html", heading: /mixmaster/i },
  { path: "/onda/", heading: /uma onda de gratidão/i }
];

test.describe("páginas do estúdio", () => {
  for (const pageInfo of studioPages) {
    test(`abre ${pageInfo.path} e mostra o título principal`, async ({ page }) => {
      const response = await page.goto(pageInfo.path, { waitUntil: "domcontentloaded" });
      expect(response?.ok()).toBeTruthy();
      await expect(page.getByRole("heading", { level: 1, name: pageInfo.heading })).toBeVisible();
    });
  }

  test("a página inicial oferece atalhos acessíveis para os estúdios", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Abrir estúdio de voz" })).toHaveAttribute("href", "voz.html");
    await expect(page.getByRole("link", { name: "Abrir Guitar FX LAB" })).toHaveAttribute("href", "guitarra.html");
    await expect(page.getByRole("link", { name: "Abrir MIXMASTER" })).toHaveAttribute("href", "mixmaster.html");
  });

  for (const pageInfo of studioPages) {
    test(`não cria rolagem horizontal em celular em ${pageInfo.path}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(pageInfo.path, { waitUntil: "domcontentloaded" });
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth
      }));
      expect(dimensions.content, `largura do conteúdo: ${dimensions.content}px; viewport: ${dimensions.viewport}px`)
        .toBeLessThanOrEqual(dimensions.viewport + 1);
    });
  }

  for (const pageInfo of studioPages) {
    test(`controles podem receber foco pelo teclado em ${pageInfo.path}`, async ({ page }) => {
      await page.goto(pageInfo.path, { waitUntil: "domcontentloaded" });
      await page.keyboard.press("Tab");
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).not.toBe("BODY");
    });
  }

  test("onda interativa responde às setas do teclado", async ({ page }) => {
    await page.goto("/onda/", { waitUntil: "domcontentloaded" });
    const stage = page.locator("#waveStage");
    const cursor = page.locator(".wave-cursor");
    await stage.focus();
    const before = await cursor.evaluate(element => element.style.left);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => cursor.evaluate(element => element.style.left)).not.toBe(before);
  });
});

test("sons dos links preservam Ctrl+clique e a aba atual", async ({ page, context }) => {
  for (const [path, selector, destination] of [
    ["/", 'a[href="guitarra.html"]', "/guitarra.html"],
    ["/guitarra.html", 'a[href="index.html"]', "/index.html"]
  ]) {
    await page.goto(path);
    const original = page.url(), opened = context.waitForEvent("page");
    await page.locator(selector).first().click({ modifiers: ["Control"] });
    const tab = await opened;
    await tab.waitForURL("**" + destination);
    expect(page.url()).toBe(original);
    await tab.close();
  }
});

test("onda continua animando após os eventos de ida e retorno do histórico", async ({ page }) => {
  await page.addInitScript(() => {
    window.waveFrameCount = 0;
    const frame = window.requestAnimationFrame;
    window.requestAnimationFrame = callback => frame(time => { window.waveFrameCount++; callback(time); });
  });
  await page.goto("/onda/");
  await expect.poll(() => page.evaluate(() => window.waveFrameCount)).toBeGreaterThan(2);
  const before = await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    return window.waveFrameCount;
  });
  await expect.poll(() => page.evaluate(() => window.waveFrameCount)).toBeGreaterThan(before + 2);
});


test("servidor entrega o site pela raiz e mantém arquivos de desenvolvimento fora dela", async ({ request }) => {
  for (const path of ["/", "/voz.html", "/guitarra.html", "/mixmaster.html", "/onda/", "/robots.txt"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
  }
  for (const path of ["/server.js", "/package.json", "/plugin/CMakeLists.txt"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
  expect((await (await request.get("/health")).json()).status).toBe("ok");
});
