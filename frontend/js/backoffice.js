// Backoffice F.A.N.S — FIX 400 en reclamos (prefer FORM), robustez usuarios pendientes + approve/reject flex
(function(){
  const API = window.API || "/api/api.php";
  const UPLOADS_BASE = (window.UPLOADS_BASE || "/uploads/comprobantes/").replace(/\/+$/,"") + "/";
  const DEBUG = true;

  const ACTIONS = {
    usuarios: {
      pendientes: [
        "admin_usuarios_pendientes","usuarios_pendientes","admin_usuarios_listar_pendientes",
        "usuarios_listar_pendientes","listar_usuarios_pendientes",
        "admin_solicitudes_listar","solicitudes_listar","solicitudes_pendientes","admin_solicitudes_pendientes",
        "registro_pendientes","registros_pendientes","admin_registros_pendientes","admin_registros_listar",
        "pending_users","users_pending","usuarios_en_revision"
      ],
      aprobar:  ["admin_usuarios_aprobar","usuarios_aprobar","aprobar_usuario","solicitud_aprobar","registro_aprobar"],
      rechazar: ["admin_usuarios_rechazar","usuarios_rechazar","rechazar_usuario","solicitud_rechazar","registro_rechazar"],
      listarTodo: ["admin_usuarios_listar","usuarios_listar","listar_usuarios","users_list","usuarios_admin_todos"]
    },
    comprobantes: {
      listar:   ["admin_comprobantes_listar","comprobantes_listar_admin","comprobantes_listar","listar_comprobantes"],
      setEstado:["admin_comprobantes_set_estado","comprobantes_set_estado","comprobantes_cambiar_estado"],
      eliminar: ["admin_comprobantes_eliminar","comprobantes_eliminar","eliminar_comprobante"],
    },
    comunicados: {
      listarPacks: [
        ["admin_comunicados_listar","comunicados_admin_listar","comunicados_listar_todos","listar_comunicados_admin"],
        ["comunicados_listar","anuncios_listar","avisos_listar","news_list","listar_comunicados"],
        ["admin_anuncios_listar","admin_avisos_listar"]
      ],
      crear:    ["admin_comunicados_crear","admin_comunicados_publicar","comunicados_publicar","anuncios_crear","avisos_crear"],
      eliminar: ["admin_comunicados_eliminar","comunicados_eliminar","anuncios_eliminar","avisos_eliminar","eliminar_comunicado"],
    },
    reclamos: {
      listarPacks: [
        ["admin_reclamos_listar","reclamos_listar_admin","reclamos_listar","listar_reclamos","reclamos_admin_todos","tickets_listar"]
      ],
      setEstado: [
        "admin_reclamos_cambiar_estado","reclamos_cambiar_estado","reclamos_set_estado",
        "admin_reclamos_set_estado","reclamo_cambiar_estado","reclamo_set_estado",
        "reclamos_update_estado","reclamos_actualizar","ticket_set_estado","ticket_update_estado"
      ],
      eliminar: [
        "admin_reclamos_eliminar","reclamos_eliminar","eliminar_reclamo",
        "reclamo_eliminar","ticket_eliminar","tickets_eliminar","reclamos_borrar"
      ],
    },
    reservas: {
      listarPacks: [
        ["reservas_listar_admin","admin_reservas_listar","reservas_listar","listar_reservas_admin"],
        ["reservas_listar_todos","admin_reservas_todas","reservas_admin_todas","reservas_admin_listar"]
      ],
      aprobar:  ["admin_reservas_aprobar","reservas_aprobar","aprobar_reserva"],
      rechazar: ["admin_reservas_rechazar","reservas_rechazar","rechazar_reserva"],
      ocupar:   ["admin_reservas_marcar_ocupado","reservas_ocupar","reservas_marcar_ocupado","reservas_set_estado","admin_reservas_set_estado"],
      eliminar: ["admin_reservas_eliminar","reservas_eliminar","eliminar_reserva"]
    }
  };

  const $id = (s)=>document.getElementById(s);
  const H = ()=>{
    const t = (window.session && window.session.getToken && window.session.getToken())
           || localStorage.getItem("fans_token")
           || localStorage.getItem("token") || "";
    return t ? { "Authorization": "Bearer "+t } : {};
  };
  const log = (...a)=>{ if(DEBUG) console.log("[BO]",...a); };
  const warn = (...a)=>{ if(DEBUG) console.warn("[BO]",...a); };
  const nocache = (u)=>{ u.searchParams.set("_", String(Date.now())); return u; };

  async function _raw(url, opts){
    const r = await fetch(url, { ...opts, cache:"no-store", credentials:"include" });
    const txt = await r.text();
    let j; try{ j = JSON.parse(txt); }catch{ j = { ok:r.ok, raw:txt }; }
    if(!r.ok || j?.ok===false){
      warn("HTTP", r.status, "URL:", url.toString(), "Body:", opts?.body, "Resp:", txt);
      throw new Error(j?.error || txt || ("HTTP "+r.status));
    }
    return j;
  }

  // --- primero FORM (PHP friendly), luego JSON, luego GET ---
  async function postPreferForm(actions, data){
    for(const a of actions){
      try{
        const u = nocache(new URL(API, location.origin)); u.searchParams.set("action", a);
        const body = new URLSearchParams(); Object.entries(data).forEach(([k,v])=> body.append(k, v));
        log("POST-FORM", a, data);
        return await _raw(u, { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded; charset=UTF-8", ...H() }, body: body.toString() });
      }catch(e){}
      try{
        const u = nocache(new URL(API, location.origin)); u.searchParams.set("action", a);
        log("POST-JSON", a, data);
        return await _raw(u, { method:"POST", headers:{ "Content-Type":"application/json", ...H() }, body: JSON.stringify(data) });
      }catch(e){}
    }
    // GET último recurso
    for(const a of actions){
      try{
        const u = nocache(new URL(API, location.origin)); u.searchParams.set("action", a);
        Object.entries(data).forEach(([k,v])=> u.searchParams.set(k, v));
        log("GET", a, data);
        return await _raw(u, { headers:{...H()} });
      }catch(e){}
    }
    throw new Error("POST/GET falló para: "+actions.join(", "));
  }

  async function tryGET(actions, params={}){
    for(const a of actions){
      try{
        const u = nocache(new URL(API, location.origin));
        u.searchParams.set("action", a);
        Object.entries(params).forEach(([k,v])=>{ if(v!==undefined && v!==null && v!=="") u.searchParams.set(k, v); });
        log("GET", a, params);
        return await _raw(u, { headers:{...H()} });
      }catch(e){}
    }
    throw new Error("GET falló: "+actions.join(", "));
  }
  async function tryGETmerge(packs, params={}){
    let out=[]; for(const p of packs){ try{ const j=await tryGET(p, params); out=out.concat(arr(j)); }catch(_){} }
    const seen=new Set();
    out=out.filter(o=>{ const key=keyOf(o); if(seen.has(key)) return false; seen.add(key); return true; });
    return out;
  }

  const arr = (j)=> Array.isArray(j) ? j :
    (j?.rows || j?.items || j?.data || j?.list || j?.records || j?.result
      || j?.comprobantes || j?.comunicados || j?.reclamos || j?.reservas
      || j?.usuarios || j?.users
      || j?.solicitudes || j?.solicitudes_pendientes || j?.usuarios_pendientes
      || j?.registros || j?.registros_pendientes
      || j?.pending || j?.pending_users || j?.tickets || []);

  const keyOf = (o)=> String(
    (o && (o.id ?? o.ID ?? o.id_usuario ?? o.user_id ?? o.id_reclamo ?? o.ticket_id ?? o.id_reserva ?? o.id_Reserva ?? o.id_Comprobante))
    ?? JSON.stringify(o)
  );
  const g = (o, keys, d="—") => { for(const k of keys) if(o && o[k]!=null) return o[k]; return d; };
  const hhmm = (s)=> { if(!s) return "—"; const m = /^\d\d:\d\d/.exec(String(s)); return m?m[0]:s; };
  const pill = (v)=>{ const t = String(v||"").toLowerCase(); let cls="bo-badge ";
    if(t.includes("aproba")||t==="ok") cls+="bo-ok";
    else if(t.includes("recha")||t.includes("cerrad")||t.includes("ocup")) cls+="bo-bad";
    else cls+="bo-warn"; return `<span class="${cls}">${v ?? "—"}</span>`; };
  const btn = (label, cls, attrs="")=> `<button class="btn ${cls}" ${attrs}>${label}</button>`;

  function linkFromComprobante(r){
    const url = g(r,["Archivo_URL","archivo_url","url","enlace"],""); if (url) return url;
    let nombre = g(r,["Archivo","archivo","nombre_archivo","file"],""); if(!nombre) return "";
    if(/^https?:\/\//i.test(nombre)) return nombre;
    nombre = String(nombre).replace(/^\.\/+/,"").replace(/^\/+/,"");
    if (nombre.toLowerCase().startsWith("uploads/comprobantes/")) return "/"+nombre;
    return "/"+(UPLOADS_BASE + nombre).replace(/\/+/g,"/");
  }

  // ===== Usuarios pendientes (reforzado)
  function isPendingUser(u){
    const raw = String(u.estado ?? u.Estado ?? u.status ?? u.estatus ?? "").toLowerCase().trim();
    const aprobado = (u.aprobado ?? u.approved ?? u.is_approved ?? u.habilitado ?? u.activo);
    const rol = String(u.rol ?? u.role ?? "").toLowerCase();
    if (rol==="admin" || rol==="administrador") return false;
    if (aprobado === true || aprobado === 1 || aprobado === "1" || aprobado === "true") return false;
    if (/(rechaz|bloque|cerrad|inactiv)/.test(raw)) return false;
    if (/(pend|espera|por_?aprobar|sin_?aprobar|nuevo|review|to_approve|pending|solicitud)/.test(raw)) return true;
    return (aprobado === false || aprobado === 0 || aprobado === "0" || aprobado == null);
  }
  function dedupeUsers(rows){
    const seen=new Set();
    return rows.map((u,i)=>({u,i})).filter(({u,i})=>{
      const id=(u.id||u.ID||u.id_usuario||u.user_id||"").toString();
      const em=(u.email||u.correo||u.mail||"").toLowerCase();
      const key=(id||em)?`${id}|${em}`:`row${i}`;
      if(seen.has(key)) return false; seen.add(key); return true;
    }).map(x=>x.u);
  }

  const usersTBody = $id("pendingUsersTbody");
  async function loadPendingUsers(){
    if(!usersTBody) return;
    usersTBody.innerHTML = `<tr><td colspan="5">Cargando…</td></tr>`;
    try{
      let rows = [];

      // 1) endpoints de pendientes/solicitudes
      try{
        rows = rows.concat(arr(await tryGET(ACTIONS.usuarios.pendientes, {
          admin:1, all:1,
          estado:"pendiente", estatus:"pendiente",
          aprobado:0, habilitado:0, activo:0,
          solo_pendientes:1, pending:1, solo:"pendientes"
        })));
      }catch(_){}

      // 2) fallback: listar todos y filtrar
      try{
        const all = arr(await tryGET(ACTIONS.usuarios.listarTodo, { admin:1, all:1 }));
        rows = rows.concat(all.filter(isPendingUser));
      }catch(_){}

      // 3) ultimo intento: pedir al backend que filtre
      if(!rows.length){
        try{
          rows = rows.concat(arr(await tryGET(ACTIONS.usuarios.listarTodo, {
            admin:1, all:1, estado:"pendiente", aprobado:0, solo_pendientes:1
          })));
        }catch(_){}
      }

      rows = dedupeUsers(rows);
      rows.sort((A,B)=> (new Date(B.created_at||B.fecha||B.Fecha||0)) - (new Date(A.created_at||A.fecha||A.Fecha||0)));

      usersTBody.innerHTML = rows.length ? rows.map(u=>{
        const id     = g(u,["id","ID","id_usuario","user_id"]);
        const nombre = g(u,["nombre","Nombre","name"],"—");
        const correo = g(u,["email","correo"],"—");
        const fecha  = g(u,["fecha","created_at","Fecha"],"—");
        return `<tr>
          <td>${id ?? "—"}</td><td>${nombre}</td><td>${correo}</td><td>${fecha}</td>
          <td class="nowrap">
            ${btn("Aprobar","btn-success btn-sm",`data-acc="usr-ok" data-id="${id||""}" data-email="${(correo||"").toLowerCase()}"`)}
            ${btn("Rechazar","btn-outline btn-sm",`data-acc="usr-no" data-id="${id||""}" data-email="${(correo||"").toLowerCase()}"`)}
          </td>
        </tr>`;
      }).join("") : `<tr><td colspan="5">Sin usuarios pendientes.</td></tr>`;
    }catch(e){
      usersTBody.innerHTML = `<tr><td colspan="5" style="color:#ef4444">Error: ${e.message}</td></tr>`;
    }
  }

  // ===== Comprobantes
  const tbodyComp=$id("tbodyComprobantes"), estadoFiltro=$id("estadoFiltro"), residenteFiltro=$id("residenteFiltro");
  async function loadComprobantes(){
    if(!tbodyComp) return;
    tbodyComp.innerHTML = `<tr><td colspan="7">Cargando…</td></tr>`;
    try{
      const params={}, est=estadoFiltro?.value||"", rid=residenteFiltro?.value||"";
      if(est && est!=="Todos") params.estado=est;
      if(rid) params.id_residente=rid;
      const rows = arr(await tryGET(ACTIONS.comprobantes.listar, params))
        .sort((A,B)=> String(B.Fecha||B.fecha||"").localeCompare(String(A.Fecha||A.fecha||"")));
      tbodyComp.innerHTML = rows.length ? rows.map((r,i)=>{
        const id=g(r,["id","ID","id_Comprobante"]);
        const tipo=g(r,["Tipo","tipo"]), fecha=g(r,["Fecha","fecha"]);
        const monto=g(r,["Monto","monto"]), estado=g(r,["Estado","estado"],"Pendiente");
        const link=linkFromComprobante(r);
        return `<tr>
          <td>${i+1}</td><td>${tipo}</td><td>${fecha}</td><td>${monto}</td><td>${pill(estado)}</td>
          <td>${link ? `<a target="_blank" href="${link}">Ver</a>` : "—"}</td>
          <td class="nowrap">
            ${btn("Aprobar","btn-success btn-sm",`data-acc="comp-ok" data-id="${id}"`)}
            ${btn("Rechazar","btn-outline btn-sm",`data-acc="comp-no" data-id="${id}"`)}
            ${btn("Eliminar","btn-danger btn-sm",`data-acc="comp-del" data-id="${id}"`)}
          </td>
        </tr>`;
      }).join("") : `<tr><td colspan="7">Sin comprobantes.</td></tr>`;
    }catch(e){
      tbodyComp.innerHTML = `<tr><td colspan="7" style="color:#ef4444">Error: ${e.message}</td></tr>`;
    }
  }
  estadoFiltro?.addEventListener("change", loadComprobantes);
  residenteFiltro?.addEventListener("change", loadComprobantes);

  // ===== Comunicados
  const annList=$id("comList"), annForm=$id("boAnnForm"), annTitle=$id("comTitle"), annBody=$id("comBody");
  async function tryGETpacks(packs, params){ return await tryGETmerge(packs, params); }
  async function loadAnns(){
    if(!annList) return;
    annList.textContent="Cargando…";
    try{
      const rows = await tryGETpacks(ACTIONS.comunicados.listarPacks, { all:1, admin:1 });
      rows.sort((A,B)=> String(B.fecha||B.Fecha||"").localeCompare(String(A.fecha||A.Fecha||"")));
      annList.innerHTML = rows.length ? rows.map(c=>{
        const id=g(c,["id","ID","id_comunicado","Id_Comunicado","idComunicado"]);
        const titulo=g(c,["Titulo","titulo","title"],"(sin título)");
        const cuerpo=g(c,["Cuerpo","cuerpo","Contenido","contenido","descripcion","texto"],"");
        const fecha=g(c,["Fecha","fecha","fecha_publicacion","created_at","updated_at"],"");
        return `<article class="bo-card">
          <header class="bo-card-h"><strong>${titulo}</strong><span class="muted">${fecha}</span></header>
          <div class="bo-card-b">${String(cuerpo).replace(/\n/g,"<br>")}</div>
          <footer class="bo-card-f">${btn("Eliminar","btn-danger btn-sm",`data-acc="ann-del" data-id="${id}"`)}</footer>
        </article>`;
      }).join("") : "Sin comunicados.";
    }catch(e){
      annList.innerHTML = `<span style="color:#ef4444">Error: ${e.message}</span>`;
    }
  }
  annForm?.addEventListener("submit", async(ev)=>{
    ev.preventDefault();
    const titulo=(annTitle?.value||"").trim(), cuerpo=(annBody?.value||"").trim();
    if(!titulo || !cuerpo) return alert("Completá título y cuerpo.");
    try{
      await postPreferForm(ACTIONS.comunicados.crear, { Titulo:titulo, titulo, Contenido:cuerpo, contenido:cuerpo, cuerpo });
      if(annTitle) annTitle.value=""; if(annBody) annBody.value="";
      await loadAnns();
    }catch(e){ alert("No se pudo publicar: "+e.message); }
  });

  // ===== Reclamos (igual que tu versión estable)
  const claimsTBody=$id("boReclamosTBody");
  const ESTADO_CODE = { aprobado:1, rechazada:2, rechazado:2, en_proceso:3, proceso:3, cerrado:4 };
  function payloadsEstado(id, nuevo){
    const code = ESTADO_CODE[nuevo] ?? "";
    const accion = nuevo==="aprobado" ? "aprobar" : nuevo==="rechazado" ? "rechazar" : nuevo==="en_proceso" ? "procesar" : nuevo==="cerrado" ? "cerrar" : nuevo;
    const upper = nuevo.toUpperCase();
    const bases = [ { id }, { id_reclamo:id }, { reclamo_id:id }, { ticket_id:id }, { ID:id }, { Id_Reclamo:id }, { idReclamo:id } ];
    const variants=[]; bases.forEach(b=>{
      variants.push({ ...b, estado:nuevo });
      variants.push({ ...b, status:nuevo });
      variants.push({ ...b, nuevo_estado:nuevo });
      variants.push({ ...b, accion:accion });
      variants.push({ ...b, state:nuevo });
      variants.push({ ...b, ESTADO:upper });
      if(code) variants.push({ ...b, estado_id:code });
    });
    return variants;
  }
  async function setReclamoEstado(id, nuevo){
    const bodies = payloadsEstado(id, nuevo);
    let last=""; for(const data of bodies){
      try{ await postPreferForm(ACTIONS.reclamos.setEstado, data); log("reclamo OK", data); return; }
      catch(e){ last=e.message; }
    }
    throw new Error(last || "No se pudo actualizar estado");
  }
  async function eliminarReclamo(id){
    const bodies=[ { id }, { id_reclamo:id }, { reclamo_id:id }, { ticket_id:id }, { ID:id }, { Id_Reclamo:id }, { idReclamo:id } ];
    let last=""; for(const data of bodies){
      try{ await postPreferForm(ACTIONS.reclamos.eliminar, data); log("reclamo eliminado", data); return; }
      catch(e){ last=e.message; }
    }
    throw new Error(last || "No se pudo eliminar");
  }
  async function loadReclamos(){
    if(!claimsTBody) return;
    claimsTBody.innerHTML = `<tr><td colspan="6">Cargando…</td></tr>`;
    try{
      const rows = await tryGETmerge(ACTIONS.reclamos.listarPacks, { all:1, admin:1 });
      rows.sort((A,B)=> String(B.fecha||B.Fecha||"").localeCompare(String(A.fecha||A.Fecha||"")));
      claimsTBody.innerHTML = rows.length ? rows.map(r=>{
        const id=g(r,["id","ID","id_reclamo","Id_Reclamo","ticket_id","idReclamo"]);
        const fecha=g(r,["Fecha","fecha","fecha_creacion","created_at"]);
        const asunto=g(r,["Asunto","asunto","Titulo","titulo"],"—");
        const desc=g(r,["Descripcion","descripcion","detalle","cuerpo"],"");
        const estado=g(r,["Estado","estado","status"],"abierto");
        const residente=g(r,["residente","Residente","id_residente","residente_id","usuario_id","user_id"],"—");
        return `<tr>
          <td>${residente}</td>
          <td>${fecha}</td>
          <td><strong>${asunto}</strong><div class="muted">${desc}</div></td>
          <td>${pill(estado)}</td>
          <td class="nowrap">
            ${btn("Aprobar","btn-success btn-sm",`data-acc="rec-aprobar" data-id="${id}"`)}
            ${btn("Rechazar","btn-outline btn-sm",`data-acc="rec-rechazar" data-id="${id}"`)}
            ${btn("En proceso","btn-outline btn-sm",`data-acc="rec-proc" data-id="${id}"`)}
            ${btn("Cerrar","btn-success btn-sm",`data-acc="rec-cerrar" data-id="${id}"`)}
            ${btn("Eliminar","btn-danger btn-sm",`data-acc="rec-del" data-id="${id}"`)}
          </td>
        </tr>`;
      }).join("") : `<tr><td colspan="6">Sin reclamos.</td></tr>`;
    }catch(e){
      claimsTBody.innerHTML = `<tr><td colspan="6" style="color:#ef4444">Error: ${e.message}</td></tr>`;
    }
  }

  // ===== Reservas (igual que tu versión)
  const reservasBody=$id("boReservasTBody");
  async function loadReservas(){
    if(!reservasBody) return;
    reservasBody.innerHTML = `<tr><td colspan="6">Cargando…</td></tr>`;
    try{
      const rows = await tryGETmerge(ACTIONS.reservas.listarPacks, { all:1, admin:1 });
      rows.sort((A,B)=>{ const Akey=`${A.Fecha||A.fecha||""} ${A.Hora_Inicio||A.hora_inicio||""}`, Bkey=`${B.Fecha||B.fecha||""} ${B.Hora_Inicio||B.hora_inicio||""}`; return Bkey.localeCompare(Akey); });
      reservasBody.innerHTML = rows.length ? rows.map((r,i)=>{
        const id=g(r,["id_Reserva","id_reserva","id","ID"]);
        const residente=g(r,["id_Residente","residente","residente_id","usuario_id"],"—");
        const fecha=g(r,["Fecha","fecha"],"—");
        const hi=hhmm(g(r,["Hora_Inicio","hora_inicio"])), hf=hhmm(g(r,["Hora_Fin","hora_fin"]));
        const estado=g(r,["Estado","estado"],"Pendiente");
        return `<tr>
          <td>${i+1}</td><td>${residente}</td><td>${fecha}</td><td>${hi} – ${hf}</td><td>${pill(estado)}</td>
          <td class="nowrap">
            ${btn("Aprobar","btn-success btn-sm",`data-acc="res-ok" data-id="${id}"`)}
            ${btn("Rechazar","btn-outline btn-sm",`data-acc="res-no" data-id="${id}"`)}
            ${btn("Marcar ocupado","btn-outline btn-sm",`data-acc="res-ocup" data-id="${id}"`)}
            ${btn("Eliminar","btn-danger btn-sm",`data-acc="res-del" data-id="${id}"`)}
          </td>
        </tr>`;
      }).join("") : `<tr><td colspan="6">Sin reservas.</td></tr>`;
    }catch(e){
      reservasBody.innerHTML = `<tr><td colspan="6" style="color:#ef4444">Error: ${e.message}</td></tr>`;
    }
  }

  // ===== ACCIONES
  document.addEventListener("click", async (ev)=>{
    const el = ev.target; if(!(el instanceof HTMLElement)) return;

    // Usuarios (aprobar/rechazar con payload flexible)
    if(el.matches('[data-acc="usr-ok"],[data-acc="usr-no"]')){
      const id = el.getAttribute("data-id");
      const email = (el.getAttribute("data-email")||"").toLowerCase();
      const isApprove = el.matches('[data-acc="usr-ok"]');
      const actions = isApprove ? ACTIONS.usuarios.aprobar : ACTIONS.usuarios.rechazar;

      const bases = [
        { id }, { id_usuario:id }, { user_id:id }, { usuario_id:id }, { ID:id }
      ];
      // si el backend usa email como key
      if(email && !id) bases.push({ email }), bases.push({ correo:email });

      // algunos backends exigen estado/accion explícito
      const variants=[];
      const estado = isApprove ? "aprobado" : "rechazado";
      const accion = isApprove ? "aprobar" : "rechazar";
      bases.forEach(b=>{
        variants.push({ ...b });
        variants.push({ ...b, estado });
        variants.push({ ...b, accion });
        variants.push({ ...b, status: estado });
        variants.push({ ...b, aprobado: isApprove ? 1 : 0 });
      });

      let ok=false,last="";
      for(const payload of variants){
        try { await postPreferForm(actions, payload); ok=true; break; }
        catch(e){ last=e.message; }
      }
      if(!ok) return alert("No se pudo "+(isApprove?"aprobar":"rechazar")+": "+last);
      await loadPendingUsers();
    }

    // Comprobantes
    if(el.matches('[data-acc="comp-ok"]')){ const id = el.getAttribute("data-id");
      try{ await postPreferForm(ACTIONS.comprobantes.setEstado, { id, estado:"aprobado" }); await loadComprobantes(); }catch(e){ alert(e.message); } }
    if(el.matches('[data-acc="comp-no"]')){ const id = el.getAttribute("data-id");
      try{ await postPreferForm(ACTIONS.comprobantes.setEstado, { id, estado:"rechazado" }); await loadComprobantes(); }catch(e){ alert(e.message); } }
    if(el.matches('[data-acc="comp-del"]')){ const id = el.getAttribute("data-id");
      if(!confirm("¿Eliminar comprobante #"+id+"?")) return;
      try{ await postPreferForm(ACTIONS.comprobantes.eliminar, { id }); await loadComprobantes(); }catch(e){ alert(e.message); } }

    // Comunicados
    if(el.matches('[data-acc="ann-del"]')){ const id = el.getAttribute("data-id");
      if(!confirm("¿Eliminar comunicado #"+id+"?")) return;
      try{ await postPreferForm(ACTIONS.comunicados.eliminar, { id }); await loadAnns(); }catch(e){ alert(e.message); } }

    // Reclamos
    if(el.matches('[data-acc="rec-aprobar"]')){ const id=el.getAttribute("data-id"); try{ await setReclamoEstado(id,"aprobado"); await loadReclamos(); }catch(e){ alert(e.message); } }
    if(el.matches('[data-acc="rec-rechazar"]')){ const id=el.getAttribute("data-id"); try{ await setReclamoEstado(id,"rechazado"); await loadReclamos(); }catch(e){ alert(e.message); } }
    if(el.matches('[data-acc="rec-proc"]')){ const id=el.getAttribute("data-id"); try{ await setReclamoEstado(id,"en_proceso"); await loadReclamos(); }catch(e){ alert(e.message); } }
    if(el.matches('[data-acc="rec-cerrar"]')){ const id=el.getAttribute("data-id"); try{ await setReclamoEstado(id,"cerrado"); await loadReclamos(); }catch(e){ alert(e.message); } }
    if(el.matches('[data-acc="rec-del"]')){ const id=el.getAttribute("data-id");
      if(!confirm("¿Eliminar reclamo #"+id+"?")) return;
      try{ await eliminarReclamo(id); await loadReclamos(); }catch(e){ alert(e.message); } }

    // Reservas
    if(el.matches('[data-acc="res-ok"]')){ const id = el.getAttribute("data-id");
      try{ await postPreferForm(ACTIONS.reservas.aprobar, { id }); await loadReservas(); }catch(e){ alert(e.message); } }
    if(el.matches('[data-acc="res-no"]')){ const id = el.getAttribute("data-id");
      try{ await postPreferForm(ACTIONS.reservas.rechazar, { id }); await loadReservas(); }catch(e){ alert(e.message); } }
    if(el.matches('[data-acc="res-ocup"]')){ const id = el.getAttribute("data-id");
      const payloads=[{id,estado:"ocupado"},{id_reserva:id,estado:"ocupado"},{reserva_id:id,estado:"ocupado"},{id,ocupado:1}];
      let ok=false,last=""; for(const p of payloads){ try{ await postPreferForm(ACTIONS.reservas.ocupar, p); ok=true; break; }catch(e){ last=e.message; } }
      if(!ok) alert("No se pudo marcar ocupado: "+last); await loadReservas();
    }
    if(el.matches('[data-acc="res-del"]')){ const id = el.getAttribute("data-id");
      if(!confirm("¿Eliminar la reserva #"+id+"?")) return;
      const payloads=[{id},{id_reserva:id},{reserva_id:id}];
      let ok=false,last=""; for(const p of payloads){ try{ await postPreferForm(ACTIONS.reservas.eliminar, p); ok=true; break; }catch(e){ last=e.message; } }
      if(!ok) alert("No se pudo eliminar: "+last); await loadReservas();
    }
  });

  function refreshAll(){ loadPendingUsers(); loadComprobantes(); loadAnns(); loadReclamos(); loadReservas(); }
  document.addEventListener("DOMContentLoaded", refreshAll);
  document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible") refreshAll(); });
  window.addEventListener("focus", ()=>{ loadPendingUsers(); });
})();