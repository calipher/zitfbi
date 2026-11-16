import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runDataMiningSuite } from '../src/utils/dataMiningEngine.ts';
import {
  INITIAL_EDITIONS,
  INITIAL_EXHIBITORS,
  INITIAL_VISITORS,
  INITIAL_TRANSACTIONS,
  INITIAL_TRADE_ENGAGEMENTS,
  INITIAL_HALL_UTILISATION,
} from '../server/warehouseSeeds.ts';

describe('Algorithmic Data Mining & Forecasting Engine', () => {
  it('computes OLS regression forecasts, K-means exhibitor clusters, anomalies, and association rules', () => {
    const result = runDataMiningSuite(
      {
        editions: INITIAL_EDITIONS,
        exhibitors: INITIAL_EXHIBITORS,
        visitors: INITIAL_VISITORS,
        transactions: INITIAL_TRANSACTIONS,
        tradeEngagements: INITIAL_TRADE_ENGAGEMENTS,
        hallUtilisation: INITIAL_HALL_UTILISATION,
      },
      { kClusters: 3, anomalyZThreshold: 2.0 }
    );

    assert.ok(result.datasetSummary.totalRawRecords > 0);
    assert.ok(Number.isFinite(result.forecasts.revenueUsd.nextEditionForecast));
    assert.ok(result.forecasts.revenueUsd.nextEditionYear >= 2027);
    assert.ok(result.forecasts.revenueUsd.rSquared >= 0 && result.forecasts.revenueUsd.rSquared <= 1);
    assert.equal(result.clustering.k, 3);
    assert.equal(result.clustering.points.length, INITIAL_EXHIBITORS.length);
    assert.ok(result.clustering.profiles.length > 0);
    assert.ok(Array.isArray(result.anomalies));
    assert.ok(Array.isArray(result.associationRules));
    assert.ok(result.pareto.hhiScore >= 0);
    assert.ok(result.sectorMomentum.length > 0);
  });

  it('flags an injected commercial spike via robust MAD Z-score anomaly detection', () => {
    const spikedTransactions = [
      ...INITIAL_TRANSACTIONS,
      {
        id: 'tx-spike-test',
        refNumber: 'INV-SPIKE-999',
        type: 'Sponsorship Agreement' as const,
        clientName: 'Mega Sovereign Expo Sponsor',
        amountUsd: 450000,
        outstandingBalanceUsd: 0,
        editionId: 'zitf-2026',
        status: 'Fully Paid' as const,
        paymentDate: '2026-04-21',
        sector: 'Mining & Natural Resources',
        notes: 'Injected spike for test verification',
        isDemo: false,
      },
    ];

    const result = runDataMiningSuite(
      {
        editions: INITIAL_EDITIONS,
        exhibitors: INITIAL_EXHIBITORS,
        visitors: INITIAL_VISITORS,
        transactions: spikedTransactions,
        tradeEngagements: INITIAL_TRADE_ENGAGEMENTS,
        hallUtilisation: INITIAL_HALL_UTILISATION,
      },
      { kClusters: 3, anomalyZThreshold: 2.0 }
    );

    const flagged = result.anomalies.find((a) => a.recordRef === 'INV-SPIKE-999');
    assert.ok(flagged, 'Expected injected $450k invoice spike to be flagged as an anomaly');
    assert.equal(flagged?.direction, 'High Spike');
    assert.ok(Math.abs(flagged?.zScore || 0) >= 2.0);
  });
});
