-- V3: versioned local KEK metadata and durable database operation intents.
-- Back up the database before applying. This migration is additive and does
-- not re-encrypt content; historical encrypted rows are assigned key version v1.
ALTER TABLE content
  ADD COLUMN kek_version VARCHAR(32) NOT NULL DEFAULT 'v1';

ALTER TABLE blockchain_operations
  ADD COLUMN operation_key CHAR(36) NULL,
  ADD UNIQUE INDEX uq_blockchain_operation_key (operation_key);

CREATE INDEX idx_security_type_time ON security_events (event_type, created_at);

-- The existing PENDING/CONFIRMED/FAILED status vocabulary is preserved.
-- A no-hash or otherwise ambiguous submission remains PENDING with a bounded
-- diagnostic and is surfaced for manual chain inspection, never auto-granted.
