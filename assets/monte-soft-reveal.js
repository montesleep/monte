// One-time, fail-open reveals for page content. Navigation and dialogs retain Impact motion.
const enabled = document.documentElement.hasAttribute('data-monte-soft-reveal');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const atomic = [
  '.monte-product-card', '.mb-card', '.monte-feature', '.monte-catalog-promo',
  '.monte-reviews__content', '.monte-benefits', '.mp-gallery-main', '.mp-gallery-thumbs',
  '.mp-bundle-choice', '.mp-swatches', '.mp-trust-pills', '.mp-payments', '.mp-shipping',
  '.mp-ugc-track', '.mp-rating', '.mp-price', '.monte-reviews__rating',
  '.monte-collection-hero__rating', '.mfooter__wordmark', '.mfooter__socials',
  '.mfooter__payments', '.monte-story__media', '.monte-details__media',
  'details', 'form', '[data-monte-reveal]'
].join(',');
const candidates = [
  atomic, 'h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'blockquote',
  'button', 'a.button', '.mb-button', '.monte-faq-nav__link', 'picture', 'img', 'video',
  '.monte-categories__item', '.mfooter__brand-logo', '.monte-contact__input'
].join(',');
const excluded = [
  '[data-monte-reveal="off"]', '.sr-only', '[role="alert"]', '[aria-live]',
  '.shopify-app-block', '.shopify-payment-button', '.shopify-section-group-header-group',
  'x-slideshow', '[reveal-js]', '[reveal-on-scroll="true"]',
  '.drawer', '.popover', 'dialog', '[role="dialog"]', '.mb-dialog', '.pswp',
  '.mp-sticky', '.product-quick-add', '.mb-sticky', '.mb-summary-desktop',
  '.monte-mission__motion', '[data-reveal-item]'
].join(',');
const watched = new Set();
const revealed = new WeakSet();
const active = new Map();

function finish(element) {
  const animation = active.get(element);
  if (!animation) return;
  animation.cancel();
  active.delete(element);
}

function reveal(element, delay) {
  watched.delete(element);
  observer.unobserve(element);
  revealed.add(element);
  element.dataset.monteRevealed = '';
  const style = getComputedStyle(element);
  if (reducedMotion.matches || window.Shopify?.designMode || style.opacity === '0' ||
      style.display === 'contents' || element.contains(document.activeElement)) return;
  // Individual translate leaves card zoom, button scale, and component transforms intact.
  const animation = element.animate([
    { opacity: 0, translate: '0 12px' },
    { opacity: style.opacity, translate: style.translate === 'none' ? '0 0' : style.translate }
  ], { duration: 600, delay, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' });
  active.set(element, animation);
  animation.finished.then(() => finish(element), () => active.delete(element));
}

const observer = new IntersectionObserver(entries => {
  const groups = new Map();
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const element = entry.target;
    if (!element.isConnected || !element.getClientRects().length) continue;
    const section = element.closest('.shopify-section') || element.parentElement;
    const index = groups.get(section) || 0;
    groups.set(section, index + 1);
    reveal(element, Math.min(index * 50, 150));
  }
}, { threshold: 0, rootMargin: '0px 0px -16px 0px' });

function register(element) {
  if (revealed.has(element) || watched.has(element) || !element.closest('#main') ||
      element.closest(excluded) || element.parentElement?.closest(atomic)) return;
  // A paragraph's inline button and a list's contents enter together, not twice.
  if (element.parentElement?.closest('h1, h2, h3, h4, p, ul, ol, blockquote, picture, button, a.button')) return;
  if (element.matches('picture, img, video')) {
    const rect = element.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 80) return;
  }
  watched.add(element);
  observer.observe(element);
}

function scan(root) {
  if (!enabled || reducedMotion.matches || window.Shopify?.designMode) return;
  if (root instanceof Element && root.matches(candidates)) register(root);
  root.querySelectorAll?.(candidates).forEach(register);
}

if (enabled && !window.Shopify?.designMode) {
  scan(document);
  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) if (node instanceof Element) scan(node);
      for (const node of record.removedNodes) {
        if (!(node instanceof Element) || node.isConnected) continue;
        for (const element of watched) {
          if (node === element || node.contains(element)) {
            observer.unobserve(element);
            watched.delete(element);
          }
        }
        for (const element of active.keys()) {
          if (node === element || node.contains(element)) finish(element);
        }
      }
    }
  }).observe(document.getElementById('main'), { childList: true, subtree: true });

  document.addEventListener('focusin', event => {
    for (const element of active.keys()) if (element.contains(event.target)) finish(element);
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      for (const element of active.keys()) finish(element);
      observer.disconnect();
      watched.clear();
    } else scan(document);
  });
  window.addEventListener('pagehide', () => {
    for (const element of active.keys()) finish(element);
  });
}
