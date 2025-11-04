-- One-shot "doctor" script: creates DB (if missing), creates core tables, tokens, and an admin user.
-- Use at your own risk in dev only.

CREATE DATABASE IF NOT EXISTS fans_cooperativa CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE fans_cooperativa;
INSERT INTO residente (Nombre,Apellido,Cedula,Correo,Telefono,Fecha_Ingreso,Contrasena,estado_aprobacion)
VALUES ('Nicolás','Pereyra','-','pereyranicolas417@gmail.com','-',CURDATE(),'tmp',1);

-- If the base schema is not present in the DB, paste/run your BaseDatos/fans_cooperativa.sql before continuing.

-- Ensure password column size fits bcrypt hashes
ALTER TABLE administrador MODIFY Contrasena VARCHAR(255) NOT NULL;
ALTER TABLE residente     MODIFY Contrasena VARCHAR(255) NOT NULL;

-- Create auth_tokens table
CREATE TABLE IF NOT EXISTS auth_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_role ENUM('admin','residente') NOT NULL,
  token CHAR(64) NOT NULL,
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_token (token),
  KEY idx_user (user_id, user_role),
  KEY idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create compatibility views (Linux MySQL is case-sensitive with table names)
DROP VIEW IF EXISTS Administrador;
DROP VIEW IF EXISTS Residente;
CREATE OR REPLACE VIEW Administrador AS SELECT * FROM administrador;
CREATE OR REPLACE VIEW Residente     AS SELECT * FROM residente;

-- Seed a default admin if not present (email: admin@fans.test, pass: Admin1234)
INSERT INTO administrador (Nombre, Apellido, Usuario, Correo, Contrasena, estado_aprobacion, fecha_registro)
SELECT 'Admin','Principal','admin','admin@fans.test',
       '$2y$10$eDw.M99A6DIW2o/mJYZZNOtGJEBMXerJlefyUZwb41zN7dd4Uw.Hm', 1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM administrador WHERE Correo='admin@fans.test');
