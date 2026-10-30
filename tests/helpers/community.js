const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const express = require("express");
const { createCommunityApp } = require("../../community/app");

const phrase = "uma frase de teste privada";
async function openCommunity(options={}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nichodev-community-test-"));
  const dbPath = path.join(directory, "test.sqlite");
  let siteDir=options.siteDir;
  if(options.publicRelease&&!siteDir){
    siteDir=path.join(directory,"site/public");
    await fs.cp(path.resolve(__dirname,"../../public"),siteDir,{recursive:true});
    require("../../scripts/route-public-html.cjs").routePublicHtml(path.dirname(siteDir));
  }
  let app, server, origin;
  async function start() {
    app = createCommunityApp({ passwordCheck:async()=>{},...options,...(siteDir?{siteDir}:{}), dbPath, origin: "http://127.0.0.1" });
    const gateway = express();
    // Match Hostinger: physical public files are served before the Node application.
    gateway.use(express.static(siteDir||path.resolve(__dirname,"../../public")));
    gateway.use(app);
    server = gateway.listen(0, "127.0.0.1");
    await once(server, "listening");
    origin = "http://127.0.0.1:" + server.address().port;
    app.locals.origin = origin;
  }
  async function stop() {
    const closed = new Promise(resolve => server.close(resolve));
    server.closeAllConnections();
    await closed;
    app.locals.close();
  }
  function client() {
    const cookies = new Map();
    return async (endpoint, { method = "GET", body, raw, headers = {} } = {}) => {
      const response = await fetch(origin + "/api/community" + endpoint, {
        method, headers: { Origin: origin, "X-Nichodev-Client": "1", Cookie: [...cookies].map(([k,v]) => k + "=" + v).join("; "), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(raw ? { "Content-Type": "audio/wav" } : {}), ...headers },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}), ...(raw ? { body: raw } : {})
      });
      for (const cookie of response.headers.getSetCookie()) { const [name, ...value] = cookie.split(";", 1)[0].split("="); cookies.set(name, value.join("=")); }
      const buffer = Buffer.from(await response.arrayBuffer());
      let data; try { data = JSON.parse(buffer); } catch { data = buffer; }
      return { status: response.status, headers: response.headers, data };
    };
  }
  await start();
  return {
    get app() { return app; }, get origin() { return origin; }, directory, dbPath, client,
    async restart() { await stop(); await start(); },
    async close() {
      await stop();
      if (path.dirname(path.resolve(directory)) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith("nichodev-community-test-")) throw new Error("Pasta de teste inesperada.");
      await fs.rm(directory, { recursive: true, force: true });
    }
  };
}
async function account(call, username) {
  const response = await call("/register", { method: "POST", body: { username, password: phrase } });
  if (response.status !== 201) throw new Error("Falha ao preparar conta de teste: " + response.status);
  const confirmed = await call("/register/confirm", { method: "POST", body: { saved: true } });
  if (confirmed.status !== 200) throw new Error("Falha ao confirmar conta de teste.");
  return { user: confirmed.data.user, key: response.data.recoveryKey };
}
module.exports = { openCommunity, account, phrase };
