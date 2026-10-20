"use strict";

const $ = id => document.getElementById(id);

const MAX_SECONDS = 300;            // duração máxima (gravação e importação)
const MAX_FILE_MB = 100;            // tamanho máximo do arquivo importado

const DEFAULTS = {
  pitch:0, formant:0, bass:0, mid:0, treble:0, drive:0, chorus:0, reverb:0,
  tremolo:0, phaser:0, delay:0, octave:0, distortion:0, wah:0,
  fuzz:0, octafuzz:0, vibrato:0, vol:100
};
const EFFECT_CONTROL_GROUPS = {
  pitch:["pitch"], formant:["formant"], eq:["bass","mid","treble"],
  drive:["drive"], chorus:["chorus"], reverb:["reverb"], tremolo:["tremolo"],
  phaser:["phaser"], delay:["delay"], octave:["octave"], distortion:["distortion"],
  wah:["wah"], fuzz:["fuzz"], octafuzz:["octafuzz"], vibrato:["vibrato"], volume:["vol"]
};
const effectEnabled = Object.fromEntries(Object.keys(EFFECT_CONTROL_GROUPS).map(id => [id, true]));

const PRESETS = {
  normal:  {...DEFAULTS},
  grave:   {...DEFAULTS, pitch:-5, bass:3, treble:-2, drive:10, reverb:15},
  crianca: {...DEFAULTS, pitch:7, chorus:20, reverb:10},
  robo:    {...DEFAULTS, pitch:-2, drive:55, chorus:70, reverb:25, phaser:25},
  rock:     {...DEFAULTS, drive:45, distortion:55, fuzz:25, chorus:25, reverb:35},
  radio:    {...DEFAULTS, bass:-5, mid:3, treble:-5, drive:12, distortion:8, reverb:4},
  telefone: {...DEFAULTS, bass:-9, mid:5, treble:-8, drive:8, distortion:5},
  catedral: {...DEFAULTS, bass:1, mid:0, treble:2, chorus:8, reverb:82, delay:8},
  espacial: {...DEFAULTS, pitch:2, chorus:42, reverb:48, delay:28, phaser:22, vibrato:8},
  eco:      {...DEFAULTS, delay:48, reverb:24, chorus:8},
  monstro:  {...DEFAULTS, pitch:-7, octave:-1, bass:5, mid:1, treble:-4, drive:38, distortion:28, fuzz:18, reverb:12}
};

let source = null;                  // {blob, name}
let sourceUrl = null, resultUrl = null;
let recorder = null;
let processedRecorder = null;
let processedDestination = null;
let processedChunks = [];
let processedRecordTimer = 0;
let processedRecordTicker = 0;
let processedRecordStartedAt = 0;
let busy = false;
let liveStream = null;
let liveFx = null;
let liveMicName = '';
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
  const p = {};
  Object.keys(DEFAULTS).forEach(id => p[id] = +$(id).value);
  for(const id of ['drive','chorus','reverb','tremolo','phaser','delay','distortion','wah','fuzz','octafuzz','vibrato']) p[id] /= 100;
  for(const [effect, ids] of Object.entries(EFFECT_CONTROL_GROUPS)){
    if(!effectEnabled[effect]) ids.forEach(id => { p[id] = id === 'vol' ? 100 : 0; });
  }
  p.volume = p.vol / 100;
  return p;
}

function currentEffectStates(){ return {...effectEnabled}; }
function updateEffectToggleButtons(){
  document.querySelectorAll('[data-effect-toggle]').forEach(button => {
    const effect = button.dataset.effectToggle;
    const enabled = effectEnabled[effect] !== false;
    const label = button.getAttribute('aria-label').replace(/^Efeito (.*): (?:ligado|desligado)$/, '$1');
    button.setAttribute('aria-checked', String(enabled));
    button.setAttribute('aria-label', 'Efeito ' + label + ': ' + (enabled ? 'ligado' : 'desligado'));
    button.classList.toggle('is-off', !enabled);
    const state = button.querySelector('.effect-switch-state');
    if(state) state.textContent = enabled ? 'ON' : 'OFF';
  });
}
function applyEffectStates(states){
  Object.keys(EFFECT_CONTROL_GROUPS).forEach(effect => { effectEnabled[effect] = !states || states[effect] !== false; });
  updateEffectToggleButtons();
}
function setAllEffectsEnabled(enabled){
  Object.keys(effectEnabled).forEach(effect => { effectEnabled[effect] = enabled; });
  updateEffectToggleButtons();
}

function updateLabels(){
  document.querySelectorAll('input[type=range]').forEach(r => {
    const v = +r.value;
    const signed = ['pitch','bass','mid','treble'].includes(r.id);
    let label = signed ? ((v > 0 ? '+' : '') + v + (['bass','mid','treble'].includes(r.id) ? ' dB' : '')) : v + '%';
    if(r.id === 'octave') label = v === 0 ? 'Desligado' : (v > 0 ? '+1 oitava' : '-1 oitava');
    if(r.id === 'formant') label = v === 0 ? 'Neutro' : (v > 0 ? '+' + v + ' (brilhante)' : v + ' (escuro)');
    document.querySelector(`b[data-for="${r.id}"]`).textContent = label;
  });
}

