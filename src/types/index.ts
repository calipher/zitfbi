export type UserRole =
  | 'Super Administrator'
  | 'Executive Management'
  | 'Department Manager'
  | 'Data Analyst'
  | 'Data Entry Officer'
  | 'External Stakeholder / Viewer';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  isActive: boolean;
  lastLogin: string;
}

export interface ActiveSessionInfo {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  department: string;
  impersonatedByUserId?: string;
  impersonatedByName?: string;
  createdAt: string;
  expiresAt: string;
  isCurrentSession?: boolean;
}

export interface ExhibitionEdition {
  id: string;
  name: string;
  editionNumber: number;
  theme: string;
  year: number;
  startDate: string;
  endDate: string;
  venue: string;
  status: 'Upcoming' | 'Active' | 'Concluded';
  isCurrent: boolean;
}

export interface Exhibitor {
  id: string;
  companyName: string;
  regNumber: string;
  businessDescription: string;
  industry: string;
  sector: string;
  country: string;
  provinceCity: string;
  contactPerson: string;
  email: string;
  phone: string;
  website: string;
  productsServices: string[];
  editionId: string;
  hallStand: string;
  standSizeSqm: number;
  category: 'Local Commercial' | 'International Pavilion' | 'State Owned Enterprise' | 'SME / Emerging' | 'Education & Research' | 'Tech & Innovation';
  registrationDate: string;
  bookingStatus: 'Confirmed' | 'Reserved' | 'Waitlisted' | 'Cancelled';
  paymentStatus: 'Fully Paid' | 'Partially Paid' | 'Pending';
  returningStatus: 'New' | 'Returning';
  satisfactionScore: number; // 1-5
  participationHistory: number[];
  isDemo?: boolean;
}

export interface Visitor {
  id: string;
  visitorRef: string;
  fullName: string;
  category:
    | 'Business Visitors'
    | 'General Public'
    | 'Students'
    | 'Government Representatives'
    | 'International Delegates'
    | 'Investors'
    | 'Buyers and Procurement'
    | 'Media Representatives';
  country: string;
  cityProvince: string;
  organization: string;
  industry: string;
  email: string;
  phone: string;
  registrationDate: string;
  editionId: string;
  attendanceDays: string[];
  interests: string[];
  areasVisited: string[];
  feedbackRating: number; // 1-5
  repeatVisitor: boolean;
  isDemo?: boolean;
}

export interface CommercialTransaction {
  id: string;
  refNumber: string;
  type:
    | 'Exhibition Hall Space'
    | 'Sponsorship Agreement'
    | 'Advertising & Signage'
    | 'Conference & Forum Pass'
    | 'Commercial Services'
    | 'Logistics & Utilities';
  clientName: string;
  exhibitorId?: string;
  amountUsd: number;
  outstandingBalanceUsd: number;
  editionId: string;
  status: 'Fully Paid' | 'Deposit Paid' | 'Invoice Sent' | 'Overdue';
  paymentDate: string;
  sector: string;
  notes: string;
  isDemo?: boolean;
}

export type TradeOpportunityType =
  | 'Export Opportunity'
  | 'Import Opportunity'
  | 'Joint Venture / Partnership'
  | 'Distribution Agreement'
  | 'Supply Contract'
  | 'Investment Enquiry'
  | 'Technology Transfer';

export type TradeEngagementStatus =
  | 'New'
  | 'Contact Established'
  | 'Meeting Scheduled'
  | 'Meeting Completed'
  | 'Follow-up Required'
  | 'Negotiation Ongoing'
  | 'Opportunity Converted'
  | 'Closed / Unsuccessful';

export type TradeVerificationStatus =
  | 'Facilitated Opportunity'
  | 'Reported by Participant'
  | 'Independently Verified';

export interface TradeEngagement {
  id: string;
  refNumber: string;
  editionId: string;
  date: string;
  buyerOrg: string;
  buyerCountry: string;
  supplierOrg: string;
  supplierCountry: string;
  industry: string;
  opportunityType: TradeOpportunityType;
  description: string;
  estimatedValueUsd: number;
  engagementStatus: TradeEngagementStatus;
  followUpDate: string;
  outcome: string;
  verificationStatus: TradeVerificationStatus;
  verifiedDate?: string;
  supportingDocName?: string;
  isDemo?: boolean;
}

