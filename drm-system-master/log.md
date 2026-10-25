# DRM System Development Log

A comprehensive log of all architectural, backend, frontend, security, and UI/UX changes implemented.

---

## 1. Authentication & Role-Based Portals

### Unified Sign-In & Dedicated Entry Flows
- **Single "Sign In" Button**: Removed extraneous demo auto-login buttons to ensure secure and standard credential validation.
- **Three Dedicated Login Portals**:
  - **Creator Portal (`/login/creator`)**:
    - Custom theme: Indigo / Violet (`#4f46e5`, `#7c3aed`).
    - Dedicated to digital asset encryption, publishing, licensing, and access management.
  - **Buyer / Consumer Portal (`/login/buyer`)**:
    - Custom theme: Emerald / Teal (`#059669`, `#10b981`).
    - Dedicated to marketplace browsing, license purchasing, encrypted streaming, and file downloads.
  - **Moderator Portal (`/login/moderator`)**:
    - Custom theme: Cyber Amber & Obsidian Gold (`#d97706`, `#f59e0b`, `#fbbf24`).
    - Dedicated to platform-wide compliance auditing, security oversight, and batch integrity checks.
- **Central Portal Gateway (`/login`)**:
  - Implemented `LoginPortalHub.jsx` introducing all three roles with interactive feature cards and direct links to each portal.
- **Self-Serve Registration (`/register`)**:
  - Added role selector tabs (`Creator`, `Buyer`, `Moderator`) and post-registration confirmation cards.
- **Moderator Role Scoping**:
  - Clarified and enforced that moderators audit and verify compliance; restricted unnecessary asset upload buttons from the moderator view.

---

## 2. Dashboard Palettes & Visual Hierarchy

- **Color Palette Alignment**:
  - Synced the dashboard color palettes to match their respective login portal themes (`app-shell-creator`, `app-shell-buyer`, `app-shell-moderator`).
- **Moderator Aesthetic Upgrade**:
  - Replaced previous crimson palette with **Cyber Amber & Obsidian Gold** (`#d97706`, `#f59e0b`, `#fbbf24`), giving moderators an authoritative command-center aesthetic.
- **Ambient Radiant Background Spread**:
  - Rebalanced the multi-stop gradient background glow across dashboards (`85% x 70%` radial falloff with fixed attachment) for smooth ambient lighting behind glassmorphic cards.

---

## 3. User-Specific Access Logs & Compliance Ledger

### Backend Updates (`backend/src/services/activityService.js` & `backend/src/controllers/historyController.js`)
- **Strict Personal Scoping by Default**:
  - Resolved an issue where file owners had other users' views and downloads mixed into their personal access feed.
  - Updated query condition: `WHERE (a.actor_id = ? OR a.target_user_id = ?)` by default.
  - Users (Buyers and Creators) now see strictly actions initiated by them or directed specifically at them.
- **Role-Aware Filtering**:
  - **Buyers (`CONSUMER`)**: Clean personal activity stream (viewing, downloading, license acquisition).
  - **Creators (`CREATOR`)**: Tabbed toggle in `History.jsx`:
    - 👤 **My Access Logs** (`scope: 'user'`): Personal creator activity.
    - 📁 **Access on My Content** (`scope: 'content'`): Traffic and access events from other consumers on the creator's files.
  - **Moderators (`MODERATOR`)**:
    - 🌐 **All System Logs** (`scope: 'all'`): Full platform compliance ledger.
    - 👤 **Filter by Specific User**: Dynamic user dropdown to inspect any specific user's access logs.
- **Dashboard Widget Sync (`Dashboard.jsx`)**:
  - Dashboard recent activity feed scoped to user-specific records (`getHistory({ limit: 6, scope: 'user' })`).

---

## 4. Collapsible Sidebar & Navigation Toggle Refactor

### Unified Toggle Design (`Layout.jsx` & `index.css`)
- **Lucide Vector Icons**:
  - Removed raw SVGs and custom 3-bar hamburger checkboxes in favor of `<PanelLeftClose size={18} />` (open) and `<PanelLeftOpen size={18} />` (collapsed).
