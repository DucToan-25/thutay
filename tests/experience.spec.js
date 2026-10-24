import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { giftConfig } from '../dist/js/config.js';

const output = new URL('../qa/', import.meta.url);
const cards = '.memory-card';
const visibleCards = '.memory-card:not([hidden])';
const stage = '#flower-stage';
const field = '#memory-orbits';

async function screenshot(page, filename) {
  await mkdir(output, { recursive: true });
  await page.waitForTimeout(700);
  await page.screenshot({ path: fileURLToPath(new URL(filename, output)), fullPage: true });
}
async function state(page, next) {
  await expect(page.locator('body')).toHaveAttribute('data-state', next);
}
async function noOverflow(page) {
  const sizes = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(sizes.document, JSON.stringify(sizes)).toBeLessThanOrEqual(sizes.width + 1);
  expect(sizes.body, JSON.stringify(sizes)).toBeLessThanOrEqual(sizes.width + 1);
}
async function immersive(page) {
  await noOverflow(page);
  const viewport = page.viewportSize();
  await expect.poll(async () => {
    const current = await page.locator(stage).boundingBox();
    return Math.max(Math.abs(current.x), Math.abs(current.y));
  }).toBeLessThanOrEqual(1);
  const box = await page.locator(stage).boundingBox();
  expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y)).toBeLessThanOrEqual(1);
  expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
  expect(box.height).toBeGreaterThanOrEqual(viewport.height - 1);
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('#flower-heading')).toHaveClass(/sr-only/);
  await expect(page.locator('#open-memories,#review-letter,#restart-gift,.orbit-group-navigation,.orbit-group-nav')).toHaveCount(0);
  await expect(page.locator('#flower-scene .scene-description,#flower-scene .sample-note,#flower-scene .flower-actions,#flower-scene .scene-utilities')).toHaveCount(0);
}
async function clickEnvelope(page) {
  await expect(page.locator('#open-envelope')).toBeEnabled();
  await page.locator('#open-envelope').evaluate(button => button.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const box = await page.locator('#open-envelope').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await state(page, 'letter');
}
async function letter(page) {
  await page.goto('/');
  await clickEnvelope(page);
}
async function modelFailure(page) {
  await page.route('**/assets/models/flower_bouquet.*', route => route.abort('failed'));
}
async function bouquet(page) {
  await letter(page);
  await page.locator('#continue-bouquet').click();
  await state(page, 'bouquet');
  await expect(page.locator('#bouquet-view')).toHaveAttribute('data-model-state', /ready|error/, { timeout: 30000 });
}
async function activateBouquet(page) {
  const canvas = page.locator('#bouquet-view canvas');
  const target = await canvas.count() ? canvas : page.locator('.bouquet-fallback');
  await target.focus();
  await page.keyboard.press('Enter');
  await state(page, 'memories');
  await expect(page.locator(cards).first()).toBeVisible();
}
async function memories(page, { fallback = true } = {}) {
  if (fallback) await modelFailure(page);
  await bouquet(page);
  await activateBouquet(page);
}
async function selectCard(page, index) {
  if (index === undefined) {
    const visible = page.locator(`${cards}.is-visible:not([hidden])`).first();
    await expect(visible).toBeVisible();
    index = Number(await visible.getAttribute('data-photo-index'));
  }
  const card = page.locator(cards).nth(index);
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(card).toHaveClass(/is-selected/);
  await expect(page.locator('.orbit-photo-caption')).toBeVisible();
  await expect(card.locator('.memory-photo-clip')).toHaveCSS('clip-path', 'none');
  await expect(card.locator('.memory-image')).toHaveCSS('object-fit', 'contain');
  await expect(card).not.toHaveClass(/is-changing/);
  return card;
}
async function boundedField(page, total) {
  await expect(page.locator(cards)).toHaveCount(total);
  await expect.poll(() => page.locator(visibleCards).count()).toBeGreaterThanOrEqual(1);
  const limit = page.viewportSize().width < 600 ? 8 : 10;
  expect(await page.locator(visibleCards).count()).toBeLessThanOrEqual(limit);
  if (total <= limit) await expect(page.locator(visibleCards)).toHaveCount(total);
  if (total > limit) expect(await page.locator(visibleCards).count()).toBeLessThan(total);
}
async function scatteredHearts(page) {
  await expect(page.locator(field)).toHaveAttribute('data-layout', 'scattered');
  const layout = await page.locator(visibleCards).evaluateAll(elements => elements.map(element => ({
    x: Number(element.dataset.worldX), y: Number(element.dataset.worldY), z: Number(element.dataset.worldZ),
    scale: Number(element.dataset.fieldScale), depth: Number(element.dataset.depth),
  })));
  expect(layout.every(heart => Object.values(heart).every(Number.isFinite))).toBe(true);
  expect(layout.some(heart => heart.x < 0)).toBe(true);
  expect(layout.some(heart => heart.x > 0)).toBe(true);
  expect(layout.some(heart => heart.y < 0)).toBe(true);
  expect(layout.some(heart => heart.y > 0)).toBe(true);
  expect(new Set(layout.map(heart => heart.x.toFixed(1))).size).toBeGreaterThan(3);
  expect(new Set(layout.map(heart => heart.y.toFixed(1))).size).toBeGreaterThan(3);
  expect(new Set(layout.map(heart => Math.hypot(heart.x, heart.y).toFixed(1))).size).toBeGreaterThan(2);
  expect(new Set(layout.map(heart => heart.scale.toFixed(2))).size).toBeGreaterThan(1);
  expect(new Set(layout.map(heart => heart.depth.toFixed(1))).size).toBeGreaterThan(1);
  await expect(page.locator(`${visibleCards}.memory-heart`)).toHaveCount(layout.length);
  await expect(page.locator(`${visibleCards} svg.crystal-shell`)).toHaveCount(layout.length);
  const glassShells = await page.locator(`${visibleCards} svg.crystal-shell`).evaluateAll(elements => elements.every(element =>
    element.querySelector('linearGradient, radialGradient') && element.querySelector('path[d]')));
  expect(glassShells).toBe(true);
  const clipped = await page.locator(`${visibleCards} .memory-photo-clip`).evaluateAll(elements => elements.every(element => getComputedStyle(element).clipPath !== 'none'));
  expect(clipped).toBe(true);
}
async function selectedFits(page) {
  const viewport = page.viewportSize();
  for (const selector of ['.memory-card.is-selected', '.orbit-photo-inspector']) {
    await expect.poll(async () => {
      const current = await page.locator(selector).boundingBox();
      return Boolean(current && current.x >= -1 && current.y >= -1
        && current.x + current.width <= viewport.width + 1 && current.y + current.height <= viewport.height + 1);
    }, { message: `${selector} must finish inside the viewport` }).toBe(true);
    const box = await page.locator(selector).boundingBox();
    expect(box, selector).not.toBeNull();
    expect(box.x, selector).toBeGreaterThanOrEqual(-1);
    expect(box.y, selector).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, selector).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height, selector).toBeLessThanOrEqual(viewport.height + 1);
  }
}
async function closeSelection(page) {
  await page.locator('.orbit-selection-close').click();
  await expect(page.locator('.memory-card.is-selected')).toHaveCount(0);
  await expect(page.locator('.orbit-photo-caption')).toBeHidden();
}
function wave(seconds) {
  const sampleRate = 16000;
  const samples = Math.floor(sampleRate * seconds);
  const data = Buffer.alloc(44 + samples * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + samples * 2, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(sampleRate, 24);
  data.writeUInt32LE(sampleRate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(Math.sin(i / sampleRate * Math.PI * 440) * 1000), 44 + i * 2);
  return data;
}
async function configure(page, { audioSeconds, failedAudio = false, photos, paragraphs } = {}) {
  await page.route('**/js/config.js', async route => {
    const response = await route.fetch();
    let body = await response.text();
    if (audioSeconds !== undefined) body += "\ngiftConfig.audio.tracks = ['assets/audio/test.wav'];";
    if (photos) body += `\ngiftConfig.photos = ${JSON.stringify(photos)};`;
    if (paragraphs) body += `\ngiftConfig.letter.paragraphs = ${JSON.stringify(paragraphs)};`;
    await route.fulfill({ response, body });
  });
  if (audioSeconds !== undefined) await page.route('**/assets/audio/test.wav', route => failedAudio ? route.abort('failed') : route.fulfill({ contentType: 'audio/wav', body: wave(audioSeconds) }));
}
async function transforms(page) {
  return page.locator(cards).evaluateAll(elements => elements.map(element => element.style.transform));
}
async function heartCenters(page) {
  return page.locator(visibleCards).evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    return { index: Number(element.dataset.photoIndex), x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }));
}
async function advanceGroup(page) {
  const group = await page.locator(field).getAttribute('data-group');
  await page.locator('#bouquet-view canvas').focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.locator(field).getAttribute('data-group')).not.toBe(group);
  await state(page, 'memories');
}
async function revealPhoto(page, index) {
  const card = page.locator(cards).nth(index);
  const groups = Number(await page.locator(field).getAttribute('data-group-count'));
  for (let step = 0; step < groups && await card.getAttribute('hidden') !== null; step++) await advanceGroup(page);
  await expect(card).toBeVisible();
  await expect(card).toBeEnabled();
}
async function mouseRotate(page, locator = page.locator(stage)) {
  const box = await locator.boundingBox();
  const before = Number(await page.locator(stage).getAttribute('data-orbit-azimuth'));
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.65);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => Number(await page.locator(stage).getAttribute('data-orbit-azimuth'))).not.toBeCloseTo(before, 2);
}
async function clickActualBouquet(page) {
  const box = await page.locator('#bouquet-view canvas').boundingBox();
  for (const [x, y] of [[0.5, 0.45], [0.5, 0.55], [0.47, 0.5], [0.53, 0.4]]) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
    if (await page.locator('body').getAttribute('data-state') === 'memories') break;
  }
  await state(page, 'memories');
}

