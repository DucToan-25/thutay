import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitModel } from './split-model.mjs';

const project = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const workspace = path.resolve(project, '..');
const dist = path.join(project, 'dist');
const cache = path.join(project, '.asset-cache');
const threeVersion = '0.180.0';

function within(base, target) {
  const resolved = path.resolve(target);
  const relative = path.relative(base, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Path outside allowed directory: ${target}`);
  return resolved;
}

async function copy(source, destination) {
  within(workspace, destination);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

async function download(url, destination) {
  within(workspace, destination);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
}

async function command(executable, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: project, stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${executable} exited ${code}`)));
  });
}

async function prepareThree() {
  const packageRoot = path.join(cache, `three-${threeVersion}`, 'package');
  if (!existsSync(path.join(packageRoot, 'package.json'))) {
    const archive = path.join(cache, `three-${threeVersion}.tgz`);
    await download(`https://registry.npmjs.org/three/-/three-${threeVersion}.tgz`, archive);
    const extractionRoot = within(workspace, path.dirname(packageRoot));
    await mkdir(extractionRoot, { recursive: true });
    await command('tar', ['-xzf', archive, '-C', extractionRoot]);
  }

  const version = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8')).version;
  if (version !== threeVersion) throw new Error(`Unexpected Three.js version: ${version}`);
  const destination = path.join(dist, 'vendor', 'three');
  const visited = new Set();
  async function copyModule(relative) {
    if (visited.has(relative)) return;
    visited.add(relative);
    const source = within(packageRoot, path.join(packageRoot, relative));
    const target = within(destination, path.join(destination, relative));
    await copy(source, target);
    const code = await readFile(source, 'utf8');
    for (const match of code.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      if (match[1].startsWith('.')) await copyModule(path.normalize(path.join(path.dirname(relative), match[1])));
    }
  }
  await copyModule('build/three.module.js');
  await copyModule('examples/jsm/loaders/GLTFLoader.js');
  await copyModule('examples/jsm/controls/OrbitControls.js');
  await copy(path.join(packageRoot, 'LICENSE'), path.join(destination, 'LICENSE'));
  console.log(`Prepared Three.js ${version}: ${visited.size} modules.`);
}

async function prepareFonts() {
  const destination = path.join(dist, 'assets', 'fonts');
  const cssCache = path.join(cache, 'google-fonts.css');
  if (!existsSync(cssCache) || !(await readFile(cssCache, 'utf8')).includes("format('woff2')")) {
    await download('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Lora:wght@400..700&display=swap', cssCache);
  }
  const css = await readFile(cssCache, 'utf8');
  let output = '/* Local Google Fonts: Lora and Be Vietnam Pro. Vietnamese + Latin subsets. */\n';
  const fetched = new Map();
  for (const match of css.matchAll(/\/\*\s*(vietnamese|latin)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g)) {
    let block = match[2];
    const url = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1];
    if (!url) throw new Error('Google Fonts response did not contain WOFF2 URLs.');
    let filename = fetched.get(url);
    if (!filename) {
      const family = block.match(/font-family:\s*'([^']+)'/)?.[1].toLowerCase().replaceAll(' ', '-');
      const weight = block.match(/font-weight:\s*([^;]+)/)?.[1].trim().replaceAll(' ', '-');
      filename = `${family}-${match[1]}-${weight}.woff2`;
      const sourceCache = path.join(cache, 'fonts', filename);
      if (!existsSync(sourceCache)) await download(url, sourceCache);
      await copy(sourceCache, path.join(destination, filename));
      fetched.set(url, filename);
    }
    block = block.replace(url, `./${filename}`);
    output += `\n/* ${match[1]} */\n${block}\n`;
  }
  if (fetched.size < 4) throw new Error('Missing Latin or Vietnamese font subsets.');
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, 'fonts.css'), output);
  for (const family of ['lora', 'bevietnampro']) {
    const licenseCache = path.join(cache, 'fonts', `${family}-OFL.txt`);
    if (!existsSync(licenseCache)) await download(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`, licenseCache);
    await copy(licenseCache, path.join(destination, `${family}-OFL.txt`));
  }
  console.log(`Prepared local fonts: ${fetched.size} WOFF2 files.`);
}

await access(path.join(workspace, 'flower_bouquet.glb'));
await splitModel(path.join(workspace, 'flower_bouquet.glb'), path.join(dist, 'assets', 'models'));
await prepareThree();
await prepareFonts();
console.log('Local model, vendor modules, and fonts are ready.');
