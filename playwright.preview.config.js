const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir:"./tests/preview", fullyParallel:false, workers:1, timeout:30000,
  forbidOnly:Boolean(process.env.CI), retries:process.env.CI?1:0, reporter:process.env.CI?"github":"list",
  use:{trace:"retain-on-failure",screenshot:"only-on-failure"},
  projects:["chromium","firefox","webkit"].map(browserName=>({name:browserName,use:{browserName}}))
});
