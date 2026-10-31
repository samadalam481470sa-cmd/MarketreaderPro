CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS app_users(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 email TEXT NOT NULL UNIQUE CHECK(length(email)<=254),
 password_hash TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_sessions(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON user_sessions(user_id,expires_at);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON user_sessions(expires_at);
CREATE TABLE IF NOT EXISTS paper_accounts(
 user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
 cash_cents BIGINT NOT NULL DEFAULT 10000000 CHECK(cash_cents>=0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS paper_orders(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 symbol TEXT NOT NULL CHECK(symbol ~ '^[A-Z0-9.-]{1,20}$'),
 side TEXT NOT NULL CHECK(side IN ('buy','sell')),
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100000),
 price_cents BIGINT NOT NULL CHECK(price_cents>0),
 total_cents BIGINT NOT NULL CHECK(total_cents>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 request_id UUID NOT NULL,
 UNIQUE(user_id,request_id)
);
CREATE INDEX IF NOT EXISTS paper_orders_user_idx ON paper_orders(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS paper_positions(
 user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 symbol TEXT NOT NULL,
 quantity BIGINT NOT NULL DEFAULT 0 CHECK(quantity>=0),
 PRIMARY KEY(user_id,symbol)
);
CREATE TABLE IF NOT EXISTS sec_filing_events(
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 cik TEXT NOT NULL CHECK(cik ~ '^[0-9]{10}$'),
 accession TEXT NOT NULL,
 form TEXT NOT NULL,
 filed_at DATE NOT NULL,
 report_at DATE,
 primary_document TEXT,
 source_url TEXT NOT NULL,
 fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(cik,accession)
);
CREATE INDEX IF NOT EXISTS sec_filing_events_filed_idx ON sec_filing_events(filed_at DESC);
