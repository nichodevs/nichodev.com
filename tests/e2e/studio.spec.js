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
  }

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
