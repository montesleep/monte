class MonteProductFeatures extends HTMLElement {
  connectedCallback() {
    this.controller?.abort();
    this.resizeObserver?.disconnect();
    this.controller = new AbortController();
    const { signal } = this.controller;
    const track = this.querySelector('.monte-features__track');
    const progress = this.querySelector('.monte-features__progress');
    if (!track) return;
    const update = () => {
      const overflowing = matchMedia('(max-width: 999px)').matches && track.scrollWidth > track.clientWidth + 1;
      progress.hidden = !overflowing;
      track.tabIndex = overflowing ? 0 : -1;
      // Keep the initial indicator correct before the first native scroll event.
      progress.style.setProperty('--scroll-progress', String(Math.min(1, (Math.abs(track.scrollLeft) + track.clientWidth) / Math.max(1, track.scrollWidth))));
    };
    this.resizeObserver = new ResizeObserver(update);
    this.resizeObserver.observe(track);
    [...track.children].forEach(card => this.resizeObserver.observe(card));
    track.addEventListener('keydown', event => {
      if (event.target !== track || track.tabIndex < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const left = event.key === 'Home' ? 0 : event.key === 'End' ? track.scrollWidth : track.scrollLeft + (event.key === 'ArrowRight' ? 260 : -260);
      track.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }, { signal });
    this.querySelectorAll('video').forEach(video => {
      video.muted = true;
      video.controls = false;
      video.disablePictureInPicture = true;
      video.setAttribute('tabindex', '-1');
      video.setAttribute('disableRemotePlayback', '');
      video.play().catch(() => {});
    });
    update();
  }
  disconnectedCallback() {
    this.controller?.abort();
    this.resizeObserver?.disconnect();
  }
}
if (!customElements.get('monte-product-features')) customElements.define('monte-product-features', MonteProductFeatures);
