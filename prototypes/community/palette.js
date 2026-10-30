(() => {
  "use strict";
  const {presets,luminance,valid}=window.NichodevPalettes;
  const key="nichodev-community-palette-v1";
  const fields=["Bg","Panel","Ink","Lime","Purple"].map(name=>document.getElementById("palette"+name));
  const choice=document.getElementById("paletteChoice"),status=document.getElementById("paletteStatus");
  const variables=["bg","panel","ink","lime","purple","panel-dark","muted","line","error"];
  let userId,revision=0;
  const controls=[...document.querySelectorAll("#paletteForm input, #paletteForm select, #paletteForm button")];
  const busy=value=>controls.forEach(control=>control.disabled=value);
  function guestColors(){try{const saved=JSON.parse(localStorage.getItem(key));if(valid(saved))return saved;}catch{}return presets.arcade;}
  async function accountPalette(method="GET",colors){
    const response=await fetch("/api/community/palette",{method,credentials:"same-origin",headers:{"X-Nichodev-Client":"1",...(colors?{"Content-Type":"application/json"}:{})},...(colors?{body:JSON.stringify({palette:colors})}:{})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"Não foi possível acessar as cores da conta.");
    return data.palette;
  }
  function apply(colors){
    fields.forEach((field,i)=>field.value=colors[i]);
    choice.value=Object.keys(presets).find(name=>presets[name].every((color,i)=>color===colors[i]))||"custom";
    const style=document.documentElement.style;
    if(choice.value==="arcade")variables.forEach(name=>style.removeProperty("--"+name));
    else{
      const values=[...colors,colors[0],colors[2],colors[3],colors[2]];
      variables.forEach((name,i)=>style.setProperty("--"+name,values[i]));
    }
    document.documentElement.style.colorScheme=luminance(colors[0])>.5?"light":"dark";
    document.querySelector('meta[name="theme-color"]').content=colors[0];
  }
  async function save(colors){
    if(!valid(colors)){status.textContent="Contraste insuficiente. Escolha texto e destaques com mais contraste em relação ao fundo e aos painéis.";return;}
    apply(colors);
    if(userId){
      const current=revision;busy(true);status.textContent="Salvando cores na conta…";
      try{await accountPalette("PUT",colors);if(current===revision)status.textContent="Cores salvas na sua conta.";}
      catch{if(current===revision)status.textContent="Cores aplicadas, mas não foram salvas na conta. Confira a conexão e o login e tente novamente.";}
      finally{if(current===revision)busy(false);}
      return;
    }
    try{localStorage.setItem(key,JSON.stringify(colors));status.textContent="Cores salvas neste navegador.";}
    catch{status.textContent="Cores aplicadas só nesta sessão. O navegador não permitiu salvar a preferência.";}
  }
  choice.addEventListener("change",()=>{if(presets[choice.value])save(presets[choice.value]);});
  fields.forEach(field=>field.addEventListener("input",()=>choice.value="custom"));
  document.getElementById("paletteForm").addEventListener("submit",event=>{event.preventDefault();save(fields.map(field=>field.value));});
  document.getElementById("paletteReset").addEventListener("click",()=>save(presets.arcade));
  window.NichodevPalette={async setUser(user){
    const id=user?.id||null;if(id===userId)return;
    userId=id;const current=++revision;busy(true);status.textContent="";
    apply(id?presets.arcade:guestColors());
    try{
      if(id){const saved=await accountPalette();if(current!==revision)return;
        apply(valid(saved)?saved:guestColors());
        status.textContent=valid(saved)?"Cores da sua conta carregadas.":"Aplique as cores para salvar esta escolha na sua conta.";
      }
      if(current===revision)busy(false);
    }catch{if(current===revision)status.textContent="Não foi possível carregar as cores da conta. Recarregue a página para tentar novamente.";}
  }};
  apply(guestColors());busy(true);
})();
