(function(){
  const KEYS=['fans_token','token','auth_token'];
  function getToken(){ for(const k of KEYS){ const t=localStorage.getItem(k); if(t) return t; } return null; }
  function setToken(v){ KEYS.forEach(k=>localStorage.setItem(k,v)); }
  function clearToken(){ KEYS.forEach(k=>localStorage.removeItem(k)); }
  const t=getToken(); if(t) setToken(t);
  window.session={ getToken,setToken,clearToken };
})();