import {
  User,
  UserRole,
  Group,
  GroupMember,
  Contribution,
  ContributionFrequency,
  ContributionStatus,
  TransactionRecord,
  ReminderRecord,
  ReminderSettings,
  PayoutRecord,
  AuditLogRecord,
  AdminNotificationRecord,
  PlatformSettings,
  formatNaira,
  formatReadableDate,
} from '../types/ajo';

const STORAGE_KEYS = {
  USERS: 'ajo_v1_users',
  GROUPS: 'ajo_v1_groups',
  GROUP_MEMBERS: 'ajo_v1_group_members',
  CONTRIBUTIONS: 'ajo_v1_contributions',
  TRANSACTIONS: 'ajo_v1_transactions',
  REMINDERS: 'ajo_v2_reminders',
  REMINDER_SETTINGS: 'ajo_v2_reminder_settings',
  PAYOUTS: 'ajo_v3_payouts',
  AUDIT_LOGS: 'ajo_v3_audit_logs',
  ADMIN_NOTIFICATIONS: 'ajo_v3_admin_notifications',
  PLATFORM_SETTINGS: 'ajo_v3_platform_settings',
  CURRENT_USER_ID: 'ajo_v1_current_user_id',
  REF_SEQ: 'ajo_v1_ref_seq',
  SCHEMA_VERSION: 'ajo_schema_version',
};

export interface AjoState {
  users: User[];
  groups: Group[];
  groupMembers: GroupMember[];
  contributions: Contribution[];
  transactions: TransactionRecord[];
  reminders: ReminderRecord[];
  reminderSettings: ReminderSettings;
  payouts: PayoutRecord[];
  auditLogs: AuditLogRecord[];
  adminNotifications: AdminNotificationRecord[];
  platformSettings: PlatformSettings;
  refSeq: number;
}

export function getTodayYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const clean = ymd.slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + days);
  const ry = dt.getFullYear();
  const rm = String(dt.getMonth() + 1).padStart(2, '0');
  const rd = String(dt.getDate()).padStart(2, '0');
  return `${ry}-${rm}-${rd}`;
}

export function calculateScheduleDueDate(
  startDateYmd: string,
  frequency: ContributionFrequency,
  cycleOffset: number
): string {
  const clean = startDateYmd.slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);

  if (frequency === 'Daily') {
    dt.setDate(dt.getDate() + cycleOffset);
  } else if (frequency === 'Weekly') {
    dt.setDate(dt.getDate() + cycleOffset * 7);
  } else {
    dt.setMonth(dt.getMonth() + cycleOffset);
  }

  const ry = dt.getFullYear();
  const rm = String(dt.getMonth() + 1).padStart(2, '0');
  const rd = String(dt.getDate()).padStart(2, '0');
  return `${ry}-${rm}-${rd}`;
}

export function calculateAutomaticStatus(
  c: Pick<Contribution, 'dueDate' | 'status' | 'paidAt'>,
  todayYmd: string = getTodayYmd()
): ContributionStatus {
  if (c.status === 'PAID' || c.paidAt) return 'PAID';
  if (c.status === 'FAILED') return 'FAILED';
  if (c.status === 'PENDING') return 'PENDING';

  const due = (c.dueDate || todayYmd).slice(0, 10);
  if (due > todayYmd) return 'UPCOMING';
  if (due === todayYmd) return 'DUE';
  return 'LATE';
}

export function recalculateContributions(
  contributions: Contribution[],
  todayYmd: string = getTodayYmd()
): Contribution[] {
  return contributions.map((c) => {
    const dueDate = (c.dueDate || c.nextDueDate || todayYmd).slice(0, 10);
    const contributionId = c.contributionId || c.id;
    const transactionReference = c.transactionReference ?? c.lastReference ?? null;
    const paidAt = c.paidAt ?? (c.status === 'PAID' ? c.updatedAt : null);
    const computedStatus = calculateAutomaticStatus(
      { dueDate, status: c.status, paidAt },
      todayYmd
    );

    return {
      ...c,
      id: contributionId,
      contributionId,
      dueDate,
      nextDueDate: dueDate,
      paidAt,
      transactionReference,
      lastReference: transactionReference || undefined,
      status: computedStatus,
    };
  });
}

