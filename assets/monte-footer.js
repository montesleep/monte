class MonteFooterNewsletter extends HTMLElement {
  connectedCallback() {
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      this.subscribe();
    }, { signal: this.abortController.signal });
  }
  disconnectedCallback() {
    this.abortController?.abort();
    this.requestController?.abort();
  }
  async subscribe() {
    const form = this.querySelector('form');
    if (this.submitting || !form.reportValidity()) return;
    const publicKey = this.dataset.publicKey.trim(), listId = this.dataset.listId.trim();
    // Empty configuration intentionally validates only; no request or success message is produced.
    if (!publicKey || !listId) return;
    const button = this.querySelector('button'), message = this.querySelector('[role="status"]');
    const email = form.elements.email.value.trim();
    this.submitting = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    message.hidden = true;
    this.requestController = new AbortController();
    const timeout = setTimeout(() => this.requestController.abort(), 15000);
    try {
      const response = await fetch(`https://a.klaviyo.com/client/subscriptions?company_id=${encodeURIComponent(publicKey)}`, {
        method: 'POST', credentials: 'omit', signal: this.requestController.signal,
        headers: { 'Content-Type': 'application/vnd.api+json', accept: 'application/vnd.api+json', revision: '2026-10-15' },
        body: JSON.stringify({ data: {
          type: 'subscription',
          attributes: { custom_source: 'Monté footer newsletter', profile: { data: { type: 'profile', attributes: { email, subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } } } } } },
          relationships: { list: { data: { type: 'list', id: listId } } }
        } })
      });
      if (!response.ok) throw new Error('Subscription failed');
      if (!this.isConnected) return;
      message.textContent = this.dataset.success;
      message.hidden = false;
      form.reset();
    } catch {
      if (this.isConnected) { message.textContent = this.dataset.error; message.hidden = false; }
    } finally {
      clearTimeout(timeout);
      this.submitting = false;
      button.disabled = false;
      form.removeAttribute('aria-busy');
    }
  }
}
if (!customElements.get('monte-footer-newsletter')) customElements.define('monte-footer-newsletter', MonteFooterNewsletter);
