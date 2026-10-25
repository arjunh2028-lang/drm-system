# Relational Database Normalization to Third Normal Form (3NF)
**Project**: Digital Rights Management (DRM) System  
**Subject**: Database Management Systems (DBMS)  
**Target Normal Form**: 3NF (Third Normal Form) with BCNF characteristics for key relations  

---

## 1. Overview and Normalization Objectives

Database Normalization is the systematic process of organizing fields and tables of a relational database to minimize data redundancy and prevent insertion, update, and deletion anomalies.

This document presents the complete formal normalization analysis of the **DRM System Database** from an unnormalized state (0NF) through **First Normal Form (1NF)**, **Second Normal Form (2NF)**, and **Third Normal Form (3NF)**.

### Primary Design Goals:
1. **Zero Redundancy**: Eliminate duplicate storage of user roles, license types, right states, and audit categories.
2. **Anomalies Prevention**:
   - **Insertion Anomaly**: Cannot record a user or right without defining legitimate domain roles/actions.
   - **Update Anomaly**: Changing a role's metadata or permissions propagates across all foreign keys without inconsistent row updates.
   - **Deletion Anomaly**: Deleting an activity record does not delete user or content master records.
3. **Lossless-Join Decomposition**: Every decomposed relation $R$ satisfies $R_1 \bowtie R_2 = R$.
4. **Dependency Preservation**: All functional dependencies in $F$ are testable in individual decomposed relations without computing Cartesian joins.

---

## 2. Unnormalized Representation (0NF)

In an unnormalized file or flat-table system, all DRM operations might be stored in a single monolithic table:

```text
DRM_FLAT_RECORD (
    user_id, user_name, user_email, password_hash, user_role, role_description,
    content_id, content_title, original_filename, stored_filename, file_path, file_hash, file_size, upload_time,
    right_id, right_type, right_description, granted_by_user_id, granted_time, right_status, revoked_by_user_id, revoked_time,
    activity_id, action_code, action_category, action_details, activity_time
)
```

### Flaws in 0NF:
- **Multi-Valued Attributes**: A single user may own multiple content files, possess multiple rights, and trigger numerous activities.
- **Repeating Groups**: Repeating content and rights columns for every user transaction.
- **Severe Redundancy**: Creator's name, email, and password hash are duplicated for every file uploaded and every right granted.
- **Lack of Distinct Primary Keys**: No single atomic identifier can identify a record.

---

## 3. First Normal Form (1NF)

### Definition:
A relation $R$ is in **First Normal Form (1NF)** if and only if:
1. All attributes contain **atomic (indivisible)** values.
2. There are no repeating groups, nested relations, or array-valued attributes.
3. A unique **Primary Key** is designated for every relation.

### Decomposition into 1NF Entities:
We eliminate repeating groups by identifying independent conceptual entities and establishing atomic attributes:

1. `USERS (user_id [PK], name, email, password_hash, role, created_at)`
2. `CONTENT (content_id [PK], title, original_filename, stored_filename, file_path, file_hash, file_size, owner_id [FK], upload_timestamp)`
3. `RIGHTS (right_id [PK], content_id [FK], user_id [FK], right_type, granted_by [FK], granted_timestamp, status, revoked_by [FK], revoked_timestamp)`
4. `ACTIVITY_LOG (activity_id [PK], content_id [FK], actor_id [FK], target_user_id [FK], action, details, created_at)`

All attributes are scalar (e.g., `name` is a single string, `file_hash` is a 64-char string, timestamps are scalar DATETIME values). Each table has a defined primary key. **1NF is satisfied.**

---

## 4. Second Normal Form (2NF)

### Definition:
A relation $R$ is in **Second Normal Form (2NF)** if and only if:
1. $R$ is in **1NF**.
2. **No Partial Functional Dependencies** exist: every non-prime attribute must depend on the **entire** candidate key, not on any proper subset of a composite candidate key.

> **Theorem**: If a relation in 1NF has only **single-attribute candidate keys**, it is **automatically in 2NF**.

### Analysis of Candidate Keys & Functional Dependencies:

