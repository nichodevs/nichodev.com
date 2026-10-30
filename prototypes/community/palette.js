(() => {
  "use strict";
  const key="nichodev-community-palette-v1";
  const presets={
    arcade:["#10160f","#192217","#edf3e4","#c9f27a","#d5b5ff"],
    noite:["#101425","#1b2340","#eef2ff","#8de5ff","#e3b8ff"],
    ambar:["#1b140b","#2c2112","#fff1d6","#ffd074","#ffbca5"],
    clara:["#faf7ef","#ffffff","#25251e","#35621c","#7042a0"]
  };
  const fields=["Bg","Panel","Ink","Lime","Purple"].map(name=>document.getElementById("palette"+name));
  const choice=document.getElementById("paletteChoice"),status=document.getElementById("paletteStatus");
  const variables=["bg","panel","ink","lime","purple","panel-dark","muted","line","error"];
  function luminance(hex){
    const rgb=hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  }
  function valid(colors){
    if(!Array.isArray(colors)||colors.length!==5||!colors.every(color=>typeof color==="string"&&/^#[0-9a-f]{6}$/i.test(color)))return false;
    const light=colors.map(luminance);
    return light.slice(2).every(text=>light.slice(0,2).every(bg=>(Math.max(text,bg)+.05)/(Math.min(text,bg)+.05)>=4.5));
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
  function save(colors){
    if(!valid(colors)){status.textContent="Contraste insuficiente. Escolha texto e destaques com mais contraste em relação ao fundo e aos painéis.";return;}
    apply(colors);
    try{localStorage.setItem(key,JSON.stringify(colors));status.textContent="Cores salvas neste navegador.";}
    catch{status.textContent="Cores aplicadas só nesta sessão. O navegador não permitiu salvar a preferência.";}
  }
  choice.addEventListener("change",()=>{if(presets[choice.value])save(presets[choice.value]);});
  fields.forEach(field=>field.addEventListener("input",()=>choice.value="custom"));
  document.getElementById("paletteForm").addEventListener("submit",event=>{event.preventDefault();save(fields.map(field=>field.value));});
  document.getElementById("paletteReset").addEventListener("click",()=>save(presets.arcade));
  try{const saved=JSON.parse(localStorage.getItem(key));if(valid(saved))apply(saved);}catch{}
})();
