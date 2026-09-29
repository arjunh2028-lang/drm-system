-- =====================================================================
-- DRM SYSTEM - 3NF NORMALIZED DATABASE SCHEMA
-- =====================================================================
-- Formally normalized to Third Normal Form (3NF).
--
-- Normal Form Guarantees:
--   1. 1NF (First Normal Form):
--      - All column values are atomic (indivisible).
--      - No repeating groups or multi-valued arrays.
--      - Every relation possesses a declared primary key.
--
--   2. 2NF (Second Normal Form):
--      - Meets 1NF.
--      - No partial functional dependencies on any candidate key.
--      - For all non-prime attributes A and candidate keys K,
--        no strict subset of K determines A.
--
--   3. 3NF (Third Normal Form):
--      - Meets 2NF.
--      - No transitive dependencies: for every non-trivial functional
--        dependency X -> Y, either X is a superkey, or Y is a prime attribute.
--      - Lookup domains (roles, right_types, right_statuses, activity_actions)
--        are factored into standalone relational entities to avoid domain/data
--        anomalies and enforce referential integrity.
--
-- Execution:
--   CREATE DATABASE IF NOT EXISTS drm_system;
--   USE drm_system;
--   SOURCE schema.sql;
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW IF EXISTS view_rights_granted_per_user;
DROP VIEW IF EXISTS view_content_with_owner;
DROP PROCEDURE IF EXISTS sp_revoke_right;
DROP PROCEDURE IF EXISTS sp_grant_right;
DROP TRIGGER IF EXISTS trg_rights_after_update;
DROP TRIGGER IF EXISTS trg_rights_after_insert;

DROP TABLE IF EXISTS activity_log;
DROP TABLE IF EXISTS rights;
DROP TABLE IF EXISTS content;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS activity_actions;
DROP TABLE IF EXISTS right_statuses;
DROP TABLE IF EXISTS right_types;
DROP TABLE IF EXISTS roles;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 1. ROLES (3NF Master / Lookup Entity)
-- Eliminates hardcoded ENUM anomaly.
-- FDs: role_name -> display_name, description
-- Candidate Key: {role_name}
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    role_name       VARCHAR(20)         PRIMARY KEY,
    display_name    VARCHAR(50)         NOT NULL,
    description     VARCHAR(255)        NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO roles (role_name, display_name, description) VALUES
('CREATOR',   'Content Creator',    'Publishes, encrypts, licenses, and manages digital content'),
('CONSUMER',  'Buyer / Consumer',   'Browses marketplace, acquires licenses, streams and downloads content'),
('MODERATOR', 'Platform Moderator', 'Audits compliance, inspects platform-wide access logs, security oversight');

