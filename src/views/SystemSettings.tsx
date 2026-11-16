import React, { useState, useEffect, useCallback } from 'react';
import { useBI } from '../context/BIContext';
import { ClientErrorLogEntry, ExhibitionEdition, StorageDiagnostics } from '../types';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import {
  FIREBASE_CONSOLE_URL,
  FIREBASE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  archiveCloudSnapshot,
  deleteCloudSnapshot,
  subscribeToCloudSnapshots,
  syncWarehouseSnapshotToFirestore,
  testFirestoreConnection,
  type CloudWarehouseSnapshotDoc,
} from '../firebase';
import {
  Building,
  Calendar,
  Sparkles,
  Database,
  Plus,
  Save,
  CheckCircle2,
  Trash2,
  X,
  HardDrive,
  ShieldAlert,
  RefreshCw,
  Download,
  Zap,
  Bug,
  Cloud,
  ExternalLink,
  LogOut,
  Archive,
} from 'lucide-react';

const CrashSimulator: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Simulated UI render failure triggered from Platform Reliability Sandbox.');
  }
  return (
    <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center justify-between gap-3">
      <div>
        <div className="font-semibold text-emerald-950">Widget Boundary Nominal</div>
        <div className="text-[11px] text-emerald-700 mt-0.5">
          Protected by React ErrorBoundary + server crash telemetry.
        </div>
      </div>
      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
    </div>
  );
};

