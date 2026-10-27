"use strict";

const $ = id => document.getElementById(id);
const PEDALS = [
  {id:"ns2", name:"NS-2", type:"gate", desc:"Noise Suppressor", color:"green", control:"Threshold"},
  {id:"cs3", name:"CS-3", type:"compressor", desc:"Compression Sustainer", color:"yellow", control:"Sustain"},
  {id:"bd2", name:"BD-2", type:"overdrive", desc:"Blues Driver", color:"blue", control:"Drive"},
  {id:"ds1", name:"DS-1", type:"distortion", desc:"Distortion", color:"orange", control:"Dist"},
  {id:"ge7", name:"GE-7", type:"eq", desc:"Graphic Equalizer", color:"pink", control:"Tone"},
  {id:"ch1", name:"CH-1", type:"chorus", desc:"Super Chorus", color:"blue", control:"Depth"},
  {id:"bf3", name:"BF-3", type:"flanger", desc:"Flanger", color:"purple", control:"Depth"},
  {id:"ph3", name:"PH-3", type:"phaser", desc:"Phase Shifter", color:"orange", control:"Rate"},
  {id:"fuzz", name:"FZ-5", type:"fuzz", desc:"Fuzz", color:"purple", control:"Fuzz"},
  {id:"octfuzz", name:"OCTAFUZZ", type:"octfuzz", desc:"Octave Fuzz", color:"orange", control:"Octave"},
  {id:"vibrato", name:"VB-2", type:"vibrato", desc:"Vibrato", color:"pink", control:"Depth"},
  {id:"tr2", name:"TR-2", type:"tremolo", desc:"Tremolo", color:"blue", control:"Depth"},
  {id:"dd8", name:"DD-8", type:"delay", desc:"Digital Delay", color:"white", control:"Feedback"},
  {id:"rv6", name:"RV-6", type:"reverb", desc:"Reverb", color:"white", control:"Level"},
  {id:"shimmer", name:"SHIMMER", type:"shimmer", desc:"Shimmer Reverb", color:"purple", control:"Shimmer"}
];
const values = Object.fromEntries(PEDALS.map(p => [p.id, ({ns2:35,cs3:18,bd2:0,ds1:0,ge7:50,ch1:0,bf3:0,ph3:0,fuzz:0,octfuzz:0,vibrato:0,tr2:0,dd8:0,rv6:0,shimmer:0})[p.id]]));
const enabled = Object.fromEntries(PEDALS.map(p => [p.id, ["ge7"].includes(p.id)]));
let order = PEDALS.map(p => p.id);
let ctx = null, inputNode = null, inputStream = null, mediaNode = null, fileUrl = null;
let analyser = null, master = null, recordDestination = null, activeStages = [];
let recorder = null, recordChunks = [], recordUrl = null, recordStarted = 0, recordTicker = 0;
let rawRecordingSource = null, rawRecordingDestination = null;
let recordedMediaNode = null, recordedPlaybackGain = null, recordedPlaybackStages = [];
let recordingHasDry = false, recordingEffectsEnabled = false;
let fileEffectsEnabled = false;
let tunerFrame = 0, tunerLastUpdate = 0, snapshots = {A:null,B:null}, currentAB = null;

const PRESETS = {
  clean:{values:{ns2:30,cs3:18,bd2:0,ds1:0,ge7:54,ch1:0,bf3:0,ph3:0,tr2:0,dd8:0,rv6:0},enabled:["ge7"]},
  blues:{values:{ns2:28,cs3:38,bd2:36,ds1:0,ge7:58,ch1:10,bf3:0,ph3:0,tr2:0,dd8:12,rv6:14},enabled:["ns2","cs3","bd2","ge7","ch1","dd8","rv6"]},
  crunch:{values:{ns2:35,cs3:26,bd2:28,ds1:46,ge7:60,ch1:0,bf3:0,ph3:0,tr2:0,dd8:8,rv6:15},enabled:["ns2","cs3","bd2","ds1","ge7","dd8","rv6"]},
  fuzz:{values:{ns2:46,cs3:40,bd2:0,ds1:78,ge7:42,ch1:0,bf3:0,ph3:0,tr2:0,dd8:12,rv6:10},enabled:["ns2","cs3","ds1","ge7","dd8","rv6"]},
  space:{values:{ns2:20,cs3:20,bd2:0,ds1:0,ge7:52,ch1:38,bf3:22,ph3:35,tr2:15,dd8:62,rv6:58},enabled:["ns2","cs3","ge7","ch1","bf3","ph3","tr2","dd8","rv6"]}
};

