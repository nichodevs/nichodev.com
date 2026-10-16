"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const pages = ["index.html", "voz.html", "guitarra.html", "mixmaster.html"];
const errors = [];
const requiredDeployFiles = new Set(pages);
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const localPath = value => decodeURIComponent(value.split(/[?#]/, 1)[0]);
const attrs = tag => Object.fromEntries(
  [...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map(match => [match[1].toLowerCase(), match[2] ?? match[3]])
);

for (const page of pages) {
  const html = read(page);
  const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(match => match[1]);
  const idSet = new Set(ids);
  const idCounts = new Map();
  for (const id of ids) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  for (const [id, count] of idCounts) {
    if (count > 1) errors.push(`${page}: ID duplicado: ${id}`);
  }

  for (const match of html.matchAll(/<[a-z][^>]*>/gi)) {
    const attributes = attrs(match[0]);
    for (const key of ["for", "aria-labelledby", "aria-describedby", "aria-controls"]) {
      for (const ref of (attributes[key] || "").split(/\s+/).filter(Boolean)) {
        if (!idSet.has(ref)) errors.push(`${page}: ${key} aponta para ID ausente: ${ref}`);
      }
    }

    const href = attributes.href;
    if (href?.startsWith("#") && !idSet.has(decodeURIComponent(href.slice(1)))) {
      errors.push(`${page}: âncora inexistente: ${href}`);
    }

    for (const key of ["src", "href"]) {
      const value = attributes[key];
      if (!value || /^(?:[a-z]+:|\/\/|#)/i.test(value)) continue;
      const local = localPath(value);
      if (!local) continue;
      requiredDeployFiles.add(local);
      if (!fs.existsSync(path.resolve(root, local))) {
        errors.push(`${page}: arquivo local ausente: ${local}`);
      }
    }
  }

  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)]
    .map(match => match[1])
    .filter(src => !/^(?:[a-z]+:|\/\/)/i.test(src));
  for (const src of scripts) {
    const file = localPath(src);
    const syntax = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
    if (syntax.status !== 0) {
      errors.push(`${page}: erro de sintaxe em ${file}: ${(syntax.stderr || syntax.stdout).trim()}`);
      continue;
    }
    const js = read(file);
    const refs = [...js.matchAll(/\$\(\s*["']([^"']+)["']\s*\)|getElementById\(\s*["']([^"']+)["']\s*\)/g)]
      .map(match => match[1] || match[2]);
    for (const id of new Set(refs)) {
      if (!idSet.has(id)) errors.push(`${page}: ${file} usa ID ausente: ${id}`);
    }
  }
}

for (const file of fs.readdirSync(root).filter(name => name.endsWith(".css"))) {
  const css = read(file);
  if ((css.match(/{/g) || []).length !== (css.match(/}/g) || []).length) {
    errors.push(`${file}: chaves CSS desbalanceadas`);
  }
  for (const [, value] of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    if (/^(?:[a-z]+:|\/\/|data:|#)/i.test(value)) continue;
    const local = localPath(value);
    if (!local) continue;
    requiredDeployFiles.add(local);
    if (!fs.existsSync(path.resolve(root, local))) {
      errors.push(`${file}: recurso CSS ausente: ${local}`);
    }
  }
}

const workflow = read(".github/workflows/deploy.yml");
const deployedFiles = new Map();
for (const [, source, destination] of workflow.matchAll(/^\s*put\s+(\S+)\s+-o\s+(\S+)\s*$/gm)) {
  deployedFiles.set(source, destination);
  if (!fs.existsSync(path.resolve(root, source))) {
    errors.push(`deploy.yml: arquivo listado para publicação não existe: ${source}`);
  }
}
for (const file of requiredDeployFiles) {
  if (deployedFiles.get(file) !== file) {
    errors.push(`${file}: usado pelo site, mas não publicado em deploy.yml com o mesmo caminho`);
  }
}

for (const file of ["modular-fx.html", "modular-fx.css", "js/modular-fx.js", "js/compact-mode.js"]) {
  if (fs.existsSync(path.join(root, file))) errors.push(`Arquivo obsoleto ainda presente: ${file}`);
}

if (errors.length) {
  console.error("Validação falhou:\n- " + errors.join("\n- "));
  process.exitCode = 1;
} else {
  console.log("Validação concluída: sintaxe JS, IDs, referências locais, cobertura SFTP e limpeza do Modular FX OK.");
}