function markPreset(key){
  document.querySelectorAll('#presets button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.p === key)));
}

document.querySelectorAll('input[type=range]').forEach(r =>
  r.addEventListener('input', () => { markPreset(null); currentAB = null; updateLabels(); applyLiveParams(); applyPreviewParams(); updateFxLabUI(); }));

// Sorteia os controles dos dois painéis, liga os efeitos e atualiza todas as saídas.
function randomizeEffects(){
  const controls = [...document.querySelectorAll('.advanced-control input[type="range"]')];
  if(!controls.length) return;

  controls.forEach(control => {
    const min = Number(control.min);
    const max = Number(control.max);
    const step = Number(control.step) || 1;
    const stepCount = Math.floor((max - min) / step) + 1;
    control.value = String(min + Math.floor(Math.random() * stepCount) * step);
  });

  setAllEffectsEnabled(true);
  markPreset(null);
  currentAB = null;
  updateLabels();
  applyLiveParams();
  applyPreviewParams();
  updateFxLabUI();
  say('Configuração aleatória aplicada. Todos os efeitos foram ligados.');
}

document.querySelectorAll('.random-effects-btn').forEach(button =>
  button.addEventListener('click', randomizeEffects));

function resetVoiceStudio(){
  Object.entries(DEFAULTS).forEach(([id, value]) => { $(id).value = value; });
  setAllEffectsEnabled(true);
  markPreset('normal');
  currentAB = null;
  updateLabels();
  applyLiveParams();
  applyPreviewParams();
  updateFxLabUI();
  $('abStatus').textContent = 'Controles restaurados à configuração inicial. Presets salvos e gravações foram mantidos.';
  say('Controles e efeitos restaurados à configuração inicial.');
}

$('resetVoiceBtn').addEventListener('click', resetVoiceStudio);

document.querySelectorAll('[data-effect-toggle]').forEach(button =>
  button.addEventListener('click', () => {
    const effect = button.dataset.effectToggle;
    effectEnabled[effect] = !effectEnabled[effect];
    markPreset(null);
    currentAB = null;
    updateEffectToggleButtons();
    applyLiveParams();
    applyPreviewParams();
    updateFxLabUI();
  }));

$('presets').addEventListener('click', e => {
  const preset = PRESETS[e.target.dataset.p];
  if(!preset) return;
  setAllEffectsEnabled(true);
  currentAB = null;
  Object.entries(preset).forEach(([id, value]) => { if($(id)) $(id).value = value; });
  markPreset(e.target.dataset.p);
  updateLabels();
  applyLiveParams();
  applyPreviewParams();
  updateFxLabUI();
});

/* ---------- Presets personalizados: armazenamento local ---------- */
const CUSTOM_PRESETS_KEY = 'nichodev.customVoicePresets.v1';

function readCustomPresets(){
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) || '[]');
    if(!Array.isArray(parsed)) return [];
    return parsed.filter(item =>
      item && typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      item.values && typeof item.values === 'object'
    );
  } catch(e) {
    return [];
  }
}

function writeCustomPresets(items){
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(items));
    return true;
  } catch(e) {
    $('customPresetStatus').textContent = 'Não foi possível salvar. O armazenamento do navegador pode estar indisponível.';
    return false;
  }
}

function currentRawParams(){
  const values = {};
  Object.keys(DEFAULTS).forEach(id => { values[id] = Number($(id).value); });
  return values;
}

function applyRawParams(values, states){
  Object.keys(DEFAULTS).forEach(id => {
    if(Object.prototype.hasOwnProperty.call(values, id) && Number.isFinite(Number(values[id]))){
      $(id).value = String(values[id]);
    }
  });
  applyEffectStates(states);
  markPreset(null);
  updateLabels();
  applyLiveParams();
  applyPreviewParams();
  currentAB = null;
  updateFxLabUI();
}

function renderCustomPresets(){
  const list = $('customPresetList');
  const items = readCustomPresets();
  list.replaceChildren();
  $('customPresetStatus').textContent = items.length
    ? `${items.length} preset(s) salvo(s) neste navegador.`
    : 'Nenhum preset personalizado salvo ainda.';
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'custom-preset-item';
    const name = document.createElement('span');
    name.className = 'custom-preset-name';
    name.textContent = item.name;
    row.append(name);
    [
      ['load','Carregar',`Carregar preset ${item.name}`],
      ['rename','Renomear',`Renomear preset ${item.name}`],
      ['duplicate','Duplicar',`Duplicar preset ${item.name}`],
      ['delete','Excluir',`Excluir preset ${item.name}`]
    ].forEach(([action,label,aria]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.customAction = action;
      button.dataset.customId = item.id;
      button.setAttribute('aria-label', aria);
      row.append(button);
    });
    list.append(row);
  });
}

