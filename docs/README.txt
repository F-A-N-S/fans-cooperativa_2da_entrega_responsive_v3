F.A.N.S Minimal Patch — 2025-11-08

How to apply:
1) Extract this zip into your project root so that:
   - backend/api/cooperativa.php
   - backend/api/usuarios.php
   - frontend/js/{config,session,guard,header,backoffice,app-users}.js

2) In your HTML, keep only these scripts (order matters):
   <script defer src="js/config.js"></script>
   <script defer src="js/session.js"></script>
   <script defer src="js/guard.js" data-guard="user-only|admin-only"></script>
   <script defer src="js/header.js"></script>
   (plus) backoffice.html -> <script defer src="js/backoffice.js"></script>
   (plus) user pages -> <script defer src="js/app-users.js"></script>

3) Endpoints covered: see files.
