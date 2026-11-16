import {
  ExhibitionEdition,
  Exhibitor,
  Visitor,
  CommercialTransaction,
  TradeEngagement,
  HallUtilisation,
} from '../types';

export type ForecastTargetKey =
  | 'revenueUsd'
  | 'exhibitorsCount'
  | 'visitorsCount'
  | 'verifiedDealsUsd';

export interface EditionSeriesPoint {
  editionId: string;
  editionName: string;
  year: number;
  actual: number | null;
  regressionFitted: number;
  holtProjection: number;
  lower95: number | null;
  upper95: number | null;
  isForecast: boolean;
}

export interface ForecastModelResult {
  target: ForecastTargetKey;
  label: string;
  unit: 'USD' | 'Count';
  slopePerYear: number;
  intercept: number;
  rSquared: number;
  residualStdError: number;
  cagrPct: number;
  nextEditionYear: number;
  nextEditionForecast: number;
  nextEditionLower95: number;
  nextEditionUpper95: number;
  series: EditionSeriesPoint[];
}

export interface VelocityForecastPoint {
  date: string;
  dailyValue: number;
  cumulativeActual: number | null;
  movingAvg3: number | null;
  projectedCumulative: number | null;
  isForecast: boolean;
}

export interface ExhibitorClusterPoint {
  id: string;
  companyName: string;
  sector: string;
  country: string;
  standSizeSqm: number;
  invoicedUsd: number;
  satisfactionScore: number;
  isReturning: boolean;
  isUploadedBatch: boolean;
  clusterId: number;
  clusterLabel: string;
  color: string;
}

export interface ClusterProfile {
  clusterId: number;
  label: string;
  color: string;
  count: number;
  sharePct: number;
  avgStandSqm: number;
  avgInvoicedUsd: number;
  avgSatisfaction: number;
  retentionPct: number;
  totalRevenueUsd: number;
}

export interface KMeansResult {
  k: number;
  iterations: number;
  separationQualityPct: number;
  points: ExhibitorClusterPoint[];
  profiles: ClusterProfile[];
}

export interface AnomalyRecord {
  id: string;
  module: 'Commercial' | 'Exhibitors' | 'Trade';
  recordRef: string;
  entityName: string;
  metricName: string;
  observedValue: number;
  baselineMedian: number;
  zScore: number;
  deviationLabel: string;
  severity: 'Critical Outlier' | 'Moderate Anomaly';
  direction: 'High Spike' | 'Low Drop';
  isUploadedBatch: boolean;
  editionId: string;
  explanation: string;
}

export interface AssociationRule {
  id: string;
  domain: 'Exhibitor Retention' | 'Visitor Behaviour' | 'Trade Conversion';
  antecedent: string;
  consequent: string;
  supportCount: number;
  supportPct: number;
  confidencePct: number;
  lift: number;
}

export interface SectorMomentumRow {
  sector: string;
  exhibitorsCount: number;
  revenueUsd: number;
  tradePipelineUsd: number;
  avgSatisfaction: number;
  yoyGrowthPct: number;
  latestCount: number;
  priorCount: number;
  status: 'Accelerating' | 'High Growth' | 'Steady' | 'Contracting';
}

export interface ParetoSummary {
  totalClientsCount: number;
  top20PctClientCount: number;
  top20PctRevenueSharePct: number;
  clientsNeededFor80PctCount: number;
  clientsNeededFor80PctSharePct: number;
  hhiScore: number;
  hhiClassification: 'Competitive / Diversified' | 'Moderately Concentrated' | 'Highly Concentrated';
  curve: { rankPct: number; cumulativeRevenuePct: number; clientName: string; amountUsd: number }[];
}

export interface DataMiningInput {
  editions: ExhibitionEdition[];
  exhibitors: Exhibitor[];
  visitors: Visitor[];
  transactions: CommercialTransaction[];
  tradeEngagements: TradeEngagement[];
  hallUtilisation?: HallUtilisation[];
  /** Filtered slices for clustering, anomalies, rules, Pareto; edition forecasting always uses full editions */
  scopedExhibitors?: Exhibitor[];
  scopedVisitors?: Visitor[];
  scopedTransactions?: CommercialTransaction[];
  scopedTradeEngagements?: TradeEngagement[];
}

export interface DataMiningSuiteResult {
  generatedAt: string;
  datasetSummary: {
    totalRawRecords: number;
    uploadedBatchRecords: number;
    exhibitorsAnalyzed: number;
    visitorsAnalyzed: number;
    transactionsAnalyzed: number;
    tradeAnalyzed: number;
    editionsSpan: number;
  };
  forecasts: Record<ForecastTargetKey, ForecastModelResult>;
  cashflowVelocity: VelocityForecastPoint[];
  clustering: KMeansResult;
  anomalies: AnomalyRecord[];
  associationRules: AssociationRule[];
  pareto: ParetoSummary;
  sectorMomentum: SectorMomentumRow[];
}

const CLUSTER_COLORS = ['#0F2137', '#C69214', '#059669', '#7C3AED'];

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * Ordinary Least Squares Linear Regression: y = intercept + slope * x
 */
