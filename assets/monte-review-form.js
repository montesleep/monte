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
    // Keep Judge.me's device history and native repeat/close handlers intact.
    const repeatText = modal.querySelector(`.${prefix}__repeat-prompt-text`);
    const repeatCopy = 'Już oceniłeś ten produkt z tego urządzenia. Czy chcesz napisać kolejną recenzję?';
    if (repeatText && repeatText.textContent !== repeatCopy) repeatText.textContent = repeatCopy;
    const writeAnother = modal.querySelector(`.${prefix}__btn--repeat-write-another`);
    if (writeAnother && writeAnother.textContent !== 'Napisz kolejną recenzję') writeAnother.textContent = 'Napisz kolejną recenzję';
    const notNow = modal.querySelector(`.${prefix}__btn--repeat-not-now`);
    if (notNow) {
      notNow.classList.add('button--outline');
      if (!notNow.querySelector('.monte-repeat-label-desktop')) {
        const desktop = document.createElement('span');
        desktop.className = 'monte-repeat-label-desktop';
        desktop.textContent = 'Nie teraz';
        const mobile = document.createElement('span');
        mobile.className = 'monte-repeat-label-mobile';
        mobile.textContent = 'Nie teraz';
        notNow.replaceChildren(desktop, mobile);
      }
    }
    [writeAnother, notNow].forEach(button => {
      if (button) button.dataset.monteMotion = 'button';
    });
  };
  decorate();
  observer = new MutationObserver(decorate);
  observer.observe(modal, { childList: true, subtree: true });
}
