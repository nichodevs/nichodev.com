const path=require("node:path");
const {openStore,backup,transaction}=require("./store");
const {DatabaseSync}=require("node:sqlite");
const {writeReceipt}=require("./operation-receipt");

async function main(){
  if(!process.env.COMMUNITY_DATA_DIR)throw new Error("Defina COMMUNITY_DATA_DIR com a pasta persistente da aplicação.");
  const db=openStore(path.join(path.resolve(process.env.COMMUNITY_DATA_DIR),"community.sqlite"));
  try{
    const [action,value]=process.argv.slice(2);
    if(action==="admin"){
      if(!/^[a-z0-9_]{3,24}$/i.test(value||""))throw new Error("Informe o nome de uma conta já cadastrada e confirmada.");
      transaction(db,()=>{
        const user=db.prepare("SELECT id,username FROM users WHERE username=? AND active=1").get(value.toLowerCase());if(!user)throw Error("Conta confirmada não encontrada.");
        const control=db.prepare("SELECT role,suspended FROM user_controls WHERE user_id=?").get(user.id);if(control?.suspended)throw Error("Reative a conta pelo procedimento autorizado antes de promover.");
        const role=control?.role==="owner"||!db.prepare("SELECT user_id FROM user_controls WHERE role='owner'").get()?"owner":"admin";
        db.prepare("UPDATE users SET admin=1 WHERE id=?").run(user.id);
        db.prepare("INSERT INTO user_controls(user_id,role) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role").run(user.id,role);
        db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
        db.prepare("INSERT INTO admin_audit(actor_name,action,target,reason,result,created) VALUES('CLI','user.role',?,'Concessão operacional offline','ok',?)").run(user.id,Date.now());
      });
      console.log("Acesso administrativo concedido à conta informada.");
    }else if(action==="backup"){
      if(!value||!path.isAbsolute(value))throw new Error("Informe um caminho absoluto para o backup, fora da pasta pública.");
      if(["../public","../server-pages","../prototypes/community"].some(folder=>{const relative=path.relative(path.resolve(__dirname,folder),value);return !relative||(!relative.startsWith("..")&&!path.isAbsolute(relative));}))throw new Error("O backup não pode ficar em uma pasta pública.");
      const receipt=path.resolve(value)===path.join(path.resolve(process.env.COMMUNITY_DATA_DIR),"latest.sqlite");
      try{
        await backup(db,value);const copy=new DatabaseSync(value,{readOnly:true});
        try{if(copy.prepare("PRAGMA integrity_check").get().integrity_check!=="ok")throw Error("Integridade inválida.");}finally{copy.close();}
        if(receipt)writeReceipt(path.resolve(process.env.COMMUNITY_DATA_DIR),"backup-status.json",{ok:true,integrity:true});
      }catch(error){if(receipt)writeReceipt(path.resolve(process.env.COMMUNITY_DATA_DIR),"backup-status.json",{ok:false,integrity:false});throw error;}
      console.log("Backup consistente concluído. Mantenha o arquivo em local privado.");
    }else throw new Error("Uso: node community/manage.js admin USUARIO | backup CAMINHO_ABSOLUTO");
  }finally{db.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
