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
const posterFormat = document.querySelector('#poster-format');
const rotatingWord = document.querySelector('#rotating-word');
const passWords = ['code', 'possibility', 'idea', 'imagination', 'spark', 'unexpected', 'mic', 'surprise', 'bug', 'fun', 'challenge', 'lead'];
let wordTransition = { state: 'hold', age: 0 };
let keywordOpacity = 1;
let smoothBannerFit;
const wordEase = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
function setPassWord(word) {
  const match = copy.value.trim().match(/^(pass\s+the\s+)(\S+)$/iu);
  const prefix = match ? match[1] : 'pass the ';
  const energies = phrases.map(phrase => phrase.energy);
  copy.value = prefix + word;
  formatCopies[posterFormat.value] = copy.value;
  rebuild();
  phrases.forEach((phrase, index) => { phrase.energy = energies[index] ?? .4; });
}
function updatePassWord(delta) {
  if (!['single', 'grid'].includes(posterFormat.value) || rotatingWord.value !== 'auto' || !running
    || document.activeElement === copy || !/^pass\s+the\s+\S+$/iu.test(copy.value.trim())) return;
  const grid = posterFormat.value === 'grid';
  if (grid) {
    const position = gridClock * document.querySelector('#grid-speed').valueAsNumber / 100 / 2.4;
    const cycle = Math.floor(position), progress = position - cycle;
    if (progress < .76) { wordTransition.state = 'hold'; keywordOpacity = 1; }
    else if (progress < .835) {
      wordTransition.state = 'out';
      keywordOpacity = 1 - wordEase((progress - .76) / .075);
    } else {
      if (gridWordCycle !== cycle) {
        const current = copy.value.trim().split(/\s+/u).at(-1).toLowerCase();
        setPassWord(passWords[(passWords.indexOf(current) + 1) % passWords.length]);
        gridWordCycle = cycle;
      }
      wordTransition.state = 'in';
      keywordOpacity = wordEase((progress - .835) / .105);
    }
    return;
  }
  const exitDuration = grid ? .18 : .28;
  const enterDelay = grid ? .03 : .12;
  const enterDuration = grid ? .22 : .3;
  wordTransition.age += delta;
  if (wordTransition.state === 'hold' && wordTransition.age >= 3.2) wordTransition = { state: 'out', age: 0 };
  if (wordTransition.state === 'out') {
    keywordOpacity = 1 - wordEase(wordTransition.age / exitDuration);
    if (wordTransition.age >= exitDuration) {
      const current = copy.value.trim().split(/\s+/u).at(-1).toLowerCase();
      setPassWord(passWords[(passWords.indexOf(current) + 1) % passWords.length]);
      wordTransition = { state: 'in', age: 0 };
      keywordOpacity = 0;
    }
  } else if (wordTransition.state === 'in') {
    keywordOpacity = wordEase((wordTransition.age - enterDelay) / enterDuration);
    if (wordTransition.age >= enterDelay + enterDuration) { wordTransition = { state: 'hold', age: 0 }; keywordOpacity = 1; }
  } else keywordOpacity = 1;
}
let previousFormat = 'poster';
const formatCopies = { poster: copy.value, single: 'pass the code', grid: 'pass the code' };
let gridClock = 0;
let gridWordCycle = -1;
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
  const layoutBlocks = posterFormat.value === 'single'
    ? [{ text: copy.value.replace(/\s*\n\s*/gu, ' '), role: 'banner' }]
    : posterFormat.value === 'grid'
      ? [{ text: copy.value.replace(/\s*\n\s*/gu, ' '), role: 'grid-row' }]
      : blocks.flatMap((text, index) => {
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
      const keyword = ['banner', 'grid-row'].includes(role) ? block.match(/^pass\s+the\s+/iu) : null;
      if (keyword && token.index === keyword[0].length) element.classList.add('rotation-keyword');
      if (keyword && token.isWordLike && token.index < keyword[0].length) element.classList.add('rotation-anchor');
      const letters = [];
      let letterHost = element;
      if (role === 'banner' && token.isWordLike) {
        letterHost = document.createElement('span');
        letterHost.className = element.classList.contains('rotation-keyword') ? 'word-ink keyword-emphasis' : 'word-ink prefix-emphasis';
        element.append(letterHost);
      }
      if (token.isWordLike) {
        for (const { segment } of graphemeSegmenter.segment(token.segment)) {
          const letter = document.createElement('span');
          letter.className = 'wave-letter';
          letter.textContent = segment;
          letterHost.append(letter);
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
  updatePassWord(running ? delta : 0);
  const strength = response.valueAsNumber / 100;
  const bloom = spread.valueAsNumber / 100;
  if (posterFormat.value === 'grid') {
    if (running) gridClock += delta * (audio ? .92 + smoothedLow * .16 : 1);
    renderKineticGrid({ poster, composition, phrases, clock: gridClock,
      amount: document.querySelector('#grid-motion').valueAsNumber / 100,
      speed: document.querySelector('#grid-speed').valueAsNumber / 100,
      colors: waveColors, colorMode: colorMode.value, colorPhase, seed: Number(colorSeed.value) >>> 0,
      music: audio ? smoothedEnergy * .75 + smoothedLow * .25 : .58,
      keywordOpacity, running, strength, blur: document.querySelector('#blur').valueAsNumber,
      tracking: -.055 + document.querySelector('#tracking').valueAsNumber / 100,
      wordGap: document.querySelector('#word-gap').valueAsNumber / 100,
      lineGap: document.querySelector('#line-spacing').valueAsNumber / 100 * 8, reach: bloom,
      typeScale: typeSize.valueAsNumber / 100, measure: (text, weight) => measureGlyph(text, 100, weight) });
    requestAnimationFrame(draw);
    return;
  }
  const singleLine = posterFormat.value === 'single';
  let bannerFit = 1;
  if (singleLine) {
    const text = composition.firstElementChild;
    const naturalWidth = text?.offsetWidth || 1;
    const targetFit = poster.clientWidth / naturalWidth * typeSize.valueAsNumber / 100;
    smoothBannerFit = smoothBannerFit === undefined ? targetFit : smoothBannerFit + (targetFit - smoothBannerFit) * (1 - Math.exp(-Math.max(.001, delta) * 14));
    bannerFit = smoothBannerFit;
    composition.style.setProperty('--banner-fit', bannerFit);
    const metrics = measureGlyph(text.textContent || 'H', 100, 900);
    const opticalOffset = (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent
      - metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent) / 2;
    composition.style.setProperty('--banner-y', `${opticalOffset * bannerFit}px`);
  }
  const bounds = poster.getBoundingClientRect();
  if (posterFormat.value === 'poster') {
    const headline = phrases.filter(p => p.element.closest('.layout-headline'));
    const top = Math.min(...headline.map(p => glyphBounds(p, p.element.getBoundingClientRect(), parseFloat(getComputedStyle(p.element).fontSize) * 1.18).top));
    if (Number.isFinite(top)) {
      const current = parseFloat(composition.style.getPropertyValue('--poster-top')) || 0;
      composition.style.setProperty('--poster-top', `${current - (top - bounds.top)}px`);
    }
  }

  const infoRows = [];
  if (Number(poster.style.getPropertyValue('--line-spacing')) === 0) {
    for (const phrase of phrases) {
      if (!phrase.element.closest('.layout-schedule, .layout-address')) continue;
      const size = parseFloat(getComputedStyle(phrase.element).fontSize) * (posterFormat.value === 'poster' ? 1.18 : 1);
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
    } else if (running && !(singleLine && wordTransition.state !== 'hold' && phrase.element.classList.contains('rotation-anchor'))) phrase.energy += (target - phrase.energy) * .18;
    const energy = phrase.energy;
    const wordFade = singleLine && phrase.element.classList.contains('rotation-keyword') ? keywordOpacity : 1;
    phrase.element.style.opacity = wordFade;
    const typeStyle = getComputedStyle(phrase.element.parentElement);
    const lineHeight = parseFloat(typeStyle.lineHeight);
    const fontSize = parseFloat(typeStyle.fontSize) * (posterFormat.value === 'poster' ? 1.18 : 1);
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
      if (singleLine) { bandTop = bounds.top; bandBottom = bounds.bottom; }
      // Horizontal boundaries still belong precisely to each word or space.
      band.style.setProperty('--color', color);
      band.style.left = rect.left - bounds.left + 'px';
      band.style.top = bandTop - bounds.top + 'px';
      band.style.width = rect.width + 'px';
      band.style.height = bandBottom - bandTop + 'px';
      band.style.setProperty('--blur-scale', fontSize * bannerFit / 72);
      // Fade at the color boundary, then reveal the next palette color.
      const colorFade = colorMode.value === 'music'
        ? Math.min(1, colorCycle / .14, (1 - colorCycle) / .14)
        : 1;
      band.style.opacity = ((.12 + Math.sqrt(energy) * .88) * colorFade * (singleLine ? 1 : wordFade)).toFixed(3);
      band.style.setProperty('--reach', Math.min(85, 55 * bloom) + '%');
    }
    for (const letter of phrase.letters) {
      const rect = letter.getBoundingClientRect();
      const line = rects.find(line => rect.top < line.bottom && rect.bottom > line.top && rect.left < line.right);
      if (!line) continue;
      const progress = Math.max(0, Math.min(1, (rect.left + rect.width / 2 - line.left) / line.width));
      const tint = Math.max(.035, 1 - progress / Math.max(.4, bloom * 1.12));
      const handoffWeight = singleLine && phrase.element.classList.contains('rotation-keyword') ? .35 + .65 * keywordOpacity : 1;
      const weight = 100 + energy * tint * 800 * handoffWeight;
      letter.style.setProperty('--weight', weight.toFixed(1));
    }
  }
  if (singleLine) {
    const text = composition.firstElementChild;
    // Read the final layout after the emphasis word has pushed the prefix to the left.
    for (const phrase of phrases) {
      const rect = phrase.element.getBoundingClientRect();
      const band = phrase.bands[0];
      if (!band) continue;
      band.style.left = `${rect.left - bounds.left}px`;
      band.style.width = `${rect.width}px`;
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
posterFormat.addEventListener('change', () => {
  poster.gridMotionStart = null;
  poster.gridLastLayout = null;
  gridClock = 0;
  gridWordCycle = -1;
  wordTransition = { state: 'hold', age: 0 };
  keywordOpacity = 1;
  smoothBannerFit = undefined;
  formatCopies[previousFormat] = copy.value;
  previousFormat = posterFormat.value;
  copy.value = formatCopies[previousFormat];
  poster.classList.toggle('single-line', previousFormat === 'single');
  poster.classList.toggle('grid-mode', previousFormat === 'grid');
  document.querySelector('.workspace').classList.toggle('grid-format', previousFormat === 'grid');
  document.querySelector('.workspace').classList.toggle('poster-format', previousFormat === 'poster');
  document.querySelector('.workspace').classList.toggle('single-format', previousFormat !== 'poster');
  const workspace = document.querySelector('.workspace');
  workspace.classList.remove('controls-open');
  const toggle = document.querySelector('#wave-settings-toggle');
  toggle.hidden = false;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = 'Settings';
  document.querySelector('.settings').inert = true;
  rebuild();
});
document.querySelector('#wave-settings-toggle').addEventListener('click', event => {
  const open = document.querySelector('.workspace').classList.toggle('controls-open');
  document.querySelector('.settings').inert = !open;
  event.currentTarget.setAttribute('aria-expanded', String(open));
  event.currentTarget.textContent = open ? 'Close settings' : 'Settings';
});
rotatingWord.addEventListener('change', () => {
  wordTransition = { state: 'hold', age: 0 };
  keywordOpacity = 1;
  if (rotatingWord.value !== 'auto') setPassWord(rotatingWord.value);
});
copy.addEventListener('input', () => {
  wordTransition = { state: 'hold', age: 0 }; keywordOpacity = 1; rebuild();
});
playButton.addEventListener('click', togglePlay);
for (const id of ['grid-motion', 'grid-speed']) document.querySelector('#' + id).addEventListener('input', event => {
  document.querySelector('#' + id + '-value').value = id === 'grid-motion' ? event.target.value + '%' : (event.target.valueAsNumber / 100).toFixed(1) + '×';
});
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
