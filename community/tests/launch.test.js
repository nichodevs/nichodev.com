const {test}=require("node:test"),assert=require("node:assert/strict");
const {openCommunity,account,phrase}=require("../../tests/helpers/community");
const {initialPreset}=require("../preset-format");
const post=body=>({method:"POST",body});
test("exportação não revela segredos e exclusão remove somente dados do titular e revoga sessões",async t=>{
 const f=await openCommunity();t.after(()=>f.close());const a=f.client(),b=f.client(),otherSession=f.client(),guest=f.client();
 await account(a,"excluir");await account(b,"preservar");await otherSession("/login",post({username:"excluir",password:phrase}));
 const created=await a("/creations",post({kind:"preset",tool:"guitarra",title:"Meu timbre",description:"Teste",visibility:"public",preset:initialPreset("guitarra")}));
 f.app.locals.db.exec("UPDATE creations SET status='approved'");await b("/creations/"+created.data.item.id+"/favorite",post({enabled:true}));
 const upload=await a("/media",{method:"POST",raw:require("../../tests/helpers/audio").wav(1,440)});assert.equal(upload.status,201);
 await a("/creations",post({kind:"audio",tool:"voz",title:"Meu áudio",description:"Teste privado",visibility:"private",mediaId:upload.data.id}));
 assert.equal((await guest("/account/export")).status,401);
 const exported=await a("/account/export");assert.equal(exported.status,200);assert.equal(exported.data.account.username,"excluir");assert.equal(exported.data.creations.length,2);assert.equal(exported.data.audio.length,1);
 assert.doesNotMatch(JSON.stringify(exported.data),/password|recovery|share_hash|token/);
 assert.equal((await a("/account",{method:"DELETE",body:{confirm:"errado",password:phrase}})).status,400);
 assert.equal((await a("/account",{method:"DELETE",body:{confirm:"excluir",password:phrase+"errada"}})).status,400);
 assert.equal((await a("/account",{method:"DELETE",body:{confirm:"excluir",password:phrase}})).status,204);
 assert.equal((await otherSession("/session")).data.user,null);
 assert.equal((await b("/me")).data.favorites.length,0);assert.equal((await b("/session")).data.user.username,"preservar");
 assert.equal(f.app.locals.db.prepare("SELECT COUNT(*) n FROM users").get().n,1);
 assert.equal(f.app.locals.db.prepare("SELECT COUNT(*) n FROM media").get().n,0);
 assert.equal(f.app.locals.db.prepare("PRAGMA foreign_key_check").all().length,0);
});
test("último administrador não pode apagar a conta sem sucessor",async t=>{
 const f=await openCommunity();t.after(()=>f.close());const a=f.client();await account(a,"responsavel");f.app.locals.db.exec("UPDATE users SET admin=1");
 assert.equal((await a("/account",{method:"DELETE",body:{confirm:"responsavel",password:phrase}})).status,409);
});
test("produção altera apresentação e indexação sem remover proteção das APIs",async t=>{
 const f=await openCommunity({publicRelease:true});t.after(()=>f.close());
 let r=await fetch(f.origin+"/comunidade/");const html=await r.text();assert.equal(r.status,200);assert.equal(r.headers.get("x-robots-tag"),null);assert.doesNotMatch(html,/HOMOLOGAÇÃO|ambiente de homologação/);assert.match(html,/index,follow/);assert.match(html,/https:\/\/nichodev.com\/comunidade\//);
 r=await fetch(f.origin+"/api/community/session");assert.equal((await r.json()).publicRelease,true);assert.match(r.headers.get("x-robots-tag"),/noindex/);
 for(const page of ["privacy.html","rules.html"]){r=await fetch(f.origin+"/comunidade/"+page);assert.equal(r.status,200);assert.match(await r.text(),/development@nichodev.com/);}
 const redirect=await new Promise((resolve,reject)=>{require("node:http").get(f.origin+"/comunidade/?from=www",{headers:{Host:"www.nichodev.com"}},response=>{response.resume();resolve(response);}).on("error",reject);});assert.equal(redirect.statusCode,308);assert.equal(redirect.headers.location,"https://nichodev.com/comunidade/?from=www");
});
test("convite do primeiro administrador não permite cadastrar outros usuários ou sem convite",async t=>{
 const f=await openCommunity({bootstrapToken:"convite-privado",bootstrapUser:"nichodevadm"});t.after(()=>f.close());const call=f.client();
 assert.equal((await call("/register",post({username:"nichodevadm",password:phrase}))).status,403);
 assert.equal((await call("/register",{...post({username:"outro",password:phrase}),headers:{"X-Nichodev-Bootstrap":"convite-privado"}})).status,403);
 assert.equal((await call("/register",{...post({username:"nichodevadm",password:phrase}),headers:{"X-Nichodev-Bootstrap":"convite-privado"}})).status,201);
 assert.equal((await call("/admin/feedback")).status,401);
 const confirmed=await call("/register/confirm",post({saved:true}));assert.equal(confirmed.status,200);assert.equal(confirmed.data.user.admin,true);
 assert.equal((await call("/admin/feedback")).status,200);
});
test("diagnóstico de proxy não fica público e unix não confia em conexões TCP diretas",async t=>{
 const f=await openCommunity({probeToken:"privado",trustedProxy:"unix"});t.after(()=>f.close());
 assert.equal((await fetch(f.origin+"/api/community/operations/proxy")).status,404);
 const r=await fetch(f.origin+"/api/community/operations/proxy",{headers:{"X-Nichodev-Probe":"privado","X-Forwarded-For":"198.51.100.7"}});const data=await r.json();assert.equal(r.status,200);assert.notEqual(data.selectedIP,"198.51.100.7");
});