export function generateMemberContributionSchedule(
  group: Group,
  member: { userId: string; userName: string },
  cyclesCount: number = 7,
  todayYmd: string = getTodayYmd()
): Contribution[] {
  const nowIso = new Date().toISOString();
  const records: Contribution[] = [];

  for (let i = 0; i < cyclesCount; i++) {
    const dueDate = calculateScheduleDueDate(group.startDate, group.frequency, i);
    const contributionId = `cnt-${group.id}-${member.userId}-${i + 1}`;
    const status = calculateAutomaticStatus(
      { dueDate, status: 'UPCOMING', paidAt: null },
      todayYmd
    );

    records.push({
      id: contributionId,
      contributionId,
      userId: member.userId,
      userName: member.userName,
      groupId: group.id,
      groupName: group.name,
      amount: group.amount,
      frequency: group.frequency,
      dueDate,
      nextDueDate: dueDate,
      status,
      createdAt: nowIso,
      paidAt: null,
      transactionReference: null,
      updatedAt: nowIso,
      cycleIndex: i + 1,
    });
  }

  return records;
}

export function buildReminderMessage(
  c: Contribution,
  type: ReminderRecord['type']
): { title: string; message: string } {
  const formattedAmt = formatNaira(c.amount);
  const formattedDue = formatReadableDate(c.dueDate);

  switch (type) {
    case 'DUE_TODAY_REMINDER':
      return {
        title: `Contribution Due Today — ${c.groupName}`,
        message: `Dear ${c.userName}, your ${c.frequency.toLowerCase()} contribution of ${formattedAmt} for "${c.groupName}" is DUE TODAY (${formattedDue}). Kindly make your payment promptly to keep our group payout schedule on track.`,
      };
    case 'LATE_WARNING':
      return {
        title: `Overdue Contribution Notice — ${c.groupName}`,
        message: `Attention ${c.userName}: Your contribution of ${formattedAmt} for "${c.groupName}" due on ${formattedDue} is currently LATE. Timely contributions are vital to protect the trust and rotational payout of every member in the group. Please settle this overdue payment immediately.`,
      };
    case 'UPCOMING_REMINDER':
      return {
        title: `Upcoming Contribution Reminder — ${c.groupName}`,
        message: `Hello ${c.userName}, this is a courtesy reminder that your next ${c.frequency.toLowerCase()} contribution of ${formattedAmt} for "${c.groupName}" will be due on ${formattedDue}. Thank you for your reliability.`,
      };
    case 'PAYMENT_CONFIRMATION':
      return {
        title: `Payment Confirmed (${c.transactionReference || 'PAID'}) — ${c.groupName}`,
        message: `Thank you, ${c.userName}! Your contribution of ${formattedAmt} for "${c.groupName}" (Due: ${formattedDue}) has been received and marked as PAID. Reference: ${c.transactionReference || 'N/A'}.`,
      };
    case 'PAYMENT_FAILED':
      return {
        title: `Payment Attempt Failed — ${c.groupName}`,
        message: `Hello ${c.userName}, your recent payment attempt of ${formattedAmt} for "${c.groupName}" (Due: ${formattedDue}) could not be completed. Please retry your contribution payment.`,
      };
  }
}

