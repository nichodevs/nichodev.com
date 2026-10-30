const { test: base, expect } = require("@playwright/test");
const { openCommunity, account, phrase } = require("../helpers/community");
const { initialPreset } = require("../../community/preset-format");
const { wav, downloadBytes } = require("../helpers/audio");

const test = base.extend({
  community: async ({}, use) => { const app = await openCommunity(); try { await use(app); } finally { await app.close(); } },
  baseURL: async ({ community }, use) => use(community.origin)
});
const post = data => ({ method: "POST", body: data });
async function register(page, username="criador") {
  await page.locator(".account-button").click();
  await page.getByRole("button",{name:"CRIAR CONTA",exact:true}).click();
  await page.locator("#accountUser").fill(username);
  await page.locator("#accountPassword").fill(phrase);
  await page.locator("#accountConfirm").fill(phrase);
  await page.locator("#accountSubmit").click();
  await expect(page.locator("#recoveryKeyDialog")).toBeVisible();
  const key=await page.locator("#recoveryKey").inputValue();
  await expect(page.locator("#finishSignup")).toBeDisabled();
  await page.locator("#keySaved").check();await page.locator("#finishSignup").click();
  await expect(page.locator("#accountLabel")).toHaveText("@"+username);
  await expect(page.locator("#recoveryKey")).toHaveValue("");
  return key;
}
async function login(page, username, password=phrase) {
  await page.locator(".account-button").click();await page.locator("#accountUser").fill(username);await page.locator("#accountPassword").fill(password);await page.locator("#accountSubmit").click();
  await expect(page.locator("#accountLabel")).toHaveText("@"+username);
}
async function seed(community,{visibility="public",title="Timbre real"}={}) {
  const call=community.client(),{user}=await account(call,"autor");
  const response=await call("/creations",post({kind:"preset",tool:"guitarra",title,description:"Parâmetros completos",visibility,preset:initialPreset("guitarra")}));
  if(visibility==="public")community.app.locals.db.prepare("UPDATE creations SET status='approved'").run();
  return {call,user,item:response.data.item};
}

