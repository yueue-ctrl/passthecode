const replayDialog = document.querySelector('#replay-dialog');
const replayCanvas = document.querySelector('#replay-canvas');
const replayDrawing = replayCanvas.getContext('2d');
const replayMusic = document.querySelector('#replay-music');
const replayWords = document.querySelector('#replay-words');
const editorTextColor = document.querySelector('#editor-text-color');
const replayTextColor = document.querySelector('#replay-text-color');
const editorBackground = document.querySelector('#editor-background');
const replayBackground = document.querySelector('#replay-background');
const replayFullLayout = document.querySelector('#replay-full-layout');
const replayFontSize = document.querySelector('#replay-font-size');
const replayInkStrength = document.querySelector('#replay-ink-strength');
const replayInkSize = document.querySelector('#replay-ink-size');
const replayAppearance = [replayWords, replayFullLayout, replayFontSize, replayInkStrength, replayInkSize, replayTextColor, replayBackground];
const replayGraphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const replayPlay = document.querySelector('#replay-play');
const replayStop = document.querySelector('#replay-stop');
const replayExport = document.querySelector('#replay-export');
const replayStatus = document.querySelector('#replay-status');

const replayFrames = [];
const recordedReplayFrames = [];
const replayEdits = [{ value: '', characters: [], added: [], deleted: [] }];
let replayEditIndex = 0;
let replayCharacterId = 0;
let soundtrack;
let audioContext;
let musicRequest = 0;
let musicLoading = false;
let playback;

function captureReplayWords(stage, bounds) {
  const field = stage.querySelector('#text');
  const node = stage.querySelector('#mirror').firstChild;
  const style = getComputedStyle(field);
  const range = document.createRange();
  const words = [];
  const save = (text, rect, token, start = token.index) => words.push({
    text, start, offset: token.index, whole: token[0],
    x: (rect.left - bounds.left - field.scrollLeft) / bounds.width,
    y: (rect.top - bounds.top - field.scrollTop + rect.height / 2) / bounds.height,
    width: rect.width / bounds.width,
  });
  for (const match of field.value.matchAll(/\S+/gu)) {
    range.setStart(node, match.index);
    range.setEnd(node, match.index + match[0].length);
    const rects = range.getClientRects();
    if (rects.length === 1) {
      save(match[0], rects[0], match);
      continue;
    }
    let offset = match.index;
    for (const letter of match[0]) {
      range.setStart(node, offset);
      offset += letter.length;
      range.setEnd(node, offset);
      save(letter, range.getBoundingClientRect(), match, offset - letter.length);
    }
  }
  const size = parseFloat(style.fontSize);
  return { words, size, family: style.fontFamily };
}

function replayEditValue() {
  return replayEdits[replayEditIndex].value;
}

