# DRM Feature Tracker

Historical statuses preserve the initial source audit. Current statuses distinguish source implementation from executed tests; no feature is marked tested until the corresponding test has actually passed.

## A. Content encryption and key management

| Feature ID | Feature | Original audit status | Current implementation status | Version introduced | Files affected | Verification evidence | Deferred version / reason |
|---|---|---|---|---|---|---|---|
| A1 | Uploaded/stored content encryption | Not implemented | Deferred | V2 | `backend/src/middleware/upload.js`, `backend/src/controllers/contentController.js` | V1 deliberately retains plaintext files; no encryption tests. | V2: full content encryption is explicitly deferred. |
| A2 | Authenticated encryption algorithm | Not implemented | Deferred | V2 | Proposed `backend/src/services/encryptionService.js` | No encryption implementation. | V2: select and test AEAD with key management. |
| A3 | Secure separate encryption keys | Not implemented | Deferred | V2 | Proposed key-provider adapter | No content-key generation. | V2: depends on encryption design. |
| A4 | Key storage and protection | Not implemented | Deferred | V2 | Proposed backend key-provider adapter | No key store exists. | V2: production KMS not part of V1. |
| A5 | Key exposure in frontend/source/logs/content | Not verified | Not applicable | V1 | `blockchain/contracts/DRMRegistry.sol`, `backend/src/services/blockchainService.js` | Contract stores hashes/addresses/IDs only; no decryption keys introduced. Source inspection only. | Reassess when key management is added. |
| A6 | Decryption restricted to valid users/licenses | Not implemented | Deferred | V2 | `backend/src/controllers/contentController.js` | V1 gates plaintext delivery, but has no decryption/key release. | V2: no content key exists in V1. |
| A7 | Plaintext temporary files/browser/cache/memory exposure | Partially implemented | Partially implemented | V1 | `backend/src/middleware/upload.js`, `frontend/src/pages/ContentDetails.jsx` | Files remain plaintext at rest and delivered to browser; view now uses an authenticated blob request. Source inspection only. | V2: minimize plaintext exposure. |

## B. Authentication and authorization

| Feature ID | Feature | Original audit status | Current implementation status | Version introduced | Files affected | Verification evidence | Deferred version / reason |
|---|---|---|---|---|---|---|---|
| B1 | User authentication | Implemented and verified | Partially implemented | V0 | `backend/src/controllers/authController.js`, `backend/src/middleware/auth.js` | Existing bcrypt/JWT flow preserved; test execution pending. | None. |
| B2 | Trusted ownership/license checks | Partially implemented | Partially implemented | V0/V1 | `backend/src/controllers/contentController.js`, `backend/src/controllers/rightsController.js`, `backend/src/services/blockchainService.js` | Existing DB checks remain; chain check is added for registered assets. End-to-end behavior not yet tested. | None. |
| B3 | IDOR protection for another user's files | Partially implemented | Partially implemented | V0/V1 | `backend/src/controllers/contentController.js`, `backend/src/controllers/blockchainController.js` | Content paths check DB rights; registration/status are owner-only; regression tests pending. | None. |
| B4 | Authorization on API and file requests | Partially implemented | Partially implemented | V1 | `backend/src/middleware/auth.js`, `backend/src/routes/contentRoutes.js`, `frontend/src/services/api.js`, `frontend/src/pages/ContentDetails.jsx` | Moderator content APIs now use role middleware; content routes require JWT; query-string JWT removed. No runtime tests yet. | None. |
| B5 | Passwords, tokens, sessions, credentials | Partially implemented | Partially implemented | V0/V1 | `backend/src/controllers/authController.js`, `backend/src/middleware/auth.js`, `frontend/src/services/api.js`, `backend/src/controllers/walletController.js` | bcrypt/JWT preserved; URL token fallback removed; wallet challenges use one-time nonce and signature verification. Tests pending. | V2: broader session hardening and token storage. |
| B6 | Logging and rate limits for access attempts | Partially implemented | Partially implemented | V0 | `backend/src/services/activityService.js`, `backend/src/controllers/contentController.js` | Existing successful activity logging remains; no rate limiter or failed-attempt detection added. | V2: abuse detection and throttling. |

## C. License management

