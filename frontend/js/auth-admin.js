// Pequeño wrapper de fetch con JSON tolerante
(function () {
  function q(params) {
    if (!params) return '';
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) usp.append(k, String(v));
    });
    const s = usp.toString();
    return s ? ('&' + s) : '';
  }

  async function parseJSON(r) {
    try { return await r.clone().json(); }
    catch {
      const text = await r.text();
      return { ok:false, error:'Respuesta no JSON', raw:text, status:r.status };
    }
  }

  async function apiGET(base, action, params, extra = {}) {
    const url = base + '?action=' + encodeURIComponent(action) + q(params);
    const r = await fetch(url, { method:'GET', headers: { ...FANS.authHeaders() }, credentials: 'include', ...extra });
    const data = await parseJSON(r);
    if (r.status === 401) throw Object.assign(new Error('UNAUTHENTICATED'), { code:'UNAUTHENTICATED', data });
    return data;
  }

  async function apiPOST_JSON(base, action, body, extra = {}) {
    const url = base + '?action=' + encodeURIComponent(action);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', ...FANS.authHeaders() },
      credentials: 'include',
      body: JSON.stringify(body || {}),
      ...extra
    });
    const data = await parseJSON(r);
    if (r.status === 401) throw Object.assign(new Error('UNAUTHENTICATED'), { code:'UNAUTHENTICATED', data });
    return data;
  }

  // Helpers con nombres claritos para cada API
  window.coopGET       = (action, params, extra) => apiGET(FANS.API_COOP, action, params, extra);
  window.coopPOST      = (action, body,   extra) => apiPOST_JSON(FANS.API_COOP, action, body, extra);
  window.usuariosGET   = (action, params, extra) => apiGET(FANS.API_USERS, action, params, extra);
  window.usuariosPOST  = (action, body,   extra) => apiPOST_JSON(FANS.API_USERS, action, body, extra);
})();