"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { parse, parseFragment, serialize } = require("parse5");
const acorn = require("acorn");
const { html: htmlText, scripts: scriptText, errors: englishErrors } = require("./locales/en.json");

const siteOrigin = "https://nichodev.com";
const publicPages = {
  "/": "index.html",
  "/index.html": "index.html",
  "/voz.html": "voz.html",
  "/guitarra.html": "guitarra.html",
  "/mixmaster.html": "mixmaster.html",
  "/downloads.html": "downloads.html",
  "/onda/": "onda/index.html"
};
const communityPages = ["/comunidade/", "/comunidade/privacy.html", "/comunidade/rules.html"];
const toolPages = ["/comunidade/ferramentas/voz.html", "/comunidade/ferramentas/guitarra.html"];
const canonicalPages = [...Object.keys(publicPages).filter(route => route !== "/index.html"), ...communityPages];
const pagePaths = new Set([...canonicalPages, ...toolPages, "/index.html", "/comunidade", "/onda", "/onda/index.html", "/comunidade/index.html"]);

const siteScripts = [
  "/js/index.js", "/js/back-sound.js", "/js/voz.js", "/js/guitarra.js", "/js/mixmaster.js",
  "/js/mixmaster/project-store.js", "/js/mixmaster/project-model.js", "/js/mixmaster/project-backup.js",
  "/js/mixmaster/midi-synth.js", "/js/mixmaster/chip-lab.js"
];
const communityScripts = ["/comunidade/preview.js", "/comunidade/palette.js", "/comunidade/char.js", "/comunidade/admin.js"];
const bridgePath = "/community/tool-bridge.js";
const localizedScripts = new Set([...siteScripts, ...communityScripts, bridgePath]);
const english = route => "/en" + route;

function canonicalRoute(route) {
  if (route === "/index.html") return "/";
  if (route === "/comunidade/index.html" || route === "/comunidade") return "/comunidade/";
  if (route === "/onda/index.html" || route === "/onda") return "/onda/";
  return route;
}

function localizedUrl(value, base, isScript = false) {
  if (!value || /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(value)) return value;
  const url = new URL(value, siteOrigin + base);
  const local = isScript ? localizedScripts.has(url.pathname) : pagePaths.has(url.pathname);
  return (local ? english(canonicalRoute(url.pathname)) : url.pathname) + url.search + url.hash;
}

function translateText(value) {
  const key = value.trim().replace(/\s+/g, " ");
  if (!Object.hasOwn(htmlText, key)) return value;
  return value.replace(/\S(?:[\s\S]*\S)?/, () => htmlText[key]);
}

const textAttrs = new Set(["aria-label", "aria-description", "title", "placeholder", "alt", "aria-valuetext"]);
const metadata = new Set(["description", "og:title", "og:description", "og:image:alt", "twitter:title", "twitter:description", "twitter:image:alt"]);

function walkHtml(node, visit) {
  visit(node);
  if (["script", "style", "code", "textarea"].includes(node.tagName)) return;
  for (const child of node.childNodes || []) walkHtml(child, visit);
  if (node.content) walkHtml(node.content, visit);
}

function translateHtmlTree(root, route) {
  walkHtml(root, node => {
    if (node.nodeName === "#text") node.value = translateText(node.value);
    const attrs = node.attrs || [];
    const get = name => attrs.find(attr => attr.name === name)?.value;
    for (const attr of attrs) {
      if (textAttrs.has(attr.name) || (node.tagName === "meta" && attr.name === "content" && metadata.has(get("name") || get("property")))) {
        attr.value = translateText(attr.value);
      }
      if (node.tagName === "html" && attr.name === "lang") attr.value = "en";
      if (node.tagName === "meta" && attr.name === "content" && get("property") === "og:locale") attr.value = "en_US";
      if (node.tagName === "meta" && attr.name === "content" && get("property") === "og:url") {
        attr.value = siteOrigin + english(canonicalRoute(new URL(attr.value, siteOrigin).pathname));
      }
      if (attr.name === "href" && node.tagName === "link" && get("rel") === "canonical") {
        attr.value = siteOrigin + english(canonicalRoute(new URL(attr.value, siteOrigin).pathname));
      } else if (attr.name === "href" || attr.name === "src" || attr.name === "poster") {
        attr.value = localizedUrl(attr.value, route, node.tagName === "script");
      }
    }
  });
}

