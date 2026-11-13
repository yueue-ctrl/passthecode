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

function rebuild() {
  const fragment = document.createDocumentFragment();
  const nextPhrases = [];
  const colors = ['#efff35', '#8dff00', '#00e2fa', '#1299ff', '#ff00c8'];
  for (const block of copy.value.split(/\n\s*\n/u)) {
    const paragraph = document.createElement('p');
    paragraph.className = 'copy-block';
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
        color: colors[nextPhrases.length % colors.length],
        pause: /[.!?。！？,，;；:：\n]/u.test(token.segment) ? .65 : 0,
      });
    }
    fragment.append(paragraph);
  }
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
  }
  const strength = response.valueAsNumber / 100;
  const bloom = spread.valueAsNumber / 100;
  const bounds = poster.getBoundingClientRect();
  for (const [index, phrase] of phrases.entries()) {
    const wave = (Math.sin(phase * 2.1 - index * .68 - phrase.pause) + 1) / 2;
    const music = audio ? smoothedEnergy * .75 + smoothedLow * .25 : .58;
    const target = Math.min(1, (.055 + music * (.17 + wave * .95)) * strength);
    if (running) phrase.energy += (target - phrase.energy) * .18;
    const energy = phrase.energy;
    const lineHeight = parseFloat(getComputedStyle(phrase.element.parentElement).lineHeight);
    const rects = [];
    for (const rect of phrase.element.getClientRects()) {
      if (rect.width <= .1) continue;
      const line = rects.find(line => Math.abs(line.top - rect.top) < lineHeight * .4);
      if (line) {
        line.left = Math.min(line.left, rect.left);
        line.right = Math.max(line.right, rect.right);
        line.width = line.right - line.left;
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
        band.style.setProperty('--color', phrase.color);
        phrase.bands.push(band);
        bands.append(band);
      }
      // Each gradient owns precisely its word or whitespace rectangle.
      band.style.left = rect.left - bounds.left + 'px';
      band.style.top = rect.top - bounds.top - (lineHeight - rect.height) / 2 + 'px';
      band.style.width = rect.width + 'px';
      band.style.height = lineHeight + 'px';
      band.style.opacity = (.1 + energy * .85).toFixed(3);
      band.style.setProperty('--reach', Math.min(95, 48 * bloom) + '%');
      band.style.filter = 'blur(3px)';
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
    if (version === loadVersion) playButton.disabled = false;
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
rebuild();
updateStatus();
requestAnimationFrame(draw);
