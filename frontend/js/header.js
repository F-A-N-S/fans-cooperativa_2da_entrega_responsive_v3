// header.js — control único del header (login/logout + visibilidad de Backoffice)
// Ocupa el <div id="nav-auth"> y muestra/oculta #backofficeLink sin duplicados.

(function () {
  "use strict";

  const API = window.API || "/api/api.php";
  const $  = (s) => document.querySelector(s);

  // --- Token robusto (ignora "undefined"/"null" guardados por error) ---
  function getToken() {
    const cand = (localStorage.getItem("fans_token") ?? localStorage.getItem("token") ?? "");
    const t = String(cand).trim();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
  }
  function clearToken() {
    localStorage.removeItem("fans_token");
    localStorage.removeItem("token");
  }
  function authHeaders() {
    const t = getToken();
    return t ? { Authorization: "Bearer " + t } : {};
  }

  // --- Datos del usuario (si hay token) ---
  async function fetchMe() {
    const t = getToken();
    if (!t) return null;
    try {
      const r = await fetch(`${API}?action=me&_=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
        headers: { ...authHeaders() }
      });
      const j = await r.json().catch(() => ({}));
      return j?.user || j?.data || j || null;
    } catch {
      return null;
    }
  }

  // --- Render del header ---
  function render(role) {
    const box = $("#nav-auth");
    if (!box) return;

    // Evitar duplicados de "Backoffice" que otros scripts hayan inyectado
    box.querySelectorAll('a[href*="backoffice"]').forEach((a) => a.remove());

    if (getToken()) {
      box.innerHTML = `<button class="btn btn-ghost" id="logoutBtn">Salir</button>`;
    } else {
      box.innerHTML =
        `<a class="btn btn-ghost" href="login.html">Ingresar</a>
         <a class="btn btn-primary" href="register.html">Registrarse</a>`;
    }

    // Mostrar/ocultar el item del menú (ya existente en el HTML)
    const bo = $("#backofficeLink");
    if (bo) {
      const r = (role || "").toString().toLowerCase();
      bo.style.display = (r === "admin" || r === "administrador") ? "inline-block" : "none";
    }
  }

  // --- Logout (botón o cualquier elemento con data-logout) ---
  document.addEventListener("click", (ev) => {
    const el = ev.target;
    if (!(el instanceof HTMLElement)) return;
    if (el.id === "logoutBtn" || el.hasAttribute("data-logout")) {
      ev.preventDefault();
      clearToken();
      // Volver a login o refrescar para que desaparezca "Salir"
      location.href = "login.html";
    }
  });

  // --- Init único ---
  async function init() {
    // Sanea posibles tokens malos
    if (localStorage.getItem("fans_token") === "undefined" || localStorage.getItem("fans_token") === "null")
      localStorage.removeItem("fans_token");
    if (localStorage.getItem("token") === "undefined" || localStorage.getItem("token") === "null")
      localStorage.removeItem("token");

    let role = "residente";
    const me = await fetchMe();
    if (me) role = (me.role || me.rol || me.perfil || role);

    render(role);
  }

  // Refrescar el header si el token cambia en otra pestaña
  window.addEventListener("storage", (e) => {
    if (e.key === "fans_token" || e.key === "token") init();
  });

  document.addEventListener("DOMContentLoaded", init);
})();