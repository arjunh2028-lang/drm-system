/**
 * Seeds the DRM database with 3 demo users, 5 content files, several
 * rights grants and activity history -- ready to explore immediately.
 *
 * This is the RECOMMENDED way to load demo data (rather than piping
 * database/sample_data.sql directly), because it:
 *   - hashes the demo password with the SAME bcrypt library the app
 *     uses at runtime, so login is guaranteed to work;
 *   - writes the sample files to disk itself and hashes them with the
 *     SAME SHA-256 routine the app uses, so integrity verification is
 *     guaranteed to show VERIFIED regardless of OS/line-ending quirks.
 *
 * Usage (from the backend/ directory, after `npm install` and with a
 * .env file pointing at a running MySQL server that already has
 * database/schema.sql applied):
 *
 *   npm run seed
 */
require('dotenv').config();
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const { sha256File } = require('../src/services/hashService');
const { UPLOAD_DIR, PROJECT_ROOT } = require('../src/config/paths');
const path = require('path');

const DEMO_PASSWORD = 'Password123!';

const DEMO_USERS = [
  { name: 'Alice Sharma', email: 'alice@example.com', role: 'CREATOR' },
  { name: 'Bob Mehta', email: 'bob@example.com', role: 'CONSUMER' },
  { name: "Carol D'Souza", email: 'carol@example.com', role: 'MODERATOR' },
];

const DEMO_FILES = [
  {
    title: 'Project Proposal',
    filename: 'project_proposal.pdf',
    ownerIndex: 0,
    body: `Project Proposal
=================
Title: Next-Gen Campus Portal
Author: Alice Sharma

This document outlines the proposal for building a unified campus
portal integrating attendance, grades, and library services.
(Sample placeholder content for DRM demo purposes.)
`,
  },
  {
    title: 'Research Notes',
    filename: 'research_notes.docx',
    ownerIndex: 0,
    body: `Research Notes
===============
Topic: Distributed Consensus Algorithms
Author: Alice Sharma

Summary of Raft vs Paxos trade-offs for the semester research paper.
(Sample placeholder content for DRM demo purposes.)
`,
  },
  {
    title: 'Financial Report Q1',
    filename: 'financial_report.xlsx',
    ownerIndex: 1,
    body: `Financial Report Q1
====================
Prepared by: Bob Mehta

Revenue, Expenses, Net Income summary for Q1.
(Sample placeholder content for DRM demo purposes.)
`,
  },
  {
    title: 'Marketing Plan',
    filename: 'marketing_plan.pdf',
    ownerIndex: 2,
    body: `Marketing Plan
==============
Prepared by: Carol D'Souza

Go-to-market strategy for the Spring product launch.
(Sample placeholder content for DRM demo purposes.)
`,
  },
  {
    title: 'Source Code Bundle',
    filename: 'source_code.zip',
    ownerIndex: 1,
    body: `Source Code Bundle (placeholder, not a real zip)
=================================================
Owner: Bob Mehta

This file stands in for a zipped source-code archive for demo purposes.
`,
  },
];

async function main() {
  console.log('[seed] Starting...');
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query('TRUNCATE TABLE activity_log');
  await pool.query('TRUNCATE TABLE rights');
  await pool.query('TRUNCATE TABLE content');
  await pool.query('TRUNCATE TABLE users');
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  // --- Users ---
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIds = [];
  for (const u of DEMO_USERS) {
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [u.name, u.email, passwordHash, u.role]
    );
    userIds.push(result.insertId);
    console.log(`[seed] Created user: ${u.name} <${u.email}>`);
  }

  // --- Content ---
  const contentIds = [];
  for (const f of DEMO_FILES) {
    const uniqueName = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}-${f.filename}`;
    const absPath = path.join(UPLOAD_DIR, uniqueName);
    fs.writeFileSync(absPath, f.body, 'utf8');

    const hash = await sha256File(absPath);
    const size = fs.statSync(absPath).size;
    const ownerId = userIds[f.ownerIndex];
    const relativePath = path.relative(PROJECT_ROOT, absPath);

    const [result] = await pool.query(
      `INSERT INTO content (title, original_filename, stored_filename, file_path, file_hash, file_size, owner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [f.title, f.filename, uniqueName, relativePath, hash, size, ownerId]
    );
    contentIds.push(result.insertId);

    await pool.query(
      `INSERT INTO activity_log (content_id, actor_id, action, details) VALUES (?, ?, 'CONTENT_UPLOADED', ?)`,
      [result.insertId, ownerId, `Uploaded ${f.filename}`]
    );
    console.log(`[seed] Created content: ${f.title} (owner: ${DEMO_USERS[f.ownerIndex].name})`);
  }

  // --- Rights ---  (content indices 0..4 map to contentIds[0..4])
  const [aliceId, bobId, carolId] = userIds;
  const [proposalId, notesId, financeId, marketingId, codeId] = contentIds;

  const grants = [
    [proposalId, bobId, 'VIEW', aliceId],
    [proposalId, bobId, 'DOWNLOAD', aliceId],
    [notesId, carolId, 'VIEW', aliceId],
    [financeId, aliceId, 'VIEW', bobId],
    [codeId, carolId, 'SHARE', bobId],
    [marketingId, aliceId, 'VIEW', carolId],
  ];

  for (const [contentId, userId, rightType, grantedBy] of grants) {
    await pool.query('CALL sp_grant_right(?, ?, ?, ?)', [contentId, userId, rightType, grantedBy]);
  }
  console.log(`[seed] Granted ${grants.length} sample rights.`);

  // Demonstrate a revoke, matching database/sample_data.sql
  const [rightRows] = await pool.query(
    `SELECT right_id FROM rights WHERE content_id = ? AND user_id = ? AND right_type = 'VIEW'`,
    [marketingId, aliceId]
  );
  if (rightRows.length > 0) {
    await pool.query('CALL sp_revoke_right(?, ?)', [rightRows[0].right_id, carolId]);
    console.log('[seed] Revoked one sample right to demonstrate the workflow.');
  }

  console.log('\n[seed] Done! Test accounts (all use the same password):');
  DEMO_USERS.forEach((u) => console.log(`   - ${u.email} / ${DEMO_PASSWORD}`));

  await pool.end();
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
