"use strict";

const $ = id => document.getElementById(id);

const MAX_SECONDS = 300;            // duração máxima (gravação e importação)
const MAX_FILE_MB = 100;            // tamanho máximo do arquivo importado

const PRESETS = {
  normal:  {pitch:0,  drive:0,  chorus:0,  reverb:0},
  grave:   {pitch:-5, drive:10, chorus:0,  reverb:15},
  crianca: {pitch:7,  drive:0,  chorus:20, reverb:10},
  robo:    {pitch:-2, drive:55, chorus:70, reverb:25},
  rock:    {pitch:0,  drive:70, chorus:25, reverb:35}
};

let source = null;                  // {blob, name}
let sourceUrl = null, resultUrl = null;
let recorder = null;
let busy = false;
let liveStream = null;
let liveFx = null;
let previewFx = null;
let previewStarting = false;
let liveRunning = false;
let liveAnimation = 0;
let recordingAnimation = 0;
let recordingStartedAt = 0;
let recordingAudioContext = null;

const say = text => { $('status').textContent = text; };

/* ---------- Efeitos ---------- */

function readParams(){
  return {
    pitch:  +$('pitch').value,
    drive:  +$('drive').value / 100,
    chorus: +$('chorus').value / 100,
    reverb: +$('reverb').value / 100,
    volume: +$('vol').value / 100
  };
}

function updateLabels(){
  document.querySelectorAll('input[type=range]').forEach(r => {
    const v = +r.value;
    document.querySelector(`b[data-for="${r.id}"]`).textContent =
      r.id === 'pitch' ? (v > 0 ? '+' : '') + v : v + '%';
  });
}