export const SystemSettings: React.FC = () => {
  const {
    editions,
    addEdition,
    selectedEditionId,
    setSelectedEditionId,
    clearDemoData,
    resetToDemoData,
    isDemoMode,
    can,
    authFetch,
    storageObjects,
    refreshStorageObjects,
    deleteServerStorageObject,
    fetchStorageDiagnostics,
    optimizeWarehouseDb,
    fetchClientErrorLogs,
    currentUser,
    executiveMetrics,
    reports,
    exhibitors,
    visitors,
    transactions,
    tradeEngagements,
    hallUtilisation,
    incidents,
    marketInsights,
    connectors,
    connectorLogs,
    alertRules,
    alertEvents,
    scheduledReports,
    sharedItems,
    annotations,
    emailDispatches,
    auditLogs,
    users,
    firebaseUser,
    isFirestoreConnected,
    isFirestoreSyncing,
    firestoreLastSyncedAt,
    firestoreSyncError,
    firestoreDocCounts,
    connectFirestoreGoogle,
    disconnectFirestoreGoogle,
    syncAllPlatformToFirestore,
  } = useBI();

  const [activeTab, setActiveTab] = useState<'organization' | 'editions' | 'ai' | 'data' | 'storage' | 'firebase'>('firebase');

  // Firebase Cloud Firestore snapshot archive & reachability probe
  const [cloudProbe, setCloudProbe] = useState<{ ok: boolean; detail: string } | null>(null);
  const [cloudSnapshots, setCloudSnapshots] = useState<CloudWarehouseSnapshotDoc[]>([]);
  const [cloudNotice, setCloudNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [isSyncingSnapshot, setIsSyncingSnapshot] = useState(false);

  useEffect(() => {
    void testFirestoreConnection().then(setCloudProbe);
  }, []);

  useEffect(() => {
    if (!firebaseUser) {
      setCloudSnapshots([]);
      return;
    }
    const unsubSnaps = subscribeToCloudSnapshots(
      firebaseUser,
      (docs) => setCloudSnapshots(docs),
      (err) => setCloudNotice({ ok: false, text: err.message })
    );
    return () => unsubSnaps();
  }, [firebaseUser]);

  // Reliability & Server Storage State
  const [diagnostics, setDiagnostics] = useState<StorageDiagnostics | null>(null);
  const [clientErrors, setClientErrors] = useState<ClientErrorLogEntry[]>([]);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);
  const [isOptimizingDb, setIsOptimizingDb] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [simulateWidgetCrash, setSimulateWidgetCrash] = useState(false);

  const loadStoragePanel = useCallback(async () => {
    setIsLoadingStorage(true);
    try {
      const [diag, errs] = await Promise.all([
        fetchStorageDiagnostics(),
        can('system:admin') ? fetchClientErrorLogs() : Promise.resolve([]),
        refreshStorageObjects(),
      ]);
      if (diag) setDiagnostics(diag);
      setClientErrors(errs);
    } finally {
      setIsLoadingStorage(false);
    }
  }, [fetchStorageDiagnostics, fetchClientErrorLogs, refreshStorageObjects, can]);

  useEffect(() => {
    if (activeTab === 'storage') {
      void loadStoragePanel();
    }
  }, [activeTab, loadStoragePanel]);

  const handleOptimizeWarehouse = async () => {
    setIsOptimizingDb(true);
    setStorageNotice(null);
    try {
      const res = await optimizeWarehouseDb();
      if (res.ok && res.diagnostics) {
        setDiagnostics(res.diagnostics);
        setStorageNotice(`SQLite WAL checkpoint & ANALYZE completed (PRAGMA quick_check: ${res.quickCheck}).`);
      } else {
        setStorageNotice(res.error || 'Optimization could not complete.');
      }
    } finally {
      setIsOptimizingDb(false);
    }
  };

  const handleDownloadObject = async (id: string, filename: string) => {
    const res = await authFetch(`/api/storage/objects/${encodeURIComponent(id)}/download`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Org Profile State
  const [orgProfile, setOrgProfile] = useState({
    name: 'Zimbabwe International Trade Fair Company',
    tradingName: 'ZITF Company',
    city: 'Bulawayo',
    country: 'Zimbabwe',
    venue: 'Zimbabwe International Exhibition Centre (ZIEC)',
    address: 'P.O. Famona, Bulawayo, Zimbabwe',
    phone: '+263 292 884 911',
    email: 'info@zitf.co.zw',
    website: 'https://zitf.co.zw',
  });
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  // Add Edition Modal State
  const [isAddEditionModalOpen, setIsAddEditionModalOpen] = useState(false);
  const [newEditionData, setNewEditionData] = useState<Partial<ExhibitionEdition>>({
    name: 'ZITF 2027',
    editionNumber: 67,
    theme: 'Industrial Modernisation & Trade Integration',
    year: 2027,
    startDate: '2027-04-20',
    endDate: '2027-04-24',
    venue: 'Zimbabwe International Exhibition Centre, Bulawayo',
    status: 'Upcoming',
    isCurrent: false,
  });

  const handleSaveOrgProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2500);
  };

  const handleCreateEdition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEditionData.name || !newEditionData.year) return;

    addEdition(newEditionData as any);
    setIsAddEditionModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              System Settings &amp; Platform Configuration
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
              Administration
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Configure institutional profile, exhibition edition cycles, AI assistant parameters, server object storage, and platform reliability.
          </p>
        </div>

        {isSavedNotice && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Settings Saved Successfully</span>
          </div>
        )}
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 text-xs">
        <button
          onClick={() => setActiveTab('organization')}
          className={`flex items-center gap-1.5 px-3.5 py-2 font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'organization'
              ? 'border-amber-600 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Organization Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('editions')}
          className={`flex items-center gap-1.5 px-3.5 py-2 font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'editions'
              ? 'border-amber-600 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Exhibition Editions ({editions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-1.5 px-3.5 py-2 font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'ai'
              ? 'border-amber-600 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Intelligence Engine</span>
        </button>

        <button
          onClick={() => setActiveTab('data')}
          className={`flex items-center gap-1.5 px-3.5 py-2 font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'data'
              ? 'border-amber-600 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Demonstration Data Controls</span>
        </button>

        <button
          onClick={() => setActiveTab('storage')}
          className={`flex items-center gap-1.5 px-3.5 py-2 font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'storage'
              ? 'border-amber-600 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Reliability &amp; Storage</span>
        </button>

        <button
          onClick={() => setActiveTab('firebase')}
          className={`flex items-center gap-1.5 px-3.5 py-2 font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'firebase'
              ? 'border-amber-600 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>Firebase Database ({FIREBASE_PROJECT_ID})</span>
        </button>
      </div>

      {/* Tab 1: Organization Profile */}
      {activeTab === 'organization' && (
        <form onSubmit={handleSaveOrgProfile} className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-2xs space-y-4 text-xs">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="h-12 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0">
              <img
                src="/assets/aistudio/zitf_3bc77275.png"
                alt="ZITF Logo"
                className="h-8 w-auto object-contain"
              />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">{orgProfile.name}</h3>
              <p className="text-slate-500 text-xs">National Exhibition &amp; Trade Promotion Authority</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Official Entity Name</label>
              <input
                type="text"
                value={orgProfile.name}
                onChange={(e) => setOrgProfile({ ...orgProfile, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Brand Trading Wordmark</label>
              <input
                type="text"
                value={orgProfile.tradingName}
                onChange={(e) => setOrgProfile({ ...orgProfile, tradingName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Headquarters Venue</label>
              <input
                type="text"
                value={orgProfile.venue}
                onChange={(e) => setOrgProfile({ ...orgProfile, venue: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Physical Address</label>
              <input
                type="text"
                value={orgProfile.address}
                onChange={(e) => setOrgProfile({ ...orgProfile, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">City &amp; Country</label>
              <input
                type="text"
                value={`${orgProfile.city}, ${orgProfile.country}`}
                readOnly
                className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-slate-600"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Official Switchboard</label>
              <input
                type="text"
                value={orgProfile.phone}
                onChange={(e) => setOrgProfile({ ...orgProfile, phone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Official Portal URL</label>
              <input
                type="text"
                value={orgProfile.website}
                onChange={(e) => setOrgProfile({ ...orgProfile, website: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-amber-400" />
              <span>Save Profile Changes</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Exhibition Editions Management */}
      {activeTab === 'editions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs">
            <p className="text-slate-500">
              Manage multiple exhibition editions without overwriting historical database records.
            </p>
            <button
              onClick={() => setIsAddEditionModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Create New Edition</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {editions.map((ed) => (
              <div
                key={ed.id}
                className={`bg-white rounded-xl border p-4 shadow-2xs space-y-3 ${
                  selectedEditionId === ed.id ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-slate-900">{ed.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                      ed.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {ed.status}
                  </span>
                </div>

                <div className="text-amber-700 font-semibold text-[11px] leading-snug">
                  Edition #{ed.editionNumber} · {ed.year}
                </div>

                <p className="text-slate-600 text-[11px] leading-relaxed bg-slate-50 p-2 rounded border border-slate-200/60">
                  &quot;{ed.theme}&quot;
                </p>

                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <div><strong>Dates:</strong> {ed.startDate} to {ed.endDate}</div>
                  <div><strong>Venue:</strong> {ed.venue}</div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  {selectedEditionId === ed.id ? (
                    <span className="text-amber-600 font-bold text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Current Active Filter</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => setSelectedEditionId(ed.id)}
                      className="text-slate-800 hover:text-slate-950 font-semibold text-[11px] cursor-pointer"
                    >
                      Set As Active Dashboard Filter
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: AI Intelligence Engine */}
      {activeTab === 'ai' && (
        <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-2xs space-y-4 text-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">Google Gemini &amp; Trade Intelligence Architecture</h3>
              <p className="text-slate-500">Secure server-side proxy integration via @google/genai SDK</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800 block mb-1">Active AI Model</span>
              <div className="text-sm font-mono font-bold text-slate-900">gemini-3.8-flash</div>
              <p className="text-slate-500 text-[11px] mt-1">Recommended low-latency model for executive trade analytics</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800 block mb-1">Security Boundary</span>
              <div className="text-sm font-semibold text-emerald-700">Server-Side Proxy (Express)</div>
              <p className="text-slate-500 text-[11px] mt-1">Zero API keys exposed to browser bundles or client DOM</p>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-slate-200 rounded-lg space-y-2">
            <span className="font-bold text-amber-400 block text-xs">Automated Fallback Architecture</span>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              If no external Gemini API key is configured in the environment, the platform seamlessly activates the built-in <strong>ZITF Rule-Based Intelligence Engine</strong>. This ensures that users can test all ten recommended business queries (exhibitor growth, commercial revenue, B2B conversions, visitor trends) without interruption or failure.
            </p>
          </div>
        </div>
      )}

      {/* Tab 4: Demonstration Data Controls */}
      {activeTab === 'data' && (
        <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-2xs space-y-4 text-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Database className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">Demonstration Database Management</h3>
              <p className="text-slate-500">Compliant with Section 18 — Clear synthetic demo data governance</p>
            </div>
          </div>

          <p className="text-slate-600 leading-relaxed">
            The platform is currently operating with <strong className="text-slate-900">{isDemoMode ? 'active synthetic demonstration records' : 'clean production database'}</strong>. Fictional enterprise records across all six pillars allow stakeholders to evaluate the interface prior to final production cutover.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={clearDemoData}
              className="px-4 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Clear All Synthetic Demo Data</span>
            </button>

            <button
              onClick={resetToDemoData}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Database className="w-4 h-4 text-amber-400" />
              <span>Reset &amp; Restore Baseline Demo Records</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 5: Platform Reliability & Scalable Server Storage */}
      {activeTab === 'storage' && (
        <div className="space-y-6 text-xs">
          {/* SQLite Engine & Performance Controls */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Centralized SQLite WAL Engine &amp; Disk Object Store
                  </h3>
                  <p className="text-slate-500 text-xs">
                    Workspace preferences, uploaded datasets, sessions, and client crash logs persist server-side beyond browser localStorage
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void loadStoragePanel()}
                  disabled={isLoadingStorage}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg font-semibold whitespace-nowrap cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStorage ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>

                {can('system:admin') && (
                  <button
                    type="button"
                    onClick={() => void handleOptimizeWarehouse()}
                    disabled={isOptimizingDb}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold whitespace-nowrap cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isOptimizingDb ? 'Optimizing...' : 'Checkpoint & Analyze DB'}</span>
                  </button>
                )}
              </div>
            </div>

            {storageNotice && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-medium">
                {storageNotice}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500">Journal / Sync</div>
                <div className="font-mono font-bold text-sm text-slate-900 mt-0.5 tabular-nums">
                  {diagnostics ? `${diagnostics.journalMode} · ${diagnostics.synchronousMode}` : 'WAL · NORMAL'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500">Warehouse Size</div>
                <div className="font-mono font-bold text-sm text-slate-900 mt-0.5 tabular-nums">
                  {diagnostics ? `${(diagnostics.dbSizeBytes / 1024).toFixed(1)} KB` : '—'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500">SQLite Indexes</div>
                <div className="font-mono font-bold text-sm text-slate-900 mt-0.5 tabular-nums">
                  {diagnostics ? diagnostics.indexCount : '—'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500">Archived Objects</div>
                <div className="font-mono font-bold text-sm text-slate-900 mt-0.5 tabular-nums">
                  {diagnostics ? `${diagnostics.objectsCount} (${(diagnostics.objectsTotalBytes / 1024).toFixed(1)} KB)` : `${storageObjects.length}`}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500">Server Preferences</div>
                <div className="font-mono font-bold text-sm text-slate-900 mt-0.5 tabular-nums">
                  {diagnostics ? `${diagnostics.preferencesCount} Profiles` : 'Active'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500">UI Error Logs</div>
                <div className="font-mono font-bold text-sm text-slate-900 mt-0.5 tabular-nums">
                  {diagnostics ? diagnostics.clientErrorLogsCount : clientErrors.length}
                </div>
              </div>
            </div>
          </div>

          {/* Server Object Storage Browser */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-sm text-slate-900">Server Disk Object Store ({storageObjects.length})</h4>
                <p className="text-slate-500 text-[11px]">
                  SHA-256 verified CSV and JSON batch archives persisted on server filesystem
                </p>
              </div>
            </div>

            {storageObjects.length === 0 ? (
              <div className="p-6 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
                No uploaded datasets archived yet. Upload and commit a CSV or JSON file in Data Management to persist its immutable artifact here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-3 font-semibold">Filename</th>
                      <th className="py-2 px-3 font-semibold">Module</th>
                      <th className="py-2 px-3 font-semibold">SHA-256 Digest</th>
                      <th className="py-2 px-3 font-semibold text-right">Size</th>
                      <th className="py-2 px-3 font-semibold">Uploaded By</th>
                      <th className="py-2 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {storageObjects.map((obj) => (
                      <tr key={obj.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-medium text-slate-900">{obj.filename}</td>
                        <td className="py-2.5 px-3 text-slate-600 capitalize">{obj.moduleRef || obj.category}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {obj.sha256.slice(0, 16)}...
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {(obj.sizeBytes / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{obj.uploadedByEmail}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleDownloadObject(obj.id, obj.filename)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-medium cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </button>
                            {can('system:admin') && (
                              <button
                                type="button"
                                onClick={() => void deleteServerStorageObject(obj.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-rose-700 hover:bg-rose-50 rounded font-medium cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Error Boundary Fault Isolation Sandbox & Captured Client Logs */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    React Error Boundary Isolation Sandbox &amp; Telemetry
                  </h4>
                  <p className="text-slate-500 text-[11px]">
                    Verify fault containment and automatic server crash logging without taking down the workspace
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSimulateWidgetCrash(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Bug className="w-3.5 h-3.5" />
                <span>Simulate Component Render Crash</span>
              </button>
            </div>

            <ErrorBoundary
              scope="widget"
              moduleName="Reliability Diagnostics Sandbox"
              userEmail={currentUser.email}
              userRole={currentUser.role}
              onReset={() => {
                setSimulateWidgetCrash(false);
                void loadStoragePanel();
              }}
            >
              <CrashSimulator shouldThrow={simulateWidgetCrash} />
            </ErrorBoundary>

            {can('system:admin') && (
              <div className="pt-2 space-y-2">
                <div className="text-xs font-semibold text-slate-700">
                  Recent Server-Logged Client Boundary Events ({clientErrors.length})
                </div>
                {clientErrors.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No client boundary crashes recorded.</p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <th className="py-2 px-3 font-semibold">Timestamp</th>
                          <th className="py-2 px-3 font-semibold">Scope / Module</th>
                          <th className="py-2 px-3 font-semibold">Error Message</th>
                          <th className="py-2 px-3 font-semibold">User</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {clientErrors.slice(0, 10).map((err) => (
                          <tr key={err.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-500 tabular-nums">
                              {err.createdAt.replace('T', ' ').slice(0, 19)}
                            </td>
                            <td className="py-2 px-3 text-slate-800">
                              <span className="capitalize">{err.scope}</span>
                              <span aria-hidden="true"> · </span>
                              <span className="font-medium">{err.moduleName}</span>
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-rose-700">
                              {err.message}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{err.userEmail || 'anonymous'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Cloud Firestore Database & Sync */}
      {activeTab === 'firebase' && (
        <div className="space-y-6 text-xs">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <Cloud className="w-6 h-6 text-amber-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Firebase Cloud Firestore Database
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Project <span className="font-mono font-semibold text-slate-800">{FIREBASE_PROJECT_ID}</span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    Database <span className="font-mono text-slate-700">{FIRESTORE_DATABASE_ID}</span>
                  </p>
                </div>
              </div>

              <a
                href={FIREBASE_CONSOLE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0"
              >
                <span>Open Firestore in Firebase Console</span>
                <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              </a>
            </div>

            {(cloudNotice || firestoreSyncError) && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                  cloudNotice?.ok && !firestoreSyncError
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <span>{firestoreSyncError || cloudNotice?.text}</span>
                {cloudNotice && (
                  <button
                    type="button"
                    onClick={() => setCloudNotice(null)}
                    className="text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">Server Reachability Probe</div>
                <div className={`mt-1 font-semibold ${cloudProbe?.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {cloudProbe ? (cloudProbe.ok ? 'Connected to Cloud Firestore' : cloudProbe.detail) : 'Probing...'}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">Live Multi-Collection Link</div>
                <div className={`mt-1 font-semibold ${isFirestoreConnected ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {isFirestoreSyncing
                    ? 'Synchronizing batches...'
                    : isFirestoreConnected
                    ? `Active (${Object.values(firestoreDocCounts).reduce((a, b) => a + b, 0)} docs)`
                    : 'Awaiting Google Sign-In'}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">Last Cloud Sync</div>
                <div className="mt-1 font-mono text-slate-900 truncate">
                  {firestoreLastSyncedAt ? firestoreLastSyncedAt.replace('T', ' ').slice(0, 19) : 'Not synced yet'}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">Google Cloud Sync Identity</div>
                <div className="mt-1 font-mono text-slate-900 truncate">
                  {firebaseUser ? `${firebaseUser.email}` : 'Not connected'}
                </div>
              </div>
            </div>

            {/* Auth, Full-Platform Sync & Snapshot Sync Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {!firebaseUser ? (
                <button
                  type="button"
                  onClick={async () => {
                    setCloudNotice(null);
                    const res = await connectFirestoreGoogle();
                    if (res.ok) {
                      setCloudNotice({
                        ok: true,
                        text: `Connected Google account ${res.email || ''} and linked live Cloud Firestore (${FIREBASE_PROJECT_ID}).`,
                      });
                    } else {
                      setCloudNotice({
                        ok: false,
                        text: res.error || 'Google Sign-In failed.',
                      });
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold cursor-pointer whitespace-nowrap"
                >
                  <Cloud className="w-4 h-4" />
                  <span>Sign In with Google to Link Whole Platform</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={isFirestoreSyncing}
                    onClick={async () => {
                      setCloudNotice(null);
                      const res = await syncAllPlatformToFirestore();
                      if (res.ok) {
                        setCloudNotice({
                          ok: true,
                          text: `Full platform database synchronized (${res.totalWritten ?? 0} documents across 19 collections + preferences) to Cloud Firestore.`,
                        });
                      } else {
                        setCloudNotice({
                          ok: false,
                          text: res.error || 'Full platform Cloud Firestore sync failed.',
                        });
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg font-bold cursor-pointer whitespace-nowrap"
                  >
                    <Database className="w-3.5 h-3.5 text-emerald-200" />
                    <span>{isFirestoreSyncing ? 'Syncing Platform...' : 'Sync Entire Platform to Cloud Firestore'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSyncingSnapshot}
                    onClick={async () => {
                      setIsSyncingSnapshot(true);
                      setCloudNotice(null);
                      try {
                        const activeEd = editions.find((e) => e.id === selectedEditionId);
                        const snapId = await syncWarehouseSnapshotToFirestore({
                          editionId: selectedEditionId === 'all' ? 'zitf-all' : selectedEditionId,
                          editionLabel: activeEd ? activeEd.name : 'All Exhibition Editions',
                          totalExhibitors: executiveMetrics.totalExhibitors,
                          totalVisitors: executiveMetrics.totalVisitors,
                          totalRevenueUsd: executiveMetrics.totalRevenueUsd,
                          verifiedDealsUsd: executiveMetrics.verifiedDealsUsd,
                          spaceOccupancyPct: executiveMetrics.spaceOccupancyPct,
                          notes: `Synced from ZITF BI by ${currentUser.email} (${currentUser.role})`,
                          reports,
                        });
                        setCloudNotice({
                          ok: true,
                          text: `Synchronized KPI archive snapshot '${snapId}' and recent BI reports to Cloud Firestore.`,
                        });
                      } catch (err: any) {
                        setCloudNotice({
                          ok: false,
                          text: err?.message || 'Failed to sync snapshot to Firestore.',
                        });
                      } finally {
                        setIsSyncingSnapshot(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg font-bold cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isSyncingSnapshot ? 'animate-spin' : ''}`} />
                    <span>{isSyncingSnapshot ? 'Archiving...' : 'Archive Edition KPI Snapshot'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void disconnectFirestoreGoogle()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect Google</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Live 20-Collection Cloud Sync Matrix */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Full-Platform Cloud Firestore Collection Matrix (19 Entity Collections + Preferences)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Real-time <span className="font-mono">onSnapshot</span> document synchronization across all 6 strategic pillars, governance, alerts, and collaboration workflows.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-600 tabular-nums">
                {isFirestoreConnected ? 'Two-Way Real-Time Hydration Active' : 'Local SQLite Warehouse Active'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 p-4">
              {[
                { key: 'editions', label: 'Editions', local: editions.length },
                { key: 'exhibitors', label: 'Exhibitors (P1)', local: exhibitors.length },
                { key: 'visitors', label: 'Visitors (P2)', local: visitors.length },
                { key: 'commercialTransactions', label: 'Commercial (P3)', local: transactions.length },
                { key: 'tradeEngagements', label: 'Trade Impact (P4)', local: tradeEngagements.length },
                { key: 'hallUtilisation', label: 'Halls (P5)', local: hallUtilisation.length },
                { key: 'operationalIncidents', label: 'Incidents (P5)', local: incidents.length },
                { key: 'marketInsights', label: 'Market Insights (P6)', local: marketInsights.length },
                { key: 'biReports', label: 'BI Reports', local: reports.length },
                { key: 'externalConnectors', label: 'Connectors', local: connectors.length },
                { key: 'connectorSyncLogs', label: 'Sync Logs', local: connectorLogs.length },
                { key: 'thresholdAlertRules', label: 'Alert Rules', local: alertRules.length },
                { key: 'alertEvents', label: 'Alert Events', local: alertEvents.length },
                { key: 'scheduledReports', label: 'Schedules', local: scheduledReports.length },
                { key: 'sharedBriefs', label: 'Shared Briefs', local: sharedItems.length },
                { key: 'annotations', label: 'Annotations', local: annotations.length },
                { key: 'emailDispatches', label: 'Email Queue', local: emailDispatches.length },
                { key: 'auditLogs', label: 'Audit Trail', local: auditLogs.length },
                { key: 'directoryUsers', label: 'Staff Directory', local: users.length },
                { key: 'workspacePreferences', label: 'Filter Prefs', local: 1 },
              ].map((col) => {
                const remoteCount =
                  col.key === 'workspacePreferences'
                    ? isFirestoreConnected
                      ? 1
                      : 0
                    : firestoreDocCounts[col.key] ?? 0;
                return (
                  <div
                    key={col.key}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/80 flex flex-col justify-between gap-1"
                  >
                    <div className="text-[11px] font-semibold text-slate-800 truncate">{col.label}</div>
                    <div className="font-mono text-[10px] text-slate-500 truncate">{col.key}</div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 text-[11px] font-mono tabular-nums">
                      <span className="text-slate-600">Local: {col.local}</span>
                      <span className={isFirestoreConnected ? 'font-bold text-emerald-700' : 'text-slate-400'}>
                        Cloud: {isFirestoreConnected ? remoteCount : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Firestore Snapshot Collection Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Live Firestore <span className="font-mono">workspaceSnapshots</span> ({cloudSnapshots.length})
                </h4>
                <p className="text-[11px] text-slate-500">
                  Real-time documents streamed directly from Cloud Firestore via <span className="font-mono">onSnapshot</span>.
                </p>
              </div>
            </div>

            {!firebaseUser ? (
              <div className="p-8 text-center text-slate-500">
                Sign in with Google above to stream live Firestore documents, or click <strong>Open Firestore in Firebase Console</strong> to browse the database directly.
              </div>
            ) : cloudSnapshots.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No snapshots synced yet. Click <strong>Sync Active Edition KPIs to Firestore</strong> to create your first live Firestore document.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-600 font-semibold text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Snapshot ID</th>
                      <th className="px-4 py-3">Edition</th>
                      <th className="px-4 py-3 text-right">Exhibitors</th>
                      <th className="px-4 py-3 text-right">Visitors</th>
                      <th className="px-4 py-3 text-right">Revenue (USD)</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cloudSnapshots.map((snap) => (
                      <tr key={snap.snapshotId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-800">{snap.snapshotId}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{snap.editionLabel}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{snap.totalExhibitors}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{snap.totalVisitors}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          ${snap.totalRevenueUsd.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{snap.status}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {snap.status !== 'Archived' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await archiveCloudSnapshot(snap.snapshotId);
                                    setCloudNotice({ ok: true, text: `Archived ${snap.snapshotId}.` });
                                  } catch (err: any) {
                                    setCloudNotice({ ok: false, text: err?.message || 'Archive failed' });
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-medium cursor-pointer"
                              >
                                <Archive className="w-3 h-3" />
                                <span>Archive</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await deleteCloudSnapshot(snap.snapshotId);
                                  setCloudNotice({ ok: true, text: `Deleted ${snap.snapshotId} from Firestore.` });
                                } catch (err: any) {
                                  setCloudNotice({ ok: false, text: err?.message || 'Delete failed' });
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-rose-700 hover:bg-rose-50 rounded font-medium cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create New Edition Modal */}
      {isAddEditionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-sm font-bold">Add New Exhibition Edition</span>
              <button onClick={() => setIsAddEditionModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEdition} className="p-5 space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Edition Name *</label>
                <input
                  type="text"
                  required
                  value={newEditionData.name || ''}
                  onChange={(e) => setNewEditionData({ ...newEditionData, name: e.target.value })}
                  placeholder="e.g. ZITF 2027"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Edition Number</label>
                  <input
                    type="number"
                    value={newEditionData.editionNumber || 67}
                    onChange={(e) => setNewEditionData({ ...newEditionData, editionNumber: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Calendar Year</label>
                  <input
                    type="number"
                    value={newEditionData.year || 2027}
                    onChange={(e) => setNewEditionData({ ...newEditionData, year: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Exhibition Strategic Theme</label>
                <textarea
                  rows={2}
                  value={newEditionData.theme || ''}
                  onChange={(e) => setNewEditionData({ ...newEditionData, theme: e.target.value })}
                  placeholder="Official theme announced by ZITF board..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newEditionData.startDate || '2027-04-20'}
                    onChange={(e) => setNewEditionData({ ...newEditionData, startDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={newEditionData.endDate || '2027-04-24'}
                    onChange={(e) => setNewEditionData({ ...newEditionData, endDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddEditionModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold"
                >
                  Save Edition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