function fitOLS(xs: number[], ys: number[]): {
  slope: number;
  intercept: number;
  rSquared: number;
  residualStdError: number;
} {
  const n = xs.length;
  if (n === 0) return { slope: 0, intercept: 0, rSquared: 0, residualStdError: 0 };
  if (n === 1) return { slope: 0, intercept: ys[0], rSquared: 1, residualStdError: 0 };

  const xMean = mean(xs);
  const yMean = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    num += dx * (ys[i] - yMean);
    den += dx * dx;
  }

  const slope = den > 1e-9 ? num / den : 0;
  const intercept = yMean - slope * xMean;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * xs[i];
    ssRes += (ys[i] - pred) ** 2;
    ssTot += (ys[i] - yMean) ** 2;
  }

  const rSquared = ssTot > 1e-9 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 1;
  const df = Math.max(1, n - 2);
  const residualStdError = Math.sqrt(ssRes / df);

  return { slope, intercept, rSquared, residualStdError };
}

/**
 * Double Exponential Smoothing (Holt's Linear Trend) for short multi-edition series
 */
function computeHoltSeries(ys: number[], horizons: number, alpha = 0.65, beta = 0.35): {
  fitted: number[];
  forecasts: number[];
} {
  if (ys.length === 0) return { fitted: [], forecasts: Array(horizons).fill(0) };
  if (ys.length === 1) {
    return { fitted: [ys[0]], forecasts: Array(horizons).fill(ys[0]) };
  }

  let level = ys[0];
  let trend = ys[1] - ys[0];
  const fitted: number[] = [ys[0]];

  for (let i = 1; i < ys.length; i++) {
    const prevLevel = level;
    const prevTrend = trend;
    level = alpha * ys[i] + (1 - alpha) * (prevLevel + prevTrend);
    trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
    fitted.push(Math.max(0, prevLevel + prevTrend));
  }

  const forecasts: number[] = [];
  for (let h = 1; h <= horizons; h++) {
    // Lightly damp trend on longer horizons (phi = 0.9) to prevent runaway extrapolation
    const dampedSteps = h === 1 ? 1 : 1 + 0.9;
    forecasts.push(Math.max(0, level + dampedSteps * trend));
  }
  return { fitted, forecasts };
}

export function computeEditionForecasts(
  editions: ExhibitionEdition[],
  exhibitors: Exhibitor[],
  visitors: Visitor[],
  transactions: CommercialTransaction[],
  tradeEngagements: TradeEngagement[]
): Record<ForecastTargetKey, ForecastModelResult> {
  const sortedEditions = [...editions].sort((a, b) => a.year - b.year);

  const rawTable = sortedEditions.map((ed) => {
    const edExh = exhibitors.filter((e) => e.editionId === ed.id);
    const edVis = visitors.filter((v) => v.editionId === ed.id);
    const edTx = transactions.filter((t) => t.editionId === ed.id);
    const edTrade = tradeEngagements.filter((t) => t.editionId === ed.id);
    return {
      editionId: ed.id,
      editionName: ed.name,
      year: ed.year,
      revenueUsd: edTx.reduce((s, t) => s + (Number(t.amountUsd) || 0), 0),
      exhibitorsCount: edExh.length,
      visitorsCount: edVis.length,
      verifiedDealsUsd: edTrade
        .filter((t) => t.verificationStatus === 'Independently Verified')
        .reduce((s, t) => s + (Number(t.estimatedValueUsd) || 0), 0),
    };
  });

  const buildModel = (
    target: ForecastTargetKey,
    label: string,
    unit: 'USD' | 'Count'
  ): ForecastModelResult => {
    const years = rawTable.map((r) => r.year);
    const baseYear = years.length > 0 ? years[0] : new Date().getFullYear();
    const xs = years.map((y) => y - baseYear);
    const ys = rawTable.map((r) => r[target]);

    const ols = fitOLS(xs, ys);
    const holt = computeHoltSeries(ys, 2);

    const lastYear = years.length > 0 ? years[years.length - 1] : new Date().getFullYear();
    const xMean = mean(xs);
    const sxx = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
    const n = Math.max(1, xs.length);

    const series: EditionSeriesPoint[] = rawTable.map((row, idx) => {
      const regVal = Math.max(0, ols.intercept + ols.slope * xs[idx]);
      return {
        editionId: row.editionId,
        editionName: row.editionName,
        year: row.year,
        actual: row[target],
        regressionFitted: Math.round(regVal),
        holtProjection: Math.round(holt.fitted[idx] ?? regVal),
        lower95: null,
        upper95: null,
        isForecast: false,
      };
    });

    // Anchor CI visually on the final historical point
    if (series.length > 0) {
      const lastPt = series[series.length - 1];
      lastPt.lower95 = lastPt.actual;
      lastPt.upper95 = lastPt.actual;
    }

    const tCritical = n <= 3 ? 2.4 : 1.96;
    const futurePoints: EditionSeriesPoint[] = [1, 2].map((step) => {
      const futureYear = lastYear + step;
      const xFuture = futureYear - baseYear;
      const olsPred = Math.max(0, ols.intercept + ols.slope * xFuture);
      const holtPred = holt.forecasts[step - 1] ?? olsPred;
      // Blend 65% OLS linear trend + 35% Holt smoothed trend for robust small-N stability
      const blended = Math.max(0, 0.65 * olsPred + 0.35 * holtPred);
      const leverage = sxx > 0 ? 1 + 1 / n + ((xFuture - xMean) ** 2) / sxx : 1 + 0.15 * step;
      const fallbackBand = blended * 0.12 * step;
      const margin = Math.max(fallbackBand, tCritical * ols.residualStdError * Math.sqrt(leverage));

      return {
        editionId: `forecast-${futureYear}`,
        editionName: `ZITF ${futureYear} (Forecast)`,
        year: futureYear,
        actual: null,
        regressionFitted: Math.round(olsPred),
        holtProjection: Math.round(blended),
        lower95: Math.max(0, Math.round(blended - margin)),
        upper95: Math.round(blended + margin),
        isForecast: true,
      };
    });

    const firstVal = ys.find((v) => v > 0) || 0;
    const lastVal = ys[ys.length - 1] || 0;
    const spanYears = Math.max(1, (years[years.length - 1] || baseYear) - baseYear);
    const cagrPct =
      firstVal > 0 && lastVal > 0 && ys.length > 1
        ? Number((((lastVal / firstVal) ** (1 / spanYears) - 1) * 100).toFixed(1))
        : 0;

    return {
      target,
      label,
      unit,
      slopePerYear: Number(ols.slope.toFixed(2)),
      intercept: Number(ols.intercept.toFixed(2)),
      rSquared: Number(ols.rSquared.toFixed(3)),
      residualStdError: Number(ols.residualStdError.toFixed(2)),
      cagrPct,
      nextEditionYear: futurePoints[0].year,
      nextEditionForecast: futurePoints[0].holtProjection,
      nextEditionLower95: futurePoints[0].lower95 ?? 0,
      nextEditionUpper95: futurePoints[0].upper95 ?? 0,
      series: [...series, ...futurePoints],
    };
  };

  return {
    revenueUsd: buildModel('revenueUsd', 'Commercial Revenue Trajectory', 'USD'),
    exhibitorsCount: buildModel('exhibitorsCount', 'Exhibitor Participation Forecast', 'Count'),
    visitorsCount: buildModel('visitorsCount', 'Visitor Attendance Trajectory', 'Count'),
    verifiedDealsUsd: buildModel('verifiedDealsUsd', 'Verified B2B Trade Value', 'USD'),
  };
}