test.beforeEach(async({page})=>{
  await page.route("https://fonts.googleapis.com/**",r=>r.abort());await page.route("https://fonts.gstatic.com/**",r=>r.abort());
  await page.goto("/comunidade/");await expect(page.locator("#exampleCards .sound-card")).toHaveCount(3);
});
for(const width of [360,768,1280])test("navegação e avaliação cabem em "+width,async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));await page.setViewportSize({width,height:900});
  for(const name of ["TIMBRES","GALERIA","MEU ESTÚDIO","EXPLORAR"]){await page.getByRole("link",{name,exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.getByRole("button",{name:"DAR MINHA OPINIÃO →"}).click();const box=await page.locator("#feedbackDialog").boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
  await page.keyboard.press("Escape");await expect(page.locator("#feedbackDialog")).not.toBeVisible();expect(errors).toEqual([]);
});

test("avaliação só confirma depois de salvar e não expõe o painel",async({page,community})=>{
  await page.getByRole("button",{name:"DAR MINHA OPINIÃO →"}).click();await page.locator('[name=experience][value=problema]').check();await page.locator("#feedbackComment").fill("Falha a investigar");
  await page.route("**/api/community/feedback",route=>route.fulfill({status:503,json:{error:"Armazenamento indisponível"}}));await page.locator('#feedbackForm button[type=submit]').click();
  await expect(page.locator("#feedbackError")).toContainText("indisponível");await expect(page.locator("#feedbackComment")).toHaveValue("Falha a investigar");await expect(page.locator("#feedbackSuccess")).not.toBeVisible();
  await page.unroute("**/api/community/feedback");await page.locator('#feedbackForm button[type=submit]').click();await expect(page.locator("#feedbackSuccess")).toBeVisible();
  expect(community.app.locals.db.prepare("SELECT comment FROM feedback").get().comment).toBe("Falha a investigar");await expect(page.locator("#adminLink")).not.toBeVisible();
});

test("fechar cadastro antes de confirmar não autentica e cancela a conta",async({page,community})=>{
  await page.locator(".account-button").click();await page.getByRole("button",{name:"CRIAR CONTA",exact:true}).click();await page.locator("#accountUser").fill("cancelada");await page.locator("#accountPassword").fill(phrase);await page.locator("#accountConfirm").fill(phrase);await page.locator("#accountSubmit").click();
  await expect(page.locator("#recoveryKeyDialog")).toBeVisible();expect(await page.evaluate(async()=>(await(await fetch("/api/community/session")).json()).user)).toBeNull();
  await page.keyboard.press("Escape");await expect(page.locator("#recoveryKeyDialog")).toBeVisible();await page.getByRole("button",{name:"Cancelar etapa da chave"}).click();await expect(page.locator("#recoveryKeyDialog")).not.toBeVisible();
  expect(community.app.locals.db.prepare("SELECT COUNT(*) n FROM users").get().n).toBe(0);await page.reload();await expect(page.locator("#accountLabel")).toHaveText("ENTRAR / CRIAR CONTA");
});

test("cadastro confirmado persiste, senha incorreta falha e recuperação troca chave",async({page})=>{
  const key=await register(page,"musico");await page.reload();await expect(page.locator("#accountLabel")).toHaveText("@musico");
  await page.getByRole("button",{name:"SAIR DA CONTA"}).click();await page.locator(".account-button").click();await page.locator("#accountUser").fill("musico");await page.locator("#accountPassword").fill(phrase+" errada");await page.locator("#accountSubmit").click();await expect(page.locator("#accountError")).toContainText("inválidos");
  await page.getByRole("button",{name:"ESQUECI MINHA SENHA"}).click();await page.locator("#passwordUser").fill("musico");await page.locator("#passwordProof").fill(key);await page.locator("#newPassword").fill(phrase+" nova");await page.locator("#newPasswordConfirm").fill(phrase+" nova");await page.locator('#passwordForm button[type=submit]').click();
  await expect(page.locator("#recoveryKeyDialog")).toBeVisible();expect(await page.locator("#recoveryKey").inputValue()).not.toBe(key);await expect(page.locator("#accountLabel")).toHaveText("ENTRAR / CRIAR CONTA");await page.locator("#keySaved").check();await page.locator("#finishSignup").click();
  await page.locator("#accountUser").fill("musico");await page.locator("#accountPassword").fill(phrase+" nova");await page.locator("#accountSubmit").click();await expect(page.locator("#accountLabel")).toHaveText("@musico");
});

test("favoritar preserva o foco do teclado ao atualizar os cartões",async({page,community})=>{
  await seed(community);await register(page);await page.getByRole("link",{name:"TIMBRES",exact:true}).click();const favorite=page.locator('#presetCards [data-action=favorite]');await expect(favorite).toBeVisible();await favorite.focus();await expect(favorite).toBeFocused();await page.keyboard.press("Space");await expect(favorite).toHaveAttribute("aria-pressed","true");await expect(favorite).toBeFocused();await page.keyboard.press("Space");await expect(favorite).toHaveAttribute("aria-pressed","false");await expect(favorite).toBeFocused();
});

test("preset capturado aplica os mesmos parâmetros na ferramenta real",async({page,community})=>{
  await register(page);const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/guitarra.html");await page.locator("#ampGain").fill("37");await page.getByRole("button",{name:"SALVAR MEU TIMBRE"}).click();await expect(page.locator("#publishDialog")).toBeVisible();
  await page.locator("#creationTitle").fill("Minha guitarra");await page.locator("#creationDescription").fill("Capturei o ganho e todos os pedais");await page.locator('#publishForm button[type=submit]').click();await expect(page.locator("#savedCards")).toContainText("Minha guitarra");
  const row=community.app.locals.db.prepare("SELECT preset FROM creations").get();expect(JSON.parse(row.preset).data.gain).toBe(37);
  await page.locator('#savedCards [data-action=detail]').click();await page.locator("#applyPresetLink").click();page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"APLICAR: Minha guitarra"}).click();await expect(page.locator("#ampGain")).toHaveValue("37");expect(errors).toEqual([]);
  await page.goto("/voz.html");await page.locator("#pitch").fill("3");await page.getByRole("button",{name:"SALVAR MEU TIMBRE"}).click();await expect(page.locator("#presetSummary")).toContainText("VOZ WEB");
  await page.locator("#creationTitle").fill("Minha voz");await page.locator("#creationDescription").fill("Afinação capturada");await page.locator('#publishForm button[type=submit]').click();
  await page.locator('#savedCards .sound-card').filter({hasText:"Minha voz"}).locator('[data-action=detail]').click();await page.locator("#applyPresetLink").click();page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"APLICAR: Minha voz"}).click();await expect(page.locator("#pitch")).toHaveValue("3");expect(errors).toEqual([]);
});

