-- =====================================================================
-- DRM SYSTEM - SAMPLE DATA
-- =====================================================================
-- Loads 3 demo users, 5 content records, several rights records and
-- activity history so the application can be explored immediately.
--
-- IMPORTANT: the password hashes below are REAL bcrypt hashes (cost 12)
-- for the password:   Password123!
-- They were generated offline (bcrypt is one-way, so this file never
-- contains a plaintext password) and will work with bcrypt.compare()
-- in the Node backend exactly as if the user had registered normally.
--
-- The matching sample files referenced by file_path already exist in
-- the project's uploads/ folder, with the file_hash values below being
-- their real SHA-256 digests -- so "Integrity Status: VERIFIED" will
-- show correctly out of the box.
--
-- Alternatively you can run `npm run seed` inside backend/ (see
-- backend/scripts/seed.js) which does the same thing programmatically.
-- =====================================================================

USE drm_system;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE activity_log;
TRUNCATE TABLE rights;
TRUNCATE TABLE content;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- USERS  (all three use the password: Password123!)
-- ---------------------------------------------------------------------
INSERT INTO users (user_id, name, email, password_hash, role, created_at) VALUES
(1, 'Alice Sharma',   'alice@example.com', '$2b$12$tnqy.NjucuzsUH0le8x8K.lYRxyA7cePq9FKhNti/136B4a2apIFa', 'CREATOR', '2026-01-05 09:00:00'),
(2, 'Bob Mehta',      'bob@example.com',   '$2b$12$fDczJntJcEPpitEMF/IZ8.DH90.NlFcPzkKCeFklaOWeM2FeMDoyO', 'CONSUMER', '2026-01-06 10:30:00'),
(3, "Carol D'Souza",  'carol@example.com', '$2b$12$drI1AHuco9vraOJOozVI4OoaWcMoBE2t0lqbugK6AaGyobemBAgq6', 'MODERATOR', '2026-01-07 14:15:00');

-- ---------------------------------------------------------------------
-- CONTENT
-- ---------------------------------------------------------------------
INSERT INTO content (content_id, title, original_filename, stored_filename, file_path, file_hash, file_size, owner_id, upload_timestamp) VALUES
(1, 'Project Proposal',    'project_proposal.pdf',  'sample-1-project_proposal.pdf',  'uploads/sample-1-project_proposal.pdf',  '4b40c4019ef8336656a29a87ee1647d9a9714fa0fabf4a85fe143fbb8a1124c2', 283, 1, '2026-01-10 11:00:00'),
(2, 'Research Notes',      'research_notes.docx',   'sample-2-research_notes.docx',   'uploads/sample-2-research_notes.docx',   'f802868daf76f2089ca2607956bcdc83cb30c23b8366d36461f33cbba26f5dcf', 214, 1, '2026-01-11 15:20:00'),
(3, 'Financial Report Q1', 'financial_report.xlsx', 'sample-3-financial_report.xlsx', 'uploads/sample-3-financial_report.xlsx', '38da08cbbc36b1248fd7cbb6eb3b8aeee0e5225ae3fb7e58fabad6669bec5006', 163, 2, '2026-01-12 09:45:00'),
(4, 'Marketing Plan',      'marketing_plan.pdf',    'sample-4-marketing_plan.pdf',    'uploads/sample-4-marketing_plan.pdf',    '9da3e19512285fce0f94db47175abac00877775d4e5c2c951e185855859f5fef', 163, 3, '2026-01-13 13:10:00'),
(5, 'Source Code Bundle',  'source_code.zip',       'sample-5-source_code.zip',       'uploads/sample-5-source_code.zip',       '5a5d58cc93d3d3c9393c25bfc72a0c0e07339e06669b7c800c4ce05e3c19ec25', 189, 2, '2026-01-14 16:40:00');

-- ---------------------------------------------------------------------
-- RIGHTS
-- (trg_rights_after_insert automatically writes matching activity_log
--  rows for every INSERT below)
-- ---------------------------------------------------------------------
-- Alice's Project Proposal: Bob gets VIEW + DOWNLOAD
INSERT INTO rights (content_id, user_id, right_type, granted_by, status, granted_timestamp) VALUES
(1, 2, 'VIEW',     1, 'ACTIVE', '2026-01-15 10:00:00'),
(1, 2, 'DOWNLOAD', 1, 'ACTIVE', '2026-01-15 10:01:00');

-- Alice's Research Notes: Carol gets VIEW only
INSERT INTO rights (content_id, user_id, right_type, granted_by, status, granted_timestamp) VALUES
(2, 3, 'VIEW', 1, 'ACTIVE', '2026-01-16 09:30:00');

-- Bob's Financial Report: Alice gets VIEW
INSERT INTO rights (content_id, user_id, right_type, granted_by, status, granted_timestamp) VALUES
(3, 1, 'VIEW', 2, 'ACTIVE', '2026-01-17 11:15:00');

-- Bob's Source Code Bundle: Carol gets SHARE (so Carol can also manage
-- who else gets rights on this file, without being the owner)
INSERT INTO rights (content_id, user_id, right_type, granted_by, status, granted_timestamp) VALUES
(5, 3, 'SHARE', 2, 'ACTIVE', '2026-01-18 08:20:00');

-- Carol's Marketing Plan: Alice gets VIEW, then it is revoked again
-- (demonstrates the revoke workflow / status history)
INSERT INTO rights (content_id, user_id, right_type, granted_by, status, granted_timestamp) VALUES
(4, 1, 'VIEW', 3, 'ACTIVE', '2026-01-19 12:00:00');

UPDATE rights
   SET status = 'REVOKED', revoked_by = 3, revoked_timestamp = '2026-01-20 09:00:00'
 WHERE content_id = 4 AND user_id = 1 AND right_type = 'VIEW';

-- ---------------------------------------------------------------------
-- ACTIVITY LOG -- manual entries for the upload events
-- (rights grant/revoke entries already exist thanks to the triggers)
-- ---------------------------------------------------------------------
INSERT INTO activity_log (content_id, actor_id, target_user_id, action, details, created_at) VALUES
(1, 1, NULL, 'CONTENT_UPLOADED', 'Uploaded project_proposal.pdf', '2026-01-10 11:00:00'),
(2, 1, NULL, 'CONTENT_UPLOADED', 'Uploaded research_notes.docx',  '2026-01-11 15:20:00'),
(3, 2, NULL, 'CONTENT_UPLOADED', 'Uploaded financial_report.xlsx','2026-01-12 09:45:00'),
(4, 3, NULL, 'CONTENT_UPLOADED', 'Uploaded marketing_plan.pdf',   '2026-01-13 13:10:00'),
(5, 2, NULL, 'CONTENT_UPLOADED', 'Uploaded source_code.zip',      '2026-01-14 16:40:00');
