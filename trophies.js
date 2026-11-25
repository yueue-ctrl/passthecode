import { createAwardsMotion } from './awards-motion.js?v=slightly-smaller-base-view';
import * as THREE from './assets/vendor/three.module.js';
import { trophyPalette, createTrophyGeometry, createTrophyMaterial, createColoredTrophyGeometry } from './trophy-model.js';

const host = document.querySelector('#trophy-view');
const error = document.querySelector('#error');
const storyMode = document.body.classList.contains('awards-story');
const story = storyMode ? createAwardsMotion() : null;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: storyMode, powerPreference: 'high-performance' });
} catch {
  error.hidden = false;
  error.textContent = 'This browser could not start 3D rendering. Open this page in a browser with WebGL enabled.';
  throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 2), 2.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = storyMode ? null : new THREE.Color('#f4f3f3');
if (storyMode) renderer.setClearColor(0x000000, 0);
const camera = new THREE.OrthographicCamera(-8, 8, 4, -4, .1, 100);
const aim = new THREE.Vector3(0, 2.65, 0);
let selected = -1, lightBackground = !storyMode;
let autoplay = true, cycleTime = 0;
const cycleDuration = 5.2;
const turn = Math.PI * 2;
const defaultElevation = storyMode ? -.22 : -.43;
let angle = 0, elevation = defaultElevation, zoom = 1;
let viewHeight = 8, targetHeight = 8;
const geometry = createTrophyGeometry();
const models = trophyPalette.map((item, i) => {
  const mesh = new THREE.Mesh(createColoredTrophyGeometry(geometry, item.color), createTrophyMaterial(item.color));
  if (storyMode) { mesh.geometry.translate(0, -2.8, 0); mesh.position.y = 2.8; }
  mesh.name = `${item.name} trophy`;
  mesh.position.x = (i - 2) * 2.12;
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.userData.index = i;
  scene.add(mesh);
  return mesh;
});
// Upload every award texture before its first handoff, avoiding a GPU upload in mid-turn.
THREE.DefaultLoadingManager.onLoad = () => {
  models.forEach(model => {
    for (const texture of [model.material.map, model.material.normalMap]) renderer.initTexture(texture);
  });
};
// Fine, mipmapped roughness gives the resin a tactile surface without noisy edges.
let resinRoughness;
if (storyMode) {
  const surface = document.createElement('canvas'); surface.width = surface.height = 512;
  const context = surface.getContext('2d');
  const pixels = context.createImageData(512, 512);
  let seed = 92831;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const grain = 175 + (seed >>> 26);
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = grain;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  resinRoughness = new THREE.CanvasTexture(surface);
  resinRoughness.wrapS = resinRoughness.wrapT = THREE.RepeatWrapping;
  resinRoughness.repeat.set(3, 10); resinRoughness.anisotropy = 8;
}
models.forEach(model => {
  model.material.roughness = storyMode ? .62 : .43;
  if (storyMode) {
    model.material.roughnessMap = resinRoughness;
    model.material.normalScale.set(1.45, 1.45);
    model.material.clearcoatNormalScale.set(.55, .55);
  }
  model.material.clearcoat = storyMode ? .7 : 1;
  model.material.clearcoatRoughness = storyMode ? .25 : .17;
  model.material.specularIntensity = storyMode ? .65 : 1;
  model.material.onBeforeCompile = shader => {
    // Keep the incised lettering on the face, but suppress noisy bump normals at the silhouette.
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      float edgeDetail = smoothstep(0.06, 0.32, abs(dot(normalize(vNormal), normalize(vViewPosition))));
      normal = normalize(mix(nonPerturbedNormal, normal, edgeDetail));
    `).replace('#include <clearcoat_normal_fragment_maps>', `
      #include <clearcoat_normal_fragment_maps>
      #ifdef USE_CLEARCOAT
        clearcoatNormal = normalize(mix(nonPerturbedNormal, clearcoatNormal, edgeDetail));
      #endif
    `);
    if (storyMode) {
      // The dark lettering is recessed matte material, not the glossy resin coating.
      // Detect its baked color so highlights cannot wash the award name into white.
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        float engravedInk = 1.0 - smoothstep(0.025, 0.82, max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.006), engravedInk);
      `).replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.9, engravedInk);
      `).replace('#include <lights_physical_fragment>', `
        #include <lights_physical_fragment>
        material.clearcoat *= 1.0 - engravedInk * 0.98;
        material.specularColor *= 1.0 - engravedInk * 0.94;
      `);
    }
  };
});
// Local, procedural studio environment: broad white softboxes instead of downloaded HDRs.
const studio = new THREE.Scene();
studio.background = new THREE.Color(.19, .19, .19);
function softbox(w, h, position, intensity) {
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide }));
  panel.position.set(...position); panel.lookAt(0, 2.5, 0); studio.add(panel);
}
softbox(10, 14, [-7, 6, 6], storyMode ? .65 : 1.2);
softbox(13, 16, [7, 6, 6], storyMode ? 3.8 : 6);
softbox(14, 4, [0, 10, -4], 3);
softbox(2, 8, [2, 3, -8], 1.5);
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(studio, .16);
scene.environment = environment.texture;
scene.environmentIntensity = storyMode ? .82 : 1.12;
pmrem.dispose();
studio.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
const ambient = new THREE.HemisphereLight('#ffffff', '#74777e', storyMode ? .32 : .45); scene.add(ambient);
const key = new THREE.DirectionalLight('#ffffff', storyMode ? 1.25 : 1.9);
key.position.set(-5, 9, 7); key.castShadow = false;
Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -5, near: .1, far: 40 });
key.shadow.mapSize.set(2048, 2048); key.shadow.normalBias = .025; key.shadow.bias = -.00015; key.shadow.radius = 4;
scene.add(key);
const fill = new THREE.DirectionalLight('#ffffff', .38); fill.position.set(6, 4, -4); scene.add(fill);
scene.add(key.target, fill.target);
const lightRight = new THREE.Vector3(), lightUp = new THREE.Vector3(), lightForward = new THREE.Vector3();
function followViewLighting() {
  camera.updateMatrixWorld();
  lightRight.setFromMatrixColumn(camera.matrixWorld, 0);
  lightUp.setFromMatrixColumn(camera.matrixWorld, 1);
  lightForward.setFromMatrixColumn(camera.matrixWorld, 2);
  key.target.position.copy(aim); fill.target.position.copy(aim);
  key.position.copy(aim).addScaledVector(lightRight, 28).addScaledVector(lightUp, 24).addScaledVector(lightForward, 20);
  fill.position.copy(aim).addScaledVector(lightRight, -24).addScaledVector(lightUp, 10).addScaledVector(lightForward, 12);
  // Rotate the reflection studio with the camera, so the same broad highlight stays on the right.
  scene.environmentRotation.copy(camera.rotation);
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: storyMode ? '#101010' : '#f4f3f3', toneMapped: false }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = false; floor.visible = !storyMode; scene.add(floor);
// Small, soft contact shadows keep each solid seated on the surface.
const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
const shadowContext = shadowCanvas.getContext('2d');
const gradient = shadowContext.createRadialGradient(64, 64, 12, 64, 64, 64);
gradient.addColorStop(0, '#00000088'); gradient.addColorStop(1, '#00000000');
shadowContext.fillStyle = gradient; shadowContext.fillRect(0, 0, 128, 128);
const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
const contacts = models.map(mesh => {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.3), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: .26 }));
  plane.rotation.x = -Math.PI / 2; plane.position.set(mesh.position.x, .006, 0); scene.add(plane); return plane;
});
const palette = document.querySelector('.palette');
trophyPalette.forEach((item, i) => {
  const button = document.createElement('button'); button.type = 'button'; button.dataset.index = i;
  button.setAttribute('aria-label', `View ${item.name} trophy`); button.setAttribute('aria-pressed', 'false');
  const dot = document.createElement('span'); dot.className = 'dot'; dot.style.setProperty('--color', item.color);
  const name = document.createElement('span'); name.className = 'color-name'; name.textContent = item.name;
  button.append(dot, name); button.addEventListener('click', () => select(i)); palette.append(button);
});
function select(index, automated = false) {
  if (!automated) { autoplay = false; document.querySelector('#tour').textContent = 'Play awards'; }
  selected = index;
  // Keep all five on their own fixed axes; rotation never changes the row layout.
  models.forEach((model, i) => {
    model.position.x = (i - 2) * 2.12;
    contacts[i].position.x = model.position.x;
  });
  if (automated) aim.x = 0;
  models.forEach((model, i) => { model.visible = index === -1 || index === i; contacts[i].visible = model.visible; });
  [...palette.children].forEach((button, i) => {
    const active = button.id === 'all' ? index === -1 : Number(button.dataset.index) === index;
    button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active));
  });
  document.querySelector('#selection').textContent = index === -1 ? 'THE COLLECTION' : `${String(index + 1).padStart(2, '0')} / ${trophyPalette[index].award.toUpperCase()}`;
  const download = document.querySelector('#download');
  download.href = `assets/trophies/pass-the-code-${index === -1 ? 'collection' : trophyPalette[index].slug}.glb`;
  download.textContent = index === -1 ? 'Download 5 models ↗' : 'Download model ↗';
  if (!automated) { angle = 0; elevation = defaultElevation; zoom = 1; }
  targetHeight = index === -1 ? Math.max(8.1, 11.8 / (innerWidth / innerHeight)) : 7.5;
}
document.querySelector('#tour').addEventListener('click', () => {
  autoplay = !autoplay;
  document.querySelector('#tour').textContent = autoplay ? 'Pause awards' : 'Play awards';
  if (autoplay) select(selected, true);
});
document.querySelector('#all').addEventListener('click', () => select(-1));
document.querySelector('#reset').addEventListener('click', () => { angle = 0; elevation = defaultElevation; zoom = 1; aim.y = 2.65; resize(); });
document.querySelector('#theme').addEventListener('click', event => {
  lightBackground = !lightBackground;
  document.body.classList.toggle('light', lightBackground);
  if (!storyMode) scene.background.set(lightBackground ? '#f4f3f3' : '#0c0d0f');
  floor.material.color.set(lightBackground ? '#f4f3f3' : '#101114');
  event.currentTarget.textContent = lightBackground ? 'Dark background' : 'Light background';
});
function resize() {
  const width = host.clientWidth, height = host.clientHeight;
  renderer.setSize(width, height);
  targetHeight = selected === -1 ? Math.max(8.1, 11.8 / (width / height)) : 7.5;
}
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(host);
resize();
let gesture;
host.addEventListener('pointerdown', event => {
  if (autoplay) { autoplay = false; document.querySelector('#tour').textContent = 'Play awards'; }
  gesture = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, panned: event.shiftKey };
  host.setPointerCapture(event.pointerId);
});
host.addEventListener('pointermove', event => {
  if (!gesture) return;
  if (event.shiftKey) {
    // Move the camera and its target together, preserving angle and perspective.
    aim.y = THREE.MathUtils.clamp(aim.y + (event.clientY - gesture.y) * viewHeight / innerHeight, -4, 9);
    gesture.panned = true;
  } else {
    angle -= (event.clientX - gesture.x) * .006;
    elevation = THREE.MathUtils.clamp(elevation + (event.clientY - gesture.y) * .004, -.7, .85);
  }
  gesture.moved ||= Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 5;
  gesture.x = event.clientX; gesture.y = event.clientY;
});
const raycaster = new THREE.Raycaster();
host.addEventListener('pointerup', event => {
  if (gesture && !gesture.moved && !gesture.panned) {
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - host.getBoundingClientRect().left) / host.clientWidth * 2 - 1, 1 - (event.clientY - host.getBoundingClientRect().top) / host.clientHeight * 2), camera);
    const hit = raycaster.intersectObjects(models.filter(mesh => mesh.visible))[0];
    if (hit) select(hit.object.userData.index);
  }
  gesture = undefined;
});
host.addEventListener('pointercancel', () => { gesture = undefined; });
host.addEventListener('wheel', event => {
  event.preventDefault(); zoom = THREE.MathUtils.clamp(zoom * Math.exp(-event.deltaY * .001), .65, 2.4);
}, { passive: false });
host.addEventListener('webglcontextlost', event => { event.preventDefault(); error.hidden = false; error.textContent = '3D rendering paused. Reload the page to continue.'; });
select(storyMode ? 0 : -1, true);
viewHeight = targetHeight;
aim.x = 0;
let previous;
function draw(time) {
  const delta = Math.min(.08, previous === undefined ? .016 : (time - previous) / 1000); previous = time;
  if (story) {
    const state = story.update(delta, autoplay && !document.hidden);
    if (selected !== state.index) select(state.index, true);
    const model = models[state.index], pose = state.pose;
    model.position.set(pose.x, 2.8 + pose.y, pose.z);
    model.rotation.set(pose.rx, pose.ry, pose.rz);
    model.scale.setScalar(pose.scale);
    contacts.forEach(contact => { contact.visible = false; });
    targetHeight = 6.45;
  } else if (autoplay && !document.hidden) {
    cycleTime += delta;
    const stagger = .65;
    const sequenceDuration = selected === -1 ? cycleDuration + stagger * (models.length - 1) : cycleDuration;
    cycleTime %= sequenceDuration;
    // Overlapping starts pass the motion along without waiting for a full turn.
    models.forEach((model, i) => {
      if (selected !== -1 && i !== selected) { model.rotation.y = 0; return; }
      const delay = selected === -1 ? i * stagger : 0;
      const phase = THREE.MathUtils.clamp((cycleTime - delay) / cycleDuration, 0, 1);
      model.rotation.y = -(turn * phase - .62 * Math.sin(turn * phase));
    });
  }
  const smooth = 1 - Math.exp(-delta * 9);
  const targetX = storyMode || selected === -1 ? 0 : models[selected].position.x;
  aim.x += (targetX - aim.x) * smooth;
  viewHeight += (targetHeight / zoom - viewHeight) * smooth;
  const aspect = host.clientWidth / host.clientHeight;
  camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2;
  camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
  const distance = 22;
  camera.position.set(aim.x + Math.sin(angle) * Math.cos(elevation) * distance, aim.y + Math.sin(elevation) * distance, Math.cos(angle) * Math.cos(elevation) * distance);
  camera.lookAt(aim);
  followViewLighting();
  renderer.setViewport(0, 0, host.clientWidth, host.clientHeight);
  renderer.render(scene, camera);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
