const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const F=require('../char-format'),A=require('../../prototypes/community/char-render');
const {openCommunity,account}=require('../../tests/helpers/community'),{staffFixture}=require('../../tests/helpers/admin'),{initialPreset}=require('../preset-format');
const put=(design,revision=0)=>({method:'PUT',body:{design,revision}}),post=body=>({method:'POST',body});
test('catálogo original valida todas as peças e limita JSON, pixels e cosméticos',()=>{
  const unlocks=['primeiro-preset','criador-aprovado','favoriteiro','perfil-criado','halloween','natal','aniversario','desafio'];
  for(const id of Object.keys(F.presets))assert.equal(F.validate(F.make(id),unlocks).archetype,id);
  for(const [key,items]of Object.entries(F.catalog))for(const x of items)assert.equal(F.validate({...F.defaults,[key]:x.id},unlocks)[key],x.id);
  assert.ok(F.catalog.hair.length>=20&&F.catalog.clothing.length>=20&&F.catalog.accessory.length>=20);
  for(const change of [{schema:2},{style:'<script>'},{hidden:'false'},{name:'<img>'},{mood:'x'.repeat(81)},{drawing:{size:64,pixels:'0'.repeat(4096)}},{drawing:{size:16,pixels:'a'.repeat(256)}},{drawing:{size:32,pixels:'0'}},{badges:['owner']},{studio:{...F.defaults.studio,petX:99}},{__unknown:true}])assert.throws(()=>F.validate({...F.defaults,...change}));
  assert.throws(()=>F.validate({...F.defaults,accessory:'fone-raro'}));
  assert.throws(()=>F.validate(JSON.parse(JSON.stringify(F.defaults).replace('"schema":1','"schema":1,"__proto__":{}'))));
  assert.deepEqual(F.validate({...F.defaults,drawing:{size:16,pixels:'2'.repeat(256)}}).drawing,{size:16,pixels:'2'.repeat(256)});
});
test('sprites são determinísticos, têm peças distintas e GIF transparente de quatro quadros',()=>{
  const d=F.make('beat-hacker'),p=A.pixels(d);assert.equal(p.length,4096);assert.deepEqual(A.pixels(d),p);assert.ok(p.filter(x=>x>1).length>100);
  const unique=key=>new Set(F.catalog[key].map(x=>{const h=crypto.createHash('sha256');for(let frame=0;frame<4;frame++)h.update(A.pixels({...F.defaults,[key]:x.id},frame));return h.digest('hex');})).size;
  for(const key of ['hair','clothing','accessory','body','eyes','face','pose','scene','companion','frame','emote','effect'])assert.equal(unique(key),F.catalog[key].length,key);
  const gif=Buffer.from(A.gif(d));assert.equal(gif.subarray(0,6).toString(),'GIF89a');assert.equal(gif.readUInt16LE(6),128);assert.equal(gif.readUInt16LE(8),128);assert.ok(gif.includes(Buffer.from('NETSCAPE2.0')));assert.equal(gif.at(-1),59);assert.ok(gif.length<100000);assert.ok(A.pixels(d,0,{scene:false}).includes(0));assert.notDeepEqual(A.pixels(d,0),A.pixels(d,3));
});
test('char persiste por conta, conserva registros, pagina membros e recusa conflito e fraude',async t=>{
  const f=await openCommunity();t.after(()=>f.close());const a=f.client(),b=f.client(),guest=f.client();const au=await account(a,'char_author');await account(b,'char_other');
  const before=f.app.locals.db.prepare('SELECT * FROM users ORDER BY id').all();
  assert.equal((await guest('/char')).status,401);assert.equal((await guest('/char',put(F.defaults))).status,401);
  assert.equal((await a('/char')).data.revision,0);let d={...F.defaults,name:'PIXEL',palette:'synth'};
  const saved=await a('/char',put(d));assert.equal(saved.status,200);assert.equal(saved.data.revision,1);assert.equal((await b('/char')).data.design.name,'NICO');
  assert.equal((await a('/char',put({...d,name:'stale'}))).status,409);assert.equal((await a('/char',put({...d,accessory:'fone-raro'},1))).status,400);
  assert.equal((await a('/char',{...put(d,1),headers:{Origin:'https://invalid.example'}})).status,403);
  let members=await guest('/members?size=1');assert.equal(members.status,200);assert.equal(members.data.total,1);assert.equal(members.data.items[0].username,'char_author');assert.equal((await guest('/members?page=2&size=1')).data.items.length,0);assert.equal((await guest('/members?page=0')).status,400);
  await f.restart();assert.equal((await a('/char')).data.design.name,'PIXEL');assert.deepEqual(f.app.locals.db.prepare('SELECT * FROM users ORDER BY id').all(),before);
  const exported=await a('/account/export');assert.equal(exported.data.char.design.name,'PIXEL');assert.ok(!JSON.stringify((await guest('/profiles/char_author')).data).includes('password'));
  assert.equal((await a('/char',put({...d,hidden:true},1))).status,200);assert.equal((await guest('/members')).data.total,0);assert.equal((await guest('/profiles/char_author')).data.char,null);
  f.app.locals.db.prepare('DELETE FROM users WHERE id=?').run(au.user.id);for(const table of ['user_chars','char_unlocks'])assert.equal(f.app.locals.db.prepare('SELECT COUNT(*) n FROM '+table+' WHERE user_id=?').get(au.user.id).n,0);
});
test('arte livre fica privada até revisão com MFA, auditoria, denúncia e bloqueio de publicação',async t=>{
  const f=await openCommunity();t.after(()=>f.close());const a=f.client(),mod=f.client(),guest=f.client(),reporter=f.client();const author=await account(a,'draw_author');await account(mod,'draw_mod');await account(reporter,'draw_reporter');
  staffFixture(f,'draw_mod','moderator');const base={...F.defaults,name:'SAFE'};assert.equal((await a('/char',put(base))).status,200);
  const d={...base,name:'PRIVATE DRAFT',drawing:{size:32,pixels:'2'.repeat(1024)}};assert.equal((await a('/char',put(d,1))).status,200);
  assert.equal((await guest('/profiles/draw_author')).data.char.design.name,'SAFE');assert.ok(!JSON.stringify((await guest('/members')).data).includes('PRIVATE DRAFT'));
  assert.equal((await a('/admin/chars')).status,403);assert.equal((await guest('/admin/chars')).status,401);
  const queue=await mod('/admin/chars');assert.equal(queue.status,200);const row=queue.data.items[0];assert.equal(row.design.name,'PRIVATE DRAFT');
  const review={method:'PATCH',body:{status:'ready',revision:row.revision,reason:'Arte original apropriada'}};
  assert.equal((await mod('/admin/chars/'+row.id,review)).status,204);assert.equal((await mod('/admin/chars/'+row.id,review)).status,409);
  assert.equal((await guest('/profiles/draw_author')).data.char.design.name,'PRIVATE DRAFT');assert.match((await a('/notifications')).data.items[0].message,/NICO\/\/CHAR/);
  assert.equal((await reporter('/profiles/draw_author/report',post({reason:'Solicito revisão do desenho'}))).status,201);assert.equal((await reporter('/profiles/draw_author/report',post({reason:'Repetida'}))).status,409);
  assert.equal((await mod('/admin/char-reports')).data.total,1);
  assert.equal((await mod('/admin/chars/'+row.id,{method:'PATCH',body:{status:'hidden',revision:3,reason:'Revisão por denúncia'}})).status,204);
  assert.equal((await guest('/profiles/draw_author')).data.char,null);assert.equal((await mod('/admin/char-reports')).data.total,0);assert.equal(f.app.locals.db.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action LIKE 'char.%'").get().n,2);
  assert.equal((await mod('/admin/chars/'+row.id+'/reward',post({badge:'desafio',reason:'Participação confirmada'}))).status,403);
  f.app.locals.db.prepare('UPDATE user_controls SET publish_until=? WHERE user_id=?').run(Date.now()+60000,author.user.id);assert.equal((await a('/char',put(base,4))).status,403);
  f.app.locals.db.exec('UPDATE session_mfa SET verified=0');assert.equal((await mod('/admin/chars')).data.code,'ADMIN_MFA_REQUIRED');
});
test('reenvios de char ocultado conservam revisão até decisão, inclusive desenho trocado por peças',async t=>{
  const f=await openCommunity();t.after(()=>f.close());const mod=f.client(),guest=f.client();await account(mod,'resend_mod');staffFixture(f,'resend_mod','moderator');
  for(const drawing of [null,{size:16,pixels:'2'.repeat(256)}]){
    const author=f.client(),name=drawing?'resend_drawing':'resend_modular',u=await account(author,name),design={...F.defaults,name:'Revisar',drawing};
    assert.equal((await author('/char',put(design))).status,200);
    assert.equal((await mod('/admin/chars/'+u.user.id,{method:'PATCH',body:{status:'hidden',revision:1,reason:'Conteúdo precisa de revisão'}})).status,204);
    const modular={...design,drawing:null};let revision=2;
    for(let i=0;i<3;i++){
      const saved=await author('/char',put(modular,revision++));assert.equal(saved.status,200);assert.equal(saved.data.status,'pending');
      assert.equal((await guest('/profiles/'+name)).data.char,null);
    }
    assert.equal((await mod('/admin/chars/'+u.user.id)).data.revision,revision);
    assert.equal((await mod('/admin/chars/'+u.user.id,{method:'PATCH',body:{status:'ready',revision,reason:'Conteúdo revisado e aprovado'}})).status,204);
    assert.equal((await guest('/profiles/'+name)).data.char.design.name,'Revisar');
    assert.equal((await author('/char',put({...modular,name:'Atualizado'},revision+1))).data.status,'ready');
  }
});
test('conquistas vêm dos marcos reais e eventos exigem proprietário com motivo',async t=>{
  const f=await openCommunity();t.after(()=>f.close());const a=f.client(),owner=f.client();const u=await account(a,'earned_char');await account(owner,'earned_owner');staffFixture(f,'earned_owner','owner');
  assert.deepEqual((await a('/char')).data.unlocks,[]);
  for(let i=0;i<7;i++)f.app.locals.db.prepare('INSERT OR REPLACE INTO daily_activity VALUES(?,?)').run(u.user.id,new Date(Date.now()-i*86400000).toISOString().slice(0,10));
  assert.ok((await a('/char')).data.unlocks.includes('sete-dias'));
  const creation=await a('/creations',post({kind:'preset',tool:'guitarra',title:'Meu primeiro preset',description:'Preset original',visibility:'public',preset:initialPreset('guitarra')}));assert.equal(creation.status,201);
  assert.ok((await a('/char')).data.unlocks.includes('primeiro-preset'));f.app.locals.db.prepare("UPDATE creations SET status='approved' WHERE id=?").run(creation.data.item.id);assert.ok((await a('/char')).data.unlocks.includes('criador-aprovado'));
  assert.equal((await owner('/admin/chars/'+u.user.id+'/reward',post({badge:'desafio',reason:'Desafio musical concluído'}))).status,204);assert.ok((await a('/char')).data.unlocks.includes('desafio'));
  assert.equal((await a('/char/tool-opened',post({tool:'voz'}))).status,204);assert.ok((await a('/char')).data.unlocks.includes('explorador'));assert.equal((await a('/char/tool-opened',post({tool:'invalida'}))).status,400);
});
test('comentários paginados só publicam após moderação e usam o char aprovado do autor',async t=>{
  const f=await openCommunity();t.after(()=>f.close());const a=f.client(),mod=f.client(),guest=f.client();await account(a,'comment_author');await account(mod,'comment_mod');staffFixture(f,'comment_mod','moderator');await a('/char',put({...F.defaults,name:'COMMENT CHAR'}));
  const creation=await a('/creations',post({kind:'preset',tool:'voz',title:'Preset comentado',description:'Teste de comentários',visibility:'public',preset:initialPreset('voz')})),id=creation.data.item.id;
  assert.equal((await a('/creations/'+id+'/comments',post({body:'Minha impressão sobre o timbre'}))).status,404);f.app.locals.db.prepare("UPDATE creations SET status='approved' WHERE id=?").run(id);
  assert.equal((await guest('/creations/'+id+'/comments',post({body:'Sem login'}))).status,401);assert.equal((await a('/creations/'+id+'/comments',post({body:'<b>Som interessante</b>'}))).status,201);
  assert.equal((await guest('/creations/'+id+'/comments')).data.total,0);const mine=(await a('/creations/'+id+'/comments')).data;assert.equal(mine.total,1);assert.equal(mine.items[0].char.design.name,'COMMENT CHAR');
  const row=(await mod('/admin/comments')).data.items[0];assert.equal((await mod('/admin/comments/'+row.id,{method:'PATCH',body:{status:'approved',revision:1,reason:'Comentário pertinente'}})).status,204);
  assert.equal((await guest('/creations/'+id+'/comments?size=1')).data.total,1);assert.equal((await mod('/comments/'+row.id,{method:'DELETE',body:{revision:2}})).status,404);assert.equal((await a('/comments/'+row.id,{method:'DELETE',body:{revision:1}})).status,409);assert.equal((await a('/comments/'+row.id,{method:'DELETE',body:{revision:2}})).status,204);
});
