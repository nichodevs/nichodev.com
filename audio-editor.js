(() => {
  const $ = id => document.getElementById(id);
  const canvas = $("waveform");
  const ctx = canvas.getContext("2d");
  const player = $("player");
  let originalBuffer = null;
  let workingBuffer = null;
  let objectUrl = null;
  let currentName = "audio";
  let dragStart = null;
  let playStopTimer = null;

  function fmt(t) { return Number(t || 0).toFixed(2); }
  function setStatus(message) { $("exportStatus").textContent = message; }
  function updateSelectionLabel() {
    $("selectionLabel").textContent = `Seleção: ${fmt(+$("selectionStart").value)}s – ${fmt(+$("selectionEnd").value)}s`;
  }
  function enableControls(yes) {
    ["playSelection","playAll","trimSelection","removeSilence","applyVolume","exportWav","resetAudio"].forEach(id => $(id).disabled = !yes);
  }
  function clampSelection() {
    if (!workingBuffer) return;
    const duration = workingBuffer.duration;
    let start = Math.max(0, Math.min(duration, Number($("selectionStart").value) || 0));
    let end = Math.max(0, Math.min(duration, Number($("selectionEnd").value) || 0));
    if (end < start) [start,end] = [end,start];
    $("selectionStart").value = fmt(start);
    $("selectionEnd").value = fmt(end);
    updateSelectionLabel();
    drawWaveform();
  }
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    drawWaveform();
  }
  function drawWaveform() {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    ctx.clearRect(0,0,w,h);
    if (!workingBuffer || !w || !h) return;
    const start = Number($("selectionStart").value) || 0;
    const end = Number($("selectionEnd").value) || workingBuffer.duration;
    const duration = workingBuffer.duration;
    const x1 = Math.max(0,Math.min(w,start/duration*w));
    const x2 = Math.max(0,Math.min(w,end/duration*w));
    ctx.fillStyle = getComputedStyle(document.body).color;
    ctx.globalAlpha = .08; ctx.fillRect(0,0,w,h); ctx.globalAlpha = 1;
    ctx.strokeStyle = getComputedStyle(document.body).color;
    ctx.globalAlpha = .15; ctx.beginPath(); ctx.moveTo(0,h/2); ctx.lineTo(w,h/2); ctx.stroke(); ctx.globalAlpha = 1;
    // Selected region highlight.
    ctx.fillStyle = getComputedStyle(document.body).color;
    ctx.globalAlpha = .12; ctx.fillRect(x1,0,Math.max(0,x2-x1),h); ctx.globalAlpha = 1;
    const channel = workingBuffer.getChannelData(0);
    const samplesPerPixel = Math.max(1, Math.floor(channel.length / w));
    ctx.strokeStyle = getComputedStyle(document.body).color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x=0; x<w; x++) {
      const from = x*samplesPerPixel;
      const to = Math.min(channel.length, from+samplesPerPixel);
      let min=1, max=-1;
      for (let i=from; i<to; i++) { const v=channel[i]; if(v<min)min=v; if(v>max)max=v; }
      ctx.moveTo(x, (1+min)*h/2);
      ctx.lineTo(x, (1+max)*h/2);
    }
    ctx.stroke();
    ctx.setLineDash([4,4]); ctx.globalAlpha=.75;
    ctx.beginPath(); ctx.moveTo(x1,0); ctx.lineTo(x1,h); ctx.moveTo(x2,0); ctx.lineTo(x2,h); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=1;
  }
  async function decodeFile(file) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ac = new AudioContextClass();
    try {
      const bytes = await file.arrayBuffer();
      return await ac.decodeAudioData(bytes.slice(0));
    } finally { await ac.close(); }
  }
  function loadBuffer(buffer, name) {
    workingBuffer = buffer;
    currentName = name.replace(/\.[^.]+$/, "") || "audio";
    $("selectionStart").value = "0";
    $("selectionEnd").value = fmt(buffer.duration);
    $("fileInfo").textContent = `${name} · ${buffer.numberOfChannels} canal(is) · ${buffer.sampleRate} Hz · ${buffer.duration.toFixed(2)} s`;
    $("waveEmpty").hidden = true;
    enableControls(true);
    $("downloadLink").hidden = true;
    updateSelectionLabel();
    drawWaveform();
    setStatus("Áudio carregado. Selecione um trecho na forma de onda ou use os controles.");
    updatePlayer();
  }
  function updatePlayer() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const wav = encodeWav(workingBuffer);
    objectUrl = URL.createObjectURL(wav);
    player.src = objectUrl;
  }
  function encodeWav(buffer) {
    const channels = buffer.numberOfChannels, sampleRate = buffer.sampleRate;
    const frames = buffer.length, bytesPerSample = 2;
    const out = new ArrayBuffer(44 + frames*channels*bytesPerSample);
    const view = new DataView(out);
    const writeString = (offset, s) => { for(let i=0;i<s.length;i++) view.setUint8(offset+i,s.charCodeAt(i)); };
    writeString(0,"RIFF"); view.setUint32(4,36+frames*channels*bytesPerSample,true);
    writeString(8,"WAVE"); writeString(12,"fmt "); view.setUint32(16,16,true);
    view.setUint16(20,1,true); view.setUint16(22,channels,true);
    view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*channels*bytesPerSample,true);
    view.setUint16(32,channels*bytesPerSample,true); view.setUint16(34,16,true);
    writeString(36,"data"); view.setUint32(40,frames*channels*bytesPerSample,true);
    let offset=44;
    const data = Array.from({length:channels},(_,c)=>buffer.getChannelData(c));
    for(let i=0;i<frames;i++) for(let c=0;c<channels;c++) {
      const s = Math.max(-1,Math.min(1,data[c][i]));
      view.setInt16(offset, s<0?s*0x8000:s*0x7fff, true); offset+=2;
    }
    return new Blob([out],{type:"audio/wav"});
  }
  function createBufferFromRanges(ranges) {
    const sr=workingBuffer.sampleRate, ch=workingBuffer.numberOfChannels;
    const totalFrames=ranges.reduce((sum,r)=>sum+Math.max(0,Math.floor((r.end-r.start)*sr)),0);
    if (!totalFrames) throw new Error("A seleção resultou em áudio vazio.");
    const out = new AudioContext().createBuffer(ch,totalFrames,sr);
    let cursor=0;
    for(const range of ranges) {
      const from=Math.max(0,Math.floor(range.start*sr)), to=Math.min(workingBuffer.length,Math.floor(range.end*sr));
      const length=Math.max(0,to-from);
      for(let c=0;c<ch;c++) out.getChannelData(c).set(workingBuffer.getChannelData(c).subarray(from,to),cursor);
      cursor+=length;
    }
    return out;
  }
  function stopAfter(duration) {
    clearTimeout(playStopTimer);
    playStopTimer=setTimeout(()=>{player.pause();},Math.max(0,duration)*1000);
  }
  function playSelection() {
    if(!workingBuffer)return;
    const start=+$("selectionStart").value,end=+$("selectionEnd").value;
    if(end-start<=.01){setStatus("Selecione um trecho maior que 0,01 s.");return;}
    player.currentTime=start; player.play().then(()=>stopAfter(end-start)).catch(()=>setStatus("Não foi possível reproduzir. Pressione play no player."));
  }
  function pointerTime(event) {
    const rect=canvas.getBoundingClientRect();
    return Math.max(0,Math.min(workingBuffer.duration,(event.clientX-rect.left)/rect.width*workingBuffer.duration));
  }
  canvas.addEventListener("pointerdown",e=>{
    if(!workingBuffer)return;
    dragStart=pointerTime(e); canvas.setPointerCapture(e.pointerId);
    $("selectionStart").value=fmt(dragStart); $("selectionEnd").value=fmt(dragStart);
    updateSelectionLabel(); drawWaveform();
  });
  canvas.addEventListener("pointermove",e=>{
    if(dragStart===null||!workingBuffer)return;
    const t=pointerTime(e); $("selectionStart").value=fmt(Math.min(dragStart,t)); $("selectionEnd").value=fmt(Math.max(dragStart,t));
    updateSelectionLabel(); drawWaveform();
  });
  function endDrag(){dragStart=null;}
  canvas.addEventListener("pointerup",endDrag); canvas.addEventListener("pointercancel",endDrag);
  $("selectionStart").addEventListener("change",clampSelection);
  $("selectionEnd").addEventListener("change",clampSelection);
  $("audioFile").addEventListener("change",async e=>{
    const file=e.target.files?.[0]; if(!file)return;
    setStatus("Decodificando áudio…");
    try { const buffer=await decodeFile(file); originalBuffer=buffer; loadBuffer(buffer,file.name); }
    catch(err){setStatus("Não consegui abrir esse arquivo. Tente WAV, MP3, OGG ou outro formato compatível com o navegador.");}
  });
  $("playSelection").addEventListener("click",playSelection);
  $("playAll").addEventListener("click",()=>{clearTimeout(playStopTimer);player.currentTime=0;player.play().catch(()=>{});});
  $("trimSelection").addEventListener("click",()=>{
    try {
      const s=+$("selectionStart").value,e=+$("selectionEnd").value;
      if(e-s<=.01){setStatus("Selecione um trecho maior que 0,01 s.");return;}
      workingBuffer=createBufferFromRanges([{start:s,end:e}]);
      loadBuffer(workingBuffer,currentName+"-trecho");
      setStatus("Áudio cortado para o trecho selecionado.");
    } catch(err){setStatus(err.message||"Não foi possível cortar a seleção.");}
  });
  $("volume").addEventListener("input",()=>{$("volumeValue").textContent=$("volume").value+"%";});
  $("applyVolume").addEventListener("click",()=>{
    const gain=+$("volume").value/100;
    const out=new AudioContext().createBuffer(workingBuffer.numberOfChannels,workingBuffer.length,workingBuffer.sampleRate);
    for(let c=0;c<workingBuffer.numberOfChannels;c++){
      const src=workingBuffer.getChannelData(c),dst=out.getChannelData(c);
      for(let i=0;i<src.length;i++)dst[i]=Math.max(-1,Math.min(1,src[i]*gain));
    }
    workingBuffer=out;loadBuffer(out,currentName+"-volume");setStatus("Volume aplicado ao áudio.");
  });
  $("silenceThreshold").addEventListener("input",()=>{$("thresholdValue").textContent=$("silenceThreshold").value+" dB";});
  $("silenceHold").addEventListener("input",()=>{$("holdValue").textContent=(+$("silenceHold").value/100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+" s";});
  $("removeSilence").addEventListener("click",()=>{
    try {
      const threshold=Math.pow(10,+$("silenceThreshold").value/20);
      const hold=+$("silenceHold").value/100;
      const sr=workingBuffer.sampleRate, data=workingBuffer.getChannelData(0);
      const windowSize=Math.max(1,Math.floor(sr*.01)), minSilentFrames=Math.floor(hold*sr);
      const keep=[], margin=Math.floor(sr*.08);
      let speechStart=null, silenceStart=null;
      for(let i=0;i<data.length;i+=windowSize){
        const end=Math.min(data.length,i+windowSize);let sum=0;
        for(let j=i;j<end;j++)sum+=data[j]*data[j];
        const rms=Math.sqrt(sum/(end-i));
        if(rms>=threshold){
          if(speechStart===null)speechStart=Math.max(0,i-margin);
          silenceStart=null;
        } else if(speechStart!==null){
          if(silenceStart===null)silenceStart=i;
          if(i-silenceStart>=minSilentFrames){
            keep.push({start:speechStart/sr,end:Math.min(data.length,silenceStart+margin)/sr});
            speechStart=null;silenceStart=null;
          }
        }
      }
      if(speechStart!==null)keep.push({start:speechStart/sr,end:data.length/sr});
      if(!keep.length){setStatus("Nenhuma fala detectada. Tente um limite menos rigoroso, por exemplo -50 dB.");return;}
      workingBuffer=createBufferFromRanges(keep);
      loadBuffer(workingBuffer,currentName+"-sem-silencios");
      setStatus(`Silêncios removidos. ${keep.length} trecho(s) de áudio mantido(s). Revise antes de exportar.`);
    } catch(err){setStatus(err.message||"Não foi possível remover os silêncios.");}
  });
  $("exportWav").addEventListener("click",()=>{
    try {
      const blob=encodeWav(workingBuffer),url=URL.createObjectURL(blob);
      $("downloadLink").href=url;$("downloadLink").download=currentName+".wav";$("downloadLink").textContent="Baixar "+currentName+".wav";$("downloadLink").hidden=false;
      setStatus("WAV pronto para baixar.");
    } catch(err){setStatus("Falha ao exportar WAV.");}
  });
  $("resetAudio").addEventListener("click",()=>{if(originalBuffer)loadBuffer(originalBuffer,currentName+"-original");});
  window.addEventListener("resize",resizeCanvas);
  $("waveEmpty").hidden=false; enableControls(false); resizeCanvas();
})();
