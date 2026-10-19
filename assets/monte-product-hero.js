import { Drawer, ProductGallery, Tabs } from 'theme';
import { timeline } from 'vendor';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const money = value => new Intl.NumberFormat(Shopify.locale || 'pl-PL', { style: 'currency', currency: Shopify.currency?.active || 'PLN', maximumFractionDigits: 2 }).format(value / 100);

class MonteProductHero extends HTMLElement {
  connectedCallback() {
    this.abort = new AbortController();
    const signal = this.abort.signal;
    const sticky = this.querySelector('.mp-sticky'), atc = this.querySelector('[data-bundle-atc]');
    if (sticky && atc) {
      const button = sticky.querySelector('[data-sticky-atc]');
      const bundle = this.querySelector('monte-product-bundle');
      const error = sticky.querySelector('.mp-sticky-error');
      const desktop = matchMedia('(min-width: 1000px)');
      const updateVisibility = () => {
        const trigger = desktop.matches ? this : atc;
        const visible = trigger.getBoundingClientRect().bottom <= 0;
        sticky.classList.toggle('is-visible', visible);
        sticky.setAttribute('aria-hidden', String(!visible));
        sticky.inert = !visible;
        const root = document.documentElement;
        root.classList.toggle('monte-sticky-mobile-visible', visible && !desktop.matches);
        root.classList.toggle('monte-sticky-desktop-visible', visible && desktop.matches);
        root.style.setProperty('--monte-sticky-height', `${sticky.getBoundingClientRect().height}px`);
      };
      this.stickyObserver = new IntersectionObserver(updateVisibility);
      this.stickyObserver.observe(atc);
      this.stickyObserver.observe(this);
      this.stickyResize = new ResizeObserver(updateVisibility);
      this.stickyResize.observe(this);
      this.stickyResize.observe(sticky);
      desktop.addEventListener('change', updateVisibility, { signal });
      window.addEventListener('resize', updateVisibility, { signal });
      updateVisibility();
      const syncSelection = () => {
        if (!bundle?.current) return;
        const { price, compare } = bundle.selectionPrices;
        button.disabled = bundle.button.disabled;
        button.setAttribute('aria-busy', String(Boolean(bundle.busy)));
        sticky.querySelector('[data-sticky-label]').textContent = bundle.querySelector('[data-atc-label]').textContent;
        sticky.classList.toggle('mp-sticky--choose-color', bundle.count === 2 && bundle.slots.some(item => !item));
        sticky.querySelector('[data-sticky-price]').textContent = money(price);
        const crossed = sticky.querySelector('[data-sticky-compare]');
        const discount = sticky.querySelector('[data-sticky-discount]');
        const onSale = compare > price;
        crossed.hidden = discount.hidden = !onSale;
        crossed.textContent = money(compare);
        discount.textContent = onSale ? `−${Math.round((compare - price) * 100 / compare)}%` : '';
        const selected = bundle.count === 2 ? bundle.slots.filter(Boolean) : [bundle.current];
        const color = sticky.querySelector('.mp-sticky-color');
        if (color) color.textContent = `Kolor: ${selected.map(item => item.color).filter(Boolean).join(' + ')}`;
        const image = sticky.querySelector('.mp-sticky-image');
        if (image && selected[0]?.image) { image.src = selected[0].image; image.removeAttribute('srcset'); }
        error.textContent = bundle.error.textContent;
        error.hidden = bundle.error.hidden;
      };
      this.addEventListener('monte:bundle-change', syncSelection, { signal });
      button.addEventListener('click', () => bundle.addToCart(), { signal });
      syncSelection();
    }
    const text = this.querySelector('[data-description]'), button = this.querySelector('[data-expand]');
    if (text && button) {
      const measure = () => { if (text.clientHeight && !this.descriptionAnimation) button.hidden = button.getAttribute('aria-expanded') !== 'true' && text.scrollHeight <= text.clientHeight + 1; };
      button.addEventListener('click', () => {
        const expanded = button.getAttribute('aria-expanded') !== 'true';
        const startHeight = text.getBoundingClientRect().height;
        this.descriptionAnimation?.cancel();
        button.setAttribute('aria-expanded', String(expanded));
        button.querySelector('span').textContent = expanded ? button.dataset.collapseLabel || 'Zwiń' : button.dataset.expandLabel || 'Rozwiń';
        text.classList.remove('mp-description--collapsed');
        const fullHeight = text.scrollHeight;
        const endHeight = expanded ? fullHeight : Math.min(fullHeight, parseFloat(getComputedStyle(text).lineHeight) * 2);
        if (reduced()) { text.classList.toggle('mp-description--collapsed', !expanded); this.descriptionAnimation = null; return; }
        // Match Impact's accordion timing while keeping the text visible during collapse.
        text.style.overflow = 'hidden';
        const animation = text.animate({ height: [`${startHeight}px`, `${endHeight}px`] }, { duration: 250, easing: 'ease' });
        this.descriptionAnimation = animation;
        animation.finished.then(() => {
          if (this.descriptionAnimation !== animation) return;
          text.classList.toggle('mp-description--collapsed', !expanded);
          text.style.removeProperty('overflow'); this.descriptionAnimation = null; measure();
        }).catch(() => {});
      }, { signal });
      this.resize = new ResizeObserver(measure); this.resize.observe(text);
      document.fonts.ready.then(() => { if (this.isConnected) measure(); });
    }
  }
  disconnectedCallback() { this.abort?.abort(); this.descriptionAnimation?.cancel(); this.resize?.disconnect(); this.stickyObserver?.disconnect(); this.stickyResize?.disconnect(); document.documentElement.classList.remove('monte-sticky-mobile-visible', 'monte-sticky-desktop-visible'); document.documentElement.style.removeProperty('--monte-sticky-height'); }
}

