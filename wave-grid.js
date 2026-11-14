// Words keep their proportions; only the two group sizes and their shared alignment change.
function renderKineticGrid(options) {
  const { poster, composition, phrases, clock, amount, speed, colors, colorMode, colorPhase, seed,
    music, running, strength, blur, tracking, typeScale, measure, wordGap, reach, keywordOpacity } = options;
  const keywordIndex = phrases.findIndex(p => p.element.classList.contains('rotation-keyword'));
  if (keywordIndex < 0) return;
  const width = poster.clientWidth, height = poster.clientHeight;
  const mix = (a, b, t) => a + (b - a) * t;
  const motionPhase = clock * speed;
  const beat = Math.max(0, Math.min(1, music * strength));
  const items = phrases.map((phrase, index) => {
    if (!phrase.gridInk) {
      phrase.gridToken = phrase.element.textContent;
      phrase.gridBackground = document.createElement('span');
      phrase.gridBackground.className = 'grid-cell-color';
      phrase.gridInk = document.createElement('span');
      phrase.gridInk.className = 'grid-cell-ink';
      if (phrase.letters.length) phrase.gridInk.append(...phrase.letters);
      else phrase.gridInk.textContent = phrase.gridToken.trim();
      phrase.element.replaceChildren(phrase.gridBackground, phrase.gridInk);
    }
    const wave = (Math.sin(clock * 1.7 - index * .52) + 1) / 2;
    const target = Math.min(1, (.2 + music * (.3 + .6 * wave)) * strength);
    if (running) phrase.energy += (target - phrase.energy) * .12;
    let advance = 0, ascent = 0, descent = 0, inkLeft = 0, inkRight = 0;
    phrase.letters.forEach((letter, i) => {
      const tint = Math.max(.07, 1 - (i + .5) / phrase.letters.length / 1.1);
      const weight = 100 + phrase.energy * tint * 800;
      letter.style.setProperty('--weight', weight);
      const m = measure(letter.textContent, weight);
      inkLeft = Math.min(inkLeft, advance - m.actualBoundingBoxLeft);
      inkRight = Math.max(inkRight, advance + m.actualBoundingBoxRight);
      advance += m.width + tracking * 100;
      ascent = Math.max(ascent, m.actualBoundingBoxAscent);
      descent = Math.max(descent, m.actualBoundingBoxDescent);
    });
    const space = /^\s+$/u.test(phrase.gridToken);
    if (space) {
      const breath = Math.sin(motionPhase * 3.4 - index * .6);
      advance = Math.max(3, (12 + wordGap * 100) * (1 + amount * (.24 * breath + .32 * beat)));
    }
    if (!advance) {
      const m = measure(phrase.gridToken, 400);
      advance = m.width; ascent = m.actualBoundingBoxAscent; descent = m.actualBoundingBoxDescent;
    }
    const inset = space ? 0 : .35 - inkLeft;
    if (!space) { advance = Math.max(advance, inkRight) + inset + .35; ascent += .35; descent += .35; }
    return { phrase, advance, ascent, descent, space, inset };
  });
  const prefix = items.slice(0, keywordIndex), keyword = items.slice(keywordIndex);
  const groupMetrics = group => ({
    width: group.reduce((n, item) => n + item.advance, 0),
    ascent: Math.max(...group.map(item => item.ascent)),
    descent: Math.max(...group.map(item => item.descent)),
  });
  const theIndex = prefix.findIndex(item => item.phrase.gridToken.toLowerCase() === 'the');
  const groups = theIndex > 0 ? [prefix.slice(0, theIndex), prefix.slice(theIndex), keyword] : [prefix, [], keyword];
  const metrics = groups.map(group => group.length ? groupMetrics(group) : { width: 0, ascent: 0, descent: 0 });
  const states = [
    { widths: [.22, .16, .62], align: 'up' },
    { widths: [.45, .25, .30], align: 'bottom' },
    { widths: [.21, .17, .62], align: 'top' },
    { widths: [.38, .30, .32], align: 'up' },
    { widths: [.18, .15, .67], align: 'down' },
    { widths: [.42, .18, .40], align: 'cascade' },
    { widths: [.24, .34, .42], align: 'bottom' },
    { widths: [.36, .24, .40], align: 'down' },
    { widths: [.16, .23, .61], align: 'valley' },
    { widths: [.44, .30, .26], align: 'top' },
    { widths: [.28, .18, .54], align: 'cascade' },
    { widths: [.30, .38, .32], align: 'valley' },
    { widths: [.50, .18, .32], align: 'peak' },
    { widths: [.20, .22, .58], align: 'rise' },
    { widths: [.32, .40, .28], align: 'top' },
    { widths: [.16, .18, .66], align: 'bottom' },
    { widths: [.46, .26, .28], align: 'reverse' },
    { widths: [.23, .35, .42], align: 'peak' },
    { widths: [.33, .17, .50], align: 'up' },
    { widths: [.40, .35, .25], align: 'rise' },
    { widths: [.17, .29, .54], align: 'down' },
    { widths: [.35, .20, .45], align: 'reverse' },
    { widths: [.24, .44, .32], align: 'bottom' },
    { widths: [.27, .18, .55], align: 'peak' },
  ];
  const position = clock * speed / 2.4;
  const step = Math.floor(position), progress = position - step;
  const t = Math.max(0, Math.min(1, (progress - .835) / .165));
  // Smooth acceleration and deceleration keep connected cells moving on one curve.
  const blend = t * t * t * (t * (t * 6 - 15) + 10);
  function layout(state) {
    const available = width * typeScale;
    const widths = state.widths.map((value, i) => mix([.30, .20, .50][i], value, amount));
    const scales = metrics.map((m, i) => available * widths[i] / Math.max(1, m.width));
    const heights = metrics.map((m, i) => (m.ascent + m.descent) * scales[i]);
    const max = Math.max(...heights);
    let ys;
    if (state.align === 'top') ys = [0, 0, 0];
    else if (state.align === 'bottom') ys = heights.map(h => max - h);
    else if (state.align === 'up') ys = [heights[2], heights[2], 0];
    else if (state.align === 'down') ys = [0, 0, Math.max(heights[0], heights[1])];
    else if (state.align === 'cascade') ys = [0, heights[0] * .65, heights[0] * .65 + heights[1] * .65];
    else if (state.align === 'peak') ys = [heights[1] * .7, 0, heights[1] * .7];
    else if (state.align === 'rise') ys = [heights[1] + heights[2], heights[2], 0];
    else if (state.align === 'reverse') ys = [heights[1] * .65 + heights[2] * .65, heights[2] * .65, 0];
    else ys = [0, max * .75, 0];
    // Keep every neighboring pair joined, including throughout interpolation.
    for (let i = 1; i < ys.length; i++) {
      ys[i] = Math.max(ys[i - 1] - heights[i], Math.min(ys[i - 1] + heights[i - 1], ys[i]));
    }
    const minY = Math.min(...ys);
    ys = ys.map(y => y - minY);
    const totalH = Math.max(...ys.map((y, i) => y + heights[i]));
    const top = (height - totalH) / 2;
    let x = (width - available) / 2;
    const cells = [];
    groups.forEach((group, i) => {
      for (const item of group) {
        const w = item.advance * scales[i];
        cells.push({ x, y: top + ys[i], w, h: heights[i], scale: scales[i],
          ascent: metrics[i].ascent, descent: metrics[i].descent });
        x += w;
      }
    });
    return cells;
  }
  let a = layout(states[step % states.length]), b = layout(states[(step + 1) % states.length]);
  if (poster.gridMotionStep !== step) {
    poster.gridMotionStep = step;
    poster.gridMotionStart = null;
  }
  if (progress >= .76 && !poster.gridMotionStart && poster.gridLastLayout) poster.gridMotionStart = poster.gridLastLayout;
  if (poster.gridMotionStart?.length === a.length) a = poster.gridMotionStart;
  const frame = a.map((cell, i) => Object.fromEntries(Object.keys(cell).map(key => [key, mix(cell[key], b[i][key], blend)])));
  poster.gridLastLayout = frame;
  Object.assign(composition.firstElementChild.style, { top: '0px', height: `${height}px` });
  items.forEach((item, index) => {
    const { phrase, space } = item;
    const from = frame[index], to = frame[index];
    const x = mix(from.x, to.x, blend), y = mix(from.y, to.y, blend);
    const w = from.w, h = from.h;
    const heldKeyword = poster.gridMotionStart && index >= keywordIndex;
    const scale = heldKeyword ? Math.min(w / Math.max(1, item.advance), h / Math.max(1, item.ascent + item.descent)) : from.scale;
    Object.assign(phrase.element.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`,
      opacity: '1', clipPath: index >= keywordIndex && keywordOpacity < .999 ? `inset(-2px ${(1 - keywordOpacity) * 100}% -2px -2px)` : 'none' });
    let colorIndex = index % colors.length, fade = 1;
    if (colorMode !== 'original') {
      const hash = Math.imul(seed ^ (index + 1), 1597334677) >>> 0;
      const cycle = hash % colors.length + (colorMode === 'music' ? colorPhase + (hash % 1000) / 1000 : 0);
      colorIndex = Math.floor(cycle) % colors.length;
      if (colorMode === 'music') fade = Math.min(1, cycle % 1 / .12, (1 - cycle % 1) / .12);
    }
    phrase.element.style.setProperty('--grid-color', colors[colorIndex]);
    const breath = (Math.sin(motionPhase * 3.4 - index * .6) + 1) / 2;
    const motionAccent = 4 * blend * (1 - blend);
    const fill = Math.min(1, .42 + phrase.energy * .3 + beat * .18 + motionAccent * .1);
    phrase.element.style.setProperty('--grid-reach', `${Math.min(92, Math.max(20, reach * (42 + 20 * breath + 20 * beat + 8 * motionAccent)))}%`);
    Object.assign(phrase.gridBackground.style, { top: '0px', bottom: '0px', height: '100%', width: '100%',
      opacity: String(fill * fade), filter: `blur(${blur * scale * 100 / 72 * (.85 + .25 * breath + .3 * beat)}px)` });
    if (space) { phrase.element.setAttribute('aria-label', 'Space'); return; }
    const m = measure('H', 400);
    const baseline = (125 - m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 + m.fontBoundingBoxAscent;
    Object.assign(phrase.gridInk.style, { left: `${item.inset * scale}px`, fontSize: `${100 * scale}px`, letterSpacing: `${tracking * 100 * scale}px`,
      bottom: `${(baseline + (heldKeyword ? item.descent : from.descent) - 125) * scale}px` });
  });
}
