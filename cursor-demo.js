const demoStage = document.querySelector('#demo-stage');
const demoCard = document.querySelector('#demo-card');
const demoTile = document.querySelector('#demo-tile');
const demoCopy = document.querySelector('#demo-copy');
const demoPass = document.querySelector('#demo-pass');
const demoPointer = document.querySelector('#demo-pointer');
const demoScene = document.querySelector('#demo-scene');
const demoPlay = document.querySelector('#demo-play');
const demoMode = document.querySelector('#demo-mode');
const chapterList = document.querySelector('#chapter-list');
const chapterDot = document.querySelector('#chapter-dot');
let chapterDotPosition;
let chapterDotAnimation;
const demoScenes = [
  ['Point & select', 'Approach. Hover. Press. Release.', 4],
  ['Text', 'A precise insertion point. Words follow.', 5],
  ['Drag', 'Pick up a phrase and carry it across the page.', 4],
  ['Resize ↔', 'The edge follows the horizontal gesture.', 4],
  ['Resize ↕', 'A vertical pull changes the working space.', 4],
  ['Resize ↘ / ↗', 'Corners stretch on both axes.', 5],
  ['Move', 'Reposition the whole surface.', 4],
  ['Loading', 'Fixed cones. A light passing from one to the next.', 3],
  ['Pass', 'A new collaborator. A new color.', 4],
];
const demoDuration = demoScenes.reduce((sum, scene) => sum + scene[2], 0);
let demoTime = 0, demoRunning = !matchMedia('(prefers-reduced-motion: reduce)').matches, demoManual = false;
let demoPreviousTime, demoColor = lastEditorColor, demoCycle = 0, demoAssetKey, demoAsset;
const demoStartColorIndex = Math.max(0, cursorColors.findIndex(([, color]) => color === demoColor));
let demoTileOffset = { x: 0, y: 0 };
let demoGeometry, demoPointerPosition = { x: 0, y: 0 }, demoGesture;
let demoManualType = 'normal';
let demoManualPress = 0;
let demoLastScene = -1;
let demoManualCopy = 'pass the code';
for (const [i, scene] of demoScenes.entries()) {
  const option = document.createElement('option'); option.value = i; option.textContent = scene[0]; demoScene.append(option);
  const chapter = document.createElement('button');
  chapter.type = 'button'; chapter.className = 'chapter'; chapter.textContent = scene[0];
  chapter.addEventListener('click', () => {
    if (demoManual) demoMode.click();
    demoTime = demoScenes.slice(0, i).reduce((sum, scene) => sum + scene[2], 0) + .01;
    demoLastScene = -1;
  });
  chapterList.append(chapter);
}
chapterList.addEventListener('scroll', () => {
  if (demoStage.clientWidth > 620 || demoLastScene < 0) return;
  const rect = chapterList.children[demoLastScene].getBoundingClientRect();
  const bounds = document.querySelector('#demo-chapters').getBoundingClientRect();
  chapterDotPosition = rect.left - bounds.left + rect.width / 2;
  chapterDot.style.transform = `translateX(${chapterDotPosition}px) translateX(-50%)`;
});
const demoEase = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const demoMix = (a, b, t) => a + (b - a) * demoEase(t);
function demoBase() {
  const w = demoStage.clientWidth, h = demoStage.clientHeight;
  const mobile = w <= 620;
  const rail = mobile ? 0 : w <= 900 ? 205 : Math.max(260, w * .24);
  const available = w - rail;
  const width = Math.min(610, available * .83);
  const height = Math.min(285, mobile ? h * .43 : h * .48);
  return { x: rail + (available - width) / 2, y: Math.max(mobile ? 200 : 90, (h - height) / 2 - (mobile ? -35 : 15)), width, height };
}
function demoSelectChapter(index, animate = true) {
  for (const [i, chapter] of [...chapterList.children].entries()) {
    if (i === index) chapter.setAttribute('aria-current', 'step');
    else chapter.removeAttribute('aria-current');
  }
  const chapter = chapterList.children[index];
  const mobile = demoStage.clientWidth <= 620;
  const container = document.querySelector('#demo-chapters').getBoundingClientRect();
  const rect = chapter.getBoundingClientRect();
  const next = mobile ? rect.left - container.left + rect.width / 2 : rect.top - container.top + rect.height / 2;
  const translate = value => mobile ? `translateX(${value}px) translateX(-50%)` : `translateY(${value}px) translateY(-50%)`;
  const currentTransform = getComputedStyle(chapterDot).transform;
  const indicator = chapterDot.getBoundingClientRect();
  const previous = mobile ? indicator.left + indicator.width / 2 - container.left : indicator.top + indicator.height / 2 - container.top;
  chapterDotAnimation?.cancel();
  chapterDot.style.transform = translate(next);
  if (animate && chapterDotPosition !== undefined && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const axis = mobile ? 'X' : 'Y';
    const dot = 6 / 28;
    const matrix = new DOMMatrixReadOnly(currentTransform === 'none' ? undefined : currentTransform);
    const startScale = mobile ? Math.hypot(matrix.a, matrix.b) : Math.hypot(matrix.c, matrix.d);
    const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * t * (t * (t * 6 - 15) + 10); };
    const frames = Array.from({ length: 91 }, (_, i) => {
      const t = i / 90;
      const position = previous + (next - previous) * smooth((t - .12) / .76);
      const size = t < .36 ? startScale + (dot - startScale) * smooth(t / .36)
        : dot + (1 - dot) * smooth((t - .64) / .36);
      return { transform: `${translate(position)} scale${axis}(${size})`, offset: t };
    });
    chapterDotAnimation = chapterDot.animate(frames, { duration: 920, easing: 'linear' });
  }
  chapterDotPosition = next;
  if (mobile) chapter.scrollIntoView({ block: 'nearest', inline: 'center', behavior: animate ? 'smooth' : 'auto' });
}

