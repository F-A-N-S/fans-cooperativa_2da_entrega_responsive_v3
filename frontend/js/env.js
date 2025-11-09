// Detecta la raíz del proyecto y arma las URLs absolutas del backend
(function () {
  const ROOT = location.pathname.includes('/frontend/')
    ? location.pathname.split('/frontend/')[0]
    : ''; // por si servís /frontend como docroot

  const API_BASE = ROOT + '/backend/api';

  window.FANS = {
    ROOT,
    API_BASE,
    USER_API: API_BASE + '/usuarios.php',
    COOP_API: API_BASE + '/cooperativa.php',
  };
})();