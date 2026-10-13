"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const board = $('board'), svg = $('wires'), status = $('status');
  const ctxClass = window.AudioContext || window.webkitAudioContext;
  let audioContext = null, buffer = null, sourceNode = null, playing = false, startedAt = 0, offset = 0;
  let recorder = null, chunks = [], edgeStart = null, dragNode = null, dragDelta = {x:0,y:0};
  let graph = new Map(), edges = [{from:'source',to:'filter-1'},{from:'filter-1',to:'output'}], serial = 1;
  const say = message => { status.textContent = message; };
  const audio = () => audioContext || (audioContext = new ctxClass());
  const el = id => board.querySelector(`[data-node="${id}"]`);
  const portPos = (node, side) => {
    const rect = node.getBoundingClientRect(), b = board.getBoundingClientRect();
    return {x: rect.left-b.left+board.scrollLeft+(side==='out'?rect.width:0), y:rect.top-b.top+board.scrollTop+rect.height/2};
  };
  function renderWires(){
    svg.setAttribute('width', Math.max(board.scrollWidth,900)); svg.setAttribute('height',Math.max(board.scrollHeight,500));
    svg.setAttribute('viewBox',`0 0 ${Math.max(board.scrollWidth,900)} ${Math.max(board.scrollHeight,500)}`); svg.replaceChildren();
    edges.forEach(edge=>{const a=el(edge.from),b=el(edge.to);if(!a||!b)return;const p=portPos(a,'out'),q=portPos(b,'in'),curve=Math.max(45,Math.abs(q.x-p.x)*.45);const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M ${p.x} ${p.y} C ${p.x+curve} ${p.y}, ${q.x-curve} ${q.y}, ${q.x} ${q.y}`);path.setAttribute('class',`wire${edge.active?' active':''}`);svg.append(path);});
    const hint=board.querySelector('.board-hint'); if(hint) hint.hidden=edges.some(e=>e.from==='source');
  }
  function effectFor(node){
    const c=audio(), type=node.dataset.type, get=k=>Number(node.querySelector(`[data-param="${k}"]`)?.value||0);
    if(type==='gain'){const n=c.createGain();n.gain.value=get('gain')/100;return n;}
    if(type==='filter'){const n=c.createBiquadFilter();n.type='lowpass';n.frequency.value=get('frequency')||1800;n.Q.value=get('q')||1;return n;}
    if(type==='delay'){const input=c.createGain(),delay=c.createDelay(2),feedback=c.createGain(),wet=c.createGain(),dry=c.createGain(),out=c.createGain();delay.delayTime.value=get('time')/1000||.28;feedback.gain.value=get('feedback')/100||.3;wet.gain.value=get('mix')/100||.35;dry.gain.value=1-(get('mix')/100||.35)*.45;input.connect(dry);dry.connect(out);input.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(wet);wet.connect(out);return {input,output:out,dispose:()=>{try{input.disconnect();delay.disconnect();feedback.disconnect();wet.disconnect();dry.disconnect();out.disconnect()}catch(e){}}};}
    if(type==='distortion'){const n=c.createWaveShaper();const amount=get('amount')||35, curve=new Float32Array(44100);for(let i=0;i<curve.length;i++){const x=i*2/curve.length-1;curve[i]=(1+amount/12)*x/(1+amount/12*Math.abs(x));}n.curve=curve;n.oversample='4x';return n;}
    if(type==='reverb'){const input=c.createGain(),convolver=c.createConvolver(),dry=c.createGain(),wet=c.createGain(),out=c.createGain();const seconds=1.2,len=Math.floor(c.sampleRate*seconds),ir=c.createBuffer(2,len,c.sampleRate);for(let ch=0;ch<2;ch++){const data=ir.getChannelData(ch);for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);}convolver.buffer=ir;const mix=(get('mix')||30)/100;dry.gain.value=1-mix*.5;wet.gain.value=mix;input.connect(dry);dry.connect(out);input.connect(convolver);convolver.connect(wet);wet.connect(out);return {input,output:out,dispose:()=>{try{input.disconnect();convolver.disconnect();dry.disconnect();wet.disconnect();out.disconnect()}catch(e){}}};}
    return c.createGain();
  }
  function hasCycle(list){const next=new Map();list.forEach(e=>{if(!next.has(e.from))next.set(e.from,[]);next.get(e.from).push(e.to);});const visiting=new Set(),done=new Set();function visit(n){if(visiting.has(n))return true;if(done.has(n))return false;visiting.add(n);for(const m of next.get(n)||[])if(visit(m))return true;visiting.delete(n);done.add(n);return false;}return [...next.keys()].some(visit);}
  function reachable(list){const seen=new Set(['source']),queue=['source'];while(queue.length){for(const e of list)if(e.from===queue[0]&&!seen.has(e.to)){seen.add(e.to);queue.push(e.to);}queue.shift();}return seen;}
  function rebuild(){
    const resume=playing, resumeOffset=resume?((audio().currentTime-startedAt)%buffer.duration):0;
    if(resume)stop();
    const c=audio(); for(const item of graph.values()){try{item.dispose?.();(item.input||item).disconnect();(item.output||item).disconnect();}catch(e){}} graph.clear();
    board.querySelectorAll('.effect-node').forEach(node=>graph.set(node.dataset.node,effectFor(node)));
    const active=reachable(edges);edges.forEach(e=>e.active=active.has(e.to));
    edges.forEach(e=>{const from=e.from==='source'?null:graph.get(e.from),to=e.to==='output'?null:graph.get(e.to);const a=from?(from.output||from):null,b=to?(to.input||to):outputGain;if(a&&b&&e.from!=='source'){try{a.connect(b)}catch(err){}} else if(e.from==='source'&&b&&sourceNode){try{sourceNode.connect(b)}catch(err){}} else if(e.from==='source'&&e.to==='output'&&sourceNode){try{sourceNode.connect(outputGain)}catch(err){}} });
    renderWires(); if(resume){offset=resumeOffset;setTimeout(()=>play().catch(()=>{}),0);}
  }
  const outputGain=(()=>{if(!ctxClass)return null;return audio().createGain()})();
  function connectOutput(){if(!ctxClass)return;const c=audio();try{outputGain.disconnect();}catch(e){}outputGain.connect(c.destination);const meter=c.createAnalyser();meter.fftSize=256;outputGain.connect(meter);const data=new Uint8Array(meter.frequencyBinCount),fill=board.querySelector('.level i');function draw(){if(!playing)return;meter.getByteTimeDomainData(data);let sum=0;for(const x of data){const v=(x-128)/128;sum+=v*v;}fill.style.width=Math.min(100,Math.sqrt(sum/data.length)*150)+'%';requestAnimationFrame(draw);}requestAnimationFrame(draw);}
  if(ctxClass){connectOutput();rebuild();}else say('Este navegador não oferece suporte ao processamento de áudio.');
  function stop(){if(sourceNode){try{sourceNode.stop()}catch(e){}try{sourceNode.disconnect()}catch(e){}sourceNode=null;}playing=false;offset=0;$('playBtn').textContent='▶ OUVIR';$('stopBtn').disabled=true;}
  async function play(){if(!buffer)return;const c=audio();await c.resume();sourceNode=c.createBufferSource();sourceNode.buffer=buffer;const active=reachable(edges);let connected=false;
    // Effect-to-effect and effect-to-output links are wired by rebuild(). Only
    // source links change for each new BufferSource; reconnecting every edge
    // here can leave duplicate/stale routes after editing the patch.
    edges.forEach(e=>{if(e.from!=='source'||!active.has(e.to))return;const to=e.to==='output'?outputGain:(graph.get(e.to)?.input||graph.get(e.to));if(to){try{sourceNode.connect(to);connected=true;}catch(err){}}});
    if(!connected)sourceNode.connect(outputGain);sourceNode.onended=()=>{if(playing){playing=false;$('playBtn').textContent='▶ OUVIR';$('stopBtn').disabled=true;}};sourceNode.start(0,offset);startedAt=c.currentTime;playing=true;$('playBtn').textContent='Ⅱ PAUSAR';$('stopBtn').disabled=false;}
  $('moduleAudio').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{say('Carregando áudio…');const c=audio();buffer=await c.decodeAudioData(await file.arrayBuffer());$('fileName').textContent=file.name;$('playBtn').disabled=false;$('exportBtn').disabled=false;say(`Áudio carregado (${Math.round(buffer.duration)} s). Conecte a cadeia e pressione Ouvir.`);}catch(err){buffer=null;say('Não foi possível abrir este arquivo de áudio. Tente outro formato.');}});
  $('playBtn').addEventListener('click',()=>{if(playing){offset=(audio().currentTime-startedAt)%buffer.duration;stop();$('playBtn').textContent='▶ OUVIR';}else play().catch(()=>say('Não foi possível iniciar o áudio. Tente novamente.'));});
  $('stopBtn').addEventListener('click',stop);
  $('exportBtn').addEventListener('click',async()=>{if(!buffer||!window.MediaRecorder){say('A exportação em tempo real não está disponível neste navegador.');return;}stop();const c=audio(),dest=c.createMediaStreamDestination();outputGain.connect(dest);const type=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';chunks=[];recorder=new MediaRecorder(dest.stream,{mimeType:type});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=()=>{const url=URL.createObjectURL(new Blob(chunks,{type})),a=document.createElement('a');a.href=url;a.download='modular-fx.webm';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);try{outputGain.disconnect(dest)}catch(e){}say('Áudio processado exportado em WebM.');};recorder.start();await play();say('Gravando a saída processada…');setTimeout(()=>{if(recorder?.state==='recording'){stop();recorder.stop();}},buffer.duration*1000+250);});
  function addNode(type){const id=`${type}-${++serial}`,titles={gain:'VOLUME',filter:'FILTRO',delay:'DELAY',distortion:'DISTORÇÃO',reverb:'REVERB'},fields={gain:[['gain','Saída',0,150,100,'%']],filter:[['frequency','Frequência',150,8000,1800,'Hz'],['q','Ressonância',.1,12,1,'']],delay:[['time','Tempo',80,800,280,'ms'],['feedback','Retorno',0,85,30,'%'],['mix','Mistura',0,80,35,'%']],distortion:[['amount','Intensidade',0,100,35,'%']],reverb:[['mix','Mistura',0,90,30,'%']]};const n=document.createElement('div');n.className='node effect-node';n.dataset.node=id;n.dataset.type=type;n.style.left=`${50+Math.random()*100}px`;n.style.top=`${65+Math.random()*260}px`;const h=document.createElement('header');h.className='node-head';h.innerHTML=`<span>${titles[type]}</span><button class="remove" title="Remover módulo" aria-label="Remover módulo">×</button>`;const body=document.createElement('div');body.className='node-body';fields[type].forEach(([key,label,min,max,value,unit])=>{const l=document.createElement('label'),o=document.createElement('output'),r=document.createElement('input');l.append(document.createTextNode(label+' '));o.textContent=value+unit;r.type='range';r.min=min;r.max=max;r.step=key==='q'?'.1':'1';r.value=value;r.dataset.param=key;r.addEventListener('input',()=>{o.textContent=r.value+unit;rebuild();});l.append(o,r);body.append(l);});n.append(h,body);const pi=document.createElement('div'),po=document.createElement('div');pi.className='port input';pi.dataset.port='in';po.className='port output';po.dataset.port='out';n.append(pi,po);board.append(n);rebuild();say(`${titles[type]} adicionado. Conecte suas portas.`);}
  document.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>addNode(b.dataset.add)));
  board.addEventListener('click',e=>{const remove=e.target.closest('.remove');if(!remove)return;const node=remove.closest('.node');edges=edges.filter(x=>x.from!==node.dataset.node&&x.to!==node.dataset.node);node.remove();rebuild();});
  board.addEventListener('pointerdown',e=>{const port=e.target.closest('.port');if(port?.dataset.port==='out'){edgeStart=port.closest('.node').dataset.node;e.preventDefault();return;}const head=e.target.closest('.node-head');if(head){dragNode=head.closest('.node');const r=dragNode.getBoundingClientRect(),b=board.getBoundingClientRect();dragDelta={x:e.clientX-(r.left-b.left+board.scrollLeft),y:e.clientY-(r.top-b.top+board.scrollTop)};head.setPointerCapture(e.pointerId);}});
  board.addEventListener('pointermove',e=>{if(dragNode){const b=board.getBoundingClientRect();dragNode.style.left=`${Math.max(4,e.clientX-b.left+board.scrollLeft-dragDelta.x)}px`;dragNode.style.top=`${Math.max(4,e.clientY-b.top+board.scrollTop-dragDelta.y)}px`;renderWires();}});
  board.addEventListener('pointerup',e=>{if(edgeStart){const port=e.target.closest('.port.input'),target=port?.closest('.node')?.dataset.node;if(target&&target!==edgeStart){const next=edges.filter(x=>x.to!==target);next.push({from:edgeStart,to:target});if(hasCycle(next)){say('Essa conexão criaria um ciclo. Escolha outro destino.');}else{edges=next;rebuild();say('Conexão atualizada.');}}edgeStart=null;}dragNode=null;});
  board.addEventListener('input',e=>{if(e.target.matches('[data-param]')){const n=e.target.closest('label'),o=n?.querySelector('output');if(o)o.textContent=e.target.value+(e.target.dataset.param==='frequency'?' Hz':e.target.dataset.param==='time'?' ms':e.target.dataset.param==='q'?'':'%');}});
  board.addEventListener('scroll',renderWires);window.addEventListener('resize',renderWires);
})();
