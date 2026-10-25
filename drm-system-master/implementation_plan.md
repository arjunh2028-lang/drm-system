# Custom Multi-Role DRM System & Frontend UI Modernization Plan

This plan introduces **three dedicated login pages** for **Creators**, **Buyers / Consumers**, and **Moderators**, with **self-serve account creation/registration** for each role (no demo logins or hardcoded accounts), plus a modern, elevated UI with SVG iconography, responsive layouts, and role-tailored capabilities.

---

## 1. Role Architecture & Three Distinct Login / Register Flows

### 🎨 1. Creator Portal (`/login/creator` & `/register/creator`)
- **Target Persona**: Content owners, artists, researchers, and developers who upload and protect files.
- **Login View**: Professional creator-focused login (accented with Violet/Indigo), features list (Secure Encryption, Granular Rights, Integrity Auditing).
- **Register Link**: Direct link to register as a **Creator**.
- **Capabilities**:
  - Drag-and-drop secure file upload with SHA-256 calculation.
  - Rights management matrix (grant VIEW, DOWNLOAD, SHARE to specific buyers/users).
  - Cryptographic integrity inspection on demand.
  - Activity audit log of who accessed their files.

### 🛒 2. Buyer / User Portal (`/login/buyer` & `/register/buyer`)
- **Target Persona**: Clients and end-users who discover, purchase, and consume DRM-protected files.
- **Login View**: Consumer-friendly login (accented with Emerald/Teal), highlights (Browse Catalog, Purchase Rights, Instant Decrypted View & Download).
- **Register Link**: Direct link to register as a **Buyer / User**.
- **Capabilities**:
  - **Marketplace / Content Catalog**: Explore all DRM-protected content published on the platform and purchase/acquire a license.
  - **My Purchased Library**: Fast access to all licensed files with direct in-browser viewing or secure download.
  - Access rights history.

### 🛡️ 3. Moderator Portal (`/login/moderator` & `/register/moderator`)
- **Target Persona**: System administrators and compliance supervisors.
- **Login View**: High-security portal login (accented with Rose/Crimson), highlights (Global Rights Ledger, Content Compliance, Batch Cryptographic Verification).
- **Register Link**: Direct link to register as a **Moderator** (with optional security key / admin passcode or direct signup).
- **Capabilities**:
  - System-wide content registry (inspect all files across all creators).
  - Global activity ledger and security audit trail.
  - One-click batch cryptographic integrity scanner across all stored files.
  - Ability to revoke or flag any rights or content.

### 🌐 Main Gateway (`/login`)
- Clean, modern Role Selection Hub allowing users to choose their portal (Creator, Buyer, or Moderator) with one click, or jump directly to their respective login/registration page.

> [!IMPORTANT]
> **No demo logins or pre-filled credentials**: All login and register forms are completely clean for real user credential entry.

---

## 2. UI/UX Modernization & Design System

1. **Design System & Typography**:
   - **Inter** & **JetBrains Mono** loaded via Google Fonts.
   - Comprehensive modern CSS custom properties in `index.css` (slate dark sidebar, crisp elevated light workspace, refined borders `#e2e8f0`, soft shadows, glassmorphism, micro-interactions).
   - Responsive drawer sidebar for mobile & tablet.

2. **SVG Iconography (`lucide-react`)**:
   - Install `lucide-react` for crisp SVG icons replacing all emojis.

3. **Enhanced Pages**:
   - **Dashboard**: Role-adaptive metrics and widgets (Creator sees storage/rights granted; Buyer sees licensed files/store link; Moderator sees global system health & total assets).
   - **Catalog / Store Page (`Marketplace.jsx`)**: Card grid of available content with file type badges, sizes, creator info, and 1-click "Purchase / Request License" modal.
   - **My Content & Accessible Content**: Instant live search, copy-to-clipboard SHA-256 hash chips, and status filters.
   - **Content Details**: Visual SHA-256 integrity status hero banner, one-click hash copy, and rights management matrix.
   - **Upload**: Drag-and-drop file target zone with file preview and cryptographic info box.

---

## 3. Database & Backend Enhancements

1. **Database Schema (`users` table)**:
   - Add `role` column: `ENUM('CREATOR', 'CONSUMER', 'MODERATOR') NOT NULL DEFAULT 'CONSUMER'`.
   - Update existing rows to default roles if needed, or leave clean for new registrations.
