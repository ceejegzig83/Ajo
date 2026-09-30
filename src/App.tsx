import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Plus,
  Users,
  History,
  User as UserIcon,
  LogOut,
  Copy,
  Check,
  ArrowLeft,
  CreditCard,
  ShieldAlert,
  KeyRound,
  FolderKanban,
  Home as HomeIcon,
  RotateCcw,
  Calendar,
  Bell,
  Send,
} from 'lucide-react';
import {
  User,
  UserRole,
  Group,
  GroupMember,
  Contribution,
  ContributionFrequency,
  ContributionStatus,
  TransactionRecord,
  PaymentStatus,
  ReminderRecord,
  AppScreen,
  formatNaira,
  formatReadableDate,
} from './types/ajo';
import {
  AjoState,
  loadAjoState,
  saveAjoState,
  getInitialDemoState,
  getStoredUserId,
  setStoredUserId,
  generateUnique6DigitCode,
  getTodayYmd,
  generateMemberContributionSchedule,
  buildReminderMessage,
  createAuditEntry,
} from './services/storage';
import { PWAInstallButton, OfflineIndicator } from './components/pwa/PWAInstall';
import {
  MyContributionsScreen,
  RemindersCenterScreen,
  renderStatusBadge,
} from './components/v2/V2Screens';
import {
  isAuthorizedSuperAdmin,
  AdminLoginScreen,
} from './components/admin/AdminAuthAndHelpers';
import { SuperAdminControlCenter } from './components/admin/SuperAdminControlCenter';

