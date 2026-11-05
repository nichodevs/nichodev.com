import { CHIP_PITCHES, CHIP_DRUMS, CHIP_INSTRUMENTS, RECORDED_INSTRUMENTS, isDrumInstrument } from './project-model.js?v=3';

const STEP_COUNT = 16;
const LANE_NAMES = ['Melodia', 'Harmonia', 'Baixo', 'Percussão'];
const DRUM_SYMBOLS = ['B', 'C', 'H'];
const EXAMPLES = [
  {
    name: 'Tela de Título', bpm: 112, key: 'Dó maior',
    instruments: ['pulse25', 'pulse50', 'triangle', 'noise'],
    patterns: [
      'C5 - E5 - G5 - C6 - G5 - E5 - D5 - G5 -',
      '- G4 - - E4 - - G4 - F4 - - G4 - - B4',
      'C3 - - - C3 - - - F2 - - - G2 - - -',
      'B - H - C - H - B - H - C - H H'
    ]
  },
  {
    name: 'Fase Noturna', bpm: 120, key: 'Lá menor',
    instruments: ['pulse25', 'pulse50', 'triangle', 'noise'],
    patterns: [
      'A4 - C5 - E5 - G5 - E5 - C5 - G4 - E5 -',
      '- E4 - - G4 - - E4 - D4 - - G4 - - E4',
      'A2 - - - A2 - - E2 G2 - - - E2 - - -',
      'B - H - C - H - B - H - C - H H'
    ]
  },
  {
    name: 'Corrida Pixel', bpm: 156, key: 'Mi menor',
    instruments: ['pulse12', 'pluck', 'triangle', 'noise'],
    patterns: [
      'E5 G5 A5 B5 - A5 G5 - E5 G5 B5 - C6 - B5 A5',
      '- B4 - D5 - E5 - B4 - C5 - A4 - B4 - D5',
      'E2 - E3 - G2 - G3 - A2 - A3 - B2 - B3 -',
      'B H - H C H B H B H - H C H H H'
    ]
  }
];

function loadExample(example) {
  const { name, bpm, patterns, instruments } = example;
  const lanes = patterns.map((pattern, lane) => {
    const pitches = lane === 3 ? DRUM_SYMBOLS : CHIP_PITCHES;
    const notes = pattern.split(' ').flatMap((note, step) => note === '-' ? [] : [{ step, pitch: pitches.indexOf(note) }]);
    return { name: LANE_NAMES[lane], instrument: instruments[lane], notes };
  });
  return { name, bpm, lanes };
}

