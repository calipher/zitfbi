import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useBI } from '../context/BIContext';
import { ActiveSessionInfo, UserProfile, UserRole } from '../types';
import { ROLE_POLICIES, getRolePermissions } from '../utils/rbac';
import {
  Plus,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  X,
  SlidersHorizontal,
  Edit2,
  Trash2,
  KeyRound,
  Ban,
  ArrowLeft,
  Search,
  Download,
  RefreshCw,
  Eye,
  Lock,
  AlertCircle,
} from 'lucide-react';

type UserMgmtTab = 'directory' | 'sessions' | 'rbac' | 'audit';

const ALL_ROLES: UserRole[] = [
  'Super Administrator',
  'Executive Management',
  'Department Manager',
  'Data Analyst',
  'Data Entry Officer',
  'External Stakeholder / Viewer',
];

function formatShortTimestamp(iso?: string): string {
  if (!iso) return '—';
  return iso.replace('T', ' ').substring(0, 16);
}

export const UserManagement: React.FC = () => {
  const {
    users,
    addUser,
    updateUser,
    deleteUser,
    currentUser,
    impersonatedByUserId,
    impersonateUser,
    switchRole,
    resetUserPassword,
    revokeUserSessions,
    fetchActiveSessions,
    revokeSessionById,
    auditLogs,
    can,
  } = useBI();

  const canManageUsers = can('users:manage');
  const canImpersonate = currentUser.role === 'Super Administrator' || Boolean(impersonatedByUserId);

  const [activeSubTab, setActiveSubTab] = useState<UserMgmtTab>('directory');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [auditSearch, setAuditSearch] = useState('');

  // Active SQLite Sessions state
  const [activeSessions, setActiveSessions] = useState<ActiveSessionInfo[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Selected user inspection modal + RBAC inspector role
  const [inspectedUser, setInspectedUser] = useState<UserProfile | null>(null);
  const [selectedRbacRole, setSelectedRbacRole] = useState<UserRole>('Super Administrator');

  // Provision / Edit User modal state
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<UserProfile> & { password?: string }>({
    name: '',
    email: '',
    role: 'Data Analyst',
    department: 'Business Intelligence & Strategy',
    isActive: true,
    password: '',
  });

  // Admin password reset modal state
  const [resetTargetUser, setResetTargetUser] = useState<UserProfile | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resetModalError, setResetModalError] = useState<string | null>(null);
  const [isResettingPwd, setIsResettingPwd] = useState(false);

  const [securityNotice, setSecurityNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const list = await fetchActiveSessions();
      setActiveSessions(list);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [fetchActiveSessions]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions, users.length, currentUser.id]);

  // Keep inspected user in sync if edited
  useEffect(() => {
    if (!inspectedUser) return;
    const latest = users.find((u) => u.id === inspectedUser.id);
    if (latest) {
      setInspectedUser(latest);
    } else {
      setInspectedUser(null);
    }
  }, [users, inspectedUser]);

  const sessionsByUserId = useMemo(() => {
    const map = new Map<string, ActiveSessionInfo[]>();
    for (const s of activeSessions) {
      const arr = map.get(s.userId) || [];
      arr.push(s);
      map.set(s.userId, arr);
    }
    return map;
  }, [activeSessions]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;
      if (q) {
        const match =
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.department.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const securityAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs
      .filter((log) => {
        const isSecurityLog =
          log.module === 'User Management' ||
          log.module === 'Security & Authentication' ||
          log.module === 'Security & RBAC' ||
          log.action.toLowerCase().includes('user') ||
          log.action.toLowerCase().includes('password') ||
          log.action.toLowerCase().includes('session') ||
          log.action.toLowerCase().includes('impersonat') ||
          log.action.toLowerCase().includes('rbac') ||
          log.action.toLowerCase().includes('sign');
        if (!isSecurityLog) return false;
        if (!q) return true;
        return (
          log.userEmail.toLowerCase().includes(q) ||
          log.userRole.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q)
        );
      })
      .slice(0, 60);
  }, [auditLogs, auditSearch]);

  const metrics = useMemo(() => {
    const activeCount = users.filter((u) => u.isActive).length;
    const suspendedCount = users.length - activeCount;
    const privilegedCount = users.filter(
      (u) =>
        u.isActive &&
        (u.role === 'Super Administrator' ||
          u.role === 'Executive Management' ||
          u.role === 'Department Manager')
    ).length;
    const impersonatedCount = activeSessions.filter((s) => Boolean(s.impersonatedByUserId)).length;
    return {
      total: users.length,
      activeCount,
      suspendedCount,
      sessionsTotal: activeSessions.length,
      impersonatedCount,
      privilegedCount,
      securityEventsCount: securityAuditLogs.length,
    };
  }, [users, activeSessions, securityAuditLogs.length]);

  const permissionsMatrix = Object.values(ROLE_POLICIES);
  const inspectedRolePerms = useMemo(
    () => getRolePermissions(selectedRbacRole),
    [selectedRbacRole]
  );

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setModalError(null);
    setFormData({
      name: '',
      email: '',
      role: 'Data Analyst',
      department: 'Business Intelligence & Strategy',
      isActive: true,
      password: '',
    });
    setIsAddUserModalOpen(true);
  };

  const handleOpenEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setModalError(null);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      isActive: user.isActive,
      password: '',
    });
    setIsAddUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!formData.name?.trim() || !formData.email?.trim()) {
      setModalError('Full name and corporate email address are required.');
      return;
    }

    setIsSavingUser(true);
    try {
      if (editingUser) {
        const res = await updateUser(editingUser.id, {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          role: formData.role,
          department: formData.department?.trim() || 'Trade Intelligence',
          isActive: formData.isActive,
        });
        if (!res.ok) {
          setModalError(res.error || 'Could not save user changes.');
          return;
        }
        setSecurityNotice({ ok: true, text: `Updated account profile for ${formData.name.trim()}.` });
      } else {
        const pwd = formData.password?.trim() || undefined;
        if (pwd && pwd.length < 6) {
          setModalError('Initial password must be at least 6 characters.');
          return;
        }
        const res = await addUser({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          role: (formData.role as UserRole) || 'Data Analyst',
          department: formData.department?.trim() || 'Trade Intelligence',
          isActive: true,
          lastLogin: 'Never logged in',
          password: pwd,
        });
        if (!res.ok) {
          setModalError(res.error || 'Could not provision user account.');
          return;
        }
        setSecurityNotice({
          ok: true,
          text: `Provisioned account ${formData.email.trim().toLowerCase()} with ${
            pwd ? 'custom' : 'default UAT (Zitf@2026!)'
          } scrypt credentials.`,
        });
      }

      setIsAddUserModalOpen(false);
      setEditingUser(null);
      void loadSessions();
    } finally {
      setIsSavingUser(false);
    }
  };

  const toggleUserActive = async (user: UserProfile) => {
    if (!canManageUsers) return;
    const res = await updateUser(user.id, { isActive: !user.isActive });
    if (!res.ok) {
      setSecurityNotice({ ok: false, text: res.error || 'Failed to update account status.' });
      return;
    }
    setSecurityNotice({
      ok: true,
      text: !user.isActive
        ? `Reactivated ${user.name} (${user.email}).`
        : `Deactivated ${user.name} and revoked all active sessions on backend.`,
    });
    void loadSessions();
  };

  const handleDeleteUser = async (usr: UserProfile) => {
    const res = await deleteUser(usr.id);
    setConfirmDeleteId(null);
    if (!res.ok) {
      setSecurityNotice({ ok: false, text: res.error || 'Failed to delete user account.' });
      return;
    }
    setSecurityNotice({ ok: true, text: `Deleted user account ${usr.email}.` });
    if (inspectedUser?.id === usr.id) {
      setInspectedUser(null);
    }
    void loadSessions();
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetModalError(null);
    if (!resetTargetUser) return;
    if (resetPasswordInput.length < 6) {
      setResetModalError('New password must be at least 6 characters.');
      return;
    }
    if (resetPasswordInput !== resetPasswordConfirm) {
      setResetModalError('Password confirmation does not match.');
      return;
    }

    setIsResettingPwd(true);
    try {
      const res = await resetUserPassword(resetTargetUser.id, resetPasswordInput);
      if (res.ok) {
        setSecurityNotice({
          ok: true,
          text: `Password updated and active sessions invalidated for ${resetTargetUser.email}.`,
        });
        setResetTargetUser(null);
        setResetPasswordInput('');
        setResetPasswordConfirm('');
        void loadSessions();
      } else {
        setResetModalError(res.error || 'Failed to reset password.');
      }
    } finally {
      setIsResettingPwd(false);
    }
  };

  const handleRevokeAllForUser = async (usr: UserProfile) => {
    const res = await revokeUserSessions(usr.id);
    if (res.ok) {
      setSecurityNotice({ ok: true, text: `All active SQLite sessions revoked for ${usr.email}.` });
      void loadSessions();
    } else {
      setSecurityNotice({ ok: false, text: res.error || 'Failed to revoke sessions.' });
    }
  };

  const handleRevokeSingleSession = async (sess: ActiveSessionInfo) => {
    const res = await revokeSessionById(sess.sessionId);
    if (res.ok) {
      setSecurityNotice({
        ok: true,
        text: `Terminated session ${sess.sessionId} for ${sess.userEmail}.`,
      });
      void loadSessions();
    } else {
      setSecurityNotice({ ok: false, text: res.error || 'Could not terminate session.' });
    }
  };

  const handleExportDirectoryCsv = () => {
    const headers = [
      'User ID',
      'Full Name',
      'Email',
      'Role',
      'Department',
      'Status',
      'Active Sessions',
      'Last Login',
    ];
    const rows = filteredUsers.map((u) => [
      u.id,
      u.name,
      u.email,
      u.role,
      u.department,
      u.isActive ? 'Active' : 'Deactivated',
      String(sessionsByUserId.get(u.id)?.length || 0),
      u.lastLogin,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zitf-user-directory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            User Management &amp; Access Control
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Provision institutional accounts, monitor active SQLite sessions, inspect security audit trails, and enforce 6-role RBAC.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportDirectoryCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Directory CSV</span>
          </button>

          {canManageUsers && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Provision New User</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {securityNotice && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-xs border flex items-center justify-between gap-3 ${
            securityNotice.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {securityNotice.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{securityNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setSecurityNotice(null)}
            aria-label="Dismiss notice"
            className="text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4-Column KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Provisioned Accounts</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{metrics.total}</div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            <span className="text-emerald-700 font-semibold">{metrics.activeCount} active</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className={metrics.suspendedCount > 0 ? 'text-rose-700 font-semibold' : ''}>
              {metrics.suspendedCount} suspended
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Active SQLite Sessions</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.sessionsTotal}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            <span>{metrics.sessionsTotal - metrics.impersonatedCount} standard</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>{metrics.impersonatedCount} impersonated</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Privileged &amp; Sign-Off Roles</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.privilegedCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Admin, Executive &amp; Dept Managers
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Security Audit Events</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.securityEventsCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Logins, password &amp; RBAC actions
          </div>
        </div>
      </div>

      {/* Authenticated Super Admin Impersonation Control */}
      {canImpersonate && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs text-amber-950">
          <div>
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <SlidersHorizontal className="w-4 h-4 text-amber-700" />
              <span>Multi-Role RBAC Session Impersonation (Super Administrator)</span>
            </div>
            <p className="text-amber-900/80 mt-0.5">
              Signed in as <strong className="text-slate-950">{currentUser.name}</strong> ({currentUser.role}). Switching issues a real server-verified SQLite token scoped to that role.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {impersonatedByUserId && (
              <button
                type="button"
                onClick={() => void impersonateUser(null)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold bg-amber-600 text-slate-950 hover:bg-amber-500 cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Return to Admin</span>
              </button>
            )}
            {ALL_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => void switchRole(r)}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  currentUser.role === r
                    ? 'bg-slate-900 text-amber-400'
                    : 'bg-white hover:bg-amber-100 text-slate-800 border border-amber-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Segmented Workspace Sub-Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setActiveSubTab('directory')}
            className={`px-3.5 py-1.5 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'directory'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            User Directory ({users.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('sessions');
              void loadSessions();
            }}
            className={`px-3.5 py-1.5 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'sessions'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active Sessions ({activeSessions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('rbac')}
            className={`px-3.5 py-1.5 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'rbac'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Roles &amp; RBAC Matrix
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('audit')}
            className={`px-3.5 py-1.5 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'audit'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Security Audit Trail ({securityAuditLogs.length})
          </button>
        </div>

        {!canManageUsers && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Read-only directory inspection ({currentUser.role})</span>
          </div>
        )}
      </div>

      {/* TAB 1: User Directory */}
      {activeSubTab === 'directory' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Search & Filter Toolbar */}
          <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, corporate email, role, or department..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-amber-600"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                aria-label="Filter by role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 cursor-pointer"
              >
                <option value="all">All Roles ({users.length})</option>
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['all', 'active', 'inactive'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-md font-medium capitalize cursor-pointer whitespace-nowrap ${
                      statusFilter === st
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st === 'all' ? 'All' : st === 'active' ? 'Active' : 'Suspended'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Directory Table or Empty State */}
          {filteredUsers.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                No accounts match your current search or filter criteria.
              </p>
              <p className="text-xs text-slate-500">
                Clear active filters or provision a new institutional user account.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('all');
                  setStatusFilter('all');
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-600 font-semibold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Account &amp; Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3 text-right">Sessions</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Login</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredUsers.map((usr) => {
                    const userSessions = sessionsByUserId.get(usr.id) || [];
                    const isSelf = usr.id === currentUser.id;
                    return (
                      <tr key={usr.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">
                            {usr.name}
                            {isSelf && (
                              <span className="ml-2 text-[11px] font-medium text-amber-700">
                                · Current User
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">{usr.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>{usr.role}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{usr.department}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                          {userSessions.length}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={!canManageUsers || isSelf}
                            onClick={() => void toggleUserActive(usr)}
                            title={
                              isSelf
                                ? 'Cannot suspend your own active session'
                                : canManageUsers
                                ? 'Toggle account active status'
                                : 'Super Administrator required'
                            }
                            className={`inline-flex items-center gap-1 font-semibold text-xs ${
                              canManageUsers && !isSelf ? 'cursor-pointer hover:underline' : 'cursor-default'
                            } ${usr.isActive ? 'text-emerald-700' : 'text-rose-700'}`}
                          >
                            {usr.isActive ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            <span>{usr.isActive ? 'Active' : 'Suspended'}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-[11px] text-slate-500">
                          {usr.lastLogin}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectedUser(usr)}
                              title="Inspect account permissions & activity"
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Inspect</span>
                            </button>

                            {canManageUsers && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(usr)}
                                  title="Edit profile & role"
                                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded font-medium text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                >
                                  <Edit2 className="w-3 h-3 text-amber-700" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetTargetUser(usr);
                                    setResetPasswordInput('');
                                    setResetPasswordConfirm('');
                                    setResetModalError(null);
                                  }}
                                  title="Reset user password"
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-medium text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                >
                                  <KeyRound className="w-3 h-3 text-slate-600" />
                                  <span>Password</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleRevokeAllForUser(usr)}
                                  title="Revoke all active SQLite sessions"
                                  className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded font-medium text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                >
                                  <Ban className="w-3 h-3" />
                                  <span>Revoke</span>
                                </button>
                              </>
                            )}

                            {canImpersonate && usr.isActive && !isSelf && (
                              <button
                                type="button"
                                onClick={() => void impersonateUser(usr.id)}
                                title="Start server-verified impersonation session"
                                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                              >
                                Impersonate
                              </button>
                            )}

                            {canManageUsers && users.length > 1 && !isSelf && (
                              confirmDeleteId === usr.id ? (
                                <div className="inline-flex items-center gap-1 ml-1">
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteUser(usr)}
                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer whitespace-nowrap"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-1.5 py-1 bg-slate-100 text-slate-600 rounded text-[10px] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(usr.id)}
                                  title="Delete user account"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Active SQLite Sessions */}
      {activeSubTab === 'sessions' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-sm text-slate-900">Active SQLite Authentication Sessions</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live SHA-256 token sessions persisted in <span className="font-mono">user_sessions</span> (24-hour TTL).
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadSessions()}
              disabled={isLoadingSessions}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSessions ? 'animate-spin' : ''}`} />
              <span>{isLoadingSessions ? 'Refreshing...' : 'Refresh Sessions'}</span>
            </button>
          </div>

          {activeSessions.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              No active SQLite user sessions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-600 font-semibold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Session ID</th>
                    <th className="px-4 py-3">User Account</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Session Type</th>
                    <th className="px-4 py-3">Issued</th>
                    <th className="px-4 py-3">Expires</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {activeSessions.map((sess) => (
                    <tr key={sess.sessionId} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                        {sess.sessionId}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{sess.userName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{sess.userEmail}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{sess.userRole}</td>
                      <td className="px-4 py-3">
                        {sess.impersonatedByUserId ? (
                          <span className="text-amber-800 font-semibold">
                            Impersonated by {sess.impersonatedByName || sess.impersonatedByUserId}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">Standard Login</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-[11px] text-slate-500">
                        {formatShortTimestamp(sess.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-[11px] text-slate-500">
                        {formatShortTimestamp(sess.expiresAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {sess.isCurrentSession ? (
                          <span className="text-[11px] font-semibold text-slate-400">
                            Current Session
                          </span>
                        ) : canManageUsers ? (
                          <button
                            type="button"
                            onClick={() => void handleRevokeSingleSession(sess)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                          >
                            Revoke Session
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">View Only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Roles & RBAC Matrix */}
      {activeSubTab === 'rbac' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-bold text-sm text-slate-900">Enterprise RBAC Permission Matrix</h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Enforced identically on frontend navigation and Express REST API endpoints. Click a role row to inspect granular permission scopes.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-700 font-bold text-[11px]">
                  <tr>
                    <th className="px-3 py-2.5">Role Name</th>
                    <th className="px-3 py-2.5 text-center">Exec Dashboard</th>
                    <th className="px-3 py-2.5 text-center">Exhibitors / Visitors</th>
                    <th className="px-3 py-2.5 text-center">Commercial Financials</th>
                    <th className="px-3 py-2.5 text-center">Deal Verification</th>
                    <th className="px-3 py-2.5 text-center">Reports</th>
                    <th className="px-3 py-2.5 text-center">System Admin</th>
                    <th className="px-3 py-2.5 text-right">Accounts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {permissionsMatrix.map((item) => {
                    const count = users.filter((u) => u.role === item.role).length;
                    const isSelected = selectedRbacRole === item.role;
                    return (
                      <tr
                        key={item.role}
                        onClick={() => setSelectedRbacRole(item.role)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-3 py-2.5 font-bold text-slate-900">{item.role}</td>
                        <td className="px-3 py-2.5 text-center">
                          {item.executiveDashboard ? (
                            <span className="text-emerald-700 font-bold">Yes</span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center font-medium">
                          <span
                            className={
                              item.exhibitorsVisitors === 'Full CRUD'
                                ? 'text-slate-900 font-bold'
                                : 'text-slate-500'
                            }
                          >
                            {item.exhibitorsVisitors}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold">
                          <span
                            className={
                              item.commercialFinance === 'Full Invoicing'
                                ? 'text-emerald-800'
                                : item.commercialFinance === 'View Aggregates'
                                ? 'text-blue-800'
                                : 'text-rose-700'
                            }
                          >
                            {item.commercialFinance}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {item.tradeDealVerification ? (
                            <span className="text-emerald-700 font-bold">Authorized</span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {item.reportGeneration ? (
                            <span className="text-emerald-700 font-bold">Authorized</span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {item.systemAdmin ? (
                            <span className="text-amber-700 font-bold">Full Access</span>
                          ) : (
                            <span className="text-slate-400">Restricted</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-700">
                          {count}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Granular Capability Inspector */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Granular API Permissions — {selectedRbacRole}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {inspectedRolePerms.length} enforced capability tokens validated by <span className="font-mono">requirePermission</span> middleware.
                </p>
              </div>
              <select
                aria-label="Select role to inspect"
                value={selectedRbacRole}
                onChange={(e) => setSelectedRbacRole(e.target.value as UserRole)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 cursor-pointer"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs font-mono text-slate-700">
              {inspectedRolePerms.map((perm) => (
                <div
                  key={perm}
                  className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{perm}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Security Audit Trail */}
      {activeSubTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-sm text-slate-900">User &amp; Security Audit Trail</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Immutable SQLite <span className="font-mono">audit_logs</span> scoped to authentication, user lifecycle, and RBAC events.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Filter by email, action, or details..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900"
              />
            </div>
          </div>

          {securityAuditLogs.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              No matching security or user lifecycle events recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-600 font-semibold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {securityAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono tabular-nums text-[11px] text-slate-500 whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-800">
                        {log.userEmail}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{log.userRole}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Account Detail Inspection Modal */}
      {inspectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden text-xs max-h-[90vh] flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <div className="text-sm font-bold">{inspectedUser.name}</div>
                <div className="text-[11px] text-slate-300 font-mono mt-0.5">
                  {inspectedUser.email} · {inspectedUser.role}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedUser(null)}
                aria-label="Close inspection panel"
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {/* Summary Strip */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 pb-3 border-b border-slate-200">
                <span>
                  Department: <strong className="text-slate-900">{inspectedUser.department}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Status:{' '}
                  <strong className={inspectedUser.isActive ? 'text-emerald-700' : 'text-rose-700'}>
                    {inspectedUser.isActive ? 'Active' : 'Suspended'}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Last Login: <span className="font-mono text-slate-900">{inspectedUser.lastLogin}</span>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Active Sessions:{' '}
                  <strong className="font-mono tabular-nums text-slate-900">
                    {(sessionsByUserId.get(inspectedUser.id) || []).length}
                  </strong>
                </span>
              </div>

              {/* Active Sessions for User */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2">Active SQLite Sessions</h4>
                {(sessionsByUserId.get(inspectedUser.id) || []).length === 0 ? (
                  <p className="text-slate-500">No active sessions currently open for this user.</p>
                ) : (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                    {(sessionsByUserId.get(inspectedUser.id) || []).map((s) => (
                      <div key={s.sessionId} className="p-2.5 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-mono text-[11px] text-slate-800">{s.sessionId}</div>
                          <div className="text-[11px] text-slate-500">
                            {s.impersonatedByUserId
                              ? `Impersonated by ${s.impersonatedByName || s.impersonatedByUserId}`
                              : 'Standard Login'}{' '}
                            · Expires {formatShortTimestamp(s.expiresAt)}
                          </div>
                        </div>
                        {canManageUsers && !s.isCurrentSession && (
                          <button
                            type="button"
                            onClick={() => void handleRevokeSingleSession(s)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded font-semibold text-[11px] cursor-pointer"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Role Capabilities */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2">
                  Granted Permissions ({getRolePermissions(inspectedUser.role).length})
                </h4>
                <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-slate-600 leading-relaxed">
                  {getRolePermissions(inspectedUser.role).join(' · ')}
                </div>
              </div>

              {/* User Audit History */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2">Recent Activity &amp; Security Events</h4>
                {(() => {
                  const userLogs = auditLogs
                    .filter(
                      (l) =>
                        l.userEmail.toLowerCase() === inspectedUser.email.toLowerCase() ||
                        l.details.toLowerCase().includes(inspectedUser.email.toLowerCase()) ||
                        l.details.includes(inspectedUser.id)
                    )
                    .slice(0, 8);
                  if (userLogs.length === 0) {
                    return <p className="text-slate-500">No recent audit events logged for this account.</p>;
                  }
                  return (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                      {userLogs.map((l) => (
                        <div key={l.id} className="p-2.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-900">{l.action}</span>
                            <span className="font-mono text-slate-400">{l.timestamp}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5">{l.details}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              {canManageUsers && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const target = inspectedUser;
                      setInspectedUser(null);
                      handleOpenEditModal(target);
                    }}
                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-semibold cursor-pointer"
                  >
                    Edit Account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = inspectedUser;
                      setInspectedUser(null);
                      setResetTargetUser(target);
                      setResetPasswordInput('');
                      setResetPasswordConfirm('');
                      setResetModalError(null);
                    }}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold cursor-pointer"
                  >
                    Reset Password
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setInspectedUser(null)}
                className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provision / Edit User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-sm font-bold">
                {editingUser ? `Edit Account: ${editingUser.name}` : 'Provision New User Account'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAddUserModalOpen(false);
                  setEditingUser(null);
                }}
                aria-label="Close modal"
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-3">
              {modalError && (
                <div
                  role="alert"
                  className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Farai Nyoni"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Corporate Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. f.nyoni@zitf.co.zw"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Initial Password (min 6 chars, optional — defaults to Zitf@2026!)
                  </label>
                  <input
                    type="password"
                    minLength={6}
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Leave blank to assign Zitf@2026!"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Assigned Role</label>
                  <select
                    value={formData.role || 'Data Analyst'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Department</label>
                  <input
                    type="text"
                    required
                    value={formData.department || ''}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              {editingUser && (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Account Status</label>
                  <select
                    value={formData.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="active">Active (Access Allowed)</option>
                    <option value="inactive">Suspended (Access Blocked &amp; Sessions Revoked)</option>
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddUserModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold cursor-pointer hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSavingUser
                    ? 'Saving...'
                    : editingUser
                    ? 'Save User Changes'
                    : 'Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Password Reset Modal */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold">Reset User Password</span>
              </div>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                aria-label="Close password reset modal"
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdminResetPassword} className="p-5 space-y-3">
              <div className="text-slate-600">
                Assign a new password for <strong className="text-slate-900">{resetTargetUser.name}</strong> (
                <span className="font-mono">{resetTargetUser.email}</span>). All active sessions will be revoked.
              </div>

              {resetModalError && (
                <div
                  role="alert"
                  className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{resetModalError}</span>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">New Password (min 6 chars) *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={resetPasswordConfirm}
                  onChange={(e) => setResetPasswordConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPwd}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg font-bold cursor-pointer"
                >
                  {isResettingPwd ? 'Resetting...' : 'Reset & Revoke Sessions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