test('model and first photos preload behind the envelope and load once through the gift', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [], modelRequests = [], photoRequests = new Set(), textureRequests = new Map();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/flower_bouquet\.(gltf|bin)$/.test(request.url())) modelRequests.push(request.url());
    if (request.url().includes('/assets/photos/')) photoRequests.add(request.url());
    if (request.url().includes('/assets/models/textures/')) textureRequests.set(request.url(), (textureRequests.get(request.url()) || 0) + 1);
  });
  await page.goto('/');
  await expect(page.locator('#bouquet-view')).toHaveAttribute('data-model-state', 'ready', { timeout: 30000 });
  await state(page, 'envelope');
  await expect(page.locator(stage)).toHaveAttribute('data-background-motion', 'hidden');
  expect(modelRequests.filter(url => url.endsWith('.gltf'))).toHaveLength(1);
  expect(modelRequests.filter(url => url.endsWith('.bin'))).toHaveLength(1);
  expect(photoRequests.size).toBe(6);
  expect((await page.locator('#open-envelope').boundingBox()).width).toBeGreaterThan(330);
  await noOverflow(page);
  await screenshot(page, 'crystal-desktop-envelope.png');
  await page.locator('#open-envelope').evaluate(button => { for (let i = 0; i < 6; i++) button.click(); });
  await state(page, 'letter');
  await expect(page.locator('#letter-content p')).toHaveCount(giftConfig.letter.paragraphs.length + 1);
  await expect(page.locator('#audio-play')).toBeEnabled();
  await expect(page.locator('#letter-audio')).toHaveJSProperty('paused', false);
  await screenshot(page, 'crystal-desktop-letter.png');
  await page.locator('#continue-bouquet').click();
  await state(page, 'bouquet');
  await immersive(page);
  const canvas = page.locator('#bouquet-view canvas');
  const originalCanvas = await canvas.elementHandle();
  await expect(canvas).toHaveAttribute('aria-disabled', 'false');
  await expect(page.locator('.bouquet-fallback')).toHaveCount(0);
  await expect(page.locator('#memory-orbits')).toBeHidden();
  await expect(page.locator(cards).first()).toBeDisabled();
  await screenshot(page, 'crystal-desktop-bouquet.png');
  await canvas.click({ position: { x: 5, y: 5 } });
  await state(page, 'bouquet');
  await activateBouquet(page);
  await immersive(page);
  await expect(page.locator(stage)).toHaveAttribute('data-bouquet-presentation', 'center');
  await expect(page.locator(stage)).toHaveAttribute('data-bouquet-progress', '1.000');
  expect(Number(await page.locator(stage).getAttribute('data-bouquet-scale'))).toBeGreaterThan(0.6);
  expect(await canvas.evaluate((element, before) => element === before, originalCanvas)).toBe(true);
  await expect(page.locator('#bouquet-view')).toHaveAttribute('data-memory-renderer', 'webgl');
  await boundedField(page, 6);
  await scatteredHearts(page);
  await expect(page.locator('.orbit-photo-caption')).toBeHidden();
  await screenshot(page, 'crystal-desktop-memories.png');
  await selectCard(page);
  await selectedFits(page);
  await expect(page.locator('dialog')).toHaveCount(0);
  await screenshot(page, 'crystal-desktop-selected.png');
  await closeSelection(page);
  expect(modelRequests.filter(url => url.endsWith('.gltf'))).toHaveLength(1);
  expect(modelRequests.filter(url => url.endsWith('.bin'))).toHaveLength(1);
  expect(textureRequests.size).toBe(20);
  expect([...textureRequests.values()]).toEqual(Array(textureRequests.size).fill(1));
  expect(errors).toEqual([]);
});

