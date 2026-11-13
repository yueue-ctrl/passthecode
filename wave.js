const copy = document.querySelector('#copy');
const composition = document.querySelector('#composition');
const bands = document.querySelector('#bands');
const poster = document.querySelector('#poster');
const playButton = document.querySelector('#play');
const musicInput = document.querySelector('#music');
const mode = document.querySelector('#mode');
const trackName = document.querySelector('#track-name');
const response = document.querySelector('#intensity');
const spread = document.querySelector('#spread');
const typeSize = document.querySelector('#size');
const colorMode = document.querySelector('#color-mode');
const colorSeed = document.querySelector('#seed');
const waveColors = ['#efff35', '#8dff00', '#00e2fa', '#1299ff', '#ff00c8'];
let colorPhase = 0;
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let phrases = [];
let running = !reducedMotion.matches;
let phase = 0;
let lastTime;
let audioContext;
let analyser;
let source;
let audioBuffer;
let frequencyData;
let audio;
let audioUrl;
let loadVersion = 0;
let smoothedEnergy = 0;
let smoothedLow = 0;

const glyphContext = document.createElement('canvas').getContext('2d');
const glyphMetrics = new Map();
function measureGlyph(text, size, weight) {
  const roundedWeight = Math.round(weight / 10) * 10;
  const key = `${text}:${size}:${roundedWeight}`;
  if (!glyphMetrics.has(key)) {
    glyphContext.font = `${roundedWeight} ${size}px "Inter Wave"`;
    glyphMetrics.set(key, glyphContext.measureText(text));
    if (glyphMetrics.size > 5000) glyphMetrics.delete(glyphMetrics.keys().next().value);
  }
  return glyphMetrics.get(key);
}
function glyphBounds(phrase, rect, size) {
  let top = Infinity;
  let bottom = -Infinity;
  const letters = phrase.letters.length ? phrase.letters : [phrase.element];
  for (const letter of letters) {
    const box = letter.getBoundingClientRect();
    if (box.bottom <= rect.top || box.top >= rect.bottom || box.right <= rect.left || box.left >= rect.right) continue;
    const weight = parseFloat(letter.style.getPropertyValue('--weight')) || 400;
    const text = letter.textContent.trim() || 'H';
    const metrics = measureGlyph(text, size, weight);
    const ascent = metrics.fontBoundingBoxAscent;
    const descent = metrics.fontBoundingBoxDescent;
    const baseline = box.top + (box.height - ascent - descent) / 2 + ascent;
    // All bands share the cap/ascender top, even for x-height-only words like 'pass'.
    const topReference = measureGlyph('Hh', size, weight);
    top = Math.min(top, baseline - Math.max(metrics.actualBoundingBoxAscent, topReference.actualBoundingBoxAscent));
    bottom = Math.max(bottom, baseline + metrics.actualBoundingBoxDescent);
  }
  return Number.isFinite(top) && bottom > top ? { top, bottom } : { top: rect.top, bottom: rect.bottom };
}

function rebuild() {
  const fragment = document.createDocumentFragment();
  const nextPhrases = [];
  const blocks = copy.value.split(/\n\s*\n/u);
  const roles = ['headline', 'subtitle', 'invitation', 'schedule', 'address'];
  const layoutBlocks = blocks.flatMap((text, index) => {
    if (index === 2 && /^join\s+us$/iu.test(text.trim())) {
      const words = text.trim().split(/\s+/u);
      return [{ text: words[0], role: 'join' }, { text: words[1], role: 'us' }];
    }
    return [{ text, role: roles[index] ?? 'extra' }];
  });
  for (const { text: block, role } of layoutBlocks) {
    const paragraph = document.createElement('p');
    paragraph.className = `copy-block layout-${role}`;
    for (const token of wordSegmenter.segment(block)) {
      const element = document.createElement('span');
      element.className = token.isWordLike ? 'wave-word' : 'wave-space';
      const letters = [];
      if (token.isWordLike) {
        for (const { segment } of graphemeSegmenter.segment(token.segment)) {
          const letter = document.createElement('span');
          letter.className = 'wave-letter';
          letter.textContent = segment;
          element.append(letter);
          letters.push(letter);
        }
      } else {
        element.textContent = token.segment;
      }
      paragraph.append(element);
      nextPhrases.push({
        element, letters, bands: [], energy: .4,
        pause: /[.!?。！？,，;；:：\n]/u.test(token.segment) ? .65 : 0,
      });
    }
    fragment.append(paragraph);
  }
  glyphMetrics.clear();
  composition.replaceChildren(fragment);
  bands.replaceChildren();
  phrases = nextPhrases;
}

function readEnergy() {
  if (!analyser || !audio || audio.paused) return;
  analyser.getFloatTimeDomainData(audioBuffer);
  let total = 0;
  for (const sample of audioBuffer) total += sample * sample;
  const rms = Math.min(1, Math.sqrt(total / audioBuffer.length) * 4.8);
  analyser.getByteFrequencyData(frequencyData);
  let low = 0;
  const bins = Math.max(1, Math.floor(220 * analyser.fftSize / audioContext.sampleRate));
  for (let index = 1; index <= bins; index++) low += frequencyData[index] / 255;
  const bass = Math.min(1, low / bins);
  smoothedEnergy += (rms - smoothedEnergy) * (rms > smoothedEnergy ? .45 : .09);
  smoothedLow += (bass - smoothedLow) * .2;
}

