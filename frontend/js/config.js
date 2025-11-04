(function(){
  try{
    var RAW=(typeof window!=="undefined" && window.API)?window.API:"/api/api.php";
    try{ var u=new URL(RAW,window.location.origin); window.API=u.pathname+(u.search||""); }catch(_){ window.API=RAW; }
    window.API_URL=window.API;

    window.authH=function(){
      const t=(window.session&&window.session.getToken&&window.session.getToken())
        || localStorage.getItem("fans_token") || localStorage.getItem("token");
      return t?{Authorization:"Bearer "+t}:{};
    };
    function parseJson(r,txt){
      let j; try{ j=JSON.parse(txt); }catch(_){
        const peek=(txt||"").slice(0,120).replace(/\s+/g," ").trim();
        throw new Error("Respuesta no JSON: "+peek);
      }
      if(!r.ok || j?.ok===false) throw new Error(j?.error||("HTTP "+r.status));
      return j;
    }
    window.apiBuild=function(action,params){
      const qs=new URLSearchParams(params||{}).toString();
      return window.API+"?action="+action+(qs?("&"+qs):"");
    };
    window.apiGet=async function(action,params){
      const r=await fetch(window.apiBuild(action,params),{headers:{...window.authH()}});
      const txt=await r.text(); return parseJson(r,txt);
    };
    window.apiPost=async function(action,data){
      const r=await fetch(window.apiBuild(action),{
        method:"POST",headers:{"Content-Type":"application/json",...window.authH()},body:JSON.stringify(data||{})
      });
      const txt=await r.text(); return parseJson(r,txt);
    };
    console.log("[config] API =",window.API);
  }catch(e){ console.error("config init error",e); }
})();