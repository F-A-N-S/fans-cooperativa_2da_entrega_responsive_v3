// guard.js (no module)
(() => {
  const API = '../backend/api/';
  const guard = document.currentScript?.dataset?.guard || 'user-only';
  const logoutBtn = document.getElementById('logoutBtn');

  async function check(url, loginRedirect) {
    try {
      const r = await fetch(API + url, { credentials: 'include' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) throw new Error(j.error || 'UNAUTH');
      return j;
    } catch (e) {
      if (loginRedirect) location.replace(loginRedirect);
      throw e;
    }
  }

  async function main() {
    if (guard === 'admin-only') {
      // verifica sesión/token de ADMIN
      await check('cooperativa.php?action=me', 'admin_login.html');
    } else if (guard === 'user-only') {
      // verifica sesión/token de RESIDENTE
      await check('usuarios.php?action=me', 'login.html');
    } else if (guard === 'no-auth-admin') {
      // si ya está logueado como admin, mandalo al backoffice
      try { await check('cooperativa.php?action=me'); location.replace('backoffice.html'); } catch {}
    } else if (guard === 'no-auth-user') {
      // si ya está logueado como user, mandalo al dashboard
      try { await check('usuarios.php?action=me'); location.replace('dashboard.html'); } catch {}
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        // Opcional: si no tenés endpoint logout, al menos limpiá storage y redirigí
        try { await fetch(API + 'auth.php?action=logout', { credentials: 'include' }); } catch {}
        try { localStorage.removeItem('fans_token'); } catch {}
        if (guard === 'admin-only') location.href = 'admin_login.html';
        else location.href = 'login.html';
      });
    }
  }

  main();
})();