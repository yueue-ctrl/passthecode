const replayDialog = document.querySelector('#replay-dialog');
const replayCanvas = document.querySelector('#replay-canvas');
const replayDrawing = replayCanvas.getContext('2d');
const replayMusic = document.querySelector('#replay-music');
const replayWords = document.querySelector('#replay-words');
const replayFontSize = document.querySelector('#replay-font-size');
const replayInkStrength = document.querySelector('#replay-ink-strength');
const replayInkSize = document.querySelector('#replay-ink-size');
const replayAppearance = [replayWords, replayFontSize, replayInkStrength, replayInkSize];
const replayPlay = document.querySelector('#replay-play');
const replayStop = document.querySelector('#replay-stop');
const replayExport = document.querySelector('#replay-export');
const replayStatus = document.querySelector('#replay-status');

const replayFrames = [];
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
  const save = (text, rect, token) => words.push({
    text, offset: token.index, whole: token[0],
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
      save(letter, range.getBoundingClientRect(), match);
    }
  }
  const size = parseFloat(style.fontSize) * replayCanvas.height / bounds.height;
  return { words, size, family: style.fontFamily };
}

function recordReplayFrame(stage, point, person, type) {
  const now = performance.now();
  const bounds = stage.getBoundingClientRect();
  const previous = replayFrames.at(-1);
  const shapes = type === 'move' && previous ? previous.shapes
    : [...stage.querySelectorAll('#ink [data-person]')].map(element => {
      const rect = element.getBoundingClientRect();
      return {
        x: (rect.left - bounds.left) / bounds.width,
        y: (rect.top - bounds.top) / bounds.height,
        width: rect.width / bounds.width,
        height: rect.height / bounds.height,
        color: element.style.getPropertyValue('--wash-color'),
      };
    });
  replayFrames.push({
    type, person, color: person.color, shapes, time: now,
    lettering: type === 'move' && previous ? previous.lettering : captureReplayWords(stage, bounds),
    x: point.x / bounds.width,
    y: point.y / bounds.height,
  });
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

function drawReplay(frame, previous, age, beatAge, index = 0, beat = -1, wordIndex = index) {
  const ctx = replayDrawing;
  const { width, height } = replayCanvas;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  if (!frame) return;

  const hit = Number.isFinite(beatAge)
    ? Math.max(0, 1 - beatAge / .28)
    : frame.type === 'edit' && !soundtrack ? Math.max(0, 1 - age / .2) * .6 : 0;
  const inkScale = replayInkSize.valueAsNumber / 100;
  const inkStrength = replayInkStrength.valueAsNumber / 100;
  for (const [slot, shape] of frame.shapes.entries()) {
    const x = shape.x * width;
    const y = shape.y * height;
    const span = Math.max(5, shape.width * width) * inkScale;
    const blockHeight = shape.height * height;
    const tint = ctx.createLinearGradient(x, 0, x + span, 0);
    tint.addColorStop(0, shape.color);
    tint.addColorStop(1, `${shape.color}00`);
    const strength = (slot + index) % 3 === 0 ? .16 + hit * .64 : .32 + hit * .16;
    ctx.globalAlpha = Math.min(1, strength * inkStrength);
    ctx.filter = `blur(${4 + hit * 4}px)`;
    ctx.fillStyle = tint;
    ctx.fillRect(x, y + blockHeight * (1 - inkScale) / 2, span, blockHeight * inkScale);
  }

  const textScale = replayWords.checked ? replayFontSize.valueAsNumber / 100 : 1;
  const caretRow = frame.lettering.words.find(word => Math.abs((word.y - frame.y) * height - 18) < 12);
  const rowStart = caretRow?.x ?? frame.x;
  const caretX = rowStart + (frame.x - rowStart) * textScale;
  const x = Math.max(4, Math.min(width - 8, caretX * width));
  const y = Math.max(4, Math.min(height - 42, frame.y * height));
  const tailAge = Math.max(0, age);
  const handoff = frame.type === 'pass';
  const impact = Math.max(hit, handoff ? Math.max(0, 1 - age / .66) : 0);
  if (impact > 0) {
    const reach = 22 + (1 - impact) * 135;
    const glow = ctx.createRadialGradient(x, y + 18, 0, x, y + 18, reach);
    glow.addColorStop(0, frame.color);
    glow.addColorStop(.36, `${frame.color}86`);
    glow.addColorStop(1, `${frame.color}00`);
    ctx.filter = 'none';
    ctx.globalAlpha = impact * .46;
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
    ctx.globalAlpha = Math.min(1, progress * 12) * (1 - progress) * .78;
    ctx.filter = `blur(${2 + progress * 9}px)`;
    ctx.fillRect(from - 35, y, 80 + progress * 15, 36);
  }

  const flash = beatAge < .12;
  if (age < .36 || flash || Math.floor(age / .53) % 2 === 0) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = frame.color;
    ctx.filter = flash ? 'blur(2px)' : 'blur(1px)';
    ctx.fillRect(x - 4, y, flash ? 11 : 8, 36);
  }
  ctx.filter = 'none';
  const wordAge = soundtrack ? beatAge : age;
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
    const selected = offsets[(beat >= 0 ? beat : index) % offsets.length];
    const scale = textScale;
    ctx.font = `${wordFrame.lettering.size * scale}px ${wordFrame.lettering.family}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#171719';
    const rowStarts = new Map();
    for (const word of wordFrame.lettering.words) {
      if (word.width <= 0) continue;
      const row = Math.round(word.y * height);
      if (!rowStarts.has(row)) rowStarts.set(row, word.x);
      if (word.offset !== selected) continue;
      const start = rowStarts.get(row);
      ctx.globalAlpha = Math.min(1, wordAge / .035, (wordWindow - wordAge) / (wordWindow * .45));
      ctx.fillText(word.text, (start + (word.x - start) * scale) * width, word.y * height, word.width * width * scale);
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
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
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
        beat < 0 ? Infinity : time - soundtrack.peaks[beat], index, beat, soundtrack ? wordIndex : index);
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
  drawReplay();
  updateReplayControls();
  replayStatus.textContent = replayFrames.length ? `${replayFrames.length} recorded events` : 'Type or pass in the editor to start recording.';
  replayDialog.showModal();
});
replayPlay.addEventListener('click', () => startReplay(false));
replayExport.addEventListener('click', () => startReplay(true));
replayStop.addEventListener('click', () => stopReplay());
for (const control of replayAppearance) {
  control.addEventListener('input', () => {
    if (!playback) drawReplay(replayFrames.at(-1), replayFrames.at(-2), .12, .12, replayFrames.length - 1);
  });
}
document.querySelector('#replay-close').addEventListener('click', () => replayDialog.close());
replayDialog.addEventListener('close', () => stopReplay());