#### 1. `USERS`
- **Candidate Keys**: $CK_1 = \{user\_id\}$, $CK_2 = \{email\}$
- **Non-Prime Attributes**: $\{name, password\_hash, role, created\_at\}$
- Since all candidate keys contain exactly one attribute, no proper subset can exist.
- **Result**: $\text{USERS} \in \text{2NF}$.

#### 2. `CONTENT`
- **Candidate Keys**: $CK_1 = \{content\_id\}$, $CK_2 = \{stored\_filename\}$
- **Non-Prime Attributes**: $\{title, original\_filename, file\_path, file\_hash, file\_size, owner\_id, upload\_timestamp\}$
- All candidate keys are simple (single-attribute). No partial dependencies can exist.
- **Result**: $\text{CONTENT} \in \text{2NF}$.

#### 3. `RIGHTS`
- **Candidate Keys**:
  - $CK_1 = \{right\_id\}$
  - $CK_2 = \{content\_id, user\_id, right\_type\}$
- **Prime Attributes**: $\{right\_id, content\_id, user\_id, right\_type\}$
- **Non-Prime Attributes**: $\{granted\_by, granted\_timestamp, status, revoked\_by, revoked\_timestamp\}$
- **Testing for Partial Dependencies on $CK_2$**:
  - Does $\{content\_id, user\_id\} \to status$? **No**. A user can hold a `VIEW` right as `ACTIVE` and a `SHARE` right as `REVOKED` on the same content file.
  - Does $\{content\_id, right\_type\} \to status$? **No**. Status depends on which specific user was granted that right.
  - Does $\{user\_id, right\_type\} \to status$? **No**. Access differs across different content files.
  - Therefore, non-prime attributes depend on the **complete triad** $\{content\_id, user\_id, right\_type\}$.
- **Result**: $\text{RIGHTS} \in \text{2NF}$.

#### 4. `ACTIVITY_LOG`
- **Candidate Key**: $CK_1 = \{activity\_id\}$
- Candidate key is single-attribute.
- **Result**: $\text{ACTIVITY\_LOG} \in \text{2NF}$.

---

## 5. Third Normal Form (3NF)

### Definition:
A relation $R$ is in **Third Normal Form (3NF)** if and only if:
1. $R$ is in **2NF**.
2. For every non-trivial functional dependency $X \to Y$ holding on $R$, at least one of the following conditions is satisfied:
   - **Condition A**: $X$ is a **superkey** of $R$.
   - **Condition B**: $Y$ is a **prime attribute** of $R$ (i.e., $Y$ is a member of some candidate key of $R$).

> **Transitive Dependency**: A functional dependency $X \to Z$ is transitive if there exists an attribute set $Y$ such that $X \to Y$ and $Y \to Z$, where $Y$ is not a candidate key and $Z$ is non-prime.

### Identification of Transitive Dependencies in 2NF Design:
1. **User Role Descriptions**:
   - If `users` contained role metadata (e.g., `user_id -> role -> role_description`), `role -> role_description` would violate 3NF because `role` is not a superkey of `users`.
   - **3NF Solution**: Extract into dedicated relation `ROLES(role_name [PK], display_name, description)`.
2. **Right Type Definitions**:
   - If `rights` contained right descriptions, `right_type -> description` would violate 3NF.
   - **3NF Solution**: Extract into dedicated relation `RIGHT_TYPES(right_type [PK], description)`.
3. **Right Status Definitions**:
   - If `rights` contained status metadata, `status -> description` would violate 3NF.
   - **3NF Solution**: Extract into dedicated relation `RIGHT_STATUSES(status [PK], description)`.
4. **Audit Action Categories**:
   - In `activity_log`, each audit event has an action code and category: `action_code -> action_category, description`.
   - **3NF Solution**: Extract into dedicated relation `ACTIVITY_ACTIONS(action_code [PK], category, description)`.

---

## 6. Formal 3NF Relational Schema

Below is the complete decomposed relational schema in Third Normal Form:

