(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const presets = [
    { id: "espacial", title: "Guitarra espacial limpa", tool: "guitarra", author: "pixel_demo", description: "Um ponto de partida com brilho, ecos leves e espaço entre as notas.", tags: ["Limpo", "Espacial"], tone: 65, delay: 36, space: 42 },
    { id: "voz-arcade", title: "Voz de arcade", tool: "voz", author: "onda_demo", description: "Uma ideia de voz com presença e uma ambiência curta para explorar.", tags: ["Voz", "Criativo"], tone: 76, delay: 18, space: 22 },
    { id: "quarto", title: "Som de quarto", tool: "guitarra", author: "fita_demo", description: "Menos agudos, um pouco de delay e um clima mais íntimo.", tags: ["Suave", "Ambiente"], tone: 32, delay: 24, space: 28 },
    { id: "voz-proxima", title: "Voz por perto", tool: "voz", author: "pixel_demo", description: "Uma referência mais seca para comparar com os efeitos espaciais.", tags: ["Voz", "Seco"], tone: 50, delay: 0, space: 5 }
  ];
  const examples = [
    { id: "primeiro-loop", title: "Meu primeiro loop", tool: "mixmaster", description: "Ouça uma sequência simples e baixe uma cópia editável para o MIXMASTER.", tags: ["MIDI", "Editável"], tone: 52, delay: 12, space: 18 },
    { ...presets[0], id: "exemplo-guitarra", title: "Espaço entre as notas", description: "Mexa no tom, no delay e na ambiência de uma pequena frase sintetizada." },
    { ...presets[1], id: "exemplo-voz", title: "Uma ideia de voz", description: "Explore o fluxo de um preset de voz com uma amostra sintetizada, sem gravar." }
  ];
  const publications = [
    { id: "noite-pixel", title: "Noite em pixels", author: "pixel_demo", tool: "mixmaster", type: "musica", description: "Uma pequena trilha imaginada para o começo de um jogo.", visibility: "public", presetId: "espacial" },
    { id: "ecos", title: "Ecos de uma ideia", author: "onda_demo", tool: "guitarra", type: "experimento", description: "Notas espaçadas e ecos para deixar o som respirar.", visibility: "public", presetId: "quarto" },
    { id: "sinal", title: "Sinal de outro lugar", author: "fita_demo", tool: "voz", type: "experimento", description: "Um estudo fictício de textura e ambiência.", visibility: "public", presetId: "voz-arcade" }
  ];
  const toolNames = { guitarra: "GUITARRA WEB", voz: "VOZ WEB", mixmaster: "MIXMASTER", site: "SITE / COMUNIDADE" };
  const experienceNames = { bem: "Funcionou bem", dificuldade: "Tive dificuldade", problema: "Encontrei um problema" };
  const accounts = new Map();
  const feedback = [];
  let user = null, accountMode = "login", passwordMode = "recover", presetFilter = "todos", galleryFilter = "todos";
  let labItem = null, detailItem = null, publishKind = "publication", sequence = 1, keySequence = 1, pendingAction = null;
  let demoKey = "DEMO-CHAVE-SEM-VALIDADE-0001", activeAudio = null, audioTimer = null, feedbackInvited = false;
  const status = text => { $("pageStatus").textContent = text; };
  const lookup = id => [...allPresets(), ...examples, ...(user?.saved || [])].find(item => item.id === id);
  const closeDialogs = () => { document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close()); };
  const openDialog = id => { closeDialogs(); $(id).showModal(); };
  const normalize = name => name.trim().toLowerCase();
  const profile = name => ({ username: normalize(name), key: "DEMO-CHAVE-SEM-VALIDADE-" + String(++keySequence).padStart(4, "0"), favorites: new Set(), saved: [], publications: [] });
  const allPresets = () => [...presets, ...[...accounts.values()].flatMap(account => account.saved).filter(item => item.visibility === "public")];
  const navigate = view => { history.replaceState(null, "", "#" + view); route(); };
  const allPublications = () => [...publications, ...[...accounts.values()].flatMap(account => account.publications).filter(item => item.visibility === "public")];

  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy(text, target) {
    try { await navigator.clipboard.writeText(text); $(target).textContent = "Copiado. Conteúdo demonstrativo, sem validade real."; }
    catch { $(target).textContent = "A cópia automática não está disponível. Selecione e copie: " + text; }
  }
  function requireAccount(action) {
    if (user) { action(); return; }
    pendingAction = action;
    showAccount("login");
  }
  function card(item, kind) {
    const element = document.createElement("article");
    element.className = "sound-card";
    element.innerHTML = '<p class="card-kicker"></p><h3></h3><p class="card-author"></p><div class="card-visual" aria-hidden="true"></div><p class="card-description"></p><div class="tags"></div><div class="card-actions"></div>';
    element.querySelector(".card-kicker").textContent = toolNames[item.tool];
    element.querySelector("h3").textContent = item.title;
    element.querySelector(".card-author").textContent = item.author ? "por @" + item.author : "EXEMPLO NICHODEV";
    element.querySelector(".card-description").textContent = item.description;
    for (const text of item.tags || [item.visibility === "private" ? "Privado" : item.visibility === "unlisted" ? "Não listado" : "Público"]) {
      const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = text;
      element.querySelector(".tags").append(tag);
    }
    const actions = element.querySelector(".card-actions");
    const primary = document.createElement("button");
    primary.type = "button"; primary.className = "button outline compact"; primary.dataset.id = item.id;
    primary.dataset.action = kind === "publication" ? "detail" : "lab";
    primary.textContent = kind === "publication" ? "▶ OUVIR PRÉVIA" : "EXPERIMENTAR →";
    actions.append(primary);
    if (kind === "preset") {
      const favorite = document.createElement("button");
      favorite.type = "button"; favorite.className = "favorite-button"; favorite.dataset.action = "favorite"; favorite.dataset.id = item.id;
      favorite.setAttribute("aria-pressed", String(Boolean(user?.favorites.has(item.id))));
      favorite.setAttribute("aria-label", "Favoritar " + item.title); favorite.textContent = user?.favorites.has(item.id) ? "★" : "☆";
      const save = document.createElement("button");
      save.type = "button"; save.className = "text-link"; save.dataset.action = "save-preset"; save.dataset.id = item.id; save.textContent = "SALVAR CÓPIA";
      actions.append(favorite, save);
    }
    return element;
  }
  function fillCards(id, items, kind, empty = "Nenhum exemplo por aqui ainda.") {
    const root = $(id); root.replaceChildren();
    for (const item of items) root.append(card(item, kind));
    if (!items.length) { const note = document.createElement("p"); note.className = "empty-note"; note.textContent = empty; root.append(note); }
  }
  function render() {
    fillCards("exampleCards", examples, "example");
    fillCards("presetCards", allPresets().filter(item => presetFilter === "todos" || item.tool === presetFilter), "preset");
    fillCards("galleryCards", allPublications().filter(item => galleryFilter === "todos" || item.type === galleryFilter), "publication");
    $("accountLabel").textContent = user ? "@" + user.username : "ENTRAR / CRIAR CONTA";
    $("studioGuest").hidden = Boolean(user); $("studioMember").hidden = !user;
    $("studioSubtitle").textContent = user ? "Olá, @" + user.username + ". Esta área existe apenas nesta sessão demonstrativa." : "Entre na demonstração para explorar sua área pessoal.";
    if (user) {
      fillCards("favoriteCards", allPresets().filter(item => user.favorites.has(item.id)), "preset", "Favorite um timbre para encontrá-lo aqui.");
      fillCards("savedCards", user.saved, "saved", "Salve uma cópia de um timbre ou crie um exemplo.");
      fillCards("myPublications", user.publications, "publication", "Suas prévias começam privadas. A publicação real virá em outra etapa.");
    }
    renderFeedback();
  }
  function renderFeedback() {
    const root = $("feedbackList"), filter = $("feedbackFilter").value; root.replaceChildren();
    for (const item of feedback.filter(entry => filter === "todos" || entry.status === filter)) {
      const element = document.createElement("article"); element.className = "feedback-item";
      const meta = document.createElement("p"); meta.className = "feedback-meta"; meta.textContent = toolNames[item.tool] + " / " + experienceNames[item.experience];
      const comment = document.createElement("p"); comment.textContent = item.comment || "Sem comentário.";
      const contact = document.createElement("p"); contact.textContent = item.contact ? "Contato fictício: " + item.contact : "Sem contato informado.";
      const label = document.createElement("label"); label.textContent = "Situação "; label.htmlFor = "feedback-" + item.id;
      const select = document.createElement("select"); select.id = label.htmlFor;
      for (const [value, text] of [["recebido", "Recebido"], ["analise", "Em análise"], ["concluido", "Concluído"]]) {
        const option = document.createElement("option"); option.value = value; option.textContent = text; select.append(option);
      }
      select.value = item.status;
      select.addEventListener("change", () => { item.status = select.value; renderFeedback(); });
      element.append(meta, comment, contact, label, select); root.append(element);
    }
    if (!root.children.length) { const note = document.createElement("p"); note.className = "empty-note"; note.textContent = "Nenhuma avaliação simulada nesta situação."; root.append(note); }
  }
  function route() {
    const view = location.hash.slice(1) || "inicio";
    const selected = view.startsWith("criacao/") ? "galeria" : ["inicio", "timbres", "galeria", "estudio", "painel"].includes(view) ? view : "inicio";
    closeDialogs(); stopAudio();
    document.querySelectorAll("[data-view]").forEach(section => { section.hidden = section.dataset.view !== selected; });
    document.querySelectorAll("[data-view-link]").forEach(link => {
      if (link.dataset.viewLink === selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    status("");
    if (view.startsWith("criacao/")) {
      const item = publications.find(entry => entry.id === view.slice(8));
      if (item) { document.querySelector('[data-view="inicio"]').hidden = true; document.querySelector('[data-view="galeria"]').hidden = false; showDetail(item); }
    }
  }
  function showAccount(mode) {
    accountMode = mode; $("accountTitle").textContent = mode === "register" ? "CRIAR CONTA" : "ENTRAR";
    $("confirmPasswordField").hidden = mode !== "register"; $("accountConfirm").required = mode === "register";
    $("accountSubmit").textContent = mode === "register" ? "SIMULAR CADASTRO →" : "SIMULAR ENTRADA →";
    $("accountError").textContent = "";
    document.querySelectorAll("[data-account-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.accountMode === mode)));
    if (user) $("accountUser").value = user.username;
    openDialog("accountDialog");
  }
  function finishAuth() {
    const action = pendingAction; pendingAction = null;
    render(); navigate("estudio"); closeDialogs();
    status("Conta demonstrativa aberta. Nenhuma autenticação real foi realizada.");
    if (action) action();
  }
  function showKey(newKey = true) {
    if (newKey) user.key = "DEMO-CHAVE-SEM-VALIDADE-" + String(++keySequence).padStart(4, "0");
    demoKey = user.key;
    $("recoveryKey").value = demoKey; $("keySaved").checked = false; $("finishSignup").disabled = true; $("keyStatus").textContent = "";
    openDialog("recoveryKeyDialog");
  }
  function showPassword(mode) {
    passwordMode = mode;
    $("passwordTitle").textContent = mode === "recover" ? "RECUPERAR SENHA" : mode === "rotate" ? "SUBSTITUIR CHAVE" : "ALTERAR SENHA";
    $("passwordIntro").textContent = mode === "recover" ? "Use o usuário de demonstração e a chave fictícia. Na versão real, a recuperação encerrará as sessões anteriores e substituirá a chave." : "Na versão real, sua senha atual será conferida antes da alteração. Aqui, use qualquer frase fictícia com pelo menos 15 caracteres.";
    $("passwordProofLabel").textContent = mode === "recover" ? "CHAVE DE RECUPERAÇÃO DEMO" : "SENHA ATUAL FICTÍCIA";
    $("passwordProof").type = mode === "recover" ? "text" : "password";
    $("passwordProof").minLength = mode === "recover" ? 1 : 15;
    $("passwordUser").value = user?.username || $("accountUser").value || "visitante_demo";
    $("passwordUser").readOnly = mode !== "recover";
    $("newPassword").parentElement.querySelector('label[for="newPassword"]').hidden = mode === "rotate";
    $("newPassword").hidden = mode === "rotate"; $("newPassword").required = mode !== "rotate";
    $("newPasswordConfirm").parentElement.querySelector('label[for="newPasswordConfirm"]').hidden = mode === "rotate";
    $("newPasswordConfirm").hidden = mode === "rotate"; $("newPasswordConfirm").required = mode !== "rotate";
    $("passwordError").textContent = ""; openDialog("passwordDialog");
  }
  function showLab(item) {
    labItem = item;
    $("labTitle").textContent = item.title; $("labTool").textContent = toolNames[item.tool] + " / LABORATÓRIO DE EXEMPLO";
    $("labDescription").textContent = item.description;
    for (const [id, value] of [["labTone", item.tone], ["labDelay", item.delay], ["labSpace", item.space]]) $(id).value = value;
    updateLabLabels();
    $("labFavorite").hidden = !allPresets().some(preset => preset.id === item.id);
    $("labFavorite").textContent = user?.favorites.has(item.id) ? "★ FAVORITADO" : "☆ FAVORITAR";
    $("downloadExample").hidden = item.tool !== "mixmaster"; $("downloadHelp").hidden = item.tool !== "mixmaster"; $("labFeedback").hidden = true;
    openDialog("labDialog");
  }
  function updateLabLabels() {
    for (const [input, output] of [["labTone", "toneOutput"], ["labDelay", "delayOutput"], ["labSpace", "spaceOutput"]]) $(output).textContent = $(input).value + "%";
  }
  function toggleFavorite(id) {
    requireAccount(() => {
      if (user.favorites.has(id)) user.favorites.delete(id); else user.favorites.add(id);
      render(); $("labFavorite").textContent = user.favorites.has(id) ? "★ FAVORITADO" : "☆ FAVORITAR";
      status("Favoritos atualizados apenas nesta sessão.");
    });
  }
  function savePreset(id) {
    requireAccount(() => {
      const original = lookup(id);
      user.saved.push({ ...original, id: "copia-" + sequence++, title: original.title + " · minha versão", author: user.username });
      render(); status("Cópia adicionada ao Meu Estúdio nesta sessão.");
    });
  }
  function showPublish(kind) {
    requireAccount(() => {
      publishKind = kind; $("publishForm").reset();
      $("publishTitle").textContent = kind === "preset" ? "COMPARTILHAR TIMBRE" : "COMPARTILHAR UMA IDEIA";
      $("creationTool").value = kind === "preset" ? "guitarra" : "mixmaster";
      $("creationTool").querySelector('[value="mixmaster"]').disabled = kind === "preset";
      $("visibilityHelp").textContent = "Começa privado. Nada será enviado; o exemplo ficará apenas nesta sessão.";
      openDialog("publishDialog");
    });
  }
  function showDetail(item) {
    detailItem = item; $("detailTitle").textContent = item.title; $("detailMeta").textContent = toolNames[item.tool] + " / @" + item.author;
    $("detailDescription").textContent = item.description;
    $("detailVisibility").textContent = item.visibility === "private" ? "Privado · somente na sua área de demonstração." : item.visibility === "unlisted" ? "Não listado · no produto real, qualquer pessoa com o link poderá acessar e repassá-lo." : "Público · conteúdo fictício da galeria demonstrativa.";
    $("shareStatus").textContent = ""; openDialog("detailDialog");
  }
  function demoProject() {
    const notes = [7, 5, 3, 5, 6, 4, 2, 4].map((pitch, step) => ({ pitch, step: step * 2, velocity: .65 }));
    const clip = { id: "demo-clip", type: "midi", name: "Primeiro loop", start: 0, duration: 2, notes };
    const track = { id: "demo-track", type: "midi", name: "MEU PRIMEIRO LOOP", volume: .7, pan: 0, tone: .8, delay: .12, reverb: .18, muted: false, solo: false, clips: [clip] };
    return { app: "nichodev-mixmaster", formatVersion: 1, exportedAt: new Date().toISOString(), project: { tracks: [track], selected: [clip.id], selectedTrackId: track.id, playhead: 0, bpm: 120, master: .65 }, assets: [] };
  }

  function stopAudio() {
    if (audioTimer) window.clearTimeout(audioTimer);
    audioTimer = null;
    if (activeAudio) { const context = activeAudio.context; activeAudio = null; context.close().catch(() => {}); }
    $("labPlay").textContent = "▶ OUVIR EXEMPLO"; $("labPlaybackStatus").textContent = "AMOSTRA SINTETIZADA · 4 SEGUNDOS";
    document.querySelectorAll(".lab-display").forEach(element => element.classList.remove("playing"));
  }
  async function playExample(item, lab = false) {
    if (activeAudio) { stopAudio(); return; }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) { status("Este navegador não oferece áudio para a demonstração."); return; }
    let context;
    try {
      context = new Context();
      const filter = context.createBiquadFilter(), output = context.createGain(), delay = context.createDelay(1), feedbackGain = context.createGain(), wet = context.createGain(), reverb = context.createConvolver(), space = context.createGain();
      filter.type = "lowpass"; output.gain.value = .35; delay.delayTime.value = .28; feedbackGain.gain.value = .24;
      filter.connect(output); filter.connect(delay); delay.connect(feedbackGain).connect(delay); delay.connect(wet).connect(output);
      filter.connect(reverb); reverb.connect(space).connect(output); output.connect(context.destination);
      const impulse = context.createBuffer(1, Math.floor(context.sampleRate * .7), context.sampleRate), samples = impulse.getChannelData(0);
      let seed = 31;
      for (let i = 0; i < samples.length; i++) { seed = (seed * 16807) % 2147483647; samples[i] = (seed / 2147483647 * 2 - 1) * Math.pow(1 - i / samples.length, 3); }
      reverb.buffer = impulse;
      activeAudio = { context, filter, wet, space };
      const parameters = lab ? { tone: Number($("labTone").value), delay: Number($("labDelay").value), space: Number($("labSpace").value) } : item;
      setAudioParameters(parameters);
      await context.resume();
      if (activeAudio?.context !== context) return;
      const start = context.currentTime + .03, frequencies = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];
      for (let i = 0; i < frequencies.length; i++) {
        const oscillator = context.createOscillator(), envelope = context.createGain(), time = start + i * .4;
        oscillator.type = item.tool === "voz" ? "sine" : "triangle"; oscillator.frequency.value = frequencies[i];
        envelope.gain.setValueAtTime(0, time); envelope.gain.linearRampToValueAtTime(.12, time + .015); envelope.gain.exponentialRampToValueAtTime(.001, time + .32);
        oscillator.connect(envelope).connect(filter); oscillator.start(time); oscillator.stop(time + .34);
      }
      $("labPlay").textContent = "■ PARAR EXEMPLO"; $("labPlaybackStatus").textContent = "REPRODUZINDO · AMOSTRA SINTETIZADA";
      document.querySelectorAll("dialog[open] .lab-display").forEach(element => element.classList.add("playing"));
      audioTimer = window.setTimeout(stopAudio, 4000);
    } catch {
      if (activeAudio?.context === context) stopAudio(); else if (context) context.close().catch(() => {});
      $("labPlaybackStatus").textContent = "Não foi possível iniciar o áudio. Tente novamente.";
      status("Não foi possível iniciar o áudio da demonstração.");
    }
  }
  function setAudioParameters(parameters) {
    if (!activeAudio) return;
    const { context, filter, wet, space } = activeAudio;
    filter.frequency.setTargetAtTime(250 + parameters.tone * 85, context.currentTime, .025);
    wet.gain.setTargetAtTime(parameters.delay / 100, context.currentTime, .025);
    space.gain.setTargetAtTime(parameters.space / 100, context.currentTime, .025);
  }

  $("feedbackForm").addEventListener("submit", event => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    feedback.unshift({ id: sequence++, tool: data.get("tool"), experience: data.get("experience"), comment: data.get("comment").trim(), contact: data.get("contact").trim(), status: "recebido" });
    $("feedbackForm").hidden = true; $("feedbackSuccess").hidden = false; renderFeedback();
    $("feedbackSuccess").querySelector("button").focus();
  });
  $("feedbackFilter").addEventListener("change", renderFeedback);
  $("accountForm").addEventListener("submit", event => {
    event.preventDefault(); const name = normalize($("accountUser").value); $("accountError").textContent = "";
    if (accountMode === "register" && accounts.has(name)) { $("accountError").textContent = "Esse usuário já existe nesta demonstração."; return; }
    if (accountMode === "register" && $("accountPassword").value !== $("accountConfirm").value) { $("accountError").textContent = "As senhas de demonstração não coincidem."; return; }
    if (!accounts.has(name)) accounts.set(name, profile(name));
    user = accounts.get(name);
    $("accountPassword").value = ""; $("accountConfirm").value = "";
    if (accountMode === "register") showKey(); else finishAuth();
  });
  $("keySaved").addEventListener("change", () => { $("finishSignup").disabled = !$("keySaved").checked; });
  $("finishSignup").addEventListener("click", finishAuth);
  $("passwordForm").addEventListener("submit", event => {
    event.preventDefault(); $("passwordError").textContent = "";
    if (passwordMode === "recover" && $("passwordProof").value.trim() !== accounts.get(normalize($("passwordUser").value))?.key) { $("passwordError").textContent = "Confira o usuário e a chave de demonstração."; return; }
    if (passwordMode === "recover" && !accounts.has(normalize($("passwordUser").value))) { $("passwordError").textContent = "Confira o usuário e a chave de demonstração."; return; }
    if (passwordMode !== "rotate" && $("newPassword").value !== $("newPasswordConfirm").value) { $("passwordError").textContent = "As novas senhas não coincidem."; return; }
    if (passwordMode === "recover") user = accounts.get(normalize($("passwordUser").value));
    $("passwordProof").value = ""; $("newPassword").value = ""; $("newPasswordConfirm").value = "";
    if (passwordMode === "recover" || passwordMode === "rotate") showKey();
    else { closeDialogs(); status("Fluxo de alteração concluído. Nenhuma senha foi armazenada ou alterada de verdade."); }
    render();
  });
  $("creationVisibility").addEventListener("change", event => {
    $("visibilityHelp").textContent = event.target.value === "unlisted" ? "Na versão real, quem tiver o link poderá acessar e repassá-lo. A prévia não gera um link público." : event.target.value === "public" ? "O exemplo aparecerá somente na galeria desta sessão. Não haverá publicação na internet." : "Começa privado. Nada será enviado; o exemplo ficará apenas nesta sessão.";
  });
  $("publishForm").addEventListener("submit", event => {
    event.preventDefault(); if (!user) return;
    const item = { ...presets[0], id: "criacao-" + sequence++, title: $("creationTitle").value.trim(), description: $("creationDescription").value.trim(), author: user.username, tool: $("creationTool").value, visibility: $("creationVisibility").value, type: publishKind === "preset" ? "experimento" : "musica", tags: undefined, presetId: "espacial" };
    if (!item.title || !item.description) return;
    if (publishKind === "preset") user.saved.push(item);
    user.publications.push(item); closeDialogs(); render(); navigate("estudio"); status("Exemplo salvo somente nesta sessão. Nada foi publicado ou enviado.");
  });
  for (const id of ["labTone", "labDelay", "labSpace"]) $(id).addEventListener("input", () => { updateLabLabels(); setAudioParameters({ tone: Number($("labTone").value), delay: Number($("labDelay").value), space: Number($("labSpace").value) }); });
  $("labPlay").addEventListener("click", () => playExample(labItem, true));
  $("labFavorite").addEventListener("click", () => toggleFavorite(labItem.id));
  $("downloadExample").addEventListener("click", () => { download("nichodev-primeiro-loop.nichodev.json", JSON.stringify(demoProject(), null, 2), "application/json"); if (!feedbackInvited) { $("labFeedback").hidden = false; feedbackInvited = true; } });

  document.addEventListener("click", event => {
    const close = event.target.closest("[data-close]"); if (close) { close.closest("dialog").close(); return; }
    const mode = event.target.closest("[data-account-mode]"); if (mode) { showAccount(mode.dataset.accountMode); return; }
    const preset = event.target.closest("[data-preset-filter]");
    if (preset) { presetFilter = preset.dataset.presetFilter; document.querySelectorAll("[data-preset-filter]").forEach(button => button.setAttribute("aria-pressed", String(button === preset))); render(); return; }
    const gallery = event.target.closest("[data-gallery-filter]");
    if (gallery) { galleryFilter = gallery.dataset.galleryFilter; document.querySelectorAll("[data-gallery-filter]").forEach(button => button.setAttribute("aria-pressed", String(button === gallery))); render(); return; }
    const control = event.target.closest("[data-action]"); if (!control) return;
    const action = control.dataset.action, id = control.dataset.id;
    if (action === "account") { if (user) navigate("estudio"); else showAccount("login"); }
    else if (action === "feedback") { $("feedbackForm").reset(); $("feedbackForm").hidden = false; $("feedbackSuccess").hidden = true; $("feedbackTool").value = $("labDialog").open ? labItem.tool : location.hash === "#timbres" ? "guitarra" : "site"; openDialog("feedbackDialog"); }
    else if (action === "view-feedback") { closeDialogs(); navigate("painel"); }
    else if (action === "lab") showLab(lookup(id));
    else if (action === "favorite") toggleFavorite(id);
    else if (action === "save-preset") savePreset(id);
    else if (action === "logout") { pendingAction = null; user = null; closeDialogs(); render(); navigate("inicio"); status("Você saiu da conta demonstrativa."); }
    else if (action === "recover") showPassword("recover");
    else if (action === "settings" && user) { $("settingsUser").textContent = "Usuário de demonstração: @" + user.username; openDialog("settingsDialog"); }
    else if (action === "change-password" && user) showPassword("change");
    else if (action === "rotate-key" && user) showPassword("rotate");
    else if (action === "copy-key") copy(demoKey, "keyStatus");
    else if (action === "download-key") download("nichodev-chave-DEMO.txt", "SOMENTE DEMONSTRAÇÃO. SEM VALIDADE REAL.\nUsuário: " + user?.username + "\nChave: " + demoKey + "\n", "text/plain;charset=utf-8");
    else if (action === "new-preset") showPublish("preset");
    else if (action === "new-publication") showPublish("publication");
    else if (action === "detail") showDetail(allPublications().find(item => item.id === id) || user?.publications.find(item => item.id === id));
    else if (action === "play-detail") playExample(presets.find(item => item.id === detailItem.presetId) || presets[0]);
    else if (action === "remix-detail") { const item = presets.find(preset => preset.id === detailItem.presetId) || presets[0]; requireAccount(() => { savePreset(item.id); closeDialogs(); navigate("estudio"); }); }
    else if (action === "share-detail") {
      if (!publications.some(item => item.id === detailItem.id)) { $("shareStatus").textContent = "A publicação real e os links privados/não listados dependem do backend. Este exemplo existe somente nesta aba."; return; }
      const url = new URL(location.href); url.hash = "criacao/" + detailItem.id;
      copy(url.href, "shareStatus");
      $("shareStatus").textContent = "Link da demonstração local. Não é uma publicação real: " + url.href;
    }
  });
  for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("close", () => { stopAudio(); dialog.querySelectorAll('input[type="password"]').forEach(input => { input.value = ""; }); });
    dialog.addEventListener("click", event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("pagehide", stopAudio);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopAudio(); });
  render(); route();
})();
