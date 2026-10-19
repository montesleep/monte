// One-time text reveals. Images, controls, navigation, and dialogs keep their own motion.
const enabled = document.documentElement.hasAttribute('data-monte-soft-reveal');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const candidates = 'h1, h2, h3, h4, h5, h6, p, blockquote, ul, ol, dl';
const excluded = [
  '[data-monte-reveal="off"]', '.sr-only', '[role="alert"]', '[aria-live]',
  '.shopify-app-block', '.shopify-payment-button', '.shopify-section-group-header-group',
  'x-slideshow', '[reveal-js]', '[reveal-on-scroll="true"]',
  '.drawer', '.popover', 'dialog', '[role="dialog"]', '.mb-dialog', '.pswp',
  '.mp-sticky', '.product-quick-add', '.mb-sticky', '.mb-summary-desktop',
  '.monte-mission__motion', '[data-reveal-item]', '.mp-bundle-slots',
  'monte-pdp-tabs', 'details', 'button', '[role="button"]', 'nav',
  '.monte-reviews__columns', '.monte-benefits'
].join(',');
const seen = new WeakSet();
const active = new Map();

function finish(element) {
  seen.add(element);
  observer.unobserve(element);
  const animation = active.get(element);
  active.delete(element);
  animation?.cancel();
  element.dataset.monteRevealed = 'visible';
}

const observer = new IntersectionObserver(entries => {
  for (const { target: element, isIntersecting } of entries) {
    if (!isIntersecting || seen.has(element) || !element.isConnected) continue;
    seen.add(element);
    observer.unobserve(element);
    const animation = active.get(element);
    if (!animation) continue;
    if (reducedMotion.matches || window.Shopify?.designMode) {
      finish(element);
      continue;
    }
    element.dataset.monteRevealed = 'animated';
    animation.play();
  }
}, { threshold: 0, rootMargin: '0px 0px -24px 0px' });

function register(element) {
  if (seen.has(element) || active.has(element) || !element.closest('#main') ||
      element.closest(excluded) || element.parentElement?.closest(candidates) ||
      !element.textContent.trim()) return;
  // Never animate media, cards, forms, or controls through a containing list.
  if (element.querySelector('img, picture, video, button, input, select, form, .monte-product-card')) return;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  if (!element.getClientRects().length || rect.top < window.innerHeight ||
      style.opacity === '0' || style.display === 'contents') {
    seen.add(element);
    return;
  }

  // Prepare only offscreen text before it can be painted in the viewport.
  // A paused animation holds the first frame until entry; it never restarts.
  let animation;
  try {
    animation = element.animate([
      { opacity: 0, translate: '0 10px' },
      { opacity: style.opacity, translate: style.translate === 'none' ? '0 0' : style.translate }
    ], { duration: 650, easing: 'cubic-bezier(.22, .61, .36, 1)', fill: 'both' });
    animation.pause();
    animation.currentTime = 0;
    active.set(element, animation);
    element.dataset.monteRevealed = 'pending';
    animation.finished.then(() => {
      if (active.get(element) !== animation) return;
      active.delete(element);
      animation.cancel();
    }, () => {
      if (active.get(element) === animation) active.delete(element);
    });
    observer.observe(element);
  } catch {
    animation?.cancel();
    finish(element);
  }
}

function scan(root) {
  if (!enabled || reducedMotion.matches || window.Shopify?.designMode) return;
  if (root instanceof Element && root.matches(candidates)) register(root);
  root.querySelectorAll?.(candidates).forEach(register);
}

function finishAll() {
  for (const element of active.keys()) finish(element);
}

if (enabled && !window.Shopify?.designMode) {
  scan(document);
  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) if (node instanceof Element) scan(node);
      for (const node of record.removedNodes) {
        if (!(node instanceof Element) || node.isConnected) continue;
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
    if (reducedMotion.matches) finishAll();
    else scan(document);
  });
  window.addEventListener('beforeprint', finishAll);
  window.addEventListener('pagehide', finishAll);
}
