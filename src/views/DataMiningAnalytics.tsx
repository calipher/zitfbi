import React, { useMemo, useState } from 'react';
import { useBI } from '../context/BIContext';
import { FilterBar } from '../components/common/FilterBar';
import { MetricCard } from '../components/common/MetricCard';
import { ShareCollaborateModal } from '../components/common/ShareCollaborateModal';
import { formatUsdCompact } from '../utils/formatters';
import {
  runDataMiningSuite,
  ForecastTargetKey,
  AnomalyRecord,
  AssociationRule,
} from '../utils/dataMiningEngine';
import {
  Cpu,
  TrendingUp,
  AlertTriangle,
  Network,
  Layers,
  Download,
  SlidersHorizontal,
  Database,
  ArrowUpRight,
  CheckCircle2,
  BarChart3,
  Share2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  ReferenceLine,
} from 'recharts';

type MiningLens = 'forecast' | 'clusters' | 'anomalies' | 'rules';

export const DataMiningAnalytics: React.FC<{ onNavigate?: (tab: string) => void }> = ({
  onNavigate,
}) => {
  const {
    editions,
    exhibitors,
    visitors,
    transactions,
    tradeEngagements,
    hallUtilisation,
    filteredExhibitors,
    filteredVisitors,
    filteredTransactions,
    filteredTradeEngagements,
    selectedEditionId,
  } = useBI();

  const [activeLens, setActiveLens] = useState<MiningLens>('forecast');
  const [forecastTarget, setForecastTarget] = useState<ForecastTargetKey>('revenueUsd');
  const [kClusters, setKClusters] = useState<number>(3);
  const [zThreshold, setZThreshold] = useState<number>(2.0);
  const [anomalyModuleFilter, setAnomalyModuleFilter] = useState<'All' | 'Commercial' | 'Exhibitors' | 'Trade'>('All');
  const [ruleDomainFilter, setRuleDomainFilter] = useState<'All' | AssociationRule['domain']>('All');
  const [selectedClusterFilter, setSelectedClusterFilter] = useState<number | 'all'>('all');
  const [isShareOpen, setIsShareOpen] = useState(false);

  const currentEditionObj = editions.find((e) => e.id === selectedEditionId);
  const editionTitle = currentEditionObj ? currentEditionObj.name : 'All Editions';

  // Run full deterministic algorithmic mining suite reactively over live SQLite state + filters
  const miningResult = useMemo(
    () =>
      runDataMiningSuite(
        {
          editions,
          exhibitors,
          visitors,
          transactions,
          tradeEngagements,
          hallUtilisation,
          scopedExhibitors: filteredExhibitors,
          scopedVisitors: filteredVisitors,
          scopedTransactions: filteredTransactions,
          scopedTradeEngagements: filteredTradeEngagements,
        },
        { kClusters, anomalyZThreshold: zThreshold }
      ),
    [
      editions,
      exhibitors,
      visitors,
      transactions,
      tradeEngagements,
      hallUtilisation,
      filteredExhibitors,
      filteredVisitors,
      filteredTransactions,
      filteredTradeEngagements,
      kClusters,
      zThreshold,
    ]
  );

  const activeForecast = miningResult.forecasts[forecastTarget];

  const displayedAnomalies = useMemo(() => {
    if (anomalyModuleFilter === 'All') return miningResult.anomalies;
    return miningResult.anomalies.filter((a) => a.module === anomalyModuleFilter);
  }, [miningResult.anomalies, anomalyModuleFilter]);

  const displayedRules = useMemo(() => {
    if (ruleDomainFilter === 'All') return miningResult.associationRules;
    return miningResult.associationRules.filter((r) => r.domain === ruleDomainFilter);
  }, [miningResult.associationRules, ruleDomainFilter]);

  const displayedClusterPoints = useMemo(() => {
    if (selectedClusterFilter === 'all') return miningResult.clustering.points;
    return miningResult.clustering.points.filter((p) => p.clusterId === selectedClusterFilter);
  }, [miningResult.clustering.points, selectedClusterFilter]);

  const formatMetricValue = (val: number, unit: 'USD' | 'Count') =>
    unit === 'USD' ? formatUsdCompact(val) : val.toLocaleString();

  const handleExportMiningJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(miningResult, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `ZITF_DataMining_Forecast_${selectedEditionId}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleExportAnomaliesCsv = () => {
    const header = [
      'Module',
      'Reference',
      'Entity',
      'Metric',
      'Observed',
      'BaselineMedian',
      'ZScore',
      'Severity',
      'Direction',
      'Source',
      'Explanation',
    ];
    const rows = miningResult.anomalies.map((a: AnomalyRecord) => [
      a.module,
      a.recordRef,
      `"${a.entityName.replace(/"/g, '""')}"`,
      a.metricName,
      a.observedValue,
      a.baselineMedian,
      a.zScore,
      a.severity,
      a.direction,
      a.isUploadedBatch ? 'Uploaded CSV/API' : 'Warehouse Baseline',
      `"${a.explanation.replace(/"/g, '""')}"`,
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + [header, ...rows].map((r) => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `ZITF_Statistical_Anomalies_${selectedEditionId}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Transform forecast series to support Confidence Interval stacked area (base + band width)
  const forecastChartData = useMemo(
    () =>
      activeForecast.series.map((pt) => {
        const lower = pt.lower95 ?? null;
        const upper = pt.upper95 ?? null;
        return {
          ...pt,
          ciRange: lower !== null && upper !== null ? [lower, upper] : undefined,
        };
      }),
    [activeForecast]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Algorithmic Data Mining &amp; Predictive Forecasting
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
              {editionTitle}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Live OLS regression forecasting, K-Means++ clustering, MAD anomaly detection, and Apriori association mining over raw SQLite warehouse records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsShareOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share / Email Forecast</span>
          </button>
          {onNavigate && (
            <button
              onClick={() => onNavigate('data')}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-amber-600" />
              <span>Upload Raw CSV / API Feed</span>
            </button>
          )}
          <button
            onClick={handleExportAnomaliesCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export Outliers CSV</span>
          </button>
          <button
            onClick={handleExportMiningJson}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export Mined Model JSON</span>
          </button>
        </div>
      </div>

      {/* Global Context FilterBar */}
      <FilterBar
        totalFilteredCount={miningResult.datasetSummary.totalRawRecords}
        totalLabel="Raw Warehouse Records Mined"
      />

      {/* Live Dataset Coverage Strip */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs border border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="font-bold text-white flex items-center gap-2">
              <span>Live SQLite Computation Engine</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Zero Static Forecasts
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Analyzing {miningResult.datasetSummary.exhibitorsAnalyzed} exhibitors ·{' '}
              {miningResult.datasetSummary.visitorsAnalyzed} visitors ·{' '}
              {miningResult.datasetSummary.transactionsAnalyzed} invoices ·{' '}
              {miningResult.datasetSummary.tradeAnalyzed} trade deals across {miningResult.datasetSummary.editionsSpan} editions
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono">
          <div className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700">
            <span className="text-slate-400">Uploaded Batch Rows: </span>
            <span className="text-amber-400 font-bold">{miningResult.datasetSummary.uploadedBatchRecords}</span>
          </div>
          <div className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700">
            <span className="text-slate-400">Endpoint: </span>
            <span className="text-emerald-300">/api/analytics/mining</span>
          </div>
        </div>
      </div>

      {/* Top Executive Mining KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <MetricCard
          title={`${activeForecast.nextEditionYear} Forecast (${activeForecast.unit === 'USD' ? 'Revenue' : 'Volume'})`}
          value={formatMetricValue(activeForecast.nextEditionForecast, activeForecast.unit)}
          previousValue={`R² = ${activeForecast.rSquared}`}
          changePct={activeForecast.cagrPct}
          icon={TrendingUp}
          badge={`R² Fit: ${activeForecast.rSquared}`}
          badgeVariant={activeForecast.rSquared >= 0.7 ? 'emerald' : 'amber'}
          targetValue={`95% CI Upper: ${formatMetricValue(activeForecast.nextEditionUpper95, activeForecast.unit)}`}
          targetProgress={Math.round(activeForecast.rSquared * 100)}
          breakdown={[
            {
              label: 'OLS Slope/Yr',
              value:
                activeForecast.unit === 'USD'
                  ? `${activeForecast.slopePerYear >= 0 ? '+' : ''}${formatUsdCompact(activeForecast.slopePerYear)}`
                  : `${activeForecast.slopePerYear >= 0 ? '+' : ''}${activeForecast.slopePerYear}`,
            },
            {
              label: '95% Lower',
              value: formatMetricValue(activeForecast.nextEditionLower95, activeForecast.unit),
            },
          ]}
          insight={`Blended OLS + Holt projection for ZITF ${activeForecast.nextEditionYear} computed strictly from raw multi-edition SQLite records.`}
          subtitle={activeForecast.label}
        />

        <MetricCard
          title="K-Means++ Clusters"
          value={`${miningResult.clustering.k} Tiers`}
          previousValue={`${miningResult.clustering.iterations} iters`}
          icon={Layers}
          badge={`${miningResult.clustering.separationQualityPct}% Separation`}
          badgeVariant="blue"
          targetValue="100% Assignment"
          targetProgress={Math.min(100, Math.round(miningResult.clustering.separationQualityPct))}
          breakdown={miningResult.clustering.profiles.slice(0, 2).map((p) => ({
            label: p.label.split(' ')[0],
            value: `${p.count} cos`,
          }))}
          insight={`Z-score normalized 4D clustering (stand sqm, revenue, satisfaction, tenure) across ${miningResult.clustering.points.length} exhibitors.`}
          subtitle="Unsupervised Segmentation"
        />

        <MetricCard
          title="Statistical Outliers"
          value={`${miningResult.anomalies.length} Flagged`}
          previousValue={`|z| ≥ ${zThreshold.toFixed(1)}`}
          icon={AlertTriangle}
          badge={`${miningResult.anomalies.filter((a) => a.severity === 'Critical Outlier').length} Critical`}
          badgeVariant={miningResult.anomalies.some((a) => a.severity === 'Critical Outlier') ? 'amber' : 'emerald'}
          breakdown={[
            {
              label: 'Commercial',
              value: `${miningResult.anomalies.filter((a) => a.module === 'Commercial').length}`,
            },
            {
              label: 'Uploaded Rows',
              value: `${miningResult.anomalies.filter((a) => a.isUploadedBatch).length}`,
            },
          ]}
          insight={`Modified Z-Score (Median Absolute Deviation) scanner isolating spikes, drops, and churn risk in raw records.`}
          subtitle="MAD / IQR Anomaly Radar"
        />

        <MetricCard
          title="Mined Rules & HHI"
          value={`${miningResult.associationRules.length} Rules`}
          previousValue={`HHI ${miningResult.pareto.hhiScore}`}
          icon={Network}
          badge={miningResult.pareto.hhiClassification.split(' ')[0]}
          badgeVariant={miningResult.pareto.hhiScore < 1500 ? 'emerald' : 'purple'}
          breakdown={[
            {
              label: 'Top 20% Rev',
              value: `${miningResult.pareto.top20PctRevenueSharePct}%`,
            },
            {
              label: 'Peak Lift',
              value:
                miningResult.associationRules.length > 0
                  ? `${miningResult.associationRules[0].lift}x`
                  : 'N/A',
            },
          ]}
          insight={`Apriori co-occurrence rules paired with Herfindahl-Hirschman sector concentration (HHI=${miningResult.pareto.hhiScore}).`}
          subtitle="Co-Occurrence & Pareto 80/20"
        />
      </div>

      {/* Lens Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-1">
        {(
          [
            { id: 'forecast', label: 'Predictive Forecasting (OLS & Holt)', icon: TrendingUp },
            { id: 'clusters', label: 'K-Means++ Exhibitor Clustering', icon: Layers },
            { id: 'anomalies', label: `Statistical Anomaly Radar (${miningResult.anomalies.length})`, icon: AlertTriangle },
            { id: 'rules', label: 'Association Rules & Pareto 80/20', icon: Network },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeLens === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveLens(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                active
                  ? 'border-amber-600 text-slate-900 bg-amber-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* LENS 1: PREDICTIVE FORECASTING (OLS + HOLT + VELOCITY)              */}
      {/* =================================================================== */}
      {activeLens === 'forecast' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Main Multi-Edition Forecast Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Multi-Edition Trend Regression &amp; {activeForecast.nextEditionYear}–{activeForecast.nextEditionYear + 1} Forecast
                  </h3>
                  <p className="text-xs text-slate-500">
                    OLS slope ={' '}
                    <span className="font-mono font-semibold text-slate-700">
                      {activeForecast.slopePerYear >= 0 ? '+' : ''}
                      {activeForecast.unit === 'USD'
                        ? `$${activeForecast.slopePerYear.toLocaleString()}/yr`
                        : `${activeForecast.slopePerYear}/yr`}
                    </span>{' '}
                    · R² = <span className="font-mono font-semibold text-slate-700">{activeForecast.rSquared}</span> · CAGR ={' '}
                    <span className="font-mono font-semibold text-emerald-700">{activeForecast.cagrPct}%</span>
                  </p>
                </div>

                <select
                  aria-label="Forecast Target Metric"
                  value={forecastTarget}
                  onChange={(e) => setForecastTarget(e.target.value as ForecastTargetKey)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 cursor-pointer"
                >
                  <option value="revenueUsd">Commercial Revenue (USD)</option>
                  <option value="exhibitorsCount">Exhibitor Participation (Count)</option>
                  <option value="visitorsCount">Visitor Attendance (Count)</option>
                  <option value="verifiedDealsUsd">Verified B2B Trade Value (USD)</option>
                </select>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecastChartData} margin={{ top: 10, right: 16, left: 6, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) =>
                        activeForecast.unit === 'USD' ? formatUsdCompact(Number(v)) : String(v)
                      }
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => {
                        if (Array.isArray(val)) {
                          return [
                            `${formatMetricValue(val[0], activeForecast.unit)} – ${formatMetricValue(val[1], activeForecast.unit)}`,
                            '95% Confidence Interval',
                          ];
                        }
                        return [formatMetricValue(Number(val), activeForecast.unit), String(name ?? '')];
                      }}
                      contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area
                      type="monotone"
                      dataKey="ciRange"
                      name="95% Confidence Band"
                      fill="#F59E0B"
                      fillOpacity={0.16}
                      stroke="none"
                    />
                    <Bar
                      dataKey="actual"
                      name="Actual (SQLite Records)"
                      fill="#0F2137"
                      barSize={34}
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="regressionFitted"
                      name="OLS Linear Trend"
                      stroke="#64748B"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="holtProjection"
                      name="Blended OLS + Holt Forecast"
                      stroke="#C69214"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#C69214' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Forecast Numerical Summary Table */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">Edition Forecast &amp; 95% Bounds</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Residual Std. Error:{' '}
                  <span className="font-mono font-semibold text-slate-700">
                    {formatMetricValue(activeForecast.residualStdError, activeForecast.unit)}
                  </span>
                </p>

                <div className="space-y-2.5 text-xs">
                  {activeForecast.series.map((pt) => (
                    <div
                      key={pt.editionId}
                      className={`p-2.5 rounded-lg border ${
                        pt.isForecast
                          ? 'bg-amber-50/70 border-amber-200'
                          : 'bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{pt.editionName}</span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                            pt.isForecast
                              ? 'bg-amber-200/80 text-amber-950'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {pt.isForecast ? 'PROJECTED' : 'ACTUAL'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-sm font-bold text-slate-900 font-mono">
                          {pt.isForecast
                            ? formatMetricValue(pt.holtProjection, activeForecast.unit)
                            : formatMetricValue(pt.actual || 0, activeForecast.unit)}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          OLS: {formatMetricValue(pt.regressionFitted, activeForecast.unit)}
                        </span>
                      </div>
                      {pt.isForecast && pt.lower95 !== null && pt.upper95 !== null && (
                        <div className="text-[10px] text-amber-900 mt-1 font-mono">
                          95% CI: [{formatMetricValue(pt.lower95, activeForecast.unit)} ..{' '}
                          {formatMetricValue(pt.upper95, activeForecast.unit)}]
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Cumulative Invoice Cashflow Velocity Forecast */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Timestamped Cashflow Accumulation &amp; 3-Period Velocity Projection
                </h3>
                <p className="text-xs text-slate-500">
                  3-step moving average and linear extrapolation computed directly from raw `transactions.paymentDate` timestamps in the current filter scope
                </p>
              </div>
              <span className="text-[11px] font-mono px-2 py-1 rounded bg-slate-100 text-slate-700">
                {miningResult.cashflowVelocity.filter((p) => !p.isForecast).length} Dated Payment Buckets
              </span>
            </div>

            {miningResult.cashflowVelocity.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                No dated commercial transactions match the active filter scope.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={miningResult.cashflowVelocity} margin={{ top: 10, right: 16, left: 6, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatUsdCompact(Number(v))} />
                    <Tooltip
                      formatter={(val: any, name: any) => [formatUsdCompact(Number(val)), String(name ?? '')]}
                      contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="dailyValue" name="Bucket Inflow (USD)" fill="#94A3B8" barSize={18} />
                    <Line
                      type="monotone"
                      dataKey="cumulativeActual"
                      name="Cumulative Collected/Invoiced"
                      stroke="#0F2137"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="projectedCumulative"
                      name="Linear Velocity Projection"
                      stroke="#059669"
                      strokeDasharray="5 5"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#059669' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* LENS 2: K-MEANS++ EXHIBITOR CLUSTERING                              */}
      {/* =================================================================== */}
      {activeLens === 'clusters' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-600" />
              <span className="font-bold text-slate-900">K-Means++ Hyperparameters:</span>
              <span className="text-slate-500">
                Features = [Stand Sqm, Invoiced USD, Satisfaction, Tenure] (Z-Score Normalized)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Clusters (k):</span>
              {[2, 3, 4].map((kVal) => (
                <button
                  key={kVal}
                  onClick={() => {
                    setKClusters(kVal);
                    setSelectedClusterFilter('all');
                  }}
                  className={`px-3 py-1 rounded-lg font-mono font-bold cursor-pointer transition-colors ${
                    kClusters === kVal
                      ? 'bg-slate-900 text-amber-400'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  k = {kVal}
                </button>
              ))}
            </div>
          </div>

          {/* Cluster Profiles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {miningResult.clustering.profiles.map((prof) => (
              <button
                key={prof.clusterId}
                onClick={() =>
                  setSelectedClusterFilter(
                    selectedClusterFilter === prof.clusterId ? 'all' : prof.clusterId
                  )
                }
                className={`text-left bg-white rounded-xl border p-4 shadow-2xs transition-all cursor-pointer ${
                  selectedClusterFilter === prof.clusterId
                    ? 'border-amber-500 ring-2 ring-amber-500/20'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: prof.color }}
                    />
                    <span className="truncate">{prof.label}</span>
                  </span>
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {prof.count} ({prof.sharePct}%)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-400 block">Avg Stand</span>
                    <span className="font-bold text-slate-800">{prof.avgStandSqm} sqm</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Avg Invoiced</span>
                    <span className="font-bold text-slate-800">{formatUsdCompact(prof.avgInvoicedUsd)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Avg Rating</span>
                    <span className="font-bold text-slate-800">{prof.avgSatisfaction}/5</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Returning</span>
                    <span className="font-bold text-emerald-700">{prof.retentionPct}%</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Scatter Plot */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
              <div className="mb-3">
                <h3 className="font-bold text-sm text-slate-900">
                  Cluster Topology: Stand Footprint (sqm) vs. Matched Commercial Value (USD)
                </h3>
                <p className="text-xs text-slate-500">
                  Between-cluster variance explained: {miningResult.clustering.separationQualityPct}% (converged in {miningResult.clustering.iterations} iterations)
                </p>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 16, bottom: 10, left: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      type="number"
                      dataKey="standSizeSqm"
                      name="Stand Size"
                      unit=" sqm"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="invoicedUsd"
                      name="Invoiced Revenue"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => formatUsdCompact(Number(v))}
                    />
                    <ZAxis type="number" dataKey="satisfactionScore" range={[60, 220]} name="Satisfaction" />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const pt = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs shadow-lg border border-slate-700 space-y-0.5">
                            <div className="font-bold text-amber-400">{pt.companyName}</div>
                            <div className="text-slate-300">{pt.clusterLabel}</div>
                            <div>Stand: {pt.standSizeSqm} sqm · Rev: {formatUsdCompact(pt.invoicedUsd)}</div>
                            <div>Satisfaction: {pt.satisfactionScore}/5 · {pt.sector}</div>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={displayedClusterPoints} name="Exhibitors">
                      {displayedClusterPoints.map((pt) => (
                        <Cell key={pt.id} fill={pt.color} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cluster Members Table */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-slate-900">
                  Cluster Assignments ({displayedClusterPoints.length})
                </h3>
                {selectedClusterFilter !== 'all' && (
                  <button
                    onClick={() => setSelectedClusterFilter('all')}
                    className="text-[11px] font-semibold text-amber-700 hover:underline cursor-pointer"
                  >
                    Show All Clusters
                  </button>
                )}
              </div>
              <div className="flex-1 max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                {displayedClusterPoints.map((pt) => (
                  <div key={pt.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: pt.color }}
                        />
                        <span className="truncate">{pt.companyName}</span>
                        {pt.isUploadedBatch && (
                          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                            Uploaded
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {pt.clusterLabel} · {pt.sector}
                      </div>
                    </div>
                    <div className="text-right font-mono shrink-0">
                      <div className="font-bold text-slate-800">{pt.standSizeSqm} sqm</div>
                      <div className="text-[11px] text-slate-500">{formatUsdCompact(pt.invoicedUsd)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* LENS 3: STATISTICAL ANOMALY & OUTLIER RADAR (MAD / IQR)             */}
      {/* =================================================================== */}
      {activeLens === 'anomalies' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800">Module Scope:</span>
              {(['All', 'Commercial', 'Exhibitors', 'Trade'] as const).map((mod) => (
                <button
                  key={mod}
                  onClick={() => setAnomalyModuleFilter(mod)}
                  className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                    anomalyModuleFilter === mod
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {mod}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Z-Score Sensitivity (|z| ≥):</span>
              {[1.5, 2.0, 2.5, 3.0].map((zVal) => (
                <button
                  key={zVal}
                  onClick={() => setZThreshold(zVal)}
                  className={`px-2.5 py-1 rounded-lg font-mono font-bold cursor-pointer ${
                    zThreshold === zVal
                      ? 'bg-amber-600 text-slate-950'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {zVal.toFixed(1)}σ
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Detected Raw Record Outliers ({displayedAnomalies.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Evaluated via Iglewicz–Hoaglin Modified Z-Score (0.6745 × (x − median) / MAD) across raw warehouse values
                </p>
              </div>
            </div>

            {displayedAnomalies.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <div className="font-bold text-slate-800">No Outliers Detected at |z| ≥ {zThreshold.toFixed(1)}</div>
                <p>Lower the Z-score sensitivity to 1.5σ or upload skewed CSV/API batches to inspect variance.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                      <th className="p-3">Module / Ref</th>
                      <th className="p-3">Entity</th>
                      <th className="p-3">Metric</th>
                      <th className="p-3 text-right">Observed</th>
                      <th className="p-3 text-right">Median</th>
                      <th className="p-3 text-right">Z-Score</th>
                      <th className="p-3">Severity</th>
                      <th className="p-3">Diagnostic Explanation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedAnomalies.map((anom) => (
                      <tr key={anom.id} className="hover:bg-slate-50/70">
                        <td className="p-3">
                          <div className="font-bold text-slate-800">{anom.module}</div>
                          <div className="font-mono text-[11px] text-slate-500">{anom.recordRef}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{anom.entityName}</span>
                            {anom.isUploadedBatch && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                Uploaded
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">{anom.editionId}</div>
                        </td>
                        <td className="p-3 text-slate-700">{anom.metricName}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {anom.metricName.includes('USD')
                            ? `$${anom.observedValue.toLocaleString()}`
                            : anom.observedValue}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-500">
                          {anom.metricName.includes('USD')
                            ? `$${anom.baselineMedian.toLocaleString()}`
                            : anom.baselineMedian}
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          <span
                            className={
                              anom.zScore >= 0 ? 'text-amber-700' : 'text-rose-700'
                            }
                          >
                            {anom.zScore >= 0 ? `+${anom.zScore}` : anom.zScore}σ
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              anom.severity === 'Critical Outlier'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {anom.severity}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 max-w-xs">{anom.explanation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* LENS 4: ASSOCIATION RULES (APRIORI) + PARETO 80/20 & HHI            */}
      {/* =================================================================== */}
      {activeLens === 'rules' && (
        <div className="space-y-5">
          {/* Pareto 80/20 + Sector Momentum Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Pareto Concentration Curve */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Pareto (80/20) Client Revenue Concentration
                  </h3>
                  <p className="text-xs text-slate-500">
                    Top 20% of accounts ({miningResult.pareto.top20PctClientCount} of {miningResult.pareto.totalClientsCount}) generate{' '}
                    <strong className="text-slate-900">{miningResult.pareto.top20PctRevenueSharePct}%</strong> of invoiced revenue;{' '}
                    {miningResult.pareto.clientsNeededFor80PctSharePct}% reach 80% threshold.
                  </p>
                </div>
                <span className="text-[11px] font-mono font-bold px-2 py-1 rounded bg-slate-100 text-slate-800 shrink-0">
                  HHI: {miningResult.pareto.hhiScore}
                </span>
              </div>

              {miningResult.pareto.curve.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  No commercial transactions in scope for Pareto modeling.
                </div>
              ) : (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={miningResult.pareto.curve} margin={{ top: 10, right: 16, left: 6, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="rankPct" unit="%" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(val: any, _name: any, item: any) => [
                          `${val}% Cumulative (${item?.payload?.clientName}: $${Number(item?.payload?.amountUsd || 0).toLocaleString()})`,
                          'Pareto Share',
                        ]}
                        contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '11px' }}
                      />
                      <ReferenceLine y={80} stroke="#C69214" strokeDasharray="4 4" />
                      <Area
                        type="monotone"
                        dataKey="cumulativeRevenuePct"
                        fill="#0F2137"
                        fillOpacity={0.12}
                        stroke="#0F2137"
                        strokeWidth={2.5}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Live Multi-Edition Sector Momentum Chart */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
              <div className="mb-3">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-600" />
                  <span>Computed YoY Sector Growth Velocity (Edition-over-Edition)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Calculated directly from exhibitor &amp; revenue records across consecutive editions in SQLite
                </p>
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={miningResult.sectorMomentum.slice(0, 7)}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" unit="%" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="sector" width={135} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(val: any) => [`${Number(val) >= 0 ? '+' : ''}${val}% YoY`, 'Participation Delta']}
                      contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <ReferenceLine x={0} stroke="#64748B" />
                    <Bar dataKey="yoyGrowthPct" fill="#C69214" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Apriori Association Rules Table */}
          <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Discovered Co-Occurrence &amp; Association Rules ({displayedRules.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Apriori-style rules mined from raw attribute baskets where Confidence ≥ 45% and Lift &gt; 1.05
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {(['All', 'Exhibitor Retention', 'Visitor Behaviour', 'Trade Conversion'] as const).map(
                  (dom) => (
                    <button
                      key={dom}
                      onClick={() => setRuleDomainFilter(dom)}
                      className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                        ruleDomainFilter === dom
                          ? 'bg-slate-900 text-amber-400'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {dom}
                    </button>
                  )
                )}
              </div>
            </div>

            {displayedRules.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Insufficient co-occurrence density in current filter scope to surface rules above threshold.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                      <th className="p-3">Domain</th>
                      <th className="p-3">If Condition (Antecedent)</th>
                      <th className="p-3">Then Outcome (Consequent)</th>
                      <th className="p-3 text-right">Support</th>
                      <th className="p-3 text-right">Confidence</th>
                      <th className="p-3 text-right">Lift</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedRules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-slate-50/70">
                        <td className="p-3 font-semibold text-slate-700">{rule.domain}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-900">{rule.antecedent}</td>
                        <td className="p-3 font-mono text-[11px] text-emerald-800 flex items-center gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{rule.consequent}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-600">
                          {rule.supportPct}% ({rule.supportCount})
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {rule.confidencePct}%
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-amber-700">
                          {rule.lift}x
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <ShareCollaborateModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        targetType="DataMining"
        targetId={`mining-forecast-${selectedEditionId}`}
        targetTitle={`Algorithmic Forecast & Outlier Analysis (${editionTitle})`}
        editionId={selectedEditionId === 'all' ? 'zitf-2026' : selectedEditionId}
        snapshotSummary={`${activeForecast.nextEditionYear} ${activeForecast.label}: ${formatMetricValue(activeForecast.nextEditionForecast, activeForecast.unit)} (R²=${activeForecast.rSquared}, CAGR=${activeForecast.cagrPct}%) | K-Means++ Tiers: ${miningResult.clustering.k} | MAD Outliers Flagged: ${miningResult.anomalies.length} | HHI: ${miningResult.pareto.hhiScore}`}
        onSuccessNavigateToCollab={onNavigate ? () => onNavigate('collaborate') : undefined}
      />
    </div>
  );
};