function draw(time) {
  const delta = Math.min(.06, lastTime === undefined ? 0 : (time - lastTime) / 1000);
  lastTime = time;
  if (running) {
    readEnergy();
    phase += delta * (audio ? .9 + smoothedLow * 1.3 : 1.1);
    colorPhase += delta * (audio ? .35 + smoothedEnergy * .75 + smoothedLow * .4 : .6);
  }
  const strength = response.valueAsNumber / 100;
  const bloom = spread.valueAsNumber / 100;
  const bounds = poster.getBoundingClientRect();
  const infoRows = [];
  if (Number(poster.style.getPropertyValue('--line-spacing')) === 0) {
    for (const phrase of phrases) {
      if (!phrase.element.closest('.layout-schedule, .layout-address')) continue;
      const size = parseFloat(getComputedStyle(phrase.element).fontSize);
      for (const rect of phrase.element.getClientRects()) {
        if (rect.width <= .1) continue;
        const ink = glyphBounds(phrase, rect, size);
        const row = infoRows.find(row => Math.abs(row.rectTop - rect.top) < 2);
        if (row) {
          row.top = Math.min(row.top, ink.top);
          row.bottom = Math.max(row.bottom, ink.bottom);
        } else infoRows.push({ rectTop: rect.top, ...ink });
      }
    }
    infoRows.sort((a, b) => a.rectTop - b.rectTop);
    for (let i = 0; i < infoRows.length - 1; i++) infoRows[i].bottom = Math.max(infoRows[i].bottom, infoRows[i + 1].top);
  }
  const passPhrase = phrases.find(phrase => phrase.element.closest('.layout-headline') && phrase.element.textContent.toLowerCase() === 'pass');
  const creativePhrase = phrases.find(phrase => phrase.element.closest('.layout-subtitle') && phrase.element.textContent.toLowerCase() === 'creative');
  for (const [index, phrase] of phrases.entries()) {
    let color = waveColors[index % waveColors.length];
    let colorCycle = 0;
    if (colorMode.value !== 'original') {
      let hash = Math.imul((Number(colorSeed.value) >>> 0) ^ (index + 1), 1597334677);
      hash = Math.imul(hash ^ (hash >>> 16), 2246822507) >>> 0;
      const offset = ((hash >>> 8) % 1000) / 1000;
      const position = hash % waveColors.length + (colorMode.value === 'music' ? colorPhase + offset : 0);
      const from = Math.floor(position) % waveColors.length;
      colorCycle = position % 1;
      color = waveColors[from];
    }
    const wave = (Math.sin(phase * 2.1 - index * .68 - phrase.pause) + 1) / 2;
    const music = audio ? smoothedEnergy * .75 + smoothedLow * .25 : .58;
    const target = Math.min(1, (.055 + music * (.17 + wave * .95)) * strength);
    if (phrase === creativePhrase && passPhrase) {
      // Derive the second envelope from the first, avoiding independent smoothing drift.
      const floor = Math.min(.055, strength);
      const ceiling = Math.min(1, strength);
      phrase.energy = floor + ceiling - Math.max(floor, Math.min(ceiling, passPhrase.energy));
    } else if (running) phrase.energy += (target - phrase.energy) * .18;
    const energy = phrase.energy;
    const typeStyle = getComputedStyle(phrase.element.parentElement);
    const lineHeight = parseFloat(typeStyle.lineHeight);
    const fontSize = parseFloat(typeStyle.fontSize);
    const rects = [];
    for (const rect of phrase.element.getClientRects()) {
      if (rect.width <= .1) continue;
      const line = rects.find(line => Math.abs(line.top - rect.top) < lineHeight * .4);
      if (line) {
        line.left = Math.min(line.left, rect.left);
        line.right = Math.max(line.right, rect.right);
        line.width = line.right - line.left;
        line.top = Math.min(line.top, rect.top);
        line.bottom = Math.max(line.bottom, rect.bottom);
        line.height = line.bottom - line.top;
      } else {
        rects.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height });
      }
    }
    while (phrase.bands.length > rects.length) phrase.bands.pop().remove();
    for (const [line, rect] of rects.entries()) {
      let band = phrase.bands[line];
      if (!band) {
        band = document.createElement('div');
        band.className = 'color-band';
        phrase.bands.push(band);
        bands.append(band);
      }
      // Measure visible glyph ink, not the font's extra ascent/descent padding.
      let { top: bandTop, bottom: bandBottom } = glyphBounds(phrase, rect, fontSize);
      if (phrase.element.closest('.layout-schedule, .layout-address')) {
        const row = infoRows.find(row => Math.abs(row.rectTop - rect.top) < 2);
        if (row) {
          const density = devicePixelRatio || 1;
          bandTop = Math.floor(row.top * density) / density;
          bandBottom = Math.ceil(row.bottom * density) / density;
        }
      }
      // Horizontal boundaries still belong precisely to each word or space.
      band.style.setProperty('--color', color);
      band.style.left = rect.left - bounds.left + 'px';
      band.style.top = bandTop - bounds.top + 'px';
      band.style.width = rect.width + 'px';
      band.style.height = bandBottom - bandTop + 'px';
      band.style.setProperty('--blur-scale', fontSize / 72);
      // Fade at the color boundary, then reveal the next palette color.
      const colorFade = colorMode.value === 'music'
        ? Math.min(1, colorCycle / .14, (1 - colorCycle) / .14)
        : 1;
      band.style.opacity = ((.12 + Math.sqrt(energy) * .88) * colorFade).toFixed(3);
      band.style.setProperty('--reach', Math.min(85, 55 * bloom) + '%');
    }
    for (const letter of phrase.letters) {
      const rect = letter.getBoundingClientRect();
      const line = rects.find(line => rect.top < line.bottom && rect.bottom > line.top && rect.left < line.right);
      if (!line) continue;
      const progress = Math.max(0, Math.min(1, (rect.left + rect.width / 2 - line.left) / line.width));
      const tint = Math.max(.035, 1 - progress / Math.max(.4, bloom * 1.12));
      const weight = 100 + energy * tint * 800;
      letter.style.setProperty('--weight', weight.toFixed(1));
    }
  }
  requestAnimationFrame(draw);
}

