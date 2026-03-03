-- ============================================================
-- Cramer vs Portfolio Tracker - Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PORTFOLIOS TABLE
-- ============================================================
CREATE TABLE portfolios (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Portfolio',
  cash_balance NUMERIC(15, 2) DEFAULT 0.00,
  is_cramer BOOLEAN DEFAULT FALSE,  -- TRUE = Jim Cramer's portfolio
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HOLDINGS TABLE
-- ============================================================
CREATE TABLE holdings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL COLLATE "C",
  company_name TEXT,
  shares NUMERIC(15, 4) NOT NULL DEFAULT 0,
  avg_cost_basis NUMERIC(15, 4),  -- optional: track cost basis
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, symbol)
);

-- ============================================================
-- PRICE CACHE TABLE (store last known prices to reduce API calls)
-- ============================================================
CREATE TABLE price_cache (
  symbol TEXT PRIMARY KEY,
  price NUMERIC(15, 4) NOT NULL,
  previous_close NUMERIC(15, 4),
  change_percent NUMERIC(8, 4),
  company_name TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PORTFOLIO SNAPSHOTS (daily performance history)
-- ============================================================
CREATE TABLE portfolio_snapshots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  total_value NUMERIC(15, 2) NOT NULL,
  cash_balance NUMERIC(15, 2) NOT NULL,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, snapshot_date)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles, only update their own
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Portfolios: users see their own; Cramer portfolio is readable by all
CREATE POLICY "portfolios_select" ON portfolios FOR SELECT
  USING (user_id = auth.uid() OR is_cramer = TRUE);
CREATE POLICY "portfolios_insert" ON portfolios FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "portfolios_update" ON portfolios FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "portfolios_delete" ON portfolios FOR DELETE
  USING (user_id = auth.uid());

-- Holdings: follow portfolio ownership; Cramer holdings readable by all
CREATE POLICY "holdings_select" ON holdings FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid() OR is_cramer = TRUE
    )
  );
CREATE POLICY "holdings_insert" ON holdings FOR INSERT
  WITH CHECK (
    portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid())
  );
CREATE POLICY "holdings_update" ON holdings FOR UPDATE
  USING (
    portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid())
  );
CREATE POLICY "holdings_delete" ON holdings FOR DELETE
  USING (
    portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid())
  );

-- Price cache: readable by all authenticated users
CREATE POLICY "price_cache_select" ON price_cache FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "price_cache_upsert" ON price_cache FOR ALL USING (auth.role() = 'authenticated');

-- Portfolio snapshots: same as portfolios
CREATE POLICY "snapshots_select" ON portfolio_snapshots FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid() OR is_cramer = TRUE
    )
  );
CREATE POLICY "snapshots_insert" ON portfolio_snapshots FOR INSERT
  WITH CHECK (
    portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid())
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER portfolios_updated_at BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER holdings_updated_at BEFORE UPDATE ON holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED: Create Cramer's admin portfolio (run AFTER creating your admin account)
-- Replace 'YOUR_ADMIN_USER_ID' with the actual UUID from auth.users
-- ============================================================

-- Step 1: After signing up with your admin email, run this to make them admin:
-- UPDATE profiles SET is_admin = TRUE WHERE username = 'your_admin_username';

-- Step 2: Create Cramer's portfolio:
-- INSERT INTO portfolios (user_id, name, is_cramer, cash_balance)
-- VALUES ('YOUR_ADMIN_USER_ID', 'Jim Cramer Mad Money Portfolio', TRUE, 0);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_holdings_portfolio ON holdings(portfolio_id);
CREATE INDEX idx_holdings_symbol ON holdings(symbol);
CREATE INDEX idx_portfolios_user ON portfolios(user_id);
CREATE INDEX idx_portfolios_cramer ON portfolios(is_cramer);
CREATE INDEX idx_snapshots_portfolio_date ON portfolio_snapshots(portfolio_id, snapshot_date);