function makePresetId(){
  return (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function updateCustomPresetStatus(message, isError = false){
  const status = $('customPresetStatus');
  status.textContent = message;
  status.dataset.state = isError ? 'error' : 'success';
}

$('savePresetBtn').addEventListener('click', () => {
  const nameInput = $('customPresetName');
  const name = nameInput.value.trim();
  if(!name){
    updateCustomPresetStatus('Digite um nome para salvar seu preset.', true);
    nameInput.focus();
    return;
  }
  const items = readCustomPresets();
  if(items.length >= 30){
    updateCustomPresetStatus('Limite de 30 presets atingido. Exclua ou exporte algum antes de salvar outro.', true);
    return;
  }
  const item = {id:makePresetId(), name:name.slice(0,32), values:currentRawParams(), enabled:currentEffectStates()};
  items.push(item);
  if(writeCustomPresets(items)){
    nameInput.value = '';
    renderCustomPresets();
    updateCustomPresetStatus(`Preset "${item.name}" salvo neste navegador.`);
  }
});

$('customPresetList').addEventListener('click', e => {
  const button = e.target.closest('button[data-custom-action]');
  if(!button) return;
  const items = readCustomPresets();
  const index = items.findIndex(entry => entry.id === button.dataset.customId);
  if(index < 0) return;
  const item = items[index];
  const action = button.dataset.customAction;

  if(action === 'load'){
    applyRawParams(item.values, item.enabled);
    updateCustomPresetStatus(`Preset "${item.name}" carregado.`);
  } else if(action === 'rename'){
    const proposed = window.prompt('Digite o novo nome do preset:', item.name);
    if(proposed === null) return;
    const name = proposed.trim().slice(0,32);
    if(!name){ updateCustomPresetStatus('O nome não pode ficar vazio.', true); return; }
    items[index] = {...item, name};
    if(writeCustomPresets(items)){ renderCustomPresets(); updateCustomPresetStatus(`Preset renomeado para "${name}".`); }
  } else if(action === 'duplicate'){
    if(items.length >= 30){ updateCustomPresetStatus('Limite de 30 presets atingido. Exclua ou exporte algum antes de duplicar.', true); return; }
    const copyName = item.name.slice(0,25) + ' (cópia)';
    items.splice(index + 1, 0, {...item, id:makePresetId(), name:copyName, values:{...item.values}, enabled:{...(item.enabled || {})}});
    if(writeCustomPresets(items)){ renderCustomPresets(); updateCustomPresetStatus(`Cópia de "${item.name}" criada.`); }
  } else if(action === 'delete'){
    if(!window.confirm(`Excluir o preset "${item.name}"? Essa ação não pode ser desfeita.`)) return;
    items.splice(index,1);
    if(writeCustomPresets(items)){ renderCustomPresets(); updateCustomPresetStatus(`Preset "${item.name}" excluído.`); }
  }
});

$('exportCustomPresetsBtn').addEventListener('click', () => {
  const items = readCustomPresets();
  if(!items.length){ updateCustomPresetStatus('Não há presets personalizados para exportar.', true); return; }
  const payload = {app:'NICHODEVS FX LAB', version:1, exportedAt:new Date().toISOString(), presets:items};
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)], {type:'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nichodev-fx-presets.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  updateCustomPresetStatus(`${items.length} preset(s) exportado(s) para um arquivo JSON.`);
});

$('importCustomPresetsBtn').addEventListener('click', () => $('importCustomPresetsFile').click());
$('importCustomPresetsFile').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if(!file) return;
  if(file.size > 1024 * 1024){
    updateCustomPresetStatus('O arquivo de presets ultrapassa o limite de 1 MB.', true);
    return;
  }
  try {
    const parsed = JSON.parse(await file.text());
    const imported = Array.isArray(parsed) ? parsed : parsed && parsed.presets;
    if(!Array.isArray(imported)) throw new Error('Formato JSON inválido.');
    const current = readCustomPresets();
    const slots = Math.max(0, 30 - current.length);
    const normalized = imported.map(item => {
      if(!item || typeof item.name !== 'string' || !item.values || typeof item.values !== 'object') return null;
      const values = {...DEFAULTS};
      Object.keys(DEFAULTS).forEach(id => {
        if(Object.prototype.hasOwnProperty.call(item.values,id) && Number.isFinite(Number(item.values[id]))){
          const input = $(id), min = Number(input.min), max = Number(input.max);
          values[id] = Math.min(max,Math.max(min,Number(item.values[id])));
        }
      });
      const enabled = {};
      Object.keys(EFFECT_CONTROL_GROUPS).forEach(key => { enabled[key] = !item.enabled || item.enabled[key] !== false; });
      const name = item.name.trim().slice(0,32);
      return name ? {id:makePresetId(),name,values,enabled} : null;
    }).filter(Boolean);
    const accepted = normalized.slice(0,slots);
    if(!accepted.length){
      updateCustomPresetStatus(imported.length ? 'Nenhum preset válido foi importado ou o limite de 30 foi atingido.' : 'O arquivo não contém presets.', true);
      return;
    }
    const merged = [...current,...accepted];
    if(writeCustomPresets(merged)){
      renderCustomPresets();
      const skipped = normalized.length - accepted.length;
      updateCustomPresetStatus(`${accepted.length} preset(s) importado(s).${skipped ? ' ${skipped} não couberam no limite de 30.' : ''}`);
    }
  } catch(err) {
    updateCustomPresetStatus('Arquivo inválido. Selecione um JSON exportado pelo FX LAB.', true);
  }
});

