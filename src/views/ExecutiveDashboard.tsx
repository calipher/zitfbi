import React, { useMemo, useState } from 'react';
import { useBI } from '../context/BIContext';
import { FilterBar } from '../components/common/FilterBar';
import { ShareCollaborateModal } from '../components/common/ShareCollaborateModal';
import { formatUsdCompact } from '../utils/formatters';
import {
  Users,
  Store,
  DollarSign,
  Maximize2,
  Handshake,
  FileCheck2,
  Award,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Building,
  Database,
  Share2,
  Minus,
  Plus,
  Download,
  Star,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from 'recharts';

const REVENUE_COLORS: Record<string, string> = {
  'Exhibition Hall Space': '#0d6efd',
  'Sponsorship Agreement': '#198754',
  'Advertising & Signage': '#6f42c1',
  'Conference & Forum Pass': '#0dcaf0',
  'Commercial Services': '#fd7e14',
  'Logistics & Utilities': '#20c997',
};

export const ExecutiveDashboard: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const {
    executiveMetrics,
    selectedEditionId,
    editions,
    exhibitors,
    hallUtilisation,
    filteredExhibitors,
    filteredVisitors,
    filteredTransactions,
    filteredTradeEngagements,
    warehouseStats,
    setIsAIAssistantOpen,
  } = useBI();

  const currentEditionObj = editions.find((e) => e.id === selectedEditionId);
  const editionTitle = currentEditionObj ? currentEditionObj.name : 'All Editions';

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [primaryChartTab, setPrimaryChartTab] = useState<'sectors' | 'attendance' | 'origins'>('sectors');
  const [secondaryCardTab, setSecondaryCardTab] = useState<'revenue' | 'trade'>('revenue');
  const [isPrimaryCardCollapsed, setIsPrimaryCardCollapsed] = useState(false);
  const [isSecondaryCardCollapsed, setIsSecondaryCardCollapsed] = useState(false);

  // 1. Live Sector Participation Chart Data
  const sectorData = useMemo(() => {
    const counts = new Map<string, number>();
    filteredExhibitors.forEach((e) => {
      const key = e.sector || 'Unclassified';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const total = filteredExhibitors.length;
    return Array.from(counts.entries())
      .map(([sector, count]) => ({
        sector,
        exhibitors: count,
        share: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.exhibitors - a.exhibitors);
  }, [filteredExhibitors]);

  // 2. Live Visitor Attendance Progression by Day (Days 1-5)
  const attendanceProgressionData = useMemo(() => {
    const dayBuckets = [
      { key: 'Day 1', label: 'Day 1 (Biz)' },
      { key: 'Day 2', label: 'Day 2 (Biz)' },
      { key: 'Day 3', label: 'Day 3 (Biz)' },
      { key: 'Day 4', label: 'Day 4 (Public)' },
      { key: 'Day 5', label: 'Day 5 (Public)' },
    ];
    return dayBuckets.map((b) => ({
      day: b.label,
      visitors: filteredVisitors.filter((v) => v.attendanceDays.some((d) => d.includes(b.key))).length,
    }));
  }, [filteredVisitors]);

  // 3. Live Revenue Stream Breakdown
  const revenueStreamData = useMemo(() => {
    const sums = new Map<string, number>();
    filteredTransactions.forEach((tx) => {
      sums.set(tx.type, (sums.get(tx.type) || 0) + (Number(tx.amountUsd) || 0));
    });
    return Array.from(sums.entries())
      .map(([name, value]) => ({
        name,
        value,
        color: REVENUE_COLORS[name] || '#475569',
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  // 4. Live Trade Outcomes Breakdown (3-Tier Verification)
  const tradeOutcomesData = useMemo(() => {
    const verified = filteredTradeEngagements.filter((t) => t.verificationStatus === 'Independently Verified');
    const reported = filteredTradeEngagements.filter((t) => t.verificationStatus === 'Reported by Participant');
    const facilitated = filteredTradeEngagements.filter((t) => t.verificationStatus === 'Facilitated Opportunity');

    return [
      {
        category: 'Independently Verified',
        valueUsd: verified.reduce((s, t) => s + (Number(t.estimatedValueUsd) || 0), 0),
        count: verified.length,
        color: '#198754',
      },
      {
        category: 'Reported by Participants',
        valueUsd: reported.reduce((s, t) => s + (Number(t.estimatedValueUsd) || 0), 0),
        count: reported.length,
        color: '#fd7e14',
      },
      {
        category: 'Facilitated Pipeline',
        valueUsd: facilitated.reduce((s, t) => s + (Number(t.estimatedValueUsd) || 0), 0),
        count: facilitated.length,
        color: '#0d6efd',
      },
    ];
  }, [filteredTradeEngagements]);

  const maxOutcomeUsd = useMemo(
    () => Math.max(1, ...tradeOutcomesData.map((d) => d.valueUsd)),
    [tradeOutcomesData]
  );

  // 5. Live Multi-Edition Local vs International Exhibitors
  const originData = useMemo(() => {
    return [...editions]
      .sort((a, b) => a.year - b.year)
      .map((ed) => {
        const list = exhibitors.filter((e) => e.editionId === ed.id);
        const intl = list.filter((e) => e.country.trim().toLowerCase() !== 'zimbabwe').length;
        return {
          year: String(ed.year),
          Local: list.length - intl,
          International: intl,
        };
      });
  }, [editions, exhibitors]);

  const peakHall = useMemo(() => {
    if (hallUtilisation.length === 0) return null;
    return [...hallUtilisation].sort((a, b) => b.utilizationRatePct - a.utilizationRatePct)[0];
  }, [hallUtilisation]);

  const handleExportCsv = () => {
    const rows = [
      ['Metric', 'Value', 'Context'],
      ['Total Exhibitors', executiveMetrics.totalExhibitors, editionTitle],
      ['International Exhibitor Share', `${executiveMetrics.internationalPct}%`, `${executiveMetrics.internationalCountriesCount} Countries`],
      ['Exhibitor Retention Rate', `${executiveMetrics.retentionRate}%`, 'Database Computed'],
      ['Total Attendance', executiveMetrics.totalVisitors, 'Registered Visitors'],
      ['Trade Business Delegates', executiveMetrics.businessVisitors, 'Business Segments'],
      ['Total Commercial Revenue (USD)', executiveMetrics.totalRevenueUsd, 'Invoiced'],
      ['Venue Space Occupancy', `${executiveMetrics.spaceOccupancyPct}%`, `${executiveMetrics.occupiedSqmTotal.toLocaleString()} sqm`],
      ['B2B Matchmaking Engagements', executiveMetrics.b2bMeetingsCount, 'Logged Records'],
      ['Independently Verified Deals (USD)', executiveMetrics.verifiedDealsUsd, 'Audited'],
      ['Reported Pipeline Deals (USD)', executiveMetrics.reportedDealsUsd, 'Participant Reported'],
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ZITF_Executive_Summary_${selectedEditionId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Top Action & Context Strip */}
      <div className="bg-white border border-slate-200 rounded-md px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap text-xs text-slate-600">
          <span className="font-semibold text-slate-900">{editionTitle}</span>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center gap-1.5 font-mono text-emerald-700 font-medium">
            <Database className="w-3.5 h-3.5" />
            <span>
              SQLite Warehouse ({warehouseStats ? warehouseStats.totalRecords.toLocaleString() : 0} records)
            </span>
          </span>
          <span className="text-slate-300">·</span>
          <span>
            Peak Hall:{' '}
            <strong className="text-slate-800 font-mono">
              {peakHall ? `${peakHall.hallId.toUpperCase()} (${peakHall.utilizationRatePct}%)` : 'N/A'}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsShareOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Share2 className="w-3.5 h-3.5 text-[#0d6efd]" />
            <span>Share Snapshot</span>
          </button>
          <button
            onClick={() => onNavigate('reports')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-slate-600" />
            <span>Executive Report</span>
          </button>
          <button
            onClick={() => setIsAIAssistantOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d6efd] hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask AI Analyst</span>
          </button>
        </div>
      </div>

      {/* Cross-Pillar Filter Bar */}
      <FilterBar
        onExportCsv={handleExportCsv}
        exportLabel="Export Executive Summary (CSV)"
        totalFilteredCount={filteredExhibitors.length}
        totalLabel="Active Exhibitors In Context"
      />

      {/* Row 1: 4 Classic AdminLTE Small Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Small Box 1: Info (Blue) — Total Exhibitors */}
        <div className="rounded-md overflow-hidden bg-[#0073b7] text-white shadow-2xs flex flex-col justify-between group">
          <div className="p-4 relative flex items-start justify-between">
            <div className="min-w-0 pr-2">
              <div className="text-3xl font-bold tracking-tight tabular-nums leading-none">
                {executiveMetrics.totalExhibitors.toLocaleString()}
              </div>
              <div className="text-sm font-medium mt-2">Total Exhibitors</div>
              <div className="text-[11px] text-sky-100 mt-1 font-mono tabular-nums">
                {executiveMetrics.internationalPct}% Int&apos;l · {executiveMetrics.internationalCountriesCount} Countries · {executiveMetrics.retentionRate}% Retained
              </div>
            </div>
            <Store className="w-14 h-14 text-black/20 group-hover:scale-105 transition-transform shrink-0" />
          </div>
          <button
            type="button"
            onClick={() => onNavigate('exhibitors')}
            className="w-full py-1.5 px-4 bg-black/15 hover:bg-black/25 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>More info</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Small Box 2: Success (Emerald) — Exhibition Revenue */}
        <div className="rounded-md overflow-hidden bg-[#198754] text-white shadow-2xs flex flex-col justify-between group">
          <div className="p-4 relative flex items-start justify-between">
            <div className="min-w-0 pr-2">
              <div className="text-3xl font-bold tracking-tight tabular-nums leading-none">
                {formatUsdCompact(executiveMetrics.totalRevenueUsd)}
              </div>
              <div className="text-sm font-medium mt-2">Exhibition Revenue (USD)</div>
              <div className="text-[11px] text-emerald-100 mt-1 font-mono tabular-nums">
                {executiveMetrics.collectionRatePct}% Collected · {formatUsdCompact(executiveMetrics.outstandingBalanceUsd)} Due
              </div>
            </div>
            <DollarSign className="w-14 h-14 text-black/20 group-hover:scale-105 transition-transform shrink-0" />
          </div>
          <button
            type="button"
            onClick={() => onNavigate('commercial')}
            className="w-full py-1.5 px-4 bg-black/15 hover:bg-black/25 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>More info</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Small Box 3: Warning (Amber) — Total Visitors */}
        <div className="rounded-md overflow-hidden bg-[#d97706] text-white shadow-2xs flex flex-col justify-between group">
          <div className="p-4 relative flex items-start justify-between">
            <div className="min-w-0 pr-2">
              <div className="text-3xl font-bold tracking-tight tabular-nums leading-none">
                {executiveMetrics.totalVisitors.toLocaleString()}
              </div>
              <div className="text-sm font-medium mt-2">Registered Visitors</div>
              <div className="text-[11px] text-amber-100 mt-1 font-mono tabular-nums">
                {executiveMetrics.businessVisitors.toLocaleString()} Business · {executiveMetrics.foreignVisitorCountriesCount} Foreign States
              </div>
            </div>
            <Users className="w-14 h-14 text-black/20 group-hover:scale-105 transition-transform shrink-0" />
          </div>
          <button
            type="button"
            onClick={() => onNavigate('visitors')}
            className="w-full py-1.5 px-4 bg-black/15 hover:bg-black/25 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>More info</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Small Box 4: Danger (Crimson) — Space Occupancy */}
        <div className="rounded-md overflow-hidden bg-[#dc3545] text-white shadow-2xs flex flex-col justify-between group">
          <div className="p-4 relative flex items-start justify-between">
            <div className="min-w-0 pr-2">
              <div className="text-3xl font-bold tracking-tight tabular-nums leading-none">
                {executiveMetrics.spaceOccupancyPct}%
              </div>
              <div className="text-sm font-medium mt-2">Venue Space Occupancy</div>
              <div className="text-[11px] text-rose-100 mt-1 font-mono tabular-nums">
                {executiveMetrics.occupiedSqmTotal.toLocaleString()} / {executiveMetrics.totalCapacitySqm.toLocaleString()} sqm · {hallUtilisation.length} Halls
              </div>
            </div>
            <Maximize2 className="w-14 h-14 text-black/20 group-hover:scale-105 transition-transform shrink-0" />
          </div>
          <button
            type="button"
            onClick={() => onNavigate('operations')}
            className="w-full py-1.5 px-4 bg-black/15 hover:bg-black/25 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>More info</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2: 4 Classic AdminLTE Info Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Info Box 1: B2B Engagements */}
        <button
          type="button"
          onClick={() => onNavigate('trade')}
          className="bg-white border border-slate-200 rounded-md p-2.5 flex items-center gap-3 hover:border-slate-300 transition-colors text-left cursor-pointer"
        >
          <div className="w-14 h-14 rounded bg-[#0dcaf0] text-slate-950 flex items-center justify-center shrink-0">
            <Handshake className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 font-medium truncate">B2B Matchmaking</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums leading-tight">
              {executiveMetrics.b2bMeetingsCount.toLocaleString()}
            </div>
            <div className="w-full bg-slate-100 h-1 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-[#0dcaf0] h-full"
                style={{ width: `${Math.min(100, executiveMetrics.followUpRatePct)}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate font-mono tabular-nums">
              {executiveMetrics.convertedDealsCount} converted · {executiveMetrics.followUpRatePct}% active
            </div>
          </div>
        </button>

        {/* Info Box 2: Verified Trade Deals */}
        <button
          type="button"
          onClick={() => onNavigate('trade')}
          className="bg-white border border-slate-200 rounded-md p-2.5 flex items-center gap-3 hover:border-slate-300 transition-colors text-left cursor-pointer"
        >
          <div className="w-14 h-14 rounded bg-[#198754] text-white flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 font-medium truncate">Verified Trade Deals</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums leading-tight">
              {formatUsdCompact(executiveMetrics.verifiedDealsUsd)}
            </div>
            <div className="w-full bg-slate-100 h-1 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-[#198754] h-full"
                style={{
                  width: `${
                    executiveMetrics.verifiedDealsUsd + executiveMetrics.reportedDealsUsd > 0
                      ? Math.round(
                          (executiveMetrics.verifiedDealsUsd /
                            (executiveMetrics.verifiedDealsUsd + executiveMetrics.reportedDealsUsd)) *
                            100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate font-mono tabular-nums">
              {executiveMetrics.verifiedDealsCount} audited · {formatUsdCompact(executiveMetrics.reportedDealsUsd)} reported
            </div>
          </div>
        </button>

        {/* Info Box 3: Visitor Satisfaction */}
        <button
          type="button"
          onClick={() => onNavigate('visitors')}
          className="bg-white border border-slate-200 rounded-md p-2.5 flex items-center gap-3 hover:border-slate-300 transition-colors text-left cursor-pointer"
        >
          <div className="w-14 h-14 rounded bg-[#6f42c1] text-white flex items-center justify-center shrink-0">
            <Star className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 font-medium truncate">Visitor Satisfaction</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums leading-tight">
              {executiveMetrics.totalVisitors > 0 ? `${executiveMetrics.visitorSatisfaction} / 5.0` : '0 / 5.0'}
            </div>
            <div className="w-full bg-slate-100 h-1 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-[#6f42c1] h-full"
                style={{ width: `${Math.min(100, Math.round((executiveMetrics.visitorSatisfaction / 5) * 100))}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate font-mono tabular-nums">
              {executiveMetrics.repeatVisitorPct}% repeat rate · N={executiveMetrics.totalVisitors}
            </div>
          </div>
        </button>

        {/* Info Box 4: Network Uptime & Returning Loyalty */}
        <button
          type="button"
          onClick={() => onNavigate('operations')}
          className="bg-white border border-slate-200 rounded-md p-2.5 flex items-center gap-3 hover:border-slate-300 transition-colors text-left cursor-pointer"
        >
          <div className="w-14 h-14 rounded bg-[#0d6efd] text-white flex items-center justify-center shrink-0">
            <Building className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 font-medium truncate">Campus &amp; Network SLA</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums leading-tight">
              {executiveMetrics.networkUptimePct}%
            </div>
            <div className="w-full bg-slate-100 h-1 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-[#0d6efd] h-full"
                style={{ width: `${Math.min(100, executiveMetrics.networkUptimePct)}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate font-mono tabular-nums">
              {executiveMetrics.openIncidentsCount} open alerts · {executiveMetrics.resolvedIncidentsCount} resolved
            </div>
          </div>
        </button>
      </div>

      {/* Row 3: 12-Column AdminLTE Analytics & Trade Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: AdminLTE Card Widget — Participation & Attendance Analytics */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-md flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">
              Exhibition Analytics ({editionTitle})
            </h2>

            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="inline-flex border border-slate-200 rounded overflow-hidden text-[11px]">
                <button
                  type="button"
                  onClick={() => setPrimaryChartTab('sectors')}
                  className={`px-2.5 py-1 font-medium cursor-pointer whitespace-nowrap ${
                    primaryChartTab === 'sectors'
                      ? 'bg-[#0d6efd] text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Sectors
                </button>
                <button
                  type="button"
                  onClick={() => setPrimaryChartTab('attendance')}
                  className={`px-2.5 py-1 font-medium border-l border-slate-200 cursor-pointer whitespace-nowrap ${
                    primaryChartTab === 'attendance'
                      ? 'bg-[#0d6efd] text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  5-Day Traffic
                </button>
                <button
                  type="button"
                  onClick={() => setPrimaryChartTab('origins')}
                  className={`px-2.5 py-1 font-medium border-l border-slate-200 cursor-pointer whitespace-nowrap ${
                    primaryChartTab === 'origins'
                      ? 'bg-[#0d6efd] text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Local vs Int&apos;l
                </button>
              </div>

              <button
                type="button"
                onClick={handleExportCsv}
                className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                title="Export Summary CSV"
                aria-label="Export Summary CSV"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsPrimaryCardCollapsed((prev) => !prev)}
                className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                title={isPrimaryCardCollapsed ? 'Expand Card' : 'Collapse Card'}
                aria-label="Toggle Analytics Card"
              >
                {isPrimaryCardCollapsed ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {!isPrimaryCardCollapsed && (
            <div className="p-4 flex-1">
              <div className="h-72">
                {primaryChartTab === 'sectors' && (
                  sectorData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No exhibitor records available for the selected filters.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sectorData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis dataKey="sector" type="category" width={155} tick={{ fontSize: 10, fill: '#334155' }} />
                        <Tooltip
                          formatter={(val: any, _name: any, item: any) => [`${val} Stands (${item.payload.share}%)`, 'Stands']}
                          contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '6px', fontSize: '12px', border: 'none' }}
                        />
                        <Bar dataKey="exhibitors" fill="#0d6efd" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                )}

                {primaryChartTab === 'attendance' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={attendanceProgressionData} margin={{ left: 5, right: 15, top: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="lteVisitorGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0d6efd" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#0d6efd" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        formatter={(val: any) => [`${Number(val).toLocaleString()} check-ins`, 'Attendance']}
                        contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '6px', fontSize: '12px', border: 'none' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="visitors"
                        stroke="#0d6efd"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#lteVisitorGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}

                {primaryChartTab === 'origins' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={originData} margin={{ left: 5, right: 15, top: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '6px', fontSize: '12px', border: 'none' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar dataKey="Local" fill="#343a40" radius={[3, 3, 0, 0]} name="Zimbabwean Enterprises" />
                      <Bar dataKey="International" fill="#0d6efd" radius={[3, 3, 0, 0]} name="International Pavilions" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span className="font-mono tabular-nums">
              {filteredExhibitors.length} exhibitors · {filteredVisitors.length} visitor records
            </span>
            <button
              type="button"
              onClick={() => onNavigate(primaryChartTab === 'attendance' ? 'visitors' : 'exhibitors')}
              className="text-[#0d6efd] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Open Full Module</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>

        {/* Right 5 Cols: AdminLTE Card Widget — Commercial Revenue & 3-Tier Trade Rigor */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-md flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">
              Revenue Mix &amp; Trade Verification
            </h2>

            <div className="flex items-center gap-1.5">
              <div className="inline-flex border border-slate-200 rounded overflow-hidden text-[11px]">
                <button
                  type="button"
                  onClick={() => setSecondaryCardTab('revenue')}
                  className={`px-2.5 py-1 font-medium cursor-pointer whitespace-nowrap ${
                    secondaryCardTab === 'revenue'
                      ? 'bg-[#198754] text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Revenue Mix
                </button>
                <button
                  type="button"
                  onClick={() => setSecondaryCardTab('trade')}
                  className={`px-2.5 py-1 font-medium border-l border-slate-200 cursor-pointer whitespace-nowrap ${
                    secondaryCardTab === 'trade'
                      ? 'bg-[#198754] text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Trade Rigor
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsSecondaryCardCollapsed((prev) => !prev)}
                className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                title={isSecondaryCardCollapsed ? 'Expand Card' : 'Collapse Card'}
                aria-label="Toggle Financial Card"
              >
                {isSecondaryCardCollapsed ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {!isSecondaryCardCollapsed && (
            <div className="p-4 flex-1">
              {secondaryCardTab === 'revenue' ? (
                revenueStreamData.length === 0 ? (
                  <div className="h-72 flex items-center justify-center text-xs text-slate-400">
                    No commercial transactions recorded for the active filters.
                  </div>
                ) : (
                  <div className="h-72 flex flex-col sm:flex-row items-center gap-3">
                    <div className="w-full sm:w-1/2 h-48 sm:h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={revenueStreamData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={74}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {revenueStreamData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(val: any) => [`$${Number(val).toLocaleString()} USD`, 'Revenue']}
                            contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '6px', fontSize: '12px', border: 'none' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full sm:w-1/2 divide-y divide-slate-100 text-xs overflow-y-auto max-h-68">
                      {revenueStreamData.map((stream, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{ backgroundColor: stream.color }}
                            />
                            <span className="font-medium text-slate-700 truncate">{stream.name}</span>
                          </div>
                          <span className="font-bold text-slate-900 font-mono tabular-nums shrink-0 ml-2">
                            {formatUsdCompact(stream.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <div className="space-y-4 py-1">
                  <p className="text-xs text-slate-500">
                    Strict 3-tier verification separation across documented contracts, self-reported pipeline, and early matchmaking opportunities.
                  </p>
                  {tradeOutcomesData.map((item, idx) => {
                    const pct = item.valueUsd > 0 ? Math.min(100, Math.round((item.valueUsd / maxOutcomeUsd) * 100)) : 0;
                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">{item.category}</span>
                          <span className="font-mono text-slate-600 tabular-nums">
                            {formatUsdCompact(item.valueUsd)} USD · {item.count} records
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-300"
                            style={{ backgroundColor: item.color, width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span className="font-mono tabular-nums">
              {filteredTransactions.length} invoices · {filteredTradeEngagements.length} B2B deals
            </span>
            <button
              type="button"
              onClick={() => onNavigate(secondaryCardTab === 'revenue' ? 'commercial' : 'trade')}
              className="text-[#198754] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>{secondaryCardTab === 'revenue' ? 'Commercial Ledger' : 'Trade Desk'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      </div>

      {/* Row 4: AdminLTE Bottom Operational Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: Latest Exhibitors & Stand Allocations Table */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-md flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              Latest Exhibitors &amp; Stand Allocations
            </h2>
            <span className="text-[11px] font-mono text-slate-500 tabular-nums">
              Showing {Math.min(6, filteredExhibitors.length)} of {filteredExhibitors.length}
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            {filteredExhibitors.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No exhibitor stands match the active filters.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4">Organization</th>
                    <th className="py-2.5 px-3">Sector</th>
                    <th className="py-2.5 px-3">Origin</th>
                    <th className="py-2.5 px-3">Stand</th>
                    <th className="py-2.5 px-4 text-right">Area (sqm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExhibitors.slice(0, 6).map((ex) => (
                    <tr key={ex.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{ex.companyName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{ex.sector}</td>
                      <td className="py-2.5 px-3 text-slate-600">{ex.country}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{ex.hallStand}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800 font-semibold">
                        {ex.standSizeSqm}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => onNavigate('exhibitors')}
              className="px-3 py-1 bg-[#0d6efd] hover:bg-blue-700 text-white rounded font-semibold cursor-pointer"
            >
              View All Exhibitors
            </button>
            <button
              type="button"
              onClick={() => onNavigate('data')}
              className="text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
            >
              Open Data Warehouse -&gt;
            </button>
          </div>
        </section>

        {/* Right 5 Cols: AdminLTE Hall Capacity Utilization Progress Group */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-md flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              Hall Capacity Utilization
            </h2>
            <span className="text-[11px] font-mono text-slate-500 tabular-nums">
              {hallUtilisation.length} Active Halls
            </span>
          </div>

          <div className="p-4 space-y-3.5 flex-1">
            {hallUtilisation.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No hall utilization telemetry recorded.
              </div>
            ) : (
              hallUtilisation.slice(0, 6).map((hall) => {
                const pct = Math.min(100, Math.round(hall.utilizationRatePct));
                const barColor =
                  pct >= 90
                    ? 'bg-[#dc3545]'
                    : pct >= 70
                    ? 'bg-[#198754]'
                    : 'bg-[#0d6efd]';

                return (
                  <div key={hall.hallId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 truncate pr-2">
                        {hall.hallName}
                      </span>
                      <span className="font-mono text-slate-600 tabular-nums shrink-0">
                        <strong className="text-slate-900">{hall.occupiedSqm.toLocaleString()}</strong> /{' '}
                        {hall.totalCapacitySqm.toLocaleString()} sqm ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className={`${barColor} h-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span className="font-mono tabular-nums">
              Mean Occupancy: {executiveMetrics.spaceOccupancyPct}%
            </span>
            <button
              type="button"
              onClick={() => onNavigate('operations')}
              className="text-[#0d6efd] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Operations Monitor</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      </div>

      <ShareCollaborateModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        targetType="Dashboard"
        targetId={`exec-dashboard-${selectedEditionId}`}
        targetTitle={`Executive BI Dashboard Snapshot — ${editionTitle}`}
        editionId={selectedEditionId === 'all' ? 'zitf-2026' : selectedEditionId}
        snapshotSummary={`Exhibitors: ${executiveMetrics.totalExhibitors} (${executiveMetrics.internationalPct}% Int'l) | Visitors: ${executiveMetrics.totalVisitors.toLocaleString()} | Revenue: ${formatUsdCompact(executiveMetrics.totalRevenueUsd)} (${executiveMetrics.collectionRatePct}% Collected) | Verified Trade Deals: ${formatUsdCompact(executiveMetrics.verifiedDealsUsd)} | Occupancy: ${executiveMetrics.spaceOccupancyPct}%`}
        onSuccessNavigateToCollab={() => onNavigate('collaborate')}
      />
    </div>
  );
};
