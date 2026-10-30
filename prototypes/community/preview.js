(() => {
  "use strict";
  const $=id=>document.getElementById(id),api="/api/community";
  const names={voz:"VOZ WEB",guitarra:"GUITARRA WEB",mixmaster:"MIXMASTER",site:"SITE"};
  const experiences={bem:"Funcionou bem",dificuldade:"Tive dificuldade",problema:"Encontrei um problema"};
  let user=null,items=[],mine=[],favorites=new Set(),presetFilter="todos",galleryFilter="todos",pending=null,accountMode="login";
  let keyFlow="",keyValue="",keyUsername="",passwordMode="recover",draftPreset=null,editing=null,mediaId=null,detail=null,detailKey="",deleting=null,audioContext=null,audioTimer=null;
  const status=message=>{$("pageStatus").textContent=message;};
  async function request(path,{method="GET",body,raw}={}){
    const response=await fetch(api+path,{method,credentials:"same-origin",headers:{"X-Nichodev-Client":"1",...(body?{"Content-Type":"application/json"}:{}),...(raw?{"Content-Type":"audio/wav"}:{})},...(body?{body:JSON.stringify(body)}:{}),...(raw?{body:raw}:{})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(data.error||"Não foi possível concluir. Tente novamente.");error.status=response.status;throw error;}
    return data;
  }
  const closeDialogs=()=>document.querySelectorAll("dialog[open]").forEach(dialog=>dialog.close());
  const openDialog=id=>{closeDialogs();$(id).showModal();};
  function navigate(view){history.pushState(null,"","#"+view);route();}
  function download(filename,value,type="application/json"){
    const url=URL.createObjectURL(new Blob([value],{type})),link=document.createElement("a");link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function copy(value,target){
    try{await navigator.clipboard.writeText(value);$(target).textContent="Copiado. Guarde em um local privado.";}
    catch{$(target).textContent="Copie manualmente: "+value;}
  }
  async function submit(form,errorId,action){
    const button=form.querySelector('button[type="submit"]');button.disabled=true;$(errorId).textContent="";
    try{await action();}catch(error){$(errorId).textContent=error.message;}finally{button.disabled=false;}
  }
  function requireAccount(action){if(user)return action();pending=action;showAccount("login");}
  function empty(root,message){const paragraph=document.createElement("p");paragraph.className="empty-note";paragraph.textContent=message;root.append(paragraph);}
  function button(label,action,id,primary=false){
    const b=document.createElement("button");b.type="button";b.className=primary?"button outline compact":"text-link";b.textContent=label;b.dataset.action=action;if(id)b.dataset.id=id;return b;
  }
  function card(item){
    const root=document.createElement("article");root.className="sound-card";
    const kicker=document.createElement("p");kicker.className="card-kicker";kicker.textContent=names[item.tool];
    const title=document.createElement("h3");title.textContent=item.title;
    const author=document.createElement("p");author.className="card-author";author.textContent="@"+item.author;
    const description=document.createElement("p");description.className="card-description";description.textContent=item.description;
    const state=document.createElement("p");state.className="section-note";state.textContent=item.visibility==="private"?"Privado":item.visibility==="unlisted"?"Não listado":item.status==="approved"?"Público":item.status==="hidden"?"Oculto pela moderação":"Aguardando moderação";
    const actions=document.createElement("div");actions.className="card-actions";
    actions.append(button(item.kind==="preset"?"EXPERIMENTAR →":"OUVIR PRÉVIA →","detail",item.id,true));
    if(item.kind==="preset"){
      const favorite=button(favorites.has(item.id)?"★":"☆","favorite",item.id);favorite.className="favorite-button";favorite.setAttribute("aria-label","Favoritar "+item.title);favorite.setAttribute("aria-pressed",String(favorites.has(item.id)));
      actions.append(favorite,button("SALVAR CÓPIA","copy",item.id));
    }
    if(user?.id===item.owner)actions.append(button("EDITAR","edit",item.id),button("EXCLUIR","delete",item.id));
    root.append(kicker,title,author,description,state,actions);return root;
  }
  function fill(id,list,message){
    const root=$(id);root.replaceChildren();list.forEach(item=>root.append(card(item)));if(!list.length)empty(root,message);
  }
  const lookup=id=>[...mine,...items].find(item=>item.id===id);
  function render(){
    const focused=document.activeElement,focusAction=focused?.dataset.action,focusId=focused?.dataset.id;
    fill("presetCards",items.filter(item=>item.kind==="preset"&&(presetFilter==="todos"||item.tool===presetFilter)),"Ainda não há timbres públicos aprovados. Capture um timbre na ferramenta para começar.");
    fill("galleryCards",items.filter(item=>galleryFilter==="todos"||(galleryFilter==="musica"?item.kind==="audio":item.kind==="preset")),"Nenhuma publicação aprovada nesta categoria.");
    $("accountLabel").textContent=user?"@"+user.username:"ENTRAR / CRIAR CONTA";
    $("studioGuest").hidden=Boolean(user);$("studioMember").hidden=!user;$("adminLink").hidden=!user?.admin;
    $("studioSubtitle").textContent=user?"Suas criações são salvas neste ambiente, @"+user.username+".":"Entre para acessar suas criações e favoritos.";
    const all=[...new Map([...mine,...items].map(item=>[item.id,item])).values()];
    fill("favoriteCards",all.filter(item=>favorites.has(item.id)),"Favorite um timbre público para encontrá-lo aqui.");
    fill("savedCards",mine.filter(item=>item.kind==="preset"),"Capture seus ajustes na Voz ou Guitarra, ou importe um preset JSON.");
    fill("myPublications",mine.filter(item=>item.kind==="audio"),"Envie uma prévia WAV. Suas criações começam privadas.");
    if(focusAction&&focusId){const target=[...document.querySelectorAll("[data-action]")].find(element=>element.dataset.action===focusAction&&element.dataset.id===focusId&&element.getClientRects().length);target?.focus();}
  }
  async function refresh(){
    ({user}=await request("/session"));
    ({items}=await request("/creations"));
    if(user){const data=await request("/me");mine=data.items;favorites=new Set(data.favorites);}
    else{mine=[];favorites=new Set();}
    render();
  }
  function showAccount(mode){
    accountMode=mode;$("accountTitle").textContent=mode==="register"?"CRIAR CONTA":"ENTRAR";
    $("confirmPasswordField").hidden=mode!=="register";$("accountConfirm").required=mode==="register";
    $("accountSubmit").textContent=mode==="register"?"CRIAR CONTA →":"ENTRAR →";$("accountError").textContent="";
    document.querySelectorAll("[data-account-mode]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.accountMode===mode)));
    openDialog("accountDialog");
  }
  async function afterLogin(){
    await refresh();closeDialogs();const action=pending;pending=null;
    if(action)await action();else navigate("estudio");
  }
  function showKey(data,flow){
    keyValue=data.recoveryKey;keyUsername=data.username;keyFlow=flow;
    $("recoveryKey").value=keyValue;$("keySaved").checked=false;$("finishSignup").disabled=true;
    $("finishSignup").textContent=flow==="register"?"CONCLUIR CADASTRO →":flow==="recover"?"VOLTAR AO LOGIN →":"CONTINUAR →";
    $("keyStatus").textContent="Guarde a chave antes de continuar. Ela não poderá ser consultada novamente.";
    openDialog("recoveryKeyDialog");
  }
  function showPassword(mode){
    passwordMode=mode;$("passwordTitle").textContent=mode==="recover"?"RECUPERAR SENHA":mode==="rotate"?"SUBSTITUIR CHAVE":"ALTERAR SENHA";
    $("passwordIntro").textContent=mode==="recover"?"Informe usuário e chave. A recuperação encerra as sessões e substitui a chave.":"Confirme sua senha atual. A alteração de senha encerra as sessões existentes.";
    $("passwordProofLabel").textContent=mode==="recover"?"CHAVE DE RECUPERAÇÃO":"SENHA ATUAL";
    $("passwordProof").type=mode==="recover"?"text":"password";$("passwordProof").minLength=mode==="recover"?1:15;
    $("passwordUser").value=user?.username||$("accountUser").value;$("passwordUser").readOnly=mode!=="recover";
    for(const id of ["newPassword","newPasswordConfirm"]){$(id).hidden=mode==="rotate";$(id).required=mode!=="rotate";document.querySelector('label[for="'+id+'"]').hidden=mode==="rotate";}
    $("passwordError").textContent="";openDialog("passwordDialog");
  }
  function openPublish(kind,item=null,preset=null){
    editing=item;draftPreset=preset||item?.preset||null;mediaId=item?.mediaId||null;
    $("publishForm").reset();$("publishForm").dataset.kind=kind;
    $("publishTitle").textContent=item?"EDITAR CRIAÇÃO":kind==="preset"?"SALVAR TIMBRE":"COMPARTILHAR ÁUDIO";
    $("creationTitle").value=item?.title||"";$("creationDescription").value=item?.description||"";
    $("creationTool").value=item?.tool||draftPreset?.tool||(kind==="preset"?"guitarra":"mixmaster");
    $("creationTool").querySelector('[value="mixmaster"]').disabled=kind==="preset";
    $("creationVisibility").value=item?.visibility||"private";
    $("presetFile").hidden=kind!=="preset";document.querySelector('label[for="presetFile"]').hidden=kind!=="preset";
    $("audioFile").required=kind==="audio"&&!mediaId;
    $("presetSummary").textContent=draftPreset?"Preset completo de "+names[draftPreset.tool]+", formato v1.":"Capture os parâmetros na ferramenta ou importe um preset JSON.";
    $("publishError").textContent="";$("visibilityHelp").textContent="Começa privado. Conteúdo público passa por moderação. Editar invalida links não listados anteriores.";
    openDialog("publishDialog");
  }
  function newPreset(){
    let draft=null;try{const value=sessionStorage.getItem("nichodev-community-draft");if(value)draft=window.NichodevPresets.validatePreset(JSON.parse(value));}catch{status("O rascunho não é válido. Capture novamente ou importe o arquivo JSON.");}
    return requireAccount(()=>openPublish("preset",null,draft));
  }
  function presetUrl(item,key=""){
    return "/comunidade/ferramentas/"+item.tool+".html?communityPreset="+encodeURIComponent(item.id)+(key?"&key="+encodeURIComponent(key):"");
  }
  function showDetail(item,key=""){
    detail=item;detailKey=key;$("detailTitle").textContent=item.title;$("detailMeta").textContent=names[item.tool]+" / @"+item.author;
    $("detailDescription").textContent=item.description;
    $("applyPresetLink").hidden=!item.preset;$("downloadPreset").hidden=!item.preset;
    if(item.preset)$("applyPresetLink").href=presetUrl(item,key);
    $("detailAudio").hidden=!item.mediaId;$("detailAudio").removeAttribute("src");
    if(item.mediaId)$("detailAudio").src=api+"/media/"+encodeURIComponent(item.mediaId)+(key?"?key="+encodeURIComponent(key):"");
    $("detailVisibility").textContent=item.visibility==="private"?"Somente você e a administração podem acessar.":item.visibility==="unlisted"?"Quem tiver o link poderá acessar e repassá-lo.":"A publicação precisa ser aprovada para aparecer na galeria.";
    document.querySelector('[data-action="remix-detail"]').hidden=!item.preset;
    document.querySelector('[data-action="share-detail"]').hidden=!(item.owner===user?.id||item.visibility==="public");
    $("shareStatus").textContent="";openDialog("detailDialog");
  }
  async function loadAdmin(){
    const root=$("feedbackList"),moderation=$("moderationList");root.replaceChildren();moderation.replaceChildren();
    if(!user?.admin){empty(root,"Acesso restrito à administração.");return;}
    const data=await request("/admin/feedback");
    for(const item of data.items){
      if($("feedbackFilter").value!=="todos"&&$("feedbackFilter").value!==item.status)continue;
      const row=document.createElement("article");row.className="feedback-item";
      const heading=document.createElement("p");heading.textContent=names[item.tool]+" / "+experiences[item.experience];
      const comment=document.createElement("p");comment.textContent=item.comment||"Sem comentário.";
      const contact=document.createElement("p");contact.textContent=item.contact||"Sem contato informado.";
      const select=document.createElement("select");select.setAttribute("aria-label","Situação da avaliação");
      for(const [value,title]of [["recebido","Recebido"],["analise","Em análise"],["concluido","Concluído"]])select.append(new Option(title,value));
      select.value=item.status;
      const error=document.createElement("p");error.setAttribute("role","alert");
      select.addEventListener("change",async()=>{
        const old=item.status,focused=document.activeElement===select;select.disabled=true;
        try{await request("/admin/feedback/"+item.id,{method:"PATCH",body:{status:select.value}});item.status=select.value;if($("feedbackFilter").value!=="todos"&&$("feedbackFilter").value!==item.status){row.remove();$("feedbackFilter").focus();}}
        catch(e){select.value=old;error.textContent=e.message;}finally{select.disabled=false;if(focused&&row.isConnected)select.focus();}
      });
      row.append(heading,comment,contact,select,error);root.append(row);
    }
    if(!root.children.length)empty(root,"Nenhuma avaliação nesta situação.");
    const queue=await request("/admin/creations");
    for(const item of queue.items){
      const row=card(item);
      for(const [state,title]of [["approved","APROVAR"],["hidden","OCULTAR"]]){
        const action=document.createElement("button");action.type="button";action.className="button outline compact";action.textContent=title;
        action.addEventListener("click",async()=>{action.disabled=true;try{await request("/admin/creations/"+item.id,{method:"PATCH",body:{status:state}});await refresh();await loadAdmin();(moderation.querySelector("button")||document.querySelector('[data-view="painel"] h1')).focus();status(state==="approved"?"Publicação aprovada.":"Publicação ocultada.");}catch(error){status(error.message);action.disabled=false;}});
        row.append(action);
      }
      row.querySelector('[data-action="detail"]').addEventListener("click",event=>{event.stopPropagation();showDetail(item);});
      moderation.append(row);
    }
    if(!queue.items.length)empty(moderation,"Nenhuma publicação aguardando moderação.");
  }
  async function route(){
    const hash=location.hash.slice(1)||"inicio";if(hash==="main"||hash==="exemplos")return;
    closeDialogs();stopExample();
    const view=hash.startsWith("criacao/")?"galeria":hash==="novo-timbre"?"timbres":["inicio","timbres","galeria","estudio","painel"].includes(hash)?hash:"inicio";
    document.querySelectorAll("[data-view]").forEach(element=>{element.hidden=element.dataset.view!==view;});
    document.querySelectorAll("[data-view-link]").forEach(link=>{if(link.dataset.viewLink===view)link.setAttribute("aria-current","page");else link.removeAttribute("aria-current");});
    const heading=document.querySelector('[data-view="'+view+'"] h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
    if(hash==="novo-timbre")await newPreset();
    else if(view==="painel"){try{await loadAdmin();}catch(error){status(error.message);}}
    else if(hash.startsWith("criacao/")){
      const [id,query]=hash.slice(8).split("?"),key=new URLSearchParams(query).get("key")||"";
      try{const {item}=await request("/creations/"+encodeURIComponent(id)+(key?"?key="+encodeURIComponent(key):""));showDetail(item,key);}catch(error){status(error.message);}
    }
  }
  function exampleProject(){
    const notes=[7,5,3,5,6,4,2,4].map((pitch,step)=>({pitch,step:step*2,velocity:.65}));
    const clip={id:"example-clip",type:"midi",name:"Primeiro loop",start:0,duration:2,notes};
    const track={id:"example-track",type:"midi",name:"MEU PRIMEIRO LOOP",volume:.7,pan:0,tone:1,delay:0,reverb:0,muted:false,solo:false,clips:[clip]};
    return {app:"nichodev-mixmaster",formatVersion:1,exportedAt:new Date().toISOString(),project:{tracks:[track],selected:[clip.id],selectedTrackId:track.id,playhead:0,bpm:120,master:.65},assets:[]};
  }
  function stopExample(){clearTimeout(audioTimer);if(audioContext){audioContext.close().catch(()=>{});audioContext=null;}$("labPlay").textContent="▶ OUVIR EXEMPLO";$("detailAudio").pause();}
  $("labPlay").addEventListener("click",async()=>{
    if(audioContext){stopExample();return;}
    try{
      const {scheduleMidiNotes}=await import("/js/mixmaster/midi-synth.js?v=1");
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context)throw new Error("Este navegador não oferece Web Audio. Experimente outro navegador atualizado.");
      const project=exampleProject().project,track=project.tracks[0],ctx=new Context();audioContext=ctx;
      const volume=ctx.createGain(),pan=ctx.createStereoPanner(),filter=ctx.createBiquadFilter(),master=ctx.createGain();
      volume.gain.value=track.volume;pan.pan.value=track.pan;filter.type="lowpass";filter.frequency.value=500+track.tone*19500;master.gain.value=project.master;
      volume.connect(pan).connect(filter).connect(master).connect(ctx.destination);await ctx.resume();
      if(audioContext!==ctx)return;
      scheduleMidiNotes(ctx,track.clips[0],project.bpm,ctx.currentTime+.03,0,volume);
      $("labPlay").textContent="■ PARAR EXEMPLO";audioTimer=setTimeout(stopExample,2200);
    }catch(error){stopExample();$("labPlaybackStatus").textContent="Não foi possível reproduzir: "+error.message;}
  });
  function renderExamples(){
    const root=$("exampleCards");root.replaceChildren();
    for(const [title,description,tool]of [["Meu primeiro loop","Ouça e baixe o mesmo projeto MIDI a 120 BPM.","mixmaster"],["Meu timbre de guitarra","Ajuste os pedais reais e capture seus parâmetros.","guitarra"],["Minha voz","Transforme a voz e compartilhe os ajustes reais.","voz"]]){
      const article=document.createElement("article");article.className="sound-card";
      const heading=document.createElement("h3");heading.textContent=title;const paragraph=document.createElement("p");paragraph.textContent=description;
      if(tool==="mixmaster"){const action=button("EXPERIMENTAR →","example",null,true);article.append(heading,paragraph,action);}
      else{const link=document.createElement("a");link.className="button outline compact";link.href="/comunidade/ferramentas/"+tool+".html";link.textContent="ABRIR FERRAMENTA →";article.append(heading,paragraph,link);}
      root.append(article);
    }
  }
  $("downloadExample").addEventListener("click",()=>{download("nichodev-primeiro-loop.nichodev.json",JSON.stringify(exampleProject(),null,2));$("labFeedback").hidden=false;});
  $("feedbackForm").addEventListener("submit",event=>{
    event.preventDefault();const form=event.currentTarget,data=new FormData(form);
    submit(form,"feedbackError",async()=>{await request("/feedback",{method:"POST",body:{tool:data.get("tool"),experience:data.get("experience"),comment:data.get("comment"),contact:data.get("contact")}});form.reset();$("feedbackForm").hidden=true;$("feedbackSuccess").hidden=false;$("feedbackSuccess").querySelector("button").focus();});
  });
  $("accountForm").addEventListener("submit",event=>{
    event.preventDefault();const form=event.currentTarget;
    submit(form,"accountError",async()=>{
      if(accountMode==="register"&&$("accountPassword").value!==$("accountConfirm").value)throw new Error("As senhas não coincidem.");
      const data=await request(accountMode==="register"?"/register":"/login",{method:"POST",body:{username:$("accountUser").value,password:$("accountPassword").value}});
      $("accountPassword").value="";$("accountConfirm").value="";
      if(accountMode==="register")showKey(data,"register");else await afterLogin();
    });
  });
  $("keySaved").addEventListener("change",()=>{$("finishSignup").disabled=!$("keySaved").checked;});
  $("finishSignup").addEventListener("click",async()=>{
    const control=$("finishSignup");control.disabled=true;
    try{
      if(keyFlow==="register"){await request("/register/confirm",{method:"POST",body:{saved:true}});keyValue="";keyFlow="";await afterLogin();}
      else{const flow=keyFlow;keyValue="";keyFlow="";closeDialogs();if(flow==="recover")showAccount("login");else await refresh();}
    }catch(error){$("keyStatus").textContent=error.message;control.disabled=false;}
  });
  $("passwordForm").addEventListener("submit",event=>{
    event.preventDefault();const form=event.currentTarget;
    submit(form,"passwordError",async()=>{
      if(passwordMode!=="rotate"&&$("newPassword").value!==$("newPasswordConfirm").value)throw new Error("As senhas não coincidem.");
      const body=passwordMode==="recover"?{username:$("passwordUser").value,recoveryKey:$("passwordProof").value,password:$("newPassword").value}:passwordMode==="rotate"?{current:$("passwordProof").value}:{current:$("passwordProof").value,password:$("newPassword").value};
      const data=await request(passwordMode==="recover"?"/recover":passwordMode==="rotate"?"/recovery-key":"/password",{method:"POST",body});
      form.querySelectorAll("input").forEach(input=>{if(input.type==="password")input.value="";});
      if(passwordMode==="recover"){user=null;await refresh();showKey(data,"recover");}
      else if(passwordMode==="rotate")showKey(data,"rotate");
      else{await refresh();showAccount("login");$("accountError").textContent="Senha alterada. Entre novamente.";}
    });
  });
  $("presetFile").addEventListener("change",async event=>{
    const file=event.target.files[0];if(!file)return;
    try{if(file.size>32768)throw new Error("O preset excede 32 KB.");draftPreset=window.NichodevPresets.validatePreset(JSON.parse(await file.text()));$("creationTool").value=draftPreset.tool;$("presetSummary").textContent="Preset validado de "+names[draftPreset.tool]+", formato v1.";}
    catch(error){draftPreset=null;$("presetSummary").textContent=error.message;}
  });
  $("creationVisibility").addEventListener("change",event=>{$("visibilityHelp").textContent=event.target.value==="unlisted"?"Quem tiver o link poderá acessar e repassá-lo. Gerar outro link invalida o anterior.":event.target.value==="public"?"A criação aparecerá na galeria após aprovação da administração.":"Somente você e a administração poderão acessar.";});
  $("publishForm").addEventListener("submit",event=>{
    event.preventDefault();const form=event.currentTarget;
    submit(form,"publishError",async()=>{
      const file=$("audioFile").files[0];
      if(file){if(file.size>10*1024*1024)throw new Error("O WAV excede 10 MB.");const result=await request("/media",{method:"POST",raw:file});mediaId=result.id;$("audioFile").value="";$("audioFile").required=false;}
      const payload={kind:form.dataset.kind,title:$("creationTitle").value,description:$("creationDescription").value,tool:$("creationTool").value,visibility:$("creationVisibility").value,preset:draftPreset,mediaId,...(editing?{version:editing.version}:{})};
      await request(editing?"/creations/"+editing.id:"/creations",{method:editing?"PATCH":"POST",body:payload});
      try{sessionStorage.removeItem("nichodev-community-draft");}catch{}
      closeDialogs();await refresh();navigate("estudio");status("Criação salva. Publicações públicas aguardam moderação.");
    });
  });
  $("confirmDelete").addEventListener("click",async()=>{
    $("confirmDelete").disabled=true;
    try{await request("/creations/"+deleting.id,{method:"DELETE",body:{version:deleting.version}});closeDialogs();await refresh();status("Criação excluída.");}
    catch(error){$("deleteError").textContent=error.message;}
    finally{$("confirmDelete").disabled=false;}
  });
  $("downloadPreset").addEventListener("click",()=>download("nichodev-preset-"+detail.tool+".json",JSON.stringify(detail.preset,null,2)));
  $("feedbackFilter").addEventListener("change",()=>loadAdmin().catch(error=>status(error.message)));
  document.addEventListener("click",async event=>{
    const close=event.target.closest("[data-close]");
    if(close){
      const dialog=close.closest("dialog");
      if(dialog.id==="recoveryKeyDialog"){
        if(keyFlow!=="register"){$("keyStatus").textContent="Guarde e confirme a nova chave antes de continuar.";return;}
        try{await request("/register/cancel",{method:"POST",body:{}});keyFlow="";keyValue="";dialog.close();status("Cadastro cancelado. Nenhuma sessão foi aberta.");}catch(error){$("keyStatus").textContent=error.message;}
      }else dialog.close();
      return;
    }
    const mode=event.target.closest("[data-account-mode]");if(mode){showAccount(mode.dataset.accountMode);return;}
    const filter=event.target.closest("[data-preset-filter]");if(filter){presetFilter=filter.dataset.presetFilter;document.querySelectorAll("[data-preset-filter]").forEach(b=>b.setAttribute("aria-pressed",String(b===filter)));render();return;}
    const gallery=event.target.closest("[data-gallery-filter]");if(gallery){galleryFilter=gallery.dataset.galleryFilter;document.querySelectorAll("[data-gallery-filter]").forEach(b=>b.setAttribute("aria-pressed",String(b===gallery)));render();return;}
    const control=event.target.closest("[data-action]");if(!control)return;
    const action=control.dataset.action,id=control.dataset.id;
    try{
      if(action==="account"){if(user)navigate("estudio");else showAccount("login");}
      else if(action==="recover")showPassword("recover");
      else if(action==="settings"){if(!user)return;$("settingsUser").textContent="@"+user.username;openDialog("settingsDialog");}
      else if(action==="change-password")showPassword("change");
      else if(action==="rotate-key")showPassword("rotate");
      else if(action==="copy-key")await copy(keyValue,"keyStatus");
      else if(action==="download-key")download("nichodev-chave-recuperacao.txt","Usuário: "+keyUsername+"\nChave: "+keyValue+"\nGuarde fora do site. Quem tiver a chave poderá recuperar sua conta.\n","text/plain;charset=utf-8");
      else if(action==="logout"){await request("/logout",{method:"POST",body:{}});await refresh();navigate("inicio");}
      else if(action==="feedback"){$("feedbackForm").hidden=false;$("feedbackSuccess").hidden=true;$("feedbackError").textContent="";$("feedbackTool").value=$("labDialog").open?"mixmaster":location.hash==="#timbres"?"guitarra":"site";openDialog("feedbackDialog");}
      else if(action==="new-preset")await newPreset();
      else if(action==="new-publication")await requireAccount(()=>openPublish("audio"));
      else if(action==="detail"){const data=await request("/creations/"+id);showDetail(data.item);}
      else if(action==="edit"){const data=await request("/creations/"+id);openPublish(data.item.kind,data.item);}
      else if(action==="delete"){deleting=lookup(id);$("deleteError").textContent="";openDialog("deleteDialog");}
      else if(action==="favorite")await requireAccount(async()=>{await request("/creations/"+id+"/favorite",{method:"POST",body:{enabled:!favorites.has(id)}});await refresh();status("Favoritos atualizados.");});
      else if(action==="copy"||action==="remix-detail")await requireAccount(async()=>{
        const original=action==="copy"?lookup(id):detail;
        if(!original?.preset)throw new Error("Esta criação não possui um preset para copiar.");
        await request("/creations",{method:"POST",body:{kind:"preset",tool:original.tool,title:original.title.slice(0,42)+" · minha versão",description:original.description,visibility:"private",preset:original.preset,mediaId:null}});
        closeDialogs();await refresh();navigate("estudio");status("Cópia salva na sua conta.");
      });
      else if(action==="share-detail"){
        if(detail.owner===user?.id){if(detail.visibility==="unlisted"&&!window.confirm("Gerar outro link invalida o anterior. Continuar?"))return;const result=await request("/creations/"+detail.id+"/share",{method:"POST",body:{}});await copy(result.url,"shareStatus");}
        else await copy(location.origin+"/comunidade/#criacao/"+detail.id,"shareStatus");
      }
      else if(action==="example"){
        $("labTitle").textContent="Meu primeiro loop";$("labTool").textContent="MIXMASTER / 120 BPM";
        $("labDescription").textContent="A prévia e o projeto baixado usam as mesmas notas, síntese e andamento. O exemplo está sem efeitos para facilitar a comparação.";
        $("downloadExample").hidden=false;$("downloadHelp").hidden=false;$("labFeedback").hidden=true;
        $("labPlaybackStatus").textContent="PROJETO MIDI · 120 BPM · 2 SEGUNDOS";openDialog("labDialog");
      }
    }catch(error){if(action==="share-detail")$("shareStatus").textContent=error.message;else status(error.message);}
  });
  document.querySelectorAll("dialog").forEach(dialog=>{
    dialog.addEventListener("close",()=>{stopExample();dialog.querySelectorAll('input[type="password"]').forEach(input=>{input.value="";});if(dialog.id==="recoveryKeyDialog"&&!keyFlow){$("recoveryKey").value="";keyUsername="";}});
    dialog.addEventListener("cancel",event=>{if(dialog.id==="recoveryKeyDialog"&&keyFlow){event.preventDefault();$("keyStatus").textContent="Guarde a chave e conclua a etapa ou use o botão de cancelar cadastro.";}});
  });
  window.addEventListener("beforeunload",event=>{if(keyFlow&&keyValue){event.preventDefault();event.returnValue="";}});
  window.addEventListener("hashchange",route);
  window.addEventListener("pagehide",stopExample);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)stopExample();});
  renderExamples();refresh().then(route).catch(error=>status("Não foi possível carregar a comunidade: "+error.message));
})();