class MontePdpTabs extends Tabs {
  async _transition(fromPanel, toPanel) {
    this.nextPanel = toPanel;
    if (this.switching) return;
    this.switching = true;
    try {
      while (this.nextPanel && this.isConnected) {
        const target = this.nextPanel; this.nextPanel = null;
        const current = this.panels.find(panel => !panel.hidden);
        if (current === target) continue;
        const before = this.getBoundingClientRect().height;
        if (current && !reduced()) {
          this.panelAnimation = timeline([[current, { opacity: [1, 0] }, { duration: .15 }]]);
          await this.panelAnimation.finished;
        }
        this.panels.forEach(panel => { panel.hidden = panel !== target; });
        const after = this.getBoundingClientRect().height;
        if (!reduced()) {
          this.style.overflow = 'hidden';
          this.panelAnimation = timeline([
            [this, { height: [`${before}px`, `${after}px`] }, { duration: .25, easing: 'ease', at: 0 }],
            [target, { opacity: [0, 1], transform: ['translateY(4px)', 'translateY(0)'] }, { duration: .25, at: 0 }]
          ]);
          await this.panelAnimation.finished;
          this.style.removeProperty('height'); this.style.removeProperty('overflow');
        }
      }
    } catch (error) {
      if (this.isConnected) this.panels.forEach((panel, index) => { panel.hidden = index !== this.selectedIndex; });
    } finally { this.switching = false; this.style.removeProperty('height'); this.style.removeProperty('overflow'); }
  }
  disconnectedCallback() { this.panelAnimation?.cancel(); super.disconnectedCallback(); }
}

