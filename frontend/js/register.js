// register.js — registro único + errores claros + estado "pendiente"
(function () {
  const API = window.API || "/api/api.php";
  const $ = (s,r=document)=>r.querySelector(s);

  const form = $("#registerForm");
  const msg  = $("#registerMessage");

  function headers(){ return { "Content-Type":"application/json" }; }

  async function call(actions, body){
    // prueba en orden: usuarios_registrar, register_user, signup
    for (const a of actions){
      try{
        const u = new URL(API, location.origin);
        u.searchParams.set("action", a);
        u.searchParams.set("_", Date.now());
        const r = await fetch(u, { method:"POST", body: JSON.stringify(body), headers: headers(), cache:"no-store", credentials:"include" });
        const t = await r.text();
        let j; try{ j = JSON.parse(t); }catch{ j = { ok:r.ok, raw:t }; }
        if (!r.ok || j?.ok===false) throw Object.assign(new Error(j?.error || t || ("HTTP "+r.status)), {code:r.status, detail:j?.detail||""});
        return j;
      }catch(e){ /* intenta siguiente */ }
    }
    throw new Error("No se pudo registrar con ningún endpoint.");
  }

  function ui(state, text=""){
    const btn = form?.querySelector("button[type=submit]");
    if(btn){ btn.disabled = state==="busy"; }
    if(msg){ msg.textContent = text||""; msg.className = "message "+(state||""); }
  }

  form?.addEventListener("submit", async (ev)=>{
    ev.preventDefault();
    ui("busy","Enviando registro…");

    const payload = {
      nombre:  $("#nombre")?.value?.trim(),
      apellido:$("#apellido")?.value?.trim(),
      correo:  $("#correo")?.value?.trim(),
      password:$("#password")?.value||"",
      fecha_ingreso: $("#fecha_ingreso")?.value||"",
      cedula:  $("#cedula")?.value?.trim()||"",
      telefono:$("#telefono")?.value?.trim()||"",
      // aseguremos estado "pendiente" para backoffice
      estado:"pendiente", status:"pendiente", aprobado:0, activo:0
    };
    if (!payload.nombre || !payload.apellido || !payload.correo || !payload.password || !payload.fecha_ingreso){
      ui("error","Completá los campos obligatorios."); return;
    }

    const actions = ["usuarios_registrar","register_user","signup"];

    try{
      const res = await call(actions, payload);
      // No autologuear. Deja la cuenta en PENDIENTE
      ui("ok","Registro enviado. Te avisamos cuando el administrador lo apruebe.");
      // redirige al login con un pequeño delay
      setTimeout(()=>location.href="login.html", 900);
    }catch(e){
      const msgMap = (e.detail||e.message||"").toLowerCase();
      if (e.code===409 || msgMap.includes("duplicate") || msgMap.includes("1062")){
        ui("error","Ese correo ya está registrado.");
      } else if (e.code===400){
        ui("error","Datos inválidos. Revisá el formulario.");
      } else {
        ui("error","Error al registrar. Intentalo de nuevo.");
      }
      console.error("[registro]", e);
    }
  });
})();