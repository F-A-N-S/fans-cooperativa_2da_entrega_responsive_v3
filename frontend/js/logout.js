// logout.js — limpia token y avisa al backend si existe logout
import { API_COOP, API_USERS, clearAuth } from './env.js';

async function tryLogout(url) {
  try {
    await fetch(`${url}?action=logout`, { method: 'POST', credentials: 'include' });
  } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('[data-logout], #btnSalir, a[href="#logout"]');
  if (!btn) return;
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    await Promise.all([ tryLogout(API_COOP), tryLogout(API_USERS) ]);
    clearAuth();
    // Decide adónde volver según página
    const page = (location.pathname.split('/').pop() || '').toLowerCase();
    if (page === 'backoffice.html') location.assign('admin_login.html');
    else location.assign('login.html');
  });
});