function demoApplyBox(box) {
  Object.assign(demoCard.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` });
}
function demoDrawPointer(type, x, y, press = 0, loading = 0) {
  const style = cursorStyles.find(style => style.id === type) || cursorStyles[0];
  const key = [type, demoColor, cursorSize, Math.round(press * 12), loading].join(':');
  if (key !== demoAssetKey) {
    demoAssetKey = key; demoAsset = cursorAsset(style, demoColor, Math.round(press * 12) / 12, loading);
    demoPointer.src = demoAsset;
  }
  const layout = cursorLayouts.get(style.id);
  const hot = style.hot.map((v, axis) => (v * layout.scale + (axis ? layout.y : layout.x)) * cursorSize / 48);
  Object.assign(demoPointer.style, { width: `${cursorSize}px`, height: `${cursorSize}px`, left: `${x - hot[0]}px`, top: `${y - hot[1]}px` });
}
function demoAuto() {
  let time = demoTime % demoDuration, sceneIndex = 0;
  while (time >= demoScenes[sceneIndex][2]) time -= demoScenes[sceneIndex++][2];
  const progress = time / demoScenes[sceneIndex][2];
  const box = demoBase();
  let x = box.x - 60, y = box.y + box.height + 45, type = 'normal', press = 0;
  const pull = progress < .65 ? demoEase((progress - .25) / .4) : 1 - demoEase((progress - .7) / .3);
  demoTile.style.transform = '';
  demoCopy.textContent = 'pass the code';
  demoPass.classList.remove('is-pressed');
  demoCard.classList.toggle('is-active', sceneIndex >= 2 && sceneIndex <= 6 && progress > .25 && progress < .9);
  if (sceneIndex === 0 || sceneIndex === 8) {
    const targetX = box.x + box.width - 62, targetY = box.y + box.height - 44;
    x = demoMix(box.x - 55, targetX, progress / .42); y = demoMix(box.y + box.height + 40, targetY, progress / .42);
    type = progress > .4 ? 'link' : 'normal';
    press = progress > .55 && progress < .7 ? Math.sin((progress - .55) / .15 * Math.PI) : 0;
    demoPass.classList.toggle('is-pressed', press > .2);
    if (sceneIndex === 8 && progress > .65) demoColor = cursorColors[(demoStartColorIndex + demoCycle + 1) % cursorColors.length][1];
  } else if (sceneIndex === 1) {
    x = demoMix(box.x + box.width + 50, box.x + 40, progress / .25); y = box.y + 90;
    type = progress > .2 ? 'text' : 'normal';
    const text = 'pass the code. together.';
    demoCopy.textContent = progress < .3 ? 'pass the code' : text.slice(0, Math.min(text.length, Math.floor((progress - .3) / .6 * text.length)));
    if (progress > .3) x = box.x + 28 + Math.min(box.width - 60, demoCopy.textContent.length * Math.min(26, innerWidth * .02));
  } else if (sceneIndex === 2) {
    const dx = Math.min(170, box.width * .3) * pull, dy = -65 * pull;
    x = box.x + 110 + dx; y = box.y + 171 + dy;
    type = progress < .22 ? 'link' : progress > .9 ? 'normal' : 'drag';
    demoTile.style.transform = `translate(${dx}px, ${dy}px)`;
  } else if (sceneIndex === 3) {
    box.width += Math.min(150, demoStage.clientWidth * .12) * pull; x = box.x + box.width; y = box.y + box.height / 2; type = 'horizontal';
  } else if (sceneIndex === 4) {
    box.height += 80 * pull; x = box.x + box.width / 2; y = box.y + box.height; type = 'vertical';
  } else if (sceneIndex === 5) {
    const second = progress > .5;
    const motion = Math.sin(progress * Math.PI * 2) ** 2;
    box.width += 110 * motion; box.height += 55 * motion;
    x = box.x + box.width; y = second ? box.y : box.y + box.height; type = second ? 'diagonal-1' : 'diagonal-2';
  } else if (sceneIndex === 6) {
    box.x += 100 * Math.sin(progress * Math.PI * 2); box.y -= 55 * Math.sin(progress * Math.PI);
    x = box.x + box.width / 2; y = box.y + 18; type = 'move';
  } else {
    x = box.x + box.width / 2; y = box.y + box.height / 2; type = 'loading'; demoCopy.textContent = 'passing the code…';
  }
  demoApplyBox(box);
  if (sceneIndex !== demoLastScene) {
    demoLastScene = sceneIndex; demoScene.value = sceneIndex;
    demoSelectChapter(sceneIndex);
    document.querySelector('#scene-title').textContent = demoScenes[sceneIndex][0];
    document.querySelector('#scene-detail').textContent = demoScenes[sceneIndex][1];
    document.querySelector('#scene-counter').textContent = `${String(sceneIndex + 1).padStart(2, '0')} / 09`;
  }
  document.querySelector('#demo-progress').style.width = `${(demoTime % demoDuration) / demoDuration * 100}%`;
  demoDrawPointer(type, x, y, press, type === 'loading' ? Math.floor(time / .09) / 2 % 8 : 0);
}
function demoTick(now) {
  if (demoPreviousTime !== undefined && demoRunning && !demoManual) {
    const previousCycle = Math.floor(demoTime / demoDuration);
    demoTime += Math.min(.08, (now - demoPreviousTime) / 1000);
    if (Math.floor(demoTime / demoDuration) !== previousCycle) { demoCycle++; demoColor = cursorColors[(demoStartColorIndex + demoCycle) % 5][1]; }
  }
  demoPreviousTime = now;
  if (document.documentElement.style.getPropertyValue('--demo-color') !== demoColor) document.documentElement.style.setProperty('--demo-color', demoColor);
  if (!demoManual) demoAuto();
  else demoDrawPointer(demoManualType, demoPointerPosition.x, demoPointerPosition.y, demoManualPress);
  requestAnimationFrame(demoTick);
}
demoPlay.addEventListener('click', () => { demoRunning = !demoRunning; demoPlay.textContent = demoRunning ? 'Pause' : 'Play'; });
demoScene.addEventListener('change', () => {
  demoTime = demoScenes.slice(0, Number(demoScene.value)).reduce((sum, scene) => sum + scene[2], 0) + .01;
  demoLastScene = -1;
});
demoMode.addEventListener('click', () => {
  demoManual = !demoManual; demoMode.textContent = demoManual ? 'Auto demo' : 'Try it yourself';
  demoPlay.disabled = demoManual; demoScene.disabled = demoManual;
  if (demoManual) {
    demoGeometry = demoBase(); demoApplyBox(demoGeometry); demoTileOffset = { x: 0, y: 0 }; demoTile.style.transform = ''; demoCopy.textContent = demoManualCopy;
    chapterDotAnimation?.cancel();
    for (const chapter of chapterList.children) chapter.removeAttribute('aria-current');
    document.querySelector('.sidebar-eyebrow').textContent = 'YOUR TURN';
    document.querySelector('#scene-title').textContent = 'Your turn.';
    document.querySelector('#scene-detail').textContent = 'Drag the phrase. Move the top edge. Resize the sides and corners. Click the text and type.';
    demoCard.classList.remove('is-active');
  } else { document.querySelector('.sidebar-eyebrow').textContent = 'NOW SHOWING'; demoLastScene = -1; }
});
function demoHit(event) {
  const b = demoCard.getBoundingClientRect(), s = demoStage.getBoundingClientRect();
  const x = event.clientX - b.left, y = event.clientY - b.top;
  const edgeX = Math.abs(x - b.width) < 15 ? 'right' : Math.abs(x) < 15 ? 'left' : '';
  const edgeY = Math.abs(y - b.height) < 15 ? 'bottom' : Math.abs(y) < 15 ? 'top' : '';
  if (edgeX && edgeY) return { type: (edgeX === 'right') === (edgeY === 'bottom') ? 'diagonal-2' : 'diagonal-1', edgeX, edgeY };
  if (edgeX) return { type: 'horizontal', edgeX };
  if (edgeY === 'bottom') return { type: 'vertical', edgeY };
  if (y >= 0 && y < 35 && x >= 0 && x <= b.width) return { type: 'move' };
  if (event.target.closest('#demo-pass')) return { type: 'link' };
  if (event.target.closest('#demo-tile')) return { type: 'drag' };
  if (event.target.closest('#demo-copy')) return { type: 'text' };
  return { type: 'normal' };
}
demoStage.addEventListener('pointermove', event => {
  const rect = demoStage.getBoundingClientRect(); demoPointerPosition = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  if (!demoManual) return;
  if (!demoGesture) { demoManualType = demoHit(event).type; return; }
  const dx = event.clientX - demoGesture.x, dy = event.clientY - demoGesture.y;
  const b = { ...demoGesture.box };
  if (demoGesture.type === 'move') { b.x += dx; b.y += dy; }
  else if (demoGesture.type === 'drag') {
    demoTileOffset = { x: demoGesture.tile.x + dx, y: demoGesture.tile.y + dy };
    demoTile.style.transform = `translate(${demoTileOffset.x}px,${demoTileOffset.y}px)`;
  }
  else {
    if (demoGesture.edgeX === 'right') b.width = Math.max(300, b.width + dx);
    if (demoGesture.edgeX === 'left') { b.width = Math.max(300, b.width - dx); b.x += demoGesture.box.width - b.width; }
    if (demoGesture.edgeY === 'bottom') b.height = Math.max(220, b.height + dy);
    if (demoGesture.edgeY === 'top') { b.height = Math.max(220, b.height - dy); b.y += demoGesture.box.height - b.height; }
  }
  demoGeometry = b; demoApplyBox(b);
});
demoStage.addEventListener('pointerdown', event => {
  if (!demoManual) return;
  demoStage.focus({ preventScroll: true });
  const hit = demoHit(event); demoManualType = hit.type; demoManualPress = hit.type === 'link' ? 1 : 0;
  demoCopy.dataset.editing = String(hit.type === 'text');
  demoGesture = { ...hit, x: event.clientX, y: event.clientY, box: { ...demoGeometry }, tile: { ...demoTileOffset } };
  demoStage.setPointerCapture(event.pointerId);
});
function demoRelease() { demoGesture = undefined; demoManualPress = 0; }
demoStage.addEventListener('pointerup', demoRelease); demoStage.addEventListener('pointercancel', demoRelease);
demoPass.addEventListener('click', () => { if (demoManual) demoColor = cursorColors[(cursorColors.findIndex(([, color]) => color === demoColor) + 1) % 5][1]; });
document.addEventListener('keydown', event => {
  if (!demoManual || demoCopy.dataset.editing !== 'true' || event.metaKey || event.ctrlKey || event.altKey || event.target.closest('.demo-dock')) return;
  if (event.key === 'Backspace') { event.preventDefault(); demoManualCopy = [...demoManualCopy].slice(0, -1).join(''); }
  else if (event.key.length === 1) { event.preventDefault(); demoManualCopy += event.key; }
  demoCopy.textContent = demoManualCopy;
});
const demoFullscreenButton = document.querySelector('#demo-fullscreen');
function demoExitImmersive() {
  document.body.classList.remove('demo-immersive');
  demoFullscreenButton.textContent = 'Full screen ↗';
}
demoFullscreenButton.addEventListener('click', async () => {
  if (document.body.classList.contains('demo-immersive')) { demoExitImmersive(); return; }
  if (document.fullscreenElement) { await document.exitFullscreen(); return; }
  try { await document.documentElement.requestFullscreen(); }
  catch {
    document.body.classList.add('demo-immersive');
    demoStage.focus({ preventScroll: true });
    demoFullscreenButton.textContent = 'Exit full screen';
    document.querySelector('#demo-status').textContent = 'Immersive mode. Move to the bottom for controls. Press Escape to exit.';
  }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') demoExitImmersive(); });
window.addEventListener('resize', () => { if (demoLastScene >= 0) demoSelectChapter(demoLastScene, false); if (demoManual) { demoGeometry = demoBase(); demoApplyBox(demoGeometry); } });
demoPlay.textContent = demoRunning ? 'Pause' : 'Play';
requestAnimationFrame(demoTick);
