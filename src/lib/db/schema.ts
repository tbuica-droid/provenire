// Schema is kept as an inline string (not a .sql file) so it survives Next.js
// server bundling without runtime filesystem path resolution.
//
// Design note: every structured Finding field lives in its own normalized column
// — category, finding_type, severity, benchmark_*, estimated_value_impact — NOT
// as opaque JSON or memo prose. This is deliberate: it is what lets a cross-deal
// benchmarking corpus (span of control, headcount-to-revenue, cost-per-FTE) be
// assembled later with plain SQL, without re-processing old documents.

export const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS deals (
  id                          TEXT PRIMARY KEY,
  company                     TEXT NOT NULL,
  sector                      TEXT NOT NULL,
  deal_type                   TEXT NOT NULL,
  deal_size_or_revenue_range  TEXT NOT NULL DEFAULT '',
  created_at                  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY,
  deal_id      TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  doc_kind     TEXT NOT NULL DEFAULT 'Other',
  size_bytes   INTEGER NOT NULL DEFAULT 0,
  char_count   INTEGER NOT NULL DEFAULT 0,
  chunk_count  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
  id           TEXT PRIMARY KEY,
  document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  deal_id      TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  source_doc   TEXT NOT NULL,          -- denormalized filename (what the model cites)
  location     TEXT NOT NULL,          -- page / section / tab range
  text         TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL,
  embedding    BLOB,                   -- nullable; populated only for semantic embedder
  embedder     TEXT                    -- which embedder produced the stored vector
);
CREATE INDEX IF NOT EXISTS idx_chunks_deal ON chunks(deal_id);

CREATE TABLE IF NOT EXISTS findings (
  id                       TEXT PRIMARY KEY,   -- slug, unique within a run
  deal_id                  TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  run_id                   TEXT NOT NULL,
  category                 TEXT NOT NULL,      -- Financial | Legal | Commercial | Operational
  finding_type             TEXT NOT NULL,      -- Risk | Opportunity | Open Question
  title                    TEXT NOT NULL,
  severity                 TEXT,               -- High | Medium | Low | NULL (Open Question)
  rationale                TEXT NOT NULL,
  estimated_value_impact   TEXT,               -- dollar/structural impact + methodology, nullable

  -- normalized benchmark columns (the signature Operational differentiator)
  benchmark_metric              TEXT,
  benchmark_target_value        TEXT,
  benchmark_peer_range          TEXT,
  benchmark_deviation           TEXT,
  benchmark_source_note         TEXT,

  confidence               TEXT NOT NULL,      -- High | Medium | Low
  needs_human_review       INTEGER NOT NULL DEFAULT 0,
  grounded                 INTEGER NOT NULL DEFAULT 1,  -- citation passed enforcement?

  review_status            TEXT NOT NULL DEFAULT 'pending',  -- pending|approved|rejected|edited
  reviewed_at              TEXT,
  created_at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_findings_deal ON findings(deal_id);
CREATE INDEX IF NOT EXISTS idx_findings_review ON findings(deal_id, review_status);

CREATE TABLE IF NOT EXISTS finding_evidence (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  finding_id   TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  source_doc   TEXT NOT NULL,
  location     TEXT NOT NULL,
  quote_or_value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_finding ON finding_evidence(finding_id);

CREATE TABLE IF NOT EXISTS memos (
  id           TEXT PRIMARY KEY,
  deal_id      TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  finding_ids  TEXT NOT NULL DEFAULT '[]',   -- JSON array of approved finding ids included
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memos_deal ON memos(deal_id);
`;
