"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function validateFixture(mode) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "nichodev-validation-"));
  try {
    for (const folder of ["scripts", ".github/workflows", "public/js", "public/onda"]) fs.mkdirSync(path.join(fixture, folder), { recursive: true });
    fs.copyFileSync(path.join(__dirname, "../scripts/validate-site.js"), path.join(fixture, "scripts/validate-site.js"));
    const files = {
      "index.html": '<script src="js/main.js" defer></script>',
      "voz.html": "<h1>Voz</h1>", "guitarra.html": "<h1>Guitarra</h1>",
      "downloads.html": "<h1>Downloads</h1>", "mixmaster.html": "<h1>Mixmaster</h1>", "onda/index.html": "<h1>Onda</h1>",
      "js/main.js": 'import("./feature.js?v=1");',
      "js/feature.js": 'import { value } from "./model.js?v=1"; export const result = value;',
      "js/model.js": "export const value = 1;"
    };
    const uploads = Object.keys(files).filter(file => !(file === "js/model.js" && mode !== "valid"));
    if (mode === "missing") delete files["js/model.js"];
    for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(fixture, "public", file), content);
    fs.writeFileSync(path.join(fixture, ".github/workflows/deploy.yml"), uploads.map(file => `put public/${file} -o ${file}`).join("\n"));
    return spawnSync(process.execPath, [path.join(fixture, "scripts/validate-site.js")], { encoding: "utf8" });
  } finally {
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

test("validador segue imports estáticos e dinâmicos relativos", () => {
  const result = validateFixture("valid");
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("validador rejeita dependência que ficou fora do SFTP", () => {
  const result = validateFixture("not-uploaded");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /js\/model\.js: usado pelo site, mas não publicado/);
});

test("validador rejeita módulo importado ausente", () => {
  const result = validateFixture("missing");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /arquivo local ausente: js\/model\.js/);
});
