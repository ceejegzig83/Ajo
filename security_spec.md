# Security Specification — AJO DAILY CONTRIBUTION

## 1. Data Invariants
1. **Identity & PII Isolation**: A user document at `/users/{userId}` can only be read or created by `request.auth.uid == userId` or a verified `isAdmin()`. Users cannot self-assign `SUPER_ADMIN` role upon creation.
2. **Group Ownership & Access Code Integrity**: A group at `/groups/{groupId}` must have `organizerId == request.auth.uid`, a valid 6-digit `accessCode` (`^[0-9]{6}$`), and positive `amount`.
3. **Contribution Integrity**: Contributions at `/contributions/{contributionId}` must reference a valid `groupId` and `userId`. Once `status == 'PAID'`, terminal state locking prevents reverting or double-paying unless overridden by `isAdmin()`.
4. **Transaction Verification Guard**: Transactions at `/transactions/{transactionId}` must belong to `request.auth.uid`, enforce positive `amount` in `NGN`, and lock once `status == 'SUCCESS'`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Privilege Escalation on User Create**: `{ "uid": "u1", "role": "SUPER_ADMIN", ... }` by non-admin user -> `PERMISSION_DENIED`
2. **Shadow Field Injection on User Update**: `{ "uid": "u1", "isVerified": true }` -> `PERMISSION_DENIED`
3. **Unverified Email Spoofing**: Request with `email == "ceejegzig83@gmail.com"` but `email_verified == false` -> `PERMISSION_DENIED`
4. **Cross-User PII Read**: Authenticated user `u2` attempting `get(/users/u1)` -> `PERMISSION_DENIED`
5. **Blanket User List Scraping**: Authenticated non-admin attempting `list(/users)` without `userId` filter -> `PERMISSION_DENIED`
6. **ID Poisoning Attack**: Document ID exceeding 128 chars or containing invalid symbols -> `PERMISSION_DENIED`
7. **Group Creation Spoofing Organizer**: User `u1` creating group with `organizerId: "u2"` -> `PERMISSION_DENIED`
8. **Invalid Group Access Code**: Creating group with `accessCode: "ABC12345"` -> `PERMISSION_DENIED`
9. **Terminal Contribution Mutation**: Updating a contribution where existing `status == "PAID"` to `"DUE"` -> `PERMISSION_DENIED`
10. **Cross-User Transaction Creation**: User `u1` creating a transaction with `userId: "u2"` -> `PERMISSION_DENIED`
11. **Value Poisoning on Update**: Updating `amount` with a string `"5000"` instead of number -> `PERMISSION_DENIED`
12. **Immutable Timestamp Tampering**: Modifying `createdAt` during an update operation -> `PERMISSION_DENIED`
