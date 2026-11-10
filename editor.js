const editor = document.querySelector('#text');
const mirror = document.querySelector('#mirror');
const stage = document.querySelector('#stage');
const effects = document.querySelector('#effects');
const ink = document.querySelector('#ink');
const inkNames = document.querySelector('#ink-names');
const caret = document.querySelector('#caret');
const beamHeight = caret.offsetHeight;
const announcement = document.querySelector('#announcement');
const colorMenu = document.querySelector('#colors');
const swatches = document.querySelector('#swatches');
const opacityControl = document.querySelector('#opacity');
const inkView = document.querySelector('#ink-view');
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
let hoveredInk;

function hideInkNames() {
  hoveredInk = undefined;
  inkNames.replaceChildren();
}

function showInkNames(event) {
  if (event.buttons || event.pointerType === 'touch' || !layers.length) return;
  const { clientX, clientY } = event;
  const view = inkView.value;
  const target = [...ink.querySelectorAll('[data-person]')].find(element => {
    const rect = element.getBoundingClientRect();
    const slop = view === 'wash' ? 0 : 4;
    return clientX >= rect.left - slop && clientX <= rect.right + slop
      && clientY >= rect.top && clientY < rect.bottom;
  });
  const anchor = view === 'stack' ? target?.parentElement : target;
  if (anchor === hoveredInk) return;
  hideInkNames();
  if (!anchor) return;
  hoveredInk = anchor;

  const markers = view === 'stack' ? [...anchor.children] : [anchor];
  const bounds = stage.getBoundingClientRect();
  const rect = anchor.getBoundingClientRect();
  inkNames.dataset.view = view;
  inkNames.style.left = '8px';
  inkNames.style.top = '0px';
  const labels = markers.map(marker => {
    const person = people.find(person => person.name === marker.dataset.person);
    const label = document.createElement('span');
    label.className = 'ink-name';
    const name = document.createElement('span');
    name.textContent = person.name;
    label.append(name);
    label.style.setProperty('--person-color', person.color);
    return label;
  });
  inkNames.replaceChildren(...labels);
  const left = rect.left - bounds.left;
  inkNames.style.left = `${Math.max(8, Math.min(left, bounds.width - inkNames.offsetWidth - 8))}px`;
  inkNames.style.top = `${Math.max(2, rect.top - bounds.top - inkNames.offsetHeight + 4)}px`;

  if (reduceMotion.matches) return;
  const closed = view === 'rail' ? 'inset(0 96% 0 0)' : 'inset(94% 0 0 0)';
  for (const [index, label] of labels.entries()) {
    const delay = index * 52;
    label.animate([
      { clipPath: closed, opacity: .35 },
      { clipPath: 'inset(0)', opacity: 1 },
    ], { duration: 250, delay, fill: 'backwards', easing: 'ease-out' });
    label.firstElementChild.animate([
      { opacity: 0, filter: 'blur(3px)' },
      { opacity: 1, filter: 'blur(0)' },
    ], { duration: 160, delay: delay + 85, fill: 'backwards', easing: 'ease-out' });
  }
}

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
  draft.ranges = mergeRanges([...draft.ranges, { start, end }]);
}