export function syncAutomatedReminders(
  contributions: Contribution[],
  users: User[],
  existingReminders: ReminderRecord[],
  settings: ReminderSettings,
  todayYmd: string = getTodayYmd()
): ReminderRecord[] {
  const tomorrowYmd = addDaysYmd(todayYmd, 1);
  const existingKeys = new Set(
    existingReminders.map((r) => `${r.contributionId}:${r.type}`)
  );
  const newReminders: ReminderRecord[] = [];
  const nowIso = new Date().toISOString();

  for (const c of contributions) {
    const user = users.find((u) => u.id === c.userId);
    const phone = user?.phone || '08000000000';
    const email = user?.email || 'member@ajodaily.ng';

    if (c.status === 'LATE' && settings.autoRemindLate) {
      const key = `${c.contributionId}:LATE_WARNING`;
      if (!existingKeys.has(key)) {
        const { title, message } = buildReminderMessage(c, 'LATE_WARNING');
        newReminders.push({
          id: `rem-auto-late-${c.contributionId}`,
          contributionId: c.contributionId,
          userId: c.userId,
          userName: c.userName,
          userPhone: phone,
          userEmail: email,
          groupId: c.groupId,
          groupName: c.groupName,
          amount: c.amount,
          dueDate: c.dueDate,
          type: 'LATE_WARNING',
          title,
          message,
          channels: settings.channels,
          sentAt: nowIso,
          isRead: false,
          triggeredBy: 'AUTOMATED_SYSTEM',
        });
        existingKeys.add(key);
      }
    } else if (c.status === 'DUE' && settings.autoRemindDueToday) {
      const key = `${c.contributionId}:DUE_TODAY_REMINDER`;
      if (!existingKeys.has(key)) {
        const { title, message } = buildReminderMessage(c, 'DUE_TODAY_REMINDER');
        newReminders.push({
          id: `rem-auto-due-${c.contributionId}`,
          contributionId: c.contributionId,
          userId: c.userId,
          userName: c.userName,
          userPhone: phone,
          userEmail: email,
          groupId: c.groupId,
          groupName: c.groupName,
          amount: c.amount,
          dueDate: c.dueDate,
          type: 'DUE_TODAY_REMINDER',
          title,
          message,
          channels: settings.channels,
          sentAt: nowIso,
          isRead: false,
          triggeredBy: 'AUTOMATED_SYSTEM',
        });
        existingKeys.add(key);
      }
    } else if (
      c.status === 'UPCOMING' &&
      c.dueDate === tomorrowYmd &&
      settings.autoRemindUpcoming
    ) {
      const key = `${c.contributionId}:UPCOMING_REMINDER`;
      if (!existingKeys.has(key)) {
        const { title, message } = buildReminderMessage(c, 'UPCOMING_REMINDER');
        newReminders.push({
          id: `rem-auto-upcoming-${c.contributionId}`,
          contributionId: c.contributionId,
          userId: c.userId,
          userName: c.userName,
          userPhone: phone,
          userEmail: email,
          groupId: c.groupId,
          groupName: c.groupName,
          amount: c.amount,
          dueDate: c.dueDate,
          type: 'UPCOMING_REMINDER',
          title,
          message,
          channels: settings.channels,
          sentAt: nowIso,
          isRead: false,
          triggeredBy: 'AUTOMATED_SYSTEM',
        });
        existingKeys.add(key);
      }
    }
  }

  return [...newReminders, ...existingReminders];
}

export function createAuditEntry(
  action: string,
  user: Pick<User, 'id' | 'fullName' | 'role'>,
  description: string
): AuditLogRecord {
  return {
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    action,
    userId: user.id,
    userName: user.fullName,
    userRole: user.role,
    timestamp: new Date().toISOString(),
    description,
  };
}

export function getDefaultPlatformSettings(): PlatformSettings {
  return {
    platformName: 'AJO DAILY CONTRIBUTION',
    supportEmail: 'support@ajodaily.ng',
    defaultCurrency: 'NGN (₦)',
    gracePeriodHours: 24,
    allowSelfRegistration: true,
    defaultContributionFrequency: 'Daily',
    minContributionAmount: 500,
    paymentProvider: 'MOCK',
    testMode: true,
    requireAdminSessionAuth: true,
  };
}

