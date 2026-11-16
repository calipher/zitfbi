import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  INITIAL_EDITIONS,
  INITIAL_USERS,
  INITIAL_EXHIBITORS,
  INITIAL_VISITORS,
  INITIAL_TRANSACTIONS,
  INITIAL_TRADE_ENGAGEMENTS,
  INITIAL_HALL_UTILISATION,
  INITIAL_INCIDENTS,
  INITIAL_MARKET_INSIGHTS,
  INITIAL_REPORTS,
  INITIAL_AUDIT_LOGS,
} from './warehouseSeeds.ts';
import type {
  ExhibitionEdition,
  UserProfile,
  Exhibitor,
  Visitor,
  CommercialTransaction,
  TradeEngagement,
  HallUtilisation,
  OperationalIncident,
  MarketInsight,
  BIReport,
  AuditLogItem,
  ExternalConnector,
  ConnectorSyncLog,
  ConnectorTargetModule,
  GovernedImportResult,
  ThresholdAlertRule,
  AlertEvent,
  ScheduledReportConfig,
  SharedBriefItem,
  AnnotationComment,
  EmailDispatchLog,
  CollaborationTargetType,
  CollaborationWorkflowStatus,
  UserRole,
  UserWorkspacePreferences,
  StorageObjectRecord,
  ClientErrorLogEntry,
  StorageDiagnostics,
  PaginatedWarehouseQueryResult,
} from '../src/types/index.ts';
import {
  governDatasetBatch,
  validateSingleEntityRecord,
} from '../src/utils/dataGovernance.ts';
import {
  evaluateAlertRules,
  buildAutomatedBIReport,
  computeNextRunIso,
} from '../src/utils/alertsAndSchedules.ts';
import {
  ensureUserCredential,
  seedAllUserCredentials,
  setUserPassword,
  revokeAllUserSessions,
} from './auth.ts';
import { hasPermission } from '../src/utils/rbac.ts';

export const INITIAL_CONNECTORS_SEED: ExternalConnector[] = [
  {
    id: 'conn-crm',
    name: 'ZITF CRM & Exhibitor Registry',
    systemType: 'CRM',
    mode: 'Pull (REST/CSV)',
    targetModule: 'exhibitors',
    endpointUrl: '/api/connectors/sample-feed/crm',
    dataPath: 'data.records',
    authType: 'None',
    status: 'Connected',
    autoDeduplicate: true,
    description: 'Pulls confirmed exhibitor profiles, stand allocations, and registration IDs via REST JSON.',
  },
  {
    id: 'conn-ticketing',
    name: 'Gate Turnstiles & RFID Ticketing',
    systemType: 'Ticketing',
    mode: 'Pull (REST/CSV)',
    targetModule: 'visitors',
    endpointUrl: '/api/connectors/sample-feed/ticketing',
    dataPath: 'records',
    authType: 'None',
    status: 'Connected',
    autoDeduplicate: true,
    description: 'Ingests accredited trade buyers, investor delegates, and gate entry registrations.',
  },
  {
    id: 'conn-b2b',
    name: 'B2B Matchmaking Portal Webhook',
    systemType: 'B2B Portal',
    mode: 'Webhook Push',
    targetModule: 'trade',
    endpointUrl: '/api/webhooks/ingest/conn-b2b',
    dataPath: 'matches',
    authType: 'None',
    status: 'Connected',
    autoDeduplicate: true,
    description: 'Receives real-time HTTP POST pushes from the B2B Matchmaking Portal and flushes queued deals.',
  },
  {
    id: 'conn-smartstand',
    name: 'Smart Stand ERP & Billing CSV Feed',
    systemType: 'Smart Stand',
    mode: 'Pull (REST/CSV)',
    targetModule: 'commercial',
    endpointUrl: '/api/connectors/sample-feed/smartstand',
    dataPath: '',
    authType: 'None',
    status: 'Connected',
    autoDeduplicate: true,
    description: 'Pulls live CSV billing streams for space rental, auxiliary power, and fiber drop invoices.',
  },
];

export const INITIAL_ALERT_RULES_SEED: ThresholdAlertRule[] = [
  {
    id: 'alr-rule-collection',
    name: 'Commercial Receivables Collection Drop',
    metricKey: 'collection_rate_pct',
    operator: 'lt',
    threshold: 85,
    severity: 'Critical',
    editionId: 'zitf-2026',
    notifyRoles: ['Super Administrator', 'Executive Management', 'Department Manager'],
    recipients: 'finance@zitf.co.zw, s.nkomo@zitf.co.zw',
    isActive: true,
    createdAt: '2026-04-01T08:00:00.000Z',
  },
  {
    id: 'alr-rule-incidents',
    name: 'Open Operational Incidents Threshold',
    metricKey: 'open_incidents_count',
    operator: 'gte',
    threshold: 2,
    severity: 'Warning',
    editionId: 'zitf-2026',
    notifyRoles: ['Super Administrator', 'Department Manager'],
    recipients: 'ops@zitf.co.zw, t.chigumba@zitf.co.zw',
    isActive: true,
    createdAt: '2026-04-01T08:05:00.000Z',
  },
  {
    id: 'alr-rule-wifi',
    name: 'Venue ICT & Wi-Fi SLA Breach',
    metricKey: 'network_uptime_pct',
    operator: 'lt',
    threshold: 99,
    severity: 'Warning',
    editionId: 'zitf-2026',
    notifyRoles: ['Super Administrator', 'Data Analyst'],
    recipients: 'ict@zitf.co.zw',
    isActive: true,
    createdAt: '2026-04-01T08:10:00.000Z',
  },
  {
    id: 'alr-rule-anomalies',
    name: 'Statistical Outlier Surge (|z| >= 2.0)',
    metricKey: 'anomaly_count',
    operator: 'gte',
    threshold: 3,
    severity: 'Info',
    editionId: 'zitf-2026',
    notifyRoles: ['Data Analyst', 'Super Administrator'],
    recipients: 'k.sibanda@zitf.co.zw',
    isActive: true,
    createdAt: '2026-04-01T08:15:00.000Z',
  },
];

export const INITIAL_SCHEDULED_REPORTS_SEED: ScheduledReportConfig[] = [
  {
    id: 'sched-exec-daily',
    name: 'Executive Daily Trade & Occupancy Flash Brief',
    pillar: 'Executive',
    editionId: 'zitf-2026',
    confidentiality: 'Confidential - Board & Executive',
    frequency: 'Daily',
    runTimeUtc: '06:00',
    dayOfWeekOrMonth: 'Every Day',
    recipients: 'board@zitf.co.zw, s.nkomo@zitf.co.zw',
    includeMiningForecast: true,
    isActive: true,
    nextRunAt: computeNextRunIso('Daily', '06:00'),
    runCount: 0,
    createdAt: '2026-04-01T07:00:00.000Z',
  },
  {
    id: 'sched-comm-weekly',
    name: 'Weekly Commercial Receivables & B2B Pipeline Digest',
    pillar: 'Commercial',
    editionId: 'zitf-2026',
    confidentiality: 'Management Internal',
    frequency: 'Weekly',
    runTimeUtc: '08:00',
    dayOfWeekOrMonth: 'Monday',
    recipients: 'finance@zitf.co.zw, t.chigumba@zitf.co.zw',
    includeMiningForecast: true,
    isActive: true,
    nextRunAt: computeNextRunIso('Weekly', '08:00'),
    runCount: 0,
    createdAt: '2026-04-01T07:30:00.000Z',
  },
];

export const INITIAL_SHARES_SEED: SharedBriefItem[] = [
  {
    id: 'shr-seed-001',
    shareToken: 'ZITF-SHR-2026A',
    targetType: 'Report',
    targetId: 'rep-2026-01',
    title: 'ZITF 2026 Consolidated Executive Trade & Commercial Performance Report',
    editionId: 'zitf-2026',
    sharedByName: 'Dr. Nicholas Moyo',
    sharedByEmail: 'n.moyo@zitf.co.zw',
    sharedByRole: 'Super Administrator',
    recipientEmails: ['s.nkomo@zitf.co.zw', 'k.sibanda@zitf.co.zw', 't.chigumba@zitf.co.zw'],
    recipientRoles: ['Executive Management', 'Data Analyst', 'Department Manager'],
    accessLevel: 'Approve / Sign-Off',
    note: 'Please review the Q2 verified trade figures and receivables clearance ahead of the Board Audit Committee briefing.',
    workflowStatus: 'In Review',
    createdAt: '2026-04-26T09:15:00.000Z',
  },
  {
    id: 'shr-seed-002',
    shareToken: 'ZITF-SHR-2026B',
    targetType: 'DataMining',
    targetId: 'mining-zitf-2026',
    title: '2027 OLS Revenue Forecast & K-Means Exhibitor Tier Segmentation',
    editionId: 'zitf-2026',
    sharedByName: 'Kudakwashe Sibanda',
    sharedByEmail: 'k.sibanda@zitf.co.zw',
    sharedByRole: 'Data Analyst',
    recipientEmails: ['s.nkomo@zitf.co.zw', 'n.moyo@zitf.co.zw'],
    recipientRoles: ['Executive Management', 'Super Administrator'],
    accessLevel: 'Comment & Annotate',
    note: 'Includes 95% confidence bounds and MAD outlier flags on high-value sponsorship invoices.',
    workflowStatus: 'Shared',
    createdAt: '2026-04-27T11:30:00.000Z',
  },
];

export const INITIAL_ANNOTATIONS_SEED: AnnotationComment[] = [
  {
    id: 'ann-seed-001',
    targetType: 'Report',
    targetId: 'rep-2026-01',
    targetTitle: 'ZITF 2026 Consolidated Executive Trade & Commercial Performance Report',
    sectionTag: 'Executive Summary',
    authorName: 'Stella Nkomo',
    authorEmail: 's.nkomo@zitf.co.zw',
    authorRole: 'Executive Management',
    body: '@t.chigumba@zitf.co.zw Confirm supporting contract PDFs are attached for the Independently Verified $14.8M deals before Friday sign-off.',
    mentions: ['t.chigumba@zitf.co.zw'],
    status: 'Open',
    createdAt: '2026-04-26 10:42:00',
  },
  {
    id: 'ann-seed-002',
    targetType: 'Report',
    targetId: 'rep-2026-01',
    targetTitle: 'ZITF 2026 Consolidated Executive Trade & Commercial Performance Report',
    sectionTag: 'KPI Snapshot',
    authorName: 'Tariro Chigumba',
    authorEmail: 't.chigumba@zitf.co.zw',
    authorRole: 'Department Manager',
    body: 'Verified invoices reconciled with Smart Stand ERP ledger. Outstanding receivables collection stands above 98%.',
    mentions: [],
    status: 'Resolved',
    resolvedBy: 'Dr. Nicholas Moyo',
    resolvedAt: '2026-04-26 14:15:00',
    createdAt: '2026-04-26 12:10:00',
  },
];

export const INITIAL_EMAIL_DISPATCHES_SEED: EmailDispatchLog[] = [
  {
    id: 'eml-seed-001',
    targetType: 'Report',
    targetId: 'rep-2026-01',
    subject: '[ZITF BI] 2026 Executive Trade & Commercial Performance Brief (For Review)',
    recipients: ['s.nkomo@zitf.co.zw', 'delegate@zimtrade.co.zw'],
    bodyPreview: 'Executive summary and KPI snapshot attached for Board & ZimTrade stakeholder briefing.',
    shareUrl: '?share=ZITF-SHR-2026A',
    senderName: 'Dr. Nicholas Moyo',
    senderEmail: 'n.moyo@zitf.co.zw',
    deliveryMode: 'MIME Queue & Mailto Dispatch',
    status: 'Queued (MIME Ready)',
    dispatchedAt: '2026-04-26 09:20:00',
  },
];

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'zitf_warehouse.db');
const OBJECTS_DIR = path.join(DATA_DIR, 'objects');

let dbInstance: DatabaseSync | null = null;

