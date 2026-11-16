import { UserRole } from '../types';

export type RbacPermission =
  | 'dashboard:view'
  | 'exhibitors_visitors:read'
  | 'exhibitors_visitors:write'
  | 'commercial:read'
  | 'commercial:write'
  | 'trade:read'
  | 'trade:write'
  | 'trade:verify'
  | 'operations:read'
  | 'operations:write'
  | 'market:read'
  | 'market:write'
  | 'mining:read'
  | 'reports:read'
  | 'reports:write'
  | 'alerts_schedules:write'
  | 'data_management:access'
  | 'collaboration:read'
  | 'collaboration:write'
  | 'collaboration:approve'
  | 'users:read'
  | 'users:manage'
  | 'system:admin';

export interface RolePolicySummary {
  role: UserRole;
  executiveDashboard: boolean;
  exhibitorsVisitors: 'Full CRUD' | 'View Only' | 'None';
  commercialFinance: 'Full Invoicing' | 'View Aggregates' | 'Restricted';
  tradeDealVerification: boolean;
  reportGeneration: boolean;
  systemAdmin: boolean;
  permissions: RbacPermission[];
}

export const ROLE_POLICIES: Record<UserRole, RolePolicySummary> = {
  'Super Administrator': {
    role: 'Super Administrator',
    executiveDashboard: true,
    exhibitorsVisitors: 'Full CRUD',
    commercialFinance: 'Full Invoicing',
    tradeDealVerification: true,
    reportGeneration: true,
    systemAdmin: true,
    permissions: [
      'dashboard:view',
      'exhibitors_visitors:read',
      'exhibitors_visitors:write',
      'commercial:read',
      'commercial:write',
      'trade:read',
      'trade:write',
      'trade:verify',
      'operations:read',
      'operations:write',
      'market:read',
      'market:write',
      'mining:read',
      'reports:read',
      'reports:write',
      'alerts_schedules:write',
      'data_management:access',
      'collaboration:read',
      'collaboration:write',
      'collaboration:approve',
      'users:read',
      'users:manage',
      'system:admin',
    ],
  },
  'Executive Management': {
    role: 'Executive Management',
    executiveDashboard: true,
    exhibitorsVisitors: 'Full CRUD',
    commercialFinance: 'Full Invoicing',
    tradeDealVerification: true,
    reportGeneration: true,
    systemAdmin: false,
    permissions: [
      'dashboard:view',
      'exhibitors_visitors:read',
      'exhibitors_visitors:write',
      'commercial:read',
      'commercial:write',
      'trade:read',
      'trade:write',
      'trade:verify',
      'operations:read',
      'operations:write',
      'market:read',
      'market:write',
      'mining:read',
      'reports:read',
      'reports:write',
      'alerts_schedules:write',
      'data_management:access',
      'collaboration:read',
      'collaboration:write',
      'collaboration:approve',
      'users:read',
    ],
  },
  'Department Manager': {
    role: 'Department Manager',
    executiveDashboard: true,
    exhibitorsVisitors: 'Full CRUD',
    commercialFinance: 'Full Invoicing',
    tradeDealVerification: true,
    reportGeneration: true,
    systemAdmin: false,
    permissions: [
      'dashboard:view',
      'exhibitors_visitors:read',
      'exhibitors_visitors:write',
      'commercial:read',
      'commercial:write',
      'trade:read',
      'trade:write',
      'trade:verify',
      'operations:read',
      'operations:write',
      'market:read',
      'market:write',
      'mining:read',
      'reports:read',
      'reports:write',
      'alerts_schedules:write',
      'data_management:access',
      'collaboration:read',
      'collaboration:write',
      'collaboration:approve',
      'users:read',
    ],
  },
  'Data Analyst': {
    role: 'Data Analyst',
    executiveDashboard: true,
    exhibitorsVisitors: 'Full CRUD',
    commercialFinance: 'View Aggregates',
    tradeDealVerification: false,
    reportGeneration: true,
    systemAdmin: false,
    permissions: [
      'dashboard:view',
      'exhibitors_visitors:read',
      'exhibitors_visitors:write',
      'commercial:read',
      'trade:read',
      'trade:write',
      'operations:read',
      'operations:write',
      'market:read',
      'market:write',
      'mining:read',
      'reports:read',
      'reports:write',
      'alerts_schedules:write',
      'data_management:access',
      'collaboration:read',
      'collaboration:write',
      'users:read',
    ],
  },
  'Data Entry Officer': {
    role: 'Data Entry Officer',
    executiveDashboard: false,
    exhibitorsVisitors: 'Full CRUD',
    commercialFinance: 'Restricted',
    tradeDealVerification: false,
    reportGeneration: false,
    systemAdmin: false,
    permissions: [
      'exhibitors_visitors:read',
      'exhibitors_visitors:write',
      'trade:read',
      'trade:write',
      'operations:read',
      'operations:write',
      'market:read',
      'data_management:access',
      'collaboration:read',
      'collaboration:write',
      'users:read',
    ],
  },
  'External Stakeholder / Viewer': {
    role: 'External Stakeholder / Viewer',
    executiveDashboard: true,
    exhibitorsVisitors: 'View Only',
    commercialFinance: 'Restricted',
    tradeDealVerification: false,
    reportGeneration: true,
    systemAdmin: false,
    permissions: [
      'dashboard:view',
      'exhibitors_visitors:read',
      'trade:read',
      'operations:read',
      'market:read',
      'mining:read',
      'reports:read',
      'collaboration:read',
      'collaboration:write',
      'users:read',
    ],
  },
};

export function hasPermission(role: UserRole | undefined | null, permission: RbacPermission): boolean {
  if (!role) return false;
  const policy = ROLE_POLICIES[role];
  if (!policy) return false;
  return policy.permissions.includes(permission);
}

export function getRolePermissions(role: UserRole): RbacPermission[] {
  return ROLE_POLICIES[role]?.permissions || [];
}

export function canAccessNavTab(role: UserRole | undefined | null, tabId: string): boolean {
  if (!role) return false;
  switch (tabId) {
    case 'overview':
      return hasPermission(role, 'dashboard:view');
    case 'mining':
      return hasPermission(role, 'mining:read');
    case 'exhibitors':
    case 'visitors':
      return hasPermission(role, 'exhibitors_visitors:read');
    case 'commercial':
      return hasPermission(role, 'commercial:read');
    case 'trade':
      return hasPermission(role, 'trade:read');
    case 'operations':
      return hasPermission(role, 'operations:read');
    case 'market':
      return hasPermission(role, 'market:read');
    case 'reports':
      return hasPermission(role, 'reports:read');
    case 'collaborate':
      return hasPermission(role, 'collaboration:read');
    case 'data':
      return hasPermission(role, 'data_management:access');
    case 'users':
      return hasPermission(role, 'users:manage') || role === 'Executive Management';
    case 'settings':
      return hasPermission(role, 'system:admin') || role === 'Executive Management';
    default:
      return true;
  }
}

export function getDefaultTabForRole(role: UserRole): string {
  if (hasPermission(role, 'dashboard:view')) return 'overview';
  if (hasPermission(role, 'exhibitors_visitors:read')) return 'exhibitors';
  return 'collaborate';
}
