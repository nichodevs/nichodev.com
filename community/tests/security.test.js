const {test}=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const {execFile}=require("node:child_process"),{promisify}=require("node:util"),{DatabaseSync}=require("node:sqlite");
const execute=promisify(execFile),{openStore}=require("../store"),{security,checkNewPassword,byteRange}=require("../security");
const {openCommunity,account,phrase}=require("../../tests/helpers/community"),{wav}=require("../../tests/helpers/audio");
const post=body=>({method:"POST",body});

test("limites sobrevivem reinícios e são atômicos entre quatro processos",async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"nichodev-security-")),file=path.join(dir,"db.sqlite");
 try{
  let db=openStore(file);security(db).consume(["persistente"],1);db.close();
  db=openStore(file);assert.throws(()=>security(db).consume(["persistente"],1),e=>e.status===429);db.close();
  const worker=`const {openStore}=require('./community/store'),{security}=require('./community/security');const db=openStore(process.argv[1]),guard=security(db);let accepted=0;for(let i=0;i<8;i++){try{guard.consume(['parallel'],10);accepted++;}catch(e){if(e.status!==429)throw e;}}db.close();console.log(accepted);`;
  const results=await Promise.all(Array.from({length:4},()=>execute(process.execPath,["-e",worker,file],{cwd:path.resolve(__dirname,"../..")})));
  assert.equal(results.reduce((n,r)=>n+Number(r.stdout.trim()),0),10);
 }finally{assert.equal(path.dirname(dir),os.tmpdir());fs.rmSync(dir,{recursive:true,force:true});}
});

test("migração preserva sessões antigas e reservas limitam workers e expiram após falha",()=>{
 const db=new DatabaseSync(":memory:");db.close();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"nichodev-migration-")),file=path.join(dir,"old.sqlite");
 try{
  const old=new DatabaseSync(file);old.exec("CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id TEXT,expires INTEGER) STRICT; INSERT INTO sessions VALUES('old','owner',9999999999999)");old.close();
  const migrated=openStore(file),guard=security(migrated),other=security(migrated);
  assert.deepEqual({...migrated.prepare("SELECT * FROM sessions").get()},{token:"old",user_id:"owner",expires:9999999999999});
  const release=guard.reserve([[["auth"],1]]);assert.throws(()=>other.reserve([[["auth"],1]]),e=>e.status===503);
  release();release();const stale=other.reserve([[["auth"],1]]);migrated.exec("UPDATE security_leases SET expires=0");const active=guard.reserve([[["auth"],1]]);stale();assert.equal(migrated.prepare("SELECT COUNT(*) n FROM security_leases").get().n,1);active();migrated.close();
 }finally{assert.equal(path.dirname(dir),os.tmpdir());fs.rmSync(dir,{recursive:true,force:true});}
});

test("senhas comprometidas enviam somente prefixo e a consulta falha fechada",async()=>{
 const value="Uma frase exclusiva para este teste 9832",hash=crypto.createHash("sha1").update(value).digest("hex").toUpperCase();let calls=0;
 const lookup=async(url,options)=>{calls++;assert.equal(url,"https://api.pwnedpasswords.com/range/"+hash.slice(0,5));assert.ok(!url.includes(value));assert.equal(options.headers["Add-Padding"],"true");return new Response(hash.slice(5)+":3\r\n"+"A".repeat(35)+":0");};
 await assert.rejects(checkNewPassword(value,lookup),e=>e.status===400);assert.equal(calls,1);
 await checkNewPassword(value,async()=>new Response(hash.slice(5)+":0"));
 for(const response of [new Response("bad"),new Response("",{status:503})])await assert.rejects(checkNewPassword(value,async()=>response),e=>e.status===503);
 await assert.rejects(checkNewPassword(value,async()=>{throw Error("timeout");}),e=>e.status===503);
 await assert.rejects(checkNewPassword("passwordpasswordpassword",async()=>{throw Error("Não consultar senha trivial");}),e=>e.status===400);
});

