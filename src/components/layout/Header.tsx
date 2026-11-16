import React, { useState } from 'react';
import { useBI } from '../../context/BIContext';
import { UserRole } from '../../types';
import { canAccessNavTab } from '../../utils/rbac';
import {
  Menu,
  Search,
  Bell,
  Sparkles,
  ChevronDown,
  ShieldCheck,
  Building2,
  Calendar,
  X,
  UserCheck,
  UserCog,
  SlidersHorizontal,
  LogOut,
  KeyRound,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Cloud,
  RefreshCw,
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onToggleDesktopSidebar?: () => void;
  onOpenMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onToggleDesktopSidebar,
  onOpenMobileSidebar,
}) => {
  const {
    editions,
    selectedEditionId,
    setSelectedEditionId,
    selectedPeriod,
    setSelectedPeriod,
    currentUser,
    impersonatedByUserId,
    impersonateUser,
    switchRole,
    logout,
    changePassword,
    searchQuery,
    setSearchQuery,
    setIsAIAssistantOpen,
    auditLogs,
    alertEvents,
    sharedItems,
    annotations,
    filteredExhibitors,
    filteredVisitors,
    filteredTradeEngagements,
    isFirestoreConnected,
    isFirestoreSyncing,
    connectFirestoreGoogle,
  } = useBI();

  const activeAlerts = alertEvents.filter((a) => a.status === 'Active');
  const pendingReviews = sharedItems.filter(
    (s) => s.workflowStatus === 'In Review' || s.workflowStatus === 'Changes Requested'
  );
  const openAnnotations = annotations.filter((a) => a.status === 'Open');
  const totalNotifCount = activeAlerts.length + pendingReviews.length;

  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Change password modal state
  const [isChangePwdOpen, setIsChangePwdOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdFeedback, setPwdFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [isSavingPwd, setIsSavingPwd] = useState(false);

  const canImpersonate = currentUser.role === 'Super Administrator' || Boolean(impersonatedByUserId);

  const rolesList: UserRole[] = [
    'Super Administrator',
    'Executive Management',
    'Department Manager',
    'Data Analyst',
    'Data Entry Officer',
    'External Stakeholder / Viewer',
  ];

  const hasSearchMatches =
    searchQuery.trim().length > 1 &&
    (filteredExhibitors.length > 0 || filteredVisitors.length > 0 || filteredTradeEngagements.length > 0);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Ignore fullscreen denial inside sandboxed iframes
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdFeedback(null);
    if (newPwd.length < 6) {
      setPwdFeedback({ ok: false, text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdFeedback({ ok: false, text: 'New password and confirmation do not match.' });
      return;
    }
    setIsSavingPwd(true);
    try {
      const res = await changePassword(currentPwd, newPwd);
      if (res.ok) {
        setPwdFeedback({ ok: true, text: 'Password updated successfully.' });
        setCurrentPwd('');
        setNewPwd('');
        setConfirmPwd('');
      } else {
        setPwdFeedback({ ok: false, text: res.error || 'Could not update password.' });
      }
    } finally {
      setIsSavingPwd(false);
    }
  };

  return (
    <>
      {/* AdminLTE v4 Light Top Navbar (app-header navbar) */}
      <header className="bg-white border-b border-slate-200 text-slate-700 sticky top-0 z-30 h-14 flex items-center justify-between px-3 sm:px-4 gap-3 no-print">
        {/* Left: AdminLTE PushMenu Toggle + Quick Top Links */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
            aria-label="Open navigation sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Desktop PushMenu Collapse Toggle */}
          <button
            type="button"
            onClick={onToggleDesktopSidebar}
            className="hidden lg:inline-flex p-2 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
            title="Toggle Sidebar (PushMenu)"
            aria-label="Toggle Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* AdminLTE Top Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => onSelectTab('overview')}
              className={`px-2.5 py-1.5 rounded transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'text-[#0d6efd] font-semibold bg-sky-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Home
            </button>
            {canAccessNavTab(currentUser.role, 'reports') && (
              <button
                type="button"
                onClick={() => onSelectTab('reports')}
                className={`px-2.5 py-1.5 rounded transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'reports'
                    ? 'text-[#0d6efd] font-semibold bg-sky-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Reports
              </button>
            )}
            {canAccessNavTab(currentUser.role, 'data') && (
              <button
                type="button"
                onClick={() => onSelectTab('data')}
                className={`px-2.5 py-1.5 rounded transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'data'
                    ? 'text-[#0d6efd] font-semibold bg-sky-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Warehouse
              </button>
            )}
          </nav>
        </div>

        {/* Center: Global Search + Edition & Period Context Selectors */}
        <div className="flex items-center gap-2 flex-1 justify-end md:justify-center max-w-2xl">
          {/* Global Search Bar */}
          <div className="relative flex-1 max-w-xs hidden sm:block">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                placeholder="Search exhibitors, deals, records..."
                className="w-full bg-slate-100 text-xs text-slate-800 pl-8 pr-7 py-1.5 rounded border border-slate-200 focus:outline-none focus:bg-white focus:border-[#0d6efd] transition-colors placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Autocomplete Search Dropdown */}
            {isSearchFocused && hasSearchMatches && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-md shadow-xl overflow-hidden z-50 text-xs">
                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 font-semibold text-slate-600 flex items-center justify-between">
                  <span>Matching Records for &quot;{searchQuery}&quot;</span>
                  <span className="text-[10px] text-slate-400 font-mono">Esc</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {filteredExhibitors.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      onMouseDown={() => onSelectTab('exhibitors')}
                      className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{e.companyName}</div>
                        <div className="text-[11px] text-slate-500 truncate">{e.sector} · {e.country} · {e.hallStand}</div>
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-sky-700 shrink-0 ml-2">Exhibitor</span>
                    </div>
                  ))}

                  {filteredVisitors.slice(0, 2).map((v) => (
                    <div
                      key={v.id}
                      onMouseDown={() => onSelectTab('visitors')}
                      className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{v.fullName} ({v.organization})</div>
                        <div className="text-[11px] text-slate-500 truncate">{v.category} · {v.country}</div>
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-indigo-700 shrink-0 ml-2">Visitor</span>
                    </div>
                  ))}

                  {filteredTradeEngagements.slice(0, 2).map((t) => (
                    <div
                      key={t.id}
                      onMouseDown={() => onSelectTab('trade')}
                      className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{t.buyerOrg} -&gt; {t.supplierOrg}</div>
                        <div className="text-[11px] text-slate-500 truncate">${t.estimatedValueUsd.toLocaleString()} · {t.opportunityType}</div>
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-emerald-700 shrink-0 ml-2">Trade Deal</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Edition Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs shrink-0">
            <Building2 className="w-3.5 h-3.5 text-[#0d6efd] shrink-0" />
            <select
              aria-label="Exhibition Edition"
              value={selectedEditionId}
              onChange={(e) => setSelectedEditionId(e.target.value)}
              className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer pr-1 max-w-[140px] sm:max-w-none truncate"
            >
              {editions.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.name} ({ed.editionNumber}th)
                </option>
              ))}
              <option value="all">All Editions (Historical)</option>
            </select>
          </div>

          {/* Period Selector */}
          <div className="hidden xl:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs shrink-0">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              aria-label="Reporting Period"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">Full Exhibition (All Days)</option>
              <option value="business_days">Business Days (Days 1–3)</option>
              <option value="public_days">Public Trade Days (Days 4–5)</option>
            </select>
          </div>
        </div>

        {/* Right Navbar Action Strip (AdminLTE Utility Icons & User Menu) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Cloud Firestore Live Sync Trigger */}
          <button
            type="button"
            onClick={() => {
              if (isFirestoreConnected && canAccessNavTab(currentUser.role, 'settings')) {
                onSelectTab('settings');
              } else {
                void connectFirestoreGoogle();
              }
            }}
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isFirestoreConnected
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title={
              isFirestoreConnected
                ? 'Cloud Firestore two-way sync active — click to open database settings'
                : 'Sign in with Google to sync the ZITF BI database to Cloud Firestore'
            }
          >
            {isFirestoreSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            ) : (
              <Cloud className={`w-3.5 h-3.5 ${isFirestoreConnected ? 'text-emerald-600' : 'text-slate-500'}`} />
            )}
            <span className="hidden lg:inline">
              {isFirestoreSyncing ? 'Syncing Cloud...' : isFirestoreConnected ? 'Firestore Live' : 'Link Cloud DB'}
            </span>
          </button>

          {/* Ask AI CTA */}
          <button
            type="button"
            onClick={() => setIsAIAssistantOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0d6efd] hover:bg-blue-700 text-white font-semibold text-xs rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Ask AI</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden sm:inline-flex p-2 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Workspace'}
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Notifications Bell Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                setIsRoleDropdownOpen(false);
              }}
              className="p-2 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 relative transition-colors cursor-pointer"
              title="Threshold Alerts & Collaboration Inbox"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {totalNotifCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {totalNotifCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-md shadow-xl p-3 z-50 text-xs text-slate-700">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="font-bold text-slate-900">Alerts &amp; Audit Activity</span>
                  <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                    {activeAlerts.length} Alert{activeAlerts.length === 1 ? '' : 's'} · {pendingReviews.length} Review{pendingReviews.length === 1 ? '' : 's'}
                  </span>
                </div>

                {activeAlerts.length > 0 && (
                  <div className="py-2 border-b border-slate-100 space-y-1.5 max-h-40 overflow-y-auto">
                    {activeAlerts.slice(0, 3).map((al) => (
                      <div
                        key={al.id}
                        onClick={() => {
                          onSelectTab('reports');
                          setIsNotifOpen(false);
                        }}
                        className="p-2 rounded bg-rose-50 border border-rose-200 cursor-pointer hover:bg-rose-100/70"
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold text-rose-700">
                          <span>{al.severity.toUpperCase()} BREACH</span>
                          <span className="font-mono">{al.triggeredAt}</span>
                        </div>
                        <p className="text-[11px] text-slate-700 mt-0.5 line-clamp-2">{al.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto mt-1">
                  {auditLogs.slice(0, 4).map((log) => (
                    <div key={log.id} className="py-2">
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span className="font-semibold text-slate-800">{log.action}</span>
                        <span className="font-mono">{log.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{log.details}</p>
                      <span className="text-[10px] text-slate-400 font-mono">{log.module} · {log.userRole}</span>
                    </div>
                  ))}
                </div>

                {(pendingReviews.length > 0 || openAnnotations.length > 0) && (
                  <div
                    onClick={() => {
                      onSelectTab('collaborate');
                      setIsNotifOpen(false);
                    }}
                    className="mt-2 p-2 rounded bg-amber-50 border border-amber-200 cursor-pointer hover:bg-amber-100/70"
                  >
                    <div className="text-[10px] font-bold text-amber-800 uppercase">
                      Collaboration Inbox
                    </div>
                    <p className="text-[11px] text-slate-700 mt-0.5">
                      {pendingReviews.length} workflow(s) &amp; {openAnnotations.length} open note(s).
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      onSelectTab('reports');
                      setIsNotifOpen(false);
                    }}
                    className="py-1.5 text-center text-[#0d6efd] hover:bg-sky-50 font-semibold text-[11px] rounded border border-slate-200 cursor-pointer"
                  >
                    Alerts
                  </button>
                  <button
                    onClick={() => {
                      onSelectTab('collaborate');
                      setIsNotifOpen(false);
                    }}
                    className="py-1.5 text-center text-emerald-700 hover:bg-emerald-50 font-semibold text-[11px] rounded border border-slate-200 cursor-pointer"
                  >
                    Collaborate
                  </button>
                  <button
                    onClick={() => {
                      onSelectTab('data');
                      setIsNotifOpen(false);
                    }}
                    className="py-1.5 text-center text-slate-700 hover:bg-slate-100 font-medium text-[11px] rounded border border-slate-200 cursor-pointer"
                  >
                    Audit
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile & Account Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsRoleDropdownOpen(!isRoleDropdownOpen);
                setIsNotifOpen(false);
              }}
              className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors cursor-pointer text-left"
            >
              <div className="w-7 h-7 rounded-full bg-[#343a40] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block">
                <div className="text-xs font-semibold text-slate-800 leading-tight">{currentUser.name}</div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono leading-tight">
                  <ShieldCheck className="w-3 h-3 text-[#0d6efd]" />
                  <span>{currentUser.role}</span>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isRoleDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-md shadow-xl overflow-hidden z-50 text-xs text-slate-700">
                {/* AdminLTE User Dropdown Header Card */}
                <div className="bg-[#0d6efd] text-white p-3.5 text-center">
                  <div className="w-11 h-11 rounded-full bg-white/20 border-2 border-white/40 mx-auto flex items-center justify-center text-base font-bold">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="font-bold text-sm mt-1.5">{currentUser.name}</div>
                  <div className="text-[11px] text-sky-100 font-mono">{currentUser.email}</div>
                  <div className="text-[10px] text-sky-100 mt-0.5">
                    {currentUser.role} · {currentUser.department}
                  </div>
                </div>

                {/* Account Actions */}
                <div className="p-2 border-b border-slate-200 space-y-1">
                  {canAccessNavTab(currentUser.role, 'users') && (
                    <button
                      onClick={() => {
                        setIsRoleDropdownOpen(false);
                        onSelectTab('users');
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-slate-700 hover:bg-slate-100 cursor-pointer font-medium"
                    >
                      <UserCog className="w-3.5 h-3.5 text-[#0d6efd]" />
                      <span>User Management &amp; RBAC</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsRoleDropdownOpen(false);
                      setPwdFeedback(null);
                      setIsChangePwdOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-slate-700 hover:bg-slate-100 cursor-pointer font-medium"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    <span>Change My Password</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsRoleDropdownOpen(false);
                      void logout();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-rose-700 hover:bg-rose-50 cursor-pointer font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-600" />
                    <span>Sign Out Session</span>
                  </button>
                </div>

                {/* Super Admin Impersonation Controls */}
                {canImpersonate && (
                  <div className="p-2 bg-slate-50">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                      <span>Admin Role Impersonation</span>
                      <SlidersHorizontal className="w-3 h-3 text-slate-400" />
                    </div>
                    {impersonatedByUserId && (
                      <button
                        onClick={() => {
                          setIsRoleDropdownOpen(false);
                          void impersonateUser(null);
                        }}
                        className="w-full mt-1 mb-1.5 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Exit to Super Administrator</span>
                      </button>
                    )}
                    <div className="mt-1 space-y-0.5">
                      {rolesList.map((role) => (
                        <button
                          key={role}
                          onClick={() => {
                            setIsRoleDropdownOpen(false);
                            void switchRole(role);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors cursor-pointer ${
                            currentUser.role === role
                              ? 'bg-[#0d6efd] text-white font-semibold'
                              : 'text-slate-700 hover:bg-slate-200/70'
                          }`}
                        >
                          <span>{role}</span>
                          {currentUser.role === role && <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Change Password Modal */}
      {isChangePwdOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-md shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-[#343a40] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-bold">Change Account Password</span>
              </div>
              <button
                onClick={() => setIsChangePwdOpen(false)}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="p-5 space-y-3 text-slate-900">
              <div className="text-[11px] text-slate-500">
                Updating credentials for <span className="font-mono font-semibold text-slate-700">{currentUser.email}</span>
              </div>

              {pwdFeedback && (
                <div
                  className={`p-2.5 rounded border text-xs ${
                    pwdFeedback.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {pwdFeedback.text}
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Current Password *</label>
                <input
                  type="password"
                  required
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">New Password (min 6 chars) *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsChangePwdOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded font-medium cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSavingPwd}
                  className="px-4 py-2 bg-[#0d6efd] hover:bg-blue-700 disabled:opacity-60 text-white rounded font-bold cursor-pointer whitespace-nowrap"
                >
                  {isSavingPwd ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
