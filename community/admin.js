const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {transaction}=require('./store');
const {encode,match,cipher}=require('./mfa');
const defaults={registrationsOpen:true,publicationOpen:true,maintenanceMessage:'',uploadMB:10,accountAudioMB:50,totalAudioMB:500,creationLimit:100,rolloutPercent:100,rules:'Publicações públicas passam por moderação.',features:{reports:true,assistedRecovery:true}};
const permissions={owner:['users','recovery','moderate','stats','operations','settings','roles','audit','feedback'],admin:['users','recovery','moderate','stats','operations','settings','audit','feedback'],moderator:['moderate']};
function installAdmin(c){
  const {api,db,dbPath,auth,actor,passwordAdmin,rate,now,get,all,run,fail,text,select,digest,random,uuid,cookies,cookieName,verify,password,newPassword,hash,item,creation,visible}=c;
  const encryption=cipher(get('SELECT secret FROM security_config WHERE id=1').secret);
  function role(user){return get('SELECT role FROM user_controls WHERE user_id=?',user.id)?.role||(user.admin?'admin':'member');}
  function staff(req){const u=passwordAdmin(req);return {...u,role:role(u)};}
  function audit(user,action,target,reason,result='ok'){run('INSERT INTO admin_audit(actor_id,actor_name,action,target,reason,result,created) VALUES(?,?,?,?,?,?,?)',user.id,user.username,action,target,reason,result,now());}
  function admin(req,permission='moderate'){
    const u=staff(req);
    if(!permissions[u.role]?.includes(permission))fail(403,'Seu papel não permite esta ação.');
    const token=digest(cookies(req)[cookieName]);
    if(!get('SELECT user_id FROM admin_mfa WHERE user_id=? AND enabled=1',u.id))throw Object.assign(Error('Configure o segundo fator para acessar a administração.'),{status:403,code:'ADMIN_MFA_SETUP_REQUIRED'});
    if(!get('SELECT token FROM session_mfa WHERE token=? AND verified>?',token,now()-10*60000))throw Object.assign(Error('Confirme o código do autenticador.'),{status:403,code:'ADMIN_MFA_REQUIRED'});
    return u;
  }
  function settings(){const row=get('SELECT * FROM community_settings WHERE id=1');return {value:row?JSON.parse(row.value):structuredClone(defaults),version:row?.version||0};}
  function enabled(user){return parseInt(digest(user.id).slice(0,8),16)%100<settings().value.rolloutPercent;}
  function controls(id){return get('SELECT * FROM user_controls WHERE user_id=?',id)||{role:'member',suspended:0,publish_until:0,last_seen:null};}
  function touch(user){if(!user)return;const day=new Date(now()).toISOString().slice(0,10);run('INSERT OR IGNORE INTO daily_activity VALUES(?,?)',user.id,day);run("INSERT INTO user_controls(user_id,last_seen,role) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen=excluded.last_seen WHERE last_seen IS NULL OR last_seen<?",user.id,Math.floor(now()/3600000)*3600000,user.admin?'admin':'member',now()-3600000);}
  function publish(user,visibility){if(visibility!=='public')return;if(!settings().value.publicationOpen||controls(user.id).publish_until>now())fail(403,'Publicações temporariamente bloqueadas. Consulte as notificações.');}
  function page(req){const page=Number(req.query.page??1),size=Number(req.query.size??25);if(!Number.isSafeInteger(page)||page<1||page>1000000||!Number.isSafeInteger(size)||size<1||size>100)fail(400,'Paginação inválida.');return {page,size,offset:(page-1)*size};}
  function list(req,res,sql,count,params=[],map=x=>x){const p=page(req);res.json({items:all(sql+' LIMIT ? OFFSET ?',...params,p.size,p.offset).map(map),total:get(count,...params).n,page:p.page,size:p.size});}
  function reason(req){return text(req.body.reason,500);}
  function target(id){const user=get('SELECT id,username,admin,active FROM users WHERE id=?',id);if(!user)fail(404,'Conta não encontrada.');return {...user,role:role(user)};}
  function mayManage(user,t){if(t.id===user.id||(user.role!=='owner'&&t.role!=='member'))fail(403,'Esta conta exige outro proprietário ou não pode ser alterada por você.');}
  function notice(id,message){run('INSERT INTO notices(user_id,message,created) VALUES(?,?,?)',id,message,now());}
  function verifyMfa(user,code){
    const row=get('SELECT * FROM admin_mfa WHERE user_id=?',user.id);
    if(!row||(!row.enabled&&now()-row.created>10*60000))fail(400,'Inicie a configuração do autenticador novamente.');
    const step=match(encryption.open(row.secret),code,row.last_step,now());
    if(step===null)fail(400,'Código inválido, expirado ou já utilizado.');
    if(!run('UPDATE admin_mfa SET last_step=? WHERE user_id=? AND last_step<?',step,user.id,step).changes)fail(409,'Código já utilizado.');
    return row;
  }
  api.get('/admin/access',(req,res)=>{const u=staff(req);res.json({role:u.role,permissions:permissions[u.role]||[],enrolled:Boolean(get('SELECT user_id FROM admin_mfa WHERE user_id=? AND enabled=1',u.id))});});
  api.post('/admin/mfa/setup',async(req,res)=>{
    const u=staff(req);rate(req,'mfa-setup',5,3600000);
    const record=get('SELECT password,recovery FROM users WHERE id=?',u.id);
    if(!await verify(password(req.body.current),record.password)||digest(text(req.body.recoveryKey,100))!==record.recovery)fail(400,'Senha ou chave de recuperação inválida.');
    const secret=encode(crypto.randomBytes(20));
    transaction(db,()=>{
      staff(req);if(get('SELECT password,recovery FROM users WHERE id=?',u.id)?.password!==record.password||get('SELECT recovery FROM users WHERE id=?',u.id)?.recovery!==record.recovery)fail(409,'A conta mudou. Entre novamente.');
      if(get('SELECT user_id FROM admin_mfa WHERE user_id=? AND enabled=1',u.id))fail(409,'O segundo fator já está configurado.');
      run('INSERT INTO admin_mfa VALUES(?,?,0,-1,?) ON CONFLICT(user_id) DO UPDATE SET secret=excluded.secret,last_step=-1,created=excluded.created',u.id,encryption.seal(secret),now());audit(u,'mfa.setup',u.id,'Configuração iniciada');
    });
    res.json({secret,uri:'otpauth://totp/'+encodeURIComponent('Nichodev:'+u.username)+'?secret='+secret+'&issuer=Nichodev&algorithm=SHA1&digits=6&period=30'});
  });
  api.post('/admin/mfa/verify',(req,res)=>{
    const u=staff(req);rate(req,'mfa-verify',8);let codes;
    transaction(db,()=>{
      const row=verifyMfa(u,req.body.code);
      if(!row.enabled){codes=Array.from({length:8},()=>random().slice(0,20));run('UPDATE admin_mfa SET enabled=1 WHERE user_id=?',u.id);run('DELETE FROM mfa_backup WHERE user_id=?',u.id);for(const code of codes)run('INSERT INTO mfa_backup VALUES(?,?)',u.id,digest(code));}
      run('INSERT INTO session_mfa VALUES(?,?) ON CONFLICT(token) DO UPDATE SET verified=excluded.verified',digest(cookies(req)[cookieName]),now());audit(u,'mfa.verify',u.id,'Segundo fator confirmado');
    });res.json({backupCodes:codes||[]});
  });
  api.post('/admin/mfa/backup',(req,res)=>{
    const u=staff(req);rate(req,'mfa-backup',5,3600000);
    transaction(db,()=>{
      if(!run('DELETE FROM mfa_backup WHERE user_id=? AND hash=?',u.id,digest(text(req.body.code,100))).changes)fail(400,'Código de emergência inválido ou utilizado.');
      run('DELETE FROM admin_mfa WHERE user_id=?',u.id);run('DELETE FROM mfa_backup WHERE user_id=?',u.id);run('DELETE FROM sessions WHERE user_id=? AND token<>?',u.id,digest(cookies(req)[cookieName]));run('DELETE FROM session_mfa WHERE token=?',digest(cookies(req)[cookieName]));audit(u,'mfa.reset',u.id,'Código de emergência utilizado; novo cadastro de MFA obrigatório');
    });res.status(204).end();
  });
  api.get('/admin/users',(req,res)=>{
    admin(req,'users');const query=text(req.query.q||'',24,false).toLowerCase(),filter=select(req.query.status||'all',['all','active','suspended','pending']);
    const where=" WHERE u.username LIKE ? ESCAPE '\\' AND (?='all' OR (?='pending' AND u.active=0) OR (?='suspended' AND COALESCE(x.suspended,0)=1) OR (?='active' AND u.active=1 AND COALESCE(x.suspended,0)=0))";
    const params=[query.replace(/[\\%_]/g,'\\$&')+'%',filter,filter,filter,filter];
    list(req,res,"SELECT u.id,u.username,u.created,u.active,COALESCE(x.role,CASE WHEN u.admin=1 THEN 'admin' ELSE 'member' END) role,COALESCE(x.suspended,0) suspended,COALESCE(x.publish_until,0) publish_until,x.last_seen,(SELECT COUNT(*) FROM creations c WHERE c.owner=u.id) creations FROM users u LEFT JOIN user_controls x ON x.user_id=u.id"+where+' ORDER BY u.created DESC,u.id',"SELECT COUNT(*) n FROM users u LEFT JOIN user_controls x ON x.user_id=u.id"+where,params);
  });
  api.get('/admin/users/:id/history',(req,res)=>{admin(req,'users');target(req.params.id);list(req,res,'SELECT * FROM admin_audit WHERE target=? ORDER BY id DESC','SELECT COUNT(*) n FROM admin_audit WHERE target=?',[req.params.id]);});
  api.patch('/admin/users/:id',(req,res)=>{
    const u=admin(req,'users'),t=target(req.params.id),why=reason(req),action=select(req.body.action,['suspend','reactivate','sessions','publication-block']);mayManage(u,t);
    const until=Number(req.body.until);if(action==='publication-block'&&(!Number.isSafeInteger(until)||until<0||until>now()+30*86400000||(until!==0&&until<=now())))fail(400,'Use um prazo futuro de até 30 dias ou zero para liberar.');
    transaction(db,()=>{
      run('INSERT OR IGNORE INTO user_controls(user_id,role) VALUES(?,?)',t.id,t.role);
      if(action==='suspend')run('UPDATE user_controls SET suspended=1 WHERE user_id=?',t.id);
      if(action==='reactivate')run('UPDATE user_controls SET suspended=0 WHERE user_id=?',t.id);
      if(action==='publication-block')run('UPDATE user_controls SET publish_until=? WHERE user_id=?',until,t.id);
      if(action==='suspend'||action==='sessions')run('DELETE FROM sessions WHERE user_id=?',t.id);
      notice(t.id,action+': '+why);audit(u,'user.'+action,t.id,why);
    });res.status(204).end();
  });
  api.patch('/admin/users/:id/role',(req,res)=>{
    const u=admin(req,'roles'),t=target(req.params.id),next=select(req.body.role,['member','moderator','admin','owner']),why=reason(req);
    if(t.id===u.id)fail(409,'Outro proprietário deve alterar seu papel.');if(!t.active||controls(t.id).suspended)fail(409,'Confirme e reative a conta antes de alterar seu papel.');
    transaction(db,()=>{
      run('INSERT INTO user_controls(user_id,role) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role',t.id,next);run('UPDATE users SET admin=? WHERE id=?',next==='member'?0:1,t.id);run('DELETE FROM sessions WHERE user_id=?',t.id);audit(u,'user.role',t.id,why+' ['+t.role+' → '+next+']');
    });res.status(204).end();
  });
  api.post('/recovery-requests',(req,res)=>{
    rate(req,'assisted-recovery',5,3600000);if(!settings().value.features.assistedRecovery)fail(503,'Recuperação assistida indisponível.');
    const name=text(req.body.username,24).toLowerCase();c.guard.consume(['account',name,'assisted-recovery'],5,3600000);
    const u=get('SELECT * FROM users WHERE username=? AND active=1',name),proof=digest(text(req.body.recoveryKey,100));
    if(!u||u.recovery!==proof||u.admin||controls(u.id).suspended||!enabled(u))fail(400,'Não foi possível verificar esta solicitação. Contas administrativas usam recuperação própria e MFA.');
    const token=random(),id=uuid();transaction(db,()=>{
      run("UPDATE recovery_requests SET status='expired' WHERE user_id=? AND status IN ('pending','approved') AND expires<=?",u.id,now());
      if(get("SELECT id FROM recovery_requests WHERE user_id=? AND status IN ('pending','approved')",u.id))fail(409,'Já existe uma solicitação aberta.');
      run('INSERT INTO recovery_requests(id,user_id,proof_hash,token_hash,expires,created) VALUES(?,?,?,?,?,?)',id,u.id,proof,digest(token),now()+86400000,now());
      run('DELETE FROM sessions WHERE user_id=?',u.id);
    });res.status(201).json({id,token,expires:now()+86400000});
  });
  api.get('/admin/recovery',(req,res)=>{admin(req,'recovery');list(req,res,"SELECT r.id,u.username,r.user_id,r.status,r.reason,r.created,r.expires FROM recovery_requests r JOIN users u ON u.id=r.user_id ORDER BY r.created DESC,r.id",'SELECT COUNT(*) n FROM recovery_requests');});
  api.patch('/admin/recovery/:id',(req,res)=>{
    const u=admin(req,'recovery'),state=select(req.body.status,['approved','denied']),why=reason(req);
    transaction(db,()=>{
      const r=get('SELECT * FROM recovery_requests WHERE id=?',req.params.id);if(!r)fail(404,'Solicitação não encontrada.');
      if(!run("UPDATE recovery_requests SET status=?,reason=? WHERE id=? AND status='pending' AND expires>? AND proof_hash=(SELECT recovery FROM users WHERE id=user_id)",state,why,r.id,now()).changes)fail(409,'Solicitação expirada ou já revisada.');
      run('DELETE FROM sessions WHERE user_id=?',r.user_id);audit(u,'recovery.'+state,r.user_id,why);
    });res.status(204).end();
  });
  api.post('/recovery-requests/:id/complete',async(req,res)=>{
    rate(req,'assisted-complete',5,3600000);const token=digest(text(req.body.token,100)),r=get("SELECT r.* FROM recovery_requests r JOIN users u ON u.id=r.user_id LEFT JOIN user_controls x ON x.user_id=u.id WHERE r.id=? AND r.token_hash=? AND r.status='approved' AND r.expires>? AND r.proof_hash=u.recovery AND u.active=1 AND u.admin=0 AND COALESCE(x.suspended,0)=0",req.params.id,token,now());
    if(!r)fail(400,'Solicitação indisponível ou ainda não aprovada.');const next=await hash(await newPassword(password(req.body.password))),key=random();
    transaction(db,()=>{
      if(!run("UPDATE recovery_requests SET status='completed' WHERE id=? AND token_hash=? AND status='approved' AND expires>?",r.id,token,now()).changes)fail(409,'Solicitação expirada ou utilizada.');
      if(!run('UPDATE users SET password=?,recovery=? WHERE id=? AND recovery=? AND active=1 AND admin=0 AND NOT EXISTS(SELECT 1 FROM user_controls WHERE user_id=users.id AND suspended=1)',next,digest(key),r.user_id,r.proof_hash).changes)fail(409,'A conta mudou. Reinicie a recuperação.');
      run('DELETE FROM sessions WHERE user_id=?',r.user_id);
    });res.json({recoveryKey:key});
  });
  api.post('/creations/:id/report',(req,res)=>{const u=auth(req);rate(req,'report',10,3600000);if(!settings().value.features.reports||!enabled(u))fail(503,'Denúncias temporariamente indisponíveis.');const row=visible(creation(req.params.id),req),why=reason(req);if(row.owner===u.id||row.visibility!=='public'||row.status!=='approved')fail(404,'Publicação indisponível para denúncia.');if(get("SELECT id FROM reports WHERE creation_id=? AND reporter=? AND status='pending'",row.id,u.id))fail(409,'Denúncia já recebida.');run('INSERT INTO reports(creation_id,reporter,reason,created) VALUES(?,?,?,?)',row.id,u.id,why,now());res.status(201).json({received:true});});
  api.get('/admin/reports',(req,res)=>{admin(req);const state=select(req.query.status||'pending',['pending','reviewed','dismissed']);list(req,res,'SELECT r.id,r.creation_id,c.title,c.owner,r.reason,r.created,r.status FROM reports r JOIN creations c ON c.id=r.creation_id WHERE r.status=? ORDER BY r.id','SELECT COUNT(*) n FROM reports WHERE status=?',[state]);});
  api.patch('/admin/reports/:id',(req,res)=>{const u=admin(req),state=select(req.body.status,['reviewed','dismissed']),why=reason(req);transaction(db,()=>{if(!run("UPDATE reports SET status=? WHERE id=? AND status='pending'",state,req.params.id).changes)fail(409,'Denúncia já revisada ou inexistente.');audit(u,'report.'+state,String(req.params.id),why);});res.status(204).end();});
  api.get('/admin/creations',(req,res)=>{admin(req);const state=select(req.query.status||'pending',['pending','approved','hidden']);list(req,res,"SELECT c.*,u.username,(SELECT COUNT(*) FROM moderation m WHERE m.owner=c.owner AND m.decision='hidden') prior_decisions FROM creations c JOIN users u ON u.id=c.owner WHERE c.visibility='public' AND c.status=? ORDER BY c.created,c.id","SELECT COUNT(*) n FROM creations WHERE visibility='public' AND status=?",[state],r=>({...item(r),priorDecisions:r.prior_decisions}));});
  api.get('/admin/creations/:id/history',(req,res)=>{admin(req);list(req,res,'SELECT id,decision,reason,created FROM moderation WHERE creation_id=? ORDER BY id DESC','SELECT COUNT(*) n FROM moderation WHERE creation_id=?',[req.params.id]);});
  api.patch('/admin/creations/:id',(req,res)=>{
    const u=admin(req),state=select(req.body.status,['approved','hidden','pending']),why=reason(req),row=creation(req.params.id);
    if(!Number.isSafeInteger(req.body.version)||req.body.version<1)fail(400,'Versão inválida.');
    if(row.visibility!=='public')fail(400,'Apenas publicações públicas entram na fila.');
    transaction(db,()=>{
      if(!run('UPDATE creations SET status=?,version=version+1 WHERE id=? AND version=?',state,row.id,req.body.version).changes)fail(409,'Publicação alterada. Recarregue antes de decidir.');
      run('INSERT INTO moderation(creation_id,owner,actor,decision,reason,created) VALUES(?,?,?,?,?,?)',row.id,row.owner,u.id,state,why,now());notice(row.owner,row.title+' — '+state+': '+why);audit(u,'creation.'+state,row.owner,why+' [criação '+row.id+']');
    });res.status(204).end();
  });
  api.get('/notifications',(req,res)=>{const u=auth(req);list(req,res,'SELECT id,message,created FROM notices WHERE user_id=? ORDER BY id DESC','SELECT COUNT(*) n FROM notices WHERE user_id=?',[u.id]);});
  api.post('/creations/:id/use',(req,res)=>{const u=auth(req);rate(req,'preset-use',30,3600000);const row=visible(creation(req.params.id),req);if(row.kind!=='preset'||row.visibility!=='public'||row.status!=='approved')fail(400,'Preset público indisponível.');c.guard.consume(['preset-use',u.id,row.id],1,86400000);run('INSERT INTO preset_usage VALUES(?,?,1) ON CONFLICT(day,creation_id) DO UPDATE SET uses=uses+1',row.id,new Date(now()).toISOString().slice(0,10));res.status(204).end();});
  api.get('/admin/stats',(req,res)=>{admin(req,'stats');const start=now()-30*86400000,day=new Date(start).toISOString().slice(0,10);res.json({since:start,registrations:all("SELECT strftime('%Y-%m-%d',created/1000,'unixepoch') day,COUNT(*) count FROM users WHERE created>=? GROUP BY day ORDER BY day",start),active:all('SELECT day,COUNT(*) count FROM daily_activity WHERE day>=? GROUP BY day ORDER BY day',day),retention:all("SELECT strftime('%Y-%m-%d',u.created/1000,'unixepoch') cohort,COUNT(*) members,SUM(EXISTS(SELECT 1 FROM daily_activity a WHERE a.user_id=u.id AND a.day=date(u.created/1000,'unixepoch','+7 days'))) returnedDay7 FROM users u WHERE u.created BETWEEN ? AND ? GROUP BY cohort ORDER BY cohort",start,now()-8*86400000),presets:all('SELECT c.id,c.title,SUM(p.uses) uses FROM preset_usage p JOIN creations c ON c.id=p.creation_id WHERE p.day>=? GROUP BY c.id ORDER BY uses DESC,c.id LIMIT 10',day),totals:get("SELECT (SELECT COUNT(*) FROM users WHERE active=1) users,(SELECT COUNT(*) FROM creations WHERE visibility='public' AND status='approved') approved,(SELECT COUNT(*) FROM creations WHERE visibility='public' AND status='pending') pending,(SELECT COALESCE(SUM(length(audio)),0) FROM media) audioBytes"),note:'Dias em UTC. Atividade diária retida por 90 dias; sem IP, rota ou histórico de navegação. Uso de presets conta aberturas declaradas, limitado por conta/preset/dia; não comprova uso audível.'});});
  api.get('/admin/settings',(req,res)=>{admin(req,'settings');res.json(settings());});
  api.put('/admin/settings',(req,res)=>{
    const u=admin(req,'settings'),why=reason(req),v=req.body.value;
    if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==Object.keys(defaults).sort().join()||typeof v.registrationsOpen!=='boolean'||typeof v.publicationOpen!=='boolean'||!v.features||Object.keys(v.features).sort().join()!=='assistedRecovery,reports'||Object.values(v.features).some(x=>typeof x!=='boolean'))fail(400,'Configurações inválidas.');
    if(!Number.isSafeInteger(v.rolloutPercent)||v.rolloutPercent<0||v.rolloutPercent>100)fail(400,'Percentual inválido.');
    text(v.maintenanceMessage,240,false);text(v.rules,1000);
    for(const [k,max]of [['uploadMB',10],['accountAudioMB',500],['totalAudioMB',5000],['creationLimit',1000]])if(!Number.isSafeInteger(v[k])||v[k]<1||v[k]>max)fail(400,'Limite inválido: '+k);
    if(v.uploadMB>v.accountAudioMB||v.accountAudioMB>v.totalAudioMB)fail(400,'Os limites de arquivo, conta e ambiente devem ser crescentes.');
    transaction(db,()=>{const old=settings();if(req.body.version!==old.version)fail(409,'Configuração alterada por outra pessoa. Recarregue.');run('INSERT INTO community_settings VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,version=excluded.version',JSON.stringify(v),old.version+1);audit(u,'settings.update','community',why+' [campos: '+Object.keys(v).filter(k=>JSON.stringify(v[k])!==JSON.stringify(old.value[k])).join(', ')+']');});res.json(settings());
  });
  api.get('/admin/audit',(req,res)=>{admin(req,'audit');const target=text(req.query.target||'',100,false);list(req,res,"SELECT * FROM admin_audit WHERE (?='' OR target=?) ORDER BY id DESC","SELECT COUNT(*) n FROM admin_audit WHERE (?='' OR target=?)",[target,target]);});
  api.get('/admin/feedback',(req,res)=>{admin(req,'feedback');const state=select(req.query.status||'all',['all','recebido','analise','concluido']);list(req,res,"SELECT * FROM feedback WHERE (?='all' OR status=?) ORDER BY created DESC,id","SELECT COUNT(*) n FROM feedback WHERE (?='all' OR status=?)",[state,state]);});
  api.patch('/admin/feedback/:id',(req,res)=>{const u=admin(req,'feedback'),state=select(req.body.status,['recebido','analise','concluido']);transaction(db,()=>{if(!run('UPDATE feedback SET status=? WHERE id=?',state,req.params.id).changes)fail(404,'Avaliação não encontrada.');audit(u,'feedback.'+state,req.params.id,'Classificação de avaliação');});res.status(204).end();});
  const dataDir=path.dirname(dbPath);
  function receipt(file,valid){try{const p=path.join(dataDir,file);if(fs.statSync(p).size>32768)return null;const r=JSON.parse(fs.readFileSync(p,'utf8'));return valid(r)?r:null;}catch{return null;}}
  function backups(){
    let local=null;try{local={at:fs.statSync(path.join(dataDir,'latest.sqlite')).mtimeMs};}catch{}
    const offsite=receipt('offsite/last-success.json',r=>r.status==='OFFSITE_BACKUP_OK'&&r.downloadVerified===true&&r.integrity===true&&r.site===new URL(c.app.locals.origin).hostname&&Number.isFinite(r.at)&&r.at<=now()+60000);
    const restore=receipt('restore-status.json',r=>typeof r.ok==='boolean'&&Number.isFinite(r.at)&&r.at<=now()+60000);
    const localRun=receipt('backup-status.json',r=>typeof r.ok==='boolean'&&Number.isFinite(r.at));
    const offsiteRun=receipt('offsite/status.json',r=>typeof r.ok==='boolean'&&Number.isFinite(r.at));
    const monitor=receipt('monitor-state.json',r=>typeof r.ok==='boolean'&&Number.isFinite(r.checkedAt));
    const safe=r=>r?{at:r.at,ok:r.ok??true,integrity:r.integrity??null}:null;
    return {local:local?{...local,integrity:localRun?.ok===true&&localRun.at>=local.at-60000?localRun.integrity:null}:null,localRun:safe(localRun),r2:safe(offsite),r2Run:safe(offsiteRun),restore:safe(restore),monitor:monitor?{ok:monitor.ok,checkedAt:monitor.checkedAt,errors:monitor.errors}:null};
  }
  api.get('/admin/backups',(req,res)=>{admin(req,'operations');res.json(backups());});
  const telemetry={started:now(),requests:0,errors:0,inFlight:0,samples:[]};
  // Only bounded, aggregate request times; never store URLs, IPs or user agents.
  function measure(req,res,next){telemetry.requests++;telemetry.inFlight++;const start=performance.now();let done=false;const finish=()=>{if(done)return;done=true;telemetry.inFlight--;if(res.statusCode>=500)telemetry.errors++;telemetry.samples.push(Math.round(performance.now()-start));if(telemetry.samples.length>256)telemetry.samples.shift();};res.once('finish',finish);res.once('close',finish);next();}
  function healthReport(){
    const begin=performance.now();get('SELECT 1');const dbMs=performance.now()-begin,samples=[...telemetry.samples].sort((a,b)=>a-b),p95=samples[Math.floor(samples.length*.95)]??0;
    let sqliteBytes=0,walBytes=0,freeBytes=null;try{sqliteBytes=fs.statSync(dbPath).size;walBytes=fs.existsSync(dbPath+'-wal')?fs.statSync(dbPath+'-wal').size:0;const disk=fs.statfsSync(dataDir);freeBytes=disk.bavail*disk.bsize;}catch{}
    const audioBytes=get('SELECT COALESCE(SUM(length(audio)),0) n FROM media').n,limits=settings().value,alerts=[];
    if(p95>1000)alerts.push('API lenta: p95 acima de 1 s.');if(audioBytes>limits.totalAudioMB*1048576*.8)alerts.push('Áudio acima de 80% da cota.');if(freeBytes!==null&&freeBytes<1024**3)alerts.push('Disco com menos de 1 GiB livre.');if(process.memoryUsage().rss>512*1048576)alerts.push('Memória do processo acima de 512 MiB.');
    const b=backups();for(const [name,r]of [['local',b.local],['R2',b.r2]])if(!r||now()-r.at>36*3600000)alerts.push('Backup '+name+' sem confirmação recente.');
    return {checkedAt:now(),uptimeMs:now()-telemetry.started,requests:telemetry.requests,errors:telemetry.errors,inFlight:telemetry.inFlight,p95Ms:p95,sampleSize:samples.length,dbMs:Math.round(dbMs*100)/100,memoryBytes:process.memoryUsage().rss,sqliteBytes,walBytes,freeBytes,audioBytes,sessions:get('SELECT COUNT(*) n FROM sessions WHERE expires>?',now()).n,alerts,scope:'Processo atual, últimos 256 pedidos. SQLite usa uma conexão por processo. Sessões não são conexões TCP; disco compartilhado depende do provedor.'};
  }
  api.get('/admin/health',(req,res)=>{admin(req,'operations');res.json(healthReport());});
  function saveHealth(){try{const r=healthReport();fs.writeFileSync(path.join(dataDir,'server-health.json'),JSON.stringify({checkedAt:r.checkedAt,memoryBytes:r.memoryBytes,p95Ms:r.p95Ms,alerts:r.alerts}),{mode:0o600});}catch{console.error('Não foi possível gravar o resumo operacional.');}}
  const healthTimer=setInterval(saveHealth,60000);healthTimer.unref();const close=c.app.locals.close;c.app.locals.close=()=>{clearInterval(healthTimer);close();};
  api.get('/config',(req,res)=>{const v=settings().value;res.json({registrationsOpen:v.registrationsOpen,publicationOpen:v.publicationOpen,maintenanceMessage:v.maintenanceMessage,rules:v.rules,features:v.features});});
  return {admin,role,audit,settings,controls,touch,publish,measure};
}
module.exports={installAdmin,defaults,permissions};