function recordReplayFrame(stage, point, person, type, change) {
  const now = performance.now();
  const bounds = stage.getBoundingClientRect();
  const previous = recordedReplayFrames.at(-1);
  const field = stage.querySelector('#text');
  if (type === 'edit' || type === 'delete') {
    const prior = replayEdits[replayEditIndex];
    const value = field.value;
    if (value === prior.value) return;
    if (!change) {
      let left = 0;
      let oldRight = prior.value.length;
      let newRight = value.length;
      while (left < Math.min(oldRight, newRight) && value[left] === prior.value[left]) left++;
      while (oldRight > left && newRight > left && prior.value[oldRight - 1] === value[newRight - 1]) {
        oldRight--;
        newRight--;
      }
      change = { left, oldRight, newRight };
    }
    const { left, oldRight, newRight } = change;
    const added = Array.from({ length: newRight - left }, () => ++replayCharacterId);
    const deleted = type === 'delete' ? prior.characters.slice(left, oldRight) : [];
    const characters = [...prior.characters.slice(0, left), ...added, ...prior.characters.slice(oldRight)];
    replayEdits.splice(replayEditIndex + 1, Infinity, { value, characters, added, deleted });
    replayEditIndex++;
    if (type === 'delete') return;
  }
  const edit = replayEdits[replayEditIndex];
  const ink = stage.querySelector('#ink');
  const inkStyle = getComputedStyle(ink);
  const opacity = parseFloat(inkStyle.getPropertyValue('--ink-opacity')) || .55;
  const view = stage.querySelector('#ink-view').value;
  const blur = inkStyle.getPropertyValue(view === 'stack' ? '--stack-blur' : '--wash-blur').trim() || '6px';
  const viewport = {
    width: bounds.width, height: bounds.height, scrollX: field.scrollLeft, scrollY: field.scrollTop,
  };
  const sameLayout = type === 'move' && previous
    && previous.edit === edit
    && previous.inkOpacity === opacity && previous.view === view
    && Object.keys(viewport).every(key => viewport[key] === previous.viewport[key]);
  const shapes = sameLayout ? previous.shapes
    : [...ink.querySelectorAll('[data-person]')].map(element => {
      const rect = element.getBoundingClientRect();
      const wash = element.classList.contains('wash');
      return {
        // Use the layout box before the editor's temporary pulse transform.
        x: wash ? parseFloat(element.style.left) : rect.left - bounds.left,
        y: wash ? parseFloat(element.style.top) : rect.top - bounds.top,
        width: wash ? parseFloat(element.style.width) : rect.width,
        height: wash ? parseFloat(element.style.height) : rect.height,
        color: element.style.getPropertyValue('--wash-color'),
      };
    });
  recordedReplayFrames.push({
    type, edit, person, color: person.color, shapes, viewport, view, blur, inkOpacity: opacity, time: now,
    lettering: sameLayout ? previous.lettering : captureReplayWords(stage, bounds),
    x: point.x / bounds.width,
    y: point.y / bounds.height,
  });
}

function restoreReplayEdit(value, inputType) {
  const direction = inputType === 'historyUndo' ? -1 : 1;
  for (let index = replayEditIndex + direction; index >= 0 && index < replayEdits.length; index += direction) {
    if (replayEdits[index].value !== value) continue;
    replayEditIndex = index;
    break;
  }
}

function compactReplayScene(frame, deleted) {
  const removed = [];
  const words = frame.lettering.words.flatMap(word => {
    const ids = frame.edit.characters.slice(word.start, word.start + word.text.length);
    if (!ids.some(id => deleted.has(id))) return [word];
    const fragments = [];
    let offset = 0;
    for (const character of word.text) {
      const x = word.x + word.width * offset / word.text.length;
      const width = word.width * character.length / word.text.length;
      if (deleted.has(ids[offset])) removed.push({ x, y: word.y, width });
      else fragments.push({ ...word, text: character, x, width });
      offset += character.length;
    }
    const whole = fragments.map(fragment => fragment.text).join('');
    return fragments.map(fragment => ({ ...fragment, whole }));
  });
  if (!removed.length) return frame;

  const { width, height } = frame.viewport;
  const compactX = (x, y) => x - removed.reduce((shift, gap) => {
    if (Math.abs(gap.y - y) * height > 8) return shift;
    return shift + Math.max(0, Math.min(gap.width, x - gap.x));
  }, 0);
  const shapes = frame.view === 'wash' ? frame.shapes.flatMap(shape => {
    const y = (shape.y + shape.height / 2) / height;
    const left = compactX(shape.x / width, y) * width;
    const right = compactX((shape.x + shape.width) / width, y) * width;
    return right - left > .5 ? [{ ...shape, x: left, width: right - left }] : [];
  }) : frame.shapes;
  return {
    ...frame,
    x: compactX(frame.x, frame.y + 18 / height),
    shapes,
    lettering: {
      ...frame.lettering,
      words: words.map(word => ({ ...word, x: compactX(word.x, word.y) })),
    },
  };
}

