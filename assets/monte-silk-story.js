// Native scrolling drives the story; no wheel or touch events are intercepted.
class MonteSilkStory extends HTMLElement {
  connectedCallback() {
    this.disconnectedCallback();
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.stage = this.querySelector('.monte-silk-story__stage');
    this.rows = this.querySelector('.monte-silk-story__rows');
    this.cards = [...this.rows.children];
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.current = null;
    this.frame = null;
    this.schedule = () => {
      if (this.enabled && !this.frame) this.frame = requestAnimationFrame(time => this.render(time));
    };
    this.refresh = () => this.measure();
    addEventListener('scroll', this.schedule, { passive: true, signal });
    addEventListener('resize', this.refresh, { passive: true, signal });
    addEventListener('pageshow', this.refresh, { signal });
    this.reduced.addEventListener('change', this.refresh, { signal });
    this.resizeObserver = new ResizeObserver(this.refresh);
    this.cards.forEach(card => this.resizeObserver.observe(card));
    this.measure();
    document.fonts.ready.then(() => { if (this.isConnected && !signal.aborted) this.measure(); });
  }

  measure() {
    cancelAnimationFrame(this.frame);
    this.frame = null;
    this.lastTime = null;
    this.current = null;
    this.enabled = this.dataset.scrollStory !== 'false' && this.cards.length > 1 && !this.reduced.matches && !window.Shopify?.designMode;
    this.classList.toggle('is-scroll-story', this.enabled);
    if (this.enabled) {
      const style = getComputedStyle(this.stage);
      this.top = parseFloat(style.top) || 0;
      this.stageHeight = this.stage.clientHeight;
      const heading = this.querySelector('.monte-silk-story__heading');
      const headingHeight = heading ? heading.offsetHeight + parseFloat(getComputedStyle(heading).marginBottom) : 0;
      const needed = headingHeight + this.rows.offsetHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      // Long merchant content must remain readable, even on short landscape screens.
      if (needed > this.stageHeight + 1) {
        this.enabled = false;
        this.classList.remove('is-scroll-story');
      }
    }
    if (!this.enabled) {
      this.style.removeProperty('--mss-distance');
      this.cards.forEach(card => {
        ['transform', 'opacity', 'visibility', 'pointer-events', 'z-index'].forEach(name => card.style.removeProperty(name));
      });
      return;
    }
    this.step = this.stageHeight * .9;
    this.style.setProperty('--mss-distance', (this.step * (this.cards.length - 1 + .3)).toFixed(2) + 'px');
    this.render(performance.now());
  }

  render(time) {
    this.frame = null;
    if (!this.enabled || !this.isConnected) return;
    const target = Math.max(0, Math.min(this.cards.length - 1, (this.top - this.getBoundingClientRect().top) / this.step));
    const delta = this.lastTime ? Math.min(64, time - this.lastTime) : 16;
    this.lastTime = time;
    this.current = this.current === null ? target : this.current + (target - this.current) * (1 - Math.exp(-delta / 85));
    if (Math.abs(target - this.current) < .0005) this.current = target;
    const clamp = value => Math.max(0, Math.min(1, value));
    const smooth = value => value * value * (3 - 2 * value);
    this.cards.forEach((card, index) => {
      // A short reading hold precedes each transition. Both directions are reversible.
      const incoming = index === 0 ? 1 : smooth(clamp((this.current - index + .8) / .8));
      const outgoing = index === this.cards.length - 1 ? 0 : smooth(clamp((this.current - index - .2) / .8));
      const y = (1 - incoming) * (this.rows.offsetHeight + 80) - outgoing * 32;
      const opacity = incoming * (1 - outgoing);
      card.style.transform = `translate3d(0,${y.toFixed(2)}px,0) scale(${(1 - outgoing * .08).toFixed(4)})`;
      card.style.opacity = opacity.toFixed(4);
      card.style.visibility = opacity < .001 ? 'hidden' : 'visible';
      card.style.pointerEvents = opacity > .95 ? 'auto' : 'none';
      card.style.zIndex = index + 1;
    });
    if (this.current !== target) this.schedule();
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.frame);
  }
}
if (!customElements.get('monte-silk-story')) customElements.define('monte-silk-story', MonteSilkStory);
