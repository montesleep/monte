class MonteMission extends HTMLElement {
  connectedCallback() {
    this.observer?.disconnect();
    if (this.hasAttribute('data-revealed') || matchMedia('(prefers-reduced-motion: reduce)').matches || window.Shopify?.designMode) {
      this.setAttribute('data-revealed', '');
      return;
    }
    // The rotation belongs to the outer wrapper; only its media slides in.
    this.setAttribute('data-animate', '');
    this.observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      this.setAttribute('data-revealed', '');
      this.observer.disconnect();
    }, { threshold: .15 });
    const target = matchMedia('(min-width: 1000px)').matches ? this : this.querySelector('.monte-mission__mobile');
    this.observer.observe(target || this);
  }
  disconnectedCallback() { this.observer?.disconnect(); }
}
if (!customElements.get('monte-mission')) customElements.define('monte-mission', MonteMission);

