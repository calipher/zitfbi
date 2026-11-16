import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import {
  getWarehouseDb,
  getWarehouseState,
  getWarehouseStateForRole,
  getWarehouseStats,
  clearWarehouseDemoData,
  resetWarehouseToDemoData,
  upsertEntity,
  batchUpsertEntity,
  deleteEntity,
  patchEntity,
  governedBatchImport,
  evaluateWarehouseAlerts,
  acknowledgeOrResolveAlertEvent,
  executeScheduledReportNow,
  processDueScheduledReports,
  createSharedBrief,
  updateSharedWorkflow,
  createAnnotationComment,
  updateAnnotationStatus,
  dispatchEmailBrief,
  getUserPreferences,
  saveUserPreferences,
  saveStorageObject,
  listStorageObjects,
  readStorageObjectFile,
  deleteStorageObject,
  recordClientErrorLog,
  listClientErrorLogs,
  queryWarehouseEntity,
  getStorageDiagnostics,
  optimizeWarehouseDatabase,
} from './server/warehouse.ts';
import {
  type AuthenticatedSession,
  authenticateCredentials,
  checkEntityWriteAuthorization,
  createSessionForUser,
  listActiveSessions,
  parseSessionCookie,
  resolveSessionToken,
  revokeAllUserSessions,
  revokeSessionById,
  revokeSessionToken,
  setUserPassword,
  validateUserPayload,
  verifyPassword,
} from './server/auth.ts';
import { getRolePermissions, hasPermission, type RbacPermission } from './src/utils/rbac.ts';
import { runDataMiningSuite } from './src/utils/dataMiningEngine.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Initialize centralized server-side SQLite warehouse on boot
getWarehouseDb();

app.use(express.json({ limit: '15mb' }));

// Lightweight Gzip response compression for API JSON payloads >= 1 KB
app.use('/api', (req, res, next) => {
  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  if (!acceptEncoding.includes('gzip') || req.path.includes('/download')) {
    return next();
  }
  const origJson = res.json.bind(res);
  res.json = ((body: any) => {
    try {
      const jsonStr = JSON.stringify(body);
      const rawBuf = Buffer.from(jsonStr, 'utf8');
      if (rawBuf.byteLength >= 1024 && !res.headersSent) {
        const zipped = zlib.gzipSync(rawBuf, { level: zlib.constants.Z_BEST_SPEED });
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Content-Length', String(zipped.byteLength));
        return res.send(zipped);
      }
    } catch {
      // fall back to uncompressed json
    }
    return origJson(body);
  }) as any;
  return next();
});

// ==========================================
// Authentication & RBAC Middleware Helpers
// ==========================================
declare global {
  namespace Express {
    interface Request {
      authSession?: AuthenticatedSession;
      authToken?: string;
    }
  }
}

function getRequestToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  return parseSessionCookie(req.headers.cookie);
}

function setSessionCookie(res: express.Response, token: string) {
  res.setHeader(
    'Set-Cookie',
    `zitf_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${24 * 60 * 60}`
  );
}