function markPreset(key){
  document.querySelectorAll('#presets button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.p === key)));
}

document.querySelectorAll('input[type=range]').forEach(r =>
  r.addEventListener('input', () => { markPreset(null); updateLabels(); applyLiveParams(); applyPreviewParams(); }));

$('presets').addEventListener('click', e => {
  const preset = PRESETS[e.target.dataset.p];
  if(!preset) return;
  Object.entries(preset).forEach(([id, value]) => { $(id).value = value; });
  markPreset(e.target.dataset.p);
  updateLabels();
  applyLiveParams();
  applyPreviewParams();
});

/* ---------- Estado da interface ---------- */

function setBusy(on){
  busy = on;
  $('recordBtn').disabled = on;
  $('audioFile').disabled = on || !!recorder;
  $('processBtn').disabled = on || !source || !!recorder;
  $('effectPreviewBtn').disabled = on || !source || previewStarting;
}

function clearResult(){
  if(resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  ['resultAudio', 'resultHint', 'downloadResult'].forEach(id => { $(id).hidden = true; });
  $('resultAudio').removeAttribute('src');
  $('downloadResult').removeAttribute('href');
}

function setSource(blob, name){
  if(sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(blob);
  source = {blob, name};
  $('sourceAudio').src = sourceUrl;
  clearResult();
  setBusy(false);
  $('effectPreviewBtn').disabled = false;
  $('previewStatus').textContent = 'Áudio pronto. Clique em “Ouvir com efeitos” para testar os ajustes.';
  stopEffectPreview();
}

/* ---------- Gravar ou importar ---------- */

async function toggleRecording(){
  if(recorder){ recorder.stop(); return; }
  if(liveRunning){
    say('Desligue o microfone ao vivo antes de começar uma gravação.');
    return;
  }

  if(!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia){
    say('Seu navegador não suporta gravação. Use Chrome, Edge ou Firefox atualizado, por HTTPS.');
    return;
  }
  $('recordBtn').disabled = true;
  let mic;
  try {
    mic = await navigator.mediaDevices.getUserMedia({audio:true});
  } catch(e) {
    $('recordBtn').disabled = false;
    say('Não foi possível usar o microfone. Permita o acesso e tente novamente.');
    return;
  }

  const chunks = [];
  let analyser = null;
  try {
    recordingAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    const micSource = recordingAudioContext.createMediaStreamSource(mic);
    analyser = recordingAudioContext.createAnalyser();
    analyser.fftSize = 512;
    micSource.connect(analyser); // mede o microfone sem reproduzi-lo nos alto-falantes
  } catch(e) {
    recordingAudioContext = null;
  }
  const rec = new MediaRecorder(mic);
  const timer = setTimeout(() => { if(rec.state !== 'inactive') rec.stop(); }, MAX_SECONDS * 1000);

  rec.ondataavailable = e => { if(e.data.size) chunks.push(e.data); };
  rec.onerror = () => { if(rec.state !== 'inactive') rec.stop(); };
  rec.onstop = async () => {
    clearTimeout(timer);
    cancelAnimationFrame(recordingAnimation);
    recordingAnimation = 0;
    mic.getTracks().forEach(t => t.stop());
    if(recordingAudioContext){
      try { await recordingAudioContext.close(); } catch(e) {}
      recordingAudioContext = null;
    }
    $('recordMonitor').hidden = true;
    $('recordMeterFill').style.width = '0%';
    $('recordMeterLabel').textContent = 'Nível do microfone: 0%';
    $('recordTime').textContent = '00:00';
    document.querySelector('.record-meter').setAttribute('aria-valuenow', '0');
    recorder = null;
    $('recordBtn').textContent = 'Começar gravação';
    $('recordBtn').classList.remove('on');
    if(chunks.length){
      setSource(new Blob(chunks, {type: rec.mimeType || 'audio/webm'}), 'gravacao');
      say('Gravação pronta. Ouça a prévia, ajuste os efeitos e exporte.');
    } else {
      setBusy(false);
      say('Nenhum áudio foi gravado. Tente novamente.');
    }
  };

  recorder = rec;
  rec.start();
  recordingStartedAt = performance.now();
  $('recordMonitor').hidden = false;
  updateRecordingMonitor(analyser);
  $('recordBtn').textContent = 'Parar gravação';
  $('recordBtn').classList.add('on');
  setBusy(false);
  say('Gravando… o tempo e a intensidade do microfone são atualizados em tempo real.');
}

function updateRecordingMonitor(analyser){
  if(!recorder || recorder.state === 'inactive') return;
  const elapsed = Math.min((performance.now() - recordingStartedAt) / 1000, MAX_SECONDS);
  const seconds = Math.floor(elapsed);
  $('recordTime').textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  let percent = 0;
  if(analyser){
    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for(let i = 0; i < samples.length; i++){
      const value = (samples[i] - 128) / 128;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / samples.length);
    percent = Math.min(100, Math.round(rms * 280));
  }
  $('recordMeterFill').style.width = percent + '%';
  document.querySelector('.record-meter').setAttribute('aria-valuenow', String(percent));
  $('recordMeterLabel').textContent = 'Nível do microfone: ' + percent + '%';
  recordingAnimation = requestAnimationFrame(() => updateRecordingMonitor(analyser));
}

$('recordBtn').addEventListener('click', toggleRecording);

$('audioFile').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';              // permite escolher o mesmo arquivo de novo
  if(!file) return;
  if(file.size > MAX_FILE_MB * 1024 * 1024){
    say(`Arquivo muito grande. O limite é ${MAX_FILE_MB} MB.`);
    return;
  }
  setSource(file, file.name.replace(/\.[^.]+$/, '') || 'audio');
  say(`Arquivo carregado: ${file.name}`);
});


/* ---------- Monitoramento ao vivo ---------- */

async function startLive(){
  if(previewFx || previewStarting){
    $('liveStatus').textContent = 'Pare a prévia do áudio antes de ligar o microfone ao vivo.';
    return;
  }
  if(recorder){
    $('liveStatus').textContent = 'Pare a gravação antes de ligar o teste ao vivo.';
    return;
  }
  if(typeof Tone === 'undefined'){
    $('liveStatus').textContent = 'A biblioteca de áudio não carregou. Confira a conexão e recarregue a página.';
    return;
  }
  if(!navigator.mediaDevices?.getUserMedia){
    $('liveStatus').textContent = 'O navegador não liberou o microfone. Abra o site por HTTPS no Chrome ou Edge.';
    return;
  }
  $('liveBtn').disabled = true;
  try{
    await Tone.start();
    liveStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation:false, noiseSuppression:false, autoGainControl:false }
    });
    const ctx = Tone.getContext().rawContext;
    const src = ctx.createMediaStreamSource(liveStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser); // medição visual, sem enviar o som cru aos fones
    liveFx = {
      src,
      analyser,
      pitch: new Tone.PitchShift({pitch:0, windowSize:0.08, wet:0}),
      drive: new Tone.Distortion({distortion:0.2, wet:0}),
      chorus: new Tone.Chorus({frequency:1.8, delayTime:3.5, depth:0.7, wet:0}).start(),
      reverb: new Tone.Reverb({decay:2.5, wet:0}),
      volume: new Tone.Volume(0),
      limiter: new Tone.Limiter(-1)
    };
    await liveFx.reverb.generate();
    // Tone.connect conecta corretamente um AudioNode nativo ao efeito Tone.js.
    Tone.connect(src, liveFx.pitch);
    liveFx.pitch.chain(liveFx.drive, liveFx.chorus, liveFx.reverb, liveFx.volume, liveFx.limiter, Tone.getDestination());
    liveRunning = true;
    $('liveBtn').textContent = 'Desligar microfone';
    $('liveBtn').classList.add('on');
    $('liveStatus').textContent = 'Ao vivo! Fale e ajuste os efeitos abaixo.';
    applyLiveParams();
    updateLiveMeter();
  }catch(err){
    console.error('Erro ao iniciar o microfone:', err);
    stopLive();
    $('liveStatus').textContent = 'Não consegui iniciar o microfone. Veja o Console (F12) para identificar o erro.';
  }finally{
    $('liveBtn').disabled = false;
  }
}

