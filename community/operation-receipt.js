const fs=require('node:fs'),path=require('node:path');
function writeReceipt(data,file,report){
  if(!path.isAbsolute(data)||!['backup-status.json','offsite/status.json','restore-status.json'].includes(file))throw Error('Destino de recibo inválido.');
  const destination=path.join(data,file);fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});
  const temporary=destination+'.'+process.pid+'.tmp';
  try{fs.writeFileSync(temporary,JSON.stringify({...report,at:Date.now()}),{mode:0o600});fs.renameSync(temporary,destination);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
module.exports={writeReceipt};