export function computeDailyVelocityForecast(transactions: CommercialTransaction[]): VelocityForecastPoint[] {
  const dated = transactions
    .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.paymentDate))
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));

  if (dated.length === 0) return [];

  const byDate = new Map<string, number>();
  for (const tx of dated) {
    byDate.set(tx.paymentDate, (byDate.get(tx.paymentDate) || 0) + (Number(tx.amountUsd) || 0));
  }

  const dates = Array.from(byDate.keys()).sort();
  let running = 0;
  const dailyVals: number[] = [];
  const points: VelocityForecastPoint[] = dates.map((d, idx) => {
    const val = byDate.get(d) || 0;
    running += val;
    dailyVals.push(val);
    const win = dailyVals.slice(Math.max(0, idx - 2), idx + 1);
    const ma = mean(win);
    return {
      date: d,
      dailyValue: Math.round(val),
      cumulativeActual: Math.round(running),
      movingAvg3: Math.round(ma),
      projectedCumulative: idx === dates.length - 1 ? Math.round(running) : null,
      isForecast: false,
    };
  });

  // OLS over cumulative index for next 3 booking periods
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.cumulativeActual || 0);
  const { slope, intercept } = fitOLS(xs, ys);
  const avgIncrement = Math.max(0, slope);
  const lastDate = new Date(dates[dates.length - 1] + 'T00:00:00Z');

  for (let step = 1; step <= 3; step++) {
    const nextDate = new Date(lastDate.getTime() + step * 7 * 86400000);
    const dateStr = nextDate.toISOString().slice(0, 10);
    const proj = Math.max(running, intercept + slope * (xs.length - 1 + step));
    points.push({
      date: `${dateStr} (Proj)`,
      dailyValue: Math.round(avgIncrement),
      cumulativeActual: null,
      movingAvg3: null,
      projectedCumulative: Math.round(proj),
      isForecast: true,
    });
  }

  return points;
}

/**
 * Deterministic K-Means++ Clustering over raw Exhibitor + matched Transaction records
 */
