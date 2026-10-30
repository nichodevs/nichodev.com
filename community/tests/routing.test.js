const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),http=require("node:http");
const {routePublicHtml}=require("../../scripts/route-public-html.cjs");
const {publicPages}=require("../app");
const {openCommunity}=require("../../tests/helpers/community");
test("roteamento preserva conteúdo e originais, recusa divergências e não altera o banco",t=>{
  const site=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"nichodev-html-routing-"))),source=path.join(site,"source");t.after(()=>{assert.equal(path.dirname(fs.realpathSync(site)),fs.realpathSync(os.tmpdir()));fs.rmSync(site,{recursive:true,force:true});});
  fs.mkdirSync(path.join(site,"community-private"));fs.mkdirSync(path.join(source,"public"),{recursive:true});
  fs.writeFileSync(path.join(site,"community-private/community.sqlite"),"preservar");const files=[...new Set(Object.values(publicPages))];
  for(const file of files){fs.mkdirSync(path.dirname(path.join(source,"public",file)),{recursive:true});fs.writeFileSync(path.join(source,"public",file),"HTML "+file);}
  fs.writeFileSync(path.join(source,"public/site.css"),"preservar");fs.writeFileSync(path.join(source,"public/onda/onda.css"),"onda CSS");
  const result=routePublicHtml(source);assert.equal(result.moved,files.length);assert.equal(fs.existsSync(path.join(source,"public/onda")),false);assert.equal(fs.readFileSync(path.join(result.pages,"onda/onda.css"),"utf8"),"onda CSS");
  assert.equal(routePublicHtml(source).moved,0);
  for(const file of files){assert.equal(fs.readFileSync(path.join(result.pages,file),"utf8"),"HTML "+file);assert.equal(fs.readFileSync(path.join(result.originals,file),"utf8"),"HTML "+file);}
  fs.renameSync(path.join(result.originals,"voz.html"),path.join(source,"public/voz.html"));fs.writeFileSync(path.join(result.pages,"voz.html"),"divergente");assert.throws(()=>routePublicHtml(source),/difere/);assert.equal(fs.readFileSync(path.join(source,"public/voz.html"),"utf8"),"HTML voz.html");
  fs.copyFileSync(path.join(source,"public/voz.html"),path.join(result.pages,"voz.html"));assert.equal(routePublicHtml(source).moved,1);
  assert.equal(fs.readFileSync(path.join(site,"community-private/community.sqlite"),"utf8"),"preservar");assert.equal(fs.readFileSync(path.join(source,"public/site.css"),"utf8"),"preservar");
});
test("páginas relocadas pelo Node recebem nonce e www preserva caminho e consulta",async t=>{
  const f=await openCommunity({publicRelease:true});t.after(()=>f.close());
  for(const route of Object.keys(publicPages)){const r=await fetch(f.origin+route),body=await r.text();assert.equal(r.status,200);const nonce=r.headers.get("content-security-policy").match(/'nonce-([^']+)'/)[1];for(const script of body.matchAll(/<script\b([^>]*)>/g))assert.ok(script[1].includes('nonce="'+nonce+'"'));}
  assert.equal((await fetch(f.origin+"/onda/onda.css")).status,200);assert.equal((await fetch(f.origin+"/server-pages/.originals/index.html")).status,404);
  const wave=await fetch(f.origin+"/onda?teste=1",{redirect:"manual"});assert.equal(wave.status,308);assert.equal(wave.headers.get("location"),"/onda/?teste=1");
  const response=await new Promise((resolve,reject)=>{http.get(f.origin+"/voz.html?teste=1",{headers:{host:"www.nichodev.com"}},res=>{res.resume();res.on("end",()=>resolve(res));}).on("error",reject);});
  assert.equal(response.statusCode,308);assert.equal(response.headers.location,"https://nichodev.com/voz.html?teste=1");
});
