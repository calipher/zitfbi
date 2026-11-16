import React, { useState } from 'react';
import { useBI } from '../../context/BIContext';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  KeyRound,
  Building2,
} from 'lucide-react';

interface UatAccountPreset {
  role: string;
  name: string;
  email: string;
  scope: string;
}

const UAT_PRESET_ACCOUNTS: UatAccountPreset[] = [
  {
    role: 'Super Administrator',
    name: 'Dr. Nicholas Moyo',
    email: 'n.moyo@zitf.co.zw',
    scope: 'Full System Admin, User Management, RBAC & All 6 Pillars',
  },
  {
    role: 'Executive Management',
    name: 'Stella Nkomo',
    email: 's.nkomo@zitf.co.zw',
    scope: 'Executive BI, Deal Verification, Commercial & Approvals',
  },
  {
    role: 'Department Manager',
    name: 'Tariro Chigumba',
    email: 't.chigumba@zitf.co.zw',
    scope: 'Full Operations, Commercial Invoicing & Trade Verification',
  },
  {
    role: 'Data Analyst',
    name: 'Kudakwashe Sibanda',
    email: 'k.sibanda@zitf.co.zw',
    scope: 'Data Mining, Reports & Imports (Commercial Write & Deal Verification Blocked)',
  },
  {
    role: 'Data Entry Officer',
    name: 'Blessing Ndlovu',
    email: 'b.ndlovu@zitf.co.zw',
    scope: 'Exhibitor/Visitor Entry & Imports (Exec BI, Commercial & Reports Blocked)',
  },
  {
    role: 'External Stakeholder / Viewer',
    name: 'ZimTrade Delegate',
    email: 'delegate@zimtrade.co.zw',
    scope: 'View-Only Briefs & Reports (Commercial Financials Redacted, Writes Blocked)',
  },
];

export const LoginScreen: React.FC<{ pendingShareToken?: string | null }> = ({ pendingShareToken }) => {
  const { login } = useBI();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showUatAccounts, setShowUatAccounts] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Please enter your corporate email address and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(email.trim(), password);
      if (!res.ok) {
        setErrorMsg(res.error || 'Authentication failed. Check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillPreset = (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword('Zitf@2026!');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-8 text-slate-900">
      {/* Top Institutional Bar */}
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between text-xs text-slate-400 pb-4">
        <div className="flex items-center gap-2.5">
          <Building2 className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-slate-200">
            Zimbabwe International Trade Fair Company · Bulawayo
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>SQLite Session Auth · RBAC Enforced</span>
        </div>
      </div>

      {/* Main Centered Auth Card */}
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch my-auto">
        {/* Left Brand & Form Column */}
        <div className="lg:col-span-6 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col justify-between">
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="h-12 px-3 py-1.5 bg-slate-900 rounded-xl flex items-center justify-center shrink-0 border border-slate-800 shadow-xs">
                <img
                  src="/assets/aistudio/zitf_3bc77275.png"
                  alt="ZITF Logo"
                  className="h-8 w-auto object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  ZITF Business Intelligence
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authorized Executive &amp; Trade Analytics Portal
                </p>
              </div>
            </div>

            {pendingShareToken && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Shared Brief Protected:</span> Sign in to open brief{' '}
                  <span className="font-mono font-semibold">{pendingShareToken}</span> with your role permissions.
                </div>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="zitf-login-email"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Corporate Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="zitf-login-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. n.moyo@zitf.co.zw"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="zitf-login-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="zitf-login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <span>{isSubmitting ? 'Verifying Credentials...' : 'Sign In to ZITF BI'}</span>
                {!isSubmitting && <ArrowRight className="w-4 h-4 text-amber-400" />}
              </button>
            </form>
          </div>

          <div className="px-6 sm:px-8 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>Scrypt Salted Credential Hashing</span>
            <span className="font-mono text-slate-600">HTTP-Only + Bearer Token</span>
          </div>
        </div>

        {/* Right UAT Role Credential Directory Column */}
        <div className="lg:col-span-6 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-7 text-slate-200 flex flex-col justify-between">
          <div>
            <button
              type="button"
              onClick={() => setShowUatAccounts(!showUatAccounts)}
              className="w-full flex items-center justify-between text-left pb-3 border-b border-slate-800 cursor-pointer"
            >
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  User Acceptance Testing · Provisioned Roles
                </div>
                <h2 className="text-base font-bold text-white mt-0.5">
                  Click any authorized account to fill credentials
                </h2>
              </div>
              {showUatAccounts ? (
                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>

            {showUatAccounts && (
              <div className="mt-4 space-y-2 max-h-[370px] overflow-y-auto pr-1">
                {UAT_PRESET_ACCOUNTS.map((acct) => {
                  const isSelected = email.trim().toLowerCase() === acct.email;
                  return (
                    <button
                      key={acct.email}
                      type="button"
                      onClick={() => handleFillPreset(acct.email)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-950/50 border-amber-500/70'
                          : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-white">{acct.role}</span>
                        <span className="font-mono text-[11px] text-amber-300 shrink-0">
                          {acct.email}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                        {acct.name} · {acct.scope}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>
              Default UAT Password:{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono font-semibold">
                Zitf@2026!
              </code>
            </span>
            <span className="text-slate-500">All API writes &amp; reads verified on backend</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-5xl w-full mx-auto pt-4 text-center text-[11px] text-slate-500">
        &copy; {new Date().getFullYear()} Zimbabwe International Trade Fair (ZITF Company) · &quot;Turning ZITF Data into Decisions&quot;
      </div>
    </div>
  );
};