export function computeExhibitorKMeans(
  exhibitors: Exhibitor[],
  transactions: CommercialTransaction[],
  requestedK = 3
): KMeansResult {
  if (exhibitors.length === 0) {
    return { k: requestedK, iterations: 0, separationQualityPct: 0, points: [], profiles: [] };
  }

  const k = Math.max(2, Math.min(requestedK, exhibitors.length, 4));

  // Join transactions by exhibitorId or clientName
  const txByExhibitorId = new Map<string, number>();
  const txByClientName = new Map<string, number>();
  transactions.forEach((t) => {
    const amt = Number(t.amountUsd) || 0;
    if (t.exhibitorId) {
      txByExhibitorId.set(t.exhibitorId, (txByExhibitorId.get(t.exhibitorId) || 0) + amt);
    }
    const key = (t.clientName || '').trim().toLowerCase();
    if (key) {
      txByClientName.set(key, (txByClientName.get(key) || 0) + amt);
    }
  });

  const rawItems = exhibitors.map((ex) => {
    const directRev = txByExhibitorId.get(ex.id) || 0;
    const nameRev = txByClientName.get(ex.companyName.trim().toLowerCase()) || 0;
    // If no direct invoice exists, estimate spatial booking weight solely as secondary fallback signal = 0 invoiced
    const invoicedUsd = directRev > 0 ? directRev : nameRev;
    const tenure = Math.max(
      1,
      Array.isArray(ex.participationHistory) && ex.participationHistory.length > 0
        ? ex.participationHistory.length
        : ex.returningStatus === 'Returning'
        ? 2
        : 1
    );
    return {
      exhibitor: ex,
      features: [
        Number(ex.standSizeSqm) || 0,
        invoicedUsd,
        Number(ex.satisfactionScore) || 0,
        tenure,
      ],
      invoicedUsd,
    };
  });

  // Z-score normalize 4D feature matrix
  const dims = 4;
  const means = Array.from({ length: dims }, (_, d) => mean(rawItems.map((r) => r.features[d])));
  const stds = Array.from({ length: dims }, (_, d) => {
    const s = stdDev(rawItems.map((r) => r.features[d]));
    return s > 1e-6 ? s : 1;
  });

  const vectors = rawItems.map((r) => r.features.map((v, d) => (v - means[d]) / stds[d]));

  const sqDist = (a: number[], b: number[]) =>
    a.reduce((sum, val, idx) => sum + (val - b[idx]) ** 2, 0);

  // Deterministic K-Means++ seeding: pick highest L2 norm point, then iterative max-min distance
  const centroids: number[][] = [];
  let firstIdx = 0;
  let bestNorm = -1;
  vectors.forEach((v, idx) => {
    const norm = v.reduce((s, x) => s + x * x, 0);
    if (norm > bestNorm) {
      bestNorm = norm;
      firstIdx = idx;
    }
  });
  centroids.push([...vectors[firstIdx]]);

  while (centroids.length < k) {
    let farthestIdx = 0;
    let farthestDist = -1;
    vectors.forEach((v, idx) => {
      const minDist = Math.min(...centroids.map((c) => sqDist(v, c)));
      if (minDist > farthestDist) {
        farthestDist = minDist;
        farthestIdx = idx;
      }
    });
    centroids.push([...vectors[farthestIdx]]);
  }

  let assignments = new Array<number>(vectors.length).fill(0);
  let iterations = 0;

  for (let iter = 0; iter < 25; iter++) {
    iterations = iter + 1;
    let changed = false;

    const nextAssignments = vectors.map((v) => {
      let bestC = 0;
      let bestD = Infinity;
      centroids.forEach((c, cIdx) => {
        const d = sqDist(v, c);
        if (d < bestD) {
          bestD = d;
          bestC = cIdx;
        }
      });
      return bestC;
    });

    for (let i = 0; i < vectors.length; i++) {
      if (nextAssignments[i] !== assignments[i]) {
        changed = true;
        break;
      }
    }
    assignments = nextAssignments;

    // Recompute centroids
    for (let cIdx = 0; cIdx < k; cIdx++) {
      const members = vectors.filter((_, idx) => assignments[idx] === cIdx);
      if (members.length > 0) {
        for (let d = 0; d < dims; d++) {
          centroids[cIdx][d] = mean(members.map((m) => m[d]));
        }
      }
    }

    if (!changed) break;
  }

  // Compute Between-Cluster / Total Variance ratio (Calinski-style separation percentage)
  const globalCenter = Array.from({ length: dims }, (_, d) => mean(vectors.map((v) => v[d])));
  const tss = vectors.reduce((s, v) => s + sqDist(v, globalCenter), 0);
  const wss = vectors.reduce((s, v, idx) => s + sqDist(v, centroids[assignments[idx]]), 0);
  const separationQualityPct = tss > 1e-9 ? Number((((tss - wss) / tss) * 100).toFixed(1)) : 100;

  // Rank clusters by composite revenue & footprint weight so names are intuitive & deterministic
  const rawClusterIds = Array.from({ length: k }, (_, i) => i);
  const clusterRankScore = rawClusterIds.map((cId) => {
    const members = rawItems.filter((_, idx) => assignments[idx] === cId);
    const avgRev = mean(members.map((m) => m.invoicedUsd));
    const avgSqm = mean(members.map((m) => m.exhibitor.standSizeSqm));
    return { cId, score: avgRev * 0.01 + avgSqm, count: members.length };
  });
  clusterRankScore.sort((a, b) => b.score - a.score);

  const labelPalette =
    k === 2
      ? ['Anchor / Strategic Tier', 'Standard & Emerging Cohort']
      : k === 3
      ? ['Anchor High-Yield Tier', 'Growth Mid-Market Cohort', 'Emerging / Small Stand Tier']
      : ['Anchor Pavilion Leaders', 'Established Commercial Core', 'Growth & SME Segment', 'Entry / Retention Watch'];

  const remap = new Map<number, { newId: number; label: string; color: string }>();
  clusterRankScore.forEach((item, rankIdx) => {
    remap.set(item.cId, {
      newId: rankIdx,
      label: labelPalette[rankIdx] || `Cluster ${rankIdx + 1}`,
      color: CLUSTER_COLORS[rankIdx % CLUSTER_COLORS.length],
    });
  });

  const points: ExhibitorClusterPoint[] = rawItems.map((item, idx) => {
    const meta = remap.get(assignments[idx])!;
    return {
      id: item.exhibitor.id,
      companyName: item.exhibitor.companyName,
      sector: item.exhibitor.sector,
      country: item.exhibitor.country,
      standSizeSqm: item.exhibitor.standSizeSqm,
      invoicedUsd: item.invoicedUsd,
      satisfactionScore: item.exhibitor.satisfactionScore,
      isReturning: item.exhibitor.returningStatus === 'Returning',
      isUploadedBatch: item.exhibitor.isDemo === false,
      clusterId: meta.newId,
      clusterLabel: meta.label,
      color: meta.color,
    };
  });

  const profiles: ClusterProfile[] = Array.from({ length: k }, (_, newId) => {
    const members = points.filter((p) => p.clusterId === newId);
    const label = labelPalette[newId] || `Cluster ${newId + 1}`;
    const color = CLUSTER_COLORS[newId % CLUSTER_COLORS.length];
    return {
      clusterId: newId,
      label,
      color,
      count: members.length,
      sharePct: points.length > 0 ? Number(((members.length / points.length) * 100).toFixed(1)) : 0,
      avgStandSqm: Number(mean(members.map((m) => m.standSizeSqm)).toFixed(1)),
      avgInvoicedUsd: Math.round(mean(members.map((m) => m.invoicedUsd))),
      avgSatisfaction: Number(mean(members.map((m) => m.satisfactionScore)).toFixed(2)),
      retentionPct:
        members.length > 0
          ? Number(((members.filter((m) => m.isReturning).length / members.length) * 100).toFixed(1))
          : 0,
      totalRevenueUsd: Math.round(members.reduce((s, m) => s + m.invoicedUsd, 0)),
    };
  }).filter((p) => p.count > 0);

  return { k: profiles.length, iterations, separationQualityPct, points, profiles };
}

