const cursorLibrary = document.querySelector('#cursor-library');
const cursorToggle = document.querySelector('#cursor-library-toggle');
const cursorClose = document.querySelector('#cursor-library-close');
const cursorGrid = document.querySelector('#cursor-grid');
const cursorPalette = document.querySelector('#cursor-palette');
const cursorTest = document.querySelector('#cursor-test');
const cursorTestImage = document.querySelector('#cursor-test-image');
const cursorTestName = document.querySelector('#cursor-test-name');
const cursorEnable = document.querySelector('#cursor-enable');
const cursorRoot = document.documentElement;

const cursorColors = [
  ['Lemon', '#efff35'], ['Lime', '#8dff00'], ['Cyan', '#00e2fa'],
  ['Blue', '#1299ff'], ['Magenta', '#ff00c8'],
];
const cursorStyles = [
  { id: 'normal', name: 'Normal', fallback: 'default', hot: [9, 6] },
  { id: 'text', name: 'Text', fallback: 'text', hot: [24, 24] },
  { id: 'link', name: 'Hand / select', fallback: 'pointer', hot: [24, 5] },
  { id: 'drag', name: 'Drag', fallback: 'grabbing', hot: [9, 6] },
  { id: 'loading', name: 'Loading', fallback: 'progress', hot: [24, 24] },
  { id: 'horizontal', name: 'Resize ↔', fallback: 'ew-resize', hot: [24, 24] },
  { id: 'vertical', name: 'Resize ↕', fallback: 'ns-resize', hot: [24, 24] },
  { id: 'diagonal-1', name: 'Resize ↗', fallback: 'nesw-resize', hot: [24, 24] },
  { id: 'diagonal-2', name: 'Resize ↘', fallback: 'nwse-resize', hot: [24, 24] },
  { id: 'move', name: 'Move', fallback: 'move', hot: [24, 24] },
];

let previewColor = cursorColors[1][1];
let selectedCursor = cursorStyles[0];
let lastEditorColor;

let cursorSize = Math.max(24, Math.min(96, Number(localStorage.getItem('pass-cursor-size')) || 48));
const cursorLayouts = new Map();
function cursorLayout(style, shape) {
  if (cursorLayouts.has(style.id)) return cursorLayouts.get(style.id);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none';
  svg.innerHTML = `<g>${shape}</g>`;
  document.body.append(svg);
  const box = svg.firstElementChild.getBBox();
  svg.remove();
  const scale = 36 / Math.max(box.width, box.height);
  const layout = { scale, x: 24 - (box.x + box.width / 2) * scale, y: 24 - (box.y + box.height / 2) * scale };
  cursorLayouts.set(style.id, layout);
  return layout;
}
function cursorUrl(asset, style) {
  const layout = cursorLayouts.get(style.id);
  const hot = style.hot.map((value, axis) => Math.round((value * layout.scale + (axis ? layout.y : layout.x)) * cursorSize / 48));
  return `url("${asset}") ${hot.join(' ')}, ${style.fallback}`;
}

