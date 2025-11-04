// dashboard.js — completa datos del usuario + botones Acceder + limpia secciones antiguas
(function () {
  const API = window.API || "/api/api.php";

  const $ = (id) => document.getElementById(id);
  const authHeaders = () => {
    try {
      const t =
        (window.session && session.getToken && session.getToken()) ||
        localStorage.getItem("fans_token") ||
        localStorage.getItem("token");
      return t ? { Authorization: "Bearer " + t } : {};
    } catch {
      return {};
    }
  };

  const g = (o, keys, d = "—") => {
    for (const k of keys) if (o && o[k] != null && o[k] !== "") return o[k];
    return d;
  };

  function fullName(u) {
    const n =
      g(u, ["nombre", "Nombre", "name", "first_name", "given_name"], "").toString();
    const a =
      g(u, ["apellido", "Apellido", "last_name", "family_name"], "").toString();
    const un = g(u, ["username", "usuario", "user"], "");
    const out = (n + " " + a).trim();
    return out || un || "—";
  }

  function normEstado(u) {
    const s = String(
      g(u, ["status", "estado", "Estado", "estatus", "estado_cuenta"], "")
    ).toLowerCase();
    const aprobado = g(
      u,
      ["aprobado", "approved", "is_approved", "habilitado", "activo"],
      undefined
    );
    if (aprobado === true || aprobado === 1 || aprobado === "1" || aprobado === "true")
      return "aprobado";
    if (/pend/.test(s)) return "pendiente";
    if (/rech/.test(s)) return "rechazado";
    return s || "—";
  }

  async function fetchMe() {
    // 1) API me
    try {
      const u = new URL(API, location.origin);
      u.searchParams.set("action", "me");
      u.searchParams.set("_", Date.now());
      const r = await fetch(u, {
        credentials: "include",
        cache: "no-store",
        headers: { ...authHeaders() },
      });
      const txt = await r.text();
      let j;
      try {
        j = JSON.parse(txt);
      } catch {
        j = {};
      }
      const me = j.user || j.me || j.data || (j.ok && j) || null;
      if (me) return me;
    } catch (_) {}

    // 2) session helper si existe
    try {
      if (window.session && session.getProfile) {
        const p = session.getProfile();
        if (p) return p;
      }
    } catch (_) {}

    // 3) localStorage “fans_user”
    try {
      const raw =
        localStorage.getItem("fans_user") ||
        localStorage.getItem("user") ||
        localStorage.getItem("profile");
      if (raw) return JSON.parse(raw);
    } catch (_) {}

    return null;
  }

  function setText(id, v) {
    const el = $(id);
    if (el) el.textContent = v ?? "—";
  }

  async function loadUserBox() {
    const me = await fetchMe();
    if (!me) return;

    setText("dpNombre", fullName(me));
    setText("dpEmail", g(me, ["email", "correo"]));
    setText("dpCedula", g(me, ["cedula", "Cedula", "ci", "documento", "dni"]));
    setText("dpTelefono", g(me, ["telefono", "tel", "phone", "celular"]));
    setText("dpEstado", normEstado(me));
  }

  function wireButtons() {
    const routes = [
      ["btnPagos", "upload.html"],        // Comprobantes de pago
      ["btnReclamos", "reclamos.html"],   // Reclamos
      ["btnComunicados", "comunicados.html"], // Comunicados
    ];
    routes.forEach(([id, href]) => {
      const b = $(id);
      if (b) b.addEventListener("click", () => (location.href = href));
    });
  }

  function removeOldSections() {
    // Por si quedaron en el HTML, los quito
    const ids = ["registroHorasSection", "compPagoSectionDashboard"];
    ids.forEach((id) => {
      const el = $(id);
      if (el) el.remove();
    });
    // Y, por si estaban sin ID, oculto por títulos comunes
    document
      .querySelectorAll("h2, h3")
      ?.forEach((h) => {
        const t = h.textContent?.toLowerCase() || "";
        if (/(registro de horas|comprobantes de pago)/.test(t)) {
          const card = h.closest(".card, section, .card--light") || h.parentElement;
          if (card) card.remove();
        }
      });
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireButtons();
    removeOldSections();
    loadUserBox();
  });
})();