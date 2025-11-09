// frontend/js/login.js
(function () {
  const $ = (s, p = document) => p.querySelector(s);

  const form   = $('#loginForm');
  const email  = $('#email');
  const pass   = $('#password');
  const btn    = $('#submitBtn');
  const errorB = $('#errorBox');

  // Detecta raíz del proyecto: /.../frontend/login.html -> ROOT=/...
  const path = location.pathname;
  const ROOT = path.includes('/frontend/')
    ? path.split('/frontend/')[0]
    : '';

  // Endpoint a backend/api/usuarios.php
  const USER_API = (ROOT || '..') + '/backend/api/usuarios.php';

  const showErr = (m) => { if (errorB) { errorB.style.display='block'; errorB.textContent = m; } };
  const hideErr = ()    => { if (errorB) { errorB.style.display='none';  errorB.textContent = ''; } };

  async function tryLogin(url, bodyKV) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(bodyKV)) fd.append(k, v);
    const res = await fetch(url, { method: 'POST', body: fd, credentials: 'include' });
    if (!res.ok) {
      const t = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status} ${url}\n${t}`);
    }
    const txt = await res.text();
    try { return JSON.parse(txt); } catch { return { ok: true, text: txt }; }
  }

  // Mantener loginFlow DENTRO del IIFE (no global)
  async function loginFlow(mail, pwd) {
    // 1) action en body + email/password
    try {
      return await tryLogin(USER_API, { action: 'login', email: mail, password: pwd });
    } catch (e1) {
      // 2) usuario/pass alternativos
      try {
        return await tryLogin(USER_API, { action: 'login', usuario: mail, pass: pwd });
      } catch (e2) {
        // 3) action en query
        try {
          return await tryLogin(`${USER_API}?action=login`, { email: mail, password: pwd });
        } catch (e3) {
          throw new Error([e1?.message, e2?.message, e3?.message].filter(Boolean).join('\n---\n'));
        }
      }
    }
  }

  // NO usar onsubmit="loginFlow(...)" en el HTML
  form?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    hideErr();
    if (btn) btn.disabled = true;

    const mail = (email?.value || '').trim();
    const pwd  = pass?.value || '';

    try {
      const resp = await loginFlow(mail, pwd);

      const ok = resp.ok === true || resp.success === true || resp.status === 'ok' || resp.code === 200;
      if (!ok) {
        showErr(resp.message || resp.error || 'Usuario o contraseña inválidos.');
        return;
      }

      // Guardar token para que el guard lo vea
      if (resp.token) {
        document.cookie = 'fans_token=' + encodeURIComponent(resp.token) + '; path=/; SameSite=Lax';
        try { localStorage.setItem('fans_token', resp.token); } catch {}
      }

      // Rol → destino
      const role = (resp.role ?? resp.usuario?.rol ?? resp.user?.role ?? resp.data?.role ?? '')
        .toString().toLowerCase();
      const isAdmin = role === 'admin' || role === '1' || resp.is_admin === true;

      location.href = isAdmin ? 'backoffice.html' : 'dashboard.html';
    } catch (err) {
      console.error(err);
      showErr(
        `No se pudo contactar al servidor (404/400 u otra).\n` +
        `Probé: ${USER_API}\n` +
        `${err?.message || ''}`
      );
    } finally {
      if (btn) btn.disabled = false;
    }
  });
})();