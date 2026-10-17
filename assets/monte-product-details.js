import { AccordionDisclosure } from 'theme';

class MonteDetailDisclosure extends AccordionDisclosure {
  _onSummaryClicked(event) {
    event.preventDefault();
    this.closest('monte-product-details')?.select(this, true);
  }

  async _transition(value) {
    // Keep Impact's animation, serializing rapid changes so stale closes cannot hide an active row.
    const previous = this.transitionFinished;
    let finish;
    this.transitionFinished = new Promise(resolve => { finish = resolve; });
    try {
      if (previous) await previous;
      if (this.open !== value) return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.toggleAttribute('open', value);
      } else {
        await super._transition(value);
      }
      this.setAttribute('aria-expanded', String(this.open));
    } finally {
      finish();
    }
  }
}

class MonteProductDetails extends HTMLElement {
  connectedCallback() {
    this.controller?.abort();
    cancelAnimationFrame(this.frame);
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.rows = [...this.querySelectorAll('.monte-details__item')];
    this.active = this.rows.find(row => row.open) || this.rows[0];
    this.elapsed = 0;
    this.lastTime = null;
    this.pausedUntil = 0;
    this.editorSelected = false;
    if (this.active) this.select(this.active);

    document.addEventListener('visibilitychange', () => { this.lastTime = null; }, { signal });
    this.addEventListener('focusin', () => this.pause(), { signal });
    this.addEventListener('click', event => {
      if (!event.target.closest('summary')) this.pause();
    }, { signal });
    this.addEventListener('shopify:block:select', event => {
      const row = event.target.closest('.monte-details__item');
      if (!row || !this.contains(row)) return;
      event.stopImmediatePropagation();
      this.select(row, true);
      this.editorSelected = true;
    }, { signal, capture: true });
    this.addEventListener('shopify:block:deselect', event => {
      if (!event.target.closest('.monte-details__item')) return;
      event.stopImmediatePropagation();
      this.editorSelected = false;
      this.pause();
    }, { signal, capture: true });

    const video = this.querySelector('video');
    if (video) {
      video.muted = true;
      video.controls = false;
      video.disablePictureInPicture = true;
      video.setAttribute('tabindex', '-1');
      video.setAttribute('disableRemotePlayback', '');
      video.play().catch(() => {});
    }

    const tick = now => {
      if (!this.isConnected) return;
      if (this.lastTime === null) this.lastTime = now;
      const delta = now - this.lastTime;
      this.lastTime = now;
      if (!document.hidden && !this.editorSelected && this.rows.length > 1) {
        if (this.pausedUntil) {
          if (now >= this.pausedUntil) this.pausedUntil = 0;
        } else {
          this.elapsed = Math.min(10000, this.elapsed + delta);
          this.renderProgress();
          if (this.elapsed >= 10000) {
            this.select(this.rows[(this.rows.indexOf(this.active) + 1) % this.rows.length]);
          }
        }
      }
      this.frame = requestAnimationFrame(tick);
    };
    if (this.rows.length > 1) this.frame = requestAnimationFrame(tick);
  }

  select(row, manual = false) {
    if (!this.rows?.includes(row)) return;
    if (this.active !== row) {
      this.active = row;
      this.elapsed = 0;
    }
    for (const item of this.rows) {
      item.open = item === row;
      if (item !== row) item.style.setProperty('--detail-progress', '0');
    }
    this.renderProgress();
    if (manual) this.pause();
  }

  pause() {
    this.pausedUntil = performance.now() + 10000;
  }

  renderProgress() {
    this.active?.style.setProperty('--detail-progress', String(this.elapsed / 10000));
  }

  disconnectedCallback() {
    this.controller?.abort();
    cancelAnimationFrame(this.frame);
  }
}

if (!customElements.get('monte-detail-disclosure')) customElements.define('monte-detail-disclosure', MonteDetailDisclosure, { extends: 'details' });
if (!customElements.get('monte-product-details')) customElements.define('monte-product-details', MonteProductDetails);