export function getInitialDemoState(): AjoState {
  const todayYmd = getTodayYmd();
  const threeDaysAgoDate = addDaysYmd(todayYmd, -3);
  const twoDaysAgoDate = addDaysYmd(todayYmd, -2);
  const yesterdayDate = addDaysYmd(todayYmd, -1);

  const defaultReminderSettings: ReminderSettings = {
    autoRemindUpcoming: true,
    autoRemindDueToday: true,
    autoRemindLate: true,
    channels: ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'],
  };

  const users: User[] = [
    {
      id: 'usr-org-1',
      fullName: 'Alhaja Kudirat Balogun',
      phone: '08031112201',
      email: 'kudirat@ajodaily.ng',
      password: 'password123',
      role: 'ORGANIZER',
      status: 'ACTIVE',
      lastLoginAt: `${todayYmd}T08:00:00.000Z`,
      createdAt: '2026-09-20T09:00:00.000Z',
    },
    {
      id: 'usr-mem-1',
      fullName: 'Ngozi Eze',
      phone: '08052223301',
      email: 'ngozi@ajodaily.ng',
      password: 'password123',
      role: 'MEMBER',
      status: 'ACTIVE',
      lastLoginAt: `${todayYmd}T08:30:00.000Z`,
      createdAt: '2026-09-21T10:00:00.000Z',
    },
    {
      id: 'usr-mem-2',
      fullName: 'Tunde Bakare',
      phone: '08052223302',
      email: 'tunde@ajodaily.ng',
      password: 'password123',
      role: 'MEMBER',
      status: 'ACTIVE',
      lastLoginAt: `${todayYmd}T07:30:00.000Z`,
      createdAt: '2026-09-21T11:30:00.000Z',
    },
    {
      id: 'usr-admin-1',
      fullName: 'Chukwuma Okafor',
      phone: '08090001100',
      email: 'admin@ajodaily.ng',
      password: 'admin123',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      lastLoginAt: `${todayYmd}T09:00:00.000Z`,
      createdAt: '2026-09-15T08:00:00.000Z',
    },
  ];

  const groups: Group[] = [
    {
      id: 'grp-market-daily',
      name: 'Market Women Daily Ajo',
      description:
        'Daily ₦5,000 rotational contribution group for traders and small business owners. Transparent daily savings and timely payouts.',
      organizerId: 'usr-org-1',
      organizerName: 'Alhaja Kudirat Balogun',
      amount: 5000,
      frequency: 'Daily',
      startDate: threeDaysAgoDate,
      maxMembers: 20,
      accessCode: '583921',
      status: 'ACTIVE',
      createdAt: '2026-09-22T08:00:00.000Z',
    },
  ];

  const groupMembers: GroupMember[] = [
    {
      id: 'gm-1',
      groupId: 'grp-market-daily',
      userId: 'usr-mem-1',
      userName: 'Ngozi Eze',
      userPhone: '08052223301',
      userEmail: 'ngozi@ajodaily.ng',
      joinedAt: '2026-09-23T09:00:00.000Z',
    },
    {
      id: 'gm-2',
      groupId: 'grp-market-daily',
      userId: 'usr-mem-2',
      userName: 'Tunde Bakare',
      userPhone: '08052223302',
      userEmail: 'tunde@ajodaily.ng',
      joinedAt: '2026-09-23T10:15:00.000Z',
    },
  ];

  const ngoziSchedule = generateMemberContributionSchedule(
    groups[0],
    { userId: 'usr-mem-1', userName: 'Ngozi Eze' },
    7,
    todayYmd
  ).map((c, idx) => {
    if (idx === 0) {
      return {
        ...c,
        status: 'PAID' as ContributionStatus,
        paidAt: `${threeDaysAgoDate}T09:15:00.000Z`,
        transactionReference: 'AJO-TEST-000001',
        lastReference: 'AJO-TEST-000001',
      };
    }
    if (idx === 1) {
      return {
        ...c,
        status: 'PAID' as ContributionStatus,
        paidAt: `${twoDaysAgoDate}T10:20:00.000Z`,
        transactionReference: 'AJO-TEST-000002',
        lastReference: 'AJO-TEST-000002',
      };
    }
    return c;
  });

  const tundeSchedule = generateMemberContributionSchedule(
    groups[0],
    { userId: 'usr-mem-2', userName: 'Tunde Bakare' },
    7,
    todayYmd
  ).map((c, idx) => {
    if (idx === 0) {
      return {
        ...c,
        status: 'PAID' as ContributionStatus,
        paidAt: `${threeDaysAgoDate}T08:40:00.000Z`,
        transactionReference: 'AJO-TEST-000003',
        lastReference: 'AJO-TEST-000003',
      };
    }
    if (idx === 1) {
      return {
        ...c,
        status: 'PAID' as ContributionStatus,
        paidAt: `${twoDaysAgoDate}T08:50:00.000Z`,
        transactionReference: 'AJO-TEST-000004',
        lastReference: 'AJO-TEST-000004',
      };
    }
    if (idx === 2) {
      return {
        ...c,
        status: 'PAID' as ContributionStatus,
        paidAt: `${yesterdayDate}T09:05:00.000Z`,
        transactionReference: 'AJO-TEST-000005',
        lastReference: 'AJO-TEST-000005',
      };
    }
    if (idx === 3) {
      return {
        ...c,
        status: 'PAID' as ContributionStatus,
        paidAt: `${todayYmd}T07:30:00.000Z`,
        transactionReference: 'AJO-TEST-000006',
        lastReference: 'AJO-TEST-000006',
      };
    }
    return c;
  });

  const contributions = recalculateContributions(
    [...ngoziSchedule, ...tundeSchedule],
    todayYmd
  );

  const transactions: TransactionRecord[] = [
    {
      id: 'txn-6',
      reference: 'AJO-TEST-000006',
      contributionId: tundeSchedule[3].contributionId,
      groupId: 'grp-market-daily',
      groupName: 'Market Women Daily Ajo',
      userId: 'usr-mem-2',
      userName: 'Tunde Bakare',
      amount: 5000,
      dueDate: tundeSchedule[3].dueDate,
      paymentMethod: 'Card / Bank Transfer (Test)',
      provider: 'MOCK',
      status: 'PAID',
      date: `${todayYmd}T07:30:00.000Z`,
    },
    {
      id: 'txn-5',
      reference: 'AJO-TEST-000005',
      contributionId: tundeSchedule[2].contributionId,
      groupId: 'grp-market-daily',
      groupName: 'Market Women Daily Ajo',
      userId: 'usr-mem-2',
      userName: 'Tunde Bakare',
      amount: 5000,
      dueDate: tundeSchedule[2].dueDate,
      paymentMethod: 'Card / Bank Transfer (Test)',
      provider: 'MOCK',
      status: 'PAID',
      date: `${yesterdayDate}T09:05:00.000Z`,
    },
    {
      id: 'txn-2',
      reference: 'AJO-TEST-000002',
      contributionId: ngoziSchedule[1].contributionId,
      groupId: 'grp-market-daily',
      groupName: 'Market Women Daily Ajo',
      userId: 'usr-mem-1',
      userName: 'Ngozi Eze',
      amount: 5000,
      dueDate: ngoziSchedule[1].dueDate,
      paymentMethod: 'Card / Bank Transfer (Test)',
      provider: 'MOCK',
      status: 'PAID',
      date: `${twoDaysAgoDate}T10:20:00.000Z`,
    },
    {
      id: 'txn-1',
      reference: 'AJO-TEST-000001',
      contributionId: ngoziSchedule[0].contributionId,
      groupId: 'grp-market-daily',
      groupName: 'Market Women Daily Ajo',
      userId: 'usr-mem-1',
      userName: 'Ngozi Eze',
      amount: 5000,
      dueDate: ngoziSchedule[0].dueDate,
      paymentMethod: 'Card / Bank Transfer (Test)',
      provider: 'MOCK',
      status: 'PAID',
      date: `${threeDaysAgoDate}T09:15:00.000Z`,
    },
  ];

  const reminders = syncAutomatedReminders(
    contributions,
    users,
    [],
    defaultReminderSettings,
    todayYmd
  );

  const payouts: PayoutRecord[] = [
    {
      id: 'pay-1',
      groupId: 'grp-market-daily',
      groupName: 'Market Women Daily Ajo',
      recipientUserId: 'usr-mem-2',
      recipientName: 'Tunde Bakare',
      amount: 35000,
      scheduledDate: todayYmd,
      status: 'PROCESSING',
    },
    {
      id: 'pay-2',
      groupId: 'grp-market-daily',
      groupName: 'Market Women Daily Ajo',
      recipientUserId: 'usr-mem-1',
      recipientName: 'Ngozi Eze',
      amount: 35000,
      scheduledDate: addDaysYmd(todayYmd, 3),
      status: 'UPCOMING',
    },
  ];

  const auditLogs: AuditLogRecord[] = [
    {
      id: 'aud-1',
      action: 'Organizer created group',
      userId: 'usr-org-1',
      userName: 'Alhaja Kudirat Balogun',
      userRole: 'ORGANIZER',
      timestamp: '2026-09-22T08:00:00.000Z',
      description: 'Created group "Market Women Daily Ajo" with access code 583921.',
    },
    {
      id: 'aud-2',
      action: 'Member joined group',
      userId: 'usr-mem-1',
      userName: 'Ngozi Eze',
      userRole: 'MEMBER',
      timestamp: '2026-09-23T09:00:00.000Z',
      description: 'Joined group "Market Women Daily Ajo" (583921).',
    },
    {
      id: 'aud-3',
      action: 'Payment successful',
      userId: 'usr-mem-2',
      userName: 'Tunde Bakare',
      userRole: 'MEMBER',
      timestamp: `${todayYmd}T07:30:00.000Z`,
      description: 'Mock payment AJO-TEST-000006 of ₦5,000 succeeded.',
    },
    {
      id: 'aud-4',
      action: 'Contribution marked late',
      userId: 'usr-mem-1',
      userName: 'Ngozi Eze',
      userRole: 'MEMBER',
      timestamp: `${todayYmd}T00:05:00.000Z`,
      description: `Contribution due on ${yesterdayDate} automatically marked LATE.`,
    },
    {
      id: 'aud-5',
      action: 'Reminder generated',
      userId: 'usr-org-1',
      userName: 'Alhaja Kudirat Balogun',
      userRole: 'ORGANIZER',
      timestamp: `${todayYmd}T08:00:00.000Z`,
      description: 'Automated reminders generated for DUE and LATE contributions.',
    },
  ];

  const adminNotifications: AdminNotificationRecord[] = [
    {
      id: 'anot-1',
      category: 'LATE_CONTRIBUTIONS',
      title: 'Overdue Contribution Detected',
      message: `Ngozi Eze has a late contribution of ₦5,000 in Market Women Daily Ajo (due ${yesterdayDate}).`,
      createdAt: `${todayYmd}T08:00:00.000Z`,
      isRead: false,
    },
    {
      id: 'anot-2',
      category: 'LARGE_CONTRIBUTION',
      title: 'Contribution Payment Received',
      message: 'Tunde Bakare completed payment AJO-TEST-000006 (₦5,000).',
      createdAt: `${todayYmd}T07:30:00.000Z`,
      isRead: false,
    },
    {
      id: 'anot-3',
      category: 'GROUP_CREATED',
      title: 'Active Contribution Group Running',
      message: 'Market Women Daily Ajo (Code: 583921) is active with 2 members.',
      createdAt: '2026-09-22T08:00:00.000Z',
      isRead: false,
    },
  ];

  return {
    users,
    groups,
    groupMembers,
    contributions,
    transactions,
    reminders,
    reminderSettings: defaultReminderSettings,
    payouts,
    auditLogs,
    adminNotifications,
    platformSettings: getDefaultPlatformSettings(),
    refSeq: 7,
  };
}

