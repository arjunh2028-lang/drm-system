# DRM System — V3 DRM Protection and Blockchain Licensing

React, Express and MySQL DRM application with an EVM-compatible asset/license
registry and V3 AES-256-GCM envelope encryption. New uploads are encrypted before
they reach storage. Converted legacy files use the same protected delivery path;
unconverted legacy files are identified and protected delivery is refused.

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
- **File storage**: private local filesystem under `uploads/`. New content is AES-256-GCM ciphertext. The original SHA-256 remains the hash registered on chain; a separate encrypted-file hash validates stored ciphertext.
- **Key management**: each asset has a random DEK; a versioned local provider wraps it with a separately configured 32-byte KEK. Wrapped keys can be rotated without re-encrypting content. The local provider is development-grade, not a managed KMS or hardware-backed key store.
- **Blockchain**: Solidity `DRMRegistry`, local Hardhat network, verified wallet association, asset hash/owner records, and wallet/right-scoped licenses. A backend-held issuer submits transactions after checking application permissions; this is a centralized trust model.

## 3. Requirements

- Node.js 18+ and npm or pnpm
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

Then create demo data through the backend seeder after configuring a private
`DEMO_PASSWORD` and versioned KEK. The seed is non-destructive and writes only
encrypted fixture bytes to uploads.

```bash
cd backend
pnpm run seed
```

`database/sample_data.sql` is intentionally retired: it contained destructive
table truncation and referred to plaintext files with misleading extensions.

### 4.2 Backend Setup

```bash
cd backend
pnpm install
cp .env.example .env
# edit .env: set DB_PASSWORD, JWT_SECRET, CONTENT_KEK_VERSION, CONTENT_KEK_BASE64,
# and a private DEMO_PASSWORD before seeding new demo accounts
pnpm start
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
pnpm install
cp .env.example .env   # defaults already point at http://localhost:5000/api
pnpm run dev
```

Open `http://localhost:5173` in your browser.

## 5. Test Accounts

The encrypted demo seeder creates these development-only email accounts:

| Name         | Email               |
|--------------|---------------------|
| Alice Sharma | alice@example.com   |
| Bob Mehta    | bob@example.com     |
| Carol D'Souza| carol@example.com   |

Set a private `DEMO_PASSWORD` of at least 12 characters in `backend/.env`
before seeding new accounts. The seed script does not print it. Existing
accounts are reused without changing their password.

## 6. Demo Workflow (5–10 minutes)

1. **Log in as Alice** (`alice@example.com`) using the password configured for seeding.
2. Go to **My Content** — Alice owns "Project Proposal" and "Research Notes".
3. Open **Project Proposal** → **Rights Management** → see that Bob already has VIEW + DOWNLOAD.
4. Click **Grant Right** → give Carol `VIEW` on this file too. Watch it appear in the rights table instantly.
5. Click **Revoke** next to Bob's DOWNLOAD right. Its status flips to `REVOKED` (history is preserved, not deleted).
6. Click **Verify Integrity** — should show `Integrity Status: VERIFIED`.
7. Log out, **log in as Bob** (`bob@example.com`) using the configured seed password.
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
GET    /api/content/:id/view     decrypt after VIEW authorization (does not grant DOWNLOAD)
GET    /api/content/:id/download decrypt after DOWNLOAD authorization
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

## 9. Security Notes

- Passwords hashed with bcrypt (`bcryptjs`), never stored or logged in plaintext.
- JWT-based auth with an expiring token; all content/rights/history routes require it.
- Content delivery checks the authenticated server-side VIEW or DOWNLOAD right, expiration and revocation state, and confirmed chain state where an asset is registered. VIEW does not imply DOWNLOAD or SHARE.
- Uploaded filenames are sanitized and given a random unique stored name, preventing path traversal or collisions.
- File type is restricted to an allowlist of common document/media extensions, and file size is capped (`MAX_FILE_SIZE_MB`).
- Secrets (`JWT_SECRET`, DB credentials, blockchain issuer key, all KEK versions, and `DEMO_PASSWORD`) live only in `.env`, which is git-ignored.
- Error logs contain request metadata and error codes rather than raw exception messages; API responses use generic errors for internal failures.

## 10. Known Limitations

