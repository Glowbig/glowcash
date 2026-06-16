-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ACCOUNTS
-- ============================================================
CREATE TABLE accounts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  bank        TEXT NOT NULL CHECK (bank IN ('bancolombia', 'nequi', 'nu', 'davivienda', 'cash', 'other')),
  type        TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit', 'cash', 'wallet')),
  balance     DECIMAL(15,2) DEFAULT 0,
  currency    TEXT DEFAULT 'COP',
  last_four   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_own" ON accounts FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('need', 'want', 'saving')),
  icon        TEXT DEFAULT '💳',
  color       TEXT DEFAULT '#94A3B8',
  budget_pct  DECIMAL(5,2) DEFAULT 0,
  is_default  BOOLEAN DEFAULT FALSE
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_own_or_default" ON categories FOR SELECT
  USING (auth.uid() = user_id OR is_default = TRUE);
CREATE POLICY "categories_own_write" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_own_update" ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "categories_own_delete" ON categories FOR DELETE USING (auth.uid() = user_id);

-- Default categories for all new users
INSERT INTO categories (user_id, name, type, icon, color, budget_pct, is_default) VALUES
  (NULL, 'Alimentación',    'need', '🛒', '#22D3EE', 20, TRUE),
  (NULL, 'Vivienda',        'need', '🏠', '#38BDF8', 30, TRUE),
  (NULL, 'Transporte',      'need', '🚌', '#0EA5E9', 8,  TRUE),
  (NULL, 'Salud',           'need', '💊', '#06B6D4', 5,  TRUE),
  (NULL, 'Servicios',       'need', '💡', '#0891B2', 10, TRUE),
  (NULL, 'Restaurantes',    'want', '🍽️', '#A78BFA', 10, TRUE),
  (NULL, 'Entretenimiento', 'want', '🎬', '#8B5CF6', 8,  TRUE),
  (NULL, 'Ropa',            'want', '👗', '#7C3AED', 5,  TRUE),
  (NULL, 'Compras',         'want', '🛍️', '#6D28D9', 5,  TRUE),
  (NULL, 'Educación',       'want', '📚', '#5B21B6', 5,  TRUE),
  (NULL, 'Ahorro',          'saving', '💰', '#4ADE80', 12, TRUE),
  (NULL, 'Inversión',       'saving', '📈', '#22C55E', 5,  TRUE),
  (NULL, 'Transferencia',   'need', '↔️', '#64748B', 0,  TRUE),
  (NULL, 'Otro',            'want', '💳', '#94A3B8', 0,  TRUE);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id   UUID REFERENCES accounts(id) ON DELETE SET NULL,
  amount       DECIMAL(15,2) NOT NULL,
  description  TEXT NOT NULL,
  merchant     TEXT,
  category_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
  date         TIMESTAMPTZ NOT NULL,
  source       TEXT NOT NULL CHECK (source IN ('email', 'sms', 'manual', 'api')),
  raw_text     TEXT,
  hash         TEXT UNIQUE,  -- SHA256 for deduplication
  is_pending   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_date ON transactions (user_id, date DESC);
CREATE INDEX idx_transactions_hash ON transactions (hash);
CREATE INDEX idx_transactions_category ON transactions (user_id, category_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_own" ON transactions FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- CATEGORIZATION RULES (learning)
-- ============================================================
CREATE TABLE categorization_rules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pattern      TEXT NOT NULL,
  category_id  UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  confidence   DECIMAL(4,3) DEFAULT 1.0,
  uses_count   INTEGER DEFAULT 1,
  created_from TEXT DEFAULT 'user' CHECK (created_from IN ('user', 'ai')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, pattern)
);

ALTER TABLE categorization_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules_own" ON categorization_rules FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- BUDGET CONFIG
-- ============================================================
CREATE TABLE budget_config (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  income       DECIMAL(15,2) NOT NULL DEFAULT 2825095,
  model        TEXT DEFAULT '3_bolsillos' CHECK (model IN ('50_30_20', '3_bolsillos', 'custom')),
  period       TEXT DEFAULT 'monthly' CHECK (period IN ('monthly', 'biweekly')),
  needs_pct    DECIMAL(5,2) DEFAULT 58,
  wants_pct    DECIMAL(5,2) DEFAULT 30,
  savings_pct  DECIMAL(5,2) DEFAULT 12,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE budget_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budget_own" ON budget_config FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE alerts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('budget_exceeded', 'unusual_spending', 'nu_payment_due', 'saving_reminder', 'tip')),
  message    TEXT NOT NULL,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_user_unread ON alerts (user_id, read, created_at DESC);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_own" ON alerts FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTION: auto-create budget_config on new user signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO budget_config (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