async function togglePlay() {
  try {
    if (audio) {
      if (running) audio.pause();
      else {
        await audioContext.resume();
        await audio.play();
      }
    }
    running = !running;
    updateStatus();
  } catch {
    mode.textContent = 'Playback could not start';
  }
}

function updateStatus() {
  playButton.textContent = running ? 'Pause' : 'Play';
  mode.textContent = audio ? (running ? 'Music → color → weight' : 'Music paused') : (running ? 'Demo wave' : 'Wave paused');
}

musicInput.addEventListener('change', async () => {
  const file = musicInput.files[0];
  if (!file) return;
  const version = ++loadVersion;
  playButton.disabled = true;
  trackName.textContent = 'Loading music…';
  document.body.classList.add('cursor-loading');
  try {
    audioContext ??= new AudioContext();
    await audioContext.resume();
    // Decode first, so an unsupported file never replaces the current track.
    const decoded = await audioContext.decodeAudioData(await file.arrayBuffer());
    if (version !== loadVersion) return;
    if (!decoded.duration) throw new Error('Empty track');
    audio?.pause();
    source?.disconnect();
    analyser?.disconnect();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(file);
    audio = new Audio(audioUrl);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source = audioContext.createMediaElementSource(audio);
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    audioBuffer = new Float32Array(analyser.fftSize);
    running = false;
    smoothedEnergy = smoothedLow = 0;
    audio.addEventListener('ended', () => { running = false; updateStatus(); });
    trackName.textContent = file.name;
    updateStatus();
  } catch {
    if (version === loadVersion) trackName.textContent = 'Could not read this audio file.';
  } finally {
    if (version === loadVersion) {
      playButton.disabled = false;
      document.body.classList.remove('cursor-loading');
    }
  }
});
copy.addEventListener('input', rebuild);
playButton.addEventListener('click', togglePlay);
for (const control of [response, spread, typeSize]) {
  control.addEventListener('input', () => {
    document.querySelector('#' + control.id + '-value').value = control.value + '%';
    if (control === typeSize) poster.style.setProperty('--type-scale', control.valueAsNumber / 100);
  });
}
for (const id of ['tracking', 'word-gap']) {
  const control = document.getElementById(id);
  control.addEventListener('input', () => {
    const spacing = control.valueAsNumber / 100;
    poster.style.setProperty('--' + id, spacing + 'em');
    document.getElementById(id + '-value').value = spacing.toFixed(2) + ' em';
  });
}
const lineSpacing = document.querySelector('#line-spacing');
poster.style.setProperty('--line-spacing', lineSpacing.valueAsNumber / 100);
lineSpacing.addEventListener('input', () => {
  poster.style.setProperty('--line-spacing', lineSpacing.valueAsNumber / 100);
  document.querySelector('#line-spacing-value').value = lineSpacing.value === '0'
    ? 'Touching' : lineSpacing.value === '100' ? 'Original' : lineSpacing.value + '%';
});
const gradientBlur = document.querySelector('#blur');
gradientBlur.addEventListener('input', () => {
  poster.style.setProperty('--gradient-blur', gradientBlur.value + 'px');
  document.querySelector('#blur-value').value = gradientBlur.value;
});
document.querySelector('#refresh-seed').addEventListener('click', () => {
  colorSeed.value = crypto.getRandomValues(new Uint32Array(1))[0];
  if (colorMode.value === 'original') colorMode.value = 'seed';
});
colorSeed.addEventListener('change', () => {
  if (!colorSeed.checkValidity() || colorSeed.value === '') colorSeed.value = '42';
  if (colorMode.value === 'original') colorMode.value = 'seed';
});
rebuild();
updateStatus();
requestAnimationFrame(draw);

document.fonts.ready.then(() => glyphMetrics.clear());