function parseJsonField<T>(val: unknown, fallback: T): T {
  if (typeof val !== 'string' || !val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

export function getWarehouseDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(OBJECTS_DIR)) {
    fs.mkdirSync(OBJECTS_DIR, { recursive: true });
  }

  const db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA temp_store = MEMORY;');
  db.exec('PRAGMA cache_size = -16000;');
  db.exec('PRAGMA busy_timeout = 5000;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS warehouse_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS editions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      editionNumber INTEGER NOT NULL,
      theme TEXT NOT NULL,
      year INTEGER NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      venue TEXT NOT NULL,
      status TEXT NOT NULL,
      isCurrent INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      lastLogin TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exhibitors (
      id TEXT PRIMARY KEY,
      companyName TEXT NOT NULL,
      regNumber TEXT NOT NULL,
      businessDescription TEXT NOT NULL,
      industry TEXT NOT NULL,
      sector TEXT NOT NULL,
      country TEXT NOT NULL,
      provinceCity TEXT NOT NULL,
      contactPerson TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      website TEXT NOT NULL,
      productsServicesJson TEXT NOT NULL,
      editionId TEXT NOT NULL,
      hallStand TEXT NOT NULL,
      standSizeSqm REAL NOT NULL,
      category TEXT NOT NULL,
      registrationDate TEXT NOT NULL,
      bookingStatus TEXT NOT NULL,
      paymentStatus TEXT NOT NULL,
      returningStatus TEXT NOT NULL,
      satisfactionScore REAL NOT NULL,
      participationHistoryJson TEXT NOT NULL,
      isDemo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY,
      visitorRef TEXT NOT NULL,
      fullName TEXT NOT NULL,
      category TEXT NOT NULL,
      country TEXT NOT NULL,
      cityProvince TEXT NOT NULL,
      organization TEXT NOT NULL,
      industry TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      registrationDate TEXT NOT NULL,
      editionId TEXT NOT NULL,
      attendanceDaysJson TEXT NOT NULL,
      interestsJson TEXT NOT NULL,
      areasVisitedJson TEXT NOT NULL,
      feedbackRating REAL NOT NULL,
      repeatVisitor INTEGER NOT NULL DEFAULT 0,
      isDemo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS commercial_transactions (
      id TEXT PRIMARY KEY,
      refNumber TEXT NOT NULL,
      type TEXT NOT NULL,
      clientName TEXT NOT NULL,
      exhibitorId TEXT,
      amountUsd REAL NOT NULL,
      outstandingBalanceUsd REAL NOT NULL,
      editionId TEXT NOT NULL,
      status TEXT NOT NULL,
      paymentDate TEXT NOT NULL,
      sector TEXT NOT NULL,
      notes TEXT NOT NULL,
      isDemo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS trade_engagements (
      id TEXT PRIMARY KEY,
      refNumber TEXT NOT NULL,
      editionId TEXT NOT NULL,
      date TEXT NOT NULL,
      buyerOrg TEXT NOT NULL,
      buyerCountry TEXT NOT NULL,
      supplierOrg TEXT NOT NULL,
      supplierCountry TEXT NOT NULL,
      industry TEXT NOT NULL,
      opportunityType TEXT NOT NULL,
      description TEXT NOT NULL,
      estimatedValueUsd REAL NOT NULL,
      engagementStatus TEXT NOT NULL,
      followUpDate TEXT NOT NULL,
      outcome TEXT NOT NULL,
      verificationStatus TEXT NOT NULL,
      verifiedDate TEXT,
      supportingDocName TEXT,
      isDemo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS hall_utilisation (
      hallId TEXT PRIMARY KEY,
      hallName TEXT NOT NULL,
      totalCapacitySqm REAL NOT NULL,
      occupiedSqm REAL NOT NULL,
      utilizationRatePct REAL NOT NULL,
      primarySector TEXT NOT NULL,
      wifiUptimePct REAL NOT NULL,
      activeExhibitorsCount INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operational_incidents (
      id TEXT PRIMARY KEY,
      refNumber TEXT NOT NULL,
      editionId TEXT NOT NULL,
      hallOrArea TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      reportedTime TEXT NOT NULL,
      resolvedTime TEXT,
      status TEXT NOT NULL,
      resolutionNotes TEXT,
      isDemo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS market_insights (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      sector TEXT NOT NULL,
      marketType TEXT NOT NULL,
      summary TEXT NOT NULL,
      keyIndicatorsJson TEXT NOT NULL,
      estimatedMarketValueUsd REAL NOT NULL,
      growthRateYoY REAL NOT NULL,
      zimbabweMarketContext TEXT NOT NULL,
      sourceAttribution TEXT NOT NULL,
      date TEXT NOT NULL,
      isDemo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bi_reports (
      id TEXT PRIMARY KEY,
      reportNumber TEXT NOT NULL,
      title TEXT NOT NULL,
      pillar TEXT NOT NULL,
      editionId TEXT NOT NULL,
      generationDate TEXT NOT NULL,
      author TEXT NOT NULL,
      confidentiality TEXT NOT NULL,
      summaryFindings TEXT NOT NULL,
      kpisJson TEXT NOT NULL,
      recommendationsJson TEXT NOT NULL,
      isDemo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      userEmail TEXT NOT NULL,
      userRole TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      details TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS external_connectors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      systemType TEXT NOT NULL,
      mode TEXT NOT NULL,
      targetModule TEXT NOT NULL,
      endpointUrl TEXT NOT NULL,
      dataPath TEXT,
      authType TEXT NOT NULL,
      authHeaderName TEXT,
      authToken TEXT,
      status TEXT NOT NULL,
      lastSyncAt TEXT,
      lastSyncCount INTEGER,
      lastLatencyMs INTEGER,
      lastStatusCode INTEGER,
      lastError TEXT,
      autoDeduplicate INTEGER NOT NULL DEFAULT 1,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS connector_sync_logs (
      id TEXT PRIMARY KEY,
      connectorId TEXT NOT NULL,
      connectorName TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL,
      statusCode INTEGER,
      latencyMs INTEGER,
      recordsFetched INTEGER NOT NULL,
      recordsImported INTEGER NOT NULL,
      duplicatesSkipped INTEGER NOT NULL,
      message TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS threshold_alert_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      metricKey TEXT NOT NULL,
      operator TEXT NOT NULL,
      threshold REAL NOT NULL,
      severity TEXT NOT NULL,
      editionId TEXT NOT NULL,
      notifyRolesJson TEXT NOT NULL,
      recipients TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      lastEvaluatedAt TEXT,
      lastTriggeredAt TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_events (
      id TEXT PRIMARY KEY,
      ruleId TEXT NOT NULL,
      ruleName TEXT NOT NULL,
      metricKey TEXT NOT NULL,
      metricLabel TEXT NOT NULL,
      observedValue REAL NOT NULL,
      threshold REAL NOT NULL,
      operator TEXT NOT NULL,
      severity TEXT NOT NULL,
      editionId TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL,
      triggeredAt TEXT NOT NULL,
      acknowledgedBy TEXT,
      acknowledgedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS scheduled_reports (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pillar TEXT NOT NULL,
      editionId TEXT NOT NULL,
      confidentiality TEXT NOT NULL,
      frequency TEXT NOT NULL,
      runTimeUtc TEXT NOT NULL,
      dayOfWeekOrMonth TEXT,
      recipients TEXT NOT NULL,
      includeMiningForecast INTEGER NOT NULL DEFAULT 1,
      isActive INTEGER NOT NULL DEFAULT 1,
      lastRunAt TEXT,
      nextRunAt TEXT NOT NULL,
      lastReportId TEXT,
      runCount INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shared_items (
      id TEXT PRIMARY KEY,
      shareToken TEXT UNIQUE NOT NULL,
      targetType TEXT NOT NULL,
      targetId TEXT NOT NULL,
      title TEXT NOT NULL,
      editionId TEXT NOT NULL,
      sharedByName TEXT NOT NULL,
      sharedByEmail TEXT NOT NULL,
      sharedByRole TEXT NOT NULL,
      recipientEmailsJson TEXT NOT NULL,
      recipientRolesJson TEXT NOT NULL,
      accessLevel TEXT NOT NULL,
      note TEXT NOT NULL,
      workflowStatus TEXT NOT NULL,
      approvedBy TEXT,
      approvedAt TEXT,
      snapshotSummary TEXT,
      createdAt TEXT NOT NULL,
      expiresAt TEXT
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      targetType TEXT NOT NULL,
      targetId TEXT NOT NULL,
      targetTitle TEXT NOT NULL,
      sectionTag TEXT NOT NULL,
      authorName TEXT NOT NULL,
      authorEmail TEXT NOT NULL,
      authorRole TEXT NOT NULL,
      body TEXT NOT NULL,
      mentionsJson TEXT NOT NULL,
      status TEXT NOT NULL,
      resolvedBy TEXT,
      resolvedAt TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_dispatches (
      id TEXT PRIMARY KEY,
      targetType TEXT NOT NULL,
      targetId TEXT NOT NULL,
      subject TEXT NOT NULL,
      recipientsJson TEXT NOT NULL,
      bodyPreview TEXT NOT NULL,
      shareUrl TEXT,
      senderName TEXT NOT NULL,
      senderEmail TEXT NOT NULL,
      deliveryMode TEXT NOT NULL,
      status TEXT NOT NULL,
      dispatchedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      userId TEXT PRIMARY KEY,
      selectedEditionId TEXT NOT NULL,
      selectedPeriod TEXT NOT NULL,
      selectedSector TEXT NOT NULL,
      geographicFilter TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS storage_objects (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      filename TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      diskPath TEXT NOT NULL,
      uploadedByEmail TEXT NOT NULL,
      uploadedByRole TEXT NOT NULL,
      moduleRef TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS client_error_logs (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      moduleName TEXT NOT NULL,
      message TEXT NOT NULL,
      stackPreview TEXT,
      componentStackPreview TEXT,
      userEmail TEXT,
      userRole TEXT,
      urlPath TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_exhibitors_edition_sector ON exhibitors(editionId, sector, country);
    CREATE INDEX IF NOT EXISTS idx_visitors_edition_cat ON visitors(editionId, category, country);
    CREATE INDEX IF NOT EXISTS idx_transactions_edition_sector ON commercial_transactions(editionId, sector, status);
    CREATE INDEX IF NOT EXISTS idx_trade_edition_verif ON trade_engagements(editionId, industry, verificationStatus);
    CREATE INDEX IF NOT EXISTS idx_incidents_edition_status ON operational_incidents(editionId, status, severity);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_ts ON audit_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_storage_objects_cat ON storage_objects(category, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_client_errors_ts ON client_error_logs(createdAt DESC);
  `);

  dbInstance = db;
  seedWarehouseIfFirstRun(db);
  seedAllUserCredentials(db);
  db.exec('CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(userId, expiresAt);');
  seedAlertsAndSchedulesIfEmpty(db);
  seedCollaborationIfEmpty(db);
  return db;
}

function seedAllInitialRecords(db: DatabaseSync) {
  const insEdition = db.prepare(`
    INSERT OR REPLACE INTO editions (id, name, editionNumber, theme, year, startDate, endDate, venue, status, isCurrent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const e of INITIAL_EDITIONS) {
    insEdition.run(e.id, e.name, e.editionNumber, e.theme, e.year, e.startDate, e.endDate, e.venue, e.status, e.isCurrent ? 1 : 0);
  }

  const insUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, name, email, role, department, isActive, lastLogin)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const u of INITIAL_USERS) {
    insUser.run(u.id, u.name, u.email, u.role, u.department, u.isActive ? 1 : 0, u.lastLogin);
  }

  const insExhibitor = db.prepare(`
    INSERT OR REPLACE INTO exhibitors (
      id, companyName, regNumber, businessDescription, industry, sector, country, provinceCity,
      contactPerson, email, phone, website, productsServicesJson, editionId, hallStand, standSizeSqm,
      category, registrationDate, bookingStatus, paymentStatus, returningStatus, satisfactionScore,
      participationHistoryJson, isDemo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const ex of INITIAL_EXHIBITORS) {
    insExhibitor.run(
      ex.id,
      ex.companyName,
      ex.regNumber,
      ex.businessDescription,
      ex.industry,
      ex.sector,
      ex.country,
      ex.provinceCity,
      ex.contactPerson,
      ex.email,
      ex.phone,
      ex.website,
      JSON.stringify(ex.productsServices || []),
      ex.editionId,
      ex.hallStand,
      ex.standSizeSqm,
      ex.category,
      ex.registrationDate,
      ex.bookingStatus,
      ex.paymentStatus,
      ex.returningStatus,
      ex.satisfactionScore,
      JSON.stringify(ex.participationHistory || []),
      ex.isDemo ? 1 : 0
    );
  }

  const insVisitor = db.prepare(`
    INSERT OR REPLACE INTO visitors (
      id, visitorRef, fullName, category, country, cityProvince, organization, industry,
      email, phone, registrationDate, editionId, attendanceDaysJson, interestsJson, areasVisitedJson,
      feedbackRating, repeatVisitor, isDemo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const v of INITIAL_VISITORS) {
    insVisitor.run(
      v.id,
      v.visitorRef,
      v.fullName,
      v.category,
      v.country,
      v.cityProvince,
      v.organization,
      v.industry,
      v.email,
      v.phone,
      v.registrationDate,
      v.editionId,
      JSON.stringify(v.attendanceDays || []),
      JSON.stringify(v.interests || []),
      JSON.stringify(v.areasVisited || []),
      v.feedbackRating,
      v.repeatVisitor ? 1 : 0,
      v.isDemo ? 1 : 0
    );
  }

  const insTx = db.prepare(`
    INSERT OR REPLACE INTO commercial_transactions (
      id, refNumber, type, clientName, exhibitorId, amountUsd, outstandingBalanceUsd,
      editionId, status, paymentDate, sector, notes, isDemo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const t of INITIAL_TRANSACTIONS) {
    insTx.run(
      t.id,
      t.refNumber,
      t.type,
      t.clientName,
      t.exhibitorId ?? null,
      t.amountUsd,
      t.outstandingBalanceUsd,
      t.editionId,
      t.status,
      t.paymentDate,
      t.sector,
      t.notes,
      t.isDemo ? 1 : 0
    );
  }

  const insTrade = db.prepare(`
    INSERT OR REPLACE INTO trade_engagements (
      id, refNumber, editionId, date, buyerOrg, buyerCountry, supplierOrg, supplierCountry,
      industry, opportunityType, description, estimatedValueUsd, engagementStatus, followUpDate,
      outcome, verificationStatus, verifiedDate, supportingDocName, isDemo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const te of INITIAL_TRADE_ENGAGEMENTS) {
    insTrade.run(
      te.id,
      te.refNumber,
      te.editionId,
      te.date,
      te.buyerOrg,
      te.buyerCountry,
      te.supplierOrg,
      te.supplierCountry,
      te.industry,
      te.opportunityType,
      te.description,
      te.estimatedValueUsd,
      te.engagementStatus,
      te.followUpDate,
      te.outcome,
      te.verificationStatus,
      te.verifiedDate ?? null,
      te.supportingDocName ?? null,
      te.isDemo ? 1 : 0
    );
  }

  const insHall = db.prepare(`
    INSERT OR REPLACE INTO hall_utilisation (
      hallId, hallName, totalCapacitySqm, occupiedSqm, utilizationRatePct,
      primarySector, wifiUptimePct, activeExhibitorsCount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const h of INITIAL_HALL_UTILISATION) {
    insHall.run(
      h.hallId,
      h.hallName,
      h.totalCapacitySqm,
      h.occupiedSqm,
      h.utilizationRatePct,
      h.primarySector,
      h.wifiUptimePct,
      h.activeExhibitorsCount
    );
  }

  const insInc = db.prepare(`
    INSERT OR REPLACE INTO operational_incidents (
      id, refNumber, editionId, hallOrArea, category, severity, title, description,
      reportedTime, resolvedTime, status, resolutionNotes, isDemo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const inc of INITIAL_INCIDENTS) {
    insInc.run(
      inc.id,
      inc.refNumber,
      inc.editionId,
      inc.hallOrArea,
      inc.category,
      inc.severity,
      inc.title,
      inc.description,
      inc.reportedTime,
      inc.resolvedTime ?? null,
      inc.status,
      inc.resolutionNotes ?? null,
      inc.isDemo ? 1 : 0
    );
  }

  const insMkt = db.prepare(`
    INSERT OR REPLACE INTO market_insights (
      id, title, sector, marketType, summary, keyIndicatorsJson, estimatedMarketValueUsd,
      growthRateYoY, zimbabweMarketContext, sourceAttribution, date, isDemo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const m of INITIAL_MARKET_INSIGHTS) {
    insMkt.run(
      m.id,
      m.title,
      m.sector,
      m.marketType,
      m.summary,
      JSON.stringify(m.keyIndicators || []),
      m.estimatedMarketValueUsd,
      m.growthRateYoY,
      m.zimbabweMarketContext,
      m.sourceAttribution,
      m.date,
      m.isDemo ? 1 : 0
    );
  }

  const insRep = db.prepare(`
    INSERT OR REPLACE INTO bi_reports (
      id, reportNumber, title, pillar, editionId, generationDate, author,
      confidentiality, summaryFindings, kpisJson, recommendationsJson, isDemo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of INITIAL_REPORTS) {
    insRep.run(
      r.id,
      r.reportNumber,
      r.title,
      r.pillar,
      r.editionId,
      r.generationDate,
      r.author,
      r.confidentiality,
      r.summaryFindings,
      JSON.stringify(r.kpis || []),
      JSON.stringify(r.recommendations || []),
      r.isDemo ? 1 : 0
    );
  }

  const insAudit = db.prepare(`
    INSERT OR REPLACE INTO audit_logs (id, timestamp, userEmail, userRole, action, module, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const a of INITIAL_AUDIT_LOGS) {
    insAudit.run(a.id, a.timestamp, a.userEmail, a.userRole, a.action, a.module, a.details);
  }

  const insConn = db.prepare(`
    INSERT OR REPLACE INTO external_connectors (
      id, name, systemType, mode, targetModule, endpointUrl, dataPath, authType,
      authHeaderName, authToken, status, lastSyncAt, lastSyncCount, lastLatencyMs,
      lastStatusCode, lastError, autoDeduplicate, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of INITIAL_CONNECTORS_SEED) {
    insConn.run(
      c.id,
      c.name,
      c.systemType,
      c.mode,
      c.targetModule,
      c.endpointUrl,
      c.dataPath ?? null,
      c.authType,
      c.authHeaderName ?? null,
      c.authToken ?? null,
      c.status,
      c.lastSyncAt ?? null,
      c.lastSyncCount ?? null,
      c.lastLatencyMs ?? null,
      c.lastStatusCode ?? null,
      c.lastError ?? null,
      c.autoDeduplicate ? 1 : 0,
      c.description ?? null
    );
  }

  seedAlertsAndSchedulesRecords(db);
}

function seedAlertsAndSchedulesRecords(db: DatabaseSync) {
  const insRule = db.prepare(`
    INSERT OR REPLACE INTO threshold_alert_rules (
      id, name, metricKey, operator, threshold, severity, editionId, notifyRolesJson,
      recipients, isActive, lastEvaluatedAt, lastTriggeredAt, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of INITIAL_ALERT_RULES_SEED) {
    insRule.run(
      r.id,
      r.name,
      r.metricKey,
      r.operator,
      r.threshold,
      r.severity,
      r.editionId,
      JSON.stringify(r.notifyRoles || []),
      r.recipients,
      r.isActive ? 1 : 0,
      r.lastEvaluatedAt ?? null,
      r.lastTriggeredAt ?? null,
      r.createdAt
    );
  }

  const insSched = db.prepare(`
    INSERT OR REPLACE INTO scheduled_reports (
      id, name, pillar, editionId, confidentiality, frequency, runTimeUtc,
      dayOfWeekOrMonth, recipients, includeMiningForecast, isActive,
      lastRunAt, nextRunAt, lastReportId, runCount, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of INITIAL_SCHEDULED_REPORTS_SEED) {
    insSched.run(
      s.id,
      s.name,
      s.pillar,
      s.editionId,
      s.confidentiality,
      s.frequency,
      s.runTimeUtc,
      s.dayOfWeekOrMonth ?? null,
      s.recipients,
      s.includeMiningForecast ? 1 : 0,
      s.isActive ? 1 : 0,
      s.lastRunAt ?? null,
      s.nextRunAt,
      s.lastReportId ?? null,
      s.runCount || 0,
      s.createdAt
    );
  }
}

function seedAlertsAndSchedulesIfEmpty(db: DatabaseSync) {
  const rulesMeta = db.prepare(`SELECT value FROM warehouse_meta WHERE key = 'alerts_seeded'`).get() as
    | { value: string }
    | undefined;
  if (rulesMeta?.value === 'true') return;

  const existingRuleCount = Number((db.prepare(`SELECT COUNT(*) AS c FROM threshold_alert_rules`).get() as any).c);
  const existingSchedCount = Number((db.prepare(`SELECT COUNT(*) AS c FROM scheduled_reports`).get() as any).c);

  db.exec('BEGIN IMMEDIATE;');
  try {
    if (existingRuleCount === 0 && existingSchedCount === 0) {
      seedAlertsAndSchedulesRecords(db);
    }
    db.prepare(`INSERT OR REPLACE INTO warehouse_meta (key, value) VALUES ('alerts_seeded', 'true')`).run();
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  // Run initial evaluation so existing threshold breaches surface right away
  try {
    evaluateWarehouseAlerts('system@zitf.co.zw');
  } catch {
    // non-fatal during bootstrap
  }
}

function seedCollaborationRecords(db: DatabaseSync) {
  const insShare = db.prepare(`
    INSERT OR REPLACE INTO shared_items (
      id, shareToken, targetType, targetId, title, editionId, sharedByName, sharedByEmail,
      sharedByRole, recipientEmailsJson, recipientRolesJson, accessLevel, note, workflowStatus,
      approvedBy, approvedAt, snapshotSummary, createdAt, expiresAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of INITIAL_SHARES_SEED) {
    insShare.run(
      s.id,
      s.shareToken,
      s.targetType,
      s.targetId,
      s.title,
      s.editionId,
      s.sharedByName,
      s.sharedByEmail,
      s.sharedByRole,
      JSON.stringify(s.recipientEmails || []),
      JSON.stringify(s.recipientRoles || []),
      s.accessLevel,
      s.note,
      s.workflowStatus,
      s.approvedBy ?? null,
      s.approvedAt ?? null,
      s.snapshotSummary ?? null,
      s.createdAt,
      s.expiresAt ?? null
    );
  }

  const insAnn = db.prepare(`
    INSERT OR REPLACE INTO annotations (
      id, targetType, targetId, targetTitle, sectionTag, authorName, authorEmail, authorRole,
      body, mentionsJson, status, resolvedBy, resolvedAt, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const a of INITIAL_ANNOTATIONS_SEED) {
    insAnn.run(
      a.id,
      a.targetType,
      a.targetId,
      a.targetTitle,
      a.sectionTag,
      a.authorName,
      a.authorEmail,
      a.authorRole,
      a.body,
      JSON.stringify(a.mentions || []),
      a.status,
      a.resolvedBy ?? null,
      a.resolvedAt ?? null,
      a.createdAt
    );
  }

  const insEml = db.prepare(`
    INSERT OR REPLACE INTO email_dispatches (
      id, targetType, targetId, subject, recipientsJson, bodyPreview, shareUrl,
      senderName, senderEmail, deliveryMode, status, dispatchedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const e of INITIAL_EMAIL_DISPATCHES_SEED) {
    insEml.run(
      e.id,
      e.targetType,
      e.targetId,
      e.subject,
      JSON.stringify(e.recipients || []),
      e.bodyPreview,
      e.shareUrl ?? null,
      e.senderName,
      e.senderEmail,
      e.deliveryMode,
      e.status,
      e.dispatchedAt
    );
  }
}

function seedCollaborationIfEmpty(db: DatabaseSync) {
  const meta = db.prepare(`SELECT value FROM warehouse_meta WHERE key = 'collab_seeded'`).get() as
    | { value: string }
    | undefined;
  if (meta?.value === 'true') return;

  const existingShares = Number((db.prepare(`SELECT COUNT(*) AS c FROM shared_items`).get() as any).c);
  db.exec('BEGIN IMMEDIATE;');
  try {
    if (existingShares === 0) {
      seedCollaborationRecords(db);
    }
    db.prepare(`INSERT OR REPLACE INTO warehouse_meta (key, value) VALUES ('collab_seeded', 'true')`).run();
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

function seedWarehouseIfFirstRun(db: DatabaseSync) {
  const row = db.prepare(`SELECT value FROM warehouse_meta WHERE key = 'initialized'`).get() as
    | { value: string }
    | undefined;
  if (row?.value === 'true') return;

  db.exec('BEGIN IMMEDIATE;');
  try {
    seedAllInitialRecords(db);
    seedCollaborationRecords(db);
    db.prepare(`INSERT OR REPLACE INTO warehouse_meta (key, value) VALUES ('initialized', 'true')`).run();
    db.prepare(`INSERT OR REPLACE INTO warehouse_meta (key, value) VALUES ('alerts_seeded', 'true')`).run();
    db.prepare(`INSERT OR REPLACE INTO warehouse_meta (key, value) VALUES ('collab_seeded', 'true')`).run();
    db.prepare(`INSERT OR REPLACE INTO warehouse_meta (key, value) VALUES ('createdAt', ?)`).run(
      new Date().toISOString()
    );
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function getWarehouseStats() {
  const db = getWarehouseDb();
  const counts = {
    editions: Number((db.prepare(`SELECT COUNT(*) AS c FROM editions`).get() as any).c),
    users: Number((db.prepare(`SELECT COUNT(*) AS c FROM users`).get() as any).c),
    exhibitors: Number((db.prepare(`SELECT COUNT(*) AS c FROM exhibitors`).get() as any).c),
    visitors: Number((db.prepare(`SELECT COUNT(*) AS c FROM visitors`).get() as any).c),
    transactions: Number((db.prepare(`SELECT COUNT(*) AS c FROM commercial_transactions`).get() as any).c),
    tradeEngagements: Number((db.prepare(`SELECT COUNT(*) AS c FROM trade_engagements`).get() as any).c),
    hallUtilisation: Number((db.prepare(`SELECT COUNT(*) AS c FROM hall_utilisation`).get() as any).c),
    incidents: Number((db.prepare(`SELECT COUNT(*) AS c FROM operational_incidents`).get() as any).c),
    marketInsights: Number((db.prepare(`SELECT COUNT(*) AS c FROM market_insights`).get() as any).c),
    reports: Number((db.prepare(`SELECT COUNT(*) AS c FROM bi_reports`).get() as any).c),
    auditLogs: Number((db.prepare(`SELECT COUNT(*) AS c FROM audit_logs`).get() as any).c),
    connectors: Number((db.prepare(`SELECT COUNT(*) AS c FROM external_connectors`).get() as any).c),
    connectorLogs: Number((db.prepare(`SELECT COUNT(*) AS c FROM connector_sync_logs`).get() as any).c),
    alertRules: Number((db.prepare(`SELECT COUNT(*) AS c FROM threshold_alert_rules`).get() as any).c),
    alertEvents: Number((db.prepare(`SELECT COUNT(*) AS c FROM alert_events`).get() as any).c),
    scheduledReports: Number((db.prepare(`SELECT COUNT(*) AS c FROM scheduled_reports`).get() as any).c),
    sharedItems: Number((db.prepare(`SELECT COUNT(*) AS c FROM shared_items`).get() as any).c),
    annotations: Number((db.prepare(`SELECT COUNT(*) AS c FROM annotations`).get() as any).c),
    emailDispatches: Number((db.prepare(`SELECT COUNT(*) AS c FROM email_dispatches`).get() as any).c),
  };

  let sizeBytes = 0;
  try {
    sizeBytes = fs.statSync(DB_FILE).size;
  } catch {
    sizeBytes = 0;
  }

  return {
    engine: 'SQLite Centralized Server Warehouse (node:sqlite WAL)',
    dbPath: 'data/zitf_warehouse.db',
    sizeBytes,
    tableCounts: counts,
    totalRecords: Object.values(counts).reduce((a, b) => a + b, 0),
    checkedAt: new Date().toISOString(),
  };
}

export function getWarehouseState() {
  const db = getWarehouseDb();

  const editions: ExhibitionEdition[] = (db.prepare(`SELECT * FROM editions ORDER BY year DESC`).all() as any[]).map(
    (r) => ({ ...r, isCurrent: Boolean(r.isCurrent) })
  );

  const users: UserProfile[] = (db.prepare(`SELECT * FROM users`).all() as any[]).map((r) => ({
    ...r,
    isActive: Boolean(r.isActive),
  }));

  const exhibitors: Exhibitor[] = (
    db.prepare(`SELECT * FROM exhibitors ORDER BY rowid DESC`).all() as any[]
  ).map((r) => ({
    id: r.id,
    companyName: r.companyName,
    regNumber: r.regNumber,
    businessDescription: r.businessDescription,
    industry: r.industry,
    sector: r.sector,
    country: r.country,
    provinceCity: r.provinceCity,
    contactPerson: r.contactPerson,
    email: r.email,
    phone: r.phone,
    website: r.website,
    productsServices: parseJsonField<string[]>(r.productsServicesJson, []),
    editionId: r.editionId,
    hallStand: r.hallStand,
    standSizeSqm: r.standSizeSqm,
    category: r.category,
    registrationDate: r.registrationDate,
    bookingStatus: r.bookingStatus,
    paymentStatus: r.paymentStatus,
    returningStatus: r.returningStatus,
    satisfactionScore: r.satisfactionScore,
    participationHistory: parseJsonField<number[]>(r.participationHistoryJson, []),
    isDemo: Boolean(r.isDemo),
  }));

  const visitors: Visitor[] = (db.prepare(`SELECT * FROM visitors ORDER BY rowid DESC`).all() as any[]).map((r) => ({
    id: r.id,
    visitorRef: r.visitorRef,
    fullName: r.fullName,
    category: r.category,
    country: r.country,
    cityProvince: r.cityProvince,
    organization: r.organization,
    industry: r.industry,
    email: r.email,
    phone: r.phone,
    registrationDate: r.registrationDate,
    editionId: r.editionId,
    attendanceDays: parseJsonField<string[]>(r.attendanceDaysJson, []),
    interests: parseJsonField<string[]>(r.interestsJson, []),
    areasVisited: parseJsonField<string[]>(r.areasVisitedJson, []),
    feedbackRating: r.feedbackRating,
    repeatVisitor: Boolean(r.repeatVisitor),
    isDemo: Boolean(r.isDemo),
  }));

  const transactions: CommercialTransaction[] = (
    db.prepare(`SELECT * FROM commercial_transactions ORDER BY rowid DESC`).all() as any[]
  ).map((r) => ({
    id: r.id,
    refNumber: r.refNumber,
    type: r.type,
    clientName: r.clientName,
    exhibitorId: r.exhibitorId || undefined,
    amountUsd: r.amountUsd,
    outstandingBalanceUsd: r.outstandingBalanceUsd,
    editionId: r.editionId,
    status: r.status,
    paymentDate: r.paymentDate,
    sector: r.sector,
    notes: r.notes,
    isDemo: Boolean(r.isDemo),
  }));

  const tradeEngagements: TradeEngagement[] = (
    db.prepare(`SELECT * FROM trade_engagements ORDER BY rowid DESC`).all() as any[]
  ).map((r) => ({
    id: r.id,
    refNumber: r.refNumber,
    editionId: r.editionId,
    date: r.date,
    buyerOrg: r.buyerOrg,
    buyerCountry: r.buyerCountry,
    supplierOrg: r.supplierOrg,
    supplierCountry: r.supplierCountry,
    industry: r.industry,
    opportunityType: r.opportunityType,
    description: r.description,
    estimatedValueUsd: r.estimatedValueUsd,
    engagementStatus: r.engagementStatus,
    followUpDate: r.followUpDate,
    outcome: r.outcome,
    verificationStatus: r.verificationStatus,
    verifiedDate: r.verifiedDate || undefined,
    supportingDocName: r.supportingDocName || undefined,
    isDemo: Boolean(r.isDemo),
  }));

  const hallUtilisation: HallUtilisation[] = db.prepare(`SELECT * FROM hall_utilisation`).all() as any[];

  const incidents: OperationalIncident[] = (
    db.prepare(`SELECT * FROM operational_incidents ORDER BY rowid DESC`).all() as any[]
  ).map((r) => ({
    id: r.id,
    refNumber: r.refNumber,
    editionId: r.editionId,
    hallOrArea: r.hallOrArea,
    category: r.category,
    severity: r.severity,
    title: r.title,
    description: r.description,
    reportedTime: r.reportedTime,
    resolvedTime: r.resolvedTime || undefined,
    status: r.status,
    resolutionNotes: r.resolutionNotes || undefined,
    isDemo: Boolean(r.isDemo),
  }));

  const marketInsights: MarketInsight[] = (
    db.prepare(`SELECT * FROM market_insights ORDER BY rowid DESC`).all() as any[]
  ).map((r) => ({
    id: r.id,
    title: r.title,
    sector: r.sector,
    marketType: r.marketType,
    summary: r.summary,
    keyIndicators: parseJsonField<string[]>(r.keyIndicatorsJson, []),
    estimatedMarketValueUsd: r.estimatedMarketValueUsd,
    growthRateYoY: r.growthRateYoY,
    zimbabweMarketContext: r.zimbabweMarketContext,
    sourceAttribution: r.sourceAttribution,
    date: r.date,
    isDemo: Boolean(r.isDemo),
  }));

  const reports: BIReport[] = (db.prepare(`SELECT * FROM bi_reports ORDER BY rowid DESC`).all() as any[]).map((r) => ({
    id: r.id,
    reportNumber: r.reportNumber,
    title: r.title,
    pillar: r.pillar,
    editionId: r.editionId,
    generationDate: r.generationDate,
    author: r.author,
    confidentiality: r.confidentiality,
    summaryFindings: r.summaryFindings,
    kpis: parseJsonField<{ label: string; value: string; trend?: string }[]>(r.kpisJson, []),
    recommendations: parseJsonField<string[]>(r.recommendationsJson, []),
    isDemo: Boolean(r.isDemo),
  }));

  const auditLogs: AuditLogItem[] = db
    .prepare(`SELECT * FROM audit_logs ORDER BY timestamp DESC, rowid DESC LIMIT 100`)
    .all() as any[];

  const connectors: ExternalConnector[] = (
    db.prepare(`SELECT * FROM external_connectors`).all() as any[]
  ).map((r) => ({
    ...r,
    dataPath: r.dataPath ?? '',
    authHeaderName: r.authHeaderName ?? undefined,
    authToken: r.authToken ?? undefined,
    lastSyncAt: r.lastSyncAt ?? undefined,
    lastSyncCount: r.lastSyncCount ?? undefined,
    lastLatencyMs: r.lastLatencyMs ?? undefined,
    lastStatusCode: r.lastStatusCode ?? undefined,
    lastError: r.lastError ?? undefined,
    autoDeduplicate: Boolean(r.autoDeduplicate),
    description: r.description ?? undefined,
  }));

  const connectorLogs: ConnectorSyncLog[] = db
    .prepare(`SELECT * FROM connector_sync_logs ORDER BY rowid DESC LIMIT 50`)
    .all() as any[];

  const alertRules: ThresholdAlertRule[] = (
    db.prepare(`SELECT * FROM threshold_alert_rules ORDER BY rowid DESC`).all() as any[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    metricKey: r.metricKey,
    operator: r.operator,
    threshold: r.threshold,
    severity: r.severity,
    editionId: r.editionId,
    notifyRoles: parseJsonField(r.notifyRolesJson, []),
    recipients: r.recipients,
    isActive: Boolean(r.isActive),
    lastEvaluatedAt: r.lastEvaluatedAt ?? undefined,
    lastTriggeredAt: r.lastTriggeredAt ?? undefined,
    createdAt: r.createdAt,
  }));

  const alertEvents: AlertEvent[] = (
    db.prepare(`SELECT * FROM alert_events ORDER BY triggeredAt DESC, rowid DESC LIMIT 100`).all() as any[]
  ).map((e) => ({
    id: e.id,
    ruleId: e.ruleId,
    ruleName: e.ruleName,
    metricKey: e.metricKey,
    metricLabel: e.metricLabel,
    observedValue: e.observedValue,
    threshold: e.threshold,
    operator: e.operator,
    severity: e.severity,
    editionId: e.editionId,
    message: e.message,
    status: e.status,
    triggeredAt: e.triggeredAt,
    acknowledgedBy: e.acknowledgedBy ?? undefined,
    acknowledgedAt: e.acknowledgedAt ?? undefined,
  }));

  const scheduledReports: ScheduledReportConfig[] = (
    db.prepare(`SELECT * FROM scheduled_reports ORDER BY rowid DESC`).all() as any[]
  ).map((s) => ({
    id: s.id,
    name: s.name,
    pillar: s.pillar,
    editionId: s.editionId,
    confidentiality: s.confidentiality,
    frequency: s.frequency,
    runTimeUtc: s.runTimeUtc,
    dayOfWeekOrMonth: s.dayOfWeekOrMonth ?? undefined,
    recipients: s.recipients,
    includeMiningForecast: Boolean(s.includeMiningForecast),
    isActive: Boolean(s.isActive),
    lastRunAt: s.lastRunAt ?? undefined,
    nextRunAt: s.nextRunAt,
    lastReportId: s.lastReportId ?? undefined,
    runCount: Number(s.runCount) || 0,
    createdAt: s.createdAt,
  }));

  const sharedItems: SharedBriefItem[] = (
    db.prepare(`SELECT * FROM shared_items ORDER BY createdAt DESC, rowid DESC`).all() as any[]
  ).map((s) => ({
    id: s.id,
    shareToken: s.shareToken,
    targetType: s.targetType,
    targetId: s.targetId,
    title: s.title,
    editionId: s.editionId,
    sharedByName: s.sharedByName,
    sharedByEmail: s.sharedByEmail,
    sharedByRole: s.sharedByRole,
    recipientEmails: parseJsonField<string[]>(s.recipientEmailsJson, []),
    recipientRoles: parseJsonField<UserRole[]>(s.recipientRolesJson, []),
    accessLevel: s.accessLevel,
    note: s.note,
    workflowStatus: s.workflowStatus,
    approvedBy: s.approvedBy ?? undefined,
    approvedAt: s.approvedAt ?? undefined,
    snapshotSummary: s.snapshotSummary ?? undefined,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt ?? undefined,
  }));

  const annotations: AnnotationComment[] = (
    db.prepare(`SELECT * FROM annotations ORDER BY createdAt DESC, rowid DESC`).all() as any[]
  ).map((a) => ({
    id: a.id,
    targetType: a.targetType,
    targetId: a.targetId,
    targetTitle: a.targetTitle,
    sectionTag: a.sectionTag,
    authorName: a.authorName,
    authorEmail: a.authorEmail,
    authorRole: a.authorRole,
    body: a.body,
    mentions: parseJsonField<string[]>(a.mentionsJson, []),
    status: a.status,
    resolvedBy: a.resolvedBy ?? undefined,
    resolvedAt: a.resolvedAt ?? undefined,
    createdAt: a.createdAt,
  }));

  const emailDispatches: EmailDispatchLog[] = (
    db.prepare(`SELECT * FROM email_dispatches ORDER BY dispatchedAt DESC, rowid DESC LIMIT 100`).all() as any[]
  ).map((e) => ({
    id: e.id,
    targetType: e.targetType,
    targetId: e.targetId,
    subject: e.subject,
    recipients: parseJsonField<string[]>(e.recipientsJson, []),
    bodyPreview: e.bodyPreview,
    shareUrl: e.shareUrl ?? undefined,
    senderName: e.senderName,
    senderEmail: e.senderEmail,
    deliveryMode: e.deliveryMode,
    status: e.status,
    dispatchedAt: e.dispatchedAt,
  }));

  return {
    editions,
    users,
    exhibitors,
    visitors,
    transactions,
    tradeEngagements,
    hallUtilisation,
    incidents,
    marketInsights,
    reports,
    auditLogs,
    connectors,
    connectorLogs,
    alertRules,
    alertEvents,
    scheduledReports,
    sharedItems,
    annotations,
    emailDispatches,
    stats: getWarehouseStats(),
  };
}

export function getWarehouseStateForRole(role: UserRole) {
  const state = getWarehouseState();
  if (!hasPermission(role, 'commercial:read')) {
    return {
      ...state,
      transactions: [] as CommercialTransaction[],
      commercialRedacted: true,
    };
  }
  return {
    ...state,
    commercialRedacted: false,
  };
}

export function clearWarehouseDemoData() {
  const db = getWarehouseDb();
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.exec(`
      DELETE FROM exhibitors WHERE isDemo = 1;
      DELETE FROM visitors WHERE isDemo = 1;
      DELETE FROM commercial_transactions WHERE isDemo = 1;
      DELETE FROM trade_engagements WHERE isDemo = 1;
      DELETE FROM operational_incidents WHERE isDemo = 1;
      DELETE FROM market_insights WHERE isDemo = 1;
      DELETE FROM bi_reports WHERE isDemo = 1;
    `);
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function resetWarehouseToDemoData() {
  const db = getWarehouseDb();
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.exec(`
      DELETE FROM editions;
      DELETE FROM users;
      DELETE FROM exhibitors;
      DELETE FROM visitors;
      DELETE FROM commercial_transactions;
      DELETE FROM trade_engagements;
      DELETE FROM hall_utilisation;
      DELETE FROM operational_incidents;
      DELETE FROM market_insights;
      DELETE FROM bi_reports;
      DELETE FROM audit_logs;
      DELETE FROM external_connectors;
      DELETE FROM connector_sync_logs;
      DELETE FROM threshold_alert_rules;
      DELETE FROM alert_events;
      DELETE FROM scheduled_reports;
      DELETE FROM shared_items;
      DELETE FROM annotations;
      DELETE FROM email_dispatches;
      DELETE FROM user_sessions;
      DELETE FROM user_credentials;
    `);
    seedAllInitialRecords(db);
    seedCollaborationRecords(db);
    seedAllUserCredentials(db);
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function upsertEntity(entity: string, item: any) {
  const db = getWarehouseDb();

  const validationErrors = validateSingleEntityRecord(entity, item);
  if (validationErrors.length > 0) {
    throw new Error(`Data governance validation failed for ${entity}: ${validationErrors.join('; ')}`);
  }

  switch (entity) {
    case 'editions':
      db.prepare(`
        INSERT OR REPLACE INTO editions (id, name, editionNumber, theme, year, startDate, endDate, venue, status, isCurrent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.name,
        item.editionNumber,
        item.theme,
        item.year,
        item.startDate,
        item.endDate,
        item.venue,
        item.status,
        item.isCurrent ? 1 : 0
      );
      break;

    case 'users':
      db.prepare(`
        INSERT OR REPLACE INTO users (id, name, email, role, department, isActive, lastLogin)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(item.id, item.name, item.email, item.role, item.department, item.isActive ? 1 : 0, item.lastLogin);
      if (typeof item.password === 'string' && item.password.trim().length > 0) {
        setUserPassword(db, item.id, item.password.trim());
      } else {
        ensureUserCredential(db, item.id);
      }
      if (!item.isActive) {
        revokeAllUserSessions(db, item.id);
      }
      break;

    case 'exhibitors':
      db.prepare(`
        INSERT OR REPLACE INTO exhibitors (
          id, companyName, regNumber, businessDescription, industry, sector, country, provinceCity,
          contactPerson, email, phone, website, productsServicesJson, editionId, hallStand, standSizeSqm,
          category, registrationDate, bookingStatus, paymentStatus, returningStatus, satisfactionScore,
          participationHistoryJson, isDemo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.companyName,
        item.regNumber,
        item.businessDescription || '',
        item.industry || item.sector || 'General Trade',
        item.sector || 'Commercial',
        item.country || 'Zimbabwe',
        item.provinceCity || 'Bulawayo',
        item.contactPerson || '',
        item.email || '',
        item.phone || '',
        item.website || '',
        JSON.stringify(item.productsServices || []),
        item.editionId || 'zitf-2026',
        item.hallStand || 'Hall 2',
        Number(item.standSizeSqm) || 36,
        item.category || 'Local Commercial',
        item.registrationDate || new Date().toISOString().substring(0, 10),
        item.bookingStatus || 'Confirmed',
        item.paymentStatus || 'Fully Paid',
        item.returningStatus || 'New',
        Number(item.satisfactionScore) || 4.5,
        JSON.stringify(item.participationHistory || [2026]),
        item.isDemo ? 1 : 0
      );
      break;

    case 'visitors':
      db.prepare(`
        INSERT OR REPLACE INTO visitors (
          id, visitorRef, fullName, category, country, cityProvince, organization, industry,
          email, phone, registrationDate, editionId, attendanceDaysJson, interestsJson, areasVisitedJson,
          feedbackRating, repeatVisitor, isDemo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.visitorRef,
        item.fullName,
        item.category || 'Business Visitors',
        item.country || 'Zimbabwe',
        item.cityProvince || 'Bulawayo',
        item.organization || '',
        item.industry || 'Trade & Commerce',
        item.email || '',
        item.phone || '',
        item.registrationDate || new Date().toISOString().substring(0, 10),
        item.editionId || 'zitf-2026',
        JSON.stringify(item.attendanceDays || []),
        JSON.stringify(item.interests || []),
        JSON.stringify(item.areasVisited || []),
        Number(item.feedbackRating) || 4.5,
        item.repeatVisitor ? 1 : 0,
        item.isDemo ? 1 : 0
      );
      break;

    case 'transactions':
      db.prepare(`
        INSERT OR REPLACE INTO commercial_transactions (
          id, refNumber, type, clientName, exhibitorId, amountUsd, outstandingBalanceUsd,
          editionId, status, paymentDate, sector, notes, isDemo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.refNumber,
        item.type,
        item.clientName,
        item.exhibitorId ?? null,
        Number(item.amountUsd) || 0,
        Number(item.outstandingBalanceUsd) || 0,
        item.editionId || 'zitf-2026',
        item.status || 'Fully Paid',
        item.paymentDate || new Date().toISOString().substring(0, 10),
        item.sector || 'General Commercial',
        item.notes || '',
        item.isDemo ? 1 : 0
      );
      break;

    case 'tradeEngagements':
      db.prepare(`
        INSERT OR REPLACE INTO trade_engagements (
          id, refNumber, editionId, date, buyerOrg, buyerCountry, supplierOrg, supplierCountry,
          industry, opportunityType, description, estimatedValueUsd, engagementStatus, followUpDate,
          outcome, verificationStatus, verifiedDate, supportingDocName, isDemo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.refNumber,
        item.editionId || 'zitf-2026',
        item.date || new Date().toISOString().substring(0, 10),
        item.buyerOrg,
        item.buyerCountry || 'Zimbabwe',
        item.supplierOrg,
        item.supplierCountry || 'Zimbabwe',
        item.industry || 'Trade',
        item.opportunityType || 'Supply Contract',
        item.description || '',
        Number(item.estimatedValueUsd) || 0,
        item.engagementStatus || 'Contact Established',
        item.followUpDate || '',
        item.outcome || '',
        item.verificationStatus || 'Facilitated Opportunity',
        item.verifiedDate ?? null,
        item.supportingDocName ?? null,
        item.isDemo ? 1 : 0
      );
      break;

    case 'incidents':
      db.prepare(`
        INSERT OR REPLACE INTO operational_incidents (
          id, refNumber, editionId, hallOrArea, category, severity, title, description,
          reportedTime, resolvedTime, status, resolutionNotes, isDemo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.refNumber,
        item.editionId || 'zitf-2026',
        item.hallOrArea,
        item.category,
        item.severity,
        item.title,
        item.description,
        item.reportedTime,
        item.resolvedTime ?? null,
        item.status,
        item.resolutionNotes ?? null,
        item.isDemo ? 1 : 0
      );
      break;

    case 'marketInsights':
      db.prepare(`
        INSERT OR REPLACE INTO market_insights (
          id, title, sector, marketType, summary, keyIndicatorsJson, estimatedMarketValueUsd,
          growthRateYoY, zimbabweMarketContext, sourceAttribution, date, isDemo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.title,
        item.sector,
        item.marketType,
        item.summary,
        JSON.stringify(item.keyIndicators || []),
        Number(item.estimatedMarketValueUsd) || 0,
        Number(item.growthRateYoY) || 0,
        item.zimbabweMarketContext || '',
        item.sourceAttribution || '',
        item.date || new Date().toISOString().substring(0, 10),
        item.isDemo ? 1 : 0
      );
      break;

    case 'reports':
      db.prepare(`
        INSERT OR REPLACE INTO bi_reports (
          id, reportNumber, title, pillar, editionId, generationDate, author,
          confidentiality, summaryFindings, kpisJson, recommendationsJson, isDemo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.reportNumber,
        item.title,
        item.pillar,
        item.editionId,
        item.generationDate,
        item.author,
        item.confidentiality,
        item.summaryFindings,
        JSON.stringify(item.kpis || []),
        JSON.stringify(item.recommendations || []),
        item.isDemo ? 1 : 0
      );
      break;

    case 'auditLogs':
      db.prepare(`
        INSERT OR REPLACE INTO audit_logs (id, timestamp, userEmail, userRole, action, module, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(item.id, item.timestamp, item.userEmail, item.userRole, item.action, item.module, item.details);
      break;

    case 'connectors':
      db.prepare(`
        INSERT OR REPLACE INTO external_connectors (
          id, name, systemType, mode, targetModule, endpointUrl, dataPath, authType,
          authHeaderName, authToken, status, lastSyncAt, lastSyncCount, lastLatencyMs,
          lastStatusCode, lastError, autoDeduplicate, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.name,
        item.systemType,
        item.mode,
        item.targetModule,
        item.endpointUrl,
        item.dataPath ?? null,
        item.authType || 'None',
        item.authHeaderName ?? null,
        item.authToken ?? null,
        item.status || 'Connected',
        item.lastSyncAt ?? null,
        item.lastSyncCount ?? null,
        item.lastLatencyMs ?? null,
        item.lastStatusCode ?? null,
        item.lastError ?? null,
        item.autoDeduplicate ? 1 : 0,
        item.description ?? null
      );
      break;

    case 'connectorLogs':
      db.prepare(`
        INSERT OR REPLACE INTO connector_sync_logs (
          id, connectorId, connectorName, timestamp, status, statusCode, latencyMs,
          recordsFetched, recordsImported, duplicatesSkipped, message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.connectorId,
        item.connectorName,
        item.timestamp,
        item.status,
        item.statusCode ?? null,
        item.latencyMs ?? null,
        item.recordsFetched || 0,
        item.recordsImported || 0,
        item.duplicatesSkipped || 0,
        item.message
      );
      break;

    case 'alertRules':
      db.prepare(`
        INSERT OR REPLACE INTO threshold_alert_rules (
          id, name, metricKey, operator, threshold, severity, editionId, notifyRolesJson,
          recipients, isActive, lastEvaluatedAt, lastTriggeredAt, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.name,
        item.metricKey,
        item.operator,
        Number(item.threshold) || 0,
        item.severity || 'Warning',
        item.editionId || 'zitf-2026',
        JSON.stringify(item.notifyRoles || []),
        item.recipients || '',
        item.isActive ? 1 : 0,
        item.lastEvaluatedAt ?? null,
        item.lastTriggeredAt ?? null,
        item.createdAt || new Date().toISOString()
      );
      break;

    case 'alertEvents':
      db.prepare(`
        INSERT OR REPLACE INTO alert_events (
          id, ruleId, ruleName, metricKey, metricLabel, observedValue, threshold,
          operator, severity, editionId, message, status, triggeredAt, acknowledgedBy, acknowledgedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.ruleId,
        item.ruleName,
        item.metricKey,
        item.metricLabel,
        Number(item.observedValue) || 0,
        Number(item.threshold) || 0,
        item.operator,
        item.severity,
        item.editionId || 'zitf-2026',
        item.message,
        item.status || 'Active',
        item.triggeredAt,
        item.acknowledgedBy ?? null,
        item.acknowledgedAt ?? null
      );
      break;

    case 'scheduledReports':
      db.prepare(`
        INSERT OR REPLACE INTO scheduled_reports (
          id, name, pillar, editionId, confidentiality, frequency, runTimeUtc,
          dayOfWeekOrMonth, recipients, includeMiningForecast, isActive,
          lastRunAt, nextRunAt, lastReportId, runCount, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.name,
        item.pillar || 'Executive',
        item.editionId || 'zitf-2026',
        item.confidentiality || 'Management Internal',
        item.frequency || 'Daily',
        item.runTimeUtc || '07:00',
        item.dayOfWeekOrMonth ?? null,
        item.recipients || '',
        item.includeMiningForecast ? 1 : 0,
        item.isActive ? 1 : 0,
        item.lastRunAt ?? null,
        item.nextRunAt || computeNextRunIso(item.frequency || 'Daily', item.runTimeUtc || '07:00'),
        item.lastReportId ?? null,
        Number(item.runCount) || 0,
        item.createdAt || new Date().toISOString()
      );
      break;

    case 'sharedItems':
      db.prepare(`
        INSERT OR REPLACE INTO shared_items (
          id, shareToken, targetType, targetId, title, editionId, sharedByName, sharedByEmail,
          sharedByRole, recipientEmailsJson, recipientRolesJson, accessLevel, note, workflowStatus,
          approvedBy, approvedAt, snapshotSummary, createdAt, expiresAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.shareToken,
        item.targetType,
        item.targetId,
        item.title,
        item.editionId || 'zitf-2026',
        item.sharedByName,
        item.sharedByEmail,
        item.sharedByRole,
        JSON.stringify(item.recipientEmails || []),
        JSON.stringify(item.recipientRoles || []),
        item.accessLevel || 'Comment & Annotate',
        item.note || '',
        item.workflowStatus || 'Shared',
        item.approvedBy ?? null,
        item.approvedAt ?? null,
        item.snapshotSummary ?? null,
        item.createdAt || new Date().toISOString(),
        item.expiresAt ?? null
      );
      break;

    case 'annotations':
      db.prepare(`
        INSERT OR REPLACE INTO annotations (
          id, targetType, targetId, targetTitle, sectionTag, authorName, authorEmail, authorRole,
          body, mentionsJson, status, resolvedBy, resolvedAt, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.targetType,
        item.targetId,
        item.targetTitle,
        item.sectionTag || 'General',
        item.authorName,
        item.authorEmail,
        item.authorRole,
        item.body,
        JSON.stringify(item.mentions || []),
        item.status || 'Open',
        item.resolvedBy ?? null,
        item.resolvedAt ?? null,
        item.createdAt || new Date().toISOString().replace('T', ' ').substring(0, 19)
      );
      break;

    case 'emailDispatches':
      db.prepare(`
        INSERT OR REPLACE INTO email_dispatches (
          id, targetType, targetId, subject, recipientsJson, bodyPreview, shareUrl,
          senderName, senderEmail, deliveryMode, status, dispatchedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.targetType,
        item.targetId,
        item.subject,
        JSON.stringify(item.recipients || []),
        item.bodyPreview,
        item.shareUrl ?? null,
        item.senderName,
        item.senderEmail,
        item.deliveryMode,
        item.status,
        item.dispatchedAt
      );
      break;

    default:
      throw new Error(`Unknown warehouse entity: ${entity}`);
  }
}

export function batchUpsertEntity(entity: string, items: any[]) {
  const db = getWarehouseDb();
  db.exec('BEGIN IMMEDIATE;');
  try {
    for (const item of items) {
      upsertEntity(entity, item);
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function deleteEntity(entity: string, id: string) {
  const db = getWarehouseDb();
  const tableMap: Record<string, string> = {
    editions: 'editions',
    users: 'users',
    exhibitors: 'exhibitors',
    visitors: 'visitors',
    transactions: 'commercial_transactions',
    tradeEngagements: 'trade_engagements',
    incidents: 'operational_incidents',
    marketInsights: 'market_insights',
    reports: 'bi_reports',
    connectors: 'external_connectors',
    alertRules: 'threshold_alert_rules',
    alertEvents: 'alert_events',
    scheduledReports: 'scheduled_reports',
    sharedItems: 'shared_items',
    annotations: 'annotations',
    emailDispatches: 'email_dispatches',
  };
  const table = tableMap[entity];
  if (!table) {
    throw new Error(`Delete not supported for entity: ${entity}`);
  }
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  if (entity === 'users') {
    db.prepare(`DELETE FROM user_credentials WHERE userId = ?`).run(id);
    db.prepare(`DELETE FROM user_sessions WHERE userId = ?`).run(id);
  }
}

export function patchEntity(entity: string, id: string, updates: Record<string, any>) {
  const state = getWarehouseState() as Record<string, any>;
  const collection = state[entity];
  if (!Array.isArray(collection)) {
    throw new Error(`Patch not supported for entity: ${entity}`);
  }
  const existing = collection.find((item: any) => item.id === id);
  if (!existing) {
    throw new Error(`Record ${id} not found in ${entity}`);
  }
  const merged = { ...existing, ...updates, id };
  upsertEntity(entity, merged);
  return merged;
}

export function governedBatchImport(
  targetModule: ConnectorTargetModule,
  rawRecords: Record<string, any>[],
  options: {
    skipDuplicates?: boolean;
    defaultEditionId?: string;
    userEmail?: string;
    userRole?: string;
  } = {}
): GovernedImportResult {
  const validModules: ConnectorTargetModule[] = ['exhibitors', 'visitors', 'commercial', 'trade'];
  if (!validModules.includes(targetModule)) {
    throw new Error(`Unsupported governance module: ${targetModule}`);
  }

  const db = getWarehouseDb();
  const skipDuplicates = options.skipDuplicates ?? true;
  const state = getWarehouseState();

  const result = governDatasetBatch(
    targetModule,
    rawRecords,
    {
      exhibitors: state.exhibitors,
      visitors: state.visitors,
      transactions: state.transactions,
      tradeEngagements: state.tradeEngagements,
    },
    {
      skipDuplicates,
      defaultEditionId: options.defaultEditionId,
    }
  );

  const entityMap: Record<ConnectorTargetModule, string> = {
    exhibitors: 'exhibitors',
    visitors: 'visitors',
    commercial: 'transactions',
    trade: 'tradeEngagements',
  };
  const entityName = entityMap[targetModule];

  db.exec('BEGIN IMMEDIATE;');
  try {
    for (const item of result.validPayloads) {
      upsertEntity(entityName, item);
    }

    const auditEntry: AuditLogItem = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userEmail: options.userEmail || 'system@zitf.co.zw',
      userRole: (options.userRole as any) || 'Data Analyst',
      action: 'Governed Batch Import',
      module: 'Data Management',
      details: `Server SQLite governance processed ${rawRecords.length} ${targetModule} row(s): ${result.validPayloads.length} committed, ${result.duplicateRows.length} duplicate(s) blocked, ${result.rejectedRows.length} rejected by schema validator.`,
    };
    upsertEntity('auditLogs', auditEntry);

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  // Re-evaluate configured threshold alerts immediately after batch ingestion
  try {
    evaluateWarehouseAlerts(options.userEmail || 'governance@zitf.co.zw');
  } catch {
    // non-fatal
  }

  return {
    ok: true,
    targetModule,
    successCount: result.validPayloads.length,
    errorCount: result.rejectedRows.length,
    duplicateCount: result.duplicateRows.length,
    importedItems: result.validPayloads,
    rejectedRows: result.rejectedRows,
    duplicateRows: result.duplicateRows,
    stats: getWarehouseStats(),
  };
}

export function evaluateWarehouseAlerts(actorEmail = 'alerts@zitf.co.zw') {
  const db = getWarehouseDb();
  const state = getWarehouseState();
  const nowIso = new Date().toISOString();

  const { evaluations, newlyTriggeredEvents, updatedRules } = evaluateAlertRules(
    state.alertRules,
    state.alertEvents,
    state,
    nowIso
  );

  db.exec('BEGIN IMMEDIATE;');
  try {
    for (const rule of updatedRules) {
      upsertEntity('alertRules', rule);
    }
    for (const evt of newlyTriggeredEvents) {
      upsertEntity('alertEvents', evt);
    }
    if (newlyTriggeredEvents.length > 0) {
      upsertEntity('auditLogs', {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        timestamp: nowIso.replace('T', ' ').substring(0, 19),
        userEmail: actorEmail,
        userRole: 'Data Analyst',
        action: 'Threshold Alert Triggered',
        module: 'Reports & Alerts',
        details: `${newlyTriggeredEvents.length} threshold alert(s) breached: ${newlyTriggeredEvents
          .map((e) => e.ruleName)
          .join(', ')}`,
      });
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  const nextState = getWarehouseState();
  return {
    ok: true,
    evaluatedAt: nowIso,
    triggeredCount: newlyTriggeredEvents.length,
    newlyTriggeredEvents,
    evaluations,
    alertRules: nextState.alertRules,
    alertEvents: nextState.alertEvents,
    stats: nextState.stats,
  };
}

export function acknowledgeOrResolveAlertEvent(
  eventId: string,
  nextStatus: 'Acknowledged' | 'Resolved' | 'Active',
  actorName = 'System Administrator'
) {
  const state = getWarehouseState();
  const existing = state.alertEvents.find((e) => e.id === eventId);
  if (!existing) {
    throw new Error(`Alert event ${eventId} not found`);
  }

  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const updated: AlertEvent = {
    ...existing,
    status: nextStatus,
    acknowledgedBy: nextStatus === 'Active' ? undefined : actorName,
    acknowledgedAt: nextStatus === 'Active' ? undefined : nowStr,
  };
  upsertEntity('alertEvents', updated);

  return {
    ok: true,
    event: updated,
    stats: getWarehouseStats(),
  };
}

export function executeScheduledReportNow(scheduleId: string, actorEmail = 'scheduler@zitf.co.zw') {
  const db = getWarehouseDb();
  const state = getWarehouseState();
  const schedule = state.scheduledReports.find((s) => s.id === scheduleId);
  if (!schedule) {
    throw new Error(`Scheduled report ${scheduleId} not found`);
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const generatedReport = buildAutomatedBIReport(schedule, state, now);
  const nextSchedule: ScheduledReportConfig = {
    ...schedule,
    lastRunAt: nowIso,
    nextRunAt: computeNextRunIso(schedule.frequency, schedule.runTimeUtc, now),
    lastReportId: generatedReport.id,
    runCount: (schedule.runCount || 0) + 1,
  };

  db.exec('BEGIN IMMEDIATE;');
  try {
    upsertEntity('reports', generatedReport);
    upsertEntity('scheduledReports', nextSchedule);
    upsertEntity('auditLogs', {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: nowIso.replace('T', ' ').substring(0, 19),
      userEmail: actorEmail,
      userRole: 'Executive Management',
      action: 'Scheduled Report Executed',
      module: 'Reports & Alerts',
      details: `Compiled scheduled report "${schedule.name}" (${generatedReport.reportNumber}) for delivery to ${schedule.recipients || 'Executive Committee'}.`,
    });
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  return {
    ok: true,
    report: generatedReport,
    schedule: nextSchedule,
    stats: getWarehouseStats(),
  };
}

export function processDueScheduledReports() {
  const state = getWarehouseState();
  const nowMs = Date.now();
  const dueSchedules = state.scheduledReports.filter(
    (s) => s.isActive && Date.parse(s.nextRunAt) <= nowMs
  );

  const executed: { scheduleId: string; reportId: string }[] = [];
  for (const sched of dueSchedules) {
    const res = executeScheduledReportNow(sched.id, 'auto-scheduler@zitf.co.zw');
    executed.push({ scheduleId: sched.id, reportId: res.report.id });
  }
  return {
    ok: true,
    checkedCount: state.scheduledReports.length,
    executedCount: executed.length,
    executed,
  };
}

// ==========================================
// Share, Annotations, Workflow & Email Dispatch
// ==========================================
export function createSharedBrief(input: {
  targetType: CollaborationTargetType;
  targetId: string;
  title: string;
  editionId: string;
  sharedByName: string;
  sharedByEmail: string;
  sharedByRole: UserRole;
  recipientEmails: string[];
  recipientRoles?: UserRole[];
  accessLevel?: SharedBriefItem['accessLevel'];
  note?: string;
  snapshotSummary?: string;
}) {
  const db = getWarehouseDb();
  const token = `ZITF-SHR-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const nowIso = new Date().toISOString();
  const item: SharedBriefItem = {
    id: `shr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    shareToken: token,
    targetType: input.targetType,
    targetId: input.targetId,
    title: input.title,
    editionId: input.editionId || 'zitf-2026',
    sharedByName: input.sharedByName,
    sharedByEmail: input.sharedByEmail,
    sharedByRole: input.sharedByRole,
    recipientEmails: input.recipientEmails.map((e) => e.trim()).filter(Boolean),
    recipientRoles: input.recipientRoles || [],
    accessLevel: input.accessLevel || 'Comment & Annotate',
    note: input.note || '',
    workflowStatus: input.accessLevel === 'Approve / Sign-Off' ? 'In Review' : 'Shared',
    snapshotSummary: input.snapshotSummary,
    createdAt: nowIso,
  };

  db.exec('BEGIN IMMEDIATE;');
  try {
    upsertEntity('sharedItems', item);
    upsertEntity('auditLogs', {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: nowIso.replace('T', ' ').substring(0, 19),
      userEmail: input.sharedByEmail,
      userRole: input.sharedByRole,
      action: 'In-App Share Created',
      module: 'Share & Collaborate',
      details: `Shared ${input.targetType} "${input.title}" (${token}) with ${
        item.recipientEmails.join(', ') || 'internal roles'
      } [${item.accessLevel}].`,
    });
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  return item;
}

export function updateSharedWorkflow(
  id: string,
  workflowStatus: CollaborationWorkflowStatus,
  actorName: string,
  actorEmail: string,
  actorRole: UserRole
) {
  const db = getWarehouseDb();
  const state = getWarehouseState();
  const existing = state.sharedItems.find((s) => s.id === id);
  if (!existing) {
    throw new Error(`Shared item ${id} not found`);
  }

  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const updated: SharedBriefItem = {
    ...existing,
    workflowStatus,
    approvedBy: workflowStatus === 'Approved' ? actorName : existing.approvedBy,
    approvedAt: workflowStatus === 'Approved' ? nowStr : existing.approvedAt,
  };

  db.exec('BEGIN IMMEDIATE;');
  try {
    upsertEntity('sharedItems', updated);
    upsertEntity('auditLogs', {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: nowStr,
      userEmail: actorEmail,
      userRole: actorRole,
      action: `Workflow -> ${workflowStatus}`,
      module: 'Share & Collaborate',
      details: `${actorName} transitioned "${existing.title}" (${existing.shareToken}) to ${workflowStatus}.`,
    });
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  return updated;
}

export function createAnnotationComment(input: {
  targetType: CollaborationTargetType;
  targetId: string;
  targetTitle: string;
  sectionTag: string;
  authorName: string;
  authorEmail: string;
  authorRole: UserRole;
  body: string;
}) {
  const db = getWarehouseDb();
  const mentions = Array.from(
    new Set(
      (input.body.match(/@[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).map((m) =>
        m.slice(1).toLowerCase()
      )
    )
  );
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const comment: AnnotationComment = {
    id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    targetType: input.targetType,
    targetId: input.targetId,
    targetTitle: input.targetTitle,
    sectionTag: input.sectionTag || 'General',
    authorName: input.authorName,
    authorEmail: input.authorEmail,
    authorRole: input.authorRole,
    body: input.body.trim(),
    mentions,
    status: 'Open',
    createdAt: nowStr,
  };

  db.exec('BEGIN IMMEDIATE;');
  try {
    upsertEntity('annotations', comment);
    upsertEntity('auditLogs', {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: nowStr,
      userEmail: input.authorEmail,
      userRole: input.authorRole,
      action: 'Annotation Posted',
      module: 'Share & Collaborate',
      details: `Annotated [${comment.sectionTag}] on ${input.targetType} "${input.targetTitle}".`,
    });
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  return comment;
}

export function updateAnnotationStatus(
  id: string,
  status: 'Open' | 'Resolved',
  actorName: string
) {
  const state = getWarehouseState();
  const existing = state.annotations.find((a) => a.id === id);
  if (!existing) {
    throw new Error(`Annotation ${id} not found`);
  }
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const updated: AnnotationComment = {
    ...existing,
    status,
    resolvedBy: status === 'Resolved' ? actorName : undefined,
    resolvedAt: status === 'Resolved' ? nowStr : undefined,
  };
  upsertEntity('annotations', updated);
  return updated;
}

export async function dispatchEmailBrief(input: {
  targetType: CollaborationTargetType;
  targetId: string;
  subject: string;
  recipients: string[];
  body: string;
  shareUrl?: string;
  senderName: string;
  senderEmail: string;
  senderRole: UserRole;
}) {
  const recipients = input.recipients.map((r) => r.trim()).filter(Boolean);
  if (recipients.length === 0) {
    throw new Error('At least one recipient email address is required.');
  }

  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  let deliveryMode: EmailDispatchLog['deliveryMode'] = 'MIME Queue & Mailto Dispatch';
  let status: EmailDispatchLog['status'] = 'Queued (MIME Ready)';

  const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
  if (webhookUrl) {
    deliveryMode = 'Webhook Relay';
    try {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${input.senderName} <${input.senderEmail}>`,
          to: recipients,
          subject: input.subject,
          text: input.body,
          shareUrl: input.shareUrl,
        }),
      });
      status = resp.ok ? 'Dispatched' : 'Failed';
    } catch {
      status = 'Failed';
    }
  }

  const emlLines = [
    `From: ${input.senderName} <${input.senderEmail}>`,
    `To: ${recipients.join(', ')}`,
    `Subject: ${input.subject}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    '',
    input.body,
    input.shareUrl ? `\nDirect ZITF BI Link: ${input.shareUrl}` : '',
  ].join('\r\n');

  const mailtoUrl = `mailto:${encodeURIComponent(recipients.join(','))}?subject=${encodeURIComponent(
    input.subject
  )}&body=${encodeURIComponent(
    `${input.body}${input.shareUrl ? `\n\nOpen in ZITF BI: ${input.shareUrl}` : ''}`
  )}`;

  const logItem: EmailDispatchLog = {
    id: `eml-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    targetType: input.targetType,
    targetId: input.targetId,
    subject: input.subject,
    recipients,
    bodyPreview: input.body.slice(0, 240),
    shareUrl: input.shareUrl,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    deliveryMode,
    status,
    dispatchedAt: nowStr,
  };

  const db = getWarehouseDb();
  db.exec('BEGIN IMMEDIATE;');
  try {
    upsertEntity('emailDispatches', logItem);
    upsertEntity('auditLogs', {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: nowStr,
      userEmail: input.senderEmail,
      userRole: input.senderRole,
      action: 'Email Brief Dispatched',
      module: 'Share & Collaborate',
      details: `Dispatched "${input.subject}" to ${recipients.join(', ')} (${status}).`,
    });
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  return {
    ok: true,
    dispatch: logItem,
    mailtoUrl,
    emlContent: emlLines,
    stats: getWarehouseStats(),
  };
}

// ==========================================
// Scalable Server Storage, Preferences & Query Engine
// ==========================================

export function getUserPreferences(userId: string): UserWorkspacePreferences {
  const db = getWarehouseDb();
  const row = db
    .prepare(
      `SELECT userId, selectedEditionId, selectedPeriod, selectedSector, geographicFilter, updatedAt
       FROM user_preferences WHERE userId = ? LIMIT 1`
    )
    .get(userId) as any;

  if (!row) {
    return {
      userId,
      selectedEditionId: 'zitf-2026',
      selectedPeriod: 'all',
      selectedSector: 'all',
      geographicFilter: 'all',
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    userId: row.userId,
    selectedEditionId: row.selectedEditionId || 'zitf-2026',
    selectedPeriod: row.selectedPeriod || 'all',
    selectedSector: row.selectedSector || 'all',
    geographicFilter:
      row.geographicFilter === 'local' || row.geographicFilter === 'international'
        ? row.geographicFilter
        : 'all',
    updatedAt: row.updatedAt,
  };
}

export function saveUserPreferences(
  userId: string,
  updates: Partial<Omit<UserWorkspacePreferences, 'userId' | 'updatedAt'>>
): UserWorkspacePreferences {
  const db = getWarehouseDb();
  const current = getUserPreferences(userId);
  const next: UserWorkspacePreferences = {
    userId,
    selectedEditionId:
      typeof updates.selectedEditionId === 'string' && updates.selectedEditionId.trim()
        ? updates.selectedEditionId.trim()
        : current.selectedEditionId,
    selectedPeriod:
      typeof updates.selectedPeriod === 'string' && updates.selectedPeriod.trim()
        ? updates.selectedPeriod.trim()
        : current.selectedPeriod,
    selectedSector:
      typeof updates.selectedSector === 'string' && updates.selectedSector.trim()
        ? updates.selectedSector.trim()
        : current.selectedSector,
    geographicFilter:
      updates.geographicFilter === 'local' ||
      updates.geographicFilter === 'international' ||
      updates.geographicFilter === 'all'
        ? updates.geographicFilter
        : current.geographicFilter,
    updatedAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT OR REPLACE INTO user_preferences
     (userId, selectedEditionId, selectedPeriod, selectedSector, geographicFilter, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    next.userId,
    next.selectedEditionId,
    next.selectedPeriod,
    next.selectedSector,
    next.geographicFilter,
    next.updatedAt
  );

  return next;
}

export function saveStorageObject(input: {
  category: StorageObjectRecord['category'];
  filename: string;
  mimeType?: string;
  textContent?: string;
  contentBase64?: string;
  uploadedByEmail: string;
  uploadedByRole: UserRole;
  moduleRef?: string;
}): StorageObjectRecord {
  const db = getWarehouseDb();
  if (!fs.existsSync(OBJECTS_DIR)) {
    fs.mkdirSync(OBJECTS_DIR, { recursive: true });
  }

  const buffer =
    typeof input.contentBase64 === 'string' && input.contentBase64.length > 0
      ? Buffer.from(input.contentBase64, 'base64')
      : Buffer.from(String(input.textContent || ''), 'utf8');

  if (buffer.byteLength === 0) {
    throw new Error('Cannot store an empty file in server object storage.');
  }
  if (buffer.byteLength > 10 * 1024 * 1024) {
    throw new Error('File exceeds maximum 10 MB object storage limit.');
  }

  const safeBaseName = path.basename(input.filename || 'dataset.csv').replace(/[^a-zA-Z0-9._-]/g, '_');
  const id = `obj-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const diskFilename = `${id}_${safeBaseName}`;
  const diskPath = path.join(OBJECTS_DIR, diskFilename);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const createdAt = new Date().toISOString();

  fs.writeFileSync(diskPath, buffer);

  const mimeType =
    input.mimeType ||
    (safeBaseName.endsWith('.json')
      ? 'application/json'
      : safeBaseName.endsWith('.csv')
      ? 'text/csv'
      : 'application/octet-stream');

  db.prepare(
    `INSERT INTO storage_objects
     (id, category, filename, mimeType, sizeBytes, sha256, diskPath, uploadedByEmail, uploadedByRole, moduleRef, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.category,
    safeBaseName,
    mimeType,
    buffer.byteLength,
    sha256,
    diskFilename,
    input.uploadedByEmail,
    input.uploadedByRole,
    input.moduleRef || null,
    createdAt
  );

  return {
    id,
    category: input.category,
    filename: safeBaseName,
    mimeType,
    sizeBytes: buffer.byteLength,
    sha256,
    uploadedByEmail: input.uploadedByEmail,
    uploadedByRole: input.uploadedByRole,
    moduleRef: input.moduleRef,
    createdAt,
  };
}

export function listStorageObjects(category?: string): StorageObjectRecord[] {
  const db = getWarehouseDb();
  const rows = category
    ? (db
        .prepare(
          `SELECT id, category, filename, mimeType, sizeBytes, sha256, uploadedByEmail, uploadedByRole, moduleRef, createdAt
           FROM storage_objects WHERE category = ? ORDER BY createdAt DESC LIMIT 200`
        )
        .all(category) as any[])
    : (db
        .prepare(
          `SELECT id, category, filename, mimeType, sizeBytes, sha256, uploadedByEmail, uploadedByRole, moduleRef, createdAt
           FROM storage_objects ORDER BY createdAt DESC LIMIT 200`
        )
        .all() as any[]);

  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    filename: r.filename,
    mimeType: r.mimeType,
    sizeBytes: Number(r.sizeBytes),
    sha256: r.sha256,
    uploadedByEmail: r.uploadedByEmail,
    uploadedByRole: r.uploadedByRole as UserRole,
    moduleRef: r.moduleRef || undefined,
    createdAt: r.createdAt,
  }));
}

export function readStorageObjectFile(
  id: string
): { record: StorageObjectRecord; buffer: Buffer } | null {
  const db = getWarehouseDb();
  const row = db
    .prepare(
      `SELECT id, category, filename, mimeType, sizeBytes, sha256, diskPath, uploadedByEmail, uploadedByRole, moduleRef, createdAt
       FROM storage_objects WHERE id = ? LIMIT 1`
    )
    .get(id) as any;

  if (!row) return null;
  const fullPath = path.resolve(OBJECTS_DIR, path.basename(row.diskPath));
  if (!fullPath.startsWith(OBJECTS_DIR) || !fs.existsSync(fullPath)) {
    return null;
  }

  const buffer = fs.readFileSync(fullPath);
  return {
    record: {
      id: row.id,
      category: row.category,
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes),
      sha256: row.sha256,
      uploadedByEmail: row.uploadedByEmail,
      uploadedByRole: row.uploadedByRole as UserRole,
      moduleRef: row.moduleRef || undefined,
      createdAt: row.createdAt,
    },
    buffer,
  };
}

export function deleteStorageObject(id: string): boolean {
  const db = getWarehouseDb();
  const row = db.prepare(`SELECT diskPath FROM storage_objects WHERE id = ? LIMIT 1`).get(id) as any;
  if (!row) return false;
  const fullPath = path.resolve(OBJECTS_DIR, path.basename(row.diskPath));
  if (fullPath.startsWith(OBJECTS_DIR) && fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
  db.prepare(`DELETE FROM storage_objects WHERE id = ?`).run(id);
  return true;
}

export function recordClientErrorLog(
  entry: Omit<ClientErrorLogEntry, 'id' | 'createdAt'>
): ClientErrorLogEntry {
  const db = getWarehouseDb();
  const item: ClientErrorLogEntry = {
    id: `err-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    scope: entry.scope === 'app' || entry.scope === 'widget' ? entry.scope : 'module',
    moduleName: String(entry.moduleName || 'Unknown').slice(0, 120),
    message: String(entry.message || 'Unhandled UI exception').slice(0, 500),
    stackPreview: entry.stackPreview ? String(entry.stackPreview).slice(0, 1500) : undefined,
    componentStackPreview: entry.componentStackPreview
      ? String(entry.componentStackPreview).slice(0, 1500)
      : undefined,
    userEmail: entry.userEmail ? String(entry.userEmail).slice(0, 120) : undefined,
    userRole: entry.userRole ? String(entry.userRole).slice(0, 80) : undefined,
    urlPath: entry.urlPath ? String(entry.urlPath).slice(0, 200) : undefined,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO client_error_logs
     (id, scope, moduleName, message, stackPreview, componentStackPreview, userEmail, userRole, urlPath, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    item.id,
    item.scope,
    item.moduleName,
    item.message,
    item.stackPreview || null,
    item.componentStackPreview || null,
    item.userEmail || null,
    item.userRole || null,
    item.urlPath || null,
    item.createdAt
  );

  return item;
}

export function listClientErrorLogs(limit = 50): ClientErrorLogEntry[] {
  const db = getWarehouseDb();
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const rows = db
    .prepare(
      `SELECT id, scope, moduleName, message, stackPreview, componentStackPreview, userEmail, userRole, urlPath, createdAt
       FROM client_error_logs ORDER BY createdAt DESC LIMIT ?`
    )
    .all(safeLimit) as any[];

  return rows.map((r) => ({
    id: r.id,
    scope: r.scope,
    moduleName: r.moduleName,
    message: r.message,
    stackPreview: r.stackPreview || undefined,
    componentStackPreview: r.componentStackPreview || undefined,
    userEmail: r.userEmail || undefined,
    userRole: r.userRole || undefined,
    urlPath: r.urlPath || undefined,
    createdAt: r.createdAt,
  }));
}

export function queryWarehouseEntity(params: {
  entity: string;
  editionId?: string;
  sector?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  role?: UserRole;
}): PaginatedWarehouseQueryResult<any> {
  const db = getWarehouseDb();
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const limit = Math.max(1, Math.min(200, Math.floor(Number(params.limit) || 50)));
  const offset = (page - 1) * limit;

  if (params.entity === 'transactions' && params.role && !hasPermission(params.role, 'commercial:read')) {
    return {
      entity: params.entity,
      items: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
      redacted: true,
    };
  }

  const clauses: string[] = [];
  const bindParams: (string | number)[] = [];
  const searchLike = params.search && params.search.trim() ? `%${params.search.trim().toLowerCase()}%` : null;

  if (params.entity === 'exhibitors') {
    if (params.editionId && params.editionId !== 'all') {
      clauses.push('editionId = ?');
      bindParams.push(params.editionId);
    }
    if (params.sector && params.sector !== 'all') {
      clauses.push('(sector = ? OR industry = ?)');
      bindParams.push(params.sector, params.sector);
    }
    if (params.status && params.status !== 'all') {
      clauses.push('bookingStatus = ?');
      bindParams.push(params.status);
    }
    if (searchLike) {
      clauses.push('(LOWER(companyName) LIKE ? OR LOWER(regNumber) LIKE ? OR LOWER(country) LIKE ?)');
      bindParams.push(searchLike, searchLike, searchLike);
    }
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const total = Number(
      (db.prepare(`SELECT COUNT(*) AS cnt FROM exhibitors ${whereSql}`).get(...bindParams) as any)?.cnt || 0
    );
    const rows = db
      .prepare(`SELECT * FROM exhibitors ${whereSql} ORDER BY registrationDate DESC LIMIT ? OFFSET ?`)
      .all(...bindParams, limit, offset) as any[];
    const items = rows.map((r) => ({
      id: r.id,
      companyName: r.companyName,
      regNumber: r.regNumber,
      businessDescription: r.businessDescription,
      industry: r.industry,
      sector: r.sector,
      country: r.country,
      provinceCity: r.provinceCity,
      contactPerson: r.contactPerson,
      email: r.email,
      phone: r.phone,
      website: r.website,
      productsServices: parseJsonField<string[]>(r.productsServicesJson, []),
      editionId: r.editionId,
      hallStand: r.hallStand,
      standSizeSqm: Number(r.standSizeSqm),
      category: r.category,
      registrationDate: r.registrationDate,
      bookingStatus: r.bookingStatus,
      paymentStatus: r.paymentStatus,
      returningStatus: r.returningStatus,
      satisfactionScore: Number(r.satisfactionScore),
      participationHistory: parseJsonField<number[]>(r.participationHistoryJson, []),
      isDemo: Boolean(r.isDemo),
    }));
    return {
      entity: params.entity,
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  if (params.entity === 'visitors') {
    if (params.editionId && params.editionId !== 'all') {
      clauses.push('editionId = ?');
      bindParams.push(params.editionId);
    }
    if (params.sector && params.sector !== 'all') {
      clauses.push('industry = ?');
      bindParams.push(params.sector);
    }
    if (params.status && params.status !== 'all') {
      clauses.push('category = ?');
      bindParams.push(params.status);
    }
    if (searchLike) {
      clauses.push('(LOWER(fullName) LIKE ? OR LOWER(organization) LIKE ? OR LOWER(visitorRef) LIKE ?)');
      bindParams.push(searchLike, searchLike, searchLike);
    }
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const total = Number(
      (db.prepare(`SELECT COUNT(*) AS cnt FROM visitors ${whereSql}`).get(...bindParams) as any)?.cnt || 0
    );
    const rows = db
      .prepare(`SELECT * FROM visitors ${whereSql} ORDER BY registrationDate DESC LIMIT ? OFFSET ?`)
      .all(...bindParams, limit, offset) as any[];
    const items = rows.map((r) => ({
      id: r.id,
      visitorRef: r.visitorRef,
      fullName: r.fullName,
      category: r.category,
      country: r.country,
      cityProvince: r.cityProvince,
      organization: r.organization,
      industry: r.industry,
      email: r.email,
      phone: r.phone,
      registrationDate: r.registrationDate,
      editionId: r.editionId,
      attendanceDays: parseJsonField<string[]>(r.attendanceDaysJson, []),
      interests: parseJsonField<string[]>(r.interestsJson, []),
      areasVisited: parseJsonField<string[]>(r.areasVisitedJson, []),
      feedbackRating: Number(r.feedbackRating),
      repeatVisitor: Boolean(r.repeatVisitor),
      isDemo: Boolean(r.isDemo),
    }));
    return {
      entity: params.entity,
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  if (params.entity === 'transactions') {
    if (params.editionId && params.editionId !== 'all') {
      clauses.push('editionId = ?');
      bindParams.push(params.editionId);
    }
    if (params.sector && params.sector !== 'all') {
      clauses.push('sector = ?');
      bindParams.push(params.sector);
    }
    if (params.status && params.status !== 'all') {
      clauses.push('status = ?');
      bindParams.push(params.status);
    }
    if (searchLike) {
      clauses.push('(LOWER(clientName) LIKE ? OR LOWER(refNumber) LIKE ? OR LOWER(type) LIKE ?)');
      bindParams.push(searchLike, searchLike, searchLike);
    }
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const total = Number(
      (db.prepare(`SELECT COUNT(*) AS cnt FROM commercial_transactions ${whereSql}`).get(...bindParams) as any)?.cnt || 0
    );
    const rows = db
      .prepare(`SELECT * FROM commercial_transactions ${whereSql} ORDER BY paymentDate DESC LIMIT ? OFFSET ?`)
      .all(...bindParams, limit, offset) as any[];
    const items = rows.map((r) => ({
      id: r.id,
      refNumber: r.refNumber,
      type: r.type,
      clientName: r.clientName,
      exhibitorId: r.exhibitorId || undefined,
      amountUsd: Number(r.amountUsd),
      outstandingBalanceUsd: Number(r.outstandingBalanceUsd),
      editionId: r.editionId,
      status: r.status,
      paymentDate: r.paymentDate,
      sector: r.sector,
      notes: r.notes,
      isDemo: Boolean(r.isDemo),
    }));
    return {
      entity: params.entity,
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  if (params.entity === 'tradeEngagements') {
    if (params.editionId && params.editionId !== 'all') {
      clauses.push('editionId = ?');
      bindParams.push(params.editionId);
    }
    if (params.sector && params.sector !== 'all') {
      clauses.push('industry = ?');
      bindParams.push(params.sector);
    }
    if (params.status && params.status !== 'all') {
      clauses.push('verificationStatus = ?');
      bindParams.push(params.status);
    }
    if (searchLike) {
      clauses.push('(LOWER(buyerOrg) LIKE ? OR LOWER(supplierOrg) LIKE ? OR LOWER(refNumber) LIKE ?)');
      bindParams.push(searchLike, searchLike, searchLike);
    }
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const total = Number(
      (db.prepare(`SELECT COUNT(*) AS cnt FROM trade_engagements ${whereSql}`).get(...bindParams) as any)?.cnt || 0
    );
    const rows = db
      .prepare(`SELECT * FROM trade_engagements ${whereSql} ORDER BY date DESC LIMIT ? OFFSET ?`)
      .all(...bindParams, limit, offset) as any[];
    const items = rows.map((r) => ({
      id: r.id,
      refNumber: r.refNumber,
      editionId: r.editionId,
      date: r.date,
      buyerOrg: r.buyerOrg,
      buyerCountry: r.buyerCountry,
      supplierOrg: r.supplierOrg,
      supplierCountry: r.supplierCountry,
      industry: r.industry,
      opportunityType: r.opportunityType,
      description: r.description,
      estimatedValueUsd: Number(r.estimatedValueUsd),
      engagementStatus: r.engagementStatus,
      followUpDate: r.followUpDate,
      outcome: r.outcome,
      verificationStatus: r.verificationStatus,
      verifiedDate: r.verifiedDate || undefined,
      supportingDocName: r.supportingDocName || undefined,
      isDemo: Boolean(r.isDemo),
    }));
    return {
      entity: params.entity,
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  if (params.entity === 'auditLogs') {
    if (searchLike) {
      clauses.push('(LOWER(action) LIKE ? OR LOWER(module) LIKE ? OR LOWER(userEmail) LIKE ?)');
      bindParams.push(searchLike, searchLike, searchLike);
    }
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const total = Number(
      (db.prepare(`SELECT COUNT(*) AS cnt FROM audit_logs ${whereSql}`).get(...bindParams) as any)?.cnt || 0
    );
    const rows = db
      .prepare(`SELECT * FROM audit_logs ${whereSql} ORDER BY timestamp DESC LIMIT ? OFFSET ?`)
      .all(...bindParams, limit, offset) as any[];
    return {
      entity: params.entity,
      items: rows,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  throw new Error(`Unsupported paginated warehouse entity: ${params.entity}`);
}

export function getStorageDiagnostics(): StorageDiagnostics {
  const db = getWarehouseDb();
  const baseStats = getWarehouseStats();
  const journalRow = db.prepare('PRAGMA journal_mode;').get() as any;
  const syncRow = db.prepare('PRAGMA synchronous;').get() as any;
  const indexCount = Number(
    (db.prepare(`SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type = 'index'`).get() as any)?.cnt || 0
  );
  const objAgg = db
    .prepare(`SELECT COUNT(*) AS cnt, COALESCE(SUM(sizeBytes), 0) AS totalBytes FROM storage_objects`)
    .get() as any;
  const prefCount = Number(
    (db.prepare(`SELECT COUNT(*) AS cnt FROM user_preferences`).get() as any)?.cnt || 0
  );
  const sessCount = Number(
    (
      db
        .prepare(`SELECT COUNT(*) AS cnt FROM user_sessions WHERE expiresAt > ?`)
        .get(new Date().toISOString()) as any
    )?.cnt || 0
  );
  const errCount = Number(
    (db.prepare(`SELECT COUNT(*) AS cnt FROM client_error_logs`).get() as any)?.cnt || 0
  );

  let walSizeBytes = 0;
  const walFile = `${DB_FILE}-wal`;
  try {
    if (fs.existsSync(walFile)) {
      walSizeBytes = fs.statSync(walFile).size;
    }
  } catch {
    walSizeBytes = 0;
  }

  const syncLabels: Record<number, string> = { 0: 'OFF', 1: 'NORMAL', 2: 'FULL', 3: 'EXTRA' };
  const syncNum = Number(syncRow?.synchronous ?? 1);

  return {
    engine: baseStats.engine,
    journalMode: String(journalRow?.journal_mode || 'wal').toUpperCase(),
    synchronousMode: syncLabels[syncNum] || String(syncNum),
    dbSizeBytes: baseStats.sizeBytes,
    walSizeBytes,
    indexCount,
    objectsCount: Number(objAgg?.cnt || 0),
    objectsTotalBytes: Number(objAgg?.totalBytes || 0),
    preferencesCount: prefCount,
    activeSessionsCount: sessCount,
    clientErrorLogsCount: errCount,
    tableCounts: baseStats.tableCounts,
    checkedAt: new Date().toISOString(),
  };
}

export function optimizeWarehouseDatabase(): {
  ok: boolean;
  walCheckpoint: any;
  analyzed: boolean;
  quickCheck: string;
  diagnostics: StorageDiagnostics;
} {
  const db = getWarehouseDb();
  const walCheckpoint = db.prepare('PRAGMA wal_checkpoint(TRUNCATE);').get() as any;
  db.exec('ANALYZE;');
  const quickRow = db.prepare('PRAGMA quick_check(1);').get() as any;
  const quickCheck = String(quickRow?.quick_check || 'ok');
  return {
    ok: quickCheck.toLowerCase() === 'ok',
    walCheckpoint,
    analyzed: true,
    quickCheck,
    diagnostics: getStorageDiagnostics(),
  };
}
