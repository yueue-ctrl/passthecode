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
const arrow = '<path d="M9 6 31 25 22 27 28 38 22 41 16 29 9 36Z"/>';
const hand = '<path d="M17 26V10c0-5 6-5 6 0v12-3c0-4 6-4 6 0v4-2c0-4 6-4 6 0v4c0-4 6-4 6 0v9c0 7-4 11-11 11h-5c-5 0-7-3-10-7l-6-8c-3-4 1-8 4-5l4 3Z"/>';
const hourglass = '<path d="M12 7h24v5c0 5-7 9-10 12 3 3 10 7 10 12v5H12v-5c0-5 7-9 10-12-3-3-10-7-10-12Z"/>';
const doubleArrow = '<path d="M24 6 17 14h5v20h-5l7 8 7-8h-5V14h5Z"/>';
const cursorStyles = [
  { id: 'normal', name: 'Normal', fallback: 'default', hot: [9, 6], shape: arrow },
  { id: 'help', name: 'Help', fallback: 'help', hot: [9, 6], shape: arrow + '<path d="M31 11c0-10 16-10 16 0 0 6-7 6-7 12h-4c0-9 7-8 7-12 0-5-8-5-8 0Z"/><circle cx="38" cy="28" r="2.2"/>' },
  { id: 'working', name: 'Working', fallback: 'progress', hot: [9, 6], shape: arrow + '<path d="M35 24a10 10 0 1 1-9 6l4 2a6 6 0 1 0 5-4Z"/>' },
  { id: 'busy', name: 'Busy', fallback: 'wait', hot: [24, 24], shape: hourglass },
  { id: 'precision', name: 'Precision', fallback: 'crosshair', hot: [24, 24], shape: '<path d="M23 6h2v16h16v3H25v17h-2V25H6v-3h17Z"/>' },
  { id: 'text', name: 'Text select', fallback: 'text', hot: [24, 24], shape: '<rect x="20" y="7" width="8" height="34" rx="2"/>' },
  { id: 'unavailable', name: 'Unavailable', fallback: 'not-allowed', hot: [24, 24], shape: '<path fill-rule="evenodd" d="M24 7a17 17 0 1 0 0 34 17 17 0 0 0 0-34Zm0 5a12 12 0 1 1 0 24 12 12 0 0 1 0-24Z"/><path d="m12 33 21-21 3 3-21 21Z"/>' },
  { id: 'vertical', name: 'Vertical', fallback: 'ns-resize', hot: [24, 24], shape: doubleArrow },
  { id: 'horizontal', name: 'Horizontal', fallback: 'ew-resize', hot: [24, 24], shape: '<g transform="rotate(90 24 24)">' + doubleArrow + '</g>' },
  { id: 'diagonal-1', name: 'Diagonal ↘', fallback: 'nwse-resize', hot: [24, 24], shape: '<g transform="rotate(-45 24 24)">' + doubleArrow + '</g>' },
  { id: 'diagonal-2', name: 'Diagonal ↗', fallback: 'nesw-resize', hot: [24, 24], shape: '<g transform="rotate(45 24 24)">' + doubleArrow + '</g>' },
  { id: 'move', name: 'Move', fallback: 'move', hot: [24, 24], shape: '<path d="m24 5-6 7h4v10H12v-4l-7 6 7 6v-4h10v10h-4l6 7 6-7h-4V26h10v4l7-6-7-6v4H26V12h4Z"/>' },
  { id: 'link', name: 'Link select', fallback: 'pointer', hot: [20, 7], shape: hand },
  { id: 'click', name: 'Click', fallback: 'pointer', hot: [20, 10], shape: '<g transform="translate(1 3) scale(.93)">' + hand + '</g><path d="M18 1h3v5h-3ZM6 4l3-2 4 5-3 2ZM30 7l4-5 3 2-4 5Z"/>' },
];

let previewColor = cursorColors[1][1];
let selectedCursor = cursorStyles[0];
let lastEditorColor;

function cursorAsset(style, color) {
  const start = Math.max(0, cursorColors.findIndex(([, value]) => value === color));
  const spectrum = [...cursorColors.slice(start), ...cursorColors.slice(0, start)];
  const stops = spectrum.map(([, value], index) =>
    `<stop offset="${index / (spectrum.length - 1)}" stop-color="${value}"/>`
  ).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <defs>
    <linearGradient id="color" gradientUnits="userSpaceOnUse" x1="${style.id === 'text' ? 20 : 9}" y1="7" x2="${style.id === 'text' ? 28 : 36}" y2="41">${stops}</linearGradient>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.5"/></filter>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".45"/></filter>
    <g id="shape" fill="url(#color)">${style.shape}</g>
  </defs>
  <use href="#shape" filter="url(#glow)" opacity=".85"/>
  <use href="#shape" filter="url(#soft)"/>
  </svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function cursorValue(style, color) {
  return `url("${cursorAsset(style, color)}") ${style.hot.join(' ')}, ${style.fallback}`;
}

function refreshCursorPreview() {
  for (const [index, button] of [...cursorGrid.children].entries()) {
    const style = cursorStyles[index];
    button.querySelector('img').src = cursorAsset(style, previewColor);
    button.style.cursor = cursorValue(style, previewColor);
    button.setAttribute('aria-pressed', String(style === selectedCursor));
  }
  for (const button of cursorPalette.children) {
    button.setAttribute('aria-pressed', String(button.dataset.color === previewColor));
  }
  cursorTestImage.src = cursorAsset(selectedCursor, previewColor);
  cursorTestName.textContent = selectedCursor.name;
  cursorTest.style.cursor = cursorValue(selectedCursor, previewColor);
}

for (const [name, color] of cursorColors) {
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

for (const style of cursorStyles) {
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
  const color = getComputedStyle(cursorRoot).getPropertyValue('--accent').trim();
  if (color === lastEditorColor) return;
  lastEditorColor = color;
  for (const style of cursorStyles) cursorRoot.style.setProperty(`--cursor-${style.id}`, cursorValue(style, color));
}

function closeCursorLibrary() {
  cursorLibrary.hidden = true;
  cursorToggle.setAttribute('aria-expanded', 'false');
  cursorToggle.focus({ preventScroll: true });
}

cursorToggle.addEventListener('click', () => {
  cursorLibrary.hidden = !cursorLibrary.hidden;
  cursorToggle.setAttribute('aria-expanded', String(!cursorLibrary.hidden));
  if (!cursorLibrary.hidden) cursorClose.focus({ preventScroll: true });
});
cursorClose.addEventListener('click', closeCursorLibrary);
cursorLibrary.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeCursorLibrary();
  }
});
cursorEnable.addEventListener('change', () => cursorRoot.classList.toggle('custom-cursors', cursorEnable.checked));
new MutationObserver(syncEditorCursors).observe(cursorRoot, { attributes: true, attributeFilter: ['style'] });
cursorRoot.classList.add('custom-cursors');
syncEditorCursors();
refreshCursorPreview();
