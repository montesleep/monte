import { SearchDrawer } from 'theme';

class MonteSearchDrawer extends SearchDrawer {
  get initialFocus() { return this; }
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
    this.input.addEventListener('input', () => this.onInput(), { signal });
    this.form.addEventListener('submit', event => {
      event.preventDefault();
      this.onInput(true);
    }, { signal });
    this.querySelector('[data-search-retry]').addEventListener('click', () => this.onInput(true), { signal });
    this.addEventListener('dialog:after-hide', () => this.resetSearch(), { signal });
    window.addEventListener('resize', () => { if (this.open) this._setInitialPosition(); }, { signal });
  }
  disconnectedCallback() {
    this.cancelSearch();
    super.disconnectedCallback();
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
    const query = this.input.value.trim();
    this.toggleAttribute('has-text', query.length > 0);
    const active = Array.from(query).length >= 3;
    this.toggleAttribute('has-query', active);
    this.idle.hidden = active;
    this.results.hidden = !active;
    this.results.replaceChildren();
    this.loading.hidden = !active;
    this.error.hidden = true;
    this.status.textContent = '';
    this.scrollArea.scrollTop = 0;
    if (!active) return;
    const version = this.version;
    this.searchTimer = setTimeout(() => this.search(query, version), immediate ? 0 : 250);
  }
  async search(query, version) {
    if (version !== this.version || !this.isConnected) return;
    const request = this.request = new AbortController();
    this.results.setAttribute('aria-busy', 'true');
    const url = new URL(this.form.action, location.origin);
    url.search = new URLSearchParams({ q: query, type: 'product', 'options[prefix]': 'last', section_id: 'monte-search-results' }).toString();
    let next = url.href;
    let firstPage = true;
    const seenPages = new Set();
    const seenProducts = new Set();
    try {
      // Fetch successive Shopify search pages so results are not capped at predictive search's 10 products.
      while (next && !seenPages.has(next)) {
        seenPages.add(next);
        const response = await fetch(next, { signal: request.signal, credentials: 'same-origin' });
        if (!response.ok) throw new Error('Search request failed');
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        if (version !== this.version || !this.isConnected) return;
        const page = doc.querySelector('[data-search-page]');
        if (!page) throw new Error('Search markup missing');
        if (firstPage) {
          this.results.replaceChildren(...page.childNodes);
          this.results.querySelectorAll('[data-product-id]').forEach(card => seenProducts.add(card.dataset.productId));
          this.status.textContent = page.dataset.status;
          firstPage = false;
        } else {
          const grid = this.results.querySelector('.monte-search-grid');
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
