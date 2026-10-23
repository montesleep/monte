const reviewRequests = new Map();

// Keep three neighboring pages before the final page; omit dots when no pages are skipped.
function reviewPageNumbers(pages, current) {
  if (pages <= 4) return Array.from({ length: pages }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(current - 1, pages - 3));
  return [start, start + 1, start + 2, pages];
}
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const safeURL = value => {
  if (!value) return '';
  try { const url = new URL(value, location.origin); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; }
};

// Only published storefront widget data is requested. Private API keys never belong in a theme.
async function fetchProductReviews(config, product) {
  let page = 1;
  let total = Infinity;
  const reviews = new Map();
  while (reviews.size < total) {
    const url = new URL('https://api.judge.me/api/v1/widgets/product_review');
    url.search = new URLSearchParams({ api_token: config.token, shop_domain: config.shop, external_id: product.id, page, per_page: 100 });
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Review service unavailable');
    const data = await response.json();
    if (String(data.product_external_id) !== String(product.id) || typeof data.widget !== 'string') throw new Error('Unexpected review product');
    const doc = new DOMParser().parseFromString(data.widget, 'text/html');
    const widget = doc.querySelector('.jdgm-rev-widg');
    if (!widget || !widget.hasAttribute('data-number-of-reviews')) throw new Error('Invalid review response');
    total = Number(widget.dataset.numberOfReviews);
    if (!Number.isFinite(total) || total < 0) throw new Error('Invalid review count');
    const before = reviews.size;
    for (const row of doc.querySelectorAll('.jdgm-rev[data-review-id]')) {
      const score = Number(row.querySelector('.jdgm-rev__rating')?.dataset.score);
      if (score < 1 || score > 5 || !Number.isInteger(score)) continue;
      const body = row.querySelector('.jdgm-rev__body');
      body?.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
      body?.querySelectorAll('p').forEach(p => p.append('\n'));
      const photos = Array.from(row.querySelectorAll('.jdgm-rev__pics img')).map(img => ({
        thumb: safeURL(img.getAttribute('data-src') || img.getAttribute('src')),
        full: safeURL(img.closest('a')?.getAttribute('href') || img.getAttribute('data-src') || img.getAttribute('src'))
      })).filter(photo => photo.thumb && photo.full);
      reviews.set(row.dataset.reviewId, {
        id: row.dataset.reviewId, score, product,
        author: row.querySelector('.jdgm-rev__author')?.textContent.trim() || 'Klient',
        verified: row.dataset.verifiedBuyer === 'true',
        title: row.querySelector('.jdgm-rev__title')?.textContent.trim() || '',
        body: body?.textContent.trim() || '',
        date: row.querySelector('time')?.getAttribute('datetime') || '', photos
      });
    }
    if (reviews.size === before && reviews.size < total) throw new Error('Incomplete review response');
    page += 1;
  }
  return Array.from(reviews.values());
}

function loadGroup(config) {
  const products = Array.from(new Map(config.products.map(product => [String(product.id), product])).values());
  const key = `${config.shop}:${products.map(product => product.id).sort().join(',')}`;
  if (!reviewRequests.has(key)) {
    const request = Promise.all(products.map(product => fetchProductReviews(config, product))).then(groups => {
      const unique = new Map(groups.flat().map(review => [review.id, review]));
      return Array.from(unique.values()).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || a.id.localeCompare(b.id));
    }).catch(error => { reviewRequests.delete(key); throw error; });
    reviewRequests.set(key, request);
  }
  return reviewRequests.get(key);
}

function reviewStars(config, rating, count = 5, hero = false) {
    const assets = config.assets;
    const visualRating = Math.floor(rating * 2) / 2;
    return `<span class="monte-social-rating" role="img" aria-label="${rating.toFixed(1)} z 5 gwiazdek">${Array.from({ length: count }, (_, index) => {
      const fill = Math.min(1, Math.max(0, visualRating - index)) * 100;
      return `<span class="monte-social-rating__star" aria-hidden="true"><img src="${escapeHTML(hero ? assets.heroBase : assets.base)}" width="16" height="16" alt=""><img src="${escapeHTML(assets.fill)}" width="16" height="16" alt="" style="clip-path:inset(0 ${100 - fill}% 0 0)"><img class="monte-social-rating__glyph" src="${escapeHTML(assets.glyph)}" width="12.618" height="12" alt=""></span>`;
    }).join('')}</span>`;
  }

