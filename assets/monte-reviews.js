class MonteReviews extends HTMLElement {
  connectedCallback() {
    this.controller?.abort();
    this.resizeObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.carousel = this.querySelector('.monte-reviews__carousel');
    if (!this.carousel) return;
    this.groups = [...this.querySelectorAll('[data-review-group]')];
    this.desktop = matchMedia('(min-width: 1000px)');
    this.progress = this.querySelector('.monte-reviews__progress');
    const refresh = () => {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => this.refresh());
    };
    this.resizeObserver = new ResizeObserver(refresh);
    this.resizeObserver.observe(this.carousel);
    this.groups.forEach(group => this.resizeObserver.observe(group));
    this.desktop.addEventListener('change', refresh, { signal });
    this.visibilityObserver = new IntersectionObserver(entries => {
      this.classList.toggle('is-out-of-view', !entries[0].isIntersecting);
    });
    this.visibilityObserver.observe(this);
    this.addEventListener('shopify:block:select', event => {
      const card = event.target.closest('[data-review-original]');
      if (!card || !this.desktop.matches) return;
      this.classList.add('is-editing');
      const column = card.closest('.monte-reviews__column');
      column.scrollTop += card.getBoundingClientRect().top - column.getBoundingClientRect().top;
    }, { signal });
    this.addEventListener('shopify:block:deselect', () => {
      this.classList.remove('is-editing');
      this.querySelectorAll('.monte-reviews__column').forEach(column => { column.scrollTop = 0; });
    }, { signal });
    this.carousel.addEventListener('keydown', event => {
      if (this.desktop.matches || event.target !== this.carousel || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      this.carousel.scrollBy({ left: event.key === 'ArrowRight' ? 248 : -248, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }, { signal });
    refresh();
  }
  disconnectedCallback() {
    this.controller?.abort();
    this.resizeObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    cancelAnimationFrame(this.resizeFrame);
  }
  refresh() {
    const overflow = !this.desktop.matches && this.carousel.scrollWidth > this.carousel.clientWidth + 1;
    this.progress.hidden = !overflow;
    if (!this.desktop.matches) return;
    const speed = Math.max(10, Number(this.dataset.speed) || 25);
    this.groups.forEach(group => {
      const track = group.parentElement;
      const distance = group.getBoundingClientRect().height;
      if (!distance) return;
      const copies = Math.ceil(this.carousel.clientHeight / distance) + 1;
      if (track.dataset.copies !== String(copies)) {
        track.querySelectorAll('[data-review-copy]').forEach(copy => copy.remove());
        for (let index = 0; index < copies; index++) {
          const copy = group.cloneNode(true);
          copy.removeAttribute('data-review-group');
          copy.setAttribute('data-review-copy', '');
          copy.setAttribute('aria-hidden', 'true');
          copy.inert = true;
          copy.querySelectorAll('*').forEach(element => {
            ['id', 'data-review-original', 'data-review-id', 'data-shopify-editor-block'].forEach(attribute => element.removeAttribute(attribute));
          });
          track.append(copy);
        }
        track.dataset.copies = String(copies);
      }
      track.style.setProperty('--reviews-distance', `${distance}px`);
      track.style.setProperty('--reviews-duration', `${distance / speed}s`);
      track.classList.add('is-ready');
    });
  }
}
if (!customElements.get('monte-reviews')) customElements.define('monte-reviews', MonteReviews);
