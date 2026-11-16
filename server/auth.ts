import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { ActiveSessionInfo, UserProfile, UserRole } from '../src/types/index.ts';
import { getRolePermissions, hasPermission, type RbacPermission } from '../src/utils/rbac.ts';

export const DEFAULT_UAT_PASSWORD = process.env.ZITF_DEFAULT_PASSWORD || 'Zitf@2026!';
const SESSION_TTL_HOURS = 24;

export const VALID_USER_ROLES: UserRole[] = [
  'Super Administrator',
  'Executive Management',
  'Department Manager',
  'Data Analyst',
  'Data Entry Officer',
  'External Stakeholder / Viewer',
];

export interface AuthenticatedSession {
  sessionId: string;
  user: UserProfile;
  impersonatedByUserId?: string;
  permissions: RbacPermission[];
  expiresAt: string;
}

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  if (!storedHash || !storedSalt) return false;
  const derived = crypto.scryptSync(password, storedSalt, 64);
  const storedBuf = Buffer.from(storedHash, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function ensureAuthTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_credentials (
      userId TEXT PRIMARY KEY,
      passwordHash TEXT NOT NULL,
      passwordSalt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      tokenHash TEXT UNIQUE NOT NULL,
      userId TEXT NOT NULL,
      impersonatedByUserId TEXT,
      createdAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      revokedAt TEXT
    );
  `);
}

export function ensureUserCredential(db: DatabaseSync, userId: string, plainPassword = DEFAULT_UAT_PASSWORD) {
  const existing = db.prepare(`SELECT userId FROM user_credentials WHERE userId = ?`).get(userId) as
    | { userId: string }
    | undefined;
  if (existing) return;

  const { hash, salt } = hashPassword(plainPassword);
  db.prepare(
    `INSERT OR REPLACE INTO user_credentials (userId, passwordHash, passwordSalt, updatedAt) VALUES (?, ?, ?, ?)`
  ).run(userId, hash, salt, new Date().toISOString());
}

export function seedAllUserCredentials(db: DatabaseSync) {
  ensureAuthTables(db);
  const users = db.prepare(`SELECT id FROM users`).all() as { id: string }[];
  for (const u of users) {
    ensureUserCredential(db, u.id, DEFAULT_UAT_PASSWORD);
  }
}

export function setUserPassword(db: DatabaseSync, userId: string, newPassword: string) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  ensureAuthTables(db);
  const { hash, salt } = hashPassword(newPassword);
  db.prepare(
    `INSERT OR REPLACE INTO user_credentials (userId, passwordHash, passwordSalt, updatedAt) VALUES (?, ?, ?, ?)`
  ).run(userId, hash, salt, new Date().toISOString());
}

export function createSessionForUser(
  db: DatabaseSync,
  userId: string,
  impersonatedByUserId?: string
): { rawToken: string; expiresAt: string; sessionId: string } {
  ensureAuthTables(db);
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const sessionId = `sess-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  db.prepare(
    `INSERT INTO user_sessions (id, tokenHash, userId, impersonatedByUserId, createdAt, expiresAt, revokedAt)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`
  ).run(sessionId, tokenHash, userId, impersonatedByUserId ?? null, now.toISOString(), expiresAt);

  const nowStr = now.toISOString().replace('T', ' ').substring(0, 16);
  db.prepare(`UPDATE users SET lastLogin = ? WHERE id = ?`).run(nowStr, userId);

  return { rawToken, expiresAt, sessionId };
}

export function authenticateCredentials(
  db: DatabaseSync,
  email: string,
  password: string
): { user: UserProfile; rawToken: string; expiresAt: string; permissions: RbacPermission[] } {
  ensureAuthTables(db);
  const cleanEmail = email.trim().toLowerCase();
  const userRow = db
    .prepare(`SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1`)
    .get(cleanEmail) as any | undefined;

  if (!userRow) {
    throw new Error('Invalid email address or password.');
  }
  if (!userRow.isActive) {
    throw new Error('This account has been deactivated by an administrator.');
  }

  ensureUserCredential(db, userRow.id, DEFAULT_UAT_PASSWORD);
  const cred = db
    .prepare(`SELECT passwordHash, passwordSalt FROM user_credentials WHERE userId = ?`)
    .get(userRow.id) as { passwordHash: string; passwordSalt: string } | undefined;

  if (!cred || !verifyPassword(password, cred.passwordHash, cred.passwordSalt)) {
    throw new Error('Invalid email address or password.');
  }

  const { rawToken, expiresAt } = createSessionForUser(db, userRow.id);
  const updatedRow = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userRow.id) as any;
  const user: UserProfile = {
    id: updatedRow.id,
    name: updatedRow.name,
    email: updatedRow.email,
    role: updatedRow.role as UserRole,
    department: updatedRow.department,
    isActive: Boolean(updatedRow.isActive),
    lastLogin: updatedRow.lastLogin,
  };

  return {
    user,
    rawToken,
    expiresAt,
    permissions: getRolePermissions(user.role),
  };
}

