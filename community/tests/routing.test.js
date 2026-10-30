const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),http=require("node:http");
const {routePublicHtml}=require("../../scripts/route-public-html.cjs");
const {publicPages}=require("../app");
const {openCommunity}=require("../../tests/helpers/community");
test("roteamento move somente cópias HTML idênticas, mantém fontes e dados e permite retorno",t=>{
  const site=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"nichodev-html-routing-"))),source=path.join(site,"source");t.after(()=>fs.rmSync(site,{recursive:true,force:true}));
  for(const dir of ["public_html","community-private","source/public"])fs.mkdirSync(path.join(site,dir),{recursive:true});
  fs.writeFileSync(path.join(site,"community-private/community.sqlite"),"preservar");
  const files=[...new Set(Object.values(publicPages))];
  for(const file of files)for(const root of [path.join(site,"public_html"),path.join(source,"public")]){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),"HTML "+file);}
  fs.writeFileSync(path.join(site,"public_html/site.css"),"preservar");
  for(const root of [path.join(site,"public_html"),path.join(source,"public")])fs.writeFileSync(path.join(root,"onda/onda.css"),"onda CSS");
  fs.writeFileSync(path.join(site,"public_html/voz.html"),"divergente");assert.throws(()=>routePublicHtml(site,source),/difere/);assert.ok(fs.existsSync(path.join(site,"public_html/index.html")));
  fs.copyFileSync(path.join(source,"public/voz.html"),path.join(site,"public_html/voz.html"));const result=routePublicHtml(site,source);assert.equal(result.moved,files.length);assert.equal(fs.existsSync(path.join(site,"public_html/onda")),false);assert.equal(fs.readFileSync(path.join(result.backup,"onda/onda.css"),"utf8"),"onda CSS");
  for(const file of files){assert.equal(fs.existsSync(path.join(site,"public_html",file)),false);assert.equal(fs.readFileSync(path.join(source,"public",file),"utf8"),"HTML "+file);fs.mkdirSync(path.dirname(path.join(site,"public_html",file)),{recursive:true});fs.copyFileSync(path.join(result.backup,file),path.join(site,"public_html",file));}
  assert.equal(fs.readFileSync(path.join(site,"community-private/community.sqlite"),"utf8"),"preservar");assert.equal(fs.readFileSync(path.join(site,"public_html/site.css"),"utf8"),"preservar");
});
test("páginas públicas pelo Node recebem nonce e www preserva caminho e consulta",async t=>{
  const f=await openCommunity({publicRelease:true});t.after(()=>f.close());
  for(const route of Object.keys(publicPages)){const r=await fetch(f.origin+route),body=await r.text();assert.equal(r.status,200);const nonce=r.headers.get("content-security-policy").match(/'nonce-([^']+)'/)[1];for(const script of body.matchAll(/<script\b([^>]*)>/g))assert.ok(script[1].includes('nonce="'+nonce+'"'));}
  const wave=await fetch(f.origin+"/onda?teste=1",{redirect:"manual"});assert.equal(wave.status,308);assert.equal(wave.headers.get("location"),"/onda/?teste=1");
  const response=await new Promise((resolve,reject)=>{http.get(f.origin+"/voz.html?teste=1",{headers:{host:"www.nichodev.com"}},res=>{res.resume();res.on("end",()=>resolve(res));}).on("error",reject);});
  assert.equal(response.statusCode,308);assert.equal(response.headers.location,"https://nichodev.com/voz.html?teste=1");
});
