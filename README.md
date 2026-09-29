# DRM System — V1 (MySQL, no blockchain)

A working, database-backed Digital Rights Management system built for a
DBMS/college project. Users register, upload digital content, and
control who else can **view**, **download**, or **share/manage rights**
on that content. All permission checks are enforced on the backend.

This is **V1**: a normal three-tier web app (React + Express + MySQL).
No blockchain, no crypto wallets, no smart contracts — see [V2
Roadmap](#v2-roadmap-blockchain) for how that could be layered on later.

---

## 1. Project Overview

Each user can:

- Register and log in (JWT-based auth, bcrypt-hashed passwords)
- Upload a file, becoming its **owner** with all rights automatically
- Grant other users **VIEW**, **DOWNLOAD**, or **SHARE** rights on content they own
- Revoke rights they previously granted
- View content and rights that have been shared with them
- View a SHA-256 **integrity status** (VERIFIED / MODIFIED) for any file they can access
- Browse a full activity/history log of uploads, grants, and revocations

A user with an active **SHARE** right (even if they don't own the
content) can also grant/revoke rights on that content on the owner's
behalf — this is enforced in the backend, not just the UI.

## 2. Architecture

```
React (Vite)  --HTTP/JSON-->  Express.js API  --SQL-->  MySQL
   :5173                          :5000                 :3306
      |                              |
      |                        local filesystem
      |                         (uploads/ folder)
```

- **Frontend**: React + Vite, plain CSS, `axios` for API calls, JWT stored in `localStorage`.
- **Backend**: Node.js + Express, `mysql2` connection pool, `multer` for file uploads, `bcryptjs` + `jsonwebtoken` for auth.
- **Database**: MySQL — 4 tables, 2 views, 2 triggers, 2 stored procedures (see `database/schema.sql`).
- **File storage**: local filesystem under `uploads/`. Only metadata + SHA-256 hash live in MySQL — never the file binary.

## 3. Requirements

- Node.js 18+ and npm
- MySQL 8.0+ (needed for `CHECK` constraints and modern SQL support)
- A terminal. That's it — everything else runs locally.

## 4. Installation

```bash
git clone <your-repo-url> drm-system
cd drm-system
```

### 4.1 Database Setup

```bash
mysql -u root -p -e "CREATE DATABASE drm_system;"
mysql -u root -p drm_system database/schema.sql
```

Then load demo data using **either** of these (pick one):

**Option A — recommended:** run the Node seed script after setting up
the backend (step 4.2). It regenerates the demo files on disk and
inserts everything through the same bcrypt/SHA-256 code paths the app
uses at runtime, so login and integrity checks are guaranteed correct:

```bash
cd backend
npm run seed
```

**Option B — pure SQL** (useful for grading / demonstrating raw SQL):

```bash
mysql -u root -p drm_system < database/sample_data.sql
```

This uses pre-computed bcrypt hashes and pre-computed SHA-256 hashes
that match the `sample-*` files already committed under `uploads/`.
Note: if you use Option B, make sure your git checkout hasn't altered
line endings on the `uploads/sample-*` files (a committed
`.gitattributes` already prevents this).

### 4.2 Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set DB_PASSWORD (and DB_USER if not root), and JWT_SECRET
npm start
```

The API runs at `http://localhost:5000`. You should see:
```
[db] Connected to MySQL database: drm_system
[server] DRM backend running on http://localhost:5000
```

### 4.3 Frontend Setup

In a separate terminal:

```bash
cd frontend
npm install
cp .env.example .env   # defaults already point at http://localhost:5000/api
npm run dev
```

Open `http://localhost:5173` in your browser.

## 5. Test Accounts

All demo accounts use the same password: **`Password123!`**

| Name         | Email               |
|--------------|---------------------|
| Alice Sharma | alice@example.com   |
| Bob Mehta    | bob@example.com     |
| Carol D'Souza| carol@example.com   |

These are **development/test credentials only** — never used in any
real deployment, and the database never stores the plaintext password,
only its bcrypt hash.

## 6. Demo Workflow (5–10 minutes)

1. **Log in as Alice** (`alice@example.com` / `Password123!`).
2. Go to **My Content** — Alice owns "Project Proposal" and "Research Notes".
3. Open **Project Proposal** → **Rights Management** → see that Bob already has VIEW + DOWNLOAD.
4. Click **Grant Right** → give Carol `VIEW` on this file too. Watch it appear in the rights table instantly.
5. Click **Revoke** next to Bob's DOWNLOAD right. Its status flips to `REVOKED` (history is preserved, not deleted).
6. Click **Verify Integrity** — should show `Integrity Status: VERIFIED`.
7. Log out, **log in as Bob** (`bob@example.com` / `Password123!`).
8. Go to **Accessible Content** — Bob can still see "Project Proposal" (VIEW right untouched) but can no longer download it.
9. Try opening `http://localhost:5000/api/content/1/download` directly without a DOWNLOAD right (e.g. via curl without a token, or after the revoke above) — the backend returns `403 Forbidden`, proving permissions are enforced server-side, not just hidden in the UI.
10. Go to **Activity History** — see the upload, grant, and revoke events timestamped in order.
11. Try **Upload Content** as Bob, then go to **My Content** — Bob is now the owner of a new file with full rights automatically.

## 7. API Overview

All routes except register/login require `Authorization: Bearer <token>`.

**Auth**
```
POST   /api/auth/register        { name, email, password, confirmPassword }
POST   /api/auth/login           { email, password }
GET    /api/auth/me
GET    /api/auth/users           list other users (for the "grant right to" dropdown)
```

**Content**
```
GET    /api/content              content you own
GET    /api/content/accessible   content shared with you (not owned)
POST   /api/content              multipart upload: fields "file", "title"
GET    /api/content/:id          full details + rights + your permissions
GET    /api/content/:id/view     stream file inline (requires VIEW or ownership)
GET    /api/content/:id/download stream file as attachment (requires DOWNLOAD or ownership)
GET    /api/content/:id/verify   recompute SHA-256, compare to stored hash
```

**Rights**
```
GET    /api/content/:id/rights          all rights (active + revoked) on this content
POST   /api/content/:id/rights          { userId, rightType } — grant/re-grant
DELETE /api/content/:id/rights/:rightId revoke a right
GET    /api/rights/mine                 active rights you hold on others' content
```

**History**
```
GET    /api/history?limit=100    activity involving you (actor, target, or content owner)
```

## 8. Database Schema

| Table          | Purpose                                                              |
|----------------|-----------------------------------------------------------------------|
| `users`        | Accounts: name, email (unique), bcrypt password hash                 |
| `content`      | Uploaded files' metadata, SHA-256 hash, owner, storage path           |
| `rights`       | One row per (content, user, right_type); soft-revoked via `status`   |
| `activity_log` | Full audit trail: uploads, views, downloads, grants, revokes          |

Also included:
- **Views**: `view_content_with_owner` (content joined with owner info), `view_rights_granted_per_user` (aggregate rights count per user)
- **Triggers**: `trg_rights_after_insert` / `trg_rights_after_update` automatically write `activity_log` rows whenever a right is granted or revoked
- **Stored procedures**: `sp_grant_right` (idempotent grant/re-grant), `sp_revoke_right`
- `database/queries.sql` has annotated example JOINs, GROUP BY/HAVING, subqueries, and transactions

## 9. Security Notes (V1 scope)

- Passwords hashed with bcrypt (`bcryptjs`), never stored or logged in plaintext.
- JWT-based auth with an expiring token; all content/rights/history routes require it.
- Every access check (VIEW/DOWNLOAD/SHARE) happens in the Express backend against the database — the frontend UI hides buttons for convenience only, it is never the actual gate.
- Uploaded filenames are sanitized and given a random unique stored name, preventing path traversal or collisions.
- File type is restricted to an allowlist of common document/media extensions, and file size is capped (`MAX_FILE_SIZE_MB`).
- Secrets (`JWT_SECRET`, DB credentials) live only in `.env`, which is git-ignored.
- Errors are logged server-side but only generic messages are returned to the client — no stack traces leak.

## 10. Known Limitations of V1

- No password reset / email verification flow.
- No pagination on content or history lists (fine for a class demo dataset, would need it at scale).
- No virus/malware scanning of uploaded files — extension allowlist only.
- No content versioning (re-uploading creates a new content record rather than a new version of an existing one).
- No admin role — every user has the same capabilities over their own content.
- Rights are per-file; no folder/collection-level permission model yet.

## 11. V2 Roadmap (Blockchain)

V1 already treats the concepts a blockchain layer would need as
first-class, identifiable data:

- `content.content_id` + `content.file_hash` → could be anchored as an on-chain content registration (hash-only, never the file itself).
- `content.owner_id` → could map to a wallet address for on-chain ownership proof.
- `rights` rows (`content_id`, `user_id`, `right_type`, `granted_by`, timestamps) → could be emitted as on-chain permission-grant/revoke transactions or events.
- `activity_log` → could become an off-chain index of on-chain transaction hashes, giving a fast queryable view backed by an immutable chain.

A plausible V2 architecture: keep MySQL as the fast, queryable "read
layer" for the UI, add a smart contract (e.g. on an EVM-compatible
chain) that mirrors ownership + rights grants/revocations as
transactions, and have the backend write to both — MySQL synchronously
for the UI, the chain asynchronously as a verifiable, tamper-evident
audit trail. None of that is implemented here; V1 is intentionally a
plain MySQL application so the DBMS fundamentals stay front and
center.
