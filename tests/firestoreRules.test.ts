import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const rulesText = fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8');
const blueprint = JSON.parse(fs.readFileSync(path.join(rootDir, 'firebase-blueprint.json'), 'utf8'));

describe('Cloud Firestore Security Rules & Blueprint Contract Verification', () => {
  it('enforces rules_version = 2 and global default-deny catch-all at top of rules', () => {
    assert.match(rulesText, /rules_version\s*=\s*'2'/);
    assert.match(rulesText, /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/);
  });

  it('requires verified email on isSignedIn() and restricts client bootstrap admin email explicitly', () => {
    assert.match(rulesText, /function\s+isSignedIn\(\)\s*\{[^}]*request\.auth\.token\.email_verified\s*==\s*true/);
    assert.match(rulesText, /function\s+isBootstrappedAdminEmail\(\)\s*\{[^}]*request\.auth\.token\.email\s*==\s*'calipherrndlovu@gmail\.com'/);
    assert.match(rulesText, /function\s+isAdmin\(\)\s*\{[^}]*exists\(\/databases\/\$\(database\)\/documents\/admins\/\$\(request\.auth\.uid\)\)/);
  });

  it('validates document IDs via regex helper and blocks cross-document reads inside allow list rules', () => {
    assert.match(rulesText, /function\s+isValidId\(id\)\s*\{[^}]*id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\)/);

    const listLines = rulesText
      .split('\n')
      .filter((line) => /^\s*allow\s+list\b/.test(line));
    assert.ok(listLines.length >= 19, `Expected >= 19 allow list rules, found ${listLines.length}`);

    for (const line of listLines) {
      assert.equal(/\bget\s*\(/.test(line), false, `allow list must not call get(): ${line}`);
      assert.equal(/\bexists\s*\(/.test(line), false, `allow list must not call exists(): ${line}`);
      assert.equal(/\bisAdmin\s*\(/.test(line), false, `allow list must not call isAdmin(): ${line}`);
      assert.match(line, /resource\.data\.ownerUid\s*==\s*request\.auth\.uid/, `allow list must enforce ownerUid filter: ${line}`);
    }
  });

  it('covers every Firestore collection defined in firebase-blueprint.json with matching schema guards', () => {
    const blueprintPaths = Object.keys(blueprint.firestore || {});
    assert.equal(blueprintPaths.length, 24, `Expected 24 blueprint paths, found ${blueprintPaths.length}`);

    const requiredMatchPatterns = [
      'match /users/{userId}/private/{docId}',
      'match /admins/{adminUid}',
      'match /workspaceSnapshots/{snapshotId}',
      'match /reports/{reportId}',
      'match /editions/{editionId}',
      'match /exhibitors/{exhibitorId}',
      'match /visitors/{visitorId}',
      'match /commercialTransactions/{txId}',
      'match /tradeEngagements/{engagementId}',
      'match /hallUtilisation/{hallId}',
      'match /operationalIncidents/{incidentId}',
      'match /marketInsights/{insightId}',
      'match /biReports/{reportId}',
      'match /externalConnectors/{connectorId}',
      'match /connectorSyncLogs/{logId}',
      'match /thresholdAlertRules/{ruleId}',
      'match /alertEvents/{eventId}',
      'match /scheduledReports/{scheduleId}',
      'match /sharedBriefs/{briefId}',
      'match /annotations/{commentId}',
      'match /emailDispatches/{dispatchId}',
      'match /auditLogs/{logId}',
      'match /directoryUsers/{staffId}',
      'match /workspacePreferences/{userId}',
    ];

    for (const pattern of requiredMatchPatterns) {
      assert.ok(rulesText.includes(pattern), `Missing security rule block: ${pattern}`);
    }
  });

  it('enforces immutable auditLogs, server request.time timestamps, and terminal state locks', () => {
    // Audit logs cannot be updated via client SDK
    assert.match(rulesText, /match\s+\/auditLogs\/\{logId\}[\s\S]*?allow\s+update:\s*if\s+false;/);

    // Server timestamps mandatory on create & update
    assert.match(rulesText, /incoming\(\)\.createdAt\s*==\s*request\.time/);
    assert.match(rulesText, /incoming\(\)\.updatedAt\s*==\s*request\.time/);

    // Terminal state locks for non-admins on Verified deals, Resolved incidents/alerts, Approved briefs, Archived snapshots
    assert.match(rulesText, /existing\(\)\.verificationStatus\s*!=\s*'Independently Verified'/);
    assert.match(rulesText, /existing\(\)\.status\s*!=\s*'Resolved'/);
    assert.match(rulesText, /existing\(\)\.workflowStatus\s*!=\s*'Approved'/);
    assert.match(rulesText, /existing\(\)\.status\s*!=\s*'Archived'/);

    // Non-admin owners cannot elevate their own role or active status on directoryUsers
    assert.match(rulesText, /incoming\(\)\.role\s*==\s*existing\(\)\.role/);
    assert.match(rulesText, /incoming\(\)\.isActive\s*==\s*existing\(\)\.isActive/);
  });
});
