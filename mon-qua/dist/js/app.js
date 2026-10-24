import { giftConfig as config } from './config.js';
import { BouquetView } from './bouquet.js';
import { MemoryGallery } from './gallery.js';

const $ = (id) => document.getElementById(id);
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
let state = 'envelope';
let sceneId = 'envelope-scene';
let pendingSceneId = null;
let transitionId = 0;
let modelState = 'loading';
const audioTracks = config.audio.tracks || (config.audio.src ? [config.audio.src] : []);
let audioUnavailable = audioTracks.length === 0;
let audioAttemptId = 0;
let audioTrackIndex = 0;
let audioRunning = false;
let audioWait = null;
let letterAudioReady = false;
const audio = $('letter-audio');
const nextAudio = new Audio();
nextAudio.preload = 'auto';

const flowerMusic = config.flowerMusic || config.music || { src: 'assets/audio/mussic.mp3', loop: true };
const flowerAudio = $('flower-audio') || new Audio();
flowerAudio.preload = 'auto';
flowerAudio.loop = Boolean(flowerMusic?.loop ?? true);
if (flowerMusic?.src && flowerAudio.getAttribute('src') !== flowerMusic.src) {
  flowerAudio.src = flowerMusic.src;
}
let flowerAudioWasPlaying = false;

function playFlowerMusic() {
  if (!flowerAudio.src) return;
  flowerAudio.loop = Boolean(flowerMusic?.loop ?? true);
  flowerAudio.muted = audio.muted;
  if (flowerAudio.paused) {
    const playPromise = flowerAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }
  }
}

function pauseFlowerMusic(reset = false) {
  flowerAudio.pause();
  if (reset) {
    try { flowerAudio.currentTime = 0; } catch { /* No metadata yet */ }
  }
}

function setState(next) {
  state = next;
  document.body.dataset.state = next;
}

const bouquet = new BouquetView({
  container: $('bouquet-view'),
  interactionElement: $('flower-stage'),
  modelUrl: config.model.src,
  fallbackUrl: config.model.fallback,
  reducedMotion: reducedQuery.matches,
  onActivate: revealMemories,
  onStatus: ({ state: status, message, progress }) => {
    modelState = status;
    const overlay = $('model-loading');
    overlay.hidden = status !== 'loading';
    overlay.classList.toggle('is-error', status === 'error');
    $('model-status-text').textContent = message || (status === 'loading' ? 'Đang mở gói hoa của bạn…' : '');
    if (Number.isFinite(progress)) $('model-progress').value = progress * 100;
    else $('model-progress').removeAttribute('value');
  }
});
const gallery = new MemoryGallery({
  stage: $('flower-stage'), layer: $('memory-orbits'), photos: config.photos,
  scene: bouquet, reducedMotion: reducedQuery.matches,
  onModalChange: (open) => {
    bouquet.setPaused(open);
  }
});

