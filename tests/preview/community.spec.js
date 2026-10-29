const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");

const phrase = "frase ficticia para homologacao";

async function login(page, username = "visitante_demo") {
  await page.locator(".account-button").click();
  await page.locator("#accountUser").fill(username);
  await page.locator("#accountPassword").fill(phrase);
  await page.getByRole("button", { name: "SIMULAR ENTRADA →", exact: true }).click();
  await expect(page.locator('[data-view="estudio"]')).toBeVisible();
}
async function register(page, username) {
  await page.locator(".account-button").click();
  await page.getByRole("button", { name: "CRIAR CONTA", exact: true }).click();
  await page.locator("#accountUser").fill(username);
  await page.locator("#accountPassword").fill(phrase);
  await page.locator("#accountConfirm").fill(phrase);
  await page.getByRole("button", { name: "SIMULAR CADASTRO →" }).click();
  await expect(page.locator("#recoveryKeyDialog")).toBeVisible();
  const key = await page.locator("#recoveryKey").inputValue();
  await expect(page.locator("#finishSignup")).toBeDisabled();
  await page.locator("#keySaved").check();
  await page.locator("#finishSignup").click();
  return key;
}
async function logout(page) {
  await page.getByRole("link", { name: "MEU ESTÚDIO", exact: true }).click();
  await page.getByRole("button", { name: "SAIR DA DEMONSTRAÇÃO" }).click();
}
test.beforeEach(async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
  await page.goto("/");
});