renderCustomPresets();
/* ---------- Cadeia compartilhada de efeitos ---------- */
async function createEffectChain(p){
  const fx = {
    pitch: new Tone.PitchShift({pitch:p.pitch, windowSize:0.08, wet:p.pitch === 0 ? 0 : 1}),
    octave: new Tone.PitchShift({pitch:p.octave * 12, windowSize:0.08, wet:p.octave === 0 ? 0 : 1}),
    formant1: new Tone.Filter({frequency:500, type:"peaking", Q:1.2, gain:0}),
    formant2: new Tone.Filter({frequency:1500, type:"peaking", Q:1.2, gain:0}),
    formant3: new Tone.Filter({frequency:2600, type:"peaking", Q:1.2, gain:0}),
    eq: new Tone.EQ3({low:p.bass, mid:p.mid, high:p.treble}),
    drive: new Tone.Distortion({distortion:0.2 + p.drive * 0.8, wet:p.drive}),
    distortion: new Tone.Distortion({distortion:0.95, wet:p.distortion}),
    fuzz: new Tone.Distortion({distortion:0.98, wet:p.fuzz}),
    octafuzzPitch: new Tone.PitchShift({pitch:12, windowSize:0.08, wet:p.octafuzz}),
    octafuzz: new Tone.Distortion({distortion:0.98, wet:p.octafuzz}),
    wah: new Tone.AutoWah({baseFrequency:100, octaves:6, sensitivity:0, Q:2, gain:2, wet:p.wah}),
    tremolo: new Tone.Tremolo(9, 0.8).start(),
    phaser: new Tone.Phaser({frequency:0.5, octaves:3, stages:10, Q:8, baseFrequency:350, wet:p.phaser}),
    delay: new Tone.FeedbackDelay(0.25, 0.3),
    vibrato: new Tone.Vibrato(5, 0.1),
    chorus: new Tone.Chorus({frequency:1.8, delayTime:3.5, depth:0.7, wet:p.chorus}).start(),
    reverb: new Tone.Reverb({decay:2.5, wet:p.reverb}),
    volume: new Tone.Volume(Tone.gainToDb(Math.max(p.volume, 0.0001))),
    limiter: new Tone.Limiter(-1)
  };
  await fx.reverb.generate();
  applyChainParams(fx,p);
  fx.nodes = [fx.pitch, fx.octave, fx.formant1, fx.formant2, fx.formant3, fx.eq, fx.drive, fx.distortion, fx.fuzz, fx.octafuzzPitch, fx.octafuzz, fx.wah, fx.tremolo, fx.phaser, fx.delay, fx.vibrato, fx.chorus, fx.reverb, fx.volume, fx.limiter];
  return fx;
}

function applyChainParams(fx,p){
  if(!fx) return;
  fx.pitch.pitch = p.pitch; fx.pitch.wet.value = p.pitch === 0 ? 0 : 1;
  fx.octave.pitch = p.octave * 12; fx.octave.wet.value = p.octave === 0 ? 0 : 1;
  const formantRatio = Math.pow(2, (p.formant || 0) / 100);
  const formantAmount = Math.abs(p.formant || 0) / 50;
  fx.formant1.frequency.value = 500 * formantRatio;
  fx.formant2.frequency.value = 1500 * formantRatio;
  fx.formant3.frequency.value = 2600 * formantRatio;
  fx.formant1.gain.value = 3.5 * formantAmount;
  fx.formant2.gain.value = 2.5 * formantAmount;
  fx.formant3.gain.value = 1.5 * formantAmount;
  fx.eq.low.value = p.bass; fx.eq.mid.value = p.mid; fx.eq.high.value = p.treble;
  fx.drive.distortion = 0.2 + p.drive * 0.8; fx.drive.wet.value = p.drive;
  fx.distortion.wet.value = p.distortion;
  fx.fuzz.wet.value = p.fuzz;
  fx.octafuzzPitch.wet.value = p.octafuzz;
  fx.octafuzz.wet.value = p.octafuzz;
  fx.wah.wet.value = p.wah;
  fx.tremolo.wet.value = p.tremolo;
  fx.phaser.wet.value = p.phaser;
  fx.delay.wet.value = p.delay;
  fx.vibrato.wet.value = p.vibrato;
  fx.chorus.wet.value = p.chorus;
  fx.reverb.wet.value = p.reverb;
  fx.volume.volume.value = Tone.gainToDb(Math.max(p.volume, 0.0001));
}

function connectChain(sourceNode, fx){ sourceNode.chain(...fx.nodes, Tone.getDestination()); }

/* ---------- Estado da interface ---------- */