function cursorAsset(style, color, press = 0, loadingPhase = 0) {
  const shaded = amount => {
    const channels = color.match(/[a-f0-9]{2}/gi).map(channel => Math.round(parseInt(channel, 16) * (1 - amount)));
    return `rgb(${channels.join(',')})`;
  };
  // Reuse Normal's exact silhouette with only rotation and uniform scaling.
  const normalAngle = Math.atan2(27, 24.75) * 180 / Math.PI;
  const normalLength = Math.hypot(24.75, 27);
  const cone = (x, y, angle, length) => `<g transform="translate(${x} ${y}) rotate(${angle - normalAngle}) scale(${length / normalLength}) translate(-9 -6)"><path d="M9 6 38 29Q35 34 29.5 37Z" fill="url(#shade)" stroke="none"/></g>`;
  const inward = cone(24, 21, -90, 16);
  const outward = cone(24, 4, 90, 16);
  const rotate = (shape, angle, opacity = 1) => `<g transform="rotate(${angle} 24 24)" opacity="${opacity}">${shape}</g>`;
  const pair = angle => rotate(outward + rotate(outward, 180), angle);
  let shape;
  switch (style.id) {
    case 'normal': shape = cone(9, 6, normalAngle, normalLength); break;
    case 'text': { const half = cone(24, 24, -90, 20); shape = half + rotate(half, 180); break; }
    case 'horizontal': shape = pair(90); break;
    case 'vertical': shape = pair(0); break;
    case 'diagonal-1': shape = pair(45); break;
    case 'diagonal-2': shape = pair(-45); break;
    case 'move': shape = [0, 90, 180, 270].map(angle => rotate(inward, angle)).join(''); break;
    case 'loading': shape = Array.from({ length: 8 }, (_, i) => {
      const age = (loadingPhase - i + 8) % 8;
      const opacity = age < 2.5 ? 1 - age * .368 : .08;
      return rotate(inward, i * 45, opacity);
    }).join(''); break;
    case 'link': shape = `<g transform="translate(24 5) scale(${-1 - press * .06} ${1 - press * .16}) translate(-24 -5)">${cone(24, 5, 90, 37)}</g>`; break;
    case 'drag': shape = [3, 2, 1, 0].map(i => `<g opacity="${1 - i * .23}">${cone(9 + i * 3, 6 + i * 1.2, normalAngle, 30)}</g>`).join(''); break;
  }
  const layout = cursorLayout(style, shape);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cursorSize}" height="${cursorSize}" viewBox="0 0 48 48">
    <defs>
      <linearGradient id="shade" gradientUnits="userSpaceOnUse" x1="38" y1="29" x2="29.5" y2="37">
        <stop offset="0" stop-color="${color}"/>
        <stop offset=".48" stop-color="${color}"/>
        <stop offset=".64" stop-color="${shaded(.05)}"/>
        <stop offset=".82" stop-color="${shaded(.16)}"/>
        <stop offset="1" stop-color="${shaded(.32)}"/>
      </linearGradient>
      <g id="form">${shape}</g>
    </defs>
    <g transform="translate(${layout.x} ${layout.y}) scale(${layout.scale})"><use href="#form"/></g>
  </svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function cursorValue(style, color, press = 0) {
  return cursorUrl(cursorAsset(style, color, press), style);
}

function refreshCursorPreview() {
  if (!cursorLibrary) return;
  for (const [index, button] of [...cursorGrid.children].entries()) {
    const style = cursorStyles[index];
    button.querySelector('img').src = cursorAsset(style, previewColor);
    button.querySelector('img').style.width = button.querySelector('img').style.height = `${cursorSize}px`;
    button.style.cursor = cursorValue(style, previewColor);
    button.setAttribute('aria-pressed', String(style === selectedCursor));
  }
  for (const button of cursorPalette.children) {
    button.setAttribute('aria-pressed', String(button.dataset.color === previewColor));
  }
  cursorTestImage.src = cursorAsset(selectedCursor, previewColor);
  cursorTestImage.style.width = cursorTestImage.style.height = `${cursorSize * 1.5}px`;
  cursorTestName.textContent = selectedCursor.name;
  cursorTest.style.cursor = cursorValue(selectedCursor, previewColor);
}

for (const [name, color] of (cursorLibrary ? cursorColors : [])) {
  const button = document.createElement('button');
  button.className = 'cursor-color';
  button.type = 'button';
  button.dataset.color = color;
  button.style.setProperty('--swatch', color);
  button.setAttribute('aria-label', name);
  button.addEventListener('click', () => {
    previewColor = color;
    refreshCursorPreview();
  });
  cursorPalette.append(button);
}

for (const style of (cursorLibrary ? cursorStyles : [])) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cursor-card';
  const image = document.createElement('img');
  image.alt = '';
  image.width = image.height = 48;
  const name = document.createElement('span');
  name.textContent = style.name;
  button.append(image, name);
  button.addEventListener('click', () => {
    selectedCursor = style;
    refreshCursorPreview();
  });
  cursorGrid.append(button);
}

function syncEditorCursors() {
  const candidate = getComputedStyle(cursorRoot).getPropertyValue('--accent').trim() || localStorage.getItem('pass-cursor-color');
  const color = cursorColors.some(([, value]) => value === candidate) ? candidate : '#8dff00';
  if (color === lastEditorColor) return;
  lastEditorColor = color;
  localStorage.setItem('pass-cursor-color', color);
  previewColor = color;
  refreshCursorPreview();
  for (const style of cursorStyles) cursorRoot.style.setProperty(`--cursor-${style.id}`, cursorValue(style, color));
}

function closeCursorLibrary() {
  cursorLibrary.hidden = true;
  cursorToggle.setAttribute('aria-expanded', 'false');
  cursorToggle.focus({ preventScroll: true });
}

