"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const pages = ["index.html", "voz.html", "guitarra.html"];
const errors = [];
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => [m[1].toLowerCase(), m[2] ?? m[3]]));
for (const page of pages) {
  const html = read(page);
  const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(m => m[1]);
  const idSet = new Set(ids);
  for (const id of ids) if (ids.filter(x => x === id).length > 1) errors.push(`${page}: ID duplicado: ${id}`);
  for (const tag of html.matchAll(/<(?:script|link|a|label|[^>]+)\b[^>]*>/gi)) {
    const a = attrs(tag[0]);
    for (const key of ["for", "aria-labelledby", "aria-describedby", "aria-controls"]) {
      for (const ref of (a[key] || "").split(/\s+/).filter(Boolean)) if (!idSet.has(ref)) errors.push(`${page}: ${key} aponta para ID ausente: ${ref}`);
    }
    if (a.href?.startsWith("#") && !idSet.has(decodeURIComponent(a.href.slice(1)))) errors.push(`${page}: âncora inexistente: ${a.href}`);
    for (const key of ["src", "href"]) {
      const value = a[key];
      if (!value || /^(?:[a-z]+:|\/\/|#)/i.test(value)) continue;
      const local = decodeURIComponent(value.split(/[?#]/, 1)[0]);
      if (local && !fs.existsSync(path.resolve(root, local))) errors.push(`${page}: arquivo local ausente: ${local}`);
    }
  }
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(m => m[1]).filter(s => !/^(?:[a-z]+:|\/\/)/i.test(s));
  for (const file of scripts) {
    const localFile = decodeURIComponent(file.split(/[?#]/, 1)[0]);
    const syntax = spawnSync(process.execPath, ["--check", path.join(root, localFile)], { encoding: "utf8" });
    if (syntax.status !== 0) errors.push(`${page}: erro de sintaxe em ${localFile}: ${(syntax.stderr || syntax.stdout).trim()}`);
    const js = read(localFile);
    const refs = [...js.matchAll(/\$\(\s*["']([^"']+)["']\s*\)|getElementById\(\s*["']([^"']+)["']\s*\)/g)].map(m => m[1] || m[2]);
    for (const id of new Set(refs)) if (!idSet.has(id)) errors.push(`${page}: ${file} usa ID ausente: ${id}`);
  }
}
for (const file of fs.readdirSync(root).filter(f => f.endsWith(".css"))) {
  const css = read(file);
  if ((css.match(/{/g) || []).length !== (css.match(/}/g) || []).length) errors.push(`${file}: chaves CSS desbalanceadas`);
  for (const [, value] of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    if (/^(?:[a-z]+:|\/\/|data:|#)/i.test(value)) continue;
    const local = value.split(/[?#]/, 1)[0];
    if (local && !fs.existsSync(path.resolve(root, local))) errors.push(`${file}: recurso CSS ausente: ${local}`);
  }
}
for (const file of ["modular-fx.html", "modular-fx.css", "js/modular-fx.js", "js/compact-mode.js"]) {
  if (fs.existsSync(path.join(root, file))) errors.push(`Arquivo obsoleto ainda presente: ${file}`);
}
if (errors.length) {
  console.error("Validação falhou:\n- " + errors.join("\n- "));
  process.exitCode = 1;
} else {
  console.log("Validação concluída: sintaxe, IDs, referências locais e limpeza do Modular FX OK.");
}
