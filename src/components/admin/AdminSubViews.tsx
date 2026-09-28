import React, { useState } from 'react';
import {
  Download,
  ShieldAlert,
  RotateCcw,
  PlusCircle,
  Trash2,
  Lock,
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
} from 'lucide-react';
import {
  User,
  Group,
  GroupMember,
  TransactionRecord,
  PayoutStatus,
  ContributionFrequency,
  formatNaira,
  formatReadableDate,
  calculateDaysLate,
} from '../../types/ajo';
import {
  AjoState,
  getTodayYmd,
  getInitialDemoState,
  generateUnique6DigitCode,
  generateMemberContributionSchedule,
  createAuditEntry,
} from '../../services/storage';
import { exportRowsToCsv } from './AdminAuthAndHelpers';

interface SubViewProps {
  adminUser: User;
  state: AjoState;
  setState: React.Dispatch<React.SetStateAction<AjoState>>;
  notify: (text: string, type?: 'success' | 'error' | 'info') => void;
  logAdminAction: (action: string, description: string) => void;
}

export const AdminPayoutsSection: React.FC<SubViewProps> = ({
  state,
  setState,
  notify,
  logAdminAction,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | PayoutStatus>('ALL');

  const filtered =
    statusFilter === 'ALL'
      ? state.payouts
      : state.payouts.filter((p) => p.status === statusFilter);

  const updatePayoutStatus = (payoutId: string, nextStatus: PayoutStatus) => {
    const target = state.payouts.find((p) => p.id === payoutId);
    if (!target) return;
    setState((prev) => ({
      ...prev,
      payouts: prev.payouts.map((p) =>
        p.id === payoutId ? { ...p, status: nextStatus } : p
      ),
    }));
    logAdminAction(
      `Admin updated payout status`,
      `Updated simulated payout ${payoutId} (${target.recipientName}) to ${nextStatus}.`
    );
    notify(`Simulated payout marked as ${nextStatus}.`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Simulated Payout Schedule Management
          </h2>
          <p className="text-xs text-slate-500">
            Manual/simulated rotational payouts. Real bank transfers are not active in
            Version 3.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['ALL', 'UPCOMING', 'PROCESSING', 'PAID', 'CANCELLED'] as const).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                {st}
              </button>
            )
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="py-3.5 px-4">Group</th>
                <th className="py-3.5 px-4">Recipient</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4">Scheduled Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Simulated Status Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    {p.groupName}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">{p.recipientName}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {formatNaira(p.amount)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums">
                    {formatReadableDate(p.scheduledDate)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-xs">
                      {p.status === 'PAID' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                      {p.status === 'PROCESSING' && (
                        <Clock className="w-4 h-4 text-amber-600" />
                      )}
                      {p.status === 'UPCOMING' && (
                        <Calendar className="w-4 h-4 text-slate-500" />
                      )}
                      {p.status === 'CANCELLED' && (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span>{p.status}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <select
                      value={p.status}
                      onChange={(e) =>
                        updatePayoutStatus(p.id, e.target.value as PayoutStatus)
                      }
                      className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs bg-white text-slate-800"
                    >
                      <option value="UPCOMING">UPCOMING</option>
                      <option value="PROCESSING">PROCESSING</option>
                      <option value="PAID">PAID</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const AdminNotificationsSection: React.FC<SubViewProps> = ({ state }) => {
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [readFilter, setReadFilter] = useState<'ALL' | 'READ' | 'UNREAD'>('ALL');

  const mapAdminTypeLabel = (r: AjoState['reminders'][0]) => {
    if (r.triggeredBy === 'ORGANIZER_MANUAL') return 'MANUAL';
    if (r.type === 'UPCOMING_REMINDER') return 'UPCOMING';
    if (r.type === 'DUE_TODAY_REMINDER') return 'DUE';
    if (r.type === 'LATE_WARNING') return 'LATE';
    return 'FINAL';
  };

  const filtered = state.reminders.filter((r) => {
    const label = mapAdminTypeLabel(r);
    if (typeFilter !== 'ALL' && label !== typeFilter) return false;
    if (readFilter === 'READ' && !r.isRead) return false;
    if (readFilter === 'UNREAD' && r.isRead) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Platform Notification Monitoring
          </h2>
          <p className="text-xs text-slate-500">
            Monitor all automated and manual reminders dispatched across groups.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-800 font-medium"
          >
            <option value="ALL">All Types</option>
            <option value="UPCOMING">UPCOMING</option>
            <option value="DUE">DUE</option>
            <option value="LATE">LATE</option>
            <option value="FINAL">FINAL</option>
            <option value="MANUAL">MANUAL</option>
          </select>

          <select
            value={readFilter}
            onChange={(e) => setReadFilter(e.target.value as 'ALL' | 'READ' | 'UNREAD')}
            className="rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-800 font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNREAD">UNREAD / SENT</option>
            <option value="READ">READ</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="py-3.5 px-4">Recipient</th>
                <th className="py-3.5 px-4">Notification Type</th>
                <th className="py-3.5 px-4">Message</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                    {r.userName}
                    <div className="text-[11px] font-mono text-slate-500 font-normal">
                      {r.userPhone}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                    {mapAdminTypeLabel(r)}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-md">{r.message}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                    {formatReadableDate(r.sentAt)}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        r.isRead ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {r.isRead ? 'READ' : 'DELIVERED (UNREAD)'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const AdminReportsSection: React.FC<SubViewProps> = ({
  state,
  notify,
  logAdminAction,
}) => {
  const todayYmd = getTodayYmd();

  const reports = [
    {
      id: 'users',
      title: 'User Registration Report',
      description: 'All registered Super Admins, Organizers, and Members.',
      count: state.users.length,
      onExport: () => {
        exportRowsToCsv(
          `ajo_user_registration_report_${todayYmd}.csv`,
          ['User ID', 'Full Name', 'Email', 'Phone', 'Role', 'Status', 'Created At'],
          state.users.map((u) => [
            u.id,
            u.fullName,
            u.email,
            u.phone,
            u.role,
            u.status || 'ACTIVE',
            u.createdAt,
          ])
        );
      },
    },
    {
      id: 'contributions',
      title: 'Contribution Report',
      description: 'Complete schedule of member contributions across all groups.',
      count: state.contributions.length,
      onExport: () => {
        exportRowsToCsv(
          `ajo_contribution_report_${todayYmd}.csv`,
          [
            'Contribution ID',
            'Member',
            'Group',
            'Amount',
            'Due Date',
            'Status',
            'Paid At',
            'Reference',
          ],
          state.contributions.map((c) => [
            c.contributionId,
            c.userName,
            c.groupName,
            c.amount,
            c.dueDate,
            c.status,
            c.paidAt || '',
            c.transactionReference || '',
          ])
        );
      },
    },
    {
      id: 'payments',
      title: 'Payment Report',
      description: 'All mock payment transactions with status and references.',
      count: state.transactions.length,
      onExport: () => {
        exportRowsToCsv(
          `ajo_payment_report_${todayYmd}.csv`,
          ['Reference', 'Member', 'Group', 'Amount', 'Status', 'Provider', 'Date'],
          state.transactions.map((t) => [
            t.reference,
            t.userName,
            t.groupName,
            t.amount,
            t.status === 'PAID' ? 'SUCCESS' : t.status,
            t.provider || 'MOCK',
            t.date,
          ])
        );
      },
    },
    {
      id: 'late',
      title: 'Late Contribution Report',
      description: 'All overdue/late contributions with days late calculation.',
      count: state.contributions.filter(
        (c) => c.status === 'LATE' || c.status === 'FAILED'
      ).length,
      onExport: () => {
        const lateList = state.contributions.filter(
          (c) => c.status === 'LATE' || c.status === 'FAILED'
        );
        exportRowsToCsv(
          `ajo_late_contributions_report_${todayYmd}.csv`,
          ['Contribution ID', 'Member', 'Group', 'Amount', 'Due Date', 'Days Late', 'Status'],
          lateList.map((c) => [
            c.contributionId,
            c.userName,
            c.groupName,
            c.amount,
            c.dueDate,
            calculateDaysLate(c.dueDate, todayYmd),
            c.status,
          ])
        );
      },
    },
    {
      id: 'groups',
      title: 'Group Report',
      description: 'All contribution groups, access codes, organizers, and statuses.',
      count: state.groups.length,
      onExport: () => {
        exportRowsToCsv(
          `ajo_groups_report_${todayYmd}.csv`,
          [
            'Group ID',
            'Group Name',
            'Organizer',
            'Amount',
            'Frequency',
            'Access Code',
            'Status',
            'Start Date',
          ],
          state.groups.map((g) => [
            g.id,
            g.name,
            g.organizerName,
            g.amount,
            g.frequency,
            g.accessCode,
            g.status || 'ACTIVE',
            g.startDate,
          ])
        );
      },
    },
    {
      id: 'organizers',
      title: 'Organizer Report',
      description: 'All organizers with group counts and contribution volume.',
      count: state.users.filter((u) => u.role === 'ORGANIZER').length,
      onExport: () => {
        const orgs = state.users.filter((u) => u.role === 'ORGANIZER');
        exportRowsToCsv(
          `ajo_organizers_report_${todayYmd}.csv`,
          ['Organizer Name', 'Email', 'Phone', 'Groups Created', 'Status'],
          orgs.map((o) => [
            o.fullName,
            o.email,
            o.phone,
            state.groups.filter((g) => g.organizerId === o.id).length,
            o.status || 'ACTIVE',
          ])
        );
      },
    },
    {
      id: 'payouts',
      title: 'Payout Report',
      description: 'Simulated rotational payouts across groups.',
      count: state.payouts.length,
      onExport: () => {
        exportRowsToCsv(
          `ajo_payout_report_${todayYmd}.csv`,
          ['Payout ID', 'Group', 'Recipient', 'Amount', 'Scheduled Date', 'Status'],
          state.payouts.map((p) => [
            p.id,
            p.groupName,
            p.recipientName,
            p.amount,
            p.scheduledDate,
            p.status,
          ])
        );
      },
    },
    {
      id: 'notifications',
      title: 'Notification Report',
      description: 'All automated and manual payment reminders sent.',
      count: state.reminders.length,
      onExport: () => {
        exportRowsToCsv(
          `ajo_notification_report_${todayYmd}.csv`,
          ['Reminder ID', 'Recipient', 'Group', 'Type', 'Due Date', 'Sent At', 'Read'],
          state.reminders.map((r) => [
            r.id,
            r.userName,
            r.groupName,
            r.type,
            r.dueDate,
            r.sentAt,
            r.isRead ? 'YES' : 'NO',
          ])
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          Platform Reports &amp; CSV Export
        </h2>
        <p className="text-xs text-slate-500">
          Download real localStorage platform records as CSV spreadsheets.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((rep) => (
          <div
            key={rep.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between gap-4"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">{rep.title}</h3>
                <span className="font-mono text-xs font-semibold text-emerald-700">
                  {rep.count} records
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{rep.description}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                rep.onExport();
                logAdminAction('Admin exported report', `Exported ${rep.title} (CSV).`);
                notify(`Downloaded ${rep.title} CSV.`, 'success');
              }}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AdminAuditLogsSection: React.FC<SubViewProps> = ({ state }) => {
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const filtered =
    roleFilter === 'ALL'
      ? state.auditLogs
      : state.auditLogs.filter((l) => l.userRole === roleFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">System &amp; Admin Audit Logs</h2>
          <p className="text-xs text-slate-500">
            Immutable chronological trail of administrative, organizer, and member events.
          </p>
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white text-slate-800 font-medium"
        >
          <option value="ALL">All Roles</option>
          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          <option value="ORGANIZER">ORGANIZER</option>
          <option value="MEMBER">MEMBER</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="py-3.5 px-4">Date / Time</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('en-NG')}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                    {log.userName}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-emerald-700 font-semibold whitespace-nowrap">
                    {log.userRole}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const AdminSettingsAndDevSection: React.FC<SubViewProps> = ({
  adminUser,
  state,
  setState,
  notify,
  logAdminAction,
}) => {
  const [adminName, setAdminName] = useState(adminUser.fullName);
  const [adminEmail, setAdminEmail] = useState(adminUser.email);
  const [adminPassword, setAdminPassword] = useState(adminUser.password);

  const handleSaveAdminProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === adminUser.id
          ? {
              ...u,
              fullName: adminName.trim(),
              email: adminEmail.trim().toLowerCase(),
              password: adminPassword,
            }
          : u
      ),
    }));
    logAdminAction('Admin updated profile', `Updated Super Admin profile (${adminEmail}).`);
    notify('Super Admin profile updated.', 'success');
  };

  // Development Mode Generators (Section 33)
  const handleDevGenerateDemoUsers = () => {
    const stamp = Date.now().toString().slice(-4);
    const newOrg: User = {
      id: `usr-org-dev-${stamp}`,
      fullName: `Chief Adewale Soyinka (${stamp})`,
      phone: `0803999${stamp}`,
      email: `adewale.${stamp}@ajodaily.ng`,
      password: 'password123',
      role: 'ORGANIZER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    const newMem: User = {
      id: `usr-mem-dev-${stamp}`,
      fullName: `Zainab Bello (${stamp})`,
      phone: `0805888${stamp}`,
      email: `zainab.${stamp}@ajodaily.ng`,
      password: 'password123',
      role: 'MEMBER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      users: [...prev.users, newOrg, newMem],
      auditLogs: [
        createAuditEntry(
          'Dev Mode: Generated demo users',
          adminUser,
          `Generated ${newOrg.fullName} (ORGANIZER) and ${newMem.fullName} (MEMBER).`
        ),
        ...prev.auditLogs,
      ],
    }));
    notify('Generated 2 new demo users (1 Organizer, 1 Member).', 'success');
  };

  const handleDevGenerateDemoGroup = () => {
    const stamp = Date.now().toString().slice(-4);
    const code = generateUnique6DigitCode(state.groups);
    const todayYmd = getTodayYmd();
    const newGrp: Group = {
      id: `grp-dev-${stamp}`,
      name: `Lagos Tech Weekly Esusu ${stamp}`,
      description: 'Generated demo weekly savings group for testing.',
      organizerId: 'usr-org-1',
      organizerName: 'Alhaja Kudirat Balogun',
      amount: 10000,
      frequency: 'Weekly',
      startDate: todayYmd,
      maxMembers: 12,
      accessCode: code,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    const memUser = state.users.find((u) => u.role === 'MEMBER') || state.users[1];
    const newGm: GroupMember = {
      id: `gm-dev-${stamp}`,
      groupId: newGrp.id,
      userId: memUser.id,
      userName: memUser.fullName,
      userPhone: memUser.phone,
      userEmail: memUser.email,
      joinedAt: new Date().toISOString(),
    };
    const sched = generateMemberContributionSchedule(
      newGrp,
      { userId: memUser.id, userName: memUser.fullName },
      5,
      todayYmd
    );

    setState((prev) => ({
      ...prev,
      groups: [newGrp, ...prev.groups],
      groupMembers: [...prev.groupMembers, newGm],
      contributions: [...prev.contributions, ...sched],
      auditLogs: [
        createAuditEntry(
          'Dev Mode: Generated demo group',
          adminUser,
          `Generated group "${newGrp.name}" (Code: ${code}).`
        ),
        ...prev.auditLogs,
      ],
    }));
    notify(`Generated demo group "${newGrp.name}" (Code: ${code}).`, 'success');
  };

  const handleDevGenerateDemoTransaction = () => {
    const reference = `AJO-TEST-${String(state.refSeq).padStart(6, '0')}`;
    const grp = state.groups[0];
    const mem = state.users.find((u) => u.role === 'MEMBER') || state.users[1];
    const txn: TransactionRecord = {
      id: `txn-dev-${Date.now()}`,
      reference,
      groupId: grp.id,
      groupName: grp.name,
      userId: mem.id,
      userName: mem.fullName,
      amount: grp.amount,
      paymentMethod: 'Simulated Dev Transfer',
      provider: 'MOCK',
      status: 'PAID',
      date: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      refSeq: prev.refSeq + 1,
      transactions: [txn, ...prev.transactions],
      auditLogs: [
        createAuditEntry(
          'Dev Mode: Generated demo transaction',
          adminUser,
          `Generated test transaction ${reference} (${formatNaira(grp.amount)}).`
        ),
        ...prev.auditLogs,
      ],
    }));
    notify(`Generated test transaction ${reference}.`, 'success');
  };

  const handleDevClearNotifications = () => {
    setState((prev) => ({
      ...prev,
      reminders: [],
      adminNotifications: [],
      auditLogs: [
        createAuditEntry(
          'Dev Mode: Cleared test notifications',
          adminUser,
          'Cleared in-app reminders and admin notifications.'
        ),
        ...prev.auditLogs,
      ],
    }));
    notify('Cleared all test notifications.', 'info');
  };

  const handleDevResetTestPayments = () => {
    const todayYmd = getTodayYmd();
    setState((prev) => ({
      ...prev,
      transactions: [],
      contributions: prev.contributions.map((c) => ({
        ...c,
        paidAt: null,
        transactionReference: null,
        lastReference: undefined,
        status:
          c.dueDate > todayYmd
            ? 'UPCOMING'
            : c.dueDate === todayYmd
            ? 'DUE'
            : 'LATE',
      })),
      auditLogs: [
        createAuditEntry(
          'Dev Mode: Reset test payments',
          adminUser,
          'Cleared test transactions and recalculated contribution schedule statuses.'
        ),
        ...prev.auditLogs,
      ],
    }));
    notify('All test payments reset to unpaid schedule states.', 'info');
  };

  return (
    <div className="space-y-8">
      {/* 1. Platform & Contribution Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            Platform &amp; Contribution Settings
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Platform Name
              </label>
              <input
                type="text"
                value={state.platformSettings.platformName}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      platformName: e.target.value,
                    },
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Default Frequency
                </label>
                <select
                  value={state.platformSettings.defaultContributionFrequency}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      platformSettings: {
                        ...prev.platformSettings,
                        defaultContributionFrequency: e.target
                          .value as ContributionFrequency,
                      },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-900"
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Min Contribution (₦)
                </label>
                <input
                  type="number"
                  value={state.platformSettings.minContributionAmount}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      platformSettings: {
                        ...prev.platformSettings,
                        minContributionAmount: Number(e.target.value) || 500,
                      },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-slate-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Payment Settings (Section 23) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-700" />
              <span>Payment Settings</span>
            </h3>
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-mono text-xs font-bold">
              TEST MODE
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Current Payment Provider</span>
              <span className="font-mono font-bold text-slate-900">MOCK PAYMENT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Paystack Status</span>
              <span className="font-semibold text-amber-800">
                Paystack integration is not enabled.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl border-2 border-emerald-600 bg-emerald-50/50">
              <p className="font-mono font-bold text-emerald-950">MOCK (ACTIVE)</p>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Simulated test payments without real money.
              </p>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 opacity-60">
              <p className="font-mono font-bold text-slate-700">PAYSTACK (V4 READY)</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Reserved for Version 4 upgrade. No keys required.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Security Settings & Admin Profile (Sections 24 & 25) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-700" />
            <span>Security Settings</span>
          </h3>
          <div className="space-y-2.5 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between py-1 border-b border-slate-200/70">
              <span className="text-slate-500">Admin Session</span>
              <span className="font-mono font-semibold text-emerald-700">
                AUTHENTICATED (LOCAL)
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/70">
              <span className="text-slate-500">Admin Role</span>
              <span className="font-mono font-bold text-slate-900">
                {adminUser.role}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/70">
              <span className="text-slate-500">Last Login</span>
              <span className="font-mono text-slate-800">
                {formatReadableDate(adminUser.lastLoginAt || new Date().toISOString())}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Account Status</span>
              <span className="font-semibold text-emerald-700">
                {adminUser.status || 'ACTIVE'}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Architecture prepared for Two-Factor Authentication (2FA), backend JWT
            sessions, and server-side audit enforcement in Version 6.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900">Super Admin Profile</h3>
          <form onSubmit={handleSaveAdminProfile} className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Change Password
              </label>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
            <button
              type="submit"
              className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
            >
              Save Admin Profile
            </button>
          </form>
        </div>
      </div>

      {/* 4. DEVELOPMENT MODE (Section 33) */}
      <div className="bg-amber-50/70 rounded-2xl border-2 border-amber-300 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-amber-950 uppercase font-mono">
              DEVELOPMENT MODE — TEST &amp; SIMULATION CONTROLS ONLY
            </h3>
            <p className="text-xs text-amber-900 mt-0.5">
              These controls are restricted to local development/MVP testing. Super
              Admins cannot manually fabricate production payment records outside the
              payment simulator.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <button
            type="button"
            onClick={() => {
              const fresh = getInitialDemoState();
              setState(fresh);
              notify('Demo data reset to clean Version 3 defaults.', 'info');
            }}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-semibold flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>

          <button
            type="button"
            onClick={handleDevGenerateDemoUsers}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-semibold flex items-center justify-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Generate Demo Users</span>
          </button>

          <button
            type="button"
            onClick={handleDevGenerateDemoGroup}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-semibold flex items-center justify-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Generate Demo Groups</span>
          </button>

          <button
            type="button"
            onClick={handleDevGenerateDemoTransaction}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-semibold flex items-center justify-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Generate Demo Transactions</span>
          </button>

          <button
            type="button"
            onClick={handleDevClearNotifications}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-semibold flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Test Notifications</span>
          </button>

          <button
            type="button"
            onClick={handleDevResetTestPayments}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-semibold flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Test Payments</span>
          </button>
        </div>
      </div>
    </div>
  );
};
