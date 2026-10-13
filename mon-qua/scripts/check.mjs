import { readFile, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { giftConfig } from '../dist/js/config.js';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(project, 'dist');
async function existsAsset(relative) { assert((await stat(path.join(dist, relative))).isFile(), `Missing ${relative}`); }
for (const name of await readdir(path.join(dist, 'js'))) {
  if (!name.endsWith('.js')) continue;
  const check = spawnSync(process.execPath, ['--check', path.join(dist, 'js', name)], { encoding:'utf8' });
  assert.equal(check.status, 0, check.stderr);
}
assert(giftConfig.sender && Array.isArray(giftConfig.letter.paragraphs));
for (const relative of [giftConfig.model.src,giftConfig.model.fallback,...giftConfig.photos.map(photo => photo.src),...(giftConfig.audio.src ? [giftConfig.audio.src] : [])]) await existsAsset(relative);
const html = await readFile(path.join(dist,'index.html'),'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (/^(?:https?:|data:|\.\/)/.test(match[1])) continue;
  await existsAsset(match[1]);
}
const model = await readFile(path.join(dist, giftConfig.model.src));
if (giftConfig.model.src.endsWith('.glb')) {
  assert.equal(model.readUInt32LE(0), 0x46546c67, 'Invalid GLB magic');
  assert.equal(model.readUInt32LE(4), 2, 'Expected glTF 2');
  assert.equal(model.readUInt32LE(8), model.length, 'Truncated GLB');
} else if (giftConfig.model.src.endsWith('.gltf')) {
  const gltf = JSON.parse(model.toString('utf8'));
  assert.equal(gltf.asset.version, '2.0');
  for (const asset of [...gltf.buffers,...gltf.images]) {
    if (asset.uri && !asset.uri.startsWith('data:')) await existsAsset(path.join(path.dirname(giftConfig.model.src),asset.uri));
  }
}
const hosting = JSON.parse(await readFile(path.join(project,'.openai/hosting.json'),'utf8'));
assert.equal(hosting.static.directory,'dist');
await existsAsset('vendor/three/build/three.module.js');
await existsAsset('vendor/three/build/three.core.js');
await existsAsset('vendor/three/examples/jsm/loaders/GLTFLoader.js');
await existsAsset('vendor/three/examples/jsm/controls/OrbitControls.js');
console.log('OK: JavaScript syntax, configuration, assets, model integrity and static hosting.');
