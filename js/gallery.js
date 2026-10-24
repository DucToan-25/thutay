const GROUP_DURATION = 9;
const HEART_WIDTH = 240;
const HEART_HEIGHT = 220;
const HEART_PATH = 'M120 207 C108 199 20 133 15 80 C8 23 78 5 120 57 C162 5 232 23 225 80 C220 133 132 199 120 207 Z';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const random = (min, max) => min + Math.random() * (max - min);
const node = (tag, className, text) => {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
};

/** Independent floating photo hearts, projected with the real bouquet's camera. */
export class MemoryGallery {
  constructor({ stage, layer, photos = [], scene, reducedMotion = false, onModalChange = () => {}, onSelectionChange }) {
    Object.assign(this, { stage, layer, scene, active: false, externalPaused: false, selectedIndex: null,
      elapsed: 0, frame: 0, lastTime: 0, pointerStart: null, layoutGroup: -1, layoutAge: 0 });
    this.photos = photos.filter(photo => photo && typeof photo === 'object');
    this.onSelectionChange = onSelectionChange || onModalChange;
    this.reducedMotion = typeof reducedMotion === 'boolean' ? reducedMotion : Boolean(reducedMotion?.matches);
    this.cards = [];
    this.pointers = new Set();
    this.stage.style.setProperty('--bouquet-depth', '20');
    this.layer.classList.add('memory-orbits', 'memory-heart-field');
    this.layer.setAttribute('role', 'group');
    this.layer.setAttribute('aria-label', 'Những trái tim pha lê lưu giữ ảnh kỷ niệm');
    this.layer.dataset.layout = 'scattered';
    this.layer.dataset.visibleCount = '0';
    this.layer.dataset.fieldMotion = 'hidden';
    this.layer.hidden = true;
    this.createSparkles();
    this.createInspector();
    this.createCards();
    this.bindInteractions();
    this.scene?.subscribeProjection?.(() => {
      if (this.active && !this.frame) this.render();
    });
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.motionPreference.addEventListener('change', event => {
      this.reducedMotion = event.matches;
      this.finishTransitions(); this.render(); this.updateAnimation();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.render();
      this.updateAnimation();
    });
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.stage);
    } else window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  get capacity() { return this.viewport?.width < 600 ? 8 : 10; }
  get groupCount() { return Math.max(1, Math.ceil(this.photos.length / this.capacity)); }
  get currentGroup() { return (Math.floor(this.elapsed / GROUP_DURATION) % this.groupCount) + 1; }
  get visibleCount() { return Number(this.layer.dataset.visibleCount || 0); }

  createSparkles() {
    for (let index = 0; index < 34; index++) {
      const sparkle = node('span', 'memory-sparkle');
      sparkle.setAttribute('aria-hidden', 'true');
      sparkle.style.left = random(2, 98) + '%';
      sparkle.style.top = random(2, 97) + '%';
      sparkle.style.setProperty('--sparkle-size', random(3, index % 5 === 0 ? 22 : 8) + 'px');
      sparkle.style.setProperty('--sparkle-delay', random(-5, 0) + 's');
      this.layer.append(sparkle);
    }
  }

  createInspector() {
    this.inspector = node('div', 'orbit-photo-inspector');
    this.inspector.dataset.orbitUi = '';
    this.inspector.hidden = true;
    const copy = node('div', 'orbit-photo-copy');
    this.date = node('time', 'orbit-photo-date');
    this.date.hidden = true;
    this.caption = node('p', 'orbit-photo-caption');
    this.caption.id = 'orbit-selected-caption';
    this.caption.setAttribute('aria-live', 'polite');
    copy.append(this.date, this.caption);
    this.closeButton = node('button', 'orbit-selection-close', '×');
    this.closeButton.type = 'button';
    this.closeButton.setAttribute('aria-label', 'Đóng ảnh');
    this.closeButton.addEventListener('click', () => this.closeSelection());
    this.inspector.append(copy, this.closeButton);
    this.layer.append(this.inspector);
  }

  crystalShell(index) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('crystal-shell');
    svg.setAttribute('viewBox', '0 0 240 220');
    svg.setAttribute('aria-hidden', 'true');
    const id = 'crystal-' + index;
    svg.innerHTML = `<defs>
      <clipPath id="${id}-photo" clipPathUnits="objectBoundingBox"><path d="${HEART_PATH}" transform="scale(0.004166667 0.004545455)"/></clipPath>
      <linearGradient id="${id}-fill" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".34"/><stop offset=".42" stop-color="#ffd4e6" stop-opacity=".08"/><stop offset=".8" stop-color="#ffeff6" stop-opacity=".18"/><stop offset="1" stop-color="#ffc7d9" stop-opacity=".42"/></linearGradient>
      <linearGradient id="${id}-edge" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fff"/><stop offset=".2" stop-color="#fff" stop-opacity=".95"/><stop offset=".42" stop-color="#b04a71" stop-opacity=".55"/><stop offset=".62" stop-color="#fff"/><stop offset=".82" stop-color="#ec96b0"/><stop offset="1" stop-color="#fff"/></linearGradient>
      <linearGradient id="${id}-rim" x1="1" y1="0" x2="0" y2="1"><stop stop-color="#e799b1"/><stop offset=".36" stop-color="#fff"/><stop offset=".65" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#f4c3d3"/></linearGradient>
      <radialGradient id="${id}-shine" cx=".3" cy=".15" r=".9"><stop stop-color="#fff" stop-opacity=".45"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>
    <path d="${HEART_PATH}" fill="url(#${id}-fill)" stroke="#d96f97" stroke-opacity=".42" stroke-width="8"/>
    <path d="${HEART_PATH}" fill="url(#${id}-shine)" stroke="url(#${id}-edge)" stroke-width="4.5"/>
    <path d="${HEART_PATH}" transform="translate(5 4) scale(.956 .956)" fill="none" stroke="url(#${id}-rim)" stroke-width="1.8" opacity=".86"/>
    <path d="M25 77 C20 40 59 18 86 34 M154 31 C181 18 216 41 217 65" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" opacity=".95"/>
    <path d="M24 92 C29 122 46 145 68 164 M207 101 C199 124 184 144 171 158" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".78"/>
    <ellipse cx="54" cy="35" rx="15" ry="4" transform="rotate(-20 54 35)" fill="#fff" opacity=".95"/>
    <path d="M102 188 Q118 204 126 199" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
    `;
    return svg;
  }

  createCards() {
    this.photos.forEach((photo, index) => {
      const button = node('button', 'memory-card memory-heart');
      button.type = 'button';
      button.dataset.orbitCard = '';
      button.dataset.photoIndex = String(index);
      button.disabled = true; button.hidden = true;
      button.setAttribute('aria-label', 'Xem ảnh ' + (index + 1) + ': ' + (photo.caption || photo.alt || 'Kỷ niệm'));
      button.setAttribute('aria-pressed', 'false');
      const surface = node('span', 'memory-card-surface');
      const clip = node('span', 'memory-photo-clip');
      clip.style.clipPath = `url(#crystal-${index}-photo)`;
      const image = node('img', 'memory-image');
      image.alt = photo.alt || photo.caption || 'Một bức ảnh kỷ niệm';
      image.draggable = false; image.decoding = 'async';
      const fallback = node('span', 'memory-image-unavailable');
      fallback.append(node('span', 'memory-placeholder-icon', '♡'), node('span', '', 'Ảnh đang chờ được thêm'));
      fallback.hidden = true;
      const card = { button, index, aspect: 1.38 };
      image.addEventListener('load', () => {
        if (image.naturalWidth && image.naturalHeight) {
          card.aspect = clamp(image.naturalWidth / image.naturalHeight, 0.4, 2.8);
          button.style.setProperty('--memory-image-ratio', String(card.aspect));
          if (this.active && this.selectedIndex === index) this.render();
        }
      });
      image.addEventListener('error', () => { image.hidden = true; fallback.hidden = false; });
      if (photo.src) image.src = photo.src;
      else { image.hidden = true; fallback.hidden = false; }
      clip.append(image, fallback);
      surface.append(clip, this.crystalShell(index), node('span', 'memory-card-shine'));
      button.append(surface);
      button.addEventListener('click', event => {
        if (event.detail === 0 && !event.pointerType) this.selectPhoto(index);
      });
      this.layer.insertBefore(button, this.inspector);
      this.cards.push(card);
    });
  }

  bindInteractions() {
    document.addEventListener('pointerdown', event => {
      if (!this.active || !this.stage.contains(event.target)) return;
      this.pointers.add(event.pointerId); this.updateAnimation();
      if (this.pointers.size > 1) { if (this.pointerStart) this.pointerStart.cancelled = true; return; }
      if (event.target.closest('[data-orbit-ui]')) return;
      const card = event.target.closest('[data-orbit-card]');
      this.pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, card, cancelled: false,
        closeOnTap: !card && this.selectedIndex !== null };
    }, true);
    document.addEventListener('pointermove', event => {
      const start = this.pointerStart;
      if (start && start.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
        start.cancelled = true; this.finishTransitions();
      }
    }, true);
    document.addEventListener('pointerup', event => {
      this.pointers.delete(event.pointerId);
      const start = this.pointerStart;
      if (start?.id === event.pointerId) {
        this.pointerStart = null;
        if (this.active && !start.cancelled && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 8) {
          if (start.card?.isConnected && !start.card.hidden) this.selectPhoto(Number(start.card.dataset.photoIndex));
          else if (start.closeOnTap) this.closeSelection();
        }
      }
      this.updateAnimation();
    }, true);
    document.addEventListener('pointercancel', event => {
      this.pointers.delete(event.pointerId);
      if (this.pointerStart?.id === event.pointerId) this.pointerStart = null;
      this.updateAnimation();
    }, true);
    document.addEventListener('keydown', event => {
      if (this.active && this.selectedIndex !== null && event.key === 'Escape') { event.preventDefault(); this.closeSelection(); }
    });
  }

  show() {
    if (this.active) return;
    this.active = true; this.layer.hidden = false;
    this.scene?.setMemoryMode?.(true);
    this.resize(); this.render(); this.updateAnimation();
  }

  hide() {
    this.active = false; this.closeSelection(false); this.stopAnimation(); this.finishTransitions();
    this.layer.hidden = true; this.inspector.hidden = true;
    this.pointerStart = null; this.pointers.clear();
    this.cards.forEach(({ button }) => { button.disabled = true; button.hidden = true; button.classList.remove('is-visible'); });
    this.layer.dataset.visibleCount = '0'; this.layer.dataset.fieldMotion = 'hidden';
    this.scene?.setMemoryMode?.(false);
  }

  reset() { this.hide(); this.externalPaused = false; this.elapsed = 0; this.layoutGroup = -1; }
  setPaused(paused) { this.externalPaused = Boolean(paused); this.updateAnimation(); }
  showAll() { if (!this.active) this.show(); }

  advance(step = 1) {
    if (!this.active || !this.photos.length) return;
    this.closeSelection(false);
    this.elapsed = Math.max(0, Math.floor(this.elapsed / GROUP_DURATION) + Math.trunc(step)) * GROUP_DURATION;
    this.layoutGroup = -1;
    this.render(); this.updateAnimation();
  }

  startTransition(button) {
    clearTimeout(button.memoryTransition);
    if (this.reducedMotion) return;
    button.classList.add('is-changing');
    button.memoryTransition = setTimeout(() => button.classList.remove('is-changing'), 450);
  }

  finishTransitions() {
    this.cards.forEach(({ button }) => { clearTimeout(button.memoryTransition); button.classList.remove('is-changing'); });
  }

  selectPhoto(index) {
    if (!this.active || !this.photos[index] || this.cards[index].button.hidden) return;
    if (this.selectedIndex === index) { this.closeSelection(); return; }
    const firstSelection = this.selectedIndex === null;
    const oldButton = this.cards[this.selectedIndex]?.button;
    if (oldButton) this.startTransition(oldButton);
    this.selectedIndex = index;
    const photo = this.photos[index];
    this.caption.textContent = photo.caption || photo.alt || 'Kỷ niệm ' + (index + 1);
    this.date.textContent = typeof photo.date === 'string' ? photo.date : '';
    this.date.hidden = !this.date.textContent;
    this.date.removeAttribute('datetime');
    if (/^\d{4}-\d{2}-\d{2}$/.test(this.date.textContent)) this.date.dateTime = this.date.textContent;
    this.inspector.hidden = false;
    this.layer.classList.add('has-selection');
    this.cards.forEach(({ button, index: cardIndex }) => {
      const selected = cardIndex === index;
      button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', String(selected));
      if (selected) button.setAttribute('aria-describedby', this.caption.id);
      else button.removeAttribute('aria-describedby');
    });
    this.startTransition(this.cards[index].button);
    if (firstSelection) this.onSelectionChange(true);
    this.updateAnimation(); this.render();
  }

  closeSelection(restoreFocus = true) {
    if (this.selectedIndex === null) return;
    const button = this.cards[this.selectedIndex]?.button;
    this.selectedIndex = null; this.inspector.hidden = true;
    this.layer.classList.remove('has-selection');
    this.cards.forEach(({ button: card }) => {
      card.classList.remove('is-selected'); card.setAttribute('aria-pressed', 'false'); card.removeAttribute('aria-describedby');
    });
    if (button) this.startTransition(button);
    this.onSelectionChange(false);
    if (restoreFocus && this.active && document.activeElement === this.closeButton) button?.focus({ preventScroll: true });
    this.render(); this.updateAnimation();
  }

  resize() {
    const { width, height } = this.stage.getBoundingClientRect();
    if (!width || !height) return;
    const changed = !this.viewport || Math.abs(this.viewport.width - width) > 1 || Math.abs(this.viewport.height - height) > 1;
    this.viewport = { width, height };
    this.layer.style.setProperty('--memory-card-width', HEART_WIDTH + 'px');
    if (changed) this.layoutGroup = -1;
    this.render();
  }

  scatter(group) {
    const { width, height } = this.viewport;
    const mobile = width < 600;
    // Rejection sampling gives a new irregular composition without fixed slots.
    const placed = [];
    const start = group * this.capacity;
    const end = Math.min(start + this.capacity, this.cards.length);
    if (this.selectedIndex !== null && (this.selectedIndex < start || this.selectedIndex >= end)) {
      this.elapsed = Math.floor(this.selectedIndex / this.capacity) * GROUP_DURATION;
      return this.scatter(Math.floor(this.selectedIndex / this.capacity));
    }
    this.cards.forEach(card => { card.layout = null; });
    for (let index = start; index < end; index++) {
      const baseSize = mobile ? clamp(width * 0.29, 88, 150) : clamp(width * 0.18, 190, 290);
      const size = baseSize * random(0.6, 1.12);
      const marginX = Math.min(0.26, size * 0.6 / width + 0.02);
      const marginY = Math.min(0.26, size * 0.58 / height + 0.025);
      let best, bestScore = -Infinity;
      for (let attempt = 0; attempt < 70; attempt++) {
        const x = random(marginX, 1 - marginX), y = random(marginY, 1 - marginY);
        const middle = ((x - 0.5) / (mobile ? 0.29 : 0.225)) ** 2 + ((y - 0.51) / (mobile ? 0.245 : 0.39)) ** 2;
        if (middle < 1.06) continue;
        const separation = placed.length ? Math.min(...placed.map(p => Math.hypot((x - p.x) * width, (y - p.y) * height) / ((size + p.size) * 0.5))) : 1;
        const score = separation + random(0, 0.12);
        if (score > bestScore) { bestScore = score; best = { x, y, size }; }
      }
      best ||= { x: random(0.08, 0.22), y: random(0.14, 0.85), size };
      placed.push(best);
      const depthFactor = random(0.87, 1.3);
      const anchor = this.scene?.pointFromViewport?.(best.x, best.y, depthFactor)
        || { x: (best.x - 0.5) * 14, y: (0.5 - best.y) * 10, z: (1 - depthFactor) * 5 };
      const initialProjection = this.scene?.projectPoint?.(anchor);
      const worldUnit = (this.scene?.baseDistance || 12) * 0.024;
      this.cards[index].layout = {
        anchor, size, phase: random(0, Math.PI * 2), phaseY: random(0, Math.PI * 2), phaseZ: random(0, Math.PI * 2),
        speedX: random(0.75, 1.4), speedY: random(0.95, 1.65), speedZ: random(0.5, 1.0),
        driftX: worldUnit * random(0.5, 1.1), driftY: worldUnit * random(0.55, 1.0),
        tilt: random(-20, 20), tiltY: random(-13, 13), referenceScale: initialProjection?.scale || 1,
      };
      this.startTransition(this.cards[index].button);
    }
    this.layoutGroup = group;
    this.layoutAge = this.elapsed;
    this.layer.dataset.group = String(group + 1);
    this.layer.dataset.groupCount = String(this.groupCount);
  }

  selectedPose(card) {
    const { width, height } = this.viewport;
    const preferredWidth = Math.min(width - 28, width < 600 ? width * 0.86 : 440);
    this.inspector.style.width = preferredWidth + 'px';
    this.caption.style.maxHeight = clamp(height * 0.16, 42, 100) + 'px';
    const captionHeight = this.inspector.offsetHeight || 70;
    const imageWidth = Math.min(preferredWidth, Math.max(50, height - captionHeight - 58) * card.aspect);
    const imageHeight = imageWidth / card.aspect + 12;
    const x = width / 2, y = (height - captionHeight - 8) / 2;
    card.button.style.width = imageWidth + 'px';
    card.button.style.height = imageHeight + 'px';
    card.button.style.setProperty('--memory-selected-width', imageWidth + 'px');
    card.button.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1) rotate(0deg)`;
    card.button.style.zIndex = '200';
    card.button.style.setProperty('--memory-depth-opacity', '1');
    this.inspector.style.left = x + 'px';
    this.inspector.style.top = (y + imageHeight / 2 + 9) + 'px';
  }

  render() {
    if (!this.active || !this.viewport || !this.cards.length) return;
    const { width, height } = this.viewport;
    const group = Math.floor(this.elapsed / GROUP_DURATION) % this.groupCount;
    if (group !== this.layoutGroup) this.scatter(group);
    const t = this.reducedMotion ? 0 : this.elapsed;
    const reveal = this.reducedMotion ? 1 : clamp((this.elapsed - this.layoutAge) / 0.65, 0, 1);
    const entrance = 1 - (1 - reveal) ** 3;
    let visibleCount = 0;
    for (const card of this.cards) {
      const { button, layout, index } = card;
      if (!layout) {
        button.hidden = true; button.disabled = true; button.classList.remove('is-visible');
        continue;
      }
      const world = {
        x: layout.anchor.x + Math.sin(t * layout.speedX + layout.phase) * layout.driftX,
        y: layout.anchor.y + Math.sin(t * layout.speedY + layout.phaseY) * layout.driftY,
        z: layout.anchor.z + Math.sin(t * layout.speedZ + layout.phaseZ) * layout.driftY * 0.55,
      };
      const projected = this.scene?.projectPoint?.(world) || {
        x: width / 2 + world.x * width / 14, y: height / 2 - world.y * height / 10, depth: 10 - world.z, scale: 1,
      };
      const visible = this.selectedIndex === index || projected.visible !== false;
      button.hidden = !visible; button.disabled = !visible; button.classList.toggle('is-visible', visible);
      if (!visible) continue;
      visibleCount++;
      button.dataset.worldX = world.x.toFixed(4); button.dataset.worldY = world.y.toFixed(4); button.dataset.worldZ = world.z.toFixed(4);
      button.dataset.depth = projected.depth.toFixed(4);
      if (this.selectedIndex === index) { this.selectedPose(card); continue; }
      const scale = layout.size / HEART_WIDTH * clamp((projected.scale || 1) / layout.referenceScale, 0.76, 1.35) * (0.88 + entrance * 0.12);
      const boxWidth = HEART_WIDTH * scale, boxHeight = HEART_HEIGHT * scale;
      const x = clamp(projected.x, boxWidth * 0.59 + 7, width - boxWidth * 0.59 - 7);
      const y = clamp(projected.y + (1 - entrance) * 22, boxHeight * 0.62 + 8, height - boxHeight * 0.62 - 8);
      const rotation = layout.tilt + Math.sin(t * 0.9 + layout.phase) * 7;
      const tiltY = layout.tiltY + Math.sin(t * 1.15 + layout.phaseZ) * 8;
      const tiltX = Math.cos(t * 1.1 + layout.phaseY) * 7;
      button.style.width = HEART_WIDTH + 'px'; button.style.height = HEART_HEIGHT + 'px';
      button.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) translate(-50%, -50%) perspective(900px) scale(${scale.toFixed(4)}) rotate(${rotation.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) rotateX(${tiltX.toFixed(2)}deg)`;
      button.style.zIndex = String(projected.depth > (this.scene?.baseDistance || 15) * 1.03 ? 12 : 30);
      button.style.setProperty('--memory-depth-opacity', (0.88 + entrance * 0.12).toFixed(3));
      button.style.setProperty('--memory-depth-blur', '0px');
      button.dataset.fieldScale = scale.toFixed(4);
    }
    this.layer.dataset.visibleCount = String(visibleCount);
    this.layer.dataset.fieldProgress = this.elapsed.toFixed(4);
  }

  updateAnimation() {
    const run = this.active && this.photos.length > 0 && !this.reducedMotion && !document.hidden
      && !this.externalPaused && this.selectedIndex === null && this.pointers.size === 0;
    this.layer.dataset.fieldMotion = !this.active || document.hidden ? 'hidden'
      : this.selectedIndex !== null || this.externalPaused || this.pointers.size ? 'paused' : this.reducedMotion ? 'reduced' : 'running';
    if (!run) { this.stopAnimation(); return; }
    if (this.frame) return;
    this.lastTime = 0;
    const tick = time => {
      if (this.lastTime) this.elapsed += Math.max((time - this.lastTime) / 1000, 0);
      this.lastTime = time; this.render(); this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  stopAnimation() { if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0; this.lastTime = 0; }
}
