CREATE TABLE IF NOT EXISTS official_filing_index (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source TEXT NOT NULL CHECK(source IN ('house','sec')),
 source_id TEXT NOT NULL,
 filer_name TEXT,
 document_type TEXT NOT NULL,
 filed_date DATE,
 document_url TEXT NOT NULL CHECK(document_url LIKE 'https://%'),
 source_year INTEGER,
 imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(source,source_id)
);
CREATE INDEX IF NOT EXISTS official_filing_source_date ON official_filing_index(source,filed_date DESC);
CREATE TABLE IF NOT EXISTS sec_form4_transactions (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 accession TEXT NOT NULL,
 cik TEXT NOT NULL,
 issuer_cik TEXT,
 issuer_ticker TEXT,
 reporting_owner TEXT,
 security_title TEXT,
 transaction_date DATE,
 filing_date DATE,
 transaction_code TEXT,
 shares NUMERIC(30,8),
 price_per_share NUMERIC(30,8),
 acquired_disposed TEXT CHECK(acquired_disposed IS NULL OR acquired_disposed IN ('A','D')),
 direct_indirect TEXT,
 source_url TEXT NOT NULL CHECK(source_url LIKE 'https://%'),
 imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 source_key TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS sec_form4_trade_dates ON sec_form4_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS sec_form4_ticker_dates ON sec_form4_transactions(issuer_ticker,transaction_date DESC);