document.querySelectorAll('[data-sender]').forEach((el) => { el.textContent = config.sender; });
$('open-envelope').setAttribute('aria-label', `Mở phong thư từ ${config.sender}`);
const greeting = document.createElement('p');
greeting.className = 'salutation';
greeting.textContent = config.letter.greeting || `Gửi ${config.recipient},`;
$('letter-content').append(greeting);
config.letter.paragraphs.forEach((text) => {
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  if (text.startsWith('“')) paragraph.className = 'letter-quote';
  $('letter-content').append(paragraph);
});
if (config.letter.signature) {
  document.querySelector('.letter-signature > span').textContent = config.letter.signature.label;
  document.querySelector('.letter-signature > strong').textContent = config.letter.signature.name;
}
const letterCues = new Map();
for (const [filename, text] of Object.entries(config.audio.letterCues || {})) {
  const paragraph = [...$('letter-content').children].find(element => element.textContent.includes(text));
  if (!paragraph) continue;
  const offset = paragraph.textContent.indexOf(text);
  let anchor = paragraph;
  if (offset > 0) {
    // The 3.1 cue begins within a paragraph. Wrap the existing text unchanged.
    const tail = paragraph.firstChild.splitText(offset);
    anchor = document.createElement('span');
    tail.replaceWith(anchor);
    anchor.append(tail);
  }
  anchor.dataset.audioCue = filename;
  letterCues.set(filename, anchor);
}
let letterScrollFrame = null;
let followedTrack = null;
function cancelLetterScroll() {
  if (letterScrollFrame !== null) cancelAnimationFrame(letterScrollFrame);
  letterScrollFrame = null;
}
function followAudioTrack() {
  if (state !== 'letter' || !audioRunning || !letterAudioReady) return;
  const filename = audioTracks[audioTrackIndex].split('/').pop();
  const anchor = letterCues.get(filename);
  if (!anchor || followedTrack === filename) return;
  followedTrack = filename;
  $('letter-content').dataset.audioTrack = filename;
  cancelLetterScroll();
  const start = window.scrollY;
  const inset = Math.min(120, Math.max(48, window.innerHeight * 0.16));
  const limit = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const target = Math.min(limit, Math.max(0, start + anchor.getBoundingClientRect().top - inset));
  if (reducedQuery.matches) { window.scrollTo({ top: target, behavior: 'instant' }); return; }
  const started = performance.now();
  function step(now) {
    const progress = Math.min(1, (now - started) / 950);
    const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    window.scrollTo({ top: start + (target - start) * eased, behavior: 'instant' });
    letterScrollFrame = progress < 1 ? requestAnimationFrame(step) : null;
  }
  letterScrollFrame = requestAnimationFrame(step);
}
// Let the reader take over scrolling; follow again when the next file starts.
for (const event of ['wheel', 'touchstart', 'pointerdown', 'resize']) {
  window.addEventListener(event, cancelLetterScroll, { passive: true });
}
window.addEventListener('keydown', event => {
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) cancelLetterScroll();
});
$('sample-letter-note').hidden = !config.letter.isSample;
if (config.model.credit) {
  $('model-credit').title = `Hoa 3D: ${config.model.credit.author} · ${config.model.credit.license}`;
  $('model-credit').setAttribute('aria-label', `Nguồn mô hình hoa: ${config.model.credit.author}, ${config.model.credit.license}`);
  $('model-credit').href = config.model.credit.href;
} else $('model-credit').hidden = true;

