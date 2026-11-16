import type {
  AlertEvent,
  AlertMetricKey,
  AlertOperator,
  BIReport,
  CommercialTransaction,
  ExhibitionEdition,
  Exhibitor,
  HallUtilisation,
  OperationalIncident,
  ScheduleFrequency,
  ScheduledReportConfig,
  ThresholdAlertRule,
  TradeEngagement,
  Visitor,
} from '../types/index.ts';
import { computeEditionForecasts, detectRecordAnomalies } from './dataMiningEngine.ts';
import { formatUsdCompact } from './formatters.ts';

export interface AlertMetricMeta {
  key: AlertMetricKey;
  label: string;
  unit: '%' | 'USD' | 'Count';
  defaultOperator: AlertOperator;
  defaultThreshold: number;
  description: string;
}

export const ALERT_METRIC_CATALOG: AlertMetricMeta[] = [
  {
    key: 'collection_rate_pct',
    label: 'Receivables Collection Rate (%)',
    unit: '%',
    defaultOperator: 'lt',
    defaultThreshold: 85,
    description: 'Percentage of invoiced commercial revenue collected (paid vs. invoiced total).',
  },
  {
    key: 'outstanding_balance_usd',
    label: 'Outstanding Receivables (USD)',
    unit: 'USD',
    defaultOperator: 'gt',
    defaultThreshold: 30000,
    description: 'Total unpaid invoice balance across commercial transactions.',
  },
  {
    key: 'space_occupancy_pct',
    label: 'Venue Space Occupancy (%)',
    unit: '%',
    defaultOperator: 'lt',
    defaultThreshold: 75,
    description: 'Occupied square metres as a share of total exhibition hall capacity.',
  },
  {
    key: 'open_incidents_count',
    label: 'Open Operational Incidents',
    unit: 'Count',
    defaultOperator: 'gte',
    defaultThreshold: 2,
    description: 'Count of unresolved (Open or In Progress) venue & ICT incidents.',
  },
  {
    key: 'network_uptime_pct',
    label: 'Hall Network Uptime (%)',
    unit: '%',
    defaultOperator: 'lt',
    defaultThreshold: 99,
    description: 'Average Wi-Fi and ICT backbone availability across active halls.',
  },
  {
    key: 'exhibitor_retention_pct',
    label: 'Exhibitor Retention Rate (%)',
    unit: '%',
    defaultOperator: 'lt',
    defaultThreshold: 55,
    description: 'Share of returning exhibitors vs. total registered companies.',
  },
  {
    key: 'verified_deals_usd',
    label: 'Independently Verified Deals (USD)',
    unit: 'USD',
    defaultOperator: 'lt',
    defaultThreshold: 500000,
    description: 'Audited bilateral trade contract value within selected edition scope.',
  },
  {
    key: 'anomaly_count',
    label: 'Statistical Outliers Flagged (|z| ≥ 2.0)',
    unit: 'Count',
    defaultOperator: 'gte',
    defaultThreshold: 4,
    description: 'Count of raw record spikes or churn risks flagged by the MAD anomaly scanner.',
  },
];

export interface WarehouseEvaluationScope {
  editions: ExhibitionEdition[];
  exhibitors: Exhibitor[];
  visitors: Visitor[];
  transactions: CommercialTransaction[];
  tradeEngagements: TradeEngagement[];
  hallUtilisation: HallUtilisation[];
  incidents: OperationalIncident[];
}

export function formatOperatorSymbol(op: AlertOperator): string {
  switch (op) {
    case 'lt':
      return '<';
    case 'lte':
      return '≤';
    case 'gt':
      return '>';
    case 'gte':
      return '≥';
  }
}

export function formatAlertMetricValue(metricKey: AlertMetricKey, value: number): string {
  const meta = ALERT_METRIC_CATALOG.find((m) => m.key === metricKey);
  if (!meta) return String(value);
  if (meta.unit === '%') return `${Number(value.toFixed(1))}%`;
  if (meta.unit === 'USD') return `$${Math.round(value).toLocaleString()} USD`;
  return String(Math.round(value));
}

