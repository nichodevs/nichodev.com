const express = require("express");
const crypto = require("node:crypto");
const {promisify} = require("node:util");
const fs = require("node:fs");
const path = require("node:path");
const {openStore,transaction} = require("./store");
const {validatePreset} = require("./preset-format");
const {valid:validPalette} = require("./palette-format");
const {security,checkNewPassword,byteRange}=require("./security");

const scrypt = promisify(crypto.scrypt);
const digest = value => crypto.createHash("sha256").update(String(value)).digest("hex");
const random = () => crypto.randomBytes(32).toString("base64url");
const uuid = () => crypto.randomUUID();
const fail = (status,message) => { const error=new Error(message);error.status=status;throw error; };
const text = (value,max,required=true) => {
  if(typeof value!=="string"||value.length>max||(required&&!value.trim()))fail(400,"Confira os campos informados.");
  return value.trim();
};
const username = value => { const name=text(value,24).toLowerCase();if(!/^[a-z0-9_]{3,24}$/.test(name))fail(400,"Use de 3 a 24 letras, números ou _.");return name; };
const password = value => {
  if(typeof value!=="string"||[...value].length<15||[...value].length>128)fail(400,"Use uma frase de 15 a 128 caracteres como senha.");
  if(/^(.)\1+$/.test(value)||["123456789012345","passwordpassword","senhasenhasenha1"].includes(value.toLowerCase()))fail(400,"Escolha uma senha menos previsível.");
  return value;
};
const select = (value,allowed) => { if(!allowed.includes(value))fail(400,"Opção inválida.");return value; };

function validateWav(buffer) {
  if(!Buffer.isBuffer(buffer)||buffer.length<44||buffer.toString("ascii",0,4)!=="RIFF"||buffer.toString("ascii",8,12)!=="WAVE"||buffer.readUInt32LE(4)!==buffer.length-8)fail(400,"Envie um WAV PCM16 ou float32 válido.");
  let format=null,data=null,dataStart=0,offset=12,chunks=0;
  while(offset+8<=buffer.length){
    if(++chunks>512)fail(400,"WAV com estrutura inválida.");
    const id=buffer.toString("ascii",offset,offset+4),length=buffer.readUInt32LE(offset+4),start=offset+8;
    if(start+length>buffer.length)fail(400,"WAV incompleto.");
    if(id==="fmt "){if(format||length<16)fail(400,"Formato WAV inválido.");format={code:buffer.readUInt16LE(start),channels:buffer.readUInt16LE(start+2),rate:buffer.readUInt32LE(start+4),bytes:buffer.readUInt32LE(start+8),align:buffer.readUInt16LE(start+12),bits:buffer.readUInt16LE(start+14)};}
    if(id==="data"){if(data!==null)fail(400,"WAV com dados repetidos.");data=length;dataStart=start;}
    offset=start+length+(length%2);
  }
  if(offset!==buffer.length||!format||!data||!((format.code===1&&format.bits===16)||(format.code===3&&format.bits===32))||![1,2].includes(format.channels)||format.rate<8000||format.rate>96000||format.align!==format.channels*format.bits/8||format.bytes!==format.rate*format.align||data%format.align||data/format.bytes>120)fail(400,"Use WAV mono/estéreo, de até 120 segundos, PCM16 ou float32.");
  if(format.code===3)for(let at=dataStart;at<dataStart+data;at+=4)if(!Number.isFinite(buffer.readFloatLE(at)))fail(400,"O áudio contém amostras inválidas.");
}

const publicPages={"/":"index.html","/index.html":"index.html","/voz.html":"voz.html","/guitarra.html":"guitarra.html","/mixmaster.html":"mixmaster.html","/downloads.html":"downloads.html","/onda/":"onda/index.html"};

