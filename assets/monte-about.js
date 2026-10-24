class MonteSleepStory extends HTMLElement {
  connectedCallback() {
    this.disconnectedCallback();
    this.frame = null;
    this.lastTime = null;
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.stage = this.querySelector('.monte-sleep-story__stage');
    this.layers = [...this.querySelectorAll('[data-parallax-speed]')];
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.mobile = matchMedia('(max-width: 999px)');
    this.frames = new Set();
    this.visible = false;
    this.current = null;
    this.schedule = () => {
      if (!this.frame && this.visible && !this.reduced.matches && !window.Shopify?.designMode) this.frame = requestAnimationFrame(time => this.renderParallax(time));
    };
    this.resetMotion = () => {
      cancelAnimationFrame(this.frame);
      this.frame = null;
      this.current = null;
      this.layers.forEach(layer => layer.style.removeProperty('transform'));
      this.schedule();
    };
    addEventListener('scroll', this.schedule, { passive: true, signal });
    addEventListener('resize', this.resetMotion, { passive: true, signal });
    this.reduced.addEventListener('change', this.resetMotion, { signal });
    this.visibilityObserver = new IntersectionObserver(entries => {
      this.visible = entries[0].isIntersecting;
      if (this.visible) this.schedule();
    }, { rootMargin: '200px' });
    this.visibilityObserver.observe(this.stage);
    this.countObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        this.countObserver.unobserve(entry.target);
        this.count(entry.target);
      });
    }, { threshold: .25 });
    this.querySelectorAll('[data-count-value]').forEach(value => {
      if (this.reduced.matches || window.Shopify?.designMode) return;
      this.countObserver.observe(value);
    });
  }

  renderParallax(time) {
    this.frame = null;
    if (!this.isConnected || !this.visible || this.reduced.matches) return;
    const rect = this.stage.getBoundingClientRect();
    const target = Math.max(-1, Math.min(1, (innerHeight / 2 - rect.top - rect.height / 2) / ((innerHeight + rect.height) / 2)));
    const delta = this.lastTime ? Math.min(64, time - this.lastTime) : 16;
    this.lastTime = time;
    this.current = this.current === null ? target : this.current + (target - this.current) * (1 - Math.exp(-delta / 100));
    const strength = Number(this.dataset.strength) || 0;
    this.layers.forEach(layer => {
      const offset = this.current * Number(layer.dataset.parallaxSpeed) * strength * (this.mobile.matches ? .25 : 1);
      layer.style.transform = 'translate3d(0,' + (-offset).toFixed(2) + 'px,0)';
    });
    if (Math.abs(target - this.current) > .0001) this.schedule();
  }

  count(element) {
    if (element.dataset.counted) return;
    element.dataset.counted = 'true';
    const original = element.dataset.countValue;
    if (!/\d/.test(original)) return;
    const start = performance.now();
    const tick = time => {
      const progress = this.reduced.matches ? 1 : Math.min(1, (time - start) / 1400);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = progress === 1 ? original : original.replace(/\d+(?:[.,]\d+)?/g, value => {
        const decimals = value.includes(',') ? value.split(',')[1].length : value.includes('.') ? value.split('.')[1].length : 0;
        const result = (Math.floor(Number(value.replace(',', '.')) * eased * Math.pow(10, decimals)) / Math.pow(10, decimals)).toFixed(decimals);
        return value.includes(',') ? result.replace('.', ',') : result;
      });
      if (progress < 1 && this.isConnected) {
        const frame = requestAnimationFrame(time => { this.frames.delete(frame); tick(time); });
        this.frames.add(frame);
      }
    };
    tick(start);
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.visibilityObserver?.disconnect();
    this.countObserver?.disconnect();
    cancelAnimationFrame(this.frame);
    this.frames?.forEach(frame => cancelAnimationFrame(frame));
  }
}
if (!customElements.get('monte-sleep-story')) customElements.define('monte-sleep-story', MonteSleepStory);
