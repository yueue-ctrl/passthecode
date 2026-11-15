const demoStage = document.querySelector('#demo-stage');
const chapterList = document.querySelector('#chapter-list');
const chapterDot = document.querySelector('#chapter-dot');
const demoPlay = document.querySelector('#demo-play');
const loadingDisc = document.querySelector('#loading-disc');
const loadingContext = loadingDisc.getContext('2d');
const coneCanvas = document.querySelector('#cone-demo');
const coneContext = coneCanvas.getContext('2d');
const demoEase = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
let demoTime = 0, previousTime, demoRunning = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let activeScene = 0, coneColorIndex = Math.max(0, cursorColors.findIndex(([, c]) => c === lastEditorColor));
const demoStartColorIndex = coneColorIndex;
let pressTime = -10;
let coneTransition = null, queuedConePasses = 0, coneAutoAt = 0;
function beginConePass() {
  coneTransition = { from: coneColorIndex, to: (coneColorIndex + 1) % cursorColors.length, start: demoTime };
}
const scenes = [['Cursor', 'Color passes continuously along the cone.'], ['Loading', 'A pale edge passes clockwise. One revolution, one color.']];
function selectScene(index) {
  if (coneTransition) coneColorIndex = coneTransition.to;
  coneTransition = null; queuedConePasses = 0; coneAutoAt = 0;
  activeScene = index; demoTime = 0;
  for (const [i, button] of [...chapterList.children].entries()) {
    if (i === index) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
  }
  const rect = chapterList.children[index].getBoundingClientRect();
  const bounds = document.querySelector('#demo-chapters').getBoundingClientRect();
  const horizontal = demoStage.clientWidth <= 620;
  const next = horizontal ? rect.left - bounds.left + rect.width / 2 : rect.top - bounds.top + rect.height / 2;
  const transform = horizontal ? `translateX(${next}px) translateX(-50%)` : `translateY(${next}px) translateY(-50%)`;
  const current = getComputedStyle(chapterDot).transform;
  chapterDot.style.transform = transform;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) chapterDot.animate([{transform: current},{transform}], {duration:650,easing:'cubic-bezier(.22,1,.36,1)'});
  document.querySelector('#scene-detail').textContent = scenes[index][1];
  document.querySelector('#scene-title').textContent = scenes[index][0];
  document.querySelector('#scene-counter').textContent = `0${index + 1} / 02`;
  coneCanvas.hidden = index !== 0; loadingDisc.hidden = index !== 1;
}
scenes.forEach(([name], index) => {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'chapter'; button.textContent = name;
  button.addEventListener('click', () => selectScene(index)); chapterList.append(button);
});
function demoBase() {
  const w = demoStage.clientWidth, h = demoStage.clientHeight;
  const rail = w <= 620 ? 0 : w <= 900 ? 205 : Math.max(260, w * .24);
  return {x:rail, y:w <= 620 ? 180 : 60, width:w-rail, height:h-(w <= 620 ? 190 : 80)};
}
function drawCone(time, box) {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = box.width, h = box.height;
  Object.assign(coneCanvas.style, {left:box.x+'px',top:box.y+'px',width:w+'px',height:h+'px'});
  if (coneCanvas.width !== Math.round(w*dpr) || coneCanvas.height !== Math.round(h*dpr)) {coneCanvas.width=Math.round(w*dpr);coneCanvas.height=Math.round(h*dpr);}
  const ctx = coneContext;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const size = Math.min(w*.48,h*.5,340);
  const pressed = Math.max(0,1-(time-pressTime)/.25);
  ctx.translate(w/2,h/2);
  ctx.scale(size/31,size/31);
  ctx.translate(-23.5,-21.5);
  if (coneTransition && time - coneTransition.start >= 2.4) {
    coneColorIndex = coneTransition.to; coneTransition = null;
    document.documentElement.style.setProperty('--demo-color', cursorColors[coneColorIndex][1]);
    if (queuedConePasses > 0) { queuedConePasses--; beginConePass(); }
  }
  if (!coneTransition && time >= coneAutoAt) { beginConePass(); coneAutoAt = time + 2.4; }
  const progress = coneTransition ? Math.max(0, Math.min(1, (time-coneTransition.start)/2.4)) : 1;
  paintLiveCone(ctx, {
    from: cursorColors[coneTransition ? coneTransition.from : coneColorIndex][1],
    to: cursorColors[coneTransition ? coneTransition.to : coneColorIndex][1],
    progress, phase: progress % 1,
  });

}
coneCanvas.addEventListener('click',()=>{
  if (coneTransition) queuedConePasses = Math.min(queuedConePasses + 1, cursorColors.length);
  else beginConePass();
  pressTime = demoTime;
});
coneCanvas.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();coneCanvas.click();}});
function drawLoadingDisc(time, box) {
  const w = Math.min(demoStage.clientWidth - 40, Math.max(box.width, 420));
  const h = Math.min(demoStage.clientHeight * .72, 440);
  const density = Math.min(devicePixelRatio || 1, 2);
  const left = box.x + box.width / 2 - w / 2;
  Object.assign(loadingDisc.style, { left: `${left}px`, top: `${box.y + box.height / 2 - h / 2}px`, width: `${w}px`, height: `${h}px` });
  if (loadingDisc.width !== Math.round(w * density) || loadingDisc.height !== Math.round(h * density)) {
    loadingDisc.width = Math.round(w * density); loadingDisc.height = Math.round(h * density);
  }
  const ctx = loadingContext;
  ctx.setTransform(density, 0, 0, density, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const turns = Math.max(0, time - .45) / 2.4;
  const angle = turns * Math.PI * 2;
  const color = cursorColors[(demoStartColorIndex + Math.floor(turns)) % cursorColors.length][1];
  const radius = Math.min(w * .32, h * .43), cx = w / 2, cy = h / 2;
  // The original beam is a radius: its lower endpoint stays fixed while color passes clockwise.
  // Sweep a sector from that endpoint instead of folding or morphing a rectangular strip.
  if (angle > 0) {
    ctx.save();
    ctx.filter = 'blur(2.5px)';
    const sweep = Math.max(.0001, turns % 1);
    const start = -Math.PI / 2;
    const end = start + sweep * Math.PI * 2;
    // The saturated edge stays at the original beam; the pale edge leads the sweep.
    if (turns >= 1) {
      const previous = cursorColors[(demoStartColorIndex + Math.floor(turns) - 1) % cursorColors.length][1];
      const tail = ctx.createConicGradient(start, cx, cy);
      tail.addColorStop(0, previous); tail.addColorStop(1, previous + '00');
      ctx.fillStyle = tail;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius, end, start + Math.PI * 2); ctx.closePath(); ctx.fill();
    }
    const gradient = ctx.createConicGradient(start, cx, cy);
    gradient.addColorStop(0, color);
    gradient.addColorStop(sweep, color + '00');
    gradient.addColorStop(1, color + '00');
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius, start, end); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (time < .7) {
    ctx.save();
    ctx.globalAlpha = 1 - demoEase((time - .45) / .25);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowColor = color; ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - radius); ctx.stroke();
    ctx.restore();
  }

}
function tick(now) {
  if(previousTime !== undefined && demoRunning) demoTime += Math.min(.08,(now-previousTime)/1000);
  previousTime=now;
  const box=demoBase();
  if(activeScene===0)drawCone(demoTime,box);else drawLoadingDisc(demoTime % 14.8,box);
  requestAnimationFrame(tick);
}
demoPlay.addEventListener('click',()=>{demoRunning=!demoRunning;demoPlay.textContent=demoRunning?'Pause':'Play';});
document.querySelector('#demo-fullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen();else demoStage.requestFullscreen?.();});
window.addEventListener('resize',()=>selectScene(activeScene));
selectScene(0);demoPlay.textContent=demoRunning?'Pause':'Play';requestAnimationFrame(tick);
