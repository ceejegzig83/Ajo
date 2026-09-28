import React, { useState } from 'react';
import { X, Users, FolderKanban, ShieldAlert } from 'lucide-react';
import {
  User,
  UserRole,
  Group,
  Contribution,
  formatNaira,
  formatReadableDate,
  calculateDaysLate,
} from '../../types/ajo';
import { AjoState, getTodayYmd } from '../../services/storage';
import { renderStatusBadge } from '../v2/V2Screens';

interface UserDetailsModalProps {
  user: User;
  state: AjoState;
  onClose: () => void;
}

export const AdminUserDetailsModal: React.FC<UserDetailsModalProps> = ({
  user,
  state,
  onClose,
}) => {
  const userMemberships = state.groupMembers.filter((m) => m.userId === user.id);
  const memberGroups = state.groups.filter((g) =>
    userMemberships.some((m) => m.groupId === g.id)
  );
  const organizerGroups = state.groups.filter((g) => g.organizerId === user.id);
  const organizerGroupIds = new Set(organizerGroups.map((g) => g.id));
  const organizerMembersCount = state.groupMembers.filter((m) =>
    organizerGroupIds.has(m.groupId)
  ).length;
  const organizerVolume = state.contributions
    .filter((c) => organizerGroupIds.has(c.groupId) && c.status === 'PAID')
    .reduce((s, c) => s + c.amount, 0);

  const userContributions = state.contributions.filter((c) => c.userId === user.id);
  const userPayments = state.transactions.filter((t) => t.userId === user.id);
  const userNotifications = state.reminders.filter((r) => r.userId === user.id);
  const userActivity = state.auditLogs.filter((a) => a.userId === user.id);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-mono uppercase text-emerald-700 font-semibold">
              ADMIN → USER DETAILS
            </p>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">{user.fullName}</h2>
            <p className="text-xs text-slate-500 font-mono">
              {user.email} · {user.phone}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Basic Profile Metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500">Role</span>
            <p className="font-mono font-bold text-slate-900 mt-1">{user.role}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500">Account Status</span>
            <p
              className={`font-bold mt-1 ${
                (user.status || 'ACTIVE') === 'ACTIVE'
                  ? 'text-emerald-700'
                  : 'text-red-700'
              }`}
            >
              {user.status || 'ACTIVE'}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500">Registration Date</span>
            <p className="font-mono font-semibold text-slate-900 mt-1">
              {formatReadableDate(user.createdAt)}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500">Groups Joined</span>
            <p className="font-mono font-bold text-slate-900 mt-1">
              {memberGroups.length}
            </p>
          </div>
        </div>

        {/* Organizer Specific Metrics */}
        {user.role === 'ORGANIZER' && (
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-emerald-800">Groups Created</span>
              <p className="text-lg font-mono font-bold text-emerald-950 mt-0.5">
                {organizerGroups.length}
              </p>
            </div>
            <div>
              <span className="text-emerald-800">Total Members Managed</span>
              <p className="text-lg font-mono font-bold text-emerald-950 mt-0.5">
                {organizerMembersCount}
              </p>
            </div>
            <div>
              <span className="text-emerald-800">Total Contribution Volume</span>
              <p className="text-lg font-mono font-bold text-emerald-950 mt-0.5">
                {formatNaira(organizerVolume)}
              </p>
            </div>
          </div>
        )}

        {/* Groups */}
        <div className="space-y-2 text-xs">
          <h3 className="font-bold text-slate-900">
            Associated Groups ({memberGroups.length + organizerGroups.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {[...organizerGroups, ...memberGroups].map((g) => (
              <span
                key={g.id}
                className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-medium text-slate-800"
              >
                {g.name} ({formatNaira(g.amount)} · Code: {g.accessCode})
              </span>
            ))}
            {organizerGroups.length === 0 && memberGroups.length === 0 && (
              <span className="text-slate-500">No groups associated yet.</span>
            )}
          </div>
        </div>

        {/* Contribution History & Payment History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
            <h4 className="font-bold text-slate-900">
              Contribution History ({userContributions.length})
            </h4>
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
              {userContributions.slice(0, 8).map((c) => (
                <div
                  key={c.contributionId}
                  className="py-2 flex items-center justify-between"
                >
                  <span className="font-mono text-slate-700">
                    {formatReadableDate(c.dueDate)} · {formatNaira(c.amount)}
                  </span>
                  {renderStatusBadge(c.status)}
                </div>
              ))}
              {userContributions.length === 0 && (
                <p className="text-slate-500 py-2">No contributions recorded.</p>
              )}
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
            <h4 className="font-bold text-slate-900">
              Payment History ({userPayments.length})
            </h4>
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
              {userPayments.map((t) => (
                <div key={t.id} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="font-mono font-semibold text-slate-900">
                      {t.reference}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatReadableDate(t.date)}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatNaira(t.amount)} ({t.status})
                  </span>
                </div>
              ))}
              {userPayments.length === 0 && (
                <p className="text-slate-500 py-2">No payment transactions yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Notifications & Activity History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
            <h4 className="font-bold text-slate-900">
              Notifications ({userNotifications.length})
            </h4>
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100">
              {userNotifications.map((r) => (
                <div key={r.id} className="py-2">
                  <p className="font-semibold text-slate-800">{r.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {formatReadableDate(r.sentAt)}
                  </p>
                </div>
              ))}
              {userNotifications.length === 0 && (
                <p className="text-slate-500 py-2">No notifications sent.</p>
              )}
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
            <h4 className="font-bold text-slate-900">
              Activity History ({userActivity.length})
            </h4>
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100">
              {userActivity.map((a) => (
                <div key={a.id} className="py-2">
                  <p className="font-semibold text-slate-800">{a.action}</p>
                  <p className="text-[11px] text-slate-500">{a.description}</p>
                </div>
              ))}
              {userActivity.length === 0 && (
                <p className="text-slate-500 py-2">No audit activity logged.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface EditUserModalProps {
  user: User;
  currentAdminId: string;
  onSave: (updated: User) => void;
  onClose: () => void;
}

export const AdminEditUserModal: React.FC<EditUserModalProps> = ({
  user,
  currentAdminId,
  onSave,
  onClose,
}) => {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [role, setRole] = useState<UserRole>(user.role);
  const isSelfAdmin = user.id === currentAdminId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...user,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role: isSelfAdmin ? 'SUPER_ADMIN' : role,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            Edit User — {user.fullName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl border border-slate-200 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Phone</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Role</label>
            <select
              disabled={isSelfAdmin}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-900 disabled:opacity-60"
            >
              <option value="MEMBER">MEMBER</option>
              <option value="ORGANIZER">ORGANIZER</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
            {isSelfAdmin && (
              <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>You cannot remove your own active SUPER_ADMIN role.</span>
              </p>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface GroupDetailsModalProps {
  group: Group;
  state: AjoState;
  onClose: () => void;
}

export const AdminGroupDetailsModal: React.FC<GroupDetailsModalProps> = ({
  group,
  state,
  onClose,
}) => {
  const members = state.groupMembers.filter((m) => m.groupId === group.id);
  const contribs = state.contributions.filter((c) => c.groupId === group.id);
  const txns = state.transactions.filter((t) => t.groupId === group.id);
  const reminders = state.reminders.filter((r) => r.groupId === group.id);
  const payouts = state.payouts.filter((p) => p.groupId === group.id);

  const paidContribs = contribs.filter((c) => c.status === 'PAID');
  const lateContribs = contribs.filter(
    (c) => c.status === 'LATE' || c.status === 'FAILED'
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-mono uppercase text-emerald-700 font-semibold">
              ADMIN → GROUP DETAILS · ACCESS CODE: {group.accessCode}
            </p>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">{group.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{group.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500">Organizer</span>
            <p className="font-bold text-slate-900 mt-1 truncate">
              {group.organizerName}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500">Contribution</span>
            <p className="font-mono font-bold text-emerald-700 mt-1">
              {formatNaira(group.amount)} ({group.frequency})
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500">Start Date</span>
            <p className="font-mono font-bold text-slate-900 mt-1">
              {formatReadableDate(group.startDate)}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500">Members</span>
            <p className="font-mono font-bold text-slate-900 mt-1">
              {members.length}/{group.maxMembers}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500">Status</span>
            <p className="font-mono font-bold text-emerald-700 mt-1">
              {group.status || 'ACTIVE'}
            </p>
          </div>
        </div>

        {/* Contribution, Payment, and Reminder Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl border border-slate-200 space-y-1">
            <p className="font-bold text-slate-900">Contribution Statistics</p>
            <p className="text-slate-600">
              Total Scheduled: <strong>{contribs.length}</strong> · Paid:{' '}
              <strong className="text-emerald-700">{paidContribs.length}</strong> ·
              Late: <strong className="text-red-700">{lateContribs.length}</strong>
            </p>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 space-y-1">
            <p className="font-bold text-slate-900">Payment Statistics</p>
            <p className="text-slate-600">
              Transactions: <strong>{txns.length}</strong> · Volume Collected:{' '}
              <strong className="font-mono text-emerald-700">
                {formatNaira(
                  txns
                    .filter((t) => t.status === 'PAID')
                    .reduce((s, t) => s + t.amount, 0)
                )}
              </strong>
            </p>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 space-y-1">
            <p className="font-bold text-slate-900">Reminder Statistics</p>
            <p className="text-slate-600">
              Total Dispatched: <strong>{reminders.length}</strong> · Unread:{' '}
              <strong>{reminders.filter((r) => !r.isRead).length}</strong>
            </p>
          </div>
        </div>

        {/* Members & Late Members */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-700" />
              <span>Group Members ({members.length})</span>
            </h4>
            <div className="divide-y divide-slate-100">
              {members.map((m) => (
                <div key={m.id} className="py-2 flex justify-between">
                  <span className="font-semibold text-slate-800">{m.userName}</span>
                  <span className="font-mono text-slate-500">{m.userPhone}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-red-200 bg-red-50/30 rounded-2xl p-4 space-y-2">
            <h4 className="font-bold text-red-900">
              Late Members ({lateContribs.length})
            </h4>
            <div className="divide-y divide-red-100">
              {lateContribs.map((c) => (
                <div key={c.contributionId} className="py-2 flex justify-between">
                  <span className="font-semibold text-slate-900">{c.userName}</span>
                  <span className="font-mono text-red-700">
                    Due {formatReadableDate(c.dueDate)} ({formatNaira(c.amount)})
                  </span>
                </div>
              ))}
              {lateContribs.length === 0 && (
                <p className="text-slate-500 py-2">No late members in this group.</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Transactions & Payout Schedule */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
            <h4 className="font-bold text-slate-900">
              Recent Transactions ({txns.length})
            </h4>
            <div className="divide-y divide-slate-100">
              {txns.slice(0, 5).map((t) => (
                <div key={t.id} className="py-2 flex justify-between">
                  <span className="font-mono text-slate-800">
                    {t.reference} · {t.userName}
                  </span>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatNaira(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <FolderKanban className="w-4 h-4 text-emerald-700" />
              <span>Payout Schedule ({payouts.length})</span>
            </h4>
            <div className="divide-y divide-slate-100">
              {payouts.map((p) => (
                <div key={p.id} className="py-2 flex justify-between">
                  <span className="font-semibold text-slate-800">
                    {p.recipientName} ({formatReadableDate(p.scheduledDate)})
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatNaira(p.amount)} · {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ContributionDetailsModalProps {
  contribution: Contribution;
  organizerName: string;
  onClose: () => void;
}

export const AdminContributionDetailsModal: React.FC<
  ContributionDetailsModalProps
> = ({ contribution, organizerName, onClose }) => {
  const daysLate = calculateDaysLate(contribution.dueDate, getTodayYmd());
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-2xl text-xs">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-base font-bold text-slate-900">Contribution Details</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl border border-slate-200 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex justify-between">
            <span className="text-slate-500">Contribution ID</span>
            <span className="font-mono font-semibold text-slate-900">
              {contribution.contributionId}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Member</span>
            <span className="font-semibold text-slate-900">
              {contribution.userName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Group</span>
            <span className="font-semibold text-slate-900">
              {contribution.groupName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Organizer</span>
            <span className="font-semibold text-slate-900">{organizerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Amount</span>
            <span className="font-mono font-bold text-emerald-700">
              {formatNaira(contribution.amount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Due Date</span>
            <span className="font-mono font-semibold text-slate-900">
              {formatReadableDate(contribution.dueDate)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Days Late</span>
            <span className="font-mono font-bold text-red-700">
              {daysLate} day(s)
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Status</span>
            {renderStatusBadge(contribution.status)}
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Transaction Reference</span>
            <span className="font-mono text-slate-700">
              {contribution.transactionReference || '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
