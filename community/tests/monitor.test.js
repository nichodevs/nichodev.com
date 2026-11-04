const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {openStore}=require("../store"),{inspect}=require("../../scripts/monitor-community.cjs");
const {checkPublic}=require("../../scripts/check-public-community.cjs");
test("monitor externo exige backend público e recusa falha ou página de homologação",async t=>{
 t.mock.method(globalThis,"fetch",async()=>({ok:true,json:async()=>({publicRelease:true}),text:async()=>"COMUNIDADE"}));
 assert.equal((await checkPublic()).status,"PUBLIC_COMMUNITY_OK");
 t.mock.method(globalThis,"fetch",async()=>({ok:true,json:async()=>({publicRelease:false}),text:async()=>"COMUNIDADE"}));await assert.rejects(checkPublic(),/não está ativo/);
 t.mock.method(globalThis,"fetch",async()=>({ok:false,status:503}));await assert.rejects(checkPublic(),/503/);
});
test("monitor exige aplicação, banco, backups recentes e recibo de verificação",async t=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),"nichodev-monitor-"));t.after(()=>{assert.equal(path.dirname(path.resolve(data)),path.resolve(os.tmpdir()));fs.rmSync(data,{recursive:true,force:true});});
 const db=openStore(path.join(data,"community.sqlite"));db.close();fs.copyFileSync(path.join(data,"community.sqlite"),path.join(data,"latest.sqlite"));fs.mkdirSync(path.join(data,"offsite"));
 const receipt={status:"OFFSITE_BACKUP_OK",downloadVerified:true,integrity:true,site:"nichodev.com",at:Date.now()};
 fs.writeFileSync(path.join(data,"offsite/last-success.json"),JSON.stringify(receipt));
 t.mock.method(globalThis,"fetch",async()=>({ok:true,json:async()=>({status:"ok"})}));
 assert.equal((await inspect({data,origin:"https://nichodev.com"})).ok,true);
 fs.writeFileSync(path.join(data,"offsite/last-success.json"),JSON.stringify({...receipt,downloadVerified:false}));
 assert.equal((await inspect({data,origin:"https://nichodev.com"})).ok,false);
 fs.writeFileSync(path.join(data,"offsite/last-success.json"),JSON.stringify(receipt));
 assert.equal((await inspect({data,origin:"https://nichodev.com",now:Date.now()+37*3600000})).ok,false);
 t.mock.method(globalThis,"fetch",async()=>{throw Error("timeout");});assert.equal((await inspect({data,origin:"https://nichodev.com"})).ok,false);
});

test("monitor considera saúde recente e falhas operacionais sem ler credenciais",async t=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),"nichodev-monitor-"));
 t.after(()=>{assert.equal(path.dirname(path.resolve(data)),path.resolve(os.tmpdir()));fs.rmSync(data,{recursive:true,force:true});});
 const db=openStore(path.join(data,"community.sqlite"));db.close();fs.copyFileSync(path.join(data,"community.sqlite"),path.join(data,"latest.sqlite"));fs.mkdirSync(path.join(data,"offsite"));
 fs.writeFileSync(path.join(data,"offsite/last-success.json"),JSON.stringify({status:"OFFSITE_BACKUP_OK",downloadVerified:true,integrity:true,site:"nichodev.com",at:Date.now()}));
 fs.writeFileSync(path.join(data,"server-health.json"),JSON.stringify({checkedAt:Date.now(),memoryBytes:600*1048576,p95Ms:1500}));
 fs.writeFileSync(path.join(data,"backup-status.json"),JSON.stringify({ok:false,at:Date.now()}));
 t.mock.method(globalThis,"fetch",async()=>({ok:true,json:async()=>({status:"ok"})}));
 const r=await inspect({data,origin:"https://nichodev.com"});assert.equal(r.ok,false);assert.ok(r.errors.some(x=>x.includes("512 MiB")));assert.ok(r.errors.some(x=>x.includes("p95")));assert.ok(r.errors.some(x=>x.includes("backup-status")));
});