test('crystal hearts surround the central bouquet and selecting any photo pauses and resumes the field', async ({ page }) => {
  await memories(page);
  await boundedField(page, 6);
  await scatteredHearts(page);
  await expect(page.locator(stage)).toHaveAttribute('data-bouquet-presentation', 'center');
  await expect(page.locator('.orbit-photo-caption')).toBeHidden();
  await page.mouse.move(1, 1);
  await page.locator(stage).focus();
  await expect(page.locator(field)).toHaveAttribute('data-field-motion', 'running');
  const card = await selectCard(page, 2);
  await state(page, 'memories');
  await expect(page.locator('.orbit-photo-caption')).not.toHaveText('');
  await expect(page.locator(field)).toHaveAttribute('data-field-motion', 'paused');
  const progress = await page.locator(field).getAttribute('data-field-progress');
  await page.waitForTimeout(450);
  expect(await page.locator(field).getAttribute('data-field-progress')).toBe(progress);
  await selectedFits(page);
  await expect(page.locator('dialog')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.memory-card.is-selected')).toHaveCount(0);
  await expect(card.locator('.memory-card-surface')).toBeVisible();
  await page.locator(stage).focus();
  await page.mouse.move(1, 1);
  await expect(page.locator(field)).toHaveAttribute('data-field-motion', 'running');
  await expect.poll(() => page.locator(field).getAttribute('data-field-progress')).not.toBe(progress);
  for (let index = 0; index < 6; index++) {
    await selectCard(page, index);
    await expect(page.locator(cards).nth(index)).toHaveAttribute('aria-pressed', 'true');
    await closeSelection(page);
  }
});

test('actual bouquet raycast opens photographs and dragging rotates the unified scene', async ({ page }) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await bouquet(page);
  await expect(page.locator('#bouquet-view canvas')).toHaveAttribute('aria-disabled', 'false');
  await immersive(page);
  await clickActualBouquet(page);
  await expect(page.locator(cards)).toHaveCount(6);
  const before = await transforms(page);
  await mouseRotate(page);
  await state(page, 'memories');
  await expect(page.locator('.memory-card.is-selected')).toHaveCount(0);
  await expect.poll(() => transforms(page)).not.toEqual(before);
  const selected = await selectCard(page);
  await mouseRotate(page, selected);
  await expect(selected).toHaveClass(/is-selected/);
  await expect(page.locator('.orbit-photo-caption')).toBeVisible();
  await selectedFits(page);
  await closeSelection(page);
});

