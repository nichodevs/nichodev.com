const {test:base,expect}=require('@playwright/test');
const {openCommunity,account,phrase}=require('../helpers/community');
const {staffFixture}=require('../helpers/admin');
const {totp}=require('../../community/mfa');
const {initialPreset}=require('../../community/preset-format');
const path=require('node:path'),fs=require('node:fs');
const test=base.extend({community:async({},use)=>{const f=await openCommunity();try{await use(f);}finally{await f.close();}},baseURL:async({community},use)=>use(community.origin)});
test.beforeEach(async({page})=>{await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.route('https://fonts.gstatic.com/**',r=>r.abort());});
async function login(page,name){await page.goto('/comunidade/');await page.locator('.account-button').click();await page.locator('#accountUser').fill(name);await page.locator('#accountPassword').fill(phrase);await page.locator('#accountSubmit').click();await expect(page.locator('#accountLabel')).toHaveText('@'+name);}
test('admin console paginates, suspends, audits, validates settings and works on mobile',async({page,community})=>{
  test.setTimeout(60000);const call=community.client(),member=community.client();await account(call,'nichodev_demo');const m=await account(member,'guitar_player');staffFixture(community,'nichodev_demo','owner');
  await login(page,'nichodev_demo');staffFixture(community,'nichodev_demo','owner');await page.locator('#adminLink').click();await expect(page.locator('#adminTitle')).toHaveText('VISÃO GERAL');
  await page.getByRole('button',{name:'USUÁRIOS',exact:true}).click();await expect(page.locator('#adminContent')).toContainText('guitar_player');
  await page.locator('[data-admin-action=user][data-id="'+m.user.id+'"]').click();await page.locator('#adm-action').selectOption('suspend');await page.locator('#adm-reason').fill('Revisão de segurança');await page.locator('dialog[open] button[type=submit]').click();await expect(page.locator('#adminContent')).toContainText('Suspensa');expect((await member('/me')).status).toBe(401);
  await page.locator('[data-admin-action=user-history][data-id="'+m.user.id+'"]').click();await expect(page.locator('dialog[open]')).toContainText('Revisão de segurança');await page.getByRole('button',{name:'Fechar histórico'}).click();
  await page.getByRole('button',{name:'CONFIGURAÇÕES',exact:true}).click();await page.locator('#adm-maintenanceMessage').fill('Manutenção programada às 23h.');await page.locator('#adm-reason').fill('Aviso programado');await page.getByRole('button',{name:'SALVAR CONFIGURAÇÕES'}).click();await expect(page.locator('#adminMessage')).toContainText('Atualizado');
  for(const label of ['BACKUPS','SERVIDOR','RECUPERAÇÃO','AUDITORIA','AVALIAÇÕES']){await page.getByRole('button',{name:label,exact:true}).click();await expect(page.locator('#adminTitle')).toHaveText(label);await expect(page.locator('#adminMessage')).toContainText('Atualizado');}
  await page.getByRole('button',{name:'USUÁRIOS',exact:true}).click();await expect(page.locator('#adminTitle')).toHaveText('USUÁRIOS');
  if(process.env.ADMIN_PREVIEW_DIR){fs.mkdirSync(process.env.ADMIN_PREVIEW_DIR,{recursive:true});await page.setViewportSize({width:1440,height:1100});await page.locator('#adminRoot').screenshot({path:path.join(process.env.ADMIN_PREVIEW_DIR,'painel-admin-desktop.png')});}
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(process.env.ADMIN_PREVIEW_DIR)await page.locator('#adminRoot').screenshot({path:path.join(process.env.ADMIN_PREVIEW_DIR,'painel-admin-mobile.png')});
  for(let i=0;i<28;i++)community.app.locals.db.prepare('INSERT INTO users(id,username,password,recovery,active,created) VALUES(?,?,?,?,1,?)').run('page'+i,'pagina_'+i,'fixture','fixture',Date.now()-i);
  await page.getByRole('button',{name:'ATUALIZAR ↻'}).click();await expect(page.locator('.admin-pages')).toContainText('Página 1 de 2');await page.getByRole('button',{name:'PRÓXIMA →'}).click();await expect(page.locator('.admin-pages')).toContainText('Página 2 de 2');
});
test('MFA enrollment and confirmation happen in accessible dialogs, without unlocking on cancel',async({page,community})=>{
  test.setTimeout(60000);const call=community.client(),a=await account(call,'admin_mfa');community.app.locals.db.prepare('UPDATE users SET admin=1 WHERE id=?').run(a.user.id);community.app.locals.db.prepare("UPDATE user_controls SET role='owner' WHERE user_id=?").run(a.user.id);
  await login(page,'admin_mfa');await page.locator('#adminLink').click();await expect(page.getByRole('heading',{name:'ATIVAR SEGUNDO FATOR'})).toBeVisible();await page.locator('#adm-current').fill(phrase);await page.locator('#adm-recoveryKey').fill(a.key);await page.locator('dialog[open] button[type=submit]').click();await expect(page.locator('#adm-secret')).toBeVisible();
  const secret=await page.locator('#adm-secret').inputValue();await page.locator('#adm-code').fill(totp(secret,Math.floor(Date.now()/30000)));await page.locator('dialog[open] button[type=submit]').click();await expect(page.getByRole('heading',{name:'GUARDE OS CÓDIGOS DE EMERGÊNCIA'})).toBeVisible();await page.locator('dialog[open] input[type=checkbox]').check();await page.locator('dialog[open] button[type=submit]').click();await expect(page.locator('#adminTitle')).toHaveText('VISÃO GERAL');
  community.app.locals.db.exec('UPDATE session_mfa SET verified=0');await page.getByRole('button',{name:'USUÁRIOS',exact:true}).click();await expect(page.getByRole('heading',{name:'CONFIRMAR SEGUNDO FATOR'})).toBeVisible();await page.getByRole('button',{name:'Cancelar operação',exact:true}).click();await expect(page.locator('dialog[open]')).toHaveCount(0);await expect(page.locator('#adminMessage')).toContainText('cancelada');
});
test('moderation requires a reason, records review history and notifies the author',async({page,community})=>{
  const mod=community.client(),author=community.client();await account(mod,'moderador');await account(author,'musico');staffFixture(community,'moderador','moderator');
  const creation=await author('/creations',{method:'POST',body:{kind:'preset',tool:'guitarra',title:'Timbre para revisão',description:'Preset de guitarra',visibility:'public',preset:initialPreset('guitarra')}});expect(creation.status).toBe(201);
  await login(page,'moderador');staffFixture(community,'moderador','moderator');await page.locator('#adminLink').click();await expect(page.locator('#adminTitle')).toHaveText('MODERAÇÃO');await expect(page.getByRole('button',{name:'USUÁRIOS',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'REVISAR',exact:true}).click();await page.locator('#adm-reason').fill('Conteúdo atende às regras');await page.locator('dialog[open] button[type=submit]').click();await expect(page.locator('#adminContent')).not.toContainText('Timbre para revisão');expect((await author('/notifications')).data.items[0].message).toContain('Conteúdo atende às regras');
});

test('assisted recovery lets only the token holder finish an approved request',async({page,community})=>{
 test.setTimeout(60000);const admin=community.client(),member=community.client();await account(admin,'dono_recuperacao');staffFixture(community,'dono_recuperacao','owner');const a=await account(member,'recuperacao_ui');
 await page.goto('/comunidade/');await page.locator('.account-button').click();await page.getByRole('button',{name:'ESQUECI MINHA SENHA'}).click();await page.getByRole('button',{name:'RECUPERAÇÃO ASSISTIDA',exact:true}).click();await page.locator('dialog[open] button[type=submit]').click();
 await page.locator('#adm-username').fill('recuperacao_ui');await page.locator('#adm-recoveryKey').fill(a.key);await page.locator('dialog[open] button[type=submit]').click();
 await expect(page.locator('#adm-token')).toBeVisible();const id=await page.locator('#adm-id').inputValue(),token=await page.locator('#adm-token').inputValue();await page.locator('dialog[open] input[type=checkbox]').check();await page.locator('dialog[open] button[type=submit]').click();
 expect((await admin('/admin/recovery/'+id,{method:'PATCH',body:{status:'approved',reason:'Chave de recuperação verificada'}})).status).toBe(204);
 await page.locator('.account-button').click();await page.getByRole('button',{name:'ESQUECI MINHA SENHA'}).click();await page.getByRole('button',{name:'RECUPERAÇÃO ASSISTIDA',exact:true}).click();await page.locator('#adm-step').selectOption('complete');await page.locator('dialog[open] button[type=submit]').click();
 await page.locator('#adm-id').fill(id);await page.locator('#adm-token').fill(token);await page.locator('#adm-password').fill(phrase+' alterada');await page.locator('#adm-confirm').fill(phrase+' alterada');await page.locator('dialog[open] button[type=submit]').click();await expect(page.locator('#adm-key')).toBeVisible();await page.locator('dialog[open] input[type=checkbox]').check();await page.locator('dialog[open] button[type=submit]').click();
 expect((await member('/login',{method:'POST',body:{username:'recuperacao_ui',password:phrase+' alterada'}})).status).toBe(200);
});
