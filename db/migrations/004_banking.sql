-- Plaid access tokens are encrypted by the application before persistence.
CREATE TABLE IF NOT EXISTS bank_connections(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 provider TEXT NOT NULL DEFAULT 'plaid' CHECK(provider='plaid'),
 item_id TEXT NOT NULL,
 access_ciphertext TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(user_id,provider,item_id)
);
CREATE INDEX IF NOT EXISTS bank_connections_user_idx ON bank_connections(user_id);