| Feature ID | Feature | Original audit status | Current implementation status | Version introduced | Files affected | Verification evidence | Deferred version / reason |
|---|---|---|---|---|---|---|---|
| C1 | Issue licenses to users | Implemented and verified | Partially implemented | V0/V1 | `backend/src/controllers/rightsController.js`, `backend/src/controllers/contentController.js`, `backend/src/services/blockchainService.js` | DB grants retained; registered assets submit confirmed contract grants before DB changes. Tests pending. | None. |
| C2 | Correct content/owner/user association | Implemented and verified | Partially implemented | V0/V1 | `backend/src/controllers/blockchainController.js`, `backend/src/controllers/walletController.js` | Verified wallets required for on-chain owners and recipients. No live chain test yet. | None. |
| C3 | Enforce permissions and restrictions | Partially implemented | Partially implemented | V0/V1 | `backend/src/services/rightsService.js`, `backend/src/controllers/contentController.js`, `backend/src/services/blockchainService.js` | Registered assets require active DB rights plus matching valid chain right. Tests pending. | None. |
| C4 | License expiry and validity period | Not implemented | Partially implemented | V1 | `blockchain/contracts/DRMRegistry.sol`, `backend/src/controllers/rightsController.js`, `frontend/src/pages/ContentDetails.jsx`, `database/migrations/001_blockchain.sql` | Contract checks expiry and UI supports expiration; chain tests not yet executed. Legacy rights remain non-expiring. | V1 legacy limitation; expiry applies to blockchain-enabled assets. |
| C5 | License revocation | Implemented and verified | Partially implemented | V0/V1 | `backend/src/controllers/rightsController.js`, `backend/src/services/blockchainService.js`, `blockchain/contracts/DRMRegistry.sol` | Registered-asset revocation confirms chain transaction before DB revocation; tests pending. | None. |
| C6 | Permission changes affect subsequent access | Implemented and verified | Partially implemented | V0/V1 | `backend/src/controllers/contentController.js`, `backend/src/services/blockchainService.js` | Request-time DB and chain checks are implemented. No integration test yet. | None. |
| C7 | Prevent license/token reuse beyond intended scope | Partially implemented | Partially implemented | V0/V1 | `backend/src/middleware/auth.js`, `backend/src/controllers/walletController.js`, `blockchain/contracts/DRMRegistry.sol` | Wallet challenge nonce is consumed; licenses scoped to asset, wallet, and right. JWT remains a bearer token until expiry. Tests pending. | V2: broader session/device binding is deferred. |
| C8 | Offline access and revocation limits | Partially implemented | Partially implemented | V0 | `backend/src/controllers/contentController.js`, `frontend/src/pages/ContentDetails.jsx` | Download still returns plaintext file; server cannot revoke a copy already obtained. | V2: offline licensing is deferred. |
| C9 | Signed/tamper-protected license records | Not implemented | Partially implemented | V1 | `blockchain/contracts/DRMRegistry.sol`, `backend/src/services/blockchainService.js` | On-chain records/events added; no contract test has yet been executed. Legacy DB-only licenses remain ordinary rows. | None for registered assets; legacy migration is explicit. |

## D. Blockchain integration

| Feature ID | Feature | Original audit status | Current implementation status | Version introduced | Files affected | Verification evidence | Deferred version / reason |
|---|---|---|---|---|---|---|---|
| D1 | Connected blockchain network | Not implemented | Implemented, not yet tested | V1 | `blockchain/hardhat.config.cjs`, `backend/src/services/blockchainService.js`, `backend/.env.example` | Local Hardhat chain configuration and configurable RPC client added. Runtime tests pending. |
| D2 | Smart contracts and deployment | Not implemented | Implemented, not yet tested | V1 | `blockchain/contracts/DRMRegistry.sol`, `blockchain/scripts/deploy.cjs` | Asset/license registry and local deploy script added. Compilation/deployment pending. |
| D3 | Asset identifier and integrity hash registration | Not implemented | Implemented, not yet tested | V1 | `backend/src/controllers/blockchainController.js`, `backend/src/services/blockchainService.js`, `blockchain/contracts/DRMRegistry.sol` | Content ID and exact SHA-256 bytes32 registered; runtime evidence pending. |
| D4 | On-chain asset ownership | Not implemented | Implemented, not yet tested | V1 | `backend/src/controllers/walletController.js`, `backend/src/controllers/blockchainController.js`, `blockchain/contracts/DRMRegistry.sol` | Owner address must be linked by signature and is compared during access checks; tests pending. |
| D5 | On-chain grants, expiry, revocation, transfers | Not implemented | Partially implemented | V1 | `backend/src/controllers/rightsController.js`, `backend/src/services/blockchainService.js`, `blockchain/contracts/DRMRegistry.sol` | Grants, expiry, and revocation are implemented; ownership transfer is not in V1. Tests pending. |
| D6 | Backend verification of chain state | Not implemented | Implemented, not yet tested | V1 | `backend/src/services/blockchainService.js`, `backend/src/controllers/contentController.js` | Request-time asset and license reads added; no live-chain test yet. |
| D7 | Chain state enforces actual access | Not implemented | Implemented, not yet tested | V1 | `backend/src/controllers/contentController.js`, `backend/src/services/blockchainService.js` | Registered asset view/download require DB permission and valid chain state; RPC errors fail closed. Tests pending. |
| D8 | Wallet connection and signing | Not implemented | Implemented, not yet tested | V1 | `frontend/src/components/WalletLink.jsx`, `backend/src/controllers/walletController.js` | Frontend requests account and signs backend challenge; runtime test pending. |
| D9 | Chain IDs, addresses, ABI, network config | Not implemented | Implemented, not yet tested | V1 | `backend/.env.example`, `backend/src/services/blockchainService.js`, `blockchain/hardhat.config.cjs` | Settings are environment-configurable; ABI loads from compile artifact. Tests pending. |
| D10 | Avoid sensitive on-chain data | Implemented and verified | Implemented, not yet tested | V1 | `blockchain/contracts/DRMRegistry.sol` | Contract stores only numeric content ID, SHA-256, wallet, and license state; source inspection only. |
| D11 | RPC/transaction/confirmation failure handling | Not implemented | Partially implemented | V1 | `backend/src/services/blockchainService.js`, `backend/src/controllers/blockchainController.js`, `backend/src/controllers/rightsController.js`, `database/migrations/001_blockchain.sql` | One-confirmation wait, pending/confirmed/failed asset and license-operation states, DB-sync status, retry path, and fail-closed access added. Failure/recovery integration tests pending. |

