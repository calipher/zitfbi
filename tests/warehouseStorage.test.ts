import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  deleteStorageObject,
  getStorageDiagnostics,
  getUserPreferences,
  getWarehouseDb,
  listStorageObjects,
  optimizeWarehouseDatabase,
  queryWarehouseEntity,
  readStorageObjectFile,
  recordClientErrorLog,
  saveStorageObject,
  saveUserPreferences,
} from '../server/warehouse.ts';

describe('Scalable Server Storage, WAL Warehouse & Paginated SQL Queries', () => {
  it('runs SQLite in WAL mode with indexes and completes checkpoint + quick_check', () => {
    getWarehouseDb();
    const diag = getStorageDiagnostics();
    assert.equal(diag.journalMode, 'WAL');
    assert.ok(diag.indexCount >= 8, 'Expected indexed warehouse tables');

    const opt = optimizeWarehouseDatabase();
    assert.equal(opt.ok, true);
    assert.equal(opt.quickCheck.toLowerCase(), 'ok');
  });

  it('executes paginated SQL queries and redacts commercial transactions for Data Entry Officer', () => {
    const exhPage = queryWarehouseEntity({
      entity: 'exhibitors',
      editionId: 'zitf-2026',
      page: 1,
      limit: 3,
      role: 'Super Administrator',
    });
    assert.ok(exhPage.items.length <= 3);
    assert.ok(exhPage.total >= exhPage.items.length);

    const redacted = queryWarehouseEntity({
      entity: 'transactions',
      page: 1,
      limit: 10,
      role: 'Data Entry Officer',
    });
    assert.equal(redacted.redacted, true);
    assert.equal(redacted.items.length, 0);
  });

  it('persists user workspace preferences server-side beyond localStorage', () => {
    const testUserId = 'usr-test-pref-suite';
    const saved = saveUserPreferences(testUserId, {
      selectedEditionId: 'zitf-2025',
      selectedPeriod: 'business_days',
      selectedSector: 'Mining & Natural Resources',
      geographicFilter: 'international',
    });
    assert.equal(saved.selectedEditionId, 'zitf-2025');
    assert.equal(saved.geographicFilter, 'international');

    const loaded = getUserPreferences(testUserId);
    assert.equal(loaded.selectedEditionId, 'zitf-2025');
    assert.equal(loaded.selectedPeriod, 'business_days');

    // Cleanup synthetic preference row
    getWarehouseDb().prepare(`DELETE FROM user_preferences WHERE userId = ?`).run(testUserId);
  });

  it('archives, SHA-256 verifies, reads, and deletes files in server disk object storage', () => {
    const csvSample = 'companyName,country\n"Test Zimbabwe Exporter","Zimbabwe"\n';
    const expectedSha = crypto.createHash('sha256').update(csvSample, 'utf8').digest('hex');

    const created = saveStorageObject({
      category: 'upload-csv',
      filename: 'unit_test_export.csv',
      mimeType: 'text/csv',
      textContent: csvSample,
      uploadedByEmail: 'test@zitf.co.zw',
      uploadedByRole: 'Super Administrator',
      moduleRef: 'exhibitors',
    });

    assert.equal(created.sha256, expectedSha);
    assert.ok(listStorageObjects('upload-csv').some((o) => o.id === created.id));

    const loaded = readStorageObjectFile(created.id);
    assert.ok(loaded);
    assert.equal(loaded?.buffer.toString('utf8'), csvSample);

    const deleted = deleteStorageObject(created.id);
    assert.equal(deleted, true);
    assert.equal(readStorageObjectFile(created.id), null);
  });

  it('records sanitized client error boundary crash telemetry in SQLite', () => {
    const entry = recordClientErrorLog({
      scope: 'module',
      moduleName: 'test-suite',
      message: 'Automated boundary check',
      userEmail: 'test@zitf.co.zw',
      userRole: 'Super Administrator',
    });
    assert.ok(entry.id.startsWith('err-'));
    getWarehouseDb().prepare(`DELETE FROM client_error_logs WHERE id = ?`).run(entry.id);
  });
});
