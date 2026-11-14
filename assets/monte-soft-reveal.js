// One owner for page-entry motion. Dialogs and interactive state changes stay with Impact.
const main = document.getElementById('main');
const enabled = document.documentElement.hasAttribute('data-monte-soft-reveal');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mobile = matchMedia('(max-width: 999px)');
const text = 'h1,h2,h3,h4,h5,h6,p,blockquote,ul,ol,dl';
const cards = '.monte-product-card,.mb-card,.monte-blog__card,.monte-feature,.monte-sleep-story__stat,.product-card,.blog-post-card';
const copies = '.monte-story__content,.monte-details__intro,.monte-faq__intro,.monte-mission__content,.monte-spotlight__content,.monte-catalog-promo__content,.monte-collection-hero__content,.monte-hero__content';
const media = [
  '.monte-story__media img', '.monte-spotlight__media img',
  '.monte-details__media img', '.monte-feature__media img',
  '.monte-blog__media img', '.monte-article__hero img',
  '.monte-collection-hero__media img', '.monte-catalog-promo__media img',
  '.monte-mission__motion img', '.monte-sleep-story__float img',
  '.monte-hero .content-over-media > picture > img'
].join(',');
const excluded = [
  '[data-monte-reveal="off"]', '.sr-only', '.visually-hidden', '[role="alert"]', '[aria-live]',
  '.shopify-app-block', '.shopify-payment-button', '.shopify-section-group-header-group',
  '.drawer', '.popover', 'dialog', '[role="dialog"]', '.mb-dialog', '.pswp',
  '.mp-sticky', '.product-quick-add', '.mb-sticky', '.mb-summary-desktop',
  '.mp-bundle-slots', 'monte-pdp-tabs', 'details', 'button', '[role="button"]',
  'nav', '[role="tablist"]', '.monte-reviews__columns', '.monte-benefits',
  '.mp-ugc-track', '[data-reveal-item]', '[reveal-js]',
  'x-slideshow:not(.monte-hero)', '[reveal-on-scroll="true"]'
].join(',');
const seen = new WeakSet();
const records = new Map();
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const element = entry.target;
    const record = records.get(element);
    if (!record || record.started) continue;
    if (disabled() || element.closest(excluded)) { finish(element); continue; }
    record.started = true;
    seen.add(element);
    observer.unobserve(element);
    element.dataset.monteRevealed = 'running';
    record.animation.play();
  }
}, { threshold: 0, rootMargin: '0px 0px 48px 0px' });

function disabled() {
  return !enabled || reducedMotion.matches || window.Shopify?.designMode;
}

function finish(element) {
  const record = records.get(element);
  records.delete(element);
  observer.unobserve(element);
  seen.add(element);
  // Cancel only our animation. Never cancel component hover, accordion, or drawer motion.
  record?.animation.cancel();
  element.dataset.monteRevealed = 'visible';
}

function hasEntryParent(element) {
  return element.parentElement?.closest('[data-monte-entry="text"],[data-monte-entry="card"]');
}

function register(element, kind) {
  if (seen.has(element) || records.has(element) || !main.contains(element) || element.closest(excluded)) return;
  if (kind !== 'image' && hasEntryParent(element)) return;
  // Defer hidden tabs and responsive alternatives until they are actually shown.
  const rect = element.getBoundingClientRect();
  if (!element.getClientRects().length || !rect.width || !rect.height || element.closest('[hidden]')) return;
  const style = getComputedStyle(element);
  if (style.visibility !== 'visible' || style.display === 'contents' || Number(style.opacity) === 0) return;
  element.dataset.monteEntry = kind;
  // Already visible content must never jump or disappear during module loading/history restore.
  if (rect.top < innerHeight) {
    seen.add(element);
    element.dataset.monteRevealed = 'visible';
    return;
  }
  let animation;
  try {
    let keyframes, duration;
    if (kind === 'image') {
      // Individual scale composes with the existing 1.03 hover transform.
      if (style.scale !== 'none' && style.scale !== '1') { finish(element); return; }
      keyframes = [{ scale: 1.1 }, { scale: 1 }];
      duration = mobile.matches ? 1000 : 1200;
    } else {
      if (style.translate !== 'none' && style.translate !== '0px') { finish(element); return; }
      let offset = mobile.matches ? 24 : 56;
      if (kind === 'card') {
        const siblings = [...element.parentElement.children].filter(child => child.matches(cards));
        const index = Math.max(0, siblings.indexOf(element)) % (mobile.matches ? 2 : 4);
        offset += index * (mobile.matches ? 10 : 20);
      }
      keyframes = [{ translate: `0 ${offset}px` }, { translate: '0 0' }];
      duration = kind === 'card' ? (mobile.matches ? 950 : 1200) : 750;
    }
    // Offscreen preparation keeps content opaque. There is no fade-out/re-hide cycle.
    animation = element.animate(keyframes, {
      duration, easing: 'cubic-bezier(.32,.71,.42,.94)', fill: 'both'
    });
    animation.pause();
    animation.currentTime = 0;
    records.set(element, { animation, started: false });
    element.dataset.monteRevealed = 'pending';
    animation.finished.then(() => {
      if (records.get(element)?.animation === animation) finish(element);
    }, () => {
      if (records.get(element)?.animation === animation) finish(element);
    });
    observer.observe(element);
  } catch {
    animation?.cancel();
    finish(element);
  }
}

function select(root, selector) {
  const result = [...(root.querySelectorAll?.(selector) || [])];
  if (root instanceof Element && root.matches(selector)) result.unshift(root);
  return result;
}

function scan(root = main) {
  if (disabled() || !main || !root) return;
  // Cards own their copy. Text inside them must not run a second entrance.
  select(root, cards).forEach(element => register(element, 'card'));
  select(root, copies).forEach(element => register(element, 'text'));
  select(root, text).forEach(element => {
    if (element.closest(cards + ',' + copies) || element.parentElement?.closest(text) || !element.textContent.trim()) return;
    // Lists with controls/media keep their own layout and interactions.
    if (element.querySelector('img,picture,video,button,input,select,form,article')) return;
    register(element, 'text');
  });
  select(root, media).forEach(element => register(element, 'image'));
}

function finishAll(root = main) {
  for (const element of records.keys()) {
    if (element === root || root?.contains(element)) finish(element);
  }
}

if (enabled && main && !window.Shopify?.designMode) {
  scan();
  let queued = false;
  const roots = new Set();
  function queue(root) {
    roots.add(root);
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      for (const root of roots) if (root.isConnected) scan(root);
      roots.clear();
    });
  }
  new MutationObserver(changes => {
    for (const change of changes) {
      if (change.type === 'attributes') {
        // A tab hidden mid-animation must never reopen in a half-finished state.
        if (change.target.hidden) finishAll(change.target);
        else queue(change.target);
        continue;
      }
      for (const node of change.addedNodes) if (node instanceof Element) queue(node);
      for (const node of change.removedNodes) {
        if (node instanceof Element && !node.isConnected) finishAll(node);
      }
    }
  }).observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('focusin', event => {
    for (const element of records.keys()) if (element.contains(event.target)) finish(element);
  });
  document.addEventListener('shopify:section:load', event => queue(event.target));
  document.addEventListener('shopify:section:unload', event => finishAll(event.target));
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) finishAll();
    else scan();
  });
  mobile.addEventListener('change', () => { finishAll(); queue(main); });
  window.addEventListener('beforeprint', () => finishAll());
  window.addEventListener('pagehide', () => finishAll());
  window.addEventListener('pageshow', event => { if (event.persisted) finishAll(); });
}