2. **Backend API Endpoints**:
   - Update `authController.js` `register` to accept and validate `role` (`CREATOR`, `CONSUMER`, `MODERATOR`).
   - Update `authController.js` `login` to return `role` and include `role` in JWT token.
   - Optional: Validate on login if user is logging into the matching portal or return role in response so the frontend routes them to the right dashboard.
   - Add `GET /api/content/catalog` for buyers to explore available content.
   - Add `POST /api/content/:id/purchase` for buyers to acquire license/rights.
   - Add `GET /api/content/all` for moderators to view system-wide content.
   - Add `GET /api/content/verify-all` for moderators to verify platform integrity in batch.

---

## User Review Required

> [!NOTE]
> All demo credentials and hints are removed. Each portal (`/login/creator`, `/login/buyer`, `/login/moderator`) links to its matching registration form (`/register?role=...`) so you can create and manage your own accounts freely.

---

## Proposed Changes

### Database
#### [MODIFY] `database/schema.sql` and live MySQL table `users`
- Add `role ENUM('CREATOR', 'CONSUMER', 'MODERATOR')` column.

---

### Backend
#### [MODIFY] [authController.js](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/backend/src/controllers/authController.js)
- Accept `role` on registration and persist it. Return `role` on login and include in JWT token.

#### [MODIFY] [contentController.js](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/backend/src/controllers/contentController.js)
- Add `listCatalogContent`, `purchaseRight`, and `listAllContentModerator`.

#### [MODIFY] [contentRoutes.js](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/backend/src/routes/contentRoutes.js)
- Register catalog, purchase, and moderator endpoints.

---

### Frontend
#### [MODIFY] [package.json](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/frontend/package.json)
- Add `lucide-react`.

#### [MODIFY] [index.html](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/frontend/index.html)
- Load Google Fonts (`Inter`, `JetBrains Mono`).

#### [MODIFY] [index.css](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/frontend/src/index.css)
- Implement comprehensive modern design system with role-specific color accents (Creator Indigo, Buyer Emerald, Moderator Rose), card styles, badges, and responsive navigation.

#### [NEW] [LoginPortalHub.jsx](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/frontend/src/pages/LoginPortalHub.jsx)
- Gateway at `/login` showcasing the 3 portals.

#### [NEW] [CreatorLogin.jsx](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/frontend/src/pages/CreatorLogin.jsx)
- Dedicated login form for Creators at `/login/creator`.

#### [NEW] [BuyerLogin.jsx](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/frontend/src/pages/BuyerLogin.jsx)
- Dedicated login form for Buyers at `/login/buyer`.

#### [NEW] [ModeratorLogin.jsx](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/frontend/src/pages/ModeratorLogin.jsx)
- Dedicated login form for Moderators at `/login/moderator`.

#### [MODIFY] [Register.jsx](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/frontend/src/pages/Register.jsx)
- Register page supporting role selection (`Creator`, `Buyer`, or `Moderator`), linking seamlessly from each login page.

#### [NEW] [Marketplace.jsx](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/frontend/src/pages/Marketplace.jsx)
- Buyer marketplace to browse all DRM content and purchase/acquire licenses.

#### [NEW] [ModeratorOverview.jsx](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/frontend/src/pages/ModeratorOverview.jsx)
- Moderator portal with system-wide file registry, global integrity scanner, and platform audit.

#### [MODIFY] [Layout.jsx](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/frontend/src/components/Layout.jsx)
- Role-aware navigation (Creators see upload/my files, Buyers see marketplace/purchased files, Moderators see global oversight), role badge in user profile, Lucide icons.

#### [MODIFY] [App.jsx](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/frontend/src/App.jsx)
- Route setup for all portals and views.

#### [MODIFY] [Dashboard.jsx](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/frontend/src/pages/Dashboard.jsx)
- Role-adapted dashboard metrics, quick actions, and activity feed.

#### [MODIFY] [ContentDetails.jsx](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/frontend/src/pages/ContentDetails.jsx)
- Redesigned cryptographic integrity hero, one-click hash copy, and rights matrix.

#### [MODIFY] [Upload.jsx](file:///c:/Users/arjun/OneDrive/Desktop/sem3/DBMS/drm-system/frontend/src/pages/Upload.jsx)
- Drag-and-drop zone with animated upload progress.

---

## Verification Plan

### Automated / Build Verification
- Run MySQL migration to add `role` column.
- Run `npm run build` in `frontend/` to ensure clean build.

### Manual Verification
- Register a new **Creator** account via `/register?role=creator` and log in via `/login/creator`.
- Register a new **Buyer** account via `/register?role=buyer` and log in via `/login/buyer`.
- Register a new **Moderator** account via `/register?role=moderator` and log in via `/login/moderator`.
- Test Creator uploading a file.
- Test Buyer discovering the file in the Marketplace and purchasing a license.
- Test Moderator inspecting global assets, verifying integrity, and checking audit logs.
