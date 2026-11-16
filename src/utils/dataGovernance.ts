import type {
  CommercialTransaction,
  ConnectorTargetModule,
  Exhibitor,
  ImportPreviewRow,
  TradeEngagement,
  Visitor,
} from '../types/index.ts';

export interface GovernanceModuleRule {
  module: ConnectorTargetModule;
  label: string;
  requiredFields: string[];
  dedupKeys: string[];
  fieldRules: string[];
  recognizedKeys: string[];
}

export const MODULE_GOVERNANCE_RULES: Record<ConnectorTargetModule, GovernanceModuleRule> = {
  exhibitors: {
    module: 'exhibitors',
    label: 'Exhibitors',
    requiredFields: ['companyName', 'sector', 'country', 'email'],
    dedupKeys: ['regNumber', 'email', 'companyName + editionId'],
    fieldRules: [
      'email must match valid RFC format',
      'standSizeSqm > 0 and <= 50,000',
      'satisfactionScore within 1.0–5.0',
      'paymentStatus in {Fully Paid, Partially Paid, Pending}',
    ],
    recognizedKeys: ['companyName', 'regNumber', 'sector', 'country', 'email', 'hallStand', 'standSizeSqm'],
  },
  visitors: {
    module: 'visitors',
    label: 'Visitors',
    requiredFields: ['fullName', 'country', 'email'],
    dedupKeys: ['visitorRef', 'email', 'fullName + organization + editionId'],
    fieldRules: [
      'email must match valid RFC format',
      'category must be a recognized ZITF visitor tier',
      'feedbackRating within 1.0–5.0',
      'phone >= 6 digits if supplied',
    ],
    recognizedKeys: ['fullName', 'visitorRef', 'category', 'country', 'email', 'organization', 'industry'],
  },
  commercial: {
    module: 'commercial',
    label: 'Commercial Invoices',
    requiredFields: ['clientName', 'amountUsd'],
    dedupKeys: ['refNumber', 'clientName + type + amountUsd + editionId'],
    fieldRules: [
      'amountUsd must be strictly numeric > 0',
      '0 <= outstandingBalanceUsd <= amountUsd',
      'Fully Paid invoices cannot carry outstanding balance > 0',
      'type & status validated against commercial enums',
    ],
    recognizedKeys: ['clientName', 'refNumber', 'type', 'amountUsd', 'outstandingBalanceUsd', 'status', 'sector'],
  },
  trade: {
    module: 'trade',
    label: 'Trade Impact (B2B)',
    requiredFields: ['buyerOrg', 'supplierOrg', 'estimatedValueUsd'],
    dedupKeys: ['refNumber', 'buyerOrg + supplierOrg + opportunityType + editionId'],
    fieldRules: [
      'buyerOrg and supplierOrg must be distinct organizations',
      'estimatedValueUsd must be strictly numeric >= 0',
      'opportunityType, engagementStatus & verificationStatus validated',
      'followUpDate must be valid YYYY-MM-DD if supplied',
    ],
    recognizedKeys: ['buyerOrg', 'supplierOrg', 'opportunityType', 'estimatedValueUsd', 'engagementStatus', 'verificationStatus'],
  },
};

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const EXHIBITOR_CATEGORIES = new Set([
  'Local Commercial',
  'International Pavilion',
  'State Owned Enterprise',
  'SME / Emerging',
  'Education & Research',
  'Tech & Innovation',
]);

const EXHIBITOR_PAYMENT_STATUSES = new Set(['Fully Paid', 'Partially Paid', 'Pending']);

const VISITOR_CATEGORIES = new Set([
  'Business Visitors',
  'General Public',
  'Students',
  'Government Representatives',
  'International Delegates',
  'Investors',
  'Buyers and Procurement',
  'Media Representatives',
]);

const REVENUE_STREAM_TYPES = new Set([
  'Exhibition Hall Space',
  'Sponsorship Agreement',
  'Advertising & Signage',
  'Conference & Forum Pass',
  'Commercial Services',
  'Logistics & Utilities',
]);

const TRANSACTION_STATUSES = new Set(['Fully Paid', 'Deposit Paid', 'Invoice Sent', 'Overdue']);

const TRADE_OPPORTUNITY_TYPES = new Set([
  'Export Opportunity',
  'Import Opportunity',
  'Joint Venture / Partnership',
  'Distribution Agreement',
  'Supply Contract',
  'Investment Enquiry',
  'Technology Transfer',
]);

const TRADE_ENGAGEMENT_STATUSES = new Set([
  'New',
  'Contact Established',
  'Meeting Scheduled',
  'Meeting Completed',
  'Follow-up Required',
  'Negotiation Ongoing',
  'Opportunity Converted',
  'Closed / Unsuccessful',
]);

const TRADE_VERIFICATION_STATUSES = new Set([
  'Facilitated Opportunity',
  'Reported by Participant',
  'Independently Verified',
]);