function renderProductRating(element, config, reviews) {
  const count = reviews.length;
  const average = count ? reviews.reduce((sum, review) => sum + review.score, 0) / count : 0;
  element.innerHTML = count ? `${reviewStars(config, average, 5, true)}<span>Ocena <strong>${average.toFixed(1)}</strong>/5 | <strong>${count} ${count === 1 ? 'recenzja' : 'recenzji'}</strong>.</span>` : '';
  element.hidden = count === 0;
}

// Quickviews use the same grouped reviews without mounting a full reviews section.
export async function loadProductRating(element, config) {
  element.hidden = true;
  try {
    if (!config.token) return;
    const reviews = await loadGroup(config);
    if (element.isConnected) renderProductRating(element, config, reviews);
  } catch {
    element.hidden = true;
  }
}

class MonteProductReviews extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.abort = new AbortController();
    this.config = JSON.parse(this.querySelector('[data-review-config]').textContent);
    this.page = 1;
    this.addEventListener('click', event => {
      const page = event.target.closest('[data-review-page]');
      if (page) { this.page = Number(page.dataset.reviewPage); this.renderPage(true); }
      if (event.target.closest('[data-write-review]')) this.openForm();
      if (event.target.closest('[data-review-retry]')) this.load();
    }, { signal: this.abort.signal });
    this.load();
  }

  disconnectedCallback() { this.abort?.abort(); this.initialized = false; }

  stars(rating, count = 5, hero = false) { return reviewStars(this.config, rating, count, hero); }

  async load() {
    const summary = this.querySelector('[data-review-summary]');
    const status = this.querySelector('[data-review-status]');
    status.textContent = '';
    this.setAttribute('aria-busy', 'true');
    try {
      if (!this.config.token) throw new Error('Missing public token');
      this.reviews = await loadGroup(this.config);
      if (!this.isConnected) return;
      const count = this.reviews.length;
      const average = count ? this.reviews.reduce((sum, review) => sum + review.score, 0) / count : 0;
      const histogram = [5, 4, 3, 2, 1].map(score => {
        const frequency = this.reviews.filter(review => review.score === score).length;
        return `<div class="mpr-histogram-row" aria-label="${score} gwiazdek: ${frequency}"><span>${score}</span>${this.stars(5, 1)}<span class="mpr-histogram-track"><span class="mpr-histogram-fill" style="width:${count ? frequency / count * 100 : 0}%"></span></span><span>${frequency}</span></div>`;
      }).join('');
      summary.innerHTML = `<div class="mpr-score"><span class="mpr-score-number">${average.toFixed(1)}</span>${this.stars(average)}<span>Na podstawie ${count} opinii</span></div><div class="mpr-histogram">${histogram}</div>`;
      document.querySelectorAll(`[data-product-review-rating="${this.dataset.productId}"]`).forEach(rating => {
        renderProductRating(rating, this.config, this.reviews);
      });
      this.renderPage();
    } catch (error) {
      summary.innerHTML = '';
      status.innerHTML = 'Nie udało się załadować opinii. <button type="button" class="link" data-review-retry>Spróbuj ponownie</button>';
      if (window.Shopify?.designMode && !this.config.token) status.textContent = 'Add the Judge.me public API token in Theme settings > Monté product reviews.';
    } finally { this.removeAttribute('aria-busy'); }
  }

  renderReview(review) {
    const initials = review.author.split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join('').toUpperCase();
    const date = Date.parse(review.date);
    const dateText = Number.isNaN(date) ? '' : new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    return `<article class="mpr-review" data-review-id="${escapeHTML(review.id)}">
      <div class="mpr-content">
        <div class="mpr-review-top">${this.stars(review.score)}</div>
        <div class="mpr-copy">${review.title ? `<h3 class="mpr-title">${escapeHTML(review.title)}</h3>` : ''}<p class="mpr-body">${escapeHTML(review.body)}</p></div>
        ${review.photos.length ? `<div class="mpr-photos">${review.photos.map(photo => `<a href="${escapeHTML(photo.full)}" target="_blank" rel="noopener" aria-label="Otwórz zdjęcie z opinii"><img src="${escapeHTML(photo.thumb)}" alt="Zdjęcie z opinii klienta" width="80" height="80" loading="lazy"></a>`).join('')}</div>` : ''}
      </div>
      <div class="mpr-author"><div class="mpr-person"><span class="mpr-avatar" aria-hidden="true">${escapeHTML(initials)}</span><div><strong>${escapeHTML(review.author)}</strong>${review.verified ? `<div class="mpr-verification">Zweryfikowany klient<img src="${escapeHTML(this.config.assets.verified)}" width="16" height="16" alt=""></div>` : ''}</div></div>
        <a class="mpr-product" href="${escapeHTML(review.product.url)}">${review.product.image ? `<img src="${escapeHTML(review.product.image)}" alt="" width="48" height="48" loading="lazy">` : ''}<span><strong>Recenzja na:</strong>${escapeHTML(review.product.title)}</span></a>
      </div>
      <time class="mpr-date" datetime="${escapeHTML(review.date)}">${dateText}</time>
    </article>`;
  }

  renderPage(shouldFocus = false) {
    const list = this.querySelector('[data-review-list]');
    list.innerHTML = this.reviews.length ? this.reviews.slice((this.page - 1) * 5, this.page * 5).map(review => this.renderReview(review)).join('') : '<p>Ten produkt nie ma jeszcze opinii. Zostaw pierwszą!</p>';
    const pages = Math.ceil(this.reviews.length / 5);
    const visiblePages = reviewPageNumbers(pages, this.page);
    let previous = 0;
    this.querySelector('[data-review-pagination]').innerHTML = pages > 1 ? visiblePages.map(page => {
      const gap = previous && page > previous + 1 ? '<span class="mpr-pagination-ellipsis" aria-hidden="true">…</span>' : '';
      previous = page;
      return `${gap}<button type="button" data-review-page="${page}" aria-label="Strona opinii ${page}" ${page === this.page ? 'aria-current="page"' : ''}>${page}</button>`;
    }).join('') : '';
    if (shouldFocus) {
      list.focus({ preventScroll: true });
      list.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    }
  }

  async openForm() {
    const button = this.querySelector('[data-write-review]');
    const status = this.querySelector('[data-review-status]');
    button.disabled = true;
    status.textContent = '';
    try {
      // Judge.me's native form owns submission, verification, consent and media uploads.
      const start = Date.now();
      while (!window.jdgm?._WriteReviewModal || !window.jdgm?.$ || !window.jdgm?._resolveProductTitle) {
        if (Date.now() - start > 15000) throw new Error('Judge.me form unavailable');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!this.isConnected) return;
      window.jdgm.loadCSS(window.jdgm.widgetPath('form.css'));
      if (!window.jdgm._rtlStarsEnabled) {
        window.jdgm.loadScript(window.jdgm.CDN_HOST + 'widget/form.js');
      }
      while (!window.jdgm._rtlStarsEnabled || !document.querySelector('.jdgm-review-widget-modal.jdgm-write-review-modal')) {
        if (Date.now() - start > 15000) throw new Error('Judge.me form unavailable');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const { prepareReviewForm } = await import('./monte-review-form.js');
      prepareReviewForm(this.config.products[0].title);
      this.querySelector('.jdgm-write-rev-link').click();
    } catch {
      status.textContent = 'Nie udało się otworzyć formularza opinii. Spróbuj ponownie.';
    } finally { button.disabled = false; }
  }
}
if (!customElements.get('monte-product-reviews')) customElements.define('monte-product-reviews', MonteProductReviews);
