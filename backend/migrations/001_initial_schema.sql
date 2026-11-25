-- JR13 SAVINGS PostgreSQL Initial Schema Migration (001)
-- Enforces non-negative balances, zero forfeiture, and restricted-funds governance

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(256),
  google_sub VARCHAR(128) UNIQUE,
  auth_provider VARCHAR(20) NOT NULL DEFAULT 'demo',
  account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(120) NOT NULL,
  phone_masked VARCHAR(20),
  city VARCHAR(80),
  state VARCHAR(80),
  preferred_start_inr NUMERIC(12, 2) NOT NULL DEFAULT 10.00 CHECK (preferred_start_inr >= 10),
  preferred_increment_inr NUMERIC(12, 2) NOT NULL DEFAULT 10.00 CHECK (preferred_increment_inr >= 5),
  preferred_upi_app VARCHAR(24),
  preferred_upi_vpa_masked VARCHAR(80),
  kyc_simulation_status VARCHAR(32) NOT NULL DEFAULT 'SIMULATED_VERIFIED',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenges (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_code VARCHAR(24) NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days IN (1, 49, 99, 299, 364)),
  illustrative_bonus_rate NUMERIC(5, 2) NOT NULL,
  start_amount_inr NUMERIC(12, 2) NOT NULL DEFAULT 10.00,
  increment_amount_inr NUMERIC(12, 2) NOT NULL DEFAULT 10.00,
  total_planned_inr NUMERIC(14, 2) NOT NULL CHECK (total_planned_inr > 0),
  total_saved_inr NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_saved_inr >= 0),
  completed_days INTEGER NOT NULL DEFAULT 0 CHECK (completed_days >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'FAILED')),
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  simulated_mode BOOLEAN NOT NULL DEFAULT TRUE CHECK (simulated_mode = TRUE),
  start_date DATE NOT NULL,
  next_due_date DATE NOT NULL,
  failed_reason VARCHAR(240),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_challenges_user ON challenges(user_id);

CREATE TABLE IF NOT EXISTS daily_contributions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id VARCHAR(64) NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 364),
  scheduled_date DATE NOT NULL,
  amount_inr NUMERIC(12, 2) NOT NULL CHECK (amount_inr > 0),
  status VARCHAR(24) NOT NULL DEFAULT 'PAID_SIMULATED',
  reference_code VARCHAR(64) NOT NULL UNIQUE,
  upi_app VARCHAR(24),
  upi_vpa_masked VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contrib_challenge ON daily_contributions(challenge_id);

CREATE TABLE IF NOT EXISTS streaks (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id VARCHAR(64) NOT NULL UNIQUE REFERENCES challenges(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_contribution_date DATE,
  streak_broken BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id VARCHAR(64) NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  tx_type VARCHAR(40) NOT NULL,
  amount_inr NUMERIC(14, 2) NOT NULL CHECK (amount_inr >= 0),
  simulated BOOLEAN NOT NULL DEFAULT TRUE CHECK (simulated = TRUE),
  reference_id VARCHAR(64) NOT NULL UNIQUE,
  reconciliation_status VARCHAR(24) NOT NULL DEFAULT 'RECONCILED',
  upi_app VARCHAR(24),
  upi_vpa_masked VARCHAR(80),
  description VARCHAR(240) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);

CREATE TABLE IF NOT EXISTS restricted_funds_ledger (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id VARCHAR(64) NOT NULL UNIQUE REFERENCES challenges(id) ON DELETE CASCADE,
  principal_balance_inr NUMERIC(14, 2) NOT NULL CHECK (principal_balance_inr >= 0),
  ownership_status VARCHAR(32) NOT NULL DEFAULT 'USER_OWNED_RESTRICTED',
  forfeiture_prohibited BOOLEAN NOT NULL DEFAULT TRUE CHECK (forfeiture_prohibited = TRUE),
  admin_spend_prohibited BOOLEAN NOT NULL DEFAULT TRUE CHECK (admin_spend_prohibited = TRUE),
  legal_partner_review_status VARCHAR(40) NOT NULL DEFAULT 'PENDING_LEGAL_PARTNER_REVIEW',
  reconciliation_note VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settlement_requests (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id VARCHAR(64) NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  ledger_id VARCHAR(64) NOT NULL REFERENCES restricted_funds_ledger(id) ON DELETE CASCADE,
  amount_inr NUMERIC(14, 2) NOT NULL CHECK (amount_inr >= 0),
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING_LEGAL_PARTNER_REVIEW',
  legal_approval_ref VARCHAR(100),
  partner_bank_ref VARCHAR(100),
  transaction_ref VARCHAR(100),
  approved_by VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reward_records (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id VARCHAR(64) NOT NULL UNIQUE REFERENCES challenges(id) ON DELETE CASCADE,
  eligible_savings_inr NUMERIC(14, 2) NOT NULL,
  bonus_rate_pct NUMERIC(5, 2) NOT NULL,
  bonus_amount_inr NUMERIC(14, 2) NOT NULL,
  illustrative_only BOOLEAN NOT NULL DEFAULT TRUE CHECK (illustrative_only = TRUE),
  status VARCHAR(32) NOT NULL DEFAULT 'CREDITED_SIMULATED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(140) NOT NULL,
  message VARCHAR(400) NOT NULL,
  category VARCHAR(32) NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
  uid VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(254) NOT NULL UNIQUE,
  role VARCHAR(32) NOT NULL DEFAULT 'COMPLIANCE_ADMIN',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  actor_uid VARCHAR(64) NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  summary VARCHAR(320) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_uid);

CREATE TABLE IF NOT EXISTS payment_accounts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('UPI_VPA', 'BANK_ACCOUNT')),
  holder_name VARCHAR(120) NOT NULL,
  account_label VARCHAR(80) NOT NULL,
  upi_app VARCHAR(24),
  upi_vpa_masked VARCHAR(80),
  bank_name VARCHAR(80),
  ifsc_code VARCHAR(11),
  account_number_masked VARCHAR(32),
  account_last4 VARCHAR(4),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  simulated_mode BOOLEAN NOT NULL DEFAULT TRUE CHECK (simulated_mode = TRUE),
  verification_status VARCHAR(36) NOT NULL DEFAULT 'SIMULATED_VERIFIED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_user ON payment_accounts(user_id);