function setBusy(on){
  busy = on;
  $('recordBtn').disabled = on;
  $('audioFile').disabled = on || !!recorder;
  $('processBtn').disabled = on || !source || !!recorder;
  $('effectPreviewBtn').disabled = on || !source || previewStarting || liveRunning || !!recorder;
}

function clearResult(){
  if(resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  ['resultAudio', 'resultHint', 'downloadResult'].forEach(id => { $(id).hidden = true; });
  $('resultAudio').removeAttribute('src');
  $('downloadResult').removeAttribute('href');
}

function confirmAudioReplacement(action){
  if(!source && !resultUrl) return true;
  const items = [];
  if(source) items.push('o áudio atual' + (source.name ? ' (' + source.name + ')' : ''));
  if(resultUrl) items.push('o resultado exportado');
  return window.confirm(action + ' substituirá ' + items.join(' e ') + '. Continuar?');
}

function setSource(blob, name, confirmed = false){
  if(!confirmed && !confirmAudioReplacement('Carregar um novo áudio')) return false;
  if(sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(blob);
  source = {blob, name};
  $('sourceAudio').src = sourceUrl;
  clearResult();
  setBusy(false);
  $('effectPreviewBtn').disabled = false;
  $('previewStatus').textContent = 'Áudio pronto. Clique em “Ouvir com efeitos” para testar os ajustes.';
  stopEffectPreview();
  return true;
}

function setMicrophoneControlsLocked(locked){
  $('microphoneSelect').disabled = locked;
  if(locked){
    $('audioFile').disabled = true;
    $('processBtn').disabled = true;
    $('effectPreviewBtn').disabled = true;
  } else {
    $('audioFile').disabled = busy || !!recorder;
    $('processBtn').disabled = busy || !source || !!recorder;
    $('effectPreviewBtn').disabled = busy || !source || previewStarting || liveRunning || !!recorder;
  }
}

function selectedAudioConstraints(extra = {}){
  const deviceId = $('microphoneSelect').value;
  return {...extra, ...(deviceId ? {deviceId:{exact:deviceId}} : {})};
}

function microphoneErrorMessage(error){
  switch(error && error.name){
    case 'NotAllowedError':
    case 'SecurityError':
      return 'O navegador bloqueou o microfone. Permita o acesso nas configurações do site e tente novamente.';
    case 'NotFoundError':
      return 'Nenhum microfone foi encontrado. Conecte um microfone e tente novamente.';
    case 'NotReadableError':
      return 'O microfone está ocupado ou indisponível. Feche outros aplicativos que o estejam usando.';
    case 'OverconstrainedError':
      return 'A entrada selecionada não está disponível. Escolha outro microfone.';
    default:
      return 'Não foi possível acessar o microfone. Verifique a conexão e a permissão do navegador.';
  }
}

async function refreshMicrophoneDevices(activeDeviceId = ''){
  const select = $('microphoneSelect');
  if(!navigator.mediaDevices?.enumerateDevices) return;
  const previous = activeDeviceId || select.value;
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'audioinput');
    select.replaceChildren(new Option('Microfone padrão do navegador',''));
    devices.forEach((device,index) => {
      const option = new Option(device.label || `Entrada de áudio ${index + 1}`,device.deviceId);
      select.append(option);
    });
    if(previous && [...select.options].some(option => option.value === previous)) select.value = previous;
  } catch(error) {
    $('micDeviceStatus').textContent = 'Não consegui listar as entradas de microfone.';
  }
}

async function showConnectedMicrophone(stream){
  const track = stream && stream.getAudioTracks()[0];
  const deviceId = track && track.getSettings ? track.getSettings().deviceId : '';
  await refreshMicrophoneDevices(deviceId || '');
  const selected = $('microphoneSelect').selectedOptions[0];
  const name = selected && selected.value ? selected.textContent : 'microfone padrão do navegador';
  $('micDeviceStatus').textContent = `Microfone conectado: ${name}.`;
  return name;
}

function showMicrophoneDisconnected(name = ''){
  $('micDeviceStatus').textContent = name
    ? `Microfone desconectado. Entrada usada: ${name}.`
    : 'Microfone desconectado. A entrada selecionada será usada na próxima gravação.';
}

$('microphoneSelect').addEventListener('change', () => {
  const option = $('microphoneSelect').selectedOptions[0];
  $('micDeviceStatus').textContent = `Entrada selecionada para a próxima gravação: ${option ? option.textContent : 'padrão'}.`;
});
if(navigator.mediaDevices){
  refreshMicrophoneDevices();
  navigator.mediaDevices.addEventListener?.('devicechange', () => refreshMicrophoneDevices());
}



/* ---------- Gravar ou importar ---------- */

