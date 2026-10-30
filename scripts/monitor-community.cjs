const fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const {DatabaseSync}=require("node:sqlite");
const {execFileSync}=require("node:child_process");

async function inspect({data,origin,now=Date.now()}){
  const errors=[];
  try{const response=await fetch(origin+"/health",{signal:AbortSignal.timeout(10000)});if(!response.ok||(await response.json()).status!=="ok")errors.push("A aplicação não respondeu saudável.");}catch{errors.push("A aplicação não respondeu no prazo.");}
  try{const db=new DatabaseSync(path.join(data,"community.sqlite"),{readOnly:true});try{db.prepare("SELECT COUNT(*) FROM users").get();}finally{db.close();}}catch{errors.push("O banco não pôde ser lido.");}
  for(const [file,label]of [["latest.sqlite","Backup local"],["offsite/last-success.json","Backup externo verificado"]]){
    try{
      let stamp;
      if(file.endsWith("json")){
        const receipt=JSON.parse(fs.readFileSync(path.join(data,file),"utf8"));
        if(receipt.status!=="OFFSITE_BACKUP_OK"||receipt.downloadVerified!==true||receipt.integrity!==true||receipt.site!==new URL(origin).hostname)throw new Error("Recibo inválido.");
        stamp=receipt.at;
      }else{
        const backup=new DatabaseSync(path.join(data,file),{readOnly:true});try{backup.prepare("SELECT COUNT(*) FROM users").get();}finally{backup.close();}
        stamp=fs.statSync(path.join(data,file)).mtimeMs;
      }
      if(!Number.isFinite(stamp)||now-stamp>36*3600000)errors.push(label+" está atrasado.");
    }catch{errors.push(label+" não tem confirmação disponível.");}
  }
  try{const disk=fs.statfsSync(data);if(disk.bavail/disk.blocks<.1)errors.push("Menos de 10% de espaço livre no disco.");}catch{errors.push("Não foi possível conferir o espaço livre.");}
  return {ok:errors.length===0,errors,checkedAt:now};
}
function sendMail(subject,body){
  const email="development@nichodev.com";
  const encoded="=?UTF-8?B?"+Buffer.from(subject).toString("base64")+"?=";
  execFileSync("php",["-r","if (!mail($argv[1], $argv[2], $argv[3], $argv[4])) exit(1);",email,encoded,body,"From: nichodev.com <"+email+">\r\nContent-Type: text/plain; charset=UTF-8"],{timeout:20000,windowsHide:true,stdio:["ignore","pipe","pipe"]});
}
async function main(){
  const site=fs.realpathSync(path.resolve(os.homedir(),process.argv[2]||"")),domain=path.basename(site);
  if(!["nichodev.com","cornflowerblue-lapwing-604910.hostingersite.com"].includes(domain))throw new Error("Informe a pasta de um site autorizado.");
  const data=fs.realpathSync(path.join(site,"community-private")),stateFile=path.join(data,"monitor-state.json"),report=await inspect({data,origin:"https://"+domain});
  let previous={};try{previous=JSON.parse(fs.readFileSync(stateFile,"utf8"));}catch{}
  const test=process.argv.includes("--test-alert"),notify=test||(!report.ok&&(previous.ok!==false||Date.now()-(previous.notifiedAt||0)>=3600000))||(report.ok&&previous.ok===false);
  let notifiedAt=previous.notifiedAt||0;
  if(notify){sendMail("[nichodev.com] "+(test?"Teste de alerta":report.ok?"Serviço recuperado":"Atenção operacional"),JSON.stringify({site:domain,...report},null,2));notifiedAt=Date.now();}
  fs.writeFileSync(stateFile,JSON.stringify({...report,notifiedAt}),{mode:0o600});
  console.log(JSON.stringify({site:domain,...report,notificationSent:notify}));if(!report.ok)process.exitCode=1;
}
if(require.main===module)main().catch(error=>{console.error("Falha no monitor da comunidade: "+error.message);process.exitCode=1;});
module.exports={inspect};
