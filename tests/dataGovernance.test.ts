import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  governDatasetBatch,
  parseCsvContent,
  validateSingleEntityRecord,
} from '../src/utils/dataGovernance.ts';
import {
  INITIAL_EXHIBITORS,
  INITIAL_VISITORS,
  INITIAL_TRANSACTIONS,
  INITIAL_TRADE_ENGAGEMENTS,
} from '../server/warehouseSeeds.ts';

describe('Data Governance & Deduplication Pipeline', () => {
  const existingData = {
    exhibitors: INITIAL_EXHIBITORS,
    visitors: INITIAL_VISITORS,
    transactions: INITIAL_TRANSACTIONS,
    tradeEngagements: INITIAL_TRADE_ENGAGEMENTS,
  };

  it('parses quoted CSV strings and rejects malformed exhibitor rows while deduplicating regNumber', () => {
    const csv = [
      'companyName,regNumber,sector,country,provinceCity,contactPerson,email,phone,hallStand,standSizeSqm,category,paymentStatus',
      '"Matobo Clean Energy","MCE-ZW-9001","Energy & Clean Tech","Zimbabwe","Bulawayo","Noma Ncube","noma@matoboenergy.co.zw","+263 292 600 100","Hall 3 - Stand E01",54,"SME / Emerging","Fully Paid"',
      '"Matobo Clean Energy Duplicate","MCE-ZW-9001","Energy & Clean Tech","Zimbabwe","Bulawayo","Noma Ncube","noma2@matoboenergy.co.zw","+263 292 600 101","Hall 3 - Stand E02",54,"SME / Emerging","Fully Paid"',
      '"Bad Email Corp","BEC-ZW-9002","Manufacturing","Zimbabwe","Harare","Sam Dube","not-an-email","+263 242 500 200","Hall 1 - Stand A05",-15,"Local Commercial","Fully Paid"',
    ].join('\n');

    const parsed = parseCsvContent(csv);
    assert.equal(parsed.records.length, 3);

    const res = governDatasetBatch('exhibitors', parsed.records, existingData, {
      skipDuplicates: true,
      defaultEditionId: 'zitf-2026',
    });

    assert.equal(res.summary.validNewCount, 1);
    assert.equal(res.summary.duplicateCount, 1);
    assert.equal(res.summary.errorCount, 1);
    assert.equal(res.validPayloads.length, 1);
    assert.equal(res.validPayloads[0].companyName, 'Matobo Clean Energy');
    assert.ok(res.rejectedRows[0].errors.some((e) => e.includes('email')));
    assert.ok(res.rejectedRows[0].errors.some((e) => e.includes('standSizeSqm')));
  });

  it('enforces commercial balance consistency (outstanding <= amount, Fully Paid == 0 outstanding)', () => {
    const res = governDatasetBatch(
      'commercial',
      [
        {
          clientName: 'Alpha Mining Co',
          refNumber: 'INV-TEST-01',
          type: 'Exhibition Hall Space',
          amountUsd: 10000,
          outstandingBalanceUsd: 12000,
          status: 'Overdue',
          sector: 'Mining',
        },
        {
          clientName: 'Beta Logistics Ltd',
          refNumber: 'INV-TEST-02',
          type: 'Exhibition Hall Space',
          amountUsd: 8000,
          outstandingBalanceUsd: 0,
          status: 'Fully Paid',
          sector: 'Logistics',
        },
      ],
      existingData,
      { skipDuplicates: true, defaultEditionId: 'zitf-2026' }
    );

    assert.equal(res.summary.errorCount, 1);
    assert.equal(res.summary.validNewCount, 1);
    assert.equal(res.validPayloads[0].clientName, 'Beta Logistics Ltd');
  });

  it('blocks identical buyerOrg and supplierOrg on B2B trade engagements', () => {
    const res = governDatasetBatch(
      'trade',
      [
        {
          buyerOrg: 'Zimbabwe Holdings',
          supplierOrg: 'Zimbabwe Holdings',
          estimatedValueUsd: 500000,
          opportunityType: 'Export Opportunity',
        },
      ],
      existingData,
      { skipDuplicates: true, defaultEditionId: 'zitf-2026' }
    );

    assert.equal(res.summary.errorCount, 1);
    assert.ok(res.rejectedRows[0].errors.some((e) => e.includes('identical')));
  });

  it('validates single records via validateSingleEntityRecord guard', () => {
    const badExh = validateSingleEntityRecord('exhibitors', {
      companyName: '',
      email: 'bad-email',
      standSizeSqm: 0,
    });
    assert.equal(badExh.length, 3);

    const goodVis = validateSingleEntityRecord('visitors', {
      fullName: 'Tendai Moyo',
      email: 'tendai@example.co.zw',
    });
    assert.equal(goodVis.length, 0);
  });
});
