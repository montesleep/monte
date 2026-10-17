import { NavigationDrawer } from 'theme';
import { animate } from 'vendor';

class MonteNavigationDrawer extends NavigationDrawer {
  get shouldAppendToBody() { return false; }
  get openFrom() { return 'left'; }
  get header() { return this.closest('.shopify-section').querySelector('store-header'); }
  get focusTrap() {
    const trap = super.focusTrap;
    trap.updateContainerElements([this.header, this]);
    return trap;
  }
  connectedCallback() {
    super.connectedCallback();
    const signal = this._abortController.signal;
    this.header.addEventListener('click', event => {
      const control = event.target.closest('a, button');
      if (this.open && control && !this.contains(control) && control.getAttribute('aria-controls') !== this.id) {
        this.focusTrap.deactivate({ returnFocus: false });
        this.hide();
      }
    }, { signal });
    this.addEventListener('dialog:after-hide', () => {
      this.controls.forEach(control => control.setAttribute('aria-label', this.dataset.openLabel));
      if (this._savedScroll) window.scrollTo({ top: this._savedScroll, behavior: 'instant' });
      this._savedScroll = 0;
    }, { signal });
    window.addEventListener('resize', () => {
      if (window.matchMedia('(min-width: 1150px)').matches) this.hide();
      else if (this.open) this._setInitialPosition();
    }, { signal });
  }
  show(animated = true) {
    if (this.open || window.matchMedia('(min-width: 1150px)').matches) return;
    this._savedScroll = window.scrollY;
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (this.header.hasAttribute('hide-on-scroll')) this.header.show();
    this.controls.forEach(control => control.setAttribute('aria-label', this.dataset.closeLabel));
    return super.show(animated);
  }
  _setInitialPosition() {
    const top = Math.max(0, this.header.closest('.shopify-section').getBoundingClientRect().bottom);
    this.style.setProperty('--monte-mobile-menu-top', `${top}px`);
    Object.assign(this.style, { top: `${top}px`, bottom: '0', left: '0', right: '0' });
  }
  async switchToPanel(panelIndex, linkListIndex = null) {
    if (this._isTransitioning) return;
    this._isTransitioning = true;
    const panels = this.querySelectorAll('.panel');
    const forward = linkListIndex !== null;
    const outgoing = panels[forward ? 0 : 1], incoming = panels[Number(panelIndex)];
    if (forward) {
      incoming.querySelectorAll('.panel__wrapper').forEach((list, index) => { list.hidden = index !== Number(linkListIndex); });
      this._returnControl = this.querySelector(`[data-panel="1-${linkListIndex}"]`);
      this.setExpanded(this._returnControl);
    } else this.setExpanded();
    outgoing.inert = true;
    incoming.inert = false;
    const direction = (document.dir === 'rtl' ? -1 : 1) * (forward ? 1 : -1);
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : .3;
    this._panelAnimations = [
      animate(outgoing, { transform: ['translateX(0%)', `translateX(${-direction * 100}%)`], opacity: [1, 0] }, { duration }),
      animate(incoming, { visibility: ['visible', 'visible'], transform: [`translateX(${direction * 100}%)`, 'translateX(0%)'], opacity: [0, 1] }, { duration })
    ];
    await Promise.all(this._panelAnimations.map(animation => animation.finished));
    outgoing.style.visibility = 'hidden';
    this._isTransitioning = false;
    if (this.open) (forward ? incoming.querySelector('.panel__wrapper:not([hidden]) .monte-menu-back') : this._returnControl)?.focus({ preventScroll: true });
  }
  reinitializeDrawer() {
    this._panelAnimations?.forEach(animation => animation.finish());
    super.reinitializeDrawer();
    this.querySelector('.panel').style.visibility = 'inherit';
    this.querySelectorAll('.panel').forEach((panel, index) => { panel.inert = index !== 0; });
    this.setExpanded();
    this._isTransitioning = false;
  }
}

class MonteMenuController extends HTMLElement {
  connectedCallback() {
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.header = this.closest('.shopify-section').querySelector('store-header');
    this.shop = this.header.querySelector('.monte-shop-disclosure');
    this.contact = this.header.querySelector('.monte-contact-disclosure');
    this.overlay = document.createElement('div');
    this.overlay.className = 'monte-menu-backdrop';
    this.overlay.hidden = true;
    this.overlay.setAttribute('aria-hidden', 'true');
    document.body.append(this.overlay);
    this.overlay.addEventListener('click', () => { this.shop.open = false; }, { signal });
    this.header.addEventListener('toggle', event => {
      if (event.target === this.shop && this.shop.open) this.contact.open = false;
      if (event.target === this.contact && this.contact.open) this.shop.open = false;
      this.update();
    }, { capture: true, signal });
    this.resize = new ResizeObserver(() => this.update());
    this.resize.observe(this.header);
    this.resize.observe(this.shop.querySelector('.monte-mega-menu'));
    window.addEventListener('scroll', () => this.update(), { passive: true, signal });
    window.addEventListener('resize', () => {
      if (window.innerWidth < 1150) { this.shop.open = false; this.contact.open = false; }
      this.update();
    }, { signal });
    this.update();
  }
  update() {
    const panel = this.shop.querySelector('.monte-mega-menu');
    this.header.style.setProperty('--monte-menu-available-height', `${Math.max(0, window.innerHeight - this.header.getBoundingClientRect().bottom)}px`);
    this.overlay.hidden = !this.shop.open || window.innerWidth < 1150;
    this.overlay.style.top = `${panel.getBoundingClientRect().bottom}px`;
  }
  disconnectedCallback() { this.abort?.abort(); this.resize?.disconnect(); this.overlay?.remove(); }
}
if (!customElements.get('monte-navigation-drawer')) customElements.define('monte-navigation-drawer', MonteNavigationDrawer);
if (!customElements.get('monte-menu-controller')) customElements.define('monte-menu-controller', MonteMenuController);
