import { test, expect } from '@playwright/test';
import { giftConfig } from '../dist/js/config.js';

async function openLetter(page, reducedMotion = 'reduce', gapMs) {
  if (gapMs !== undefined) await page.route('**/js/config.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()) + `\ngiftConfig.audio.gapMs = ${gapMs};` });
  });
  await page.emulateMedia({ reducedMotion });
  await page.route('**/assets/models/flower_bouquet.*', route => route.abort('failed'));
  await page.addInitScript(() => {
    window.audioEvents = [];
    addEventListener('DOMContentLoaded', () => {
      const audio = document.getElementById('letter-audio');
      document.getElementById('letter-scene').addEventListener('animationend', event => {
        if (event.target.id === 'letter-scene' && event.animationName === 'scene-in') {
          window.audioEvents.push({ type: 'opening-finished', at: performance.now() });
        }
      });
      let lastTrack;
      audio.addEventListener('playing', () => {
        if (lastTrack === audio.currentSrc.split('/').pop()) return;
        lastTrack = audio.currentSrc.split('/').pop();
        window.audioEvents.push({ type: 'playing', track: lastTrack, at: performance.now(), state: document.body.dataset.state,
          animating: document.getElementById('letter-scene').getAnimations().some(animation => animation.playState === 'running') });
      });
      audio.addEventListener('ended', () => window.audioEvents.push({ type: 'ended', track: lastTrack, at: performance.now() }));
      new MutationObserver(() => {
        if (document.body.dataset.state === 'transition') window.audioEvents.push({ type: 'transition', at: performance.now() });
      }).observe(document.body, { attributes: true, attributeFilter: ['data-state'] });
    });
  });
  await page.goto('/');
  await expect(page.locator('#letter-audio')).toHaveJSProperty('paused', true);
  const envelope = await page.locator('#open-envelope').boundingBox();
  await page.mouse.click(envelope.x + envelope.width / 2, envelope.y + envelope.height / 2);
  await expect.poll(() => page.evaluate(() => window.audioEvents.filter(event => event.type === 'playing').length)).toBe(1);
}

async function endTrack(page) {
  await expect.poll(() => page.locator('#letter-audio').evaluate(audio => Number.isFinite(audio.duration) && audio.duration > 0)).toBe(true);
  await page.locator('#letter-audio').evaluate(audio => { audio.currentTime = audio.duration - 0.05; });
}

test('all real M4A files start 3s after opening, follow their cues and finish with a 3s delay', async ({ page }) => {
  test.setTimeout(60000);
  await openLetter(page, 'no-preference');
  const tracks = giftConfig.audio.tracks.map(src => src.split('/').pop());
  expect(giftConfig.audio.gapMs).toBe(0);
  expect(giftConfig.audio.startDelayMs).toBe(3000);
  expect(giftConfig.audio.finishDelayMs).toBe(3000);
  expect(tracks).toEqual(['1.m4a', '2.m4a', '3.m4a', '3.1.m4a', '4.m4a', '5.m4a', '6.m4a', '7.m4a', '8.m4a', '9.m4a', '10.m4a', '11.m4a', '12.m4a', '13.m4a']);
  for (let index = 0; index < tracks.length; index++) {
    await expect.poll(() => page.evaluate(() => window.audioEvents.filter(event => event.type === 'playing').length)).toBe(index + 1);
    await expect(page.locator('#letter-content')).toHaveAttribute('data-audio-track', tracks[index]);
    const cue = page.locator(`[data-audio-cue="${tracks[index]}"]`);
    await expect(cue).toContainText(giftConfig.audio.letterCues[tracks[index]]);
    await expect.poll(async () => {
      const box = await cue.boundingBox();
      return box.y >= 0 && box.y < page.viewportSize().height * 0.7;
    }).toBe(true);
    await endTrack(page);
    await expect.poll(() => page.evaluate(() => window.audioEvents.filter(event => event.type === 'ended').length)).toBe(index + 1);
  }
  await expect(page.locator('body')).toHaveAttribute('data-state', 'letter');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'bouquet');
  const events = await page.evaluate(() => window.audioEvents);
  const plays = events.filter(event => event.type === 'playing');
  const ends = events.filter(event => event.type === 'ended');
  expect(plays.map(event => event.track)).toEqual(tracks);
  expect(plays.every(event => event.state === 'letter' && !event.animating)).toBe(true);
  const openingFinished = events.find(event => event.type === 'opening-finished');
  expect(openingFinished).toBeTruthy();
  expect(plays[0].at - openingFinished.at).toBeGreaterThanOrEqual(2980);
  expect(plays[0].at - openingFinished.at).toBeLessThan(4500);
  for (let index = 1; index < plays.length; index++) {
    expect(plays[index].at - ends[index - 1].at).toBeGreaterThanOrEqual(0);
    expect(plays[index].at - ends[index - 1].at).toBeLessThan(1500);
  }
  const finish = events.filter(event => event.type === 'transition').at(-1).at - ends.at(-1).at;
  expect(finish).toBeGreaterThanOrEqual(2980);
  expect(finish).toBeLessThan(3800);
  await expect(page.locator('#letter-audio')).toHaveJSProperty('paused', true);
});

test('leaving during the initial 3s wait prevents delayed audio from starting', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/assets/models/flower_bouquet.*', route => route.abort('failed'));
  await page.goto('/');
  await page.locator('#letter-audio').evaluate(audio => {
    window.audioStartCount = 0;
    audio.addEventListener('play', () => window.audioStartCount++);
  });
  await page.locator('#open-envelope').click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'letter');
  await page.locator('#audio-play').evaluate(button => button.click());
  await expect(page.locator('#letter-audio')).toHaveJSProperty('paused', true);
  await page.locator('#continue-bouquet').evaluate(button => button.click());
  await expect(page.locator('body')).toHaveAttribute('data-state', 'bouquet');
  await page.waitForTimeout(3500);
  expect(await page.evaluate(() => window.audioStartCount)).toBe(0);
});