function timeLabel(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
function updatePlayer() {
  const playing = audioRunning;
  $('audio-play').querySelector('use').setAttribute('href', playing ? '#icon-pause' : '#icon-play');
  $('audio-play').setAttribute('aria-label', playing ? 'Tạm dừng lời nhắn' : 'Phát lời nhắn');
  $('audio-label').textContent = `${playing ? config.audio.label : 'Phát lời nhắn'}${audioTracks.length > 1 ? ` · ${audioTrackIndex + 1}/${audioTracks.length}` : ''}`;
  $('audio-time').textContent = `${timeLabel(audio.currentTime)} / ${timeLabel(audio.duration)}`;
  $('audio-progress').disabled = !Number.isFinite(audio.duration) || audio.duration <= 0;
  $('audio-progress').value = audio.duration > 0 ? audio.currentTime / audio.duration * 100 : 0;
}
function setAudioStatus(message) { $('audio-status').textContent = message; }
function setAudioTrack(index) {
  audioTrackIndex = index;
  audio.src = audioTracks[index];
  audio.dataset.track = String(index + 1);
  if (audioTracks[index + 1]) nextAudio.src = audioTracks[index + 1];
  else nextAudio.removeAttribute('src');
  updatePlayer();
}
function pauseAudio() {
  cancelLetterScroll();
  audioAttemptId++;
  audioRunning = false;
  if (audioWait && audioWait.timer !== null) {
    clearTimeout(audioWait.timer);
    audioWait.remaining = Math.max(0, audioWait.deadline - performance.now());
    audioWait.timer = null;
  }
  audio.pause();
  updatePlayer();
}
function stopAudio(reset = true) {
  pauseAudio();
  audioWait = null;
  if (reset) { try { audio.currentTime = 0; } catch { /* No metadata yet. */ } }
  updatePlayer();
}
function resumeAudioWait() {
  const waiting = audioWait;
  if (!waiting || waiting.timer !== null) return;
  waiting.deadline = performance.now() + waiting.remaining;
  waiting.timer = setTimeout(() => {
    if (audioWait !== waiting || !audioRunning || state !== 'letter') return;
    audioWait = null;
    if (waiting.kind === 'finish') goToBouquet();
    else playMessage();
  }, waiting.remaining);
}
function waitForAudio(kind, milliseconds) {
  audioWait = { kind, remaining: milliseconds, deadline: 0, timer: null };
  resumeAudioWait();
  updatePlayer();
}
// Start only once the envelope and letter entrance animations have finished.
function playMessage() {
  if (!audioTracks.length || audioUnavailable || state !== 'letter' || !letterAudioReady) return;
  audioRunning = true;
  if (audioWait) { resumeAudioWait(); updatePlayer(); return; }
  const attempt = ++audioAttemptId;
  if (audio.ended) audio.currentTime = 0;
  const playback = audio.play();
  playback?.then(() => {
    const letterIsActive = state === 'letter';
    if (attempt !== audioAttemptId || !letterIsActive) {
      // A stale promise must not stop a newer legitimate playback.
      if (!letterIsActive) audio.pause();
      return;
    }
    setAudioStatus('Bạn có thể vừa đọc thư, vừa nghe lời nhắn.');
    updatePlayer();
  }).catch((error) => {
    if (attempt !== audioAttemptId || error.name === 'AbortError') return;
    audioRunning = false;
    setAudioStatus('Chạm “Phát lời nhắn” để nghe. Bạn vẫn có thể đọc thư và tiếp tục đến bó hoa.');
    updatePlayer();
  });
}
if (audioTracks.length) setAudioTrack(0);
else {
  $('audio-player').hidden = true;
  $('audio-play').disabled = true;
  $('audio-status').classList.add('sr-only');
  setAudioStatus('Giọng đọc sẽ được thêm sau. Bạn có thể đọc thư và tiếp tục đến bó hoa.');
}
audio.addEventListener('error', () => {
  audioUnavailable = true;
  $('audio-play').disabled = false;
  stopAudio(false);
  setAudioStatus('Chưa tải được lời nhắn. Bạn vẫn có thể đọc thư và tiếp tục đến bó hoa.');
});
for (const event of ['timeupdate', 'loadedmetadata', 'durationchange', 'play', 'pause']) audio.addEventListener(event, updatePlayer);
audio.addEventListener('playing', followAudioTrack);
audio.addEventListener('ended', () => {
  if (state !== 'letter' || !audioRunning || audioWait) return;
  if (audioTrackIndex < audioTracks.length - 1) {
    setAudioTrack(audioTrackIndex + 1);
    const gap = config.audio.gapMs ?? 0;
    if (gap > 0) waitForAudio('next', gap);
    else playMessage();
  } else {
    waitForAudio('finish', config.audio.finishDelayMs ?? 3000);
  }
});
$('audio-play').addEventListener('click', () => {
  if (state !== 'letter') return;
  if (audioUnavailable && audioTracks.length) {
    audioUnavailable = false;
    audio.load();
  }
  if (audioRunning) pauseAudio();
  else playMessage();
});
$('audio-progress').addEventListener('input', (event) => {
  if (state === 'letter' && Number.isFinite(audio.duration)) {
    const wasRunning = audioRunning;
    if (audioWait) { pauseAudio(); audioWait = null; }
    audio.currentTime = Number(event.target.value) / 100 * audio.duration;
    if (wasRunning) playMessage();
  }
});
function syncMute() {
  flowerAudio.muted = audio.muted;
  for (const id of ['global-mute', 'audio-mute']) {
    const button = $(id);
    button.setAttribute('aria-pressed', String(audio.muted));
    button.setAttribute('aria-label', audio.muted ? 'Bật âm thanh' : 'Tắt âm thanh');
    button.title = audio.muted ? 'Bật âm thanh' : 'Tắt âm thanh';
    button.querySelector('use').setAttribute('href', audio.muted ? '#icon-muted' : '#icon-volume');
  }
}
for (const id of ['global-mute', 'audio-mute']) $(id).addEventListener('click', () => { audio.muted = !audio.muted; syncMute(); });

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function changeScene(id, nextState) {
  const token = ++transitionId;
  pendingSceneId = id;
  const previous = $(sceneId);
  setState('transition');
  previous.inert = true;
  previous.classList.add('leaving');
  bouquet.setActive(false);
  gallery.hide();
  if (nextState !== 'bouquet' && nextState !== 'memories') {
    pauseFlowerMusic(true);
  }
  await pause(reducedQuery.matches ? 0 : 280);
  if (token !== transitionId) return false;
  previous.hidden = true;
  previous.classList.remove('leaving');
  const next = $(id);
  next.hidden = false;
  next.inert = false;
  sceneId = id;
  pendingSceneId = null;
  setState(nextState);
  if (id === 'flower-scene') {
    bouquet.setPaused(false);
    bouquet.setActive(true);
    requestAnimationFrame(() => { bouquet.resize(); gallery.resize(); });
    playFlowerMusic();
  }
  next.querySelector('h1,h2')?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  $('live-status').textContent = nextState === 'letter' ? 'Bức thư đã được mở.' : nextState === 'bouquet' ? 'Một bó hoa dành cho bạn. Nhấn vào bó hoa để mở kỷ niệm.' : 'Món quà đã trở về phong thư.';
  return true;
}
async function openEnvelope() {
  if (state !== 'envelope') return;
  setState('opening');
  $('envelope-scene').classList.add('is-opening');
  $('open-envelope').disabled = true;
  $('open-envelope').classList.add('opening');
  await pause(reducedQuery.matches ? 0 : 1150);
  if (state !== 'opening') return;
  const opened = await changeScene('letter-scene', 'letter');
  if (!opened) return;
  // The new scene also has a 500ms entrance animation.
  await Promise.all($('letter-scene').getAnimations().map(animation => animation.finished.catch(() => {})));
  const startAttempt = audioAttemptId;
  await pause(config.audio.startDelayMs ?? 3000);
  letterAudioReady = true;
  if (state === 'letter' && !document.hidden && startAttempt === audioAttemptId) playMessage();
}
function resetFlowerUI() {
  gallery.reset();
  bouquet.setMemoryMode(false);
  $('bouquet-view').removeAttribute('aria-hidden');
  $('bouquet-view').querySelectorAll('canvas,button').forEach(el => { el.tabIndex = 0; });
  $('flower-scene').classList.remove('has-memories');
  $('flower-heading').textContent = 'Bó hoa và những kỷ niệm';
}
async function goToBouquet() {
  if (state !== 'letter') return;
  stopAudio();
  resetFlowerUI();
  await changeScene('flower-scene', 'bouquet');
}
function revealMemories() {
  playFlowerMusic();
  if (state === 'memories') {
    gallery.advance?.();
    return;
  }
  if (state !== 'bouquet' || modelState === 'loading') return;
  setState('memories');
  bouquet.setMemoryMode(true);
  syncBouquetAccessibility();
  $('flower-scene').classList.add('has-memories');
  $('flower-heading').textContent = 'Bó hoa và những trái tim kỷ niệm';
  if ($('bouquet-view').contains(document.activeElement)) $('flower-heading').focus({ preventScroll: true });
  gallery.show();
  $('flower-stage').setAttribute('aria-label', 'Bó hoa 3D giữa những trái tim pha lê chứa ảnh. Chạm trái tim để xem ảnh và ghi chú. Kéo để đổi góc nhìn, chạm bó hoa để xem thêm ảnh.');
  $('live-status').textContent = `${config.photos.length} ảnh kỷ niệm trong những trái tim pha lê quanh bó hoa. Chạm trái tim để xem ảnh, chạm bó hoa để xem thêm.`;
}
function syncBouquetAccessibility() {
  $('bouquet-view').removeAttribute('aria-hidden');
  $('bouquet-view').querySelectorAll('canvas,button').forEach(el => { el.tabIndex = 0; });
}
$('open-envelope').addEventListener('click', openEnvelope);
$('continue-bouquet').addEventListener('click', goToBouquet);
$('flower-stage').addEventListener('pointerdown', () => {
  if (['bouquet', 'memories'].includes(state) && flowerAudio.paused) {
    playFlowerMusic();
  }
}, { passive: true });
document.addEventListener('visibilitychange', () => {
  document.body.classList.toggle('page-inactive', document.hidden);
  // Returning to the tab never starts audio without the user's intent.
  if (document.hidden && audioRunning) pauseAudio();
  if (document.hidden && !flowerAudio.paused) {
    pauseFlowerMusic(false);
    flowerAudioWasPlaying = true;
  } else if (!document.hidden && flowerAudioWasPlaying && ['bouquet', 'memories'].includes(state)) {
    playFlowerMusic();
    flowerAudioWasPlaying = false;
  }
});
reducedQuery.addEventListener('change', () => {
  cancelLetterScroll();
  // Each view reads its motion preference again on resize/activity changes.
  bouquet.setReducedMotion(reducedQuery.matches);
  gallery.reducedMotion = reducedQuery.matches;
  gallery.resize();
  if (state === 'memories') syncBouquetAccessibility();
});
window.addEventListener('pagehide', () => {
  stopAudio(false);
  pauseFlowerMusic(false);
  bouquet.setActive(false);
  gallery.hide();
});
window.addEventListener('pageshow', () => {
  if (['bouquet','memories'].includes(state)) {
    bouquet.setActive(true);
    playFlowerMusic();
  }
  if (state === 'memories') gallery.show();
});

// Decode geometry/textures and prepare GPU resources while the envelope is visible.
bouquet.preload();
// Warm the first photo hearts while the letter is visible.
const firstPhotoPreloads = config.photos.slice(0, 6).filter(photo => photo.src).map(photo => {
  const image = new Image();
  image.decoding = 'async';
  image.src = photo.src;
  return image;
});
