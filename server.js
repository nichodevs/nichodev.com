
const express = require("express");
const path = require("node:path");
const fs = require("node:fs/promises");
const { publicPages, renderLanguage, english, installEnglishScripts } = require("./lib/site-language");

const app = express();
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Nichodevs',
    message: 'API conectada com sucesso!'
  });
});
const PORT = process.env.PORT || 3000;

const siteDir = path.join(__dirname, "public");
const pageDir = path.join(__dirname, "server-pages");
for (const route of ["/en", "/en/onda"]) {
  app.get(route, (req, res, next) => req.path === route ? res.redirect(308, route + "/" + req.originalUrl.slice(route.length)) : next());
}
for (const [route, file] of Object.entries(publicPages)) {
  app.get([route, english(route)], async (req, res) => {
    const html = await fs.readFile(path.join(pageDir, file), "utf8").catch(error => {
      if (error.code !== "ENOENT") throw error;
      return fs.readFile(path.join(siteDir, file), "utf8");
    });
    const isEnglish = req.path.startsWith("/en/");
    res.set("Content-Language", isEnglish ? "en" : "pt-BR");
    res.type("html").send(renderLanguage(html, route, req.originalUrl));
  });
}
installEnglishScripts(app, { siteDir });
app.use(express.static(pageDir));
app.use(express.static(siteDir));

app.get("/health", (req, res) => {
  res.json({ status: "ok", app: "Nichodevs" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Nichodevs rodando na porta ${PORT}`);
});