function updateLiveMeter(){
  if(!liveRunning || !liveFx?.analyser) return;
  const analyser = liveFx.analyser;
  const samples = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(samples);
  let sum = 0;
  for(let i=0;i<samples.length;i++){
    const value = (samples[i] - 128) / 128;
    sum += value * value;
  }
  const rms = Math.sqrt(sum / samples.length);
  const percent = Math.max(0, Math.min(100, Math.round(rms * 300)));
  $('liveMeterFill').style.width = percent + '%';
  document.querySelector('.level-meter').setAttribute('aria-valuenow', percent);
  $('liveMeterLabel').textContent = 'Nível do microfone: ' + percent + '%';
  liveAnimation = requestAnimationFrame(updateLiveMeter);
}

function applyLiveParams(){
  if(!liveFx) return;
  const p = readParams();
  liveFx.pitch.pitch = p.pitch;
  liveFx.pitch.wet.value = p.pitch === 0 ? 0 : 1;
  liveFx.drive.distortion = 0.2 + p.drive * 0.8;
  liveFx.drive.wet.value = p.drive;
  liveFx.chorus.wet.value = p.chorus;
  liveFx.reverb.wet.value = p.reverb;
  liveFx.volume.volume.value = Tone.gainToDb(Math.max(p.volume, 0.0001));
}

function stopLive(){
  liveRunning = false;
  if(liveAnimation) cancelAnimationFrame(liveAnimation);
  liveAnimation = 0;
  if(liveStream){ liveStream.getTracks().forEach(track => track.stop()); liveStream = null; }
  if(liveFx){
    try{ liveFx.src.disconnect(); }catch(e){}
    try{ liveFx.analyser.disconnect(); }catch(e){}
    Object.values(liveFx).forEach(node => { if(node && typeof node.dispose === 'function') node.dispose(); });
    liveFx = null;
  }
  $('liveMeterFill').style.width = '0%';
  document.querySelector('.level-meter').setAttribute('aria-valuenow', '0');
  $('liveMeterLabel').textContent = 'Nível do microfone: 0%';
  $('liveBtn').textContent = 'Ligar microfone';
  $('liveBtn').classList.remove('on');
  $('liveStatus').textContent = 'Microfone desligado.';
}

