(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.NicoChar=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const list=(names)=>names.split('|').map(id=>({id,label:id.replaceAll('-',' ')}));
  const catalog={
    style:list('atari-minimal|pocket-rpg|underground-hacker|cyber-mascot'),
    body:list('medio|magro|baixinho|alto|chibi|robo|criatura'),
    hair:list('curto|baguncado|afro|moicano|capacete|capuz|careca|antena|crt|franja|longo|coque|rabo-de-cavalo|trancas|cacheado|sidecut|espigado|bone|cat-ears|disco|ninja|raposa'),
    eyes:list('normal|serio|animado|sono|raiva|feliz|glitch|visor|emoji'),
    face:list('neutro|sorriso|dentes|mascara|barba|bigode|blush|cicatriz'),
    clothing:list('hoodie|college|camiseta|armadura-synth|sobretudo|dj|dev|kimono|capa|street|equalizador|disco|listras|colete|jaqueta|astronauta|punk|jardineira|vestido|mago|ninja|cassete'),
    accessory:list('nenhum|fones|oculos|oculos-escuros|corrente|mochila|luvas|bone|headset|camera|espada|guitarra|microfone|laptop|cd|sampler|sintetizador|boombox|skate|cajado|disquete|fone-raro|capa-evento'),
    pose:list('em-pe|mao-no-bolso|sentado|guitarra|microfone|andando|pulando|synth|peace|bracos-cruzados|boss-fight|perfil|costas'),
    palette:list('mono|terminal|ambar|gelo|synth|alerta'),
    scene:list('preto|estrelas|terminal|estudio|palco|quarto|cidade|dungeon|boot|crt|voz|guitarra|mixmaster|dev-mode|community-mode|halloween|natal|aniversario|desafio'),
    frame:list('pixel|metal|terminal|hud|cartucho|save-slot|crt|cassete'),
    companion:list('nenhum|gato-nico|robo-mini|disquete|morcego|slime|disco-vivo|fantasma|speaker'),
    companionPosition:list('lado|ombro|flutuando|rodape'),
    emote:list('nenhum|hello|fire|nota|skull|coracao|raio|code|glitch|fantasma|disquete'),
    effect:list('nenhum|brilho|contorno|glitch|fumaca|notas|raios|poeira|scanline|orbita'),
    mode:list('retrato|mini-cena|badge-card|idle-display'),
    archetype:list('beat-hacker|synth-mage|street-pixel|robo-sound|disc-crew|creature|pixel-dev|sound-ninja|studio-mage|street-composer|noise-knight|glitch-hunter')
  };
  const locks={'fone-raro':'favoriteiro','glitch':'criador-aprovado','terminal':'primeiro-preset','halloween':'halloween','natal':'natal','aniversario':'aniversario','desafio':'desafio','capa-evento':'desafio'};
  // Locks apply to the named category only; eyes/effects and scenes have separate meanings.
  const required=(key,id)=>key==='accessory'?locks[id]:key==='scene'?locks[id]:key==='eyes'&&id==='glitch'?'criador-aprovado':null;
  const defaults={schema:1,name:'NICO',mood:'Criando sons e ideias',style:'pocket-rpg',body:'medio',hair:'curto',eyes:'normal',face:'neutro',clothing:'hoodie',accessory:'fones',pose:'em-pe',palette:'mono',scene:'preto',frame:'pixel',companion:'gato-nico',companionPosition:'lado',emote:'nota',effect:'nenhum',mode:'mini-cena',archetype:'beat-hacker',hidden:false,animation:true,drawing:null,studio:{desk:true,pc:true,guitar:true,speakers:true,poster:true,lights:true,petX:48,petY:44},badges:[]};
  const presets={
    'beat-hacker':{style:'underground-hacker',hair:'capuz',clothing:'hoodie',accessory:'laptop',scene:'crt'},
    'synth-mage':{hair:'antena',clothing:'mago',accessory:'cajado',effect:'poeira',scene:'dungeon'},
    'street-pixel':{hair:'bone',clothing:'street',accessory:'boombox',pose:'mao-no-bolso',scene:'cidade'},
    'robo-sound':{style:'cyber-mascot',body:'robo',hair:'crt',clothing:'equalizador',accessory:'sintetizador',scene:'estudio'},
    'disc-crew':{style:'cyber-mascot',body:'robo',hair:'disco',clothing:'disco',accessory:'cd',companion:'disco-vivo'},
    creature:{style:'cyber-mascot',body:'criatura',hair:'cat-ears',clothing:'camiseta',accessory:'microfone',companion:'slime'},
    'pixel-dev':{hair:'baguncado',clothing:'dev',accessory:'laptop',scene:'dev-mode'},
    'sound-ninja':{hair:'ninja',face:'mascara',clothing:'ninja',accessory:'espada',scene:'cidade'},
    'studio-mage':{hair:'longo',clothing:'capa',accessory:'sintetizador',scene:'estudio'},
    'street-composer':{hair:'afro',clothing:'college',accessory:'guitarra',pose:'guitarra',scene:'palco'},
    'noise-knight':{hair:'capacete',clothing:'armadura-synth',accessory:'espada',scene:'dungeon'},
    'glitch-hunter':{style:'underground-hacker',hair:'capuz',clothing:'sobretudo',accessory:'headset',effect:'glitch',scene:'boot'}
  };
  const make=archetype=>({...structuredClone(defaults),...presets[archetype],archetype});
  function validate(value,unlocks=[]){
    const bad=()=>{throw new Error('Personagem inválido. Confira as peças, o tamanho e os itens desbloqueados.');};
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(defaults,k))||value.schema!==1)bad();
    const out={...structuredClone(defaults),...value};
    for(const [key,items]of Object.entries(catalog))if(!items.some(x=>x.id===out[key])||(required(key,out[key])&&!unlocks.includes(required(key,out[key]))))bad();
    for(const [key,max]of [['name',24],['mood',80]])if(typeof out[key]!=='string'||!out[key].trim()||out[key].length>max||/[\u0000-\u001f\u007f<>]/.test(out[key]))bad();else out[key]=out[key].trim();
    if(typeof out.hidden!=='boolean'||typeof out.animation!=='boolean'||!Array.isArray(out.badges)||out.badges.length>3||new Set(out.badges).size!==out.badges.length||out.badges.some(x=>!unlocks.includes(x)))bad();
    if(!out.studio||typeof out.studio!=='object'||Array.isArray(out.studio)||Object.keys(out.studio).length!==8)bad();
    for(const k of ['desk','pc','guitar','speakers','poster','lights'])if(typeof out.studio[k]!=='boolean')bad();
    for(const k of ['petX','petY'])if(!Number.isInteger(out.studio[k])||out.studio[k]<2||out.studio[k]>52)bad();
    if(out.drawing!==null){const d=out.drawing;if(!d||Object.keys(d).length!==2||![16,32].includes(d.size)||typeof d.pixels!=='string'||d.pixels.length!==d.size*d.size||!/^[0-5]+$/.test(d.pixels))bad();out.drawing={size:d.size,pixels:d.pixels};}
    return out;
  }
  const colors={mono:['#000000','#f4f4f0','#949b9d','#ffffff','#303638'],terminal:['#000000','#f4f4f0','#949b9d','#89f0b4','#183b2b'],ambar:['#000000','#f4f4f0','#949b9d','#f7c75f','#3c301c'],gelo:['#000000','#f4f4f0','#949b9d','#8dcdf4','#1c2e3c'],synth:['#000000','#f4f4f0','#949b9d','#c4a4ef','#30213d'],alerta:['#000000','#f4f4f0','#949b9d','#f69494','#3c2020']};
  return {catalog,defaults,presets,make,validate,required,colors};
});
