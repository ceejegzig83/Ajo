import React, { useState } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  Layers,
  Megaphone,
  Sliders,
  UserPlus,
  FolderPlus,
} from 'lucide-react';
import {
  User,
  UserRole,
  Group,
  ContributionFrequency,
  WebsiteFeatureCard,
  WebsiteCustomSection,
} from '../../types/ajo';
import {
  AjoState,
  createAuditEntry,
  generateUnique6DigitCode,
  getTodayYmd,
} from '../../services/storage';

interface AdminWebsiteEditorProps {
  adminUser: User;
  state: AjoState;
  setState: React.Dispatch<React.SetStateAction<AjoState>>;
  notify: (text: string, type?: 'success' | 'error' | 'info') => void;
  onPreviewWebsite: () => void;
}

export const AdminWebsiteEditor: React.FC<AdminWebsiteEditorProps> = ({
  adminUser,
  state,
  setState,
  notify,
  onPreviewWebsite,
}) => {
  const ps = state.platformSettings;
  const features = ps.websiteFeatures || [];
  const customSections = ps.customSections || [];

  // Add New Feature Card State
  const [newBadge, setNewBadge] = useState(
    `0${features.length + 1}. FEATURE`
  );
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Add Custom Website Section State
  const [secTitle, setSecTitle] = useState('');
  const [secSubtitle, setSecSubtitle] = useState('');
  const [secContent, setSecContent] = useState('');
  const [secCtaLabel, setSecCtaLabel] = useState('');
  const [secCtaTarget, setSecCtaTarget] = useState<
    'LOGIN' | 'REGISTER' | 'JOIN_GROUP' | 'MAKE_PAYMENT'
  >('REGISTER');

  // Quick Add User State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('password123');
  const [newUserRole, setNewUserRole] = useState<UserRole>('MEMBER');

  // Quick Add Group State
  const [newGrpName, setNewGrpName] = useState('');
  const [newGrpDesc, setNewGrpDesc] = useState('');
  const [newGrpAmount, setNewGrpAmount] = useState('5000');
  const [newGrpFreq, setNewGrpFreq] = useState<ContributionFrequency>('Daily');
  const [newGrpMax, setNewGrpMax] = useState('20');

  const updateSettings = (
    updater: (
      current: AjoState['platformSettings']
    ) => AjoState['platformSettings'],
    auditMessage: string
  ) => {
    setState((prev) => ({
      ...prev,
      platformSettings: updater(prev.platformSettings),
      auditLogs: [
        createAuditEntry('Admin updated website', adminUser, auditMessage),
        ...prev.auditLogs,
      ],
    }));
  };

  const handleAddFeatureCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) {
      notify('Please provide both a feature title and description.', 'error');
      return;
    }
    const card: WebsiteFeatureCard = {
      id: `feat-${Date.now()}`,
      badge: newBadge.trim() || `0${features.length + 1}. FEATURE`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      enabled: true,
    };
    const nextFeatures = [...features, card];
    updateSettings(
      (curr) => ({
        ...curr,
        websiteFeatures: nextFeatures,
      }),
      `Added website feature card "${card.title}".`
    );
    setNewBadge(`0${nextFeatures.length + 1}. FEATURE`);
    setNewTitle('');
    setNewDesc('');
    notify(`Feature "${card.title}" added to the website.`, 'success');
  };

  const handleUpdateFeatureCard = (
    id: string,
    patch: Partial<WebsiteFeatureCard>
  ) => {
    const nextFeatures = features.map((f) =>
      f.id === id ? { ...f, ...patch } : f
    );
    updateSettings(
      (curr) => ({
        ...curr,
        websiteFeatures: nextFeatures,
      }),
      `Updated website feature card (${id}).`
    );
  };

  const handleDeleteFeatureCard = (id: string, title: string) => {
    const nextFeatures = features.filter((f) => f.id !== id);
    updateSettings(
      (curr) => ({
        ...curr,
        websiteFeatures: nextFeatures,
      }),
      `Removed website feature card "${title}".`
    );
    notify(`Feature "${title}" removed from the website.`, 'info');
  };

  const handleAddCustomSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secTitle.trim() || !secContent.trim()) {
      notify('Please enter a section title and content.', 'error');
      return;
    }
    const section: WebsiteCustomSection = {
      id: `sec-${Date.now()}`,
      title: secTitle.trim(),
      subtitle: secSubtitle.trim() || 'PLATFORM UPDATE',
      content: secContent.trim(),
      ctaLabel: secCtaLabel.trim() || undefined,
      ctaTargetScreen: secCtaLabel.trim() ? secCtaTarget : undefined,
      enabled: true,
    };
    updateSettings(
      (curr) => ({
        ...curr,
        customSections: [...(curr.customSections || []), section],
      }),
      `Added custom website section "${section.title}".`
    );
    setSecTitle('');
    setSecSubtitle('');
    setSecContent('');
    setSecCtaLabel('');
    notify(`Custom section "${section.title}" published to the website.`, 'success');
  };

  const handleToggleCustomSection = (id: string) => {
    const next = customSections.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    updateSettings(
      (curr) => ({ ...curr, customSections: next }),
      `Toggled custom website section visibility (${id}).`
    );
  };

  const handleDeleteCustomSection = (id: string, title: string) => {
    const next = customSections.filter((s) => s.id !== id);
    updateSettings(
      (curr) => ({ ...curr, customSections: next }),
      `Deleted custom website section "${title}".`
    );
    notify(`Custom section "${title}" deleted.`, 'info');
  };

  const handleQuickCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newUserEmail.trim().toLowerCase();
    if (!newUserName.trim() || !cleanEmail || !newUserPassword) return;
    if (state.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      notify('A user with this email already exists.', 'error');
      return;
    }
    const created: User = {
      id: `usr-${Date.now()}`,
      fullName: newUserName.trim(),
      email: cleanEmail,
      phone: newUserPhone.trim() || '08000000000',
      password: newUserPassword,
      role: newUserRole,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      users: [created, ...prev.users],
      auditLogs: [
        createAuditEntry(
          'Admin created user',
          adminUser,
          `Created ${created.role} account for ${created.fullName} (${created.email}).`
        ),
        ...prev.auditLogs,
      ],
    }));
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPhone('');
    notify(`Created ${created.role} account for ${created.fullName}.`, 'success');
  };

  const handleQuickCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(newGrpAmount);
    if (!newGrpName.trim() || !amt || amt <= 0) return;
    const organizer =
      state.users.find((u) => u.role === 'ORGANIZER') || adminUser;
    const code = generateUnique6DigitCode(state.groups);
    const created: Group = {
      id: `grp-${Date.now()}`,
      name: newGrpName.trim(),
      description:
        newGrpDesc.trim() ||
        `${newGrpFreq} contribution group managed via ${ps.platformName}.`,
      organizerId: organizer.id,
      organizerName: organizer.fullName,
      amount: amt,
      frequency: newGrpFreq,
      startDate: getTodayYmd(),
      maxMembers: Number(newGrpMax) || 20,
      accessCode: code,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      groups: [created, ...prev.groups],
      auditLogs: [
        createAuditEntry(
          'Admin created group',
          adminUser,
          `Created group "${created.name}" with access code ${code}.`
        ),
        ...prev.auditLogs,
      ],
    }));
    setNewGrpName('');
    setNewGrpDesc('');
    notify(
      `Created group "${created.name}" (Access Code: ${code}).`,
      'success'
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-emerald-950 text-white rounded-2xl p-6 border border-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-emerald-300">
            <Globe className="w-4 h-4" />
            <span>Website &amp; Feature Builder (Live CMS)</span>
          </div>
          <h3 className="text-lg font-bold">
            Edit &amp; Add Features Across the Entire Website
          </h3>
          <p className="text-xs text-emerald-100/90 max-w-2xl">
            Every change you make here updates the live public website, navigation,
            hero banner, feature cards, custom sections, and member/organizer
            capabilities immediately.
          </p>
        </div>
        <button
          type="button"
          onClick={onPreviewWebsite}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0"
        >
          Preview Live Website →
        </button>
      </div>

      {/* 1. Website Hero, Branding & Global Announcement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-700" />
            <span>1. Website Branding &amp; Hero Section Editor</span>
          </h4>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Website Brand Title / Heading
              </label>
              <input
                type="text"
                value={ps.platformName}
                onChange={(e) =>
                  updateSettings(
                    (curr) => ({ ...curr, platformName: e.target.value }),
                    `Changed website brand title to "${e.target.value}".`
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Hero Top Subtitle Badge
              </label>
              <input
                type="text"
                value={ps.heroSubtitle ?? ''}
                onChange={(e) =>
                  updateSettings(
                    (curr) => ({ ...curr, heroSubtitle: e.target.value }),
                    'Updated hero subtitle badge.'
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Hero Main Tagline
              </label>
              <textarea
                rows={2}
                value={ps.heroTagline ?? ''}
                onChange={(e) =>
                  updateSettings(
                    (curr) => ({ ...curr, heroTagline: e.target.value }),
                    'Updated hero tagline.'
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Primary Button Text
                </label>
                <input
                  type="text"
                  value={ps.primaryCtaText ?? 'LOGIN'}
                  onChange={(e) =>
                    updateSettings(
                      (curr) => ({ ...curr, primaryCtaText: e.target.value }),
                      'Updated primary CTA button text.'
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Secondary Button Text
                </label>
                <input
                  type="text"
                  value={ps.secondaryCtaText ?? 'CREATE ACCOUNT'}
                  onChange={(e) =>
                    updateSettings(
                      (curr) => ({ ...curr, secondaryCtaText: e.target.value }),
                      'Updated secondary CTA button text.'
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Website Footer Text
              </label>
              <input
                type="text"
                value={ps.footerText ?? ''}
                onChange={(e) =>
                  updateSettings(
                    (curr) => ({ ...curr, footerText: e.target.value }),
                    'Updated website footer text.'
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Global Announcement & Functional Feature Switches */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-emerald-700" />
                <span>2. Global Website Announcement Banner</span>
              </h4>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(ps.announcementBannerActive)}
                  onChange={(e) =>
                    updateSettings(
                      (curr) => ({
                        ...curr,
                        announcementBannerActive: e.target.checked,
                      }),
                      `Set global announcement banner active=${e.target.checked}.`
                    )
                  }
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Show Banner on Website</span>
              </label>
            </div>

            <div className="text-xs space-y-2">
              <input
                type="text"
                value={ps.announcementBannerText ?? ''}
                onChange={(e) =>
                  updateSettings(
                    (curr) => ({
                      ...curr,
                      announcementBannerText: e.target.value,
                    }),
                    'Updated global announcement banner message.'
                  )
                }
                placeholder="e.g. Notice: New Daily & Weekly Ajo cycles open this Monday! Join with your 6-digit code."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-900"
              />
              <p className="text-[11px] text-slate-500">
                When enabled, this announcement bar is displayed at the top of every
                screen across the public and member/organizer website.
              </p>
            </div>
          </div>

          {/* 3. Platform-Wide Feature Toggles */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-700" />
              <span>3. Enable / Disable Website Functional Modules</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {[
                {
                  key: 'allowSelfRegistration' as const,
                  label: 'User Registration',
                  desc: 'Allow visitors to create Member/Organizer accounts',
                },
                {
                  key: 'allowGroupCreation' as const,
                  label: 'Group Creation',
                  desc: 'Allow Organizers to create new Ajo groups',
                },
                {
                  key: 'allowGroupJoining' as const,
                  label: 'Join Group via Code',
                  desc: 'Allow Members to join groups with 6-digit code',
                },
                {
                  key: 'enableScheduleFeature' as const,
                  label: 'Contribution Schedule',
                  desc: 'Enable My Contributions schedule screen',
                },
                {
                  key: 'enableRemindersFeature' as const,
                  label: 'Reminders Center',
                  desc: 'Enable automated & manual payment reminders',
                },
                {
                  key: 'enablePaymentHistoryFeature' as const,
                  label: 'Payment History',
                  desc: 'Enable transaction receipts & history ledger',
                },
                {
                  key: 'showPublicDemoAccounts' as const,
                  label: 'Home Demo Accounts',
                  desc: 'Show sample Member/Organizer accounts on Home',
                },
              ].map((mod) => {
                const isEnabled = ps[mod.key] !== false;
                return (
                  <label
                    key={mod.key}
                    className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-start gap-2.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => {
                        updateSettings(
                          (curr) => ({
                            ...curr,
                            [mod.key]: e.target.checked,
                          }),
                          `Toggled website module "${mod.label}" to ${
                            e.target.checked ? 'ENABLED' : 'DISABLED'
                          }.`
                        );
                        notify(
                          `${mod.label} ${
                            e.target.checked ? 'enabled' : 'disabled'
                          }.`,
                          'info'
                        );
                      }}
                      className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">{mod.label}</p>
                      <p className="text-[11px] text-slate-500">{mod.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Add & Edit Website Feature Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span>4. Website Feature Cards ({features.length})</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Edit existing feature cards or add new feature cards displayed on the
              website homepage.
            </p>
          </div>
        </div>

        {/* Existing Feature Cards Editor */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.id}
              className={`rounded-2xl border p-4 space-y-3 text-xs ${
                f.enabled
                  ? 'border-slate-200 bg-slate-50/50'
                  : 'border-slate-200 bg-slate-100 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={f.badge}
                  onChange={(e) =>
                    handleUpdateFeatureCard(f.id, { badge: e.target.value })
                  }
                  className="font-mono text-[11px] font-bold text-emerald-700 bg-white border border-slate-200 rounded-lg px-2 py-1 w-36"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateFeatureCard(f.id, { enabled: !f.enabled })
                    }
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                    title={f.enabled ? 'Hide feature' : 'Show feature'}
                  >
                    {f.enabled ? (
                      <Eye className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFeatureCard(f.id, f.title)}
                    className="p-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600"
                    title="Delete feature card"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Feature Title
                </label>
                <input
                  type="text"
                  value={f.title}
                  onChange={(e) =>
                    handleUpdateFeatureCard(f.id, { title: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={f.description}
                  onChange={(e) =>
                    handleUpdateFeatureCard(f.id, {
                      description: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add New Feature Card Form */}
        <form
          onSubmit={handleAddFeatureCard}
          className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-3 items-end text-xs"
        >
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              New Badge / Tag
            </label>
            <input
              type="text"
              value={newBadge}
              onChange={(e) => setNewBadge(e.target.value)}
              placeholder="04. PAYOUTS"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-slate-900"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              New Feature Title
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Automated Rotational Payouts"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Feature Description
            </label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Describe how this feature helps members & organizers..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>
          <button
            type="submit"
            className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Feature Card</span>
          </button>
        </form>
      </div>

      {/* 5. Add Custom Website Sections / Blocks */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
        <div>
          <h4 className="text-base font-bold text-slate-900">
            5. Add Custom Sections / Content Blocks to the Website
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Create custom informational sections, rules, FAQs, or promotional blocks
            that appear on the public homepage.
          </p>
        </div>

        {customSections.length > 0 && (
          <div className="space-y-3">
            {customSections.map((sec) => (
              <div
                key={sec.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <p className="font-mono text-[11px] font-bold text-emerald-700 uppercase">
                    {sec.subtitle} {sec.enabled ? '· LIVE' : '· HIDDEN'}
                  </p>
                  <p className="text-sm font-bold text-slate-900">{sec.title}</p>
                  <p className="text-slate-600">{sec.content}</p>
                  {sec.ctaLabel && (
                    <p className="text-[11px] font-mono text-slate-500">
                      Button: &ldquo;{sec.ctaLabel}&rdquo; → {sec.ctaTargetScreen}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleCustomSection(sec.id)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 font-semibold text-slate-700"
                  >
                    {sec.enabled ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomSection(sec.id, sec.title)}
                    className="px-3 py-1.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 font-semibold text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleAddCustomSection}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"
        >
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Section Title
            </label>
            <input
              type="text"
              value={secTitle}
              onChange={(e) => setSecTitle(e.target.value)}
              placeholder="e.g. How Ajo Woman Daily Contribution Works"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Section Subtitle / Badge
            </label>
            <input
              type="text"
              value={secSubtitle}
              onChange={(e) => setSecSubtitle(e.target.value)}
              placeholder="e.g. COMMUNITY SAVINGS GUIDE"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block font-medium text-slate-700 mb-1">
              Section Content / Body Text
            </label>
            <textarea
              rows={3}
              value={secContent}
              onChange={(e) => setSecContent(e.target.value)}
              placeholder="Enter detailed information, group guidelines, or new feature announcements..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Optional Action Button Label
            </label>
            <input
              type="text"
              value={secCtaLabel}
              onChange={(e) => setSecCtaLabel(e.target.value)}
              placeholder="e.g. Join a Group Today"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Button Target Screen
            </label>
            <div className="flex gap-2">
              <select
                value={secCtaTarget}
                onChange={(e) =>
                  setSecCtaTarget(
                    e.target.value as
                      | 'LOGIN'
                      | 'REGISTER'
                      | 'JOIN_GROUP'
                      | 'MAKE_PAYMENT'
                  )
                }
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-900"
              >
                <option value="REGISTER">Register Account</option>
                <option value="LOGIN">Login Screen</option>
                <option value="JOIN_GROUP">Join Group</option>
                <option value="MAKE_PAYMENT">Make Payment</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold whitespace-nowrap inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Publish Section</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 6. Quick Add User & Quick Add Group */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-700" />
            <span>6. Add New User Account Directly</span>
          </h4>
          <form onSubmit={handleQuickCreateUser} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Amina Bello"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-900"
                >
                  <option value="MEMBER">MEMBER</option>
                  <option value="ORGANIZER">ORGANIZER</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="amina@example.com"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  placeholder="08030000000"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-slate-900"
                />
              </div>
            </div>
            <button
              type="submit"
              className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Create User Account</span>
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-emerald-700" />
            <span>7. Add New Contribution Group Directly</span>
          </h4>
          <form onSubmit={handleQuickCreateGroup} className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Group Name
              </label>
              <input
                type="text"
                required
                value={newGrpName}
                onChange={(e) => setNewGrpName(e.target.value)}
                placeholder="e.g. Abuja Women Petty Traders Ajo"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Amount (₦)
                </label>
                <input
                  type="number"
                  required
                  value={newGrpAmount}
                  onChange={(e) => setNewGrpAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-slate-900"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Frequency
                </label>
                <select
                  value={newGrpFreq}
                  onChange={(e) =>
                    setNewGrpFreq(e.target.value as ContributionFrequency)
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
                  Max Members
                </label>
                <input
                  type="number"
                  required
                  value={newGrpMax}
                  onChange={(e) => setNewGrpMax(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-slate-900"
                />
              </div>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={newGrpDesc}
                onChange={(e) => setNewGrpDesc(e.target.value)}
                placeholder="Short description of the group savings goal..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
            <button
              type="submit"
              className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Contribution Group</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
