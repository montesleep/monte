import { AccordionDisclosure } from 'theme';

class MonteFaqDisclosure extends AccordionDisclosure {
  async _transition(value) {
    // Serialize rapid clicks so an older close cannot hide a newly opened answer.
    const previous = this.transitionFinished;
    let finish;
    this.transitionFinished = new Promise(resolve => { finish = resolve; });
    try {
      if (previous) await previous;
      if (this.open !== value) return;
      if (value) {
        this.closest('monte-faq')?.querySelectorAll('details').forEach(item => {
          if (item !== this && item.open) item.open = false;
        });
      }
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.toggleAttribute('open', value);
      } else {
        await super._transition(value);
      }
      // Impact's attribute callback may run after a later click during collapse.
      this.setAttribute('aria-expanded', String(this.open));
    } finally {
      finish();
    }
  }
}

if (!customElements.get('monte-faq-disclosure')) {
  customElements.define('monte-faq-disclosure', MonteFaqDisclosure, { extends: 'details' });
}
