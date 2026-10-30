const path=require("node:path");
const {openStore,backup}=require("./store");

async function main(){
  if(!process.env.COMMUNITY_DATA_DIR)throw new Error("Defina COMMUNITY_DATA_DIR com a pasta persistente da aplicação.");
  const db=openStore(path.join(path.resolve(process.env.COMMUNITY_DATA_DIR),"community.sqlite"));
  try{
    const [action,value]=process.argv.slice(2);
    if(action==="admin"){
      if(!/^[a-z0-9_]{3,24}$/i.test(value||""))throw new Error("Informe o nome de uma conta já cadastrada e confirmada.");
      const result=db.prepare("UPDATE users SET admin=1 WHERE username=? AND active=1").run(value.toLowerCase());
      if(!result.changes)throw new Error("Conta confirmada não encontrada.");
      console.log("Acesso administrativo concedido à conta informada.");
    }else if(action==="backup"){
      if(!value||!path.isAbsolute(value))throw new Error("Informe um caminho absoluto para o backup, fora da pasta pública.");
      if(["../public","../server-pages","../prototypes/community"].some(folder=>{const relative=path.relative(path.resolve(__dirname,folder),value);return !relative||(!relative.startsWith("..")&&!path.isAbsolute(relative));}))throw new Error("O backup não pode ficar em uma pasta pública.");
      await backup(db,value);
      console.log("Backup consistente concluído. Mantenha o arquivo em local privado.");
    }else throw new Error("Uso: node community/manage.js admin USUARIO | backup CAMINHO_ABSOLUTO");
  }finally{db.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
