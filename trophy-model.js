import * as THREE from './assets/vendor/three.module.js';

export const trophyPalette = [
  { name: 'Lemon', award: 'Audience Choice', color: '#efff35', slug: 'lemon' },
  { name: 'Lime', award: 'Innovation Award', color: '#8dff00', slug: 'lime' },
  { name: 'Cyan', award: 'Best Visual', color: '#00e2fa', slug: 'cyan' },
  { name: 'Blue', award: 'Best Collaboration', color: '#1299ff', slug: 'blue' },
  { name: 'Magenta', award: 'Best Transformation', color: '#ff00c8', slug: 'magenta' },
];
export const trophyHeight = 5.6;
export function createTrophyGeometry() {
  // A closed solid of revolution. Tiny radii soften the base and rounded point.
  const points = [new THREE.Vector2(0, .015), new THREE.Vector2(.555, .015)];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + i / 12 * Math.PI / 2;
    points.push(new THREE.Vector2(.555 + .035 * Math.cos(a), .05 + .035 * Math.sin(a)));
  }
  points.push(new THREE.Vector2(.59, .075));
  for (let i = 1; i <= 80; i++) {
    const t = i / 80;
    points.push(new THREE.Vector2(.59 + (.026 - .59) * t, .075 + (5.574 - .075) * t));
  }
  for (let i = 1; i <= 16; i++) {
    const a = i / 16 * Math.PI / 2;
    points.push(new THREE.Vector2(.026 * Math.cos(a), 5.574 + .026 * Math.sin(a)));
  }
  points.push(new THREE.Vector2(0, 5.6));
  const geometry = new THREE.LatheGeometry(points, 192);
  // Image-space V runs from the point at the top to the base at the bottom.
  for (let i = 0; i < geometry.attributes.position.count; i++) geometry.attributes.uv.setY(i, 1 - geometry.attributes.position.getY(i) / trophyHeight);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}
export function createTrophyColorArray(geometry, hex) {
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  const color = new THREE.Color(0xffffff);
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    colors.set([color.r, color.g, color.b], i * 3);
  }
  return colors;
}

