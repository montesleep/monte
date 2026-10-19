class MonteFaqNavigation extends HTMLElement {
  connectedCallback() {
    this.controller?.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.track = this.querySelector('.monte-faq-nav__track');
    this.progress = this.querySelector('.monte-faq-nav__progress');
    this.links = [...this.querySelectorAll('.monte-faq-nav__link')];
    this.bindTargets();
    this.track.addEventListener('scroll', () => this.updateProgress(), { passive: true, signal });
    this.addEventListener('click', event => {
      const link = event.target.closest('.monte-faq-nav__link');
      if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      event.preventDefault();
      const heading = target.querySelector('h2') || target;
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      history.replaceState(null, '', link.hash);
    }, { signal });
    this.resizeObserver = new ResizeObserver(() => this.updateProgress());
    this.resizeObserver.observe(this.track);
    this.links.forEach(link => this.resizeObserver.observe(link));
    ['shopify:section:load', 'shopify:section:unload', 'shopify:section:reorder'].forEach(type => {
      document.addEventListener(type, () => requestAnimationFrame(() => { if (this.isConnected) this.bindTargets(); }), { signal });
    });
  }

  bindTargets() {
    const targets = [...(this.closest('main') || document).querySelectorAll('monte-faq')]
      .filter(faq => this.compareDocumentPosition(faq) & Node.DOCUMENT_POSITION_FOLLOWING);
    this.links.forEach((link, index) => {
      const section = targets[index]?.closest('.shopify-section');
      link.hidden = !section;
      if (section) link.href = `#${section.id}`;
    });
    this.updateProgress();
  }

  updateProgress() {
    const max = this.track.scrollWidth - this.track.clientWidth;
    this.progress.hidden = max <= 1 || matchMedia('(min-width: 1000px)').matches;
    const progress = max > 1 ? (this.track.clientWidth + Math.max(0, this.track.scrollLeft)) / this.track.scrollWidth : 1;
    this.style.setProperty('--faq-progress', `${Math.min(1, progress) * 100}%`);
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.resizeObserver?.disconnect();
  }
}

class MonteContact extends HTMLElement {
  connectedCallback() {
    this.controller?.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.form = this.querySelector('form');
    this.button = this.querySelector('button[type="submit"]');
    if (!this.form || !this.button) return;
    this.fields = [...this.form.querySelectorAll('[required]')];
    const validate = () => this.validate();
    this.form.addEventListener('input', validate, { signal });
    this.form.addEventListener('change', validate, { signal });
    this.form.addEventListener('focusin', validate, { signal });
    window.addEventListener('pageshow', validate, { signal });
    this.form.addEventListener('submit', event => {
      if (!this.validate()) {
        event.preventDefault();
        this.form.reportValidity();
      }
    }, { signal });
    this.validate();
  }

  validate() {
    const valid = this.fields.every(field => field.type === 'checkbox'
      ? field.checked
      : field.value.trim().length > 0 && field.validity.valid);
    this.button.disabled = !valid;
    return valid;
  }

  disconnectedCallback() { this.controller?.abort(); }
}

if (!customElements.get('monte-faq-navigation')) customElements.define('monte-faq-navigation', MonteFaqNavigation);
if (!customElements.get('monte-contact')) customElements.define('monte-contact', MonteContact);