function collectReplayFrames() {
  const activeEdits = new Set(replayEdits.slice(0, replayEditIndex + 1));
  const deleted = new Set([...activeEdits].flatMap(edit => edit.deleted));
  replayFrames.length = 0;
  for (const frame of recordedReplayFrames) {
    const erased = frame.edit.added.length && frame.edit.added.every(id => deleted.has(id));
    if (activeEdits.has(frame.edit) && !erased) {
      replayFrames.push(deleted.size ? compactReplayScene(frame, deleted) : frame);
    } else if (frame.type === 'pass') {
      // Keep the handoff, but use the last surviving scene instead of the undone text.
      const scene = replayFrames.at(-1) ?? {
        viewport: frame.viewport, view: frame.view, inkOpacity: frame.inkOpacity,
        shapes: [], lettering: { ...frame.lettering, words: [] },
        x: frame.x, y: frame.y,
      };
      replayFrames.push({
        ...scene, type: 'pass', time: frame.time, person: frame.person, color: frame.color,
      });
    }
  }
}

function findMusicOnsets(buffer) {
  const channel = buffer.getChannelData(0);
  const stride = Math.max(1, Math.floor(buffer.sampleRate * .02));
  let average = 0;
  const peaks = [];
  for (let start = 0; start < channel.length; start += stride) {
    let energy = 0;
    for (let i = start; i < Math.min(start + stride, channel.length); i += 4) energy += channel[i] ** 2;
    const rms = Math.sqrt(energy / Math.ceil(stride / 4));
    const time = start / buffer.sampleRate;
    if (rms > .025 && rms > average * 1.55 && time - (peaks.at(-1) ?? -1) >= .17) peaks.push(time);
    average = average * .9 + rms * .1;
  }
  return peaks;
}

function makeReplayTimeline() {
  let elapsed = .18;
  const timing = replayFrames.map((frame, index) => {
    if (index) elapsed += Math.min(1.25, Math.max(.045, (frame.time - replayFrames[index - 1].time) / 1000));
    return elapsed;
  });
  if (!soundtrack) return timing;

  const last = Math.max(0, soundtrack.buffer.duration - .3);
  const beats = soundtrack.peaks.filter(time => time <= last);
  const duration = Math.min(last, Math.max(1, elapsed * 1.2));
  if (!beats.length) return timing.map(time => time / elapsed * duration);
  if (beats.length >= timing.length) return beats.slice(0, timing.length);

  // For a short or sparse track, keep edits in order between the available onsets.
  const anchors = [...beats, last].filter((time, i, times) => i === 0 || time > times[i - 1]);
  return timing.map(time => {
    const slot = (time - timing[0]) / Math.max(.001, elapsed - timing[0]) * (anchors.length - 1);
    const index = Math.floor(slot);
    return anchors[index] + ((anchors[index + 1] ?? anchors[index]) - anchors[index]) * (slot - index);
  });
}

