const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "prototypes", "community");
const files = { "/": ["index.html", "text/html"], "/index.html": ["index.html", "text/html"], "/preview.css": ["preview.css", "text/css"], "/preview.js": ["preview.js", "text/javascript"] };
const port = Number(process.env.PREVIEW_PORT || 3100);
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const file = Object.hasOwn(files, pathname) ? files[pathname] : null;
  if (!file || !["GET", "HEAD"].includes(req.method)) { res.writeHead(404); res.end("Não encontrado"); return; }
  fs.readFile(path.join(root, file[0]), (error, content) => {
    if (error) { res.writeHead(500); res.end("Não foi possível abrir a prévia."); return; }
    res.writeHead(200, {
      "Content-Type": file[1] + "; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'none'; img-src 'self' data:; media-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    });
    res.end(req.method === "HEAD" ? undefined : content);
  });
});
server.listen(port, "127.0.0.1", () => console.log("Homologação local: http://127.0.0.1:" + server.address().port));