- No password reset / email verification flow.
- No pagination on content or history lists (fine for a class demo dataset, would need it at scale).
- No virus/malware scanning of uploaded files — extension allowlist only.
- Authorized view/download returns plaintext to the user's browser. Watermarks and server-side authorization discourage misuse but cannot prevent screenshots, copying, or redistribution.
- Protected VIEW previews are supported for UTF-8 `.txt` and CSV only. CSV is rendered to escaped HTML instead of prefixing the original CSV. PDF, Office, image, audio, and video views fail closed; DOWNLOAD rights remain separate.
- Visible watermarking is an attribution aid, not forensic watermarking or copy prevention.
- The KEK provider supports versioned environment keys and DEK re-wrapping. Production still requires managed KMS/HSM custody, access controls, durable backup, and incident recovery.
- Legacy conversion moves verified plaintext sources to `backend/legacy-backups/`, outside the upload directory. The sample placeholder files remain plaintext pending live data inventory and safe retirement; the repository is not described as fully protected at rest.
- If the KEK is lost, wrapped DEKs cannot be recovered. Keep a controlled backup separate from the application host.
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

5. For an existing V1 database, back it up and apply the additive V1 blockchain migration, then V2 migration:

   ```sh
   mysql -u root -p drm_system < database/migrations/001_blockchain.sql
   ```

   After backend dependencies and `.env` are configured, run `pnpm run migrate:v2`
   from `backend/`. This introspects the schema and can be safely rerun. Existing
   content is marked `LEGACY`; convert it only after taking a storage backup.

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
`pnpm run build` from `frontend/`.

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

### Trust and security limits

- The backend issuer is centralized and submits transactions after application
  authorization. Wallet signatures prove account ownership but do not make this a
  decentralized owner-signed transaction model.
- Content is encrypted at rest after upload/conversion, but authorized users
  receive plaintext in their browser. Blockchain registration is not DRM by
  itself and cannot erase copies already obtained.
- Production key custody, HTTPS deployment, secure playback, and live recovery
  from inconsistent database/chain writes need operational validation.
- Public moderator registration is rejected and moderator-only content endpoints
  require the moderator role.

See [`docs/DRM_FEATURE_TRACKER.md`](docs/DRM_FEATURE_TRACKER.md) for all original
A1–G9 requirements and their current evidence status.

## 12. Advanced DRM limits

This project does not implement device attestation, offline license enforcement,
TEE/native DRM, managed KMS/HSM integration, forensic per-copy watermarking, or
screenshot prevention. These capabilities require a target native platform,
trusted hardware/service, or separate DRM ecosystem. A visible browser watermark
cannot prevent capture or copying.

## 13. V2/V3 Operations

### Required key setup

Configure `CONTENT_KEK_VERSION=v1` and `CONTENT_KEK_BASE64` in `backend/.env` before starting the API. Generate
32 random bytes with Node's built-in cryptography (run locally, never paste the
result into source control):

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

The backend validates the value at startup and refuses to start if it is missing
or malformed. Back up the KEK in a restricted secret manager. Losing the KEK
permanently prevents decryption of its wrapped asset keys.

### Migrations and legacy files

Back up MySQL and `uploads/` first. For an existing V1 database, apply the V2
additive migration after `001_blockchain.sql`:

```sh
cd backend
pnpm run migrate:v2
```

The migration is safe to rerun; existing rows are classified `LEGACY`. Preview
the files that can be converted, then opt in to conversion:

```sh
pnpm run convert:legacy-content
pnpm run convert:legacy-content -- --apply
```

The converter checks each original plaintext SHA-256, writes and reads back
ciphertext, moves the source to `backend/legacy-backups/`, and only then updates
the database metadata. It reports converted, skipped, failed, and unresolved
assets. The backup directory is excluded from Git but still requires host ACLs,
backup controls, and eventual retention-based retirement. A run interrupted
after the move can be retried using the protected backup source.

For a fresh installation, use the updated `database/schema.sql`; it creates
encryption metadata and security audit tables. Do not run the destructive fresh
schema against an existing database.

### License recovery and verification

Run the reconciliation command after resolving RPC/database outages:

```sh
cd backend
pnpm run reconcile:blockchain
```

It inspects confirmed or submitted transactions, waits for the configured
confirmation depth, checks current on-chain license state, then synchronizes
MySQL rights and operation records transactionally. Pending or conflicting
chain state is reported as skipped for manual review rather than granted.

Run backend tests with `pnpm test` from `backend/`, contract tests with `pnpm test`
from `blockchain/`, and the frontend build with `pnpm run build` from `frontend/`.
Use a separate disposable database and local chain for integration checks.

### Delivery and monitoring behavior

Uploads use in-memory multipart handling and persist only ciphertext. Protected
content routes authorize before setting response headers, verify encrypted hash,
AES-GCM authentication, and the original plaintext SHA-256 before sending bytes.
Responses are private/no-store and use nosniff/sandbox headers. Only `.txt` and
`.csv` get a server-generated visible identity/asset/time watermark. Security
events record authentication/access denials and blockchain failures without
recording credentials, signatures, keys, or file contents. A configurable count
of repeated denials emits a warning; it is not a claim that an account is
malicious.