export function computeAlertMetricValues(
  scope: WarehouseEvaluationScope,
  editionId: string
): Record<AlertMetricKey, number> {
  const matchEd = (ed: string) => !editionId || editionId === 'all' || ed === editionId;

  const exh = scope.exhibitors.filter((e) => matchEd(e.editionId));
  const txs = scope.transactions.filter((t) => matchEd(t.editionId));
  const trd = scope.tradeEngagements.filter((t) => matchEd(t.editionId));
  const inc = scope.incidents.filter((i) => matchEd(i.editionId));

  const totalRevenueUsd = txs.reduce((s, t) => s + (Number(t.amountUsd) || 0), 0);
  const outstandingBalanceUsd = txs.reduce((s, t) => s + (Number(t.outstandingBalanceUsd) || 0), 0);
  const collectionRatePct =
    totalRevenueUsd > 0
      ? Number((((totalRevenueUsd - outstandingBalanceUsd) / totalRevenueUsd) * 100).toFixed(1))
      : 100;

  const totalCapacitySqm = scope.hallUtilisation.reduce((s, h) => s + (Number(h.totalCapacitySqm) || 0), 0);
  const occupiedSqm = scope.hallUtilisation.reduce((s, h) => s + (Number(h.occupiedSqm) || 0), 0);
  const spaceOccupancyPct =
    totalCapacitySqm > 0 ? Number(((occupiedSqm / totalCapacitySqm) * 100).toFixed(1)) : 0;

  const openIncidentsCount = inc.filter((i) => i.status !== 'Resolved').length;

  const networkUptimePct =
    scope.hallUtilisation.length > 0
      ? Number(
          (
            scope.hallUtilisation.reduce((s, h) => s + (Number(h.wifiUptimePct) || 0), 0) /
            scope.hallUtilisation.length
          ).toFixed(2)
        )
      : 100;

  const returningCount = exh.filter((e) => e.returningStatus === 'Returning').length;
  const exhibitorRetentionPct =
    exh.length > 0 ? Number(((returningCount / exh.length) * 100).toFixed(1)) : 0;

  const verifiedDealsUsd = trd
    .filter((t) => t.verificationStatus === 'Independently Verified')
    .reduce((s, t) => s + (Number(t.estimatedValueUsd) || 0), 0);

  const anomalies = detectRecordAnomalies(exh, txs, trd, 2.0);

  return {
    collection_rate_pct: collectionRatePct,
    outstanding_balance_usd: Math.round(outstandingBalanceUsd),
    space_occupancy_pct: spaceOccupancyPct,
    open_incidents_count: openIncidentsCount,
    network_uptime_pct: networkUptimePct,
    exhibitor_retention_pct: exhibitorRetentionPct,
    verified_deals_usd: Math.round(verifiedDealsUsd),
    anomaly_count: anomalies.length,
  };
}

export function testAlertCondition(observed: number, operator: AlertOperator, threshold: number): boolean {
  switch (operator) {
    case 'lt':
      return observed < threshold;
    case 'lte':
      return observed <= threshold;
    case 'gt':
      return observed > threshold;
    case 'gte':
      return observed >= threshold;
  }
}

export interface RuleEvaluationSnapshot {
  ruleId: string;
  observedValue: number;
  breached: boolean;
  metricLabel: string;
}

