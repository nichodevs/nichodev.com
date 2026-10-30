(() => {
  "use strict";
  const tool=location.pathname.endsWith("guitarra.html")?"guitarra":"voz";
  const api="/api/community";
  const bar=document.createElement("aside");
  bar.setAttribute("aria-label","Comunidade e avaliações");
  bar.style.cssText="padding:14px;margin:12px auto;border:2px solid currentColor;max-width:1000px;font:13px/1.7 monospace;display:flex;gap:12px;flex-wrap:wrap;align-items:center";
  const title=document.createElement("span");title.textContent="COMUNIDADE NICHODEV";
  const capture=document.createElement("button");capture.type="button";capture.textContent="SALVAR MEU TIMBRE";
  const feedback=document.createElement("button");feedback.type="button";feedback.textContent="AVALIAR FERRAMENTA";
  const home=document.createElement("a");home.href="/comunidade/";home.textContent="VOLTAR À COMUNIDADE";
  const status=document.createElement("p");status.setAttribute("role","status");status.style.flexBasis="100%";
  bar.append(title,capture,feedback,home,status);document.body.prepend(bar);
  async function request(path,body){
    const response=await fetch(api+path,{method:body?"POST":"GET",credentials:"same-origin",headers:{"Content-Type":"application/json","X-Nichodev-Client":"1"},...(body?{body:JSON.stringify(body)}:{})});
    const value=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(value.error||"Não foi possível concluir. Tente novamente.");
    return value;
  }
  function read(){
    const data=tool==="guitarra"?window.snapshot():{values:window.currentRawParams(),enabled:window.currentEffectStates()};
    if(tool==="guitarra")for(const key of ["gain","tone","master"])data[key]=Number(data[key]);
    return window.NichodevPresets.validatePreset({app:"nichodev-preset",version:1,tool,data});
  }
  capture.addEventListener("click",()=>{
    try{
      const preset=read();
      try{sessionStorage.setItem("nichodev-community-draft",JSON.stringify(preset));location.href="/comunidade/#novo-timbre";}
      catch{
        const url=URL.createObjectURL(new Blob([JSON.stringify(preset,null,2)],{type:"application/json"})),link=document.createElement("a");
        link.href=url;link.download="nichodev-preset-"+tool+".json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        status.textContent="Não foi possível abrir o rascunho. O preset foi baixado para você importá-lo na comunidade.";
      }
    }catch(error){status.textContent=error.message;}
  });
  const dialog=document.createElement("dialog");
  dialog.setAttribute("aria-label","Avaliar a ferramenta");
  dialog.innerHTML='<form><h2>COMO FOI SUA EXPERIÊNCIA?</h2><fieldset><legend>Resultado</legend><label><input type="radio" name="experience" value="bem" required> Funcionou bem</label><label><input type="radio" name="experience" value="dificuldade"> Tive dificuldade</label><label><input type="radio" name="experience" value="problema"> Encontrei um problema</label></fieldset><label>Comentário opcional <textarea name="comment" maxlength="1200"></textarea></label><label>E-mail opcional para resposta <input type="email" name="contact" maxlength="254"></label><p>A avaliação será privada. Seu e-mail será usado somente para resposta.</p><p role="status"></p><button type="submit">ENVIAR AVALIAÇÃO</button><button type="button">FECHAR</button></form>';
  dialog.style.cssText="max-width:600px;width:calc(100% - 32px);padding:24px;background:var(--bg);color:var(--fg);border:3px solid currentColor";
  document.body.append(dialog);
  dialog.querySelector('button[type="button"]').addEventListener("click",()=>dialog.close());
  feedback.addEventListener("click",()=>dialog.showModal());
  dialog.querySelector("form").addEventListener("submit",async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),data=new FormData(form);
    button.disabled=true;
    try{await request("/feedback",{tool,experience:data.get("experience"),comment:data.get("comment"),contact:data.get("contact")});form.reset();dialog.querySelector('[role="status"]').textContent="Avaliação recebida e salva. Obrigado!";}
    catch(error){dialog.querySelector('[role="status"]').textContent=error.message;}
    finally{button.disabled=false;}
  });
  const params=new URLSearchParams(location.search),id=params.get("communityPreset");
  if(id){
    request("/creations/"+encodeURIComponent(id)+(params.get("key")?"?key="+encodeURIComponent(params.get("key")):"")).then(({item})=>{
      const preset=window.NichodevPresets.validatePreset(item.preset);
      if(preset.tool!==tool)throw new Error("Esse timbre pertence a outra ferramenta.");
      const apply=document.createElement("button");apply.type="button";apply.textContent="APLICAR: "+item.title;
      apply.addEventListener("click",()=>{
        if(!window.confirm("Aplicar este preset substituirá os ajustes atuais. Deseja continuar?"))return;
        if(tool==="guitarra"){window.applySnapshot(preset.data);currentAB=null;}
        else window.applyRawParams(preset.data.values,preset.data.enabled);
        status.textContent="Preset aplicado: "+item.title;apply.remove();
      });
      bar.insertBefore(apply,status);status.textContent="Confira o nome e aplique o preset quando estiver pronto.";
    }).catch(error=>{status.textContent=error.message;});
  }
})();
