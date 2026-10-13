import { giftConfig as config } from './config.js';
import { BouquetView } from './bouquet.js';
import { MemoryGallery } from './gallery.js';

const $ = (id) => document.getElementById(id);
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
let state = 'envelope';
let sceneId = 'envelope-scene';
let pendingSceneId = null;
let transitionId = 0;
let endedWhileOpening = false;
let modelState = 'loading';
let audioUnavailable = !config.audio.src;
let audioAttemptId = 0;
const audio = $('letter-audio');

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
  $('letter-content').append(paragraph);
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
  const playing = !audio.paused && !audio.ended;
  $('audio-play').querySelector('use').setAttribute('href', playing ? '#icon-pause' : '#icon-play');
  $('audio-play').setAttribute('aria-label', playing ? 'Tạm dừng lời nhắn' : 'Phát lời nhắn');
  $('audio-label').textContent = playing ? config.audio.label : 'Phát lời nhắn';
  $('audio-time').textContent = `${timeLabel(audio.currentTime)} / ${timeLabel(audio.duration)}`;
  $('audio-progress').disabled = !Number.isFinite(audio.duration) || audio.duration <= 0;
  $('audio-progress').value = audio.duration > 0 ? audio.currentTime / audio.duration * 100 : 0;
}
function setAudioStatus(message) { $('audio-status').textContent = message; }
function stopAudio(reset = true) {
  audioAttemptId++;
  audio.pause();
  if (reset) { try { audio.currentTime = 0; } catch { /* No metadata yet. */ } }
  updatePlayer();
}
// Called synchronously by the opening gesture, before animation awaits.
function playMessage() {
  if (!config.audio.src || audioUnavailable) return;
  const attempt = ++audioAttemptId;
  if (audio.ended) audio.currentTime = 0;
  const playback = audio.play();
  playback?.then(() => {
    const letterIsActive = ['opening', 'letter'].includes(state) || (state === 'transition' && pendingSceneId === 'letter-scene');
    if (attempt !== audioAttemptId || !letterIsActive) {
      // A stale promise must not stop a newer legitimate playback.
      if (!letterIsActive) audio.pause();
      return;
    }
    setAudioStatus('Bạn có thể vừa đọc thư, vừa nghe lời nhắn.');
    updatePlayer();
  }).catch((error) => {
    if (attempt !== audioAttemptId || error.name === 'AbortError') return;
    setAudioStatus('Chạm “Phát lời nhắn” để nghe. Bạn vẫn có thể đọc thư và tiếp tục đến bó hoa.');
    updatePlayer();
  });
}
if (config.audio.src) audio.src = config.audio.src;
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
audio.addEventListener('ended', () => {
  updatePlayer();
  if (state === 'opening' || (state === 'transition' && pendingSceneId === 'letter-scene')) endedWhileOpening = true;
  else if (state === 'letter') goToBouquet();
});
$('audio-play').addEventListener('click', () => {
  if (state !== 'letter') return;
  if (audioUnavailable && config.audio.src) {
    audioUnavailable = false;
    audio.load();
  }
  if (!audio.paused) audio.pause();
  else playMessage();
});
$('audio-progress').addEventListener('input', (event) => {
  if (state === 'letter' && Number.isFinite(audio.duration)) audio.currentTime = Number(event.target.value) / 100 * audio.duration;
});
function syncMute() {
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
  endedWhileOpening = false;
  $('open-envelope').disabled = true;
  $('open-envelope').classList.add('opening');
  playMessage();
  await pause(reducedQuery.matches ? 0 : 1150);
  if (state !== 'opening') return;
  const opened = await changeScene('letter-scene', 'letter');
  if (opened && endedWhileOpening) goToBouquet();
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
document.addEventListener('visibilitychange', () => {
  document.body.classList.toggle('page-inactive', document.hidden);
  // Returning to the tab never starts audio without the user's intent.
  if (document.hidden && !audio.paused) audio.pause();
});
reducedQuery.addEventListener('change', () => {
  // Each view reads its motion preference again on resize/activity changes.
  bouquet.setReducedMotion(reducedQuery.matches);
  gallery.reducedMotion = reducedQuery.matches;
  gallery.resize();
  if (state === 'memories') syncBouquetAccessibility();
});
window.addEventListener('pagehide', () => { stopAudio(false); bouquet.setActive(false); gallery.hide(); });
window.addEventListener('pageshow', () => {
  if (['bouquet','memories'].includes(state)) bouquet.setActive(true);
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
