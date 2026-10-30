const crypto=require("node:crypto");
const {transaction}=require("./store");

function rejected(status,message,retryAfter){return Object.assign(new Error(message),{status,retryAfter});}
function security(db){
  db.prepare("INSERT OR IGNORE INTO security_config(id,secret) VALUES(1,?)").run(crypto.randomBytes(32).toString("hex"));
  const secret=db.prepare("SELECT secret FROM security_config WHERE id=1").get().secret;
  const key=parts=>crypto.createHmac("sha256",secret).update(JSON.stringify(parts)).digest("hex");
  function consume(parts,max,period=600000,amount=1){
    const time=Date.now(),scope=key(parts);
    if(amount>max)throw rejected(429,"Muitas solicitações. Aguarde e tente novamente.",Math.ceil(period/1000));
    const result=db.prepare(`INSERT INTO limits(key,count,expires) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET
      count=CASE WHEN limits.expires<=? THEN excluded.count ELSE limits.count+excluded.count END,
      expires=CASE WHEN limits.expires<=? THEN excluded.expires ELSE limits.expires END
      WHERE limits.expires<=? OR limits.count<=? RETURNING expires`).get(scope,amount,time+period,time,time,time,max-amount);
    if(!result){const record=db.prepare("SELECT expires FROM limits WHERE key=?").get(scope);throw rejected(429,"Muitas solicitações. Aguarde e tente novamente.",Math.max(1,Math.ceil(((record?.expires||time+period)-time)/1000)));}
  }
  function reserve(scopes,ttl=120000){
    const id=crypto.randomUUID(),time=Date.now();
    transaction(db,()=>{
      db.prepare("DELETE FROM security_leases WHERE expires<=?").run(time);
      for(const [parts,max]of scopes){
        const scope=key(parts);
        if(db.prepare("SELECT COUNT(*) AS n FROM security_leases WHERE scope=?").get(scope).n>=max)throw rejected(503,"Serviço ocupado. Tente novamente em instantes.",2);
        db.prepare("INSERT INTO security_leases(id,scope,expires) VALUES(?,?,?)").run(id,scope,time+ttl);
      }
    });
    let released=false;
    return ()=>{if(released)return;released=true;db.prepare("DELETE FROM security_leases WHERE id=?").run(id);};
  }
  return {consume,reserve};
}

async function checkNewPassword(value,fetchRange=fetch){
  const normalized=value.normalize("NFKC").toLowerCase().replace(/[\s_-]/g,"");
  if(/^(password|senha|1234567890?|qwerty|letmein|admin)+\d*$/.test(normalized))throw rejected(400,"Escolha uma senha menos previsível.");
  const hash=crypto.createHash("sha1").update(value).digest("hex").toUpperCase();
  let compromised;
  try{
    const response=await fetchRange("https://api.pwnedpasswords.com/range/"+hash.slice(0,5),{headers:{"Add-Padding":"true","User-Agent":"nichodev-password-check"},signal:AbortSignal.timeout(5000),redirect:"error"});
    if(!response.ok)throw Error("Password lookup unavailable");
    const chunks=[];let size=0;
    for await(const chunk of response.body){
      size+=chunk.length;if(size>2*1024*1024)throw Error("Invalid password lookup");chunks.push(chunk);
    }
    const body=Buffer.concat(chunks,size).toString("utf8");
    const lines=body.trim().split(/\r?\n/);
    if(!lines.length||!lines.every(line=>/^[A-F0-9]{35}:\d+$/.test(line)))throw Error("Invalid password lookup");
    compromised=lines.some(line=>{const [suffix,count]=line.split(":");return suffix===hash.slice(5)&&Number(count)>0;});
  }catch{throw rejected(503,"Não foi possível verificar a nova senha. Tente novamente em instantes.",30);}
  if(compromised)throw rejected(400,"Essa senha consta em vazamentos conhecidos. Escolha outra frase.");
}

function byteRange(value,size){
  if(!value)return {start:0,end:size-1,partial:false};
  const match=/^bytes=(\d*)-(\d*)$/.exec(value);
  if(!match||(!match[1]&&!match[2]))return null;
  let start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
  let end=match[1]&&match[2]?Math.min(size-1,Number(match[2])):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start||(!match[1]&&Number(match[2])===0))return null;
  return {start,end,partial:true};
}
module.exports={security,checkNewPassword,byteRange};