## E. Secure content delivery and playback

| Feature ID | Feature | Original audit status | Current implementation status | Version introduced | Files affected | Verification evidence | Deferred version / reason |
|---|---|---|---|---|---|---|---|
| E1 | HTTPS or secure transport | Not verified | Not verified | — | Deployment configuration not present | Local setup uses HTTP; production transport cannot be checked here. | Deployment-specific. |
| E2 | Private storage | Partially implemented | Partially implemented | V0 | `backend/src/middleware/upload.js`, `backend/src/controllers/contentController.js` | No static file route; handler authorization remains. Plaintext filesystem exposure remains. | V2: hardened storage architecture. |
| E3 | Time-limited links/tokens | Partially implemented | Partially implemented | V1 | `backend/src/middleware/auth.js`, `frontend/src/services/api.js`, `frontend/src/pages/ContentDetails.jsx` | Query-token view removed; JWT still expires, no single-use delivery token added. Tests pending. | V2: short-lived scoped delivery token. |
| E4 | Separate authorized key release | Not implemented | Deferred | V2 | Proposed key-release service | No content encryption/key service in V1. | V2 by explicit scope. |
| E5 | Viewer plaintext/key/reusable credentials exposure | Partially implemented | Partially implemented | V1 | `frontend/src/services/api.js`, `frontend/src/pages/ContentDetails.jsx` | Viewer obtains plaintext blob using bearer header rather than URL token; client still receives plaintext. | V2: plaintext exposure reduction. |
| E6 | Temporary/persistent plaintext copies | Partially implemented | Partially implemented | V0 | `backend/src/middleware/upload.js`, `backend/src/controllers/contentController.js` | Original file stored and downloads remain plaintext. | V2: encryption/key release. |
| E7 | Protected viewing/screen capture | Not implemented | Deferred | V2 | Current browser viewer | No capture restrictions; browser cannot guarantee prevention. | V2: content/platform-specific viewer. |
| E8 | TEE/hardware-backed/platform DRM | Not implemented | Deferred | V2+ | None | No such component in V1. | V2+: requires target platform and content decision. |
| E9 | Realistic platform-specific protection path | Partially implemented | Partially implemented | V1 | `frontend/src/pages/ContentDetails.jsx` | Existing browser app remains workable for access checks but not copy prevention. | V2: choose protected viewer based on media type. |

## F. Anti-tampering, redistribution, and monitoring

| Feature ID | Feature | Original audit status | Current implementation status | Version introduced | Files affected | Verification evidence | Deferred version / reason |
|---|---|---|---|---|---|---|---|
| F1 | Signed licenses/integrity checks | Not implemented | Partially implemented | V1 | `blockchain/contracts/DRMRegistry.sol`, `backend/src/services/blockchainService.js` | On-chain state plus asset hash comparisons; no executed tests. Legacy licenses remain DB rows. |
| F2 | Device/application integrity | Not implemented | Deferred | V2+ | None | Not included in V1. | Requires separate platform trust model. |
| F3 | Suspicious pattern detection | Not implemented | Deferred | V2 | `backend/src/services/activityService.js` | Existing event logs only; no detector added. | Advanced monitoring explicitly deferred. |
| F4 | Visible/forensic watermarking | Not implemented | Deferred | V2+ | None | No watermarking implementation. | Requires content-specific rendering pipeline. |
| F5 | Attribute leaked copy | Not implemented | Deferred | V2+ | None | No per-copy watermark/identifier. | Depends on watermarking and viewer decisions. |
| F6 | Key rotation/recovery | Not implemented | Deferred | V2 | None | No content keys exist in V1. | Depends on future key management. |
| F7 | Security event logging without secrets | Partially implemented | Partially implemented | V0/V1 | `backend/src/services/activityService.js`, `backend/src/controllers/blockchainController.js` | Existing rights/access logs retained; transaction hashes tracked in tables. No secret logging was added by design; tests pending. | V2: failure-event auditing and retention policy. |