-- ---------------------------------------------------------------------
-- 2. USERS
-- Candidate Keys: {user_id}, {email}
-- Prime Attributes: {user_id, email}
-- Non-Prime Attributes: {name, password_hash, role, created_at}
-- FDs:
--   user_id -> name, email, password_hash, role, created_at
--   email   -> user_id, name, password_hash, role, created_at
-- In 3NF: Every determinant is a superkey. No partial or transitive dependencies.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id         INT AUTO_INCREMENT  PRIMARY KEY,
    name            VARCHAR(100)        NOT NULL,
    email           VARCHAR(150)        NOT NULL,
    password_hash   VARCHAR(255)        NOT NULL,
    role            VARCHAR(20)         NOT NULL DEFAULT 'CONSUMER',
    created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT fk_users_role
        FOREIGN KEY (role) REFERENCES roles(role_name)
        ON UPDATE CASCADE,
    CONSTRAINT chk_users_name_len CHECK (CHAR_LENGTH(name) >= 2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_users_role ON users(role);

-- ---------------------------------------------------------------------
-- 3. CONTENT
-- Candidate Keys: {content_id}, {stored_filename}
-- Prime Attributes: {content_id, stored_filename}
-- Non-Prime Attributes: {title, original_filename, file_path, file_hash, file_size, owner_id, upload_timestamp}
-- FDs:
--   content_id      -> title, original_filename, stored_filename, file_path, file_hash, file_size, owner_id, upload_timestamp
--   stored_filename -> content_id, title, original_filename, file_path, file_hash, file_size, owner_id, upload_timestamp
-- In 3NF: Every determinant is a candidate key.
-- ---------------------------------------------------------------------
CREATE TABLE content (
    content_id          INT AUTO_INCREMENT  PRIMARY KEY,
    title               VARCHAR(200)        NOT NULL,
    original_filename   VARCHAR(255)        NOT NULL,
    stored_filename     VARCHAR(255)        NOT NULL,
    file_path           VARCHAR(500)        NOT NULL,
    file_hash           CHAR(64)            NOT NULL,           -- SHA-256 hex digest
    file_size           BIGINT UNSIGNED     NOT NULL,
    owner_id            INT                 NOT NULL,
    upload_timestamp    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_content_stored_filename UNIQUE (stored_filename),
    CONSTRAINT fk_content_owner
        FOREIGN KEY (owner_id) REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_content_file_size CHECK (file_size >= 0),
    CONSTRAINT chk_content_hash_len CHECK (CHAR_LENGTH(file_hash) = 64)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_content_owner ON content(owner_id);

-- ---------------------------------------------------------------------
-- 4. RIGHT_TYPES (3NF Master / Lookup Entity)
-- FDs: right_type -> description
-- Candidate Key: {right_type}
-- ---------------------------------------------------------------------
CREATE TABLE right_types (
    right_type      VARCHAR(20)         PRIMARY KEY,
    description     VARCHAR(255)        NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO right_types (right_type, description) VALUES
('VIEW',     'Permission to decrypt and stream digital media in-browser'),
('DOWNLOAD', 'Permission to decrypt and download local copy of asset'),
('SHARE',    'Permission to delegate or grant access rights to other users');

-- ---------------------------------------------------------------------
-- 5. RIGHT_STATUSES (3NF Master / Lookup Entity)
-- FDs: status -> description
-- Candidate Key: {status}
-- ---------------------------------------------------------------------
CREATE TABLE right_statuses (
    status          VARCHAR(20)         PRIMARY KEY,
    description     VARCHAR(255)        NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO right_statuses (status, description) VALUES
('ACTIVE',  'Right is currently valid and active'),
('REVOKED', 'Right has been revoked and is inactive');

-- ---------------------------------------------------------------------
-- 6. RIGHTS
-- Candidate Keys: {right_id}, {content_id, user_id, right_type}
-- Prime Attributes: {right_id, content_id, user_id, right_type}
-- Non-Prime Attributes: {granted_by, granted_timestamp, status, revoked_by, revoked_timestamp}
-- FDs:
--   right_id -> content_id, user_id, right_type, granted_by, granted_timestamp, status, revoked_by, revoked_timestamp
--   (content_id, user_id, right_type) -> right_id, granted_by, granted_timestamp, status, revoked_by, revoked_timestamp
-- In 3NF: Both determinants are candidate keys. No partial or transitive dependencies.
-- ---------------------------------------------------------------------
CREATE TABLE rights (
    right_id            INT AUTO_INCREMENT  PRIMARY KEY,
    content_id          INT                 NOT NULL,
    user_id             INT                 NOT NULL,
    right_type          VARCHAR(20)         NOT NULL,
    granted_by          INT                 NOT NULL,
    granted_timestamp   DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status              VARCHAR(20)         NOT NULL DEFAULT 'ACTIVE',
    revoked_by          INT                 NULL,
    revoked_timestamp   DATETIME            NULL,
    CONSTRAINT uq_rights_content_user_type UNIQUE (content_id, user_id, right_type),
    CONSTRAINT fk_rights_content
        FOREIGN KEY (content_id) REFERENCES content(content_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_rights_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_rights_type
        FOREIGN KEY (right_type) REFERENCES right_types(right_type)
        ON UPDATE CASCADE,
    CONSTRAINT fk_rights_status
        FOREIGN KEY (status) REFERENCES right_statuses(status)
        ON UPDATE CASCADE,
    CONSTRAINT fk_rights_granted_by
        FOREIGN KEY (granted_by) REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_rights_revoked_by
        FOREIGN KEY (revoked_by) REFERENCES users(user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_rights_user ON rights(user_id);
CREATE INDEX idx_rights_content ON rights(content_id);
CREATE INDEX idx_rights_status ON rights(status);

-- ---------------------------------------------------------------------
-- 7. ACTIVITY_ACTIONS (3NF Master / Lookup Entity)
-- FDs: action_code -> category, description
-- Candidate Key: {action_code}
-- ---------------------------------------------------------------------
CREATE TABLE activity_actions (
    action_code     VARCHAR(50)         PRIMARY KEY,
    category        VARCHAR(50)         NOT NULL,
    description     VARCHAR(255)        NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO activity_actions (action_code, category, description) VALUES
('LOGIN',               'AUTH',     'User signed in to account'),
('LOGOUT',              'AUTH',     'User logged out of active session'),
('REGISTER',            'AUTH',     'New user account registered'),
('CONTENT_UPLOADED',    'CONTENT',  'Digital asset encrypted and uploaded'),
('CONTENT_VIEWED',      'ACCESS',   'Protected content decrypted and viewed/streamed'),
('CONTENT_DOWNLOADED',  'ACCESS',   'Protected content downloaded for offline consumption'),
('RIGHT_ACQUIRED',      'RIGHTS',   'User acquired content license via marketplace'),
('RIGHT_GRANTED',       'RIGHTS',   'Access right granted to user'),
('RIGHT_REVOKED',       'RIGHTS',   'Access right revoked from user'),
('INTEGRITY_VERIFIED',  'AUDIT',    'Cryptographic SHA-256 hash verified successfully'),
('INTEGRITY_TAMPERED',  'AUDIT',    'Hash mismatch or file tampering detected');

-- ---------------------------------------------------------------------
-- 8. ACTIVITY_LOG
-- Candidate Key: {activity_id}
-- FDs: activity_id -> content_id, actor_id, target_user_id, action, details, created_at
-- In 3NF: activity_id is superkey. All foreign keys explicitly enforced.
-- ---------------------------------------------------------------------
CREATE TABLE activity_log (
    activity_id     INT AUTO_INCREMENT  PRIMARY KEY,
    content_id      INT                 NULL,
    actor_id        INT                 NULL,
    target_user_id  INT                 NULL,
    action          VARCHAR(50)         NOT NULL,
    details         VARCHAR(500)        NULL,
    created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_activity_content
        FOREIGN KEY (content_id) REFERENCES content(content_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_activity_actor
        FOREIGN KEY (actor_id) REFERENCES users(user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_activity_target
        FOREIGN KEY (target_user_id) REFERENCES users(user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_activity_action
        FOREIGN KEY (action) REFERENCES activity_actions(action_code)
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_activity_content ON activity_log(content_id);
CREATE INDEX idx_activity_actor ON activity_log(actor_id);
CREATE INDEX idx_activity_created ON activity_log(created_at);
CREATE INDEX idx_activity_action ON activity_log(action);

-- =====================================================================
-- VIEWS (Preserves Normalized Storage while Simplifying Complex Joins)
-- =====================================================================

-- Content joined with owner information (used by "My Content" / details)
CREATE OR REPLACE VIEW view_content_with_owner AS
SELECT
    c.content_id,
    c.title,
    c.original_filename,
    c.stored_filename,
    c.file_path,
    c.file_hash,
    c.file_size,
    c.upload_timestamp,
    u.user_id   AS owner_id,
    u.name      AS owner_name,
    u.email     AS owner_email
FROM content c
JOIN users u ON u.user_id = c.owner_id;

-- Number of ACTIVE rights currently granted per user
CREATE OR REPLACE VIEW view_rights_granted_per_user AS
SELECT
    u.user_id,
    u.name,
    u.email,
    COUNT(r.right_id) AS active_rights_count
FROM users u
LEFT JOIN rights r ON r.user_id = u.user_id AND r.status = 'ACTIVE'
GROUP BY u.user_id, u.name, u.email;

-- =====================================================================
-- TRIGGERS
-- =====================================================================

DELIMITER $$

-- Automatically log every new right grant into the activity log.
CREATE TRIGGER trg_rights_after_insert
AFTER INSERT ON rights
FOR EACH ROW
BEGIN
    INSERT INTO activity_log (content_id, actor_id, target_user_id, action, details)
    VALUES (
        NEW.content_id,
        NEW.granted_by,
        NEW.user_id,
        'RIGHT_GRANTED',
        CONCAT('Right ', NEW.right_type, ' granted')
    );
END$$

-- Automatically log a right transitioning to REVOKED or re-granted to ACTIVE.
CREATE TRIGGER trg_rights_after_update
AFTER UPDATE ON rights
FOR EACH ROW
BEGIN
    IF NEW.status = 'REVOKED' AND OLD.status <> 'REVOKED' THEN
        INSERT INTO activity_log (content_id, actor_id, target_user_id, action, details)
        VALUES (
            NEW.content_id,
            NEW.revoked_by,
            NEW.user_id,
            'RIGHT_REVOKED',
            CONCAT('Right ', NEW.right_type, ' revoked')
        );
    ELSEIF NEW.status = 'ACTIVE' AND OLD.status = 'REVOKED' THEN
        INSERT INTO activity_log (content_id, actor_id, target_user_id, action, details)
        VALUES (
            NEW.content_id,
            NEW.granted_by,
            NEW.user_id,
            'RIGHT_GRANTED',
            CONCAT('Right ', NEW.right_type, ' re-granted')
        );
    END IF;
END$$

DELIMITER ;

-- =====================================================================
-- STORED PROCEDURES
-- =====================================================================

DELIMITER $$

-- Grant (or re-grant) a right. Idempotent: if (content, user, right)
-- already exists it flips back to ACTIVE instead of erroring.
CREATE PROCEDURE sp_grant_right (
    IN p_content_id   INT,
    IN p_user_id      INT,
    IN p_right_type   VARCHAR(20),
    IN p_granted_by   INT
)
BEGIN
    INSERT INTO rights (content_id, user_id, right_type, granted_by, status)
    VALUES (p_content_id, p_user_id, p_right_type, p_granted_by, 'ACTIVE')
    ON DUPLICATE KEY UPDATE
        status = 'ACTIVE',
        granted_by = p_granted_by,
        granted_timestamp = CURRENT_TIMESTAMP,
        revoked_by = NULL,
        revoked_timestamp = NULL;
END$$

-- Revoke a right by its primary key.
CREATE PROCEDURE sp_revoke_right (
    IN p_right_id    INT,
    IN p_revoked_by  INT
)
BEGIN
    UPDATE rights
       SET status = 'REVOKED',
           revoked_by = p_revoked_by,
           revoked_timestamp = CURRENT_TIMESTAMP
     WHERE right_id = p_right_id
       AND status = 'ACTIVE';
END$$

DELIMITER ;