const escapeAttribute = value => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function renderLanguage(html, route, requestUrl, publicRelease = true, pwa = false) {
  const isEnglish = requestUrl.startsWith("/en/");
  const canonical = canonicalRoute(route);
  const root = isEnglish ? parse(html) : null;
  if (root) {
    translateHtmlTree(root, canonical);
    html = serialize(root);
  }
  const query = requestUrl.includes("?") ? requestUrl.slice(requestUrl.indexOf("?")) : "";
  const pt = escapeAttribute(canonical + query);
  const en = escapeAttribute(english(canonical) + query);
  const current = ' aria-current="true"';
  const app = pwa ? `
    <a href="${isEnglish ? "/en/comunidade/" : "/comunidade/"}">${isEnglish ? "Community" : "Comunidade"}</a>
    <a href="${isEnglish ? "/en/mixmaster.html" : "/mixmaster.html"}">MIXMASTER</a>
    <button type="button" class="pwa-install" aria-haspopup="dialog"><span aria-hidden="true">↓</span> ${isEnglish ? "Install app" : "Instalar app"}</button>` : "";
  const installHelp = pwa ? `<dialog class="pwa-dialog" aria-labelledby="pwa-install-title">
    <form method="dialog"><button class="pwa-close" aria-label="${isEnglish ? "Close installation instructions" : "Fechar instruções de instalação"}">×</button></form>
    <p class="pwa-kicker">NICHO//APP</p>
    <h2 id="pwa-install-title">${isEnglish ? "Install Nichodev" : "Instalar o Nichodev"}</h2>
    <p>${isEnglish ? "Community, NICO//CHAR and CHIP LAB, right from your Home Screen." : "Comunidade, NICO//CHAR e CHIP LAB direto da sua tela inicial."}</p>
    <button type="button" class="pwa-native" hidden>${isEnglish ? "Install now" : "Instalar agora"}</button>
    <div class="pwa-platforms" role="group" aria-label="${isEnglish ? "Choose your device" : "Escolha seu aparelho"}">
      <button type="button" data-pwa-platform="android" aria-pressed="false">Android</button>
      <button type="button" data-pwa-platform="ios" aria-pressed="false">iPhone / iPad</button>
      <button type="button" data-pwa-platform="desktop" aria-pressed="false">${isEnglish ? "Computer" : "Computador"}</button>
    </div>
    <section data-pwa-instructions="android" hidden>
      <h3>Android · Chrome</h3>
      <ol>${isEnglish ? `<li>Open this site in <strong>Chrome</strong>.</li><li>Tap the <strong>⋮</strong> menu, then <strong>Install and create shortcut → Install</strong>.</li><li>If you see <strong>Install app</strong> or <strong>Add to Home screen</strong>, choose that option and confirm.</li>` : `<li>Abra este site no <strong>Chrome</strong>.</li><li>Toque no menu <strong>⋮</strong> e escolha <strong>Instalar e criar atalho → Instalar</strong>.</li><li>Se aparecer <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>, escolha essa opção e confirme.</li>`}</ol>
    </section>
    <section data-pwa-instructions="ios" hidden>
      <h3>iPhone / iPad · Safari</h3>
      <ol>${isEnglish ? `<li>Open this site in <strong>Safari</strong>.</li><li>Tap <strong>Share ↑</strong>. Depending on your layout, open the page menu first.</li><li>Choose <strong>Add to Home Screen</strong>. If it is missing, find it under <strong>Edit Actions</strong>.</li><li>Turn on <strong>Open as Web App</strong> if offered, then tap <strong>Add</strong>.</li>` : `<li>Abra este site no <strong>Safari</strong>.</li><li>Toque em <strong>Compartilhar ↑</strong>. Dependendo do layout, abra primeiro o menu da página.</li><li>Escolha <strong>Adicionar à Tela de Início</strong>. Se não aparecer, procure em <strong>Editar Ações</strong>.</li><li>Ative <strong>Abrir como App da Web</strong>, se aparecer, e toque em <strong>Adicionar</strong>.</li>`}</ol>
    </section>
    <section data-pwa-instructions="desktop" hidden>
      <h3>${isEnglish ? "On your computer" : "No computador"}</h3>
      <ol>${isEnglish ? `<li>Open this site in <strong>Chrome or Edge</strong>.</li><li>Use the install icon in the address bar or the browser menu's <strong>Install app</strong> option.</li><li>Confirm and open <strong>Nichodev</strong> from your apps.</li>` : `<li>Abra este site no <strong>Chrome ou Edge</strong>.</li><li>Use o ícone de instalação na barra de endereço ou a opção <strong>Instalar app</strong> no menu do navegador.</li><li>Confirme e abra o <strong>Nichodev</strong> na lista de aplicativos.</li>`}</ol>
    </section>
    <p class="pwa-note">${isEnglish ? "Open the Nichodev icon and sign in with your existing account. An internet connection is required." : "Abra o ícone Nichodev e entre com sua conta do site. É preciso estar conectado à internet."}</p>
  </dialog>` : "";
  const navLabel = pwa ? (isEnglish ? "Language and app" : "Idioma e app") : (isEnglish ? "Site language" : "Idioma do site");
  const chooser = `<nav class="site-language" aria-label="${navLabel}"><a href="${pt}" lang="pt-BR" hreflang="pt-BR"${isEnglish ? "" : current}>Português</a><a href="${en}" lang="en" hreflang="en"${isEnglish ? current : ""}>English</a>${app}</nav>`;
  const alternates = publicRelease && canonicalPages.includes(canonical)
    ? `<link rel="alternate" hreflang="pt-BR" href="${siteOrigin + canonical}"><link rel="alternate" hreflang="en" href="${siteOrigin + english(canonical)}"><link rel="alternate" hreflang="x-default" href="${siteOrigin + canonical}">`
    : "";
  const install = pwa ? '<link rel="manifest" href="/nichodev.webmanifest"><link rel="apple-touch-icon" href="/assets/nichodev-192.png"><script src="/js/pwa.js?v=2" defer></script>' : "";
  return html.replace("</head>", `${alternates}${install}<link rel="stylesheet" href="/language.css?v=3"><script src="/js/language.js?v=2" defer></script></head>`)
    .replace(/<body\b[^>]*>/i, tag => tag + chooser + installHelp);
}

function scriptPhrase(value, catalog) {
  if (Object.hasOwn(catalog, value)) return catalog[value];
  if (!/^\s*<[a-z/]/i.test(value)) return value;
  // Update text in place because a template fragment can end inside an HTML tag.
  const fragment = parseFragment(value, { sourceCodeLocationInfo: true });
  const edits = [];
  walkHtml(fragment, node => {
    if (!node.sourceCodeLocation) return;
    if (node.nodeName === "#text") {
      const translated = translateText(node.value);
      if (translated !== node.value) edits.push({ ...node.sourceCodeLocation, text: escapeAttribute(translated) });
    }
    for (const attr of node.attrs || []) {
      if (!textAttrs.has(attr.name)) continue;
      const location = node.sourceCodeLocation.attrs?.[attr.name];
      const translated = translateText(attr.value);
      if (location && translated !== attr.value) edits.push({ ...location, text: attr.name + '="' + escapeAttribute(translated) + '"' });
    }
  });
  for (const { startOffset, endOffset, text } of edits.sort((a, b) => b.startOffset - a.startOffset)) {
    value = value.slice(0, startOffset) + text + value.slice(endOffset);
  }
  return value;
}

function translateScript(source, script) {
  const catalog = scriptText[script] || {};
  const edits = [];
  const tree = acorn.parse(source, { ecmaVersion: "latest", sourceType: "module" });
  function visit(node) {
    if (node.type === "Literal" && typeof node.value === "string") {
      const value = scriptPhrase(node.value, catalog);
      if (value !== node.value) edits.push([node.start, node.end, JSON.stringify(value)]);
      return;
    }
    if (node.type === "TemplateElement" && node.value.cooked !== null) {
      const translated = scriptPhrase(node.value.cooked, catalog);
      if (translated !== node.value.cooked) {
        const value = translated.replace(/[\\\x60]/g, "\\$&").replace(/\$\{/g, "\\\${");
        edits.push([node.start, node.end, value]);
      }
      return;
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) {
        for (const item of child) if (item?.type) visit(item);
      } else if (child?.type) visit(child);
    }
  }
  visit(tree);
  for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0])) {
    source = source.slice(0, start) + value + source.slice(end);
  }
  return source;
}

function installEnglishScripts(app, { siteDir, communityDir, bridgeFile }) {
  for (const script of localizedScripts) {
    const community = communityScripts.includes(script);
    if (!communityDir && (community || script === bridgePath)) continue;
    const file = community ? path.join(communityDir, path.basename(script)) :
      script === bridgePath ? bridgeFile : path.join(siteDir, script.slice(1));
    let translated;
    app.get(english(script), (req, res, next) => {
      try {
        translated ??= translateScript(fs.readFileSync(file, "utf8"), script);
        res.type("js").send(translated);
      } catch (error) { next(error); }
    });
  }
}

function translateError(message, language) {
  return language === "en" && Object.hasOwn(englishErrors, message) ? englishErrors[message] : message;
}

module.exports = { publicPages, communityPages, toolPages, canonicalPages, renderLanguage, english, installEnglishScripts, translateError };