for (const width of [360, 768, 1280]) {
  test("navegação e avaliação cabem na largura " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const view of ["TIMBRES", "GALERIA", "MEU ESTÚDIO", "EXPLORAR"]) {
      await page.getByRole("link", { name: view, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole("button", { name: "DAR MINHA OPINIÃO →" }).click();
    const bounds = await page.locator("#feedbackDialog").boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await page.keyboard.press("Escape");
    await expect(page.locator("#feedbackDialog")).not.toBeVisible();
    expect(errors).toEqual([]);
  });
}
test("avaliação é privada, opcional e somente da sessão; painel altera situação", async ({ page }) => {
  const writes = [];
  page.on("request", request => { if (request.method() !== "GET") writes.push(request.url()); });
  await page.getByRole("button", { name: "DAR MINHA OPINIÃO →" }).click();
  await page.getByLabel("Tive dificuldade", { exact: true }).check();
  await page.getByRole("button", { name: "SIMULAR ENVIO PRIVADO →" }).click();
  await expect(page.locator("#feedbackSuccess")).toContainText("Nenhuma mensagem foi enviada");
  await page.getByRole("button", { name: "VER PAINEL DEMO" }).click();
  await expect(page.locator("#feedbackList")).toContainText("Sem comentário.");
  await expect(page.locator("#feedbackList")).toContainText("Sem contato informado.");
  await page.locator("#feedbackList select").selectOption("analise");
  await page.locator("#feedbackFilter").selectOption("recebido");
  await expect(page.locator("#feedbackList")).toContainText("Nenhuma avaliação");
  await page.locator("#feedbackFilter").selectOption("analise");
  await expect(page.locator("#feedbackList .feedback-item")).toHaveCount(1);
  expect(writes).toEqual([]);
  await page.reload();
  await expect(page.locator("#feedbackList")).toContainText("Nenhuma avaliação");
});
test("comentário é texto, sem executar HTML; formulário exige a experiência", async ({ page }) => {
  await page.getByRole("button", { name: "DAR MINHA OPINIÃO →" }).click();
  expect(await page.locator("#feedbackForm").evaluate(form => form.checkValidity())).toBe(false);
  await page.getByLabel("Encontrei um problema", { exact: true }).check();
  await page.locator("#feedbackComment").fill('<img src=x onerror="window.injetado=true">');
  await page.getByRole("button", { name: "SIMULAR ENVIO PRIVADO →" }).click();
  await page.getByRole("button", { name: "VER PAINEL DEMO" }).click();
  await expect(page.locator("#feedbackList")).toContainText("<img src=x");
  await expect(page.locator("#feedbackList img")).toHaveCount(0);
  expect(await page.evaluate(() => window.injetado)).toBeUndefined();
});
test("cadastro confere campos, chave demo e duplicidade sem guardar senha", async ({ page }) => {
  await page.locator(".account-button").click();
  await page.getByRole("button", { name: "CRIAR CONTA", exact: true }).click();
  await page.locator("#accountUser").fill("ab");
  await page.locator("#accountPassword").fill(phrase);
  await page.locator("#accountConfirm").fill("outra frase ficticia");
  expect(await page.locator("#accountForm").evaluate(form => form.checkValidity())).toBe(false);
  await page.locator("#accountUser").fill("Artista_demo");
  await page.getByRole("button", { name: "SIMULAR CADASTRO →" }).click();
  await expect(page.locator("#accountError")).toContainText("não coincidem");
  await page.locator("#accountConfirm").fill(phrase);
  await page.getByRole("button", { name: "SIMULAR CADASTRO →" }).click();
  await expect(page.locator("#recoveryKey")).toHaveValue(/^DEMO-/);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "BAIXAR CHAVE DEMO" }).click();
  const download = await downloadPromise;
  const keyText = await fs.readFile(await download.path(), "utf8");
  expect(keyText).toContain("SEM VALIDADE REAL");
  expect(keyText).toContain("artista_demo");
  expect(keyText).not.toContain(phrase);
  await page.locator("#keySaved").check();
  await page.locator("#finishSignup").click();
  expect(await page.locator("#accountPassword").inputValue()).toBe("");
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await logout(page);
  await page.locator(".account-button").click();
  await page.getByRole("button", { name: "CRIAR CONTA", exact: true }).click();
  await page.locator("#accountUser").fill("ARTISTA_DEMO");
  await page.locator("#accountPassword").fill(phrase);
  await page.locator("#accountConfirm").fill(phrase);
  await page.getByRole("button", { name: "SIMULAR CADASTRO →" }).click();
  await expect(page.locator("#accountError")).toContainText("já existe");
});
test("recuperação liga a chave ao usuário e invalida a chave anterior", async ({ page }) => {
  const firstKey = await register(page, "primeiro_demo");
  await logout(page);
  const otherKey = await register(page, "segundo_demo");
  expect(firstKey).not.toBe(otherKey);
  await logout(page);
  await page.locator(".account-button").click();
  await page.getByRole("button", { name: "ESQUECI MINHA SENHA" }).click();
  await page.locator("#passwordUser").fill("primeiro_demo");
  await page.locator("#passwordProof").fill(otherKey);
  await page.locator("#newPassword").fill(phrase);
  await page.locator("#newPasswordConfirm").fill(phrase);
  await page.getByRole("button", { name: "SIMULAR ALTERAÇÃO →" }).click();
  await expect(page.locator("#passwordError")).toContainText("Confira o usuário");
  await page.locator("#passwordProof").fill(firstKey);
  await page.getByRole("button", { name: "SIMULAR ALTERAÇÃO →" }).click();
  const nextKey = await page.locator("#recoveryKey").inputValue();
  expect(nextKey).not.toBe(firstKey);
  await page.locator("#keySaved").check();
  await page.locator("#finishSignup").click();
  await expect(page.locator("#accountLabel")).toHaveText("@primeiro_demo");
  await logout(page);
  await page.locator(".account-button").click();
  await page.getByRole("button", { name: "ESQUECI MINHA SENHA" }).click();
  await page.locator("#passwordUser").fill("primeiro_demo");
  await page.locator("#passwordProof").fill(firstKey);
  await page.locator("#newPassword").fill(phrase);
  await page.locator("#newPasswordConfirm").fill(phrase);
  await page.getByRole("button", { name: "SIMULAR ALTERAÇÃO →" }).click();
  await expect(page.locator("#passwordError")).toContainText("Confira o usuário");
});
test("favoritar convida ao login e preserva a ação; filtros e cópia funcionam", async ({ page }) => {
  await page.getByRole("link", { name: "TIMBRES", exact: true }).click();
  await page.getByRole("button", { name: "GUITARRA WEB", exact: true }).click();
  await expect(page.locator("#presetCards .sound-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Favoritar Guitarra espacial limpa", exact: true }).click();
  await page.locator("#accountPassword").fill(phrase);
  await page.getByRole("button", { name: "SIMULAR ENTRADA →" }).click();
  await expect(page.locator("#favoriteCards .sound-card")).toHaveCount(1);
  await page.locator("#favoriteCards").getByRole("button", { name: "SALVAR CÓPIA" }).click();
  await expect(page.locator("#savedCards")).toContainText("Guitarra espacial limpa · minha versão");
});
test("criações começam privadas e só a visibilidade pública entra na galeria", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "GALERIA", exact: true }).click();
  await page.getByRole("button", { name: "＋ NOVA PRÉVIA", exact: true }).click();
  await expect(page.locator("#creationVisibility")).toHaveValue("private");
  await page.locator("#creationTitle").fill("Minha prévia privada");
  await page.locator("#creationDescription").fill("Exemplo fictício");
  await page.getByRole("button", { name: "SALVAR EXEMPLO NESTA SESSÃO →" }).click();
  await expect(page.locator("#myPublications")).toContainText("Minha prévia privada");
  await expect(page.locator("#galleryCards")).not.toContainText("Minha prévia privada");
  await page.getByRole("link", { name: "TIMBRES", exact: true }).click();
  await page.getByRole("button", { name: "＋ COMPARTILHAR TIMBRE", exact: true }).click();
  await page.locator("#creationTitle").fill("Meu timbre público");
  await page.locator("#creationDescription").fill("Outro exemplo fictício");
  await page.locator("#creationVisibility").selectOption("public");
  await page.getByRole("button", { name: "SALVAR EXEMPLO NESTA SESSÃO →" }).click();
  await expect(page.locator("#presetCards")).toContainText("Meu timbre público");
  await expect(page.locator("#galleryCards")).toContainText("Meu timbre público");
});
test("troca de senha e chave são explícitas como simulações", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "CONFIGURAÇÕES DA CONTA" }).click();
  await page.getByRole("button", { name: "ALTERAR SENHA", exact: true }).click();
  await page.locator("#passwordProof").fill(phrase);
  await page.locator("#newPassword").fill(phrase);
  await page.locator("#newPasswordConfirm").fill(phrase);
  await page.getByRole("button", { name: "SIMULAR ALTERAÇÃO →" }).click();
  await expect(page.locator("#pageStatus")).toContainText("Nenhuma senha foi armazenada");
  await page.getByRole("button", { name: "CONFIGURAÇÕES DA CONTA" }).click();
  await page.getByRole("button", { name: "GERAR OUTRA CHAVE DEMO" }).click();
  await page.locator("#passwordProof").fill(phrase);
  await page.getByRole("button", { name: "SIMULAR ALTERAÇÃO →" }).click();
  await expect(page.locator("#recoveryKeyDialog")).toBeVisible();
});
test("áudio inicia só por ação, ajusta parâmetros e fecha ao sair do laboratório", async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext || window.webkitAudioContext;
    window.previewContexts = [];
    window.AudioContext = function (...args) { const context = new Original(...args); window.previewContexts.push(context); return context; };
  });
  await page.reload();
  expect(await page.evaluate(() => window.previewContexts.length)).toBe(0);
  await page.locator("#exampleCards .sound-card").first().getByRole("button", { name: "EXPERIMENTAR →" }).click();
  await page.locator("#labPlay").click();
  await expect.poll(() => page.evaluate(() => window.previewContexts.at(-1)?.state)).toBe("running");
  await page.locator("#labTone").fill("80");
  await expect(page.locator("#toneOutput")).toHaveText("80%");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => window.previewContexts.at(-1)?.state)).toBe("closed");
  await page.getByRole("link", { name: "GALERIA", exact: true }).click();
  await page.locator("#galleryCards .sound-card").first().getByRole("button", { name: "▶ OUVIR PRÉVIA" }).click();
  await page.locator("#detailPlay").click();
  await expect(page.locator("#detailPlay")).toHaveText("■ PARAR PRÉVIA");
  await page.locator("#detailPlay").click();
  await expect(page.locator("#detailPlay")).toHaveText("▶ OUVIR PRÉVIA");
  await expect.poll(() => page.evaluate(() => window.previewContexts.at(-1)?.state)).toBe("closed");
});
test("exemplo baixado importa no MIXMASTER real sem arquivos de áudio externos", async ({ page, context }) => {
  await page.locator("#exampleCards .sound-card").first().getByRole("button", { name: "EXPERIMENTAR →" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#downloadExample").click();
  const download = await downloadPromise;
  const buffer = await fs.readFile(await download.path());
  const backup = JSON.parse(buffer.toString());
  expect(backup.app).toBe("nichodev-mixmaster");
  expect(backup.assets).toEqual([]);
  await expect(page.locator("#labFeedback")).toBeVisible();
  await page.locator("#labFeedback").click();
  await expect(page.locator("#feedbackTool")).toHaveValue("mixmaster");
  await page.keyboard.press("Escape");
  const mixer = await context.newPage();
  mixer.on("dialog", dialog => dialog.accept());
  await mixer.goto("http://127.0.0.1:3000/mixmaster.html");
  await mixer.locator("#projectFile").setInputFiles({ name: download.suggestedFilename(), mimeType: "application/json", buffer });
  await expect(mixer.locator("#projectStatus")).toContainText("Backup restaurado");
  await expect(mixer.locator(".track-name")).toContainText("MEU PRIMEIRO LOOP");
  await expect(mixer.locator(".midi-clip")).toHaveCount(1);
});
test("servidor da prévia não expõe código do servidor ou endpoint de escrita", async ({ request }) => {
  for (const route of ["/server.js", "/package.json", "/../server.js", "/toString", "/constructor"]) expect((await request.get(route)).status()).toBe(404);
  expect((await request.post("/api/feedback", { data: {} })).status()).toBe(404);
  const response = await request.get("/");
  expect(response.headers()["content-security-policy"]).toContain("connect-src 'none'");
  expect(await response.text()).toContain("noindex,nofollow");
});
