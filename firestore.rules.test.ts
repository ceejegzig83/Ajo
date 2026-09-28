/**
 * Red Team Security Specification & Adversarial Payload Verification Suite
 * Verifies all 12 Dirty Dozen payloads result in PERMISSION_DENIED.
 */

export interface AdversarialPayloadTest {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authUid: string | null;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: AdversarialPayloadTest[] = [
  {
    id: 1,
    name: 'Privilege Escalation on User Create',
    collection: 'users/u1',
    operation: 'create',
    authUid: 'u1',
    emailVerified: true,
    payload: { uid: 'u1', fullName: 'Attacker', email: 'a@b.com', phone: '08012345678', role: 'SUPER_ADMIN', status: 'ACTIVE' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on User Update',
    collection: 'users/u1',
    operation: 'update',
    authUid: 'u1',
    emailVerified: true,
    payload: { uid: 'u1', fullName: 'Valid Name', isVerified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Spoofing',
    collection: 'users/u1',
    operation: 'get',
    authUid: 'u2',
    emailVerified: false,
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Cross-User PII Read',
    collection: 'users/u1',
    operation: 'get',
    authUid: 'u2',
    emailVerified: true,
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Blanket User List Scraping',
    collection: 'users',
    operation: 'list',
    authUid: 'u2',
    emailVerified: true,
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'ID Poisoning Attack',
    collection: 'users/invalid$id!with*bad^chars',
    operation: 'create',
    authUid: 'invalid$id!with*bad^chars',
    emailVerified: true,
    payload: { uid: 'invalid$id!with*bad^chars' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Group Creation Spoofing Organizer',
    collection: 'groups/g1',
    operation: 'create',
    authUid: 'u1',
    emailVerified: true,
    payload: { id: 'g1', name: 'Spoofed Group', organizerId: 'u2', organizerName: 'Other', amount: 5000, currency: 'NGN', frequency: 'DAILY', accessCode: '123456', status: 'ACTIVE' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Invalid Group Access Code',
    collection: 'groups/g1',
    operation: 'create',
    authUid: 'u1',
    emailVerified: true,
    payload: { id: 'g1', name: 'Bad Code Group', organizerId: 'u1', organizerName: 'Self', amount: 5000, currency: 'NGN', frequency: 'DAILY', accessCode: 'ABCDEF', status: 'ACTIVE' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Terminal Contribution Mutation (PAID -> DUE)',
    collection: 'contributions/c1',
    operation: 'update',
    authUid: 'u1',
    emailVerified: true,
    payload: { status: 'DUE' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Cross-User Transaction Creation',
    collection: 'transactions/t1',
    operation: 'create',
    authUid: 'u1',
    emailVerified: true,
    payload: { transactionId: 't1', reference: 'REF-1', userId: 'u2', groupId: 'g1', contributionId: 'c1', amount: 5000, currency: 'NGN', provider: 'mock', status: 'INITIATED' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Value Poisoning on Update (String instead of Number)',
    collection: 'groups/g1',
    operation: 'update',
    authUid: 'u1',
    emailVerified: true,
    payload: { amount: '5000' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Immutable Timestamp Tampering',
    collection: 'users/u1',
    operation: 'update',
    authUid: 'u1',
    emailVerified: true,
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
