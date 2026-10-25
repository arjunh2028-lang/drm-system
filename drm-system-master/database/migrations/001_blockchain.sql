-- Apply once to an existing V1 database. Back up the database first.
-- This migration preserves legacy content and rights; they remain legacy until registered.
ALTER TABLE users
    ADD COLUMN wallet_address CHAR(42) NULL,
    ADD CONSTRAINT uq_users_wallet UNIQUE (wallet_address);

CREATE TABLE blockchain_assets (
    content_id INT PRIMARY KEY,
    chain_id BIGINT UNSIGNED NOT NULL,
    contract_address CHAR(42) NOT NULL,
    owner_wallet CHAR(42) NOT NULL,
    status VARCHAR(20) NOT NULL,
    registration_tx CHAR(66) NULL,
    error_message VARCHAR(500) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_blockchain_asset_content FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE CASCADE,
    CONSTRAINT chk_blockchain_asset_status CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE blockchain_rights (
    right_id INT PRIMARY KEY,
    expiration_timestamp BIGINT UNSIGNED NULL COMMENT 'Unix seconds; NULL means no expiration',
    transaction_hash CHAR(66) NULL,
    status VARCHAR(20) NOT NULL,
    error_message VARCHAR(500) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_blockchain_right_right FOREIGN KEY (right_id) REFERENCES rights(right_id) ON DELETE CASCADE,
    CONSTRAINT chk_blockchain_right_status CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE blockchain_operations (
    operation_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    content_id INT NOT NULL,
    right_id INT NULL,
    operation_type VARCHAR(10) NOT NULL,
    wallet_address CHAR(42) NOT NULL,
    right_type VARCHAR(20) NOT NULL,
    expiration_timestamp BIGINT UNSIGNED NULL COMMENT 'Unix seconds; NULL means no expiration',
    transaction_hash CHAR(66) NULL,
    block_number BIGINT UNSIGNED NULL,
    status VARCHAR(20) NOT NULL,
    database_sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    error_message VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_blockchain_operation_content FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE CASCADE,
    CONSTRAINT fk_blockchain_operation_right FOREIGN KEY (right_id) REFERENCES rights(right_id) ON DELETE SET NULL,
    CONSTRAINT chk_blockchain_operation_type CHECK (operation_type IN ('GRANT', 'REVOKE')),
    CONSTRAINT chk_blockchain_operation_status CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
    CONSTRAINT chk_blockchain_operation_sync CHECK (database_sync_status IN ('PENDING', 'SYNCED', 'FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE wallet_link_challenges (
    challenge_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    wallet_address CHAR(42) NOT NULL,
    nonce CHAR(64) NOT NULL UNIQUE,
    message VARCHAR(500) NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wallet_challenge_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
