var API_URL = window.API_URL || window.API || '/api/api.php';

async function loadClaims(){
  const r = await fetch(`${API_URL}?action=reclamos_list`, { headers: fansAuthHeaders() });
  if (r.status === 401){
    alert('Tu sesión expiró o es inválida. Volvé a iniciar sesión.');
    location.href = 'login.html?next=' + encodeURIComponent(location.pathname);
    return;
  }
  const j = await r.json();
  const tbody = document.getElementById('claimsTBody');
  if (!j.ok || !j.items || !j.items.length){
    tbody.innerHTML = '<tr><td colspan="3" class="text-muted">Sin resultados.</td></tr>';
    return;
  }
  tbody.innerHTML = j.items.map(c => `
    <tr>
      <td>${c.fecha||''}</td>
      <td>${c.asunto||''}</td>
      <td>${c.estado||''}</td>
    </tr>`).join('');
}

async function sendClaim(ev){
  ev.preventDefault();
  const data = {
    asunto: document.getElementById('asunto').value.trim(),
    descripcion: document.getElementById('descripcion').value.trim()
  };
  const r = await fetch(`${API_URL}?action=reclamos_create`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', ...fansAuthHeaders() },
    body: JSON.stringify(data)
  });
  const j = await r.json();
  if (!j.ok){ alert(j.error || 'No se pudo enviar'); return; }
  document.getElementById('claimForm').reset();
  await loadClaims();
}

window.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('claimForm')?.addEventListener('submit', sendClaim);
  loadClaims();
});