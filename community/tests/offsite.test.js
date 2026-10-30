const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const childProcess=require("node:child_process");
const {DatabaseSync}=require("node:sqlite");
const {backupOffsite}=require("../../scripts/backup-offsite.cjs");

test("backup externo exige crypt, verifica o download e limpa somente suas cópias",async t=>{
  const site=fs.mkdtempSync(path.join(os.tmpdir(),"nichodev-offsite-test-"));
  const data=path.join(site,"community-private"),tool=path.join(data,"offsite");
  fs.mkdirSync(tool,{recursive:true,mode:0o700});fs.writeFileSync(path.join(tool,"rclone.conf"),"configuração fictícia",{mode:0o600});
  const db=new DatabaseSync(path.join(data,"community.sqlite"));
  db.exec("CREATE TABLE sample(value TEXT); INSERT INTO sample VALUES('dado preservado');");
  const original=fs.readFileSync(path.join(data,"community.sqlite"));
  let crypt=true,corrupt=false,uploaded,copies=0,targetTool=tool;
  t.mock.method(childProcess,"execFile",(binary,args,options,callback)=>{
    try{
      assert.equal(binary,path.join(targetTool,process.platform==="win32"?"rclone.exe":"rclone"));
      assert.equal(options.windowsHide,true);
      const command=args.indexOf("dump");
      if(command>=0)return callback(null,JSON.stringify({backup:{type:crypt?"crypt":"alias",remote:"r2:nichodev-community-backups",filename_encryption:"standard",password:"fictício"},r2:{type:"s3",provider:"Cloudflare",endpoint:"https://"+"a".repeat(32)+".r2.cloudflarestorage.com"}}),"");
      const at=args.indexOf("copyto"),from=args[at+1],to=args[at+2];copies++;
      if(from.startsWith("backup:"))fs.writeFileSync(to,corrupt?Buffer.from("corrompido"):uploaded);
      else {assert.match(to,/^backup:(producao\/)?community-/);assert.ok(args.includes("--immutable"));uploaded=fs.readFileSync(from);}
      callback(null,"","");
    }catch(error){callback(error);}
  });
  try{
    const result=await backupOffsite(site);
    assert.equal(result.status,"OFFSITE_BACKUP_OK");assert.equal(result.encrypted,true);assert.equal(result.downloadVerified,true);assert.equal(copies,2);
    assert.deepEqual(fs.readFileSync(path.join(data,"community.sqlite")),original);
    assert.deepEqual(fs.readdirSync(data).filter(name=>name.startsWith("offsite-send-")),[]);
    crypt=false;await assert.rejects(backupOffsite(site),/criptografia/);assert.equal(copies,2);
    crypt=true;corrupt=true;await assert.rejects(backupOffsite(site),/difere/);
    assert.deepEqual(fs.readFileSync(path.join(data,"community.sqlite")),original);
    assert.deepEqual(fs.readdirSync(data).filter(name=>name.startsWith("offsite-send-")),[]);
    corrupt=false;
    const production=path.join(site,"nichodev.com"),productionData=path.join(production,"community-private");
    fs.mkdirSync(productionData,{recursive:true});fs.cpSync(tool,path.join(productionData,"offsite"),{recursive:true});fs.writeFileSync(path.join(productionData,"community.sqlite"),original);
    targetTool=path.join(productionData,"offsite");const isolated=await backupOffsite(production);assert.match(isolated.object,/^producao\//);
    const receipt=JSON.parse(fs.readFileSync(path.join(productionData,"offsite/last-success.json"),"utf8"));assert.equal(receipt.site,"nichodev.com");assert.equal(receipt.downloadVerified,true);
  }finally{
    db.close();assert.equal(path.dirname(path.resolve(site)),path.resolve(os.tmpdir()));fs.rmSync(site,{recursive:true,force:true});
  }
});
