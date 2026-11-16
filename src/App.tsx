import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BIProvider, useBI } from './context/BIContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DemoDataNotice } from './components/common/DemoDataNotice';
import { AskZITFAssistant } from './components/ai/AskZITFAssistant';
import { LoginScreen } from './components/auth/LoginScreen';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { canAccessNavTab, getDefaultTabForRole } from './utils/rbac';

// Eager primary view + Code-split secondary modules for fast initial load
import { ExecutiveDashboard } from './views/ExecutiveDashboard';
const ExhibitorIntelligence = lazy(() =>
  import('./views/ExhibitorIntelligence').then((m) => ({ default: m.ExhibitorIntelligence }))
);
const VisitorIntelligence = lazy(() =>
  import('./views/VisitorIntelligence').then((m) => ({ default: m.VisitorIntelligence }))
);
const CommercialIntelligence = lazy(() =>
  import('./views/CommercialIntelligence').then((m) => ({ default: m.CommercialIntelligence }))
);
const TradeImpact = lazy(() =>
  import('./views/TradeImpact').then((m) => ({ default: m.TradeImpact }))
);
const OperationalIntelligence = lazy(() =>
  import('./views/OperationalIntelligence').then((m) => ({ default: m.OperationalIntelligence }))
);
const StrategicMarketInsight = lazy(() =>
  import('./views/StrategicMarketInsight').then((m) => ({ default: m.StrategicMarketInsight }))
);
const ReportsCentre = lazy(() =>
  import('./views/ReportsCentre').then((m) => ({ default: m.ReportsCentre }))
);
const CollaborationHub = lazy(() =>
  import('./views/CollaborationHub').then((m) => ({ default: m.CollaborationHub }))
);
const DataManagement = lazy(() =>
  import('./views/DataManagement').then((m) => ({ default: m.DataManagement }))
);
const DataMiningAnalytics = lazy(() =>
  import('./views/DataMiningAnalytics').then((m) => ({ default: m.DataMiningAnalytics }))
);
const UserManagement = lazy(() =>
  import('./views/UserManagement').then((m) => ({ default: m.UserManagement }))
);
const SystemSettings = lazy(() =>
  import('./views/SystemSettings').then((m) => ({ default: m.SystemSettings }))
);
import { ShieldAlert, ShieldCheck, ArrowLeft, X } from 'lucide-react';

const TAB_META: Record<string, { title: string; group: string }> = {
  overview: { title: 'Executive Dashboard', group: 'Consolidated Executive' },
  mining: { title: 'Data Mining & Forecasting', group: 'Consolidated Executive' },
  exhibitors: { title: 'Exhibitor Intelligence', group: 'Six Strategic Pillars' },
  visitors: { title: 'Visitor Intelligence', group: 'Six Strategic Pillars' },
  commercial: { title: 'Commercial Intelligence', group: 'Six Strategic Pillars' },
  trade: { title: 'Trade Impact', group: 'Six Strategic Pillars' },
  operations: { title: 'Operational Intelligence', group: 'Six Strategic Pillars' },
  market: { title: 'Strategic Market Insight', group: 'Six Strategic Pillars' },
  reports: { title: 'Reports & Threshold Alerts', group: 'Reporting & Admin' },
  collaborate: { title: 'Share & Collaborate', group: 'Reporting & Admin' },
  data: { title: 'Data Management', group: 'Reporting & Admin' },
  users: { title: 'User Management', group: 'Reporting & Admin' },
  settings: { title: 'System Settings', group: 'Reporting & Admin' },
};

const ModuleSuspenseFallback: React.FC = () => (
  <div className="space-y-4 animate-pulse py-4" aria-label="Loading module">
    <div className="h-7 w-64 bg-slate-200 rounded" />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="h-24 bg-slate-200 rounded" />
      <div className="h-24 bg-slate-200 rounded" />
      <div className="h-24 bg-slate-200 rounded" />
      <div className="h-24 bg-slate-200 rounded" />
    </div>
    <div className="h-72 bg-slate-200 rounded" />
  </div>
);

