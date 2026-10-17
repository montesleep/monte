class MonteCollectionGrid extends HTMLElement {
  connectedCallback() {
    this.listeners?.abort();
    this.listeners = new AbortController();
    const { signal } = this.listeners;
    this.currentUrl = new URL(location.href);
    this.currentSort = this.querySelector('[role="option"][aria-selected="true"]')?.getAttribute('value');
    // Impact moves mobile popovers to document.body while they are open.
    document.addEventListener('listbox:change', event => {
      const popover = event.target.closest('x-popover');
      if (popover?.id !== `monte-sort-${this.dataset.sectionId}`) return;
      event.stopPropagation();
      if (this.restoringSort) return;
      const url = new URL(location.href);
      url.searchParams.set('sort_by', event.detail.value);
      url.searchParams.delete('section_id');
      url.searchParams.delete('page');
      this.load(url, { historyMode: 'push', closed: popover.hide() });
    }, { signal, capture: true });
    this.addEventListener('click', event => {
      const link = event.target.closest('[data-load-more]');
      if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (!this.loading) this.load(new URL(link.href), { append: true });
    }, { signal });
    window.addEventListener('popstate', () => {
      if (location.pathname === this.currentUrl.pathname) this.load(new URL(location.href));
    }, { signal });
    // Liquid cannot override the collection's configured default sort order.
    // Request Shopify's best-selling order without changing shared collection settings.
    if (!this.currentUrl.searchParams.has('sort_by') && this.dataset.defaultSort !== 'best-selling') {
      const url = new URL(this.currentUrl);
      url.searchParams.set('sort_by', 'best-selling');
      url.searchParams.delete('page');
      this.load(url, { historyMode: 'replace' });
    }
  }
  disconnectedCallback() {
    this.listeners?.abort();
    this.request?.abort();
  }
  setBusy(busy) {
    this.loading = busy;
    this.querySelector('.monte-catalog__results')?.setAttribute('aria-busy', String(busy));
    this.querySelector('[data-load-more]')?.setAttribute('aria-disabled', String(busy));
  }
  async load(url, { append = false, historyMode, closed } = {}) {
    this.request?.abort();
    const request = this.request = new AbortController();
    this.setBusy(true);
    const status = this.querySelector('[role="status"]');
    status.textContent = '';
    status.classList.add('sr-only');
    const requestUrl = new URL(url);
    requestUrl.searchParams.set('section_id', this.dataset.sectionId);
    try {
      const [response] = await Promise.all([fetch(requestUrl, { signal: request.signal }), closed]);
      if (!response.ok) throw new Error('Collection request failed');
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const incoming = doc.querySelector('monte-collection-grid');
      if (!incoming || !incoming.querySelector('.monte-catalog__results')) throw new Error('Collection markup missing');
      if (request.signal.aborted || !this.isConnected) return;
      if (append) {
        const batch = incoming.querySelector('.monte-catalog__batch');
        if (!batch?.querySelector('.monte-product-card')) throw new Error('Product batch missing');
        const imported = document.importNode(batch, true);
        this.querySelector('.monte-catalog__results').append(imported);
        const more = this.querySelector('.monte-catalog__more');
        const nextMore = incoming.querySelector('.monte-catalog__more');
        const hadFocus = more.contains(document.activeElement);
        more.hidden = nextMore.hidden;
        more.querySelector('[data-load-more]').href = nextMore.querySelector('[data-load-more]').getAttribute('href') || '#';
        more.querySelector('.monte-catalog__summary').textContent = nextMore.querySelector('.monte-catalog__summary').textContent;
        const progress = more.querySelector('[role="progressbar"]');
        const nextProgress = nextMore.querySelector('[role="progressbar"]');
        progress.setAttribute('aria-valuenow', nextProgress.getAttribute('aria-valuenow'));
        progress.setAttribute('aria-valuemax', nextProgress.getAttribute('aria-valuemax'));
        progress.firstElementChild.style.width = nextProgress.firstElementChild.style.width;
        status.textContent = more.querySelector('.monte-catalog__summary').textContent;
        if (more.hidden && hadFocus) imported.querySelector('a').focus({ preventScroll: true });
      } else {
        this.replaceChildren(...document.importNode(incoming, true).childNodes);
        this.dataset.total = incoming.dataset.total;
        this.currentSort = this.querySelector('[role="option"][aria-selected="true"]')?.getAttribute('value');
        this.currentUrl = new URL(url);
        this.currentUrl.searchParams.delete('section_id');
        if (historyMode) history[historyMode === 'push' ? 'pushState' : 'replaceState']({}, '', this.currentUrl);
        this.querySelector('[role="status"]').textContent = this.querySelector('.monte-catalog__count').textContent;
        if (historyMode === 'push') this.querySelector('.monte-catalog__sort-button')?.focus({ preventScroll: true });
      }
    } catch (error) {
      if (error.name !== 'AbortError' && this.isConnected) {
        const status = this.querySelector('[role="status"]');
        status.textContent = this.dataset.error;
        status.classList.remove('sr-only');
        // Keep the visible sort label consistent with the products after a failed request.
        await closed;
        const selected = [...this.querySelectorAll('[role="option"]')].find(option => option.getAttribute('value') === this.currentSort);
        if (selected) {
          this.restoringSort = true;
          selected.closest('x-listbox').setAttribute('aria-activedescendant', selected.id);
          this.querySelector('.monte-catalog__sort-button span').textContent = selected.textContent.trim();
          this.restoringSort = false;
        }
      }
    } finally {
      if (this.request === request) this.setBusy(false);
    }
  }
}
if (!customElements.get('monte-collection-grid')) customElements.define('monte-collection-grid', MonteCollectionGrid);
