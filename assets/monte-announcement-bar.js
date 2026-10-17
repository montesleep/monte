// A shared campaign deadline; no visitor storage or automatic restarts.
class MonteAnnouncementBar extends HTMLElement {
  connectedCallback() {
    this.disconnectedCallback();
    this.fields = ['days', 'hours', 'minutes', 'seconds'].map(unit => this.querySelector(`[data-countdown-${unit}]`));
    if (this.fields.some(field => !field)) return;

    const start = this.getAttribute('data-campaign-start') || '';
    const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):00([+-])(0\d|1[0-4]):([0-5]\d)$/.exec(start);
    const calendarDate = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
    const validDate = calendarDate && calendarDate.getUTCFullYear() === +match[1]
      && calendarDate.getUTCMonth() === +match[2] - 1 && calendarDate.getUTCDate() === +match[3]
      && (+match[7] < 14 || +match[8] === 0);
    this.start = validDate ? Date.parse(start) : NaN;
    const notice = this.querySelector('[data-countdown-notice]');
    if (notice) notice.hidden = Number.isFinite(this.start);
    if (!Number.isFinite(this.start)) {
      this.render(0);
      return;
    }

    this.end = this.start + 72 * 60 * 60 * 1000;
    this.tick = () => {
      const remaining = Math.min(72 * 60 * 60, Math.max(0, Math.ceil((this.end - Date.now()) / 1000)));
      this.render(remaining);
      if (remaining === 0) this.disconnectedCallback();
    };
    this.visibilityHandler = () => { if (!document.hidden) this.tick(); };
    this.interval = window.setInterval(this.tick, 1000);
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.tick();
  }

  disconnectedCallback() {
    window.clearInterval(this.interval);
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

  render(seconds) {
    const values = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
    this.fields.forEach((field, index) => {
      const value = String(values[index]).padStart(2, '0');
      if (field.textContent !== value) field.textContent = value;
    });
  }
}

if (!customElements.get('monte-announcement-bar')) {
  customElements.define('monte-announcement-bar', MonteAnnouncementBar);
}
