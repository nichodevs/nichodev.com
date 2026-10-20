"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const pages = ["index.html", "voz.html", "guitarra.html", "mixmaster.html", "easter-egg/onda/index.html"];
const errors = [];
const requiredDeployFiles = new Set(pages);
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const localPath = value => decodeURIComponent(value.split(/[?#]/, 1)[0]);
const resolveLocal = (fromFile, value) => {
  const clean = localPath(value).replace(/^\/+/, "").replace(/\\/g, "/");
  const relative = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), clean));
  return { relative, absolute: path.resolve(root, ...relative.split("/")) };
};
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
      const resolved = resolveLocal(page, value);
      if (!resolved.relative || resolved.relative.startsWith("../")) {
        errors.push(`${page}: caminho local fora do projeto: ${value}`);
        continue;
      }
      let deployPath = resolved.relative;
      if (fs.existsSync(resolved.absolute) && fs.statSync(resolved.absolute).isDirectory()) {
        deployPath = path.posix.join(deployPath, "index.html");
      }
      requiredDeployFiles.add(deployPath);
      if (!fs.existsSync(resolved.absolute)) {
        errors.push(`${page}: arquivo local ausente: ${resolved.relative}`);
      }
    }
  }

  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)]
    .map(match => match[1])
    .filter(src => !/^(?:[a-z]+:|\/\/)/i.test(src));
  for (const src of scripts) {
    const resolved = resolveLocal(page, src);
    const file = resolved.relative;
    const syntax = spawnSync(process.execPath, ["--check", path.join(root, ...file.split("/"))], { encoding: "utf8" });
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

const cssFiles = [];
function collectCss(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectCss(absolute);
    else if (entry.isFile() && entry.name.endsWith(".css")) {
      cssFiles.push(path.relative(root, absolute).split(path.sep).join("/"));
    }
  }
}
collectCss(root);

for (const file of cssFiles) {
  const css = read(file);
  if ((css.match(/{/g) || []).length !== (css.match(/}/g) || []).length) {
    errors.push(`${file}: chaves CSS desbalanceadas`);
  }
  for (const [, value] of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    if (/^(?:[a-z]+:|\/\/|data:|#)/i.test(value)) continue;
    const resolved = resolveLocal(file, value);
    if (!resolved.relative || resolved.relative.startsWith("../")) {
      errors.push(`${file}: recurso CSS fora do projeto: ${value}`);
      continue;
    }
    requiredDeployFiles.add(resolved.relative);
    if (!fs.existsSync(resolved.absolute)) {
      errors.push(`${file}: recurso CSS ausente: ${resolved.relative}`);
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
