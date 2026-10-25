-- V2 content protection metadata and privacy-conscious security audit events.
-- Apply once to an existing V1 database, after backing up the database.
-- Existing content is explicitly marked LEGACY and remains plaintext until
-- converted with `npm run convert:legacy-content -- --apply`.
ALTER TABLE content
  ADD COLUMN encryption_status VARCHAR(20) NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN encrypted_dek VARCHAR(100) NULL,
  ADD COLUMN kek_nonce VARCHAR(32) NULL,
  ADD COLUMN kek_auth_tag VARCHAR(32) NULL,
  ADD COLUMN content_nonce VARCHAR(32) NULL,
  ADD COLUMN content_auth_tag VARCHAR(32) NULL,
  ADD COLUMN encrypted_file_hash CHAR(64) NULL;

ALTER TABLE blockchain_operations
  ADD COLUMN actor_user_id INT NULL,
  ADD CONSTRAINT fk_blockchain_operation_actor_v2 FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL;

CREATE TABLE security_events (
  security_event_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_id INT NULL,
  content_id INT NULL,
  event_type VARCHAR(50) NOT NULL,
  outcome VARCHAR(20) NOT NULL,
  detail VARCHAR(240) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_security_event_actor FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_security_event_content FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE SET NULL,
  CONSTRAINT chk_security_event_outcome CHECK (outcome IN ('ALLOWED', 'DENIED', 'ERROR')),
  INDEX idx_security_actor_time (actor_id, created_at),
  INDEX idx_security_content_time (content_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
