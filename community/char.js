const {transaction}=require('./store');
const format=require('./char-format');
function initCharStore(db){
  db.exec(`CREATE TABLE IF NOT EXISTS user_chars(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,design TEXT NOT NULL,public_design TEXT,revision INTEGER NOT NULL,updated INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'ready',reason TEXT NOT NULL DEFAULT '') STRICT;
    CREATE INDEX IF NOT EXISTS chars_moderation ON user_chars(status,updated,user_id);
    CREATE TABLE IF NOT EXISTS char_unlocks(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,badge TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(user_id,badge)) STRICT;
    CREATE TABLE IF NOT EXISTS char_reports(id INTEGER PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,reporter TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created INTEGER NOT NULL) STRICT;
    CREATE INDEX IF NOT EXISTS char_reports_status ON char_reports(status,id);
    CREATE UNIQUE INDEX IF NOT EXISTS char_reports_open ON char_reports(user_id,reporter) WHERE status='pending';
    CREATE TABLE IF NOT EXISTS creation_comments(id INTEGER PRIMARY KEY,creation_id TEXT NOT NULL REFERENCES creations(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',revision INTEGER NOT NULL DEFAULT 1,created INTEGER NOT NULL) STRICT;
    CREATE INDEX IF NOT EXISTS comments_creation ON creation_comments(creation_id,status,id);
    CREATE INDEX IF NOT EXISTS comments_queue ON creation_comments(status,id);
    CREATE INDEX IF NOT EXISTS comments_user ON creation_comments(user_id,id);`);
}
function installChar(c){
  const {api,db,auth,rate,now,get,all,run,fail,ops,text}=c;
  const earned=id=>all('SELECT badge FROM char_unlocks WHERE user_id=? ORDER BY badge',id).map(x=>x.badge);
  function achievements(id){
    const add=badge=>run('INSERT OR IGNORE INTO char_unlocks VALUES(?,?,?)',id,badge,now());
    if(get("SELECT id FROM creations WHERE owner=? AND kind='preset' AND visibility='public' LIMIT 1",id))add('primeiro-preset');
    if(get("SELECT id FROM creations WHERE owner=? AND visibility='public' AND status='approved' LIMIT 1",id))add('criador-aprovado');
    if(get('SELECT COUNT(*) n FROM favorites WHERE user_id=?',id).n>=10)add('favoriteiro');
    if(get('SELECT user_id FROM user_chars WHERE user_id=?',id))add('perfil-criado');
    const days=all('SELECT day FROM daily_activity WHERE user_id=? ORDER BY day DESC LIMIT 7',id).map(x=>x.day);
    if(days.length===7&&days.every((day,i)=>day===new Date(now()-i*86400000).toISOString().slice(0,10)))add('sete-dias');
    return earned(id);
  }
  function own(id){const row=get('SELECT * FROM user_chars WHERE user_id=?',id),unlocks=achievements(id);return {design:row?JSON.parse(row.design):structuredClone(format.defaults),revision:row?.revision||0,status:row?.status||'ready',reason:row?.reason||'',unlocks,level:1+unlocks.length};}
  function publicRecord(row){return row?.public_design?{design:JSON.parse(row.public_design),revision:row.revision,level:1+(row.badge_count||0)}:null;}
  function publicFor(id){return publicRecord(get('SELECT a.public_design,a.revision,(SELECT COUNT(*) FROM char_unlocks b WHERE b.user_id=u.id) badge_count FROM user_chars a JOIN users u ON u.id=a.user_id WHERE a.user_id=? AND u.active=1 AND NOT EXISTS(SELECT 1 FROM user_controls x WHERE x.user_id=u.id AND x.suspended=1)',id));}
  function page(req){const page=Number(req.query.page??1),size=Number(req.query.size??25);if(!Number.isSafeInteger(page)||page<1||page>1000000||!Number.isSafeInteger(size)||size<1||size>100)fail(400,'Paginação inválida.');return {page,size,offset:(page-1)*size};}
  api.get('/char',(req,res)=>res.json(own(auth(req).id)));
  api.put('/char',(req,res)=>{
    const u=auth(req);rate(req,'char-save',30,3600000);
    let design;try{design=format.validate(req.body.design,achievements(u.id));}catch(e){fail(400,e.message);}
    if(!Number.isSafeInteger(req.body.revision)||req.body.revision<0)fail(400,'Versão inválida.');
    transaction(db,()=>{
      const old=get('SELECT * FROM user_chars WHERE user_id=?',u.id);if(req.body.revision!==(old?.revision||0))fail(409,'Seu personagem mudou em outra sessão. Reabra o CHAR LAB antes de salvar.');
      if(design.drawing&&old?.status==='hidden'&&old.design===JSON.stringify(design))fail(409,'Revise seu desenho antes de enviar novamente.');
      if(!design.hidden)ops.publish(u,'public');
      const review=Boolean(design.drawing||old?.status==='hidden'||old?.status==='pending'),status=review?'pending':'ready',publicDesign=design.hidden?null:review?(old?.public_design||null):JSON.stringify(design);
      run("INSERT INTO user_chars VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET design=excluded.design,public_design=excluded.public_design,revision=excluded.revision,updated=excluded.updated,status=excluded.status,reason=excluded.reason",u.id,JSON.stringify(design),publicDesign,(old?.revision||0)+1,now(),status,'');
    });res.json(own(u.id));
  });
  api.post('/char/tool-opened',(req,res)=>{const u=auth(req);rate(req,'char-explore',10,3600000);if(!['voz','guitarra','mixmaster'].includes(req.body.tool))fail(400,'Ferramenta inválida.');run('INSERT OR IGNORE INTO char_unlocks VALUES(?,?,?)',u.id,'explorador',now());res.status(204).end();});
  api.get('/members',(req,res)=>{
    rate(req,'char-members',120);const p=page(req),q=text(req.query.q||'',24,false).toLowerCase();if(q&&!/^[a-z0-9_]+$/.test(q))fail(400,'Use o prefixo de um usuário.');
    const pattern=q.replaceAll('_','\\_')+'%',where="u.active=1 AND a.public_design IS NOT NULL AND u.username LIKE ? ESCAPE '\\' AND NOT EXISTS(SELECT 1 FROM user_controls x WHERE x.user_id=u.id AND x.suspended=1)";
    const total=get('SELECT COUNT(*) n FROM users u JOIN user_chars a ON a.user_id=u.id WHERE '+where,pattern).n;
    res.json({items:all('SELECT u.username,a.public_design,a.revision,(SELECT COUNT(*) FROM char_unlocks b WHERE b.user_id=u.id) badge_count FROM users u JOIN user_chars a ON a.user_id=u.id WHERE '+where+' ORDER BY u.username LIMIT ? OFFSET ?',pattern,p.size,p.offset).map(row=>({username:row.username,char:publicRecord(row)})),total,page:p.page,size:p.size});
  });
  api.get('/profiles/:username',(req,res)=>{
    rate(req,'char-profile',120);const p=page(req),name=String(req.params.username);if(!/^[a-z0-9_]{3,24}$/.test(name))fail(404,'Perfil não encontrado.');
    const u=get('SELECT id,username FROM users WHERE username=? AND active=1',name);if(!u||ops.controls(u.id).suspended)fail(404,'Perfil não encontrado.');
    const rows=all("SELECT c.*,u.username,a.public_design char_design,a.revision char_revision FROM creations c JOIN users u ON u.id=c.owner LEFT JOIN user_chars a ON a.user_id=u.id AND NOT EXISTS(SELECT 1 FROM user_controls x WHERE x.user_id=u.id AND x.suspended=1) WHERE c.owner=? AND c.visibility='public' AND c.status='approved' ORDER BY c.created DESC,c.id LIMIT ? OFFSET ?",u.id,p.size,p.offset);
    res.json({username:u.username,char:publicFor(u.id),items:rows.map(c.item),total:get("SELECT COUNT(*) n FROM creations WHERE owner=? AND visibility='public' AND status='approved'",u.id).n,page:p.page,size:p.size});
  });
  api.post('/profiles/:username/report',(req,res)=>{
    const u=auth(req);rate(req,'char-report',5,3600000);const target=get('SELECT u.id FROM users u JOIN user_chars a ON a.user_id=u.id WHERE u.username=? AND a.public_design IS NOT NULL AND u.active=1',req.params.username);
    if(!target||target.id===u.id)fail(404,'Personagem indisponível para denúncia.');
    const reason=text(req.body.reason,500);if(reason.length<3)fail(400,'Explique o motivo.');
    if(get("SELECT id FROM char_reports WHERE user_id=? AND reporter=? AND status='pending'",target.id,u.id))fail(409,'Denúncia já recebida.');
    run('INSERT INTO char_reports(user_id,reporter,reason,created) VALUES(?,?,?,?)',target.id,u.id,reason,now());res.status(201).json({received:true});
  });
  api.get('/admin/chars',(req,res)=>{
    ops.admin(req,'moderate');const p=page(req),status=req.query.status||'pending';if(!['pending','ready','hidden'].includes(status))fail(400,'Fila inválida.');
    res.json({items:all('SELECT a.*,u.username FROM user_chars a JOIN users u ON u.id=a.user_id WHERE a.status=? ORDER BY a.updated,a.user_id LIMIT ? OFFSET ?',status,p.size,p.offset).map(r=>({id:r.user_id,username:r.username,design:JSON.parse(r.design),revision:r.revision,status:r.status,reason:r.reason})),total:get('SELECT COUNT(*) n FROM user_chars WHERE status=?',status).n,page:p.page,size:p.size});
  });
  api.patch('/admin/chars/:id',(req,res)=>{
    const staff=ops.admin(req,'moderate'),status=req.body.status,reason=text(req.body.reason,500);if(!['ready','hidden','pending'].includes(status)||reason.length<3)fail(400,'Decisão ou motivo inválido.');
    transaction(db,()=>{const row=get('SELECT * FROM user_chars WHERE user_id=?',req.params.id);if(!row||row.revision!==req.body.revision)fail(409,'Personagem mudou. Atualize a fila.');
      const design=JSON.parse(row.design),published=status==='ready'&&!design.hidden?row.design:null;
      run('UPDATE user_chars SET status=?,public_design=?,reason=?,revision=revision+1,updated=? WHERE user_id=?',status,published,reason,now(),row.user_id);
      run("UPDATE char_reports SET status='reviewed' WHERE user_id=? AND status='pending'",row.user_id);run('INSERT INTO notices(user_id,message,created) VALUES(?,?,?)',row.user_id,'NICO//CHAR — '+status+': '+reason,now());ops.audit(staff,'char.'+status,row.user_id,reason);
    });res.status(204).end();
  });
  api.get('/admin/chars/:id',(req,res)=>{ops.admin(req,'moderate');const row=get('SELECT a.*,u.username FROM user_chars a JOIN users u ON u.id=a.user_id WHERE a.user_id=?',req.params.id);if(!row)fail(404,'Personagem não encontrado.');res.json({id:row.user_id,username:row.username,design:JSON.parse(row.design),revision:row.revision,status:row.status,reason:row.reason});});
  api.get('/admin/char-reports',(req,res)=>{ops.admin(req,'moderate');const p=page(req);res.json({items:all("SELECT r.*,u.username FROM char_reports r JOIN users u ON u.id=r.user_id WHERE r.status='pending' ORDER BY r.id LIMIT ? OFFSET ?",p.size,p.offset),total:get("SELECT COUNT(*) n FROM char_reports WHERE status='pending'").n,page:p.page,size:p.size});});
  api.post('/admin/chars/:id/reward',(req,res)=>{
    const staff=ops.admin(req,'roles'),badge=req.body.badge,reason=text(req.body.reason,500);if(!['halloween','natal','aniversario','desafio'].includes(badge)||reason.length<3)fail(400,'Recompensa ou motivo inválido.');
    if(!get('SELECT id FROM users WHERE id=? AND active=1',req.params.id))fail(404,'Conta não encontrada.');
    transaction(db,()=>{run('INSERT OR IGNORE INTO char_unlocks VALUES(?,?,?)',req.params.id,badge,now());ops.audit(staff,'char.reward',req.params.id,reason+' ['+badge+']');});res.status(204).end();
  });
  function commentThread(req){const row=c.visible(c.creation(req.params.id),req);if(row.visibility!=='public'||row.status!=='approved')fail(404,'Comentários disponíveis somente em criações públicas aprovadas.');return row;}
  api.get('/creations/:id/comments',(req,res)=>{
    commentThread(req);rate(req,'comments-read',120);const p=page(req),u=c.actor(req),where="m.creation_id=? AND (m.status='approved' OR m.user_id=?)";
    const rows=all('SELECT m.id,m.body,m.status,m.revision,m.created,u.username,a.public_design,a.revision char_revision FROM creation_comments m JOIN users u ON u.id=m.user_id LEFT JOIN user_chars a ON a.user_id=u.id AND NOT EXISTS(SELECT 1 FROM user_controls x WHERE x.user_id=u.id AND x.suspended=1) WHERE '+where+' ORDER BY m.id LIMIT ? OFFSET ?',req.params.id,u?.id||'',p.size,p.offset);
    res.json({items:rows.map(r=>({id:r.id,body:r.body,status:r.status,revision:r.revision,created:r.created,username:r.username,char:r.public_design?{design:JSON.parse(r.public_design),revision:r.char_revision}:null,mine:r.username===u?.username})),total:get('SELECT COUNT(*) n FROM creation_comments m WHERE '+where,req.params.id,u?.id||'').n,page:p.page,size:p.size});
  });
  api.post('/creations/:id/comments',(req,res)=>{
    const u=auth(req);commentThread(req);ops.publish(u,'public');rate(req,'comment-post',10,3600000);const body=text(req.body.body,600);if(body.length<2)fail(400,'Escreva pelo menos dois caracteres.');
    run('INSERT INTO creation_comments(creation_id,user_id,body,created) VALUES(?,?,?,?)',req.params.id,u.id,body,now());res.status(201).json({received:true});
  });
  api.delete('/comments/:id',(req,res)=>{const u=auth(req);rate(req,'comment-delete',30,3600000);const row=get('SELECT * FROM creation_comments WHERE id=? AND user_id=?',req.params.id,u.id);if(!row)fail(404,'Comentário não encontrado.');if(req.body.revision!==row.revision)fail(409,'Comentário mudou. Atualize.');run('DELETE FROM creation_comments WHERE id=?',row.id);res.status(204).end();});
  api.get('/admin/comments',(req,res)=>{ops.admin(req,'moderate');const p=page(req),status=req.query.status||'pending';if(!['pending','approved','hidden'].includes(status))fail(400,'Fila inválida.');res.json({items:all('SELECT m.*,u.username,c.title FROM creation_comments m JOIN users u ON u.id=m.user_id JOIN creations c ON c.id=m.creation_id WHERE m.status=? ORDER BY m.id LIMIT ? OFFSET ?',status,p.size,p.offset),total:get('SELECT COUNT(*) n FROM creation_comments WHERE status=?',status).n,page:p.page,size:p.size});});
  api.patch('/admin/comments/:id',(req,res)=>{
    const staff=ops.admin(req,'moderate'),status=req.body.status,reason=text(req.body.reason,500);if(!['pending','approved','hidden'].includes(status)||reason.length<3)fail(400,'Decisão ou motivo inválido.');
    transaction(db,()=>{const row=get('SELECT * FROM creation_comments WHERE id=?',req.params.id);if(!row||row.revision!==req.body.revision)fail(409,'Comentário mudou. Atualize.');run('UPDATE creation_comments SET status=?,revision=revision+1 WHERE id=?',status,row.id);run('INSERT INTO notices(user_id,message,created) VALUES(?,?,?)',row.user_id,'Comentário — '+status+': '+reason,now());ops.audit(staff,'comment.'+status,row.user_id,reason+' [comentário '+row.id+']');});res.status(204).end();
  });
  return {own,publicFor};
}
module.exports={initCharStore,installChar};
