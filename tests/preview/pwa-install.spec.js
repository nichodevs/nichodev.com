const { test, expect } = require("@playwright/test");
const { openCommunity } = require("../helpers/community");

const android = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

for (const [name, userAgent, platform, route, title] of [
  ["Android", android, "android", "/", "Instalar o Nichodev"],
  ["iPhone", iphone, "ios", "/comunidade/", "Instalar o Nichodev"],
  ["English", iphone, "ios", "/en/mixmaster.html", "Install Nichodev"]
]) {
  test.describe(name, () => {
    test.use({ userAgent, viewport: { width: 390, height: 844 } });
    test("the visible install button opens device instructions and keeps keyboard focus", async ({ page }) => {
      const community = await openCommunity({ publicRelease: true });
      let releaseSession;
      const gate = new Promise(resolve => { releaseSession = resolve; });
      try {
        await page.route("**/api/community/session", async request => { await gate; await request.continue(); });
        await page.goto(community.origin + route);
        const install = page.getByRole("button", { name: name === "English" ? "Install app" : "Instalar app", exact: true });
        await expect(install).toBeInViewport();
        expect((await install.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await install.click();
        releaseSession();
        await page.waitForLoadState("networkidle");
        const dialog = page.getByRole("dialog", { name: title });
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('[data-pwa-platform="' + platform + '"]')).toHaveAttribute("aria-pressed", "true");
        const steps = dialog.locator('[data-pwa-instructions="' + platform + '"]');
        await expect(steps).toBeVisible();
        await expect(steps).toContainText(platform === "android" ? "Chrome" : "Safari");
        await expect(steps).toContainText(name === "English" ? "Open as Web App" : platform === "android" ? "Instalar e criar atalho" : "Abrir como App da Web");
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        await dialog.getByRole("button", { name: "Android", exact: true }).click();
        await expect(dialog.locator('[data-pwa-instructions="android"]')).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
        await expect(install).toBeFocused();
      } finally {
        releaseSession();
        await community.close();
      }
    });
  });
}

test("the browser invitation is consumed once and installation hides the button", async ({ page }) => {
  const community = await openCommunity({ publicRelease: true });
  try {
    await page.goto(community.origin + "/");
    await page.evaluate(() => {
      window.installCalls = 0;
      const invitation = new Event("beforeinstallprompt", { cancelable: true });
      invitation.prompt = async () => { window.installCalls++; return { outcome: "dismissed" }; };
      window.dispatchEvent(invitation);
      window.invitationDeferred = invitation.defaultPrevented;
    });
    const install = page.getByRole("button", { name: "Instalar app", exact: true });
    await install.click();
    expect(await page.evaluate(() => window.installCalls)).toBe(1);
    expect(await page.evaluate(() => window.invitationDeferred)).toBe(true);
    await expect(page.locator(".pwa-dialog")).not.toBeVisible();
    await install.click();
    await expect(page.locator('[data-pwa-instructions="desktop"]')).toBeVisible();
    expect(await page.evaluate(() => window.installCalls)).toBe(1);
    await page.evaluate(() => {
      const invitation = new Event("beforeinstallprompt", { cancelable: true });
      invitation.prompt = async () => { window.installCalls++; return { outcome: "dismissed" }; };
      window.dispatchEvent(invitation);
    });
    const nativeInstall = page.getByRole("button", { name: "Instalar agora", exact: true });
    await expect(nativeInstall).toBeVisible();
    await nativeInstall.click();
    expect(await page.evaluate(() => window.installCalls)).toBe(2);
    await expect(nativeInstall).toBeHidden();
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(install).toBeHidden();
    await expect(page.locator(".pwa-dialog")).not.toBeVisible();
  } finally { await community.close(); }
});

test("a rejected invitation opens the manual instructions", async ({ page }) => {
  const community = await openCommunity({ publicRelease: true });
  try {
    await page.goto(community.origin + "/");
    await page.evaluate(() => {
      const invitation = new Event("beforeinstallprompt", { cancelable: true });
      invitation.prompt = async () => { throw new Error("Installation unavailable"); };
      window.dispatchEvent(invitation);
    });
    const install = page.getByRole("button", { name: "Instalar app", exact: true });
    await install.click();
    await expect(page.locator(".pwa-dialog")).toBeVisible();
    await expect(install).toBeEnabled();
    await page.getByRole("button", { name: "Fechar instruções de instalação" }).click();
    await expect(page.locator(".pwa-dialog")).not.toBeVisible();
  } finally { await community.close(); }
});

test("the installed iPhone app does not offer installation again", async ({ page }) => {
  const community = await openCommunity({ publicRelease: true });
  try {
    await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
    await page.goto(community.origin + "/comunidade/");
    await expect(page.locator(".pwa-install")).toBeHidden();
  } finally { await community.close(); }
});
