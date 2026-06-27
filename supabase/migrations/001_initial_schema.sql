-- =============================================================================
-- GLOWCASH — Schema inicial de base de datos
-- Supabase / PostgreSQL
--
-- Tablas:
--   accounts            → cuentas bancarias del usuario (Bancolombia, Nequi, Nu…)
--   categories          → categorías de gastos/ingresos con categorías por defecto
--   transactions        → todas las transacciones (email, SMS, manual)
--   categorization_rules→ reglas aprendidas para categorizar automáticamente
--   budget_config       → configuración del modelo 3-Bolsillos Nu por usuario
--   alerts              → notificaciones generadas por la app
--
-- Seguridad: RLS (Row Level Security) en todas las tablas.
-- Cada usuario solo puede ver y modificar sus propios datos.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- ACCOUNTS — Cuentas bancarias registradas por el usuario
-- =============================================================================
-- Ejemplo: "Bancolombia Ahorros *1234", "Nequi", "Nu Tarjeta de Crédito", "Efectivo"
CREATE TABLE accounts (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,                          -- Nombre legible: "Nequi", "Nu Crédito"
  bank        TEXT        NOT NULL CHECK (bank IN (
                'bancolombia', 'nequi', 'nu',
                'davivienda', 'cash', 'other'
              )),
  type        TEXT        NOT NULL CHECK (type IN (
                'checking',   -- cuenta corriente
                'savings',    -- cuenta de ahorros
                'credit',     -- tarjeta de crédito
                'cash',       -- efectivo
                'wallet'      -- billetera digital
              )),
  balance     DECIMAL(15,2) DEFAULT 0,
  currency    TEXT          DEFAULT 'COP',
  last_four   TEXT,                                          -- Últimos 4 dígitos de la tarjeta
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- Solo el dueño puede ver y modificar sus cuentas
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_solo_dueno"
  ON accounts FOR ALL
  USING (auth.uid() = user_id);


-- =============================================================================
-- CATEGORIES — Categorías de gastos e ingresos
-- =============================================================================
-- Hay dos tipos de categorías:
--   • Globales (user_id = NULL, is_default = TRUE): visibles para todos los usuarios.
--     Estas las insertamos abajo y no se pueden editar individualmente.
--   • Personales (user_id = <id>): creadas por el usuario para personalizar.
--
-- Tipos de categoría (alineados con el modelo 3-Bolsillos Nu):
--   need   → Gastos Fijos  (vivienda, servicios, transporte, salud)
--   want   → Gastos Variables (restaurantes, ropa, entretenimiento)
--   saving → Ahorro / Inversión
CREATE TABLE categories (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID          REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = categoría global
  name        TEXT          NOT NULL,
  type        TEXT          NOT NULL CHECK (type IN ('need', 'want', 'saving')),
  icon        TEXT          DEFAULT '💳',
  color       TEXT          DEFAULT '#94A3B8',
  budget_pct  DECIMAL(5,2)  DEFAULT 0,   -- % del salario neto sugerido para esta categoría
  is_default  BOOLEAN       DEFAULT FALSE
);

-- El usuario puede leer las globales (is_default=TRUE) y las suyas propias.
-- Solo puede crear/editar/borrar las suyas.
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_leer_globales_y_propias"
  ON categories FOR SELECT
  USING (is_default = TRUE OR auth.uid() = user_id);

CREATE POLICY "categories_crear_propias"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories_editar_propias"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "categories_borrar_propias"
  ON categories FOR DELETE
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------
-- Categorías globales por defecto (visibles para todos los usuarios)
-- Organizadas por el modelo 3-Bolsillos Nu:
--   need   → Gastos Fijos  (arriendo, servicios, transporte, salud)
--   want   → Gastos Variables (ocio, ropa, restaurantes)
--   saving → Ahorro e inversión
-- -----------------------------------------------------------------------
INSERT INTO categories (user_id, name, type, icon, color, budget_pct, is_default) VALUES
  -- GASTOS FIJOS (need) — objetivo: ~58% del salario neto
  (NULL, 'Vivienda',        'need',   '🏠', '#38BDF8', 30, TRUE),  -- arriendo o cuota hipoteca
  (NULL, 'Alimentación',    'need',   '🛒', '#22D3EE', 20, TRUE),  -- mercado y compras de despensa
  (NULL, 'Servicios',       'need',   '💡', '#0891B2', 10, TRUE),  -- luz, agua, gas, internet, celular
  (NULL, 'Transporte',      'need',   '🚌', '#0EA5E9',  8, TRUE),  -- Transmilenio, Uber, gasolina
  (NULL, 'Salud',           'need',   '💊', '#06B6D4',  5, TRUE),  -- médico, medicamentos, EPS adicional

  -- GASTOS VARIABLES (want) — objetivo: ~30% del salario neto
  (NULL, 'Restaurantes',    'want',   '🍽️', '#A78BFA', 10, TRUE), -- domicilios, salidas a comer
  (NULL, 'Entretenimiento', 'want',   '🎬', '#8B5CF6',  8, TRUE), -- Netflix, Spotify, cine, juegos
  (NULL, 'Ropa',            'want',   '👗', '#7C3AED',  5, TRUE), -- ropa, zapatos, accesorios
  (NULL, 'Compras',         'want',   '🛍️', '#6D28D9',  5, TRUE), -- Amazon, Mercado Libre, otros
  (NULL, 'Educación',       'want',   '📚', '#5B21B6',  5, TRUE), -- cursos, libros, suscripciones

  -- AHORRO / INVERSIÓN (saving) — objetivo: ~12% del salario neto
  (NULL, 'Ahorro',          'saving', '💰', '#4ADE80', 12, TRUE), -- bolsillo Nu, CDT, fondo emergencia
  (NULL, 'Inversión',       'saving', '📈', '#22C55E',  5, TRUE), -- FIC, acciones, criptomonedas

  -- NEUTRAS (no cuentan en el presupuesto de gasto)
  (NULL, 'Transferencia',   'need',   '↔️', '#64748B',  0, TRUE), -- movimientos entre cuentas propias
  (NULL, 'Otro',            'want',   '💳', '#94A3B8',  0, TRUE); -- sin categoría definida


-- =============================================================================
-- TRANSACTIONS — Registro de todas las transacciones
-- =============================================================================
-- Fuentes posibles (columna `source`):
--   email  → importada de un correo de Bancolombia, Nequi o Nu
--   sms    → leída directamente de un SMS en Android
--   manual → ingresada a mano por el usuario
--   api    → sincronizada desde la API bancaria (futuro)
--
-- Monto:
--   Negativo (-) = gasto / débito
--   Positivo (+) = ingreso / crédito
--
-- Deduplicación:
--   El campo `hash` = SHA256(fecha + monto + descripción normalizada).
--   Si la misma transacción llega por email Y por SMS, solo se guarda una vez.
CREATE TABLE transactions (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id   UUID          REFERENCES accounts(id) ON DELETE SET NULL,
  amount       DECIMAL(15,2) NOT NULL,             -- negativo = gasto, positivo = ingreso
  description  TEXT          NOT NULL,             -- texto original de la notificación
  merchant     TEXT,                               -- nombre del comercio extraído (ej: "D1", "Rappi")
  category_id  UUID          REFERENCES categories(id) ON DELETE SET NULL,
  date         TIMESTAMPTZ   NOT NULL,
  source       TEXT          NOT NULL CHECK (source IN ('email', 'sms', 'manual', 'api')),
  raw_text     TEXT,                               -- texto completo original del email/SMS
  hash         TEXT          UNIQUE,               -- SHA256 para evitar duplicados
  is_pending   BOOLEAN       DEFAULT FALSE,
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX idx_transactions_user_date     ON transactions (user_id, date DESC);
CREATE INDEX idx_transactions_hash          ON transactions (hash);
CREATE INDEX idx_transactions_user_category ON transactions (user_id, category_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_solo_dueno"
  ON transactions FOR ALL
  USING (auth.uid() = user_id);


-- =============================================================================
-- CATEGORIZATION_RULES — Reglas aprendidas para categorización automática
-- =============================================================================
-- Cuando el usuario corrige "STARBUCKS → Otro" a "STARBUCKS → Restaurantes",
-- se guarda aquí la regla. La próxima vez que aparezca "STARBUCKS" (o algo
-- similar por fuzzy matching), se categoriza automáticamente sin llamar a Gemini.
--
-- created_from:
--   user → el usuario corrigió manualmente la categoría (confidence = 1.0)
--   ai   → Gemini Flash sugirió la categoría y se guardó para reutilizar
CREATE TABLE categorization_rules (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern      TEXT          NOT NULL,             -- texto del comercio/descripción normalizado
  category_id  UUID          NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  confidence   DECIMAL(4,3)  DEFAULT 1.0,          -- 0.0 a 1.0 (1.0 = certeza total)
  uses_count   INTEGER       DEFAULT 1,            -- cuántas veces se ha aplicado esta regla
  created_from TEXT          DEFAULT 'user' CHECK (created_from IN ('user', 'ai')),
  created_at   TIMESTAMPTZ   DEFAULT NOW(),

  UNIQUE (user_id, pattern)  -- no duplicar reglas para el mismo patrón y usuario
);

ALTER TABLE categorization_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reglas_solo_dueno"
  ON categorization_rules FOR ALL
  USING (auth.uid() = user_id);


-- =============================================================================
-- BUDGET_CONFIG — Configuración del modelo financiero por usuario
-- =============================================================================
-- Modelo por defecto: 3 Bolsillos Nu
--   savings_pct = 12% → transferir a bolsillo Nu el día de pago (primero)
--   needs_pct   = 58% → gastos fijos (arriendo, servicios, EPS…)
--   wants_pct   = 30% → gastos variables + pago tarjeta Nu al corte
--
-- El trigger `on_auth_user_created` crea este registro automáticamente
-- cuando el usuario se registra, con los valores por defecto.
CREATE TABLE budget_config (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID          NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  income       DECIMAL(15,2) NOT NULL DEFAULT 2825095,  -- salario NETO en COP (ajustable)
  model        TEXT          DEFAULT '3_bolsillos' CHECK (model IN (
                  '3_bolsillos',  -- Ahorro primero + Fijos + Variables (recomendado)
                  '50_30_20',     -- Necesidades / Gustos / Ahorro
                  'custom'        -- porcentajes libres definidos por el usuario
               )),
  period       TEXT          DEFAULT 'monthly' CHECK (period IN (
                  'monthly',    -- ciclo mensual
                  'biweekly'    -- quincenas (1ro y 15 del mes)
               )),
  needs_pct    DECIMAL(5,2)  DEFAULT 58,   -- % para gastos fijos
  wants_pct    DECIMAL(5,2)  DEFAULT 30,   -- % para gastos variables
  savings_pct  DECIMAL(5,2)  DEFAULT 12,   -- % para ahorro (se transfiere primero)
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE budget_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budget_solo_dueno"
  ON budget_config FOR ALL
  USING (auth.uid() = user_id);


-- =============================================================================
-- ALERTS — Notificaciones generadas por la app
-- =============================================================================
-- Tipos:
--   budget_exceeded   → una categoría superó su límite mensual
--   unusual_spending  → gasto > 150% del promedio en ese comercio
--   nu_payment_due    → se acerca la fecha de corte de la tarjeta Nu
--   saving_reminder   → recordatorio de transferir al bolsillo de ahorro
--   tip               → consejo financiero contextual
CREATE TABLE alerts (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN (
               'budget_exceeded',
               'unusual_spending',
               'nu_payment_due',
               'saving_reminder',
               'tip'
             )),
  message    TEXT        NOT NULL,
  read       BOOLEAN     DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_no_leidas
  ON alerts (user_id, read, created_at DESC);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alertas_solo_dueno"
  ON alerts FOR ALL
  USING (auth.uid() = user_id);


-- =============================================================================
-- TRIGGER — Inicializar budget_config al crear un nuevo usuario
-- =============================================================================
-- Cuando alguien se registra en la app, se crea automáticamente su configuración
-- financiera con los valores por defecto del modelo 3-Bolsillos Nu.
-- El usuario puede cambiar el salario y los porcentajes desde la pantalla Config.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO budget_config (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
