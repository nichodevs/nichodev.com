const { defineConfig } = require("@playwright/test");
const site = require("./playwright.config");

module.exports = defineConfig({
  ...site,
  testDir: "./tests/preview",
  use: { ...site.use, baseURL: "http://127.0.0.1:3100" },
  projects: ["chromium", "firefox", "webkit"].map(browserName => ({ name: browserName, use: { browserName } })),
  webServer: [
    { command: "npm run preview:community", url: "http://127.0.0.1:3100", reuseExistingServer: !process.env.CI, timeout: 30_000 },
    site.webServer
  ]
});
