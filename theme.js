// Shared appearance setting for the profile pages and Japanese Learning.
(() => {
  const key = 'viet-dung-vu-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let saved;
  try { saved = localStorage.getItem(key); } catch { saved = null; }
  let manual = saved === 'light' || saved === 'dark';

  function apply(theme) {
    root.dataset.theme = theme;
    const dark = theme === 'dark';
    for (const button of document.querySelectorAll('[data-theme-toggle]')) {
      button.textContent = dark ? '☀' : '☾';
      button.setAttribute('aria-label', dark ? 'Bật chế độ sáng' : 'Bật chế độ tối');
      button.setAttribute('title', dark ? 'Bật chế độ sáng' : 'Bật chế độ tối');
      button.setAttribute('aria-pressed', String(dark));
    }
    const color = document.querySelector('meta[name="theme-color"]');
    if (color) color.content = dark ? color.dataset.themeDark : color.dataset.themeLight;
  }

  apply(manual ? saved : (system.matches ? 'dark' : 'light'));
  document.addEventListener('DOMContentLoaded', () => apply(root.dataset.theme));
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-theme-toggle]')) return;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    manual = true;
    try { localStorage.setItem(key, next); } catch { /* file previews can deny storage */ }
    apply(next);
  });
  system.addEventListener?.('change', event => {
    if (!manual) apply(event.matches ? 'dark' : 'light');
  });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    manual = event.newValue === 'light' || event.newValue === 'dark';
    apply(manual ? event.newValue : (system.matches ? 'dark' : 'light'));
  });
})();
