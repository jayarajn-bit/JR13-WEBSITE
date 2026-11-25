# JR13 SAVINGS Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity Isolation**: Every user-owned document (`users`, `profiles`, `challenges`, `dailyContributions`, `streaks`, `transactions`, `restrictedFundsLedger`, `settlementRequests`, `rewardRecords`, `notifications`, `paymentAccounts`) MUST bind `userId == request.auth.uid` on create and prohibit `userId` reassignment on update.
2. **PII Protection**: No collection containing PII (`users`, `profiles`, `paymentAccounts`) permits blanket `isSignedIn()` reads; only `isOwner(userId)` or `isAdmin()` may read, and bank/UPI identifiers are stored strictly masked.
3. **Locked Challenge Integrity**: Once a `Challenge` reaches terminal status (`FAILED` or `COMPLETED`) with `locked == true`, non-admin clients cannot mutate `status`, `locked`, `totalSavedInr`, or `completedDays`, and cannot attach new `dailyContributions` to a non-ACTIVE challenge.
4. **Restricted Funds Non-Confiscation**: `restrictedFundsLedger` enforces `forfeitureProhibited == true` and `adminSpendProhibited == true` on all writes. Regular users cannot mark a ledger entry `SETTLED` or `APPROVED_FOR_SETTLEMENT`; only verified admins can update reconciliation notes or record partner-approved settlement transitions.
5. **Immutable Audit Logs**: `auditLogs` allows `create` only with valid actor binding (`actorUid == request.auth.uid`) and forbids `update` and `delete` for everyone including admins.
6. **Admin Privilege Prevention**: Non-admin users cannot create, update, or delete `adminUsers` documents.

## 2. Dirty Dozen Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read on `/users/u1`**: `auth: null` -> DENIED.
2. **Cross-user PII read on `/profiles/victim_uid`**: `auth: attacker_uid` -> DENIED.
3. **Identity spoofing on `/challenges/c1` create**: `data.userId = "victim_uid"` while `auth.uid = "attacker_uid"` -> DENIED.
4. **Shadow field injection on `/profiles/u1` update**: adding `isAdmin: true` or `role: "SUPER_ADMIN"` -> DENIED (`hasOnly` rejects).
5. **Self-escalation on `/adminUsers/attacker_uid` create**: `auth.uid = "attacker_uid"` -> DENIED.
6. **Spoofed unverified email admin bypass**: `auth.token.email = "jayarajyadav2006@gmail.com", email_verified = false` -> DENIED.
7. **Resource poisoning with 5KB ID**: `challengeId = "a".repeat(5000)` -> DENIED (`isValidId` fails).
8. **Mutating locked FAILED challenge back to ACTIVE**: `existing.locked == true`, `incoming.status = "ACTIVE"` -> DENIED.
9. **User self-approving settlement request**: `auth.uid == userId`, `incoming.status = "SETTLED_REFUNDED"` -> DENIED.
10. **Attempting forfeiture on `restrictedFundsLedger`**: `incoming.forfeitureProhibited = false` or `adminSpendProhibited = false` -> DENIED.
11. **Deleting or modifying an `auditLogs` entry**: `delete` or `update` on `/auditLogs/log1` -> DENIED.
12. **Blanket list scraping on `/transactions` or `/paymentAccounts`**: `list` query without `where("userId", "==", auth.uid)` as non-admin -> DENIED.
