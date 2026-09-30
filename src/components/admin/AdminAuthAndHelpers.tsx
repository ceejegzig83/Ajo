import React, { useState } from 'react';
import { ShieldAlert, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { User } from '../../types/ajo';

/**
 * Reusable Admin Authorization Guard (Section 31)
 */
export function isAuthorizedSuperAdmin(user: User | null): boolean {
  return Boolean(
    user &&
      user.role === 'SUPER_ADMIN' &&
      (user.status || 'ACTIVE') === 'ACTIVE'
  );
}

export function exportRowsToCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];
  const blob = new Blob([csvLines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface AdminLoginScreenProps {
  users: User[];
  currentUser: User | null;
  accessDeniedReason?: string | null;
  onAdminLoginSuccess: (adminUser: User) => void;
  onExitToPublicHome: () => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({
  users,
  currentUser,
  accessDeniedReason,
  onAdminLoginSuccess,
  onExitToPublicHome,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(accessDeniedReason || null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    const matched = users.find(
      (u) =>
        u.role === 'SUPER_ADMIN' &&
        u.email.toLowerCase() === cleanEmail &&
        u.password === password
    );

    if (!matched) {
      setError('Invalid Super Admin email or password.');
      return;
    }

    if (matched.status === 'SUSPENDED') {
      setError('This Super Admin account is currently suspended.');
      return;
    }

    onAdminLoginSuccess(matched);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center px-4 py-12">
      <div className="max-w-md w-full mx-auto space-y-6">
        <button
          type="button"
          onClick={onExitToPublicHome}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Public Platform</span>
        </button>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-emerald-400">
              <Lock className="w-3.5 h-3.5" />
              <span>/#amind · Restricted Portal</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              AJO WOMAN DAILY CONTRIBUTION
            </h1>
            <p className="text-xs font-mono font-semibold text-emerald-400">
              SUPER ADMIN CONTROL CENTER
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Private administrator authentication gate. Authorized credentials are
              required to access the control center.
            </p>
          </div>

          {currentUser && currentUser.role !== 'SUPER_ADMIN' && (
            <div className="p-3.5 rounded-2xl bg-amber-950/60 border border-amber-700/60 text-xs text-amber-200 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Active Session Role: {currentUser.role} ({currentUser.fullName})
                </p>
                <p className="text-amber-300/90 mt-0.5">
                  Sign in with your authorized Super Admin credentials below.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-2xl bg-red-950/70 border border-red-800 text-xs text-red-200 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs" autoComplete="off">
            <div>
              <label className="block font-medium text-slate-300 mb-1.5">
                Super Admin Email
              </label>
              <input
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter administrator email"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1.5">
                Admin Password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter administrator password"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm transition-colors"
            >
              SIGN IN TO SUPER ADMIN
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