export function createColoredTrophyGeometry(geometry, hex) {
  const colored = geometry.clone();
  colored.setAttribute('color', new THREE.BufferAttribute(createTrophyColorArray(geometry, hex), 3));
  return colored;
}
const trophyTextureCache = new Map();
function getEngravedTextures(hex) {
  if (typeof document === 'undefined') return {};
  const item = trophyPalette.find(item => item.color === hex) || trophyPalette[0];
  if (!trophyTextureCache.has(item.slug)) {
    const loader = new THREE.TextureLoader();
    const map = loader.load(new URL(`./assets/trophies/${item.slug}-engraved-color.png?v=award-visual-singular`, import.meta.url).href);
    const normalMap = loader.load(new URL(`./assets/trophies/${item.slug}-engraved-normal.png?v=award-visual-singular`, import.meta.url).href);
    map.colorSpace = THREE.SRGBColorSpace;
    for (const texture of [map, normalMap]) {
      texture.flipY = false;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 8;
    }
    trophyTextureCache.set(item.slug, { map, normalMap });
  }
  return trophyTextureCache.get(item.slug);
}
export function createTrophyMaterial(hex) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff, vertexColors: false, metalness: 0, roughness: .43,
    transmission: 0, ior: 1.46,
    clearcoat: 1, clearcoatRoughness: .17,
    specularIntensity: 1,
    ...getEngravedTextures(hex), normalScale: new THREE.Vector2(1.1, 1.1),
    clearcoatNormalMap: getEngravedTextures(hex).normalMap, clearcoatNormalScale: new THREE.Vector2(1.1, 1.1),
  });
}
// Self-contained binary glTF export: geometry and materials, with no external assets.
export function trophyGLB(geometry, indices = [0, 1, 2, 3, 4], textures = {}) {
  const positions = geometry.attributes.position.array;
  const normals = geometry.attributes.normal.array;
  const indexArray = geometry.index.array;
  const chunks = [positions, normals, indexArray, geometry.attributes.uv.array];
  for (const i of indices) {
    const item = textures[trophyPalette[i].slug];
    if (!item?.color || !item?.normal) throw new Error(`Missing engraving textures for ${trophyPalette[i].slug}`);
    chunks.push(item.color, item.normal);
  }
  let offset = 0;
  const views = chunks.map((array, i) => {
    const view = { buffer: 0, byteOffset: offset, byteLength: array.byteLength };
    if (i < 4) view.target = i === 2 ? 34963 : 34962;
    offset += Math.ceil(array.byteLength / 4) * 4;
    return view;
  });
  const binary = new Uint8Array(offset);
  chunks.forEach((array, i) => binary.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), views[i].byteOffset));
  const box = geometry.boundingBox;
  const json = {
    asset: { version: '2.0', generator: 'Pass the Code / engraved trophy studies', copyright: 'Pass the Code' },
    scene: 0, scenes: [{ name: 'Pass the Code awards', nodes: indices.map((_, i) => i) }],
    nodes: indices.map((i, n) => ({ name: `${trophyPalette[i].award} — ${trophyPalette[i].name}`, mesh: n,
      scale: [.06, .06, .06],
      translation: [indices.length === 1 ? 0 : (n - (indices.length - 1) / 2) * 2.15 * .06, 0, 0],
      extras: { heightMillimeters: 336, awardText: trophyPalette[i].award, brandText: 'pass the code 2027' } })),
    meshes: indices.map((i, n) => ({ name: trophyPalette[i].award, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 3 }, indices: 2, material: n }] })),
    materials: indices.map((i, n) => ({ name: `${trophyPalette[i].name} engraved resin`,
      normalTexture: { index: n * 2 + 1, scale: 1.1 },
      pbrMetallicRoughness: { baseColorFactor: [1,1,1,1], baseColorTexture: { index: n * 2 }, metallicFactor: 0, roughnessFactor: .43 },
      extensions: { KHR_materials_clearcoat: { clearcoatFactor: 1, clearcoatRoughnessFactor: .17, clearcoatNormalTexture: { index: n * 2 + 1, scale: 1.1 } } },
    })),
    extensionsUsed: ['KHR_materials_clearcoat'],
    images: indices.flatMap((i, n) => [
      { name: `${trophyPalette[i].slug} engraved color`, bufferView: 4 + n * 2, mimeType: 'image/png' },
      { name: `${trophyPalette[i].slug} engraved normal`, bufferView: 5 + n * 2, mimeType: 'image/png' },
    ]),
    samplers: [{ wrapS: 10497, wrapT: 10497, magFilter: 9729, minFilter: 9987 }],
    textures: indices.flatMap((_, n) => [{ sampler: 0, source: n * 2 }, { sampler: 0, source: n * 2 + 1 }]),
    buffers: [{ byteLength: binary.byteLength }], bufferViews: views,
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: box.min.toArray(), max: box.max.toArray() },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: indexArray instanceof Uint32Array ? 5125 : 5123, count: indexArray.length, type: 'SCALAR' },
      { bufferView: 3, componentType: 5126, count: positions.length / 3, type: 'VEC2' },
    ],
  };
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonSize = Math.ceil(bytes.length / 4) * 4;
  const result = new ArrayBuffer(12 + 8 + jsonSize + 8 + binary.byteLength);
  const out = new DataView(result), data = new Uint8Array(result);
  out.setUint32(0, 0x46546c67, true); out.setUint32(4, 2, true); out.setUint32(8, result.byteLength, true);
  out.setUint32(12, jsonSize, true); out.setUint32(16, 0x4e4f534a, true);
  data.fill(32, 20, 20 + jsonSize); data.set(bytes, 20);
  const binStart = 20 + jsonSize;
  out.setUint32(binStart, binary.byteLength, true); out.setUint32(binStart + 4, 0x004e4942, true); data.set(binary, binStart + 8);
  return result;
}