/**
 * Robust Modified Z-Score (Median + MAD) with StdDev fallback for detecting raw anomalies
 */
function computeRobustZScores(values: number[]): { med: number; zScores: number[] } {
  if (values.length < 3) return { med: median(values), zScores: values.map(() => 0) };
  const med = median(values);
  const absDevs = values.map((v) => Math.abs(v - med));
  const mad = median(absDevs);

  if (mad > 1e-6) {
    // Iglewicz & Hoaglin modified z-score constant 0.6745
    return {
      med,
      zScores: values.map((v) => (0.6745 * (v - med)) / mad),
    };
  }

  const sd = stdDev(values);
  if (sd > 1e-6) {
    const m = mean(values);
    return { med, zScores: values.map((v) => (v - m) / sd) };
  }

  return { med, zScores: values.map(() => 0) };
}

export function detectRecordAnomalies(
  exhibitors: Exhibitor[],
  transactions: CommercialTransaction[],
  tradeEngagements: TradeEngagement[],
  zThreshold = 2.0
): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = [];

  // 1. Commercial Transaction Amounts
  if (transactions.length >= 3) {
    const amounts = transactions.map((t) => Number(t.amountUsd) || 0);
    const { med, zScores } = computeRobustZScores(amounts);
    transactions.forEach((tx, idx) => {
      const z = zScores[idx];
      if (Math.abs(z) >= zThreshold) {
        const direction = z >= 0 ? 'High Spike' : 'Low Drop';
        const ratio = med > 0 ? (tx.amountUsd / med).toFixed(1) : 'N/A';
        anomalies.push({
          id: `anom-tx-${tx.id}`,
          module: 'Commercial',
          recordRef: tx.refNumber,
          entityName: tx.clientName,
          metricName: 'Invoice Value (USD)',
          observedValue: tx.amountUsd,
          baselineMedian: Math.round(med),
          zScore: Number(z.toFixed(2)),
          deviationLabel: `${ratio}x median ($${Math.round(med).toLocaleString()})`,
          severity: Math.abs(z) >= zThreshold + 1.0 ? 'Critical Outlier' : 'Moderate Anomaly',
          direction,
          isUploadedBatch: tx.isDemo === false,
          editionId: tx.editionId,
          explanation:
            direction === 'High Spike'
              ? `Invoice ${tx.refNumber} ($${tx.amountUsd.toLocaleString()}) exceeds commercial median by ${ratio}x (|z|=${Math.abs(z).toFixed(2)}).`
              : `Invoice ${tx.refNumber} ($${tx.amountUsd.toLocaleString()}) is unusually small relative to commercial median.`,
        });
      }
    });
  }

  // 2. Exhibitor Stand Area & Low Satisfaction Outliers
  if (exhibitors.length >= 3) {
    const areas = exhibitors.map((e) => Number(e.standSizeSqm) || 0);
    const { med: areaMed, zScores: areaZs } = computeRobustZScores(areas);
    exhibitors.forEach((ex, idx) => {
      const z = areaZs[idx];
      if (Math.abs(z) >= zThreshold) {
        const direction = z >= 0 ? 'High Spike' : 'Low Drop';
        const ratio = areaMed > 0 ? (ex.standSizeSqm / areaMed).toFixed(1) : 'N/A';
        anomalies.push({
          id: `anom-exh-sqm-${ex.id}`,
          module: 'Exhibitors',
          recordRef: ex.regNumber,
          entityName: ex.companyName,
          metricName: 'Stand Footprint (sqm)',
          observedValue: ex.standSizeSqm,
          baselineMedian: Math.round(areaMed),
          zScore: Number(z.toFixed(2)),
          deviationLabel: `${ratio}x median (${Math.round(areaMed)} sqm)`,
          severity: Math.abs(z) >= zThreshold + 1.0 ? 'Critical Outlier' : 'Moderate Anomaly',
          direction,
          isUploadedBatch: ex.isDemo === false,
          editionId: ex.editionId,
          explanation: `Stand allocation of ${ex.standSizeSqm} sqm deviates sharply from edition median (${Math.round(areaMed)} sqm).`,
        });
      }
    });

    const sats = exhibitors.map((e) => Number(e.satisfactionScore) || 0);
    const { med: satMed, zScores: satZs } = computeRobustZScores(sats);
    exhibitors.forEach((ex, idx) => {
      const z = satZs[idx];
      if (z <= -zThreshold) {
        anomalies.push({
          id: `anom-exh-sat-${ex.id}`,
          module: 'Exhibitors',
          recordRef: ex.regNumber,
          entityName: ex.companyName,
          metricName: 'Satisfaction Score (/5)',
          observedValue: ex.satisfactionScore,
          baselineMedian: Number(satMed.toFixed(1)),
          zScore: Number(z.toFixed(2)),
          deviationLabel: `${ex.satisfactionScore}/5 vs ${satMed.toFixed(1)} median`,
          severity: ex.satisfactionScore <= 2.5 ? 'Critical Outlier' : 'Moderate Anomaly',
          direction: 'Low Drop',
          isUploadedBatch: ex.isDemo === false,
          editionId: ex.editionId,
          explanation: `Exhibitor churn risk: satisfaction score ${ex.satisfactionScore}/5 sits significantly below cohort median (${satMed.toFixed(1)}).`,
        });
      }
    });
  }

  // 3. Trade Engagement Deal Valuations
  if (tradeEngagements.length >= 3) {
    const vals = tradeEngagements.map((t) => Number(t.estimatedValueUsd) || 0);
    const { med: trdMed, zScores: trdZs } = computeRobustZScores(vals);
    tradeEngagements.forEach((tr, idx) => {
      const z = trdZs[idx];
      if (Math.abs(z) >= zThreshold) {
        const direction = z >= 0 ? 'High Spike' : 'Low Drop';
        const ratio = trdMed > 0 ? (tr.estimatedValueUsd / trdMed).toFixed(1) : 'N/A';
        anomalies.push({
          id: `anom-trd-${tr.id}`,
          module: 'Trade',
          recordRef: tr.refNumber,
          entityName: `${tr.buyerOrg} ↔ ${tr.supplierOrg}`,
          metricName: 'Deal Valuation (USD)',
          observedValue: tr.estimatedValueUsd,
          baselineMedian: Math.round(trdMed),
          zScore: Number(z.toFixed(2)),
          deviationLabel: `${ratio}x median ($${Math.round(trdMed).toLocaleString()})`,
          severity: Math.abs(z) >= zThreshold + 1.0 ? 'Critical Outlier' : 'Moderate Anomaly',
          direction,
          isUploadedBatch: tr.isDemo === false,
          editionId: tr.editionId,
          explanation: `B2B engagement ${tr.refNumber} valued at $${tr.estimatedValueUsd.toLocaleString()} stands ${ratio}x above median deal size (${tr.verificationStatus}).`,
        });
      }
    });
  }

  return anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

