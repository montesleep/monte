// Recycle slides after each transition: no visible rewind and only one playing video.
class MonteUgcCarousel extends HTMLElement {
  connectedCallback() {
    if (this.abort) return;
    this.abort = new AbortController();
    const options = { signal: this.abort.signal };
    this.viewport = this.querySelector('.mugc-viewport');
    this.track = this.querySelector('.mugc-track');
    this.originals = [...this.track.children];
    if (!this.originals.length) return;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.visible = false;
    this.paused = false;
    this.sound = false;
    this.editorSelected = false;
    this.addEventListener('click', event => this.onClick(event), { ...options, capture: true });
    // Media events do not bubble; capture also covers recycled slide copies.
    this.addEventListener('ended', event => this.advanceEndedVideo(event.target), { ...options, capture: true });
    this.viewport.addEventListener('pointerdown', event => this.pointerDown(event), options);
    document.addEventListener('pointermove', event => this.pointerMove(event), { ...options, passive: false });
    document.addEventListener('pointerup', event => this.pointerEnd(event), options);
    document.addEventListener('pointercancel', event => this.pointerEnd(event, true), options);
    this.viewport.addEventListener('dragstart', event => event.preventDefault(), options);
    this.viewport.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      this.move(event.key === 'ArrowRight' ? 1 : -1, true);
    }, options);
    this.viewport.addEventListener('wheel', event => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 4) return;
      event.preventDefault();
      if (Date.now() < (this.wheelUntil || 0)) return;
      this.wheelUntil = Date.now() + 650;
      this.move(event.deltaX > 0 ? 1 : -1, true);
    }, { ...options, passive: false });
    this.addEventListener('focusin', () => this.schedule(), options);
    this.addEventListener('focusout', () => queueMicrotask(() => this.schedule()), options);
    document.addEventListener('visibilitychange', () => { this.playActive(); this.schedule(); }, options);
    this.reduced.addEventListener('change', () => { this.playActive(); this.schedule(); }, options);
    document.addEventListener('shopify:block:select', event => {
      const slide = this.originals.find(item => item.dataset.ugcId === event.detail.blockId);
      if (!slide) return;
      this.editorSelected = true;
      this.setup(slide.dataset.ugcId);
    }, options);
    document.addEventListener('shopify:block:deselect', () => {
      this.editorSelected = false;
      this.schedule();
    }, options);
    this.resize = new ResizeObserver(() => {
      const width = this.viewport.clientWidth;
      if (width === this.width) return;
      this.width = width;
      this.setup(this.active?.dataset.ugcId);
    });
    this.resize.observe(this.viewport);
    this.observer = new IntersectionObserver(entries => {
      this.visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .25;
      this.playActive();
      this.schedule();
    }, { threshold: [0, .25] });
    this.observer.observe(this.viewport);
    this.setup();
  }

  disconnectedCallback() {
    this.abort?.abort();
    this.abort = null;
    this.resize?.disconnect();
    this.observer?.disconnect();
    clearTimeout(this.timer);
    clearTimeout(this.transitionTimer);
    this.querySelectorAll('video').forEach(video => video.pause());
    this.track?.replaceChildren(...(this.originals || []));
    this.classList.remove('is-ready');
  }

  setup(id = this.originals[0].dataset.ugcId) {
    const playback = this.active ? { paused: this.paused, sound: this.sound, manual: this.manualPlay,
      time: this.active.querySelector('video')?.currentTime || 0 } : null;
    clearTimeout(this.timer);
    clearTimeout(this.transitionTimer);
    this.moving = false;
    this.pointer = null;
    this.classList.remove('is-dragging');
    this.querySelectorAll('video').forEach(video => { video.pause(); video.muted = true; });
    const style = getComputedStyle(this);
    this.step = parseFloat(style.getPropertyValue('--ugc-width')) + parseFloat(style.getPropertyValue('--ugc-gap'));
    const count = this.originals.length;
    // Extra copies fill both edges even when the merchant has only two videos.
    const minimum = Math.ceil(this.viewport.clientWidth / this.step) + 6;
    const needed = count === 1 ? 1 : Math.max(count, Math.ceil(minimum / count) * count);
    this.center = Math.floor(needed / 2);
    const selected = Math.max(0, this.originals.findIndex(slide => slide.dataset.ugcId === id));
    const used = new Set();
    const slides = Array.from({ length: needed }, (_, index) => {
      const original = this.originals[((selected + index - this.center) % count + count) % count];
      const slide = used.has(original) ? original.cloneNode(true) : original;
      if (slide !== original) {
        slide.dataset.ugcClone = '';
        slide.removeAttribute('data-shopify-editor-block');
        slide.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
      }
      used.add(original);
      slide.classList.remove('is-active');
      slide.querySelector('[data-ugc-action="media"]').disabled = false;
      return slide;
    });
    this.track.replaceChildren(...slides);
    this.classList.add('is-ready');
    this.querySelector('.mugc-navigation').hidden = count < 2;
    this.track.style.transition = 'none';
    this.position();
    this.activate(slides[this.center]);
    if (playback) {
      this.paused = playback.paused;
      this.sound = playback.sound;
      this.manualPlay = playback.manual;
      const video = this.active.querySelector('video');
      if (video && playback.time > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(playback.time, video.duration);
      this.controls();
      this.playActive();
    }
    this.updateAccess();
    this.schedule();
  }

  position(offset = 0) {
    const width = parseFloat(getComputedStyle(this).getPropertyValue('--ugc-width'));
    this.track.style.transform = `translate3d(${(this.viewport.clientWidth - width) / 2 - this.center * this.step + offset}px,0,0)`;
  }

  updateAccess() {
    const width = this.step - parseFloat(getComputedStyle(this).getPropertyValue('--ugc-gap'));
    [...this.track.children].forEach((slide, index) => {
      const left = (this.viewport.clientWidth - width) / 2 + (index - this.center) * this.step;
      slide.inert = left + width <= 0 || left >= this.viewport.clientWidth;
    });
  }

  activate(slide) {
    this.active = slide;
    this.paused = this.reduced.matches;
    this.sound = false;
    this.manualPlay = false;
    for (const item of this.track.children) {
      const active = item === slide;
      item.classList.toggle('is-active', active);
      item.toggleAttribute('data-ugc-active', active);
      const controls = item.querySelector('.mugc-controls');
      if (controls) controls.hidden = !active;
      const video = item.querySelector('video');
      if (video) {
        video.muted = true;
        video.loop = true;
        if (!active) video.pause();
        else if (video.readyState > 0) video.currentTime = 0;
      }
      item.querySelector('[data-ugc-action="media"]').setAttribute('aria-label', active ? 'Zatrzymaj automatyczne odtwarzanie' : 'Pokaż ten film');
    }
    this.controls();
    this.playActive();
  }

  controls() {
    const slide = this.active;
    if (!slide) return;
    slide.querySelectorAll('[data-muted]').forEach(el => el.hidden = this.sound);
    slide.querySelectorAll('[data-sound]').forEach(el => el.hidden = !this.sound);
    slide.querySelectorAll('[data-pause]').forEach(el => el.hidden = this.paused);
    slide.querySelectorAll('[data-play]').forEach(el => el.hidden = !this.paused);
    const play = slide.querySelector('[data-ugc-action="play"]');
    const sound = slide.querySelector('[data-ugc-action="sound"]');
    play?.setAttribute('aria-label', this.paused ? 'Odtwórz film' : 'Zatrzymaj film');
    play?.setAttribute('aria-pressed', String(this.paused));
    sound?.setAttribute('aria-label', this.sound ? 'Wyłącz dźwięk' : 'Włącz dźwięk');
    sound?.setAttribute('aria-pressed', String(this.sound));
    slide.querySelector('[data-ugc-action="media"]').setAttribute('aria-label', this.paused ? 'Wznów odtwarzanie' : 'Zatrzymaj automatyczne odtwarzanie');
  }

  playActive() {
    if (!this.active) return;
    const video = this.active.querySelector('video');
    if (!video) return;
    video.loop = !this.sound;
    video.muted = !this.sound;
    if (this.advanceEndedVideo(video)) return;
    if (!this.visible || document.hidden || this.paused || (this.reduced.matches && !this.manualPlay)) {
      video.pause();
      return;
    }
    video.muted = !this.sound;
    if (!video.paused || this.pendingVideo === video) return;
    this.pendingVideo = video;
    video.play().then(() => {
      if (video !== this.active?.querySelector('video') || !this.visible || document.hidden || this.paused) video.pause();
    }).catch(() => {
      if (video !== this.active?.querySelector('video')) return;
      this.paused = true;
      this.controls();
      this.schedule();
    }).finally(() => { if (this.pendingVideo === video) this.pendingVideo = null; });
  }

  schedule(reset = true) {
    clearTimeout(this.timer);
    if (this.advanceEndedVideo(this.active?.querySelector('video'))) return;
    if (reset) this.deadline = Date.now() + 5000;
    const focused = this.contains(document.activeElement) && document.activeElement.matches(':focus-visible');
    if (!this.isConnected || !this.visible || document.hidden || this.paused || this.sound || this.pointer ||
        this.moving || this.editorSelected || this.reduced.matches || focused || this.originals.length < 2) return;
    this.timer = setTimeout(() => this.move(1), Math.max(0, this.deadline - Date.now()));
  }

  move(delta, manual = false) {
    if (this.moving || this.originals.length < 2) return;
    delta = Math.max(-this.center, Math.min(this.track.children.length - this.center - 1, delta));
    if (!delta) return;
    clearTimeout(this.timer);
    this.moving = true;
    this.moveDelta = delta;
    this.moveManual = manual;
    this.deadline = Date.now() + 5000;
    const duration = this.reduced.matches ? 0 : 550;
    this.track.style.transition = `transform ${duration}ms cubic-bezier(.25,.46,.45,.94)`;
    this.activate(this.track.children[this.center + delta]);
    this.position(-delta * this.step);
    this.transitionTimer = setTimeout(() => this.finishMove(), duration);
  }

  finishMove() {
    if (!this.moving) return;
    clearTimeout(this.transitionTimer);
    this.track.style.transition = 'none';
    for (let i = 0; i < Math.abs(this.moveDelta); i++) {
      if (this.moveDelta > 0) this.track.append(this.track.firstElementChild);
      else this.track.prepend(this.track.lastElementChild);
    }
    this.position();
    this.updateAccess();
    this.moving = false;
    if (this.moveManual) {
      const index = this.originals.findIndex(slide => slide.dataset.ugcId === this.active.dataset.ugcId);
      this.querySelector('[data-ugc-status]').textContent = `Film ${index + 1} z ${this.originals.length}`;
    }
    this.schedule(false);
  }

  advanceEndedVideo(video) {
    if (!video?.ended || video !== this.active?.querySelector('video') || !this.sound || this.paused ||
        this.moving || this.pointer || !this.visible || document.hidden || this.editorSelected) return false;
    if (this.originals.length > 1) this.move(1);
    else { this.paused = true; this.controls(); }
    return true;
  }

  onClick(event) {
    if (Date.now() < (this.suppressClickUntil || 0)) { event.preventDefault(); event.stopPropagation(); return; }
    const arrow = event.target.closest('[data-ugc-step]');
    if (arrow) { this.move(Number(arrow.dataset.ugcStep), true); return; }
    const button = event.target.closest('[data-ugc-action]');
    if (!button || this.moving) return;
    const slide = button.closest('.mugc-slide');
    if (slide !== this.active) {
      this.move([...this.track.children].indexOf(slide) - this.center, true);
      return;
    }
    if (button.dataset.ugcAction === 'sound') {
      this.sound = !this.sound;
      if (this.sound) { this.paused = false; this.manualPlay = true; }
    } else {
      this.paused = !this.paused;
      this.manualPlay = !this.paused;
    }
    this.controls();
    this.playActive();
    this.schedule();
  }

  pointerDown(event) {
    if (event.button !== 0 || event.isPrimary === false || this.pointer || this.originals.length < 2) return;
    clearTimeout(this.timer);
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0,
      lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, dragging: false, offset: 0 };
  }

  pointerMove(event) {
    const pointer = this.pointer;
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (!pointer.dragging) {
      // Wait for clear intent instead of rejecting a slightly diagonal swipe.
      if (Math.abs(dy) > Math.abs(dx) * 1.25 && Math.abs(dy) > 10) {
        this.pointer = null;
        this.schedule();
        return;
      }
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
      pointer.dragging = true;
      if (this.moving) {
        // Settle the recycled order without jumping the slide under the finger.
        const before = this.active.getBoundingClientRect().left;
        this.finishMove();
        pointer.offset = before - this.active.getBoundingClientRect().left;
      }
      this.viewport.setPointerCapture(event.pointerId);
      this.classList.add('is-dragging');
      this.track.style.transition = 'none';
    }
    if (event.cancelable) event.preventDefault();
    const elapsed = event.timeStamp - pointer.lastTime;
    if (elapsed > 0) pointer.velocity = (event.clientX - pointer.lastX) / elapsed;
    pointer.lastX = event.clientX;
    pointer.lastTime = event.timeStamp;
    pointer.dx = Math.max(-this.step, Math.min(this.step, dx));
    this.position(pointer.offset + pointer.dx);
  }

  pointerEnd(event, cancelled = false) {
    const pointer = this.pointer;
    if (!pointer || event.pointerId !== pointer.id) return;
    this.pointer = null;
    this.classList.remove('is-dragging');
    if (this.viewport.hasPointerCapture(event.pointerId)) this.viewport.releasePointerCapture(event.pointerId);
    if (!pointer.dragging) { this.schedule(); return; }
    this.suppressClickUntil = Date.now() + 350;
    const flick = Math.abs(pointer.dx) >= 12 && Math.abs(pointer.velocity) >= .35 &&
      event.timeStamp - pointer.lastTime < 100;
    if (!cancelled && (Math.abs(pointer.dx) >= 24 || flick)) this.move(pointer.dx < 0 ? 1 : -1, true);
    else {
      this.track.style.transition = 'transform 350ms cubic-bezier(.25,.46,.45,.94)';
      this.position();
      this.schedule();
    }
  }
}
if (!customElements.get('monte-ugc-carousel')) customElements.define('monte-ugc-carousel', MonteUgcCarousel);
