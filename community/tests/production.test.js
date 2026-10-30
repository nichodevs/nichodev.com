const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const {productionConfig}=require("../production-config");
const {checkTarget,checkFiles}=require("../../scripts/check-community-package.cjs");

test("pacotes exigem main, alvo válido e liberação de produção, sem arquivos privados",()=>{
  assert.doesNotThrow(()=>checkTarget({REF:"refs/heads/main",TARGET:"homologacao"}));
  assert.doesNotThrow(()=>checkTarget({REF:"refs/heads/main",TARGET:"producao",ENABLED:"true"}));
  for(const env of [{REF:"refs/heads/main",TARGET:"producao"},{REF:"refs/heads/test",TARGET:"homologacao"},{REF:"refs/heads/main",TARGET:"outro"}])assert.throws(()=>checkTarget(env));
  assert.doesNotThrow(()=>checkFiles(["package.json","community/app.js","public/voz.html"]));
  for(const file of [".env","config/.env.production","offsite/rclone.conf","data/community.sqlite","data/community.sqlite-wal","test.db","keys/access.pem",".data/test.json","node_modules/express/index.js"])assert.throws(()=>checkFiles([file]));
});

function fixture(t){
  const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"nichodev-production-test-")));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const data=path.join(home,"domains/nichodev.com/community-private");
  const env={COMMUNITY_PUBLIC_RELEASE:"enabled",NODE_ENV:"production",APP_ORIGIN:"https://nichodev.com",COMMUNITY_DATA_DIR:data,TRUSTED_PROXY:"127.0.0.1/32,::1/128"};
  return {home,data,env};
}
test("preparar produção valida configuração sem criar ou copiar dados",t=>{
  const {home,data,env}=fixture(t);
  assert.deepEqual(productionConfig(env,home),{origin:"https://nichodev.com",data});
  assert.equal(fs.existsSync(data),false);
  assert.throws(()=>productionConfig({...env,TRUSTED_PROXY:"unix",LSNODE_SOCKET:"/outro/socket"},home));
  for(const changes of [{COMMUNITY_PUBLIC_RELEASE:""},{NODE_ENV:"development"},{APP_ORIGIN:"https://www.nichodev.com"},{TRUSTED_PROXY:""},{TRUSTED_PROXY:"true"},{TRUSTED_PROXY:"0.0.0.0/0"},{TRUSTED_PROXY:"127.0.0.1/33"}])assert.throws(()=>productionConfig({...env,...changes},home));
});
test("produção rejeita banco de homologação, pasta pública e atalhos para outros dados",t=>{
  const {home,data,env}=fixture(t),staging=path.join(home,"domains/staging.test/community-private");
  fs.mkdirSync(staging,{recursive:true});fs.writeFileSync(path.join(staging,"sentinel"),"preservar");
  for(const directory of [staging,path.join(home,"public"),"community-private"])assert.throws(()=>productionConfig({...env,COMMUNITY_DATA_DIR:directory},home));
  fs.mkdirSync(path.dirname(data),{recursive:true});
  fs.symlinkSync(staging,data,process.platform==="win32"?"junction":"dir");
  assert.throws(()=>productionConfig(env,home));
  assert.equal(fs.readFileSync(path.join(staging,"sentinel"),"utf8"),"preservar");
  fs.unlinkSync(data);
});
test("entrada de produção fecha antes de abrir o servidor ou inicializar o banco sem autorização",t=>{
  const {data}=fixture(t);
  const result=spawnSync(process.execPath,[path.resolve(__dirname,"../../scripts/start-community-production.js")],{env:{...process.env,COMMUNITY_PUBLIC_RELEASE:"",COMMUNITY_DATA_DIR:data},encoding:"utf8",timeout:10000,windowsHide:true});
  assert.notEqual(result.status,0);assert.match(result.stderr,/não foi liberada explicitamente/);
  assert.equal(fs.existsSync(data),false);
});
test("entrada de homologação não contorna a liberação do domínio público",t=>{
  const {data}=fixture(t);
  for(const host of ["nichodev.com","www.nichodev.com"]){
    const result=spawnSync(process.execPath,[path.resolve(__dirname,"../server.js")],{env:{...process.env,NODE_ENV:"production",APP_ORIGIN:"https://"+host,COMMUNITY_DATA_DIR:data,COMMUNITY_PUBLIC_RELEASE:"enabled"},encoding:"utf8",timeout:10000,windowsHide:true});
    assert.notEqual(result.status,0);assert.match(result.stderr,/entrada de produção protegida/);
    assert.equal(fs.existsSync(data),false);
  }
});

test("produção usa a pasta da conta mesmo quando o runtime apresenta a pasta do domínio como home",t=>{
  const {home,data,env}=fixture(t);
  t.mock.method(os,"userInfo",()=>({homedir:home}));
  t.mock.method(os,"homedir",()=>path.join(home,"domains/nichodev.com"));
  assert.deepEqual(productionConfig(env),{origin:"https://nichodev.com",data});
  assert.throws(()=>productionConfig({...env,COMMUNITY_DATA_DIR:path.join(home,"domains/staging.test/community-private")}));
  assert.equal(fs.existsSync(data),false);
});
