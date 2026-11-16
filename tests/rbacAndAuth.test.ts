import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  authenticateCredentials,
  checkEntityWriteAuthorization,
  createSessionForUser,
  DEFAULT_UAT_PASSWORD,
  hashPassword,
  listActiveSessions,
  resolveSessionToken,
  revokeAllUserSessions,
  revokeSessionById,
  revokeSessionToken,
  seedAllUserCredentials,
  setUserPassword,
  validateUserPayload,
  verifyPassword,
} from '../server/auth.ts';
import { canAccessNavTab, hasPermission } from '../src/utils/rbac.ts';
import { INITIAL_USERS } from '../server/warehouseSeeds.ts';

function createInMemoryAuthDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      lastLogin TEXT NOT NULL
    );
  `);
  const ins = db.prepare(
    `INSERT INTO users (id, name, email, role, department, isActive, lastLogin) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const u of INITIAL_USERS) {
    ins.run(u.id, u.name, u.email, u.role, u.department, u.isActive ? 1 : 0, u.lastLogin);
  }
  seedAllUserCredentials(db);
  return db;
}

describe('Cryptographic Authentication & RBAC Enforcement Matrix', () => {
  it('hashes and verifies passwords with scrypt timingSafeEqual', () => {
    const { hash, salt } = hashPassword('ZitfStrongPass#2026');
    assert.equal(verifyPassword('ZitfStrongPass#2026', hash, salt), true);
    assert.equal(verifyPassword('WrongPassword', hash, salt), false);
  });

  it('authenticates valid credentials, resolves session tokens, and revokes sessions cleanly', () => {
    const db = createInMemoryAuthDb();
    const adminUser = INITIAL_USERS.find((u) => u.role === 'Super Administrator')!;

    const auth = authenticateCredentials(db, adminUser.email, DEFAULT_UAT_PASSWORD);
    assert.equal(auth.user.email, adminUser.email);
    assert.ok(auth.rawToken.length >= 32);

    const resolved = resolveSessionToken(db, auth.rawToken);
    assert.ok(resolved);
    assert.equal(resolved?.user.id, adminUser.id);

    revokeSessionToken(db, auth.rawToken);
    assert.equal(resolveSessionToken(db, auth.rawToken), null);
  });

  it('supports password rotation and bulk user session revocation', () => {
    const db = createInMemoryAuthDb();
    const analyst = INITIAL_USERS.find((u) => u.role === 'Data Analyst')!;

    const s1 = authenticateCredentials(db, analyst.email, DEFAULT_UAT_PASSWORD);
    assert.ok(resolveSessionToken(db, s1.rawToken));

    setUserPassword(db, analyst.id, 'Rotated#2026');
    assert.throws(() => authenticateCredentials(db, analyst.email, DEFAULT_UAT_PASSWORD));

    const s2 = authenticateCredentials(db, analyst.email, 'Rotated#2026');
    assert.ok(resolveSessionToken(db, s2.rawToken));

    revokeAllUserSessions(db, analyst.id);
    assert.equal(resolveSessionToken(db, s2.rawToken), null);
  });

  it('lists active SQLite sessions and revokes individual sessions by ID', () => {
    const db = createInMemoryAuthDb();
    const adminUser = INITIAL_USERS.find((u) => u.role === 'Super Administrator')!;
    const analyst = INITIAL_USERS.find((u) => u.role === 'Data Analyst')!;

    const adminSess = createSessionForUser(db, adminUser.id);
    const impSess = createSessionForUser(db, analyst.id, adminUser.id);

    const active = listActiveSessions(db, adminSess.sessionId);
    assert.equal(active.length, 2);

    const current = active.find((s) => s.sessionId === adminSess.sessionId);
    assert.equal(current?.isCurrentSession, true);

    const imp = active.find((s) => s.sessionId === impSess.sessionId);
    assert.equal(imp?.impersonatedByUserId, adminUser.id);
    assert.equal(imp?.impersonatedByName, adminUser.name);

    const revoked = revokeSessionById(db, impSess.sessionId);
    assert.equal(revoked.revoked, true);
    assert.equal(resolveSessionToken(db, impSess.rawToken), null);
    assert.equal(listActiveSessions(db, adminSess.sessionId).length, 1);
  });

  it('enforces user email uniqueness, valid roles, self-protection, and last Super Administrator guard', () => {
    const db = createInMemoryAuthDb();
    const adminUser = INITIAL_USERS.find((u) => u.role === 'Super Administrator')!;
    const analyst = INITIAL_USERS.find((u) => u.role === 'Data Analyst')!;

    const dup = validateUserPayload(db, {
      id: 'usr-new',
      name: 'Duplicate Email User',
      email: analyst.email.toUpperCase(),
      role: 'Data Analyst',
      department: 'BI',
      isActive: true,
    });
    assert.equal(dup.ok, false);

    const badRole = validateUserPayload(db, {
      id: 'usr-new-2',
      name: 'Invalid Role User',
      email: 'new.user@zitf.co.zw',
      role: 'Root Overlord',
      department: 'BI',
      isActive: true,
    });
    assert.equal(badRole.ok, false);

    const selfDeactivate = validateUserPayload(
      db,
      { isActive: false },
      { targetUserId: adminUser.id, currentActorId: adminUser.id, isPatch: true }
    );
    assert.equal(selfDeactivate.ok, false);

    const demoteLastAdmin = validateUserPayload(
      db,
      { role: 'Data Analyst' },
      { targetUserId: adminUser.id, currentActorId: 'another-actor', isPatch: true }
    );
    assert.equal(demoteLastAdmin.ok, false);

    const validCreate = validateUserPayload(db, {
      id: 'usr-valid-new',
      name: 'Tatenda Mpofu',
      email: 't.mpofu@zitf.co.zw',
      role: 'Department Manager',
      department: 'Exhibitor Relations',
      isActive: true,
    });
    assert.equal(validCreate.ok, true);
  });

  it('enforces 6-role CRUD and navigation boundaries accurately', () => {
    assert.equal(hasPermission('Super Administrator', 'system:admin'), true);
    assert.equal(hasPermission('Executive Management', 'system:admin'), false);
    assert.equal(hasPermission('Data Entry Officer', 'commercial:read'), false);
    assert.equal(canAccessNavTab('Data Entry Officer', 'commercial'), false);
    assert.equal(canAccessNavTab('External Stakeholder / Viewer', 'users'), false);

    // Backend entity write guards
    const viewerWriteExh = checkEntityWriteAuthorization('External Stakeholder / Viewer', 'exhibitors', 'POST');
    assert.equal(viewerWriteExh.allowed, false);

    const analystVerifyDeal = checkEntityWriteAuthorization('Data Analyst', 'tradeEngagements', 'PATCH', {
      verificationStatus: 'Independently Verified',
    });
    assert.equal(analystVerifyDeal.allowed, false);

    const mgrVerifyDeal = checkEntityWriteAuthorization('Department Manager', 'tradeEngagements', 'PATCH', {
      verificationStatus: 'Independently Verified',
    });
    assert.equal(mgrVerifyDeal.allowed, true);

    const immutableAudit = checkEntityWriteAuthorization('Super Administrator', 'auditLogs', 'DELETE');
    assert.equal(immutableAudit.allowed, false);
  });
});