export interface HallUtilisation {
  hallId: string;
  hallName: string;
  totalCapacitySqm: number;
  occupiedSqm: number;
  utilizationRatePct: number;
  primarySector: string;
  wifiUptimePct: number;
  activeExhibitorsCount: number;
}

export interface OperationalIncident {
  id: string;
  refNumber: string;
  editionId: string;
  hallOrArea: string;
  category: 'ICT & Network' | 'Electrical & Power' | 'Facilities & HVAC' | 'Logistics & Transport' | 'Security & Safety' | 'Customer Care';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  title: string;
  description: string;
  reportedTime: string;
  resolvedTime?: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  resolutionNotes?: string;
  isDemo?: boolean;
}

export interface MarketInsight {
  id: string;
  title: string;
  sector: string;
  marketType: 'Emerging Sector' | 'Export Potential' | 'Investment Opportunity' | 'SME Growth' | 'Technology Trend' | 'Trade Corridor';
  summary: string;
  keyIndicators: string[];
  estimatedMarketValueUsd: number;
  growthRateYoY: number;
  zimbabweMarketContext: string;
  sourceAttribution: string;
  date: string;
  isDemo?: boolean;
}

export interface BIReport {
  id: string;
  reportNumber: string;
  title: string;
  pillar: 'Executive' | 'Exhibitor' | 'Visitor' | 'Commercial' | 'Trade Impact' | 'Operational' | 'Market Insight';
  editionId: string;
  generationDate: string;
  author: string;
  confidentiality: 'Confidential - Board & Executive' | 'Management Internal' | 'Public Trade Release';
  summaryFindings: string;
  kpis: { label: string; value: string; trend?: string }[];
  recommendations: string[];
  isDemo?: boolean;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  userEmail: string;
  userRole: UserRole;
  action: string;
  module: string;
  details: string;
}

export interface ImportPreviewRow {
  rowIndex: number;
  data: Record<string, any>;
  normalizedData?: Record<string, any>;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
  duplicateReason?: string;
}

export interface GovernedImportResult {
  ok: boolean;
  targetModule: ConnectorTargetModule;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
  importedItems: any[];
  rejectedRows: { rowIndex: number; errors: string[]; data: Record<string, any> }[];
  duplicateRows: { rowIndex: number; reason: string; data: Record<string, any> }[];
  stats?: WarehouseStats;
}

export type ConnectorSystemType = 'CRM' | 'Ticketing' | 'B2B Portal' | 'Smart Stand' | 'Custom REST';
export type ConnectorTargetModule = 'exhibitors' | 'visitors' | 'commercial' | 'trade';
export type ConnectorAuthType = 'None' | 'Bearer Token' | 'API Key Header';

export interface ExternalConnector {
  id: string;
  name: string;
  systemType: ConnectorSystemType;
  mode: 'Pull (REST/CSV)' | 'Webhook Push';
  targetModule: ConnectorTargetModule;
  endpointUrl: string;
  dataPath?: string;
  authType: ConnectorAuthType;
  authHeaderName?: string;
  authToken?: string;
  status: 'Connected' | 'Standby' | 'Error' | 'Syncing';
  lastSyncAt?: string;
  lastSyncCount?: number;
  lastLatencyMs?: number;
  lastStatusCode?: number;
  lastError?: string;
  autoDeduplicate: boolean;
  description?: string;
}

export interface ConnectorSyncLog {
  id: string;
  connectorId: string;
  connectorName: string;
  timestamp: string;
  status: 'Success' | 'Failed';
  statusCode?: number;
  latencyMs?: number;
  recordsFetched: number;
  recordsImported: number;
  duplicatesSkipped: number;
  message: string;
}

export interface WarehouseStats {
  engine: string;
  dbPath: string;
  sizeBytes: number;
  tableCounts: Record<string, number>;
  totalRecords: number;
  checkedAt: string;
}

export type AlertMetricKey =
  | 'collection_rate_pct'
  | 'outstanding_balance_usd'
  | 'space_occupancy_pct'
  | 'open_incidents_count'
  | 'network_uptime_pct'
  | 'exhibitor_retention_pct'
  | 'verified_deals_usd'
  | 'anomaly_count';

export type AlertOperator = 'lt' | 'lte' | 'gt' | 'gte';
export type AlertSeverity = 'Critical' | 'Warning' | 'Info';

