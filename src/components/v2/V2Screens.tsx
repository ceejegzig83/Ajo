import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Calendar,
  Bell,
  Send,
  ArrowLeft,
  CreditCard,
  CheckCheck,
} from 'lucide-react';
import {
  User,
  Group,
  Contribution,
  ContributionStatus,
  ReminderRecord,
  ReminderChannel,
  formatNaira,
  formatReadableDate,
} from '../../types/ajo';
import { AjoState, buildReminderMessage } from '../../services/storage';

export function renderStatusBadge(
  status: ContributionStatus | 'PAID' | 'PENDING' | 'FAILED' | 'CANCELLED'
) {
  switch (status) {
    case 'PAID':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>PAID</span>
        </span>
      );
    case 'DUE':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
          <Clock className="w-4 h-4 shrink-0 text-amber-600" />
          <span>DUE</span>
        </span>
      );
    case 'UPCOMING':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Calendar className="w-4 h-4 shrink-0 text-slate-500" />
          <span>UPCOMING</span>
        </span>
      );
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
          <Clock className="w-4 h-4 shrink-0 text-amber-600" />
          <span>PENDING</span>
        </span>
      );
    case 'LATE':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>LATE</span>
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
          <XCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>FAILED</span>
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <XCircle className="w-4 h-4 shrink-0 text-slate-400" />
          <span>CANCELLED</span>
        </span>
      );
  }
}

interface MyContributionsProps {
  currentUser: User;
  state: AjoState;
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
  onBack: () => void;
  onPayContribution: (contribution: Contribution) => void;
  onJoinGroup: () => void;
}