export function resolveSessionToken(db: DatabaseSync, rawToken?: string | null): AuthenticatedSession | null {
  if (!rawToken || typeof rawToken !== 'string') return null;
  ensureAuthTables(db);
  const tokenHash = hashToken(rawToken.trim());
  const sess = db
    .prepare(`SELECT * FROM user_sessions WHERE tokenHash = ? LIMIT 1`)
    .get(tokenHash) as any | undefined;

  if (!sess || sess.revokedAt) return null;
  if (Date.parse(sess.expiresAt) <= Date.now()) return null;

  const userRow = db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(sess.userId) as any | undefined;
  if (!userRow || !userRow.isActive) return null;

  const user: UserProfile = {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    role: userRow.role as UserRole,
    department: userRow.department,
    isActive: Boolean(userRow.isActive),
    lastLogin: userRow.lastLogin,
  };

  return {
    sessionId: sess.id,
    user,
    impersonatedByUserId: sess.impersonatedByUserId || undefined,
    permissions: getRolePermissions(user.role),
    expiresAt: sess.expiresAt,
  };
}

export function listActiveSessions(db: DatabaseSync, currentSessionId?: string): ActiveSessionInfo[] {
  ensureAuthTables(db);
  const nowIso = new Date().toISOString();
  const rows = db
    .prepare(
      `SELECT s.id AS sessionId, s.userId, s.impersonatedByUserId, s.createdAt, s.expiresAt,
              u.name AS userName, u.email AS userEmail, u.role AS userRole, u.department AS department,
              imp.name AS impersonatedByName
       FROM user_sessions s
       INNER JOIN users u ON u.id = s.userId
       LEFT JOIN users imp ON imp.id = s.impersonatedByUserId
       WHERE s.revokedAt IS NULL AND s.expiresAt > ? AND u.isActive = 1
       ORDER BY s.createdAt DESC`
    )
    .all(nowIso) as any[];

  return rows.map((r) => ({
    sessionId: r.sessionId,
    userId: r.userId,
    userName: r.userName,
    userEmail: r.userEmail,
    userRole: r.userRole as UserRole,
    department: r.department,
    impersonatedByUserId: r.impersonatedByUserId || undefined,
    impersonatedByName: r.impersonatedByName || undefined,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    isCurrentSession: Boolean(currentSessionId && r.sessionId === currentSessionId),
  }));
}

export function revokeSessionById(
  db: DatabaseSync,
  sessionId: string
): { revoked: boolean; userId?: string } {
  ensureAuthTables(db);
  const row = db
    .prepare(`SELECT id, userId, revokedAt FROM user_sessions WHERE id = ? LIMIT 1`)
    .get(sessionId) as { id: string; userId: string; revokedAt: string | null } | undefined;
  if (!row || row.revokedAt) {
    return { revoked: false };
  }
  db.prepare(`UPDATE user_sessions SET revokedAt = ? WHERE id = ?`).run(
    new Date().toISOString(),
    sessionId
  );
  return { revoked: true, userId: row.userId };
}

export function revokeSessionToken(db: DatabaseSync, rawToken: string) {
  ensureAuthTables(db);
  const tokenHash = hashToken(rawToken.trim());
  db.prepare(`UPDATE user_sessions SET revokedAt = ? WHERE tokenHash = ?`).run(
    new Date().toISOString(),
    tokenHash
  );
}

export function revokeAllUserSessions(db: DatabaseSync, userId: string) {
  ensureAuthTables(db);
  db.prepare(`UPDATE user_sessions SET revokedAt = ? WHERE userId = ? AND revokedAt IS NULL`).run(
    new Date().toISOString(),
    userId
  );
}