async function toggleRecording(){
  if(recorder){ recorder.stop(); return; }
  if(liveRunning){
    say('Desligue o microfone ao vivo antes de começar uma gravação.');
    return;
  }
  if(!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia){
    const message = 'Seu navegador não oferece gravação de áudio. Use uma versão atualizada e abra o site por HTTPS.';
    say(message);
    $('recordingState').textContent = message;
    $('recordingState').dataset.state = 'error';
    return;
  }
  if(!confirmAudioReplacement('A nova gravação')) return;
  setBusy(true);
  setMicrophoneControlsLocked(true);
  let mic;
  try {
    mic = await navigator.mediaDevices.getUserMedia({audio:selectedAudioConstraints()});
  } catch(e) {
    setBusy(false);
    setMicrophoneControlsLocked(false);
    const message = microphoneErrorMessage(e);
    say(message);
    $('recordingState').textContent = message;
    $('recordingState').dataset.state = 'error';
    $('micDeviceStatus').textContent = message;
    return;
  }
  let micName = await showConnectedMicrophone(mic);
  const chunks = [];
  let analyser = null;
  try {
    recordingAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    const micSource = recordingAudioContext.createMediaStreamSource(mic);
    analyser = recordingAudioContext.createAnalyser();
    analyser.fftSize = 512;
    micSource.connect(analyser);
  } catch(e) {
    recordingAudioContext = null;
  }
  let rec;
  try {
    rec = new MediaRecorder(mic);
  } catch(error) {
    mic.getTracks().forEach(track => track.stop());
    setBusy(false);
    setMicrophoneControlsLocked(false);
    const message = 'Este navegador não conseguiu iniciar a gravação de áudio.';
    say(message);
    $('recordingState').textContent = message;
    $('recordingState').dataset.state = 'error';
    return;
  }
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
    $('recordMeterFill').style.width = '0%';
    $('recordMeterLabel').textContent = 'Nível do microfone: 0%';
    document.querySelector('.record-meter').setAttribute('aria-valuenow', '0');
    recorder = null;
    $('recordBtn').textContent = 'Começar gravação';
    $('recordBtn').classList.remove('on');
    $('recordBtn').disabled = false;
    setMicrophoneControlsLocked(false);
    const duration = $('recordTime').textContent;
    if(chunks.length){
      setSource(new Blob(chunks, {type: rec.mimeType || 'audio/webm'}), 'gravacao', true);
      $('recordingState').textContent = `Gravação concluída: ${duration}. O áudio está pronto para ouvir e exportar.`;
      $('recordingState').dataset.state = 'done';
      say('Gravação pronta. Ouça a prévia, ajuste os efeitos e exporte.');
    } else {
      setBusy(false);
      $('recordingState').textContent = 'Gravação encerrada sem áudio. Tente novamente.';
      $('recordingState').dataset.state = 'error';
      say('Nenhum áudio foi gravado. Tente novamente.');
    }
    showMicrophoneDisconnected(micName);
  };

  recorder = rec;
  rec.start();
  recordingStartedAt = performance.now();
  $('recordTime').textContent = '00:00';
  $('recordMonitor').hidden = false;
  $('recordingState').textContent = 'Gravando… duração máxima de 5 minutos.';
  $('recordingState').dataset.state = 'recording';
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
  if(!setSource(file, file.name.replace(/\.[^.]+$/, '') || 'audio')){
    say('Importação cancelada. O áudio atual foi preservado.');
    return;
  }
  $('recordMonitor').hidden = true;
  $('recordTime').textContent = '00:00';
  $('recordingState').textContent = 'Arquivo importado e pronto para processar.';
  $('recordingState').dataset.state = 'ready';
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
    const message = 'O navegador bloqueou o microfone. Abra o site por HTTPS e permita o acesso nas configurações do navegador.';
    $('liveStatus').textContent = message;
    $('micDeviceStatus').textContent = message;
    return;
  }
  $('liveBtn').disabled = true;
  try{
    await Tone.start();
    setMicrophoneControlsLocked(true);
    liveStream = await navigator.mediaDevices.getUserMedia({
      audio: selectedAudioConstraints({echoCancellation:false, noiseSuppression:false, autoGainControl:false})
    });
    liveMicName = await showConnectedMicrophone(liveStream);
    const ctx = Tone.getContext().rawContext;
    const src = ctx.createMediaStreamSource(liveStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser); // medição visual, sem enviar o som cru aos fones
    const chain = await createEffectChain(readParams());
    liveFx = {...chain, src, analyser, microphoneName:liveMicName};
    // Tone.connect conecta corretamente um AudioNode nativo ao primeiro efeito Tone.js.
    Tone.connect(src, liveFx.pitch);
    liveFx.nodes[0].chain(...liveFx.nodes.slice(1), Tone.getDestination());
    processedDestination = ctx.createMediaStreamDestination();
    // Captura a saída já processada, sem alterar a saída normal para fones/alto-falantes.
    liveFx.limiter.output.connect(processedDestination);
    $('recordProcessedBtn').disabled = false;
    liveRunning = true;
    $('liveBtn').textContent = 'Desligar microfone';
    $('liveBtn').classList.add('on');
    $('liveStatus').textContent = 'Microfone conectado. Fale e ajuste os efeitos abaixo.';
    applyLiveParams();
    updateLiveMeter();
  }catch(err){
    console.error('Erro ao iniciar o microfone:', err);
    stopLive();
    const message = microphoneErrorMessage(err);
    $('liveStatus').textContent = message;
    $('micDeviceStatus').textContent = message;
  }finally{
    $('liveBtn').disabled = false;
    setMicrophoneControlsLocked(liveRunning);
  }
}