$('liveBtn').addEventListener('click', () => liveRunning ? stopLive() : startLive());

/* ---------- Processamento ---------- */

async function decode(blob){
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    return await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    ctx.close();
  }
}

// Mesma cadeia que o resultado final usa: tom → drive → chorus → reverb → volume → limitador.
async function render(input, p){
  // cauda extra só quando há reverb; folga pequena para o atraso do pitch shift
  const tail = (p.reverb > 0 ? 2.5 : 0) + (p.pitch !== 0 ? 0.1 : 0);
  const channels = Math.min(input.numberOfChannels, 2);
  const buffer = new Tone.ToneAudioBuffer(input);

  const rendered = await Tone.Offline(async () => {
    const player = new Tone.Player(buffer);
    const pitch = new Tone.PitchShift({pitch:p.pitch, windowSize:0.08, wet:p.pitch === 0 ? 0 : 1});
    const drive = new Tone.Distortion({distortion:0.2 + p.drive * 0.8, wet:p.drive});
    const chorus = new Tone.Chorus({frequency:1.8, delayTime:3.5, depth:0.7, wet:p.chorus}).start();
    const reverb = new Tone.Reverb({decay:2.5, wet:p.reverb});
    const volume = new Tone.Volume(Tone.gainToDb(Math.max(p.volume, 0.0001)));
    const limiter = new Tone.Limiter(-1);
    await reverb.generate();
    player.chain(pitch, drive, chorus, reverb, volume, limiter, Tone.getDestination());
    player.start(0);
  }, input.duration + tail, channels, input.sampleRate);

  return rendered.get();
}

