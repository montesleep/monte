import { SearchDrawer } from 'theme';
import { timeline, FocusTrap } from 'vendor';

class MonteSearchDrawer extends SearchDrawer {
  get initialFocus() { return this; }
  get focusTrap() {
    // Keep the input inactive on touch devices until the customer chooses it.
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
    this.form = this.querySelector('form');
    this.input = this.form.elements.q;
    this.results = this.querySelector('[data-search-results]');
    this.idle = this.querySelector('[data-search-idle]');
    this.loading = this.querySelector('[data-search-loading]');
    this.error = this.querySelector('[data-search-error]');
    this.status = this.querySelector('[data-search-status]');
    this.scrollArea = this.querySelector('.monte-search-scroll');
    const signal = this._abortController.signal;
    this.input.addEventListener('input', event => { if (!event.isComposing) this.onInput(); }, { signal });
    this.input.addEventListener('compositionend', () => this.onInput(), { signal });
    this.input.addEventListener('change', () => this.onInput(true), { signal });
    this.form.addEventListener('submit', event => {
      event.preventDefault();
      this.onInput(true);
    }, { signal });
    this.querySelector('[data-search-retry]').addEventListener('click', () => this.onInput(true), { signal });
    this.addEventListener('dialog:after-hide', () => this.resetSearch(), { signal });
    const resize = () => { if (this.open) this._setInitialPosition(); };
    window.addEventListener('resize', resize, { signal });
    window.visualViewport?.addEventListener('resize', resize, { signal });
  }
  disconnectedCallback() {
    this.cancelSearch();
    this.unlockPage();
    super.disconnectedCallback();
  }
  _setInitialPosition() {
    super._setInitialPosition();
    this.style.setProperty('--search-viewport-height', `${window.visualViewport?.height || window.innerHeight}px`);
  }
  lockPage() {
    if (this.pageLock) return;
    const body = document.body;
    const properties = ['position', 'top', 'left', 'right', 'width', 'overflow', 'padding-right'];
    this.pageLock = { x: window.scrollX, y: window.scrollY, styles: properties.map(name => [name, body.style.getPropertyValue(name), body.style.getPropertyPriority(name)]) };
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbar > 0) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + scrollbar}px`;
    Object.assign(body.style, { position: 'fixed', top: `${-this.pageLock.y}px`, left: `${-this.pageLock.x}px`, right: '0', width: '100%', overflow: 'hidden' });
    document.documentElement.classList.add('monte-search-locked');
  }
  unlockPage() {
    if (!this.pageLock) return;
    const { x, y, styles } = this.pageLock;
    this.pageLock = null;
    styles.forEach(([name, value, priority]) => value ? document.body.style.setProperty(name, value, priority) : document.body.style.removeProperty(name));
    document.documentElement.classList.remove('monte-search-locked');
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
        // Close header menus before trapping focus in search.
        document.querySelectorAll('.monte-shop-disclosure[open], .monte-contact-disclosure[open]').forEach(menu => { menu.open = false; });
        await super.show(animated);
      } else {
        this.cancelSearch();
        await super.hide();
      }
    }
  }
  cancelSearch() {
    clearTimeout(this.searchTimer);
    this.request?.abort();
    this.version = (this.version || 0) + 1;
    this.results?.setAttribute('aria-busy', 'false');
  }
  resetSearch() {
    this.cancelSearch();
    this.input.value = '';
    this.removeAttribute('has-query');
    this.removeAttribute('has-text');
    this.idle.hidden = false;
    this.results.hidden = true;
    this.results.replaceChildren();
    this.loading.hidden = true;
    this.error.hidden = true;
    this.status.textContent = '';
    this.scrollArea.scrollTop = 0;
  }
  onInput(immediate = false) {
    this.cancelSearch();
    const query = this.input.value.trim().replace(/\s+/g, ' ');
    this.toggleAttribute('has-text', query.length > 0);
    const active = Array.from(query).length >= 3 && this.searchWords(query).length > 0;
    this.toggleAttribute('has-query', active);
    this.idle.hidden = active;
    this.results.hidden = !active;
    if (!active) this.results.replaceChildren();
    this.loading.hidden = !active;
    const empty = this.results.querySelector('[data-search-empty]');
    if (active && empty) empty.hidden = true;
    this.error.hidden = true;
    this.status.textContent = '';
    this.scrollArea.scrollTop = 0;
    if (!active) return;
    const version = this.version;
    this.searchTimer = setTimeout(() => this.search(query, version), immediate ? 0 : 250);
  }
  async fetchPage(url, signal) {
    // Retry a transient network/Shopify failure once; never leave a request spinning indefinitely.
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (signal.aborted) throw new DOMException('Search cancelled', 'AbortError');
      signal.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 8000);
      try {
        const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin' });
        if (!response.ok) throw new Error('Search request failed');
        const html = await response.text();
        if (!html.includes('data-search-page')) throw new Error('Search markup missing');
        return html;
      } catch (error) {
        if (signal.aborted) throw new DOMException('Search cancelled', 'AbortError');
        if (attempt === 1) throw new Error('Search unavailable', { cause: error });
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
      }
    }
  }
  searchWords(value) {
    return value.normalize('NFC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  }
  matchesProduct(card, terms, exact = false) {
    const words = this.searchWords(`${card.dataset.searchTitle || ''} ${card.dataset.searchTags || ''}`);
    return terms.length > 0 && terms.every(term => words.some(word => exact ? word === term : word.startsWith(term)));
  }
  async search(query, version) {
    if (version !== this.version || !this.isConnected) return;
    const request = this.request = new AbortController();
    this.results.setAttribute('aria-busy', 'true');
    const terms = this.searchWords(query);
    const url = new URL(this.form.action, location.origin);
    url.search = new URLSearchParams({ q: terms.join(' '), type: 'product', 'options[prefix]': 'last', section_id: 'monte-search-results' }).toString();
    let next = url.href;
    let resultPage;
    let productsLabel = '';
    const seenPages = new Set();
    const seenProducts = new Set();
    try {
      // Fetch successive Shopify search pages so results are not capped at predictive search's 10 products.
      while (next && !seenPages.has(next)) {
        seenPages.add(next);
        const html = await this.fetchPage(next, request.signal);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        if (version !== this.version || !this.isConnected) return;
        const page = doc.querySelector('[data-search-page]');
        if (!page) throw new Error('Search markup missing');
        // Shopify's broad matching supplies candidates; only title/tag word prefixes qualify.
        page.querySelectorAll('[data-product-id]').forEach(card => {
          if (!this.matchesProduct(card, terms)) card.remove();
        });
        if (!resultPage) {
          resultPage = page;
          productsLabel = page.dataset.productsLabel;
          page.querySelectorAll('[data-product-id]').forEach(card => seenProducts.add(card.dataset.productId));
        } else {
          const grid = resultPage.querySelector('.monte-search-grid');
          page.querySelectorAll('[data-product-id]').forEach(card => {
            if (!seenProducts.has(card.dataset.productId)) {
              seenProducts.add(card.dataset.productId);
              grid.append(card);
            }
          });
        }
        next = page.dataset.nextUrl;
        if (next) {
          const nextUrl = new URL(next, url);
          nextUrl.searchParams.set('section_id', 'monte-search-results');
          nextUrl.searchParams.set('type', 'product');
          next = nextUrl.href;
        }
      }
      // Decide across all pages before rendering so prefix-only matches never flash before exact matches.
      const cards = Array.from(resultPage.querySelectorAll('[data-product-id]'));
      const exactMatches = new Set(cards.filter(card => this.matchesProduct(card, terms, true)));
      if (exactMatches.size) cards.forEach(card => { if (!exactMatches.has(card)) card.remove(); });
      const count = exactMatches.size || cards.length;
      this.results.replaceChildren(...resultPage.childNodes);
      const empty = this.results.querySelector('[data-search-empty]');
      empty.hidden = count > 0;
      this.results.querySelector('.monte-search-grid').hidden = count === 0;
      this.status.textContent = count ? `${productsLabel}: ${count}. ${query}` : empty.textContent.trim();
    } catch (error) {
      if (error.name !== 'AbortError' && version === this.version && this.isConnected) this.error.hidden = false;
    } finally {
      if (version === this.version && this.isConnected) {
        this.loading.hidden = true;
        this.results.setAttribute('aria-busy', 'false');
      }
    }
  }
}
if (!customElements.get('monte-search-drawer')) customElements.define('monte-search-drawer', MonteSearchDrawer);
