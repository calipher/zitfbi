import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAutomatedBIReport,
  computeNextRunIso,
  evaluateAlertRules,
} from '../src/utils/alertsAndSchedules.ts';
import {
  INITIAL_EDITIONS,
  INITIAL_EXHIBITORS,
  INITIAL_VISITORS,
  INITIAL_TRANSACTIONS,
  INITIAL_TRADE_ENGAGEMENTS,
  INITIAL_HALL_UTILISATION,
  INITIAL_INCIDENTS,
} from '../server/warehouseSeeds.ts';
import type { ScheduledReportConfig, ThresholdAlertRule } from '../src/types/index.ts';

describe('Threshold Alerts & Automated Report Scheduler', () => {
  const scope = {
    editions: INITIAL_EDITIONS,
    exhibitors: INITIAL_EXHIBITORS,
    visitors: INITIAL_VISITORS,
    transactions: INITIAL_TRANSACTIONS,
    tradeEngagements: INITIAL_TRADE_ENGAGEMENTS,
    hallUtilisation: INITIAL_HALL_UTILISATION,
    incidents: INITIAL_INCIDENTS,
  };

  it('triggers alerts when threshold breaches occur and prevents duplicate active events', () => {
    const rule: ThresholdAlertRule = {
      id: 'rule-test-1',
      name: 'Occupancy Floor Test',
      metricKey: 'space_occupancy_pct',
      operator: 'lt',
      threshold: 99.9, // guaranteed breach against baseline occupancy
      severity: 'Warning',
      editionId: 'zitf-2026',
      notifyRoles: ['Super Administrator'],
      recipients: 'ops@zitf.co.zw',
      isActive: true,
      createdAt: '2026-04-01T08:00:00.000Z',
    };

    const firstPass = evaluateAlertRules([rule], [], scope);
    assert.equal(firstPass.newlyTriggeredEvents.length, 1);
    assert.equal(firstPass.newlyTriggeredEvents[0].status, 'Active');

    // Second pass with existing Active event must not create duplicate active alerts
    const secondPass = evaluateAlertRules([rule], firstPass.newlyTriggeredEvents, scope);
    assert.equal(secondPass.newlyTriggeredEvents.length, 0);
  });

  it('synthesizes scheduled BI reports with live KPIs and OLS forecasts', () => {
    const schedule: ScheduledReportConfig = {
      id: 'sched-test-1',
      name: 'Weekly Board Flash',
      pillar: 'Executive',
      editionId: 'zitf-2026',
      confidentiality: 'Confidential - Board & Executive',
      frequency: 'Weekly',
      runTimeUtc: '08:00',
      recipients: 'board@zitf.co.zw',
      includeMiningForecast: true,
      isActive: true,
      nextRunAt: computeNextRunIso('Weekly', '08:00'),
      runCount: 0,
      createdAt: '2026-04-01T08:00:00.000Z',
    };

    const report = buildAutomatedBIReport(schedule, scope);
    assert.ok(report.reportNumber.startsWith('ZITF-AUTO-'));
    assert.ok(report.kpis.some((k) => k.label.includes('Projected ZITF')));
    assert.ok(report.summaryFindings.includes('Automated scheduled report'));
  });
});