function drawReplay(frame, previous, age, beatAge, index = 0, beat = -1, wordIndex = index, intro = 1) {
  const ctx = replayDrawing;
  const background = replayBackground.value;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, replayCanvas.width, replayCanvas.height);
  if (!frame) return;
  const { width, height } = frame.viewport;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();

  const hit = Number.isFinite(beatAge)
    ? Math.max(0, 1 - beatAge / .28)
    : frame.type === 'edit' && !soundtrack ? Math.max(0, 1 - age / .2) * .6 : 0;
  const inkScale = replayInkSize.valueAsNumber / 100;
  const inkStrength = replayInkStrength.valueAsNumber / 100;
  for (const shape of frame.shapes) {
    const span = shape.width * inkScale;
    const top = shape.y + shape.height * (1 - inkScale) / 2;
    const wash = frame.view === 'wash';
    ctx.globalAlpha = Math.min(1, (wash ? frame.inkOpacity : 1) * inkStrength);
    ctx.filter = frame.view === 'rail' ? 'none' : `blur(${frame.blur})`;
    if (frame.view === 'rail') {
      ctx.fillStyle = `color-mix(in srgb, ${shape.color} ${30 + frame.inkOpacity * 60}%, ${background})`;
    } else {
      const tint = ctx.createLinearGradient(shape.x, 0, shape.x + span, 0);
      if (wash) {
        tint.addColorStop(0, shape.color);
        tint.addColorStop(.68, `${shape.color}61`);
      } else {
        const strength = 38 + frame.inkOpacity * 60;
        tint.addColorStop(.12, `color-mix(in srgb, ${shape.color} ${strength}%, ${background})`);
      }
      tint.addColorStop(1, `${shape.color}00`);
      ctx.fillStyle = tint;
    }
    ctx.beginPath();
    ctx.roundRect(shape.x, top, span, shape.height * inkScale, wash ? 7 : 5);
    ctx.fill();
  }

  const x = frame.x * width;
  const y = frame.y * height;
  const tailAge = Math.max(0, age);
  const handoff = frame.type === 'pass';
  const passImpact = handoff ? Math.max(0, 1 - age / .66) : 0;
  const impact = Math.max(hit, passImpact);
  if (impact > 0) {
    // A weak pulse starts small too. Strength controls opacity, while time controls spread.
    const pulseAge = passImpact >= hit || !Number.isFinite(beatAge) ? age : beatAge;
    const reach = 22 + Math.min(1, pulseAge / .44) * 135;
    const glow = ctx.createRadialGradient(x, y + 18, 0, x, y + 18, reach);
    glow.addColorStop(0, frame.color);
    glow.addColorStop(.36, `${frame.color}86`);
    glow.addColorStop(1, `${frame.color}00`);
    ctx.filter = 'none';
    ctx.globalAlpha = impact * .62 * intro;
    ctx.fillStyle = glow;
    ctx.fillRect(x - reach, y + 18 - reach, reach * 2, reach * 2);
  }
  const tailDuration = handoff ? .85 : .34;
  if (tailAge < tailDuration) {
    const progress = tailAge / tailDuration;
    const from = x + progress * (handoff ? 120 : 36);
    const tail = ctx.createLinearGradient(from - 35, 0, from + 45, 0);
    const outgoing = handoff ? previous?.color ?? frame.color : frame.color;
    tail.addColorStop(0, outgoing);
    if (handoff) {
      tail.addColorStop(.47, `${outgoing}00`);
      tail.addColorStop(.49, `${frame.color}00`);
      tail.addColorStop(.63, frame.color);
    }
    tail.addColorStop(1, `${frame.color}00`);
    ctx.fillStyle = tail;
    ctx.globalAlpha = Math.min(1, progress * 12) * (1 - progress) * .78 * intro;
    ctx.filter = `blur(${5 + progress * 17}px)`;
    ctx.fillRect(from - 35, y, 80 + progress * 15, 36);
  }

  const flash = beatAge < .12;
  if (age < .36 || flash || Math.floor(age / .53) % 2 === 0) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = frame.color;
    ctx.filter = flash ? 'blur(2px)' : 'blur(1px)';
    ctx.beginPath();
    ctx.roundRect(x - 4.5, y, 9, 36, 2);
    ctx.fill();
  }
  ctx.filter = 'none';
  const wordAge = soundtrack ? beatAge : age;
  const fullLayout = replayFullLayout.checked;
  const wordFrame = replayFrames[wordIndex];
  const nextBeat = soundtrack?.peaks[beat + 1];
  const wordWindow = beat >= 0 && nextBeat !== undefined
    ? Math.min(.38, (nextBeat - soundtrack.peaks[beat]) * .9) : .38;
  if (replayWords.checked && wordFrame && wordAge >= 0 && wordAge < wordWindow) {
    let next = wordIndex + 1;
    while (replayFrames[next]?.type === 'move') next++;
    const nextEdit = replayFrames[next];
    const tokens = new Map();
    for (const word of wordFrame.lettering.words) {
      if (word.width > 0) tokens.set(word.offset, word.whole);
    }
    if (nextEdit?.type === 'edit' && wordFrame.type !== 'pass') {
      for (const word of nextEdit.lettering.words) {
        const token = tokens.get(word.offset);
        if (token && word.whole.length > token.length && word.whole.startsWith(token)) {
          tokens.delete(word.offset);
        }
      }
    }
    const offsets = [...tokens.keys()];
    const count = Math.min(fullLayout ? 3 : 1, offsets.length);
    const first = ((beat >= 0 ? beat : index) * count) % offsets.length;
    const reveals = new Map();
    for (let slot = 0; slot < count; slot++) {
      const delay = slot * wordWindow * .18;
      const duration = wordWindow * (count > 1 ? .64 : 1);
      const progress = (wordAge - delay) / duration;
      if (progress > 0 && progress < 1) {
        const offset = offsets[(first + slot) % offsets.length];
        const length = [...replayGraphemes.segment(tokens.get(offset))].length;
        reveals.set(offset, {
          remaining: Math.min(length, 1 + Math.floor(length * progress / .58)),
          opacity: Math.min(1, progress / .1, (1 - progress) / .34),
        });
      }
    }
    const scale = replayFontSize.valueAsNumber / 100;
    ctx.font = `${wordFrame.lettering.size * scale}px ${wordFrame.lettering.family}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = replayTextColor.value;
    const rowStarts = new Map();
    for (const word of wordFrame.lettering.words) {
      if (word.width <= 0) continue;
      const row = Math.round(word.y * height);
      if (!rowStarts.has(row)) rowStarts.set(row, word.x);
      const reveal = reveals.get(word.offset);
      if (!reveal?.remaining) continue;
      const start = rowStarts.get(row);
      ctx.globalAlpha = reveal.opacity;
      const letters = [...replayGraphemes.segment(word.text)];
      const visible = letters.slice(0, reveal.remaining).map(letter => letter.segment).join('');
      reveal.remaining -= Math.min(reveal.remaining, letters.length);
      const wordViewport = wordFrame.viewport;
      ctx.fillText(visible, (start + (word.x - start) * scale) * wordViewport.width,
        word.y * wordViewport.height, word.width * wordViewport.width * scale * visible.length / word.text.length);
    }
  }
  const tagOpacity = handoff ? Math.max(0, 1 - age / .85) : hit * .9;
  if (tagOpacity > 0) {
    const name = handoff && previous?.person !== frame.person && previous
      ? `${previous.person.name} → ${frame.person.name}` : frame.person.name;
    ctx.font = '600 16px monospace';
    ctx.textBaseline = 'middle';
    const tagWidth = ctx.measureText(name).width + 22;
    const left = Math.max(4, Math.min(x, width - tagWidth - 8));
    const top = Math.max(4, y - 31 - (1 - tagOpacity) * 8);
    ctx.globalAlpha = tagOpacity;
    const tint = ctx.createLinearGradient(left, 0, left + tagWidth, 0);
    tint.addColorStop(0, `${frame.color}aa`);
    tint.addColorStop(1, `${frame.color}18`);
    ctx.fillStyle = tint;
    ctx.fillRect(left, top, tagWidth, 24);
    ctx.fillStyle = '#171719';
    ctx.fillText(name, left + 9, top + 12);
  }
  ctx.restore();
}

function updateReplayControls() {
  const unavailable = !replayFrames.length || musicLoading || Boolean(playback);
  replayPlay.disabled = unavailable;
  replayExport.disabled = unavailable || !replayCanvas.captureStream || typeof MediaRecorder === 'undefined';
  replayStop.disabled = !playback;
  for (const control of replayAppearance) control.disabled = Boolean(playback?.recorder);
}

function stopReplay(save = false) {
  const run = playback;
  if (!run) return;
  playback = undefined;
  cancelAnimationFrame(run.frameRequest);
  run.source?.stop();
  run.source?.disconnect();
  if (run.recorder) {
    run.save = save;
    run.recorder.stop();
  }
  replayStatus.textContent = save ? 'Finished' : 'Stopped';
  updateReplayControls();
}

async function startReplay(exportVideo) {
  if (playback || !replayFrames.length || musicLoading) return;
  const timing = makeReplayTimeline();
  const run = {};
  playback = run;
  updateReplayControls();
  drawReplay();
  const end = soundtrack
    ? Math.min(soundtrack.buffer.duration, timing.at(-1) + .9)
    : timing.at(-1) + .9;

  try {
    if (soundtrack) {
      await audioContext.resume();
      if (playback !== run) return;
      run.source = audioContext.createBufferSource();
      run.source.buffer = soundtrack.buffer;
      run.source.connect(audioContext.destination);
    }
    if (exportVideo) {
      const stream = replayCanvas.captureStream(30);
      if (run.source) {
        const destination = audioContext.createMediaStreamDestination();
        run.source.connect(destination);
        for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
      }
      const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
        .find(type => MediaRecorder.isTypeSupported(type));
      const chunks = [];
      run.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      run.recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      run.recorder.onstop = () => {
        for (const track of stream.getTracks()) track.stop();
        if (!run.save || !chunks.length) return;
        const type = run.recorder.mimeType;
        const url = URL.createObjectURL(new Blob(chunks, { type }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `pass-the-code.${type.includes('mp4') ? 'mp4' : 'webm'}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      };
      run.recorder.start();
      updateReplayControls();
    }
    const clock = () => run.source ? audioContext.currentTime : performance.now() / 1000;
    const startedAt = clock();
    run.source?.start(startedAt, 0, end);
    replayStatus.textContent = exportVideo ? 'Recording video…' : 'Playing';
    let index = -1;
    let beat = -1;
    let wordIndex = -1;
    function tick() {
      const time = clock() - startedAt;
      while (timing[index + 1] <= time) index++;
      while (soundtrack?.peaks[beat + 1] <= time) beat++;
      while (timing[wordIndex + 1] <= soundtrack?.peaks[beat]) wordIndex++;
      drawReplay(replayFrames[index], replayFrames[index - 1], time - timing[index],
        beat < 0 ? Infinity : time - soundtrack.peaks[beat], index, beat, soundtrack ? wordIndex : index,
        Math.max(0, Math.min(1, (time - timing[0]) / .28)));
      if (time >= end) stopReplay(true);
      else run.frameRequest = requestAnimationFrame(tick);
    }
    tick();
  } catch {
    if (playback === run) {
      playback = undefined;
      run.source?.disconnect();
      if (run.recorder?.state === 'recording') run.recorder.stop();
      updateReplayControls();
      replayStatus.textContent = 'Could not start playback or recording.';
    }
  }
}

