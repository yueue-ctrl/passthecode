const editor = document.querySelector('#text');
const mirror = document.querySelector('#mirror');
const stage = document.querySelector('#stage');
const effects = document.querySelector('#effects');
const ink = document.querySelector('#ink');
const caret = document.querySelector('#caret');
const beamHeight = caret.offsetHeight;
const announcement = document.querySelector('#announcement');
const colorMenu = document.querySelector('#colors');
const swatches = document.querySelector('#swatches');
const opacityControl = document.querySelector('#opacity');
const passButton = document.querySelector('#pass');
const handoffHistory = document.querySelector('#handoffs');
const colorToggle = document.querySelector('#color-toggle');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const people = [
  { name: 'Ari', color: '#efff35' },
  { name: 'Lin', color: '#8dff00' },
  { name: 'Kai', color: '#00e2fa' },
  { name: 'Mina', color: '#1299ff' },
  { name: 'Noa', color: '#ff00c8' },
];

let active = people[1];
let recipient;
let point;
let composing = false;
let pendingFrame = 0;
let mirroredValue;
let beforeEdit;
let draft;
const layers = [];

const blink = caret.animate([
  { opacity: 1, offset: 0 },
  { opacity: 1, offset: .5 },
  { opacity: 0, offset: .5 },
  { opacity: 0, offset: 1 },
], { duration: 1060, iterations: Infinity });

function wakeCaret() {
  if (reduceMotion.matches) blink.pause();
  else blink.play();
  blink.currentTime = 0;
}

function avatar(person) {
  const badge = document.createElement('span');
  badge.className = 'avatar';
  badge.style.setProperty('--person-color', person.color);
  badge.title = person.name;
  badge.setAttribute('role', 'img');
  badge.setAttribute('aria-label', person.name);
  badge.textContent = person.name[0];
  return badge;
}

function nextPerson() {
  return recipient ?? people[(people.indexOf(active) + 1) % people.length];
}

function updateRecipients() {
  const next = nextPerson();
  colorToggle.style.setProperty('--accent', next.color);
  colorToggle.title = `Pass to ${next.name}`;
  passButton.setAttribute('aria-label', `Pass to ${next.name}`);
  for (const [index, swatch] of [...swatches.children].entries()) {
    swatch.disabled = people[index] === active;
    swatch.setAttribute('aria-pressed', String(people[index] === next));
  }
}

function chooseRecipient(person) {
  if (person === active) return;
  recipient = person;
  updateRecipients();
  announcement.textContent = `Next collaborator: ${person.name}`;
}

function recordTurn(person) {
  handoffHistory.lastElementChild?.removeAttribute('aria-current');
  const item = document.createElement('li');
  item.setAttribute('aria-current', 'step');
  item.append(avatar(person));
  handoffHistory.append(item);
  handoffHistory.scrollLeft = handoffHistory.scrollWidth;
}

for (const person of people) {
  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'swatch';
  swatch.setAttribute('aria-label', person.name);
  swatch.append(avatar(person));
  swatch.addEventListener('click', () => {
    chooseRecipient(person);
    colorMenu.hidePopover();
    editor.focus({ preventScroll: true });
  });
  swatches.append(swatch);
}

updateRecipients();
recordTurn(active);

opacityControl.addEventListener('input', () => {
  ink.style.setProperty('--ink-opacity', opacityControl.valueAsNumber / 100);
});

function mark(start, end) {
  if (start === end) return;
  if (!draft) {
    draft = { person: active, ranges: [] };
    layers.push(draft);
  }
  const ranges = [...draft.ranges, { start, end }].sort((a, b) => a.start - b.start);
  draft.ranges = [];
  for (const range of ranges) {
    const last = draft.ranges.at(-1);
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else draft.ranges.push(range);
  }
}

function recordEdit({ value: old, start, end }, value) {
  if (old === value) return;
  // Anchor the diff to the selection so repeated letters stay attached to their colors.
  const limit = Math.min(start, editor.selectionEnd, old.length, value.length);
  let left = 0;
  while (left < limit && old[left] === value[left]) left++;
  let oldRight = old.length;
  let newRight = value.length;
  while (oldRight > Math.max(left, end) && newRight > Math.max(left, editor.selectionEnd)
    && old[oldRight - 1] === value[newRight - 1]) {
    oldRight--;
    newRight--;
  }
  const shift = newRight - oldRight;
  const continuation = oldRight === left && draft?.ranges.find(range => range.start < left && range.end === left);
  for (const layer of layers) {
    layer.ranges = layer.ranges.map(range => {
      if (continuation && range.end === left && range.start < continuation.end
        && range.end > continuation.start) {
        return { start: range.start, end: newRight };
      }
      if (range.end <= left) return range;
      if (range.start >= oldRight) return { start: range.start + shift, end: range.end + shift };
      return {
        start: Math.min(range.start, left),
        end: range.end > oldRight ? range.end + shift : newRight,
      };
    }).filter(range => range.start < range.end);
  }
  mark(left, newRight);
}