test('native touch rotates the scene and 320px and 390px phones retain usable photos and captions', async ({ browser }) => {
  test.setTimeout(90000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:4173/');
    await expect(page.locator('#bouquet-view')).toHaveAttribute('data-model-state', 'ready', { timeout: 30000 });
    await clickEnvelope(page);
    for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await noOverflow(page);
      await screenshot(page, `crystal-mobile-${viewport.width}-letter.png`);
    }
    await page.locator('#continue-bouquet').click();
    await state(page, 'bouquet');
    await immersive(page);
    await screenshot(page, 'crystal-mobile-390-bouquet.png');
    await activateBouquet(page);
    const box = await page.locator(stage).boundingBox();
    const before = Number(await page.locator(stage).getAttribute('data-orbit-azimuth'));
    const session = await context.newCDPSession(page);
    const start = { x: box.x + box.width * 0.25, y: box.y + box.height * 0.68 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
    for (let i = 1; i <= 8; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + i * 12, y: start.y - i * 2, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => Number(await page.locator(stage).getAttribute('data-orbit-azimuth'))).not.toBeCloseTo(before, 2);
    await state(page, 'memories');
    await expect(page.locator('.memory-card.is-selected')).toHaveCount(0);
    for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await immersive(page);
      await boundedField(page, 6);
      await screenshot(page, `crystal-mobile-${viewport.width}-memories.png`);
      await selectCard(page);
      await selectedFits(page);
      await screenshot(page, `crystal-mobile-${viewport.width}-selected.png`);
      await page.locator('.orbit-selection-close').tap();
      await expect(page.locator('.memory-card.is-selected')).toHaveCount(0);
    }
  } finally { await context.close(); }
});

