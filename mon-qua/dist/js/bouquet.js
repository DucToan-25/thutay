/** Preloads the gift and shares one 3D camera with the floating crystal hearts. */
export class BouquetView {
  constructor({ container, interactionElement, modelUrl, fallbackUrl, onActivate, onStatus, reducedMotion }) {
    if (!container) throw new Error('BouquetView cần một phần tử chứa mô hình.');
    this.container = container;
    this.interactionElement = interactionElement || container;
    this.modelUrl = modelUrl;
    this.fallbackUrl = fallbackUrl;
    this.onActivate = onActivate;
    this.onStatus = onStatus;
    this.active = false;
    this.paused = false;
    this.disposed = false;
    this.inViewport = true;
    this.state = 'idle';
    this.memoryMode = false;
    this.memoryBlend = 0;
    this.presentationTransition = null;
    this.presentationCameraDirty = false;
    this.projectionListeners = new Set();
    this.viewport = { width: 320, height: 320 };
    this.revision = 0;
    this.frameId = null;
    this.elapsed = 0;
    this.previousFrame = 0;
    this.lastRender = 0;
    this.pointerDown = null;
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = reducedMotion ?? this.motionPreference.matches;
    this.followsMotionPreference = reducedMotion == null;
    this.handleMotionChange = (event) => {
      if (this.followsMotionPreference) this.setReducedMotion(event.matches);
    };
    this.handleVisibility = () => this.syncLoop();
    this.handleResize = () => this.resize();
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.motionPreference.addEventListener?.('change', this.handleMotionChange);
    window.addEventListener('resize', this.handleResize, { passive: true });
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(container);
    }
    if ('IntersectionObserver' in window) {
      this.visibilityObserver = new IntersectionObserver(([entry]) => {
        this.inViewport = entry.isIntersecting;
        this.syncLoop();
      });
      this.visibilityObserver.observe(container);
    }
    this.tick = this.tick.bind(this);
  }

  setActive(active) {
    if (this.disposed) return;
    this.active = Boolean(active);
    if (this.atmosphere) this.atmosphere.visible = this.active;
    if (!this.active) this.pointerDown = null;
    if (this.active && this.state === 'idle') this.preload();
    if (this.controls) this.controls.enabled = this.interactive();
    if (this.active) this.resize();
    this.syncLoop();
  }

  preload() {
    if (this.disposed) return Promise.resolve();
    this.preloadRequested = true;
    if (this.state === 'idle') this.readyPromise = this.init();
    return this.readyPromise || Promise.resolve();
  }

  setPaused(paused) {
    if (this.disposed) return;
    this.paused = Boolean(paused);
    if (this.paused) this.pointerDown = null;
    this.syncLoop();
  }

  setReducedMotion(reduced) {
    this.reducedMotion = Boolean(reduced);
    if (this.reducedMotion) {
      this.memoryBlend = this.memoryMode ? 1 : 0;
      this.presentationTransition = null;
      this.presentationCameraDirty = true;
    }
    this.resize();
    this.syncLoop();
  }

  status(state, message, progress) {
    this.state = state;
    this.container.dataset.modelState = state;
    this.onStatus?.({ state, message, ...(progress == null ? {} : { progress }) });
  }

  async init() {
    const revision = ++this.revision;
    this.status('loading', 'Đang chuẩn bị bó hoa của bạn…', 0);
    try {
      // Keep dependency failures inside this boundary so the gift remains usable.
      const [THREE, { GLTFLoader }, { OrbitControls }] = await Promise.all([
        import('three'),
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/controls/OrbitControls.js'),
      ]);
      if (this.disposed || revision !== this.revision) return;
      this.THREE = THREE;
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      this.renderer = renderer;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      const canvas = renderer.domElement;
      Object.assign(canvas.style, {
        display: 'block', width: '100%', height: '100%', touchAction: 'none', outlineOffset: '-8px',
      });
      canvas.tabIndex = 0;
      canvas.setAttribute('role', 'button');
      canvas.setAttribute('aria-label', 'Bó hoa 3D. Nhấn để mở kỷ niệm; kéo để xoay, cuộn hoặc chụm hai ngón tay để thu phóng. Dùng các phím mũi tên để xoay.');
      canvas.setAttribute('aria-disabled', 'true');
      this.container.append(canvas);
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 100);
      this.raycaster = new THREE.Raycaster();
      this.pointer = new THREE.Vector2();
      this.projectionVector = new THREE.Vector3();
      this.depthVector = new THREE.Vector3();
      this.pivot = new THREE.Group();
      this.scene.add(this.pivot);
      this.scene.add(new THREE.HemisphereLight(0xfff5ea, 0x71826f, 2.2));
      const keyLight = new THREE.DirectionalLight(0xfff7ef, 2.5);
      keyLight.position.set(4, 6, 5);
      this.scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xffd9df, 1.0);
      fillLight.position.set(-4, 1, -2);
      this.scene.add(fillLight);
      this.createAtmosphere();
      this.bindCanvas(canvas);
      this.bindControls(OrbitControls);
      this.resize();
      const manager = new THREE.LoadingManager();
      manager.onProgress = (url, loaded, total) => {
        if (revision !== this.revision || this.disposed) return;
        this.onStatus?.({
          state: 'loading', message: 'Đang chuẩn bị mô hình và toàn bộ chất liệu hoa…',
          progress: Math.min(0.96, loaded / Math.max(total, 1)),
        });
      };
      const gltf = await new GLTFLoader(manager).loadAsync(this.modelUrl, (event) => {
        if (revision !== this.revision || this.disposed) return;
        const progress = event.lengthComputable && event.total > 0
          ? Math.min(0.25, event.loaded / event.total * 0.25) : undefined;
        this.onStatus?.({ state: 'loading', message: 'Đang tải bó hoa 3D…', progress });
      });
      if (this.disposed || revision !== this.revision) {
        this.disposeModel(gltf.scene);
        return;
      }
      const model = gltf.scene;
      this.model = model;
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      if (bounds.isEmpty() || !Number.isFinite(size.length()) || size.length() === 0) {
        throw new Error('Mô hình không có hình học để hiển thị.');
      }
      // Measure the actual vertices rather than the empty corners of a bounding box.
      // The supplied GLB has baked unlit textures and an existing Y-up transform.
      // Center it with a parent group; retain its hierarchy, transforms, and materials.
      const vertex = new THREE.Vector3();
      let radiusSquared = 0;
      this.hitMeshes = [];
      model.traverse((object) => {
        if (!object.isMesh) return;
        this.hitMeshes.push(object);
        object.geometry.computeBoundingBox();
        const positions = object.geometry.attributes.position;
        if (!positions) return;
        for (let index = 0; index < positions.count; index += 1) {
          vertex.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
          radiusSquared = Math.max(radiusSquared, vertex.distanceToSquared(center));
        }
      });
      if (!this.hitMeshes.length) throw new Error('Mô hình không có bó hoa để hiển thị.');
      const scale = 3.2 / Math.max(size.x, size.y, size.z);
      this.centerGroup = new THREE.Group();
      this.centerGroup.add(model);
      this.centerGroup.position.copy(center).multiplyScalar(-1);
      this.pivot.add(this.centerGroup);
      this.modelBaseScale = scale;
      this.modelBaseRadius = Math.max(Math.sqrt(radiusSquared) * scale, 0.1);
      this.memoryBlend = this.memoryMode ? 1 : 0;
      this.pivot.scale.setScalar(this.modelBaseScale);
      this.radius = this.modelBaseRadius;
      this.pivot.rotation.y = -0.22;
      this.pivot.updateMatrixWorld(true);
      this.resize();
      this.camera.updateMatrixWorld(true);
      this.updateFlowerPose();
      // Decode/download every texture, upload it, and compile shaders while the
      // envelope is visible. One hidden render warms the GPU without an RAF loop.
      this.onStatus?.({ state: 'loading', message: 'Đang hoàn thiện bó hoa…', progress: 0.98 });
      const textures = new Set();
      this.scene.traverse((object) => {
        for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
          if (!material) continue;
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        }
      });
      textures.forEach((texture) => renderer.initTexture(texture));
      await renderer.compileAsync(this.scene, this.camera);
      if (this.disposed || revision !== this.revision) return;
      this.atmosphere.visible = true;
      this.updateAtmosphere();
      renderer.render(this.scene, this.camera);
      this.atmosphere.visible = this.active;
      this.container.dataset.memoryRenderer = 'webgl';
      canvas.setAttribute('aria-disabled', 'false');
      this.status('ready', 'Bó hoa đã sẵn sàng.', 1);
      this.controls.enabled = this.interactive();
      this.resize();
      this.syncLoop();
    } catch (error) {
      if (revision !== this.revision || this.disposed) return;
      this.fail(error);
    }
  }

  bindCanvas(canvas) {
    const stage = this.interactionElement;
    this.handlePointerDown = (event) => {
      if (!this.interactive() || (this.paused && !this.memoryMode) || !event.isPrimary || event.button !== 0
        || event.target.closest?.('[data-orbit-ui], [data-orbit-card]') || !this.hit(event)) return;
      this.pointerDown = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    };
    this.handlePointerMove = (event) => {
      if (this.pointerDown?.id === event.pointerId
        && Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > 8) {
        this.pointerDown.moved = true;
      }
      if (!this.interactive() || event.pointerType === 'touch' || this.dragging) return;
      // Raycasting the textured bouquet is more expensive than changing a cursor.
      const now = performance.now();
      if (now - (this.lastHoverCheck || 0) < 70) return;
      this.lastHoverCheck = now;
      canvas.style.cursor = this.hit(event) ? 'pointer' : 'grab';
    };
    this.handlePointerUp = (event) => {
      const down = this.pointerDown;
      this.pointerDown = null;
      if (!this.interactive() || (this.paused && !this.memoryMode) || !down || down.id !== event.pointerId || down.moved) return;
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) return;
      if (this.hit(event)) this.onActivate?.();
    };
    this.handlePointerCancel = () => { this.pointerDown = null; };
    this.handlePointerLeave = () => {
      this.pointerDown = null;
      canvas.style.cursor = this.dragging ? 'grabbing' : 'grab';
    };
    this.handleKeyDown = (event) => {
      if (!this.interactive() || event.repeat
        || (event.target !== canvas && event.target !== stage)) return;
      if (event.target === canvas && ['Enter', ' '].includes(event.key) && (!this.paused || this.memoryMode)) {
        event.preventDefault();
        this.onActivate?.();
      }
      const arrows = { ArrowLeft: [-45, 0], ArrowRight: [45, 0], ArrowUp: [0, -35], ArrowDown: [0, 35] };
      if (arrows[event.key]) {
        event.preventDefault();
        this.rotateBy(...arrows[event.key]);
      }
    };
    this.handleContextLost = (event) => {
      event.preventDefault();
      if (!this.disposed) this.fail(new Error('WebGL context lost'));
    };
    stage.addEventListener('pointerdown', this.handlePointerDown, true);
    stage.addEventListener('pointermove', this.handlePointerMove, true);
    stage.addEventListener('pointerup', this.handlePointerUp, true);
    stage.addEventListener('pointercancel', this.handlePointerCancel, true);
    stage.addEventListener('pointerleave', this.handlePointerLeave);
    stage.addEventListener('keydown', this.handleKeyDown);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
  }

  bindControls(OrbitControls) {
    const stage = this.interactionElement;
    this.originalTouchAction = stage.style.touchAction;
    this.handleControlGuard = (event) => {
      if (event.target.closest?.('[data-orbit-ui], input, textarea, select, a[href]')) {
        // Let controls' click handlers and normal UI defaults work, but keep
        // their pointer/wheel gestures from reaching the OrbitControls listener.
        event.stopImmediatePropagation();
      }
    };
    stage.addEventListener('pointerdown', this.handleControlGuard, true);
    stage.addEventListener('wheel', this.handleControlGuard, { capture: true, passive: true });
    this.controls = new OrbitControls(this.camera, stage);
    this.controls.enabled = false;
    this.controls.enablePan = false;
    this.controls.enableDamping = false;
    this.controls.rotateSpeed = 0.72;
    this.controls.zoomSpeed = 0.8;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = Math.PI - 0.12;
    this.controls.touches = { ONE: this.THREE.TOUCH.ROTATE, TWO: this.THREE.TOUCH.DOLLY_ROTATE };
    this.controls.mouseButtons = { LEFT: this.THREE.MOUSE.ROTATE, MIDDLE: this.THREE.MOUSE.DOLLY, RIGHT: this.THREE.MOUSE.ROTATE };
    this.controls.target.set(0, 0, 0);
    this.handleControlChange = () => {
      if (this.fittingCamera) return;
      this.camera.updateMatrixWorld(true);
      this.renderFrame();
    };
    this.handleControlStart = () => {
      this.dragging = true;
      if (this.renderer) this.renderer.domElement.style.cursor = 'grabbing';
    };
    this.handleControlEnd = () => {
      this.dragging = false;
      if (this.renderer) this.renderer.domElement.style.cursor = 'grab';
    };
    this.controls.addEventListener('change', this.handleControlChange);
    this.controls.addEventListener('start', this.handleControlStart);
    this.controls.addEventListener('end', this.handleControlEnd);
  }

  interactive() {
    // Pausing freezes automatic movement while manual camera rotation remains usable.
    return !this.disposed && this.active && this.state === 'ready';
  }

  setMemoryMode(memoryMode) {
    if (this.disposed) return;
    const changed = this.memoryMode !== Boolean(memoryMode);
    this.memoryMode = Boolean(memoryMode);
    if (changed) {
      const target = this.memoryMode ? 1 : 0;
      if (!this.reducedMotion && this.active && this.state === 'ready') {
        this.presentationTransition = { start: this.memoryBlend, target, elapsed: 0, duration: 0.8 };
      } else {
        this.memoryBlend = target;
        this.presentationTransition = null;
      }
      this.presentationCameraDirty = true;
      this.resetCameraZoom = true;
    }
    this.updateFallbackPose();
    this.resize();
    this.emitProjection();
  }

  updateFlowerPose() {
    if (!this.pivot || !this.modelBaseScale || !this.camera) return;
    const time = this.reducedMotion ? 0 : this.elapsed;
    const blend = this.memoryBlend;
    const secondaryScale = this.viewport.width < 600 ? 0.8 : 0.84;
    const factor = 1 + (secondaryScale - 1) * blend;
    const breathing = 1 + Math.sin(time * 2.1) * 0.012 + Math.sin(time * 3.7) * 0.005;
    this.pivot.scale.setScalar(this.modelBaseScale * factor * breathing);
    this.radius = this.modelBaseRadius * factor;
    this.pivot.rotation.set(Math.sin(time * 1.1) * 0.042,
      -0.22 + Math.sin(time * 0.95) * 0.2, Math.sin(time * 0.8) * 0.028);
    const target = this.controls?.target || new this.THREE.Vector3();
    const depth = this.camera.position.distanceTo(target);
    const halfHeight = depth * Math.tan(this.THREE.MathUtils.degToRad(this.camera.fov) / 2);
    // Keep the real bouquet at the center of the composition during camera gestures.
    this.flowerAnchor ??= new this.THREE.Vector3();
    this.flowerAnchor.set(0, -0.035 * halfHeight, -depth)
      .applyMatrix4(this.camera.matrixWorld);
    this.pivot.position.copy(this.flowerAnchor).multiplyScalar(blend);
    this.pivot.position.y += Math.sin(time * 1.15) * 0.06;
    this.pivot.updateMatrixWorld(true);
    this.interactionElement.dataset.bouquetProgress = blend.toFixed(3);
    this.interactionElement.dataset.bouquetScale = factor.toFixed(3);
    this.interactionElement.dataset.bouquetPresentation = this.presentationTransition
      ? 'revealing' : this.memoryMode ? 'center' : 'waiting';
  }

  createAtmosphere() {
    const THREE = this.THREE;
    this.atmosphere = new THREE.Group();
    this.scene.add(this.atmosphere);
    let seed = 211020;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const textureFrom = (paint, size = 64) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Không tạo được chất liệu trang trí.');
      paint(context, size);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };
    const glowTexture = textureFrom((context, size) => {
      const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.13, 'rgba(255,247,250,.8)');
      gradient.addColorStop(0.45, 'rgba(255,221,240,.16)');
      gradient.addColorStop(1, 'rgba(255,221,240,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
    });
    const count = window.innerWidth < 600 ? 320 : 480;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [0xfff1dc, 0xffb6d7, 0xe9c6ff, 0xf591be].map((color) => new THREE.Color(color));
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = 2.7 + random() * 4.5;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = Math.sin(angle) * radius * 0.8;
      positions[index * 3 + 2] = (random() - 0.5) * 6;
      palette[index % palette.length].toArray(colors, index * 3);
    }
    const field = new THREE.BufferGeometry();
    field.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    field.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.ambientDust = new THREE.Points(field, new THREE.PointsMaterial({
      map: glowTexture, size: 0.09, transparent: true, opacity: 0.82,
      vertexColors: true, depthWrite: false, sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    }));
    this.atmosphere.add(this.ambientDust);
    this.centralGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: 0xe673aa, transparent: true, opacity: 0.2,
      depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    }));
    this.centralGlow.position.set(0, 0.05, -0.35);
    this.atmosphere.add(this.centralGlow);

    const petalTexture = textureFrom((context) => {
      const gradient = context.createLinearGradient(13, 9, 48, 56);
      gradient.addColorStop(0, '#fff2dc');
      gradient.addColorStop(0.4, '#ffbad7');
      gradient.addColorStop(1, '#df548d');
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(32, 7);
      context.bezierCurveTo(3, 12, 8, 52, 29, 58);
      context.bezierCurveTo(45, 46, 60, 15, 32, 7);
      context.fill();
      context.strokeStyle = 'rgba(255,242,240,.55)';
      context.lineWidth = 1.4;
      context.beginPath(); context.moveTo(31, 15); context.quadraticCurveTo(24, 34, 29, 49); context.stroke();
    });
    const petalCount = window.innerWidth < 600 ? 16 : 24;
    const petalMaterial = new THREE.MeshBasicMaterial({
      map: petalTexture, transparent: true, opacity: 0.62, depthWrite: false,
      side: THREE.DoubleSide, forceSinglePass: true,
    });
    this.petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.19, 0.3), petalMaterial, petalCount);
    this.petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.petals.frustumCulled = false;
    this.petalStates = Array.from({ length: petalCount }, () => ({
      x: (random() - 0.5) * 14, y: (random() - 0.5) * 12, z: (random() - 0.5) * 7 - 1,
      phase: random() * Math.PI * 2, speed: 0.25 + random() * 0.3, size: 0.6 + random() * 0.65,
    }));
    this.petalTransform = new THREE.Object3D();
    this.atmosphere.add(this.petals);

    // Cloud glows live beyond the world-space model and photo rings. They are
    // translucent additive textures, leaving rear DOM photographs visible.
    this.backdrop = new THREE.Group();
    this.backdrop.matrixAutoUpdate = false;
    this.atmosphere.add(this.backdrop);
    const cloudTexture = textureFrom((context, size) => {
      context.globalCompositeOperation = 'lighter';
      for (const [x, y, radius] of [[0.36, 0.51, 0.35], [0.61, 0.43, 0.34], [0.54, 0.64, 0.3]]) {
        const gradient = context.createRadialGradient(size * x, size * y, 0, size * x, size * y, size * radius);
        gradient.addColorStop(0, 'rgba(255,246,251,.32)');
        gradient.addColorStop(0.38, 'rgba(246,209,244,.17)');
        gradient.addColorStop(1, 'rgba(246,209,244,0)');
        context.fillStyle = gradient; context.fillRect(0, 0, size, size);
      }
    }, 128);
    this.clouds = [
      { x: -0.7, y: 0.57, size: 0.58, color: 0xb04b86, phase: 0 },
      { x: 0.69, y: -0.55, size: 0.6, color: 0x9a66cd, phase: 1.6 },
      { x: -0.52, y: -0.7, size: 0.52, color: 0xf486a4, phase: 3.3 },
      { x: 0.55, y: 0.72, size: 0.5, color: 0xb888db, phase: 4.9 },
    ].map((state) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTexture, color: state.color, transparent: true, opacity: 0.35,
        depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
      }));
      this.backdrop.add(sprite);
      return { ...state, sprite };
    });
    const streakGeometry = new THREE.BufferGeometry();
    this.streakPositions = new THREE.BufferAttribute(new Float32Array(18), 3).setUsage(THREE.DynamicDrawUsage);
    this.streakColors = new THREE.BufferAttribute(new Float32Array(24), 4).setUsage(THREE.DynamicDrawUsage);
    streakGeometry.setAttribute('position', this.streakPositions);
    streakGeometry.setAttribute('color', this.streakColors);
    this.streaks = new THREE.LineSegments(streakGeometry, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.streaks.frustumCulled = false;
    this.backdrop.add(this.streaks);
    delete this.interactionElement.dataset.heartCount;
  }

  updateAtmosphere() {
    if (!this.atmosphere || !this.camera) return;
    const time = this.reducedMotion ? 0 : this.elapsed;
    this.ambientDust.rotation.y = time * 0.05;
    this.ambientDust.rotation.x = Math.sin(time * 0.22) * 0.08;
    this.ambientDust.material.opacity = 0.72 + Math.sin(time * 0.65) * 0.1;
    this.centralGlow.scale.setScalar((4.4 - this.memoryBlend * 1.7) * (1 + Math.sin(time * 0.8) * 0.035));
    this.glowOffset ??= new this.THREE.Vector3();
    this.glowOffset.copy(this.camera.position).sub(this.controls?.target || this.pivot.position).normalize();
    this.centralGlow.position.copy(this.pivot.position).addScaledVector(this.glowOffset, -0.35);
    this.centralGlow.material.opacity = 0.19 + Math.sin(time * 0.8) * 0.025;
    this.petalStates.forEach((state, index) => {
      const fallingY = ((state.y - time * state.speed + 6) % 12 + 12) % 12 - 6;
      this.petalTransform.position.set(state.x + Math.sin(time * 0.75 + state.phase) * 0.35, fallingY, state.z);
      this.petalTransform.rotation.set(state.phase * 0.5, Math.sin(time * 0.8 + state.phase) * 0.9,
        state.phase + time * 0.26);
      this.petalTransform.scale.setScalar(state.size);
      this.petalTransform.updateMatrix();
      this.petals.setMatrixAt(index, this.petalTransform.matrix);
    });
    this.petals.instanceMatrix.needsUpdate = true;
    this.camera.updateMatrixWorld(true);
    this.backdrop.matrix.copy(this.camera.matrixWorld);
    const depth = this.camera.position.distanceTo(this.controls?.target || this.pivot.position) + 12;
    const halfHeight = depth * Math.tan(this.THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const halfWidth = halfHeight * this.camera.aspect;
    for (const cloud of this.clouds) {
      cloud.sprite.position.set((cloud.x + Math.sin(time * 0.15 + cloud.phase) * 0.07) * halfWidth,
        (cloud.y + Math.cos(time * 0.12 + cloud.phase) * 0.055) * halfHeight, -depth);
      cloud.sprite.scale.set(halfWidth * cloud.size * 2, halfHeight * cloud.size * 1.5, 1);
      cloud.sprite.material.opacity = 0.29 + Math.sin(time * 0.25 + cloud.phase) * 0.055;
    }
    for (let index = 0; index < 3; index += 1) {
      const phase = (time + index * 4.7) % (10.5 + index * 2.3);
      const progress = phase / 1.3;
      const opacity = !this.reducedMotion && progress <= 1 ? Math.sin(progress * Math.PI) * 0.75 : 0;
      const headX = (-0.86 + Math.min(progress, 1) * 1.4 + index * 0.16) * halfWidth;
      const headY = (0.79 - Math.min(progress, 1) * 0.8 - index * 0.23) * halfHeight;
      this.streakPositions.setXYZ(index * 2, headX - halfWidth * 0.16, headY + halfHeight * 0.07, -depth + 1);
      this.streakPositions.setXYZ(index * 2 + 1, headX, headY, -depth + 1);
      this.streakColors.setXYZW(index * 2, 1, 0.45, 0.75, 0);
      this.streakColors.setXYZW(index * 2 + 1, 1, 0.9, 0.95, opacity);
    }
    this.streakPositions.needsUpdate = this.streakColors.needsUpdate = true;
    this.backdrop.updateMatrixWorld(true);
  }

  rotateBy(dx, dy) {
    if (!this.interactive() || !this.controls || !this.camera) return;
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new this.THREE.Spherical().setFromVector3(offset);
    spherical.theta -= Number(dx || 0) * 0.006;
    spherical.phi = this.THREE.MathUtils.clamp(spherical.phi - Number(dy || 0) * 0.006,
      this.controls.minPolarAngle, this.controls.maxPolarAngle);
    this.camera.position.copy(this.controls.target).add(offset.setFromSpherical(spherical));
    this.controls.update();
  }

  projectPoint({ x = 0, y = 0, z = 0 }) {
    const { width, height } = this.viewport;
    if (!this.camera || !this.THREE) {
      // The memories also remain reachable through the illustrated error fallback.
      const unit = Math.min(width, height) / 11.5;
      return { x: width / 2 + x * unit, y: height / 2 - y * unit, depth: 20 - z,
        scale: 1 + z * 0.025, visible: true };
    }
    this.camera.updateMatrixWorld(true);
    const projected = this.projectionVector.set(x, y, z).project(this.camera);
    const depth = -this.depthVector.set(x, y, z).applyMatrix4(this.camera.matrixWorldInverse).z;
    return {
      x: (projected.x * 0.5 + 0.5) * width,
      y: (-projected.y * 0.5 + 0.5) * height,
      depth,
      scale: this.THREE.MathUtils.clamp((this.projectionDistance || this.baseDistance || 1) / Math.max(depth, 0.01), 0.35, 2.2),
      visible: depth > 0 && projected.z >= -1 && projected.z <= 1,
    };
  }

  pointFromViewport(x, y, depthFactor = 1) {
    const { width, height } = this.viewport;
    if (!this.camera || !this.THREE) {
      const unit = Math.min(width, height) / 11.5;
      return { x: (x - 0.5) * width / unit, y: (0.5 - y) * height / unit, z: (1 - depthFactor) * 8 };
    }
    this.camera.updateMatrixWorld(true);
    const distance = (this.baseDistance || this.camera.position.length()) * depthFactor;
    const halfHeight = distance * Math.tan(this.THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const point = new this.THREE.Vector3((x - 0.5) * 2 * halfHeight * this.camera.aspect,
      (0.5 - y) * 2 * halfHeight, -distance).applyMatrix4(this.camera.matrixWorld);
    return { x: point.x, y: point.y, z: point.z };
  }

  subscribeProjection(callback) {
    if (typeof callback !== 'function') return () => {};
    this.projectionListeners.add(callback);
    if (this.state === 'ready') callback();
    return () => this.projectionListeners.delete(callback);
  }

  emitProjection() {
    if (this.controls) {
      const stage = this.interactionElement;
      stage.dataset.orbitAzimuth = this.controls.getAzimuthalAngle().toFixed(5);
      stage.dataset.orbitPolar = this.controls.getPolarAngle().toFixed(5);
      stage.dataset.orbitDistance = this.controls.getDistance().toFixed(5);
    }
    for (const callback of this.projectionListeners) {
      try { callback(); }
      catch (error) { console.warn('Không cập nhật được vị trí kỷ niệm:', error); }
    }
  }

  hit(event) {
    if (!this.renderer || !this.hitMeshes?.length) return false;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.pivot.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(this.hitMeshes, false).length > 0;
  }

  resize() {
    if (this.disposed) return;
    const rect = this.container.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : this.viewport.width;
    const height = rect.height > 0 ? rect.height : this.viewport.height;
    this.viewport = { width, height };
    if (!this.renderer || !this.camera) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.fitCamera();
    this.camera.updateProjectionMatrix();
    this.emitProjection();
    this.syncLoop();
  }

  fitCamera() {
    if (!this.camera || !this.modelBaseRadius) return;
    {
      const verticalFov = this.THREE.MathUtils.degToRad(this.camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect);
      const room = this.camera.aspect < 0.85 ? 1.07 : 1.16;
      const frameRadius = this.modelBaseRadius * (1 + (room - 1) * this.memoryBlend);
      const distance = frameRadius / Math.sin(Math.min(verticalFov, horizontalFov) / 2) * 1.06;
      const target = this.controls?.target || new this.THREE.Vector3();
      const previousDistance = this.camera.position.distanceTo(target);
      const zoom = this.baseDistance && !this.resetCameraZoom ? previousDistance / this.baseDistance : 1;
      const direction = this.baseDistance
        ? this.camera.position.clone().sub(target).normalize() : new this.THREE.Vector3(0, 0.09, 1).normalize();
      this.baseDistance = distance;
      this.projectionDistance = distance;
      this.camera.position.copy(target).addScaledVector(direction, distance * zoom);
      this.camera.lookAt(target);
      this.camera.near = 0.05;
      this.camera.far = Math.max(150, distance * 2.5 + 12);
      if (this.controls) {
        this.controls.minDistance = distance * 0.65;
        this.controls.maxDistance = distance * 1.65;
        this.fittingCamera = true;
        try { this.controls.update(); }
        finally { this.fittingCamera = false; }
      }
      this.resetCameraZoom = false;
    }
    this.camera.updateProjectionMatrix();
    this.presentationCameraDirty = false;
  }

  canRender() {
    return this.interactive() && !document.hidden && this.inViewport
      && this.container.clientWidth > 0 && this.container.clientHeight > 0;
  }

  syncLoop() {
    this.interactionElement.dataset.backgroundMotion = !this.active || document.hidden || !this.inViewport
      ? 'hidden' : this.reducedMotion ? 'reduced' : this.paused ? 'paused' : this.state === 'ready' ? 'running' : 'loading';
    if (!this.canRender() || this.reducedMotion || this.paused) this.stopLoop();
    if (!this.canRender()) return;
    if (this.reducedMotion || this.paused) {
      this.renderFrame();
    } else if (this.frameId == null) {
      this.renderFrame();
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  renderFrame() {
    if (this.presentationCameraDirty) this.fitCamera();
    if (this.camera) this.camera.updateMatrixWorld(true);
    this.updateFlowerPose();
    this.updateAtmosphere();
    this.inProjectionRender = true;
    this.emitProjection();
    this.inProjectionRender = false;
    if (this.canRender()) this.renderer.render(this.scene, this.camera);
  }

  tick(timestamp) {
    this.frameId = null;
    if (!this.canRender() || this.reducedMotion || this.paused) { this.previousFrame = 0; return; }
    const fps = navigator.hardwareConcurrency <= 4 ? 30 : 60;
    if (timestamp - this.lastRender >= 1000 / fps - 1) {
      // Poses are functions of time, so low frame rates must not slow the animation.
      // Visibility and pause reset previousFrame before this clock resumes.
      const delta = this.previousFrame ? Math.max((timestamp - this.previousFrame) / 1000, 0) : 0;
      this.elapsed += delta;
      this.previousFrame = timestamp;
      this.lastRender = timestamp;
      if (this.presentationTransition) {
        const transition = this.presentationTransition;
        transition.elapsed += delta;
        const progress = Math.min(transition.elapsed / transition.duration, 1);
        const eased = 0.5 - Math.cos(progress * Math.PI) * 0.5;
        this.memoryBlend = transition.start + (transition.target - transition.start) * eased;
        this.presentationCameraDirty = true;
        if (progress === 1) this.presentationTransition = null;
      }
      this.interactionElement.dataset.backgroundPhase = this.elapsed.toFixed(3);
      this.renderFrame();
    }
    this.frameId = requestAnimationFrame(this.tick);
  }

  stopLoop() {
    if (this.frameId != null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.previousFrame = 0;
    this.lastRender = 0;
  }

  fail(error) {
    ++this.revision;
    this.releaseResources();
    this.showFallback();
    this.status('error', 'Chưa thể hiển thị mô hình 3D. Bạn vẫn có thể nhấn bó hoa minh họa để mở kỷ niệm.');
    // Preserve the underlying cause for local troubleshooting without exposing it in the gift.
    console.warn('Không tải được bó hoa 3D:', error);
  }

  showFallback() {
    this.fallbackButton?.remove();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bouquet-fallback';
    button.setAttribute('aria-label', 'Bó hoa minh họa dự phòng. Mở những kỷ niệm.');
    Object.assign(button.style, {
      position: 'absolute', inset: '0', margin: 'auto', width: 'min(88%, 24rem)',
      height: '90%', padding: '0', border: '0', background: 'transparent',
      color: 'inherit', cursor: 'pointer', font: 'inherit', borderRadius: '24px',
    });
    const illustration = document.createElement('img');
    illustration.src = this.fallbackUrl;
    illustration.alt = 'Bó hoa minh họa';
    illustration.draggable = false;
    Object.assign(illustration.style, { width: '100%', height: '100%', objectFit: 'contain' });
    button.append(illustration);
    button.addEventListener('click', () => {
      if (this.active && (!this.paused || this.memoryMode) && !this.disposed) this.onActivate?.();
    });
    this.fallbackButton = button;
    this.container.append(button);
    this.updateFallbackPose();
  }

  updateFallbackPose() {
    if (!this.fallbackButton) return;
    this.resize();
    this.interactionElement.dataset.bouquetProgress = this.memoryMode ? '1.000' : '0.000';
    this.interactionElement.dataset.bouquetScale = this.memoryMode ? '0.800' : '1.000';
    this.interactionElement.dataset.bouquetPresentation = this.memoryMode ? 'center' : 'waiting';
    Object.assign(this.fallbackButton.style, this.memoryMode ? {
      inset: '0', margin: 'auto', width: 'min(60%,32rem)',
      height: '72%', transform: 'none',
    } : {
      inset: '0', margin: 'auto', width: 'min(88%,24rem)', height: '90%', transform: 'none',
    });
  }

  retry() {
    if (this.disposed) return;
    ++this.revision;
    this.releaseResources();
    this.fallbackButton?.remove();
    this.fallbackButton = null;
    this.state = 'idle';
    if (this.active || this.preloadRequested) this.preload();
  }

  disposeModel(model) {
    if (!model) return;
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    model.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    textures.forEach((texture) => { texture.dispose(); texture.source?.data?.close?.(); });
    materials.forEach((material) => material.dispose());
  }

  releaseResources() {
    this.stopLoop();
    const canvas = this.renderer?.domElement;
    const stage = this.interactionElement;
    if (canvas) {
      canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    }
    stage.removeEventListener('pointerdown', this.handlePointerDown, true);
    stage.removeEventListener('pointermove', this.handlePointerMove, true);
    stage.removeEventListener('pointerup', this.handlePointerUp, true);
    stage.removeEventListener('pointercancel', this.handlePointerCancel, true);
    stage.removeEventListener('pointerleave', this.handlePointerLeave);
    stage.removeEventListener('keydown', this.handleKeyDown);
    stage.removeEventListener('pointerdown', this.handleControlGuard, true);
    stage.removeEventListener('wheel', this.handleControlGuard, true);
    this.controls?.dispose();
    if (this.originalTouchAction != null) stage.style.touchAction = this.originalTouchAction;
    this.controls = null;
    this.disposeModel(this.model);
    this.disposeModel(this.atmosphere);
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    canvas?.remove();
    this.renderer = null;
    this.model = null;
    this.scene = null;
    this.atmosphere = null;
    this.ambientDust = null;
    this.centralGlow = null;
    this.petals = null;
    this.petalStates = null;
    this.petalTransform = null;
    this.backdrop = null;
    this.clouds = null;
    this.streaks = null;
    this.streakPositions = null;
    this.streakColors = null;
    this.interactionElement.dataset.backgroundMotion = 'hidden';
    delete this.interactionElement.dataset.heartCount;
    this.container.dataset.memoryRenderer = 'fallback';
    this.camera = null;
    this.pivot = null;
    this.centerGroup = null;
    this.hitMeshes = [];
    this.pointerDown = null;
    this.radius = null;
    this.modelBaseScale = null;
    this.modelBaseRadius = null;
    this.flowerAnchor = null;
    this.glowOffset = null;
    this.presentationTransition = null;
    this.memoryBlend = this.memoryMode ? 1 : 0;
    this.presentationCameraDirty = false;
    this.fittingCamera = false;
    this.baseDistance = null;
    this.projectionDistance = null;
    this.dragging = false;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    ++this.revision;
    document.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('resize', this.handleResize);
    this.motionPreference.removeEventListener?.('change', this.handleMotionChange);
    this.resizeObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    this.releaseResources();
    this.fallbackButton?.remove();
    this.fallbackButton = null;
    this.projectionListeners.clear();
  }
}