export default function App() {
  const [state, setState] = useState<AjoState>(() => loadAjoState());
  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    getStoredUserId()
  );
  const [adminAccessDeniedMsg, setAdminAccessDeniedMsg] = useState<string | null>(
    null
  );

  const checkIsAdminUrl = () => {
    const hash = (window.location.hash || '').toLowerCase();
    const path = (window.location.pathname || '').toLowerCase();
    const href = (window.location.href || '').toLowerCase();
    return (
      hash === '#amind' ||
      hash === '#/amind' ||
      hash.includes('amind') ||
      hash === '#admin' ||
      hash === '#/admin' ||
      path.includes('/amind') ||
      path === '/admin/login' ||
      path === '/admin/dashboard' ||
      href.includes('/#amind')
    );
  };

  const [screen, setScreen] = useState<AppScreen>(() => {
    const uid = getStoredUserId();
    const initial = loadAjoState();
    const found = uid ? initial.users.find((u) => u.id === uid) || null : null;

    if (checkIsAdminUrl()) {
      return isAuthorizedSuperAdmin(found) ? 'ADMIN_DASHBOARD' : 'ADMIN_LOGIN';
    }
    if (!found) return 'HOME';
    if (found.role === 'SUPER_ADMIN') return 'ADMIN_DASHBOARD';
    return found.role === 'ORGANIZER' ? 'ORGANIZER_DASHBOARD' : 'MEMBER_DASHBOARD';
  });

  const [selectedGroupId, setSelectedGroupId] = useState<string>('grp-market-daily');
  const [selectedContributionId, setSelectedContributionId] = useState<string | null>(
    null
  );
  const [bannerMsg, setBannerMsg] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Sync state to localStorage whenever modified
  useEffect(() => {
    saveAjoState(state);
  }, [state]);

  const currentUser = state.users.find((u) => u.id === currentUserId) || null;

  const updateUrlPath = (nextPath: string) => {
    try {
      if (nextPath.startsWith('/#') || nextPath.startsWith('#')) {
        window.location.hash = nextPath.replace(/^\/?#/, '');
      } else {
        window.history.pushState({}, '', nextPath);
      }
    } catch {
      // ignore in restricted iframe history environments
    }
  };

  // Listen for URL hash (/ #amind) or history changes so adding /#amind opens Admin portal
  useEffect(() => {
    const handleLocationChange = () => {
      if (checkIsAdminUrl()) {
        setScreen(
          isAuthorizedSuperAdmin(currentUser) ? 'ADMIN_DASHBOARD' : 'ADMIN_LOGIN'
        );
      }
    };
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, [currentUser]);

  const openAdminRoute = (target: '/admin/login' | '/admin/dashboard') => {
    if (target === '/admin/dashboard') {
      if (!isAuthorizedSuperAdmin(currentUser)) {
        setAdminAccessDeniedMsg(
          'Authentication required: Please sign in with your Super Admin credentials.'
        );
        updateUrlPath('/#amind');
        setScreen('ADMIN_LOGIN');
        return;
      }
      setAdminAccessDeniedMsg(null);
      updateUrlPath('/#amind');
      setScreen('ADMIN_DASHBOARD');
      return;
    }
    setAdminAccessDeniedMsg(null);
    updateUrlPath('/#amind');
    setScreen('ADMIN_LOGIN');
  };

  const notify = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setBannerMsg({ text, type });
    setTimeout(() => {
      setBannerMsg((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const navigateToDashboard = (user: User) => {
    if (user.role === 'SUPER_ADMIN') {
      updateUrlPath('/#amind');
      setScreen('ADMIN_DASHBOARD');
    } else if (user.role === 'ORGANIZER') {
      updateUrlPath('/');
      setScreen('ORGANIZER_DASHBOARD');
    } else {
      updateUrlPath('/');
      setScreen('MEMBER_DASHBOARD');
    }
  };

  const handleLoginUser = (user: User) => {
    if (user.status === 'SUSPENDED') {
      notify('Your account has been suspended by the platform administrator.', 'error');
      return;
    }
    setCurrentUserId(user.id);
    setStoredUserId(user.id);
    navigateToDashboard(user);
    notify(`Welcome back, ${user.fullName}`, 'success');
  };

  const handleAdminLoginSuccess = (adminUser: User) => {
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === adminUser.id ? { ...u, lastLoginAt: nowIso } : u
      ),
      auditLogs: [
        createAuditEntry(
          'Admin logged in',
          adminUser,
          `Super Admin ${adminUser.fullName} signed in via /#amind.`
        ),
        ...prev.auditLogs,
      ],
    }));
    setCurrentUserId(adminUser.id);
    setStoredUserId(adminUser.id);
    setAdminAccessDeniedMsg(null);
    updateUrlPath('/#amind');
    setScreen('ADMIN_DASHBOARD');
    notify(`Authenticated as Super Admin (${adminUser.fullName}).`, 'success');
  };

  const handleLogout = () => {
    setCurrentUserId(null);
    setStoredUserId(null);
    updateUrlPath('/');
    setScreen('HOME');
    notify('You have been logged out.', 'info');
  };

  const handleResetDemoData = () => {
    const fresh = getInitialDemoState();
    setState(fresh);
    saveAjoState(fresh);
    notify('Demo data has been reset to initial defaults.', 'info');
  };

  const handleSendSingleReminder = (c: Contribution) => {
    const u = state.users.find((usr) => usr.id === c.userId);
    const rType =
      c.status === 'LATE' || c.status === 'FAILED'
        ? 'LATE_WARNING'
        : c.status === 'DUE'
        ? 'DUE_TODAY_REMINDER'
        : 'UPCOMING_REMINDER';
    const { title, message } = buildReminderMessage(c, rType);
    const newRem: ReminderRecord = {
      id: `rem-manual-${Date.now()}`,
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
      sentAt: new Date().toISOString(),
      isRead: false,
      triggeredBy: 'ORGANIZER_MANUAL',
    };
    setState((prev) => ({
      ...prev,
      reminders: [newRem, ...prev.reminders],
    }));
    notify(
      `Reminder sent to ${c.userName} for ${formatReadableDate(c.dueDate)} (${formatNaira(c.amount)}).`,
      'success'
    );
  };

  // Helper to render accessible status with icon + text
  const renderStatusIndicator = (
    status:
      | ContributionStatus
      | PaymentStatus
      | 'PAID'
      | 'PENDING'
      | 'FAILED'
      | 'CANCELLED'
  ) => renderStatusBadge(status);

  // ============================================================================
  // SCREEN 1: HOME / WELCOME
  // ============================================================================
  const HomeView = () => {
    const ps = state.platformSettings;
    const activeFeatures = (ps.websiteFeatures || []).filter((f) => f.enabled);
    const activeCustomSections = (ps.customSections || []).filter(
      (s) => s.enabled
    );

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-14">
        {/* Hero Section */}
        <section className="bg-emerald-950 text-white rounded-3xl p-8 sm:p-12 border border-emerald-900 shadow-xl">
          <div className="max-w-2xl space-y-5">
            <p className="text-xs font-mono uppercase tracking-widest text-emerald-300">
              {ps.heroSubtitle || 'Nigerian Digital Savings & Thrift Platform'}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
              {ps.platformName || 'AJO WOMAN DAILY CONTRIBUTION'}
            </h1>
            <p className="text-base sm:text-lg text-emerald-100 leading-relaxed">
              {ps.heroTagline ||
                'Simple, transparent and organized group contributions.'}
            </p>

            <div className="pt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setScreen('LOGIN')}
                className="min-h-[46px] px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap"
              >
                {ps.primaryCtaText || 'LOGIN'}
              </button>
              {ps.allowSelfRegistration !== false && (
                <button
                  type="button"
                  onClick={() => setScreen('REGISTER')}
                  className="min-h-[46px] px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-sm transition-colors whitespace-nowrap"
                >
                  {ps.secondaryCtaText || 'CREATE ACCOUNT'}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Dynamic Website Feature Cards (Editable & Expandable by Admin) */}
        {activeFeatures.length > 0 && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {activeFeatures.map((feat) => (
              <div
                key={feat.id}
                className="bg-white rounded-2xl p-6 border border-slate-200 space-y-2"
              >
                <p className="text-xs font-mono text-emerald-700 font-semibold">
                  {feat.badge}
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  {feat.title}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {feat.description}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* Dynamic Custom Website Sections Added by Admin */}
        {activeCustomSections.length > 0 && (
          <section className="space-y-6">
            {activeCustomSections.map((sec) => (
              <div
                key={sec.id}
                className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 space-y-3"
              >
                <p className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-semibold">
                  {sec.subtitle}
                </p>
                <h2 className="text-xl font-bold text-slate-900">{sec.title}</h2>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {sec.content}
                </p>
                {sec.ctaLabel && sec.ctaTargetScreen && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setScreen(sec.ctaTargetScreen!)}
                      className="min-h-[42px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                    >
                      {sec.ctaLabel} →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Instant Demo Testing Bar (Member & Organizer only; Admin is strictly hidden) */}
        {ps.showPublicDemoAccounts !== false && (
          <section className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Instant Demo Accounts (Pre-seeded for Immediate Testing)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Demo Group: <strong>Market Women Daily Ajo</strong> · Contribution:{' '}
                  <span className="font-mono tabular-nums">₦5,000</span> Daily · Access
                  Code:{' '}
                  <span className="font-mono font-semibold text-slate-800 tabular-nums">
                    583921
                  </span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {state.users
                .filter((u) => u.role !== 'SUPER_ADMIN')
                .slice(0, 3)
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleLoginUser(u)}
                    className="min-h-[48px] p-3.5 rounded-xl border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40 text-left transition-colors flex items-center justify-between"
                  >
                    <div className="truncate pr-2">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {u.fullName}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {u.role} · {u.email}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 shrink-0">
                      Sign In →
                    </span>
                  </button>
                ))}
            </div>
          </section>
        )}
      </div>
    );
  };

  // ============================================================================
  // SCREEN 2: LOGIN
  // ============================================================================
  const LoginView = () => {
    const [email, setEmail] = useState('ngozi@ajodaily.ng');
    const [password, setPassword] = useState('password123');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const cleanEmail = email.trim().toLowerCase();
      const found = state.users.find(
        (u) => u.email.toLowerCase() === cleanEmail && u.password === password
      );
      if (!found) {
        setError('Invalid email or password. Use a demo account below or create an account.');
        return;
      }
      if (found.role === 'SUPER_ADMIN') {
        handleAdminLoginSuccess(found);
        return;
      }
      handleLoginUser(found);
    };

    return (
      <div className="max-w-md mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div>
            <button
              type="button"
              onClick={() => setScreen('HOME')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
            <h1 className="text-xl font-bold text-slate-900">Sign In to Your Account</h1>
            <p className="text-xs text-slate-500 mt-1">
              Access your Member or Organizer dashboard.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[46px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors"
            >
              LOGIN
            </button>
          </form>

          {/* Quick Demo Fillers (Member & Organizer only; Admin email is strictly hidden) */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <p className="text-[11px] font-medium text-slate-500">
              Quick-Fill Demo Accounts (Password: <span className="font-mono">password123</span>):
            </p>
            <div className="grid grid-cols-1 gap-2">
              {state.users
                .filter((u) => u.role !== 'SUPER_ADMIN')
                .slice(0, 3)
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setEmail(u.email);
                      setPassword(u.password);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left text-xs flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-800">
                      {u.fullName} ({u.role})
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">{u.email}</span>
                  </button>
                ))}
            </div>
          </div>

          <p className="text-xs text-center text-slate-600">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => setScreen('REGISTER')}
              className="font-semibold text-emerald-700 hover:underline"
            >
              Create Account
            </button>
          </p>
        </div>
      </div>
    );
  };

  // ============================================================================
  // SCREEN 3: REGISTER
  // ============================================================================
  const RegisterView = () => {
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole>('MEMBER');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const cleanEmail = email.trim().toLowerCase();
      if (!fullName.trim() || !phone.trim() || !cleanEmail || !password) {
        setError('All fields are required.');
        return;
      }
      if (state.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
        setError('An account with this email already exists. Please login instead.');
        return;
      }

      const newUser: User = {
        id: `usr-${Date.now()}`,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: cleanEmail,
        password,
        role,
        createdAt: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        users: [...prev.users, newUser],
      }));

      setCurrentUserId(newUser.id);
      setStoredUserId(newUser.id);
      navigateToDashboard(newUser);
      notify(`Account created! Welcome, ${newUser.fullName}.`, 'success');
    };

    return (
      <div className="max-w-md mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div>
            <button
              type="button"
              onClick={() => setScreen('HOME')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
            <h1 className="text-xl font-bold text-slate-900">Create Your Ajo Account</h1>
            <p className="text-xs text-slate-500 mt-1">
              Choose Member to join contribution groups or Organizer to manage groups.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1.5">
                Select Account Role
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setRole('MEMBER')}
                  className={`min-h-[40px] rounded-lg font-semibold transition-colors ${
                    role === 'MEMBER'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  MEMBER
                </button>
                <button
                  type="button"
                  onClick={() => setRole('ORGANIZER')}
                  className={`min-h-[40px] rounded-lg font-semibold transition-colors ${
                    role === 'ORGANIZER'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ORGANIZER
                </button>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Chidinma Okafor"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 08031234567"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[46px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors"
            >
              CREATE ACCOUNT
            </button>
          </form>

          <p className="text-xs text-center text-slate-600">
            Already registered?{' '}
            <button
              type="button"
              onClick={() => setScreen('LOGIN')}
              className="font-semibold text-emerald-700 hover:underline"
            >
              Login here
            </button>
          </p>
        </div>
      </div>
    );
  };

  // ============================================================================
  // SCREEN 5: ORGANIZER DASHBOARD
  // ============================================================================
  const OrganizerDashboardView = () => {
    if (!currentUser) return null;
    const todayYmd = getTodayYmd();
    const myGroups = state.groups.filter((g) => g.organizerId === currentUser.id);
    const myGroupIds = new Set(myGroups.map((g) => g.id));
    const myMembers = state.groupMembers.filter((m) => myGroupIds.has(m.groupId));
    const myContributions = state.contributions.filter((c) => myGroupIds.has(c.groupId));

    const paidCount = myContributions.filter((c) => c.status === 'PAID').length;
    const pendingCount = myContributions.filter(
      (c) => c.status === 'DUE' || c.status === 'PENDING' || c.status === 'UPCOMING'
    ).length;
    const expectedTotal = myContributions.reduce((sum, c) => sum + c.amount, 0);

    // Version 2: Today's & Late Contribution Monitoring
    const todaysContributions = myContributions.filter((c) => c.dueDate === todayYmd);
    const todaysExpectedTotal = todaysContributions.reduce((s, c) => s + c.amount, 0);
    const todaysPaidList = todaysContributions.filter((c) => c.status === 'PAID');
    const todaysPaidTotal = todaysPaidList.reduce((s, c) => s + c.amount, 0);
    const todaysPendingList = todaysContributions.filter((c) => c.status !== 'PAID');
    const todaysPendingTotal = todaysPendingList.reduce((s, c) => s + c.amount, 0);

    const lateContributions = myContributions.filter(
      (c) => c.status === 'LATE' || c.status === 'FAILED'
    );
    const lateTotal = lateContributions.reduce((s, c) => s + c.amount, 0);

    const attentionRequiredList = myContributions
      .filter(
        (c) =>
          c.status === 'LATE' ||
          c.status === 'FAILED' ||
          c.status === 'DUE' ||
          c.dueDate === todayYmd
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Welcome & Quick Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-mono text-emerald-700 font-semibold">
              ORGANIZER PORTAL · VERSION 2
            </p>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
              Welcome, {currentUser.fullName}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage contribution schedules, today&apos;s expected collections, late
              defaulters, and automated reminders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setScreen('CREATE_GROUP')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>CREATE GROUP</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (myGroups[0]) setSelectedGroupId(myGroups[0].id);
                setScreen('GROUP_DETAILS');
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              VIEW GROUPS
            </button>
            <button
              type="button"
              onClick={() => setScreen('REMINDERS')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5 text-emerald-700" />
              <span>REMINDERS ({state.reminders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setScreen('PAYMENT_HISTORY')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              PAYMENT RECORDS
            </button>
            <button
              type="button"
              onClick={() => setScreen('PROFILE')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              PROFILE
            </button>
          </div>
        </div>

        {/* Overall Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500">Total Groups</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {myGroups.length}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500">Total Members</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {myMembers.length}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500">Expected Contributions</p>
            <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {formatNaira(expectedTotal)}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500">Paid Contributions</p>
            <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
              {paidCount}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 col-span-2 sm:col-span-1">
            <p className="text-xs text-slate-500">Pending Contributions</p>
            <p className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
              {pendingCount}
            </p>
          </div>
        </div>

        {/* Version 2: Organizer Contribution Monitoring (Today + Late) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Today&apos;s Contribution Monitoring ({formatReadableDate(todayYmd)})
            </h2>
            <button
              type="button"
              onClick={() => setScreen('MY_CONTRIBUTIONS')}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              View Full Schedule →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <p className="text-xs text-slate-500">Today&apos;s Expected Contributions</p>
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                {formatNaira(todaysExpectedTotal)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {todaysContributions.length} member schedule(s) due today
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <p className="text-xs text-slate-500">Today&apos;s Paid Contributions</p>
              <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
                {formatNaira(todaysPaidTotal)}
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                {todaysPaidList.length} paid today
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <p className="text-xs text-slate-500">Today&apos;s Pending Contributions</p>
              <p className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
                {formatNaira(todaysPendingTotal)}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                {todaysPendingList.length} awaiting payment today
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-red-200 bg-red-50/30">
              <p className="text-xs text-red-700 font-medium">Late Contributions</p>
              <p className="text-2xl font-bold text-red-700 font-mono tabular-nums mt-1">
                {formatNaira(lateTotal)}
              </p>
              <p className="text-xs text-red-700 mt-1">
                {lateContributions.length} overdue obligation(s)
              </p>
            </div>
          </div>
        </div>

        {/* Today's & Late Member Obligations Table with Instant Reminder Action */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Today&apos;s Due &amp; Overdue Member Contributions
              </h2>
              <p className="text-xs text-slate-500">
                Track who has paid today, who is late, and send firm, respectful payment
                reminders.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setScreen('REMINDERS')}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Manage Automated Reminders</span>
            </button>
          </div>

          {attentionRequiredList.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No due or overdue contributions right now.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Group</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Reminder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {attentionRequiredList.map((c) => (
                    <tr key={c.contributionId} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {c.userName}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{c.groupName}</td>
                      <td className="py-3 px-4 font-mono text-slate-700 tabular-nums">
                        {formatReadableDate(c.dueDate)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatNaira(c.amount)}
                      </td>
                      <td className="py-3 px-4">{renderStatusIndicator(c.status)}</td>
                      <td className="py-3 px-4 text-right">
                        {c.status !== 'PAID' ? (
                          <button
                            type="button"
                            onClick={() => handleSendSingleReminder(c)}
                            className="min-h-[34px] px-3 py-1 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            <Send className="w-3 h-3 text-emerald-700" />
                            <span>Send Reminder</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-medium">
                            Paid ({c.transactionReference || 'Ref'})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Groups List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Your Contribution Groups
            </h2>
          </div>

          {myGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <p className="text-sm text-slate-600">
                You haven&apos;t created any contribution groups yet.
              </p>
              <button
                type="button"
                onClick={() => setScreen('CREATE_GROUP')}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold"
              >
                Create Your First Group
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myGroups.map((g) => {
                const membersCount = state.groupMembers.filter(
                  (m) => m.groupId === g.id
                ).length;
                return (
                  <div
                    key={g.id}
                    className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-900">{g.name}</h3>
                        <span className="font-mono text-sm font-bold text-emerald-700 tabular-nums">
                          {formatNaira(g.amount)} · {g.frequency}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {g.description}
                      </p>
                      <div className="pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>
                          Access Code:{' '}
                          <strong className="font-mono text-slate-900 tabular-nums">
                            {g.accessCode}
                          </strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Members: {membersCount}/{g.maxMembers}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Starts: {g.startDate}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(g.accessCode);
                          notify(`Copied Access Code ${g.accessCode}`, 'success');
                        }}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code ({g.accessCode})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGroupId(g.id);
                          setScreen('GROUP_DETAILS');
                        }}
                        className="min-h-[40px] px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                      >
                        Group Details →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // SCREEN 6: CREATE GROUP
  // ============================================================================
  const CreateGroupView = () => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('5000');
    const [frequency, setFrequency] = useState<ContributionFrequency>('Daily');
    const [startDate, setStartDate] = useState('2026-10-01');
    const [maxMembers, setMaxMembers] = useState('20');
    const [createdGroup, setCreatedGroup] = useState<Group | null>(null);
    const [copied, setCopied] = useState(false);

    if (!currentUser) return null;

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || Number(amount) <= 0) {
        notify('Please enter a valid group name and contribution amount.', 'error');
        return;
      }

      const accessCode = generateUnique6DigitCode(state.groups);
      const newGroup: Group = {
        id: `grp-${Date.now()}`,
        name: name.trim(),
        description:
          description.trim() ||
          `${frequency} ${formatNaira(Number(amount))} contribution group organized by ${currentUser.fullName}.`,
        organizerId: currentUser.id,
        organizerName: currentUser.fullName,
        amount: Number(amount),
        frequency,
        startDate,
        maxMembers: Number(maxMembers) || 20,
        accessCode,
        createdAt: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        groups: [newGroup, ...prev.groups],
      }));
      setSelectedGroupId(newGroup.id);
      setCreatedGroup(newGroup);
    };

    const handleShareCode = () => {
      if (!createdGroup) return;
      const shareText = `Join my "${createdGroup.name}" on Ajo Daily Contribution! Contribution: ${formatNaira(createdGroup.amount)} (${createdGroup.frequency}). Use 6-digit Group Access Code: ${createdGroup.accessCode}`;
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      notify(`Copied invitation & Access Code (${createdGroup.accessCode})`, 'success');
      setTimeout(() => setCopied(false), 2500);
    };

    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigateToDashboard(currentUser)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
          </div>

          {createdGroup ? (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h2 className="text-lg font-bold text-emerald-950">
                  GROUP CREATED SUCCESSFULLY
                </h2>
                <p className="text-xs text-emerald-800">
                  Share the 6-digit Group Access Code below with your members.
                </p>
              </div>

              <div className="space-y-3 text-xs bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <div className="flex justify-between py-1.5 border-b border-slate-200/70">
                  <span className="text-slate-500">Group Name</span>
                  <span className="font-semibold text-slate-900">
                    {createdGroup.name}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200/70">
                  <span className="text-slate-500">Contribution Amount</span>
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    {formatNaira(createdGroup.amount)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200/70">
                  <span className="text-slate-500">Frequency</span>
                  <span className="font-semibold text-slate-900">
                    {createdGroup.frequency}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-500">6-Digit Access Code</span>
                  <span className="text-2xl font-mono font-bold tracking-widest text-slate-900 tabular-nums">
                    {createdGroup.accessCode}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleShareCode}
                  className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Code Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Share Code ({createdGroup.accessCode})</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setScreen('GROUP_DETAILS')}
                  className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
                >
                  Open Group Details →
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Create Contribution Group
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Set up a new Ajo savings cycle and generate a 6-digit Group Access Code.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Group Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Market Women Daily Ajo"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the group purpose and rules"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Contribution Amount (₦)
                    </label>
                    <input
                      type="number"
                      required
                      min={100}
                      step={500}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Frequency
                    </label>
                    <select
                      value={frequency}
                      onChange={(e) =>
                        setFrequency(e.target.value as ContributionFrequency)
                      }
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Number of Members
                    </label>
                    <input
                      type="number"
                      required
                      min={2}
                      max={100}
                      value={maxMembers}
                      onChange={(e) => setMaxMembers(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[46px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors"
                >
                  CREATE GROUP
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // SCREEN 7: MEMBER DASHBOARD
  // ============================================================================
  const MemberDashboardView = () => {
    if (!currentUser) return null;

    const myMemberships = state.groupMembers.filter(
      (m) => m.userId === currentUser.id
    );
    const myGroupIds = new Set(myMemberships.map((m) => m.groupId));
    const myGroups = state.groups.filter((g) => myGroupIds.has(g.id));

    const activeGroup =
      myGroups.find((g) => g.id === selectedGroupId) || myGroups[0] || null;

    const myGroupContributions = activeGroup
      ? state.contributions
          .filter(
            (c) => c.groupId === activeGroup.id && c.userId === currentUser.id
          )
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      : [];

    const activeContribution =
      myGroupContributions.find(
        (c) =>
          c.status === 'LATE' ||
          c.status === 'FAILED' ||
          c.status === 'DUE' ||
          c.status === 'PENDING'
      ) ||
      myGroupContributions.find((c) => c.status === 'UPCOMING') ||
      myGroupContributions[myGroupContributions.length - 1] ||
      null;

    const unreadRemindersCount = state.reminders.filter(
      (r) => r.userId === currentUser.id && !r.isRead
    ).length;

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header & Primary Navigation Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-mono text-emerald-700 font-semibold">
              MEMBER DASHBOARD · VERSION 2
            </p>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
              Welcome, {currentUser.fullName}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Track your scheduled contribution due dates, reminders, and test payments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setScreen('MY_CONTRIBUTIONS')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>MY CONTRIBUTIONS</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!activeGroup) {
                  notify('Join a group first to make a contribution payment.', 'info');
                  setScreen('JOIN_GROUP');
                  return;
                }
                setSelectedGroupId(activeGroup.id);
                if (activeContribution) {
                  setSelectedContributionId(activeContribution.contributionId);
                }
                setScreen('MAKE_PAYMENT');
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>PAY CONTRIBUTION</span>
            </button>
            <button
              type="button"
              onClick={() => setScreen('REMINDERS')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>
                REMINDERS{unreadRemindersCount > 0 ? ` (${unreadRemindersCount})` : ''}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setScreen('JOIN_GROUP')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
              <span>JOIN GROUP</span>
            </button>
            <button
              type="button"
              onClick={() => setScreen('PAYMENT_HISTORY')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              PAYMENT HISTORY
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeGroup) setSelectedGroupId(activeGroup.id);
                setScreen('GROUP_DETAILS');
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              GROUP DETAILS
            </button>
            <button
              type="button"
              onClick={() => setScreen('PROFILE')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              PROFILE
            </button>
          </div>
        </div>

        {/* Group Selector if Member belongs to multiple groups */}
        {myGroups.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-slate-500 shrink-0">Active Group:</span>
            {myGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGroupId(g.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
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

        {/* Current Group & Obligation Summary Cards */}
        {!activeGroup ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              You have not joined a contribution group yet
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Enter a 6-digit Group Access Code (such as demo code{' '}
              <strong className="font-mono text-slate-800">583921</strong> for Market
              Women Daily Ajo) to join and start contributing.
            </p>
            <button
              type="button"
              onClick={() => setScreen('JOIN_GROUP')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
            >
              Join Group with 6-Digit Code
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <p className="text-xs text-slate-500">Current Group</p>
              <p className="text-base font-bold text-slate-900 mt-1 truncate">
                {activeGroup.name}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                Code: {activeGroup.accessCode} · {activeGroup.frequency}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <p className="text-xs text-slate-500">Contribution Amount</p>
              <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
                {formatNaira(activeGroup.amount)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Per {activeGroup.frequency.toLowerCase()} cycle
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <p className="text-xs text-slate-500">Next Due Date</p>
              <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                {formatReadableDate(
                  activeContribution?.dueDate || activeGroup.startDate
                )}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Organizer: {activeGroup.organizerName}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 flex flex-col justify-between">
              <div>
                <p className="text-xs text-slate-500">Current Obligation Status</p>
                <div className="mt-2">
                  {renderStatusIndicator(activeContribution?.status || 'DUE')}
                </div>
              </div>
              {activeContribution?.transactionReference && (
                <p className="text-[11px] font-mono text-slate-500 mt-2 tabular-nums">
                  Ref: {activeContribution.transactionReference}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Prominent Pay Contribution Callout */}
        {activeGroup && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900">
                Ready to record your {activeGroup.frequency.toLowerCase()} contribution?
              </h2>
              <p className="text-xs text-slate-600">
                Next actionable schedule:{' '}
                <strong>
                  {formatReadableDate(
                    activeContribution?.dueDate || activeGroup.startDate
                  )}
                </strong>{' '}
                ({activeContribution?.status || 'DUE'}) for{' '}
                <strong>{activeGroup.name}</strong> ({formatNaira(activeGroup.amount)}).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setScreen('MY_CONTRIBUTIONS')}
                className="min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-xs whitespace-nowrap"
              >
                VIEW SCHEDULE
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupId(activeGroup.id);
                  if (activeContribution) {
                    setSelectedContributionId(activeContribution.contributionId);
                  }
                  setScreen('MAKE_PAYMENT');
                }}
                className="min-h-[46px] px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs whitespace-nowrap transition-colors"
              >
                PAY CONTRIBUTION ({formatNaira(activeGroup.amount)})
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // SCREEN 8: JOIN GROUP
  // ============================================================================
  const JoinGroupView = () => {
    const [codeInput, setCodeInput] = useState('');
    const [matchedGroup, setMatchedGroup] = useState<Group | null>(null);
    const [lookupError, setLookupError] = useState<string | null>(null);

    if (!currentUser) return null;

    const handleSearchCode = (e: React.FormEvent) => {
      e.preventDefault();
      setLookupError(null);
      const clean = codeInput.trim();
      const found = state.groups.find((g) => g.accessCode === clean);
      if (!found) {
        setMatchedGroup(null);
        setLookupError(
          `No group found with 6-digit Access Code "${clean}". Try demo code 583921.`
        );
        return;
      }
      setMatchedGroup(found);
    };

    const handleConfirmJoin = () => {
      if (!matchedGroup) return;
      const alreadyIn = state.groupMembers.some(
        (m) => m.groupId === matchedGroup.id && m.userId === currentUser.id
      );

      if (!alreadyIn) {
        const newMember: GroupMember = {
          id: `gm-${Date.now()}`,
          groupId: matchedGroup.id,
          userId: currentUser.id,
          userName: currentUser.fullName,
          userPhone: currentUser.phone,
          userEmail: currentUser.email,
          joinedAt: new Date().toISOString(),
        };

        const generatedSchedule = generateMemberContributionSchedule(
          matchedGroup,
          { userId: currentUser.id, userName: currentUser.fullName },
          7,
          getTodayYmd()
        );

        setState((prev) => ({
          ...prev,
          groupMembers: [...prev.groupMembers, newMember],
          contributions: [...prev.contributions, ...generatedSchedule],
        }));
      }

      setSelectedGroupId(matchedGroup.id);
      notify(
        `Successfully joined "${matchedGroup.name}"! Your contribution schedule has been generated.`,
        'success'
      );
      setScreen('MY_CONTRIBUTIONS');
    };

    return (
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div>
            <button
              type="button"
              onClick={() => navigateToDashboard(currentUser)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
            <h1 className="text-xl font-bold text-slate-900">
              Join a Contribution Group
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Enter a 6-digit Group Access Code provided by your organizer.
            </p>
          </div>

          <form onSubmit={handleSearchCode} className="space-y-3">
            <label className="block text-xs font-medium text-slate-700">
              6-Digit Group Access Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                required
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ''))}
                placeholder="583921"
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-lg font-mono tracking-widest text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap"
              >
                Find Group
              </button>
            </div>
          </form>

          {/* Quick Demo Code Helper */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Available Group Codes:</span>
            {state.groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setCodeInput(g.accessCode);
                  setMatchedGroup(g);
                  setLookupError(null);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-xs tabular-nums"
              >
                {g.accessCode} ({g.name})
              </button>
            ))}
          </div>

          {lookupError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {lookupError}
            </div>
          )}

          {matchedGroup && (
            <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-4">
              <div>
                <p className="text-xs font-mono font-semibold text-emerald-800">
                  MATCHED CONTRIBUTION GROUP
                </p>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                  {matchedGroup.name}
                </h2>
              </div>

              <div className="space-y-2 text-xs border-t border-emerald-200/80 pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Contribution Amount</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {formatNaira(matchedGroup.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Frequency</span>
                  <span className="font-semibold text-slate-900">
                    {matchedGroup.frequency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Organizer</span>
                  <span className="font-semibold text-slate-900">
                    {matchedGroup.organizerName}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmJoin}
                className="w-full min-h-[46px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors"
              >
                JOIN GROUP
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // SCREEN 9: MAKE TEST PAYMENT
  // ============================================================================
  const MakeTestPaymentView = () => {
    if (!currentUser) return null;

    const myMemberships = state.groupMembers.filter(
      (m) => m.userId === currentUser.id
    );
    const myGroupIds = new Set(myMemberships.map((m) => m.groupId));
    const myGroups = state.groups.filter((g) => myGroupIds.has(g.id));
    const activeGroup =
      myGroups.find((g) => g.id === selectedGroupId) ||
      state.groups.find((g) => g.id === selectedGroupId) ||
      myGroups[0] ||
      state.groups[0];

    if (!activeGroup) {
      return (
        <div className="max-w-md mx-auto px-4 py-10 text-center">
          <p className="text-sm text-slate-600">No group selected.</p>
        </div>
      );
    }

    const memberSchedule = state.contributions
      .filter((c) => c.groupId === activeGroup.id && c.userId === currentUser.id)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const targetContribution =
      memberSchedule.find((c) => c.contributionId === selectedContributionId) ||
      memberSchedule.find(
        (c) =>
          c.status === 'LATE' ||
          c.status === 'FAILED' ||
          c.status === 'DUE' ||
          c.status === 'PENDING'
      ) ||
      memberSchedule.find((c) => c.status === 'UPCOMING') ||
      memberSchedule[0] ||
      null;

    const handleOutcome = (outcome: 'PAID' | 'FAILED' | 'PENDING') => {
      const reference = `AJO-TEST-${String(state.refSeq).padStart(6, '0')}`;
      const nowIso = new Date().toISOString();
      const targetDueDate = targetContribution?.dueDate || activeGroup.startDate;
      const targetId = targetContribution?.contributionId || `cnt-${Date.now()}`;

      const newTxn: TransactionRecord = {
        id: `txn-${Date.now()}`,
        reference,
        contributionId: targetId,
        groupId: activeGroup.id,
        groupName: activeGroup.name,
        userId: currentUser.id,
        userName: currentUser.fullName,
        amount: activeGroup.amount,
        dueDate: targetDueDate,
        status: outcome,
        date: nowIso,
      };

      setState((prev) => {
        const exists = prev.contributions.some((c) => c.contributionId === targetId);
        const updatedContributions = exists
          ? prev.contributions.map((c) => {
              if (c.contributionId === targetId) {
                return {
                  ...c,
                  status: outcome as ContributionStatus,
                  paidAt: outcome === 'PAID' ? nowIso : null,
                  transactionReference: reference,
                  lastReference: reference,
                  updatedAt: nowIso,
                };
              }
              return c;
            })
          : [
              ...prev.contributions,
              {
                id: targetId,
                contributionId: targetId,
                groupId: activeGroup.id,
                groupName: activeGroup.name,
                userId: currentUser.id,
                userName: currentUser.fullName,
                amount: activeGroup.amount,
                frequency: activeGroup.frequency,
                dueDate: targetDueDate,
                nextDueDate: targetDueDate,
                status: outcome as ContributionStatus,
                createdAt: nowIso,
                paidAt: outcome === 'PAID' ? nowIso : null,
                transactionReference: reference,
                lastReference: reference,
                updatedAt: nowIso,
              },
            ];

        const updatedItem = updatedContributions.find(
          (c) => c.contributionId === targetId
        );
        const nextReminders = [...prev.reminders];
        if (updatedItem && (outcome === 'PAID' || outcome === 'FAILED')) {
          const rType =
            outcome === 'PAID' ? 'PAYMENT_CONFIRMATION' : 'PAYMENT_FAILED';
          const { title, message } = buildReminderMessage(updatedItem, rType);
          nextReminders.unshift({
            id: `rem-pay-${Date.now()}`,
            contributionId: updatedItem.contributionId,
            userId: currentUser.id,
            userName: currentUser.fullName,
            userPhone: currentUser.phone,
            userEmail: currentUser.email,
            groupId: activeGroup.id,
            groupName: activeGroup.name,
            amount: activeGroup.amount,
            dueDate: updatedItem.dueDate,
            type: rType,
            title,
            message,
            channels: prev.reminderSettings.channels,
            sentAt: nowIso,
            isRead: false,
            triggeredBy: 'AUTOMATED_SYSTEM',
          });
        }

        return {
          ...prev,
          refSeq: prev.refSeq + 1,
          contributions: updatedContributions,
          transactions: [newTxn, ...prev.transactions],
          reminders: nextReminders,
        };
      });

      if (outcome === 'PAID') {
        notify(
          `Payment Successful for ${formatReadableDate(targetDueDate)}! Marked as PAID (${reference}).`,
          'success'
        );
      } else if (outcome === 'FAILED') {
        notify(`Test Payment marked as FAILED (${reference}).`, 'error');
      } else {
        notify(`Test Payment marked as PENDING (${reference}).`, 'info');
      }

      setScreen('MY_CONTRIBUTIONS');
    };

    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Test Mode Banner */}
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3.5 flex items-center gap-2.5 text-amber-900 text-xs font-semibold">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>TEST MODE — NO REAL MONEY WILL BE CHARGED</span>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <button
                type="button"
                onClick={() => navigateToDashboard(currentUser)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-3"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Dashboard</span>
              </button>
              <h1 className="text-xl font-bold text-slate-900">Make Test Payment</h1>
              <p className="text-xs text-slate-500 mt-1">
                Select a scheduled contribution due date and simulate a payment outcome.
              </p>
            </div>

            {memberSchedule.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Scheduled Contribution Due Date
                </label>
                <select
                  value={targetContribution?.contributionId || ''}
                  onChange={(e) => setSelectedContributionId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-mono text-slate-900 bg-white focus:border-emerald-600 focus:outline-none"
                >
                  {memberSchedule.map((c) => (
                    <option key={c.contributionId} value={c.contributionId}>
                      {formatReadableDate(c.dueDate)} — {formatNaira(c.amount)} (
                      {c.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3 text-xs">
              <div className="flex justify-between items-baseline border-b border-slate-200/70 pb-3">
                <span className="text-slate-500">Contribution Amount</span>
                <span className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
                  {formatNaira(activeGroup.amount)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Group Name</span>
                <span className="font-semibold text-slate-900">{activeGroup.name}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Scheduled Due Date</span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatReadableDate(
                    targetContribution?.dueDate || activeGroup.startDate
                  )}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Current Status</span>
                <span>{renderStatusIndicator(targetContribution?.status || 'DUE')}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Next Reference Preview</span>
                <span className="font-mono text-slate-800 tabular-nums">
                  AJO-TEST-{String(state.refSeq).padStart(6, '0')}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleOutcome('PAID')}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>SUCCESSFUL PAYMENT</span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleOutcome('FAILED')}
                  className="min-h-[46px] px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span>FAILED PAYMENT</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOutcome('PENDING')}
                  className="min-h-[46px] px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Clock className="w-4 h-4" />
                  <span>PENDING PAYMENT</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // SCREEN 10: PAYMENT HISTORY
  // ============================================================================
  const PaymentHistoryView = () => {
    if (!currentUser) return null;

    const visibleTransactions =
      currentUser.role === 'ORGANIZER'
        ? state.transactions
        : state.transactions.filter((t) => t.userId === currentUser.id);

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <button
              type="button"
              onClick={() => navigateToDashboard(currentUser)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
            <h1 className="text-2xl font-bold text-slate-900">Payment History</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete log of test contribution transactions and reference codes.
            </p>
          </div>

          {currentUser.role === 'MEMBER' && (
            <button
              type="button"
              onClick={() => setScreen('MAKE_PAYMENT')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap"
            >
              + Make Test Payment
            </button>
          )}
        </div>

        {visibleTransactions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
            <p className="text-sm text-slate-600">No payment transactions recorded yet.</p>
            <button
              type="button"
              onClick={() => setScreen('MAKE_PAYMENT')}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold"
            >
              Record Your First Test Payment
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Reference</th>
                    <th className="py-3.5 px-4">Group</th>
                    <th className="py-3.5 px-4">Member</th>
                    <th className="py-3.5 px-4 text-right">Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {visibleTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString('en-NG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {t.reference}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {t.groupName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{t.userName}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatNaira(t.amount)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusIndicator(t.status)}
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

  // ============================================================================
  // SCREEN 11: GROUP DETAILS
  // ============================================================================
  const GroupDetailsView = () => {
    if (!currentUser) return null;

    const group =
      state.groups.find((g) => g.id === selectedGroupId) || state.groups[0];

    if (!group) {
      return (
        <div className="max-w-xl mx-auto px-4 py-10 text-center">
          <p className="text-sm text-slate-600">No group found.</p>
        </div>
      );
    }

    const members = state.groupMembers.filter((m) => m.groupId === group.id);
    const contributions = state.contributions.filter((c) => c.groupId === group.id);

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <button
              type="button"
              onClick={() => navigateToDashboard(currentUser)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
            <h1 className="text-2xl font-bold text-slate-900">{group.name}</h1>
            <p className="text-xs text-slate-500 mt-1">{group.description}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(group.accessCode);
                notify(`Copied Group Access Code: ${group.accessCode}`, 'success');
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Access Code: {group.accessCode}</span>
            </button>
            {currentUser.role === 'MEMBER' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupId(group.id);
                  setScreen('MAKE_PAYMENT');
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
              >
                Pay Contribution
              </button>
            )}
          </div>
        </div>

        {/* Group Summary Metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500">Organizer</p>
            <p className="text-sm font-bold text-slate-900 mt-1 truncate">
              {group.organizerName}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500">Contribution Amount</p>
            <p className="text-lg font-bold text-emerald-700 font-mono tabular-nums mt-1">
              {formatNaira(group.amount)}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500">Frequency</p>
            <p className="text-sm font-bold text-slate-900 mt-1">{group.frequency}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500">Start Date</p>
            <p className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-1">
              {group.startDate}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 col-span-2 sm:col-span-1">
            <p className="text-xs text-slate-500">Access Code</p>
            <p className="text-lg font-bold text-slate-900 font-mono tracking-wider tabular-nums mt-1">
              {group.accessCode}
            </p>
          </div>
        </div>

        {/* Members & Contribution Status Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Group Members &amp; Contribution Schedule Status ({members.length}/
              {group.maxMembers})
            </h2>
          </div>

          {members.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No members have joined this group yet. Share Access Code{' '}
              <strong className="font-mono text-slate-900">{group.accessCode}</strong> to
              invite members.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3.5 px-6">Member Name</th>
                    <th className="py-3.5 px-4">Phone</th>
                    <th className="py-3.5 px-4">Schedule Progress</th>
                    <th className="py-3.5 px-4">Next / Active Due</th>
                    <th className="py-3.5 px-6">Status</th>
                    {currentUser.role === 'ORGANIZER' && (
                      <th className="py-3.5 px-4 text-right">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {members.map((m) => {
                    const memberContribs = contributions
                      .filter((c) => c.userId === m.userId)
                      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
                    const paidCnt = memberContribs.filter(
                      (c) => c.status === 'PAID'
                    ).length;
                    const lateCnt = memberContribs.filter(
                      (c) => c.status === 'LATE' || c.status === 'FAILED'
                    ).length;
                    const activeContrib =
                      memberContribs.find(
                        (c) =>
                          c.status === 'LATE' ||
                          c.status === 'FAILED' ||
                          c.status === 'DUE' ||
                          c.status === 'PENDING'
                      ) ||
                      memberContribs.find((c) => c.status === 'UPCOMING') ||
                      memberContribs[memberContribs.length - 1];
                    const status = activeContrib?.status || 'UPCOMING';

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-6 font-semibold text-slate-900">
                          {m.userName}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums">
                          {m.userPhone}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700 tabular-nums">
                          {paidCnt}/{memberContribs.length} Paid
                          {lateCnt > 0 ? ` · ${lateCnt} Late` : ''}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums">
                          {activeContrib
                            ? formatReadableDate(activeContrib.dueDate)
                            : '—'}
                        </td>
                        <td className="py-3.5 px-6">
                          {renderStatusIndicator(status)}
                        </td>
                        {currentUser.role === 'ORGANIZER' && (
                          <td className="py-3.5 px-4 text-right">
                            {activeContrib && activeContrib.status !== 'PAID' ? (
                              <button
                                type="button"
                                onClick={() => handleSendSingleReminder(activeContrib)}
                                className="min-h-[34px] px-3 py-1 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-800 inline-flex items-center gap-1"
                              >
                                <Send className="w-3 h-3 text-emerald-700" />
                                <span>Remind</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-emerald-700 font-medium">
                                Up to date
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // SCREEN 10: PROFILE
  // ============================================================================
  const ProfileView = () => {
    if (!currentUser) return null;
    const [fullName, setFullName] = useState(currentUser.fullName);
    const [phone, setPhone] = useState(currentUser.phone);

    const handleSaveProfile = (e: React.FormEvent) => {
      e.preventDefault();
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === currentUser.id
            ? { ...u, fullName: fullName.trim(), phone: phone.trim() }
            : u
        ),
      }));
      notify('Profile updated successfully.', 'success');
    };

    return (
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div>
            <button
              type="button"
              onClick={() => navigateToDashboard(currentUser)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
            <h1 className="text-xl font-bold text-slate-900">Your Profile</h1>
            <p className="text-xs text-slate-500 mt-1">
              Role: <strong>{currentUser.role}</strong> · Email: {currentUser.email}
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors"
            >
              Save Profile Changes
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleResetDemoData}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo Data</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // SEPARATE SUPER ADMIN PORTAL ROUTES (/admin/login & /admin/dashboard)
  // ============================================================================
  if (screen === 'ADMIN_LOGIN') {
    return (
      <AdminLoginScreen
        users={state.users}
        currentUser={currentUser}
        accessDeniedReason={adminAccessDeniedMsg}
        onAdminLoginSuccess={handleAdminLoginSuccess}
        onExitToPublicHome={() => {
          setAdminAccessDeniedMsg(null);
          if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
            navigateToDashboard(currentUser);
          } else {
            updateUrlPath('/');
            setScreen('HOME');
          }
        }}
      />
    );
  }

  if (screen === 'ADMIN_DASHBOARD') {
    if (!isAuthorizedSuperAdmin(currentUser) || !currentUser) {
      return (
        <AdminLoginScreen
          users={state.users}
          currentUser={currentUser}
          accessDeniedReason={
            adminAccessDeniedMsg ||
            'Access Denied: Only authenticated SUPER_ADMIN users can access /admin/dashboard.'
          }
          onAdminLoginSuccess={handleAdminLoginSuccess}
          onExitToPublicHome={() => {
            setAdminAccessDeniedMsg(null);
            if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
              navigateToDashboard(currentUser);
            } else {
              updateUrlPath('/');
              setScreen('HOME');
            }
          }}
        />
      );
    }

    return (
      <SuperAdminControlCenter
        adminUser={currentUser}
        state={state}
        setState={setState}
        notify={notify}
        onLogoutAdmin={handleLogout}
        onSwitchToPublicApp={() => {
          updateUrlPath('/');
          setScreen('HOME');
        }}
      />
    );
  }

  // ============================================================================
  // TOP BAR (3-Zone Contract) & MOBILE BOTTOM NAVIGATION
  // ============================================================================
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-20 md:pb-10">
      {/* Super Admin Live Preview Return Bar (Only visible to authenticated Super Admin) */}
      {isAuthorizedSuperAdmin(currentUser) && (
        <div className="bg-slate-950 text-white px-4 sm:px-6 py-2 text-xs flex items-center justify-between border-b border-slate-800">
          <span className="font-mono text-emerald-400">
            SUPER ADMIN PREVIEW MODE
          </span>
          <button
            type="button"
            onClick={() => openAdminRoute('/admin/dashboard')}
            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs"
          >
            Return to Admin Dashboard (/#amind) →
          </button>
        </div>
      )}

      {/* Global Website Announcement Banner (Controlled by Admin) */}
      {state.platformSettings.announcementBannerActive &&
        state.platformSettings.announcementBannerText && (
          <div className="bg-emerald-900 text-emerald-50 px-4 sm:px-6 py-2.5 text-xs font-medium text-center border-b border-emerald-800">
            {state.platformSettings.announcementBannerText}
          </div>
        )}

      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Zone 1: Single text element Brand wordmark */}
        <button
          type="button"
          onClick={() =>
            currentUser ? navigateToDashboard(currentUser) : setScreen('HOME')
          }
          className="text-base font-bold tracking-tight text-emerald-950 whitespace-nowrap"
        >
          {state.platformSettings.platformName || 'AJO WOMAN DAILY CONTRIBUTION'}
        </button>

        {/* Zone 2: Clean text navigation links (Admin dashboard is hidden from public) */}
        {currentUser ? (
          <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => navigateToDashboard(currentUser)}
              className="hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              Dashboard
            </button>
            {state.platformSettings.enableScheduleFeature !== false && (
              <button
                type="button"
                onClick={() => setScreen('MY_CONTRIBUTIONS')}
                className="hover:text-slate-900 transition-colors whitespace-nowrap"
              >
                My Contributions
              </button>
            )}
            {currentUser.role === 'ORGANIZER' ? (
              state.platformSettings.allowGroupCreation !== false && (
                <button
                  type="button"
                  onClick={() => setScreen('CREATE_GROUP')}
                  className="hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  Create Group
                </button>
              )
            ) : (
              <>
                {state.platformSettings.allowGroupJoining !== false && (
                  <button
                    type="button"
                    onClick={() => setScreen('JOIN_GROUP')}
                    className="hover:text-slate-900 transition-colors whitespace-nowrap"
                  >
                    Join Group
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setScreen('MAKE_PAYMENT')}
                  className="hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  Make Payment
                </button>
              </>
            )}
            {state.platformSettings.enableRemindersFeature !== false && (
              <button
                type="button"
                onClick={() => setScreen('REMINDERS')}
                className="hover:text-slate-900 transition-colors whitespace-nowrap"
              >
                Reminders
              </button>
            )}
            {state.platformSettings.enablePaymentHistoryFeature !== false && (
              <button
                type="button"
                onClick={() => setScreen('PAYMENT_HISTORY')}
                className="hover:text-slate-900 transition-colors whitespace-nowrap"
              >
                Payment History
              </button>
            )}
            <button
              type="button"
              onClick={() => setScreen('PROFILE')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              Profile
            </button>
          </nav>
        ) : (
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setScreen('HOME')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => setScreen('LOGIN')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              Login
            </button>
            {state.platformSettings.allowSelfRegistration !== false && (
              <button
                type="button"
                onClick={() => setScreen('REGISTER')}
                className="hover:text-slate-900 transition-colors whitespace-nowrap"
              >
                Register
              </button>
            )}
          </nav>
        )}

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-2">
          <PWAInstallButton />
          {currentUser ? (
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 whitespace-nowrap"
            >
              Logout
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setScreen('LOGIN')}
              className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-semibold text-white whitespace-nowrap"
            >
              Login
            </button>
          )}
        </div>
      </header>

      {/* Feedback Notification Banner */}
      {bannerMsg && (
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div
            className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
              bannerMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : bannerMsg.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}
          >
            <span>{bannerMsg.text}</span>
            <button
              type="button"
              onClick={() => setBannerMsg(null)}
              className="text-xs font-semibold underline ml-4"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {screen === 'HOME' && <HomeView />}
        {screen === 'LOGIN' && <LoginView />}
        {screen === 'REGISTER' && <RegisterView />}
        {screen === 'ORGANIZER_DASHBOARD' && <OrganizerDashboardView />}
        {screen === 'CREATE_GROUP' && <CreateGroupView />}
        {screen === 'MEMBER_DASHBOARD' && <MemberDashboardView />}
        {screen === 'JOIN_GROUP' && <JoinGroupView />}
        {screen === 'MY_CONTRIBUTIONS' && currentUser && (
          <MyContributionsScreen
            currentUser={currentUser}
            state={state}
            selectedGroupId={selectedGroupId}
            onSelectGroup={(gid) => setSelectedGroupId(gid)}
            onBack={() => navigateToDashboard(currentUser)}
            onPayContribution={(c) => {
              setSelectedGroupId(c.groupId);
              setSelectedContributionId(c.contributionId);
              setScreen('MAKE_PAYMENT');
            }}
            onJoinGroup={() => setScreen('JOIN_GROUP')}
          />
        )}
        {screen === 'REMINDERS' && currentUser && (
          <RemindersCenterScreen
            currentUser={currentUser}
            state={state}
            setState={setState}
            onBack={() => navigateToDashboard(currentUser)}
            onPayContribution={(c) => {
              setSelectedGroupId(c.groupId);
              setSelectedContributionId(c.contributionId);
              setScreen('MAKE_PAYMENT');
            }}
            notify={notify}
          />
        )}
        {screen === 'MAKE_PAYMENT' && <MakeTestPaymentView />}
        {screen === 'PAYMENT_HISTORY' && <PaymentHistoryView />}
        {screen === 'GROUP_DETAILS' && <GroupDetailsView />}
        {screen === 'PROFILE' && <ProfileView />}
      </main>

      {/* Website Footer (Editable by Admin) */}
      {state.platformSettings.footerText && (
        <footer className="max-w-5xl mx-auto w-full px-4 sm:px-6 pt-10 pb-4 text-center text-xs text-slate-400">
          {state.platformSettings.footerText}
        </footer>
      )}

      {/* Mobile Bottom Navigation Bar */}
      {currentUser && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center h-16 px-2">
          <button
            type="button"
            onClick={() => navigateToDashboard(currentUser)}
            className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium ${
              screen === 'MEMBER_DASHBOARD' || screen === 'ORGANIZER_DASHBOARD'
                ? 'text-emerald-700 font-semibold'
                : 'text-slate-500'
            }`}
          >
            <HomeIcon className="w-4 h-4" />
            <span className="mt-1">Home</span>
          </button>

          <button
            type="button"
            onClick={() => setScreen('MY_CONTRIBUTIONS')}
            className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium ${
              screen === 'MY_CONTRIBUTIONS'
                ? 'text-emerald-700 font-semibold'
                : 'text-slate-500'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span className="mt-1">Schedule</span>
          </button>

          {currentUser.role === 'ORGANIZER' ? (
            <button
              type="button"
              onClick={() => setScreen('CREATE_GROUP')}
              className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium ${
                screen === 'CREATE_GROUP'
                  ? 'text-emerald-700 font-semibold'
                  : 'text-slate-500'
              }`}
            >
              <FolderKanban className="w-4 h-4" />
              <span className="mt-1">New Group</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setScreen('MAKE_PAYMENT')}
              className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium ${
                screen === 'MAKE_PAYMENT'
                  ? 'text-emerald-700 font-semibold'
                  : 'text-slate-500'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span className="mt-1">Pay</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setScreen('REMINDERS')}
            className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium ${
              screen === 'REMINDERS'
                ? 'text-emerald-700 font-semibold'
                : 'text-slate-500'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span className="mt-1">Reminders</span>
          </button>

          <button
            type="button"
            onClick={() => setScreen('PROFILE')}
            className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium ${
              screen === 'PROFILE'
                ? 'text-emerald-700 font-semibold'
                : 'text-slate-500'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span className="mt-1">Profile</span>
          </button>
        </nav>
      )}

      <OfflineIndicator />
    </div>
  );
}
