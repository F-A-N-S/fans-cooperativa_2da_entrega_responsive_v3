// Toggle tema (negro+verde / blanco+verde) con emoji 🌙/🌞
(() => {
  const KEY = 'fans_theme';
  function apply(mode) {
    const html = document.documentElement;
    html.classList.toggle('dark', mode === 'dark');
    html.classList.toggle('light', mode === 'light');
    localStorage.setItem(KEY, mode);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = mode === 'dark' ? '🌙' : '🌞';
    document.body.classList.toggle('dark-mode', mode === 'dark');
    document.body.classList.toggle('light-mode', mode === 'light');
  }
  const initial = localStorage.getItem(KEY) || 'dark';
  apply(initial);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#themeToggle');
    if (!b) return;
    e.preventDefault();
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    apply(next);
  }, {capture:true});
  window.addEventListener('pageshow', () => apply(localStorage.getItem(KEY) || initial));
})();