test("limite de conta-alvo resiste a IPs diferentes e expira sem bloqueio permanente",async t=>{
 const f=await openCommunity({trustedProxy:"loopback"});t.after(()=>f.close());const client=f.client();await account(client,"alvo");const guard=security(f.app.locals.db);
 guard.consume(["account","alvo","login"],30,60000,30);
 for(const ip of ["192.0.2.1","192.0.2.2"]){const r=await client("/login",{...post({username:"alvo",password:phrase}),headers:{"X-Forwarded-For":ip}});assert.equal(r.status,429);assert.ok(Number(r.headers.get("retry-after"))<=60);}
 f.app.locals.db.exec("UPDATE limits SET expires=0");assert.equal((await client("/login",post({username:"alvo",password:phrase}))).status,200);
 guard.consume(["account","alvo","recover"],10,60000,10);assert.equal((await client("/recover",post({username:"alvo",recoveryKey:"errada",password:phrase}))).status,429);
});

test("orçamento global e reservas de autenticação bloqueiam antes do hash; usuário tem limite próprio",async t=>{
 const f=await openCommunity({trustedProxy:"loopback"});t.after(()=>f.close());const client=f.client();await account(client,"limites");const guard=security(f.app.locals.db);
 const release=guard.reserve([[["global","auth-work"],2]]),release2=guard.reserve([[["global","auth-work"],2]]);
 assert.equal((await client("/login",post({username:"limites",password:phrase}))).status,503);release();release2();
 assert.equal((await client("/login",post({username:"limites",password:phrase}))).status,200);
 for(let i=0;i<5;i++)assert.equal((await client("/account/export",{headers:{"X-Forwarded-For":"192.0.2."+(i+1)}})).status,200);
 assert.equal((await client("/account/export",{headers:{"X-Forwarded-For":"192.0.2.99"}})).status,429);
 f.app.locals.db.exec("DELETE FROM limits");guard.consume(["global","auth-work"],60,60000,60);assert.equal((await client("/login",post({username:"limites",password:phrase}))).status,429);
});

test("admin exige senha recente, não promove membro e não dispensa prova em sessão antiga",async t=>{
 const f=await openCommunity();t.after(()=>f.close());const client=f.client(),member=f.client();await account(client,"responsavel");await account(member,"membro");f.app.locals.db.exec("UPDATE users SET admin=1 WHERE username='responsavel'; UPDATE session_auth SET authenticated=0");
 assert.equal((await client("/admin/feedback")).data.code,"ADMIN_REAUTH_REQUIRED");
 assert.equal((await member("/admin/reauth",post({current:phrase}))).status,403);
 assert.equal((await client("/admin/reauth",post({current:phrase+"errada"}))).status,400);
 assert.equal((await client("/admin/reauth",post({current:phrase}))).status,204);
 assert.equal((await client("/admin/feedback")).status,200);
 f.app.locals.db.exec("UPDATE session_auth SET authenticated=authenticated-600001");assert.equal((await client("/admin/creations")).data.code,"ADMIN_REAUTH_REQUIRED");
});