export function mountChipLab(panel, { onPlay, onInsert, getProjectBpm }) {
  const find = id => panel.querySelector('#' + id);
  const grid = find('chipGrid'), preset = find('chipPreset'), bpm = find('chipBpm');
  const playButton = find('chipPlay'), stopButton = find('chipStop'), insertButton = find('chipInsert');
  const instrument = find('chipInstrument'), note = find('chipNote'), status = find('chipStatus');
  const exampleKey = find('chipExampleKey'), laneName = find('chipLaneName'), stepName = find('chipStepName');
  const insertHelp = find('chipInsertHelp');
  let draft, defaultPitches, selectedLane = 0, selectedStep = 0;
  let exampleIndex = 1, exampleDraft;
  let playVersion = 0, stopPreview;

  function stop() {
    playVersion++;
    stopPreview?.();
    stopPreview = undefined;
    if (!stopButton.disabled) status.textContent = 'Prévia parada.';
    playButton.disabled = false;
    stopButton.disabled = true;
  }

  function readBpm() {
    const value = bpm.valueAsNumber;
    if (Number.isFinite(value)) draft.bpm = Math.min(240, Math.max(40, Math.round(value)));
    bpm.value = draft.bpm;
  }

  const count = document.createElement('div');
  count.className = 'chip-lane chip-count';
  count.setAttribute('aria-hidden', 'true');
  count.append(document.createElement('span'));
  for (let step = 0; step < STEP_COUNT; step++) {
    const label = document.createElement('span');
    label.textContent = String(step + 1).padStart(2, '0');
    count.append(label);
  }
  grid.append(count);

  const mutedPitches = LANE_NAMES.map(() => new Map());
  const instruments = [], cells = LANE_NAMES.map((name, lane) => {
    const row = document.createElement('div');
    row.className = 'chip-lane chip-lane-' + lane;
    const track = document.createElement('div'), title = document.createElement('strong'), sound = document.createElement('small');
    track.className = 'chip-track';
    title.textContent = name;
    track.append(title, sound);
    instruments.push(sound);
    row.append(track);
    const buttons = Array.from({ length: STEP_COUNT }, (_, step) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip-step';
      button.dataset.lane = lane;
      button.dataset.step = step;
      button.addEventListener('click', () => {
        selectedLane = lane;
        selectedStep = step;
        const notes = draft.lanes[lane].notes;
        const current = notes.find(item => item.step === step);
        const pitch = mutedPitches[lane].get(step) ?? notes[0]?.pitch ?? defaultPitches[lane];
        setNote(lane, step, current ? null : pitch);
        button.focus();
      });
      button.addEventListener('keydown', event => {
        let nextLane = lane, nextStep = step;
        switch (event.key) {
          case 'ArrowLeft': nextStep--; break;
          case 'ArrowRight': nextStep++; break;
          case 'ArrowUp': nextLane--; break;
          case 'ArrowDown': nextLane++; break;
          case 'Home': nextStep = 0; break;
          case 'End': nextStep = STEP_COUNT - 1; break;
          case 'Delete':
          case 'Backspace':
            event.preventDefault();
            setNote(lane, step, null);
            return;
          default: return;
        }
        event.preventDefault();
        nextLane = Math.min(LANE_NAMES.length - 1, Math.max(0, nextLane));
        nextStep = Math.min(STEP_COUNT - 1, Math.max(0, nextStep));
        selectStep(nextLane, nextStep);
        cells[nextLane][nextStep].focus();
      });
      row.append(button);
      return button;
    });
    grid.append(row);
    return buttons;
  });

  function selectStep(lane, step) {
    selectedLane = lane;
    selectedStep = step;
    renderDraft();
  }

  function setNote(lane, step, pitch) {
    stop();
    const previous = draft.lanes[lane].notes.find(item => item.step === step);
    if (pitch === null && previous) mutedPitches[lane].set(step, previous.pitch);
    const notes = draft.lanes[lane].notes.filter(item => item.step !== step);
    if (pitch !== null) notes.push({ step, pitch });
    draft.lanes[lane].notes = notes.sort((a, b) => a.step - b.step);
    renderDraft();
  }

  function renderDraft() {
    draft.lanes.forEach((lane, laneIndex) => {
      const drums = isDrumInstrument(lane.instrument);
      const notes = new Map(lane.notes.map(item => [item.step, item.pitch]));
      instruments[laneIndex].textContent = CHIP_INSTRUMENTS[lane.instrument];
      cells[laneIndex].forEach((button, step) => {
        const pitch = notes.get(step), hasNote = pitch !== undefined;
        const selected = selectedLane === laneIndex && selectedStep === step;
        button.textContent = hasNote ? (drums ? DRUM_SYMBOLS : CHIP_PITCHES)[pitch] : '·';
        button.setAttribute('aria-label', `${lane.name}, passo ${step + 1}, ${hasNote ? (drums ? CHIP_DRUMS : CHIP_PITCHES)[pitch] : 'pausa'}`);
        button.setAttribute('aria-pressed', hasNote);
        button.tabIndex = selected ? 0 : -1;
        button.classList.toggle('has-note', hasNote);
        button.classList.toggle('is-selected', selected);
      });
    });

    const lane = draft.lanes[selectedLane], drums = isDrumInstrument(lane.instrument);
    const pitches = drums ? CHIP_DRUMS : CHIP_PITCHES;
    const pitch = lane.notes.find(item => item.step === selectedStep)?.pitch;
    const groups = ['Clássicos 8-bit', 'Instrumentos gravados'].map(label => {
      const group = document.createElement('optgroup');
      group.label = label;
      return group;
    });
    for (const [id, label] of Object.entries(CHIP_INSTRUMENTS)) {
      if (isDrumInstrument(id) !== drums) continue;
      const group = groups[Object.hasOwn(RECORDED_INSTRUMENTS, id) ? 1 : 0];
      group.append(new Option(label, id));
    }
    instrument.replaceChildren(...groups);
    instrument.value = lane.instrument;
    note.replaceChildren(new Option('Pausa', ''), ...pitches.map((label, index) => new Option(label, index)));
    note.value = pitch ?? '';
    laneName.textContent = lane.name;
    stepName.textContent = `${lane.name} · passo ${selectedStep + 1}`;
  }

  function refresh() {
    insertHelp.textContent = `4 clipes MIDI editáveis no cursor do projeto · ${getProjectBpm()} BPM.`;
  }

  preset.replaceChildren(...EXAMPLES.map(({ name }, index) => new Option(name, index)));
  preset.selectedIndex = exampleIndex;
  function showExample() {
    exampleIndex = Number(preset.value);
    const example = EXAMPLES[exampleIndex];
    draft = loadExample(example);
    mutedPitches.forEach(pitches => pitches.clear());
    defaultPitches = draft.lanes.map(lane => lane.notes[0].pitch);
    exampleDraft = JSON.stringify(draft);
    bpm.value = draft.bpm;
    exampleKey.textContent = `${example.key} no exemplo original. Carrega notas, BPM e timbres.`;
    renderDraft();
  }
  preset.addEventListener('change', () => {
    if (JSON.stringify(draft) !== exampleDraft && !window.confirm('Substituir as mudanças do rascunho pelo exemplo selecionado?')) {
      preset.selectedIndex = exampleIndex;
      return;
    }
    stop();
    showExample();
  });
  bpm.addEventListener('change', () => { stop(); readBpm(); });
  instrument.addEventListener('change', () => {
    stop();
    draft.lanes[selectedLane].instrument = instrument.value;
    renderDraft();
  });
  note.addEventListener('change', () => setNote(selectedLane, selectedStep, note.value === '' ? null : Number(note.value)));

  playButton.addEventListener('click', async () => {
    readBpm();
    const version = ++playVersion;
    playButton.disabled = true;
    stopButton.disabled = false;
    status.textContent = 'Preparando a prévia…';
    try {
      const cancel = await onPlay(structuredClone(draft), () => version === playVersion);
      if (version !== playVersion) { cancel?.(); return; }
      stopPreview = cancel;
      status.textContent = 'Ouvindo prévia em loop.';
    } catch (error) {
      if (version !== playVersion) return;
      stop();
      status.textContent = error.message || 'Não foi possível ouvir a prévia.';
    }
  });
  stopButton.addEventListener('click', stop);
  insertButton.addEventListener('click', async () => {
    stop();
    readBpm();
    insertButton.disabled = true;
    try {
      if (await onInsert(structuredClone(draft))) status.textContent = 'Loop adicionado. O rascunho continua disponível.';
    } catch {
      status.textContent = 'Não foi possível adicionar o loop.';
    } finally {
      insertButton.disabled = false;
    }
  });

  showExample();
  refresh();
  return { stop, refresh };
}
