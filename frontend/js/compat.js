(function(){
  window.API     = window.API     || "/api/api.php";
  window.API_URL = window.API_URL || window.API;

  // Aliases legacy
  window.fansAuthHeaders = window.fansAuthHeaders || function(){ return (window.authH?window.authH():{}); };
  window.fansApiGet      = window.fansApiGet      || window.apiGet;
  window.fansApiPost     = window.fansApiPost     || window.apiPost;
})();