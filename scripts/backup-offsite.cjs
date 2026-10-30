const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const childProcess=require("node:child_process");
const {DatabaseSync,backup}=require("node:sqlite");

async function hash(filename){
  const digest=crypto.createHash("sha256");
  for await(const chunk of fs.createReadStream(filename))digest.update(chunk);
  return digest.digest("hex");
}

function integrity(filename){
  const db=new DatabaseSync(filename,{readOnly:true});
  try{
    assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check,"ok");
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length,0);
  }finally{db.close();}
}

async function backupOffsite(sitePath){
  assert.ok(sitePath,"Informe a pasta do site.");
  const site=fs.realpathSync(path.resolve(os.homedir(),sitePath));
  const data=fs.realpathSync(path.join(site,"community-private"));
  const configFile=path.join(data,"offsite/rclone.conf");
  assert.ok(fs.lstatSync(configFile).isFile(),"Configuração privada ausente.");
  if(process.platform!=="win32")assert.equal(fs.statSync(configFile).mode&0o077,0,"A configuração precisa ter permissão 600.");
  const binary=path.join(data,"offsite",process.platform==="win32"?"rclone.exe":"rclone");
  const rclone=args=>new Promise((resolve,reject)=>{
    childProcess.execFile(binary,["--config",configFile,"--log-level","ERROR",...args],{timeout:300000,maxBuffer:1024*1024,windowsHide:true},(error,stdout)=>error?reject(error):resolve(stdout));
  });
  const config=JSON.parse(await rclone(["config","dump"]));
  assert.equal(config.backup?.type,"crypt","O envio exige criptografia antes do upload.");
  assert.equal(config.backup.remote,"r2:nichodev-community-backups");
  assert.equal(config.backup.filename_encryption,"standard");
  assert.ok(config.backup.password,"Chave de criptografia ausente.");
  assert.equal(config.r2?.type,"s3");assert.equal(config.r2.provider,"Cloudflare");
  assert.match(config.r2.endpoint,/^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com\/?$/);
  const source=path.join(data,"community.sqlite");
  assert.ok(fs.lstatSync(source).isFile(),"Banco ativo ausente.");
  const temporary=fs.mkdtempSync(path.join(data,"offsite-send-"));
  fs.chmodSync(temporary,0o700);
  let db;
  try{
    const filename="community-"+new Date().toISOString().replaceAll(":","-")+"-"+crypto.randomUUID()+".sqlite";
    const snapshot=path.join(temporary,filename),recovered=path.join(temporary,"recovered.sqlite");
    db=new DatabaseSync(source,{readOnly:true,timeout:5000});
    await backup(db,snapshot);db.close();db=null;
    fs.chmodSync(snapshot,0o600);integrity(snapshot);
    const remote="backup:"+filename;
    await rclone(["copyto",snapshot,remote,"--immutable"]);
    await rclone(["copyto",remote,recovered]);
    fs.chmodSync(recovered,0o600);
    assert.equal(await hash(recovered),await hash(snapshot),"A cópia recuperada difere do backup enviado.");
    integrity(recovered);
    return {status:"OFFSITE_BACKUP_OK",object:filename,bytes:fs.statSync(snapshot).size,encrypted:true,downloadVerified:true,integrity:true};
  }finally{
    if(db)db.close();
    assert.equal(path.dirname(fs.realpathSync(temporary)),data);
    fs.rmSync(temporary,{recursive:true,force:true});
  }
}

module.exports={backupOffsite};
if(require.main===module)backupOffsite(process.argv[2]).then(result=>console.log(JSON.stringify(result))).catch(()=>{
  console.error("OFFSITE_BACKUP_FAILED: envio ou verificação não concluído; consulte a configuração privada sem publicar credenciais.");process.exitCode=1;
});