export function evaluateAlertRules(
  rules: ThresholdAlertRule[],
  existingEvents: AlertEvent[],
  scope: WarehouseEvaluationScope,
  nowIso = new Date().toISOString()
): {
  evaluations: Record<string, RuleEvaluationSnapshot>;
  newlyTriggeredEvents: AlertEvent[];
  updatedRules: ThresholdAlertRule[];
} {
  const evaluations: Record<string, RuleEvaluationSnapshot> = {};
  const newlyTriggeredEvents: AlertEvent[] = [];
  const cacheByEdition = new Map<string, Record<AlertMetricKey, number>>();

  const updatedRules = rules.map((rule) => {
    const edKey = rule.editionId || 'zitf-2026';
    if (!cacheByEdition.has(edKey)) {
      cacheByEdition.set(edKey, computeAlertMetricValues(scope, edKey));
    }
    const metrics = cacheByEdition.get(edKey)!;
    const observedValue = metrics[rule.metricKey] ?? 0;
    const meta = ALERT_METRIC_CATALOG.find((m) => m.key === rule.metricKey);
    const metricLabel = meta?.label || rule.metricKey;
    const breached = rule.isActive && testAlertCondition(observedValue, rule.operator, rule.threshold);

    evaluations[rule.id] = {
      ruleId: rule.id,
      observedValue,
      breached,
      metricLabel,
    };

    if (!breached) {
      return {
        ...rule,
        lastEvaluatedAt: nowIso,
      };
    }

    // Prevent duplicate unacknowledged Active alerts for the exact same rule
    const alreadyOpen = existingEvents.some(
      (ev) => ev.ruleId === rule.id && ev.status === 'Active'
    );

    if (!alreadyOpen) {
      const edName =
        edKey === 'all'
          ? 'All Editions'
          : scope.editions.find((e) => e.id === edKey)?.name || edKey;

      newlyTriggeredEvents.push({
        id: `alrevt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ruleId: rule.id,
        ruleName: rule.name,
        metricKey: rule.metricKey,
        metricLabel,
        observedValue,
        threshold: rule.threshold,
        operator: rule.operator,
        severity: rule.severity,
        editionId: edKey,
        message: `[${rule.severity}] ${rule.name} (${edName}): ${metricLabel} is ${formatAlertMetricValue(
          rule.metricKey,
          observedValue
        )} (${formatOperatorSymbol(rule.operator)} threshold ${formatAlertMetricValue(
          rule.metricKey,
          rule.threshold
        )}).`,
        status: 'Active',
        triggeredAt: nowIso.replace('T', ' ').substring(0, 19),
      });
    }

    return {
      ...rule,
      lastEvaluatedAt: nowIso,
      lastTriggeredAt: !alreadyOpen ? nowIso : rule.lastTriggeredAt,
    };
  });

  return { evaluations, newlyTriggeredEvents, updatedRules };
}

export function computeNextRunIso(frequency: ScheduleFrequency, runTimeUtc = '07:00', fromDate = new Date()): string {
  const [hhStr, mmStr] = runTimeUtc.split(':');
  const hh = Number(hhStr) || 7;
  const mm = Number(mmStr) || 0;
  const next = new Date(fromDate.getTime());

  if (frequency === 'Hourly (Monitor)') {
    next.setTime(fromDate.getTime() + 60 * 60 * 1000);
    return next.toISOString();
  }

  next.setUTCHours(hh, mm, 0, 0);
  if (frequency === 'Daily') {
    if (next.getTime() <= fromDate.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  } else if (frequency === 'Weekly') {
    next.setUTCDate(next.getUTCDate() + 7);
  } else if (frequency === 'Monthly') {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next.toISOString();
}

export function buildAutomatedBIReport(
  schedule: ScheduledReportConfig,
  scope: WarehouseEvaluationScope,
  nowDate = new Date()
): BIReport {
  const matchEd = (ed: string) => !schedule.editionId || schedule.editionId === 'all' || ed === schedule.editionId;
  const edObj = scope.editions.find((e) => e.id === schedule.editionId);
  const editionTitle = edObj ? edObj.name : 'All Exhibition Editions';

  const exh = scope.exhibitors.filter((e) => matchEd(e.editionId));
  const vis = scope.visitors.filter((v) => matchEd(v.editionId));
  const txs = scope.transactions.filter((t) => matchEd(t.editionId));
  const trd = scope.tradeEngagements.filter((t) => matchEd(t.editionId));
  const inc = scope.incidents.filter((i) => matchEd(i.editionId));

  const totalRev = txs.reduce((s, t) => s + (Number(t.amountUsd) || 0), 0);
  const outstanding = txs.reduce((s, t) => s + (Number(t.outstandingBalanceUsd) || 0), 0);
  const collectionPct =
    totalRev > 0 ? Number((((totalRev - outstanding) / totalRev) * 100).toFixed(1)) : 100;
  const verifiedUsd = trd
    .filter((t) => t.verificationStatus === 'Independently Verified')
    .reduce((s, t) => s + (Number(t.estimatedValueUsd) || 0), 0);
  const openInc = inc.filter((i) => i.status !== 'Resolved').length;

  const kpis: { label: string; value: string; trend?: string }[] = [
    { label: 'Total Exhibitors', value: `${exh.length} Companies`, trend: `${exh.filter((e) => e.returningStatus === 'Returning').length} Returning` },
    { label: 'Accredited Visitors', value: `${vis.length.toLocaleString()} Records`, trend: `${vis.filter((v) => v.repeatVisitor).length} Repeat` },
    { label: 'Invoiced Revenue', value: `${formatUsdCompact(totalRev)} USD`, trend: `${collectionPct}% Collected` },
    { label: 'Outstanding Receivables', value: `${formatUsdCompact(outstanding)} USD`, trend: `${txs.filter((t) => t.outstandingBalanceUsd > 0).length} Open Invoices` },
    { label: 'Verified B2B Contracts', value: `${formatUsdCompact(verifiedUsd)} USD`, trend: `${trd.length} Total Deals` },
    { label: 'Open Operational Incidents', value: `${openInc}`, trend: openInc === 0 ? 'All Clear' : 'Attention Required' },
  ];

  let summaryFindings = `Automated scheduled report ("${schedule.name}", ${schedule.frequency}) generated for ${editionTitle} from live SQLite warehouse tables. Distribution: ${schedule.recipients || 'Executive Committee'}. Current snapshot reflects ${exh.length} exhibitors, ${vis.length} visitors, ${formatUsdCompact(totalRev)} USD invoiced (${collectionPct}% collected), and ${formatUsdCompact(verifiedUsd)} USD in verified bilateral deals.`;

  const recommendations: string[] = [
    `Maintain scheduled distribution cadence (${schedule.frequency}) to stakeholders: ${schedule.recipients || 'Executive Mailing List'}.`,
    outstanding > 0
      ? `Follow up on ${formatUsdCompact(outstanding)} USD in outstanding receivables to sustain collection rate above 85%.`
      : 'Commercial receivables clearance is at 100%.',
  ];

  if (schedule.includeMiningForecast) {
    const forecasts = computeEditionForecasts(
      scope.editions,
      scope.exhibitors,
      scope.visitors,
      scope.transactions,
      scope.tradeEngagements
    );
    const anomalies = detectRecordAnomalies(exh, txs, trd, 2.0);
    const revForecast = forecasts.revenueUsd;
    kpis.push({
      label: `Projected ZITF ${revForecast.nextEditionYear} Revenue`,
      value: `${formatUsdCompact(revForecast.nextEditionForecast)} USD`,
      trend: `OLS R²=${revForecast.rSquared}`,
    });
    kpis.push({
      label: 'MAD Outliers Detected',
      value: `${anomalies.length} Records`,
      trend: '|z| ≥ 2.0',
    });
    summaryFindings += ` Algorithmic Forecast Append: Blended OLS+Holt model projects ${formatUsdCompact(
      revForecast.nextEditionForecast
    )} USD for ZITF ${revForecast.nextEditionYear} (R²=${revForecast.rSquared}), with ${
      anomalies.length
    } statistical record anomaly(ies) flagged for review.`;
    if (anomalies.length > 0) {
      recommendations.push(
        `Inspect top MAD outlier (${anomalies[0].recordRef}: ${anomalies[0].entityName}, z=${anomalies[0].zScore}σ) in Data Mining & Forecasting.`
      );
    }
  }

  return {
    id: `rep-sched-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    reportNumber: `ZITF-AUTO-${nowDate.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(
      100 + Math.random() * 899
    )}`,
    title: `[Scheduled ${schedule.frequency}] ${schedule.name} — ${editionTitle}`,
    pillar: schedule.pillar,
    editionId: schedule.editionId,
    generationDate: nowDate.toISOString().substring(0, 10),
    author: `Automated Scheduler (${schedule.recipients ? schedule.recipients.split(',')[0].trim() : 'ZITF BI Engine'})`,
    confidentiality: schedule.confidentiality,
    summaryFindings,
    kpis,
    recommendations,
    isDemo: false,
  };
}
