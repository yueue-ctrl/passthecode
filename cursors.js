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
  { id: 'link', name: 'Hand / select', fallback: 'pointer', hot: [9, 6] },
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
let cursorMotionPhase = 0;
let cursorMotionColor;
let cursorPassTransition = null;

let cursorSize = Math.max(24, Math.min(96, Number(localStorage.getItem('pass-cursor-size')) || 48));
const cursorLayouts = new Map();
function cursorLayout(style, shape) {
  if (cursorLayouts.has(style.id)) return cursorLayouts.get(style.id);
  if (style.id === 'link') {
    if (!cursorLayouts.has('normal')) cursorAsset(cursorStyles[0], cursorMotionColor || lastEditorColor || '#8dff00');
    const normal = cursorLayouts.get('normal');
    const angle = Math.PI / 2 - Math.atan2(27,24.75);
    const points = [[9,6], ...Array.from({length:97},(_,i)=>coneBasePoint(i/96))].map(([x,y]) => [9+(x-9)*Math.cos(angle)-(y-6)*Math.sin(angle), 6+(x-9)*Math.sin(angle)+(y-6)*Math.cos(angle)]);
    const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
    const layout={scale:normal.scale,x:24-(Math.min(...xs)+Math.max(...xs))/2*normal.scale,y:24-(Math.min(...ys)+Math.max(...ys))/2*normal.scale};
    cursorLayouts.set('link',layout);
    return layout;
  }
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

// The first demo's rounded elliptical base, shared by previews and the live pointer.
const coneBasePoint = u => {
  const axisX = 24.75 / Math.hypot(24.75,27), axisY = 27 / Math.hypot(24.75,27);
  const angle = Math.PI * u, radius = 5.8, depth = 2.05;
  return [33.75 + axisY * radius * Math.cos(angle) + axisX * depth * Math.sin(angle),
    33 - axisX * radius * Math.cos(angle) + axisY * depth * Math.sin(angle)];
};
const coneContour = 'M9 6L' + Array.from({length:97},(_,i)=>coneBasePoint(i/96).join(' ')).join('L') + 'Z';

function coneLoadingChannels(from, to, sweep, u) {
  // The same sector sweep, with color growing from pale to saturated.
  const progress = Math.max(.0001, Math.min(1, sweep));
  const isNew = u <= progress;
  const color = isNew ? to : from;
  const opacity = isNew ? u / progress : u;
  // White grazing highlights give the flat loading gradient its conical volume.
  const lighting = Math.sin(u * Math.PI) ** .9;
  const strength = Math.max(0, opacity) * lighting;
  return color.map(channel => Math.round(255 + (channel - 255) * strength));
}

function cursorAsset(style, color, press = 0, loadingPhase = 0) {
  const shaded = amount => {
    const channels = color.match(/[a-f0-9]{2}/gi).map(channel => Math.round(parseInt(channel, 16) * (1 - amount)));
    return `rgb(${channels.join(',')})`;
  };
  // Reuse Normal's exact silhouette with only rotation and uniform scaling.
  const normalAngle = Math.atan2(27, 24.75) * 180 / Math.PI;
  const normalLength = Math.hypot(24.75, 27);
  const cone = (x, y, angle, length) => `<g transform="translate(${x} ${y}) rotate(${angle - normalAngle}) scale(${length / normalLength}) translate(-9 -6)"><path d="M9 6 38 29C37.35 30.95 31.52 36.03 29.5 37Z" fill="url(#shade)" stroke="none"/></g>`;
  const inward = cone(24, 21, -90, 16);
  const outward = cone(24, 4, 90, 16);
  const rotate = (shape, angle, opacity = 1) => `<g transform="rotate(${angle} 24 24)" opacity="${opacity}">${shape}</g>`;
  const pair = angle => rotate(outward + rotate(outward, 180), angle);
  let shape;
  switch (style.id) {
    case 'normal':
    case 'link': {
      shape = `<path d="${coneContour}" fill="white"/>`;
      const from = (cursorPassTransition?.from || cursorMotionColor || color).slice(1).match(/../g).map(v => parseInt(v,16));
      const to = (cursorPassTransition?.to || cursorMotionColor || color).slice(1).match(/../g).map(v => parseInt(v,16));
      const elapsed = cursorPassTransition ? Math.min(1,(performance.now()-cursorPassTransition.start)/2400) : 1;
      const front = elapsed*1.14;
      const point = coneBasePoint;
      for(let i=0;i<80;i++) {
        const u=(i+.5)/80;
        const a=point(i/80), b=point(Math.min(1,(i+1.08)/80));
        const sweep = cursorPassTransition ? elapsed : cursorMotionPhase;
        const rgb=coneLoadingChannels(from,to,sweep,u);
        shape+=`<path d="M9 6 L${a.join(' ')} Q${((a[0]+b[0])/2).toFixed(4)} ${((a[1]+b[1])/2).toFixed(4)} ${b.join(' ')} Z" fill="rgb(${rgb.join(',')})"/>`;
      }
      if (style.id === 'link') shape = `<g transform="rotate(${90-normalAngle} 9 6)">${shape}</g>`;
      shape = `<g filter="url(#cone-color-blur)">${shape}</g>`;
      break;
    }
    case 'text': { const half = cone(24, 24, -90, 20); shape = half + rotate(half, 180); break; }
    case 'horizontal': shape = pair(90); break;
    case 'vertical': shape = pair(0); break;
    case 'diagonal-1': shape = pair(45); break;
    case 'diagonal-2': shape = pair(-45); break;
    case 'move': shape = [0, 90, 180, 270].map(angle => rotate(inward, angle)).join(''); break;
    case 'loading': {
      const turns = loadingPhase;
      const progress = turns % 1;
      const base = Math.max(0, cursorColors.findIndex(([, c]) => c === color));
      const current = cursorColors[(base + Math.floor(turns)) % cursorColors.length][1];
      const previous = cursorColors[(base + Math.floor(turns) + cursorColors.length - 1) % cursorColors.length][1];
      shape = `<circle cx="24" cy="24" r="18" fill="transparent"/>`;
      for (let i = 0; i < 96; i++) {
        const u = i / 96, end = (i + 1.1) / 96;
        const next = u <= progress;
        if (!next && turns < 1) continue;
        const a = -Math.PI / 2 + u * Math.PI * 2, b = -Math.PI / 2 + end * Math.PI * 2;
        const opacity = next ? 1 - u / Math.max(.001, progress) : 1 - u;
        shape += `<path d="M24 24 L${24 + Math.cos(a)*18} ${24 + Math.sin(a)*18} A18 18 0 0 1 ${24 + Math.cos(b)*18} ${24 + Math.sin(b)*18}Z" fill="${next ? current : previous}" opacity="${Math.max(0,opacity)}"/>`;
      }
      if (turns < .1) shape += `<path d="M24 24V6" stroke="${current}" stroke-width="1.2" opacity="${1-turns/.1}"/>`;
      shape = `<g filter="url(#disc-blur)">${shape}</g>`;
      break;
    }
    case 'drag': shape = [3, 2, 1, 0].map(i => `<g opacity="${1 - i * .23}">${cone(9 + i * 3, 6 + i * 1.2, normalAngle, 30)}</g>`).join(''); break;
  }
  const layout = cursorLayout(style, shape);
  let movingStops = '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cursorSize}" height="${cursorSize}" viewBox="0 0 48 48">
    <defs>
      <filter id="cursor-shadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx=".15" dy="1.8" stdDeviation="1.1" flood-opacity=".18"/></filter>
      <filter id="cone-color-blur"><feGaussianBlur stdDeviation=".3"/></filter>
      <filter id="disc-blur"><feGaussianBlur stdDeviation=".3"/></filter>
      <linearGradient id="shade" gradientUnits="userSpaceOnUse" x1="38" y1="29" x2="29.5" y2="37">
        ${movingStops || `<stop offset="0" stop-color="${color}"/>
        <stop offset=".48" stop-color="${color}"/>
        <stop offset=".64" stop-color="${shaded(.08)}"/>
        <stop offset=".82" stop-color="${shaded(.27)}"/>
        <stop offset="1" stop-color="${shaded(.5)}"/>`}
      </linearGradient>
      <g id="form">${shape}</g>
    </defs>
    <g transform="translate(${layout.x} ${layout.y}) scale(${layout.scale})"><use href="#form" filter="url(#cursor-shadow)"/></g>
  </svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function cursorValue(style, color, press = 0) {
  if (!['normal', 'link', 'loading'].includes(style.id)) return style.fallback;
  if (['normal', 'link', 'loading'].includes(style.id)) {
    if (!cursorLayouts.has(style.id)) cursorAsset(style, color, press);
    return 'none';
  }
  return cursorUrl(cursorAsset(style, color, press), style);
}

function refreshCursorPreview() {
  if (!cursorLibrary) return;
  for (const [index, button] of [...cursorGrid.children].entries()) {
    const style = cursorStyles[index];
    button.querySelector('img').src = cursorAsset(style, previewColor);
    button.querySelector('img').style.width = button.querySelector('img').style.height = `${cursorSize}px`;
    button.style.cursor = cursorValue(style, previewColor);
    button.dataset.cursorKind = style.id;
    button.setAttribute('aria-pressed', String(style === selectedCursor));
  }
  for (const button of cursorPalette.children) {
    button.setAttribute('aria-pressed', String(button.dataset.color === previewColor));
  }
  cursorTestImage.src = cursorAsset(selectedCursor, previewColor);
  cursorTestImage.style.width = cursorTestImage.style.height = `${cursorSize * 1.5}px`;
  cursorTestName.textContent = selectedCursor.name;
  cursorTest.dataset.cursorKind = selectedCursor.id;
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
  cursorMotionColor = color;
  cursorPassTransition = null;
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

let loadingPhase = 0;
const loadingFrames = new Map();
const cursorMotionStart = performance.now();
let nativeLoadingStart = null;
// Draw the moving cursor directly; native cursor resources stay stable between frames.
const liveCursorCanvas = document.createElement('canvas');
liveCursorCanvas.id = 'live-motion-cursor';
liveCursorCanvas.setAttribute('aria-hidden', 'true');
liveCursorCanvas.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:2147483647;display:none';
document.body.append(liveCursorCanvas);
const liveCursorContext = liveCursorCanvas.getContext('2d');
let cursorPointer = {x:0,y:0,target:null,inside:false};
let cursorKind = '', lastPreviewPaint = 0;
function inspectLiveCursor() {
  // Resolve the element actually under the pointer, including after scrolling,
  // layout changes and pointer capture. A stale event target can show two cursors.
  const target = cursorPointer.inside ? document.elementFromPoint(cursorPointer.x, cursorPointer.y) : null;
  cursorPointer.target = target;
  if (!(target instanceof Element) || !target.isConnected) { cursorKind = ''; liveCursorCanvas.style.display='none'; return; }
  const cursor = getComputedStyle(target).cursor;
  cursorKind = cursor === 'none' ? (document.body.classList.contains('cursor-loading') ? 'loading' : target.closest('[data-cursor-kind]')?.dataset.cursorKind || (target.closest('button, a, select, input[type=checkbox], input[type=color], input[type=file], .file-label') ? 'link' : 'normal')) : '';
  if (!['normal','link','loading'].includes(cursorKind)) liveCursorCanvas.style.display='none';
}
document.addEventListener('pointermove', event => {
  cursorPointer = {x:event.clientX,y:event.clientY,target:event.target,inside:event.pointerType !== 'touch'};
  inspectLiveCursor();
}, {passive:true,capture:true});
document.addEventListener('pointerover', event => {
  cursorPointer={x:event.clientX,y:event.clientY,target:event.target,inside:event.pointerType!=='touch'};
  inspectLiveCursor();
}, {passive:true,capture:true});
document.addEventListener('pointerout', event => {
  liveCursorCanvas.style.display='none';
  if (!event.relatedTarget) {cursorPointer.inside=false;cursorKind='';}
}, {capture:true,passive:true});
document.addEventListener('pointercancel',()=>{cursorPointer.inside=false;liveCursorCanvas.style.display='none';});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cursorPointer.inside=false;liveCursorCanvas.style.display='none';}});
document.addEventListener('dragstart',()=>{cursorPointer.inside=false;liveCursorCanvas.style.display='none';},true);
window.addEventListener('blur',()=>{cursorPointer.inside=false;liveCursorCanvas.style.display='none';});
const liveFanPaths = Array.from({length:64},(_,i)=>{
  const point = coneBasePoint;
  const a=point(i/64),b=point(Math.min(1,(i+1.08)/64));
  return new Path2D(`M9 6L${a.join(' ')}L${b.join(' ')}Z`);
});
function paintLiveCone(ctx, motion = {}) {
  const from=(motion.from||cursorPassTransition?.from||cursorMotionColor||lastEditorColor).slice(1).match(/../g).map(v=>parseInt(v,16));
  const to=(motion.to||cursorPassTransition?.to||cursorMotionColor||lastEditorColor).slice(1).match(/../g).map(v=>parseInt(v,16));
  const progress = motion.progress ?? (cursorPassTransition ? Math.min(1,(performance.now()-cursorPassTransition.start)/2400) : cursorMotionPhase);
  ctx.save();
  const silhouette = new Path2D(coneContour);
  const shadowScale = Math.hypot(ctx.getTransform().a, ctx.getTransform().b);
  ctx.shadowColor='rgba(0,0,0,.18)';ctx.shadowBlur=(motion.progress !== undefined ? 2.7 : 3.8)*shadowScale;ctx.shadowOffsetX=.15*shadowScale;ctx.shadowOffsetY=1.8*shadowScale;
  ctx.fillStyle='white';ctx.fill(silhouette);
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  ctx.save();ctx.clip(silhouette);
  ctx.filter=`blur(${.38*shadowScale}px)`;
  for(let i=0;i<64;i++) {
    const u=(i+.5)/64;
    ctx.fillStyle=`rgb(${coneLoadingChannels(from,to,progress,u).join(',')})`;
    ctx.fill(liveFanPaths[i]);
  }
  ctx.restore();
  ctx.restore();
}
function paintLiveLoading(ctx) {
  const base=Math.max(0,cursorColors.findIndex(([,c])=>c===lastEditorColor)),sweep=Math.max(.0001,loadingPhase%1);
  const start=-Math.PI/2,end=start+sweep*Math.PI*2;
  ctx.shadowColor='rgba(0,0,0,.12)';ctx.shadowBlur=.8;ctx.shadowOffsetY=1.1;
  ctx.filter='blur(.4px)';
  if(loadingPhase>=1) {
    const previous=cursorColors[(base+Math.floor(loadingPhase)+4)%5][1],g=ctx.createConicGradient(start,24,24);
    g.addColorStop(0,previous);g.addColorStop(1,previous+'00');ctx.fillStyle=g;
    ctx.beginPath();ctx.moveTo(24,24);ctx.arc(24,24,18,end,start+Math.PI*2);ctx.closePath();ctx.fill();
  }
  const color=cursorColors[(base+Math.floor(loadingPhase))%5][1],g=ctx.createConicGradient(start,24,24);
  g.addColorStop(0,color);g.addColorStop(sweep,color+'00');g.addColorStop(1,color+'00');ctx.fillStyle=g;
  ctx.beginPath();ctx.moveTo(24,24);ctx.arc(24,24,18,start,end);ctx.closePath();ctx.fill();
  if(loadingPhase<.1){ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(24,24);ctx.lineTo(24,6);ctx.stroke();}
  ctx.filter='none';ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
}
function tickLiveCursor(now) {
  const elapsed=(now-cursorMotionStart)/1000,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  cursorMotionPhase=reduced?.5:elapsed/2.4%1;
  if(cursorPassTransition&&now-cursorPassTransition.start>=2400){cursorMotionColor=cursorPassTransition.to;cursorPassTransition=null;}
  const isLoading=document.body.classList.contains('cursor-loading');
  if(isLoading&&nativeLoadingStart===null)nativeLoadingStart=now;
  if(!isLoading)nativeLoadingStart=null;
  loadingPhase=reduced?.95:(isLoading?(now-nativeLoadingStart)/1000:elapsed)/2.4;
  inspectLiveCursor();
  const visible=cursorPointer.inside&&cursorRoot.classList.contains('custom-cursors')&&['normal','link','loading'].includes(cursorKind)&&!document.hidden;
  liveCursorCanvas.style.display=visible?'block':'none';
  if(visible){
    const style=cursorStyles.find(s=>s.id===cursorKind),layout=cursorLayouts.get(style.id);
    const dpr=Math.min(devicePixelRatio||1,2),size=cursorSize;
    const padding=Math.max(8,size*.18),canvasSize=size+padding*2;
    if(liveCursorCanvas.width!==Math.round(canvasSize*dpr)){liveCursorCanvas.width=liveCursorCanvas.height=Math.round(canvasSize*dpr);liveCursorCanvas.style.width=liveCursorCanvas.style.height=canvasSize+'px';}
    const hot=style.hot.map((v,i)=>(v*layout.scale+(i?layout.y:layout.x))*size/48);
    liveCursorCanvas.style.transform=`translate3d(${cursorPointer.x-hot[0]-padding}px,${cursorPointer.y-hot[1]-padding}px,0)`;
    const ctx=liveCursorContext;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,canvasSize,canvasSize);
    ctx.translate(padding,padding);ctx.scale(size/48,size/48);ctx.translate(layout.x,layout.y);ctx.scale(layout.scale,layout.scale);
    if(cursorKind==='normal'||cursorKind==='link') {
      if(cursorKind==='link') {ctx.translate(9,6);ctx.rotate(Math.PI/2-Math.atan2(27,24.75));ctx.translate(-9,-6);}
      paintLiveCone(ctx);
    } else paintLiveLoading(ctx);
  }
  if(cursorGrid&&!cursorLibrary.hidden&&now-lastPreviewPaint>120){
    const normal=cursorStyles[0],loading=cursorStyles.find(s=>s.id==='loading');
    const normalAsset=cursorAsset(normal,cursorMotionColor||lastEditorColor),loadingAsset=cursorAsset(loading,lastEditorColor,0,loadingPhase);
    cursorGrid.children[0].querySelector('img').src=normalAsset;
    const linkAsset=cursorAsset(cursorStyles.find(s=>s.id==='link'),cursorMotionColor||lastEditorColor);
    cursorGrid.children[cursorStyles.findIndex(s=>s.id==='link')].querySelector('img').src=linkAsset;
    cursorGrid.children[cursorStyles.indexOf(loading)].querySelector('img').src=loadingAsset;
    if(selectedCursor.id==='normal')cursorTestImage.src=normalAsset;
    if(selectedCursor.id==='link')cursorTestImage.src=linkAsset;
    if(selectedCursor.id==='loading')cursorTestImage.src=loadingAsset;
    lastPreviewPaint=now;
  }
  requestAnimationFrame(tickLiveCursor);
}
requestAnimationFrame(tickLiveCursor);
document.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !(cursorEnable?.checked ?? true)) return;
  const from = cursorPassTransition?.to || cursorMotionColor || lastEditorColor;
  const index = Math.max(0, cursorColors.findIndex(([, c]) => c === from));
  cursorPassTransition = {from, to:cursorColors[(index+1)%cursorColors.length][1], start:performance.now()};
});

let handPress = 0;
let handAnimation;
const handStyle = cursorStyles.find(style => style.id === 'link');
function animateHandPress() {
  // Click feedback is the color handoff; keep the silhouette at a constant size.
  handPress = 0;
  if (cursorTestImage) cursorTestImage.style.transform = 'none';
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