function renderInk(pulseLayer, passing = false) {
  if (!layers.length) return;
  const bounds = stage.getBoundingClientRect();
  const range = document.createRange();
  const fragment = document.createDocumentFragment();
  const pulses = [];
  const badges = [];
  const rowBadges = new Map();
  for (const layer of layers) {
    let needsBadge = true;
    for (const { start, end } of layer.ranges) {
      range.setStart(mirror.firstChild, start);
      range.setEnd(mirror.firstChild, end);
      for (const rect of range.getClientRects()) {
        if (!rect.width) continue;
        const wash = document.createElement('div');
        wash.className = 'wash';
        wash.style.setProperty('--wash-color', layer.person.color);
        wash.style.left = `${rect.left - bounds.left - editor.scrollLeft - 3}px`;
        wash.style.top = `${rect.top - bounds.top - editor.scrollTop}px`;
        wash.style.width = `${rect.width + 12}px`;
        wash.style.height = `${rect.height}px`;
        fragment.append(wash);
        if (needsBadge) {
          const badge = avatar(layer.person);
          const row = Math.round(rect.top - bounds.top - editor.scrollTop);
          const slot = rowBadges.get(row) ?? 0;
          badge.style.left = `${rect.left - bounds.left - editor.scrollLeft + slot * 20}px`;
          badge.style.top = `${row - 16}px`;
          rowBadges.set(row, slot + 1);
          badges.push(badge);
          needsBadge = false;
        }
        if (layer === pulseLayer) pulses.push(wash);
      }
    }
  }
  ink.replaceChildren(fragment, ...badges);
  if (reduceMotion.matches) return;
  const opacity = opacityControl.valueAsNumber / 100;
  for (const wash of pulses) {
    wash.animate([
      { opacity: passing ? 0 : opacity * .7, filter: 'blur(3px)', transform: passing ? 'scaleX(.8)' : 'scaleX(1)' },
      { opacity: Math.min(1, opacity + .25), filter: 'blur(7px)', transform: 'scaleX(1.04)', offset: .42 },
      { opacity, filter: 'blur(5px)', transform: 'scaleX(1)' },
    ], { duration: passing ? 760 : 320, easing: 'ease-out' });
  }
}

function updateCaret() {
  const { value, selectionStart, selectionEnd, selectionDirection } = editor;
  const offset = selectionDirection === 'backward' ? selectionStart : selectionEnd;
  // Match the textarea's wrapping width, including any space taken by its scrollbar.
  mirror.style.width = `${editor.clientWidth}px`;
  if (value !== mirroredValue) {
    mirror.textContent = value + '\u200b';
    mirroredValue = value;
  }

  const range = document.createRange();
  const usePrevious = (offset === value.length || value[offset] === '\n')
    && offset > 0 && value[offset - 1] !== '\n';
  const start = usePrevious ? offset - 1 : offset;
  range.setStart(mirror.firstChild, start);
  range.setEnd(mirror.firstChild, start + 1);
  const rect = range.getBoundingClientRect();
  const bounds = stage.getBoundingClientRect();
  const next = {
    x: (usePrevious ? rect.right : rect.left) - bounds.left - editor.scrollLeft,
    y: rect.top - bounds.top - editor.scrollTop + (rect.height - beamHeight) / 2,
  };

  if (!point || point.x !== next.x || point.y !== next.y) wakeCaret();
  point = next;
  caret.style.transform = `translate(${point.x}px, ${point.y}px)`;
  caret.hidden = composing || document.activeElement !== editor || selectionStart !== selectionEnd;
  return point;
}

function scheduleCaret() {
  if (pendingFrame) return;
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = 0;
    updateCaret();
  });
}