export interface ThresholdAlertRule {
  id: string;
  name: string;
  metricKey: AlertMetricKey;
  operator: AlertOperator;
  threshold: number;
  severity: AlertSeverity;
  editionId: string;
  notifyRoles: UserRole[];
  recipients: string;
  isActive: boolean;
  lastEvaluatedAt?: string;
  lastTriggeredAt?: string;
  createdAt: string;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  metricKey: AlertMetricKey;
  metricLabel: string;
  observedValue: number;
  threshold: number;
  operator: AlertOperator;
  severity: AlertSeverity;
  editionId: string;
  message: string;
  status: 'Active' | 'Acknowledged' | 'Resolved';
  triggeredAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export type ScheduleFrequency = 'Hourly (Monitor)' | 'Daily' | 'Weekly' | 'Monthly';

export interface ScheduledReportConfig {
  id: string;
  name: string;
  pillar: BIReport['pillar'];
  editionId: string;
  confidentiality: BIReport['confidentiality'];
  frequency: ScheduleFrequency;
  runTimeUtc: string;
  dayOfWeekOrMonth?: string;
  recipients: string;
  includeMiningForecast: boolean;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt: string;
  lastReportId?: string;
  runCount: number;
  createdAt: string;
}

export type CollaborationTargetType =
  | 'Report'
  | 'Dashboard'
  | 'DataMining'
  | 'TradeDeal'
  | 'Incident'
  | 'MarketInsight';

export type CollaborationWorkflowStatus =
  | 'Shared'
  | 'In Review'
  | 'Changes Requested'
  | 'Approved';

export interface SharedBriefItem {
  id: string;
  shareToken: string;
  targetType: CollaborationTargetType;
  targetId: string;
  title: string;
  editionId: string;
  sharedByName: string;
  sharedByEmail: string;
  sharedByRole: UserRole;
  recipientEmails: string[];
  recipientRoles: UserRole[];
  accessLevel: 'View Only' | 'Comment & Annotate' | 'Approve / Sign-Off';
  note: string;
  workflowStatus: CollaborationWorkflowStatus;
  approvedBy?: string;
  approvedAt?: string;
  snapshotSummary?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface AnnotationComment {
  id: string;
  targetType: CollaborationTargetType;
  targetId: string;
  targetTitle: string;
  sectionTag: string;
  authorName: string;
  authorEmail: string;
  authorRole: UserRole;
  body: string;
  mentions: string[];
  status: 'Open' | 'Resolved';
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface EmailDispatchLog {
  id: string;
  targetType: CollaborationTargetType;
  targetId: string;
  subject: string;
  recipients: string[];
  bodyPreview: string;
  shareUrl?: string;
  senderName: string;
  senderEmail: string;
  deliveryMode: 'Webhook Relay' | 'MIME Queue & Mailto Dispatch';
  status: 'Dispatched' | 'Queued (MIME Ready)' | 'Failed';
  dispatchedAt: string;
}

export interface UserWorkspacePreferences {
  userId: string;
  selectedEditionId: string;
  selectedPeriod: string;
  selectedSector: string;
  geographicFilter: 'all' | 'local' | 'international';
  updatedAt: string;
}

export interface StorageObjectRecord {
  id: string;
  category: 'upload-csv' | 'upload-json' | 'report-export' | 'warehouse-snapshot';
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedByEmail: string;
  uploadedByRole: UserRole;
  moduleRef?: string;
  createdAt: string;
}

export interface ClientErrorLogEntry {
  id: string;
  scope: 'app' | 'module' | 'widget';
  moduleName: string;
  message: string;
  stackPreview?: string;
  componentStackPreview?: string;
  userEmail?: string;
  userRole?: string;
  urlPath?: string;
  createdAt: string;
}

export interface StorageDiagnostics {
  engine: string;
  journalMode: string;
  synchronousMode: string;
  dbSizeBytes: number;
  walSizeBytes: number;
  indexCount: number;
  objectsCount: number;
  objectsTotalBytes: number;
  preferencesCount: number;
  activeSessionsCount: number;
  clientErrorLogsCount: number;
  tableCounts: Record<string, number>;
  checkedAt: string;
}

export interface PaginatedWarehouseQueryResult<T = any> {
  entity: string;
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  redacted?: boolean;
}