function drawLiveWaveform(analyser){
  const canvas = $('liveWaveform');
  if(!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if(!rect.width || !rect.height) return;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if(canvas.width !== width || canvas.height !== height){
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  if(!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width, h = rect.height;
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#fff';
  ctx.fillRect(0, 0, w, h);

  /* Grade discreta em estilo retrô */
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--line').trim() || '#000';
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for(let x = 8; x < w; x += 16){ ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for(let y = 8; y < h; y += 16){ ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  ctx.globalAlpha = 1;

  const samples = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(samples);
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--fg').trim() || '#000';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'square';
  ctx.beginPath();
  for(let i = 0; i < samples.length; i++){
    const x = (i / (samples.length - 1)) * w;
    const y = (samples[i] / 255) * h;
    if(i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function clearLiveWaveform(){
  const canvas = $('liveWaveform');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  if(!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#fff';
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--line').trim() || '#000';
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(0, rect.height / 2);
  ctx.lineTo(rect.width, rect.height / 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function updateLiveMeter(){
  if(!liveRunning || !liveFx?.analyser) return;
  const analyser = liveFx.analyser;
  drawLiveWaveform(analyser);
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

function applyLiveParams(){ if(liveFx) applyChainParams(liveFx, readParams()); }

function stopLive(){
  const disconnectedMicName = liveMicName;
  if(processedRecorder && processedRecorder.state !== 'inactive') processedRecorder.stop();
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
  if(processedDestination){
    processedDestination.stream.getTracks().forEach(track => track.stop());
    processedDestination = null;
  }
  $('recordProcessedBtn').disabled = true;
  $('liveMeterFill').style.width = '0%';
  document.querySelector('.level-meter').setAttribute('aria-valuenow', '0');
  $('liveMeterLabel').textContent = 'Nível do microfone: 0%';
  clearLiveWaveform();
  $('liveBtn').textContent = 'Ligar microfone';
  $('liveBtn').classList.remove('on');
  $('liveStatus').textContent = 'Microfone desligado.';
  setMicrophoneControlsLocked(false);
  showMicrophoneDisconnected(disconnectedMicName);
  liveMicName = '';
}

function updateProcessedRecordClock(){
  if(!processedRecorder || processedRecorder.state === 'inactive') return;
  const elapsed = Math.min(Math.floor((performance.now() - processedRecordStartedAt) / 1000), MAX_SECONDS);
  $('processedRecordTime').textContent = String(Math.floor(elapsed / 60)).padStart(2,'0') + ':' + String(elapsed % 60).padStart(2,'0');
}

function startProcessedRecording(){
  if(!liveRunning || !processedDestination){
    $('processedRecordStatus').textContent = 'Ligue o microfone ao vivo antes de gravar.';
    return;
  }
  if(!window.MediaRecorder){
    $('processedRecordStatus').textContent = 'Este navegador não oferece gravação de áudio compatível.';
    return;
  }
  if(!confirmAudioReplacement('A nova gravação processada')) return;
  $('recordMonitor').hidden = true;
  try{
    const mime = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
    processedChunks = [];
    processedRecorder = new MediaRecorder(processedDestination.stream, mime ? {mimeType:mime} : undefined);
    processedRecorder.ondataavailable = event => { if(event.data && event.data.size) processedChunks.push(event.data); };
    processedRecorder.onerror = () => { $('processedRecordStatus').textContent = 'Erro ao gravar a saída processada.'; };
    processedRecorder.onstop = () => {
      clearTimeout(processedRecordTimer);
      clearInterval(processedRecordTicker);
      processedRecordTicker = 0;
      $('stopProcessedBtn').disabled = true;
      $('recordProcessedBtn').disabled = !liveRunning;
      const duration = $('processedRecordTime').textContent;
      if(processedChunks.length){
        const blob = new Blob(processedChunks, {type: processedRecorder.mimeType || 'audio/webm'});
        setSource(blob, 'voz-processada', true);
        $('processedRecordStatus').textContent = `Gravação processada concluída: ${duration}. Áudio pronto para ouvir e exportar.`;
        say('Voz processada gravada. Você pode ouvir, ajustar e exportar.');
      } else {
        $('processedRecordStatus').textContent = 'Nenhum dado de áudio foi gravado. Tente novamente.';
      }
      processedRecorder = null;
      processedChunks = [];
    };
    processedRecorder.start(250);
    processedRecordStartedAt = performance.now();
    $('processedRecordTime').textContent = '00:00';
    processedRecordTicker = setInterval(updateProcessedRecordClock, 250);
    $('recordProcessedBtn').disabled = true;
    $('stopProcessedBtn').disabled = false;
    $('processedRecordStatus').textContent = 'Gravando a voz com efeitos. Limite de 5 minutos.';
    processedRecordTimer = setTimeout(() => { if(processedRecorder && processedRecorder.state !== 'inactive') processedRecorder.stop(); }, MAX_SECONDS * 1000);
  }catch(err){
    console.error('Falha ao gravar saída processada:', err);
    $('processedRecordStatus').textContent = 'Não foi possível iniciar a gravação processada neste navegador.';
  }
}
function stopProcessedRecording(){ if(processedRecorder && processedRecorder.state !== 'inactive') processedRecorder.stop(); }
$('recordProcessedBtn').addEventListener('click', startProcessedRecording);
$('stopProcessedBtn').addEventListener('click', stopProcessedRecording);
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
  const tail = (p.reverb > 0 ? 2.5 : 0) + (p.delay > 0 ? 1.5 : 0) + ((p.pitch !== 0 || p.octave !== 0 || p.octafuzz > 0) ? 0.15 : 0);
  const channels = Math.min(input.numberOfChannels, 2);
  const buffer = new Tone.ToneAudioBuffer(input);
  const rendered = await Tone.Offline(async () => {
    const player = new Tone.Player(buffer);
    const fx = await createEffectChain(p);
    connectChain(player, fx);
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
  if(resultUrl && !window.confirm('O processamento substituirá o resultado exportado anterior. Continuar?')) return;
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
    const chain = await createEffectChain(p);
    connectChain(player, chain);
    previewFx = {player, ...chain};
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

function applyPreviewParams(){ if(previewFx) applyChainParams(previewFx, readParams()); }

$('effectPreviewBtn').addEventListener('click', () => {
  if(previewFx) stopEffectPreview();
  else startEffectPreview();
});
$('stopPreviewBtn').addEventListener('click', stopEffectPreview);
$('processBtn').addEventListener('click', process);
window.addEventListener('pagehide', () => { stopLive(); stopEffectPreview(); });

/* ---------- FX Lab: snapshots A/B para experimentar e comparar ---------- */
const FX_LAB_KEY = 'nichodev.fxLab.snapshots.v1';
let fxSnapshots = { A: null, B: null };
let lastAB = 'A';
let currentAB = null;

function loadFxSnapshots(){
  try {
    const saved = JSON.parse(localStorage.getItem(FX_LAB_KEY) || '{}');
    for (const key of ['A','B']) {
      if (saved[key] && typeof saved[key] === 'object') fxSnapshots[key] = saved[key];
    }
  } catch (_) { /* snapshots são opcionais */ }
}
function persistFxSnapshots(){
  try { localStorage.setItem(FX_LAB_KEY, JSON.stringify(fxSnapshots)); } catch (_) {}
}
function updateFxLabUI(){
  for (const key of ['A','B']) {
    const exists = Boolean(fxSnapshots[key]);
    $(`snapshot${key}Status`).textContent = exists
      ? `Salva · ${new Date(fxSnapshots[key].savedAt || Date.now()).toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'})}`
      : 'Ainda não capturada.';
    $(`load${key}Btn`).disabled = !exists;
  }
  const next = currentAB === 'A' ? 'B' : (currentAB === 'B' ? 'A' : (lastAB === 'A' ? 'B' : 'A'));
  $('toggleABBtn').disabled = !(fxSnapshots.A && fxSnapshots.B);
  $('toggleABBtn').textContent = `Alternar para ${next}`;
  $('toggleABBtn').setAttribute('aria-label', `Carregar versão ${next} da comparação A/B`);
  $('abCurrentStatus').textContent = currentAB
    ? `Versão atual: ${currentAB}. As versões A e B permanecem salvas separadamente.`
    : 'Ajustes livres. As versões A e B ficam guardadas separadamente.';
}
function captureFxSnapshot(key){
  fxSnapshots[key] = { values: currentRawParams(), enabled: currentEffectStates(), savedAt: Date.now() };
  persistFxSnapshots();
  lastAB = key;
  currentAB = key;
  updateFxLabUI();
  $('abStatus').textContent = `Configuração ${key} capturada. A outra versão continua guardada.`;
}
function applyFxSnapshot(key){
  const snap = fxSnapshots[key];
  if (!snap) return;
  applyRawParams(snap.values || snap, snap.enabled);
  lastAB = key;
  currentAB = key;
  updateFxLabUI();
  $('abStatus').textContent = `Configuração ${key} carregada. A outra versão continua guardada.`;
}
$('captureABtn').addEventListener('click', () => captureFxSnapshot('A'));
$('captureBBtn').addEventListener('click', () => captureFxSnapshot('B'));
$('loadABtn').addEventListener('click', () => applyFxSnapshot('A'));
$('loadBBtn').addEventListener('click', () => applyFxSnapshot('B'));
$('toggleABBtn').addEventListener('click', () => {
  const next = currentAB === 'A' ? 'B' : (currentAB === 'B' ? 'A' : (lastAB === 'A' ? 'B' : 'A'));
  applyFxSnapshot(next);
});
loadFxSnapshots();
updateFxLabUI();

