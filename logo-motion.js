(() => {
  const lettering = document.querySelector('#lettering');
  lettering.replaceChildren();
  const text = document.createElement('span');
  const letters = [
    ['p', 900], ['a', 800], ['s', 700], ['s', 700], [' ', null],
    ['t', 600], ['h', 500], ['e', 400], [' ', null],
    ['c', 400], ['o', 300], ['d', 200], ['e', 100],
  ].map(([character, weight]) => {
    if (weight === null) { text.append(document.createTextNode(character)); return null; }
    const glyph = document.createElement('span');
    glyph.className = 'logo-letter';
    glyph.textContent = character;
    glyph.style.fontVariationSettings = `"wght" ${weight}, "opsz" 32`;
    text.append(glyph);
    return { glyph, weight };
  }).filter(Boolean);
  lettering.append(text);
  document.querySelector('#color-field')?.remove();
  let playing = true, elapsed = 0, previous, speed = 1;
  const cycleDuration = 5.6;
  document.querySelector('#play').onclick = event => {
    playing = !playing;
    event.currentTarget.textContent = playing ? 'Pause' : 'Play';
  };
  document.querySelector('#speed').oninput = event => { speed = Number(event.target.value) / 100; };
  document.querySelector('#restart').onclick = () => { elapsed = 0; };
  function frame(now) {
    const delta = previous === undefined ? 0 : Math.min((now - previous) / 1000, .08);
    previous = now;
    if (playing && !document.hidden) elapsed += delta * speed;
    // A one-way traveling wave: equal phase reaches left-hand letters first.
    // Spatial slope stays negative: 130 * 3.8 < 800, so the wave can never
    // reverse the logo's left-heavy / right-light weight hierarchy.
    const phase = elapsed / cycleDuration * Math.PI * 2;
    for (const { glyph, weight } of letters) {
      const position = (900 - weight) / 800;
      const wave = 130 * Math.sin(phase - position * 3.8);
      const animatedWeight = Math.max(100, Math.min(900, weight + wave));
      glyph.style.fontVariationSettings = `"wght" ${animatedWeight.toFixed(2)}, "opsz" 32`;
    }
    requestAnimationFrame(frame);
  }
  document.fonts.ready.then(() => requestAnimationFrame(frame));
})();
