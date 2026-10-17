import { CartDrawer, FreeShippingBar } from 'theme';
import { timeline, FocusTrap } from 'vendor';

class MonteCartShipping extends FreeShippingBar {
  constructor() {
    super();
    this._currencyFormatter = new Intl.NumberFormat(Shopify.locale, { style: 'currency', currency: Shopify.currency.active, minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  _onCartChanged(event) { this.totalPrice = event.detail.cart.total_price; }
}

class MonteCartDrawer extends CartDrawer {
  get initialFocus() { return this; }
  get focusTrap() {
    // Focus the panel without scrolling its content on touch devices.
    return this._focusTrap = this._focusTrap || new FocusTrap.createFocusTrap(this, {
      onDeactivate: this.hide.bind(this),
      allowOutsideClick: this._allowOutsideClick.bind(this),
      initialFocus: () => this.contains(document.activeElement) ? document.activeElement : this,
      fallbackFocus: this,
      tabbableOptions: { getShadowRoot: true },
      preventScroll: this.preventScrollWhenTrapped
    });
  }
  connectedCallback() {
    super.connectedCallback();
    const signal = this._abortController.signal;
    this.addEventListener('submit', event => {
      if (!event.target.matches('[data-cart-add-form]')) return;
      event.preventDefault();
      this.mutateCart({ type: 'add', form: event.target });
    }, { signal });
    this.addEventListener('click', event => {
      const quantity = event.target.closest('[data-cart-quantity]');
      if (quantity && !quantity.disabled) {
        const line = quantity.closest('[data-line-key]');
        const value = Number(quantity.dataset.cartQuantity);
        if (value !== 0 && (value < Number(line.dataset.min) || value > Number(line.dataset.max))) return;
        this.mutateCart({ type: 'change', key: line.dataset.lineKey, quantity: value, control: quantity });
      }
      const arrow = event.target.closest('[data-carousel-direction]');
      if (arrow && !arrow.disabled) {
        const carousel = this.querySelector('.monte-cart-carousel');
        carousel?.scrollBy({ left: Number(arrow.dataset.carouselDirection) * carousel.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
    }, { signal });
    this.addEventListener('change', event => {
      if (!event.target.matches('[data-cart-variant]')) return;
      const option = event.target.selectedOptions[0], card = event.target.closest('[data-cart-product]');
      card.querySelectorAll('a').forEach(link => { link.href = option.dataset.url; });
      card.querySelector('.monte-cart-price strong').textContent = option.dataset.price;
      let compare = card.querySelector('.monte-cart-price s');
      if (!compare) { compare = document.createElement('s'); card.querySelector('.monte-cart-price').append(compare); }
      compare.textContent = option.dataset.compare;
      compare.hidden = !option.dataset.compare;
      const image = card.querySelector('.monte-cart-image img');
      if (image && option.dataset.image) { image.src = option.dataset.image; image.removeAttribute('srcset'); }
      const variant = card.querySelector('.monte-cart-variant');
      if (variant) variant.textContent = option.textContent;
    }, { signal });
    const resize = () => { if (this.open) this._setInitialPosition(); this.updateCarousel(); };
    window.addEventListener('resize', resize, { signal });
    window.visualViewport?.addEventListener('resize', resize, { signal });
    this.addEventListener('dialog:after-show', () => this.updateCarousel(), { signal });
    this.bindCarousel();
  }
  disconnectedCallback() {
    this.carouselObserver?.disconnect();
    this.unlockPage();
    super.disconnectedCallback();
  }
  _setInitialPosition() {
    super._setInitialPosition();
    this.style.setProperty('--cart-viewport-height', `${window.visualViewport?.height || window.innerHeight}px`);
  }
  lockPage() {
    if (this.pageLock) return;
    const body = document.body;
    const properties = ['position', 'top', 'left', 'right', 'width', 'overflow', 'padding-right'];
    this.pageLock = { x: window.scrollX, y: window.scrollY, styles: properties.map(name => [name, body.style.getPropertyValue(name), body.style.getPropertyPriority(name)]) };
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbar > 0) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + scrollbar}px`;
    Object.assign(body.style, { position: 'fixed', top: `${-this.pageLock.y}px`, left: `${-this.pageLock.x}px`, right: '0', width: '100%', overflow: 'hidden' });
    document.documentElement.classList.add('monte-cart-locked');
  }
  unlockPage() {
    if (!this.pageLock) return;
    const { x, y, styles } = this.pageLock;
    this.pageLock = null;
    styles.forEach(([name, value, priority]) => value ? document.body.style.setProperty(name, value, priority) : document.body.style.removeProperty(name));
    document.documentElement.classList.remove('monte-cart-locked');
    window.scrollTo({ left: x, top: y, behavior: 'instant' });
  }
  _showTransition(animated = true) {
    this.lockPage();
    this._setInitialPosition();
    return this.animatePanel(true, animated).then(() => this.classList.add('show-close-cursor'));
  }
  _hideTransition() {
    return this.animatePanel(false).then(() => {
      this.classList.remove('show-close-cursor');
      this.unlockPage();
    });
  }
  animatePanel(open, animated = true) {
    const content = this.shadowRoot.querySelector('[part="content"]');
    const overlay = this.shadowRoot.querySelector('[part="overlay"]');
    const reduced = !animated || window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.themeVariables.settings.reduceDrawerAnimation;
    const closed = this.openFrom === 'top' ? 'inset(0 0 100% 0 round var(--rounded-sm))' : 'inset(0 0 0 100% round var(--rounded-sm))';
    const expanded = 'inset(0 0 0 0 round var(--rounded-sm))';
    // Keep the host opaque: animating its opacity creates a backdrop root and delays blur.
    Object.assign(this.style, { visibility: 'visible', opacity: '1' });
    const sequence = [
      [overlay, { backgroundColor: open ? ['rgba(0,0,0,0)', 'rgba(0,0,0,.6)'] : ['rgba(0,0,0,.6)', 'rgba(0,0,0,0)'], backdropFilter: open ? ['blur(0px)', 'blur(17px)'] : ['blur(17px)', 'blur(0px)'], webkitBackdropFilter: open ? ['blur(0px)', 'blur(17px)'] : ['blur(17px)', 'blur(0px)'] }, { duration: reduced ? 0 : .3, at: 0 }],
      [content, { clipPath: open ? [closed, expanded] : [expanded, closed] }, { duration: reduced ? 0 : .4, easing: [.86, 0, .07, 1], at: reduced ? 0 : .15 }],
      [content.children, { opacity: open ? [0, 1] : [1, 0] }, { duration: reduced ? 0 : .15, at: open && !reduced ? .55 : 0 }]
    ];
    return timeline(sequence).finished.then(() => { if (!open) this.style.visibility = 'hidden'; });
  }
  show(animated = true) { return this.setDrawerOpen(true, animated); }
  hide() { return this.setDrawerOpen(false); }
  _onToggleClicked(event) {
    event?.preventDefault();
    return this.setDrawerOpen(!(this.desiredOpen ?? this.open));
  }
  setDrawerOpen(open, animated = true) {
    this.desiredOpen = open;
    if (!this.drawerTransition) {
      this.drawerTransition = this.applyDrawerState(animated).finally(() => {
        this.drawerTransition = null;
        if (this.isConnected && this.open !== this.desiredOpen) this.setDrawerOpen(this.desiredOpen);
      });
    }
    return this.drawerTransition;
  }
  async applyDrawerState(animated) {
    while (this.isConnected && this.open !== this.desiredOpen) {
      if (this.desiredOpen) {
        // Close header menus before trapping focus in the cart.
        document.querySelectorAll('.monte-shop-disclosure[open], .monte-contact-disclosure[open]').forEach(menu => { menu.open = false; });
        await super.show(animated);
      } else {
        await super.hide();
      }
    }
  }
  _onVariantAdded(event) {
    // ProductForm emits variant:add before cart:change. Render first to avoid an empty-state flash.
    if (this.renderCart(event.detail.cart)) super._onVariantAdded(event);
    else this._onCartRefresh().then(() => {
      if (Number(this.querySelector('.monte-cart-view').dataset.itemCount) > 0) super._onVariantAdded(event);
    });
  }
  _onCartChanged(event) {
    if (!this.renderCart(event.detail.cart)) this._onCartRefresh();
  }
  _onCartRefresh() {
    if (this.refreshRequest) return this.refreshRequest;
    this.refreshRequest = this.refreshDrawer().catch(() => this.showError(this.dataset.error)).finally(() => { this.refreshRequest = null; });
    return this.refreshRequest;
  }
  async refreshDrawer() {
    const version = this.refreshVersion = (this.refreshVersion || 0) + 1;
    const url = new URL(window.Shopify.routes.root, location.origin);
    url.searchParams.set('section_id', this.dataset.sectionId);
    const html = await this.request(url, undefined, 'text');
    if (version !== this.refreshVersion || !this.isConnected) return;
    if (!this.renderCart({ sections: { [this.dataset.sectionId]: html } })) throw new Error(this.dataset.error);
  }
  renderCart(cart) {
    const html = cart?.sections?.[this.dataset.sectionId];
    if (!html) return false;
    if (html === this.lastCartMarkup) return true;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const incoming = doc.querySelector('.monte-cart-view');
    if (!incoming) return false;
    const current = this.querySelector('.monte-cart-view');
    const scrollTop = current.querySelector('.monte-cart-scroll').scrollTop;
    const scrollLeft = current.querySelector('.monte-cart-carousel')?.scrollLeft || 0;
    const focusKey = this.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
    const selections = Array.from(current.querySelectorAll('[data-cart-variant]'), select => [select.id, select.value]);
    const changedState = (Number(current.dataset.itemCount) === 0) !== (Number(incoming.dataset.itemCount) === 0);
    this.lastCartMarkup = html;
    this.refreshVersion = (this.refreshVersion || 0) + 1;
    current.replaceWith(incoming);
    this.querySelector('.monte-cart-scroll').scrollTop = changedState ? 0 : scrollTop;
    const carousel = this.querySelector('.monte-cart-carousel');
    if (carousel) carousel.scrollLeft = scrollLeft;
    for (const [id, value] of selections) {
      const select = this.querySelector(`[id="${CSS.escape(id)}"]`);
      if (select && Array.from(select.options).some(option => option.value === value && !option.disabled)) {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    this.bindCarousel();
    const count = this.querySelector('cart-count');
    count.itemCount = Number(incoming.dataset.itemCount);
    const updatedShipping = doc.querySelector('monte-cart-shipping');
    if (updatedShipping) this.querySelector('monte-cart-shipping').totalPrice = Number(updatedShipping.getAttribute('total-price'));
    if (focusKey && this.open) (this.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]:not(:disabled)`) || this).focus({ preventScroll: true });
    return true;
  }
  bindCarousel() {
    this.carouselObserver?.disconnect();
    const carousel = this.querySelector('.monte-cart-carousel');
    if (!carousel) return;
    carousel.addEventListener('scroll', () => this.updateCarousel(), { passive: true, signal: this._abortController.signal });
    this.carouselObserver = new ResizeObserver(() => this.updateCarousel());
    this.carouselObserver.observe(carousel);
    this.updateCarousel();
  }
  updateCarousel() {
    const carousel = this.querySelector('.monte-cart-carousel');
    if (!carousel) return;
    const max = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
    const position = Math.max(0, Math.min(max, carousel.scrollLeft));
    const track = this.querySelector('.monte-cart-carousel-track');
    const ratio = Math.min(1, carousel.clientWidth / (carousel.scrollWidth || 1));
    track.style.setProperty('--thumb-size', `${ratio * 100}%`);
    track.style.setProperty('--thumb-offset', `${max ? position / max * track.clientWidth * (1 - ratio) : 0}px`);
    this.querySelector('[data-carousel-direction="-1"]').disabled = position <= 1;
    this.querySelector('[data-carousel-direction="1"]').disabled = position >= max - 1;
  }
  showError(message) {
    const error = this.querySelector('[data-cart-error]');
    error.textContent = message;
    error.hidden = false;
  }
  async request(url, options, format = 'json') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { ...options, credentials: 'same-origin', signal: controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.description || body.message || this.dataset.error);
      }
      return await (format === 'text' ? response.text() : response.json());
    } finally { clearTimeout(timeout); }
  }
  async mutateCart(action) {
    if (this.mutating) return;
    this.mutating = true;
    this.setAttribute('aria-busy', 'true');
    this.querySelector('[data-cart-error]').hidden = true;
    const control = action.control || action.form.querySelector('[type="submit"]');
    control?.setAttribute('aria-busy', 'true');
    this.querySelector('.monte-cart-checkout')?.setAttribute('disabled', '');
    const root = window.Shopify.routes.root;
    try {
      const sections = [];
      document.documentElement.dispatchEvent(new CustomEvent('cart:prepare-bundled-sections', { bubbles: true, detail: { sections } }));
      let cart;
      if (action.type === 'add') {
        const id = Number(new FormData(action.form).get('id'));
        const current = await this.request(`${root}cart.js`);
        const existing = current.items.filter(item => item.variant_id === id && !item.selling_plan_allocation && Object.keys(item.properties || {}).length === 0);
        const input = action.form.querySelector('[name="id"]');
        const rules = (input.selectedOptions?.[0] || input).dataset;
        const quantity = Math.max(1, Number(existing.length ? rules.step : rules.min) || 1);
        const maximum = Math.min(50, Number(rules.max) || 50);
        if (quantity > maximum || existing.some(item => item.quantity + quantity > maximum)) throw new Error(this.dataset.limit);
        const added = await this.request(`${root}cart/add.js`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ items: [{ id, quantity }], sections: [...new Set(sections)], sections_url: location.pathname })
        });
        cart = await this.request(`${root}cart.js`);
        cart.sections = added.sections;
      } else {
        if (!Number.isInteger(action.quantity) || action.quantity < 0 || action.quantity > 50) throw new Error(this.dataset.limit);
        cart = await this.request(`${root}cart/change.js`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: action.key, quantity: action.quantity, sections: [...new Set(sections)], sections_url: location.pathname })
        });
      }
      document.documentElement.dispatchEvent(new CustomEvent('cart:change', { bubbles: true, detail: { baseEvent: action.type === 'add' ? 'variant:add' : 'line-item:change', cart } }));
      this.querySelector('[data-cart-status]').textContent = this.dataset.updated;
    } catch (error) {
      this.showError(error.name === 'AbortError' ? this.dataset.error : error.message);
      // A timed-out write may still have succeeded. Refresh, but never retry a cart mutation automatically.
      document.dispatchEvent(new CustomEvent('cart:refresh'));
    } finally {
      this.mutating = false;
      this.removeAttribute('aria-busy');
      control?.removeAttribute('aria-busy');
      this.querySelector('.monte-cart-checkout')?.removeAttribute('disabled');
    }
  }
}
if (!customElements.get('monte-cart-shipping')) customElements.define('monte-cart-shipping', MonteCartShipping);
if (!customElements.get('monte-cart-drawer')) customElements.define('monte-cart-drawer', MonteCartDrawer);