const MainLayout: React.FC = () => {
  const [activeShareToken, setActiveShareToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('share');
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === 'undefined') return 'overview';
    const params = new URLSearchParams(window.location.search);
    return params.get('share') ? 'collaborate' : 'overview';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const {
    isAuthenticated,
    isAuthChecking,
    currentUser,
    impersonatedByUserId,
    impersonateUser,
    rbacBannerError,
    clearRbacError,
    firestoreSyncError,
  } = useBI();

  // Keep active tab valid whenever authenticated user or role changes
  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeShareToken) {
      setActiveTab('collaborate');
      return;
    }
    if (!canAccessNavTab(currentUser.role, activeTab)) {
      setActiveTab(getDefaultTabForRole(currentUser.role));
    }
  }, [isAuthenticated, currentUser.role, activeTab, activeShareToken]);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#343a40] flex flex-col items-center justify-center text-slate-200 gap-3">
        <div className="w-8 h-8 border-2 border-[#0d6efd] border-t-transparent rounded-full animate-spin" />
        <div className="text-xs font-mono tracking-wider uppercase text-slate-300">
          Verifying ZITF Session Credentials...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen pendingShareToken={activeShareToken} />;
  }

  const handleSelectTab = (tab: string) => {
    if (!canAccessNavTab(currentUser.role, tab)) {
      return;
    }
    setActiveTab(tab);
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'overview':
        return <ExecutiveDashboard onNavigate={handleSelectTab} />;
      case 'exhibitors':
        return <ExhibitorIntelligence />;
      case 'visitors':
        return <VisitorIntelligence />;
      case 'commercial':
        return <CommercialIntelligence />;
      case 'trade':
        return <TradeImpact />;
      case 'operations':
        return <OperationalIntelligence />;
      case 'market':
        return <StrategicMarketInsight onNavigate={handleSelectTab} />;
      case 'mining':
        return <DataMiningAnalytics onNavigate={handleSelectTab} />;
      case 'reports':
        return <ReportsCentre onNavigate={handleSelectTab} />;
      case 'collaborate':
        return (
          <CollaborationHub
            onNavigate={handleSelectTab}
            activeShareToken={activeShareToken}
            onClearShareToken={() => setActiveShareToken(null)}
          />
        );
      case 'data':
        return <DataManagement onNavigate={handleSelectTab} />;
      case 'users':
        return <UserManagement />;
      case 'settings':
        return <SystemSettings />;
      default:
        return <ExecutiveDashboard onNavigate={handleSelectTab} />;
    }
  };

  const currentMeta = TAB_META[activeTab] || { title: 'Dashboard', group: 'ZITF BI' };
  const safeHomeTab = getDefaultTabForRole(currentUser.role);

  return (
    <div className="min-h-screen flex bg-[#f4f6f9] text-slate-900 font-sans selection:bg-sky-100 selection:text-sky-900">
      {/* AdminLTE Left Full-Height Dark Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
        isCollapsed={isSidebarCollapsed}
      />

      {/* AdminLTE Right Workspace Wrapper (Navbar + Banners + Content Header + Main + Footer) */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onToggleDesktopSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Active Admin Impersonation Session Banner */}
        {impersonatedByUserId && (
          <div className="bg-amber-950 text-amber-100 border-b border-amber-800 px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs no-print">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Admin RBAC Test Session:</strong> Signed in via Super Administrator impersonation as{' '}
                <strong className="text-white">{currentUser.name}</strong> ({currentUser.role}). Backend API permissions match this role.
              </span>
            </div>
            <button
              onClick={() => void impersonateUser(null)}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Super Admin</span>
            </button>
          </div>
        )}

        {/* Server RBAC Violation Alert Banner */}
        {rbacBannerError && (
          <div
            role="alert"
            className="bg-rose-950 text-rose-100 border-b border-rose-800 px-4 lg:px-6 py-2.5 flex items-center justify-between gap-3 text-xs no-print"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong className="text-white">Server RBAC Policy Enforcement (HTTP 403):</strong> {rbacBannerError}
              </span>
            </div>
            <button
              onClick={clearRbacError}
              aria-label="Dismiss RBAC notice"
              className="p-1 rounded hover:bg-rose-900 text-rose-300 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Cloud Firestore Error Banner (Zero-Silent-Error Surface) */}
        {firestoreSyncError && (
          <div
            role="alert"
            className="bg-amber-950 text-amber-100 border-b border-amber-800 px-4 lg:px-6 py-2.5 flex items-center justify-between gap-3 text-xs no-print"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong className="text-white">Cloud Firestore Sync Warning:</strong> {firestoreSyncError}
              </span>
            </div>
            {canAccessNavTab(currentUser.role, 'settings') && (
              <button
                type="button"
                onClick={() => handleSelectTab('settings')}
                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] cursor-pointer whitespace-nowrap"
              >
                Open Cloud Settings
              </button>
            )}
          </div>
        )}

        {/* Demonstration Data Banner */}
        <DemoDataNotice />

        {/* AdminLTE Content Header & Breadcrumb Bar */}
        <div className="px-4 sm:px-6 pt-4 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 no-print max-w-[1600px] w-full mx-auto">
          <h1 className="text-xl font-semibold tracking-tight text-slate-800">
            {currentMeta.title}
          </h1>

          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => handleSelectTab(safeHomeTab)}
              className="text-[#0d6efd] hover:underline font-medium cursor-pointer"
            >
              Home
            </button>
            <span>/</span>
            <span className="text-slate-500">{currentMeta.group}</span>
            <span>/</span>
            <span className="text-slate-700 font-medium">{currentMeta.title}</span>
          </nav>
        </div>

        {/* Viewport Content Area protected by module-level ErrorBoundary + Suspense */}
        <main className="flex-1 px-4 sm:px-6 pb-6 pt-2 max-w-[1600px] mx-auto w-full">
          <ErrorBoundary
            key={activeTab}
            scope="module"
            moduleName={activeTab}
            userEmail={currentUser.email}
            userRole={currentUser.role}
            onNavigateSafe={() => setActiveTab(getDefaultTabForRole(currentUser.role))}
          >
            <Suspense fallback={<ModuleSuspenseFallback />}>
              {renderActiveView()}
            </Suspense>
          </ErrorBoundary>
        </main>

        {/* AdminLTE Footer */}
        <footer className="bg-white border-t border-slate-200 text-slate-500 text-xs py-2.5 px-4 sm:px-6 no-print flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-[11px]">
            <strong>&copy; {new Date().getFullYear()} ZITF Business Intelligence</strong> · Zimbabwe International Trade Fair Company
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            AdminLTE v4 Workspace · Turning ZITF Data into Decisions
          </div>
        </footer>
      </div>

      {/* Floating Ask ZITF Intelligence AI Assistant Drawer isolated in widget boundary */}
      <ErrorBoundary
        scope="widget"
        moduleName="Ask ZITF Intelligence"
        userEmail={currentUser.email}
        userRole={currentUser.role}
      >
        <AskZITFAssistant />
      </ErrorBoundary>
    </div>
  );
};

export default function App() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  return (
    <BIProvider>
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <MainLayout />
    </BIProvider>
  );
}
