# DRM System — V1 Blockchain Asset and License Management

An existing React, Express and MySQL DRM application extended with an optional
EVM-compatible asset and license registry. Blockchain-enabled assets require
confirmed on-chain ownership/license state as well as the existing MySQL checks;
legacy assets retain the existing database-only behavior. Content remains
plaintext in V1, so blockchain records do not prevent copying.

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
React (Vite) -> Express API -> MySQL + local file storage
                         \-> EVM JSON-RPC -> DRMRegistry contract
```

- **Frontend**: React + Vite, plain CSS, `axios` for API calls, JWT stored in `localStorage`.
- **Backend**: Node.js + Express, `mysql2` connection pool, `multer` for file uploads, `bcryptjs` + `jsonwebtoken` for auth.
- **Database**: MySQL — normalized account/content/rights/activity tables plus blockchain and wallet-link tables, 2 views, 2 triggers, and 2 stored procedures (see `database/schema.sql`).
- **File storage**: local filesystem under `uploads/`. Files remain plaintext; blockchain registration does not encrypt or prevent copying them.
- **Blockchain**: Solidity `DRMRegistry`, local Hardhat network, verified wallet association, asset hash/owner records, and wallet/right-scoped licenses. A backend-held issuer submits transactions after checking application permissions; this is a centralized trust model.

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
9. Try downloading content after revoking its DOWNLOAD right while authenticated — the backend returns `403 Forbidden`. An unauthenticated request returns `401`.
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
- Moderator accounts are provisioned by an administrator; public registration cannot create moderators.
- Rights are per-file; no folder/collection-level permission model yet.

## 11. Local Blockchain Setup (V1)

Use pnpm below (npm can be substituted if it is available). Run from the
repository root unless stated otherwise.

1. Install contract dependencies, compile and run contract tests:

   ```sh
   cd blockchain
   pnpm install
   pnpm run compile
   pnpm test
   ```

2. Start the local chain in a separate terminal:

   ```sh
   cd blockchain
   pnpm run node
   ```

   It prints funded local development accounts and test private keys. Copy a
   local key for the issuer into `backend/.env`; never use it outside this demo.
   In MetaMask, add a local network with RPC `http://127.0.0.1:8545`, chain ID
   `31337`, and currency `ETH`, then import a separate Hardhat test account for
   the owner/licensee demonstration.

3. Deploy the contract from another terminal:

   ```sh
   cd blockchain
   pnpm run deploy:local
   ```

   Copy the printed contract address to `BLOCKCHAIN_CONTRACT_ADDRESS` in
   `backend/.env`. Set `BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545`,
   `BLOCKCHAIN_CHAIN_ID=31337`, and `BLOCKCHAIN_ISSUER_PRIVATE_KEY` to a local
   test key. Do not commit these values.

4. Install backend dependencies and configure its environment:

   ```sh
   cd backend
   pnpm install
   cp .env.example .env
   ```

   Preserve your existing MySQL settings and JWT secret while adding the local
   blockchain settings. Compile contracts before starting the API; it reads the
   ABI from `blockchain/artifacts`.

5. For an existing V1 database, back it up and apply the additive migration once:

   ```sh
   mysql -u root -p drm_system < database/migrations/001_blockchain.sql
   ```

   This adds wallet/challenge and blockchain status tables; it does not register
   old content or revoke old rights. A fresh database can use the updated
   `database/schema.sql`. Do not rerun the full schema on an existing database:
   it drops and recreates the project's tables.

6. Start the frontend as usual. Connect an EVM wallet to the local chain and use
   **Link wallet** in the sidebar. Open owned content and select **Register on
   blockchain**. Each active legacy license recipient must link a wallet before
   registration migrates those rights. Owners can then grant/revoke rights from
   the existing rights panel; optional expiration is supported on registered
   assets.

Run the backend unit tests with `pnpm test` from `backend/`, contract tests with
`pnpm test` from `blockchain/`, and the frontend production build with
`npm run build` from `frontend/`.

Asset registration waits for one confirmation by default. Failed registration is
recorded as `FAILED` and can be retried from the asset details page. Blockchain-
enabled content fails closed when RPC or contract state cannot be verified.
Legacy content remains on the original DB-only path until registered.

### Troubleshooting

- **Registry artifacts missing:** run `pnpm run compile` in `blockchain/` before
  starting the backend.
- **RPC unavailable or chain mismatch:** make sure the local node is running and
  `BLOCKCHAIN_RPC_URL` and `BLOCKCHAIN_CHAIN_ID` match the network (31337 locally).
- **Contract not configured:** deploy again to the active local node and update
  `BLOCKCHAIN_CONTRACT_ADDRESS`; restarting the node resets its chain state.
- **Registration asks recipients to link wallets:** each existing active right
  needs a recipient account with a verified wallet before it can be migrated.
- **Registration is `FAILED`:** inspect the error shown on the asset details page,
  check RPC/contract settings and issuer key, then retry. A retry checks for an
  already-registered matching asset before submitting another registration.
- **Registration remains `PENDING`:** an in-progress attempt blocks duplicate
  submissions; if its worker stopped, the same owner can reclaim it after the
  two-minute stale window and the backend reconciles against the on-chain record.
- **Package install fails certificate verification:** use a working trusted
  registry/certificate configuration; do not disable TLS certificate checks.

### V1 trust and security limits

- The backend issuer is centralized and submits transactions after application
  authorization. Wallet signatures prove account ownership but do not make this a
  decentralized owner-signed transaction model.
- Files remain plaintext at rest and are delivered as plaintext to authorized
  viewers/downloads. Blockchain registration is not encryption and cannot erase
  copies already obtained.
- Production key custody, HTTPS deployment, secure playback, and recovery from
  inconsistent database/chain writes need further operational work.
- Public moderator registration is rejected and moderator-only content endpoints
  require the moderator role.

See [`docs/DRM_FEATURE_TRACKER.md`](docs/DRM_FEATURE_TRACKER.md) for all original
A1–G9 requirements and their current evidence status.

## 12. V2 Roadmap (Advanced DRM)

Future work may add full content encryption/key management, hardened protected
viewing, device controls, watermarking, advanced abuse detection and production
key custody. These features are intentionally not claimed by V1.