export function validateUserPayload(
  db: DatabaseSync,
  input: Record<string, any>,
  options: { targetUserId?: string; currentActorId?: string; isPatch?: boolean } = {}
): { ok: boolean; error?: string; normalized?: Record<string, any> } {
  const existing = options.targetUserId
    ? (db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(options.targetUserId) as any | undefined)
    : undefined;

  if (options.isPatch && !existing) {
    return { ok: false, error: `User account ${options.targetUserId} not found.` };
  }

  const name = typeof input.name === 'string' ? input.name.trim() : existing?.name || '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : existing?.email?.toLowerCase() || '';
  const role = (typeof input.role === 'string' ? input.role : existing?.role || '') as UserRole;
  const department = typeof input.department === 'string' ? input.department.trim() : existing?.department || '';
  const isActive = input.isActive !== undefined ? Boolean(input.isActive) : existing ? Boolean(existing.isActive) : true;

  if (!name || name.length < 2) {
    return { ok: false, error: 'Full name must be at least 2 characters.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Please provide a valid corporate email address.' };
  }
  if (!VALID_USER_ROLES.includes(role)) {
    return { ok: false, error: `Invalid institutional role '${role}'.` };
  }
  if (!department) {
    return { ok: false, error: 'Department assignment is required.' };
  }
  if (typeof input.password === 'string' && input.password.trim().length > 0 && input.password.trim().length < 6) {
    return { ok: false, error: 'Initial password must be at least 6 characters long.' };
  }

  const checkId = options.targetUserId || input.id || '';
  const emailCollision = db
    .prepare(`SELECT id FROM users WHERE LOWER(email) = ? AND id != ? LIMIT 1`)
    .get(email, checkId) as { id: string } | undefined;
  if (emailCollision) {
    return { ok: false, error: `A user account with email '${email}' already exists.` };
  }

  // Self-protection & last Super Administrator guard
  if (options.currentActorId && checkId === options.currentActorId) {
    if (!isActive) {
      return { ok: false, error: 'You cannot deactivate your own active administrator account.' };
    }
    if (existing?.role === 'Super Administrator' && role !== 'Super Administrator') {
      return { ok: false, error: 'You cannot remove your own Super Administrator role while signed in.' };
    }
  }

  if (existing?.role === 'Super Administrator' && (role !== 'Super Administrator' || !isActive)) {
    const otherActiveAdmins = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM users WHERE role = 'Super Administrator' AND isActive = 1 AND id != ?`
      )
      .get(checkId) as { cnt: number };
    if ((otherActiveAdmins?.cnt || 0) === 0) {
      return {
        ok: false,
        error: 'At least one active Super Administrator account must remain enabled.',
      };
    }
  }

  return {
    ok: true,
    normalized: {
      ...input,
      name,
      email,
      role,
      department,
      isActive,
    },
  };
}

export function parseSessionCookie(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key === 'zitf_session' && val) {
      return decodeURIComponent(val);
    }
  }
  return null;
}

export function checkEntityWriteAuthorization(
  role: UserRole,
  entity: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  payload?: any
): { allowed: boolean; reason?: string } {
  switch (entity) {
    case 'users':
    case 'editions':
      return hasPermission(role, 'system:admin') || hasPermission(role, 'users:manage')
        ? { allowed: true }
        : { allowed: false, reason: `Role '${role}' is not authorized to modify ${entity}. Super Administrator required.` };

    case 'transactions':
      return hasPermission(role, 'commercial:write')
        ? { allowed: true }
        : { allowed: false, reason: `Role '${role}' cannot create, update, or delete Commercial Financial records.` };

    case 'exhibitors':
    case 'visitors':
      return hasPermission(role, 'exhibitors_visitors:write')
        ? { allowed: true }
        : { allowed: false, reason: `Role '${role}' has View Only access to ${entity}.` };

    case 'tradeEngagements':
      if (!hasPermission(role, 'trade:write')) {
        return { allowed: false, reason: `Role '${role}' cannot modify Trade Impact records.` };
      }
      if (payload?.verificationStatus === 'Independently Verified' && !hasPermission(role, 'trade:verify')) {
        return {
          allowed: false,
          reason: `Role '${role}' is not authorized to mark deals as Independently Verified.`,
        };
      }
      return { allowed: true };

    case 'incidents':
      return hasPermission(role, 'operations:write')
        ? { allowed: true }
        : { allowed: false, reason: `Role '${role}' cannot modify Operational Incidents.` };

    case 'marketInsights':
      return hasPermission(role, 'market:write')
        ? { allowed: true }
        : { allowed: false, reason: `Role '${role}' cannot publish Market Insights.` };

    case 'reports':
      return hasPermission(role, 'reports:write')
        ? { allowed: true }
        : { allowed: false, reason: `Role '${role}' cannot generate or modify BI Reports.` };

    case 'alertRules':
    case 'alertEvents':
    case 'scheduledReports':
      return hasPermission(role, 'alerts_schedules:write')
        ? { allowed: true }
        : { allowed: false, reason: `Role '${role}' cannot modify Threshold Alerts or Scheduled Reports.` };

    case 'connectors':
    case 'connectorLogs':
      return hasPermission(role, 'data_management:access') && hasPermission(role, 'exhibitors_visitors:write')
        ? { allowed: true }
        : { allowed: false, reason: `Role '${role}' cannot configure External Data Connectors.` };

    case 'auditLogs':
      return method === 'POST'
        ? { allowed: true }
        : { allowed: false, reason: 'Audit logs are immutable and cannot be modified or deleted.' };

    case 'sharedItems':
    case 'annotations':
    case 'emailDispatches':
      return hasPermission(role, 'collaboration:write')
        ? { allowed: true }
        : { allowed: false, reason: `Role '${role}' cannot modify collaboration records.` };

    default:
      return hasPermission(role, 'system:admin')
        ? { allowed: true }
        : { allowed: false, reason: `Unauthorized access to entity '${entity}'.` };
  }
}