### 1. `ROLES`
- **Attributes**: `(role_name, display_name, description)`
- **Candidate Key**: $\{role\_name\}$
- **Primary Key**: `role_name`
- **Functional Dependencies**:
  $$role\_name \to display\_name, description$$
- **3NF Verification**: $role\_name$ is a superkey. $\checkmark$

### 2. `USERS`
- **Attributes**: `(user_id, name, email, password_hash, role, created_at)`
- **Candidate Keys**: $\{user\_id\}$, $\{email\}$
- **Primary Key**: `user_id`
- **Foreign Key**: `role` $\to$ `ROLES(role_name)`
- **Functional Dependencies**:
  $$user\_id \to name, email, password\_hash, role, created\_at$$
  $$email \to user\_id, name, password\_hash, role, created\_at$$
- **3NF Verification**: For both FDs, the determinant is a candidate key / superkey. $\checkmark$

### 3. `CONTENT`
- **Attributes**: `(content_id, title, original_filename, stored_filename, file_path, file_hash, file_size, owner_id, upload_timestamp)`
- **Candidate Keys**: $\{content\_id\}$, $\{stored\_filename\}$
- **Primary Key**: `content_id`
- **Foreign Key**: `owner_id` $\to$ `USERS(user_id)`
- **Functional Dependencies**:
  $$content\_id \to title, original\_filename, stored\_filename, file\_path, file\_hash, file\_size, owner\_id, upload\_timestamp$$
  $$stored\_filename \to content\_id, title, original\_filename, file\_path, file\_hash, file\_size, owner\_id, upload\_timestamp$$
- **3NF Verification**: Every determinant is a candidate key / superkey. $\checkmark$

### 4. `RIGHT_TYPES`
- **Attributes**: `(right_type, description)`
- **Candidate Key**: $\{right\_type\}$
- **Primary Key**: `right_type`
- **Functional Dependencies**:
  $$right\_type \to description$$
- **3NF Verification**: $right\_type$ is a superkey. $\checkmark$

### 5. `RIGHT_STATUSES`
- **Attributes**: `(status, description)`
- **Candidate Key**: $\{status\}$
- **Primary Key**: `status`
- **Functional Dependencies**:
  $$status \to description$$
- **3NF Verification**: $status$ is a superkey. $\checkmark$

### 6. `RIGHTS`
- **Attributes**: `(right_id, content_id, user_id, right_type, granted_by, granted_timestamp, status, revoked_by, revoked_timestamp)`
- **Candidate Keys**: $\{right\_id\}$, $\{content\_id, user\_id, right\_type\}$
- **Primary Key**: `right_id`
- **Foreign Keys**:
  - `content_id` $\to$ `CONTENT(content_id)`
  - `user_id` $\to$ `USERS(user_id)`
  - `granted_by` $\to$ `USERS(user_id)`
  - `revoked_by` $\to$ `USERS(user_id)`
  - `right_type` $\to$ `RIGHT_TYPES(right_type)`
  - `status` $\to$ `RIGHT_STATUSES(status)`
- **Functional Dependencies**:
  $$right\_id \to content\_id, user\_id, right\_type, granted\_by, granted\_timestamp, status, revoked\_by, revoked\_timestamp$$
  $$\{content\_id, user\_id, right\_type\} \to right\_id, granted\_by, granted\_timestamp, status, revoked\_by, revoked\_timestamp$$
- **3NF Verification**: Both determinants are candidate keys. No non-prime attribute is transitively dependent on any key. $\checkmark$

### 7. `ACTIVITY_ACTIONS`
- **Attributes**: `(action_code, category, description)`
- **Candidate Key**: $\{action\_code\}$
- **Primary Key**: `action_code`
- **Functional Dependencies**:
  $$action\_code \to category, description$$
- **3NF Verification**: $action\_code$ is a superkey. $\checkmark$

### 8. `ACTIVITY_LOG`
- **Attributes**: `(activity_id, content_id, actor_id, target_user_id, action, details, created_at)`
- **Candidate Key**: $\{activity\_id\}$
- **Primary Key**: `activity_id`
- **Foreign Keys**:
  - `content_id` $\to$ `CONTENT(content_id)`
  - `actor_id` $\to$ `USERS(user_id)`
  - `target_user_id` $\to$ `USERS(user_id)`
  - `action` $\to$ `ACTIVITY_ACTIONS(action_code)`