test("edição, visibilidade e exclusão modificam somente a criação própria",async({page})=>{
  await register(page);await page.getByRole("link",{name:"TIMBRES",exact:true}).click();await page.getByRole("button",{name:"＋ COMPARTILHAR TIMBRE"}).click();
  await page.locator("#presetFile").setInputFiles({name:"preset.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(initialPreset("guitarra")))});await expect(page.locator("#presetSummary")).toContainText("validado");
  await page.locator("#creationTitle").fill("Título inicial");await page.locator("#creationDescription").fill("Preset privado");await page.locator('#publishForm button[type=submit]').click();await expect(page.locator("#savedCards")).toContainText("Título inicial");
  await page.locator('#savedCards [data-action=edit]').click();await page.locator("#creationTitle").fill("Título revisado");await page.locator("#creationVisibility").selectOption("public");await page.locator('#publishForm button[type=submit]').click();await expect(page.locator("#savedCards")).toContainText("Aguardando moderação");
  await page.locator('#savedCards [data-action=delete]').click();await page.locator("#confirmDelete").click();await expect(page.locator("#savedCards .sound-card")).toHaveCount(0);
});

test("upload privado reproduz WAV real, sem áudio sintético substituto",async({page,browserName})=>{
  test.skip(browserName==="webkit"&&process.platform==="win32","O WebKit do Playwright para Windows não oferece áudio; o CI executa este cenário no Linux.");
  await register(page);await page.getByRole("link",{name:"GALERIA",exact:true}).click();await page.getByRole("button",{name:"＋ NOVA PRÉVIA"}).click();await page.locator("#creationTitle").fill("Meu áudio");await page.locator("#creationDescription").fill("Sinal de teste");await page.locator("#audioFile").setInputFiles({name:"teste.wav",mimeType:"audio/wav",buffer:wav(1,440)});await page.locator('#publishForm button[type=submit]').click();
  await expect(page.locator("#myPublications")).toContainText("Meu áudio");await page.locator('#myPublications [data-action=detail]').click();await expect(page.locator("#detailAudio")).toBeVisible();await expect.poll(()=>page.locator("#detailAudio").evaluate(a=>a.readyState)).toBeGreaterThan(0);await expect(page.locator("#applyPresetLink")).not.toBeVisible();
});

test("painel real exige admin e preserva foco ao classificar avaliação",async({page,community})=>{
  const call=community.client();await account(call,"administrador");community.app.locals.db.exec("UPDATE users SET admin=1");await call("/feedback",post({tool:"site",experience:"bem",comment:"<img src=x onerror=alert(1)>"}));
  await login(page,"administrador");await page.locator("#adminLink").click();await expect(page.locator("#feedbackList")).toContainText("<img src=x onerror=alert(1)>");expect(await page.locator("#feedbackList img").count()).toBe(0);
  const select=page.locator("#feedbackList select");await select.focus();await select.selectOption("analise");await expect(select).toBeEnabled();await expect(select).toBeFocused();expect(community.app.locals.db.prepare("SELECT status FROM feedback").get().status).toBe("analise");
});

test("exemplo baixado usa andamento e síntese reais e importa no MIXMASTER",async({page,context,community,browserName})=>{
  test.skip(browserName==="webkit"&&process.platform==="win32","O WebKit do Playwright para Windows não oferece Web Audio; o CI executa este cenário no Linux.");
  await page.locator('#exampleCards [data-action=example]').click();const buffer=await downloadBytes(page,"#downloadExample"),file=JSON.parse(buffer);expect(file.project.bpm).toBe(120);expect(file.assets).toEqual([]);
  const result=await page.evaluate(async project=>{
    const {scheduleMidiNotes}=await import("/js/mixmaster/midi-synth.js?v=1");const offline=new OfflineAudioContext(1,16000,8000);scheduleMidiNotes(offline,project.tracks[0].clips[0],project.bpm,0,0,offline.destination);const audio=(await offline.startRendering()).getChannelData(0);return{sound:Math.max(...audio.slice(200,400).map(Math.abs)),gap:Math.max(...audio.slice(1200,1600).map(Math.abs)),second:Math.max(...audio.slice(2200,2400).map(Math.abs))};
  },file.project);expect(result.sound).toBeGreaterThan(.05);expect(result.gap).toBe(0);expect(result.second).toBeGreaterThan(.05);
  const mixer=await context.newPage();mixer.on("dialog",d=>d.accept());await mixer.goto(community.origin+"/mixmaster.html");await mixer.locator("#projectFile").setInputFiles({name:"exemplo.nichodev.json",mimeType:"application/json",buffer});await expect(mixer.locator("#projectStatus")).toContainText("Backup restaurado");await expect(mixer.locator(".track-name")).toContainText("MEU PRIMEIRO LOOP");await expect(mixer.locator(".midi-clip")).toHaveCount(1);
});