function mergeRanges(ranges) {
  const merged = [];
  for (const range of ranges.sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

function uncoveredRanges({ start, end }, covered) {
  const visible = [];
  for (const range of covered) {
    if (range.end <= start) continue;
    if (range.start >= end) break;
    if (range.start > start) visible.push({ start, end: range.start });
    start = Math.max(start, range.end);
    if (start >= end) break;
  }
  if (start < end) visible.push({ start, end });
  return visible;
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
  return { left, oldRight, newRight };
}

function renderInk(pulseLayer, passing = false) {
  if (!layers.length) return;
  hideInkNames();
  const bounds = stage.getBoundingClientRect();
  const range = document.createRange();
  const fragment = document.createDocumentFragment();
  const pulses = [];
  const badges = [];
  const rowBadges = new Map();
  const railRows = new Map();
  const view = inkView.value;
  const visibleByLayer = new Map();
  let covered = [];
  for (const layer of layers.toReversed()) {
    visibleByLayer.set(layer, layer.ranges.flatMap(span => uncoveredRanges(span, covered)));
    covered = mergeRanges([...covered, ...layer.ranges]);
  }

  for (const layer of layers) {
    for (const { start, end } of view === 'wash' ? layer.ranges : []) {
      range.setStart(mirror.firstChild, start);
      range.setEnd(mirror.firstChild, end);
      const rect = Array.from(range.getClientRects()).find(rect => rect.width);
      if (!rect) continue;
      const badge = avatar(layer.person);
      const row = Math.round(rect.top - bounds.top - editor.scrollTop);
      const slot = rowBadges.get(row) ?? 0;
      badge.style.left = `${rect.left - bounds.left - editor.scrollLeft + slot * 20}px`;
      badge.style.top = `${row - 16}px`;
      rowBadges.set(row, slot + 1);
      badges.push(badge);
      break;
    }
    const spans = view === 'stack' ? layer.ranges : visibleByLayer.get(layer);
    for (const { start, end } of spans) {
      range.setStart(mirror.firstChild, start);
      range.setEnd(mirror.firstChild, end);
      for (const rect of range.getClientRects()) {
        if (!rect.width) continue;
        if (view !== 'wash') {
          const row = Math.round(rect.top - bounds.top - editor.scrollTop);
          if (!railRows.has(row)) railRows.set(row, { height: rect.height, segments: [] });
          railRows.get(row).segments.push({ x: rect.left, width: rect.width, person: layer.person });
          continue;
        }
        const wash = document.createElement('div');
        wash.className = 'wash';
        wash.dataset.person = layer.person.name;
        wash.style.setProperty('--wash-color', layer.person.color);
        wash.style.left = `${rect.left - bounds.left - editor.scrollLeft}px`;
        wash.style.top = `${rect.top - bounds.top - editor.scrollTop}px`;
        wash.style.width = `${rect.width}px`;
        wash.style.height = `${rect.height}px`;
        fragment.append(wash);
        if (layer === pulseLayer) pulses.push(wash);
      }
    }
  }
  if (view !== 'wash') {
    const left = parseFloat(getComputedStyle(editor).paddingLeft) - (view === 'stack' ? 77 : 17);
    for (const [top, { height, segments }] of railRows) {
      const line = document.createElement('div');
      line.className = view === 'stack' ? 'stack-line' : 'rail-line';
      line.style.left = `${left}px`;
      line.style.top = `${top}px`;
      line.style.height = `${height}px`;
      const ordered = view === 'stack'
        ? [...new Map(segments.map(segment => [segment.person, segment])).values()]
        : segments.sort((a, b) => a.x - b.x);
      for (const [index, { width, person }] of ordered.entries()) {
        const segment = document.createElement('div');
        if (view === 'stack') {
          segment.className = 'stack-sheet';
          segment.style.left = `${index * 9}px`;
        } else {
          segment.className = 'rail-segment';
          segment.style.flexGrow = width;
        }
        segment.dataset.person = person.name;
        segment.style.setProperty('--wash-color', person.color);
        line.append(segment);
      }
      fragment.append(line);
    }
  }
  ink.replaceChildren(fragment, ...badges);
  if (reduceMotion.matches) return;
  const opacity = opacityControl.valueAsNumber / 100;
  for (const wash of pulses) {
    wash.animate([
      { opacity: passing ? 0 : opacity * .7, filter: 'blur(4px)', transform: passing ? 'scaleX(.8)' : 'scaleX(1)' },
      { opacity: Math.min(1, opacity + .16), filter: 'blur(9px)', transform: 'scaleX(1)', offset: .42 },
      { opacity, filter: 'blur(var(--wash-blur))', transform: 'scaleX(1)' },
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
    const previous = point;
    const current = updateCaret();
    if (!caret.hidden && previous && (current.x !== previous.x || current.y !== previous.y)) {
      recordReplayFrame(stage, current, active, 'move');
    }
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
      ? `linear-gradient(90deg, ${active.color}, transparent 50%, color-mix(in srgb, ${target.color} 75%, transparent) 64%, transparent)`
      : `linear-gradient(to ${x < 0 ? 'left' : 'right'}, transparent, ${active.color})`;
  }
  effects.insertBefore(layer, caret);
  const left = from.x - (x >= 0 ? width : 0);
  const transform = (dx, dy, scale) => `translate(${left + dx}px, ${from.y + dy}px) scale(${scale})`;
  const motion = layer.animate([
    { transform: transform(0, 0, 1), opacity: 0, filter: 'blur(.3px)' },
    { transform: transform(x * .22, y * .22, 1), opacity, filter: `blur(${width ? 4 : 1.2}px)`, offset: .16 },
    { transform: transform(x, y, width ? 1.65 : 1.14), opacity: 0, filter: `blur(${width ? 18 : 5}px)` },
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
    trace(from, { x: distance, y: rise, duration: 950, opacity: .66, width: 108, target: next });
  }
  announcement.textContent = `${active.name} passed to ${next.name}`;
  active = next;
  recipient = undefined;
  document.documentElement.style.setProperty('--accent', active.color);
  recordTurn(active);
  updateRecipients();
  recordReplayFrame(stage, from, active, 'pass');
}

editor.addEventListener('beforeinput', () => {
  beforeEdit = { value: editor.value, start: editor.selectionStart, end: editor.selectionEnd };
  updateCaret();
});
editor.addEventListener('input', event => {
  const edit = beforeEdit ?? { value: mirroredValue, start: editor.selectionStart, end: editor.selectionEnd };
  beforeEdit = undefined;
  const change = recordEdit(edit, editor.value);
  const previous = point;
  const current = updateCaret();
  renderInk(draft);
  if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
    restoreReplayEdit(editor.value, event.inputType);
  } else if (!composing) {
    const type = event.inputType.startsWith('delete') ? 'delete' : 'edit';
    recordReplayFrame(stage, current, active, type, edit.value === replayEditValue() ? change : undefined);
  }
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
  const current = updateCaret();
  recordReplayFrame(stage, current, active, 'edit');
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
inkView.addEventListener('change', () => {
  stage.classList.toggle('soft-stack', inkView.value === 'stack');
  alignInk();
});
passButton.addEventListener('click', pass);
stage.addEventListener('pointermove', showInkNames);
stage.addEventListener('pointerleave', hideInkNames);
stage.addEventListener('pointerdown', hideInkNames);
stage.addEventListener('pointerup', showInkNames);

if (matchMedia('(pointer: fine)').matches) {
  editor.setSelectionRange(0, 0);
  editor.focus({ preventScroll: true });
}
updateCaret();