function clearSessionCookie(res: express.Response) {
  res.setHeader(
    'Set-Cookie',
    `zitf_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
  );
}

function recordSecurityAudit(
  userEmail: string,
  userRole: any,
  action: string,
  module: string,
  details: string
) {
  try {
    upsertEntity('auditLogs', {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userEmail,
      userRole,
      action,
      module,
      details,
    });
  } catch {
    // non-fatal audit failure
  }
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = getRequestToken(req);
  const session = resolveSessionToken(getWarehouseDb(), token);
  if (!session) {
    return res.status(401).json({
      ok: false,
      code: 'UNAUTHENTICATED',
      error: 'Authentication required. Please sign in with valid ZITF credentials.',
    });
  }
  req.authSession = session;
  req.authToken = token || undefined;
  return next();
}

function sendForbidden(res: express.Response, session: AuthenticatedSession, action: string, reason: string) {
  recordSecurityAudit(
    session.user.email,
    session.user.role,
    'RBAC Access Denied (403)',
    'Security & RBAC',
    `${action}: ${reason}`
  );
  return res.status(403).json({
    ok: false,
    code: 'FORBIDDEN',
    role: session.user.role,
    error: reason,
  });
}

function requirePermission(permission: RbacPermission, actionLabel?: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const session = req.authSession;
    if (!session) {
      return res.status(401).json({ ok: false, code: 'UNAUTHENTICATED', error: 'Authentication required.' });
    }
    if (!hasPermission(session.user.role, permission)) {
      return sendForbidden(
        res,
        session,
        actionLabel || `${req.method} ${req.path}`,
        `Role '${session.user.role}' lacks required permission '${permission}'.`
      );
    }
    return next();
  };
}

// Health check endpoint (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), warehouse: getWarehouseStats().engine });
});

// Authenticated runtime Google Maps Platform config (reads provisioned env secret without hardcoding)
app.get('/api/maps/config', requireAuth, (_req, res) => {
  const apiKey = (process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();
  res.json({ ok: true, apiKeyConfigured: Boolean(apiKey), apiKey });
});

// ==========================================
// Real Cryptographic Authentication API
// ==========================================
app.post('/api/auth/login', (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email address and password are required.' });
    }

    const db = getWarehouseDb();
    const result = authenticateCredentials(db, email, password);
    setSessionCookie(res, result.rawToken);
    recordSecurityAudit(
      result.user.email,
      result.user.role,
      'User Sign In',
      'Security & Authentication',
      `Authenticated session issued for ${result.user.name} (${result.user.role}).`
    );

    return res.json({
      ok: true,
      token: result.rawToken,
      user: result.user,
      permissions: result.permissions,
      expiresAt: result.expiresAt,
    });
  } catch (err: any) {
    return res.status(401).json({
      ok: false,
      code: 'INVALID_CREDENTIALS',
      error: err?.message || 'Invalid email address or password.',
    });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = getRequestToken(req);
  const db = getWarehouseDb();
  const session = resolveSessionToken(db, token);
  if (token) {
    revokeSessionToken(db, token);
  }
  clearSessionCookie(res);
  if (session) {
    recordSecurityAudit(
      session.user.email,
      session.user.role,
      'User Sign Out',
      'Security & Authentication',
      `Session terminated for ${session.user.name}.`
    );
  }
  return res.json({ ok: true });
});

app.get('/api/auth/session', (req, res) => {
  const token = getRequestToken(req);
  const session = resolveSessionToken(getWarehouseDb(), token);
  if (!session) {
    return res.status(401).json({ ok: false, authenticated: false, error: 'No active session.' });
  }
  return res.json({
    ok: true,
    authenticated: true,
    token,
    user: session.user,
    permissions: session.permissions,
    impersonatedByUserId: session.impersonatedByUserId || null,
    expiresAt: session.expiresAt,
  });
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  try {
    const session = req.authSession!;
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: 'Current password and new password are required.' });
    }

    const db = getWarehouseDb();
    const cred = db
      .prepare(`SELECT passwordHash, passwordSalt FROM user_credentials WHERE userId = ?`)
      .get(session.user.id) as { passwordHash: string; passwordSalt: string } | undefined;

    if (!cred || !verifyPassword(currentPassword, cred.passwordHash, cred.passwordSalt)) {
      return res.status(400).json({ ok: false, error: 'Current password is incorrect.' });
    }

    setUserPassword(db, session.user.id, newPassword);
    recordSecurityAudit(
      session.user.email,
      session.user.role,
      'Password Changed',
      'Security & Authentication',
      `User ${session.user.email} updated their account password.`
    );
    return res.json({ ok: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err?.message || 'Failed to update password.' });
  }
});

app.post('/api/auth/impersonate', requireAuth, (req, res) => {
  const session = req.authSession!;
  const db = getWarehouseDb();

  // Only an active Super Administrator OR a session that was initiated by a Super Administrator can switch/return
  let adminRootUser: any = null;
  if (session.user.role === 'Super Administrator') {
    adminRootUser = session.user;
  } else if (session.impersonatedByUserId) {
    const row = db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(session.impersonatedByUserId) as any;
    if (row && row.isActive && row.role === 'Super Administrator') {
      adminRootUser = row;
    }
  }

  if (!adminRootUser) {
    return sendForbidden(
      res,
      session,
      'POST /api/auth/impersonate',
      'Only Super Administrators can initiate or switch impersonated user sessions.'
    );
  }

  const targetUserId = req.body?.userId;
  const returningToAdmin = !targetUserId || targetUserId === adminRootUser.id;
  const resolvedTargetId = returningToAdmin ? adminRootUser.id : String(targetUserId);

  const targetRow = db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(resolvedTargetId) as any;
  if (!targetRow) {
    return res.status(404).json({ ok: false, error: 'Target user account not found.' });
  }
  if (!targetRow.isActive) {
    return res.status(400).json({ ok: false, error: 'Cannot impersonate a deactivated user account.' });
  }

  // Revoke previous token cleanly
  if (req.authToken) {
    revokeSessionToken(db, req.authToken);
  }

  const impersonatorId = returningToAdmin ? undefined : adminRootUser.id;
  const { rawToken, expiresAt } = createSessionForUser(db, targetRow.id, impersonatorId);
  const targetUser = {
    id: targetRow.id,
    name: targetRow.name,
    email: targetRow.email,
    role: targetRow.role,
    department: targetRow.department,
    isActive: Boolean(targetRow.isActive),
    lastLogin: targetRow.lastLogin,
  };

  setSessionCookie(res, rawToken);
  recordSecurityAudit(
    adminRootUser.email,
    'Super Administrator',
    returningToAdmin ? 'End Impersonation' : 'Admin Impersonation',
    'Security & RBAC',
    returningToAdmin
      ? `Returned to Super Administrator session (${adminRootUser.email}).`
      : `Super Administrator (${adminRootUser.email}) started RBAC test session as ${targetUser.name} (${targetUser.role}).`
  );

  return res.json({
    ok: true,
    token: rawToken,
    user: targetUser,
    permissions: getRolePermissions(targetUser.role),
    impersonatedByUserId: impersonatorId || null,
    expiresAt,
  });
});

app.post('/api/auth/users/:id/reset-password', requireAuth, requirePermission('users:manage', 'Reset User Password'), (req, res) => {
  try {
    const session = req.authSession!;
    const { id } = req.params;
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const db = getWarehouseDb();
    const targetUser = db.prepare(`SELECT id, email, name FROM users WHERE id = ?`).get(id) as any;
    if (!targetUser) {
      return res.status(404).json({ ok: false, error: 'User account not found.' });
    }
    setUserPassword(db, id, newPassword);
    if (req.body?.revokeSessions !== false) {
      revokeAllUserSessions(db, id);
    }
    recordSecurityAudit(
      session.user.email,
      session.user.role,
      'Admin Password Reset',
      'User Management',
      `Reset password for ${targetUser.name} (${targetUser.email}).`
    );
    return res.json({ ok: true, message: `Password reset for ${targetUser.email}.` });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err?.message || 'Failed to reset user password.' });
  }
});

app.post('/api/auth/users/:id/revoke-sessions', requireAuth, requirePermission('users:manage', 'Revoke User Sessions'), (req, res) => {
  const session = req.authSession!;
  const { id } = req.params;
  const db = getWarehouseDb();
  const targetUser = db.prepare(`SELECT id, email, name FROM users WHERE id = ?`).get(id) as any;
  if (!targetUser) {
    return res.status(404).json({ ok: false, error: 'User account not found.' });
  }
  revokeAllUserSessions(db, id);
  recordSecurityAudit(
    session.user.email,
    session.user.role,
    'Revoke User Sessions',
    'User Management',
    `Revoked all active sessions for ${targetUser.name} (${targetUser.email}).`
  );
  return res.json({ ok: true, message: `All active sessions revoked for ${targetUser.email}.` });
});

app.get('/api/auth/sessions', requireAuth, (req, res) => {
  const session = req.authSession!;
  if (!hasPermission(session.user.role, 'users:manage') && !hasPermission(session.user.role, 'users:read')) {
    return sendForbidden(
      res,
      session,
      'GET /api/auth/sessions',
      'Not authorized to inspect active SQLite sessions.'
    );
  }
  const sessions = listActiveSessions(getWarehouseDb(), session.sessionId);
  return res.json({ ok: true, sessions });
});

app.post('/api/auth/sessions/:sessionId/revoke', requireAuth, requirePermission('users:manage', 'Revoke Active Session'), (req, res) => {
  const session = req.authSession!;
  const { sessionId } = req.params;
  if (sessionId === session.sessionId) {
    return res.status(400).json({ ok: false, error: 'Use Sign Out to end your own active session.' });
  }
  const db = getWarehouseDb();
  const result = revokeSessionById(db, sessionId);
  if (!result.revoked) {
    return res.status(404).json({ ok: false, error: 'Active session not found or already revoked.' });
  }
  recordSecurityAudit(
    session.user.email,
    session.user.role,
    'Revoke Single Session',
    'User Management',
    `Terminated SQLite session ${sessionId} for user ${result.userId}.`
  );
  return res.json({ ok: true, message: 'Session revoked successfully.' });
});

// ==========================================
// Centralized SQLite Data Warehouse API (RBAC-Protected)
// ==========================================
app.get('/api/warehouse/state', requireAuth, (req, res) => {
  try {
    const session = req.authSession!;
    res.json(getWarehouseStateForRole(session.user.role));
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read warehouse state' });
  }
});

app.get('/api/warehouse/stats', requireAuth, (_req, res) => {
  try {
    res.json(getWarehouseStats());
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read warehouse stats' });
  }
});

app.get('/api/warehouse/query/:entity', requireAuth, (req, res) => {
  try {
    const session = req.authSession!;
    const result = queryWarehouseEntity({
      entity: req.params.entity,
      editionId: typeof req.query.editionId === 'string' ? req.query.editionId : undefined,
      sector: typeof req.query.sector === 'string' ? req.query.sector : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
      role: session.user.role,
    });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to query warehouse entity' });
  }
});

// ==========================================
// Scalable Server Workspace Preferences & Object Storage API
// ==========================================
app.get('/api/storage/preferences', requireAuth, (req, res) => {
  try {
    const session = req.authSession!;
    res.json({ ok: true, preferences: getUserPreferences(session.user.id) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to load server preferences' });
  }
});

app.put('/api/storage/preferences', requireAuth, (req, res) => {
  try {
    const session = req.authSession!;
    const prefs = saveUserPreferences(session.user.id, req.body || {});
    res.json({ ok: true, preferences: prefs });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to save server preferences' });
  }
});

app.get('/api/storage/objects', requireAuth, (req, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    res.json({ ok: true, objects: listStorageObjects(category) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to list storage objects' });
  }
});

app.post('/api/storage/objects', requireAuth, (req, res) => {
  try {
    const session = req.authSession!;
    const role = session.user.role;
    const allowed =
      hasPermission(role, 'data_management:access') ||
      hasPermission(role, 'exhibitors_visitors:write') ||
      hasPermission(role, 'reports:write') ||
      hasPermission(role, 'system:admin');
    if (!allowed) {
      return sendForbidden(
        res,
        session,
        'POST /api/storage/objects',
        `Role '${role}' is not authorized to archive files in server object storage.`
      );
    }

    const body = req.body || {};
    if (!body.filename) {
      return res.status(400).json({ ok: false, error: 'filename is required.' });
    }
    const category =
      body.category === 'upload-json' ||
      body.category === 'report-export' ||
      body.category === 'warehouse-snapshot'
        ? body.category
        : 'upload-csv';

    const record = saveStorageObject({
      category,
      filename: String(body.filename),
      mimeType: typeof body.mimeType === 'string' ? body.mimeType : undefined,
      textContent: typeof body.textContent === 'string' ? body.textContent : undefined,
      contentBase64: typeof body.contentBase64 === 'string' ? body.contentBase64 : undefined,
      uploadedByEmail: session.user.email,
      uploadedByRole: session.user.role,
      moduleRef: typeof body.moduleRef === 'string' ? body.moduleRef : undefined,
    });

    recordSecurityAudit(
      session.user.email,
      session.user.role,
      'Archive Server Object',
      'Platform Storage',
      `Archived "${record.filename}" (${record.sizeBytes} bytes, SHA-256 ${record.sha256.slice(0, 12)}) in server disk store.`
    );

    res.status(201).json({ ok: true, object: record });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to store file in server object store' });
  }
});

app.get('/api/storage/objects/:id/download', requireAuth, (req, res) => {
  try {
    const item = readStorageObjectFile(req.params.id);
    if (!item) {
      return res.status(404).json({ ok: false, error: 'Stored object not found on server disk.' });
    }
    res.setHeader('Content-Type', item.record.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${item.record.filename}"`);
    res.setHeader('X-Content-SHA256', item.record.sha256);
    return res.send(item.buffer);
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'Failed to download stored object' });
  }
});

