// Lenis 1.3.27 (MIT): desktop wheel smoothing with native touch and dialog scrolling.
const root = document.documentElement;
const desktop = matchMedia('(min-width: 1000px) and (hover: hover) and (pointer: fine)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const loader = document.querySelector('script[data-monte-lenis-src]');
let Lenis;
let loading;
let instance;
let suspended = false;

function isLocked() {
  const body = getComputedStyle(document.body);
  const html = getComputedStyle(root);
  return root.classList.contains('lock') || body.position === 'fixed' ||
    [body.overflowY, html.overflowY].some(value => value === 'hidden' || value === 'clip');
}

function eligible() {
  return desktop.matches && !reducedMotion.matches && !window.Shopify?.designMode && !suspended && !isLocked();
}

function destroy() {
  instance?.destroy();
  instance = undefined;
  delete root.dataset.monteSmoothScroll;
}

async function reconcile() {
  if (!eligible()) {
    destroy();
    return;
  }
  if (instance) return;
  if (!Lenis) {
    if (!loading) {
      loading = import(loader.dataset.monteLenisSrc)
        .then(module => { Lenis = module.default; })
        .catch(() => { /* Native scrolling remains available if the asset cannot load. */ });
    }
    await loading;
  }
  if (!Lenis || instance || !eligible()) return;
  instance = new Lenis({
    autoRaf: true,
    lerp: 0.15,
    wheelMultiplier: 0.95,
    smoothWheel: true,
    syncTouch: false,
    anchors: false,
    allowNestedScroll: true,
    stopInertiaOnNavigate: true,
    respectReducedMotion: true,
    prevent: node => node instanceof Element && node.matches(
      'textarea, select, [contenteditable="true"], [role="dialog"], dialog, .drawer, .popover, .pswp'
    ),
    virtualScroll: () => {
      // A lock can be applied earlier in this event loop than the observer callback.
      if (isLocked()) {
        queueMicrotask(reconcile);
        return false;
      }
      return true;
    }
  });
  root.dataset.monteSmoothScroll = 'active';
}

// Existing Impact anchors, focus navigation and scroll restoration remain authoritative.
document.addEventListener('pointerdown', () => instance?.reset(), { passive: true, capture: true });
document.addEventListener('click', () => instance?.reset(), { passive: true, capture: true });
document.addEventListener('keydown', event => {
  if (['Tab', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) instance?.reset();
}, { capture: true });

const observer = new MutationObserver(reconcile);
observer.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
desktop.addEventListener('change', reconcile);
reducedMotion.addEventListener('change', reconcile);
window.addEventListener('pagehide', () => { suspended = true; destroy(); });
window.addEventListener('pageshow', () => { suspended = false; reconcile(); });
reconcile();
