-- =====================================================================
-- DRM SYSTEM - REFERENCE QUERIES
-- =====================================================================
-- These are the queries the backend actually runs (or close variants),
-- collected here to demonstrate the required DBMS concepts:
-- CREATE TABLE / INSERT / UPDATE / DELETE / SELECT / JOIN / GROUP BY /
-- HAVING / aggregate functions / subqueries / views / transactions /
-- stored procedures / triggers.
--
-- CREATE TABLE, VIEW, TRIGGER and PROCEDURE definitions live in
-- schema.sql. This file focuses on SELECT / INSERT / UPDATE / DELETE
-- and demonstrates them in the context of the DRM domain.
-- =====================================================================

USE drm_system;

-- ---------------------------------------------------------------------
-- 1. SELECT + JOIN
-- All content owned by a specific user, using the view that already
-- joins content with owner info.
-- ---------------------------------------------------------------------
SELECT content_id, title, original_filename, file_size, upload_timestamp
FROM view_content_with_owner
WHERE owner_id = 1
ORDER BY upload_timestamp DESC;

-- Plain JOIN version (content + owner + current active rights held by
-- a given viewer):
SELECT
    c.content_id,
    c.title,
    u.name  AS owner_name,
    r.right_type,
    r.status
FROM content c
JOIN users u  ON u.user_id = c.owner_id
LEFT JOIN rights r ON r.content_id = c.content_id AND r.user_id = 2 AND r.status = 'ACTIVE'
ORDER BY c.content_id;

-- ---------------------------------------------------------------------
-- 2. GROUP BY + HAVING + Aggregate functions
-- Number of content items owned by each user, only users owning 2+
-- files.
-- ---------------------------------------------------------------------
SELECT
    u.user_id,
    u.name,
    COUNT(c.content_id) AS content_count,
    SUM(c.file_size)    AS total_bytes,
    AVG(c.file_size)    AS avg_bytes
FROM users u
JOIN content c ON c.owner_id = u.user_id
GROUP BY u.user_id, u.name
HAVING COUNT(c.content_id) >= 2
ORDER BY content_count DESC;

-- Number of ACTIVE rights granted per user (who granted the most
-- rights to others):
SELECT
    granter.user_id,
    granter.name,
    COUNT(*) AS rights_granted_count
FROM rights r
JOIN users granter ON granter.user_id = r.granted_by
WHERE r.status = 'ACTIVE'
GROUP BY granter.user_id, granter.name
HAVING COUNT(*) > 0
ORDER BY rights_granted_count DESC;

-- ---------------------------------------------------------------------
-- 3. Subqueries
-- Content that the current user (say user_id = 2) can access, i.e. is
-- either the owner OR holds at least one ACTIVE right on it.
-- ---------------------------------------------------------------------
SELECT c.*
FROM content c
WHERE c.owner_id = 2
   OR c.content_id IN (
        SELECT r.content_id
        FROM rights r
        WHERE r.user_id = 2 AND r.status = 'ACTIVE'
   );

-- Users who currently hold NO active rights on any content (correlated
-- NOT EXISTS subquery):
SELECT u.user_id, u.name
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM rights r
    WHERE r.user_id = u.user_id AND r.status = 'ACTIVE'
);

-- The single largest file, using a subquery on MAX(file_size):
SELECT title, file_size
FROM content
WHERE file_size = (SELECT MAX(file_size) FROM content);

-- ---------------------------------------------------------------------
-- 4. Activity / history reporting
-- ---------------------------------------------------------------------
SELECT
    a.activity_id,
    a.action,
    c.title              AS content_title,
    actor.name            AS actor_name,
    target.name           AS target_user_name,
    a.details,
    a.created_at
FROM activity_log a
LEFT JOIN content c    ON c.content_id = a.content_id
LEFT JOIN users actor  ON actor.user_id = a.actor_id
LEFT JOIN users target ON target.user_id = a.target_user_id
ORDER BY a.created_at DESC
LIMIT 50;

-- Count of actions by type (aggregate + GROUP BY):
SELECT action, COUNT(*) AS occurrences
FROM activity_log
GROUP BY action
ORDER BY occurrences DESC;

-- ---------------------------------------------------------------------
-- 5. INSERT / UPDATE / DELETE examples
-- ---------------------------------------------------------------------

-- INSERT: register a new user (password already bcrypt-hashed by Node)
-- INSERT INTO users (name, email, password_hash)
-- VALUES ('Dan Kapoor', 'dan@example.com', '$2b$12$examplehashvalue...');

-- INSERT: register uploaded content
-- INSERT INTO content (title, original_filename, stored_filename, file_path, file_hash, file_size, owner_id)
-- VALUES ('Lecture Slides', 'slides.pdf', '1737000000000-slides.pdf', 'uploads/1737000000000-slides.pdf', '<sha256hex>', 204800, 1);

-- UPDATE: rename a piece of content (owner only -- enforced by backend)
-- UPDATE content SET title = 'Lecture Slides (Final)' WHERE content_id = 1 AND owner_id = 1;

-- DELETE: remove a right permanently (hard delete -- normally we prefer
-- the soft-revoke via sp_revoke_right, but DELETE is also demonstrated
-- here for completeness, e.g. for cleaning up mistaken grants):
-- DELETE FROM rights WHERE right_id = 999 AND status = 'REVOKED';

-- ---------------------------------------------------------------------
-- 6. Transactions
-- Example: granting a right and logging it atomically. In the real
-- schema the activity_log insert is actually done by the trigger, but
-- this illustrates an explicit multi-statement transaction as would be
-- used for an operation that touches more than one table by hand (e.g.
-- deleting content, which must also clean up its rights).
-- ---------------------------------------------------------------------
START TRANSACTION;

DELETE FROM rights WHERE content_id = 5;
DELETE FROM content WHERE content_id = 5 AND owner_id = 2;

-- If anything looks wrong, roll back instead of committing:
-- ROLLBACK;
COMMIT;

-- ---------------------------------------------------------------------
-- 7. Stored procedure calls (defined in schema.sql)
-- ---------------------------------------------------------------------
CALL sp_grant_right(1, 3, 'DOWNLOAD', 1);   -- Alice grants Carol DOWNLOAD on content 1
CALL sp_revoke_right(1, 1);                 -- revoke the right with right_id = 1

-- ---------------------------------------------------------------------
-- 8. Views (defined in schema.sql)
-- ---------------------------------------------------------------------
SELECT * FROM view_content_with_owner;
SELECT * FROM view_rights_granted_per_user ORDER BY active_rights_count DESC;