class MonteProductPicker extends Drawer {
  get openFrom() { return 'right'; }
  get initialFocus() { return this; }
  connectedCallback() {
    super.connectedCallback();
    this.querySelector('[data-picker-close]').addEventListener('click', () => this.hide(), { signal: this._abortController.signal });
  }
  disconnectedCallback() { this.unlockPage(); super.disconnectedCallback(); }
  lockPage() {
    if (this.pageLock) return;
    const names = ['position', 'top', 'left', 'right', 'width', 'overflow', 'padding-right'];
    this.pageLock = { x: scrollX, y: scrollY, styles: names.map(key => [key, document.body.style.getPropertyValue(key), document.body.style.getPropertyPriority(key)]) };
    const scrollbar = innerWidth - document.documentElement.clientWidth;
    if (scrollbar) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`;
    Object.assign(document.body.style, { position: 'fixed', top: `${-scrollY}px`, left: '0', right: '0', width: '100%', overflow: 'hidden' });
  }
  unlockPage() {
    if (!this.pageLock) return;
    const { x, y, styles } = this.pageLock; this.pageLock = null;
    styles.forEach(([key, value, priority]) => value ? document.body.style.setProperty(key, value, priority) : document.body.style.removeProperty(key));
    scrollTo({ left: x, top: y, behavior: 'instant' });
  }
  _showTransition(animated = true) { this._setInitialPosition(); this.lockPage(); return this.animatePanel(true, animated); }
  _hideTransition() { return this.animatePanel(false).then(() => this.unlockPage()); }
  animatePanel(open, animated = true) {
    const content = this.shadowRoot.querySelector('[part="content"]'), overlay = this.shadowRoot.querySelector('[part="overlay"]');
    const instant = reduced() || !animated;
    const closed = 'inset(0 0 0 100% round var(--rounded-sm))', expanded = 'inset(0 0 0 0 round var(--rounded-sm))';
    Object.assign(this.style, { visibility: 'visible', opacity: '1' });
    return timeline([
      [overlay, { backgroundColor: open ? ['rgba(0,0,0,0)', 'rgba(0,0,0,.6)'] : ['rgba(0,0,0,.6)', 'rgba(0,0,0,0)'], backdropFilter: open ? ['blur(0px)', 'blur(17px)'] : ['blur(17px)', 'blur(0px)'], webkitBackdropFilter: open ? ['blur(0px)', 'blur(17px)'] : ['blur(17px)', 'blur(0px)'] }, { at: 0, duration: instant ? 0 : .3 }],
      [content, { clipPath: open ? [closed, expanded] : [expanded, closed] }, { at: instant ? 0 : .15, duration: instant ? 0 : .4, easing: [.86, 0, .07, 1] }],
      [content.children, { opacity: open ? [0, 1] : [1, 0] }, { at: open && !instant ? .55 : 0, duration: instant ? 0 : .15 }]
    ]).finished.then(() => { if (!open) this.style.visibility = 'hidden'; });
  }
  show(animated = true) { return this.requestState(true, animated); }
  hide() { return this.requestState(false); }
  requestState(open, animated = true) {
    this.desired = open;
    if (!this.transition) this.transition = (async () => {
      while (this.isConnected && this.open !== this.desired) {
        if (this.desired) await super.show(animated); else await super.hide();
      }
    })().finally(() => { this.transition = null; if (this.isConnected && this.open !== this.desired) this.requestState(this.desired); });
    return this.transition;
  }
}

class MonteProductBundle extends HTMLElement {
  connectedCallback() {
    this.abort = new AbortController(); const signal = this.abort.signal;
    this.data = JSON.parse(this.querySelector('[data-bundle-data]').textContent);
    this.current = this.data.current; this.slots = [{ ...this.current }, null]; this.count = 1; this.activeSlot = 1;
    this.drawer = document.getElementById(this.dataset.drawer);
    this.button = this.querySelector('[data-bundle-atc]'); this.error = this.querySelector('.mp-bundle-error');
    this.addEventListener('change', event => {
      if (event.target.matches('input[type=radio]')) {
        const previous = this.count; this.count = Number(event.target.value); this.render();
        if (previous !== this.count) this.animateSlots();
      }
      if (event.target.matches('[data-current-variant]')) {
        const v = this.data.variants.find(v => v.id === Number(event.target.value));
        const previousId = this.current.id;
        this.current = { ...this.current, id: v.id, price: v.price, compare: v.compare_at_price || 0, available: v.available };
        if (this.slots[0]?.id === previousId) this.slots[0] = { ...this.current };
        const url = new URL(location.href); url.searchParams.set('variant', v.id); history.replaceState({}, '', url);
        this.render(); this.updatePrice();
        if (v.featured_media) this.closest('monte-product-hero').querySelector('monte-product-media')?.selectMedia(v.featured_media.id);
      }
    }, { signal });
    this.addEventListener('click', event => {
      const pick = event.target.closest('[data-pick-slot]'), remove = event.target.closest('[data-remove-slot]');
      if (pick) this.pick(Number(pick.dataset.pickSlot));
      if (remove) { this.slots[Number(remove.dataset.removeSlot)] = null; this.render(); }
      if (event.target.closest('[data-bundle-atc]')) this.addToCart();
    }, { signal });
    this.drawer.addEventListener('change', event => {
      if (!event.target.matches('[data-picker-variant]')) return;
      event.target.closest('.mp-picker-item').querySelector('[data-pick-product]').disabled = event.target.selectedOptions[0].dataset.available !== 'true';
    }, { signal });
    this.drawer.addEventListener('click', async event => {
      const button = event.target.closest('[data-pick-product]'); if (!button || button.disabled) return;
      let item = { ...this.data.products.find(item => item.productId === Number(button.dataset.pickProduct)) };
      const option = button.closest('.mp-picker-item').querySelector('select')?.selectedOptions[0];
      if (option) item = { ...item, id: Number(option.value), price: Number(option.dataset.price), available: option.dataset.available === 'true' };
      if (!item.available) return;
      this.slots[this.activeSlot] = item; this.render(); await this.drawer.hide();
      this.querySelector(`[data-remove-slot="${this.activeSlot}"]`)?.focus({ preventScroll: true });
    }, { signal });
    this.addEventListener('shopify:block:select', () => this.scrollIntoView({ block: 'center', behavior: 'smooth' }), { signal });
    this.render();
  }
  disconnectedCallback() {
    this.abort?.abort();
    this.slotAnimation?.cancel();
    if (this.drawer?.parentElement === document.body) this.drawer.remove();
  }
  pick(index) { this.activeSlot = index; this.drawer.show(); }
  animateSlots() {
    const slots = this.querySelector('.mp-bundle-slots'); if (!slots || reduced()) return;
    this.slotAnimation?.cancel();
    const expanded = this.count === 2;
    slots.hidden = false; slots.style.overflow = 'hidden';
    const height = `${slots.offsetHeight}px`;
    this.slotAnimation = slots.animate({ height: expanded ? ['0px', height] : [height, '0px'], opacity: expanded ? [0, 1] : [1, 0] }, { duration: 250, easing: 'ease' });
    this.slotAnimation.finished.then(() => { slots.hidden = this.count !== 2; slots.style.removeProperty('overflow'); }).catch(() => {});
  }
  get selectionPrices() {
    if (this.count === 1) return { price: this.current.price, compare: this.current.compare };
    // Match the main bundle estimate while an unfilled slot awaits selection.
    const compare = this.slots.reduce((sum, item) => sum + (item?.price ?? this.current.price), 0);
    const discount = Math.min(100, Math.max(0, Number(this.dataset.discount) || 0));
    return { price: Math.round(compare * (1 - discount / 100)), compare };
  }
  notifySelection() { this.dispatchEvent(new CustomEvent('monte:bundle-change', { bubbles: true })); }
  updatePrice() {
    const price = this.closest('monte-product-hero').querySelector('[data-main-price]');
    price.replaceChildren(); const current = document.createElement('strong'); current.textContent = money(this.current.price); price.append(current);
    if (this.current.compare > this.current.price) {
      const compare = document.createElement('s'), badge = document.createElement('span');
      compare.textContent = money(this.current.compare); badge.className = 'mp-saving'; badge.textContent = `−${Math.round(100 * (this.current.compare - this.current.price) / this.current.compare)}%`;
      price.append(compare, badge);
    }
  }
  render() {
    this.querySelectorAll('[data-choice]').forEach(row => row.dataset.selected = String(Number(row.dataset.choice) === this.count));
    this.querySelector('[data-selected-label]').textContent = this.querySelector(`[data-choice="${this.count}"] [data-option-title]`).textContent;
    this.querySelector('[data-single-price]').textContent = money(this.current.price);
    const slots = this.querySelector('.mp-bundle-slots');
    if (slots) {
      slots.hidden = this.count !== 2;
      this.slots.forEach((item, i) => {
        const row = this.querySelector(`[data-slot="${i}"]`), img = row.querySelector('img');
        img.hidden = !item; if (item) { img.src = item.image; img.alt = item.title; }
        row.querySelector('[data-slot-plus]').hidden = Boolean(item);
        const title = row.querySelector('[data-slot-title]'); title.hidden = !item; title.textContent = item?.title || '';
        row.querySelector('[data-pick-slot]').hidden = Boolean(item); row.querySelector('[data-remove-slot]').hidden = !item;
      });
      // Empty slots use the current product price for an estimate until a product is selected.
      const compare = this.slots.reduce((sum, item) => sum + (item?.price ?? this.current.price), 0);
      const discount = Math.min(100, Math.max(0, Number(this.dataset.discount) || 0));
      const total = Math.round(compare * (1 - discount / 100));
      this.querySelector('[data-pair-price]').textContent = money(total);
      const crossed = this.querySelector('[data-pair-compare]'); crossed.textContent = money(compare); crossed.hidden = !discount;
      const saving = this.querySelector('[data-pair-saving]'); saving.textContent = `Oszczędzasz ${money(compare - total)}`; saving.hidden = !discount;
    }
    this.querySelectorAll('[data-current-color]').forEach(swatch => swatch.setAttribute('aria-current', String(this.count === 1 || this.slots.some(item => item?.productId === this.current.productId))));
    const incomplete = this.count === 2 && this.slots.some(item => !item);
    const unavailable = !incomplete && (this.count === 1 ? !this.current.available : this.slots.some(item => !item.available));
    this.querySelector('[data-atc-label]').textContent = unavailable ? 'Wyprzedane' : incomplete ? this.querySelector('[data-pick-slot]').textContent : 'Dodaj do koszyka';
    this.querySelector('.mp-basket').hidden = incomplete || unavailable;
    this.button.disabled = unavailable || Boolean(this.busy); this.error.hidden = true;
    this.notifySelection();
  }
  async addToCart() {
    if (this.busy || this.button.disabled) return;
    if (this.count === 2 && this.slots.some(item => !item)) { this.pick(this.slots.findIndex(item => !item)); return; }
    this.busy = true; this.button.disabled = true; this.button.setAttribute('aria-busy', 'true'); this.error.hidden = true;
    this.notifySelection();
    let added = false;
    try {
      const sections = ['variant-added'];
      document.documentElement.dispatchEvent(new CustomEvent('cart:prepare-bundled-sections', { bubbles: true, detail: { sections } }));
      const chosen = this.count === 1 ? [this.current] : this.slots;
      // Preserve the existing Every Possible Discount line-property contract.
      const items = chosen.map(item => ({ id: item.id, quantity: 1, properties: { _bundle: 'true' } }));
      const response = await fetch(`${Shopify.routes.root}cart/add.js`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items, sections: [...new Set(sections)], sections_url: location.pathname }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.description || 'Nie udało się dodać produktu. Spróbuj ponownie.');
      added = true;
      const cartResponse = await fetch(`${Shopify.routes.root}cart.js`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!cartResponse.ok) throw new Error('Koszyk został zaktualizowany. Otwórz koszyk, aby zobaczyć produkty.');
      const cart = await cartResponse.json(); cart.sections = result.sections;
      this.dispatchEvent(new CustomEvent('variant:add', { bubbles: true, detail: { items: result.items, cart } }));
      document.documentElement.dispatchEvent(new CustomEvent('cart:change', { bubbles: true, detail: { baseEvent: 'variant:add', cart } }));
    } catch (error) {
      this.error.textContent = added ? 'Produkty zostały dodane. Otwórz koszyk, aby sprawdzić jego zawartość.' : error.message;
      this.error.hidden = false;
      if (added) document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
    } finally { this.busy = false; this.button.disabled = false; this.button.removeAttribute('aria-busy'); this.notifySelection(); }
  }
}

class MonteProductMedia extends HTMLElement {
  connectedCallback() {
    this.abort = new AbortController(); const signal = this.abort.signal;
    this.track = this.querySelector('[data-media-track]'); this.items = [...this.querySelectorAll('[data-lightbox-item]')];
    this.gallery = this.classList.contains('mp-gallery'); this.index = 0; this.lastTick = performance.now(); this.elapsed = 0;
    this.visibleVideos = new Set(); this.visible = false;
    this.visibility = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.target === this) this.visible = entry.isIntersecting;
        else if (entry.isIntersecting && entry.intersectionRatio >= .5) this.visibleVideos.add(entry.target); else this.visibleVideos.delete(entry.target);
      }); this.syncVideos();
    }, { threshold: [0, .5, 1] });
    this.visibility.observe(this); this.querySelectorAll('video').forEach(video => this.visibility.observe(video));
    this.addEventListener('click', event => {
      const thumb = event.target.closest('[data-gallery-index]'), step = event.target.closest('[data-gallery-step]'), arrow = event.target.closest('[data-ugc-step]'), item = event.target.closest('[data-lightbox-item]');
      if (thumb) this.select(Number(thumb.dataset.galleryIndex), true);
      else if (step) this.select((this.index + Number(step.dataset.galleryStep) + this.items.length) % this.items.length, true);
      else if (arrow) this.track.scrollBy({ left: Number(arrow.dataset.ugcStep) * this.track.clientWidth, behavior: reduced() ? 'instant' : 'smooth' });
      else if (item && !this.dragged) this.openLightbox(this.items.indexOf(item));
    }, { signal });
    this.track.addEventListener('pointerdown', event => { this.pointerX = event.clientX; this.dragged = false; this.pauseUntil = performance.now() + 10000; }, { signal });
    this.track.addEventListener('pointermove', event => { if (event.buttons && Math.abs(event.clientX - this.pointerX) > 8) this.dragged = true; }, { signal });
    this.track.addEventListener('keydown', event => {
      if (this.gallery && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); this.select((this.index + (event.key === 'ArrowRight' ? 1 : -1) + this.items.length) % this.items.length, true); }
    }, { signal });
    this.track.addEventListener('scroll', () => this.update(), { passive: true, signal });
    document.addEventListener('visibilitychange', () => { this.lastTick = performance.now(); this.syncVideos(); }, { signal });
    this.addEventListener('shopify:block:select', event => { const item = event.target.closest('[data-lightbox-item]'); if (item) this.track.scrollTo({ left: item.offsetLeft - this.track.offsetLeft, behavior: 'smooth' }); }, { signal });
    this.resize = new ResizeObserver(() => this.update()); this.resize.observe(this.track);
    this.update(); if (this.gallery && this.hasAttribute('data-rotate')) this.tick();
  }
  disconnectedCallback() {
    this.abort?.abort(); this.resize?.disconnect(); this.visibility?.disconnect(); cancelAnimationFrame(this.frame);
    this.querySelectorAll('video').forEach(video => video.pause()); this._photoswipe?.destroy(); this._photoswipe = null;
  }
  syncVideos() {
    this.querySelectorAll('video').forEach(video => {
      if (this.visibleVideos.has(video) && !document.hidden && !this.lightboxOpen) { video.muted = true; video.controls = false; video.play().catch(() => {}); }
      else video.pause();
    });
  }
  selectMedia(id) { const index = this.items.findIndex(item => Number(item.dataset.mediaId) === id); if (index >= 0) this.select(index, true); }
  select(index, manual = false) {
    if (!this.items.length) return;
    this.elapsed = 0; if (manual) this.pauseUntil = performance.now() + 10000;
    this.track.scrollTo({ left: index * this.track.clientWidth, behavior: reduced() ? 'instant' : 'smooth' });
  }
  update() {
    if (this.gallery) {
      const index = Math.round(this.track.scrollLeft / Math.max(1, this.track.clientWidth));
      if (index !== this.index) this.elapsed = 0;
      this.index = index;
      this.querySelectorAll('[data-gallery-index]').forEach(button => button.setAttribute('aria-current', String(Number(button.dataset.galleryIndex) === index)));
      const thumb = this.querySelector(`.mp-gallery-thumbs [data-gallery-index="${index}"]`), list = thumb?.parentElement;
      if (thumb && list) {
        if (matchMedia('(min-width:1000px)').matches) list.scrollTo({ top: Math.max(0, thumb.offsetTop - list.offsetTop - list.clientHeight / 2), behavior: 'smooth' });
        else list.scrollTo({ left: Math.max(0, thumb.offsetLeft - list.offsetLeft - list.clientWidth / 2), behavior: 'smooth' });
      }
    } else {
      const maximum = Math.max(0, this.track.scrollWidth - this.track.clientWidth);
      const navigable = this.items.length > 3 && maximum > 1;
      this.querySelector('.mp-arrows').hidden = !navigable;
      this.querySelector('.mp-ugc-progress').hidden = !navigable;
      this.querySelector('[data-ugc-step="-1"]').disabled = this.track.scrollLeft <= 1;
      this.querySelector('[data-ugc-step="1"]').disabled = this.track.scrollLeft >= maximum - 1;
      this.style.setProperty('--ugc-progress', `${Math.min(100, 100 * (this.track.scrollLeft + this.track.clientWidth) / Math.max(1, this.track.scrollWidth))}%`);
    }
  }
  tick(now = performance.now()) {
    const delta = Math.min(100, now - this.lastTick); this.lastTick = now;
    if (this.gallery && this.hasAttribute('data-rotate') && this.items.length > 1 && this.visible && !document.hidden && !this.lightboxOpen && !reduced()) {
      if (now >= (this.pauseUntil || 0)) this.elapsed += delta;
      this.style.setProperty('--gallery-progress', Math.min(1, this.elapsed / 13000));
      if (this.elapsed >= 13000) this.select((this.index + 1) % this.items.length);
    }
    this.frame = requestAnimationFrame(time => this.tick(time));
  }
  openLightbox(index) {
    if (!this._photoswipe) {
      // Reuse Impact's PhotoSwipe instance, UI, zoom controls and pagination.
      Object.getOwnPropertyDescriptor(ProductGallery.prototype, 'photoswipe').get.call(this);
      this._photoswipe.on('beforeOpen', () => { this.lightboxOpen = true; this.syncVideos(); });
      const play = ({ content }) => {
        const video = content.element?.querySelector('video');
        if (video && content.slide?.isActive) video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
      };
      this._photoswipe.on('contentActivate', play);
      this._photoswipe.on('contentAppend', play);
      this._photoswipe.on('contentDeactivate', ({ content }) => content.element?.querySelector('video')?.pause());
      this._photoswipe.on('close', () => { this._photoswipe.pswp?.element?.querySelectorAll('video').forEach(video => video.pause()); });
      this._photoswipe.on('destroy', () => { this.lightboxOpen = false; this.pauseUntil = performance.now() + 10000; this.syncVideos(); });
    }
    const source = this.items.map(item => {
      const video = item.querySelector('video'), image = item.querySelector('img');
      if (video) {
        const clone = video.cloneNode(true); clone.className = 'mp-lightbox-video'; clone.controls = true; clone.muted = false; clone.loop = false; clone.removeAttribute('muted'); clone.removeAttribute('autoplay'); clone.removeAttribute('loop'); clone.setAttribute('controls', '');
        return { html: clone.outerHTML, width: video.videoWidth || 900, height: video.videoHeight || 1350 };
      }
      return { src: image.currentSrc || image.src, srcset: image.srcset, msrc: image.currentSrc || image.src, width: image.naturalWidth || Number(image.width), height: image.naturalHeight || Number(image.height), alt: image.alt, thumbnailElement: image, thumbCropped: true };
    });
    this._photoswipe.loadAndOpen(index, source);
  }
}

for (const [name, component] of [['monte-pdp-tabs', MontePdpTabs], ['monte-product-picker', MonteProductPicker], ['monte-product-bundle', MonteProductBundle], ['monte-product-media', MonteProductMedia], ['monte-product-hero', MonteProductHero]]) {
  if (!customElements.get(name)) customElements.define(name, component);
}
