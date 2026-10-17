class MonteProductTabs extends HTMLElement {
  connectedCallback() {
    this.controller?.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.tabs = [...this.querySelectorAll('[role="tab"]')];
    this.panels = [...this.querySelectorAll('[role="tabpanel"]')];
    this.addEventListener('click', event => {
      const tab = event.target.closest('[role="tab"]');
      if (tab) this.select(tab);
    }, { signal });
    this.addEventListener('keydown', event => {
      const tab = event.target.closest('[role="tab"]');
      if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = this.tabs.indexOf(tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? this.tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + this.tabs.length) % this.tabs.length;
      this.select(this.tabs[next]);
      this.tabs[next].focus();
    }, { signal });
    this.addEventListener('shopify:block:select', event => {
      const panel = event.target.closest('[role="tabpanel"]');
      if (panel) this.select(this.tabs.find(tab => tab.getAttribute('aria-controls') === panel.id));
    }, { signal });
    this.querySelectorAll('.monte-products__track').forEach(track => this.enableDrag(track, signal));
  }
  disconnectedCallback() {
    this.controller?.abort();
  }
  select(selected) {
    if (!selected) return;
    this.tabs.forEach(tab => {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      this.panels.find(panel => panel.id === tab.getAttribute('aria-controls')).hidden = !active;
    });
  }
  enableDrag(track, signal) {
    let gesture = null;
    let suppressClickUntil = 0;
    track.addEventListener('dragstart', event => event.preventDefault(), { signal });
    track.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || !matchMedia('(min-width: 700px)').matches || track.scrollWidth <= track.clientWidth) return;
      gesture = { id: event.pointerId, start: event.clientX, scroll: track.scrollLeft, moved: false };
    }, { signal });
    track.addEventListener('pointermove', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const delta = event.clientX - gesture.start;
      if (!gesture.moved && Math.abs(delta) < 6) return;
      if (!gesture.moved) {
        gesture.moved = true;
        track.setPointerCapture(event.pointerId);
        track.classList.add('is-dragging');
      }
      event.preventDefault();
      track.scrollLeft = gesture.scroll - delta;
    }, { signal });
    const finish = event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      if (gesture.moved) suppressClickUntil = performance.now() + 350;
      if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
      track.classList.remove('is-dragging');
      gesture = null;
    };
    window.addEventListener('pointerup', finish, { signal });
    window.addEventListener('pointercancel', finish, { signal });
    track.addEventListener('click', event => {
      if (performance.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, { capture: true, signal });
    track.addEventListener('keydown', event => {
      if (event.target !== track || !matchMedia('(min-width: 700px)').matches || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      track.scrollBy({ left: (event.key === 'ArrowRight' ? 1 : -1) * track.clientWidth * .8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }, { signal });
  }
}
if (!customElements.get('monte-product-tabs')) customElements.define('monte-product-tabs', MonteProductTabs);