Legacy DB-only rights are retained as a migration path, but legacy plaintext
files cannot be viewed or downloaded through protected delivery until
conversion. Blockchain-backed assets in PENDING or FAILED state fail closed.

## 14. V3 key management, conversion, and protected preview

V3 adds an environment-backed **versioned local key provider**. `CONTENT_KEK_VERSION`
selects the active key. For compatibility, version `v1` reads `CONTENT_KEK_BASE64`;
later versions use variables such as `CONTENT_KEK_V2_BASE64`. Keep every old key
available until all wrapped DEKs have been rotated and verified. Generate each
key with Node's cryptography, store it in a restricted secret store, and keep an
independent protected backup. This provider is not a KMS or HSM.

For an existing installation, back up MySQL and the storage directory, apply
migrations `001_blockchain.sql` and `002_v2_drm.sql` if needed, then run
`pnpm run migrate:v3` from `backend/`. The V3 migration is additive: it adds a
KEK version column and operation intent identifier without dropping records.
Do not rerun `database/schema.sql` against an existing database; it recreates
tables. Inventory and preview historical content before applying conversion:

```sh
cd backend
pnpm run convert:legacy-content
pnpm run convert:legacy-content -- --apply
```

The converter verifies the plaintext hash, writes and reads back authenticated
ciphertext, atomically moves the plaintext source to `backend/legacy-backups/`,
and only then updates content metadata. Backups are outside the upload directory
and excluded from Git. The conversion is retryable if it stops after moving a
source, but an operator must still protect these backups with host ACLs and
retire them under an approved retention policy. The checked-in
`uploads/sample-*` files are known plaintext placeholder fixtures; they remain
in place because no live-database inventory or replacement verification was
available in this environment. They are not exposed by an Express static route,
but should be converted/quarantined before describing the storage directory as
fully protected. `database/sample_data.sql` is retired because it truncated
tables and referenced plaintext placeholders. Use the encrypted, non-truncating
backend seeder (`pnpm run seed`) instead.

To rotate KEKs without re-encrypting each asset, first configure both the old
key and the new key, then set `CONTENT_KEK_VERSION` to the new version. From
`backend/`, preview the operation with `pnpm run rotate:keks`; apply with
`pnpm run rotate:keks -- --apply`. The script re-wraps each DEK, verifies the
new wrapping, and uses a conditional per-row update so interrupted runs can be
repeated. Do not remove old key material until the rotation report and a
decryption verification confirm that no assets still reference it. Keep a
recoverable database backup for the migration window.

The current protected viewer supports UTF-8 `.txt` files and CSV. TXT previews
receive an account-ID, asset-ID, and timestamp attribution. CSV previews are
rendered as escaped HTML tables with the same attribution, so the original CSV
structure is not prefixed or altered. `/view` does not add a watermark to
downloads; `/download` returns the original bytes only after separate DOWNLOAD
authorization. PDF, Office, image, audio, and video VIEW previews are currently
unsupported and fail closed; they require a maintained server-side rendering
pipeline before VIEW-only access can be useful. Browser viewers cannot prevent
screenshots or copying of visible content.

Configurable per-process request limits apply to login/register, wallet
challenge/verification, and protected view/download. Defaults are 10 auth
requests per 15 minutes, 8 wallet requests per 15 minutes, and 60 content
requests per minute per authenticated account/IP. These in-memory limits are
not shared across multiple backend instances. Security events include anonymous
failures, selected authorization failures, encryption errors, and rate-limit
denials; event retention remains an operator-managed policy, not an automated
purge job.

Blockchain operations save a database intent key before submission and persist
the transaction hash immediately when available. Asset registration also
records its hash before waiting. Hashless license operations are surfaced by
reconciliation as unresolved for manual chain inspection; the service does not
infer a success from an ambiguous current license state. This is a safe manual
recovery state, not complete automatic recovery. Local-chain confirmations are
for demonstration only and do not establish production finality.

V3 verification in this workspace: Node syntax checks passed for 48
JavaScript/CommonJS files. The focused dependency-free Node suite passed 16/16.
The full backend suite is blocked by missing `ethers`; frontend build, Hardhat
tests, migrations, local-chain workflows, and database/API integration could
not be executed because dependencies could not be installed in this environment
(pnpm project symlink EPERM in the sandbox; the approved external install hit
registry certificate verification failure). Never disable TLS verification to
work around that. `backend/package-lock.json` still lacks the declared `ethers`
dependency, and the blockchain project still has no lockfile; resolve those
from a trusted registry before claiming reproducible installation.
