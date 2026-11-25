export function createAwardsMotion() {
  const awards = [
    { title: 'Best Transformation', description: 'For the project that changes the most in surprising and creative ways.', index: 4, color: '#ff00c8' },
    { title: 'Audience Choice', description: "The audience's favorite project, chosen by public vote.", index: 0, color: '#efff35' },
    { title: 'Innovation Award', description: 'For the most original and unexpected use of web technology.', index: 1, color: '#8dff00' },
    { title: 'Best Visual', description: 'For the most creative and impressive visual design.', index: 2, color: '#00e2fa' },
    { title: 'Best Collaboration', description: 'For the team that brings different ideas together in the most creative way.', index: 3, color: '#1299ff' },
  ];
  const rail = document.querySelector('#award-rail');
  const list = document.querySelector('#award-list');
  const duration = 6.8, transition = .9;
  let elapsed = duration, lastCycle = -1;
  const cards = Array.from({ length: 15 }, (_, n) => {
    const award = awards[n % 5];
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'award-card';
    card.style.setProperty('--award-color', award.color);
    const title = document.createElement('h2'); title.textContent = award.title;
    const description = document.createElement('p'); description.textContent = award.description;
    card.append(title, description); list.append(card);
    card.onclick = () => { elapsed = (n % 5) * duration; };
    return card;
  });
  function measureCards() {
    cards.forEach(card => { card.style.height = 'auto'; });
    const height = Math.max(...cards.map(card => card.offsetHeight));
    cards.forEach(card => { card.style.height = `${height}px`; });
  }
  new ResizeObserver(measureCards).observe(rail);
  document.fonts.ready.then(measureCards);
  const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
  return {
    update(delta, playing) {
      if (playing) elapsed += delta;
      const cycle = Math.floor(elapsed / duration), index = cycle % 5;
      const local = elapsed % duration;
      const entry = ease(Math.min(1, local / transition));
      if (cycle !== lastCycle) {
        cards.forEach((card, n) => {
          const active = n % 5 === index;
          card.classList.toggle('active', active);
          card.setAttribute('aria-current', active ? 'true' : 'false');
        });
        lastCycle = cycle;
      }
      const height = cards[0].offsetHeight;
      const gap = parseFloat(getComputedStyle(list).rowGap);
      const slot = index === 0 ? 10 : 5 + index;
      // Repeated identical lists make the last-to-first scroll seamless.
      const y = rail.clientHeight / 2 - height / 2 - (slot - 1 + entry) * (height + gap);
      list.style.transform = `translate3d(0,${y}px,0)`;
      const arrival = Math.min(1, local / 1.35);
      const remaining = Math.pow(1 - arrival, 4);
      const arc = Math.sin(arrival * Math.PI) * remaining;
      // Each award travels as a whole object, around its center rather than its base.
      const entries = [
        { x: -6, y: 2.5, z: -.5, rx: .8, ry: -Math.PI * 2, rz: -1.15, scale: .7 },
        { x: 6, y: -.8, z: 0, rx: -.35, ry: Math.PI * 2, rz: .8, scale: .95 },
        { x: -.8, y: -9, z: -1, rx: 1.2, ry: -Math.PI * 2, rz: -.35, scale: .8 },
        { x: 3, y: 9, z: .5, rx: -Math.PI * 2, ry: Math.PI, rz: .65, scale: .85 },
        { x: -6, y: -3, z: 0, rx: -.7, ry: Math.PI * 2, rz: 1.6, scale: .75 },
      ];
      const origin = entries[index];
      const exit = Math.pow(Math.max(0, (local - duration + .65) / .65), 3);
      const pose = {
        x: origin.x * remaining + arc * 1.2 + exit * 7,
        y: origin.y * remaining + arc * 1.7 + exit * 2 - .15 * (1 - remaining),
        z: origin.z * remaining,
        rx: origin.rx * remaining + exit * .45 + .035 * (1 - remaining),
        ry: origin.ry * remaining + exit * Math.PI - .18 * (1 - remaining),
        rz: origin.rz * remaining - exit * .8 - .075 * (1 - remaining),
        scale: 1.06 + (origin.scale - 1.06) * remaining,
      };
      return { index: awards[index].index, pose };
    }
  };
}