- **Geometric Consistency**:
  - Standardized dimensions: **32px × 32px** (`w-8 h-8`), `rounded-lg` (8px border radius), and centered flex alignment.
  - Glassmorphic finish: `rgba(15, 23, 42, 0.75)` with `backdrop-blur-md` and `1px solid rgba(99, 102, 241, 0.25)`.
- **Layout & Anchoring**:
  - **Open State**: Neatly aligned inside the `.sidebar-brand` header alongside the 'DRM Guardian' logo.
  - **Collapsed State**: Clean floating toggle anchored at `top: 1.25rem; left: 1.25rem;` (`top: 20px; left: 20px;`, `z-index: 50`) with smooth fade-in animation.
- **Fluid Layout Animation (Zero Snapping)**:
  - Applied cubic-bezier transition on `.sidebar`: `transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;` with `overflow-x: hidden`.
- **Text Truncation & Overflow Protection**:
  - Added `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` across navigation links, section titles, brand text, and user cards to prevent text wrapping or canvas bleeding during collapse.
- **Main Content Shift**:
  - Added `padding-left: 64px` to `.main-content-expanded` so expanded layout content never overlaps the 32px floating toggle button.

---

## 5. Theme Toggle Component & Sidebar Integration Refactor

### Component Harmonization (`ThemeToggle.jsx` & `index.css`)
- **Compact Icon Button Pattern**:
  - Built a uniform **36px × 36px** icon button matching the login pages.
  - **Light Mode**: Renders `<Moon size={18} />` with `bg-white/80`, `border-slate-200`, and `text-slate-700`.
  - **Dark Mode**: Renders `<Sun size={18} />` with `bg-slate-900/80`, `border-indigo-500/30`, and `text-amber-400`.
  - **Hover Micro-Interaction**: Added smooth `15deg` icon rotation and scale feedback with `0.2s cubic-bezier(0.4, 0, 0.2, 1)`.

### Sidebar Integration Enhancements
- **Full Hit Target Fix**:
  - Replaced the nested icon button with a single full-width clickable `<button>` (`.sidebar-theme-btn`).
  - Users can click anywhere across the entire row to toggle themes (`hover:bg-slate-800/60` in dark mode, `hover:bg-slate-100` in light mode).
- **Clean Visual Hierarchy**:
  - Removed inner borders, backgrounds, and drop shadows around the icon to eliminate the "nested button" appearance.
  - The icon sits cleanly on the right side of the row (`.sidebar-theme-icon-wrap`).
- **Dynamic Active State Text**:
  - **Dark Mode Active**: Displays `'Dark Mode'` on the left paired with a `<Moon size={18} />` icon on the right.
  - **Light Mode Active**: Displays `'Light Mode'` on the left paired with a `<Sun size={18} />` icon on the right.
- **Collapsed Sidebar Adaptability**:
  - When the sidebar is collapsed or hidden, the text label is automatically hidden and the button centers into a compact 36px icon button.

---



## 6. Database Normalization to Third Normal Form (3NF) - September 28, 2026

### Objectives & Mathematical Criteria
- **1NF (First Normal Form)**: Ensured all attribute domains are atomic (indivisible) and eliminated repeating groups and arrays across all relations.
- **2NF (Second Normal Form)**: Verified that **no partial functional dependencies** exist. Every non-prime attribute depends on the *entire* candidate key. Relations with simple primary keys (`users`, `content`, `activity_log`) satisfy 2NF automatically; composite key in `rights` ($\{content\_id, user\_id, right\_type\}$) was verified to have all non-prime attributes functionally dependent on the full triad.
- **3NF (Third Normal Form)**: Eliminated all **transitive functional dependencies** ($X \to Y \to Z$ where non-key determines non-key). Ensured that for every non-trivial functional dependency $X \to Y$, either:
  1. $X$ is a superkey of the relation, or
  2. $Y$ is a prime attribute.

---