app.delete('/api/storage/objects/:id', requireAuth, requirePermission('system:admin', 'Delete Server Object'), (req, res) => {
  try {
    const session = req.authSession!;
    const removed = deleteStorageObject(req.params.id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: 'Storage object not found.' });
    }
    recordSecurityAudit(
      session.user.email,
      session.user.role,
      'Delete Server Object',
      'Platform Storage',
      `Deleted server storage object ${req.params.id}.`
    );
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'Failed to delete stored object' });
  }
});

app.get('/api/storage/diagnostics', requireAuth, (_req, res) => {
  try {
    res.json({ ok: true, diagnostics: getStorageDiagnostics() });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to collect storage diagnostics' });
  }
});

app.post('/api/storage/optimize', requireAuth, requirePermission('system:admin', 'Optimize SQLite Warehouse'), (req, res) => {
  try {
    const session = req.authSession!;
    const result = optimizeWarehouseDatabase();
    recordSecurityAudit(
      session.user.email,
      session.user.role,
      'Optimize Warehouse DB',
      'Platform Reliability',
      `Executed WAL checkpoint(TRUNCATE), ANALYZE, and PRAGMA quick_check (${result.quickCheck}).`
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to optimize SQLite warehouse' });
  }
});

app.post('/api/system/client-errors', (req, res) => {
  try {
    const token = getRequestToken(req);
    const session = resolveSessionToken(getWarehouseDb(), token);
    const body = req.body || {};
    const entry = recordClientErrorLog({
      scope: body.scope === 'app' || body.scope === 'widget' ? body.scope : 'module',
      moduleName: String(body.moduleName || 'Unknown Module'),
      message: String(body.message || 'Unhandled React render exception'),
      stackPreview: typeof body.stackPreview === 'string' ? body.stackPreview : undefined,
      componentStackPreview:
        typeof body.componentStackPreview === 'string' ? body.componentStackPreview : undefined,
      userEmail: session?.user.email || (typeof body.userEmail === 'string' ? body.userEmail : undefined),
      userRole: session?.user.role || (typeof body.userRole === 'string' ? body.userRole : undefined),
      urlPath: typeof body.urlPath === 'string' ? body.urlPath : undefined,
    });
    res.status(201).json({ ok: true, log: entry });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to record client error log' });
  }
});

app.get('/api/system/client-errors', requireAuth, requirePermission('system:admin', 'View Client Error Logs'), (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    res.json({ ok: true, logs: listClientErrorLogs(limit) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to read client error logs' });
  }
});

app.get('/api/analytics/mining', requireAuth, requirePermission('mining:read', 'Data Mining Analytics'), (req, res) => {
  try {
    const session = req.authSession!;
    const state = getWarehouseStateForRole(session.user.role);
    const editionId = typeof req.query.editionId === 'string' ? req.query.editionId : 'all';
    const sector = typeof req.query.sector === 'string' ? req.query.sector : 'all';
    const kClusters = Math.max(2, Math.min(4, Number(req.query.k) || 3));
    const anomalyZThreshold = Math.max(1.2, Math.min(4.0, Number(req.query.z) || 2.0));

    const matchEd = (ed: string) => editionId === 'all' || ed === editionId;
    const matchSec = (sec: string) => sector === 'all' || sec === sector;

    const scopedExhibitors = state.exhibitors.filter((e) => matchEd(e.editionId) && matchSec(e.sector));
    const scopedVisitors = state.visitors.filter((v) => matchEd(v.editionId) && matchSec(v.industry));
    const scopedTransactions = state.transactions.filter((t) => matchEd(t.editionId) && matchSec(t.sector));
    const scopedTradeEngagements = state.tradeEngagements.filter((t) => matchEd(t.editionId) && matchSec(t.industry));

    const result = runDataMiningSuite(
      {
        editions: state.editions,
        exhibitors: state.exhibitors,
        visitors: state.visitors,
        transactions: state.transactions,
        tradeEngagements: state.tradeEngagements,
        hallUtilisation: state.hallUtilisation,
        scopedExhibitors,
        scopedVisitors,
        scopedTransactions,
        scopedTradeEngagements,
      },
      { kClusters, anomalyZThreshold }
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to execute data mining suite' });
  }
});

app.post('/api/warehouse/clear-demo', requireAuth, requirePermission('system:admin', 'Clear Demo Data'), (_req, res) => {
  try {
    clearWarehouseDemoData();
    res.json({ ok: true, stats: getWarehouseStats() });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to clear demo data' });
  }
});

app.post('/api/warehouse/reset', requireAuth, requirePermission('system:admin', 'Reset Warehouse Demo Data'), (req, res) => {
  try {
    const session = req.authSession!;
    resetWarehouseToDemoData();
    res.json({ ok: true, ...getWarehouseStateForRole(session.user.role) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to reset warehouse' });
  }
});

app.post('/api/warehouse/import/:targetModule', requireAuth, (req, res) => {
  try {
    const session = req.authSession!;
    const role = session.user.role;
    const targetModule = req.params.targetModule as any;

    if (!hasPermission(role, 'data_management:access')) {
      return sendForbidden(
        res,
        session,
        `Import -> ${targetModule}`,
        `Role '${role}' does not have Data Management import access.`
      );
    }

    const moduleWritePermMap: Record<string, RbacPermission> = {
      exhibitors: 'exhibitors_visitors:write',
      visitors: 'exhibitors_visitors:write',
      commercial: 'commercial:write',
      trade: 'trade:write',
    };
    const requiredPerm = moduleWritePermMap[targetModule];
    if (!requiredPerm || !hasPermission(role, requiredPerm)) {
      return sendForbidden(
        res,
        session,
        `Import -> ${targetModule}`,
        `Role '${role}' is not authorized to import records into '${targetModule}'.`
      );
    }

    const records = Array.isArray(req.body?.records)
      ? req.body.records
      : Array.isArray(req.body)
      ? req.body
      : [];
    const skipDuplicates = req.body?.skipDuplicates ?? true;
    const defaultEditionId = req.body?.defaultEditionId || 'zitf-2026';

    const result = governedBatchImport(targetModule, records, {
      skipDuplicates,
      defaultEditionId,
      userEmail: session.user.email,
      userRole: session.user.role,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Governed batch import failed' });
  }
});

app.post('/api/warehouse/batch/:entity', requireAuth, (req, res) => {
  try {
    const session = req.authSession!;
    const { entity } = req.params;
    const authCheck = checkEntityWriteAuthorization(session.user.role, entity, 'POST', req.body);
    if (!authCheck.allowed) {
      return sendForbidden(res, session, `POST /api/warehouse/batch/${entity}`, authCheck.reason || 'Forbidden');
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : Array.isArray(req.body) ? req.body : [];
    const governedEntityMap: Record<string, 'exhibitors' | 'visitors' | 'commercial' | 'trade'> = {
      exhibitors: 'exhibitors',
      visitors: 'visitors',
      transactions: 'commercial',
      tradeEngagements: 'trade',
    };
    const mod = governedEntityMap[entity];
    if (mod) {
      const result = governedBatchImport(mod, items, {
        skipDuplicates: req.body?.skipDuplicates ?? true,
        defaultEditionId: req.body?.defaultEditionId,
        userEmail: session.user.email,
        userRole: session.user.role,
      });
      return res.json({
        ok: true,
        count: result.successCount,
        duplicateCount: result.duplicateCount,
        errorCount: result.errorCount,
        stats: result.stats,
      });
    }
    batchUpsertEntity(entity, items);
    res.json({ ok: true, count: items.length, stats: getWarehouseStats() });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Batch warehouse write failed' });
  }
});

app.post('/api/warehouse/:entity', requireAuth, (req, res) => {
  try {
    const session = req.authSession!;
    const { entity } = req.params;
    const authCheck = checkEntityWriteAuthorization(session.user.role, entity, 'POST', req.body);
    if (!authCheck.allowed) {
      return sendForbidden(res, session, `POST /api/warehouse/${entity}`, authCheck.reason || 'Forbidden');
    }
    let payload =
      entity === 'auditLogs'
        ? { ...req.body, userEmail: session.user.email, userRole: session.user.role }
        : req.body;
    if (entity === 'users') {
      const check = validateUserPayload(getWarehouseDb(), payload, {
        currentActorId: session.user.id,
        isPatch: false,
      });
      if (!check.ok || !check.normalized) {
        return res.status(400).json({ ok: false, error: check.error || 'Invalid user payload.' });
      }
      payload = check.normalized;
    }
    upsertEntity(entity, payload);
    res.status(201).json({ ok: true, stats: getWarehouseStats() });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Warehouse upsert failed' });
  }
});

app.patch('/api/warehouse/:entity/:id', requireAuth, (req, res) => {
  try {
    const session = req.authSession!;
    const { entity, id } = req.params;
    const authCheck = checkEntityWriteAuthorization(session.user.role, entity, 'PATCH', req.body);
    if (!authCheck.allowed) {
      return sendForbidden(res, session, `PATCH /api/warehouse/${entity}/${id}`, authCheck.reason || 'Forbidden');
    }
    let updates = req.body || {};
    if (entity === 'users') {
      const check = validateUserPayload(getWarehouseDb(), updates, {
        targetUserId: id,
        currentActorId: session.user.id,
        isPatch: true,
      });
      if (!check.ok || !check.normalized) {
        return res.status(400).json({ ok: false, error: check.error || 'Invalid user update.' });
      }
      updates = check.normalized;
    }
    const updated = patchEntity(entity, id, updates);
    res.json({ ok: true, item: updated, stats: getWarehouseStats() });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Warehouse patch failed' });
  }
});

app.delete('/api/warehouse/:entity/:id', requireAuth, (req, res) => {
  try {
    const session = req.authSession!;
    const { entity, id } = req.params;
    const authCheck = checkEntityWriteAuthorization(session.user.role, entity, 'DELETE');
    if (!authCheck.allowed) {
      return sendForbidden(res, session, `DELETE /api/warehouse/${entity}/${id}`, authCheck.reason || 'Forbidden');
    }
    if (entity === 'users') {
      if (id === session.user.id) {
        return res.status(400).json({ ok: false, error: 'You cannot delete your own active administrator account.' });
      }
      const db = getWarehouseDb();
      const target = db.prepare(`SELECT role, isActive FROM users WHERE id = ? LIMIT 1`).get(id) as
        | { role: string; isActive: number }
        | undefined;
      if (target && target.role === 'Super Administrator' && target.isActive) {
        const remaining = db
          .prepare(
            `SELECT COUNT(*) AS cnt FROM users WHERE role = 'Super Administrator' AND isActive = 1 AND id != ?`
          )
          .get(id) as { cnt: number };
        if ((remaining?.cnt || 0) === 0) {
          return res
            .status(400)
            .json({ ok: false, error: 'Cannot delete the last active Super Administrator account.' });
        }
      }
    }
    deleteEntity(entity, id);
    res.json({ ok: true, stats: getWarehouseStats() });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Warehouse delete failed' });
  }
});

// ==========================================
// Threshold Alerts & Scheduled Reports API
// ==========================================
app.post('/api/alerts/evaluate', requireAuth, requirePermission('alerts_schedules:write', 'Evaluate Threshold Alerts'), (req, res) => {
  try {
    const session = req.authSession!;
    res.json(evaluateWarehouseAlerts(session.user.email));
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to evaluate threshold alerts' });
  }
});

app.post('/api/alerts/events/:id/status', requireAuth, requirePermission('alerts_schedules:write', 'Update Alert Status'), (req, res) => {
  try {
    const session = req.authSession!;
    const { id } = req.params;
    const status = req.body?.status;
    if (status !== 'Acknowledged' && status !== 'Resolved' && status !== 'Active') {
      return res.status(400).json({ ok: false, error: 'Status must be Active, Acknowledged, or Resolved' });
    }
    res.json(acknowledgeOrResolveAlertEvent(id, status, session.user.name));
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to update alert status' });
  }
});

app.post('/api/reports/schedules/run-due', requireAuth, requirePermission('alerts_schedules:write', 'Execute Due Report Schedules'), (_req, res) => {
  try {
    res.json(processDueScheduledReports());
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to process due scheduled reports' });
  }
});

app.post('/api/reports/schedules/:id/run', requireAuth, requirePermission('alerts_schedules:write', 'Execute Scheduled Report'), (req, res) => {
  try {
    const session = req.authSession!;
    const { id } = req.params;
    res.json(executeScheduledReportNow(id, session.user.email));
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to execute scheduled report' });
  }
});

// ==========================================
// Share & Collaborate, Annotations & Email Dispatch API
// ==========================================
app.post('/api/collaboration/share', requireAuth, requirePermission('collaboration:write', 'Create Shared Brief'), async (req, res) => {
  try {
    const session = req.authSession!;
    const body = req.body || {};
    if (!body.targetType || !body.targetId || !body.title) {
      return res.status(400).json({ ok: false, error: 'targetType, targetId, and title are required.' });
    }
    const recipients: string[] = Array.isArray(body.recipientEmails)
      ? body.recipientEmails
      : typeof body.recipientEmails === 'string'
      ? body.recipientEmails.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const sharedItem = createSharedBrief({
      targetType: body.targetType,
      targetId: body.targetId,
      title: body.title,
      editionId: body.editionId || 'zitf-2026',
      sharedByName: session.user.name,
      sharedByEmail: session.user.email,
      sharedByRole: session.user.role,
      recipientEmails: recipients,
      recipientRoles: Array.isArray(body.recipientRoles) ? body.recipientRoles : [],
      accessLevel: body.accessLevel || 'Comment & Annotate',
      note: body.note || '',
      snapshotSummary: body.snapshotSummary,
    });

    const origin =
      typeof body.origin === 'string' && body.origin.startsWith('http')
        ? body.origin
        : `${req.protocol}://${req.get('host')}`;
    const shareUrl = `${origin}/?share=${encodeURIComponent(sharedItem.shareToken)}`;

    let emailResult: any = undefined;
    if (body.sendEmail && recipients.length > 0) {
      const emailBody = [
        `${sharedItem.sharedByName} (${sharedItem.sharedByRole}) shared a ZITF Business Intelligence brief with you:`,
        '',
        `Title: ${sharedItem.title}`,
        `Access Level: ${sharedItem.accessLevel}`,
        `Workflow Status: ${sharedItem.workflowStatus}`,
        sharedItem.note ? `Note: ${sharedItem.note}` : '',
        sharedItem.snapshotSummary ? `\nSnapshot Summary:\n${sharedItem.snapshotSummary}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      emailResult = await dispatchEmailBrief({
        targetType: sharedItem.targetType,
        targetId: sharedItem.targetId,
        subject: `[ZITF BI] Shared ${sharedItem.targetType}: ${sharedItem.title}`,
        recipients,
        body: emailBody,
        shareUrl,
        senderName: sharedItem.sharedByName,
        senderEmail: sharedItem.sharedByEmail,
        senderRole: sharedItem.sharedByRole,
      });
    }

    res.status(201).json({
      ok: true,
      sharedItem,
      shareUrl,
      emailResult,
      stats: getWarehouseStats(),
    });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to create shared brief' });
  }
});

app.get('/api/collaboration/share/:token', requireAuth, (req, res) => {
  try {
    const token = decodeURIComponent(req.params.token).trim();
    const state = getWarehouseStateForRole(req.authSession!.user.role);
    const sharedItem = state.sharedItems.find(
      (s) => s.shareToken.toLowerCase() === token.toLowerCase() || s.id === token
    );
    if (!sharedItem) {
      return res.status(404).json({ ok: false, error: `Share token "${token}" was not found.` });
    }
    const relatedAnnotations = state.annotations.filter(
      (a) => a.targetType === sharedItem.targetType && a.targetId === sharedItem.targetId
    );
    const linkedReport =
      sharedItem.targetType === 'Report'
        ? state.reports.find((r) => r.id === sharedItem.targetId || r.reportNumber === sharedItem.targetId)
        : undefined;

    res.json({
      ok: true,
      sharedItem,
      annotations: relatedAnnotations,
      linkedReport,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to resolve share token' });
  }
});

app.post('/api/collaboration/shares/:id/workflow', requireAuth, (req, res) => {
  try {
    const session = req.authSession!;
    const { id } = req.params;
    const { workflowStatus } = req.body || {};
    const validStatuses = ['Shared', 'In Review', 'Changes Requested', 'Approved'];
    if (!validStatuses.includes(workflowStatus)) {
      return res.status(400).json({ ok: false, error: 'Invalid workflowStatus value.' });
    }
    if (
      (workflowStatus === 'Approved' || workflowStatus === 'Changes Requested') &&
      !hasPermission(session.user.role, 'collaboration:approve')
    ) {
      return sendForbidden(
        res,
        session,
        `Workflow -> ${workflowStatus}`,
        `Role '${session.user.role}' is not authorized to sign off or reject collaborative approvals.`
      );
    }
    if (!hasPermission(session.user.role, 'collaboration:write')) {
      return sendForbidden(
        res,
        session,
        `Workflow -> ${workflowStatus}`,
        `Role '${session.user.role}' cannot update collaboration workflows.`
      );
    }

    const updated = updateSharedWorkflow(
      id,
      workflowStatus,
      session.user.name,
      session.user.email,
      session.user.role
    );
    res.json({ ok: true, sharedItem: updated, stats: getWarehouseStats() });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to update workflow status' });
  }
});

app.post('/api/collaboration/comments', requireAuth, requirePermission('collaboration:write', 'Post Annotation'), (req, res) => {
  try {
    const session = req.authSession!;
    const body = req.body || {};
    if (!body.targetType || !body.targetId || !body.body || !String(body.body).trim()) {
      return res.status(400).json({ ok: false, error: 'targetType, targetId, and comment body are required.' });
    }
    const comment = createAnnotationComment({
      targetType: body.targetType,
      targetId: body.targetId,
      targetTitle: body.targetTitle || body.targetId,
      sectionTag: body.sectionTag || 'General',
      authorName: session.user.name,
      authorEmail: session.user.email,
      authorRole: session.user.role,
      body: String(body.body),
    });
    res.status(201).json({ ok: true, annotation: comment, stats: getWarehouseStats() });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to post annotation' });
  }
});

app.post('/api/collaboration/comments/:id/status', requireAuth, requirePermission('collaboration:write', 'Update Annotation Status'), (req, res) => {
  try {
    const session = req.authSession!;
    const { id } = req.params;
    const status = req.body?.status;
    if (status !== 'Open' && status !== 'Resolved') {
      return res.status(400).json({ ok: false, error: 'Status must be Open or Resolved.' });
    }
    const updated = updateAnnotationStatus(id, status, session.user.name);
    res.json({ ok: true, annotation: updated, stats: getWarehouseStats() });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to update annotation status' });
  }
});

app.post('/api/collaboration/email', requireAuth, requirePermission('collaboration:write', 'Dispatch Email Brief'), async (req, res) => {
  try {
    const session = req.authSession!;
    const body = req.body || {};
    const recipients: string[] = Array.isArray(body.recipients)
      ? body.recipients
      : typeof body.recipients === 'string'
      ? body.recipients.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    if (!body.subject || !body.body || recipients.length === 0) {
      return res.status(400).json({ ok: false, error: 'subject, recipients, and body are required.' });
    }

    const result = await dispatchEmailBrief({
      targetType: body.targetType || 'Report',
      targetId: body.targetId || 'custom-brief',
      subject: String(body.subject),
      recipients,
      body: String(body.body),
      shareUrl: body.shareUrl,
      senderName: session.user.name,
      senderEmail: session.user.email,
      senderRole: session.user.role,
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to dispatch email brief' });
  }
});

// AI Assistant endpoint: Ask ZITF Intelligence
app.post('/api/gemini/query', requireAuth, async (req, res) => {
  try {
    const session = req.authSession!;
    const { prompt, context, edition } = req.body;
    const userRole = session.user.role;
    const safeContext =
      hasPermission(userRole, 'commercial:read')
        ? context
        : {
            ...(context || {}),
            totalRevenueUsd: undefined,
            spaceSalesUsd: undefined,
            sponsorshipUsd: undefined,
            outstandingBalanceUsd: undefined,
            avgRevenuePerExhibitor: undefined,
            revenueDistribution: [],
            commercialNotice: 'Commercial financials redacted for current role.',
          };

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Provide intelligent rule-based response when API key is not configured
      const ruleBasedResponse = generateRuleBasedResponse(prompt, safeContext, edition, userRole);
      return res.json({
        answer: ruleBasedResponse.answer,
        isRuleBased: true,
        source: 'ZITF Rule-Based Intelligence Engine',
        supportingData: ruleBasedResponse.supportingData,
        period: edition || 'Current Active Edition',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `You are "Ask ZITF Intelligence", the senior Business Intelligence AI analyst for the Zimbabwe International Trade Fair (ZITF Company), located in Bulawayo, Zimbabwe.
Your role: Provide concise, executive-level trade intelligence, commercial performance analysis, exhibitor & visitor trends, and B2B trade outcome evaluations based strictly on the provided ZITF dataset.

Guidelines:
1. Base your answer directly on the provided ZITF data context.
2. Distinguish clearly between:
   - Facilitated opportunities vs. Reported participant transactions vs. Independently verified deals.
   - Actual figures vs. Estimates or forecasts.
3. If specific requested metrics are not present in the data, state clearly that records are unavailable rather than fabricating statistics.
4. Format responses cleanly with executive summaries, bullet points for key numbers, and strategic recommendations where relevant.
5. Currency is USD ($).
6. Respect the user's role: ${userRole || 'Executive Management'}. Confidential commercial margins or internal security specifics are summarized appropriately.`;

    const userContent = `User Role: ${userRole || 'Executive Management'}
Selected Exhibition Edition: ${edition || 'ZITF 2026 (66th Edition)'}
Current Aggregated Data Context:
${JSON.stringify(safeContext || {}, null, 2)}

User Question: "${prompt}"`;

    // Timeout protection: if external call takes longer than 5 seconds, fallback instantly
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI generation timed out')), 5000)
    );

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userContent,
      config: {
        systemInstruction,
      },
    });

    const response: any = await Promise.race([generatePromise, timeoutPromise]);
    const answer = response.text || 'No response generated.';

    return res.json({
      answer,
      isRuleBased: false,
      source: 'Gemini 3.8 Flash (Live ZITF Trade Intelligence Model)',
      period: edition || 'ZITF 2026',
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/query:', error);
    const role = req.authSession?.user.role;
    const rawCtx = req.body?.context || {};
    const fallbackSafeCtx = hasPermission(role, 'commercial:read')
      ? rawCtx
      : {
          ...rawCtx,
          totalRevenueUsd: undefined,
          spaceSalesUsd: undefined,
          sponsorshipUsd: undefined,
          outstandingBalanceUsd: undefined,
          avgRevenuePerExhibitor: undefined,
          revenueDistribution: [],
        };
    // Graceful fallback to rule-based engine on API error
    const fallback = generateRuleBasedResponse(req.body?.prompt || '', fallbackSafeCtx, req.body?.edition, role);
    return res.json({
      answer: fallback.answer,
      isRuleBased: true,
      notice: 'Served via local Trade Intelligence Engine due to external connectivity limits.',
      source: 'ZITF Rule-Based Intelligence Engine',
      supportingData: fallback.supportingData,
      period: req.body?.edition || 'Current Active Edition',
    });
  }
});

function generateRuleBasedResponse(prompt: string, context: any, edition?: string, userRole?: string) {
  const p = prompt.toLowerCase();
  const ed = edition || 'Active ZITF Edition';
  const ctx = context || {};

  const totalExhibitors = Number(ctx.totalExhibitors ?? 0);
  const intlExhibitors = Number(ctx.internationalExhibitors ?? 0);
  const localExhibitors = Math.max(0, totalExhibitors - intlExhibitors);
  const retention = ctx.retentionRate ?? 0;
  const totalVisitors = Number(ctx.totalVisitors ?? 0);
  const businessVisitors = Number(ctx.businessVisitors ?? 0);
  const publicVisitors = Math.max(0, totalVisitors - businessVisitors);
  const totalRevenueUsd = Number(ctx.totalRevenueUsd ?? 0);
  const spaceSalesUsd = Number(ctx.spaceSalesUsd ?? 0);
  const sponsorshipUsd = Number(ctx.sponsorshipUsd ?? 0);
  const outstandingBalanceUsd = Number(ctx.outstandingBalanceUsd ?? 0);
  const b2bMeetings = Number(ctx.b2bMeetingsCount ?? 0);
  const verifiedDealsUsd = Number(ctx.verifiedDealsUsd ?? 0);
  const reportedDealsUsd = Number(ctx.reportedDealsUsd ?? 0);
  const occupancyPct = Number(ctx.spaceOccupancyPct ?? 0);
  const uptimePct = Number(ctx.networkUptimePct ?? 0);
  const openIncidents = Number(ctx.openIncidentsCount ?? 0);

  const fmtUsd = (val: number) =>
    val >= 1_000_000
      ? `$${(val / 1_000_000).toFixed(2)}M`
      : val >= 1_000
      ? `$${(val / 1_000).toFixed(1)}k`
      : `$${val.toLocaleString()}`;

  if (p.includes('how many exhibitors') || p.includes('exhibitor count') || p.includes('number of exhibitors')) {
    const localPct = totalExhibitors > 0 ? ((localExhibitors / totalExhibitors) * 100).toFixed(1) : '0.0';
    const intlPct = totalExhibitors > 0 ? ((intlExhibitors / totalExhibitors) * 100).toFixed(1) : '0.0';
    return {
      answer: `In **${ed}**, the centralized warehouse contains **${totalExhibitors} registered exhibitors**.
- **Local Exhibitors:** ${localExhibitors} (${localPct}%)
- **International Exhibitors:** ${intlExhibitors} (${intlPct}%)
- **Returning Exhibitor Rate:** ${retention}%
- **Average Satisfaction Rating:** ${ctx.exhibitorSatisfaction ?? 0} / 5.0`,
      supportingData: { totalExhibitors, internationalExhibitors: intlExhibitors, localExhibitors, retentionRate: `${retention}%` },
    };
  }

  if (p.includes('revenue') || p.includes('commercial') || p.includes('highest revenue')) {
    const spaceShare = totalRevenueUsd > 0 ? ((spaceSalesUsd / totalRevenueUsd) * 100).toFixed(1) : '0.0';
    const sponsorShare = totalRevenueUsd > 0 ? ((sponsorshipUsd / totalRevenueUsd) * 100).toFixed(1) : '0.0';
    const outstandingShare = totalRevenueUsd > 0 ? ((outstandingBalanceUsd / totalRevenueUsd) * 100).toFixed(1) : '0.0';
    return {
      answer: `Commercial Performance Summary for **${ed}** (from SQLite Warehouse):
- **Total Invoiced Revenue:** **${fmtUsd(totalRevenueUsd)} USD**
- **Exhibition Hall Space Sales:** ${fmtUsd(spaceSalesUsd)} (${spaceShare}%)
- **Corporate Sponsorships:** ${fmtUsd(sponsorshipUsd)} (${sponsorShare}%)
- **Outstanding Receivables:** ${fmtUsd(outstandingBalanceUsd)} (${outstandingShare}% of invoiced total)
- **Average Revenue per Exhibitor:** $${Number(ctx.avgRevenuePerExhibitor ?? 0).toLocaleString()} USD`,
      supportingData: { totalRevenue: fmtUsd(totalRevenueUsd), spaceSales: fmtUsd(spaceSalesUsd), outstanding: fmtUsd(outstandingBalanceUsd) },
    };
  }

  if (p.includes('b2b') || p.includes('meeting') || p.includes('trade outcome') || p.includes('deals') || p.includes('opportunities')) {
    return {
      answer: `Trade Impact and Engagement Outcomes for **${ed}**:
- **Logged B2B Engagements:** **${b2bMeetings} records**
- **Independently Verified Contracts:** **${fmtUsd(verifiedDealsUsd)} USD**
- **Reported Participant Pipeline:** **${fmtUsd(reportedDealsUsd)} USD**
- **Facilitated Opportunities:** ${Number(ctx.facilitatedOppsCount ?? 0)} active leads`,
      supportingData: { b2bMeetings, reportedDealsUsd: fmtUsd(reportedDealsUsd), verifiedDealsUsd: fmtUsd(verifiedDealsUsd) },
    };
  }

  if (p.includes('visitor') || p.includes('attendance') || p.includes('interests')) {
    return {
      answer: `Visitor Attendance Summary for **${ed}**:
- **Total Registered Visitors:** **${totalVisitors.toLocaleString()}**
  - *Trade & Business Delegates:* **${businessVisitors.toLocaleString()}**
  - *Public & Student Visitors:* **${publicVisitors.toLocaleString()}**
- **Visitor Satisfaction Score:** **${ctx.visitorSatisfaction ?? 0} / 5.0**`,
      supportingData: { totalVisitors, businessVisitors, satisfaction: `${ctx.visitorSatisfaction ?? 0}/5.0` },
    };
  }

  if (p.includes('operational') || p.includes('hall') || p.includes('attention') || p.includes('challenges')) {
    return {
      answer: `Operational Intelligence Summary for **${ed}**:
- **Venue Space Occupancy:** **${occupancyPct}%** across monitored halls
- **ICT & Digital Infrastructure:** Average Wi-Fi uptime **${uptimePct}%**
- **Open Operational Incidents:** **${openIncidents}** currently active in the incident register`,
      supportingData: { occupancy: `${occupancyPct}%`, networkUptime: `${uptimePct}%`, openIncidents },
    };
  }

  // General executive answer derived strictly from active warehouse context
  return {
    answer: `ZITF Trade Intelligence Overview for **${ed}** (Live Warehouse Totals):
- **Exhibitors:** ${totalExhibitors} organizations (${intlExhibitors} international)
- **Registered Visitors:** ${totalVisitors.toLocaleString()} (${businessVisitors.toLocaleString()} trade delegates)
- **Invoiced Revenue:** ${fmtUsd(totalRevenueUsd)} USD
- **B2B Engagements:** ${b2bMeetings} logged (${fmtUsd(verifiedDealsUsd)} verified, ${fmtUsd(reportedDealsUsd)} participant-reported)
- **Operational Status:** ${occupancyPct}% hall occupancy · ${uptimePct}% ICT uptime · ${openIncidents} open incidents`,
    supportingData: { status: 'Warehouse Synchronized', edition: ed },
  };
}

// ==========================================
// Live External API Connectors & Webhook Hub
// ==========================================

interface QueuedWebhookPayload {
  id: string;
  receivedAt: string;
  sourceIp: string;
  records: Record<string, any>[];
}

const webhookBuffers = new Map<string, QueuedWebhookPayload[]>();

function parseCsvText(csvText: string): { headers: string[]; records: Record<string, any>[] } {
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

function resolveDotPath(obj: any, dotPath?: string): any {
  if (!dotPath || !dotPath.trim()) return obj;
  return dotPath
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean)
    .reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), obj);
}

// Built-in live HTTP sample endpoints representing ZITF external systems for UAT verification
app.get('/api/connectors/sample-feed/:system', (req, res) => {
  const { system } = req.params;
  const nowIso = new Date().toISOString();

  if (system === 'crm') {
    return res.json({
      source: 'ZITF Salesforce/CRM Gateway',
      syncedAt: nowIso,
      data: {
        records: [
          {
            companyName: 'Bulawayo Lithium Beneficiation Corp',
            regNumber: 'BLB-ZW-6601',
            sector: 'Mining & Natural Resources',
            country: 'Zimbabwe',
            provinceCity: 'Bulawayo',
            contactPerson: 'Sibusiso Ndlovu',
            email: 'sndlovu@blblithium.co.zw',
            phone: '+263 292 718 400',
            hallStand: 'Hall 1 - Stand C14',
            standSizeSqm: 120,
            category: 'Local Commercial',
            paymentStatus: 'Fully Paid',
          },
          {
            companyName: 'Lusaka Copperbelt Precision Tools',
            regNumber: 'LCP-ZM-4412',
            sector: 'Heavy Engineering & Logistics',
            country: 'Zambia',
            provinceCity: 'Kitwe',
            contactPerson: 'Mwamba Chanda',
            email: 'mchanda@copperbelttools.zm',
            phone: '+260 212 440 812',
            hallStand: 'Hall 4 - Stand SADC-09',
            standSizeSqm: 72,
            category: 'International Pavilion',
            paymentStatus: 'Fully Paid',
          },
        ],
      },
    });
  }

  if (system === 'ticketing') {
    return res.json({
      source: 'ZITF Gate Turnstile & RFID Ticketing API',
      syncedAt: nowIso,
      records: [
        {
          fullName: 'Tariro Nyathi',
          category: 'Buyers and Procurement',
          country: 'Zimbabwe',
          cityProvince: 'Harare',
          organization: 'Dairibord Supply Procurement',
          industry: 'Agriculture & Food Processing',
          email: 'tnyathi@dairibord-proc.co.zw',
          phone: '+263 772 901 445',
        },
        {
          fullName: 'Henrik Van Der Merwe',
          category: 'Investors',
          country: 'South Africa',
          cityProvince: 'Johannesburg',
          organization: 'Rand Merchant Industrial Ventures',
          industry: 'Financial Services',
          email: 'henrik.vdm@rmiv.co.za',
          phone: '+27 11 889 2300',
        },
      ],
    });
  }

  if (system === 'b2b') {
    return res.json({
      source: 'ZITF B2B Matchmaking Portal v2',
      syncedAt: nowIso,
      matches: [
        {
          buyerOrg: 'Rand Merchant Industrial Ventures',
          buyerCountry: 'South Africa',
          supplierOrg: 'Bulawayo Lithium Beneficiation Corp',
          supplierCountry: 'Zimbabwe',
          industry: 'Mining & Natural Resources',
          opportunityType: 'Investment Enquiry',
          estimatedValueUsd: 6500000,
          engagementStatus: 'Meeting Completed',
          verificationStatus: 'Reported by Participant',
          description: 'Off-take financing and spodumene concentrator expansion line.',
        },
      ],
    });
  }

  if (system === 'smartstand') {
    res.setHeader('Content-Type', 'text/csv');
    return res.send(
      [
        'clientName,type,amountUsd,outstandingBalanceUsd,sector,notes',
        '"Bulawayo Lithium Beneficiation Corp","Exhibition Hall Space",18400,0,"Mining & Natural Resources","Auto-synced via Smart Stand ERP Feed"',
        '"Lusaka Copperbelt Precision Tools","Commercial Services",4200,0,"Heavy Engineering & Logistics","3-phase heavy power & fiber drop"',
      ].join('\n')
    );
  }

  return res.status(404).json({ error: `Unknown sample feed system '${system}'` });
});

// Outbound Live Pull Proxy: Fetches live JSON or CSV from any configured REST endpoint
app.post('/api/connectors/pull', requireAuth, requirePermission('data_management:access', 'Connector Pull Proxy'), async (req, res) => {
  const start = Date.now();
  try {
    const { endpointUrl, authType, authHeaderName, authToken, dataPath } = req.body || {};

    if (!endpointUrl || typeof endpointUrl !== 'string') {
      return res.status(400).json({ ok: false, error: 'Endpoint URL is required.' });
    }

    let resolvedUrl = endpointUrl.trim();
    if (resolvedUrl.startsWith('/')) {
      resolvedUrl = `http://127.0.0.1:${port}${resolvedUrl}`;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(resolvedUrl);
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid endpoint URL format.' });
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ ok: false, error: 'Only HTTP and HTTPS protocols are supported.' });
    }

    const headers: Record<string, string> = {
      Accept: 'application/json, text/csv, text/plain;q=0.9, */*;q=0.8',
      'User-Agent': 'ZITF-BI-Connector/1.0',
    };

    if (authType === 'Bearer Token' && authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    } else if (authType === 'API Key Header' && authToken) {
      headers[authHeaderName?.trim() || 'x-api-key'] = authToken;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(parsedUrl.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = Date.now() - start;
    const contentType = upstreamResponse.headers.get('content-type') || '';
    const rawText = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      return res.status(502).json({
        ok: false,
        statusCode: upstreamResponse.status,
        latencyMs,
        error: `Upstream API returned HTTP ${upstreamResponse.status}: ${rawText.slice(0, 180)}`,
      });
    }

    let records: Record<string, any>[] = [];
    let headersList: string[] = [];

    const looksLikeJson =
      contentType.includes('application/json') ||
      rawText.trim().startsWith('{') ||
      rawText.trim().startsWith('[');

    if (looksLikeJson) {
      const jsonBody = JSON.parse(rawText);
      let extracted = resolveDotPath(jsonBody, dataPath);

      if (!Array.isArray(extracted)) {
        // Common auto-discovery keys if dataPath was left empty
        if (Array.isArray(jsonBody?.records)) extracted = jsonBody.records;
        else if (Array.isArray(jsonBody?.data?.records)) extracted = jsonBody.data.records;
        else if (Array.isArray(jsonBody?.data)) extracted = jsonBody.data;
        else if (Array.isArray(jsonBody?.items)) extracted = jsonBody.items;
        else if (Array.isArray(jsonBody?.results)) extracted = jsonBody.results;
        else if (Array.isArray(jsonBody?.matches)) extracted = jsonBody.matches;
        else if (jsonBody && typeof jsonBody === 'object' && !dataPath) extracted = [jsonBody];
      }

      if (!Array.isArray(extracted)) {
        return res.status(422).json({
          ok: false,
          statusCode: upstreamResponse.status,
          latencyMs,
          error: 'Could not locate an array of records in the JSON response. Configure the JSON Data Path (e.g. data.records).',
        });
      }

      records = extracted.filter((r) => r && typeof r === 'object');
      if (records.length > 0) {
        headersList = Array.from(new Set(records.flatMap((r) => Object.keys(r))));
      }
    } else {
      const parsed = parseCsvText(rawText);
      records = parsed.records;
      headersList = parsed.headers;
    }

    return res.json({
      ok: true,
      statusCode: upstreamResponse.status,
      latencyMs,
      contentType: contentType || (looksLikeJson ? 'application/json' : 'text/csv'),
      recordsCount: records.length,
      headers: headersList,
      records,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const message =
      err?.name === 'AbortError'
        ? 'External API request timed out after 10 seconds.'
        : err?.message || 'Failed to connect to external endpoint.';
    return res.status(502).json({ ok: false, latencyMs, error: message });
  }
});

// Inbound Webhook Receiver: Accepts live JSON pushes from external CRM / Ticketing / B2B systems
app.post('/api/webhooks/ingest/:connectorId', (req, res) => {
  const { connectorId } = req.params;
  const body = req.body;

  let records: Record<string, any>[] = [];
  if (Array.isArray(body)) {
    records = body;
  } else if (Array.isArray(body?.records)) {
    records = body.records;
  } else if (Array.isArray(body?.data)) {
    records = body.data;
  } else if (body && typeof body === 'object' && Object.keys(body).length > 0) {
    records = [body];
  }

  if (records.length === 0) {
    return res.status(400).json({ ok: false, error: 'Webhook body must contain a JSON object or array of records.' });
  }

  const queue = webhookBuffers.get(connectorId) || [];
  const entry: QueuedWebhookPayload = {
    id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    receivedAt: new Date().toISOString(),
    sourceIp: req.ip || 'unknown',
    records,
  };
  queue.push(entry);
  webhookBuffers.set(connectorId, queue.slice(-50));

  return res.status(202).json({
    ok: true,
    connectorId,
    queuedBatchId: entry.id,
    recordsQueued: records.length,
    totalPendingBatches: queue.length,
  });
});

// Inspect pending webhook payloads without clearing
app.get('/api/webhooks/buffer/:connectorId', requireAuth, requirePermission('data_management:access', 'Inspect Webhook Buffer'), (req, res) => {
  const { connectorId } = req.params;
  const queue = webhookBuffers.get(connectorId) || [];
  const totalRecords = queue.reduce((sum, item) => sum + item.records.length, 0);
  res.json({
    ok: true,
    connectorId,
    pendingBatches: queue.length,
    pendingRecords: totalRecords,
    batches: queue,
  });
});

// Flush queued webhook payloads into the BI application
app.post('/api/webhooks/flush/:connectorId', requireAuth, requirePermission('data_management:access', 'Flush Webhook Buffer'), (req, res) => {
  const session = req.authSession!;
  if (!hasPermission(session.user.role, 'exhibitors_visitors:write')) {
    return sendForbidden(
      res,
      session,
      'POST /api/webhooks/flush',
      `Role '${session.user.role}' is not authorized to flush webhook imports.`
    );
  }
  const { connectorId } = req.params;
  const queue = webhookBuffers.get(connectorId) || [];
  const records = queue.flatMap((batch) => batch.records);
  webhookBuffers.set(connectorId, []);
  res.json({
    ok: true,
    connectorId,
    recordsCount: records.length,
    records,
  });
});

// Development Vite integration vs Production static serve
async function startServer() {
  const server = http.createServer(app);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(port, () => {
    console.log(`ZITF Business Intelligence Platform server listening on port ${port}`);
    // Run initial evaluation + check due schedules, then poll every 60s
    try {
      evaluateWarehouseAlerts('scheduler@zitf.co.zw');
      processDueScheduledReports();
    } catch {
      // non-fatal on boot
    }
    setInterval(() => {
      try {
        evaluateWarehouseAlerts('scheduler@zitf.co.zw');
        processDueScheduledReports();
      } catch {
        // non-fatal background tick
      }
    }, 60_000);
  });
}

startServer();
