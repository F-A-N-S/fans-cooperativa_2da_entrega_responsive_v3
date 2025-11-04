var API_URL = window.API_URL || window.API || '/api/api.php';

async function doLogin(ev){
  ev?.preventDefault?.();
  const email = (document.querySelector('#email')?.value || document.querySelector('[name=email]')?.value || '').trim();
  const password = (document.querySelector('#password')?.value || document.querySelector('[name=password]')?.value || '');

  const resp = await fetch(`${API_URL}?action=login`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email, password })
  });
  const data = await resp.json();

  if (!data.ok){ alert(data.error || 'Credenciales inválidas'); throw new Error(data.error||'login'); }

  localStorage.setItem('fans_token', data.token);
  localStorage.setItem('token', data.token);      // compat viejo código
  localStorage.setItem('fans_role', data.role||'');

  const next = new URLSearchParams(location.search).get('next') || 'dashboard.html';
  location.href = next;
}

// helper global para auth
window.fansAuthHeaders = function(){
  const t = localStorage.getItem('fans_token') || localStorage.getItem('token');
  return t ? { 'Authorization': 'Bearer '+t } : {};
};

window.addEventListener('DOMContentLoaded', ()=>{
  document.querySelector('#loginForm')?.addEventListener('submit', doLogin);
});