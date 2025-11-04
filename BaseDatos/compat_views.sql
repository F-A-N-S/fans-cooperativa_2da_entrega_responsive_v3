-- Optional: compatibility views to avoid case/table-name mismatches
-- Run AFTER creating the base tables.
DROP VIEW IF EXISTS Administrador;
DROP VIEW IF EXISTS Residente;

-- Map capitalized names (used in some scripts) to the real lowercase tables
CREATE OR REPLACE VIEW Administrador AS SELECT * FROM administrador;
CREATE OR REPLACE VIEW Residente     AS SELECT * FROM residente;