test('phone scrolling is gradual, yields to manual scrolling and follows the next file', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLetter(page, 'no-preference');
  await page.waitForTimeout(1100);
  const before = await page.evaluate(() => scrollY);
  await endTrack(page);
  await expect(page.locator('#letter-content')).toHaveAttribute('data-audio-track', '2.m4a');
  await page.waitForTimeout(250);
  const during = await page.evaluate(() => ({ y: scrollY, target: scrollY + document.querySelector('[data-audio-cue="2.m4a"]').getBoundingClientRect().top - 120 }));
  expect(during.y).toBeGreaterThan(before);
  expect(during.y).toBeLessThan(during.target - 5);
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(200);
  const manual = await page.evaluate(() => scrollY);
  await page.waitForTimeout(1050);
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(manual, 0);
  await endTrack(page);
  await expect(page.locator('#letter-content')).toHaveAttribute('data-audio-track', '3.m4a');
  await page.waitForTimeout(1100);
  const cue = await page.locator('[data-audio-cue="3.m4a"]').boundingBox();
  expect(cue.y).toBeGreaterThanOrEqual(118);
  expect(cue.y).toBeLessThanOrEqual(122);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#continue-bouquet').evaluate(button => button.click());
  await expect(page.locator('body')).toHaveAttribute('data-state', 'bouquet');
  await page.waitForTimeout(1100);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('reduced motion follows the cue immediately and keeps all letter text unchanged', async ({ page }) => {
  await openLetter(page);
  const text = await page.locator('#letter-content').evaluate(element => [...element.children].map(child => child.textContent));
  expect(text).toEqual([giftConfig.letter.greeting, ...giftConfig.letter.paragraphs]);
  await endTrack(page);
  await expect(page.locator('#letter-content')).toHaveAttribute('data-audio-track', '2.m4a');
  const cue = await page.locator('[data-audio-cue="2.m4a"]').boundingBox();
  expect(cue.y).toBeGreaterThanOrEqual(118);
  expect(cue.y).toBeLessThanOrEqual(122);
});

test('pausing during a gap preserves the next track and resumes the remaining delay', async ({ page }) => {
  await openLetter(page, 'reduce', 200);
  await endTrack(page);
  await expect(page.locator('#letter-audio')).toHaveAttribute('data-track', '2');
  await page.locator('#audio-play').evaluate(button => button.click());
  await page.waitForTimeout(750);
  expect(await page.evaluate(() => window.audioEvents.filter(event => event.type === 'playing').length)).toBe(1);
  await page.locator('#audio-play').evaluate(button => button.click());
  await expect.poll(() => page.evaluate(() => window.audioEvents.filter(event => event.type === 'playing').at(-1).track)).toBe('2.m4a');
});

test('leaving the letter during a gap cancels the queued audio', async ({ page }) => {
  await openLetter(page, 'reduce', 200);
  await endTrack(page);
  await expect(page.locator('#letter-audio')).toHaveAttribute('data-track', '2');
  await page.locator('#continue-bouquet').evaluate(button => button.click());
  await expect(page.locator('body')).toHaveAttribute('data-state', 'bouquet');
  await page.waitForTimeout(750);
  expect(await page.evaluate(() => window.audioEvents.filter(event => event.type === 'playing').length)).toBe(1);
  await expect(page.locator('#letter-audio')).toHaveJSProperty('paused', true);
});

test('hiding the page during a gap pauses the playlist until manually resumed', async ({ page }) => {
  await openLetter(page, 'reduce', 200);
  await endTrack(page);
  await expect(page.locator('#letter-audio')).toHaveAttribute('data-track', '2');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(750);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate(() => window.audioEvents.filter(event => event.type === 'playing').length)).toBe(1);
  await page.locator('#audio-play').evaluate(button => button.click());
  await expect.poll(() => page.evaluate(() => window.audioEvents.filter(event => event.type === 'playing').at(-1).track)).toBe('2.m4a');
});

test('a failed middle track retries that track without skipping ahead', async ({ page }) => {
  await page.route('**/assets/audio/2.m4a', route => route.abort('failed'));
  await openLetter(page);
  await endTrack(page);
  await expect(page.locator('#audio-status')).toContainText('Chưa tải');
  await page.waitForTimeout(750);
  expect(await page.evaluate(() => window.audioEvents.filter(event => event.type === 'playing').length)).toBe(1);
  await page.unroute('**/assets/audio/2.m4a');
  await page.locator('#audio-play').evaluate(button => button.click());
  await expect.poll(() => page.evaluate(() => window.audioEvents.filter(event => event.type === 'playing').at(-1).track)).toBe('2.m4a');
});

test('pausing after file 13 also pauses the final transition countdown', async ({ page }) => {
  await page.route('**/js/config.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()) + "\ngiftConfig.audio.tracks = ['assets/audio/13.m4a'];" });
  });
  await openLetter(page);
  await endTrack(page);
  await expect.poll(() => page.evaluate(() => window.audioEvents.filter(event => event.type === 'ended').length)).toBe(1);
  await page.locator('#audio-play').evaluate(button => button.click());
  await page.waitForTimeout(2200);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'letter');
  await page.locator('#audio-play').evaluate(button => button.click());
  await expect(page.locator('body')).toHaveAttribute('data-state', 'bouquet');
  expect(await page.evaluate(() => window.audioEvents.filter(event => event.type === 'playing').length)).toBe(1);
});