/**
 * Apriori-style single-antecedent -> single-consequent Association Rule Mining
 */
export function mineAssociationRules(
  exhibitors: Exhibitor[],
  visitors: Visitor[],
  tradeEngagements: TradeEngagement[]
): AssociationRule[] {
  const rules: AssociationRule[] = [];

  const mineBaskets = (
    domain: AssociationRule['domain'],
    baskets: { antecedents: string[]; consequents: string[] }[]
  ) => {
    const n = baskets.length;
    if (n < 3) return;
    const minSupCount = Math.max(2, Math.ceil(n * 0.12));

    const antCounts = new Map<string, number>();
    const conCounts = new Map<string, number>();
    const pairCounts = new Map<string, number>();

    baskets.forEach((b) => {
      const uniqA = Array.from(new Set(b.antecedents));
      const uniqC = Array.from(new Set(b.consequents));
      uniqA.forEach((a) => antCounts.set(a, (antCounts.get(a) || 0) + 1));
      uniqC.forEach((c) => conCounts.set(c, (conCounts.get(c) || 0) + 1));
      uniqA.forEach((a) => {
        uniqC.forEach((c) => {
          const key = `${a}|||${c}`;
          pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
        });
      });
    });

    pairCounts.forEach((bothCount, key) => {
      if (bothCount < minSupCount) return;
      const [antecedent, consequent] = key.split('|||');
      const aCount = antCounts.get(antecedent) || 0;
      const cCount = conCounts.get(consequent) || 0;
      if (aCount === 0 || cCount === 0) return;

      const support = bothCount / n;
      const confidence = bothCount / aCount;
      const expectedProb = cCount / n;
      const lift = expectedProb > 0 ? confidence / expectedProb : 0;

      if (confidence >= 0.45 && lift >= 1.05) {
        rules.push({
          id: `rule-${domain}-${rules.length + 1}`,
          domain,
          antecedent,
          consequent,
          supportCount: bothCount,
          supportPct: Number((support * 100).toFixed(1)),
          confidencePct: Number((confidence * 100).toFixed(1)),
          lift: Number(lift.toFixed(2)),
        });
      }
    });
  };

  // 1. Exhibitor retention & satisfaction rules
  mineBaskets(
    'Exhibitor Retention',
    exhibitors.map((e) => ({
      antecedents: [
        `Sector: ${e.sector}`,
        `Category: ${e.category}`,
        e.standSizeSqm >= 36 ? 'Large Stand (>=36 sqm)' : 'Compact Stand (<36 sqm)',
        e.country.trim().toLowerCase() === 'zimbabwe' ? 'Origin: Domestic (ZW)' : 'Origin: International',
      ],
      consequents: [
        e.returningStatus === 'Returning' ? 'Outcome: Returning Exhibitor' : 'Outcome: First-Time Exhibitor',
        e.satisfactionScore >= 4.4 ? 'Rating: High Satisfaction (>=4.4)' : 'Rating: Standard Satisfaction (<4.4)',
        e.paymentStatus === 'Fully Paid' ? 'Payment: Settled in Full' : 'Payment: Receivables Open',
      ],
    }))
  );

  // 2. Visitor engagement rules
  mineBaskets(
    'Visitor Behaviour',
    visitors.map((v) => ({
      antecedents: [
        `Segment: ${v.category}`,
        ...(v.interests || []).slice(0, 2).map((i) => `Interest: ${i}`),
        v.attendanceDays.length >= 2 ? 'Multi-Day Attendance (>=2d)' : 'Single-Day Visit',
      ],
      consequents: [
        v.repeatVisitor ? 'Loyalty: Repeat Delegate' : 'Loyalty: New Visitor',
        v.feedbackRating >= 4.5 ? 'Feedback: Promoter (>=4.5)' : 'Feedback: Standard (<4.5)',
      ],
    }))
  );

  // 3. Trade engagement conversion rules
  mineBaskets(
    'Trade Conversion',
    tradeEngagements.map((t) => ({
      antecedents: [
        `Industry: ${t.industry}`,
        `Deal Type: ${t.opportunityType}`,
        `Buyer: ${t.buyerCountry}`,
      ],
      consequents: [
        t.engagementStatus === 'Opportunity Converted'
          ? 'Stage: Converted Contract'
          : 'Stage: Active Negotiation/Pipeline',
        t.verificationStatus === 'Independently Verified'
          ? 'Audit: Independently Verified'
          : `Audit: ${t.verificationStatus}`,
      ],
    }))
  );

  return rules.sort((a, b) => b.lift * b.confidencePct - a.lift * a.confidencePct).slice(0, 18);
}

