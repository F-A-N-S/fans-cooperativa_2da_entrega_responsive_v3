// frontend/js/admin_login.js
(function(){
  const API = '../backend/api/';
  const form = document.getElementById('adminLoginForm');
  const box  = document.getElementById('errorBox');
  const btn  = document.getElementById('submitBtn');

  function showError(msg){
    if(!box) return;
    box.textContent = msg;
    box.style.display = msg ? 'block' : 'none';
  }

  async function submit(ev){
    ev.preventDefault();
    showError('');
    btn && (btn.disabled = true);

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try{
      const r = await fetch(API+'cooperativa.php?action=admin_login', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body: JSON.stringify({ email, password })
      });
      const j = await r.json().catch(()=> ({}));
      if(!r.ok || j.ok===false) throw new Error(j.error || 'Credenciales inválidas');

      if(j.token){ try{ localStorage.setItem('fans_token', j.token); }catch(_){/* opcional */} }
      location.href = 'backoffice.html';
    }catch(err){
      showError('No se pudo iniciar sesión: ' + err.message);
    }finally{
      btn && (btn.disabled = false);
    }
  }

  form && form.addEventListener('submit', submit);
})();