### Lookup & Master Entities Factored
To eliminate data and domain anomalies from hardcoded ENUMs and unconstrained string fields, standalone master entities were created with explicit `ON UPDATE CASCADE` referential integrity:
1. **`roles`**:
   - Primary Key: `role_name` (`VARCHAR(20)`)
   - Pre-populated: `'CREATOR'`, `'CONSUMER'`, `'MODERATOR'`.
   - Referenced by: `users.role`.
2. **`right_types`**:
   - Primary Key: `right_type` (`VARCHAR(20)`)
   - Pre-populated: `'VIEW'`, `'DOWNLOAD'`, `'SHARE'`.
   - Referenced by: `rights.right_type`.
3. **`right_statuses`**:
   - Primary Key: `status` (`VARCHAR(20)`)
   - Pre-populated: `'ACTIVE'`, `'REVOKED'`.
   - Referenced by: `rights.status`.
4. **`activity_actions`**:
   - Primary Key: `action_code` (`VARCHAR(50)`)
   - Pre-populated: `'LOGIN'`, `'LOGOUT'`, `'REGISTER'`, `'CONTENT_UPLOADED'`, `'CONTENT_VIEWED'`, `'CONTENT_DOWNLOADED'`, `'RIGHT_ACQUIRED'`, `'RIGHT_GRANTED'`, `'RIGHT_REVOKED'`, `'INTEGRITY_VERIFIED'`, `'INTEGRITY_TAMPERED'`.
   - Referenced by: `activity_log.action`.

---

### 3NF Schema & Key Mapping

| Table | Primary Key | Candidate Keys | Foreign Keys | 3NF Validation |
| :--- | :--- | :--- | :--- | :--- |
| **`roles`** | `role_name` | `{role_name}` | *None* | Determinant is a superkey. |
| **`users`** | `user_id` | `{user_id}`, `{email}` | `role` $\to$ `roles(role_name)` | All non-prime attributes depend only on superkeys. |
| **`content`** | `content_id` | `{content_id}`, `{stored_filename}` | `owner_id` $\to$ `users(user_id)` | All determinants are candidate keys. |
| **`right_types`** | `right_type` | `{right_type}` | *None* | Master lookup; determinant is superkey. |
| **`right_statuses`** | `status` | `{status}` | *None* | Master lookup; determinant is superkey. |
| **`rights`** | `right_id` | `{right_id}`, `{content_id, user_id, right_type}` | `content_id`, `user_id`, `granted_by`, `revoked_by`, `right_type`, `status` | Full dependency on compound key; no transitive paths. |
| **`activity_actions`** | `action_code` | `{action_code}` | *None* | Master lookup; determinant is superkey. |
| **`activity_log`** | `activity_id` | `{activity_id}` | `content_id`, `actor_id`, `target_user_id`, `action` | Single candidate key; determinant is superkey. |

---

### Decomposition Theorems & Proofs
- **Lossless-Join Decomposition**: Every decomposed relation $R$ into $(R_1, R_2)$ satisfies $R_1 \cap R_2 \to R_1$ or $R_1 \cap R_2 \to R_2$, ensuring no spurious tuples can be produced during joins.
- **Dependency Preservation**: Verified that $(\bigcup \pi_{R_i}(F))^+ = F^+$. Every functional dependency is locally testable within its single relation without evaluating cross-table joins.

---

### Artifacts & Implementation Files
- **Academic 3NF Document**: Created [`database/NORMALIZATION_3NF.md`](database/NORMALIZATION_3NF.md) containing formal mathematical proofs, minimal cover analysis, and step-by-step 0NF $\to$ 1NF $\to$ 2NF $\to$ 3NF derivations.
- **DDL Schema**: Updated [`database/schema.sql`](database/schema.sql) with full 3NF tables, foreign key constraints, indexes, views, triggers, and stored procedures.
- **Sample Data**: Updated [`database/sample_data.sql`](database/sample_data.sql) and [`backend/scripts/seed.js`](backend/scripts/seed.js).
- **Execution Script**: Created [`backend/scripts/apply_schema.js`](backend/scripts/apply_schema.js) and executed it on MySQL database `drm_system`.
- **Live Verification**: Successfully verified all 8 base tables and 2 views active in MySQL with 100% backend API query compatibility.