test('thirty and sixty photos use bounded scattered heart groups and every photo remains reachable', async ({ page }) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const count of [30, 60]) {
    const photos = Array.from({ length: count }, (_, index) => ({ src: `assets/photos/sample-${index % 6 + 1}.svg`, alt: `Kỷ niệm ${index + 1}`, caption: `Kỷ niệm ${String(index + 1).padStart(2, '0')}` }));
    await configure(page, { photos });
    await memories(page, { fallback: false });
    await immersive(page);
    await boundedField(page, count);
    await expect(page.locator(field)).toHaveAttribute('data-group-count', String(Math.ceil(count / 10)));
    expect(await page.locator(cards).evaluateAll(elements => elements.map(element => Number(element.dataset.photoIndex)))).toEqual(Array.from({ length: count }, (_, index) => index));
    const canvas = page.locator('#bouquet-view canvas');
    await expect(canvas).toHaveAttribute('tabindex', '0');
    const reached = new Set();
    const groups = Math.ceil(count / 10);
    for (let group = 0; group < groups; group++) {
      await scatteredHearts(page);
      const indices = await page.locator(visibleCards).evaluateAll(elements => elements.map(element => Number(element.dataset.photoIndex)));
      for (const index of indices) {
        await selectCard(page, index);
        await expect(page.locator('.orbit-photo-caption')).toHaveText(photos[index].caption);
        await selectedFits(page);
        reached.add(index);
        await page.keyboard.press('Escape');
      }
      await boundedField(page, count);
      if (group < groups - 1) await advanceGroup(page);
    }
    expect([...reached].sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, index) => index));
    await revealPhoto(page, count - 1);
    await selectCard(page, count - 1);
    await selectedFits(page);
    await closeSelection(page);
    if (count === 30) {
      await screenshot(page, 'crystal-thirty-photos-desktop.png');
      await page.setViewportSize({ width: 390, height: 844 });
      await immersive(page);
      await boundedField(page, count);
      await expect(page.locator(field)).toHaveAttribute('data-group-count', String(Math.ceil(count / 8)));
      await screenshot(page, 'crystal-thirty-photos-mobile.png');
      await revealPhoto(page, 29);
      await selectCard(page, 29);
      await selectedFits(page);
      await screenshot(page, 'crystal-thirty-photos-mobile-selected.png');
      await closeSelection(page);
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    await expect(page.locator('dialog')).toHaveCount(0);
  }
});

test('the gift fits phones, tablet, desktop, short laptop and landscape while flowers fill the viewport', async ({ page }) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await modelFailure(page);
  const viewports = [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }, { width: 1366, height: 700 }, { width: 844, height: 390 }];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await noOverflow(page);
    await clickEnvelope(page);
    await noOverflow(page);
    expect(await page.locator('#letter-content').evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(14);
    await expect(page.locator('#continue-bouquet')).toBeVisible();
    await page.locator('#continue-bouquet').click();
    await state(page, 'bouquet');
    await immersive(page);
    await activateBouquet(page);
    await immersive(page);
    await expect(page.locator(cards)).toHaveCount(6);
    await selectCard(page);
    await selectedFits(page);
    await closeSelection(page);
  }
});

