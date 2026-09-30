import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  UserCog,
  FolderKanban,
  Calendar,
  ArrowLeftRight,
  BarChart3,
  Wallet,
  AlertTriangle,
  Bell,
  FileSpreadsheet,
  ClipboardList,
  Settings,
  LogOut,
  Search,
  Menu,
  X,
  Eye,
  Edit3,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import {
  User,
  Group,
  Contribution,
  ContributionStatus,
  formatNaira,
  formatReadableDate,
  calculateDaysLate,
} from '../../types/ajo';
import { AjoState, getTodayYmd, createAuditEntry } from '../../services/storage';
import { renderStatusBadge } from '../v2/V2Screens';
import {
  AdminPayoutsSection,
  AdminNotificationsSection,
  AdminReportsSection,
  AdminAuditLogsSection,
  AdminSettingsAndDevSection,
} from './AdminSubViews';
import {
  AdminUserDetailsModal,
  AdminEditUserModal,
  AdminGroupDetailsModal,
  AdminContributionDetailsModal,
} from './AdminDetailModals';

export type AdminTab =
  | 'DASHBOARD'
  | 'USERS'
  | 'ORGANIZERS'
  | 'MEMBERS'
  | 'GROUPS'
  | 'CONTRIBUTIONS'
  | 'TRANSACTIONS'
  | 'PAYMENTS'
  | 'PAYOUTS'
  | 'LATE_CONTRIBUTIONS'
  | 'NOTIFICATIONS'
  | 'REPORTS'
  | 'AUDIT_LOGS'
  | 'SETTINGS';

interface SuperAdminControlCenterProps {
  adminUser: User;
  state: AjoState;
  setState: React.Dispatch<React.SetStateAction<AjoState>>;
  notify: (text: string, type?: 'success' | 'error' | 'info') => void;
  onLogoutAdmin: () => void;
  onSwitchToPublicApp: () => void;
}

