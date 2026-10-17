// A shared campaign deadline; no visitor storage or automatic restarts.
class MonteAnnouncementBar extends HTMLElement {
  static parseStart(input) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):00$/.exec(input);
    if (!match) return NaN;
    const [, year, month, day, hour, minute] = match.map(Number);
    const wallTime = Date.UTC(year, month - 1, day, hour, minute);
    const date = new Date(wallTime);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return NaN;

    try {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Warsaw', calendar: 'gregory', numberingSystem: 'latn',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      });
      const localTime = timestamp => {
        const parts = Object.fromEntries(formatter.formatToParts(timestamp).map(part => [part.type, part.value]));
        return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
      };
      // Sample both sides of a clock change using Warsaw's time-zone rules.
      const offsets = new Set([-86400000, 0, 86400000].map(delta => {
        const probe = wallTime + delta;
        return localTime(probe) - probe;
      }));
      const candidates = [...offsets].map(offset => wallTime - offset)
        .filter(timestamp => localTime(timestamp) === wallTime);
      // Reject a skipped spring hour; use the first occurrence of a repeated autumn hour.
      return candidates.length ? Math.min(...candidates) : NaN;
    } catch {
      return NaN;
    }
  }

  connectedCallback() {
    this.disconnectedCallback();
    this.fields = ['days', 'hours', 'minutes', 'seconds'].map(unit => this.querySelector(`[data-countdown-${unit}]`));
    if (this.fields.some(field => !field)) return;

    const start = this.getAttribute('data-campaign-start') || '';
    this.start = MonteAnnouncementBar.parseStart(start);
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