function createCommunityApp({dbPath,origin,secure=false,publicDir=path.join(__dirname,"../prototypes/community"),siteDir=path.join(__dirname,"../public"),trustedProxy=false,publicRelease=false,bootstrapToken="",bootstrapUser="",probeToken="",passwordCheck=checkNewPassword}) {
  const db=openStore(dbPath),app=express(),guard=security(db);
  const cookieName=secure?"__Host-nichodev":"nichodev_local";
  app.disable("x-powered-by");if(trustedProxy)app.set("trust proxy",trustedProxy);
  app.locals.origin=origin;
  const now=()=>Date.now();
  const get=(sql,...params)=>db.prepare(sql).get(...params);
  const all=(sql,...params)=>db.prepare(sql).all(...params);
  const run=(sql,...params)=>db.prepare(sql).run(...params);
  const clean=()=>{const time=now();run("DELETE FROM sessions WHERE expires<?",time);run("DELETE FROM users WHERE active=0 AND confirmation_expiry<?",time);run("DELETE FROM limits WHERE expires<?",time);run("DELETE FROM feedback WHERE created<?",time-90*86400000);run("DELETE FROM media WHERE created<? AND id NOT IN (SELECT media_id FROM creations WHERE media_id IS NOT NULL)",time-86400000);};
  clean();
  const timer=setInterval(()=>{try{clean();}catch{console.error("Não foi possível executar a limpeza periódica da comunidade.");}},600000);timer.unref();
  app.locals.close=()=>{clearInterval(timer);db.close();};
  app.locals.db=db;

  function rate(req,key,max,period=600000,amount=1){
    guard.consume(["ip",req.ip,key],max,period,amount);
    const user=actor(req);if(user)guard.consume(["user",user.id,key],max,period,amount);
  }
  async function newPassword(value){
    guard.consume(["global","auth-work"],60,60000);
    const release=guard.reserve([[["global","auth-work"],2]]);
    try{await passwordCheck(value);}finally{release();}
    return value;
  }
  async function hash(value,salt=crypto.randomBytes(16).toString("hex")){
    guard.consume(["global","auth-work"],60,60000);
    const release=guard.reserve([[["global","auth-work"],2]]);
    try {const derived=await scrypt(value,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024});return salt+":"+derived.toString("hex");}
    finally{release();}
  }
  async function verify(value,stored){
    const [salt,result]=stored.split(":");
    const candidate=await hash(value,salt);
    const expected=Buffer.from(result,"hex"),actual=Buffer.from(candidate.split(":")[1],"hex");
    return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);
  }
  const cookieOptions={httpOnly:true,secure,sameSite:"strict",path:"/"};
  function setSession(res,userId){
    const token=random();run("INSERT INTO sessions VALUES(?,?,?)",digest(token),userId,now()+7*86400000);
    run("INSERT INTO session_auth(token,authenticated) VALUES(?,?)",digest(token),now());
    res.cookie(cookieName,token,{...cookieOptions,maxAge:7*86400000});
  }
  function cookies(req){
    const out={};
    for(const part of String(req.headers.cookie||"").split(";")){const position=part.indexOf("=");if(position>0)out[part.slice(0,position).trim()]=part.slice(position+1).trim();}
    return out;
  }
  function actor(req){
    const token=cookies(req)[cookieName];
    return token?get("SELECT u.id,u.username,u.admin,a.authenticated FROM users u JOIN sessions s ON s.user_id=u.id LEFT JOIN session_auth a ON a.token=s.token WHERE s.token=? AND s.expires>? AND u.active=1",digest(token),now()):null;
  }
  function auth(req){const user=actor(req);if(!user)fail(401,"Entre na sua conta para continuar.");return user;}
  function admin(req){
    const user=auth(req);if(!user.admin)fail(403,"Acesso restrito à administração.");
    if(!user.authenticated||now()-user.authenticated>=10*60000)throw Object.assign(new Error("Confirme sua senha para continuar na administração."),{status:403,code:"ADMIN_REAUTH_REQUIRED"});
    return user;
  }
  const safeUser=user=>user?{id:user.id,username:user.username,admin:Boolean(user.admin)}:null;
  const api=express.Router();
  app.use((req,res,next)=>{
    if(secure)res.set("Strict-Transport-Security","max-age=31536000");
    if(publicRelease&&req.hostname==="www.nichodev.com")return res.redirect(308,"https://nichodev.com/"+req.originalUrl.replace(/^\/+/,""));
    if(!publicRelease||!["/","/index.html","/voz.html","/guitarra.html","/mixmaster.html","/downloads.html","/onda/","/comunidade","/comunidade/","/comunidade/privacy.html","/comunidade/rules.html","/sitemap.xml","/robots.txt"].includes(req.path))res.set("X-Robots-Tag","noindex, nofollow");
    res.set({"X-Content-Type-Options":"nosniff","Referrer-Policy":"same-origin","Cache-Control":"no-store","Content-Security-Policy":"default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});
    next();
  });
  api.use((req,res,next)=>{
    try{
      if(!["GET","HEAD"].includes(req.method)){
        if(req.get("origin")!==app.locals.origin||req.get("x-nichodev-client")!=="1")fail(403,"Origem da solicitação inválida.");
        rate(req,"write",150);
      }
      next();
    }catch(error){next(error);}
  });
  api.use(express.json({limit:"32kb",inflate:false}));
  api.use((req,res,next)=>{if(!["GET","HEAD"].includes(req.method)&&req.path!=="/media"&&(!req.body||typeof req.body!=="object"||Array.isArray(req.body)))return next(Object.assign(new Error("Envie os campos em JSON."),{status:400}));next();});
  api.get("/session",(req,res)=>res.json({user:safeUser(actor(req)),publicRelease}));
  api.get("/operations/proxy",(req,res)=>{
    if(!probeToken||!crypto.timingSafeEqual(Buffer.from(digest(req.get("X-Nichodev-Probe")||""),"hex"),Buffer.from(digest(probeToken),"hex")))fail(404,"Recurso não encontrado.");
    res.json({socketAddress:req.socket.remoteAddress??null,forwarded:req.get("x-forwarded-for")||null,selectedIP:req.ip??null});
  });
  api.get("/account/export",(req,res)=>{
    const user=auth(req);rate(req,"export",5,3600000);
    const record=get("SELECT username,created FROM users WHERE id=?",user.id);
    const palette=get("SELECT colors FROM user_palettes WHERE user_id=?",user.id);
    res.attachment("nichodev-meus-dados.json").json({account:record,palette:palette?JSON.parse(palette.colors):null,creations:all("SELECT c.*,u.username FROM creations c JOIN users u ON u.id=c.owner WHERE c.owner=?",user.id).map(item),favorites:all("SELECT creation_id FROM favorites WHERE user_id=?",user.id).map(row=>row.creation_id),audio:all("SELECT id FROM media WHERE owner=?",user.id).map(row=>({id:row.id,url:app.locals.origin+"/api/community/media/"+row.id})),audioNote:"Os links de áudio exigem sua sessão ativa; baixe os WAV antes de excluir a conta."});
  });
  api.delete("/account",async(req,res)=>{
    const user=auth(req);rate(req,"delete-account",5,3600000);
    if(req.body.confirm!==user.username)fail(400,"Digite seu usuário para confirmar a exclusão.");
    const record=get("SELECT password FROM users WHERE id=?",user.id);
    if(!await verify(password(req.body.password),record.password))fail(400,"A senha atual não confere.");
    transaction(db,()=>{
      if(get("SELECT password FROM users WHERE id=?",user.id)?.password!==record.password)fail(409,"A conta mudou. Entre novamente.");
      if(user.admin&&!get("SELECT id FROM users WHERE admin=1 AND active=1 AND id<>?",user.id))fail(409,"Designe outro administrador antes de excluir esta conta.");
      run("DELETE FROM favorites WHERE creation_id IN (SELECT id FROM creations WHERE owner=?)",user.id);
      run("DELETE FROM creations WHERE owner=?",user.id);run("DELETE FROM media WHERE owner=?",user.id);
      run("DELETE FROM users WHERE id=?",user.id);
    });
    res.clearCookie(cookieName,cookieOptions);res.status(204).end();
  });
  api.get("/palette",(req,res)=>{
    const user=auth(req),record=get("SELECT colors FROM user_palettes WHERE user_id=?",user.id);
    res.json({palette:record?JSON.parse(record.colors):null});
  });
  api.put("/palette",(req,res)=>{
    const user=auth(req),colors=req.body?.palette;
    if(!validPalette(colors))fail(400,"Escolha cinco cores válidas com contraste suficiente.");
    run("INSERT INTO user_palettes(user_id,colors) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET colors=excluded.colors",user.id,JSON.stringify(colors));
    res.json({palette:colors});
  });
  api.post("/register",async(req,res)=>{
    rate(req,"register",6,3600000);
    const name=username(req.body.username),pass=password(req.body.password);
    if(bootstrapToken&&(name!==bootstrapUser||!crypto.timingSafeEqual(Buffer.from(digest(req.get("X-Nichodev-Bootstrap")||""),"hex"),Buffer.from(digest(bootstrapToken),"hex"))))fail(403,"Os cadastros estão temporariamente restritos à configuração da administração.");
    if(["nichodev","sistema"].includes(name)||get("SELECT id FROM users WHERE username=?",name))fail(409,"Esse usuário não está disponível.");
    const passHash=await hash(await newPassword(pass)),key=random(),confirmation=random(),id=uuid();
    const invitedAdmin=Boolean(bootstrapToken&&name===bootstrapUser&&!get("SELECT id FROM users WHERE admin=1 AND active=1"));
    try{run("INSERT INTO users(id,username,password,recovery,confirmation,confirmation_expiry,created,admin) VALUES(?,?,?,?,?,?,?,?)",id,name,passHash,digest(key),digest(confirmation),now()+1800000,now(),invitedAdmin?1:0);}
    catch(error){if(error.code?.startsWith("ERR_SQLITE"))fail(409,"Esse usuário não está disponível.");throw error;}
    res.cookie(cookieName+"_pending",confirmation,{...cookieOptions,maxAge:1800000});
    res.status(201).json({recoveryKey:key,username:name});
  });
  api.post("/register/confirm",(req,res)=>{
    const token=cookies(req)[cookieName+"_pending"],pending=token&&get("SELECT id FROM users WHERE confirmation=? AND active=0 AND confirmation_expiry>?",digest(token),now());
    if(!pending||req.body.saved!==true)fail(400,"Confirme que guardou a chave. Se a etapa expirou, cadastre novamente.");
    transaction(db,()=>{run("UPDATE users SET active=1,confirmation=NULL,confirmation_expiry=NULL WHERE id=?",pending.id);setSession(res,pending.id);});
    res.clearCookie(cookieName+"_pending",cookieOptions);res.json({user:safeUser(get("SELECT id,username,admin FROM users WHERE id=?",pending.id))});
  });
  api.post("/register/cancel",(req,res)=>{
    const token=cookies(req)[cookieName+"_pending"];if(token)run("DELETE FROM users WHERE confirmation=? AND active=0",digest(token));
    res.clearCookie(cookieName+"_pending",cookieOptions);res.status(204).end();
  });
  api.post("/login",async(req,res)=>{
    rate(req,"login",15);
    const name=username(req.body.username),pass=password(req.body.password),user=get("SELECT * FROM users WHERE username=? AND active=1",name);
    guard.consume(["account",name,"login"],30,60000);
    const valid=await verify(pass,user?.password||("0".repeat(32)+":"+"0".repeat(128)));
    if(!user||!valid)fail(401,"Usuário ou senha inválidos.");
    transaction(db,()=>{if(get("SELECT password FROM users WHERE id=? AND active=1",user.id)?.password!==user.password)fail(401,"Usuário ou senha inválidos.");const old=cookies(req)[cookieName];if(old)run("DELETE FROM sessions WHERE token=?",digest(old));setSession(res,user.id);});
    res.json({user:safeUser(user)});
  });
  api.post("/logout",(req,res)=>{
    const token=cookies(req)[cookieName];if(token)run("DELETE FROM sessions WHERE token=?",digest(token));
    res.clearCookie(cookieName,cookieOptions);res.status(204).end();
  });
  api.post("/recover",async(req,res)=>{
    rate(req,"recover",8);
    const name=username(req.body.username),key=text(req.body.recoveryKey,100),pass=password(req.body.password);
    const user=get("SELECT * FROM users WHERE username=? AND active=1",name);
    guard.consume(["account",name,"recover"],10,60000);
    if(!user||digest(key)!==user.recovery)fail(400,"Confira o usuário e a chave de recuperação.");
    const passHash=await hash(await newPassword(pass)),nextKey=random();
    transaction(db,()=>{
      const result=run("UPDATE users SET password=?,recovery=? WHERE id=? AND recovery=?",passHash,digest(nextKey),user.id,user.recovery);
      if(result.changes!==1)fail(400,"Confira o usuário e a chave de recuperação.");
      run("DELETE FROM sessions WHERE user_id=?",user.id);
    });
    res.clearCookie(cookieName,cookieOptions);res.json({recoveryKey:nextKey,username:name});
  });
  api.post("/password",async(req,res)=>{
    const user=auth(req);rate(req,"password",8);
    const current=password(req.body.current),record=get("SELECT password FROM users WHERE id=?",user.id);
    if(!await verify(current,record.password))fail(400,"A senha atual não confere.");
    const passHash=await hash(await newPassword(password(req.body.password)));
    transaction(db,()=>{const result=run("UPDATE users SET password=? WHERE id=? AND password=?",passHash,user.id,record.password);if(result.changes!==1)fail(409,"A conta mudou. Entre novamente.");run("DELETE FROM sessions WHERE user_id=?",user.id);});
    res.clearCookie(cookieName,cookieOptions);res.status(204).end();
  });
  api.post("/recovery-key",async(req,res)=>{
    const user=auth(req);rate(req,"key",8);
    const record=get("SELECT password,recovery FROM users WHERE id=?",user.id);
    if(!await verify(password(req.body.current),record.password))fail(400,"A senha atual não confere.");
    const key=random();
    const result=run("UPDATE users SET recovery=? WHERE id=? AND password=? AND recovery=?",digest(key),user.id,record.password,record.recovery);
    if(result.changes!==1)fail(409,"A conta mudou. Entre novamente.");
    res.json({recoveryKey:key,username:user.username});
  });

  api.post("/admin/reauth",async(req,res)=>{
    const user=auth(req);if(!user.admin)fail(403,"Acesso restrito à administração.");rate(req,"admin-reauth",8);
    const record=get("SELECT password FROM users WHERE id=?",user.id);
    if(!await verify(password(req.body.current),record.password))fail(400,"A senha atual não confere.");
    transaction(db,()=>{
      if(get("SELECT password FROM users WHERE id=? AND admin=1 AND active=1",user.id)?.password!==record.password)fail(409,"A conta mudou. Entre novamente.");
      const changed=run("INSERT INTO session_auth(token,authenticated) SELECT token,? FROM sessions WHERE token=? AND user_id=? AND expires>? ON CONFLICT(token) DO UPDATE SET authenticated=excluded.authenticated",now(),digest(cookies(req)[cookieName]),user.id,now());
      if(!changed.changes)fail(401,"Entre na sua conta para continuar.");
    });
    res.status(204).end();
  });

  api.post("/feedback",(req,res)=>{
    rate(req,"feedback",10,3600000);
    const tool=select(req.body.tool,["voz","guitarra","mixmaster","site"]),experience=select(req.body.experience,["bem","dificuldade","problema"]);
    const comment=text(req.body.comment??"",1200,false),contact=text(req.body.contact??"",254,false);
    if(contact&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))fail(400,"Confira o e-mail para resposta.");
    if(get("SELECT COUNT(*) AS n FROM feedback").n>=10000)fail(503,"O recebimento está temporariamente indisponível. Tente mais tarde.");
    const id=uuid();run("INSERT INTO feedback(id,tool,experience,comment,contact,created) VALUES(?,?,?,?,?,?)",id,tool,experience,comment,contact,now());
    res.status(201).json({id});
  });
  api.get("/admin/feedback",(req,res)=>{admin(req);res.json({items:all("SELECT * FROM feedback ORDER BY created DESC LIMIT 100")});});
  api.patch("/admin/feedback/:id",(req,res)=>{
    admin(req);const state=select(req.body.status,["recebido","analise","concluido"]);
    if(!run("UPDATE feedback SET status=? WHERE id=?",state,req.params.id).changes)fail(404,"Avaliação não encontrada.");
    res.status(204).end();
  });

  function creation(id){const row=get("SELECT c.*,u.username FROM creations c JOIN users u ON u.id=c.owner WHERE c.id=?",id);if(!row)fail(404,"Criação não encontrada.");return row;}
  function mayRead(row,req){const user=actor(req);return user?.id===row.owner||Boolean(user?.admin)||(row.visibility==="public"&&row.status==="approved")||(row.visibility==="unlisted"&&row.share_hash&&digest(String(req.query.key||""))===row.share_hash);}
  function visible(row,req){if(!mayRead(row,req))fail(404,"Criação não encontrada.");return row;}
  function item(row){return {id:row.id,title:row.title,description:row.description,tool:row.tool,kind:row.kind,author:row.username,owner:row.owner,visibility:row.visibility,status:row.status,version:row.version,preset:row.preset?JSON.parse(row.preset):null,mediaId:row.media_id,created:row.created};}
  api.get("/creations",(req,res)=>{
    res.json({items:all("SELECT c.*,u.username FROM creations c JOIN users u ON u.id=c.owner WHERE c.visibility='public' AND c.status='approved' ORDER BY c.created DESC LIMIT 100").map(item)});
  });
  api.get("/me",(req,res)=>{
    const user=auth(req);
    res.json({items:all("SELECT c.*,u.username FROM creations c JOIN users u ON u.id=c.owner WHERE c.owner=? ORDER BY c.created DESC LIMIT 100",user.id).map(item),favorites:all("SELECT creation_id FROM favorites WHERE user_id=?",user.id).map(row=>row.creation_id)});
  });
  api.get("/creations/:id",(req,res)=>res.json({item:item(visible(creation(req.params.id),req))}));
  function fields(body,owner){
    const kind=select(body.kind,["preset","audio"]),tool=select(body.tool,["voz","guitarra","mixmaster"]),visibility=select(body.visibility,["private","unlisted","public"]);
    const title=text(body.title,60),description=text(body.description,240);
    let preset=null;
    if(body.preset){try{preset=validatePreset(body.preset);}catch{fail(400,"Preset inválido ou incompatível.");}if(preset.tool!==tool)fail(400,"A ferramenta não corresponde ao preset.");}
    if(kind==="preset"&&(!preset||tool==="mixmaster"))fail(400,"Capture um preset na ferramenta antes de compartilhar.");
    const mediaId=body.mediaId??null;
    if(mediaId!==null&&typeof mediaId!=="string")fail(400,"Envie uma prévia de áudio válida.");
    if(mediaId!==null&&(!get("SELECT id FROM media WHERE id=? AND owner=?",mediaId,owner)))fail(400,"Envie uma prévia de áudio válida.");
    if(kind==="audio"&&!mediaId)fail(400,"Envie um arquivo WAV para a prévia.");
    return {kind,tool,visibility,title,description,preset:preset?JSON.stringify(preset):null,mediaId};
  }
  api.post("/creations",(req,res)=>{
    const user=auth(req);rate(req,"create",30,3600000);
    if(get("SELECT COUNT(*) AS n FROM creations WHERE owner=?",user.id).n>=100)fail(400,"Limite de 100 criações. Exclua uma criação antes de adicionar outra.");
    const value=fields(req.body,user.id),id=uuid();
    run("INSERT INTO creations(id,owner,kind,tool,title,description,visibility,preset,media_id,created) VALUES(?,?,?,?,?,?,?,?,?,?)",id,user.id,value.kind,value.tool,value.title,value.description,value.visibility,value.preset,value.mediaId,now());
    res.status(201).json({item:item(creation(id))});
  });
  api.patch("/creations/:id",(req,res)=>{
    const user=auth(req),current=creation(req.params.id);if(current.owner!==user.id)fail(403,"Esta criação pertence a outra conta.");
    if(req.body.version!==current.version)fail(409,"Esta criação foi alterada em outra aba. Reabra antes de editar.");
    const value=fields({...item(current),...req.body},user.id);
    transaction(db,()=>{
      run("UPDATE creations SET kind=?,tool=?,title=?,description=?,visibility=?,preset=?,media_id=?,status='pending',share_hash=NULL,version=version+1 WHERE id=?",value.kind,value.tool,value.title,value.description,value.visibility,value.preset,value.mediaId,current.id);
      if(current.media_id&&current.media_id!==value.mediaId)run("DELETE FROM media WHERE id=? AND id NOT IN (SELECT media_id FROM creations WHERE media_id IS NOT NULL)",current.media_id);
    });
    res.json({item:item(creation(current.id))});
  });
  api.delete("/creations/:id",(req,res)=>{
    const user=auth(req),current=creation(req.params.id);if(current.owner!==user.id)fail(403,"Esta criação pertence a outra conta.");
    if(req.body.version!==current.version)fail(409,"Esta criação foi alterada em outra aba. Reabra antes de excluir.");
    transaction(db,()=>{run("DELETE FROM creations WHERE id=?",current.id);if(current.media_id)run("DELETE FROM media WHERE id=? AND id NOT IN (SELECT media_id FROM creations WHERE media_id IS NOT NULL)",current.media_id);});
    res.status(204).end();
  });
  api.post("/creations/:id/favorite",(req,res)=>{
    const user=auth(req),current=visible(creation(req.params.id),req);
    if(req.body.enabled===true)run("INSERT OR IGNORE INTO favorites VALUES(?,?)",user.id,current.id);
    else if(req.body.enabled===false)run("DELETE FROM favorites WHERE user_id=? AND creation_id=?",user.id,current.id);
    else fail(400,"Escolha favoritar ou remover favorito.");
    res.status(204).end();
  });
  api.post("/creations/:id/share",(req,res)=>{
    const user=auth(req),current=creation(req.params.id);if(current.owner!==user.id)fail(403,"Esta criação pertence a outra conta.");
    if(current.visibility==="private")fail(400,"Altere a visibilidade antes de compartilhar.");
    if(current.visibility==="public"&&current.status!=="approved")fail(400,"A publicação aguarda moderação.");
    const key=current.visibility==="unlisted"?random():null;
    run("UPDATE creations SET share_hash=? WHERE id=?",key?digest(key):null,current.id);
    res.json({url:app.locals.origin+"/comunidade/#criacao/"+current.id+(key?"?key="+key:"")});
  });
  api.post("/media",(req,res,next)=>{try{auth(req);rate(req,"media",20,3600000);next();}catch(error){next(error);}},express.raw({type:"audio/wav",limit:"10mb",inflate:false}),(req,res)=>{
    const user=auth(req);validateWav(req.body);
    transaction(db,()=>{
      const used=get("SELECT COALESCE(SUM(length(audio)),0) AS n FROM media WHERE owner=?",user.id).n;
      if(get("SELECT COALESCE(SUM(length(audio)),0) AS n FROM media").n+req.body.length>500*1024*1024)fail(503,"O armazenamento de áudio está temporariamente cheio.");
      if(used+req.body.length>50*1024*1024)fail(413,"Sua conta atingiu 50 MB de áudio.");
      const id=uuid();run("INSERT INTO media VALUES(?,?,?,?)",id,user.id,req.body,now());res.status(201).json({id});
    });
  });
  api.get("/media/:id",(req,res)=>{
    rate(req,"media-read",120,60000);
    const media=get("SELECT id,owner,length(audio) AS size FROM media WHERE id=?",req.params.id);if(!media)fail(404,"Áudio não encontrado.");
    const user=actor(req),rows=all("SELECT c.*,u.username FROM creations c JOIN users u ON u.id=c.owner WHERE c.media_id=?",media.id);
    if(user?.id!==media.owner&&!rows.some(row=>mayRead(row,req)))fail(404,"Áudio não encontrado.");
    res.type("audio/wav").set("Accept-Ranges","bytes");
    if(req.method==="HEAD")return res.set("Content-Length",String(media.size)).end();
    const range=byteRange(req.get("If-Range")?null:req.get("Range"),media.size);
    if(!range)return res.status(416).set("Content-Range","bytes */"+media.size).end();
    const length=range.end-range.start+1;
    rate(req,"media-bytes",32*1024*1024,60000,length);guard.consume(["global","media-bytes"],128*1024*1024,60000,length);
    const scopes=[[["global","media-transfer"],4],[["ip",req.ip,"media-transfer"],2]];
    if(user)scopes.push([["user",user.id,"media-transfer"],2]);
    const release=guard.reserve(scopes);
    const timeout=setTimeout(()=>res.destroy(),30000);timeout.unref();
    const done=()=>{clearTimeout(timeout);try{release();}catch{console.error("Não foi possível liberar a reserva de áudio; ela expirará automaticamente.");}};
    res.once("finish",done);res.once("close",done);
    try{
      const audio=get("SELECT substr(audio,?,?) AS audio FROM media WHERE id=?",range.start+1,length,media.id).audio;
      if(range.partial)res.status(206).set("Content-Range","bytes "+range.start+"-"+range.end+"/"+media.size);
      res.set("Content-Length",String(length)).end(Buffer.from(audio.buffer,audio.byteOffset,audio.byteLength));
    }catch(error){done();throw error;}
  });
  api.get("/admin/creations",(req,res)=>{
    admin(req);res.json({items:all("SELECT c.*,u.username FROM creations c JOIN users u ON u.id=c.owner WHERE c.visibility='public' AND c.status='pending' ORDER BY c.created LIMIT 100").map(item)});
  });
  api.patch("/admin/creations/:id",(req,res)=>{
    admin(req);const state=select(req.body.status,["approved","hidden"]);
    if(!run("UPDATE creations SET status=?,version=version+1 WHERE id=?",state,req.params.id).changes)fail(404,"Criação não encontrada.");
    res.status(204).end();
  });
  app.use("/api/community",api);
  app.get(["/comunidade","/comunidade/"],(req,res,next)=>{
    fs.readFile(path.join(publicDir,"index.html"),"utf8",(error,html)=>{
      if(error)return next(error);
      if(publicRelease){
        html=html.replace('<meta name="robots" content="noindex,nofollow">','<meta name="robots" content="index,follow"><link rel="canonical" href="https://nichodev.com/comunidade/">')
          .replace("Comunidade — homologação · nichodev.com","Comunidade de áudio · nichodev.com")
          .replace("<strong>HOMOLOGAÇÃO</strong>","<strong>COMUNIDADE</strong>")
          .replace("Homologação com backend · dados salvos neste ambiente · conteúdo público depende de moderação.","Crie, compartilhe e experimente · publicações públicas passam por moderação.")
          .replace("Seus dados são salvos neste ambiente de homologação.","Seus dados são salvos na comunidade nichodev.com.");
        res.removeHeader("X-Robots-Tag");
      }
      res.type("html").send(html);
    });
  });
  app.get("/health",(req,res)=>{get("SELECT 1");res.json({status:"ok"});});
  app.get("/community/preset-format.js",(req,res)=>res.sendFile(path.join(__dirname,"preset-format.js")));
  app.get("/community/palette-format.js",(req,res)=>res.sendFile(path.join(__dirname,"palette-format.js")));
  app.get("/community/tool-bridge.js",(req,res)=>res.sendFile(path.join(__dirname,"tool-bridge.js")));
  const pageDir=path.join(path.dirname(siteDir),"server-pages");
  function readPage(file,done){
    fs.readFile(path.join(siteDir,file),"utf8",(error,html)=>{
      if(error?.code==="ENOENT")return fs.readFile(path.join(pageDir,file),"utf8",done);
      done(error,html);
    });
  }
  function renderPage(file,integrated=false){
    return (req,res,next)=>readPage(file,(error,html)=>{
      if(error)return next(error);
      if(integrated)html=html.replace(/\b(src|href)=(?:"([^"]*)"|'([^']*)')/g,(attribute,name,double,single)=>{
        const value=double??single;
        if(/^(?:[a-z][\w+.-]*:|\/|#)/i.test(value))return attribute;
        const prefix=/^(?:voz|guitarra)\.html(?:[?#]|$)/.test(value)?"/comunidade/ferramentas/":"/";
        const quote=double!==undefined?'"':"'";
        return name+"="+quote+prefix+value+quote;
      });
      const nonce=crypto.randomBytes(18).toString("base64");
      res.set("Content-Security-Policy",res.get("Content-Security-Policy").replace("script-src 'self'","script-src 'self' 'nonce-"+nonce+"'"));
      html=html.replace(/<script\b/g,'<script nonce="'+nonce+'"');
      if(integrated)html=html.replace("</body>",'<script src="/community/preset-format.js" defer></script><script src="/community/tool-bridge.js" defer></script></body>');
      res.type("html").send(html);
    });
  }
  for(const file of ["voz.html","guitarra.html"])app.get("/comunidade/ferramentas/"+file,renderPage(file,true));
  app.get("/onda",(req,res,next)=>req.path==="/onda/"?next():res.redirect(308,"/onda/"+req.originalUrl.slice(req.path.length)));
  for(const [route,file]of Object.entries(publicPages))app.get(route,renderPage(file));
  app.use("/onda",express.static(path.join(pageDir,"onda"),{index:false}));
  app.use("/comunidade",express.static(publicDir,{index:"index.html"}));
  app.use(express.static(siteDir));
  app.use((error,req,res,next)=>{
    if(res.headersSent)return next(error);
    const status=error.status||500;
    if(status===429||error.retryAfter)res.set("Retry-After",String(error.retryAfter||600));
    res.status(status).json({...((error.code==="ADMIN_REAUTH_REQUIRED")?{code:error.code}:{}),error:status===500?"Não foi possível concluir. Seus dados não foram confirmados; tente novamente.":status===413?"Arquivo ou solicitação acima do limite permitido.":error.message});
  });
  return app;
}
module.exports={createCommunityApp,validateWav,publicPages};