test("Range, HEAD e bytes limitados não leem mídia privada nem carregam o BLOB completo",async t=>{
 const f=await openCommunity();t.after(()=>f.close());const owner=f.client(),guest=f.client();await account(owner,"audio");const bytes=wav(.01,440),upload=await owner("/media",{method:"POST",raw:bytes}),id=upload.data.id;
 assert.equal((await guest("/media/"+id,{method:"HEAD"})).status,404);
 let blobReads=0;const original=f.app.locals.db.prepare.bind(f.app.locals.db);
 t.mock.method(f.app.locals.db,"prepare",sql=>{if(sql.includes("substr(audio")){blobReads++;assert.ok(sql.includes("substr(audio,?,?)"));}assert.ok(!sql.includes("SELECT audio FROM media"));return original(sql);});
 const head=await owner("/media/"+id,{method:"HEAD",headers:{Range:"bytes=0-3"}});assert.equal(head.status,200);assert.equal(Number(head.headers.get("content-length")),bytes.length);assert.equal(blobReads,0);
 const partial=await owner("/media/"+id,{headers:{Range:"bytes=0-3"}});assert.equal(partial.status,206);assert.deepEqual(partial.data,bytes.subarray(0,4));assert.equal(partial.headers.get("content-range"),"bytes 0-3/"+bytes.length);
 assert.equal((await owner("/media/"+id,{headers:{Range:"bytes=999999-"}})).status,416);
 const guard=security(f.app.locals.db);f.app.locals.db.exec("DELETE FROM limits");guard.consume(["ip","127.0.0.1","media-bytes"],32*1024*1024,60000,32*1024*1024);const before=blobReads;
 assert.equal((await owner("/media/"+id)).status,429);assert.equal(blobReads,before);assert.equal(original("SELECT COUNT(*) n FROM security_leases").get().n,0);
});

test("Range valida sufixos, múltiplos intervalos e limites numéricos",()=>{
 assert.deepEqual(byteRange("bytes=-4",10),{start:6,end:9,partial:true});assert.deepEqual(byteRange("bytes=4-99",10),{start:4,end:9,partial:true});assert.deepEqual(byteRange("bytes=4-",10),{start:4,end:9,partial:true});
 for(const value of ["bytes=-0","bytes=-","bytes=10-","bytes=3-2","bytes=1-2,4-5","bytes=999999999999999999999-","other"])assert.equal(byteRange(value,10),null);
});

test("HSTS só é emitido no ambiente HTTPS",async t=>{
 const secure=await openCommunity({secure:true}),local=await openCommunity();t.after(()=>secure.close());t.after(()=>local.close());
 assert.equal((await fetch(secure.origin+"/health")).headers.get("strict-transport-security"),"max-age=31536000");assert.equal((await fetch(local.origin+"/health")).headers.get("strict-transport-security"),null);
});

test("falha na verificação de nova senha preserva conta, chave e login existentes",async t=>{
 let available=true;const f=await openCommunity({passwordCheck:async()=>{if(!available)throw Object.assign(new Error("Verificação indisponível"),{status:503});}});t.after(()=>f.close());
 const client=f.client(),{key}=await account(client,"existente");available=false;const before={...f.app.locals.db.prepare("SELECT password,recovery FROM users").get()};
 assert.equal((await client("/register",post({username:"nova",password:phrase}))).status,503);
 assert.equal((await client("/password",post({current:phrase,password:phrase+" nova"}))).status,503);
 assert.equal((await client("/recover",post({username:"existente",recoveryKey:key,password:phrase+" nova"}))).status,503);
 assert.deepEqual({...f.app.locals.db.prepare("SELECT password,recovery FROM users").get()},before);
 assert.equal((await client("/login",post({username:"existente",password:phrase}))).status,200);
 assert.equal(f.app.locals.db.prepare("SELECT COUNT(*) n FROM users").get().n,1);
});

test("mídia recusa concorrência e orçamento global, liberando reservas depois da resposta",async t=>{
 const f=await openCommunity();t.after(()=>f.close());const client=f.client();await account(client,"concorrencia");const uploaded=await client("/media",{method:"POST",raw:wav(.01,440)}),route="/media/"+uploaded.data.id,guard=security(f.app.locals.db);
 const release=guard.reserve([[["ip","127.0.0.1","media-transfer"],2]]),release2=guard.reserve([[["ip","127.0.0.1","media-transfer"],2]]);
 assert.equal((await client(route)).status,503);assert.equal((await client(route,{method:"HEAD"})).status,200);release();release2();
 assert.equal((await client(route)).status,200);assert.equal(f.app.locals.db.prepare("SELECT COUNT(*) n FROM security_leases").get().n,0);
 f.app.locals.db.exec("DELETE FROM limits");guard.consume(["global","media-bytes"],128*1024*1024,60000,128*1024*1024);assert.equal((await client(route)).status,429);
});