## G. Reliability and testing

| Feature ID | Feature | Original audit status | Current implementation status | Version introduced | Files affected | Verification evidence | Deferred version / reason |
|---|---|---|---|---|---|---|---|
| G1 | Automated tests | Not implemented | Implemented, not yet tested | V1 | `backend/test/walletController.test.js`, `backend/package.json`, `blockchain/test/DRMRegistry.test.js` | Backend cases cover signed wallet association, nonce replay, duplicate wallet, query-token rejection, role middleware, and missing-chain-config fail-closed; contract cases cover core policy. Node syntax check passed; execution blocked by missing dependencies. |
| G2 | Smart-contract tests | Not implemented | Implemented, not yet tested | V1 | `blockchain/test/DRMRegistry.test.js` | Test cases cover authorization, invalid/duplicate assets, right validation, expiry, revoke, and valid access; execution unavailable because Hardhat is not installed. |
| G3 | Encryption/decryption tests | Not implemented | Deferred | V2 | None | V1 has no encryption implementation. |
| G4 | Authorization failure tests | Not implemented | Implemented, not yet tested | V1 | `backend/test/walletController.test.js`, `blockchain/test/DRMRegistry.test.js` | Tests cover contract unauthorized calls, role middleware, and query-string token rejection; execution blocked by missing dependencies. |
| G5 | Expiry/revocation tests | Not implemented | Implemented, not yet tested | V1 | `blockchain/test/DRMRegistry.test.js` | Contract test cases added; execution blocked by missing Hardhat dependencies. |
| G6 | Invalid tokens/modified identifiers tests | Not implemented | Partially implemented | V1 | `backend/test/walletController.test.js`, `blockchain/test/DRMRegistry.test.js` | Query-token and contract asset/hash checks are covered by source/test cases; API IDOR and invalid JWT integration tests remain absent. |
| G7 | Frontend/backend/chain/storage integration tests | Not implemented | Not implemented | — | No integration harness yet | No multi-service test suite added; requires local MySQL, RPC, and browser runner. | V1 follow-up needed before claiming complete integration. |
| G8 | Safe error and transaction failure handling | Partially implemented | Partially implemented | V1 | `backend/src/services/blockchainService.js`, `backend/src/controllers/blockchainController.js`, `backend/src/controllers/rightsController.js` | Confirmation errors surface as failure and access fails closed; failure recovery tests pending. |
| G9 | Repeatable setup documentation | Partially implemented | Implemented, not yet tested | V1 | `README.md`, `backend/.env.example`, `blockchain/package.json` | Local setup, deploy, migration, and demo commands documented; install could not complete because pnpm store symlink was sandbox-blocked and registry TLS verification failed. |

## Version history

| Version | Main features implemented | Improved, incomplete features | Deliberately deferred | Tests and outcomes | Known limitations/dependencies |
|---|---|---|---|---|---|
| V1 (in progress) | EVM contract, local deployment/test configuration, signed wallet association, asset registration and active-right migration, chain-backed grant/revoke/expiry, access checks, frontend controls, role guards, additive SQL migration. | Authenticated view no longer uses a query-string JWT; backend moderator registration closed. | Full encryption/key management, hardened delivery, protected playback, watermarking, advanced monitoring, offline licenses, production deployment. | Node syntax check passed for 27 JS/CJS files. Backend unit and Hardhat tests could not execute: dependencies are not installed (`ethers`/`hardhat` missing). Build and database/RPC/browser tests were not run. | Requires applying `database/migrations/001_blockchain.sql`, installing dependencies, local Hardhat RPC, deployed contract and server-side issuer key. End-to-end DB/RPC/browser tests remain incomplete. |

## Supplementary findings

- Backend and contract dependencies are not installed in the current workspace. The host has Node.js and a bundled `pnpm`, but not `npm`; test execution and package-lock regeneration must be attempted with the available package manager.
- The first dependency install hit a sandbox EPERM creating pnpm's project-store symlink; an elevated retry reached the npm registry but failed TLS certificate verification. Certificate verification was not bypassed. `backend/package-lock.json` therefore still needs regeneration after dependencies can be installed.
- The repository has no Git metadata at the configured project root, so a Git diff/status cannot be used to confirm the changed-file list.
- Blockchain records are a centralized issuer model: application authorization decides when the backend submits transactions. This is not owner-signed decentralized transaction authorization.
- A transaction may confirm on-chain before a later MySQL write fails. Registration is retryable and checks for an already-registered matching asset; license grant/revoke reconciliation needs integration testing and operational monitoring.