- **Functional Dependencies**:
  $$activity\_id \to content\_id, actor\_id, target\_user\_id, action, details, created\_at$$
- **3NF Verification**: $activity\_id$ is a superkey. $\checkmark$

---

## 7. Normalization Comparison Summary Table

| Relation | Primary Key | Candidate Keys | 1NF | 2NF | 3NF | Justification |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **`ROLES`** | `role_name` | `{role_name}` | $\checkmark$ | $\checkmark$ | $\checkmark$ | Key is single attribute; determinant is a superkey. |
| **`USERS`** | `user_id` | `{user_id}`, `{email}` | $\checkmark$ | $\checkmark$ | $\checkmark$ | All non-prime attributes depend only on superkeys. |
| **`CONTENT`** | `content_id` | `{content_id}`, `{stored_filename}` | $\checkmark$ | $\checkmark$ | $\checkmark$ | All determinants are candidate keys. |
| **`RIGHT_TYPES`** | `right_type` | `{right_type}` | $\checkmark$ | $\checkmark$ | $\checkmark$ | Master lookup entity; key is superkey. |
| **`RIGHT_STATUSES`** | `status` | `{status}` | $\checkmark$ | $\checkmark$ | $\checkmark$ | Master lookup entity; key is superkey. |
| **`RIGHTS`** | `right_id` | `{right_id}`, `{content_id, user_id, right_type}` | $\checkmark$ | $\checkmark$ | $\checkmark$ | Full functional dependency on compound key; no transitive paths. |
| **`ACTIVITY_ACTIONS`** | `action_code` | `{action_code}` | $\checkmark$ | $\checkmark$ | $\checkmark$ | Master lookup entity; key is superkey. |
| **`ACTIVITY_LOG`** | `activity_id` | `{activity_id}` | $\checkmark$ | $\checkmark$ | $\checkmark$ | Key is single attribute; determinant is superkey. |

---

## 8. Decomposition Properties & Proofs

### Property 1: Lossless-Join Decomposition
A decomposition of relation $R$ into $\{R_1, R_2\}$ is **lossless** with respect to functional dependency set $F$ if:
$$R_1 \cap R_2 \to R_1 \quad \text{or} \quad R_1 \cap R_2 \to R_2$$
- For `USERS` and `ROLES`:
  $$\text{USERS} \cap \text{ROLES} = \{role\}$$
  $$\{role\} \to \text{ROLES}$$
  Since $role$ is the Primary Key of `ROLES`, the condition $\{role\} \to \text{ROLES}$ holds. Therefore, the join is **lossless**.
- Similarly, for `RIGHTS` $\bowtie$ `RIGHT_TYPES`, `RIGHTS` $\bowtie$ `RIGHT_STATUSES`, and `ACTIVITY_LOG` $\bowtie$ `ACTIVITY_ACTIONS`, the common attributes form candidate keys of the referenced relations, guaranteeing **lossless joins across all decompositions**.

### Property 2: Dependency Preservation
A decomposition $D = \{R_1, R_2, \dots, R_k\}$ is **dependency-preserving** if:
$$(\bigcup_{i=1}^k \pi_{R_i}(F))^+ = F^+$$
Every functional dependency in the original universe is directly enforceable within a single relation:
- $user\_id \to role$ is enforced within `USERS`.
- $role \to description$ is enforced within `ROLES`.
- $\{content\_id, user\_id, right\_type\} \to status$ is enforced via unique constraint `uq_rights_content_user_type` within `RIGHTS`.
- No cross-table functional dependency requires a multi-table join to verify. **Dependency preservation holds 100%.**

---

## 9. Conclusion
The database has been refactored into a rigorous **Third Normal Form (3NF)** relational model. It completely eliminates update, insertion, and deletion anomalies while maintaining 100% functional dependency preservation and lossless joins, in full alignment with academic database standards.