replayMusic.addEventListener('change', async () => {
  stopReplay();
  const request = ++musicRequest;
  const file = replayMusic.files[0];
  soundtrack = undefined;
  if (!file) {
    musicLoading = false;
    replayStatus.textContent = 'Playing with edit timing';
    updateReplayControls();
    return;
  }
  musicLoading = true;
  updateReplayControls();
  replayStatus.textContent = 'Analyzing music…';
  try {
    audioContext ??= new AudioContext();
    const buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
    if (request !== musicRequest) return;
    soundtrack = { buffer, peaks: findMusicOnsets(buffer) };
    replayStatus.textContent = soundtrack.peaks.length ? 'Music ready' : 'Music ready · using even timing';
  } catch {
    if (request === musicRequest) replayStatus.textContent = 'Could not read this MP3.';
  } finally {
    if (request === musicRequest) {
      musicLoading = false;
      updateReplayControls();
    }
  }
});

document.querySelector('#open-replay').addEventListener('click', () => {
  collectReplayFrames();
  const bounds = document.querySelector('#stage').getBoundingClientRect();
  replayCanvas.width = Math.round(bounds.width);
  replayCanvas.height = Math.round(bounds.height);
  drawReplay();
  updateReplayControls();
  replayStatus.textContent = replayFrames.length ? `${replayFrames.length} recorded events` : 'Type or pass in the editor to start recording.';
  replayDialog.showModal();
});
replayPlay.addEventListener('click', () => startReplay(false));
replayExport.addEventListener('click', () => startReplay(true));
replayStop.addEventListener('click', () => stopReplay());
for (const [editorPicker, replayPicker, property] of [
  [editorTextColor, replayTextColor, '--text-color'],
  [editorBackground, replayBackground, '--paper-color'],
]) {
  for (const picker of [editorPicker, replayPicker]) {
    picker.addEventListener('input', () => {
      editorPicker.value = picker.value;
      replayPicker.value = picker.value;
      document.documentElement.style.setProperty(property, picker.value);
    });
  }
}
for (const control of replayAppearance) {
  control.addEventListener('input', () => {
    if (!playback) drawReplay(replayFrames.at(-1), replayFrames.at(-2), .12, .12, replayFrames.length - 1);
  });
}
document.querySelector('#replay-close').addEventListener('click', () => replayDialog.close());
replayDialog.addEventListener('close', () => stopReplay());