/**
 * Computes Pareto 80/20 distribution, HHI concentration, and live YoY Sector Momentum
 */
export function computeConcentrationAndSectorMomentum(
  editions: ExhibitionEdition[],
  allExhibitors: Exhibitor[],
  scopedExhibitors: Exhibitor[],
  scopedTransactions: CommercialTransaction[],
  scopedTrade: TradeEngagement[]
): { pareto: ParetoSummary; sectorMomentum: SectorMomentumRow[] } {
  // Pareto over client revenue
  const byClient = new Map<string, number>();
  scopedTransactions.forEach((tx) => {
    const client = tx.clientName || 'Unknown Client';
    byClient.set(client, (byClient.get(client) || 0) + (Number(tx.amountUsd) || 0));
  });

  const sortedClients = Array.from(byClient.entries())
    .map(([clientName, amountUsd]) => ({ clientName, amountUsd }))
    .sort((a, b) => b.amountUsd - a.amountUsd);

  const totalRev = sortedClients.reduce((s, c) => s + c.amountUsd, 0);
  let cumRev = 0;
  let clientsNeededFor80PctCount = 0;
  const curve = sortedClients.map((c, idx) => {
    cumRev += c.amountUsd;
    const cumPct = totalRev > 0 ? (cumRev / totalRev) * 100 : 0;
    if (clientsNeededFor80PctCount === 0 && cumPct >= 80) {
      clientsNeededFor80PctCount = idx + 1;
    }
    return {
      rankPct: Number((((idx + 1) / sortedClients.length) * 100).toFixed(1)),
      cumulativeRevenuePct: Number(cumPct.toFixed(1)),
      clientName: c.clientName,
      amountUsd: Math.round(c.amountUsd),
    };
  });

  const top20PctClientCount = sortedClients.length > 0 ? Math.max(1, Math.ceil(sortedClients.length * 0.2)) : 0;
  const top20Rev = sortedClients.slice(0, top20PctClientCount).reduce((s, c) => s + c.amountUsd, 0);
  const top20PctRevenueSharePct = totalRev > 0 ? Number(((top20Rev / totalRev) * 100).toFixed(1)) : 0;
  const clientsNeededFor80PctSharePct =
    sortedClients.length > 0 ? Number(((clientsNeededFor80PctCount / sortedClients.length) * 100).toFixed(1)) : 0;

  // HHI on Exhibitor Sectors (0 to 10,000)
  const sectorCounts = new Map<string, number>();
  scopedExhibitors.forEach((e) => {
    const s = e.sector || 'Unclassified';
    sectorCounts.set(s, (sectorCounts.get(s) || 0) + 1);
  });
  const totalExh = scopedExhibitors.length;
  let hhi = 0;
  if (totalExh > 0) {
    sectorCounts.forEach((cnt) => {
      const sharePct = (cnt / totalExh) * 100;
      hhi += sharePct * sharePct;
    });
  }
  const hhiScore = Math.round(hhi);
  const hhiClassification: ParetoSummary['hhiClassification'] =
    hhiScore >= 2500
      ? 'Highly Concentrated'
      : hhiScore >= 1500
      ? 'Moderately Concentrated'
      : 'Competitive / Diversified';

  // Sector Momentum comparing latest two editions in raw SQLite records
  const sortedEds = [...editions].sort((a, b) => b.year - a.year);
  const latestEd = sortedEds[0];
  const priorEd = sortedEds[1];

  const allSectorKeys = new Set<string>();
  scopedExhibitors.forEach((e) => allSectorKeys.add(e.sector || 'Unclassified'));
  allExhibitors.forEach((e) => allSectorKeys.add(e.sector || 'Unclassified'));
  scopedTransactions.forEach((t) => {
    if (t.sector && t.sector !== 'Cross-Sector') allSectorKeys.add(t.sector);
  });

  const sectorMomentum: SectorMomentumRow[] = Array.from(allSectorKeys)
    .map((sector) => {
      const exhInScope = scopedExhibitors.filter((e) => (e.sector || 'Unclassified') === sector);
      const revInScope = scopedTransactions
        .filter((t) => t.sector === sector)
        .reduce((s, t) => s + (Number(t.amountUsd) || 0), 0);
      const tradeInScope = scopedTrade
        .filter((t) => t.industry === sector)
        .reduce((s, t) => s + (Number(t.estimatedValueUsd) || 0), 0);

      const latestCount = latestEd
        ? allExhibitors.filter((e) => e.editionId === latestEd.id && e.sector === sector).length
        : exhInScope.length;
      const priorCount = priorEd
        ? allExhibitors.filter((e) => e.editionId === priorEd.id && e.sector === sector).length
        : 0;

      const yoyGrowthPct =
        priorCount > 0
          ? Number((((latestCount - priorCount) / priorCount) * 100).toFixed(1))
          : latestCount > 0
          ? 100.0
          : 0;

      const status: SectorMomentumRow['status'] =
        yoyGrowthPct >= 25
          ? 'Accelerating'
          : yoyGrowthPct > 0
          ? 'High Growth'
          : yoyGrowthPct === 0
          ? 'Steady'
          : 'Contracting';

      return {
        sector,
        exhibitorsCount: exhInScope.length,
        revenueUsd: Math.round(revInScope),
        tradePipelineUsd: Math.round(tradeInScope),
        avgSatisfaction:
          exhInScope.length > 0
            ? Number(mean(exhInScope.map((e) => Number(e.satisfactionScore) || 0)).toFixed(2))
            : 0,
        yoyGrowthPct,
        latestCount,
        priorCount,
        status,
      };
    })
    .filter((r) => r.exhibitorsCount > 0 || r.revenueUsd > 0 || r.latestCount > 0)
    .sort((a, b) => b.yoyGrowthPct - a.yoyGrowthPct || b.exhibitorsCount - a.exhibitorsCount);

  return {
    pareto: {
      totalClientsCount: sortedClients.length,
      top20PctClientCount,
      top20PctRevenueSharePct,
      clientsNeededFor80PctCount,
      clientsNeededFor80PctSharePct,
      hhiScore,
      hhiClassification,
      curve,
    },
    sectorMomentum,
  };
}