export const MyContributionsScreen: React.FC<MyContributionsProps> = ({
  currentUser,
  state,
  selectedGroupId,
  onSelectGroup,
  onBack,
  onPayContribution,
  onJoinGroup,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | ContributionStatus>('ALL');

  const myMemberships = state.groupMembers.filter((m) => m.userId === currentUser.id);
  const myGroupIds = new Set(myMemberships.map((m) => m.groupId));
  const myGroups: Group[] =
    currentUser.role === 'ORGANIZER'
      ? state.groups.filter((g) => g.organizerId === currentUser.id)
      : state.groups.filter((g) => myGroupIds.has(g.id));

  const activeGroup =
    myGroups.find((g) => g.id === selectedGroupId) || myGroups[0] || null;

  const userContributions = state.contributions
    .filter((c) =>
      currentUser.role === 'ORGANIZER'
        ? activeGroup
          ? c.groupId === activeGroup.id
          : true
        : c.userId === currentUser.id && (!activeGroup || c.groupId === activeGroup.id)
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const totalContributions = userContributions.length;
  const paidItems = userContributions.filter((c) => c.status === 'PAID');
  const pendingItems = userContributions.filter(
    (c) => c.status === 'DUE' || c.status === 'PENDING' || c.status === 'UPCOMING'
  );
  const lateItems = userContributions.filter(
    (c) => c.status === 'LATE' || c.status === 'FAILED'
  );

  const nextObligation =
    userContributions.find(
      (c) =>
        c.status === 'LATE' ||
        c.status === 'FAILED' ||
        c.status === 'DUE' ||
        c.status === 'PENDING'
    ) ||
    userContributions.find((c) => c.status === 'UPCOMING') ||
    null;

  const filteredList =
    statusFilter === 'ALL'
      ? userContributions
      : userContributions.filter((c) => c.status === statusFilter);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-900">MY CONTRIBUTIONS</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic contribution schedule, due dates, and real-time payment statuses.
          </p>
        </div>

        {myGroups.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto">
            {myGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelectGroup(g.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${
                  activeGroup?.id === g.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 6 Required Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">Total Contributions</p>
          <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {totalContributions}
          </p>
          <p className="text-[11px] font-mono text-slate-500 mt-0.5 tabular-nums">
            {formatNaira(userContributions.reduce((s, c) => s + c.amount, 0))}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">Total Paid</p>
          <p className="text-xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {paidItems.length}
          </p>
          <p className="text-[11px] font-mono text-emerald-700 mt-0.5 tabular-nums">
            {formatNaira(paidItems.reduce((s, c) => s + c.amount, 0))}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">Total Pending</p>
          <p className="text-xl font-bold text-amber-700 font-mono tabular-nums mt-1">
            {pendingItems.length}
          </p>
          <p className="text-[11px] font-mono text-amber-700 mt-0.5 tabular-nums">
            {formatNaira(pendingItems.reduce((s, c) => s + c.amount, 0))}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">Total Late</p>
          <p className="text-xl font-bold text-red-700 font-mono tabular-nums mt-1">
            {lateItems.length}
          </p>
          <p className="text-[11px] font-mono text-red-700 mt-0.5 tabular-nums">
            {formatNaira(lateItems.reduce((s, c) => s + c.amount, 0))}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">Next Due Date</p>
          <p className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-1.5">
            {nextObligation ? formatReadableDate(nextObligation.dueDate) : 'All Paid'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {nextObligation ? nextObligation.status : 'Completed'}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">Next Amount</p>
          <p className="text-xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {formatNaira(nextObligation?.amount || activeGroup?.amount || 0)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {activeGroup?.frequency || 'Scheduled'}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            ['ALL', 'PAID', 'DUE', 'LATE', 'UPCOMING', 'PENDING', 'FAILED'] as const
          ).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Contribution Schedule List */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <p className="text-sm text-slate-600">
            No contribution records match the selected filter.
          </p>
          {myGroups.length === 0 && (
            <button
              type="button"
              onClick={onJoinGroup}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold"
            >
              Join a Group
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Group</th>
                  {currentUser.role === 'ORGANIZER' && (
                    <th className="py-3.5 px-4">Member</th>
                  )}
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Transaction Ref</th>
                  <th className="py-3.5 px-4">Paid At</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredList.map((c) => (
                  <tr key={c.contributionId} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatReadableDate(c.dueDate)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {c.groupName}
                    </td>
                    {currentUser.role === 'ORGANIZER' && (
                      <td className="py-3.5 px-4 text-slate-700">{c.userName}</td>
                    )}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatNaira(c.amount)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderStatusBadge(c.status)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                      {c.transactionReference || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                      {c.paidAt ? formatReadableDate(c.paidAt) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {c.status !== 'PAID' ? (
                        <button
                          type="button"
                          onClick={() => onPayContribution(c)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Pay</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium text-emerald-700">
                          Completed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

interface RemindersCenterProps {
  currentUser: User;
  state: AjoState;
  setState: React.Dispatch<React.SetStateAction<AjoState>>;
  onBack: () => void;
  onPayContribution: (contribution: Contribution) => void;
  notify: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const RemindersCenterScreen: React.FC<RemindersCenterProps> = ({
  currentUser,
  state,
  setState,
  onBack,
  onPayContribution,
  notify,
}) => {
  const isOrganizer = currentUser.role === 'ORGANIZER';

  const visibleReminders = isOrganizer
    ? state.reminders
    : state.reminders.filter((r) => r.userId === currentUser.id);

  const handleMarkAllRead = () => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) =>
        isOrganizer || r.userId === currentUser.id ? { ...r, isRead: true } : r
      ),
    }));
    notify('All reminders marked as read.', 'info');
  };

  const handleTriggerAllUnpaidReminders = () => {
    const unpaid = state.contributions.filter(
      (c) => c.status === 'LATE' || c.status === 'DUE' || c.status === 'FAILED'
    );
    if (unpaid.length === 0) {
      notify('All due and past contributions are already paid!', 'info');
      return;
    }

    const nowIso = new Date().toISOString();
    const generated: ReminderRecord[] = unpaid.map((c, idx) => {
      const u = state.users.find((usr) => usr.id === c.userId);
      const rType =
        c.status === 'LATE' || c.status === 'FAILED'
          ? 'LATE_WARNING'
          : 'DUE_TODAY_REMINDER';
      const { title, message } = buildReminderMessage(c, rType);
      return {
        id: `rem-manual-${Date.now()}-${idx}`,
        contributionId: c.contributionId,
        userId: c.userId,
        userName: c.userName,
        userPhone: u?.phone || '08000000000',
        userEmail: u?.email || 'member@ajodaily.ng',
        groupId: c.groupId,
        groupName: c.groupName,
        amount: c.amount,
        dueDate: c.dueDate,
        type: rType,
        title,
        message,
        channels: state.reminderSettings.channels,
        sentAt: nowIso,
        isRead: false,
        triggeredBy: 'ORGANIZER_MANUAL',
      };
    });

    setState((prev) => ({
      ...prev,
      reminders: [...generated, ...prev.reminders],
    }));
    notify(
      `Dispatched ${generated.length} firm, respectful payment reminder(s) to unpaid/late members.`,
      'success'
    );
  };

  const toggleChannel = (ch: ReminderChannel) => {
    setState((prev) => {
      const exists = prev.reminderSettings.channels.includes(ch);
      const nextChannels = exists
        ? prev.reminderSettings.channels.filter((x) => x !== ch)
        : [...prev.reminderSettings.channels, ch];
      return {
        ...prev,
        reminderSettings: {
          ...prev.reminderSettings,
          channels: nextChannels.length > 0 ? nextChannels : ['IN_APP'],
        },
      };
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-900">
            Automated Reminders &amp; Notifications
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Firm, respectful payment reminders for Upcoming, Due Today, and Late Ajo
            contributions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isOrganizer && (
            <button
              type="button"
              onClick={handleTriggerAllUnpaidReminders}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Reminders to Due &amp; Late Members</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark All Read</span>
          </button>
        </div>
      </div>

      {/* Organizer Automation Rules Configuration */}
      {isOrganizer && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Automated Reminder Schedule &amp; Delivery Channels
              </h2>
              <p className="text-xs text-slate-500">
                Reminders are automatically generated when contribution due dates are
                upcoming, due today, or late.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
              <span className="font-semibold text-slate-800">
                Upcoming Reminder (Before Due)
              </span>
              <input
                type="checkbox"
                checked={state.reminderSettings.autoRemindUpcoming}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    reminderSettings: {
                      ...prev.reminderSettings,
                      autoRemindUpcoming: e.target.checked,
                    },
                  }))
                }
                className="w-4 h-4 accent-emerald-700"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
              <span className="font-semibold text-slate-800">
                Due Date Reminder (On Due Date)
              </span>
              <input
                type="checkbox"
                checked={state.reminderSettings.autoRemindDueToday}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    reminderSettings: {
                      ...prev.reminderSettings,
                      autoRemindDueToday: e.target.checked,
                    },
                  }))
                }
                className="w-4 h-4 accent-emerald-700"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
              <span className="font-semibold text-slate-800">
                Late Payment Escalation
              </span>
              <input
                type="checkbox"
                checked={state.reminderSettings.autoRemindLate}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    reminderSettings: {
                      ...prev.reminderSettings,
                      autoRemindLate: e.target.checked,
                    },
                  }))
                }
                className="w-4 h-4 accent-emerald-700"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-slate-500 font-medium">Simulated Channels:</span>
            {(['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'] as ReminderChannel[]).map((ch) => {
              const active = state.reminderSettings.channels.includes(ch);
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {ch}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Reminders Feed */}
      <div className="space-y-3">
        {visibleReminders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            No reminders or notifications recorded yet.
          </div>
        ) : (
          visibleReminders.map((r) => {
            const linkedContribution = state.contributions.find(
              (c) => c.contributionId === r.contributionId
            );
            return (
              <div
                key={r.id}
                className={`bg-white rounded-2xl border p-5 space-y-3 ${
                  r.type === 'LATE_WARNING' || r.type === 'PAYMENT_FAILED'
                    ? 'border-red-200'
                    : r.type === 'DUE_TODAY_REMINDER'
                    ? 'border-amber-200'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bell
                      className={`w-4 h-4 shrink-0 ${
                        r.type === 'LATE_WARNING' || r.type === 'PAYMENT_FAILED'
                          ? 'text-red-600'
                          : r.type === 'DUE_TODAY_REMINDER'
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    />
                    <h3 className="text-sm font-bold text-slate-900">{r.title}</h3>
                    {!r.isRead && (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                    {formatReadableDate(r.sentAt)} ·{' '}
                    {r.triggeredBy === 'AUTOMATED_SYSTEM' ? 'Auto' : 'Organizer'}
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">{r.message}</p>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      Recipient: <strong className="text-slate-800">{r.userName}</strong> (
                      {r.userPhone})
                    </span>
                    <span>·</span>
                    <span>
                      Due: <strong className="font-mono">{r.dueDate}</strong>
                    </span>
                    <span>·</span>
                    <span className="font-mono">
                      Channels: {r.channels.join(', ')}
                    </span>
                  </div>

                  {!isOrganizer &&
                    linkedContribution &&
                    linkedContribution.status !== 'PAID' && (
                      <button
                        type="button"
                        onClick={() => onPayContribution(linkedContribution)}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                      >
                        Pay {formatNaira(linkedContribution.amount)} Now →
                      </button>
                    )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