const HEADER_ALIASES: Record<string, string> = {
  // Exhibitors
  companyname: 'companyName',
  company: 'companyName',
  organizationname: 'companyName',
  exhibitorname: 'companyName',
  regnumber: 'regNumber',
  registrationnumber: 'regNumber',
  regno: 'regNumber',
  businessdescription: 'businessDescription',
  description: 'description',
  industry: 'industry',
  sector: 'sector',
  country: 'country',
  provincecity: 'provinceCity',
  province: 'provinceCity',
  city: 'provinceCity',
  contactperson: 'contactPerson',
  contact: 'contactPerson',
  email: 'email',
  emailaddress: 'email',
  phone: 'phone',
  telephone: 'phone',
  website: 'website',
  productsservices: 'productsServices',
  editionid: 'editionId',
  edition: 'editionId',
  hallstand: 'hallStand',
  stand: 'hallStand',
  standsizesqm: 'standSizeSqm',
  standsize: 'standSizeSqm',
  areasqm: 'standSizeSqm',
  category: 'category',
  paymentstatus: 'paymentStatus',
  returningstatus: 'returningStatus',
  satisfactionscore: 'satisfactionScore',

  // Visitors
  visitorref: 'visitorRef',
  badgeref: 'visitorRef',
  fullname: 'fullName',
  visitorname: 'fullName',
  name: 'fullName',
  cityprovince: 'cityProvince',
  organization: 'organization',
  companyemployer: 'organization',
  attendancedays: 'attendanceDays',
  interests: 'interests',
  areasvisited: 'areasVisited',
  feedbackrating: 'feedbackRating',
  repeatvisitor: 'repeatVisitor',

  // Commercial
  refnumber: 'refNumber',
  invoiceref: 'refNumber',
  invoicenumber: 'refNumber',
  type: 'type',
  revenuestream: 'type',
  clientname: 'clientName',
  clientorganization: 'clientName',
  amountusd: 'amountUsd',
  amount: 'amountUsd',
  outstandingbalanceusd: 'outstandingBalanceUsd',
  outstandingbalance: 'outstandingBalanceUsd',
  outstanding: 'outstandingBalanceUsd',
  status: 'status',
  paymentdate: 'paymentDate',
  notes: 'notes',

  // Trade
  buyerorg: 'buyerOrg',
  buyerorganization: 'buyerOrg',
  buyer: 'buyerOrg',
  buyercountry: 'buyerCountry',
  supplierorg: 'supplierOrg',
  supplierorganization: 'supplierOrg',
  supplier: 'supplierOrg',
  suppliercountry: 'supplierCountry',
  opportunitytype: 'opportunityType',
  estimatedvalueusd: 'estimatedValueUsd',
  estimatedvalue: 'estimatedValueUsd',
  valueusd: 'estimatedValueUsd',
  engagementstatus: 'engagementStatus',
  followupdate: 'followUpDate',
  outcome: 'outcome',
  verificationstatus: 'verificationStatus',
};

