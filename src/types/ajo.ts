export type UserRole = 'SUPER_ADMIN' | 'ORGANIZER' | 'MEMBER';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED';
export type GroupStatus = 'ACTIVE' | 'SUSPENDED' | 'COMPLETED';

export interface User {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  password: string;
  role: UserRole;
  status?: AccountStatus;
  lastLoginAt?: string;
  createdAt: string;
}

export type ContributionFrequency = 'Daily' | 'Weekly' | 'Monthly';

export interface Group {
  id: string;
  name: string;
  description: string;
  organizerId: string;
  organizerName: string;
  amount: number;
  frequency: ContributionFrequency;
  startDate: string;
  maxMembers: number;
  accessCode: string; // 6-digit code e.g. "583921"
  status?: GroupStatus;
  createdAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail: string;
  joinedAt: string;
}

export type ContributionStatus =
  | 'UPCOMING'
  | 'DUE'
  | 'PAID'
  | 'LATE'
  | 'FAILED'
  | 'PENDING';

// Keep PaymentStatus alias for full backward compatibility with Version 1
export type PaymentStatus = ContributionStatus;

export interface Contribution {
  id: string;
  contributionId: string;
  groupId: string;
  groupName: string;
  userId: string;
  userName: string;
  amount: number;
  frequency: ContributionFrequency;
  dueDate: string;
  nextDueDate: string; // Kept in sync with dueDate for V1 compatibility
  status: ContributionStatus;
  createdAt: string;
  paidAt: string | null;
  transactionReference: string | null;
  lastReference?: string; // Kept in sync with transactionReference for V1 compatibility
  updatedAt: string;
  cycleIndex?: number;
}

export interface TransactionRecord {
  id: string;
  reference: string; // e.g. "AJO-TEST-000001"
  contributionId?: string;
  groupId: string;
  groupName: string;
  userId: string;
  userName: string;
  amount: number;
  dueDate?: string;
  paymentMethod?: string;
  provider?: 'MOCK' | 'PAYSTACK';
  status: 'PAID' | 'PENDING' | 'FAILED' | 'CANCELLED';
  date: string;
}

export type ReminderType =
  | 'UPCOMING_REMINDER'
  | 'DUE_TODAY_REMINDER'
  | 'LATE_WARNING'
  | 'PAYMENT_CONFIRMATION'
  | 'PAYMENT_FAILED';

export type ReminderChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';

export interface ReminderRecord {
  id: string;
  contributionId: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail: string;
  groupId: string;
  groupName: string;
  amount: number;
  dueDate: string;
  type: ReminderType;
  title: string;
  message: string;
  channels: ReminderChannel[];
  sentAt: string;
  isRead: boolean;
  triggeredBy: 'AUTOMATED_SYSTEM' | 'ORGANIZER_MANUAL';
}

export interface ReminderSettings {
  autoRemindUpcoming: boolean;
  autoRemindDueToday: boolean;
  autoRemindLate: boolean;
  channels: ReminderChannel[];
}

export type PayoutStatus = 'UPCOMING' | 'PROCESSING' | 'PAID' | 'CANCELLED';

export interface PayoutRecord {
  id: string;
  groupId: string;
  groupName: string;
  recipientUserId: string;
  recipientName: string;
  amount: number;
  scheduledDate: string;
  status: PayoutStatus;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  timestamp: string;
  description: string;
}

export interface AdminNotificationRecord {
  id: string;
  category:
    | 'USER_REGISTERED'
    | 'GROUP_CREATED'
    | 'LARGE_CONTRIBUTION'
    | 'LATE_CONTRIBUTIONS'
    | 'PAYMENT_FAILURE'
    | 'ORGANIZER_ACTIVITY';
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  defaultCurrency: string;
  gracePeriodHours: number;
  allowSelfRegistration: boolean;
  defaultContributionFrequency: ContributionFrequency;
  minContributionAmount: number;
  paymentProvider: 'MOCK' | 'PAYSTACK';
  testMode: boolean;
  requireAdminSessionAuth: boolean;
}

export type AppScreen =
  | 'HOME'
  | 'LOGIN'
  | 'REGISTER'
  | 'MEMBER_DASHBOARD'
  | 'ORGANIZER_DASHBOARD'
  | 'CREATE_GROUP'
  | 'JOIN_GROUP'
  | 'GROUP_DETAILS'
  | 'MY_CONTRIBUTIONS'
  | 'MAKE_PAYMENT'
  | 'PAYMENT_HISTORY'
  | 'REMINDERS'
  | 'PROFILE'
  | 'ADMIN_LOGIN'
  | 'ADMIN_DASHBOARD';

export function formatNaira(amount: number): string {
  return `₦${Number(amount || 0).toLocaleString('en-NG')}`;
}

export function formatReadableDate(ymdOrIso: string | null | undefined): string {
  if (!ymdOrIso) return '—';
  const clean = ymdOrIso.slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  const parsed = new Date(ymdOrIso);
  if (isNaN(parsed.getTime())) return ymdOrIso;
  return parsed.toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function calculateDaysLate(
  dueDateYmd: string,
  todayYmd: string
): number {
  const [dy, dm, dd] = dueDateYmd.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = todayYmd.slice(0, 10).split('-').map(Number);
  const dueTime = new Date(dy, (dm || 1) - 1, dd || 1).getTime();
  const todayTime = new Date(ty, (tm || 1) - 1, td || 1).getTime();
  const diff = Math.floor((todayTime - dueTime) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}
