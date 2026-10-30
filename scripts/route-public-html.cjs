const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {publicPages}=require("../community/app");
const hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
function fingerprint(file){
  const stat=fs.lstatSync(file);assert.ok(!stat.isSymbolicLink(),"Atalho inesperado nos arquivos públicos.");
  if(stat.isFile())return hash(file);
  assert.ok(stat.isDirectory(),"Arquivo público inesperado.");
  return fs.readdirSync(file).sort().map(name=>[name,fingerprint(path.join(file,name))]);
}
function routePublicHtml(source){
  assert.equal(fs.realpathSync(source),source,"Use a pasta real da aplicação.");
  const root=path.join(source,"public"),pages=path.join(source,"server-pages");
  assert.equal(fs.realpathSync(root),root,"A pasta pública não pode apontar a outro local.");
  const targets=[...new Set(Object.values(publicPages).map(file=>file==="onda/index.html"?"onda":file))];
  for(const file of targets)assert.ok(fs.existsSync(path.join(root,file))||fs.existsSync(path.join(pages,file)),"HTML obrigatório ausente do pacote.");
  if(!fs.existsSync(pages)){
    const staging=fs.mkdtempSync(path.join(source,".server-pages-"));fs.chmodSync(staging,0o700);
    try{
      for(const file of targets){fingerprint(path.join(root,file));fs.cpSync(path.join(root,file),path.join(staging,file),{recursive:true});assert.deepEqual(fingerprint(path.join(root,file)),fingerprint(path.join(staging,file)));}
      fs.renameSync(staging,pages);
    }finally{if(fs.existsSync(staging)){assert.equal(path.dirname(fs.realpathSync(staging)),source);fs.rmSync(staging,{recursive:true,force:true});}}
  }
  assert.equal(fs.realpathSync(pages),pages,"A pasta de HTML não pode apontar a outro local.");
  const files=targets.filter(file=>fs.existsSync(path.join(root,file))),originals=path.join(pages,".originals");
  for(const file of files){assert.deepEqual(fingerprint(path.join(root,file)),fingerprint(path.join(pages,file)),"O HTML preparado difere do original; interromper sem mover arquivos.");assert.ok(!fs.existsSync(path.join(originals,file)),"Original já preservado; não sobrescrever.");}
  if(files.length)fs.mkdirSync(originals,{recursive:true,mode:0o700});
  for(const file of files)fs.renameSync(path.join(root,file),path.join(originals,file));
  return {moved:files.length,pages,originals};
}
if(require.main===module){
  const site=path.join(fs.realpathSync(os.userInfo().homedir),"domains/nichodev.com"),source=fs.realpathSync(path.join(__dirname,".."));
  assert.equal(source,fs.realpathSync(path.join(site,"hbuilds/current/nodejs")),"Execute somente o script da versão de produção publicada.");
  console.log(JSON.stringify({...routePublicHtml(source),sourceHtmlPreserved:true,databaseUntouched:true}));
}
module.exports={routePublicHtml};