export function normalizeMatchKey(val: unknown): string {
  return String(val ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeEnumMatch(val: unknown, allowedSet: Set<string>): string | null {
  const cleaned = normalizeMatchKey(val);
  if (!cleaned) return null;
  for (const item of allowedSet) {
    if (item.toLowerCase() === cleaned) return item;
  }
  return null;
}

export function canonicalizeRowKeys(rawRow: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [rawKey, value] of Object.entries(rawRow || {})) {
    const cleanKey = rawKey.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const mappedKey = HEADER_ALIASES[cleanKey] || rawKey.trim();
    if (out[mappedKey] === undefined || out[mappedKey] === '') {
      out[mappedKey] = typeof value === 'string' ? value.trim() : value;
    }
  }
  return out;
}

// RFC 4180 compliant CSV parser for uploaded files and pasted datasets
export function parseCsvContent(csvText: string): { headers: string[]; records: Record<string, any>[] } {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return { headers: [], records: [] };

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((cell) => cell !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  currentRow.push(currentField.trim());
  if (currentRow.some((cell) => cell !== '')) {
    rows.push(currentRow);
  }

  if (rows.length < 2) return { headers: rows[0] || [], records: [] };

  const headers = rows[0].map((h) => h.replace(/^"|"$/g, '').trim());
  const records = rows.slice(1).map((cells) => {
    const obj: Record<string, any> = {};
    headers.forEach((header, idx) => {
      if (header) {
        obj[header] = cells[idx] ?? '';
      }
    });
    return obj;
  });

  return { headers, records };
}

export function inspectDatasetHeaders(
  records: Record<string, any>[],
  targetModule: ConnectorTargetModule
): { compatible: boolean; message?: string; matchedColumns: string[] } {
  if (!records || records.length === 0) {
    return { compatible: false, message: 'Dataset contains 0 data rows.', matchedColumns: [] };
  }
  const canonicalKeys = new Set<string>();
  records.slice(0, 5).forEach((r) => {
    Object.keys(canonicalizeRowKeys(r)).forEach((k) => canonicalKeys.add(k));
  });

  const rule = MODULE_GOVERNANCE_RULES[targetModule];
  const matchedColumns = rule.recognizedKeys.filter((k) => canonicalKeys.has(k));

  if (matchedColumns.length === 0) {
    return {
      compatible: false,
      matchedColumns: [],
      message: `Schema mismatch: none of the ${rule.label} columns (${rule.recognizedKeys.join(', ')}) were found in this file. Verify the Destination Intelligence Module.`,
    };
  }

  return { compatible: true, matchedColumns };
}

function parseStrictNumber(val: unknown): { present: boolean; valid: boolean; num: number } {
  if (val === undefined || val === null || String(val).trim() === '') {
    return { present: false, valid: false, num: NaN };
  }
  const cleaned = String(val).replace(/[$,\s]/g, '');
  const num = Number(cleaned);
  return { present: true, valid: Number.isFinite(num), num };
}

function parseListField(val: unknown, fallback: string[]): string[] {
  if (Array.isArray(val)) {
    const cleaned = val.map((v) => String(v).trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : fallback;
  }
  if (typeof val === 'string' && val.trim()) {
    const parts = val
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : fallback;
  }
  return fallback;
}

export interface ExistingGovernanceStore {
  exhibitors?: Exhibitor[];
  visitors?: Visitor[];
  transactions?: CommercialTransaction[];
  tradeEngagements?: TradeEngagement[];
}

export interface BatchGovernanceOutput {
  previewRows: ImportPreviewRow[];
  validPayloads: any[];
  rejectedRows: { rowIndex: number; errors: string[]; data: Record<string, any> }[];
  duplicateRows: { rowIndex: number; reason: string; data: Record<string, any> }[];
  summary: {
    totalRows: number;
    validNewCount: number;
    duplicateCount: number;
    errorCount: number;
  };
}

export function governDatasetBatch(
  targetModule: ConnectorTargetModule,
  rawRecords: Record<string, any>[],
  existingStore: ExistingGovernanceStore,
  options: { skipDuplicates?: boolean; defaultEditionId?: string } = {}
): BatchGovernanceOutput {
  const skipDuplicates = options.skipDuplicates ?? true;
  const activeEdId = options.defaultEditionId && options.defaultEditionId !== 'all' ? options.defaultEditionId : 'zitf-2026';
  const todayIso = new Date().toISOString().substring(0, 10);

  const previewRows: ImportPreviewRow[] = [];
  const validPayloads: any[] = [];
  const rejectedRows: { rowIndex: number; errors: string[]; data: Record<string, any> }[] = [];
  const duplicateRows: { rowIndex: number; reason: string; data: Record<string, any> }[] = [];

  if (targetModule === 'exhibitors') {
    const existingList = existingStore.exhibitors || [];
    const seenReg = new Map<string, string>();
    const seenEmail = new Map<string, string>();
    const seenNameEd = new Map<string, string>();

    existingList.forEach((e) => {
      const reg = normalizeMatchKey(e.regNumber);
      const em = normalizeMatchKey(e.email);
      const nm = `${normalizeMatchKey(e.companyName)}|${normalizeMatchKey(e.editionId)}`;
      if (reg) seenReg.set(reg, `existing DB regNumber "${e.regNumber}"`);
      if (em) seenEmail.set(em, `existing DB email "${e.email}"`);
      if (e.companyName) seenNameEd.set(nm, `existing DB exhibitor "${e.companyName}" (${e.editionId})`);
    });

    rawRecords.forEach((rawRow, idx) => {
      const rowIndex = idx + 1;
      const r = canonicalizeRowKeys(rawRow);
      const errors: string[] = [];
      const warnings: string[] = [];

      const companyName = String(r.companyName || '').trim();
      const regNumber = String(r.regNumber || '').trim();
      const sector = String(r.sector || '').trim();
      const country = String(r.country || '').trim();
      const email = String(r.email || '').trim();
      const phone = String(r.phone || '').trim();
      const website = String(r.website || '').trim();
      const editionId = String(r.editionId || activeEdId).trim() || activeEdId;

      if (!companyName || companyName.length < 2) errors.push('companyName: Required (min 2 characters)');
      if (!sector) errors.push('sector: Required');
      if (!country) errors.push('country: Required');
      if (!email) {
        errors.push('email: Required');
      } else if (!EMAIL_REGEX.test(email)) {
        errors.push(`email: Invalid format "${email}"`);
      }

      if (phone) {
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 6) errors.push('phone: Must contain at least 6 digits');
      }

      if (website && !/^(https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(website)) {
        errors.push(`website: Invalid domain/URL "${website}"`);
      }

      const standParsed = parseStrictNumber(r.standSizeSqm);
      let standSizeSqm = 36;
      if (standParsed.present) {
        if (!standParsed.valid || standParsed.num <= 0 || standParsed.num > 50000) {
          errors.push('standSizeSqm: Must be a number > 0 and <= 50,000');
        } else {
          standSizeSqm = standParsed.num;
        }
      } else {
        warnings.push('standSizeSqm missing; defaulted to 36 sqm');
      }

      const satParsed = parseStrictNumber(r.satisfactionScore);
      let satisfactionScore = 4.5;
      if (satParsed.present) {
        if (!satParsed.valid || satParsed.num < 1 || satParsed.num > 5) {
          errors.push('satisfactionScore: Must be between 1.0 and 5.0');
        } else {
          satisfactionScore = Number(satParsed.num.toFixed(1));
        }
      }

      let category: Exhibitor['category'] = 'Local Commercial';
      if (r.category) {
        const matchedCat = normalizeEnumMatch(r.category, EXHIBITOR_CATEGORIES);
        if (!matchedCat) {
          errors.push(`category: Invalid value "${r.category}"`);
        } else {
          category = matchedCat as Exhibitor['category'];
        }
      } else if (country && normalizeMatchKey(country) !== 'zimbabwe') {
        category = 'International Pavilion';
      }

      let paymentStatus: Exhibitor['paymentStatus'] = 'Fully Paid';
      if (r.paymentStatus) {
        const rawPay = normalizeMatchKey(r.paymentStatus);
        if (rawPay === 'deposit paid') {
          paymentStatus = 'Partially Paid';
        } else {
          const matchedPay = normalizeEnumMatch(r.paymentStatus, EXHIBITOR_PAYMENT_STATUSES);
          if (!matchedPay) {
            errors.push(`paymentStatus: Must be Fully Paid, Partially Paid, or Pending (got "${r.paymentStatus}")`);
          } else {
            paymentStatus = matchedPay as Exhibitor['paymentStatus'];
          }
        }
      }

      const regDate = String(r.registrationDate || '').trim();
      if (regDate && !ISO_DATE_REGEX.test(regDate)) {
        errors.push(`registrationDate: Must be YYYY-MM-DD (got "${regDate}")`);
      }

      // Deterministic Duplicate Detection
      const regKey = normalizeMatchKey(regNumber);
      const emailKey = normalizeMatchKey(email);
      const nameEdKey = `${normalizeMatchKey(companyName)}|${normalizeMatchKey(editionId)}`;

      let duplicateReason: string | undefined;
      if (regKey && seenReg.has(regKey)) {
        duplicateReason = `Matches ${seenReg.get(regKey)}`;
      } else if (emailKey && seenEmail.has(emailKey)) {
        duplicateReason = `Matches ${seenEmail.get(emailKey)}`;
      } else if (companyName && seenNameEd.has(nameEdKey)) {
        duplicateReason = `Matches ${seenNameEd.get(nameEdKey)}`;
      }

      const isDuplicate = Boolean(duplicateReason);
      const normalizedRecord: Exhibitor = {
        id: String(r.id || `exh-${Date.now()}-${rowIndex}-${Math.random().toString(36).slice(2, 6)}`),
        companyName,
        regNumber: regNumber || `ZW-${Date.now().toString().slice(-4)}-${rowIndex}`,
        businessDescription: String(r.businessDescription || r.description || 'Imported enterprise record').trim(),
        industry: String(r.industry || sector || 'General Trade').trim(),
        sector: sector || 'General Trade',
        country: country || 'Zimbabwe',
        provinceCity: String(r.provinceCity || 'Bulawayo').trim(),
        contactPerson: String(r.contactPerson || 'Principal Representative').trim(),
        email,
        phone: phone || '+263 292 000 000',
        website: website || 'https://zitf.co.zw',
        productsServices: parseListField(r.productsServices, ['Exhibition Display']),
        editionId,
        hallStand: String(r.hallStand || 'Hall 2').trim(),
        standSizeSqm,
        category,
        registrationDate: regDate || todayIso,
        bookingStatus: 'Confirmed',
        paymentStatus,
        returningStatus: String(r.returningStatus || '').toLowerCase() === 'returning' ? 'Returning' : 'New',
        satisfactionScore,
        participationHistory: [Number(editionId.replace(/\D/g, '')) || 2026],
        isDemo: false,
      };

      previewRows.push({
        rowIndex,
        data: rawRow,
        normalizedData: normalizedRecord,
        errors,
        warnings,
        isDuplicate,
        duplicateReason,
      });

      if (errors.length > 0) {
        rejectedRows.push({ rowIndex, errors, data: rawRow });
      } else if (isDuplicate && skipDuplicates) {
        duplicateRows.push({ rowIndex, reason: duplicateReason!, data: rawRow });
      } else {
        if (regKey) seenReg.set(regKey, `earlier CSV row #${rowIndex} regNumber "${regNumber}"`);
        if (emailKey) seenEmail.set(emailKey, `earlier CSV row #${rowIndex} email "${email}"`);
        if (companyName) seenNameEd.set(nameEdKey, `earlier CSV row #${rowIndex} exhibitor "${companyName}"`);
        validPayloads.push(normalizedRecord);
      }
    });
  } else if (targetModule === 'visitors') {
    const existingList = existingStore.visitors || [];
    const seenEmail = new Map<string, string>();
    const seenRef = new Map<string, string>();
    const seenNameOrgEd = new Map<string, string>();

    existingList.forEach((v) => {
      const em = normalizeMatchKey(v.email);
      const rf = normalizeMatchKey(v.visitorRef);
      const no = `${normalizeMatchKey(v.fullName)}|${normalizeMatchKey(v.organization)}|${normalizeMatchKey(v.editionId)}`;
      if (em) seenEmail.set(em, `existing DB email "${v.email}"`);
      if (rf) seenRef.set(rf, `existing DB visitorRef "${v.visitorRef}"`);
      if (v.fullName && v.organization) seenNameOrgEd.set(no, `existing DB visitor "${v.fullName}" at "${v.organization}"`);
    });

    rawRecords.forEach((rawRow, idx) => {
      const rowIndex = idx + 1;
      const r = canonicalizeRowKeys(rawRow);
      const errors: string[] = [];
      const warnings: string[] = [];

      const fullName = String(r.fullName || '').trim();
      const country = String(r.country || '').trim();
      const email = String(r.email || '').trim();
      const visitorRef = String(r.visitorRef || '').trim();
      const organization = String(r.organization || 'Independent Trade Delegate').trim();
      const phone = String(r.phone || '').trim();
      const editionId = String(r.editionId || activeEdId).trim() || activeEdId;

      if (!fullName || fullName.length < 2) errors.push('fullName: Required (min 2 characters)');
      if (!country) errors.push('country: Required');
      if (!email) {
        errors.push('email: Required');
      } else if (!EMAIL_REGEX.test(email)) {
        errors.push(`email: Invalid format "${email}"`);
      }

      if (phone) {
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 6) errors.push('phone: Must contain at least 6 digits');
      }

      let category: Visitor['category'] = 'Business Visitors';
      if (r.category) {
        const matchedCat = normalizeEnumMatch(r.category, VISITOR_CATEGORIES);
        if (!matchedCat) {
          errors.push(`category: Unrecognized visitor category "${r.category}"`);
        } else {
          category = matchedCat as Visitor['category'];
        }
      }

      const rateParsed = parseStrictNumber(r.feedbackRating);
      let feedbackRating = 4.6;
      if (rateParsed.present) {
        if (!rateParsed.valid || rateParsed.num < 1 || rateParsed.num > 5) {
          errors.push('feedbackRating: Must be a number between 1.0 and 5.0');
        } else {
          feedbackRating = Number(rateParsed.num.toFixed(1));
        }
      }

      const emailKey = normalizeMatchKey(email);
      const refKey = normalizeMatchKey(visitorRef);
      const nameOrgKey = `${normalizeMatchKey(fullName)}|${normalizeMatchKey(organization)}|${normalizeMatchKey(editionId)}`;

      let duplicateReason: string | undefined;
      if (refKey && seenRef.has(refKey)) {
        duplicateReason = `Matches ${seenRef.get(refKey)}`;
      } else if (emailKey && seenEmail.has(emailKey)) {
        duplicateReason = `Matches ${seenEmail.get(emailKey)}`;
      } else if (fullName && organization && seenNameOrgEd.has(nameOrgKey)) {
        duplicateReason = `Matches ${seenNameOrgEd.get(nameOrgKey)}`;
      }

      const isDuplicate = Boolean(duplicateReason);
      const normalizedRecord: Visitor = {
        id: String(r.id || `vis-${Date.now()}-${rowIndex}-${Math.random().toString(36).slice(2, 6)}`),
        visitorRef: visitorRef || `VR-${Date.now().toString().slice(-4)}-${rowIndex}`,
        fullName,
        category,
        country: country || 'Zimbabwe',
        cityProvince: String(r.cityProvince || 'Bulawayo').trim(),
        organization,
        industry: String(r.industry || 'Trade & Commerce').trim(),
        email,
        phone: phone || '+263 770 000 000',
        registrationDate: String(r.registrationDate || todayIso).trim(),
        editionId,
        attendanceDays: parseListField(r.attendanceDays, ['Day 1 - 21 Apr']),
        interests: parseListField(r.interests, ['General Trade']),
        areasVisited: parseListField(r.areasVisited, ['Hall 1', 'Hall 2']),
        feedbackRating,
        repeatVisitor: String(r.repeatVisitor || '').toLowerCase() === 'true' || r.repeatVisitor === true,
        isDemo: false,
      };

      previewRows.push({
        rowIndex,
        data: rawRow,
        normalizedData: normalizedRecord,
        errors,
        warnings,
        isDuplicate,
        duplicateReason,
      });

      if (errors.length > 0) {
        rejectedRows.push({ rowIndex, errors, data: rawRow });
      } else if (isDuplicate && skipDuplicates) {
        duplicateRows.push({ rowIndex, reason: duplicateReason!, data: rawRow });
      } else {
        if (refKey) seenRef.set(refKey, `earlier CSV row #${rowIndex} visitorRef "${visitorRef}"`);
        if (emailKey) seenEmail.set(emailKey, `earlier CSV row #${rowIndex} email "${email}"`);
        if (fullName && organization) seenNameOrgEd.set(nameOrgKey, `earlier CSV row #${rowIndex} "${fullName}"`);
        validPayloads.push(normalizedRecord);
      }
    });
  } else if (targetModule === 'commercial') {
    const existingList = existingStore.transactions || [];
    const seenRef = new Map<string, string>();
    const seenFp = new Map<string, string>();

    existingList.forEach((t) => {
      const rf = normalizeMatchKey(t.refNumber);
      const fp = `${normalizeMatchKey(t.clientName)}|${normalizeMatchKey(t.type)}|${Number(t.amountUsd)}|${normalizeMatchKey(t.editionId)}`;
      if (rf) seenRef.set(rf, `existing DB invoice ref "${t.refNumber}"`);
      seenFp.set(fp, `existing DB invoice (${t.clientName}, ${t.type}, $${t.amountUsd})`);
    });

    rawRecords.forEach((rawRow, idx) => {
      const rowIndex = idx + 1;
      const r = canonicalizeRowKeys(rawRow);
      const errors: string[] = [];
      const warnings: string[] = [];

      const clientName = String(r.clientName || '').trim();
      const refNumber = String(r.refNumber || '').trim();
      const editionId = String(r.editionId || activeEdId).trim() || activeEdId;

      if (!clientName || clientName.length < 2) {
        errors.push('clientName: Required (min 2 characters)');
      }

      const amtParsed = parseStrictNumber(r.amountUsd);
      let amountUsd = 0;
      if (!amtParsed.present) {
        errors.push('amountUsd: Required numeric value > 0');
      } else if (!amtParsed.valid || amtParsed.num <= 0) {
        errors.push(`amountUsd: Must be a positive number > 0 (got "${r.amountUsd}")`);
      } else {
        amountUsd = amtParsed.num;
      }

      const outParsed = parseStrictNumber(r.outstandingBalanceUsd);
      let outstandingBalanceUsd = 0;
      if (outParsed.present) {
        if (!outParsed.valid || outParsed.num < 0) {
          errors.push(`outstandingBalanceUsd: Cannot be negative (got "${r.outstandingBalanceUsd}")`);
        } else if (amtParsed.valid && outParsed.num > amtParsed.num) {
          errors.push(`outstandingBalanceUsd ($${outParsed.num}) cannot exceed amountUsd ($${amtParsed.num})`);
        } else {
          outstandingBalanceUsd = outParsed.num;
        }
      }

      let txType: CommercialTransaction['type'] = 'Exhibition Hall Space';
      if (r.type) {
        const matchedType = normalizeEnumMatch(r.type, REVENUE_STREAM_TYPES);
        if (!matchedType) {
          errors.push(`type: Unrecognized revenue stream "${r.type}"`);
        } else {
          txType = matchedType as CommercialTransaction['type'];
        }
      }

      let txStatus: CommercialTransaction['status'] = outstandingBalanceUsd > 0 ? 'Deposit Paid' : 'Fully Paid';
      if (r.status) {
        const matchedStatus = normalizeEnumMatch(r.status, TRANSACTION_STATUSES);
        if (!matchedStatus) {
          errors.push(`status: Invalid status "${r.status}"`);
        } else {
          txStatus = matchedStatus as CommercialTransaction['status'];
        }
      }

      if (txStatus === 'Fully Paid' && outstandingBalanceUsd > 0) {
        errors.push('status vs outstandingBalanceUsd: "Fully Paid" invoice cannot have outstanding balance > 0');
      }

      const payDate = String(r.paymentDate || '').trim();
      if (payDate && !ISO_DATE_REGEX.test(payDate)) {
        errors.push(`paymentDate: Must be YYYY-MM-DD (got "${payDate}")`);
      }

      const refKey = normalizeMatchKey(refNumber);
      const fpKey = `${normalizeMatchKey(clientName)}|${normalizeMatchKey(txType)}|${amountUsd}|${normalizeMatchKey(editionId)}`;

      let duplicateReason: string | undefined;
      if (refKey && seenRef.has(refKey)) {
        duplicateReason = `Matches ${seenRef.get(refKey)}`;
      } else if (clientName && amountUsd > 0 && seenFp.has(fpKey)) {
        duplicateReason = `Matches ${seenFp.get(fpKey)}`;
      }

      const isDuplicate = Boolean(duplicateReason);
      const normalizedRecord: CommercialTransaction = {
        id: String(r.id || `tx-${Date.now()}-${rowIndex}-${Math.random().toString(36).slice(2, 6)}`),
        refNumber: refNumber || `INV-${Date.now().toString().slice(-4)}-${rowIndex}`,
        type: txType,
        clientName,
        amountUsd,
        outstandingBalanceUsd,
        editionId,
        status: txStatus,
        paymentDate: payDate || todayIso,
        sector: String(r.sector || 'General Commercial').trim(),
        notes: String(r.notes || 'Imported via Governed Data Pipeline').trim(),
        isDemo: false,
      };

      previewRows.push({
        rowIndex,
        data: rawRow,
        normalizedData: normalizedRecord,
        errors,
        warnings,
        isDuplicate,
        duplicateReason,
      });

      if (errors.length > 0) {
        rejectedRows.push({ rowIndex, errors, data: rawRow });
      } else if (isDuplicate && skipDuplicates) {
        duplicateRows.push({ rowIndex, reason: duplicateReason!, data: rawRow });
      } else {
        if (refKey) seenRef.set(refKey, `earlier CSV row #${rowIndex} invoice "${refNumber}"`);
        if (clientName && amountUsd > 0) seenFp.set(fpKey, `earlier CSV row #${rowIndex} invoice for "${clientName}"`);
        validPayloads.push(normalizedRecord);
      }
    });
  } else if (targetModule === 'trade') {
    const existingList = existingStore.tradeEngagements || [];
    const seenRef = new Map<string, string>();
    const seenPairs = new Map<string, string>();

    existingList.forEach((te) => {
      const rf = normalizeMatchKey(te.refNumber);
      const pk = `${normalizeMatchKey(te.buyerOrg)}|${normalizeMatchKey(te.supplierOrg)}|${normalizeMatchKey(te.opportunityType)}|${normalizeMatchKey(te.editionId)}`;
      if (rf) seenRef.set(rf, `existing DB ref "${te.refNumber}"`);
      seenPairs.set(pk, `existing DB B2B match (${te.buyerOrg} -> ${te.supplierOrg})`);
    });

    rawRecords.forEach((rawRow, idx) => {
      const rowIndex = idx + 1;
      const r = canonicalizeRowKeys(rawRow);
      const errors: string[] = [];
      const warnings: string[] = [];

      const buyerOrg = String(r.buyerOrg || '').trim();
      const supplierOrg = String(r.supplierOrg || '').trim();
      const refNumber = String(r.refNumber || '').trim();
      const editionId = String(r.editionId || activeEdId).trim() || activeEdId;

      if (!buyerOrg || buyerOrg.length < 2) errors.push('buyerOrg: Required (min 2 characters)');
      if (!supplierOrg || supplierOrg.length < 2) errors.push('supplierOrg: Required (min 2 characters)');
      if (buyerOrg && supplierOrg && normalizeMatchKey(buyerOrg) === normalizeMatchKey(supplierOrg)) {
        errors.push('buyerOrg vs supplierOrg: Buyer and Supplier organizations cannot be identical');
      }

      const valParsed = parseStrictNumber(r.estimatedValueUsd);
      let estimatedValueUsd = 0;
      if (!valParsed.present) {
        errors.push('estimatedValueUsd: Required numeric value >= 0');
      } else if (!valParsed.valid || valParsed.num < 0) {
        errors.push(`estimatedValueUsd: Must be >= 0 (got "${r.estimatedValueUsd}")`);
      } else {
        estimatedValueUsd = valParsed.num;
      }

      let opportunityType: TradeEngagement['opportunityType'] = 'Supply Contract';
      if (r.opportunityType) {
        const matchedOpp = normalizeEnumMatch(r.opportunityType, TRADE_OPPORTUNITY_TYPES);
        if (!matchedOpp) {
          errors.push(`opportunityType: Invalid type "${r.opportunityType}"`);
        } else {
          opportunityType = matchedOpp as TradeEngagement['opportunityType'];
        }
      }

      let engagementStatus: TradeEngagement['engagementStatus'] = 'Contact Established';
      if (r.engagementStatus) {
        const matchedSt = normalizeEnumMatch(r.engagementStatus, TRADE_ENGAGEMENT_STATUSES);
        if (!matchedSt) {
          errors.push(`engagementStatus: Invalid status "${r.engagementStatus}"`);
        } else {
          engagementStatus = matchedSt as TradeEngagement['engagementStatus'];
        }
      }

      let verificationStatus: TradeEngagement['verificationStatus'] = 'Facilitated Opportunity';
      if (r.verificationStatus) {
        const matchedVer = normalizeEnumMatch(r.verificationStatus, TRADE_VERIFICATION_STATUSES);
        if (!matchedVer) {
          errors.push(`verificationStatus: Invalid tier "${r.verificationStatus}"`);
        } else {
          verificationStatus = matchedVer as TradeEngagement['verificationStatus'];
        }
      }

      const followUpDate = String(r.followUpDate || '').trim();
      if (followUpDate && !ISO_DATE_REGEX.test(followUpDate)) {
        errors.push(`followUpDate: Must be YYYY-MM-DD (got "${followUpDate}")`);
      }

      const refKey = normalizeMatchKey(refNumber);
      const pairKey = `${normalizeMatchKey(buyerOrg)}|${normalizeMatchKey(supplierOrg)}|${normalizeMatchKey(opportunityType)}|${normalizeMatchKey(editionId)}`;

      let duplicateReason: string | undefined;
      if (refKey && seenRef.has(refKey)) {
        duplicateReason = `Matches ${seenRef.get(refKey)}`;
      } else if (buyerOrg && supplierOrg && seenPairs.has(pairKey)) {
        duplicateReason = `Matches ${seenPairs.get(pairKey)}`;
      }

      const isDuplicate = Boolean(duplicateReason);
      const normalizedRecord: TradeEngagement = {
        id: String(r.id || `trd-${Date.now()}-${rowIndex}-${Math.random().toString(36).slice(2, 6)}`),
        refNumber: refNumber || `TE-${Date.now().toString().slice(-4)}-${rowIndex}`,
        editionId,
        date: String(r.date || todayIso).trim(),
        buyerOrg,
        buyerCountry: String(r.buyerCountry || 'Zimbabwe').trim(),
        supplierOrg,
        supplierCountry: String(r.supplierCountry || 'Zimbabwe').trim(),
        industry: String(r.industry || 'Trade').trim(),
        opportunityType,
        description: String(r.description || 'Imported B2B engagement').trim(),
        estimatedValueUsd,
        engagementStatus,
        followUpDate: followUpDate || '2026-05-30',
        outcome: String(r.outcome || 'Logged via Governed B2B Import').trim(),
        verificationStatus,
        isDemo: false,
      };

      previewRows.push({
        rowIndex,
        data: rawRow,
        normalizedData: normalizedRecord,
        errors,
        warnings,
        isDuplicate,
        duplicateReason,
      });

      if (errors.length > 0) {
        rejectedRows.push({ rowIndex, errors, data: rawRow });
      } else if (isDuplicate && skipDuplicates) {
        duplicateRows.push({ rowIndex, reason: duplicateReason!, data: rawRow });
      } else {
        if (refKey) seenRef.set(refKey, `earlier CSV row #${rowIndex} ref "${refNumber}"`);
        if (buyerOrg && supplierOrg) seenPairs.set(pairKey, `earlier CSV row #${rowIndex} (${buyerOrg} -> ${supplierOrg})`);
        validPayloads.push(normalizedRecord);
      }
    });
  }

  return {
    previewRows,
    validPayloads,
    rejectedRows,
    duplicateRows,
    summary: {
      totalRows: rawRecords.length,
      validNewCount: previewRows.filter((r) => r.errors.length === 0 && !r.isDuplicate).length,
      duplicateCount: previewRows.filter((r) => r.errors.length === 0 && r.isDuplicate).length,
      errorCount: rejectedRows.length,
    },
  };
}

// Single-record server/API enforcement guard for POST /api/warehouse/:entity
export function validateSingleEntityRecord(entity: string, item: Record<string, any>): string[] {
  const errors: string[] = [];
  if (!item || typeof item !== 'object') {
    return ['Payload must be a JSON object'];
  }

  if (entity === 'exhibitors') {
    if (!String(item.companyName || '').trim()) errors.push('companyName is required');
    const em = String(item.email || '').trim();
    if (em && !EMAIL_REGEX.test(em)) errors.push('invalid email format');
    const sqm = Number(item.standSizeSqm);
    if (!Number.isFinite(sqm) || sqm <= 0 || sqm > 50000) errors.push('standSizeSqm must be > 0 and <= 50,000');
  } else if (entity === 'visitors') {
    if (!String(item.fullName || '').trim()) errors.push('fullName is required');
    const em = String(item.email || '').trim();
    if (em && !EMAIL_REGEX.test(em)) errors.push('invalid email format');
  } else if (entity === 'transactions') {
    if (!String(item.clientName || '').trim()) errors.push('clientName is required');
    const amt = Number(item.amountUsd);
    const out = Number(item.outstandingBalanceUsd ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) errors.push('amountUsd must be > 0');
    if (!Number.isFinite(out) || out < 0 || out > amt) errors.push('outstandingBalanceUsd must be between 0 and amountUsd');
  } else if (entity === 'tradeEngagements') {
    if (!String(item.buyerOrg || '').trim()) errors.push('buyerOrg is required');
    if (!String(item.supplierOrg || '').trim()) errors.push('supplierOrg is required');
    const val = Number(item.estimatedValueUsd);
    if (!Number.isFinite(val) || val < 0) errors.push('estimatedValueUsd must be >= 0');
  }

  return errors;
}
