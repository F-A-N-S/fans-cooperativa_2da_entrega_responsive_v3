// Minimal helpers: resolve API roots and auth headers
(function(){
  const m = location.pathname.match(/^(.+)\/frontend\//);
  const ROOT = m ? m[1] : '';
  window.API_COOP = ROOT + '/backend/api/cooperativa.php';
  window.API_USER = ROOT + '/backend/api/usuarios.php';

  window.fansAuthHeaders = function(){
    const t = localStorage.getItem('fans_token') || localStorage.getItem('token');
    return t ? { 'Authorization': 'Bearer '+t } : {};
  };
})();
