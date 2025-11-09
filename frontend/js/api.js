// api.js
(function () {
  if (!window.FANS) window.FANS = {};
  const { USER_API, COOP_API } = window.FANS;

  // Acciones que van al API de usuarios
  const USER_ACTIONS = new Set([
    'login', 'logout', 'register', 'me', 'profile_get', 'profile_update'
  ]);

  function pickEndpoint(action) {
    return USER_ACTIONS.has(action) ? USER_API : COOP_API;
  }

  async function raw(action, payload = {}) {
    const endpoint = pickEndpoint(action);
    const url = endpoint + '?action=' + encodeURIComponent(action);

    // Usamos FormData para máxima compatibilidad con PHP
    const fd = new FormData();
    for (const k in payload) fd.append(k, payload[k]);

    const res = await fetch(url, {
      method: 'POST',
      body: fd,
      credentials: 'include', // mantiene sesión por cookie
    });

    // Si el server tira 404/500, armamos un error legible
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} en ${url}\n${txt || ''}`.trim());
    }

    // Intentamos JSON, si no, devolvemos texto
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok: true, text }; }
  }

  async function post(action, payload) {
    const data = await raw(action, payload);
    // Normalizamos: si el backend no devuelve {ok:true}, inferimos
    if (data && typeof data === 'object' && 'ok' in data) return data;
    return { ok: true, data };
  }

  window.API = { raw, post };
})();