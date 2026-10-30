const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {publicPages}=require("../community/app");
const hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
function routePublicHtml(site,source){
  const root=path.join(site,"public_html"),data=path.join(site,"community-private");
  assert.equal(fs.realpathSync(root),root,"A pasta pública não pode apontar a outro local.");
  assert.equal(fs.realpathSync(data),data,"A pasta privada não pode apontar a outro local.");
  // A pasta física da onda também ocultaria o index atendido pelo Node.
  const files=[...new Set(Object.values(publicPages).map(file=>file==="onda/index.html"?"onda":file))].filter(file=>fs.existsSync(path.join(root,file)));
  for(const file of files){
    const target=path.join(root,file),original=path.join(source,"public",file);
    const stat=fs.lstatSync(target);assert.ok(!stat.isSymbolicLink(),"Cópia pública inesperada.");
    if(file==="onda"){
      assert.ok(stat.isDirectory(),"Pasta da onda inesperada.");
      for(const relative of fs.readdirSync(target,{recursive:true})){
        const item=path.join(target,relative),entry=fs.lstatSync(item);assert.ok(!entry.isSymbolicLink(),"Atalho público inesperado.");
        if(entry.isDirectory())continue;assert.ok(entry.isFile(),"Arquivo público inesperado.");
        assert.equal(hash(item),hash(path.join(original,relative)),"A cópia pública difere do pacote; interromper sem mover arquivos.");
      }
    }else{
      assert.ok(stat.isFile(),"Cópia pública inesperada.");
      assert.equal(hash(target),hash(original),"A cópia pública difere do pacote; interromper sem mover arquivos.");
    }
  }
  if(!files.length)return {moved:0};
  const backup=fs.mkdtempSync(path.join(data,"html-routing-"));fs.chmodSync(backup,0o700);
  for(const file of files){const destination=path.join(backup,file);fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});fs.renameSync(path.join(root,file),destination);}
  return {moved:files.length,backup};
}
if(require.main===module){
  const site=path.join(fs.realpathSync(os.userInfo().homedir),"domains/nichodev.com"),source=fs.realpathSync(path.join(__dirname,".."));
  assert.equal(source,fs.realpathSync(path.join(site,"hbuilds/current/nodejs")),"Execute somente o script da versão de produção publicada.");
  console.log(JSON.stringify({...routePublicHtml(site,source),sourceHtmlPreserved:true,databaseUntouched:true}));
}
module.exports={routePublicHtml};