export const SuperAdminControlCenter: React.FC<SuperAdminControlCenterProps> = ({
  adminUser,
  state,
  setState,
  notify,
  onLogoutAdmin,
  onSwitchToPublicApp,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('DASHBOARD');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [notifBellOpen, setNotifBellOpen] = useState(false);

  // Inspection & Edit Modals
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingGroup, setViewingGroup] = useState<Group | null>(null);
  const [viewingContribution, setViewingContribution] =
    useState<Contribution | null>(null);

  // Section Filters
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('ALL');

  const [contribStatusFilter, setContribStatusFilter] = useState<string>('ALL');
  const [contribGroupFilter, setContribGroupFilter] = useState<string>('ALL');
  const [contribMemberFilter, setContribMemberFilter] = useState<string>('ALL');
  const [contribDateFilter, setContribDateFilter] = useState<string>('');
  const [contribOrganizerFilter, setContribOrganizerFilter] =
    useState<string>('ALL');

  const [txnSearch, setTxnSearch] = useState<string>('');
  const [txnStatusFilter, setTxnStatusFilter] = useState<string>('ALL');

  const [lateGroupFilter, setLateGroupFilter] = useState<string>('ALL');
  const [lateOrganizerFilter, setLateOrganizerFilter] = useState<string>('ALL');
  const [lateDateFilter, setLateDateFilter] = useState<string>('');
  const [lateMinAmount, setLateMinAmount] = useState<string>('');

  const todayYmd = getTodayYmd();

  const logAdminAction = (action: string, description: string) => {
    const entry = createAuditEntry(action, adminUser, description);
    setState((prev) => ({
      ...prev,
      auditLogs: [entry, ...prev.auditLogs],
    }));
  };

  // User Suspend / Reactivate (Prevent Super Admin from suspending self)
  const handleToggleUserStatus = (target: User) => {
    if (target.id === adminUser.id) {
      notify(
        'Security Rule: You cannot suspend your own active Super Admin account.',
        'error'
      );
      return;
    }
    const nextStatus =
      (target.status || 'ACTIVE') === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === target.id ? { ...u, status: nextStatus } : u
      ),
      auditLogs: [
        createAuditEntry(
          nextStatus === 'SUSPENDED'
            ? 'Admin suspended user'
            : 'Admin reactivated user',
          adminUser,
          `${nextStatus === 'SUSPENDED' ? 'Suspended' : 'Reactivated'} ${target.fullName} (${target.role}).`
        ),
        ...prev.auditLogs,
      ],
    }));
    notify(
      `${target.fullName} is now ${nextStatus}.`,
      nextStatus === 'ACTIVE' ? 'success' : 'info'
    );
  };

  // Group Suspend / Reactivate
  const handleToggleGroupStatus = (group: Group) => {
    const nextStatus =
      (group.status || 'ACTIVE') === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === group.id ? { ...g, status: nextStatus } : g
      ),
      auditLogs: [
        createAuditEntry(
          nextStatus === 'SUSPENDED'
            ? 'Admin suspended group'
            : 'Admin reactivated group',
          adminUser,
          `${nextStatus === 'SUSPENDED' ? 'Suspended' : 'Reactivated'} group "${group.name}" (${group.accessCode}).`
        ),
        ...prev.auditLogs,
      ],
    }));
    notify(`Group "${group.name}" marked as ${nextStatus}.`, 'info');
  };

  // Core Platform Metrics (Section 3)
  const totalUsers = state.users.length;
  const totalMembers = state.users.filter((u) => u.role === 'MEMBER').length;
  const totalOrganizers = state.users.filter((u) => u.role === 'ORGANIZER').length;
  const totalGroups = state.groups.length;
  const activeGroups = state.groups.filter(
    (g) => (g.status || 'ACTIVE') === 'ACTIVE'
  ).length;
  const completedGroups = state.groups.filter(
    (g) => g.status === 'COMPLETED'
  ).length;
  const totalContributions = state.contributions.length;
  const successfulPayments = state.transactions.filter(
    (t) => t.status === 'PAID'
  ).length;
  const pendingPayments = state.transactions.filter(
    (t) => t.status === 'PENDING'
  ).length;
  const failedPayments = state.transactions.filter(
    (t) => t.status === 'FAILED'
  ).length;
  const lateContributionsList = state.contributions.filter(
    (c) => c.status === 'LATE' || c.status === 'FAILED'
  );
  const totalContributionVolume = state.contributions
    .filter((c) => c.status === 'PAID')
    .reduce((s, c) => s + c.amount, 0);

  // Global Search Results (Section 18)
  const cleanGlobal = globalSearch.trim().toLowerCase();
  const globalMatchedUsers = cleanGlobal
    ? state.users.filter(
        (u) =>
          u.fullName.toLowerCase().includes(cleanGlobal) ||
          u.email.toLowerCase().includes(cleanGlobal) ||
          u.phone.includes(cleanGlobal)
      )
    : [];
  const globalMatchedGroups = cleanGlobal
    ? state.groups.filter(
        (g) =>
          g.name.toLowerCase().includes(cleanGlobal) ||
          g.accessCode.includes(cleanGlobal) ||
          g.organizerName.toLowerCase().includes(cleanGlobal)
      )
    : [];
  const globalMatchedTxns = cleanGlobal
    ? state.transactions.filter(
        (t) =>
          t.reference.toLowerCase().includes(cleanGlobal) ||
          t.userName.toLowerCase().includes(cleanGlobal) ||
          t.groupName.toLowerCase().includes(cleanGlobal)
      )
    : [];

  const unreadAdminAlerts = state.adminNotifications.filter((n) => !n.isRead).length;

  const sidebarItems: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'USERS', label: 'Users', icon: <Users className="w-4 h-4" /> },
    { id: 'ORGANIZERS', label: 'Organizers', icon: <UserCog className="w-4 h-4" /> },
    { id: 'MEMBERS', label: 'Members', icon: <UserCheck className="w-4 h-4" /> },
    { id: 'GROUPS', label: 'Groups', icon: <FolderKanban className="w-4 h-4" /> },
    {
      id: 'CONTRIBUTIONS',
      label: 'Contributions',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      id: 'TRANSACTIONS',
      label: 'Transactions',
      icon: <ArrowLeftRight className="w-4 h-4" />,
    },
    { id: 'PAYMENTS', label: 'Payments', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'PAYOUTS', label: 'Payouts', icon: <Wallet className="w-4 h-4" /> },
    {
      id: 'LATE_CONTRIBUTIONS',
      label: 'Late Contributions',
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    { id: 'NOTIFICATIONS', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'REPORTS', label: 'Reports', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'AUDIT_LOGS', label: 'Audit Logs', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'SETTINGS', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-slate-950 text-slate-200 border-r border-slate-800 shrink-0">
        <div className="p-5 border-b border-slate-800">
          <p className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">
            SUPER ADMIN
          </p>
          <h1 className="text-base font-bold text-white tracking-tight mt-0.5">
            AJO WOMAN DAILY CONTRIBUTION
          </h1>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === item.id
                  ? 'bg-emerald-600 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1.5">
          <button
            type="button"
            onClick={onSwitchToPublicApp}
            className="w-full px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-900 hover:text-white text-left"
          >
            ← Public App View
          </button>
          <button
            type="button"
            onClick={onLogoutAdmin}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-950/50"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[82vw] bg-slate-950 text-slate-200 flex flex-col h-full p-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <p className="text-[10px] font-mono uppercase text-emerald-400">
                  SUPER ADMIN
                </p>
                <p className="text-sm font-bold text-white">
                  AJO WOMAN DAILY CONTRIBUTION
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 py-3 space-y-1 overflow-y-auto">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
                    activeTab === item.id
                      ? 'bg-emerald-600 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={onLogoutAdmin}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-950/50"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Admin Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700"
              aria-label="Open Admin Menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 font-bold">
                SUPER ADMIN
              </p>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                AJO WOMAN DAILY CONTRIBUTION
              </h2>
            </div>
          </div>

          {/* Global Admin Search (Section 18) */}
          <div className="flex-1 max-w-md relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Global search: user, group, 6-digit code, reference..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 py-2 text-xs text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Admin Notification Bell & Active Admin Identity */}
          <div className="flex items-center gap-3 relative">
            <button
              type="button"
              onClick={() => setNotifBellOpen((o) => !o)}
              className="relative p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
              aria-label="Admin Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadAdminAlerts > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  {unreadAdminAlerts}
                </span>
              )}
            </button>

            {notifBellOpen && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 z-40 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900">
                    Admin Platform Alerts ({state.adminNotifications.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setState((prev) => ({
                        ...prev,
                        adminNotifications: prev.adminNotifications.map((n) => ({
                          ...n,
                          isRead: true,
                        })),
                      }));
                      setNotifBellOpen(false);
                    }}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {state.adminNotifications.map((n) => (
                    <div key={n.id} className="py-2.5 space-y-0.5">
                      <p className="font-semibold text-slate-900">{n.title}</p>
                      <p className="text-slate-600">{n.message}</p>
                      <p className="text-[10px] font-mono text-slate-400">
                        {formatReadableDate(n.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-slate-900 truncate">
                {adminUser.fullName}
              </p>
              <p className="text-[10px] font-mono text-emerald-700 font-semibold">
                {adminUser.role}
              </p>
            </div>
          </div>
        </header>

        {/* Global Search Results Overlay Banner */}
        {cleanGlobal && (
          <div className="mx-4 sm:mx-6 mt-4 bg-white rounded-2xl border-2 border-emerald-600 p-5 shadow-lg space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                Global Search Results for &ldquo;{globalSearch}&rdquo;
              </h3>
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900"
              >
                Close Search
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="font-mono font-bold text-slate-500 uppercase mb-1.5">
                  Users ({globalMatchedUsers.length})
                </p>
                {globalMatchedUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      logAdminAction('Admin viewed user', `Viewed user ${u.fullName}`);
                      setViewingUser(u);
                    }}
                    className="w-full text-left p-2 rounded-xl hover:bg-slate-50 border border-slate-100 mb-1 flex justify-between"
                  >
                    <span className="font-semibold text-slate-900">{u.fullName}</span>
                    <span className="font-mono text-emerald-700">{u.role}</span>
                  </button>
                ))}
              </div>
              <div>
                <p className="font-mono font-bold text-slate-500 uppercase mb-1.5">
                  Groups &amp; Codes ({globalMatchedGroups.length})
                </p>
                {globalMatchedGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      logAdminAction('Admin viewed group', `Viewed group ${g.name}`);
                      setViewingGroup(g);
                    }}
                    className="w-full text-left p-2 rounded-xl hover:bg-slate-50 border border-slate-100 mb-1 flex justify-between"
                  >
                    <span className="font-semibold text-slate-900">{g.name}</span>
                    <span className="font-mono text-slate-700">
                      Code: {g.accessCode}
                    </span>
                  </button>
                ))}
              </div>
              <div>
                <p className="font-mono font-bold text-slate-500 uppercase mb-1.5">
                  Transactions ({globalMatchedTxns.length})
                </p>
                {globalMatchedTxns.map((t) => (
                  <div
                    key={t.id}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-100 mb-1 flex justify-between"
                  >
                    <span className="font-mono font-semibold text-slate-900">
                      {t.reference}
                    </span>
                    <span className="font-mono text-emerald-700">
                      {formatNaira(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active Tab Content */}
        <main className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl w-full mx-auto">
          {/* ==============================================================
              TAB 1: DASHBOARD OVERVIEW (Sections 3, 21, 27)
             ============================================================== */}
          {activeTab === 'DASHBOARD' && (
            <div className="space-y-8">
              {/* Quick Actions Bar (Section 27) */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase font-mono">
                  Quick Actions
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('USERS')}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                  >
                    VIEW USERS
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('GROUPS')}
                    className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold"
                  >
                    VIEW GROUPS
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('TRANSACTIONS')}
                    className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold"
                  >
                    VIEW TRANSACTIONS
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('LATE_CONTRIBUTIONS')}
                    className="px-3.5 py-2 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 text-red-800 text-xs font-semibold"
                  >
                    VIEW LATE CONTRIBUTIONS
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('REPORTS')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                  >
                    VIEW REPORTS
                  </button>
                </div>
              </div>

              {/* 12 Required Admin KPI Cards (Section 3) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <p className="text-xs text-slate-500">Total Users</p>
                  <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {totalUsers}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <p className="text-xs text-slate-500">Total Members</p>
                  <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {totalMembers}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <p className="text-xs text-slate-500">Total Organizers</p>
                  <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {totalOrganizers}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <p className="text-xs text-slate-500">Total Contribution Groups</p>
                  <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {totalGroups}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <p className="text-xs text-slate-500">Active Groups</p>
                  <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
                    {activeGroups}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <p className="text-xs text-slate-500">Completed Groups</p>
                  <p className="text-2xl font-bold text-slate-700 font-mono tabular-nums mt-1">
                    {completedGroups}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <p className="text-xs text-slate-500">Total Contributions</p>
                  <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {totalContributions}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <p className="text-xs text-slate-500">Successful Payments</p>
                  <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
                    {successfulPayments}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <p className="text-xs text-slate-500">Pending Payments</p>
                  <p className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
                    {pendingPayments}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <p className="text-xs text-slate-500">Failed Payments</p>
                  <p className="text-2xl font-bold text-red-700 font-mono tabular-nums mt-1">
                    {failedPayments}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-red-200 bg-red-50/20">
                  <p className="text-xs text-red-700 font-medium">Late Contributions</p>
                  <p className="text-2xl font-bold text-red-700 font-mono tabular-nums mt-1">
                    {lateContributionsList.length}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-emerald-200 bg-emerald-50/30">
                  <p className="text-xs text-emerald-800 font-medium">
                    Total Contribution Volume
                  </p>
                  <p className="text-xl font-bold text-emerald-800 font-mono tabular-nums mt-1">
                    {formatNaira(totalContributionVolume)}
                  </p>
                </div>
              </div>

              {/* Platform Statistics Charts (Section 21 - Driven by real localStorage data) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Platform Contribution &amp; Payment Breakdown
                  </h3>
                  <div className="space-y-3 text-xs">
                    {[
                      {
                        label: 'Paid Contributions',
                        count: state.contributions.filter((c) => c.status === 'PAID')
                          .length,
                        color: 'bg-emerald-600',
                      },
                      {
                        label: 'Due Today',
                        count: state.contributions.filter((c) => c.status === 'DUE')
                          .length,
                        color: 'bg-amber-500',
                      },
                      {
                        label: 'Late / Overdue',
                        count: lateContributionsList.length,
                        color: 'bg-red-600',
                      },
                      {
                        label: 'Upcoming Scheduled',
                        count: state.contributions.filter(
                          (c) => c.status === 'UPCOMING'
                        ).length,
                        color: 'bg-slate-600',
                      },
                    ].map((bar) => {
                      const pct =
                        totalContributions > 0
                          ? Math.round((bar.count / totalContributions) * 100)
                          : 0;
                      return (
                        <div key={bar.label} className="space-y-1">
                          <div className="flex justify-between font-medium">
                            <span>{bar.label}</span>
                            <span className="font-mono">
                              {bar.count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${bar.color}`}
                              style={{ width: `${Math.max(pct, 4)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Users &amp; Groups Composition
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500">Users by Role</span>
                      <p className="font-mono font-bold text-slate-900 mt-1">
                        {totalMembers} Members · {totalOrganizers} Organizers ·{' '}
                        {
                          state.users.filter((u) => u.role === 'SUPER_ADMIN')
                            .length
                        }{' '}
                        Admin
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500">Active Group Volume</span>
                      <p className="font-mono font-bold text-emerald-700 mt-1">
                        {formatNaira(totalContributionVolume)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <p className="font-semibold text-slate-700">Recent Audit Events</p>
                    {state.auditLogs.slice(0, 3).map((l) => (
                      <div
                        key={l.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between"
                      >
                        <span className="font-semibold text-slate-800">
                          {l.action}
                        </span>
                        <span className="font-mono text-slate-500">
                          {l.userName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 2: USERS MANAGEMENT (Section 5)
             ============================================================== */}
          {activeTab === 'USERS' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    ADMIN → USERS ({state.users.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    View, edit, suspend, or reactivate platform accounts.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 bg-white"
                  >
                    <option value="ALL">All Roles</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    <option value="ORGANIZER">ORGANIZER</option>
                    <option value="MEMBER">MEMBER</option>
                  </select>
                  <select
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 bg-white"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                        <th className="py-3.5 px-4">Name</th>
                        <th className="py-3.5 px-4">Email</th>
                        <th className="py-3.5 px-4">Phone</th>
                        <th className="py-3.5 px-4">Role</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Registration Date</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {state.users
                        .filter((u) =>
                          userRoleFilter === 'ALL' ? true : u.role === userRoleFilter
                        )
                        .filter((u) =>
                          userStatusFilter === 'ALL'
                            ? true
                            : (u.status || 'ACTIVE') === userStatusFilter
                        )
                        .map((u) => {
                          const isActive = (u.status || 'ACTIVE') === 'ACTIVE';
                          return (
                            <tr key={u.id} className="hover:bg-slate-50/80">
                              <td className="py-3.5 px-4 font-semibold text-slate-900">
                                {u.fullName}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-600">
                                {u.email}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-600">
                                {u.phone}
                              </td>
                              <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                                {u.role}
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`font-semibold ${
                                    isActive ? 'text-emerald-700' : 'text-red-700'
                                  }`}
                                >
                                  {u.status || 'ACTIVE'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-500">
                                {formatReadableDate(u.createdAt)}
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      logAdminAction(
                                        'Admin viewed user',
                                        `Viewed user details for ${u.fullName}`
                                      );
                                      setViewingUser(u);
                                    }}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold inline-flex items-center gap-1"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>VIEW</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingUser(u)}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold inline-flex items-center gap-1"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>EDIT</span>
                                  </button>
                                  {u.id !== adminUser.id && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleUserStatus(u)}
                                      className={`px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1 ${
                                        isActive
                                          ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                      }`}
                                    >
                                      {isActive ? (
                                        <>
                                          <Ban className="w-3 h-3" />
                                          <span>SUSPEND</span>
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="w-3 h-3" />
                                          <span>REACTIVATE</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 3: ORGANIZER MANAGEMENT (Section 7)
             ============================================================== */}
          {activeTab === 'ORGANIZERS' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  ADMIN → ORGANIZERS
                </h2>
                <p className="text-xs text-slate-500">
                  Monitor group organizers, member reach, and total contribution volume.
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                        <th className="py-3.5 px-4">Organizer Name</th>
                        <th className="py-3.5 px-4">Email</th>
                        <th className="py-3.5 px-4">Phone</th>
                        <th className="py-3.5 px-4">Groups</th>
                        <th className="py-3.5 px-4">Members</th>
                        <th className="py-3.5 px-4 text-right">Contribution Volume</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {state.users
                        .filter((u) => u.role === 'ORGANIZER')
                        .map((o) => {
                          const orgGroups = state.groups.filter(
                            (g) => g.organizerId === o.id
                          );
                          const gIds = new Set(orgGroups.map((g) => g.id));
                          const memCount = state.groupMembers.filter((m) =>
                            gIds.has(m.groupId)
                          ).length;
                          const vol = state.contributions
                            .filter(
                              (c) => gIds.has(c.groupId) && c.status === 'PAID'
                            )
                            .reduce((s, c) => s + c.amount, 0);
                          const isActive = (o.status || 'ACTIVE') === 'ACTIVE';

                          return (
                            <tr key={o.id} className="hover:bg-slate-50/80">
                              <td className="py-3.5 px-4 font-semibold text-slate-900">
                                {o.fullName}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-600">
                                {o.email}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-600">
                                {o.phone}
                              </td>
                              <td className="py-3.5 px-4 font-mono font-bold">
                                {orgGroups.length}
                              </td>
                              <td className="py-3.5 px-4 font-mono font-bold">
                                {memCount}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                                {formatNaira(vol)}
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`font-semibold ${
                                    isActive ? 'text-emerald-700' : 'text-red-700'
                                  }`}
                                >
                                  {o.status || 'ACTIVE'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setViewingUser(o)}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold"
                                  >
                                    VIEW
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUserStatus(o)}
                                    className={`px-2.5 py-1 rounded-lg font-semibold ${
                                      isActive
                                        ? 'bg-red-50 text-red-700'
                                        : 'bg-emerald-50 text-emerald-700'
                                    }`}
                                  >
                                    {isActive ? 'SUSPEND' : 'REACTIVATE'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 4: MEMBER MANAGEMENT (Section 8)
             ============================================================== */}
          {activeTab === 'MEMBERS' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  ADMIN → MEMBERS
                </h2>
                <p className="text-xs text-slate-500">
                  Track all members, their groups, and Paid / Pending / Late metrics.
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                        <th className="py-3.5 px-4">Member Name</th>
                        <th className="py-3.5 px-4">Email</th>
                        <th className="py-3.5 px-4">Phone</th>
                        <th className="py-3.5 px-4">Groups</th>
                        <th className="py-3.5 px-4">Total Contributions</th>
                        <th className="py-3.5 px-4">Paid</th>
                        <th className="py-3.5 px-4">Pending</th>
                        <th className="py-3.5 px-4">Late</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {state.users
                        .filter((u) => u.role === 'MEMBER')
                        .map((m) => {
                          const mGroups = state.groupMembers.filter(
                            (gm) => gm.userId === m.id
                          ).length;
                          const mContribs = state.contributions.filter(
                            (c) => c.userId === m.id
                          );
                          const paid = mContribs.filter(
                            (c) => c.status === 'PAID'
                          ).length;
                          const pending = mContribs.filter(
                            (c) =>
                              c.status === 'DUE' ||
                              c.status === 'PENDING' ||
                              c.status === 'UPCOMING'
                          ).length;
                          const late = mContribs.filter(
                            (c) => c.status === 'LATE' || c.status === 'FAILED'
                          ).length;
                          const isActive = (m.status || 'ACTIVE') === 'ACTIVE';

                          return (
                            <tr key={m.id} className="hover:bg-slate-50/80">
                              <td className="py-3.5 px-4 font-semibold text-slate-900">
                                {m.fullName}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-600">
                                {m.email}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-600">
                                {m.phone}
                              </td>
                              <td className="py-3.5 px-4 font-mono">{mGroups}</td>
                              <td className="py-3.5 px-4 font-mono font-bold">
                                {mContribs.length}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-emerald-700 font-bold">
                                {paid}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-amber-700 font-bold">
                                {pending}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-red-700 font-bold">
                                {late}
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`font-semibold ${
                                    isActive ? 'text-emerald-700' : 'text-red-700'
                                  }`}
                                >
                                  {m.status || 'ACTIVE'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setViewingUser(m)}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold"
                                  >
                                    VIEW
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUserStatus(m)}
                                    className={`px-2.5 py-1 rounded-lg font-semibold ${
                                      isActive
                                        ? 'bg-red-50 text-red-700'
                                        : 'bg-emerald-50 text-emerald-700'
                                    }`}
                                  >
                                    {isActive ? 'SUSPEND' : 'REACTIVATE'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 5: GROUP MANAGEMENT (Section 9)
             ============================================================== */}
          {activeTab === 'GROUPS' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  ADMIN → GROUPS ({state.groups.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Inspect contribution groups, 6-digit access codes, and group statuses.
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                        <th className="py-3.5 px-4">Group Name</th>
                        <th className="py-3.5 px-4">Organizer</th>
                        <th className="py-3.5 px-4">Members</th>
                        <th className="py-3.5 px-4 text-right">Amount</th>
                        <th className="py-3.5 px-4">Frequency</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Created Date</th>
                        <th className="py-3.5 px-4">Access Code</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {state.groups.map((g) => {
                        const memCnt = state.groupMembers.filter(
                          (m) => m.groupId === g.id
                        ).length;
                        const isActive = (g.status || 'ACTIVE') === 'ACTIVE';
                        return (
                          <tr key={g.id} className="hover:bg-slate-50/80">
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              {g.name}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700">
                              {g.organizerName}
                            </td>
                            <td className="py-3.5 px-4 font-mono">
                              {memCnt}/{g.maxMembers}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                              {formatNaira(g.amount)}
                            </td>
                            <td className="py-3.5 px-4">{g.frequency}</td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`font-semibold ${
                                  isActive ? 'text-emerald-700' : 'text-red-700'
                                }`}
                              >
                                {g.status || 'ACTIVE'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-500">
                              {formatReadableDate(g.createdAt)}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                              {g.accessCode}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    logAdminAction(
                                      'Admin viewed group',
                                      `Opened group details for "${g.name}"`
                                    );
                                    setViewingGroup(g);
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold"
                                >
                                  VIEW
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleGroupStatus(g)}
                                  className={`px-2.5 py-1 rounded-lg font-semibold ${
                                    isActive
                                      ? 'bg-red-50 text-red-700'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  {isActive ? 'SUSPEND' : 'REACTIVATE'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 6: CONTRIBUTIONS MANAGEMENT (Section 11)
             ============================================================== */}
          {activeTab === 'CONTRIBUTIONS' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    ADMIN → CONTRIBUTIONS ({state.contributions.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Filter by Status, Group, Member, Date, or Organizer.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <select
                    value={contribStatusFilter}
                    onChange={(e) => setContribStatusFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 bg-white"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="UPCOMING">UPCOMING</option>
                    <option value="DUE">DUE</option>
                    <option value="PAID">PAID</option>
                    <option value="LATE">LATE</option>
                    <option value="FAILED">FAILED</option>
                    <option value="PENDING">PENDING</option>
                  </select>

                  <select
                    value={contribGroupFilter}
                    onChange={(e) => setContribGroupFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 bg-white"
                  >
                    <option value="ALL">All Groups</option>
                    {state.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={contribMemberFilter}
                    onChange={(e) => setContribMemberFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 bg-white"
                  >
                    <option value="ALL">All Members</option>
                    {state.users
                      .filter((u) => u.role === 'MEMBER')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName}
                        </option>
                      ))}
                  </select>

                  <select
                    value={contribOrganizerFilter}
                    onChange={(e) => setContribOrganizerFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 bg-white"
                  >
                    <option value="ALL">All Organizers</option>
                    {state.users
                      .filter((u) => u.role === 'ORGANIZER')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName}
                        </option>
                      ))}
                  </select>

                  <input
                    type="date"
                    value={contribDateFilter}
                    onChange={(e) => setContribDateFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 bg-white"
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                        <th className="py-3.5 px-4">Member</th>
                        <th className="py-3.5 px-4">Group</th>
                        <th className="py-3.5 px-4 text-right">Amount</th>
                        <th className="py-3.5 px-4">Due Date</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Paid Date</th>
                        <th className="py-3.5 px-4">Transaction Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {state.contributions
                        .filter((c) =>
                          contribStatusFilter === 'ALL'
                            ? true
                            : c.status === contribStatusFilter
                        )
                        .filter((c) =>
                          contribGroupFilter === 'ALL'
                            ? true
                            : c.groupId === contribGroupFilter
                        )
                        .filter((c) =>
                          contribMemberFilter === 'ALL'
                            ? true
                            : c.userId === contribMemberFilter
                        )
                        .filter((c) =>
                          contribDateFilter ? c.dueDate === contribDateFilter : true
                        )
                        .filter((c) => {
                          if (contribOrganizerFilter === 'ALL') return true;
                          const grp = state.groups.find((g) => g.id === c.groupId);
                          return grp?.organizerId === contribOrganizerFilter;
                        })
                        .map((c) => (
                          <tr key={c.contributionId} className="hover:bg-slate-50/80">
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              {c.userName}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700">
                              {c.groupName}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                              {formatNaira(c.amount)}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600">
                              {formatReadableDate(c.dueDate)}
                            </td>
                            <td className="py-3.5 px-4">
                              {renderStatusBadge(c.status)}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-500">
                              {c.paidAt ? formatReadableDate(c.paidAt) : '—'}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600">
                              {c.transactionReference || '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 7: TRANSACTIONS (Section 12)
             ============================================================== */}
          {activeTab === 'TRANSACTIONS' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    ADMIN → TRANSACTIONS ({state.transactions.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Read-only audit ledger of mock payment transactions.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <input
                    type="text"
                    value={txnSearch}
                    onChange={(e) => setTxnSearch(e.target.value)}
                    placeholder="Search Reference, Member, Group..."
                    className="rounded-xl border border-slate-200 px-3 py-2 bg-white w-60"
                  />
                  <select
                    value={txnStatusFilter}
                    onChange={(e) => setTxnStatusFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 bg-white"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PAID">SUCCESS</option>
                    <option value="FAILED">FAILED</option>
                    <option value="PENDING">PENDING</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                        <th className="py-3.5 px-4">Transaction Reference</th>
                        <th className="py-3.5 px-4">Member</th>
                        <th className="py-3.5 px-4">Group</th>
                        <th className="py-3.5 px-4 text-right">Amount</th>
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4">Payment Method</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Provider</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {state.transactions
                        .filter((t) =>
                          txnStatusFilter === 'ALL'
                            ? true
                            : t.status === txnStatusFilter
                        )
                        .filter((t) => {
                          const q = txnSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            t.reference.toLowerCase().includes(q) ||
                            t.userName.toLowerCase().includes(q) ||
                            t.groupName.toLowerCase().includes(q)
                          );
                        })
                        .map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50/80">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                              {t.reference}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              {t.userName}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700">
                              {t.groupName}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                              {formatNaira(t.amount)}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-500">
                              {formatReadableDate(t.date)}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              {t.paymentMethod || 'Card / Bank Transfer (Test)'}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold">
                              <span
                                className={
                                  t.status === 'PAID'
                                    ? 'text-emerald-700'
                                    : t.status === 'PENDING'
                                    ? 'text-amber-700'
                                    : 'text-red-700'
                                }
                              >
                                {t.status === 'PAID' ? 'SUCCESS' : t.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-700">
                              {t.provider || 'MOCK'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 8: PAYMENT ANALYTICS (Section 13)
             ============================================================== */}
          {activeTab === 'PAYMENTS' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  ADMIN → PAYMENT ANALYTICS
                </h2>
                <p className="text-xs text-slate-500">
                  Real-time payment distribution and Daily, Weekly, and Monthly
                  collection volume.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500">Total Successful</p>
                  <p className="text-xl font-bold text-emerald-700 font-mono mt-1">
                    {successfulPayments}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500">Total Failed</p>
                  <p className="text-xl font-bold text-red-700 font-mono mt-1">
                    {failedPayments}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500">Total Pending</p>
                  <p className="text-xl font-bold text-amber-700 font-mono mt-1">
                    {pendingPayments}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500">Total Paid Amount</p>
                  <p className="text-lg font-bold text-emerald-700 font-mono mt-1">
                    {formatNaira(
                      state.transactions
                        .filter((t) => t.status === 'PAID')
                        .reduce((s, t) => s + t.amount, 0)
                    )}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500">Total Pending Amount</p>
                  <p className="text-lg font-bold text-amber-700 font-mono mt-1">
                    {formatNaira(
                      state.contributions
                        .filter(
                          (c) =>
                            c.status === 'DUE' ||
                            c.status === 'PENDING' ||
                            c.status === 'UPCOMING'
                        )
                        .reduce((s, c) => s + c.amount, 0)
                    )}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500">Total Failed Amount</p>
                  <p className="text-lg font-bold text-red-700 font-mono mt-1">
                    {formatNaira(
                      state.transactions
                        .filter((t) => t.status === 'FAILED')
                        .reduce((s, t) => s + t.amount, 0)
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
                  <h3 className="font-bold text-slate-900">
                    Payment Status Distribution
                  </h3>
                  {[
                    {
                      label: 'SUCCESS (PAID)',
                      val: successfulPayments,
                      color: 'bg-emerald-600',
                    },
                    {
                      label: 'PENDING',
                      val: pendingPayments,
                      color: 'bg-amber-500',
                    },
                    {
                      label: 'FAILED',
                      val: failedPayments,
                      color: 'bg-red-600',
                    },
                  ].map((item) => {
                    const total = Math.max(state.transactions.length, 1);
                    const pct = Math.round((item.val / total) * 100);
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex justify-between">
                          <span>{item.label}</span>
                          <span className="font-mono font-bold">
                            {item.val} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${item.color}`}
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
                  <h3 className="font-bold text-slate-900">
                    Collection by Frequency (Daily / Weekly / Monthly)
                  </h3>
                  {(['Daily', 'Weekly', 'Monthly'] as const).map((freq) => {
                    const vol = state.contributions
                      .filter((c) => c.frequency === freq && c.status === 'PAID')
                      .reduce((s, c) => s + c.amount, 0);
                    return (
                      <div
                        key={freq}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between"
                      >
                        <span className="font-semibold text-slate-800">
                          {freq} Collection
                        </span>
                        <span className="font-mono font-bold text-emerald-700">
                          {formatNaira(vol)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 9: PAYOUTS (Section 15)
             ============================================================== */}
          {activeTab === 'PAYOUTS' && (
            <AdminPayoutsSection
              adminUser={adminUser}
              state={state}
              setState={setState}
              notify={notify}
              logAdminAction={logAdminAction}
            />
          )}

          {/* ==============================================================
              TAB 10: LATE CONTRIBUTIONS (Section 14)
             ============================================================== */}
          {activeTab === 'LATE_CONTRIBUTIONS' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    ADMIN → LATE CONTRIBUTIONS ({lateContributionsList.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Overdue obligations with Days Late calculation and organizer lookup.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <select
                    value={lateGroupFilter}
                    onChange={(e) => setLateGroupFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 bg-white"
                  >
                    <option value="ALL">All Groups</option>
                    {state.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={lateOrganizerFilter}
                    onChange={(e) => setLateOrganizerFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 bg-white"
                  >
                    <option value="ALL">All Organizers</option>
                    {state.users
                      .filter((u) => u.role === 'ORGANIZER')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName}
                        </option>
                      ))}
                  </select>
                  <input
                    type="date"
                    value={lateDateFilter}
                    onChange={(e) => setLateDateFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 bg-white"
                  />
                  <input
                    type="number"
                    placeholder="Min Amount (₦)"
                    value={lateMinAmount}
                    onChange={(e) => setLateMinAmount(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 bg-white w-36"
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                        <th className="py-3.5 px-4">Member</th>
                        <th className="py-3.5 px-4">Group</th>
                        <th className="py-3.5 px-4">Organizer</th>
                        <th className="py-3.5 px-4 text-right">Amount</th>
                        <th className="py-3.5 px-4">Due Date</th>
                        <th className="py-3.5 px-4">Days Late</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {lateContributionsList
                        .filter((c) =>
                          lateGroupFilter === 'ALL'
                            ? true
                            : c.groupId === lateGroupFilter
                        )
                        .filter((c) => {
                          if (lateOrganizerFilter === 'ALL') return true;
                          const grp = state.groups.find((g) => g.id === c.groupId);
                          return grp?.organizerId === lateOrganizerFilter;
                        })
                        .filter((c) =>
                          lateDateFilter ? c.dueDate === lateDateFilter : true
                        )
                        .filter((c) =>
                          lateMinAmount ? c.amount >= Number(lateMinAmount) : true
                        )
                        .map((c) => {
                          const grp = state.groups.find((g) => g.id === c.groupId);
                          const daysLate = calculateDaysLate(c.dueDate, todayYmd);
                          return (
                            <tr key={c.contributionId} className="hover:bg-slate-50/80">
                              <td className="py-3.5 px-4 font-semibold text-slate-900">
                                {c.userName}
                              </td>
                              <td className="py-3.5 px-4 text-slate-700">
                                {c.groupName}
                              </td>
                              <td className="py-3.5 px-4 text-slate-600">
                                {grp?.organizerName || '—'}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                                {formatNaira(c.amount)}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-600">
                                {formatReadableDate(c.dueDate)}
                              </td>
                              <td className="py-3.5 px-4 font-mono font-bold text-red-700">
                                {daysLate} day(s)
                              </td>
                              <td className="py-3.5 px-4">
                                {renderStatusBadge(c.status)}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => setViewingContribution(c)}
                                  className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold"
                                >
                                  Inspect
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 11: NOTIFICATIONS (Section 16)
             ============================================================== */}
          {activeTab === 'NOTIFICATIONS' && (
            <AdminNotificationsSection
              adminUser={adminUser}
              state={state}
              setState={setState}
              notify={notify}
              logAdminAction={logAdminAction}
            />
          )}

          {/* ==============================================================
              TAB 12: REPORTS (Section 20)
             ============================================================== */}
          {activeTab === 'REPORTS' && (
            <AdminReportsSection
              adminUser={adminUser}
              state={state}
              setState={setState}
              notify={notify}
              logAdminAction={logAdminAction}
            />
          )}

          {/* ==============================================================
              TAB 13: AUDIT LOGS (Section 17)
             ============================================================== */}
          {activeTab === 'AUDIT_LOGS' && (
            <AdminAuditLogsSection
              adminUser={adminUser}
              state={state}
              setState={setState}
              notify={notify}
              logAdminAction={logAdminAction}
            />
          )}

          {/* ==============================================================
              TAB 14: SETTINGS, PROFILE & DEV MODE (Sections 22-25, 33)
             ============================================================== */}
          {activeTab === 'SETTINGS' && (
            <AdminSettingsAndDevSection
              adminUser={adminUser}
              state={state}
              setState={setState}
              notify={notify}
              logAdminAction={logAdminAction}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {viewingUser && (
        <AdminUserDetailsModal
          user={viewingUser}
          state={state}
          onClose={() => setViewingUser(null)}
        />
      )}

      {editingUser && (
        <AdminEditUserModal
          user={editingUser}
          currentAdminId={adminUser.id}
          onClose={() => setEditingUser(null)}
          onSave={(updated) => {
            setState((prev) => ({
              ...prev,
              users: prev.users.map((u) => (u.id === updated.id ? updated : u)),
              auditLogs: [
                createAuditEntry(
                  'Admin edited user',
                  adminUser,
                  `Updated profile/role for ${updated.fullName}.`
                ),
                ...prev.auditLogs,
              ],
            }));
            setEditingUser(null);
            notify(`Updated user ${updated.fullName}.`, 'success');
          }}
        />
      )}

      {viewingGroup && (
        <AdminGroupDetailsModal
          group={viewingGroup}
          state={state}
          onClose={() => setViewingGroup(null)}
        />
      )}

      {viewingContribution && (
        <AdminContributionDetailsModal
          contribution={viewingContribution}
          organizerName={
            state.groups.find((g) => g.id === viewingContribution.groupId)
              ?.organizerName || 'Organizer'
          }
          onClose={() => setViewingContribution(null)}
        />
      )}
    </div>
  );
};
