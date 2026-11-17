import { writeFile, readFile } from 'node:fs/promises';
import { createTrophyGeometry, trophyGLB, trophyPalette } from '../trophy-model.js';
const geometry = createTrophyGeometry();
const asset = path => new URL(`../assets/trophies/${path}`, import.meta.url);
const textures = {};
for (const item of trophyPalette) textures[item.slug] = {
  color: await readFile(asset(`${item.slug}-engraved-color.png`)),
  normal: await readFile(asset(`${item.slug}-engraved-normal.png`)),
};
for (const [name, indices] of [['collection', [0,1,2,3,4]], ...trophyPalette.map((p, i) => [p.slug, [i]])]) {
  const data = trophyGLB(geometry, indices, textures);
  const view = new DataView(data);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, view.getUint32(12, true))));
  if (view.getUint32(8, true) !== data.byteLength) throw new Error('Invalid GLB length');
  for (const [n, node] of json.nodes.entries()) {
    if (node.extras.awardText !== trophyPalette[indices[n]].award) throw new Error('Incorrect award');
  }
  if (json.images.length !== indices.length * 2) throw new Error('Missing engraving textures');
  for (const image of json.images) {
    const bufferView = json.bufferViews[image.bufferView];
    const binaryStart = 20 + view.getUint32(12, true) + 8;
    if (view.getUint32(binaryStart + bufferView.byteOffset, false) !== 0x89504e47) throw new Error('Invalid PNG image');
  }
  await writeFile(asset(`pass-the-code-${name}.glb`), new Uint8Array(data));
  console.log(`${name}: verified and exported (${indices.length} award${indices.length > 1 ? 's' : ''})`);
}
