import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  ExhibitionEdition,
  Exhibitor,
  Visitor,
  CommercialTransaction,
  TradeEngagement,
  HallUtilisation,
  OperationalIncident,
  MarketInsight,
  BIReport,
  UserProfile,
  AuditLogItem,
  UserRole,
  ExternalConnector,
  ConnectorSyncLog,
  ConnectorTargetModule,
  GovernedImportResult,
  WarehouseStats,
  ThresholdAlertRule,
  AlertEvent,
  ScheduledReportConfig,
  CollaborationTargetType,
  CollaborationWorkflowStatus,
  SharedBriefItem,
  AnnotationComment,
  EmailDispatchLog,
  StorageObjectRecord,
  StorageDiagnostics,
  ClientErrorLogEntry,
  ActiveSessionInfo,
} from '../types';
import { computeNextRunIso } from '../utils/alertsAndSchedules';
import { getRolePermissions, hasPermission, type RbacPermission } from '../utils/rbac';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  auth,
  signInWithGoogleForFirestore,
  signOutFromFirebase,
  subscribeToFirebaseAuth,
  checkFirestoreHasPlatformData,
  syncFullPlatformToFirestore,
  subscribeToPlatformCollections,
  clearDemoDocsInFirestore,
  createCollectionDoc,
  upsertCollectionDoc,
  removeCollectionDoc,
  syncWorkspacePreferencesToFirestore,
  sanitizeId,
  buildEditionPayload,
  buildExhibitorPayload,
  buildVisitorPayload,
  buildTransactionPayload,
  buildTradeEngagementPayload,
  buildIncidentPayload,
  buildMarketInsightPayload,
  buildBIReportPayload,
  buildConnectorPayload,
  buildConnectorLogPayload,
  buildAlertRulePayload,
  buildAlertEventPayload,
  buildScheduledReportPayload,
  buildSharedBriefPayload,
  buildAnnotationPayload,
  buildEmailDispatchPayload,
  buildAuditLogPayload,
  buildDirectoryUserPayload,
} from '../firebase';

const EMPTY_USER_PROFILE: UserProfile = {
  id: '',
  name: '',
  email: '',
  role: 'External Stakeholder / Viewer',
  department: '',
  isActive: false,
  lastLogin: '',
};

export interface ExecutiveMetrics {
  totalExhibitors: number;
  localExhibitors: number;
  internationalExhibitors: number;
  internationalPct: number;
  internationalCountriesCount: number;
  retentionRate: number;
  returningExhibitorsCount: number;
  newExhibitorsCount: number;
  exhibitorSatisfaction: number;
  avgStandAreaSqm: number;
  totalVisitors: number;
  businessVisitors: number;
  publicVisitors: number;
  foreignVisitorsCount: number;
  foreignVisitorCountriesCount: number;
  repeatVisitorsCount: number;
  repeatVisitorPct: number;
  visitorSatisfaction: number;
  totalRevenueUsd: number;
  spaceSalesUsd: number;
  sponsorshipUsd: number;
  auxiliaryRevenueUsd: number;
  outstandingBalanceUsd: number;
  collectionRatePct: number;
  avgRevenuePerExhibitor: number;
  b2bMeetingsCount: number;
  verifiedDealsUsd: number;
  verifiedDealsCount: number;
  reportedDealsUsd: number;
  reportedDealsCount: number;
  facilitatedDealsUsd: number;
  facilitatedOppsCount: number;
  convertedDealsCount: number;
  followUpRatePct: number;
  smeLeadsCount: number;
  totalCapacitySqm: number;
  occupiedSqmTotal: number;
  spaceOccupancyPct: number;
  networkUptimePct: number;
  openIncidentsCount: number;
  resolvedIncidentsCount: number;
}

