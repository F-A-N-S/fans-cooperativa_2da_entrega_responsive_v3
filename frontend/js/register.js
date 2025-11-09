(async function(){
  const api = '../backend/api/cooperativa.php';

  const $ = s => document.querySelector(s);
  const form = $('#registerForm');
  const msg  = $('#msg');

  function show(type, text){
    msg.className = 'alert ' + (type==='ok' ? 'alert--success' : 'alert--error');
    msg.textContent = text;
    msg.style.display = 'block';
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    msg.style.display = 'none';

    const body = {
      nombre:   $('#nombre').value.trim(),
      apellido: $('#apellido').value.trim(),
      correo:   $('#correo').value.trim(),
      telefono: $('#telefono').value.trim(),
      usuario:  $('#usuario').value.trim(),
      password: $('#pass').value
    };

    if (!body.nombre || !body.apellido || !body.correo || !body.password || body.password.length<6){
      show('err','Completá nombre, apellido, correo y contraseña (mínimo 6).');
      return;
    }

    try{
      const res = await fetch(`${api}?action=postulante_crear`, {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body)
      }).then(r=>r.json());

      if(!res.ok){
        show('err', res.message || res.error || 'No se pudo enviar la solicitud.');
        return;
      }

      show('ok','¡Listo! Tu solicitud fue enviada. Un administrador la debe aprobar.');
      setTimeout(()=> location.href = 'login.html', 1200);
    }catch(err){
      show('err','Error de red. Intentá nuevamente.');
    }
  });
})();