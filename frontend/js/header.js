// Renders nav-auth; requires session.js
(function(){
  async function renderAuth(){
    const box = document.getElementById('nav-auth');
    if (!box) return;
    box.innerHTML = '';
    let name = 'Invitado', role = '', email = '';
    const me = await (window.FANS_SESSION?.whoAmI?.() || Promise.resolve({ok:false}));
    if (me?.ok) {
      const u = me.user || me.admin || me.residente || {};
      name = u.nombre || u.name || u.Usuario || 'Usuario';
      role = (u.role || '').toLowerCase();
      email = u.correo || u.Correo || '';
      const b = document.createElement('button');
      b.textContent = 'Salir';
      b.className = 'btn btn-danger';
      b.onclick = async () => { try { await window.FANS_SESSION.logoutEverywhere(); } finally { location.href = 'index.html'; } };
      const span = document.createElement('span');
      span.className = 'muted';
      span.style.marginRight = '8px';
      span.textContent = (role==='admin'?'Admin: ':'') + (email || name);
      box.append(span, b);
    } else {
      const a = document.createElement('a');
      a.href = 'login.html'; a.className = 'btn'; a.textContent = 'Iniciar sesión';
      box.appendChild(a);
    }
  }
  document.addEventListener('DOMContentLoaded', renderAuth);
})();