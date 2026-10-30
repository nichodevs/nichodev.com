const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {promisify}=require("node:util");
const {execFile}=require("node:child_process");
const {openStore}=require("../store");
const execute=promisify(execFile);

test("restaura uma cópia privada, lê áudio pela aplicação e rejeita backup corrompido",async()=>{
  const site=fs.mkdtempSync(path.join(os.tmpdir(),"nichodev-restore-test-"));
  const privateDir=path.join(site,"community-private"),backup=path.join(privateDir,"latest.sqlite");
  fs.mkdirSync(path.join(site,"hbuilds/current"),{recursive:true});
  fs.symlinkSync(path.resolve(__dirname,"../.."),path.join(site,"hbuilds/current/nodejs"),process.platform==="win32"?"junction":"dir");
  try {
    const db=openStore(backup),now=Date.now();
    db.prepare("INSERT INTO users(id,username,password,recovery,active,admin,created) VALUES(?,?,?,?,1,1,?)").run("fixture","restore_fixture","hash preservado","chave protegida",now);
    db.prepare("INSERT INTO users(id,username,password,recovery,active,created) VALUES(?,?,?,?,1,?)").run("member","restore_member","hash preservado","chave protegida",now);
    const wav=Buffer.alloc(46);wav.write("RIFF");wav.writeUInt32LE(38,4);wav.write("WAVEfmt ",8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write("data",36);wav.writeUInt32LE(2,40);wav.writeInt16LE(1234,44);
    db.prepare("INSERT INTO media VALUES(?,?,?,?)").run("audio","fixture",wav,now);
    db.prepare("INSERT INTO creations(id,owner,kind,tool,title,description,visibility,media_id,created) VALUES(?,?,?,?,?,?,?,?,?)").run("creation","fixture","audio","mixmaster","Exemplo","Privado","private","audio",now);
    db.close();
    const before=fs.readFileSync(backup);
    const {stdout}=await execute(process.execPath,[path.resolve(__dirname,"../../scripts/test-restore.cjs"),site]);
    const result=JSON.parse(stdout.trim());
    assert.equal(result.status,"ok");assert.equal(result.accounts,2);assert.equal(result.audio,1);assert.equal(result.creations,1);assert.equal(result.isolatedCopyRemoved,true);
    assert.deepEqual(fs.readFileSync(backup),before);
    assert.deepEqual(fs.readdirSync(privateDir).filter(name=>name.startsWith("restore-check-")),[]);
    fs.writeFileSync(backup,"arquivo corrompido");
    await assert.rejects(execute(process.execPath,[path.resolve(__dirname,"../../scripts/test-restore.cjs"),site]),error=>error.code===1&&error.stderr.includes("RESTORE_CHECK_FAILED"));
    assert.deepEqual(fs.readdirSync(privateDir).filter(name=>name.startsWith("restore-check-")),[]);
  } finally {
    assert.equal(path.dirname(path.resolve(site)),path.resolve(os.tmpdir()));
    fs.rmSync(site,{recursive:true,force:true});
  }
});
