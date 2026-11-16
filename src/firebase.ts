import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  AlertEvent,
  AnnotationComment,
  AuditLogItem,
  BIReport,
  CommercialTransaction,
  ConnectorSyncLog,
  EmailDispatchLog,
  ExhibitionEdition,
  Exhibitor,
  ExternalConnector,
  HallUtilisation,
  MarketInsight,
  OperationalIncident,
  ScheduledReportConfig,
  SharedBriefItem,
  ThresholdAlertRule,
  TradeEngagement,
  UserProfile,
  Visitor,
} from './types';

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;
export const FIREBASE_CONSOLE_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data`;
export const BOOTSTRAPPED_ADMIN_EMAIL = 'calipherrndlovu@gmail.com';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<{ ok: boolean; detail: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true, detail: `Connected to ${FIREBASE_PROJECT_ID} (${FIRESTORE_DATABASE_ID})` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return { ok: false, detail: msg };
  }
}

void testFirestoreConnection();

export function sanitizeId(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 128);
  return cleaned || `id-${Date.now()}`;
}

function str(val: unknown, maxLen: number, fallback = ''): string {
  const s = typeof val === 'string' ? val : val == null ? fallback : String(val);
  return s.slice(0, maxLen);
}

function minStr(val: unknown, minLen: number, maxLen: number, fallback: string): string {
  const s = str(val, maxLen, fallback).trim();
  return s.length >= minLen ? s : fallback.slice(0, maxLen);
}

function num(val: unknown, minVal = 0, maxVal?: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return minVal;
  const floored = Math.max(minVal, n);
  return maxVal !== undefined ? Math.min(maxVal, floored) : floored;
}

function anyNum(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function strList(val: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((item) => str(item, maxItemLen).trim())
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

function numList(val: unknown, maxItems: number): number[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((item) => Number(item))
    .filter((n) => Number.isFinite(n))
    .slice(0, maxItems);
}

function pickEnum<T extends string>(val: unknown, allowed: readonly T[], fallback: T): T {
  return typeof val === 'string' && (allowed as readonly string[]).includes(val)
    ? (val as T)
    : fallback;
}

function tsToIso(val: unknown, fallbackIso = ''): string {
  if (typeof val === 'string' && val.length > 0) return val;
  if (val && typeof (val as any).toDate === 'function') {
    try {
      return (val as any).toDate().toISOString();
    } catch {
      return fallbackIso;
    }
  }
  return fallbackIso;
}

function stripFirestoreMeta<T extends Record<string, any>>(
  data: T,
  extraKeys: string[] = []
): Record<string, any> {
  const copy: Record<string, any> = { ...data };
  delete copy.ownerUid;
  delete copy.createdAt;
  delete copy.updatedAt;
  delete copy.createdAtIso;
  for (const k of extraKeys) {
    delete copy[k];
  }
  return copy;
}

export function isBootstrappedAdmin(user: FirebaseUser | null): boolean {
  return Boolean(user && user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified);
}

function collectionQueryForUser(collectionName: string, user: FirebaseUser) {
  const safeUid = sanitizeId(user.uid);
  return isBootstrappedAdmin(user)
    ? query(collection(db, collectionName))
    : query(collection(db, collectionName), where('ownerUid', '==', safeUid));
}

// -----------------------------------------------------------------------------
// Auth Helpers
// -----------------------------------------------------------------------------
export async function signInWithGoogleForFirestore(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureCloudUserProfile(result.user, 'Business Intelligence & Strategy');
  return result.user;
}

export async function signOutFromFirebase(): Promise<void> {
  await signOut(auth);
}

export function subscribeToFirebaseAuth(cb: (user: FirebaseUser | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, cb);
}

export async function ensureCloudUserProfile(user: FirebaseUser, department: string): Promise<void> {
  const safeUid = sanitizeId(user.uid);
  const path = `users/${safeUid}/private/profile`;
  const ref = doc(db, 'users', safeUid, 'private', 'profile');
  try {
    const snap = await getDoc(ref);
    const displayName = minStr(user.displayName || user.email, 1, 120, 'ZITF User');
    const dept = minStr(department, 1, 120, 'Business Intelligence');
    const email = minStr(user.email, 5, 160, 'user@zitf.co.zw');

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: safeUid,
        email,
        displayName,
        department: dept,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName,
        department: dept,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// -----------------------------------------------------------------------------
// Payload Sanitizers Synchronized with firebase-blueprint.json & firestore.rules
// -----------------------------------------------------------------------------
const EDITION_STATUSES = ['Upcoming', 'Active', 'Concluded'] as const;
const EXHIBITOR_CATEGORIES = [
  'Local Commercial',
  'International Pavilion',
  'State Owned Enterprise',
  'SME / Emerging',
  'Education & Research',
  'Tech & Innovation',
] as const;
const BOOKING_STATUSES = ['Confirmed', 'Reserved', 'Waitlisted', 'Cancelled'] as const;
const PAYMENT_STATUSES = ['Fully Paid', 'Partially Paid', 'Pending'] as const;
const RETURNING_STATUSES = ['New', 'Returning'] as const;
const VISITOR_CATEGORIES = [
  'Business Visitors',
  'General Public',
  'Students',
  'Government Representatives',
  'International Delegates',
  'Investors',
  'Buyers and Procurement',
  'Media Representatives',
] as const;
const TX_TYPES = [
  'Exhibition Hall Space',
  'Sponsorship Agreement',
  'Advertising & Signage',
  'Conference & Forum Pass',
  'Commercial Services',
  'Logistics & Utilities',
] as const;
const TX_STATUSES = ['Fully Paid', 'Deposit Paid', 'Invoice Sent', 'Overdue'] as const;
const TRADE_OPP_TYPES = [
  'Export Opportunity',
  'Import Opportunity',
  'Joint Venture / Partnership',
  'Distribution Agreement',
  'Supply Contract',
  'Investment Enquiry',
  'Technology Transfer',
] as const;
const TRADE_ENGAGEMENT_STATUSES = [
  'New',
  'Contact Established',
  'Meeting Scheduled',
  'Meeting Completed',
  'Follow-up Required',
  'Negotiation Ongoing',
  'Opportunity Converted',
  'Closed / Unsuccessful',
] as const;
const TRADE_VERIF_STATUSES = [
  'Facilitated Opportunity',
  'Reported by Participant',
  'Independently Verified',
] as const;
const INCIDENT_CATEGORIES = [
  'ICT & Network',
  'Electrical & Power',
  'Facilities & HVAC',
  'Logistics & Transport',
  'Security & Safety',
  'Customer Care',
] as const;
const INCIDENT_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
const INCIDENT_STATUSES = ['Open', 'In Progress', 'Resolved'] as const;
const MARKET_TYPES = [
  'Emerging Sector',
  'Export Potential',
  'Investment Opportunity',
  'SME Growth',
  'Technology Trend',
  'Trade Corridor',
] as const;
const PILLARS = [
  'Executive',
  'Exhibitor',
  'Visitor',
  'Commercial',
  'Trade Impact',
  'Operational',
  'Market Insight',
] as const;
const CONFIDENTIALITY_LEVELS = [
  'Confidential - Board & Executive',
  'Management Internal',
  'Public Trade Release',
] as const;
const CONNECTOR_SYS_TYPES = ['CRM', 'Ticketing', 'B2B Portal', 'Smart Stand', 'Custom REST'] as const;
const CONNECTOR_MODES = ['Pull (REST/CSV)', 'Webhook Push'] as const;
const CONNECTOR_TARGETS = ['exhibitors', 'visitors', 'commercial', 'trade'] as const;
const CONNECTOR_AUTH_TYPES = ['None', 'Bearer Token', 'API Key Header'] as const;
const CONNECTOR_STATUSES = ['Connected', 'Standby', 'Error', 'Syncing'] as const;
const ALERT_METRICS = [
  'collection_rate_pct',
  'outstanding_balance_usd',
  'space_occupancy_pct',
  'open_incidents_count',
  'network_uptime_pct',
  'exhibitor_retention_pct',
  'verified_deals_usd',
  'anomaly_count',
] as const;
const ALERT_OPS = ['lt', 'lte', 'gt', 'gte'] as const;
const ALERT_SEVERITIES = ['Critical', 'Warning', 'Info'] as const;
const ALERT_STATUSES = ['Active', 'Acknowledged', 'Resolved'] as const;
const SCHED_FREQS = ['Hourly (Monitor)', 'Daily', 'Weekly', 'Monthly'] as const;
const TARGET_TYPES = ['Report', 'Dashboard', 'DataMining', 'TradeDeal', 'Incident', 'MarketInsight'] as const;
const WORKFLOW_STATUSES = ['Shared', 'In Review', 'Changes Requested', 'Approved'] as const;
const ACCESS_LEVELS = ['View Only', 'Comment & Annotate', 'Approve / Sign-Off'] as const;
const EMAIL_MODES = ['Webhook Relay', 'MIME Queue & Mailto Dispatch'] as const;
const EMAIL_STATUSES = ['Dispatched', 'Queued (MIME Ready)', 'Failed'] as const;
const USER_ROLES = [
  'Super Administrator',
  'Executive Management',
  'Department Manager',
  'Data Analyst',
  'Data Entry Officer',
  'External Stakeholder / Viewer',
] as const;

export function buildEditionPayload(ed: ExhibitionEdition, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(ed.id);
  const base: Record<string, any> = {
    name: minStr(ed.name, 2, 120, 'ZITF Edition'),
    editionNumber: Math.round(num(ed.editionNumber, 1, 500)),
    theme: str(ed.theme, 240),
    year: Math.round(num(ed.year, 1950, 2150)),
    startDate: str(ed.startDate, 32),
    endDate: str(ed.endDate, 32),
    venue: str(ed.venue, 200),
    status: pickEnum(ed.status, EDITION_STATUSES, 'Active'),
    isCurrent: Boolean(ed.isCurrent),
    updatedAt: serverTimestamp(),
  };
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildExhibitorPayload(ex: Exhibitor, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(ex.id);
  const base: Record<string, any> = {
    companyName: minStr(ex.companyName, 1, 200, 'Exhibitor'),
    regNumber: minStr(ex.regNumber, 1, 80, id),
    businessDescription: str(ex.businessDescription, 1000),
    industry: str(ex.industry, 120),
    sector: str(ex.sector, 120),
    country: minStr(ex.country, 2, 100, 'Zimbabwe'),
    provinceCity: str(ex.provinceCity, 120),
    contactPerson: str(ex.contactPerson, 140),
    email: str(ex.email, 160),
    phone: str(ex.phone, 64),
    website: str(ex.website, 200),
    productsServices: strList(ex.productsServices, 25, 160),
    editionId: minStr(ex.editionId, 1, 64, 'zitf-2026'),
    hallStand: str(ex.hallStand, 100),
    standSizeSqm: num(ex.standSizeSqm, 0, 50000),
    category: pickEnum(ex.category, EXHIBITOR_CATEGORIES, 'Local Commercial'),
    registrationDate: str(ex.registrationDate, 32),
    bookingStatus: pickEnum(ex.bookingStatus, BOOKING_STATUSES, 'Confirmed'),
    paymentStatus: pickEnum(ex.paymentStatus, PAYMENT_STATUSES, 'Pending'),
    returningStatus: pickEnum(ex.returningStatus, RETURNING_STATUSES, 'New'),
    satisfactionScore: num(ex.satisfactionScore, 0, 5),
    participationHistory: numList(ex.participationHistory, 20),
    isDemo: Boolean(ex.isDemo),
    updatedAt: serverTimestamp(),
  };
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildVisitorPayload(v: Visitor, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(v.id);
  const base: Record<string, any> = {
    visitorRef: minStr(v.visitorRef, 1, 80, id),
    fullName: minStr(v.fullName, 1, 160, 'Visitor'),
    category: pickEnum(v.category, VISITOR_CATEGORIES, 'Business Visitors'),
    country: minStr(v.country, 2, 100, 'Zimbabwe'),
    cityProvince: str(v.cityProvince, 120),
    organization: str(v.organization, 200),
    industry: str(v.industry, 120),
    email: str(v.email, 160),
    phone: str(v.phone, 64),
    registrationDate: str(v.registrationDate, 32),
    editionId: minStr(v.editionId, 1, 64, 'zitf-2026'),
    attendanceDays: strList(v.attendanceDays, 10, 60),
    interests: strList(v.interests, 20, 120),
    areasVisited: strList(v.areasVisited, 20, 120),
    feedbackRating: num(v.feedbackRating, 0, 5),
    repeatVisitor: Boolean(v.repeatVisitor),
    isDemo: Boolean(v.isDemo),
    updatedAt: serverTimestamp(),
  };
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildTransactionPayload(tx: CommercialTransaction, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(tx.id);
  const base: Record<string, any> = {
    refNumber: minStr(tx.refNumber, 1, 80, id),
    type: pickEnum(tx.type, TX_TYPES, 'Exhibition Hall Space'),
    clientName: minStr(tx.clientName, 1, 200, 'Client'),
    amountUsd: num(tx.amountUsd, 0),
    outstandingBalanceUsd: num(tx.outstandingBalanceUsd, 0),
    editionId: minStr(tx.editionId, 1, 64, 'zitf-2026'),
    status: pickEnum(tx.status, TX_STATUSES, 'Invoice Sent'),
    paymentDate: str(tx.paymentDate, 32),
    sector: str(tx.sector, 120),
    notes: str(tx.notes, 500),
    isDemo: Boolean(tx.isDemo),
    updatedAt: serverTimestamp(),
  };
  if (tx.exhibitorId) {
    base.exhibitorId = str(tx.exhibitorId, 128);
  }
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildTradeEngagementPayload(te: TradeEngagement, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(te.id);
  const base: Record<string, any> = {
    refNumber: minStr(te.refNumber, 1, 80, id),
    editionId: minStr(te.editionId, 1, 64, 'zitf-2026'),
    date: str(te.date, 32),
    buyerOrg: minStr(te.buyerOrg, 1, 200, 'Buyer Organization'),
    buyerCountry: minStr(te.buyerCountry, 2, 100, 'Zimbabwe'),
    supplierOrg: minStr(te.supplierOrg, 1, 200, 'Supplier Organization'),
    supplierCountry: minStr(te.supplierCountry, 2, 100, 'Zimbabwe'),
    industry: str(te.industry, 120),
    opportunityType: pickEnum(te.opportunityType, TRADE_OPP_TYPES, 'Export Opportunity'),
    description: str(te.description, 1000),
    estimatedValueUsd: num(te.estimatedValueUsd, 0),
    engagementStatus: pickEnum(te.engagementStatus, TRADE_ENGAGEMENT_STATUSES, 'New'),
    followUpDate: str(te.followUpDate, 32),
    outcome: str(te.outcome, 500),
    verificationStatus: pickEnum(te.verificationStatus, TRADE_VERIF_STATUSES, 'Facilitated Opportunity'),
    isDemo: Boolean(te.isDemo),
    updatedAt: serverTimestamp(),
  };
  if (te.verifiedDate) base.verifiedDate = str(te.verifiedDate, 32);
  if (te.supportingDocName) base.supportingDocName = str(te.supportingDocName, 200);
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildHallUtilisationPayload(h: HallUtilisation, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(h.hallId);
  const base: Record<string, any> = {
    hallName: minStr(h.hallName, 1, 120, id),
    totalCapacitySqm: num(h.totalCapacitySqm, 0),
    occupiedSqm: num(h.occupiedSqm, 0),
    utilizationRatePct: num(h.utilizationRatePct, 0, 100),
    primarySector: str(h.primarySector, 120),
    wifiUptimePct: num(h.wifiUptimePct, 0, 100),
    activeExhibitorsCount: Math.round(num(h.activeExhibitorsCount, 0)),
    updatedAt: serverTimestamp(),
  };
  if (isCreate) {
    base.hallId = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildIncidentPayload(inc: OperationalIncident, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(inc.id);
  const base: Record<string, any> = {
    refNumber: minStr(inc.refNumber, 1, 80, id),
    editionId: minStr(inc.editionId, 1, 64, 'zitf-2026'),
    hallOrArea: minStr(inc.hallOrArea, 1, 120, 'Exhibition Grounds'),
    category: pickEnum(inc.category, INCIDENT_CATEGORIES, 'ICT & Network'),
    severity: pickEnum(inc.severity, INCIDENT_SEVERITIES, 'Low'),
    title: minStr(inc.title, 2, 200, 'Operational Incident'),
    description: str(inc.description, 1000),
    reportedTime: str(inc.reportedTime, 40),
    status: pickEnum(inc.status, INCIDENT_STATUSES, 'Open'),
    isDemo: Boolean(inc.isDemo),
    updatedAt: serverTimestamp(),
  };
  if (inc.resolvedTime) base.resolvedTime = str(inc.resolvedTime, 40);
  if (inc.resolutionNotes) base.resolutionNotes = str(inc.resolutionNotes, 600);
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildMarketInsightPayload(m: MarketInsight, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(m.id);
  const base: Record<string, any> = {
    title: minStr(m.title, 2, 220, 'Market Insight'),
    sector: minStr(m.sector, 2, 120, 'Manufacturing & Engineering'),
    marketType: pickEnum(m.marketType, MARKET_TYPES, 'Emerging Sector'),
    summary: str(m.summary, 1500),
    keyIndicators: strList(m.keyIndicators, 15, 160),
    estimatedMarketValueUsd: num(m.estimatedMarketValueUsd, 0),
    growthRateYoY: anyNum(m.growthRateYoY),
    zimbabweMarketContext: str(m.zimbabweMarketContext, 1000),
    sourceAttribution: str(m.sourceAttribution, 200),
    date: str(m.date, 32),
    isDemo: Boolean(m.isDemo),
    updatedAt: serverTimestamp(),
  };
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildBIReportPayload(r: BIReport, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(r.id);
  const safeKpis = Array.isArray(r.kpis)
    ? r.kpis
        .slice(0, 12)
        .filter((k) => k && typeof k.label === 'string' && typeof k.value === 'string')
        .map((k) => ({
          label: minStr(k.label, 1, 120, 'Metric'),
          value: minStr(k.value, 1, 120, '0'),
          ...(k.trend ? { trend: str(k.trend, 120) } : {}),
        }))
    : [];
  const base: Record<string, any> = {
    reportNumber: minStr(r.reportNumber, 1, 80, id),
    title: minStr(r.title, 2, 220, 'ZITF BI Report'),
    pillar: pickEnum(r.pillar, PILLARS, 'Executive'),
    editionId: minStr(r.editionId, 1, 64, 'zitf-2026'),
    generationDate: str(r.generationDate, 40),
    author: str(r.author, 140),
    confidentiality: pickEnum(r.confidentiality, CONFIDENTIALITY_LEVELS, 'Management Internal'),
    summaryFindings: str(r.summaryFindings, 3000),
    kpis: safeKpis,
    recommendations: strList(r.recommendations, 15, 240),
    isDemo: Boolean(r.isDemo),
    updatedAt: serverTimestamp(),
  };
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildConnectorPayload(c: ExternalConnector, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(c.id);
  const base: Record<string, any> = {
    name: minStr(c.name, 1, 160, 'External Connector'),
    systemType: pickEnum(c.systemType, CONNECTOR_SYS_TYPES, 'Custom REST'),
    mode: pickEnum(c.mode, CONNECTOR_MODES, 'Pull (REST/CSV)'),
    targetModule: pickEnum(c.targetModule, CONNECTOR_TARGETS, 'exhibitors'),
    endpointUrl: str(c.endpointUrl, 500),
    authType: pickEnum(c.authType, CONNECTOR_AUTH_TYPES, 'None'),
    status: pickEnum(c.status, CONNECTOR_STATUSES, 'Standby'),
    autoDeduplicate: Boolean(c.autoDeduplicate),
    updatedAt: serverTimestamp(),
  };
  if (c.dataPath) base.dataPath = str(c.dataPath, 120);
  if (c.authHeaderName) base.authHeaderName = str(c.authHeaderName, 100);
  if (c.lastSyncAt) base.lastSyncAt = str(c.lastSyncAt, 40);
  if (c.lastSyncCount !== undefined) base.lastSyncCount = num(c.lastSyncCount, 0);
  if (c.lastLatencyMs !== undefined) base.lastLatencyMs = num(c.lastLatencyMs, 0);
  if (c.lastStatusCode !== undefined) base.lastStatusCode = num(c.lastStatusCode, 0);
  if (c.lastError) base.lastError = str(c.lastError, 500);
  if (c.description) base.description = str(c.description, 500);
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildConnectorLogPayload(log: ConnectorSyncLog, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(log.id);
  const base: Record<string, any> = {
    connectorId: minStr(log.connectorId, 1, 128, 'conn'),
    connectorName: str(log.connectorName, 160),
    timestamp: str(log.timestamp, 40),
    status: log.status === 'Failed' ? 'Failed' : 'Success',
    recordsFetched: num(log.recordsFetched, 0),
    recordsImported: num(log.recordsImported, 0),
    duplicatesSkipped: num(log.duplicatesSkipped, 0),
    message: str(log.message, 600),
    updatedAt: serverTimestamp(),
  };
  if (log.statusCode !== undefined) base.statusCode = num(log.statusCode, 0);
  if (log.latencyMs !== undefined) base.latencyMs = num(log.latencyMs, 0);
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildAlertRulePayload(r: ThresholdAlertRule, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(r.id);
  const base: Record<string, any> = {
    name: minStr(r.name, 1, 160, 'Alert Rule'),
    metricKey: pickEnum(r.metricKey, ALERT_METRICS, 'collection_rate_pct'),
    operator: pickEnum(r.operator, ALERT_OPS, 'lt'),
    threshold: anyNum(r.threshold),
    severity: pickEnum(r.severity, ALERT_SEVERITIES, 'Warning'),
    editionId: minStr(r.editionId, 1, 64, 'zitf-2026'),
    notifyRoles: strList(r.notifyRoles, 10, 80),
    recipients: str(r.recipients, 400),
    isActive: Boolean(r.isActive),
    updatedAt: serverTimestamp(),
  };
  if (r.lastEvaluatedAt) base.lastEvaluatedAt = str(r.lastEvaluatedAt, 40);
  if (r.lastTriggeredAt) base.lastTriggeredAt = str(r.lastTriggeredAt, 40);
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAtIso = str(r.createdAt || new Date().toISOString(), 40);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildAlertEventPayload(ev: AlertEvent, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(ev.id);
  const base: Record<string, any> = {
    ruleId: minStr(ev.ruleId, 1, 128, 'rule'),
    ruleName: str(ev.ruleName, 160),
    metricKey: minStr(ev.metricKey, 1, 64, 'collection_rate_pct'),
    metricLabel: str(ev.metricLabel, 120),
    observedValue: anyNum(ev.observedValue),
    threshold: anyNum(ev.threshold),
    operator: pickEnum(ev.operator, ALERT_OPS, 'lt'),
    severity: pickEnum(ev.severity, ALERT_SEVERITIES, 'Warning'),
    editionId: str(ev.editionId, 64),
    message: str(ev.message, 600),
    status: pickEnum(ev.status, ALERT_STATUSES, 'Active'),
    triggeredAt: str(ev.triggeredAt, 40),
    updatedAt: serverTimestamp(),
  };
  if (ev.acknowledgedBy) base.acknowledgedBy = str(ev.acknowledgedBy, 140);
  if (ev.acknowledgedAt) base.acknowledgedAt = str(ev.acknowledgedAt, 40);
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildScheduledReportPayload(s: ScheduledReportConfig, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(s.id);
  const base: Record<string, any> = {
    name: minStr(s.name, 1, 160, 'Scheduled Report'),
    pillar: pickEnum(s.pillar, PILLARS, 'Executive'),
    editionId: minStr(s.editionId, 1, 64, 'zitf-2026'),
    confidentiality: pickEnum(s.confidentiality, CONFIDENTIALITY_LEVELS, 'Management Internal'),
    frequency: pickEnum(s.frequency, SCHED_FREQS, 'Daily'),
    runTimeUtc: str(s.runTimeUtc, 20),
    recipients: str(s.recipients, 400),
    includeMiningForecast: Boolean(s.includeMiningForecast),
    isActive: Boolean(s.isActive),
    nextRunAt: str(s.nextRunAt, 40),
    runCount: Math.round(num(s.runCount, 0)),
    updatedAt: serverTimestamp(),
  };
  if (s.dayOfWeekOrMonth) base.dayOfWeekOrMonth = str(s.dayOfWeekOrMonth, 32);
  if (s.lastRunAt) base.lastRunAt = str(s.lastRunAt, 40);
  if (s.lastReportId) base.lastReportId = str(s.lastReportId, 128);
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAtIso = str(s.createdAt || new Date().toISOString(), 40);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildSharedBriefPayload(b: SharedBriefItem, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(b.id);
  const base: Record<string, any> = {
    shareToken: minStr(b.shareToken, 1, 128, id),
    targetType: pickEnum(b.targetType, TARGET_TYPES, 'Report'),
    targetId: str(b.targetId, 128),
    title: str(b.title, 220),
    editionId: str(b.editionId, 64),
    sharedByName: str(b.sharedByName, 140),
    sharedByEmail: str(b.sharedByEmail, 160),
    sharedByRole: str(b.sharedByRole, 80),
    recipientEmails: strList(b.recipientEmails, 25, 160),
    recipientRoles: strList(b.recipientRoles, 10, 80),
    accessLevel: pickEnum(b.accessLevel, ACCESS_LEVELS, 'View Only'),
    note: str(b.note, 1000),
    workflowStatus: pickEnum(b.workflowStatus, WORKFLOW_STATUSES, 'Shared'),
    updatedAt: serverTimestamp(),
  };
  if (b.approvedBy) base.approvedBy = str(b.approvedBy, 140);
  if (b.approvedAt) base.approvedAt = str(b.approvedAt, 40);
  if (b.snapshotSummary) base.snapshotSummary = str(b.snapshotSummary, 1500);
  if (b.expiresAt) base.expiresAt = str(b.expiresAt, 40);
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAtIso = str(b.createdAt || new Date().toISOString(), 40);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildAnnotationPayload(a: AnnotationComment, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(a.id);
  const base: Record<string, any> = {
    targetType: pickEnum(a.targetType, TARGET_TYPES, 'Report'),
    targetId: str(a.targetId, 128),
    targetTitle: str(a.targetTitle, 220),
    sectionTag: str(a.sectionTag, 120),
    authorName: str(a.authorName, 140),
    authorEmail: str(a.authorEmail, 160),
    authorRole: str(a.authorRole, 80),
    body: str(a.body, 2000),
    mentions: strList(a.mentions, 20, 120),
    status: a.status === 'Resolved' ? 'Resolved' : 'Open',
    updatedAt: serverTimestamp(),
  };
  if (a.resolvedBy) base.resolvedBy = str(a.resolvedBy, 140);
  if (a.resolvedAt) base.resolvedAt = str(a.resolvedAt, 40);
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAtIso = str(a.createdAt || new Date().toISOString(), 40);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildEmailDispatchPayload(e: EmailDispatchLog, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(e.id);
  const base: Record<string, any> = {
    targetType: pickEnum(e.targetType, TARGET_TYPES, 'Report'),
    targetId: str(e.targetId, 128),
    subject: str(e.subject, 240),
    recipients: strList(e.recipients, 25, 160),
    bodyPreview: str(e.bodyPreview, 1200),
    senderName: str(e.senderName, 140),
    senderEmail: str(e.senderEmail, 160),
    deliveryMode: pickEnum(e.deliveryMode, EMAIL_MODES, 'MIME Queue & Mailto Dispatch'),
    status: pickEnum(e.status, EMAIL_STATUSES, 'Queued (MIME Ready)'),
    dispatchedAt: str(e.dispatchedAt, 40),
    updatedAt: serverTimestamp(),
  };
  if (e.shareUrl) base.shareUrl = str(e.shareUrl, 500);
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

export function buildAuditLogPayload(a: AuditLogItem, ownerUid: string) {
  const id = sanitizeId(a.id);
  return {
    id,
    data: {
      id,
      ownerUid: sanitizeId(ownerUid),
      timestamp: str(a.timestamp, 40),
      userEmail: str(a.userEmail, 160),
      userRole: str(a.userRole, 80),
      action: str(a.action, 120),
      module: str(a.module, 120),
      details: str(a.details, 1000),
      createdAt: serverTimestamp(),
    },
  };
}

export function buildDirectoryUserPayload(u: UserProfile, ownerUid: string, isCreate: boolean) {
  const id = sanitizeId(u.id);
  const base: Record<string, any> = {
    name: minStr(u.name, 1, 140, 'ZITF Staff'),
    email: minStr(u.email, 5, 160, 'staff@zitf.co.zw'),
    role: pickEnum(u.role, USER_ROLES, 'External Stakeholder / Viewer'),
    department: str(u.department, 140),
    isActive: Boolean(u.isActive),
    lastLogin: str(u.lastLogin, 40),
    updatedAt: serverTimestamp(),
  };
  if (isCreate) {
    base.id = id;
    base.ownerUid = sanitizeId(ownerUid);
    base.createdAt = serverTimestamp();
  }
  return { id, data: base };
}

// -----------------------------------------------------------------------------
// Generic Single-Document CRUD Wrappers with Zero-Silent-Error Guarantees
// -----------------------------------------------------------------------------
export async function upsertCollectionDoc(
  collectionName: string,
  docId: string,
  createData: Record<string, any>,
  updateData?: Record<string, any>
): Promise<void> {
  if (!auth.currentUser) return;
  const safeId = sanitizeId(docId);
  const path = `${collectionName}/${safeId}`;
  const ref = doc(db, collectionName, safeId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, createData);
    } else if (updateData) {
      await updateDoc(ref, updateData);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createCollectionDoc(
  collectionName: string,
  docId: string,
  data: Record<string, any>
): Promise<void> {
  if (!auth.currentUser) return;
  const safeId = sanitizeId(docId);
  const path = `${collectionName}/${safeId}`;
  try {
    await setDoc(doc(db, collectionName, safeId), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function patchCollectionDoc(
  collectionName: string,
  docId: string,
  fields: Record<string, any>
): Promise<void> {
  if (!auth.currentUser) return;
  const safeId = sanitizeId(docId);
  const path = `${collectionName}/${safeId}`;
  try {
    await updateDoc(doc(db, collectionName, safeId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeCollectionDoc(collectionName: string, docId: string): Promise<void> {
  if (!auth.currentUser) return;
  const safeId = sanitizeId(docId);
  const path = `${collectionName}/${safeId}`;
  try {
    await deleteDoc(doc(db, collectionName, safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncWorkspacePreferencesToFirestore(prefs: {
  selectedEditionId: string;
  selectedPeriod: string;
  selectedSector: string;
  geographicFilter: 'all' | 'local' | 'international';
  selectedCountry: string;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const safeUid = sanitizeId(user.uid);
  const path = `workspacePreferences/${safeUid}`;
  const ref = doc(db, 'workspacePreferences', safeUid);
  const fields = {
    selectedEditionId: minStr(prefs.selectedEditionId, 1, 64, 'zitf-2026'),
    selectedPeriod: minStr(prefs.selectedPeriod, 1, 40, 'all'),
    selectedSector: minStr(prefs.selectedSector, 1, 120, 'all'),
    geographicFilter: pickEnum(prefs.geographicFilter, ['all', 'local', 'international'] as const, 'all'),
    selectedCountry: minStr(prefs.selectedCountry, 1, 100, 'all'),
    updatedAt: serverTimestamp(),
  };
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { uid: safeUid, ...fields });
    } else {
      await updateDoc(ref, fields);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// -----------------------------------------------------------------------------
// Full-Platform Seed / Bulk Sync Engine (Chunked writeBatch <= 400 ops/batch)
// -----------------------------------------------------------------------------
export interface PlatformStatePayload {
  editions: ExhibitionEdition[];
  exhibitors: Exhibitor[];
  visitors: Visitor[];
  transactions: CommercialTransaction[];
  tradeEngagements: TradeEngagement[];
  hallUtilisation: HallUtilisation[];
  incidents: OperationalIncident[];
  marketInsights: MarketInsight[];
  reports: BIReport[];
  connectors: ExternalConnector[];
  connectorLogs: ConnectorSyncLog[];
  alertRules: ThresholdAlertRule[];
  alertEvents: AlertEvent[];
  scheduledReports: ScheduledReportConfig[];
  sharedItems: SharedBriefItem[];
  annotations: AnnotationComment[];
  emailDispatches: EmailDispatchLog[];
  auditLogs: AuditLogItem[];
  users: UserProfile[];
}

export interface BatchSyncSummary {
  totalWritten: number;
  collectionCounts: Record<string, number>;
}

export async function checkFirestoreHasPlatformData(user: FirebaseUser): Promise<boolean> {
  try {
    const [edSnap, exSnap] = await Promise.all([
      getDocs(collectionQueryForUser('editions', user)),
      getDocs(collectionQueryForUser('exhibitors', user)),
    ]);
    return !edSnap.empty || !exSnap.empty;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'editions');
  }
}

export async function syncFullPlatformToFirestore(
  payload: PlatformStatePayload,
  onProgress?: (writtenSoFar: number, totalOps: number) => void
): Promise<BatchSyncSummary> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in with Google first to sync the platform database to Cloud Firestore.');
  }
  const ownerUid = sanitizeId(user.uid);
  const ops: { col: string; id: string; data: Record<string, any> }[] = [];
  const counts: Record<string, number> = {};

  const enqueue = (col: string, built: { id: string; data: Record<string, any> }) => {
    ops.push({ col, id: built.id, data: built.data });
    counts[col] = (counts[col] || 0) + 1;
  };

  payload.editions.forEach((item) => enqueue('editions', buildEditionPayload(item, ownerUid, true)));
  payload.exhibitors.forEach((item) => enqueue('exhibitors', buildExhibitorPayload(item, ownerUid, true)));
  payload.visitors.forEach((item) => enqueue('visitors', buildVisitorPayload(item, ownerUid, true)));
  payload.transactions.forEach((item) =>
    enqueue('commercialTransactions', buildTransactionPayload(item, ownerUid, true))
  );
  payload.tradeEngagements.forEach((item) =>
    enqueue('tradeEngagements', buildTradeEngagementPayload(item, ownerUid, true))
  );
  payload.hallUtilisation.forEach((item) =>
    enqueue('hallUtilisation', buildHallUtilisationPayload(item, ownerUid, true))
  );
  payload.incidents.forEach((item) =>
    enqueue('operationalIncidents', buildIncidentPayload(item, ownerUid, true))
  );
  payload.marketInsights.forEach((item) =>
    enqueue('marketInsights', buildMarketInsightPayload(item, ownerUid, true))
  );
  payload.reports.forEach((item) => enqueue('biReports', buildBIReportPayload(item, ownerUid, true)));
  payload.connectors.forEach((item) =>
    enqueue('externalConnectors', buildConnectorPayload(item, ownerUid, true))
  );
  payload.connectorLogs.slice(0, 60).forEach((item) =>
    enqueue('connectorSyncLogs', buildConnectorLogPayload(item, ownerUid, true))
  );
  payload.alertRules.forEach((item) =>
    enqueue('thresholdAlertRules', buildAlertRulePayload(item, ownerUid, true))
  );
  payload.alertEvents.forEach((item) => enqueue('alertEvents', buildAlertEventPayload(item, ownerUid, true)));
  payload.scheduledReports.forEach((item) =>
    enqueue('scheduledReports', buildScheduledReportPayload(item, ownerUid, true))
  );
  payload.sharedItems.forEach((item) => enqueue('sharedBriefs', buildSharedBriefPayload(item, ownerUid, true)));
  payload.annotations.forEach((item) => enqueue('annotations', buildAnnotationPayload(item, ownerUid, true)));
  payload.emailDispatches.forEach((item) =>
    enqueue('emailDispatches', buildEmailDispatchPayload(item, ownerUid, true))
  );
  payload.auditLogs.slice(0, 50).forEach((item) =>
    enqueue('auditLogs', buildAuditLogPayload(item, ownerUid))
  );
  payload.users.forEach((item) => enqueue('directoryUsers', buildDirectoryUserPayload(item, ownerUid, true)));

  const CHUNK_SIZE = 400;
  let written = 0;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const slice = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of slice) {
      batch.set(doc(db, op.col, op.id), op.data);
    }
    try {
      await batch.commit();
      written += slice.length;
      if (onProgress) onProgress(written, ops.length);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, slice[0]?.col || 'batch');
    }
  }

  return { totalWritten: written, collectionCounts: counts };
}

export async function clearDemoDocsInFirestore(
  user: FirebaseUser,
  demoCollections: { col: string; ids: string[] }[]
): Promise<void> {
  const safeOps: { col: string; id: string }[] = [];
  demoCollections.forEach((entry) => {
    entry.ids.forEach((id) => safeOps.push({ col: entry.col, id: sanitizeId(id) }));
  });
  const CHUNK_SIZE = 400;
  for (let i = 0; i < safeOps.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const op of safeOps.slice(i, i + CHUNK_SIZE)) {
      batch.delete(doc(db, op.col, op.id));
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, safeOps[i]?.col || 'clearDemo');
    }
  }
  void user;
}

// -----------------------------------------------------------------------------
// Real-Time Multi-Collection Platform Subscriptions (onSnapshot)
// -----------------------------------------------------------------------------
export interface PlatformRealtimeHandlers {
  onEditions: (items: ExhibitionEdition[]) => void;
  onExhibitors: (items: Exhibitor[]) => void;
  onVisitors: (items: Visitor[]) => void;
  onTransactions: (items: CommercialTransaction[]) => void;
  onTradeEngagements: (items: TradeEngagement[]) => void;
  onHallUtilisation: (items: HallUtilisation[]) => void;
  onIncidents: (items: OperationalIncident[]) => void;
  onMarketInsights: (items: MarketInsight[]) => void;
  onReports: (items: BIReport[]) => void;
  onConnectors: (items: ExternalConnector[]) => void;
  onConnectorLogs: (items: ConnectorSyncLog[]) => void;
  onAlertRules: (items: ThresholdAlertRule[]) => void;
  onAlertEvents: (items: AlertEvent[]) => void;
  onScheduledReports: (items: ScheduledReportConfig[]) => void;
  onSharedItems: (items: SharedBriefItem[]) => void;
  onAnnotations: (items: AnnotationComment[]) => void;
  onEmailDispatches: (items: EmailDispatchLog[]) => void;
  onAuditLogs: (items: AuditLogItem[]) => void;
  onUsers: (items: UserProfile[]) => void;
  onPreferences?: (prefs: {
    selectedEditionId: string;
    selectedPeriod: string;
    selectedSector: string;
    geographicFilter: 'all' | 'local' | 'international';
    selectedCountry: string;
  }) => void;
  onError?: (err: Error) => void;
}

export function subscribeToPlatformCollections(
  user: FirebaseUser,
  handlers: PlatformRealtimeHandlers
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  const handleErr = (path: string) => (error: unknown) => {
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch (wrapped) {
      if (handlers.onError && wrapped instanceof Error) {
        handlers.onError(wrapped);
      }
    }
  };

  const listen = <T>(
    collectionName: string,
    mapper: (raw: Record<string, any>) => T,
    onData: (items: T[]) => void,
    sortFn?: (a: T, b: T) => number
  ) => {
    const q = collectionQueryForUser(collectionName, user);
    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs.map((d) => mapper(d.data() as Record<string, any>));
        if (sortFn) mapped.sort(sortFn);
        onData(mapped);
      },
      handleErr(collectionName)
    );
    unsubs.push(unsub);
  };

  listen<ExhibitionEdition>(
    'editions',
    (d) => stripFirestoreMeta(d) as ExhibitionEdition,
    handlers.onEditions,
    (a, b) => b.year - a.year
  );
  listen<Exhibitor>(
    'exhibitors',
    (d) => stripFirestoreMeta(d) as Exhibitor,
    handlers.onExhibitors
  );
  listen<Visitor>(
    'visitors',
    (d) => stripFirestoreMeta(d) as Visitor,
    handlers.onVisitors
  );
  listen<CommercialTransaction>(
    'commercialTransactions',
    (d) => stripFirestoreMeta(d) as CommercialTransaction,
    handlers.onTransactions
  );
  listen<TradeEngagement>(
    'tradeEngagements',
    (d) => stripFirestoreMeta(d) as TradeEngagement,
    handlers.onTradeEngagements
  );
  listen<HallUtilisation>(
    'hallUtilisation',
    (d) => stripFirestoreMeta(d) as HallUtilisation,
    handlers.onHallUtilisation,
    (a, b) => a.hallName.localeCompare(b.hallName)
  );
  listen<OperationalIncident>(
    'operationalIncidents',
    (d) => stripFirestoreMeta(d) as OperationalIncident,
    handlers.onIncidents
  );
  listen<MarketInsight>(
    'marketInsights',
    (d) => stripFirestoreMeta(d) as MarketInsight,
    handlers.onMarketInsights
  );
  listen<BIReport>(
    'biReports',
    (d) => stripFirestoreMeta(d) as BIReport,
    handlers.onReports
  );
  listen<ExternalConnector>(
    'externalConnectors',
    (d) => stripFirestoreMeta(d) as ExternalConnector,
    handlers.onConnectors
  );
  listen<ConnectorSyncLog>(
    'connectorSyncLogs',
    (d) => stripFirestoreMeta(d) as ConnectorSyncLog,
    handlers.onConnectorLogs,
    (a, b) => b.timestamp.localeCompare(a.timestamp)
  );
  listen<ThresholdAlertRule>(
    'thresholdAlertRules',
    (d) => ({
      ...(stripFirestoreMeta(d) as Omit<ThresholdAlertRule, 'createdAt'>),
      createdAt: tsToIso(d.createdAtIso || d.createdAt),
    }),
    handlers.onAlertRules
  );
  listen<AlertEvent>(
    'alertEvents',
    (d) => stripFirestoreMeta(d) as AlertEvent,
    handlers.onAlertEvents,
    (a, b) => b.triggeredAt.localeCompare(a.triggeredAt)
  );
  listen<ScheduledReportConfig>(
    'scheduledReports',
    (d) => ({
      ...(stripFirestoreMeta(d) as Omit<ScheduledReportConfig, 'createdAt'>),
      createdAt: tsToIso(d.createdAtIso || d.createdAt),
    }),
    handlers.onScheduledReports
  );
  listen<SharedBriefItem>(
    'sharedBriefs',
    (d) => ({
      ...(stripFirestoreMeta(d) as Omit<SharedBriefItem, 'createdAt'>),
      createdAt: tsToIso(d.createdAtIso || d.createdAt),
    }),
    handlers.onSharedItems
  );
  listen<AnnotationComment>(
    'annotations',
    (d) => ({
      ...(stripFirestoreMeta(d) as Omit<AnnotationComment, 'createdAt'>),
      createdAt: tsToIso(d.createdAtIso || d.createdAt),
    }),
    handlers.onAnnotations
  );
  listen<EmailDispatchLog>(
    'emailDispatches',
    (d) => stripFirestoreMeta(d) as EmailDispatchLog,
    handlers.onEmailDispatches,
    (a, b) => b.dispatchedAt.localeCompare(a.dispatchedAt)
  );
  listen<AuditLogItem>(
    'auditLogs',
    (d) => stripFirestoreMeta(d) as AuditLogItem,
    handlers.onAuditLogs,
    (a, b) => b.timestamp.localeCompare(a.timestamp)
  );
  listen<UserProfile>(
    'directoryUsers',
    (d) => stripFirestoreMeta(d) as UserProfile,
    handlers.onUsers
  );

  // Per-user active workspace preferences
  if (handlers.onPreferences) {
    const safeUid = sanitizeId(user.uid);
    const prefPath = `workspacePreferences/${safeUid}`;
    const unsubPref = onSnapshot(
      doc(db, 'workspacePreferences', safeUid),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, any>;
        handlers.onPreferences?.({
          selectedEditionId: str(data.selectedEditionId, 64, 'zitf-2026'),
          selectedPeriod: str(data.selectedPeriod, 40, 'all'),
          selectedSector: str(data.selectedSector, 120, 'all'),
          geographicFilter: pickEnum(
            data.geographicFilter,
            ['all', 'local', 'international'] as const,
            'all'
          ),
          selectedCountry: str(data.selectedCountry, 100, 'all'),
        });
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, prefPath);
        } catch (wrapped) {
          if (handlers.onError && wrapped instanceof Error) {
            handlers.onError(wrapped);
          }
        }
      }
    );
    unsubs.push(unsubPref);
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}

// -----------------------------------------------------------------------------
// Existing Snapshot Collection APIs (Preserved for Snapshot Archive / Subcollection)
// -----------------------------------------------------------------------------
export interface CloudWarehouseSnapshotDoc {
  snapshotId: string;
  ownerUid: string;
  ownerEmail: string;
  editionId: string;
  editionLabel: string;
  status: 'Synced' | 'Archived';
  totalExhibitors: number;
  totalVisitors: number;
  totalRevenueUsd: number;
  verifiedDealsUsd: number;
  spaceOccupancyPct: number;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export async function syncWarehouseSnapshotToFirestore(input: {
  editionId: string;
  editionLabel: string;
  totalExhibitors: number;
  totalVisitors: number;
  totalRevenueUsd: number;
  verifiedDealsUsd: number;
  spaceOccupancyPct: number;
  notes?: string;
  reports?: BIReport[];
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in with Google first to write to Cloud Firestore.');
  }
  const safeUid = sanitizeId(user.uid);
  const snapshotId = sanitizeId(`snap-${input.editionId}-${safeUid.slice(0, 10)}`);
  const snapshotPath = `workspaceSnapshots/${snapshotId}`;
  const snapshotRef = doc(db, 'workspaceSnapshots', snapshotId);

  try {
    const existing = await getDoc(snapshotRef);
    const clampedOccupancy = Math.max(0, Math.min(100, Number(input.spaceOccupancyPct) || 0));
    const safeNotes = (input.notes || '').trim().slice(0, 500);

    if (!existing.exists()) {
      await setDoc(snapshotRef, {
        snapshotId,
        ownerUid: safeUid,
        ownerEmail: (user.email || '').slice(0, 160),
        editionId: input.editionId.slice(0, 64),
        editionLabel: input.editionLabel.slice(0, 120),
        status: 'Synced',
        totalExhibitors: Math.max(0, Math.round(input.totalExhibitors)),
        totalVisitors: Math.max(0, Math.round(input.totalVisitors)),
        totalRevenueUsd: Math.max(0, Number(input.totalRevenueUsd) || 0),
        verifiedDealsUsd: Math.max(0, Number(input.verifiedDealsUsd) || 0),
        spaceOccupancyPct: Number(clampedOccupancy.toFixed(2)),
        notes: safeNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(snapshotRef, {
        editionId: input.editionId.slice(0, 64),
        editionLabel: input.editionLabel.slice(0, 120),
        totalExhibitors: Math.max(0, Math.round(input.totalExhibitors)),
        totalVisitors: Math.max(0, Math.round(input.totalVisitors)),
        totalRevenueUsd: Math.max(0, Number(input.totalRevenueUsd) || 0),
        verifiedDealsUsd: Math.max(0, Number(input.verifiedDealsUsd) || 0),
        spaceOccupancyPct: Number(clampedOccupancy.toFixed(2)),
        notes: safeNotes,
        updatedAt: serverTimestamp(),
      });
    }

    const latestReports = (input.reports || []).slice(0, 3);
    for (const rep of latestReports) {
      const reportId = sanitizeId(rep.id);
      const repPath = `workspaceSnapshots/${snapshotId}/reports/${reportId}`;
      const repRef = doc(db, 'workspaceSnapshots', snapshotId, 'reports', reportId);
      try {
        const repSnap = await getDoc(repRef);
        const title = minStr(rep.title, 3, 200, 'ZITF BI Report');
        const summary = minStr(rep.summaryFindings, 3, 2000, 'Executive summary snapshot');
        if (!repSnap.exists()) {
          await setDoc(repRef, {
            reportId,
            snapshotId,
            ownerUid: safeUid,
            title,
            pillar: rep.pillar,
            summaryFindings: summary,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(repRef, {
            title,
            pillar: rep.pillar,
            summaryFindings: summary,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, repPath);
      }
    }

    return snapshotId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, snapshotPath);
  }
}

export async function archiveCloudSnapshot(snapshotId: string): Promise<void> {
  const safeId = sanitizeId(snapshotId);
  const path = `workspaceSnapshots/${safeId}`;
  try {
    await updateDoc(doc(db, 'workspaceSnapshots', safeId), {
      status: 'Archived',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCloudSnapshot(snapshotId: string): Promise<void> {
  const safeId = sanitizeId(snapshotId);
  const path = `workspaceSnapshots/${safeId}`;
  try {
    await deleteDoc(doc(db, 'workspaceSnapshots', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToCloudSnapshots(
  user: FirebaseUser,
  onData: (snapshots: CloudWarehouseSnapshotDoc[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'workspaceSnapshots';
  const q = collectionQueryForUser(path, user);

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as CloudWarehouseSnapshotDoc);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}
