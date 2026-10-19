// Shared button feedback, including controls inserted by drawers and the theme editor.
const candidates = [
  'button', 'summary', 'a.button', 'a.btn', 'a[role="button"]',
  'a[class*="button"]', 'a[class*="btn"]', 'a[class*="cta"]',
  'a.link', 'a.link-faded', 'a.link-faded-reverse', 'a.reversed-link',
  '.mb-button', '.monte-search-tag', '.monte-header-link',
  '.monte-faq-nav__link', '.dropdown-menu__item', '.monte-contact-links a',
  '.mp-bundle-choice', '.mp-swatch', '.monte-product-card__swatches a'
].join(',');
const excluded = [
  '[data-monte-motion="off"]', '[data-tooltip]', '.mp-gallery-slide',
  '.mp-ugc-item', '.monte-product-card__media', '.product-gallery__media',
  '.product-gallery__thumbnail', '.mp-gallery-thumbs button',
  '.mp-gallery-dots button', '.hot-spot__dot', '.shop-the-look__dot',
  '[class*="overlay"]', '[class*="backdrop"]'
].join(',');
const filled = [
  '.button', '.btn', 'a[class*="button"]', 'a[class*="btn"]', 'a[class*="cta"]',
  '.mb-button', '.mp-atc', '.mp-pick', '.mp-small-primary',
  '.monte-cart-button', '.monte-search-tag', '.monte-faq-nav__link',
  '.monte-catalog__sort-button', '.mfooter__submit-btn', '.circle-button',
  '.back-button', '.tap-area', '.monte-header-button', '[is="close-button"]',
  '.mp-bundle-choice', '.mp-swatch', '.monte-product-card__swatches a'
].join(',');
const blocked = ':disabled, [disabled], [aria-disabled="true"], [aria-busy="true"], [loading]';
const prepared = new WeakSet();
const outlineSelector = '.button--outline, .mb-button--outline, .monte-cart-button--outline';
// Size the circle to reach the top corners, including resized or newly revealed controls.
const fillResize = new ResizeObserver(entries => {
  for (const { target } of entries) {
    target.style.setProperty('--monte-fill-radius', `${Math.hypot(target.offsetWidth / 2, target.offsetHeight) + 1}px`);
  }
});

function prepare(element) {
  if (prepared.has(element)) {
    if (element.matches(outlineSelector)) fillResize.observe(element);
    return;
  }
  if (element.matches(excluded) ||
      element.closest('.shopify-app-block, .shopify-payment-button, model-viewer, .pswp')) return;
  prepared.add(element);
  const style = getComputedStyle(element);
  // Preserve component transitions, including chevrons, opacity and loading feedback.
  element.style.setProperty('--monte-button-transition', style.transition);
  const isText = !element.matches(filled) && element.textContent.trim().length > 0;
  if (element.matches(outlineSelector)) {
    element.style.setProperty('--monte-outline-shadow', style.boxShadow === 'none'
      ? 'inset 0 0 0 0 #232e71' : style.boxShadow);
    element.style.setProperty('--monte-fill-radius', `${Math.hypot(element.offsetWidth / 2, element.offsetHeight) + 1}px`);
    fillResize.observe(element);
  }
  element.dataset.monteMotion = isText ? 'text' : 'button';
  if (style.display === 'inline') element.dataset.monteMotionInline = '';
  if (style.position === 'static') element.dataset.monteMotionRelative = '';
  // Extend the transparent hit area to retain the original target when scaled down.
  // Existing pseudo-elements and clipped media controls keep their own hit areas.
  if (!element.matches('.mp-bundle-choice') && style.overflowX === 'visible' && style.overflowY === 'visible' &&
      ['none', 'normal'].includes(getComputedStyle(element, '::after').content)) {
    element.dataset.monteMotionHit = '';
  }
}

function scan(root) {
  if (root instanceof Element && root.matches(candidates)) prepare(root);
  root.querySelectorAll?.(candidates).forEach(prepare);
}
scan(document);
new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.removedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches(outlineSelector)) fillResize.unobserve(node);
      node.querySelectorAll(outlineSelector).forEach(element => fillResize.unobserve(element));
    }
    for (const node of record.addedNodes) {
      if (node instanceof Element) scan(node);
    }
  }
}).observe(document.body, { childList: true, subtree: true });

// Native pointer activation stays native; keyboard activation gets the same feedback.
let pressed;
const release = () => {
  pressed?.removeAttribute('data-monte-pressed');
  pressed = null;
};
document.addEventListener('keydown', event => {
  if (event.repeat || !['Enter', ' '].includes(event.key)) return;
  const button = event.target.closest?.('[data-monte-motion]');
  if (!button || button.matches(blocked) || (event.key === ' ' && button.matches('a[href]'))) return;
  release();
  pressed = button;
  button.setAttribute('data-monte-pressed', '');
});
document.addEventListener('keyup', release);
document.addEventListener('focusout', release);
window.addEventListener('blur', release);
document.addEventListener('visibilitychange', release);