function trace(from, { x, y, duration, delay = 0, opacity, width = 0, target }) {
  const layer = document.createElement('div');
  layer.className = width ? 'ribbon' : 'beam';
  layer.style.setProperty('--beam-color', active.color);
  if (width) {
    layer.style.width = `${width}px`;
    layer.style.transformOrigin = x < 0 ? 'left center' : 'right center';
    layer.style.background = target
      ? `linear-gradient(90deg, ${active.color}, color-mix(in srgb, ${active.color}, ${target.color}) 40%, color-mix(in srgb, ${target.color} 60%, transparent) 72%, transparent)`
      : `linear-gradient(to ${x < 0 ? 'left' : 'right'}, transparent, ${active.color})`;
  }
  effects.insertBefore(layer, caret);
  const left = from.x - (x >= 0 ? width : 0);
  const transform = (dx, dy, scale) => `translate(${left + dx}px, ${from.y + dy}px) scale(${scale})`;
  const motion = layer.animate([
    { transform: transform(0, 0, 1), opacity: 0, filter: 'blur(.3px)' },
    { transform: transform(x * .22, y * .22, 1), opacity, filter: 'blur(.7px)', offset: .16 },
    { transform: transform(x, y, width ? 1.65 : 1.14), opacity: 0, filter: `blur(${width ? 9 : 3}px)` },
  ], { duration, delay, fill: 'both', easing: 'cubic-bezier(.19,.6,.35,1)' });
  motion.onfinish = () => layer.remove();
}

function pass() {
  editor.focus();
  const from = updateCaret();
  const next = nextPerson();
  mark(editor.selectionStart, editor.selectionEnd);
  renderInk(draft, true);
  draft = undefined;
  wakeCaret();
  if (!reduceMotion.matches) {
    const distance = Math.max(28, Math.min(180, stage.clientWidth - from.x - 8));
    const rise = from.y < 40 ? 20 : -26;
    for (let layer = 0; layer < 3; layer++) {
      trace(from, {
        x: distance * (1 - layer * .1),
        y: rise * (1 - layer * .1),
        duration: 950 - layer * 75,
        delay: layer * 45,
        opacity: .48 - layer * .09,
        width: 44 + layer * 18,
        target: next,
      });
    }
  }
  announcement.textContent = `${active.name} passed to ${next.name}`;
  active = next;
  recipient = undefined;
  document.documentElement.style.setProperty('--accent', active.color);
  recordTurn(active);
  updateRecipients();
}

editor.addEventListener('beforeinput', () => {
  beforeEdit = { value: editor.value, start: editor.selectionStart, end: editor.selectionEnd };
  updateCaret();
});
editor.addEventListener('input', () => {
  const edit = beforeEdit ?? { value: mirroredValue, start: editor.selectionStart, end: editor.selectionEnd };
  beforeEdit = undefined;
  recordEdit(edit, editor.value);
  const previous = point;
  const current = updateCaret();
  renderInk(draft);
  wakeCaret();
  if (reduceMotion.matches || composing || !previous || caret.hidden) return;

  const sameLine = Math.abs(current.y - previous.y) < 2;
  const delta = current.x - previous.x;
  const direction = sameLine && delta < 0 ? -1 : 1;
  const origin = sameLine ? previous : current;
  trace(origin, {
    x: direction * 14,
    y: sameLine ? 0 : 4,
    width: Math.max(15, Math.min(34, Math.abs(delta))),
    duration: 285,
    opacity: .42,
  });
  trace(origin, { x: direction * 5, y: 0, duration: 195, opacity: .55 });
});

editor.addEventListener('compositionstart', () => {
  composing = true;
  editor.classList.add('native-caret');
  updateCaret();
});
editor.addEventListener('compositionend', () => {
  composing = false;
  editor.classList.remove('native-caret');
  wakeCaret();
  scheduleCaret();
});
editor.addEventListener('keydown', event => {
  if (event.isComposing || composing) return;
  if (event.altKey && !event.metaKey && !event.ctrlKey && /^Digit[1-5]$/.test(event.code)) {
    event.preventDefault();
    chooseRecipient(people[Number(event.code.slice(-1)) - 1]);
  }
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    pass();
  }
});
for (const event of ['focus', 'blur', 'scroll', 'select', 'keyup', 'pointerup']) {
  editor.addEventListener(event, scheduleCaret);
}
editor.addEventListener('focus', wakeCaret);
editor.addEventListener('pointerup', wakeCaret);
reduceMotion.addEventListener('change', wakeCaret);
document.addEventListener('selectionchange', scheduleCaret);
const alignInk = () => {
  updateCaret();
  renderInk();
};
new ResizeObserver(alignInk).observe(stage);
editor.addEventListener('scroll', alignInk);
passButton.addEventListener('click', pass);

if (matchMedia('(pointer: fine)').matches) {
  editor.setSelectionRange(0, 0);
  editor.focus({ preventScroll: true });
}
updateCaret();