function announce(id,message){$(id).textContent=message;}
function updatePower(){const on=!!inputNode; $("ampPowerState").textContent=on?"POWER ON":"STANDBY"; $("inputLed").classList.toggle("on",on); $("inputLedLabel").textContent=on?"INPUT CONECTADA":"INPUT DESCONECTADA";}
function showInputError(error){
  const messages={NotAllowedError:"Acesso ao microfone bloqueado. Libere a permissão nas configurações do navegador.",NotFoundError:"Nenhuma entrada de áudio foi encontrada.",NotReadableError:"A entrada está ocupada por outro aplicativo.",OverconstrainedError:"A entrada selecionada não está disponível."};
  announce("inputStatus",messages[error?.name]||"Não foi possível acessar a entrada de áudio. Verifique a interface, a conexão e as permissões.");
}
async function refreshInputs(preferred=""){
  const select=$("inputSelect"), previous=preferred||select.value;
  try{
    const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==="audioinput");
    select.replaceChildren(new Option("Entrada padrão do navegador",""));
    devices.forEach((d,i)=>select.add(new Option(d.label||"Entrada de áudio "+(i+1),d.deviceId)));
    if(previous&&[...select.options].some(o=>o.value===previous))select.value=previous;
  }catch(error){announce("inputStatus","Não foi possível listar as entradas. Você ainda pode tentar a entrada padrão.")}
}
function setupAudio(){
  if(ctx)return;
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass)throw new Error("Este navegador não oferece Web Audio.");
  ctx=new AudioContextClass({latencyHint:"interactive"});
  analyser=ctx.createAnalyser(); analyser.fftSize=2048;
  master=ctx.createGain(); master.gain.value=Number($("masterVolume").value)/100;
  recordDestination=ctx.createMediaStreamDestination();
  master.connect(ctx.destination); master.connect(recordDestination);
}
function curveFor(type,amount){
  const size=2048, curve=new Float32Array(size), drive=1+amount*24;
  for(let i=0;i<size;i++){
    const x=i*2/(size-1)-1;
    if(type==="overdrive")curve[i]=Math.tanh(x*drive*0.75)/Math.tanh(drive*0.75);
    else if(type==="distortion")curve[i]=((1+drive)*x)/(1+drive*Math.abs(x));
    else if(type==="fuzz")curve[i]=Math.tanh(x*drive*1.8)/Math.tanh(drive*1.8);
    else if(type==="octfuzz")curve[i]=Math.tanh((2*Math.abs(x)-1)*drive)/Math.tanh(drive);
    else curve[i]=Math.max(-1,Math.min(1,x*drive*1.8));
  }
  return curve;
}
function makeStage(pedalId){
  const def=PEDALS.find(p=>p.id===pedalId), type=def.type, amount=values[pedalId]/100;
  const input=ctx.createGain(), output=ctx.createGain(), nodes=[input,output], oscillators=[];
  const connect=(a,b)=>a.connect(b);
  if(!enabled[pedalId]){connect(input,output);return{input,output,nodes,oscillators};}
  if(type==="gate"){
    const rectifier=ctx.createWaveShaper(),envelope=ctx.createBiquadFilter(),gate=ctx.createWaveShaper(),smooth=ctx.createBiquadFilter(),limit=ctx.createWaveShaper();
    const absolute=new Float32Array(2049),opening=new Float32Array(16385),threshold=Math.pow(10,(-60+amount*36)/20);
    for(let i=0;i<absolute.length;i++)absolute[i]=Math.abs(i*2/(absolute.length-1)-1);
    for(let i=0;i<opening.length;i++){
      const level=i*2/(opening.length-1)-1,t=Math.max(0,Math.min(1,(level-threshold*.5)/threshold));
      opening[i]=t*t*(3-2*t);
    }
    rectifier.curve=absolute;gate.curve=opening;
    // Average rectified channels before the gate so inverted stereo cannot cancel.
    envelope.channelCount=1;envelope.channelCountMode="explicit";
    envelope.type=smooth.type="lowpass";envelope.frequency.value=60;smooth.frequency.value=30;
    // Lowpass Q uses dB; keep the envelope filters non-resonant.
    envelope.Q.value=smooth.Q.value=-6.1;output.gain.value=0;
    // Clamp the smoothed control so filter overshoot cannot boost or invert the signal.
    limit.curve=new Float32Array([0,0,1]);
    nodes.push(rectifier,envelope,gate,smooth,limit);
    connect(input,output);connect(input,rectifier);connect(rectifier,envelope);connect(envelope,gate);connect(gate,smooth);connect(smooth,limit);connect(limit,output.gain);
  }else if(type==="compressor"){
    const comp=ctx.createDynamicsCompressor(); nodes.push(comp);
    comp.threshold.value=-16-amount*22;comp.knee.value=8;comp.ratio.value=1+amount*6;comp.attack.value=.008;comp.release.value=.08+amount*.12;
    connect(input,comp);connect(comp,output);
  }else if(type==="overdrive"||type==="distortion"||type==="fuzz"||type==="octfuzz"){
    const shaper=ctx.createWaveShaper();shaper.curve=curveFor(type,amount);shaper.oversample="4x";nodes.push(shaper);connect(input,shaper);connect(shaper,output);
  }else if(type==="eq"){
    const low=ctx.createBiquadFilter(),mid=ctx.createBiquadFilter(),high=ctx.createBiquadFilter();
    low.type="lowshelf";low.frequency.value=160;low.gain.value=(amount-.5)*12;
    mid.type="peaking";mid.frequency.value=950;mid.Q.value=1;mid.gain.value=(amount-.5)*10;
    high.type="highshelf";high.frequency.value=3200;high.gain.value=(amount-.5)*14;
    nodes.push(low,mid,high);connect(input,low);connect(low,mid);connect(mid,high);connect(high,output);
  }else if(type==="chorus"||type==="flanger"){
    const dry=ctx.createGain(),wet=ctx.createGain(),delay=ctx.createDelay(.08),lfo=ctx.createOscillator(),depth=ctx.createGain();
    delay.delayTime.value=type==="chorus"?.022:.004;
    lfo.frequency.value=type==="chorus"?.7+.8*amount:.15+1.1*amount;
    depth.gain.value=type==="chorus"?.008*amount:.0035*amount;
    wet.gain.value=.25+.45*amount; lfo.connect(depth);depth.connect(delay.delayTime);lfo.start();
    nodes.push(dry,wet,delay,depth);oscillators.push(lfo);connect(input,dry);connect(dry,output);connect(input,delay);connect(delay,wet);connect(wet,output);
  }else if(type==="phaser"){
    const dry=ctx.createGain(),wet=ctx.createGain(),filters=[0,1,2,3].map(()=>ctx.createBiquadFilter()),lfo=ctx.createOscillator(),depth=ctx.createGain();
    filters.forEach((f,i)=>{f.type="allpass";f.frequency.value=350+i*240;f.Q.value=.8;});
    lfo.frequency.value=.15+amount*1.4;depth.gain.value=amount*900;lfo.connect(depth);filters.forEach(f=>depth.connect(f.frequency));lfo.start();wet.gain.value=.6;
    nodes.push(dry,wet,...filters,depth);oscillators.push(lfo);connect(input,dry);connect(dry,output);connect(input,filters[0]);filters.forEach((f,i)=>connect(f,filters[i+1]||wet));connect(wet,output);
  }else if(type==="vibrato"){
    const delay=ctx.createDelay(.04),lfo=ctx.createOscillator(),depth=ctx.createGain();
    delay.delayTime.value=.012;lfo.frequency.value=.8+amount*5;depth.gain.value=.0006+amount*.006;
    lfo.connect(depth);depth.connect(delay.delayTime);lfo.start();
    nodes.push(delay,depth);oscillators.push(lfo);connect(input,delay);connect(delay,output);
  }else if(type==="tremolo"){
    const gain=ctx.createGain(),lfo=ctx.createOscillator(),depth=ctx.createGain();
    lfo.type="square";lfo.frequency.value=2+amount*8;depth.gain.value=.48*amount;gain.gain.value=1-depth.gain.value;lfo.connect(depth);depth.connect(gain.gain);lfo.start();
    nodes.push(gain,depth);oscillators.push(lfo);connect(input,gain);connect(gain,output);
  }else if(type==="delay"){
    const dry=ctx.createGain(),wet=ctx.createGain(),delay=ctx.createDelay(1.2),feedback=ctx.createGain();
    delay.delayTime.value=.09+amount*.32;feedback.gain.value=Math.min(.42,amount*.48);wet.gain.value=.08+amount*.3;
    nodes.push(dry,wet,delay,feedback);connect(input,dry);connect(dry,output);connect(input,delay);connect(delay,wet);connect(wet,output);connect(delay,feedback);connect(feedback,delay);
  }else if(type==="reverb"){
    const dry=ctx.createGain(),wet=ctx.createGain(),convolver=ctx.createConvolver(),buffer=ctx.createBuffer(2,Math.floor(ctx.sampleRate*(.65+amount*1.35)),ctx.sampleRate);
    for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3.6);}
    convolver.buffer=buffer;wet.gain.value=.04+amount*.34;nodes.push(dry,wet,convolver);connect(input,dry);connect(dry,output);connect(input,convolver);connect(convolver,wet);connect(wet,output);
  }else if(type==="shimmer"){
    const dry=ctx.createGain(),wet=ctx.createGain(),shifter=ctx.createWaveShaper(),highpass=ctx.createBiquadFilter(),convolver=ctx.createConvolver();
    const curve=new Float32Array(2048);
    for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=2*Math.abs(x)-1;}
    shifter.curve=curve;shifter.oversample="4x";highpass.type="highpass";highpass.frequency.value=120;
    const buffer=ctx.createBuffer(2,Math.floor(ctx.sampleRate*(2.2+amount*2.2)),ctx.sampleRate);
    for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2.1);}
    convolver.buffer=buffer;dry.gain.value=.82;wet.gain.value=.16+amount*.68;
    nodes.push(dry,wet,shifter,highpass,convolver);connect(input,dry);connect(dry,output);connect(input,shifter);connect(shifter,highpass);connect(highpass,convolver);connect(convolver,wet);connect(wet,output);
  }else{connect(input,output);}
  return{input,output,nodes,oscillators};
}
function disconnectStages(){
  activeStages.forEach(stage=>{stage.oscillators.forEach(o=>{try{o.stop()}catch(e){}});stage.nodes.forEach(n=>{try{n.disconnect()}catch(e){}});});
  activeStages=[];
}
function makeAmpCabStage(){
  const input=ctx.createGain(),output=ctx.createGain(),pre=ctx.createGain(),shaper=ctx.createWaveShaper();
  const tone=ctx.createBiquadFilter(),highpass=ctx.createBiquadFilter(),body=ctx.createBiquadFilter(),mudCut=ctx.createBiquadFilter(),presence=ctx.createBiquadFilter(),lowpass=ctx.createBiquadFilter();
  const gain=Number($("ampGain").value)/100,toneValue=Number($("ampTone").value)/100;
  // Keep gain at zero transparent; introduce soft clipping gradually as the
  // knob rises, with a smaller preamp boost to avoid runaway level.
  pre.gain.value=1+gain*1.5;
  const curve=new Float32Array(2048),drive=1+gain*7;
  for(let i=0;i<curve.length;i++){
    const x=i*2/(curve.length-1)-1;
    curve[i]=gain===0?x:Math.tanh(x*drive);
  }
  shaper.curve=curve;shaper.oversample="2x";
  tone.type="lowpass";tone.frequency.value=1200+toneValue*10500;tone.Q.value=.35;
  highpass.type="highpass";highpass.frequency.value=65;highpass.Q.value=.7;
  lowpass.type="lowpass";lowpass.frequency.value=4200+toneValue*1500;lowpass.Q.value=.65;
  body.type="peaking";body.frequency.value=145;body.Q.value=.8;body.gain.value=1.2;
  mudCut.type="peaking";mudCut.frequency.value=360;mudCut.Q.value=.9;mudCut.gain.value=-1.8;
  presence.type="peaking";presence.frequency.value=2100;presence.Q.value=.75;presence.gain.value=1.4;
  input.connect(pre);pre.connect(shaper);shaper.connect(tone);tone.connect(highpass);highpass.connect(body);body.connect(mudCut);mudCut.connect(presence);presence.connect(lowpass);lowpass.connect(output);
  return{input,output,nodes:[input,pre,shaper,tone,highpass,body,mudCut,presence,lowpass,output],oscillators:[]};
}
function ensureRecordedPlayback(){
  if(!ctx)return;
  if(!recordedPlaybackGain){
    recordedPlaybackGain=ctx.createGain();
    recordedPlaybackGain.gain.value=Number($("masterVolume").value)/100;
    recordedPlaybackGain.connect(ctx.destination);
  }
  if(!recordedMediaNode)recordedMediaNode=ctx.createMediaElementSource($("recordedAudio"));
}
function clearRecordedPlaybackStages(){
  recordedPlaybackStages.forEach(stage=>{
    stage.oscillators.forEach(o=>{try{o.stop()}catch(e){}});
    stage.nodes.forEach(n=>{try{n.disconnect()}catch(e){}});
  });
  recordedPlaybackStages=[];
}
function rebuildRecordedPlaybackChain(){
  if(!ctx||!recordedMediaNode||!recordedPlaybackGain)return;
  clearRecordedPlaybackStages();
  try{recordedMediaNode.disconnect()}catch(e){}
  if(!recordingHasDry||!recordingEffectsEnabled){
    recordedMediaNode.connect(recordedPlaybackGain);
    return;
  }
  let previous=recordedMediaNode;
  for(const id of order){
    const stage=makeStage(id);recordedPlaybackStages.push(stage);
    previous.connect(stage.input);previous=stage.output;
  }
  const ampCab=makeAmpCabStage();recordedPlaybackStages.push(ampCab);
  previous.connect(ampCab.input);ampCab.output.connect(recordedPlaybackGain);
}
function updateRecordingEffectsButton(){
  const button=$("recordingEffectsBtn");
  button.disabled=!recordingHasDry||!!recorder;
  button.setAttribute("aria-pressed",String(recordingEffectsEnabled));
}
function toggleRecordingEffects(){
  if(!recordingHasDry)return;
  recordingEffectsEnabled=!recordingEffectsEnabled;
  updateRecordingEffectsButton();rebuildRecordedPlaybackChain();
  announce("recordStatus",recordingEffectsEnabled?"Efeitos ligados na reprodução da gravação.":"Efeitos desligados; reprodução sem processamento.");
}
function rebuildChain(){
  if(!ctx)return;
  rebuildRecordedPlaybackChain();
  if(!inputNode)return;
  disconnectStages();
  try{inputNode.disconnect()}catch(e){}
  inputNode.connect(analyser);
  if(rawRecordingSource===inputNode&&rawRecordingDestination)inputNode.connect(rawRecordingDestination);
  if(inputNode===mediaNode&&!fileEffectsEnabled){
    inputNode.connect(master);updatePower();return;
  }
  let previous=inputNode;
  for(const id of order){const stage=makeStage(id);activeStages.push(stage);previous.connect(stage.input);previous=stage.output;}
  const ampCab=makeAmpCabStage();activeStages.push(ampCab);previous.connect(ampCab.input);ampCab.output.connect(master);
  updatePower();
}
function setAudioSource(node){
  inputNode=node;
  rebuildChain();
  $("recordBtn").disabled=false;$("recordDryBtn").disabled=false;
  $("disconnectInput").disabled=false;
  updatePower();
  startTuner();
}
async function stopInput(){
  if(recorder&&recorder.state!=="inactive")recorder.stop();
  if(inputStream){inputStream.getTracks().forEach(t=>t.stop());inputStream=null;}
  if($("audioSource").src){$("audioSource").pause();$("audioSource").currentTime=0;}
  if(inputNode){try{inputNode.disconnect()}catch(e){}}
  inputNode=null;disconnectStages();cancelAnimationFrame(tunerFrame);
  $("disconnectInput").disabled=true;$("recordBtn").disabled=true;$("recordDryBtn").disabled=true;$("playFile").disabled=true;$("stopFile").disabled=true;
  updatePower();$("clipLed").classList.remove("clip");announce("inputStatus","Entrada desconectada.");
}
async function connectGuitar(){
  try{
    setupAudio();await ctx.resume();
    if(inputStream){inputStream.getTracks().forEach(t=>t.stop());}
    const deviceId=$("inputSelect").value;
    const audioConstraints={echoCancellation:false,noiseSuppression:false,autoGainControl:false,latency:0.01,channelCount:1};
    if(deviceId)audioConstraints.deviceId={exact:deviceId};
    inputStream=await navigator.mediaDevices.getUserMedia({audio:audioConstraints});
    if($("audioSource").src){$("audioSource").pause();$("audioSource").removeAttribute("src");$("audioSource").load();}
    if(inputNode){try{inputNode.disconnect()}catch(e){}}
    setAudioSource(ctx.createMediaStreamSource(inputStream));
    const track=inputStream.getAudioTracks()[0], device=track.getSettings().deviceId;
    await refreshInputs(device||"");
    const name=$("inputSelect").selectedOptions[0]?.textContent||"entrada padrão";
    announce("inputStatus","Conectado: "+name+". Use fones para evitar microfonia.");
    $("playFile").disabled=true;
  }catch(error){showInputError(error);}
}
async function loadAudioFile(file){
  if(!file)return;
  if(file.size>100*1024*1024){announce("inputStatus","O arquivo ultrapassa o limite de 100 MB.");return;}
  await stopInput();
  try{
    setupAudio();await ctx.resume();
    if(fileUrl)URL.revokeObjectURL(fileUrl);
    fileUrl=URL.createObjectURL(file);$("audioSource").src=fileUrl;$("audioSource").hidden=false;
    if(!mediaNode)mediaNode=ctx.createMediaElementSource($("audioSource"));
    fileEffectsEnabled=false;updatePlayFileButton();
    setAudioSource(mediaNode);
    $("playFile").disabled=false;$("stopFile").disabled=false;
    announce("inputStatus","Áudio carregado: "+file.name+". Clique em Ouvir com pedais.");
  }catch(error){announce("inputStatus","Não foi possível carregar este áudio neste navegador.");}
}
function updatePlayFileButton(){
  const button=$("playFile");
  button.textContent=fileEffectsEnabled?"Ouvir sem pedais":"Ouvir com pedais";
  button.setAttribute("aria-pressed",String(fileEffectsEnabled));
}
async function playFile(){
  if(inputNode!==mediaNode||!mediaNode)return;
  const audio=$("audioSource"),shouldStart=audio.paused||audio.ended;
  fileEffectsEnabled=!fileEffectsEnabled;updatePlayFileButton();rebuildChain();
  try{
    await ctx.resume();
    if(shouldStart)await audio.play();
    announce("inputStatus",fileEffectsEnabled?"Reproduzindo com pedais. Clique para ouvir sem pedais.":"Reproduzindo sem pedais. Clique para ouvir com pedais.");
  }catch(error){announce("inputStatus","Não foi possível reproduzir o arquivo.");}
}
function stopFile(){ $("audioSource").pause();$("audioSource").currentTime=0;announce("inputStatus","Reprodução parada.");}
function startTuner(){
  cancelAnimationFrame(tunerFrame);
  const buffer=new Float32Array(analyser.fftSize);
  const update=now=>{
    tunerFrame=requestAnimationFrame(update);
    if(now-tunerLastUpdate<90)return;tunerLastUpdate=now;
    analyser.getFloatTimeDomainData(buffer);
    let rms=0;for(let i=0;i<buffer.length;i++)rms+=buffer[i]*buffer[i];rms=Math.sqrt(rms/buffer.length);
    $("clipLed").classList.toggle("clip",rms>.62);
    if(rms<.009){$("tunerNote").textContent="--";$("tunerFrequency").textContent="Aguardando sinal";return;}
    let bestLag=0,bestCorr=0;
    const minLag=Math.floor(ctx.sampleRate/1000),maxLag=Math.min(Math.floor(ctx.sampleRate/40),buffer.length/2);
    for(let lag=minLag;lag<=maxLag;lag++){let corr=0;for(let i=0;i<buffer.length-lag;i+=2)corr+=buffer[i]*buffer[i+lag];if(corr>bestCorr){bestCorr=corr;bestLag=lag;}}
    if(!bestLag)return;
    const hz=ctx.sampleRate/bestLag,midi=Math.round(69+12*Math.log2(hz/440)),noteNames=["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"],note=noteNames[(midi%12+12)%12],target=440*Math.pow(2,(midi-69)/12),cents=Math.max(-50,Math.min(50,1200*Math.log2(hz/target)));
    $("tunerNote").textContent=note+(Math.floor(midi/12)-1);$("tunerFrequency").textContent=hz.toFixed(1)+" Hz / "+(cents>0?"+":"")+cents.toFixed(0)+" cents";
    $("tunerNeedle").style.left=(50+cents)+"%";document.querySelector(".tuner-meter").setAttribute("aria-valuenow",cents.toFixed(0));
    $("tunerAdvice").textContent=Math.abs(cents)<5?"Afinada":cents<0?"Afine a corda para cima":"Afine a corda para baixo";
  };
  tunerFrame=requestAnimationFrame(update);
}
function renderPedals(){
  const root=$("pedalList");root.replaceChildren();
  order.forEach((id,index)=>{
    const p=PEDALS.find(x=>x.id===id),card=document.createElement("article");card.className="pedal pedal-"+p.color+(enabled[id]?"":" is-bypassed");
    const head=document.createElement("div");head.className="pedal-head";
    const title=document.createElement("h3");title.className="pedal-title";title.textContent=p.name+" / "+p.desc;
    const sw=document.createElement("button");sw.type="button";sw.className="pedal-switch";sw.setAttribute("role","switch");sw.setAttribute("aria-checked",String(enabled[id]));sw.setAttribute("aria-label",p.name+" "+(enabled[id]?"ligado":"desligado"));sw.textContent=enabled[id]?"● ON":"○ OFF";sw.dataset.pedal=id;
    head.append(title,sw);
    const label=document.createElement("label");label.htmlFor="knob-"+id;label.innerHTML="<span>"+p.control+"</span><output>"+values[id]+"%</output>";
    const range=document.createElement("input");range.id="knob-"+id;range.type="range";range.min="0";range.max="100";range.value=values[id];range.dataset.knob=id;range.setAttribute("aria-label",p.name+" "+p.control);
    const actions=document.createElement("div");actions.className="pedal-actions";
    const up=document.createElement("button");up.type="button";up.textContent="← MOVER";up.setAttribute("aria-label","Mover "+p.name+" para antes");up.disabled=index===0;up.dataset.move=id;up.dataset.direction="-1";
    const down=document.createElement("button");down.type="button";down.textContent="MOVER →";down.setAttribute("aria-label","Mover "+p.name+" para depois");down.disabled=index===order.length-1;down.dataset.move=id;down.dataset.direction="1";
    actions.append(up,down);card.append(head,label,range,actions);root.append(card);
  });
}
function pedalChanged(message="Pedaleira atualizada."){
  currentAB=null;renderPedals();rebuildChain();announce("pedalStatus",message);
}
function randomizePedalboard(){
  PEDALS.forEach(pedal=>{
    values[pedal.id]=Math.floor(Math.random()*101);
    enabled[pedal.id]=Math.random()<0.5;
  });
  if(!PEDALS.some(pedal=>enabled[pedal.id])) enabled[PEDALS[Math.floor(Math.random()*PEDALS.length)].id]=true;
  pedalChanged("Ajustes aleatórios aplicados à pedaleira.");
}
$("randomizePedals").addEventListener("click",randomizePedalboard);
$("pedalList").addEventListener("click",e=>{
  const sw=e.target.closest("[data-pedal]");
  if(sw){const id=sw.dataset.pedal;enabled[id]=!enabled[id];pedalChanged(PEDALS.find(p=>p.id===id).name+" "+(enabled[id]?"ligado. Ajuste preservado.":"desligado. Ajuste preservado."));return;}
  const move=e.target.closest("[data-move]");if(move){const i=order.indexOf(move.dataset.move),j=i+Number(move.dataset.direction);if(j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];pedalChanged("Ordem atualizada.");}
});
$("pedalList").addEventListener("input",e=>{
  const knob=e.target.closest("[data-knob]");if(!knob)return;
  values[knob.dataset.knob]=Number(knob.value);knob.previousElementSibling.querySelector("output").textContent=knob.value+"%";currentAB=null;rebuildChain();
});
function applyPreset(key){
  const p=PRESETS[key];if(!p)return;
  Object.assign(values,p.values);PEDALS.forEach(x=>enabled[x.id]=p.enabled.includes(x.id));
  currentAB=null;$("ampGain").value=key==="crunch"||key==="fuzz"?58:key==="blues"?30:12;$("ampTone").value=key==="blues"?62:58;
  syncAmpControls();renderPedals();rebuildChain();announce("pedalStatus","Preset "+key.toUpperCase()+" carregado.");
}
function resetEffects(){
  const defaults={ns2:35,cs3:18,bd2:0,ds1:0,ge7:50,ch1:0,bf3:0,ph3:0,fuzz:0,octfuzz:0,vibrato:0,tr2:0,dd8:0,rv6:0,shimmer:0};
  Object.assign(values,defaults);
  PEDALS.forEach(p=>enabled[p.id]=["ns2","cs3","ge7"].includes(p.id));
  order=PEDALS.map(p=>p.id);
  $("masterVolume").value=55;$("ampGain").value=12;$("ampTone").value=58;
  snapshots={A:null,B:null};currentAB=null;$("toggleAB").disabled=true;
  syncAmpControls();renderPedals();rebuildChain();
  announce("pedalStatus","Efeitos e controles restaurados à configuração inicial.");
  announce("abState","Configuração reiniciada. Capture novas versões A e B para comparar.");
}
function snapshot(){
  return{values:{...values},enabled:{...enabled},order:[...order],gain:$("ampGain").value,tone:$("ampTone").value,master:$("masterVolume").value};
}
function applySnapshot(s){
  Object.assign(values,s.values);Object.assign(enabled,s.enabled);order=[...s.order];
  $("ampGain").value=s.gain;$("ampTone").value=s.tone;$("masterVolume").value=s.master;
  syncAmpControls();renderPedals();rebuildChain();
}
function captureAB(slot){
  snapshots[slot]=snapshot();announce("abState","Configuração "+slot+" salva. A e B são mantidas separadamente.");
  $("toggleAB").disabled=!(snapshots.A&&snapshots.B);currentAB=slot;
}
function toggleAB(){
  if(!snapshots.A||!snapshots.B)return;
  const target=currentAB==="A"?"B":"A";applySnapshot(snapshots[target]);currentAB=target;
  announce("abState","Alternando para a configuração "+target+".");
}
function syncAmpControls(){
  ["masterVolume","ampGain","ampTone"].forEach(id=>$(id+"Value").textContent=$(id).value+"%");
  if(master)master.gain.setTargetAtTime(Number($("masterVolume").value)/100,ctx.currentTime,.015);
  if(recordedPlaybackGain)recordedPlaybackGain.gain.setTargetAtTime(Number($("masterVolume").value)/100,ctx.currentTime,.015);
  currentAB=null;
}
function startRecording(withoutEffects=false){
  if(!inputNode||(!withoutEffects&&!recordDestination))return;
  if(!window.MediaRecorder){announce("recordStatus","Este navegador não oferece gravação de áudio.");return;}
  if(recordUrl&&!window.confirm("Começar uma nova gravação substituirá a gravação anterior. Continuar?"))return;
  if(recordUrl)URL.revokeObjectURL(recordUrl);
  $("recordedAudio").pause();recordingHasDry=false;recordingEffectsEnabled=false;updateRecordingEffectsButton();
  if(recordedMediaNode)rebuildRecordedPlaybackChain();
  recordUrl=null;$("recordedAudio").removeAttribute("src");$("recordedAudio").hidden=true;$("downloadRecording").removeAttribute("href");$("downloadRecording").hidden=true;$("recordTime").textContent="00:00";
  recordChunks=[];
  const destination=withoutEffects?ctx.createMediaStreamDestination():recordDestination;
  if(withoutEffects){rawRecordingSource=inputNode;rawRecordingDestination=destination;inputNode.connect(destination);}
  const releaseRawTap=()=>{
    if(rawRecordingSource&&rawRecordingDestination){try{rawRecordingSource.disconnect(rawRecordingDestination)}catch(e){}}
    rawRecordingSource=null;rawRecordingDestination=null;
  };
  const mime=["audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/webm"].find(t=>MediaRecorder.isTypeSupported(t));
  try{recorder=new MediaRecorder(destination.stream,mime?{mimeType:mime}:undefined);}catch(error){releaseRawTap();announce("recordStatus","Não foi possível iniciar a gravação.");return;}
  recorder.ondataavailable=e=>{if(e.data.size)recordChunks.push(e.data);};
  recorder.onerror=()=>announce("recordStatus","Houve um erro durante a gravação.");
  recorder.onstop=()=>{
    const blob=new Blob(recordChunks,{type:recorder.mimeType||"audio/webm"});recordUrl=URL.createObjectURL(blob);
    $("recordedAudio").src=recordUrl;$("recordedAudio").hidden=false;$("downloadRecording").href=recordUrl;
    $("downloadRecording").download="guitar-fx-lab-"+(withoutEffects?"sem-efeitos-":"")+new Date().toISOString().replace(/[:.]/g,"-")+".webm";$("downloadRecording").hidden=false;
    releaseRawTap();recordingHasDry=withoutEffects;recordingEffectsEnabled=false;
    ensureRecordedPlayback();rebuildRecordedPlaybackChain();
    recorder=null;updateRecordingEffectsButton();clearInterval(recordTicker);
    $("recordBtn").disabled=!inputNode;$("recordDryBtn").disabled=!inputNode;$("stopRecordBtn").disabled=true;
    announce("recordStatus",withoutEffects?"Gravação sem efeitos pronta. Use Efeitos para alternar a reprodução com e sem processamento.":"Gravação processada pronta para ouvir e baixar.");
  };
  recorder.start();recordStarted=Date.now();$("recordBtn").disabled=true;$("recordDryBtn").disabled=true;$("recordingEffectsBtn").disabled=true;$("stopRecordBtn").disabled=false;
  announce("recordStatus",withoutEffects?"Gravando saída sem efeitos (sinal direto da entrada)…":"Gravando saída processada…");
  clearInterval(recordTicker);recordTicker=setInterval(()=>{$("recordTime").textContent=formatTime((Date.now()-recordStarted)/1000);},250);
}
function formatTime(seconds){const s=Math.floor(seconds);return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");}
function stopRecording(){if(recorder&&recorder.state!=="inactive")recorder.stop();}
$("connectInput").addEventListener("click",connectGuitar);
$("disconnectInput").addEventListener("click",stopInput);
$("inputSelect").addEventListener("change",()=>{if(inputStream)connectGuitar();});
$("audioFile").addEventListener("change",e=>loadAudioFile(e.target.files?.[0]));
$("playFile").addEventListener("click",playFile);$("stopFile").addEventListener("click",stopFile);
$("audioSource").addEventListener("ended",()=>announce("inputStatus","Áudio processado concluído."));
$("masterVolume").addEventListener("input",syncAmpControls);
$("ampGain").addEventListener("input",()=>{syncAmpControls();rebuildChain();});
$("ampTone").addEventListener("input",()=>{syncAmpControls();rebuildChain();});
$("resetAmp").addEventListener("click",resetEffects);
document.querySelectorAll("[data-preset]").forEach(b=>b.addEventListener("click",()=>applyPreset(b.dataset.preset)));
$("captureA").addEventListener("click",()=>captureAB("A"));$("captureB").addEventListener("click",()=>captureAB("B"));$("toggleAB").addEventListener("click",toggleAB);
$("recordBtn").addEventListener("click",()=>startRecording(false));$("recordDryBtn").addEventListener("click",()=>startRecording(true));$("stopRecordBtn").addEventListener("click",stopRecording);$("recordingEffectsBtn").addEventListener("click",toggleRecordingEffects);
if(navigator.mediaDevices){refreshInputs();navigator.mediaDevices.addEventListener?.("devicechange",()=>refreshInputs(inputStream?.getAudioTracks()[0]?.getSettings().deviceId||""));}
renderPedals();syncAmpControls();