test('a long letter starts below the header on phones and desktop and can continue', async ({ page }) => {
  const paragraphs = Array.from({ length: 12 }, (_, index) => `Đoạn thư ${index + 1}. Mình mong những điều dịu dàng và bình yên sẽ luôn ở bên bạn. Một lời hỏi thăm, một bó hoa và những kỷ niệm đáng giữ.`);
  await configure(page, { paragraphs });
  await modelFailure(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await letter(page);
  await expect(page.locator('#letter-content p')).toHaveCount(13);
  for (const viewport of [{ width: 320, height: 640 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => scrollTo(0, 0));
    const heading = await page.locator('#letter-heading').boundingBox();
    const header = await page.locator('.site-header').boundingBox();
    expect(heading.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    expect(await page.locator('#letter-content').evaluate(element => getComputedStyle(element).overflowY)).toBe('visible');
    await page.locator('#letter-content p').last().scrollIntoViewIfNeeded();
    await expect(page.locator('#letter-content p').last()).toBeVisible();
    await noOverflow(page);
  }
  await page.locator('#continue-bouquet').click();
  await state(page, 'bouquet');
});

test('valid audio advances once to the bouquet and resets playback', async ({ page }) => {
  await configure(page, { audioSeconds: 2 });
  await modelFailure(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await letter(page);
  await expect(page.locator('#letter-audio')).toHaveJSProperty('paused', false);
  await expect(page.locator('#audio-progress')).toBeEnabled();
  await state(page, 'bouquet');
  await expect(page.locator('#letter-audio')).toHaveJSProperty('paused', true);
  await expect(page.locator('#letter-audio')).toHaveJSProperty('currentTime', 0);
});

test('short audio waits for the opening animation before playing and then advances', async ({ page }) => {
  await modelFailure(page);
  for (const audioSeconds of [0.2, 1.25]) {
    await configure(page, { audioSeconds });
    await page.goto('/');
    const box = await page.locator('#open-envelope').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('body')).toHaveAttribute('data-state', 'bouquet', { timeout: 15000 });
    await expect(page.locator('#letter-scene')).toBeHidden();
  }
});

test('autoplay rejection leaves manual playback available and allows continuing', async ({ page }) => {
  await configure(page, { audioSeconds: 5 });
  await modelFailure(page);
  await page.addInitScript(() => { HTMLMediaElement.prototype.play = function () { return Promise.reject(new DOMException('Gesture required', 'NotAllowedError')); }; });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await letter(page);
  await expect(page.locator('#audio-status')).toContainText(/phát|nghe/i);
  await expect(page.locator('#audio-play')).toBeEnabled();
  await page.locator('#continue-bouquet').click();
  await state(page, 'bouquet');
});

test('failed audio remains retryable and never blocks the letter', async ({ page }) => {
  await configure(page, { audioSeconds: 2, failedAudio: true });
  await modelFailure(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await letter(page);
  await expect(page.locator('#audio-status')).toContainText(/chưa|không/i);
  await page.locator('#audio-play').click();
  await expect(page.locator('#audio-status')).toContainText(/chưa|không/i);
  await expect(page.locator('#letter-content')).toBeVisible();
  await page.locator('#continue-bouquet').click();
  await state(page, 'bouquet');
});

test('failed model loading supplies a keyboard accessible fallback before opening the gift', async ({ page }) => {
  await modelFailure(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#bouquet-view')).toHaveAttribute('data-model-state', 'error');
  await state(page, 'envelope');
  await clickEnvelope(page);
  await page.locator('#continue-bouquet').click();
  await state(page, 'bouquet');
  await expect(page.locator('.bouquet-fallback')).toBeVisible();
  await expect(page.locator('#bouquet-view canvas')).toHaveCount(0);
  await expect(page.locator('.bouquet-fallback img')).toHaveJSProperty('complete', true);
  await page.locator('.bouquet-fallback').focus();
  await page.keyboard.press('Space');
  await state(page, 'memories');
  await expect(page.locator(cards)).toHaveCount(6);
});

test('failed photo loading preserves a selectable card and readable caption', async ({ page }) => {
  await page.route('**/assets/photos/sample-1.svg', route => route.abort('failed'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await memories(page);
  const first = page.locator(cards).first();
  await expect(first.locator('.memory-card-surface')).toBeVisible();
  await expect(first.locator('.memory-image-unavailable')).toBeVisible();
  await selectCard(page);
  await expect(first.locator('.memory-image-unavailable')).toBeVisible();
  await expect(page.locator('.orbit-photo-caption')).toBeVisible();
  await state(page, 'memories');
});

test('envelope address and progress footer are absent and the heading fades before the letter rises', async ({ page }) => {
  await modelFailure(page);
  await page.goto('/');
  await expect(page.locator('#envelope-address,.envelope-address')).toHaveCount(0);
  await expect(page.locator('.site-footer,.journey,[data-step]')).toHaveCount(0);
  const intro = page.locator('#envelope-scene .scene-intro');
  await expect(intro).toHaveCSS('opacity', '1');
  await page.locator('#open-envelope').evaluate(button => button.click());
  await state(page, 'opening');
  await expect(intro).toHaveCSS('opacity', '0');
  await state(page, 'opening');
  await state(page, 'letter');
});

test('hearts move independently and the flower scene pauses for selection, reduced motion and hidden pages', async ({ page }) => {
  test.setTimeout(60000);
  await memories(page, { fallback: false });
  // A preference change immediately after activation must complete a pending reveal.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator(stage)).toHaveAttribute('data-bouquet-presentation', 'center');
  await expect(page.locator(stage)).toHaveAttribute('data-bouquet-progress', '1.000');
  await expect(page.locator(field)).toHaveAttribute('data-field-motion', 'reduced');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.mouse.move(1, 1);
  await page.locator(stage).focus();
  await expect(page.locator(stage)).toHaveAttribute('data-background-motion', 'running');
  await expect(page.locator(field)).toHaveAttribute('data-field-motion', 'running');
  await expect(page.locator(stage)).toHaveAttribute('data-bouquet-presentation', 'center');
  await expect(page.locator(stage)).toHaveAttribute('data-bouquet-progress', '1.000');
  const moving = await transforms(page);
  const centers = await heartCenters(page);
  const phase = Number(await page.locator(stage).getAttribute('data-background-phase'));
  await expect.poll(() => transforms(page)).not.toEqual(moving);
  await expect.poll(async () => Number(await page.locator(stage).getAttribute('data-background-phase'))).toBeGreaterThan(phase);
  await page.waitForTimeout(700);
  const nextCenters = await heartCenters(page);
  const displacements = nextCenters.map(heart => {
    const before = centers.find(sample => sample.index === heart.index);
    return { dx: heart.x - before.x, dy: heart.y - before.y };
  });
  expect(displacements.filter(delta => Math.hypot(delta.dx, delta.dy) > 2).length).toBeGreaterThanOrEqual(3);
  expect(new Set(displacements.map(delta => `${delta.dx.toFixed(1)},${delta.dy.toFixed(1)}`)).size).toBeGreaterThanOrEqual(4);
  expect(displacements.every(delta => Math.hypot(delta.dx, delta.dy) < 140)).toBe(true);
  await selectCard(page);
  await expect(page.locator(stage)).toHaveAttribute('data-background-motion', 'paused');
  await expect(page.locator(field)).toHaveAttribute('data-field-motion', 'paused');
  await page.waitForTimeout(400);
  const selected = await transforms(page);
  await page.waitForTimeout(400);
  expect(await transforms(page)).toEqual(selected);
  await closeSelection(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator(stage).focus();
  await page.mouse.move(1, 1);
  await expect(page.locator(stage)).toHaveAttribute('data-background-motion', 'reduced');
  await expect(page.locator(field)).toHaveAttribute('data-field-motion', 'reduced');
  await page.waitForTimeout(200);
  const reduced = await transforms(page);
  const reducedPhase = await page.locator(stage).getAttribute('data-background-phase');
  await page.waitForTimeout(400);
  expect(await transforms(page)).toEqual(reduced);
  expect(await page.locator(stage).getAttribute('data-background-phase')).toBe(reducedPhase);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator(stage)).toHaveAttribute('data-background-motion', 'hidden');
  await expect(page.locator(field)).toHaveAttribute('data-field-motion', 'hidden');
  await page.waitForTimeout(200);
  const hidden = await transforms(page);
  const hiddenPhase = await page.locator(stage).getAttribute('data-background-phase');
  await page.waitForTimeout(400);
  expect(await transforms(page)).toEqual(hidden);
  expect(await page.locator(stage).getAttribute('data-background-phase')).toBe(hiddenPhase);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator(stage)).toHaveAttribute('data-background-motion', 'running');
  await expect(page.locator(field)).toHaveAttribute('data-field-motion', 'running');
  await expect.poll(() => transforms(page)).not.toEqual(hidden);
});