function toWav(buf){
  const ch = buf.numberOfChannels, n = buf.length, rate = buf.sampleRate;
  const pcm = new Int16Array(n * ch);
  for(let c = 0; c < ch; c++){
    const data = buf.getChannelData(c);
    for(let i = 0; i < n; i++){
      const s = Math.max(-1, Math.min(1, data[i]));
      pcm[i * ch + c] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }
  const head = new DataView(new ArrayBuffer(44));
  const text = (offset, str) => { for(let i = 0; i < str.length; i++) head.setUint8(offset + i, str.charCodeAt(i)); };
  text(0, 'RIFF'); head.setUint32(4, 36 + pcm.byteLength, true); text(8, 'WAVEfmt ');
  head.setUint32(16, 16, true); head.setUint16(20, 1, true); head.setUint16(22, ch, true);
  head.setUint32(24, rate, true); head.setUint32(28, rate * ch * 2, true);
  head.setUint16(32, ch * 2, true); head.setUint16(34, 16, true);
  text(36, 'data'); head.setUint32(40, pcm.byteLength, true);
  return new Blob([head, pcm], {type:'audio/wav'});
}

async function process(){
  if(busy || recorder || !source) return;
  if(typeof Tone === 'undefined'){
    say('A biblioteca de áudio não carregou. Verifique a conexão e recarregue a página.');
    return;
  }
  setBusy(true);
  clearResult();
  $('exportLoader').hidden = false;
  $('exportLoaderText').textContent = 'PROCESSANDO ÁUDIO...';
  say('Processando áudio no navegador…');
  try {
    const input = await decode(source.blob);
    if(input.duration > MAX_SECONDS){
      say(`O áudio tem mais de ${MAX_SECONDS / 60} minutos. Use um trecho menor.`);
      return;
    }
    const wav = toWav(await render(input, readParams()));
    resultUrl = URL.createObjectURL(wav);
    $('resultAudio').src = resultUrl;
    $('downloadResult').href = resultUrl;
    $('downloadResult').download = `${source.name}-modificado.wav`;
    ['resultAudio', 'resultHint', 'downloadResult'].forEach(id => { $(id).hidden = false; });
    say('Pronto! Ouça o resultado e baixe o arquivo.');
  } catch(e) {
    console.error(e);
    say('Não consegui processar esse arquivo. Tente outro formato comum, como WAV, MP3 ou M4A.');
  } finally {
    $('exportLoader').hidden = true;
    setBusy(false);
  }
}

/* ---------- Prévia processada em tempo real ---------- */

function disposePreview(){
  if(!previewFx) return;
  try { previewFx.player.stop(); } catch(e) {}
  Object.values(previewFx).forEach(node => {
    if(node && typeof node.dispose === 'function') { try { node.dispose(); } catch(e) {} }
  });
  previewFx = null;
  $('stopPreviewBtn').disabled = true;
  $('effectPreviewBtn').textContent = 'Ouvir com efeitos';
}

function stopEffectPreview(){
  disposePreview();
  if(source) $('effectPreviewBtn').disabled = false;
  $('previewStatus').textContent = source ? 'Prévia parada.' : 'Grave ou importe um áudio para habilitar a prévia com efeitos.';
}

async function startEffectPreview(){
  if(!source || previewStarting || busy) return;
  if(liveRunning || recorder){
    $('previewStatus').textContent = 'Desligue o microfone ao vivo e pare a gravação antes da prévia.';
    return;
  }
  if(typeof Tone === 'undefined'){
    $('previewStatus').textContent = 'A biblioteca de áudio não carregou. Recarregue a página e tente novamente.';
    return;
  }
  previewStarting = true;
  $('effectPreviewBtn').disabled = true;
  $('previewStatus').textContent = 'Preparando prévia com efeitos…';
  try{
    await Tone.start();
    const decoded = await decode(source.blob);
    const buffer = new Tone.ToneAudioBuffer(decoded);
    const p = readParams();
    const player = new Tone.Player(buffer);
    const pitch = new Tone.PitchShift({pitch:p.pitch, windowSize:0.08, wet:p.pitch === 0 ? 0 : 1});
    const drive = new Tone.Distortion({distortion:0.2 + p.drive * 0.8, wet:p.drive});
    const chorus = new Tone.Chorus({frequency:1.8, delayTime:3.5, depth:0.7, wet:p.chorus}).start();
    const reverb = new Tone.Reverb({decay:2.5, wet:p.reverb});
    const volume = new Tone.Volume(Tone.gainToDb(Math.max(p.volume, 0.0001)));
    const limiter = new Tone.Limiter(-1);
    await reverb.generate();
    player.chain(pitch, drive, chorus, reverb, volume, limiter, Tone.getDestination());
    previewFx = {player, pitch, drive, chorus, reverb, volume, limiter};
    player.onstop = () => {
      if(previewFx?.player === player){
        disposePreview();
        $('previewStatus').textContent = 'Prévia finalizada.';
        $('effectPreviewBtn').disabled = !source;
      }
    };
    player.start();
    $('stopPreviewBtn').disabled = false;
    $('effectPreviewBtn').textContent = 'Reiniciar prévia';
    $('previewStatus').textContent = 'Reproduzindo com efeitos. Ajuste os controles para ouvir as mudanças.';
  }catch(e){
    console.error('Erro na prévia com efeitos:', e);
    disposePreview();
    $('previewStatus').textContent = 'Não foi possível iniciar a prévia. Tente outro arquivo de áudio.';
  }finally{
    previewStarting = false;
    $('effectPreviewBtn').disabled = !source || busy;
  }
}

function applyPreviewParams(){
  if(!previewFx) return;
  const p = readParams();
  previewFx.pitch.pitch = p.pitch;
  previewFx.pitch.wet.value = p.pitch === 0 ? 0 : 1;
  previewFx.drive.distortion = 0.2 + p.drive * 0.8;
  previewFx.drive.wet.value = p.drive;
  previewFx.chorus.wet.value = p.chorus;
  previewFx.reverb.wet.value = p.reverb;
  previewFx.volume.volume.value = Tone.gainToDb(Math.max(p.volume, 0.0001));
}

$('effectPreviewBtn').addEventListener('click', () => {
  if(previewFx) stopEffectPreview();
  else startEffectPreview();
});
$('stopPreviewBtn').addEventListener('click', stopEffectPreview);
$('processBtn').addEventListener('click', process);
window.addEventListener('pagehide', () => { stopLive(); stopEffectPreview(); });

updateLabels();
