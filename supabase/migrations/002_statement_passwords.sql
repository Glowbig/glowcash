-- =============================================================================
-- STATEMENT_PASSWORDS — Contraseñas guardadas para abrir extractos PDF
-- =============================================================================
-- Los extractos bancarios en PDF suelen venir protegidos con una contraseña
-- (normalmente la cédula del titular). El usuario puede guardar varias
-- candidatas aquí (cédula, fecha de nacimiento, etc.) y la función de import
-- de PDF las prueba una por una hasta encontrar la que abre el archivo.
CREATE TABLE statement_passwords (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label      TEXT        NOT NULL,             -- ej: "Cédula", "Fecha nacimiento"
  password   TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE statement_passwords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "statement_passwords_solo_dueno"
  ON statement_passwords FOR ALL
  USING (auth.uid() = user_id);
