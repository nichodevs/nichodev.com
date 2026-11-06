const { test, expect } = require("@playwright/test");
const { openCommunity, account, phrase } = require("../helpers/community");

test("English menus keep the locale, account and deep link on mobile", async ({ page }) => {
  const community = await openCommunity({ publicRelease: true });
  try {
    await account(community.client(), "language_test");
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(community.origin + "/");
    await page.getByRole("link", { name: "English", exact: true }).click();
    await page.getByRole("link", { name: "Open the audio community" }).click();
    await expect(page).toHaveURL(community.origin + "/en/comunidade/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.locator(".account-button").click();
    await page.locator("#accountUser").fill("language_test");
    await page.locator("#accountPassword").fill("an incorrect passphrase");
    await page.locator("#accountSubmit").click();
    await expect(page.locator("#accountError")).toHaveText("Invalid username or password.");
    await page.locator("#accountPassword").fill(phrase);
    await page.locator("#accountSubmit").click();
    await expect(page.locator("#accountLabel")).toContainText("language_test");

    await page.locator("#headerChar").click();
    await expect(page.locator("#nicoPreview")).toBeVisible();
    await expect(page.locator("#nicoEditor")).toContainText("FREE DRAW");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole("link", { name: "Português", exact: true }).click();
    await expect(page).toHaveURL(community.origin + "/comunidade/#char");
    await expect(page.locator("#accountLabel")).toContainText("language_test");
    await page.getByRole("link", { name: "English", exact: true }).click();
    await expect(page).toHaveURL(community.origin + "/en/comunidade/#char");

    await page.goto(community.origin + "/en/comunidade/ferramentas/guitarra.html");
    await page.getByRole("link", { name: "BACK TO COMMUNITY", exact: true }).click();
    await expect(page).toHaveURL(community.origin + "/en/comunidade/");
    expect(errors).toEqual([]);
  } finally {
    await community.close();
  }
});
