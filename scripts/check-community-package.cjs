const {execFileSync}=require("node:child_process");

function checkTarget({REF,TARGET,ENABLED}){
  if(REF!=="refs/heads/main")throw new Error("Use apenas a main integrada.");
  if(!["homologacao","producao"].includes(TARGET))throw new Error("Ambiente inválido.");
  if(TARGET==="producao"&&ENABLED!=="true")throw new Error("A preparação de pacotes de produção ainda não foi liberada.");
}
function checkFiles(files){
  if(files.some(file=>/(^|\/)(\.env($|\.)|rclone\.conf$|[^/]*\.(sqlite|sqlite3|db|pem|key)(-(wal|shm))?$|node_modules\/|\.data\/)/i.test(file)))throw new Error("Arquivo privado ou local versionado: pacote recusado.");
}
if(require.main===module){
  try{
    checkTarget(process.env);
    if(process.argv.includes("--files"))checkFiles(execFileSync("git",["ls-files"],{encoding:"utf8",windowsHide:true}).trim().split(/\r?\n/));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={checkTarget,checkFiles};