export function loadAjoState(): AjoState {
  const todayYmd = getTodayYmd();
  const demo = getInitialDemoState();

  try {
    const rawUsers = localStorage.getItem(STORAGE_KEYS.USERS);
    const rawGroups = localStorage.getItem(STORAGE_KEYS.GROUPS);
    const rawMembers = localStorage.getItem(STORAGE_KEYS.GROUP_MEMBERS);
    const rawContributions = localStorage.getItem(STORAGE_KEYS.CONTRIBUTIONS);
    const rawTransactions = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    const rawReminders = localStorage.getItem(STORAGE_KEYS.REMINDERS);
    const rawSettings = localStorage.getItem(STORAGE_KEYS.REMINDER_SETTINGS);
    const rawPayouts = localStorage.getItem(STORAGE_KEYS.PAYOUTS);
    const rawAuditLogs = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    const rawAdminNotifs = localStorage.getItem(STORAGE_KEYS.ADMIN_NOTIFICATIONS);
    const rawPlatformSettings = localStorage.getItem(STORAGE_KEYS.PLATFORM_SETTINGS);
    const rawSeq = localStorage.getItem(STORAGE_KEYS.REF_SEQ);

    if (rawUsers && rawGroups && rawMembers && rawContributions && rawTransactions) {
      let users: User[] = JSON.parse(rawUsers).map((u: User) => ({
        ...u,
        status: u.status || 'ACTIVE',
      }));

      // Ensure Demo Super Admin account exists in users list
      if (!users.some((u) => u.role === 'SUPER_ADMIN')) {
        const adminDemo = demo.users.find((u) => u.role === 'SUPER_ADMIN')!;
        users = [...users, adminDemo];
      }

      const groups: Group[] = JSON.parse(rawGroups).map((g: Group) => ({
        ...g,
        status: g.status || 'ACTIVE',
      }));
      const groupMembers: GroupMember[] = JSON.parse(rawMembers);
      const rawContribs: Contribution[] = JSON.parse(rawContributions);
      const transactions: TransactionRecord[] = JSON.parse(rawTransactions).map(
        (t: TransactionRecord) => ({
          ...t,
          paymentMethod: t.paymentMethod || 'Card / Bank Transfer (Test)',
          provider: t.provider || 'MOCK',
        })
      );
      const existingReminders: ReminderRecord[] = rawReminders
        ? JSON.parse(rawReminders)
        : [];
      const reminderSettings: ReminderSettings = rawSettings
        ? JSON.parse(rawSettings)
        : demo.reminderSettings;

      const contributions = recalculateContributions(rawContribs, todayYmd);
      const reminders = syncAutomatedReminders(
        contributions,
        users,
        existingReminders,
        reminderSettings,
        todayYmd
      );

      const payouts: PayoutRecord[] = rawPayouts
        ? JSON.parse(rawPayouts)
        : demo.payouts;
      const auditLogs: AuditLogRecord[] = rawAuditLogs
        ? JSON.parse(rawAuditLogs)
        : demo.auditLogs;
      const adminNotifications: AdminNotificationRecord[] = rawAdminNotifs
        ? JSON.parse(rawAdminNotifs)
        : demo.adminNotifications;
      const platformSettings: PlatformSettings = rawPlatformSettings
        ? JSON.parse(rawPlatformSettings)
        : demo.platformSettings;

      const loaded: AjoState = {
        users,
        groups,
        groupMembers,
        contributions,
        transactions,
        reminders,
        reminderSettings,
        payouts,
        auditLogs,
        adminNotifications,
        platformSettings,
        refSeq: rawSeq ? Number(rawSeq) : 7,
      };
      saveAjoState(loaded);
      return loaded;
    }
  } catch (err) {
    console.error('Error reading localStorage, seeding initial V3 state:', err);
  }

  saveAjoState(demo);
  return demo;
}

