// Verifica sesión admin y conecta logout
(function () {
  async function check() {
    try {
      const d = await coopGET('me');
      if (!d || !d.ok || !d.user || d.user.role !== 'admin') throw new Error('no admin');
      window.ADMIN = d.user;
      // pinta botón salir si existe
      const btn = document.querySelector('[data-logout]');
      if (btn) {
        btn.addEventListener('click', async () => {
          try { await coopGET('logout'); } catch(_){}
          FANS.clearAuth();
          location.href = 'admin_login.html';
        });
      }
    } catch {
      FANS.clearAuth();
      location.href = 'admin_login.html';
    }
  }
  document.addEventListener('DOMContentLoaded', check);
})();