interface BIContextType {
  // Navigation & Filters
  selectedEditionId: string;
  setSelectedEditionId: (id: string) => void;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  selectedSector: string;
  setSelectedSector: (sector: string) => void;
  geographicFilter: 'all' | 'local' | 'international';
  setGeographicFilter: (geo: 'all' | 'local' | 'international') => void;
  selectedCountry: string;
  setSelectedCountry: (country: string) => void;
  availableCountries: string[];
  isGlobalMapOpen: boolean;
  setIsGlobalMapOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Real Authentication & RBAC Session State
  isAuthenticated: boolean;
  isAuthChecking: boolean;
  authToken: string | null;
  impersonatedByUserId: string | null;
  permissions: RbacPermission[];
  commercialRedacted: boolean;
  rbacBannerError: string | null;
  clearRbacError: () => void;
  can: (permission: RbacPermission) => boolean;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  impersonateUser: (userId: string | null) => Promise<{ ok: boolean; error?: string }>;
  resetUserPassword: (userId: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  revokeUserSessions: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  fetchActiveSessions: () => Promise<ActiveSessionInfo[]>;
  revokeSessionById: (sessionId: string) => Promise<{ ok: boolean; error?: string }>;

  // Active User & Permissions
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  users: UserProfile[];
  switchRole: (role: UserRole) => Promise<void>;

  // Global State Data (Backed by Server SQLite Warehouse)
  editions: ExhibitionEdition[];
  exhibitors: Exhibitor[];
  visitors: Visitor[];
  transactions: CommercialTransaction[];
  tradeEngagements: TradeEngagement[];
  hallUtilisation: HallUtilisation[];
  incidents: OperationalIncident[];
  marketInsights: MarketInsight[];
  reports: BIReport[];
  auditLogs: AuditLogItem[];

  // Server Warehouse Telemetry & Cloud Firestore Live Link
  warehouseStats: WarehouseStats | null;
  isWarehouseLoading: boolean;
  refreshWarehouseState: () => Promise<void>;
  firebaseUser: FirebaseUser | null;
  isFirestoreConnected: boolean;
  isFirestoreSyncing: boolean;
  firestoreLastSyncedAt: string | null;
  firestoreSyncError: string | null;
  firestoreDocCounts: Record<string, number>;
  connectFirestoreGoogle: () => Promise<{ ok: boolean; email?: string; error?: string }>;
  disconnectFirestoreGoogle: () => Promise<void>;
  syncAllPlatformToFirestore: () => Promise<{ ok: boolean; totalWritten?: number; error?: string }>;

  // Filtered views
  filteredExhibitors: Exhibitor[];
  filteredVisitors: Visitor[];
  filteredTransactions: CommercialTransaction[];
  filteredTradeEngagements: TradeEngagement[];
  filteredIncidents: OperationalIncident[];
  filteredMarketInsights: MarketInsight[];

  // Executive Dashboard Aggregated Metrics (100% live-computed, zero benchmark fallbacks)
  executiveMetrics: ExecutiveMetrics;

  // AI Assistant Drawer
  isAIAssistantOpen: boolean;
  setIsAIAssistantOpen: (open: boolean) => void;

  // CRUD Actions
  addExhibitor: (item: Omit<Exhibitor, 'id'>) => void;
  updateExhibitor: (id: string, updates: Partial<Exhibitor>) => void;
  deleteExhibitor: (id: string) => void;

  addVisitor: (item: Omit<Visitor, 'id'>) => void;
  updateVisitor: (id: string, updates: Partial<Visitor>) => void;
  deleteVisitor: (id: string) => void;

  addTransaction: (item: Omit<CommercialTransaction, 'id'>) => void;
  updateTransaction: (id: string, updates: Partial<CommercialTransaction>) => void;
  deleteTransaction: (id: string) => void;

  addTradeEngagement: (item: Omit<TradeEngagement, 'id'>) => void;
  updateTradeEngagement: (id: string, updates: Partial<TradeEngagement>) => void;
  deleteTradeEngagement: (id: string) => void;
  verifyTradeDeal: (id: string, docName?: string) => void;

  addIncident: (item: Omit<OperationalIncident, 'id'>) => void;
  updateIncident: (id: string, updates: Partial<OperationalIncident>) => void;

  addMarketInsight: (item: Omit<MarketInsight, 'id'>) => void;
  addReport: (item: Omit<BIReport, 'id'>) => void;

  addUser: (item: Omit<UserProfile, 'id'> & { password?: string }) => Promise<{ ok: boolean; error?: string }>;
  updateUser: (id: string, updates: Partial<UserProfile>) => Promise<{ ok: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ ok: boolean; error?: string }>;

  addEdition: (item: Omit<ExhibitionEdition, 'id'>) => void;

  // Data Management & Live Connectors
  connectors: ExternalConnector[];
  connectorLogs: ConnectorSyncLog[];
  addConnector: (item: Omit<ExternalConnector, 'id'>) => void;
  updateConnector: (id: string, updates: Partial<ExternalConnector>) => void;
  deleteConnector: (id: string) => void;
  syncConnector: (id: string) => Promise<ConnectorSyncLog>;
  testWebhookPush: (id: string) => Promise<{ ok: boolean; recordsQueued?: number; error?: string }>;
  batchImportRecords: (
    targetModule: ConnectorTargetModule,
    records: any[],
    options?: { skipDuplicates?: boolean }
  ) => Promise<GovernedImportResult>;
  clearDemoData: () => Promise<void>;
  resetToDemoData: () => Promise<void>;
  isDemoMode: boolean;
  logAudit: (action: string, module: string, details: string) => void;

  // Threshold Alerts & Scheduled Reports
  alertRules: ThresholdAlertRule[];
  alertEvents: AlertEvent[];
  scheduledReports: ScheduledReportConfig[];
  addAlertRule: (item: Omit<ThresholdAlertRule, 'id' | 'createdAt'>) => Promise<void>;
  updateAlertRule: (id: string, updates: Partial<ThresholdAlertRule>) => Promise<void>;
  deleteAlertRule: (id: string) => Promise<void>;
  evaluateAlerts: () => Promise<{ triggeredCount: number }>;
  updateAlertEventStatus: (id: string, status: 'Active' | 'Acknowledged' | 'Resolved') => Promise<void>;
  addScheduledReport: (
    item: Omit<ScheduledReportConfig, 'id' | 'createdAt' | 'nextRunAt' | 'runCount'>
  ) => Promise<void>;
  updateScheduledReport: (id: string, updates: Partial<ScheduledReportConfig>) => Promise<void>;
  deleteScheduledReport: (id: string) => Promise<void>;
  runScheduledReportNow: (id: string) => Promise<BIReport | null>;

  // Share, Annotations, Collaborative Workflows & Email Dispatch
  sharedItems: SharedBriefItem[];
  annotations: AnnotationComment[];
  emailDispatches: EmailDispatchLog[];
  shareBrief: (payload: {
    targetType: CollaborationTargetType;
    targetId: string;
    title: string;
    editionId?: string;
    recipientEmails: string[];
    recipientRoles?: UserRole[];
    accessLevel?: SharedBriefItem['accessLevel'];
    note?: string;
    snapshotSummary?: string;
    sendEmail?: boolean;
  }) => Promise<{
    ok: boolean;
    sharedItem?: SharedBriefItem;
    shareUrl?: string;
    emailResult?: { dispatch: EmailDispatchLog; mailtoUrl: string; emlContent: string };
    error?: string;
  }>;
  transitionShareWorkflow: (id: string, workflowStatus: CollaborationWorkflowStatus) => Promise<void>;
  deleteSharedItem: (id: string) => Promise<void>;
  addAnnotation: (payload: {
    targetType: CollaborationTargetType;
    targetId: string;
    targetTitle: string;
    sectionTag: string;
    body: string;
  }) => Promise<AnnotationComment | null>;
  toggleAnnotationStatus: (id: string, status: 'Open' | 'Resolved') => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  sendEmailBrief: (payload: {
    targetType: CollaborationTargetType;
    targetId: string;
    subject: string;
    recipients: string[];
    body: string;
    shareUrl?: string;
  }) => Promise<{
    ok: boolean;
    dispatch?: EmailDispatchLog;
    mailtoUrl?: string;
    emlContent?: string;
    error?: string;
  }>;

  // Scalable Server Storage & Platform Reliability
  storageObjects: StorageObjectRecord[];
  refreshStorageObjects: () => Promise<void>;
  saveFileToServerStorage: (payload: {
    category: StorageObjectRecord['category'];
    filename: string;
    mimeType?: string;
    textContent: string;
    moduleRef?: string;
  }) => Promise<StorageObjectRecord | null>;
  deleteServerStorageObject: (id: string) => Promise<boolean>;
  fetchStorageDiagnostics: () => Promise<StorageDiagnostics | null>;
  optimizeWarehouseDb: () => Promise<{
    ok: boolean;
    quickCheck?: string;
    diagnostics?: StorageDiagnostics;
    error?: string;
  }>;
  fetchClientErrorLogs: () => Promise<ClientErrorLogEntry[]>;
}

const BIContext = createContext<BIContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = 'zitf_auth_token';

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

export const BIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authToken, setAuthToken] = useState<string | null>(() => readStoredToken());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [impersonatedByUserId, setImpersonatedByUserId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<RbacPermission[]>([]);
  const [commercialRedacted, setCommercialRedacted] = useState<boolean>(false);
  const [rbacBannerError, setRbacBannerError] = useState<string | null>(null);

  const [editions, setEditions] = useState<ExhibitionEdition[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUserState] = useState<UserProfile>(EMPTY_USER_PROFILE);
  const [selectedEditionId, setSelectedEditionId] = useState<string>('zitf-2026');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [geographicFilter, setGeographicFilter] = useState<'all' | 'local' | 'international'>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [isGlobalMapOpen, setIsGlobalMapOpen] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState<boolean>(false);

  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [transactions, setTransactions] = useState<CommercialTransaction[]>([]);
  const [tradeEngagements, setTradeEngagements] = useState<TradeEngagement[]>([]);
  const [hallUtilisation, setHallUtilisation] = useState<HallUtilisation[]>([]);
  const [incidents, setIncidents] = useState<OperationalIncident[]>([]);
  const [marketInsights, setMarketInsights] = useState<MarketInsight[]>([]);
  const [reports, setReports] = useState<BIReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [connectors, setConnectors] = useState<ExternalConnector[]>([]);
  const [connectorLogs, setConnectorLogs] = useState<ConnectorSyncLog[]>([]);
  const [alertRules, setAlertRules] = useState<ThresholdAlertRule[]>([]);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReportConfig[]>([]);
  const [sharedItems, setSharedItems] = useState<SharedBriefItem[]>([]);
  const [annotations, setAnnotations] = useState<AnnotationComment[]>([]);
  const [emailDispatches, setEmailDispatches] = useState<EmailDispatchLog[]>([]);
  const [storageObjects, setStorageObjects] = useState<StorageObjectRecord[]>([]);
  const [warehouseStats, setWarehouseStats] = useState<WarehouseStats | null>(null);
  const [isWarehouseLoading, setIsWarehouseLoading] = useState<boolean>(false);
  const prefsHydratedUserRef = React.useRef<string | null>(null);

  // Cloud Firestore Live Integration State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isFirestoreSyncing, setIsFirestoreSyncing] = useState<boolean>(false);
  const [firestoreLastSyncedAt, setFirestoreLastSyncedAt] = useState<string | null>(null);
  const [firestoreSyncError, setFirestoreSyncError] = useState<string | null>(null);
  const [firestoreDocCounts, setFirestoreDocCounts] = useState<Record<string, number>>({});
  const isBootstrappingFirestoreRef = React.useRef<boolean>(false);
  const latestStateRef = React.useRef({
    editions,
    exhibitors,
    visitors,
    transactions,
    tradeEngagements,
    hallUtilisation,
    incidents,
    marketInsights,
    reports,
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
  });
  latestStateRef.current = {
    editions,
    exhibitors,
    visitors,
    transactions,
    tradeEngagements,
    hallUtilisation,
    incidents,
    marketInsights,
    reports,
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
  };

  useEffect(() => {
    const unsub = subscribeToFirebaseAuth((u) => {
      setFirebaseUser(u);
      if (!u) {
        setFirestoreDocCounts({});
        setFirestoreSyncError(null);
      }
    });
    return () => unsub();
  }, []);

  const isFirestoreConnected = Boolean(firebaseUser && firebaseUser.emailVerified);

  const connectFirestoreGoogle = useCallback(async (): Promise<{
    ok: boolean;
    email?: string;
    error?: string;
  }> => {
    setFirestoreSyncError(null);
    try {
      const user = await signInWithGoogleForFirestore();
      return { ok: true, email: user.email || undefined };
    } catch (err: any) {
      const msg = err?.message || 'Google Sign-In failed.';
      setFirestoreSyncError(msg);
      return { ok: false, error: msg };
    }
  }, []);

  const disconnectFirestoreGoogle = useCallback(async () => {
    await signOutFromFirebase();
    setFirestoreDocCounts({});
    setFirestoreSyncError(null);
  }, []);

  const syncAllPlatformToFirestore = useCallback(async (): Promise<{
    ok: boolean;
    totalWritten?: number;
    error?: string;
  }> => {
    if (!auth.currentUser) {
      return { ok: false, error: 'Sign in with Google first to sync to Cloud Firestore.' };
    }
    setIsFirestoreSyncing(true);
    setFirestoreSyncError(null);
    try {
      const res = await syncFullPlatformToFirestore(latestStateRef.current);
      setFirestoreDocCounts(res.collectionCounts);
      setFirestoreLastSyncedAt(new Date().toISOString());
      return { ok: true, totalWritten: res.totalWritten };
    } catch (err: any) {
      const msg = err?.message || 'Cloud Firestore batch sync failed.';
      setFirestoreSyncError(msg);
      return { ok: false, error: msg };
    } finally {
      setIsFirestoreSyncing(false);
    }
  }, []);

  // Attach real-time Firestore collection listeners once both BI workspace auth and Firebase auth are ready
  useEffect(() => {
    if (!isAuthenticated || !firebaseUser || !firebaseUser.emailVerified) return;
    if (isWarehouseLoading || (editions.length === 0 && exhibitors.length === 0)) return;

    let cancelled = false;
    let unsubStreams: (() => void) | null = null;

    const recordCount = (col: string, len: number) => {
      setFirestoreDocCounts((prev) => (prev[col] === len ? prev : { ...prev, [col]: len }));
    };

    const startLiveLink = async () => {
      isBootstrappingFirestoreRef.current = true;
      setFirestoreSyncError(null);
      try {
        const hasRemote = await checkFirestoreHasPlatformData(firebaseUser);
        if (cancelled) return;
        if (!hasRemote) {
          setIsFirestoreSyncing(true);
          const seeded = await syncFullPlatformToFirestore(latestStateRef.current);
          if (!cancelled) {
            setFirestoreDocCounts(seeded.collectionCounts);
            setFirestoreLastSyncedAt(new Date().toISOString());
          }
          setIsFirestoreSyncing(false);
        }
        if (cancelled) return;
        isBootstrappingFirestoreRef.current = false;

        unsubStreams = subscribeToPlatformCollections(firebaseUser, {
          onEditions: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('editions', items.length);
            setEditions(items);
          },
          onExhibitors: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('exhibitors', items.length);
            setExhibitors(items);
          },
          onVisitors: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('visitors', items.length);
            setVisitors(items);
          },
          onTransactions: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('commercialTransactions', items.length);
            setTransactions(items);
          },
          onTradeEngagements: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('tradeEngagements', items.length);
            setTradeEngagements(items);
          },
          onHallUtilisation: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('hallUtilisation', items.length);
            setHallUtilisation(items);
          },
          onIncidents: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('operationalIncidents', items.length);
            setIncidents(items);
          },
          onMarketInsights: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('marketInsights', items.length);
            setMarketInsights(items);
          },
          onReports: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('biReports', items.length);
            setReports(items);
          },
          onConnectors: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('externalConnectors', items.length);
            setConnectors(items);
          },
          onConnectorLogs: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('connectorSyncLogs', items.length);
            setConnectorLogs(items);
          },
          onAlertRules: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('thresholdAlertRules', items.length);
            setAlertRules(items);
          },
          onAlertEvents: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('alertEvents', items.length);
            setAlertEvents(items);
          },
          onScheduledReports: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('scheduledReports', items.length);
            setScheduledReports(items);
          },
          onSharedItems: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('sharedBriefs', items.length);
            setSharedItems(items);
          },
          onAnnotations: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('annotations', items.length);
            setAnnotations(items);
          },
          onEmailDispatches: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('emailDispatches', items.length);
            setEmailDispatches(items);
          },
          onAuditLogs: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('auditLogs', items.length);
            setAuditLogs(items);
          },
          onUsers: (items) => {
            if (isBootstrappingFirestoreRef.current) return;
            recordCount('directoryUsers', items.length);
            setUsers(items);
          },
          onPreferences: (prefs) => {
            if (prefs.selectedEditionId) setSelectedEditionId(prefs.selectedEditionId);
            if (prefs.selectedPeriod) setSelectedPeriod(prefs.selectedPeriod);
            if (prefs.selectedSector) setSelectedSector(prefs.selectedSector);
            if (prefs.geographicFilter) setGeographicFilter(prefs.geographicFilter);
            if (prefs.selectedCountry) setSelectedCountry(prefs.selectedCountry);
          },
          onError: (err) => {
            setFirestoreSyncError(err.message);
          },
        });
        if (!cancelled) {
          setFirestoreLastSyncedAt(new Date().toISOString());
        }
      } catch (err: any) {
        if (!cancelled) {
          setFirestoreSyncError(err?.message || 'Failed to subscribe to Cloud Firestore.');
          setIsFirestoreSyncing(false);
          isBootstrappingFirestoreRef.current = false;
        }
      }
    };

    void startLiveLink();

    return () => {
      cancelled = true;
      isBootstrappingFirestoreRef.current = false;
      if (unsubStreams) unsubStreams();
    };
  }, [isAuthenticated, firebaseUser, isWarehouseLoading, editions.length === 0 && exhibitors.length === 0]);

  const clearRbacError = useCallback(() => setRbacBannerError(null), []);

  const setCurrentUser = useCallback((user: UserProfile) => {
    setCurrentUserState(user);
    setPermissions(getRolePermissions(user.role));
  }, []);

  const clearWarehouseClientData = useCallback(() => {
    setExhibitors([]);
    setVisitors([]);
    setTransactions([]);
    setTradeEngagements([]);
    setHallUtilisation([]);
    setIncidents([]);
    setMarketInsights([]);
    setReports([]);
    setAuditLogs([]);
    setConnectors([]);
    setConnectorLogs([]);
    setAlertRules([]);
    setAlertEvents([]);
    setScheduledReports([]);
    setSharedItems([]);
    setAnnotations([]);
    setEmailDispatches([]);
    setWarehouseStats(null);
    setCommercialRedacted(false);
  }, []);

  const authFetch = useCallback(
    async (input: string, init: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(init.headers || {});
      const token = authToken || readStoredToken();
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await fetch(input, {
        ...init,
        headers,
        credentials: 'include',
      });

      if (res.status === 401 && !input.startsWith('/api/auth/login') && !input.startsWith('/api/auth/session')) {
        writeStoredToken(null);
        setAuthToken(null);
        setIsAuthenticated(false);
        setImpersonatedByUserId(null);
        clearWarehouseClientData();
      } else if (res.status === 403) {
        try {
          const clone = res.clone();
          const body = await clone.json();
          setRbacBannerError(body?.error || 'Action denied by server RBAC policy (HTTP 403 Forbidden).');
        } catch {
          setRbacBannerError('Action denied by server RBAC policy (HTTP 403 Forbidden).');
        }
      }

      return res;
    },
    [authToken, clearWarehouseClientData]
  );

  const applyWarehousePayload = useCallback((data: any) => {
    if (Array.isArray(data.editions)) setEditions(data.editions);
    if (Array.isArray(data.users)) setUsers(data.users);
    if (Array.isArray(data.exhibitors)) setExhibitors(data.exhibitors);
    if (Array.isArray(data.visitors)) setVisitors(data.visitors);
    if (Array.isArray(data.transactions)) setTransactions(data.transactions);
    setCommercialRedacted(Boolean(data.commercialRedacted));
    if (Array.isArray(data.tradeEngagements)) setTradeEngagements(data.tradeEngagements);
    if (Array.isArray(data.hallUtilisation)) setHallUtilisation(data.hallUtilisation);
    if (Array.isArray(data.incidents)) setIncidents(data.incidents);
    if (Array.isArray(data.marketInsights)) setMarketInsights(data.marketInsights);
    if (Array.isArray(data.reports)) setReports(data.reports);
    if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
    if (Array.isArray(data.connectors)) setConnectors(data.connectors);
    if (Array.isArray(data.connectorLogs)) setConnectorLogs(data.connectorLogs);
    if (Array.isArray(data.alertRules)) setAlertRules(data.alertRules);
    if (Array.isArray(data.alertEvents)) setAlertEvents(data.alertEvents);
    if (Array.isArray(data.scheduledReports)) setScheduledReports(data.scheduledReports);
    if (Array.isArray(data.sharedItems)) setSharedItems(data.sharedItems);
    if (Array.isArray(data.annotations)) setAnnotations(data.annotations);
    if (Array.isArray(data.emailDispatches)) setEmailDispatches(data.emailDispatches);
    if (data.stats) setWarehouseStats(data.stats);
  }, []);

  const refreshWarehouseState = useCallback(async (overrideToken?: string) => {
    setIsWarehouseLoading(true);
    try {
      const headers: Record<string, string> = {};
      const t = overrideToken || authToken || readStoredToken();
      if (t) headers['Authorization'] = `Bearer ${t}`;
      const res = await fetch('/api/warehouse/state', { headers, credentials: 'include' });
      if (res.status === 401) {
        writeStoredToken(null);
        setAuthToken(null);
        setIsAuthenticated(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      applyWarehousePayload(data);

      // Hydrate server-persisted workspace preferences & object store list (replaces localStorage)
      const [prefsRes, objsRes] = await Promise.all([
        fetch('/api/storage/preferences', { headers, credentials: 'include' }),
        fetch('/api/storage/objects', { headers, credentials: 'include' }),
      ]);
      if (prefsRes.ok) {
        const prefsData = await prefsRes.json();
        const prefs = prefsData?.preferences;
        if (prefs) {
          prefsHydratedUserRef.current = prefs.userId || null;
          if (prefs.selectedEditionId) setSelectedEditionId(prefs.selectedEditionId);
          if (prefs.selectedPeriod) setSelectedPeriod(prefs.selectedPeriod);
          if (prefs.selectedSector) setSelectedSector(prefs.selectedSector);
          if (prefs.geographicFilter) setGeographicFilter(prefs.geographicFilter);
        }
      }
      if (objsRes.ok) {
        const objsData = await objsRes.json();
        if (Array.isArray(objsData?.objects)) {
          setStorageObjects(objsData.objects);
        }
      }
    } catch (err) {
      console.error('Failed to hydrate centralized warehouse state:', err);
    } finally {
      setIsWarehouseLoading(false);
    }
  }, [applyWarehousePayload, authToken]);

  useEffect(() => {
    let active = true;
    const bootstrapSession = async () => {
      setIsAuthChecking(true);
      try {
        const stored = readStoredToken();
        const headers: Record<string, string> = {};
        if (stored) headers['Authorization'] = `Bearer ${stored}`;
        const res = await fetch('/api/auth/session', { headers, credentials: 'include' });
        if (!active) return;
        if (!res.ok) {
          writeStoredToken(null);
          setAuthToken(null);
          setIsAuthenticated(false);
          setIsAuthChecking(false);
          return;
        }
        const data = await res.json();
        if (data?.authenticated && data?.user) {
          const activeTok = data.token || stored || null;
          writeStoredToken(activeTok);
          setAuthToken(activeTok);
          setCurrentUserState(data.user);
          setPermissions(data.permissions || getRolePermissions(data.user.role));
          setImpersonatedByUserId(data.impersonatedByUserId || null);
          setIsAuthenticated(true);
          await refreshWarehouseState(activeTok || undefined);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        if (active) setIsAuthenticated(false);
      } finally {
        if (active) setIsAuthChecking(false);
      }
    };
    bootstrapSession();
    return () => {
      active = false;
    };
  }, []);

  const can = useCallback(
    (permission: RbacPermission) => hasPermission(currentUser.role, permission),
    [currentUser.role]
  );

  const login = useCallback(
    async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok || !data.user) {
          return { ok: false, error: data.error || 'Authentication failed.' };
        }
        writeStoredToken(data.token);
        setAuthToken(data.token);
        setCurrentUserState(data.user);
        setPermissions(data.permissions || getRolePermissions(data.user.role));
        setImpersonatedByUserId(null);
        setRbacBannerError(null);
        setIsAuthenticated(true);
        await refreshWarehouseState(data.token);
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Unable to connect to authentication server.' };
      }
    },
    [refreshWarehouseState]
  );

  const logout = useCallback(async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore logout transport error
    } finally {
      writeStoredToken(null);
      setAuthToken(null);
      setImpersonatedByUserId(null);
      setPermissions([]);
      setRbacBannerError(null);
      setIsAuthenticated(false);
      clearWarehouseClientData();
    }
  }, [authFetch, clearWarehouseClientData]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authFetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || 'Failed to update password.' };
        }
        void refreshWarehouseState();
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Network error updating password.' };
      }
    },
    [authFetch, refreshWarehouseState]
  );

  const impersonateUser = useCallback(
    async (userId: string | null): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authFetch('/api/auth/impersonate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok || !data.user) {
          return { ok: false, error: data.error || 'Impersonation denied by server RBAC policy.' };
        }
        writeStoredToken(data.token);
        setAuthToken(data.token);
        setCurrentUserState(data.user);
        setPermissions(data.permissions || getRolePermissions(data.user.role));
        setImpersonatedByUserId(data.impersonatedByUserId || null);
        setRbacBannerError(null);
        await refreshWarehouseState(data.token);
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Impersonation failed.' };
      }
    },
    [authFetch, refreshWarehouseState]
  );

  const resetUserPassword = useCallback(
    async (userId: string, newPassword: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authFetch(`/api/auth/users/${encodeURIComponent(userId)}/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword, revokeSessions: true }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || 'Failed to reset user password.' };
        }
        void refreshWarehouseState();
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Network error resetting password.' };
      }
    },
    [authFetch, refreshWarehouseState]
  );

  const revokeUserSessions = useCallback(
    async (userId: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authFetch(`/api/auth/users/${encodeURIComponent(userId)}/revoke-sessions`, {
          method: 'POST',
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || 'Failed to revoke sessions.' };
        }
        void refreshWarehouseState();
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Network error revoking sessions.' };
      }
    },
    [authFetch, refreshWarehouseState]
  );

  const fetchActiveSessions = useCallback(async (): Promise<ActiveSessionInfo[]> => {
    try {
      const res = await authFetch('/api/auth/sessions');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.sessions) ? (data.sessions as ActiveSessionInfo[]) : [];
    } catch {
      return [];
    }
  }, [authFetch]);

  const revokeSessionById = useCallback(
    async (sessionId: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authFetch(`/api/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, {
          method: 'POST',
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || 'Failed to revoke session.' };
        }
        void refreshWarehouseState();
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Network error revoking session.' };
      }
    },
    [authFetch, refreshWarehouseState]
  );

  const persistWarehouse = useCallback(
    async (url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<boolean> => {
      try {
        const res = await authFetch(url, {
          method,
          headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.stats) {
            setWarehouseStats(data.stats);
          }
          return true;
        }
        if (res.status === 403 || res.status === 400) {
          void refreshWarehouseState();
        }
        return false;
      } catch (err) {
        console.error(`Warehouse ${method} ${url} failed:`, err);
        return false;
      }
    },
    [authFetch, refreshWarehouseState]
  );

  const logAudit = useCallback(
    (action: string, module: string, details: string) => {
      if (!isAuthenticated) return;
      const newLog: AuditLogItem = {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        userEmail: currentUser.email,
        userRole: currentUser.role,
        action,
        module,
        details,
      };
      setAuditLogs((prev) => [newLog, ...prev.slice(0, 99)]);
      void persistWarehouse('/api/warehouse/auditLogs', 'POST', newLog);
      if (auth.currentUser) {
        const built = buildAuditLogPayload(newLog, auth.currentUser.uid);
        void createCollectionDoc('auditLogs', built.id, built.data);
      }
    },
    [isAuthenticated, currentUser.email, currentUser.role, persistWarehouse]
  );

  const switchRole = async (role: UserRole) => {
    const matched = users.find((u) => u.role === role && u.isActive);
    if (!matched) {
      setRbacBannerError(`No active user account exists for role '${role}'.`);
      return;
    }
    await impersonateUser(matched.id);
  };

  // Unique participating countries across Exhibitors, Visitors & B2B Trade Engagements
  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    exhibitors.forEach((e) => {
      const c = e.country?.trim();
      if (c) set.add(c);
    });
    visitors.forEach((v) => {
      const c = v.country?.trim();
      if (c) set.add(c);
    });
    tradeEngagements.forEach((te) => {
      const bc = te.buyerCountry?.trim();
      const sc = te.supplierCountry?.trim();
      if (bc) set.add(bc);
      if (sc) set.add(sc);
    });
    return Array.from(set).sort((a, b) => {
      if (a.toLowerCase() === 'zimbabwe') return -1;
      if (b.toLowerCase() === 'zimbabwe') return 1;
      return a.localeCompare(b);
    });
  }, [exhibitors, visitors, tradeEngagements]);

  // Lookup exhibitor country by ID or client company name for Commercial & Operational cross-filtering
  const exhibitorCountryLookup = useMemo(() => {
    const byId = new Map<string, string>();
    const byName = new Map<string, string>();
    exhibitors.forEach((e) => {
      const c = e.country?.trim();
      if (c) {
        byId.set(e.id, c);
        byName.set(e.companyName.trim().toLowerCase(), c);
      }
    });
    return { byId, byName };
  }, [exhibitors]);

  // Filtered dataset calculations
  const filteredExhibitors = useMemo(() => {
    const targetCountry = selectedCountry.trim().toLowerCase();
    return exhibitors.filter((e) => {
      if (selectedEditionId !== 'all' && e.editionId !== selectedEditionId) return false;
      if (selectedSector !== 'all' && e.sector !== selectedSector && e.industry !== selectedSector) return false;
      if (geographicFilter === 'local' && e.country.toLowerCase() !== 'zimbabwe') return false;
      if (geographicFilter === 'international' && e.country.toLowerCase() === 'zimbabwe') return false;
      if (selectedCountry !== 'all' && e.country.trim().toLowerCase() !== targetCountry) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          e.companyName.toLowerCase().includes(q) ||
          e.sector.toLowerCase().includes(q) ||
          e.country.toLowerCase().includes(q) ||
          e.contactPerson.toLowerCase().includes(q) ||
          e.regNumber.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [exhibitors, selectedEditionId, selectedSector, geographicFilter, selectedCountry, searchQuery]);

  const filteredVisitors = useMemo(() => {
    const targetCountry = selectedCountry.trim().toLowerCase();
    return visitors.filter((v) => {
      if (selectedEditionId !== 'all' && v.editionId !== selectedEditionId) return false;
      if (geographicFilter === 'local' && v.country.toLowerCase() !== 'zimbabwe') return false;
      if (geographicFilter === 'international' && v.country.toLowerCase() === 'zimbabwe') return false;
      if (selectedCountry !== 'all' && v.country.trim().toLowerCase() !== targetCountry) return false;
      if (selectedPeriod === 'business_days') {
        const isBiz = v.attendanceDays.some((d) => d.includes('Day 1') || d.includes('Day 2') || d.includes('Day 3'));
        if (!isBiz) return false;
      } else if (selectedPeriod === 'public_days') {
        const isPub = v.attendanceDays.some((d) => d.includes('Day 4') || d.includes('Day 5'));
        if (!isPub) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          v.fullName.toLowerCase().includes(q) ||
          v.organization.toLowerCase().includes(q) ||
          v.country.toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q) ||
          v.visitorRef.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [visitors, selectedEditionId, geographicFilter, selectedCountry, selectedPeriod, searchQuery]);

  const filteredTransactions = useMemo(() => {
    const targetCountry = selectedCountry.trim().toLowerCase();
    return transactions.filter((t) => {
      if (selectedEditionId !== 'all' && t.editionId !== selectedEditionId) return false;
      if (selectedSector !== 'all' && t.sector !== selectedSector) return false;

      const resolvedCountry =
        (t.exhibitorId && exhibitorCountryLookup.byId.get(t.exhibitorId)) ||
        exhibitorCountryLookup.byName.get(t.clientName.trim().toLowerCase()) ||
        'Zimbabwe';

      if (geographicFilter === 'local' && resolvedCountry.toLowerCase() !== 'zimbabwe') return false;
      if (geographicFilter === 'international' && resolvedCountry.toLowerCase() === 'zimbabwe') return false;
      if (selectedCountry !== 'all' && resolvedCountry.toLowerCase() !== targetCountry) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          t.clientName.toLowerCase().includes(q) ||
          t.refNumber.toLowerCase().includes(q) ||
          t.type.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [transactions, selectedEditionId, selectedSector, geographicFilter, selectedCountry, exhibitorCountryLookup, searchQuery]);

  const filteredTradeEngagements = useMemo(() => {
    const targetCountry = selectedCountry.trim().toLowerCase();
    return tradeEngagements.filter((te) => {
      if (selectedEditionId !== 'all' && te.editionId !== selectedEditionId) return false;
      if (selectedSector !== 'all' && te.industry !== selectedSector) return false;
      if (geographicFilter === 'local' && (te.buyerCountry !== 'Zimbabwe' || te.supplierCountry !== 'Zimbabwe')) return false;
      if (geographicFilter === 'international' && te.buyerCountry === 'Zimbabwe' && te.supplierCountry === 'Zimbabwe') return false;
      if (
        selectedCountry !== 'all' &&
        te.buyerCountry.trim().toLowerCase() !== targetCountry &&
        te.supplierCountry.trim().toLowerCase() !== targetCountry
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          te.buyerOrg.toLowerCase().includes(q) ||
          te.supplierOrg.toLowerCase().includes(q) ||
          te.refNumber.toLowerCase().includes(q) ||
          te.opportunityType.toLowerCase().includes(q) ||
          te.description.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [tradeEngagements, selectedEditionId, selectedSector, geographicFilter, selectedCountry, searchQuery]);

  const filteredIncidents = useMemo(() => {
    const countryHalls = new Set<string>();
    if (selectedCountry !== 'all') {
      filteredExhibitors.forEach((e) => {
        const hallPrefix = (e.hallStand || '').split('-')[0]?.trim().toLowerCase();
        if (hallPrefix) countryHalls.add(hallPrefix);
      });
    }
    return incidents.filter((i) => {
      if (selectedEditionId !== 'all' && i.editionId !== selectedEditionId) return false;
      if (selectedCountry !== 'all' && selectedCountry.trim().toLowerCase() !== 'zimbabwe') {
        const area = i.hallOrArea.trim().toLowerCase();
        if (countryHalls.size > 0 && !countryHalls.has(area)) return false;
        if (countryHalls.size === 0) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return i.title.toLowerCase().includes(q) || i.hallOrArea.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [incidents, selectedEditionId, selectedCountry, filteredExhibitors, searchQuery]);

  const filteredMarketInsights = useMemo(() => {
    const targetCountry = selectedCountry.trim().toLowerCase();
    const activeCountrySectors = new Set(filteredExhibitors.map((e) => e.sector));
    return marketInsights.filter((m) => {
      if (selectedSector !== 'all' && m.sector !== selectedSector) return false;
      if (selectedCountry !== 'all' && targetCountry !== 'zimbabwe') {
        const textBlob = `${m.title} ${m.summary} ${m.zimbabweMarketContext}`.toLowerCase();
        const matchesCountry = textBlob.includes(targetCountry) || activeCountrySectors.has(m.sector);
        if (!matchesCountry) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return m.title.toLowerCase().includes(q) || m.summary.toLowerCase().includes(q) || m.sector.toLowerCase().includes(q);
      }
      return true;
    });
  }, [marketInsights, selectedSector, selectedCountry, filteredExhibitors, searchQuery]);

  // Aggregated executive metrics — computed 100% from live SQLite warehouse records (zero benchmark fallbacks)
  const executiveMetrics = useMemo<ExecutiveMetrics>(() => {
    const totalExhibitors = filteredExhibitors.length;
    const intlList = filteredExhibitors.filter((e) => e.country.trim().toLowerCase() !== 'zimbabwe');
    const internationalExhibitors = intlList.length;
    const localExhibitors = Math.max(0, totalExhibitors - internationalExhibitors);
    const internationalPct = totalExhibitors > 0 ? Number(((internationalExhibitors / totalExhibitors) * 100).toFixed(1)) : 0;
    const internationalCountriesCount = new Set(
      intlList.map((e) => e.country.trim()).filter(Boolean)
    ).size;

    const returningExhibitorsCount = filteredExhibitors.filter((e) => e.returningStatus === 'Returning').length;
    const newExhibitorsCount = filteredExhibitors.filter((e) => e.returningStatus === 'New').length;
    const retentionRate =
      totalExhibitors > 0 ? Number(((returningExhibitorsCount / totalExhibitors) * 100).toFixed(1)) : 0;
    const exhibitorSatisfaction =
      totalExhibitors > 0
        ? Number(
            (
              filteredExhibitors.reduce((acc, e) => acc + (Number(e.satisfactionScore) || 0), 0) /
              totalExhibitors
            ).toFixed(1)
          )
        : 0;
    const avgStandAreaSqm =
      totalExhibitors > 0
        ? Number(
            (
              filteredExhibitors.reduce((acc, e) => acc + (Number(e.standSizeSqm) || 0), 0) /
              totalExhibitors
            ).toFixed(1)
          )
        : 0;

    const totalVisitors = filteredVisitors.length;
    const businessVisitors = filteredVisitors.filter(
      (v) => v.category !== 'General Public' && v.category !== 'Students'
    ).length;
    const publicVisitors = Math.max(0, totalVisitors - businessVisitors);
    const foreignVisList = filteredVisitors.filter((v) => v.country.trim().toLowerCase() !== 'zimbabwe');
    const foreignVisitorsCount = foreignVisList.length;
    const foreignVisitorCountriesCount = new Set(
      foreignVisList.map((v) => v.country.trim()).filter(Boolean)
    ).size;
    const repeatVisitorsCount = filteredVisitors.filter((v) => v.repeatVisitor).length;
    const repeatVisitorPct =
      totalVisitors > 0 ? Number(((repeatVisitorsCount / totalVisitors) * 100).toFixed(1)) : 0;
    const visitorSatisfaction =
      totalVisitors > 0
        ? Number(
            (
              filteredVisitors.reduce((acc, v) => acc + (Number(v.feedbackRating) || 0), 0) /
              totalVisitors
            ).toFixed(1)
          )
        : 0;

    const totalRevenueUsd = filteredTransactions.reduce((acc, t) => acc + (Number(t.amountUsd) || 0), 0);
    const spaceSalesUsd = filteredTransactions
      .filter((t) => t.type === 'Exhibition Hall Space')
      .reduce((acc, t) => acc + (Number(t.amountUsd) || 0), 0);
    const sponsorshipUsd = filteredTransactions
      .filter((t) => t.type === 'Sponsorship Agreement')
      .reduce((acc, t) => acc + (Number(t.amountUsd) || 0), 0);
    const auxiliaryRevenueUsd = Math.max(0, totalRevenueUsd - spaceSalesUsd - sponsorshipUsd);
    const outstandingBalanceUsd = filteredTransactions.reduce(
      (acc, t) => acc + (Number(t.outstandingBalanceUsd) || 0),
      0
    );
    const collectionRatePct =
      totalRevenueUsd > 0
        ? Number((((totalRevenueUsd - outstandingBalanceUsd) / totalRevenueUsd) * 100).toFixed(1))
        : 0;
    const avgRevenuePerExhibitor = totalExhibitors > 0 ? Math.round(totalRevenueUsd / totalExhibitors) : 0;

    const b2bMeetingsCount = filteredTradeEngagements.length;
    const verifiedDeals = filteredTradeEngagements.filter((te) => te.verificationStatus === 'Independently Verified');
    const reportedDeals = filteredTradeEngagements.filter((te) => te.verificationStatus === 'Reported by Participant');
    const facilitatedDeals = filteredTradeEngagements.filter(
      (te) => te.verificationStatus === 'Facilitated Opportunity'
    );

    const verifiedDealsUsd = verifiedDeals.reduce((acc, te) => acc + (Number(te.estimatedValueUsd) || 0), 0);
    const verifiedDealsCount = verifiedDeals.length;
    const reportedDealsUsd = reportedDeals.reduce((acc, te) => acc + (Number(te.estimatedValueUsd) || 0), 0);
    const reportedDealsCount = reportedDeals.length;
    const facilitatedDealsUsd = facilitatedDeals.reduce((acc, te) => acc + (Number(te.estimatedValueUsd) || 0), 0);
    const facilitatedOppsCount = facilitatedDeals.length;
    const convertedDealsCount = filteredTradeEngagements.filter(
      (te) => te.engagementStatus === 'Opportunity Converted'
    ).length;
    const followUpRatePct =
      b2bMeetingsCount > 0
        ? Number(
            (
              (filteredTradeEngagements.filter(
                (te) => te.engagementStatus !== 'New' && te.engagementStatus !== 'Closed / Unsuccessful'
              ).length /
                b2bMeetingsCount) *
              100
            ).toFixed(1)
          )
        : 0;

    const smeExhibitorNames = new Set(
      exhibitors.filter((e) => e.category === 'SME / Emerging').map((e) => e.companyName.trim().toLowerCase())
    );
    const smeLeadsCount = filteredTradeEngagements.filter(
      (te) =>
        smeExhibitorNames.has(te.supplierOrg.trim().toLowerCase()) ||
        smeExhibitorNames.has(te.buyerOrg.trim().toLowerCase())
    ).length;

    const totalCapacitySqm = hallUtilisation.reduce((acc, h) => acc + (Number(h.totalCapacitySqm) || 0), 0);
    const occupiedSqmTotal = hallUtilisation.reduce((acc, h) => acc + (Number(h.occupiedSqm) || 0), 0);
    const spaceOccupancyPct =
      totalCapacitySqm > 0 ? Number(((occupiedSqmTotal / totalCapacitySqm) * 100).toFixed(1)) : 0;
    const networkUptimePct =
      hallUtilisation.length > 0
        ? Number(
            (
              hallUtilisation.reduce((acc, h) => acc + (Number(h.wifiUptimePct) || 0), 0) /
              hallUtilisation.length
            ).toFixed(2)
          )
        : 0;
    const openIncidentsCount = filteredIncidents.filter((i) => i.status !== 'Resolved').length;
    const resolvedIncidentsCount = filteredIncidents.filter((i) => i.status === 'Resolved').length;

    return {
      totalExhibitors,
      localExhibitors,
      internationalExhibitors,
      internationalPct,
      internationalCountriesCount,
      retentionRate,
      returningExhibitorsCount,
      newExhibitorsCount,
      exhibitorSatisfaction,
      avgStandAreaSqm,
      totalVisitors,
      businessVisitors,
      publicVisitors,
      foreignVisitorsCount,
      foreignVisitorCountriesCount,
      repeatVisitorsCount,
      repeatVisitorPct,
      visitorSatisfaction,
      totalRevenueUsd,
      spaceSalesUsd,
      sponsorshipUsd,
      auxiliaryRevenueUsd,
      outstandingBalanceUsd,
      collectionRatePct,
      avgRevenuePerExhibitor,
      b2bMeetingsCount,
      verifiedDealsUsd,
      verifiedDealsCount,
      reportedDealsUsd,
      reportedDealsCount,
      facilitatedDealsUsd,
      facilitatedOppsCount,
      convertedDealsCount,
      followUpRatePct,
      smeLeadsCount,
      totalCapacitySqm,
      occupiedSqmTotal,
      spaceOccupancyPct,
      networkUptimePct,
      openIncidentsCount,
      resolvedIncidentsCount,
    };
  }, [
    filteredExhibitors,
    filteredVisitors,
    filteredTransactions,
    filteredTradeEngagements,
    filteredIncidents,
    hallUtilisation,
    exhibitors,
  ]);

  // CRUD Actions (persisted directly to SQLite warehouse + Cloud Firestore when signed in)
  const addExhibitor = (item: Omit<Exhibitor, 'id'>) => {
    const newExh: Exhibitor = {
      ...item,
      id: `exh-${Date.now()}`,
      isDemo: false,
    };
    setExhibitors((prev) => [newExh, ...prev]);
    void persistWarehouse('/api/warehouse/exhibitors', 'POST', newExh);
    if (auth.currentUser) {
      const built = buildExhibitorPayload(newExh, auth.currentUser.uid, true);
      void createCollectionDoc('exhibitors', built.id, built.data);
    }
    logAudit('Create Exhibitor', 'Exhibitor Intelligence', `Added new exhibitor: ${newExh.companyName}`);
  };

  const updateExhibitor = (id: string, updates: Partial<Exhibitor>) => {
    const current = exhibitors.find((e) => e.id === id);
    const merged = current ? { ...current, ...updates } : undefined;
    setExhibitors((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    void persistWarehouse(`/api/warehouse/exhibitors/${encodeURIComponent(id)}`, 'PATCH', updates);
    if (auth.currentUser && merged) {
      const uid = sanitizeId(auth.currentUser.uid);
      const createB = buildExhibitorPayload(merged, uid, true);
      const updateB = buildExhibitorPayload(merged, uid, false);
      void upsertCollectionDoc('exhibitors', createB.id, createB.data, updateB.data);
    }
    logAudit('Update Exhibitor', 'Exhibitor Intelligence', `Updated record for ${id}`);
  };

  const deleteExhibitor = (id: string) => {
    setExhibitors((prev) => prev.filter((e) => e.id !== id));
    void persistWarehouse(`/api/warehouse/exhibitors/${encodeURIComponent(id)}`, 'DELETE');
    if (auth.currentUser) {
      void removeCollectionDoc('exhibitors', id);
    }
    logAudit('Delete Exhibitor', 'Exhibitor Intelligence', `Removed exhibitor ${id}`);
  };

  const addVisitor = (item: Omit<Visitor, 'id'>) => {
    const newVis: Visitor = {
      ...item,
      id: `vis-${Date.now()}`,
      isDemo: false,
    };
    setVisitors((prev) => [newVis, ...prev]);
    void persistWarehouse('/api/warehouse/visitors', 'POST', newVis);
    if (auth.currentUser) {
      const built = buildVisitorPayload(newVis, auth.currentUser.uid, true);
      void createCollectionDoc('visitors', built.id, built.data);
    }
    logAudit('Register Visitor', 'Visitor Intelligence', `Registered visitor ${newVis.fullName}`);
  };

  const updateVisitor = (id: string, updates: Partial<Visitor>) => {
    const current = visitors.find((v) => v.id === id);
    const merged = current ? { ...current, ...updates } : undefined;
    setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, ...updates } : v)));
    void persistWarehouse(`/api/warehouse/visitors/${encodeURIComponent(id)}`, 'PATCH', updates);
    if (auth.currentUser && merged) {
      const uid = sanitizeId(auth.currentUser.uid);
      const createB = buildVisitorPayload(merged, uid, true);
      const updateB = buildVisitorPayload(merged, uid, false);
      void upsertCollectionDoc('visitors', createB.id, createB.data, updateB.data);
    }
    logAudit('Update Visitor', 'Visitor Intelligence', `Updated visitor record ${id}`);
  };

  const deleteVisitor = (id: string) => {
    setVisitors((prev) => prev.filter((v) => v.id !== id));
    void persistWarehouse(`/api/warehouse/visitors/${encodeURIComponent(id)}`, 'DELETE');
    if (auth.currentUser) {
      void removeCollectionDoc('visitors', id);
    }
    logAudit('Delete Visitor', 'Visitor Intelligence', `Removed visitor ${id}`);
  };

  const addTransaction = (item: Omit<CommercialTransaction, 'id'>) => {
    const newTx: CommercialTransaction = {
      ...item,
      id: `tx-${Date.now()}`,
      isDemo: false,
    };
    setTransactions((prev) => [newTx, ...prev]);
    void persistWarehouse('/api/warehouse/transactions', 'POST', newTx);
    if (auth.currentUser) {
      const built = buildTransactionPayload(newTx, auth.currentUser.uid, true);
      void createCollectionDoc('commercialTransactions', built.id, built.data);
    }
    logAudit('Record Transaction', 'Commercial Intelligence', `Logged invoice ${newTx.refNumber} ($${newTx.amountUsd}) for ${newTx.clientName}`);
  };

  const updateTransaction = (id: string, updates: Partial<CommercialTransaction>) => {
    const current = transactions.find((t) => t.id === id);
    const merged = current ? { ...current, ...updates } : undefined;
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    void persistWarehouse(`/api/warehouse/transactions/${encodeURIComponent(id)}`, 'PATCH', updates);
    if (auth.currentUser && merged) {
      const uid = sanitizeId(auth.currentUser.uid);
      const createB = buildTransactionPayload(merged, uid, true);
      const updateB = buildTransactionPayload(merged, uid, false);
      void upsertCollectionDoc('commercialTransactions', createB.id, createB.data, updateB.data);
    }
    logAudit('Update Transaction', 'Commercial Intelligence', `Updated transaction ${id}`);
  };

  const deleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    void persistWarehouse(`/api/warehouse/transactions/${encodeURIComponent(id)}`, 'DELETE');
    if (auth.currentUser) {
      void removeCollectionDoc('commercialTransactions', id);
    }
    logAudit('Delete Transaction', 'Commercial Intelligence', `Deleted transaction ${id}`);
  };

  const addTradeEngagement = (item: Omit<TradeEngagement, 'id'>) => {
    const newTe: TradeEngagement = {
      ...item,
      id: `trd-${Date.now()}`,
      isDemo: false,
    };
    setTradeEngagements((prev) => [newTe, ...prev]);
    void persistWarehouse('/api/warehouse/tradeEngagements', 'POST', newTe);
    if (auth.currentUser) {
      const built = buildTradeEngagementPayload(newTe, auth.currentUser.uid, true);
      void createCollectionDoc('tradeEngagements', built.id, built.data);
    }
    logAudit('Log Trade Engagement', 'Trade Impact', `Logged B2B lead ${newTe.refNumber}: ${newTe.buyerOrg} -> ${newTe.supplierOrg}`);
  };

  const updateTradeEngagement = (id: string, updates: Partial<TradeEngagement>) => {
    const current = tradeEngagements.find((te) => te.id === id);
    const merged = current ? { ...current, ...updates } : undefined;
    setTradeEngagements((prev) => prev.map((te) => (te.id === id ? { ...te, ...updates } : te)));
    void persistWarehouse(`/api/warehouse/tradeEngagements/${encodeURIComponent(id)}`, 'PATCH', updates);
    if (auth.currentUser && merged) {
      const uid = sanitizeId(auth.currentUser.uid);
      const createB = buildTradeEngagementPayload(merged, uid, true);
      const updateB = buildTradeEngagementPayload(merged, uid, false);
      void upsertCollectionDoc('tradeEngagements', createB.id, createB.data, updateB.data);
    }
    logAudit('Update Trade Engagement', 'Trade Impact', `Updated engagement status for ${id}`);
  };

  const deleteTradeEngagement = (id: string) => {
    setTradeEngagements((prev) => prev.filter((te) => te.id !== id));
    void persistWarehouse(`/api/warehouse/tradeEngagements/${encodeURIComponent(id)}`, 'DELETE');
    if (auth.currentUser) {
      void removeCollectionDoc('tradeEngagements', id);
    }
    logAudit('Delete Trade Engagement', 'Trade Impact', `Removed engagement ${id}`);
  };

  const verifyTradeDeal = (id: string, docName?: string) => {
    const verifiedDate = new Date().toISOString().substring(0, 10);
    const existing = tradeEngagements.find((te) => te.id === id);
    const updates: Partial<TradeEngagement> = {
      verificationStatus: 'Independently Verified',
      verifiedDate,
      supportingDocName: docName || existing?.supportingDocName || 'Official_ZITF_Trade_Verification.pdf',
      engagementStatus: 'Opportunity Converted',
    };
    const merged = existing ? { ...existing, ...updates } : undefined;
    setTradeEngagements((prev) => prev.map((te) => (te.id === id ? { ...te, ...updates } : te)));
    void persistWarehouse(`/api/warehouse/tradeEngagements/${encodeURIComponent(id)}`, 'PATCH', updates);
    if (auth.currentUser && merged) {
      const uid = sanitizeId(auth.currentUser.uid);
      const createB = buildTradeEngagementPayload(merged, uid, true);
      const updateB = buildTradeEngagementPayload(merged, uid, false);
      void upsertCollectionDoc('tradeEngagements', createB.id, createB.data, updateB.data);
    }
    logAudit('Verify Trade Deal', 'Trade Impact', `Independently verified trade outcome ${id} with supporting verification record.`);
  };

  const addIncident = (item: Omit<OperationalIncident, 'id'>) => {
    const newInc: OperationalIncident = {
      ...item,
      id: `inc-${Date.now()}`,
      isDemo: false,
    };
    setIncidents((prev) => [newInc, ...prev]);
    void persistWarehouse('/api/warehouse/incidents', 'POST', newInc);
    if (auth.currentUser) {
      const built = buildIncidentPayload(newInc, auth.currentUser.uid, true);
      void createCollectionDoc('operationalIncidents', built.id, built.data);
    }
    logAudit('Log Incident', 'Operational Intelligence', `Logged operational incident: ${newInc.title}`);
  };

  const updateIncident = (id: string, updates: Partial<OperationalIncident>) => {
    const current = incidents.find((inc) => inc.id === id);
    const merged = current ? { ...current, ...updates } : undefined;
    setIncidents((prev) => prev.map((inc) => (inc.id === id ? { ...inc, ...updates } : inc)));
    void persistWarehouse(`/api/warehouse/incidents/${encodeURIComponent(id)}`, 'PATCH', updates);
    if (auth.currentUser && merged) {
      const uid = sanitizeId(auth.currentUser.uid);
      const createB = buildIncidentPayload(merged, uid, true);
      const updateB = buildIncidentPayload(merged, uid, false);
      void upsertCollectionDoc('operationalIncidents', createB.id, createB.data, updateB.data);
    }
    logAudit('Update Incident', 'Operational Intelligence', `Updated incident ${id}`);
  };

  const addMarketInsight = (item: Omit<MarketInsight, 'id'>) => {
    const newMkt: MarketInsight = {
      ...item,
      id: `mkt-${Date.now()}`,
      isDemo: false,
    };
    setMarketInsights((prev) => [newMkt, ...prev]);
    void persistWarehouse('/api/warehouse/marketInsights', 'POST', newMkt);
    if (auth.currentUser) {
      const built = buildMarketInsightPayload(newMkt, auth.currentUser.uid, true);
      void createCollectionDoc('marketInsights', built.id, built.data);
    }
    logAudit('Publish Market Insight', 'Strategic Market Insight', `Published insight: ${newMkt.title}`);
  };

  const addReport = (item: Omit<BIReport, 'id'>) => {
    const newRep: BIReport = {
      ...item,
      id: `rep-${Date.now()}`,
      isDemo: false,
    };
    setReports((prev) => [newRep, ...prev]);
    void persistWarehouse('/api/warehouse/reports', 'POST', newRep);
    if (auth.currentUser) {
      const built = buildBIReportPayload(newRep, auth.currentUser.uid, true);
      void createCollectionDoc('biReports', built.id, built.data);
    }
    logAudit('Generate Report', 'Reports Centre', `Generated report ${newRep.reportNumber}: ${newRep.title}`);
  };

  const addUser = async (
    item: Omit<UserProfile, 'id'> & { password?: string }
  ): Promise<{ ok: boolean; error?: string }> => {
    const { password, ...profileFields } = item;
    const newUser: UserProfile = {
      ...profileFields,
      email: profileFields.email.trim().toLowerCase(),
      name: profileFields.name.trim(),
      department: profileFields.department.trim(),
      id: `usr-${Date.now()}`,
    };
    try {
      const res = await authFetch('/api/warehouse/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(password ? { ...newUser, password } : newUser),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || `Failed to provision user (HTTP ${res.status}).` };
      }
      setUsers((prev) => [newUser, ...prev]);
      if (auth.currentUser) {
        const built = buildDirectoryUserPayload(newUser, auth.currentUser.uid, true);
        void createCollectionDoc('directoryUsers', built.id, built.data);
      }
      if (data.stats) setWarehouseStats(data.stats);
      logAudit('Create User', 'User Management', `Provisioned user ${newUser.name} (${newUser.email}) as ${newUser.role}.`);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Network error provisioning user.' };
    }
  };

  const updateUser = async (
    id: string,
    updates: Partial<UserProfile>
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await authFetch(`/api/warehouse/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || `Failed to update user (HTTP ${res.status}).` };
      }
      const existing = users.find((u) => u.id === id);
      const nextItem = (data.item as UserProfile) || updates;
      const merged = existing ? { ...existing, ...nextItem } : undefined;
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...nextItem } : u)));
      if (currentUser.id === id) {
        setCurrentUser({ ...currentUser, ...nextItem });
      }
      if (auth.currentUser && merged) {
        const uid = sanitizeId(auth.currentUser.uid);
        const createB = buildDirectoryUserPayload(merged, uid, true);
        const updateB = buildDirectoryUserPayload(merged, uid, false);
        void upsertCollectionDoc('directoryUsers', createB.id, createB.data, updateB.data);
      }
      if (data.stats) setWarehouseStats(data.stats);
      logAudit('Update User', 'User Management', `Updated profile/access for user ${nextItem.email || id}.`);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Network error updating user.' };
    }
  };

  const deleteUser = async (id: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await authFetch(`/api/warehouse/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || `Failed to delete user (HTTP ${res.status}).` };
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      if (auth.currentUser) {
        void removeCollectionDoc('directoryUsers', id);
      }
      if (data.stats) setWarehouseStats(data.stats);
      logAudit('Delete User', 'User Management', `Deleted user account ${id}.`);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Network error deleting user.' };
    }
  };

  const addEdition = (item: Omit<ExhibitionEdition, 'id'>) => {
    const newEd: ExhibitionEdition = {
      ...item,
      id: `zitf-${item.year}`,
    };
    setEditions((prev) => [newEd, ...prev]);
    void persistWarehouse('/api/warehouse/editions', 'POST', newEd);
    if (auth.currentUser) {
      const built = buildEditionPayload(newEd, auth.currentUser.uid, true);
      void createCollectionDoc('editions', built.id, built.data);
    }
    logAudit('Create Edition', 'System Settings', `Added new exhibition edition: ${newEd.name}`);
  };

  // Server-enforced batch import pipeline with programmatic schema validation & SQLite deduplication
  const batchImportRecords = async (
    targetModule: ConnectorTargetModule,
    records: any[],
    options: { skipDuplicates?: boolean } = { skipDuplicates: true }
  ): Promise<GovernedImportResult> => {
    const skipDuplicates = options?.skipDuplicates ?? true;
    const activeEdId = selectedEditionId === 'all' ? 'zitf-2026' : selectedEditionId;

    const res = await authFetch(`/api/warehouse/import/${encodeURIComponent(targetModule)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        records,
        skipDuplicates,
        defaultEditionId: activeEdId,
        userEmail: currentUser.email,
        userRole: currentUser.role,
      }),
    });

    const data: GovernedImportResult & { error?: string } = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Governed server import failed (HTTP ${res.status})`);
    }

    if (data.importedItems && data.importedItems.length > 0) {
      if (targetModule === 'exhibitors') {
        setExhibitors((prev) => [...data.importedItems, ...prev]);
      } else if (targetModule === 'visitors') {
        setVisitors((prev) => [...data.importedItems, ...prev]);
      } else if (targetModule === 'commercial') {
        setTransactions((prev) => [...data.importedItems, ...prev]);
      } else if (targetModule === 'trade') {
        setTradeEngagements((prev) => [...data.importedItems, ...prev]);
      }
      if (auth.currentUser) {
        const uid = auth.currentUser.uid;
        for (const rec of data.importedItems) {
          if (targetModule === 'exhibitors') {
            const b = buildExhibitorPayload(rec, uid, true);
            void createCollectionDoc('exhibitors', b.id, b.data);
          } else if (targetModule === 'visitors') {
            const b = buildVisitorPayload(rec, uid, true);
            void createCollectionDoc('visitors', b.id, b.data);
          } else if (targetModule === 'commercial') {
            const b = buildTransactionPayload(rec, uid, true);
            void createCollectionDoc('commercialTransactions', b.id, b.data);
          } else if (targetModule === 'trade') {
            const b = buildTradeEngagementPayload(rec, uid, true);
            void createCollectionDoc('tradeEngagements', b.id, b.data);
          }
        }
      }
    }

    if (data.stats) {
      setWarehouseStats(data.stats);
    }

    // Pull server-generated governance audit log into state
    void refreshWarehouseState();

    return data;
  };

  // External API Connector Management & Live Execution
  const addConnector = (item: Omit<ExternalConnector, 'id'>) => {
    const newId = `conn-${Date.now()}`;
    const newConn: ExternalConnector = {
      ...item,
      id: newId,
      endpointUrl: item.mode === 'Webhook Push' ? `/api/webhooks/ingest/${newId}` : item.endpointUrl,
    };
    setConnectors((prev) => [newConn, ...prev]);
    void persistWarehouse('/api/warehouse/connectors', 'POST', newConn);
    if (auth.currentUser) {
      const built = buildConnectorPayload(newConn, auth.currentUser.uid, true);
      void createCollectionDoc('externalConnectors', built.id, built.data);
    }
    logAudit('Add API Connector', 'Data Management', `Configured ${newConn.systemType} connector "${newConn.name}" (${newConn.mode}).`);
  };

  const updateConnector = (id: string, updates: Partial<ExternalConnector>) => {
    const current = connectors.find((c) => c.id === id);
    const merged = current ? { ...current, ...updates } : undefined;
    setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    void persistWarehouse(`/api/warehouse/connectors/${encodeURIComponent(id)}`, 'PATCH', updates);
    if (auth.currentUser && merged) {
      const uid = sanitizeId(auth.currentUser.uid);
      const createB = buildConnectorPayload(merged, uid, true);
      const updateB = buildConnectorPayload(merged, uid, false);
      void upsertCollectionDoc('externalConnectors', createB.id, createB.data, updateB.data);
    }
    logAudit('Update API Connector', 'Data Management', `Updated connector configuration for ${id}.`);
  };

  const deleteConnector = (id: string) => {
    setConnectors((prev) => prev.filter((c) => c.id !== id));
    void persistWarehouse(`/api/warehouse/connectors/${encodeURIComponent(id)}`, 'DELETE');
    if (auth.currentUser) {
      void removeCollectionDoc('externalConnectors', id);
    }
    logAudit('Remove API Connector', 'Data Management', `Removed external connector ${id}.`);
  };

  const syncConnector = async (id: string): Promise<ConnectorSyncLog> => {
    const conn = connectors.find((c) => c.id === id);
    const nowDisplay = new Date().toISOString().replace('T', ' ').substring(0, 19);

    if (!conn) {
      throw new Error('Connector not found');
    }

    setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'Syncing', lastError: undefined } : c)));

    const startedAt = performance.now();
    try {
      let records: any[] = [];
      let statusCode = 200;
      let latencyMs = 0;

      if (conn.mode === 'Webhook Push') {
        const res = await authFetch(`/api/webhooks/flush/${encodeURIComponent(conn.id)}`, {
          method: 'POST',
        });
        statusCode = res.status;
        latencyMs = Math.round(performance.now() - startedAt);
        const payload = await res.json();
        if (!res.ok || !payload.ok) {
          throw new Error(payload.error || `Webhook queue flush failed (HTTP ${res.status})`);
        }
        records = payload.records || [];
      } else {
        const res = await authFetch('/api/connectors/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpointUrl: conn.endpointUrl,
            authType: conn.authType,
            authHeaderName: conn.authHeaderName,
            authToken: conn.authToken,
            dataPath: conn.dataPath,
          }),
        });
        statusCode = res.status;
        const payload = await res.json();
        latencyMs = payload.latencyMs ?? Math.round(performance.now() - startedAt);
        if (!res.ok || !payload.ok) {
          throw new Error(payload.error || `Pull failed with HTTP ${res.status}`);
        }
        records = payload.records || [];
      }

      const importResult =
        records.length > 0
          ? await batchImportRecords(conn.targetModule, records, { skipDuplicates: conn.autoDeduplicate })
          : { successCount: 0, errorCount: 0, duplicateCount: 0 };

      const message =
        records.length === 0
          ? conn.mode === 'Webhook Push'
            ? 'Webhook buffer checked: 0 queued events waiting.'
            : 'Endpoint responded cleanly with 0 records.'
          : `Fetched ${records.length} records: ${importResult.successCount} imported, ${importResult.duplicateCount} duplicates skipped, ${importResult.errorCount} rejected.`;

      const logEntry: ConnectorSyncLog = {
        id: `csync-${Date.now()}`,
        connectorId: conn.id,
        connectorName: conn.name,
        timestamp: nowDisplay,
        status: 'Success',
        statusCode,
        latencyMs,
        recordsFetched: records.length,
        recordsImported: importResult.successCount,
        duplicatesSkipped: importResult.duplicateCount,
        message,
      };

      const connUpdates: Partial<ExternalConnector> = {
        status: 'Connected',
        lastSyncAt: nowDisplay,
        lastSyncCount: importResult.successCount,
        lastLatencyMs: latencyMs,
        lastStatusCode: statusCode,
        lastError: undefined,
      };

      setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, ...connUpdates } : c)));
      setConnectorLogs((prev) => [logEntry, ...prev.slice(0, 49)]);
      void persistWarehouse(`/api/warehouse/connectors/${encodeURIComponent(id)}`, 'PATCH', connUpdates);
      void persistWarehouse('/api/warehouse/connectorLogs', 'POST', logEntry);
      if (auth.currentUser) {
        const uid = sanitizeId(auth.currentUser.uid);
        const mergedConn = { ...conn, ...connUpdates };
        const createB = buildConnectorPayload(mergedConn, uid, true);
        const updateB = buildConnectorPayload(mergedConn, uid, false);
        void upsertCollectionDoc('externalConnectors', createB.id, createB.data, updateB.data);
        const logB = buildConnectorLogPayload(logEntry, uid, true);
        void createCollectionDoc('connectorSyncLogs', logB.id, logB.data);
      }
      logAudit('API Connector Sync', 'Data Management', `${conn.name}: ${message}`);
      return logEntry;
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startedAt);
      const errorMsg = err?.message || 'Connection failed';
      const failLog: ConnectorSyncLog = {
        id: `csync-${Date.now()}`,
        connectorId: conn.id,
        connectorName: conn.name,
        timestamp: nowDisplay,
        status: 'Failed',
        latencyMs,
        recordsFetched: 0,
        recordsImported: 0,
        duplicatesSkipped: 0,
        message: errorMsg,
      };

      const failUpdates: Partial<ExternalConnector> = {
        status: 'Error',
        lastSyncAt: nowDisplay,
        lastLatencyMs: latencyMs,
        lastError: errorMsg,
      };

      setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, ...failUpdates } : c)));
      setConnectorLogs((prev) => [failLog, ...prev.slice(0, 49)]);
      void persistWarehouse(`/api/warehouse/connectors/${encodeURIComponent(id)}`, 'PATCH', failUpdates);
      void persistWarehouse('/api/warehouse/connectorLogs', 'POST', failLog);
      if (auth.currentUser) {
        const uid = sanitizeId(auth.currentUser.uid);
        const mergedConn = { ...conn, ...failUpdates };
        const createB = buildConnectorPayload(mergedConn, uid, true);
        const updateB = buildConnectorPayload(mergedConn, uid, false);
        void upsertCollectionDoc('externalConnectors', createB.id, createB.data, updateB.data);
        const logB = buildConnectorLogPayload(failLog, uid, true);
        void createCollectionDoc('connectorSyncLogs', logB.id, logB.data);
      }
      logAudit('API Connector Error', 'Data Management', `${conn.name} sync failed: ${errorMsg}`);
      return failLog;
    }
  };

  const testWebhookPush = async (id: string) => {
    const conn = connectors.find((c) => c.id === id);
    if (!conn) return { ok: false, error: 'Connector not found' };

    const stamp = Date.now().toString().slice(-4);
    const samplePayloads: Record<string, any> = {
      exhibitors: {
        companyName: `Matabeleland AgroTech Webhook #${stamp}`,
        regNumber: `MAT-WH-${stamp}`,
        sector: 'Agriculture & Food Processing',
        country: 'Zimbabwe',
        provinceCity: 'Bulawayo',
        contactPerson: 'Nomsa Khumalo',
        email: `webhook.${stamp}@matagrotech.co.zw`,
        phone: '+263 292 612 900',
        hallStand: 'Hall 3 - Stand WH1',
        standSizeSqm: 48,
        category: 'SME / Emerging',
        paymentStatus: 'Fully Paid',
      },
      visitors: {
        fullName: `Thabo Moyo (Gate Scan #${stamp})`,
        category: 'Buyers and Procurement',
        country: 'Botswana',
        cityProvince: 'Gaborone',
        organization: 'Kalahari Cold Chain Ltd',
        industry: 'Heavy Engineering & Logistics',
        email: `tmoyo.${stamp}@kalahari.bw`,
        phone: '+267 390 1122',
      },
      commercial: {
        clientName: `Kalahari Cold Chain Ltd (#${stamp})`,
        type: 'Conference & Forum Pass',
        amountUsd: 3600,
        outstandingBalanceUsd: 0,
        sector: 'Heavy Engineering & Logistics',
        notes: 'Real-time payment webhook push',
      },
      trade: {
        buyerOrg: 'Kalahari Cold Chain Ltd',
        buyerCountry: 'Botswana',
        supplierOrg: `Matabeleland AgroTech #${stamp}`,
        supplierCountry: 'Zimbabwe',
        industry: 'Agriculture & Food Processing',
        opportunityType: 'Export Opportunity',
        estimatedValueUsd: 1450000,
        engagementStatus: 'Meeting Scheduled',
        verificationStatus: 'Facilitated Opportunity',
        description: 'Live B2B Matchmaking Portal webhook push event',
      },
    };

    try {
      const res = await authFetch(`/api/webhooks/ingest/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: [samplePayloads[conn.targetModule]] }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || 'Webhook push rejected' };
      }
      logAudit('Webhook Test Push', 'Data Management', `Dispatched live test payload to ${conn.name} (${data.recordsQueued} queued).`);
      return { ok: true, recordsQueued: data.recordsQueued };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Network error pushing webhook' };
    }
  };

  const isDemoMode = useMemo(() => {
    return (
      exhibitors.some((e) => e.isDemo) ||
      visitors.some((v) => v.isDemo) ||
      transactions.some((t) => t.isDemo) ||
      tradeEngagements.some((te) => te.isDemo)
    );
  }, [exhibitors, visitors, transactions, tradeEngagements]);

  const clearDemoData = async () => {
    const demoTargets = [
      { col: 'exhibitors', ids: exhibitors.filter((e) => e.isDemo).map((e) => e.id) },
      { col: 'visitors', ids: visitors.filter((v) => v.isDemo).map((v) => v.id) },
      { col: 'commercialTransactions', ids: transactions.filter((t) => t.isDemo).map((t) => t.id) },
      { col: 'tradeEngagements', ids: tradeEngagements.filter((te) => te.isDemo).map((te) => te.id) },
      { col: 'operationalIncidents', ids: incidents.filter((i) => i.isDemo).map((i) => i.id) },
      { col: 'marketInsights', ids: marketInsights.filter((m) => m.isDemo).map((m) => m.id) },
      { col: 'biReports', ids: reports.filter((r) => r.isDemo).map((r) => r.id) },
    ];
    const ok = await persistWarehouse('/api/warehouse/clear-demo', 'POST');
    if (ok) {
      setExhibitors((prev) => prev.filter((e) => !e.isDemo));
      setVisitors((prev) => prev.filter((v) => !v.isDemo));
      setTransactions((prev) => prev.filter((t) => !t.isDemo));
      setTradeEngagements((prev) => prev.filter((te) => !te.isDemo));
      setIncidents((prev) => prev.filter((i) => !i.isDemo));
      setMarketInsights((prev) => prev.filter((m) => !m.isDemo));
      setReports((prev) => prev.filter((r) => !r.isDemo));
      if (auth.currentUser) {
        await clearDemoDocsInFirestore(auth.currentUser, demoTargets);
      }
      logAudit('Clear Demo Data', 'System Settings', 'Administrator removed all synthetic demonstration records from SQLite warehouse & Cloud Firestore.');
    }
  };

  const resetToDemoData = async () => {
    try {
      const res = await authFetch('/api/warehouse/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        applyWarehousePayload(data);
        if (auth.currentUser) {
          setIsFirestoreSyncing(true);
          try {
            const synced = await syncFullPlatformToFirestore({
              editions: data.editions || editions,
              exhibitors: data.exhibitors || [],
              visitors: data.visitors || [],
              transactions: data.transactions || [],
              tradeEngagements: data.tradeEngagements || [],
              hallUtilisation: data.hallUtilisation || hallUtilisation,
              incidents: data.incidents || [],
              marketInsights: data.marketInsights || [],
              reports: data.reports || [],
              connectors: data.connectors || connectors,
              connectorLogs: data.connectorLogs || connectorLogs,
              alertRules: data.alertRules || alertRules,
              alertEvents: data.alertEvents || alertEvents,
              scheduledReports: data.scheduledReports || scheduledReports,
              sharedItems: data.sharedItems || sharedItems,
              annotations: data.annotations || annotations,
              emailDispatches: data.emailDispatches || emailDispatches,
              auditLogs: data.auditLogs || auditLogs,
              users: data.users || users,
            });
            setFirestoreDocCounts(synced.collectionCounts);
            setFirestoreLastSyncedAt(new Date().toISOString());
          } finally {
            setIsFirestoreSyncing(false);
          }
        }
        logAudit('Reset Demo Data', 'System Settings', 'Restored complete synthetic enterprise demonstration dataset across SQLite warehouse & Cloud Firestore.');
      }
    } catch (err) {
      console.error('Failed to reset SQLite warehouse:', err);
    }
  };

  // Threshold Alerts & Scheduled Reports Actions
  const evaluateAlerts = async (): Promise<{ triggeredCount: number }> => {
    try {
      const res = await authFetch('/api/alerts/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: currentUser.email }),
      });
      if (!res.ok) return { triggeredCount: 0 };
      const data = await res.json();
      if (Array.isArray(data.alertRules)) {
        setAlertRules(data.alertRules);
        if (auth.currentUser) {
          const uid = sanitizeId(auth.currentUser.uid);
          data.alertRules.forEach((rule: ThresholdAlertRule) => {
            const c = buildAlertRulePayload(rule, uid, true);
            const u = buildAlertRulePayload(rule, uid, false);
            void upsertCollectionDoc('thresholdAlertRules', c.id, c.data, u.data);
          });
        }
      }
      if (Array.isArray(data.alertEvents)) {
        setAlertEvents(data.alertEvents);
        if (auth.currentUser) {
          const uid = sanitizeId(auth.currentUser.uid);
          data.alertEvents.forEach((ev: AlertEvent) => {
            const c = buildAlertEventPayload(ev, uid, true);
            const u = buildAlertEventPayload(ev, uid, false);
            void upsertCollectionDoc('alertEvents', c.id, c.data, u.data);
          });
        }
      }
      if (data.stats) setWarehouseStats(data.stats);
      return { triggeredCount: Number(data.triggeredCount) || 0 };
    } catch {
      return { triggeredCount: 0 };
    }
  };

  const addAlertRule = async (item: Omit<ThresholdAlertRule, 'id' | 'createdAt'>) => {
    const newRule: ThresholdAlertRule = {
      ...item,
      id: `alr-rule-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setAlertRules((prev) => [newRule, ...prev]);
    await persistWarehouse('/api/warehouse/alertRules', 'POST', newRule);
    if (auth.currentUser) {
      const b = buildAlertRulePayload(newRule, auth.currentUser.uid, true);
      void createCollectionDoc('thresholdAlertRules', b.id, b.data);
    }
    logAudit('Create Alert Rule', 'Reports & Alerts', `Configured threshold alert "${newRule.name}" (${newRule.metricKey}).`);
    await evaluateAlerts();
  };

  const updateAlertRule = async (id: string, updates: Partial<ThresholdAlertRule>) => {
    const current = alertRules.find((r) => r.id === id);
    const merged = current ? { ...current, ...updates } : undefined;
    setAlertRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    await persistWarehouse(`/api/warehouse/alertRules/${encodeURIComponent(id)}`, 'PATCH', updates);
    if (auth.currentUser && merged) {
      const uid = sanitizeId(auth.currentUser.uid);
      const c = buildAlertRulePayload(merged, uid, true);
      const u = buildAlertRulePayload(merged, uid, false);
      void upsertCollectionDoc('thresholdAlertRules', c.id, c.data, u.data);
    }
    logAudit('Update Alert Rule', 'Reports & Alerts', `Updated alert rule ${id}.`);
    await evaluateAlerts();
  };

  const deleteAlertRule = async (id: string) => {
    setAlertRules((prev) => prev.filter((r) => r.id !== id));
    await persistWarehouse(`/api/warehouse/alertRules/${encodeURIComponent(id)}`, 'DELETE');
    if (auth.currentUser) {
      void removeCollectionDoc('thresholdAlertRules', id);
    }
    logAudit('Delete Alert Rule', 'Reports & Alerts', `Removed threshold alert rule ${id}.`);
  };

  const updateAlertEventStatus = async (
    id: string,
    status: 'Active' | 'Acknowledged' | 'Resolved'
  ) => {
    try {
      const res = await authFetch(`/api/alerts/events/${encodeURIComponent(id)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, actorName: currentUser.name }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.event) {
          setAlertEvents((prev) => prev.map((e) => (e.id === id ? data.event : e)));
          if (auth.currentUser) {
            const uid = sanitizeId(auth.currentUser.uid);
            const c = buildAlertEventPayload(data.event, uid, true);
            const u = buildAlertEventPayload(data.event, uid, false);
            void upsertCollectionDoc('alertEvents', c.id, c.data, u.data);
          }
        }
        logAudit('Alert Status Update', 'Reports & Alerts', `Marked alert event ${id} as ${status}.`);
      }
    } catch (err) {
      console.error('Failed to update alert event status:', err);
    }
  };

  const addScheduledReport = async (
    item: Omit<ScheduledReportConfig, 'id' | 'createdAt' | 'nextRunAt' | 'runCount'>
  ) => {
    const now = new Date();
    const newSched: ScheduledReportConfig = {
      ...item,
      id: `sched-${Date.now()}`,
      nextRunAt: computeNextRunIso(item.frequency, item.runTimeUtc, now),
      runCount: 0,
      createdAt: now.toISOString(),
    };
    setScheduledReports((prev) => [newSched, ...prev]);
    await persistWarehouse('/api/warehouse/scheduledReports', 'POST', newSched);
    if (auth.currentUser) {
      const b = buildScheduledReportPayload(newSched, auth.currentUser.uid, true);
      void createCollectionDoc('scheduledReports', b.id, b.data);
    }
    logAudit('Create Report Schedule', 'Reports & Alerts', `Scheduled "${newSched.name}" (${newSched.frequency}).`);
  };

  const updateScheduledReport = async (id: string, updates: Partial<ScheduledReportConfig>) => {
    const existing = scheduledReports.find((s) => s.id === id);
    const freq = updates.frequency || existing?.frequency || 'Daily';
    const time = updates.runTimeUtc || existing?.runTimeUtc || '07:00';
    const computedNext =
      updates.frequency || updates.runTimeUtc
        ? computeNextRunIso(freq, time)
        : existing?.nextRunAt;
    const mergedUpdates = computedNext ? { ...updates, nextRunAt: computedNext } : updates;
    const merged = existing ? { ...existing, ...mergedUpdates } : undefined;

    setScheduledReports((prev) => prev.map((s) => (s.id === id ? { ...s, ...mergedUpdates } : s)));
    await persistWarehouse(`/api/warehouse/scheduledReports/${encodeURIComponent(id)}`, 'PATCH', mergedUpdates);
    if (auth.currentUser && merged) {
      const uid = sanitizeId(auth.currentUser.uid);
      const c = buildScheduledReportPayload(merged, uid, true);
      const u = buildScheduledReportPayload(merged, uid, false);
      void upsertCollectionDoc('scheduledReports', c.id, c.data, u.data);
    }
    logAudit('Update Report Schedule', 'Reports & Alerts', `Updated report schedule ${id}.`);
  };

  const deleteScheduledReport = async (id: string) => {
    setScheduledReports((prev) => prev.filter((s) => s.id !== id));
    await persistWarehouse(`/api/warehouse/scheduledReports/${encodeURIComponent(id)}`, 'DELETE');
    if (auth.currentUser) {
      void removeCollectionDoc('scheduledReports', id);
    }
    logAudit('Delete Report Schedule', 'Reports & Alerts', `Removed report schedule ${id}.`);
  };

  const runScheduledReportNow = async (id: string): Promise<BIReport | null> => {
    try {
      const res = await authFetch(`/api/reports/schedules/${encodeURIComponent(id)}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: currentUser.email }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.report) {
        setReports((prev) => [data.report, ...prev]);
        if (auth.currentUser) {
          const b = buildBIReportPayload(data.report, auth.currentUser.uid, true);
          void createCollectionDoc('biReports', b.id, b.data);
        }
      }
      if (data.schedule) {
        setScheduledReports((prev) => prev.map((s) => (s.id === id ? data.schedule : s)));
        if (auth.currentUser) {
          const uid = sanitizeId(auth.currentUser.uid);
          const c = buildScheduledReportPayload(data.schedule, uid, true);
          const u = buildScheduledReportPayload(data.schedule, uid, false);
          void upsertCollectionDoc('scheduledReports', c.id, c.data, u.data);
        }
      }
      if (data.stats) setWarehouseStats(data.stats);
      await refreshWarehouseState();
      return data.report || null;
    } catch {
      return null;
    }
  };

  // Share, Annotations, Collaborative Workflows & Email Dispatch Actions
  const shareBrief: BIContextType['shareBrief'] = async (payload) => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await authFetch('/api/collaboration/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          editionId: payload.editionId || (selectedEditionId === 'all' ? 'zitf-2026' : selectedEditionId),
          sharedByName: currentUser.name,
          sharedByEmail: currentUser.email,
          sharedByRole: currentUser.role,
          origin,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || 'Failed to share brief' };
      }
      if (data.sharedItem) {
        setSharedItems((prev) => [data.sharedItem, ...prev]);
        if (auth.currentUser) {
          const b = buildSharedBriefPayload(data.sharedItem, auth.currentUser.uid, true);
          void createCollectionDoc('sharedBriefs', b.id, b.data);
        }
      }
      if (data.emailResult?.dispatch) {
        setEmailDispatches((prev) => [data.emailResult.dispatch, ...prev]);
        if (auth.currentUser) {
          const b = buildEmailDispatchPayload(data.emailResult.dispatch, auth.currentUser.uid, true);
          void createCollectionDoc('emailDispatches', b.id, b.data);
        }
      }
      if (data.stats) setWarehouseStats(data.stats);
      void refreshWarehouseState();
      return {
        ok: true,
        sharedItem: data.sharedItem,
        shareUrl: data.shareUrl,
        emailResult: data.emailResult,
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Network error while sharing brief' };
    }
  };

  const transitionShareWorkflow = async (id: string, workflowStatus: CollaborationWorkflowStatus) => {
    try {
      const res = await authFetch(`/api/collaboration/shares/${encodeURIComponent(id)}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowStatus,
          actorName: currentUser.name,
          actorEmail: currentUser.email,
          actorRole: currentUser.role,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sharedItem) {
          setSharedItems((prev) => prev.map((s) => (s.id === id ? data.sharedItem : s)));
          if (auth.currentUser) {
            const uid = sanitizeId(auth.currentUser.uid);
            const c = buildSharedBriefPayload(data.sharedItem, uid, true);
            const u = buildSharedBriefPayload(data.sharedItem, uid, false);
            void upsertCollectionDoc('sharedBriefs', c.id, c.data, u.data);
          }
        }
        if (data.stats) setWarehouseStats(data.stats);
        void refreshWarehouseState();
      }
    } catch (err) {
      console.error('Failed to transition workflow:', err);
    }
  };

  const deleteSharedItem = async (id: string) => {
    setSharedItems((prev) => prev.filter((s) => s.id !== id));
    await persistWarehouse(`/api/warehouse/sharedItems/${encodeURIComponent(id)}`, 'DELETE');
    if (auth.currentUser) {
      void removeCollectionDoc('sharedBriefs', id);
    }
    logAudit('Delete Shared Link', 'Share & Collaborate', `Revoked shared link ${id}.`);
  };

  const addAnnotation: BIContextType['addAnnotation'] = async (payload) => {
    try {
      const res = await authFetch('/api/collaboration/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          authorName: currentUser.name,
          authorEmail: currentUser.email,
          authorRole: currentUser.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.annotation) return null;
      setAnnotations((prev) => [data.annotation, ...prev]);
      if (auth.currentUser) {
        const b = buildAnnotationPayload(data.annotation, auth.currentUser.uid, true);
        void createCollectionDoc('annotations', b.id, b.data);
      }
      if (data.stats) setWarehouseStats(data.stats);
      void refreshWarehouseState();
      return data.annotation as AnnotationComment;
    } catch {
      return null;
    }
  };

  const toggleAnnotationStatus = async (id: string, status: 'Open' | 'Resolved') => {
    try {
      const res = await authFetch(`/api/collaboration/comments/${encodeURIComponent(id)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, actorName: currentUser.name }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.annotation) {
          setAnnotations((prev) => prev.map((a) => (a.id === id ? data.annotation : a)));
          if (auth.currentUser) {
            const uid = sanitizeId(auth.currentUser.uid);
            const c = buildAnnotationPayload(data.annotation, uid, true);
            const u = buildAnnotationPayload(data.annotation, uid, false);
            void upsertCollectionDoc('annotations', c.id, c.data, u.data);
          }
        }
      }
    } catch (err) {
      console.error('Failed to update annotation status:', err);
    }
  };

  const deleteAnnotation = async (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    await persistWarehouse(`/api/warehouse/annotations/${encodeURIComponent(id)}`, 'DELETE');
    if (auth.currentUser) {
      void removeCollectionDoc('annotations', id);
    }
  };

  const sendEmailBrief: BIContextType['sendEmailBrief'] = async (payload) => {
    try {
      const res = await authFetch('/api/collaboration/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          senderName: currentUser.name,
          senderEmail: currentUser.email,
          senderRole: currentUser.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || 'Failed to dispatch email brief' };
      }
      if (data.dispatch) {
        setEmailDispatches((prev) => [data.dispatch, ...prev]);
        if (auth.currentUser) {
          const b = buildEmailDispatchPayload(data.dispatch, auth.currentUser.uid, true);
          void createCollectionDoc('emailDispatches', b.id, b.data);
        }
      }
      if (data.stats) setWarehouseStats(data.stats);
      void refreshWarehouseState();
      return {
        ok: true,
        dispatch: data.dispatch,
        mailtoUrl: data.mailtoUrl,
        emlContent: data.emlContent,
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Network error dispatching email' };
    }
  };

  // Persist user filter/workspace preferences directly to SQLite & Cloud Firestore
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;
    if (prefsHydratedUserRef.current !== currentUser.id) return;
    const timer = setTimeout(() => {
      void authFetch('/api/storage/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedEditionId,
          selectedPeriod,
          selectedSector,
          geographicFilter,
        }),
      });
      if (auth.currentUser && auth.currentUser.emailVerified && !isBootstrappingFirestoreRef.current) {
        void syncWorkspacePreferencesToFirestore({
          selectedEditionId,
          selectedPeriod,
          selectedSector,
          geographicFilter,
          selectedCountry,
        });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [
    isAuthenticated,
    currentUser?.id,
    selectedEditionId,
    selectedPeriod,
    selectedSector,
    geographicFilter,
    selectedCountry,
    authFetch,
  ]);

  const refreshStorageObjects = useCallback(async () => {
    try {
      const res = await authFetch('/api/storage/objects');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.objects)) {
          setStorageObjects(data.objects);
        }
      }
    } catch {
      // ignore non-fatal list refresh error
    }
  }, [authFetch]);

  const saveFileToServerStorage: BIContextType['saveFileToServerStorage'] = async (payload) => {
    try {
      const res = await authFetch('/api/storage/objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.object) {
        setStorageObjects((prev) => [data.object, ...prev]);
        return data.object as StorageObjectRecord;
      }
      return null;
    } catch {
      return null;
    }
  };

  const deleteServerStorageObject = async (id: string): Promise<boolean> => {
    try {
      const res = await authFetch(`/api/storage/objects/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) return false;
      setStorageObjects((prev) => prev.filter((o) => o.id !== id));
      return true;
    } catch {
      return false;
    }
  };

  const fetchStorageDiagnostics = useCallback(async (): Promise<StorageDiagnostics | null> => {
    try {
      const res = await authFetch('/api/storage/diagnostics');
      if (!res.ok) return null;
      const data = await res.json();
      return (data?.diagnostics as StorageDiagnostics) || null;
    } catch {
      return null;
    }
  }, [authFetch]);

  const optimizeWarehouseDb = async () => {
    try {
      const res = await authFetch('/api/storage/optimize', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, error: data?.error || `HTTP ${res.status}` };
      }
      return {
        ok: true,
        quickCheck: data.quickCheck,
        diagnostics: data.diagnostics as StorageDiagnostics,
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Optimization failed' };
    }
  };

  const fetchClientErrorLogs = useCallback(async (): Promise<ClientErrorLogEntry[]> => {
    try {
      const res = await authFetch('/api/system/client-errors?limit=30');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.logs) ? (data.logs as ClientErrorLogEntry[]) : [];
    } catch {
      return [];
    }
  }, [authFetch]);

  return (
    <BIContext.Provider
      value={{
        isAuthenticated,
        isAuthChecking,
        authToken,
        impersonatedByUserId,
        permissions,
        commercialRedacted,
        rbacBannerError,
        clearRbacError,
        can,
        authFetch,
        login,
        logout,
        changePassword,
        impersonateUser,
        resetUserPassword,
        revokeUserSessions,
        selectedEditionId,
        setSelectedEditionId,
        selectedPeriod,
        setSelectedPeriod,
        selectedSector,
        setSelectedSector,
        geographicFilter,
        setGeographicFilter,
        selectedCountry,
        setSelectedCountry,
        availableCountries,
        isGlobalMapOpen,
        setIsGlobalMapOpen,
        searchQuery,
        setSearchQuery,
        currentUser,
        setCurrentUser,
        users,
        switchRole,
        editions,
        exhibitors,
        visitors,
        transactions,
        tradeEngagements,
        hallUtilisation,
        incidents,
        marketInsights,
        reports,
        auditLogs,
        warehouseStats,
        isWarehouseLoading,
        refreshWarehouseState,
        firebaseUser,
        isFirestoreConnected,
        isFirestoreSyncing,
        firestoreLastSyncedAt,
        firestoreSyncError,
        firestoreDocCounts,
        connectFirestoreGoogle,
        disconnectFirestoreGoogle,
        syncAllPlatformToFirestore,
        filteredExhibitors,
        filteredVisitors,
        filteredTransactions,
        filteredTradeEngagements,
        filteredIncidents,
        filteredMarketInsights,
        executiveMetrics,
        isAIAssistantOpen,
        setIsAIAssistantOpen,
        addExhibitor,
        updateExhibitor,
        deleteExhibitor,
        addVisitor,
        updateVisitor,
        deleteVisitor,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addTradeEngagement,
        updateTradeEngagement,
        deleteTradeEngagement,
        verifyTradeDeal,
        addIncident,
        updateIncident,
        addMarketInsight,
        addReport,
        addUser,
        updateUser,
        deleteUser,
        addEdition,
        connectors,
        connectorLogs,
        addConnector,
        updateConnector,
        deleteConnector,
        syncConnector,
        testWebhookPush,
        batchImportRecords,
        clearDemoData,
        resetToDemoData,
        isDemoMode,
        logAudit,
        alertRules,
        alertEvents,
        scheduledReports,
        addAlertRule,
        updateAlertRule,
        deleteAlertRule,
        evaluateAlerts,
        updateAlertEventStatus,
        addScheduledReport,
        updateScheduledReport,
        deleteScheduledReport,
        runScheduledReportNow,
        sharedItems,
        annotations,
        emailDispatches,
        shareBrief,
        transitionShareWorkflow,
        deleteSharedItem,
        addAnnotation,
        toggleAnnotationStatus,
        deleteAnnotation,
        sendEmailBrief,
        storageObjects,
        refreshStorageObjects,
        saveFileToServerStorage,
        deleteServerStorageObject,
        fetchStorageDiagnostics,
        optimizeWarehouseDb,
        fetchClientErrorLogs,
        fetchActiveSessions,
        revokeSessionById,
      }}
    >
      {children}
    </BIContext.Provider>
  );
};

export const useBI = () => {
  const context = useContext(BIContext);
  if (!context) {
    throw new Error('useBI must be used within a BIProvider');
  }
  return context;
};
