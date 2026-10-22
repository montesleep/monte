const prefix = 'jdgm-write-review-modal';
let observer;

// Judge.me retains ownership of navigation, validation, consent and submission.
export function prepareReviewForm(productTitle) {
  const modal = document.querySelector(`.${prefix}`);
  if (!modal) return;
  modal.classList.add('monte-review-form');
  observer?.disconnect();
  const decorate = () => {
    modal.querySelectorAll(`.${prefix}__product-title`).forEach(node => {
      if (node.textContent !== productTitle) node.textContent = productTitle;
    });
    const nameLabel = modal.querySelector('label[for="jdgm-name-input"]');
    if (nameLabel && nameLabel.textContent !== 'Twoje imię (Wymagane)') nameLabel.textContent = 'Twoje imię (Wymagane)';
    modal.querySelector('#jdgm-name-input')?.setAttribute('placeholder', 'Twoje imię');
    modal.querySelectorAll(`.${prefix}__nav-btn-back`).forEach(button => button.classList.add('button--outline'));
    modal.querySelectorAll(`.${prefix}__close-btn`).forEach(button => button.setAttribute('aria-label', 'Zamknij formularz opinii'));
  };
  decorate();
  observer = new MutationObserver(decorate);
  observer.observe(modal, { childList: true, subtree: true });
}
