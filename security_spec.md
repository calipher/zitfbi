# ZITF BI Cloud Firestore Security Specification

## 1. Data Invariants
1. **Default-Deny Catch-All**: Every undefined collection path and operation defaults to `allow read, write: if false`.
2. **Verified Email Gate**: Every authenticated read/write requires `request.auth != null && request.auth.token.email_verified == true`.
3. **Path Variable Hardening (ID Poisoning Guard)**: Every single-document ID (`editionId`, `exhibitorId`, `visitorId`, `txId`, `engagementId`, `hallId`, `incidentId`, `insightId`, `reportId`, `connectorId`, `logId`, `ruleId`, `eventId`, `scheduleId`, `briefId`, `commentId`, `dispatchId`, `staffId`, `userId`, `adminUid`, `snapshotId`) must match `^[a-zA-Z0-9_\-]+$` and length `1..128`.
4. **Strict Blueprint Key & Boundary Validation**: Every entity has an explicit `isValid[Entity](incoming(), docId)` validator invoked on BOTH `create` and `update`, enforcing `keys().hasAll(...)`, `keys().hasOnly(...)`, type safety, string `.size()` limits on every string, array `.size()` + index-0 type checks, numeric range checks, and enum checks matching `firebase-blueprint.json`.
5. **PII Isolation & Zero Blanket Reads**: User private profiles (`/users/{userId}/private/profile`), directory PII (`/directoryUsers/{staffId}`), exhibitor/visitor contact details, email dispatches, and audit logs strictly restrict `get` to `(existing().ownerUid == request.auth.uid || isAdmin())` and `allow list` to `(resource.data.ownerUid == request.auth.uid || isBootstrappedAdminEmail())` with zero `get()`/`exists()` inside `allow list`.
6. **Immutable Ownership & Temporal Integrity**: `id`/`ownerUid`/`createdAt` cannot change after creation; `createdAt == request.time` on `create` and `updatedAt == request.time` on `update`. `/auditLogs` and `/connectorSyncLogs` are append-only (updates rejected for non-admins).
7. **Terminal State Locking**:
   - `WarehouseSnapshot`: Locked for non-admins once `status == 'Archived'`.
   - `TradeEngagementRecord`: Locked for non-admins once `verificationStatus == 'Independently Verified'`.
   - `OperationalIncidentRecord`: Locked for non-admins once `status == 'Resolved'`.
   - `AlertEventRecord`: Locked for non-admins once `status == 'Resolved'`.
   - `SharedBriefRecord`: Locked for non-admins once `workflowStatus == 'Approved'`.
8. **Relational Master Gate**: `/workspaceSnapshots/{snapshotId}/reports/{reportId}` verifies parent `/workspaceSnapshots/{snapshotId}` existence and ownership via `get()`.

## 2. Adversarial "Dirty Dozen" Rejection Payloads
1. **Unauthenticated Access**: `request.auth == null` reading or writing `/exhibitors/ex1` -> `PERMISSION_DENIED`.
2. **Unverified Admin Email Spoof**: `request.auth.token.email == 'calipherrndlovu@gmail.com'` with `email_verified == false` -> `PERMISSION_DENIED`.
3. **ID Poisoning**: Creating `/exhibitors/bad%20id$123` or 200-char ID -> `PERMISSION_DENIED`.
4. **Identity Spoofing**: Creating `/exhibitors/ex1` with `ownerUid != request.auth.uid` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: Adding `isVerified: true` or `shadowAdmin: true` on `exhibitors`, `visitors`, `tradeEngagements`, or `biReports` -> rejected by `keys().hasOnly(...)`.
6. **Self-Privilege Escalation**: Non-admin writing `/admins/{uid}` or tampering with `/directoryUsers/{staffId}` without admin/owner authority -> `PERMISSION_DENIED`.
7. **PII Blanket Read**: Reading `/users/{otherUid}/private/profile` or `/visitors/{otherDoc}` owned by another UID -> `PERMISSION_DENIED`.
8. **Unfiltered Collection Scrape**: Listing `/commercialTransactions` or `/tradeEngagements` without owner/bootstrapped-admin predicate -> `PERMISSION_DENIED`.
9. **Client Clock Timestamp Forgery**: Creating/updating any record with `createdAt` or `updatedAt != request.time` -> `PERMISSION_DENIED`.
10. **Immutable Ownership / Log Mutation**: Attempting to alter `ownerUid`, `createdAt`, or modify an existing `/auditLogs/{logId}` entry -> `PERMISSION_DENIED`.
11. **Terminal State Bypass**: Non-admin modifying an `Independently Verified` trade deal, `Resolved` incident/alert, `Approved` brief, or `Archived` snapshot -> `PERMISSION_DENIED`.
12. **Array / String Buffer Flooding**: Submitting an exhibitor with `productsServices` array of 30 strings or a 10KB `businessDescription` -> `PERMISSION_DENIED`.