export function saveAjoState(state: AjoState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SCHEMA_VERSION, 'v3');
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(state.groups));
    localStorage.setItem(
      STORAGE_KEYS.GROUP_MEMBERS,
      JSON.stringify(state.groupMembers)
    );
    localStorage.setItem(
      STORAGE_KEYS.CONTRIBUTIONS,
      JSON.stringify(state.contributions)
    );
    localStorage.setItem(
      STORAGE_KEYS.TRANSACTIONS,
      JSON.stringify(state.transactions)
    );
    localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(state.reminders));
    localStorage.setItem(
      STORAGE_KEYS.REMINDER_SETTINGS,
      JSON.stringify(state.reminderSettings)
    );
    localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(state.payouts));
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(state.auditLogs));
    localStorage.setItem(
      STORAGE_KEYS.ADMIN_NOTIFICATIONS,
      JSON.stringify(state.adminNotifications)
    );
    localStorage.setItem(
      STORAGE_KEYS.PLATFORM_SETTINGS,
      JSON.stringify(state.platformSettings)
    );
    localStorage.setItem(STORAGE_KEYS.REF_SEQ, String(state.refSeq));
  } catch (err) {
    console.error('Error saving to localStorage:', err);
  }
}

export function getStoredUserId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
  } catch {
    return null;
  }
}

export function setStoredUserId(userId: string | null): void {
  try {
    if (userId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, userId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
    }
  } catch {
    // ignore
  }
}

export function generateUnique6DigitCode(existingGroups: Group[]): string {
  const used = new Set(existingGroups.map((g) => g.accessCode));
  for (let i = 0; i < 100; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!used.has(code)) return code;
  }
  return String(Date.now()).slice(-6);
}
