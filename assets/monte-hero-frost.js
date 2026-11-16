(() => {
  if (customElements.get('monte-hero-frost')) return;
  class MonteHeroFrost extends HTMLElement {
    connectedCallback() {
      if (this.started) return;
      this.started = true;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.hidden = true;
        return;
      }
      // Decode all layers before melting so slow assets cannot flash in mid-reveal.
      this.failSafe = window.setTimeout(() => { this.hidden = true; }, 6000);
      const images = [...this.querySelectorAll('img')];
      const heroImage = this.parentElement.querySelector('picture img');
      if (heroImage) images.push(heroImage);
      Promise.all(images.map(image => image.decode().catch(() => {}))).then(() => {
        if (!this.isConnected || this.hidden) return;
        this.startTimer = window.setTimeout(() => {
          if (!this.isConnected || this.hidden) return;
          this.classList.add('is-defrosting');
          this.endTimer = window.setTimeout(() => {
            this.hidden = true;
            window.clearTimeout(this.failSafe);
          }, 2050);
        }, 500);
      });
    }
    disconnectedCallback() {
      window.clearTimeout(this.startTimer);
      window.clearTimeout(this.endTimer);
      window.clearTimeout(this.failSafe);
    }
  }
  customElements.define('monte-hero-frost', MonteHeroFrost);
})();
