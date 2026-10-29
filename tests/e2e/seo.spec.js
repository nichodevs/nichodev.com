const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const origin = "https://nichodev.com";
const routes = ["/", "/voz.html", "/guitarra.html", "/mixmaster.html", "/downloads.html", "/onda/"];
const card = origin + "/assets/social-card.png";

test.use({ javaScriptEnabled: false });

for (const route of [...routes, "/index.html"]) {
  test(`metadados estáticos e URL canônica de ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const canonical = origin + (route === "/index.html" ? "/" : route);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical);
    const title = await page.title();
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(title).toContain("nichodev.com");
    expect(description.length).toBeGreaterThan(50);
    for (const [key, value] of Object.entries({
      "og:type": "website", "og:site_name": "nichodev.com", "og:locale": "pt_BR",
      "og:title": title, "og:description": description, "og:url": canonical,
      "og:image": card, "og:image:type": "image/png", "og:image:width": "1200", "og:image:height": "630"
    })) {
      await expect(page.locator(`meta[property="${key}"]`)).toHaveCount(1);
      await expect(page.locator(`meta[property="${key}"]`)).toHaveAttribute("content", value);
    }
    for (const [key, value] of Object.entries({
      "twitter:card": "summary_large_image", "twitter:title": title,
      "twitter:description": description, "twitter:image": card
    })) await expect(page.locator(`meta[name="${key}"]`)).toHaveAttribute("content", value);
    const alt = await page.locator('meta[property="og:image:alt"]').getAttribute("content");
    expect(alt.length).toBeGreaterThan(10);
    await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute("content", alt);
    if (route === "/") {
      expect(description).toMatch(/voz/i);
      expect(description).toContain("guitarra");
      expect(description).toContain("MIXMASTER");
      expect(description).toContain("VST3");
    }
  });
}

test("sitemap e robots anunciam apenas as páginas canônicas", async ({ request, page }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBeTruthy();
  const xml = await response.text();
  const parsed = await page.evaluate(xml => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return { errors: doc.querySelectorAll("parsererror").length, namespace: doc.documentElement.namespaceURI,
      urls: [...doc.querySelectorAll("loc")].map(el => el.textContent) };
  }, xml);
  expect(parsed.errors).toBe(0);
  expect(parsed.namespace).toBe("http://www.sitemaps.org/schemas/sitemap/0.9");
  expect(parsed.urls.sort()).toEqual(routes.map(route => origin + route).sort());
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain("Sitemap: " + origin + "/sitemap.xml");
});

test("cartão social é PNG 1200x630 e os recursos de SEO entram no SFTP", async ({ request }) => {
  const response = await request.get("/assets/social-card.png");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("image/png");
  const png = await response.body();
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
  const workflow = fs.readFileSync(path.join(__dirname, "../../.github/workflows/deploy.yml"), "utf8");
  for (const file of ["sitemap.xml", "robots.txt", "assets/social-card.png"]) {
    expect(workflow).toContain(`put public/${file} -o ${file}`);
    expect(workflow).toContain("            /" + file + "\n");
  }
});
