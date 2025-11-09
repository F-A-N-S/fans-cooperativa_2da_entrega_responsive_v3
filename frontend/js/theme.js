// Toggle claro/oscuro global
(() => {
  const KEY = 'fans_theme';
  const doc = document.documentElement;

  // Tema inicial
  const saved = localStorage.getItem(KEY);
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const start = saved || (prefersDark ? 'dark' : 'light');
  doc.setAttribute('data-theme', start);

  // Sincroniza iconos del botón
  function syncButton(btn){
    if(!btn) return;
    const dark = doc.getAttribute('data-theme') === 'dark';
    const sun = btn.querySelector('[data-sun]');
    const moon = btn.querySelector('[data-moon]');
    if(sun && moon){
      sun.style.display  = dark ? 'none' : 'inline';
      moon.style.display = dark ? 'inline' : 'none';
    }
    btn.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme-toggle]');
    if(!btn) return;
    const next = doc.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    doc.setAttribute('data-theme', next);
    localStorage.setItem(KEY, next);
    syncButton(btn);
  });

  // Al cargar, sincroniza
  syncButton(document.querySelector('[data-theme-toggle]'));
})();