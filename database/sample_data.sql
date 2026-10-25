-- V3 retired this unsafe demo seed. It previously truncated application tables and
-- inserted plaintext placeholder files with embedded demo credentials.
-- Use the backend encrypted seeder after applying the schema/migrations and
-- configuring a private DEMO_PASSWORD and versioned KEK in backend/.env.
SELECT 'Legacy sample-data seed disabled; use the encrypted backend demo seeder.' AS guidance;