export function runDataMiningSuite(
  input: DataMiningInput,
  options?: { kClusters?: number; anomalyZThreshold?: number }
): DataMiningSuiteResult {
  const kClusters = options?.kClusters ?? 3;
  const anomalyZThreshold = options?.anomalyZThreshold ?? 2.0;

  const scopedExh = input.scopedExhibitors ?? input.exhibitors;
  const scopedVis = input.scopedVisitors ?? input.visitors;
  const scopedTx = input.scopedTransactions ?? input.transactions;
  const scopedTrade = input.scopedTradeEngagements ?? input.tradeEngagements;

  const totalRawRecords =
    scopedExh.length + scopedVis.length + scopedTx.length + scopedTrade.length;
  const uploadedBatchRecords =
    scopedExh.filter((r) => r.isDemo === false).length +
    scopedVis.filter((r) => r.isDemo === false).length +
    scopedTx.filter((r) => r.isDemo === false).length +
    scopedTrade.filter((r) => r.isDemo === false).length;

  const forecasts = computeEditionForecasts(
    input.editions,
    input.exhibitors,
    input.visitors,
    input.transactions,
    input.tradeEngagements
  );

  const cashflowVelocity = computeDailyVelocityForecast(scopedTx);
  const clustering = computeExhibitorKMeans(scopedExh, scopedTx, kClusters);
  const anomalies = detectRecordAnomalies(scopedExh, scopedTx, scopedTrade, anomalyZThreshold);
  const associationRules = mineAssociationRules(scopedExh, scopedVis, scopedTrade);
  const { pareto, sectorMomentum } = computeConcentrationAndSectorMomentum(
    input.editions,
    input.exhibitors,
    scopedExh,
    scopedTx,
    scopedTrade
  );

  return {
    generatedAt: new Date().toISOString(),
    datasetSummary: {
      totalRawRecords,
      uploadedBatchRecords,
      exhibitorsAnalyzed: scopedExh.length,
      visitorsAnalyzed: scopedVis.length,
      transactionsAnalyzed: scopedTx.length,
      tradeAnalyzed: scopedTrade.length,
      editionsSpan: input.editions.length,
    },
    forecasts,
    cashflowVelocity,
    clustering,
    anomalies,
    associationRules,
    pareto,
    sectorMomentum,
  };
}
