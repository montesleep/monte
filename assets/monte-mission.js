class MonteMission extends HTMLElement {
  connectedCallback() {
    this.disconnectedCallback();
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.breakpoint = matchMedia('(min-width: 1000px)');
    this.layers = [...this.querySelectorAll('.monte-mission__item, .monte-mission__mobile-item')];
    this.frame = null;
    this.current = null;
    this.lastTime = null;
    this.visible = false;
    this.schedule = () => {
      if (this.frame === null && this.visible && !this.reduced.matches && !window.Shopify?.designMode) {
        this.frame = requestAnimationFrame(time => this.renderParallax(time));
      }
    };
    this.resetMotion = () => {
      cancelAnimationFrame(this.frame);
      this.frame = null;
      this.current = null;
      this.lastTime = null;
      this.layers.forEach(layer => layer.style.removeProperty('--mm-parallax'));
      if (this.reduced.matches) this.setAttribute('data-revealed', '');
      this.schedule();
    };
    addEventListener('scroll', this.schedule, { passive: true, signal });
    addEventListener('resize', this.resetMotion, { passive: true, signal });
    this.reduced.addEventListener('change', this.resetMotion, { signal });
    this.visibilityObserver = new IntersectionObserver(entries => {
      this.visible = entries[0].isIntersecting;
      if (this.visible) this.schedule();
    }, { rootMargin: '200px' });
    this.visibilityObserver.observe(this);
    if (this.hasAttribute('data-revealed') || this.reduced.matches || window.Shopify?.designMode) {
      this.setAttribute('data-revealed', '');
      return;
    }
    // The rotation belongs to the outer wrapper; only its media slides in.
    this.setAttribute('data-animate', '');
    this.observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      this.setAttribute('data-revealed', '');
      this.observer.disconnect();
    }, { threshold: .15 });
    this.onBreakpointChange = () => this.observeVisibleLayout();
    this.breakpoint.addEventListener('change', this.onBreakpointChange, { signal });
    this.observeVisibleLayout();
  }
  renderParallax(time) {
    this.frame = null;
    if (!this.isConnected || !this.visible || this.reduced.matches || window.Shopify?.designMode) return;
    const desktop = this.breakpoint.matches;
    const stage = desktop ? this : this.querySelector('.monte-mission__mobile');
    const rect = (stage || this).getBoundingClientRect();
    const target = Math.max(-1, Math.min(1, (innerHeight / 2 - rect.top - rect.height / 2) / ((innerHeight + rect.height) / 2)));
    const delta = this.lastTime === null ? 16 : Math.min(64, time - this.lastTime);
    this.lastTime = time;
    this.current = this.current === null ? target : this.current + (target - this.current) * (1 - Math.exp(-delta / 100));
    const speeds = desktop ? [100, 150, 40, 200, 100, 150] : [100, 200, 150];
    const layers = this.layers.filter(layer => layer.classList.contains(desktop ? 'monte-mission__item' : 'monte-mission__mobile-item'));
    layers.forEach((layer, index) => {
      const offset = -this.current * speeds[index] * (desktop ? 1 : .25);
      layer.style.setProperty('--mm-parallax', offset.toFixed(2) + 'px');
    });
    if (Math.abs(target - this.current) > .0001) this.schedule();
  }
  observeVisibleLayout() {
    this.observer.disconnect();
    if (this.hasAttribute('data-revealed')) return;
    const target = this.breakpoint.matches ? this : this.querySelector('.monte-mission__mobile');
    this.observer.observe(target || this);
  }
  disconnectedCallback() {
    this.controller?.abort();
    cancelAnimationFrame(this.frame);
    this.visibilityObserver?.disconnect();
    this.observer?.disconnect();
    if (this.onBreakpointChange) this.breakpoint?.removeEventListener('change', this.onBreakpointChange);
  }
}
if (!customElements.get('monte-mission')) customElements.define('monte-mission', MonteMission);

