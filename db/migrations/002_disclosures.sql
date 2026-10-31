-- Publicly filed transactions; actual document ingestion is a future integration.
CREATE TABLE IF NOT EXISTS disclosure_sources (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  portal_url TEXT NOT NULL CHECK (portal_url LIKE 'https://%')
);
INSERT INTO disclosure_sources(code,description,portal_url) VALUES
 ('sec','SEC EDGAR Form 4','https://www.sec.gov/edgar/search/'),
 ('house','US House financial disclosures','https://disclosures-clerk.house.gov/FinancialDisclosure'),
 ('senate','US Senate financial disclosures','https://efdsearch.senate.gov/search/')
ON CONFLICT(code) DO NOTHING;
CREATE TABLE IF NOT EXISTS public_disclosures (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_code TEXT NOT NULL REFERENCES disclosure_sources(code),
  external_reference TEXT NOT NULL CHECK(length(external_reference) BETWEEN 1 AND 256),
  filer_display_name TEXT NOT NULL,
  issuer_symbol TEXT,
  transaction_type TEXT,
  transaction_date DATE,
  filed_at DATE NOT NULL,
  amount_min NUMERIC(18,2) CHECK(amount_min IS NULL OR amount_min >= 0),
  amount_max NUMERIC(18,2) CHECK(amount_max IS NULL OR amount_max >= amount_min),
  document_url TEXT NOT NULL CHECK(document_url LIKE 'https://%'),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_code,external_reference)
);
CREATE INDEX IF NOT EXISTS disclosures_filed_idx ON public_disclosures(filed_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS disclosures_symbol_idx ON public_disclosures(issuer_symbol, filed_at DESC);
COMMENT ON TABLE public_disclosures IS 'Stores verifiable, publicly filed records only; no insider or confidential data. A blank table means ingestion has not been implemented.';
