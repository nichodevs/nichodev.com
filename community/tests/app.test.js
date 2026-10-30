const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { gzipSync } = require("node:zlib");
const { DatabaseSync, backup } = require("node:sqlite");
const path = require("node:path");
const { openCommunity, account, phrase } = require("../../tests/helpers/community");
const { initialPreset, validatePreset } = require("../preset-format");
const { validateWav } = require("../app");

async function fixture(t) { const f = await openCommunity(); t.after(() => f.close()); return f; }
const post = body => ({ method: "POST", body });
const preset = (extra = {}) => ({ kind: "preset", tool: "guitarra", title: "Timbre de teste", description: "Descrição privada", visibility: "private", preset: initialPreset("guitarra"), ...extra });
function wav(float = false) {
  const data = Buffer.alloc(float ? 48 : 46); data.write("RIFF");data.writeUInt32LE(data.length-8,4);data.write("WAVEfmt ",8);data.writeUInt32LE(16,16);data.writeUInt16LE(float?3:1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(8000,24);data.writeUInt32LE(float?32000:16000,28);data.writeUInt16LE(float?4:2,32);data.writeUInt16LE(float?32:16,34);data.write("data",36);data.writeUInt32LE(float?4:2,40);return data;
}

test("cadastro só ativa a conta após confirmar a chave, com hashes e cookie privado", async t => {
  const f = await fixture(t), call = f.client();
  let response = await call("/register", post({username:"Pessoa_123",password:phrase}));
  assert.equal(response.status,201);const key = response.data.recoveryKey;
  assert.ok(response.headers.get("set-cookie").includes("HttpOnly"));assert.ok(response.headers.get("set-cookie").includes("SameSite=Strict"));
  assert.equal((await call("/session")).data.user,null);
  assert.equal((await call("/register/confirm",post({saved:false}))).status,400);
  const stored = f.app.locals.db.prepare("SELECT * FROM users").get();
  assert.equal(stored.username,"pessoa_123");assert.equal(stored.active,0);assert.notEqual(stored.password,phrase);assert.notEqual(stored.recovery,key);
  assert.equal(stored.recovery,crypto.createHash("sha256").update(key).digest("hex"));
  assert.equal((await call("/register/confirm",post({saved:true}))).status,200);
  assert.equal((await call("/session")).data.user.username,"pessoa_123");
  assert.equal((await call("/register",post({username:"PESSOA_123",password:phrase}))).status,409);
  assert.equal((await call("/register",post({username:"xy",password:phrase}))).status,400);
  assert.equal((await call("/register",post({username:"nova",password:"curta"}))).status,400);
  assert.equal((await call("/register/confirm",post({saved:true}))).status,400);
});

test("cancelamento e expiração não deixam conta ou sessão utilizável", async t => {
  const f = await fixture(t),call=f.client();
  await call("/register",post({username:"cancelar",password:phrase}));
  assert.equal((await call("/register/cancel",post({}))).status,204);
  assert.equal(f.app.locals.db.prepare("SELECT COUNT(*) n FROM users").get().n,0);
  await call("/register",post({username:"expirada",password:phrase}));
  f.app.locals.db.exec("UPDATE users SET confirmation_expiry=0");
  assert.equal((await call("/register/confirm",post({saved:true}))).status,400);
  assert.equal((await call("/login",post({username:"expirada",password:phrase}))).status,401);
});

test("senha e chave erradas não entram; recuperação revoga sessões e troca a chave", async t => {
  const f=await fixture(t),owner=f.client(),other=f.client(),recover=f.client();
  const registered=await account(owner,"recuperar");
  assert.equal((await other("/login",post({username:"recuperar",password:phrase+"x"}))).status,401);
  assert.equal((await other("/login",post({username:"recuperar",password:phrase}))).status,200);
  assert.equal((await recover("/recover",post({username:"recuperar",recoveryKey:"incorreta",password:phrase+" nova"}))).status,400);
  const changed=await recover("/recover",post({username:"recuperar",recoveryKey:registered.key,password:phrase+" nova"}));
  assert.equal(changed.status,200);assert.notEqual(changed.data.recoveryKey,registered.key);
  for(const call of [owner,other,recover])assert.equal((await call("/session")).data.user,null);
  assert.equal((await recover("/recover",post({username:"recuperar",recoveryKey:registered.key,password:phrase}))).status,400);
  assert.equal((await owner("/login",post({username:"recuperar",password:phrase}))).status,401);
  assert.equal((await owner("/login",post({username:"recuperar",password:phrase+" nova"}))).status,200);
});

test("alterar senha exige a atual e invalida sessões; trocar chave exige senha", async t => {
  const f=await fixture(t),call=f.client(),other=f.client();await account(call,"senha");
  await account(other,"outro");
  assert.equal((await call("/password",post({current:phrase+"errada",password:phrase+" nova"}))).status,400);
  assert.equal((await call("/recovery-key",post({current:phrase+"errada"}))).status,400);
  assert.equal((await call("/recovery-key",post({current:phrase}))).status,200);
  assert.equal((await call("/password",post({current:phrase,password:phrase+" nova"}))).status,204);
  assert.equal((await call("/session")).data.user,null);
  assert.equal((await other("/session")).data.user.username,"outro");
  assert.equal((await call("/me")).status,401);
});

test("avaliações são persistentes e privadas; somente admin altera a situação", async t => {
  const f=await fixture(t),guest=f.client(),admin=f.client();await account(admin,"responsavel");
  const result=await guest("/feedback",post({tool:"voz",experience:"problema",comment:"<img src=x onerror=alert(1)>",contact:"retorno@example.com"}));
  assert.equal(result.status,201);
  assert.equal((await guest("/admin/feedback")).status,401);
  assert.equal((await admin("/admin/feedback")).status,403);
  f.app.locals.db.exec("UPDATE users SET admin=1");
  assert.equal((await admin("/admin/feedback")).data.items[0].id,result.data.id);
  assert.equal((await admin("/admin/feedback/"+result.data.id,{method:"PATCH",body:{status:"analise"}})).status,204);
  await f.restart();
  assert.equal((await admin("/admin/feedback")).data.items[0].status,"analise");
  const target=path.join(f.directory,"backup.sqlite");await backup(f.app.locals.db,target);
  const copy=new DatabaseSync(target);assert.equal(copy.prepare("SELECT COUNT(*) n FROM feedback").get().n,1);copy.close();
});

test("criações privadas têm dono; edições e exclusões recusam versões antigas", async t => {
  const f=await fixture(t),a=f.client(),b=f.client(),guest=f.client();await account(a,"autor");await account(b,"visitante");
  let result=await a("/creations",post(preset()));assert.equal(result.status,201);const id=result.data.item.id;
  assert.equal((await guest("/creations/"+id)).status,404);assert.equal((await b("/creations/"+id)).status,404);
  assert.equal((await b("/creations/"+id,{method:"PATCH",body:{version:1,title:"roubado"}})).status,403);
  assert.equal((await b("/creations/"+id,{method:"DELETE",body:{version:1}})).status,403);
  result=await a("/creations/"+id,{method:"PATCH",body:{version:1,title:"Novo título"}});assert.equal(result.status,200);assert.equal(result.data.item.version,2);
  assert.equal((await a("/creations/"+id,{method:"PATCH",body:{version:1,title:"antigo"}})).status,409);
  assert.equal((await a("/creations/"+id,{method:"DELETE",body:{version:1}})).status,409);
  assert.equal((await a("/creations/"+id,{method:"DELETE",body:{version:2}})).status,204);
  assert.equal((await a("/creations/"+id)).status,404);
});

test("galeria exige moderação e editar retira aprovação; links não listados são revogáveis", async t => {
  const f=await fixture(t),owner=f.client(),mod=f.client(),guest=f.client();await account(owner,"artista");await account(mod,"moderador");f.app.locals.db.exec("UPDATE users SET admin=1 WHERE username='moderador'");
  const {item}= (await owner("/creations",post(preset({visibility:"public"})))).data;
  assert.equal((await guest("/creations")).data.items.length,0);
  assert.equal((await guest("/creations/"+item.id)).status,404);
  assert.equal((await owner("/creations/"+item.id+"/share",post({}))).status,400);
  assert.equal((await mod("/admin/creations")).data.items.length,1);
  assert.equal((await mod("/admin/creations/"+item.id,{method:"PATCH",body:{status:"approved"}})).status,204);
  assert.equal((await guest("/creations")).data.items.length,1);
  const updated=await owner("/creations/"+item.id,{method:"PATCH",body:{version:2,visibility:"unlisted"}});assert.equal(updated.status,200);
  const one=await owner("/creations/"+item.id+"/share",post({})),key1=new URLSearchParams(one.data.url.split("?")[1]).get("key");
  assert.equal((await guest("/creations/"+item.id+"?key="+key1)).status,200);
  const two=await owner("/creations/"+item.id+"/share",post({})),key2=new URLSearchParams(two.data.url.split("?")[1]).get("key");assert.notEqual(key1,key2);
  assert.equal((await guest("/creations/"+item.id+"?key="+key1)).status,404);
  assert.equal((await guest("/creations/"+item.id+"?key="+key2)).status,200);
  await owner("/creations/"+item.id,{method:"PATCH",body:{version:3,visibility:"private"}});
  assert.equal((await guest("/creations/"+item.id+"?key="+key2)).status,404);
});

test("áudio exige autenticação, WAV válido, propriedade e autorização de leitura", async t => {
  const f=await fixture(t),a=f.client(),b=f.client(),guest=f.client();await account(a,"musico");await account(b,"ouvinte");
  assert.equal((await guest("/media",{method:"POST",raw:wav()})).status,401);
  assert.equal((await a("/media",{method:"POST",raw:Buffer.from("arquivo falso")})).status,400);
  const uploaded=await a("/media",{method:"POST",raw:wav()});assert.equal(uploaded.status,201);const mediaId=uploaded.data.id;
  assert.equal((await a("/media/"+mediaId)).status,200);assert.equal((await b("/media/"+mediaId)).status,404);
  assert.equal((await b("/creations",post(preset({kind:"audio",tool:"mixmaster",preset:null,mediaId})))).status,400);
  const saved=await a("/creations",post(preset({kind:"audio",tool:"mixmaster",preset:null,mediaId})));assert.equal(saved.status,201);
  assert.equal((await guest("/media/"+mediaId)).status,404);
  await a("/creations/"+saved.data.item.id,{method:"DELETE",body:{version:1}});
  assert.equal((await a("/media/"+mediaId)).status,404);
});

test("fronteiras rejeitam origem externa, corpos inválidos, compressão e abuso", async t => {
  const f=await fixture(t),call=f.client(),body={tool:"site",experience:"bem"};
  assert.equal((await call("/feedback",{...post(body),headers:{Origin:"https://intruso.example"}})).status,403);
  assert.equal((await call("/feedback",{method:"POST",raw:Buffer.from("{}"),headers:{"Content-Type":"text/plain"}})).status,400);
  assert.equal((await call("/feedback",{method:"POST",raw:gzipSync(Buffer.from(JSON.stringify(body))),headers:{"Content-Type":"application/json","Content-Encoding":"gzip"}})).status,415);
  assert.equal((await call("/feedback",post({tool:"invalida",experience:"bem"}))).status,400);
  for(let n=0;n<9;n++)assert.equal((await call("/feedback",post(body))).status,201);
  const limited=await call("/feedback",post(body));assert.equal(limited.status,429);assert.ok(limited.headers.get("retry-after"));
  assert.equal((await fetch(f.origin+"/community.sqlite")).status,404);
  assert.equal((await fetch(f.origin+"/community/app.js")).status,404);
  assert.ok((await call("/session")).headers.get("content-security-policy").includes("frame-ancestors 'none'"));
});

test("presets completos são limitados ao formato e aos parâmetros das ferramentas", () => {
  for(const tool of ["voz","guitarra"]){const value=initialPreset(tool);assert.deepEqual(validatePreset(value),value);delete value.data.enabled[Object.keys(value.data.enabled)[0]];assert.throws(()=>validatePreset(value));}
  for(const change of [p=>p.data.order.push("ns2"),p=>p.data.values.dd8=NaN,p=>p.data.gain=101,p=>p.extra=true,p=>p.version=2]){const p=initialPreset("guitarra");change(p);assert.throws(()=>validatePreset(p));}
});

test("parser WAV rejeita cabeçalhos, caudas e amostras não finitas sem limitar float32",()=>{
  validateWav(wav());const float=wav(true);float.writeFloatLE(1.6,44);validateWav(float);
  float.writeFloatLE(NaN,44);assert.throws(()=>validateWav(float));
  const tail=Buffer.concat([wav(),Buffer.from([1])]);tail.writeUInt32LE(tail.length-8,4);assert.throws(()=>validateWav(tail));
  const invalid=wav();invalid.writeUInt32LE(0xffffffff,40);assert.throws(()=>validateWav(invalid));
});
