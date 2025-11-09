USE fans_cooperativa;
UPDATE administrador
SET Contrasena='$2y$10$eDw.M99A6DIW2o/mJYZZNOtGJEBMXerJlefyUZwb41zN7dd4Uw.Hm',
    estado_aprobacion=1
WHERE Correo='admin@fans.test';
