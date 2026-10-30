const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {DatabaseSync} = require("node:sqlite");
let stage="paths";
const checks={};

const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const quote = name => '"'+name.replaceAll('"','""')+'"';
async function fileSha(filename) {
  const hash=crypto.createHash("sha256");
  for await(const chunk of fs.createReadStream(filename))hash.update(chunk);
  return hash.digest("hex");
}

function inspect(db) {
  assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check,"ok");
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length,0);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const counts = {},hash = crypto.createHash("sha256");
  for(const {name} of tables) {
    counts[name]=0;hash.update(name);
    for(const row of db.prepare("SELECT * FROM "+quote(name)+" ORDER BY rowid").iterate()) {
      counts[name]++;
      for(const value of Object.values(row)) {
        const bytes=value instanceof Uint8Array?Buffer.from(value):Buffer.from(JSON.stringify(value));
        hash.update(String(bytes.length)+":");hash.update(bytes);
      }
    }
  }
  for(const table of ["users","sessions","feedback","media","creations","favorites","limits"])assert.ok(table in counts,"Tabela ausente: "+table);
  return {counts,digest:hash.digest("hex")};
}

async function main() {
  assert.ok(process.argv[2],"Informe a pasta do site, absoluta ou relativa ao diretório do usuário.");
  const site=fs.realpathSync(path.resolve(os.homedir(),process.argv[2]));
  const privateDir=fs.realpathSync(path.join(site,"community-private"));
  const source=path.join(privateDir,"latest.sqlite");
  stage="source";
  assert.ok(fs.lstatSync(source).isFile(),"O backup deve ser um arquivo regular.");
  assert.ok(!fs.existsSync(source+"-wal")||fs.statSync(source+"-wal").size===0,"O backup precisa ser um SQLite independente.");
  const originalHash=await fileSha(source);
  const dir=fs.mkdtempSync(path.join(privateDir,"restore-check-"));
  fs.chmodSync(dir,0o700);
  const snapshot=path.join(dir,"snapshot.sqlite"),restored=path.join(dir,"community.sqlite");
  let reference,db,app,server,result;
  try {
    stage="copy";
    fs.copyFileSync(source,snapshot);fs.chmodSync(snapshot,0o600);
    fs.copyFileSync(snapshot,restored);fs.chmodSync(restored,0o600);
    assert.equal(await fileSha(snapshot),originalHash,"O backup mudou durante a cópia; repita o teste.");
    stage="integrity-and-records";
    reference=new DatabaseSync(snapshot,{readOnly:true});
    db=new DatabaseSync(restored);
    const expected=inspect(reference);
    assert.deepEqual(inspect(db),expected,"Os registros ou bytes de áudio diferem do backup.");
    checks.integrityAndRecords=true;
    reference.close();reference=null;db.close();db=null;

    stage="application-start";
    const {createCommunityApp,validateWav}=require(path.join(site,"hbuilds/current/nodejs/community/app.js"));
    app=createCommunityApp({dbPath:restored,origin:"http://127.0.0.1"});
    server=await new Promise((resolve,reject)=>{const listener=app.listen(0,"127.0.0.1",()=>resolve(listener));listener.once("error",reject);});
    const address=server.address();
    assert.equal(address.address,"127.0.0.1","O verificador deve escutar somente no loopback.");
    checks.loopbackPort=address.port;
    const origin="http://127.0.0.1:"+address.port;
    app.locals.origin=origin;db=app.locals.db;
    const request=(route,options={})=>fetch(origin+route,{...options,signal:AbortSignal.timeout(10000)});
    stage="health-route";
    assert.equal((await request("/health")).status,200);
    stage="interface-route";
    assert.equal((await request("/comunidade/")).status,200);
    stage="anonymous-permissions";
    assert.equal((await request("/api/community/admin/feedback")).status,401);
    let verifiedMedia=0,verifiedCreations=0;
    const users=db.prepare("SELECT id,admin FROM users WHERE active=1").all();
    assert.ok(users.length,"Não há contas ativas para validar nesta cópia.");
    for(const user of users) {
      stage="accounts-and-permissions";
      // Sessões descartáveis existem somente na cópia, sem alterar senhas recuperadas.
      const token=crypto.randomBytes(32).toString("base64url"),cookie="nichodev_local="+token;
      db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(sha(token),user.id,Date.now()+60000);
      const headers={cookie};
      const session=await request("/api/community/session",{headers});
      assert.deepEqual((await session.json()).user,{id:user.id,username:db.prepare("SELECT username FROM users WHERE id=?").get(user.id).username,admin:Boolean(user.admin)});
      assert.equal((await request("/api/community/me",{headers})).status,200);
      assert.equal((await request("/api/community/admin/feedback",{headers})).status,user.admin?200:403);
      for(const row of db.prepare("SELECT id,preset,visibility FROM creations WHERE owner=?").all(user.id)) {
        stage="creations";
        const response=await request("/api/community/creations/"+encodeURIComponent(row.id),{headers});
        assert.equal(response.status,200);
        assert.deepEqual((await response.json()).item.preset,row.preset?JSON.parse(row.preset):null);
        if(row.visibility==="private")assert.equal((await request("/api/community/creations/"+encodeURIComponent(row.id))).status,404);
        verifiedCreations++;
      }
      for(const row of db.prepare("SELECT id,audio FROM media WHERE owner=?").iterate(user.id)) {
        stage="audio";
        const response=await request("/api/community/media/"+encodeURIComponent(row.id),{headers});
        assert.equal(response.status,200);
        const bytes=Buffer.from(await response.arrayBuffer());
        validateWav(bytes);assert.equal(sha(bytes),sha(row.audio));verifiedMedia++;
        if(!db.prepare("SELECT id FROM creations WHERE media_id=? AND visibility='public' AND status='approved'").get(row.id))assert.equal((await request("/api/community/media/"+encodeURIComponent(row.id))).status,404);
      }
    }
    stage="disposable-write";
    const written=await request("/api/community/feedback",{method:"POST",headers:{"content-type":"application/json",origin,"x-nichodev-client":"1"},body:JSON.stringify({tool:"site",experience:"bem",comment:"Teste descartável de restauração"})});
    assert.equal(written.status,201);
    const id=(await written.json()).id;
    assert.ok(db.prepare("SELECT id FROM feedback WHERE id=?").get(id));
    result={status:"ok",counts:expected.counts,accounts:users.length,creations:verifiedCreations,audio:verifiedMedia,integrity:true,foreignKeys:true,allRowsAndAudioIdentical:true,applicationReadWrite:true,privateAccess:true,loopbackOnly:true};
  } finally {
    const previousStage=stage;stage="cleanup";
    if(server)await new Promise(resolve=>server.close(resolve));
    if(app){app.locals.close();db=null;}
    if(db)db.close();if(reference)reference.close();
    assert.equal(path.dirname(fs.realpathSync(dir)),privateDir);
    fs.rmSync(dir,{recursive:true,force:true});
    checks.isolatedCopyRemoved=!fs.existsSync(dir);
    assert.equal(await fileSha(source),originalHash,"O arquivo de backup mudou durante o teste.");
    checks.backupUnchanged=true;
    stage=previousStage;
  }
  console.log(JSON.stringify({...result,backupUnchanged:true,isolatedCopyRemoved:!fs.existsSync(dir)}));
}
main().catch(error=>{const value=error.code||error.cause?.code||"ERROR",code=/^[A-Z0-9_]+$/.test(value)?value:"ERROR";console.error("RESTORE_CHECK_FAILED "+JSON.stringify({stage,code,...checks}));process.exitCode=1;});