cursorToggle?.addEventListener('click', () => {
  cursorLibrary.hidden = !cursorLibrary.hidden;
  cursorToggle.setAttribute('aria-expanded', String(!cursorLibrary.hidden));
  if (!cursorLibrary.hidden) cursorClose.focus({ preventScroll: true });
});
cursorClose?.addEventListener('click', closeCursorLibrary);
cursorLibrary?.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeCursorLibrary();
  }
});
cursorEnable?.addEventListener('change', () => cursorRoot.classList.toggle('custom-cursors', (cursorEnable?.checked ?? true)));
new MutationObserver(syncEditorCursors).observe(cursorRoot, { attributes: true, attributeFilter: ['style'] });
cursorRoot.classList.add('custom-cursors');
syncEditorCursors();
refreshCursorPreview();

// Keep all cones fixed; advance only each cone's brightness.
let loadingPhase = 0;
const loadingFrames = new Map();
function loadingFrame(color) {
  const key = `${color}:${cursorSize}:${loadingPhase}`;
  if (!loadingFrames.has(key)) loadingFrames.set(key, cursorAsset(cursorStyles.find(style => style.id === 'loading'), color, 0, loadingPhase));
  return loadingFrames.get(key);
}
setInterval(() => {
  const nativeLoading = document.body.classList.contains('cursor-loading') && (cursorEnable?.checked ?? true);
  if ((!nativeLoading && (cursorLibrary?.hidden ?? true)) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  loadingPhase = (loadingPhase + .5) % 8;
  if (nativeLoading) cursorRoot.style.setProperty('--cursor-loading', cursorUrl(loadingFrame(lastEditorColor), cursorStyles.find(style => style.id === 'loading')));
  if (cursorLibrary && !cursorLibrary.hidden) {
    const asset = loadingFrame(previewColor);
    const card = cursorGrid.children[cursorStyles.findIndex(style => style.id === 'loading')];
    card.querySelector('img').src = asset;
    card.style.cursor = cursorUrl(asset, cursorStyles.find(style => style.id === 'loading'));
    if (selectedCursor.id === 'loading') {
      cursorTestImage.src = asset;
      cursorTest.style.cursor = cursorUrl(asset, cursorStyles.find(style => style.id === 'loading'));
    }
  }
}, 90);

let handPress = 0;
let handAnimation;
const handStyle = cursorStyles.find(style => style.id === 'link');
function animateHandPress(target) {
  cancelAnimationFrame(handAnimation);
  const from = handPress;
  const started = performance.now();
  const duration = target ? 90 : 180;
  function tick(now) {
    const time = Math.min(1, (now - started) / duration);
    const ease = 1 - (1 - time) ** 3;
    handPress = from + (target - from) * ease;
    const step = Math.round(handPress * 12) / 12;
    cursorRoot.style.setProperty('--cursor-link', cursorValue(handStyle, lastEditorColor, step));
    if (selectedCursor.id === 'link') {
      cursorTest.style.cursor = cursorValue(handStyle, previewColor, step);
      cursorTestImage.style.transform = `scale(${1 + handPress * .06}, ${1 - handPress * .16})`;
      cursorTestImage.style.transformOrigin = '50% 10%';
    }
    if (time < 1) handAnimation = requestAnimationFrame(tick);
  }
  handAnimation = requestAnimationFrame(tick);
}
document.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !(cursorEnable?.checked ?? true)) return;
  if (event.target.closest('button, a, input[type="checkbox"], input[type="color"]')
    || (selectedCursor.id === 'link' && event.target.closest('#cursor-test'))) animateHandPress(1);
});
for (const event of ['pointerup', 'pointercancel']) document.addEventListener(event, () => animateHandPress(0));
window.addEventListener('blur', () => animateHandPress(0));

window.addEventListener('storage', event => {
  if (event.key !== 'pass-cursor-color' || document.querySelector('#text')) return;
  if (cursorColors.some(([, color]) => color === event.newValue)) {
    cursorRoot.style.setProperty('--accent', event.newValue);
  }
});

function applyCursorSize(value, persist = true) {
  cursorSize = Math.max(24, Math.min(96, Number(value) || 48));
  loadingFrames.clear();
  for (const style of cursorStyles) cursorRoot.style.setProperty(`--cursor-${style.id}`, cursorValue(style, lastEditorColor));
  refreshCursorPreview();
  document.querySelectorAll('[data-cursor-size]').forEach(input => input.value = cursorSize);
  document.querySelectorAll('[data-cursor-size-value]').forEach(output => output.textContent = `${Math.round(cursorSize / 48 * 100)}%`);
  if (persist) localStorage.setItem('pass-cursor-size', cursorSize);
}
document.querySelectorAll('[data-cursor-size]').forEach(input => input.addEventListener('input', () => applyCursorSize(input.value)));
window.addEventListener('storage', event => {
  if (event.key === 'pass-cursor-size') applyCursorSize(event.newValue, false);
});
applyCursorSize(cursorSize, false);
