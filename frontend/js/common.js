// frontend/js/common.js
(() => {
  // ===== Tema claro/oscuro
  const KEY = 'fans_theme';
  const html = document.documentElement;
  const btn  = document.querySelector('[data-theme-toggle], #themeToggle');
  const icon = document.querySelector('[data-theme-icon], #themeIcon');

  function applyTheme(t){
    html.setAttribute('data-theme', t);
    localStorage.setItem(KEY, t);
    if (icon) icon.textContent = t === 'dark' ? '🌙' : '☀️';
  }
  applyTheme(localStorage.getItem(KEY) || 'dark');

  if (btn){
    btn.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  // ===== Scroll suave a Servicios en la landing
  // Soporta botón con id="goServices" o data-scroll="#services"
  const goBtn   = document.querySelector('#goServices,[data-scroll="#services"]');
  const target  = document.querySelector('#services,#servicios');
  if (goBtn && target){
    goBtn.addEventListener('click', (e) => {
      e.preventDefault();
      target.scrollIntoView({behavior:'smooth', block:'start'});
    });
  }

  // ===== Logout unificado (cualquier botón con data-logout)
  document.querySelectorAll('[data-logout]').forEach(el => {
    el.addEventListener('click', async () => {
      try{
        await fetch('../backend/api/cooperativa.php?action=logout', {
          method:'POST', credentials:'include'
        });
      }catch{}
      document.cookie = 'fans_token=;path=/;max-age=0;samesite=Lax';
      // si estás en residente, te conviene volver a index
      location.href = 'index.html';
    });
  });
})();