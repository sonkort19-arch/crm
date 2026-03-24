export function initMobileNav({ toggleEl, mediaQuery, bodyEl }) {
  if (!toggleEl) return;

  const syncMobileNavChrome = () => {
    if (!mediaQuery.matches) {
      bodyEl.classList.remove('mobile-nav-expanded');
      toggleEl.removeAttribute('aria-hidden');
      return;
    }
    // <=639px: нижний tab bar, режим "раскрытого" бокового меню не используется.
    bodyEl.classList.remove('mobile-nav-expanded');
    toggleEl.setAttribute('aria-expanded', 'false');
    toggleEl.setAttribute('aria-hidden', 'true');
    toggleEl.setAttribute('aria-label', 'Меню разделов');
  };

  toggleEl.addEventListener('click', () => {
    if (!mediaQuery.matches) return;
    bodyEl.classList.toggle('mobile-nav-expanded');
    syncMobileNavChrome();
  });

  const onMq = () => syncMobileNavChrome();
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', onMq);
  } else {
    mediaQuery.addListener(onMq);
  }
  syncMobileNavChrome();
}
