import React, { useMemo, useState } from 'react';
import { useBI } from '../context/BIContext';
import { MarketInsight } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { FilterBar } from '../components/common/FilterBar';
import { formatUsdCompact } from '../utils/formatters';
import { computeConcentrationAndSectorMomentum } from '../utils/dataMiningEngine';
import {
  TrendingUp,
  Plus,
  BookOpen,
  DollarSign,
  Compass,
  CheckCircle2,
  ExternalLink,
  X,
  Cpu,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

export const StrategicMarketInsight: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const {
    filteredMarketInsights,
    addMarketInsight,
    selectedEditionId,
    editions,
    exhibitors,
    filteredExhibitors,
    filteredTransactions,
    filteredTradeEngagements,
  } = useBI();

  const currentEditionObj = editions.find((e) => e.id === selectedEditionId);
  const editionTitle = currentEditionObj ? currentEditionObj.name : 'Historical';

  const [localSearch, setLocalSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<MarketInsight | null>(null);

  const [formData, setFormData] = useState<Partial<MarketInsight>>({
    title: '',
    sector: 'Mining & Natural Resources',
    marketType: 'Emerging Sector',
    summary: '',
    keyIndicators: ['Strong export demand', 'High local value addition'],
    estimatedMarketValueUsd: 500000000,
    growthRateYoY: 28.5,
    zimbabweMarketContext: 'Zimbabwe national policy prioritization.',
    sourceAttribution: 'ZITF Strategic Research Unit & ZimTrade 2026',
    date: new Date().toISOString().substring(0, 10),
  });

  const displayedInsights = filteredMarketInsights.filter((m) => {
    if (typeFilter !== 'all' && m.marketType !== typeFilter) return false;
    if (localSearch.trim()) {
      const q = localSearch.toLowerCase();
      return (
        m.title.toLowerCase().includes(q) ||
        m.sector.toLowerCase().includes(q) ||
        m.summary.toLowerCase().includes(q) ||
        m.marketType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const { pareto, sectorMomentum } = useMemo(
    () =>
      computeConcentrationAndSectorMomentum(
        editions,
        exhibitors,
        filteredExhibitors,
        filteredTransactions,
        filteredTradeEngagements
      ),
    [editions, exhibitors, filteredExhibitors, filteredTransactions, filteredTradeEngagements]
  );

  const sectorGrowthData = useMemo(
    () =>
      sectorMomentum.slice(0, 7).map((s) => ({
        sector: s.sector,
        growth: s.yoyGrowthPct,
        status: s.status,
      })),
    [sectorMomentum]
  );

  const liveMetrics = useMemo(() => {
    const activeSectorsCount = sectorMomentum.length;
    const topSector = sectorMomentum[0];
    const totalMarketPipelineUsd = filteredMarketInsights.reduce(
      (s, m) => s + (Number(m.estimatedMarketValueUsd) || 0),
      0
    );
    const totalTradePipelineUsd = filteredTradeEngagements.reduce(
      (s, t) => s + (Number(t.estimatedValueUsd) || 0),
      0
    );
    const smeCount = filteredExhibitors.filter((e) => e.category === 'SME / Emerging').length;
    const localCount = filteredExhibitors.filter((e) => e.category === 'Local Commercial').length;

    return {
      activeSectorsCount,
      topSectorName: topSector?.sector || 'No Sector Data',
      topSectorGrowth: topSector?.yoyGrowthPct ?? 0,
      topSectorCount: topSector?.latestCount ?? 0,
      totalMarketPipelineUsd,
      totalTradePipelineUsd,
      smeCount,
      localCount,
    };
  }, [sectorMomentum, filteredMarketInsights, filteredTradeEngagements, filteredExhibitors]);

  const handleSaveInsight = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    addMarketInsight({
      ...formData,
      keyIndicators: Array.isArray(formData.keyIndicators)
        ? formData.keyIndicators
        : [formData.keyIndicators || 'Strategic growth indicator'],
    } as any);

    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Module Six: Strategic Market Insight &amp; Trade Horizons
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
              {editionTitle}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Transforming ZITF transaction data and exhibition intelligence into actionable trade discovery and investment horizon reports.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onNavigate('mining')}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Cpu className="w-4 h-4 text-amber-700" />
            <span>Open Data Mining &amp; Forecasting</span>
          </button>
          <button
            onClick={() => onNavigate('reports')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-slate-600" />
            <span>Publish Trade Brief</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Add Market Insight</span>
          </button>
        </div>
      </div>

      <FilterBar
        totalFilteredCount={displayedInsights.length}
        totalLabel="Strategic Insights"
      />

      {/* KPIs (100% SQLite Live Computed) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <MetricCard
          title="Monitored Sectors"
          value={`${liveMetrics.activeSectorsCount} Sectors`}
          previousValue={`HHI ${pareto.hhiScore}`}
          icon={Compass}
          badge={pareto.hhiClassification.split(' ')[0]}
          badgeVariant="emerald"
          breakdown={[
            { label: 'Exhibitors', value: `${filteredExhibitors.length}` },
            { label: 'Briefs', value: `${filteredMarketInsights.length}` },
          ]}
          insight={`${liveMetrics.activeSectorsCount} active trade sectors computed dynamically from live SQLite exhibitor and invoice records (HHI=${pareto.hhiScore}).`}
          subtitle="Live Sector Coverage"
        />

        <MetricCard
          title="Fastest Growing"
          value={`${liveMetrics.topSectorGrowth >= 0 ? '+' : ''}${liveMetrics.topSectorGrowth}% YoY`}
          previousValue={`${liveMetrics.topSectorCount} cos`}
          changePct={liveMetrics.topSectorGrowth}
          icon={TrendingUp}
          badge={liveMetrics.topSectorName}
          badgeVariant="purple"
          breakdown={[
            { label: 'Top Sector', value: liveMetrics.topSectorName },
            { label: 'Active Cos', value: `${liveMetrics.topSectorCount}` },
          ]}
          insight={`${liveMetrics.topSectorName} recorded ${liveMetrics.topSectorGrowth}% edition-over-edition exhibitor growth in the SQLite warehouse.`}
          subtitle="Computed YoY Momentum"
        />

        <MetricCard
          title="Opportunity Pipeline"
          value={`${formatUsdCompact(liveMetrics.totalMarketPipelineUsd)} USD`}
          previousValue={`${formatUsdCompact(liveMetrics.totalTradePipelineUsd)} B2B`}
          icon={DollarSign}
          badge="Catalogued Horizons"
          badgeVariant="blue"
          breakdown={[
            { label: 'Market Briefs', value: formatUsdCompact(liveMetrics.totalMarketPipelineUsd) },
            { label: 'B2B Deals', value: formatUsdCompact(liveMetrics.totalTradePipelineUsd) },
          ]}
          insight={`${formatUsdCompact(liveMetrics.totalMarketPipelineUsd)} catalogued across strategic market briefs alongside ${formatUsdCompact(liveMetrics.totalTradePipelineUsd)} in B2B engagements.`}
          subtitle="Estimated Sector Value"
        />

        <MetricCard
          title="SME & Emerging Cohort"
          value={`${liveMetrics.smeCount} SMEs`}
          previousValue={`${liveMetrics.localCount} Commercial`}
          icon={CheckCircle2}
          badge="SQLite Cohort"
          badgeVariant="emerald"
          breakdown={[
            { label: 'SME / Emerging', value: `${liveMetrics.smeCount}` },
            { label: 'Local Commercial', value: `${liveMetrics.localCount}` },
          ]}
          insight={`${liveMetrics.smeCount} SME / Emerging exhibitors actively tracked within the current edition & filter scope.`}
          subtitle="Enterprise Participation"
        />
      </div>

      {/* Visualisations: Sector YoY Growth */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
        <div className="mb-4">
          <h3 className="font-bold text-sm text-slate-900">Comparative Sector Participation Growth (YoY Expansion %)</h3>
          <p className="text-xs text-slate-500">Computed algorithmically from exhibitor participation across consecutive SQLite editions</p>
        </div>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sectorGrowthData} margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
              <XAxis dataKey="sector" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                formatter={(val: any) => [`${Number(val) >= 0 ? '+' : ''}${val}% YoY Growth`, 'Expansion']}
                contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
              />
              <Bar dataKey="growth" fill="#C69214" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Strategic Market Opportunity Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="font-bold uppercase tracking-wider text-slate-500">
            Market Opportunity Register &amp; Strategic Briefs
          </span>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Filter Opportunity:</span>
            <select
              aria-label="Opportunity Type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 cursor-pointer"
            >
              <option value="all">All Horizons</option>
              <option value="Emerging Sector">Emerging Sector</option>
              <option value="Export Potential">Export Potential</option>
              <option value="Technology Trend">Technology Trend</option>
              <option value="Investment Opportunity">Investment Opportunity</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedInsights.map((insight) => (
            <div
              key={insight.id}
              className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                    {insight.marketType}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-emerald-700">
                    +{insight.growthRateYoY}% YoY Growth
                  </span>
                </div>

                <h3 className="font-bold text-base text-slate-900 leading-snug">
                  {insight.title}
                </h3>
                <div className="text-xs text-amber-700 font-medium mt-0.5 mb-2.5">
                  Sector: {insight.sector}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {insight.summary}
                </p>

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/70 mb-3 space-y-1.5 text-xs">
                  <span className="font-bold text-slate-900 block text-[11px]">Key Market Drivers</span>
                  {insight.keyIndicators.map((ind, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-slate-600">
                      <span className="text-amber-500 font-bold shrink-0">·</span>
                      <span className="text-[11px]">{ind}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="line-clamp-1">Source: {insight.sourceAttribution}</span>
                <button
                  onClick={() => setSelectedInsight(insight)}
                  className="font-semibold text-slate-900 hover:text-amber-700 flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                >
                  <span>View Full Brief</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedInsight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-amber-400 font-mono text-[11px] uppercase tracking-wider block">
                  {selectedInsight.marketType} · {selectedInsight.sector}
                </span>
                <div className="text-base font-bold mt-0.5">{selectedInsight.title}</div>
              </div>
              <button onClick={() => setSelectedInsight(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <span className="font-bold text-slate-900 block mb-1">Executive Market Summary</span>
                <p className="text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200/80 leading-relaxed">
                  {selectedInsight.summary}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-900 block mb-1">Zimbabwean Macro &amp; Trade Policy Context</span>
                <p className="text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200/80 leading-relaxed">
                  {selectedInsight.zimbabweMarketContext}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-slate-200">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Estimated Sector Value</span>
                  <span className="text-base font-bold text-slate-900">
                    ${(selectedInsight.estimatedMarketValueUsd / 1000000).toLocaleString()}M USD
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Annual Trajectory</span>
                  <span className="text-base font-bold text-emerald-700">+{selectedInsight.growthRateYoY}% YoY</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-900 block mb-1">Supporting Observation Points</span>
                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                  {selectedInsight.keyIndicators.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">{item}</li>
                  ))}
                </ul>
              </div>

              <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-500 text-[11px]">
                <strong className="text-slate-700">Source Attribution:</strong> {selectedInsight.sourceAttribution} · Published: {selectedInsight.date}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedInsight(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-medium"
              >
                Close Brief
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Market Insight Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-sm font-bold">Add Strategic Market Horizon / Opportunity</span>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveInsight} className="p-5 space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. SADC Regional Agro-Machinery Supply Gap"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Target Sector</label>
                  <input
                    type="text"
                    value={formData.sector || 'Agriculture & Food Processing'}
                    onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Horizon Type</label>
                  <select
                    value={formData.marketType || 'Emerging Sector'}
                    onChange={(e) => setFormData({ ...formData, marketType: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="Emerging Sector">Emerging Sector</option>
                    <option value="Export Potential">Export Potential</option>
                    <option value="Investment Opportunity">Investment Opportunity</option>
                    <option value="Technology Trend">Technology Trend</option>
                    <option value="SME Growth">SME Growth</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Market Summary</label>
                <textarea
                  rows={2}
                  value={formData.summary || ''}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Synthesized market dynamics, catalyst drivers, buyer demand..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Est. Market Value (USD)</label>
                  <input
                    type="number"
                    value={formData.estimatedMarketValueUsd || 500000000}
                    onChange={(e) => setFormData({ ...formData, estimatedMarketValueUsd: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Annual YoY Growth (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.growthRateYoY || 25.0}
                    onChange={(e) => setFormData({ ...formData, growthRateYoY: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold"
                >
                  Publish Insight
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
