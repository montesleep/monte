class MonteCollectionFilter extends HTMLElement {
  connectedCallback() {
    this.controller?.abort();
    this.observer?.disconnect();
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.track = this.querySelector('.monte-categories__track');
    this.progress = this.querySelector('.monte-categories__progress');
    this.update = () => {
      const { clientWidth, scrollWidth, scrollLeft } = this.track;
      const mobile = matchMedia('(max-width: 699px)').matches;
      this.progress.hidden = !mobile || scrollWidth <= clientWidth + 1;
      this.style.setProperty('--category-progress', Math.min(1, (Math.abs(scrollLeft) + clientWidth) / Math.max(1, scrollWidth)));
      this.track.tabIndex = mobile && scrollWidth > clientWidth + 1 ? 0 : -1;
    };
    if (this.hasAttribute('data-bundle-filter')) {
      this.querySelectorAll('.monte-categories__item').forEach(link => {
        const category = new URL(link.href).pathname.split('/').filter(Boolean).pop();
        link.dataset.category = category;
        link.href = location.pathname + '?category=' + encodeURIComponent(category);
      });
    }
    this.track.addEventListener('scroll', this.update, { passive: true, signal });
    this.track.addEventListener('keydown', event => {
      if (event.target !== this.track || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const left = event.key === 'Home' ? 0 : event.key === 'End' ? this.track.scrollWidth : this.track.scrollLeft + (event.key === 'ArrowRight' ? 1 : -1) * this.track.clientWidth * .75;
      this.track.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }, { signal });
    this.observer = new ResizeObserver(this.update);
    this.observer.observe(this.track);
    [...this.track.children].forEach(item => this.observer.observe(item));
    this.update();
    // Reveal the selected category without moving the page or starting a marquee.
    const active = this.track.querySelector('[aria-current="page"]');
    if (active && matchMedia('(max-width: 699px)').matches) {
      const itemRect = active.getBoundingClientRect();
      const trackRect = this.track.getBoundingClientRect();
      if (itemRect.left < trackRect.left || itemRect.right > trackRect.right) {
        this.track.scrollLeft += itemRect.left - trackRect.left - 20;
      }
    }
  }
  disconnectedCallback() {
    this.controller?.abort();
    this.observer?.disconnect();
  }
}
if (!customElements.get('monte-collection-filter')) customElements.define('monte-collection-filter', MonteCollectionFilter);
