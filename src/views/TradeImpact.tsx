import React, { useState, useMemo } from 'react';
import { useBI } from '../context/BIContext';
import { TradeEngagement, TradeOpportunityType, TradeEngagementStatus } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { FilterBar } from '../components/common/FilterBar';
import { formatUsdCompact } from '../utils/formatters';
import {
  Handshake,
  Plus,
  Search,
  CheckCircle,
  FileCheck,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Building,
  Upload,
  ExternalLink,
  Trash2,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export const TradeImpact: React.FC = () => {
  const {
    filteredTradeEngagements,
    addTradeEngagement,
    updateTradeEngagement,
    deleteTradeEngagement,
    verifyTradeDeal,
    selectedEditionId,
    editions,
    executiveMetrics,
    can,
  } = useBI();

  const canWriteTrade = can('trade:write');
  const canVerifyTrade = can('trade:verify');

  const currentEditionObj = editions.find((e) => e.id === selectedEditionId);
  const editionTitle = currentEditionObj ? currentEditionObj.name : 'Historical';

  const [localSearch, setLocalSearch] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [verifyingDeal, setVerifyingDeal] = useState<TradeEngagement | null>(null);
  const [supportingDocInput, setSupportingDocInput] = useState('');
  const [selectedDealForDetail, setSelectedDealForDetail] = useState<TradeEngagement | null>(null);

  const [formData, setFormData] = useState<Partial<TradeEngagement>>({
    buyerOrg: '',
    buyerCountry: 'Zimbabwe',
    supplierOrg: '',
    supplierCountry: 'Zimbabwe',
    industry: 'Mining & Natural Resources',
    opportunityType: 'Supply Contract',
    description: '',
    estimatedValueUsd: 1500000,
    engagementStatus: 'Meeting Scheduled',
    followUpDate: '2026-05-30',
    outcome: 'B2B matchmaking conducted at ZITF International Business Centre.',
    verificationStatus: 'Facilitated Opportunity',
    editionId: selectedEditionId === 'all' ? 'zitf-2026' : selectedEditionId,
  });

  const displayedEngagements = filteredTradeEngagements.filter((te) => {
    if (verificationFilter !== 'all' && te.verificationStatus !== verificationFilter) return false;
    if (statusFilter !== 'all' && te.engagementStatus !== statusFilter) return false;
    if (localSearch.trim()) {
      const q = localSearch.toLowerCase();
      return (
        te.buyerOrg.toLowerCase().includes(q) ||
        te.supplierOrg.toLowerCase().includes(q) ||
        te.refNumber.toLowerCase().includes(q) ||
        te.opportunityType.toLowerCase().includes(q) ||
        te.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Live Analytics computed from filteredTradeEngagements
  const dealTypeData = useMemo(() => {
    const map = new Map<string, { valueUsd: number; count: number }>();
    filteredTradeEngagements.forEach((te) => {
      const key = te.opportunityType || 'Supply Contract';
      const cur = map.get(key) || { valueUsd: 0, count: 0 };
      map.set(key, {
        valueUsd: cur.valueUsd + (Number(te.estimatedValueUsd) || 0),
        count: cur.count + 1,
      });
    });
    return Array.from(map.entries())
      .map(([type, info]) => ({
        type,
        value: Number((info.valueUsd / 1_000_000).toFixed(2)),
        valueUsd: info.valueUsd,
        count: info.count,
      }))
      .sort((a, b) => b.valueUsd - a.valueUsd);
  }, [filteredTradeEngagements]);

  const verificationBreakdownData = useMemo(() => {
    const verifiedUsd = executiveMetrics.verifiedDealsUsd;
    const reportedUsd = executiveMetrics.reportedDealsUsd;
    const facilitatedUsd = executiveMetrics.facilitatedDealsUsd;
    return [
      {
        name: 'Independently Verified',
        value: Number((verifiedUsd / 1_000_000).toFixed(2)),
        rawUsd: verifiedUsd,
        count: executiveMetrics.verifiedDealsCount,
        color: '#059669',
      },
      {
        name: 'Reported by Participants',
        value: Number((reportedUsd / 1_000_000).toFixed(2)),
        rawUsd: reportedUsd,
        count: executiveMetrics.reportedDealsCount,
        color: '#D97706',
      },
      {
        name: 'Facilitated Pipeline',
        value: Number((facilitatedUsd / 1_000_000).toFixed(2)),
        rawUsd: facilitatedUsd,
        count: executiveMetrics.facilitatedOppsCount,
        color: '#2563EB',
      },
    ];
  }, [executiveMetrics]);

  const crossBorderPct = useMemo(() => {
    if (filteredTradeEngagements.length === 0) return 0;
    const crossBorder = filteredTradeEngagements.filter(
      (t) => t.buyerCountry.trim().toLowerCase() !== t.supplierCountry.trim().toLowerCase()
    ).length;
    return Math.round((crossBorder / filteredTradeEngagements.length) * 100);
  }, [filteredTradeEngagements]);

  const handleSaveEngagement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.buyerOrg || !formData.supplierOrg) return;

    addTradeEngagement({
      ...formData,
      refNumber: `TE-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().substring(0, 10),
    } as any);

    setIsAddModalOpen(false);
  };

  const handleConfirmVerification = () => {
    if (!verifyingDeal) return;
    verifyTradeDeal(verifyingDeal.id, supportingDocInput || 'Bilateral_Trade_Contract_Verification.pdf');
    setVerifyingDeal(null);
    setSupportingDocInput('');
  };

  const handleExportCsv = () => {
    const headers = [
      'Ref Number',
      'Buyer Organization',
      'Buyer Country',
      'Supplier / Exhibitor',
      'Supplier Country',
      'Industry',
      'Opportunity Type',
      'Est. Value (USD)',
      'Status',
      'Verification Status',
      'Verified Date',
    ];

    const rows = displayedEngagements.map((te) => [
      `"${te.refNumber}"`,
      `"${te.buyerOrg.replace(/"/g, '""')}"`,
      `"${te.buyerCountry}"`,
      `"${te.supplierOrg.replace(/"/g, '""')}"`,
      `"${te.supplierCountry}"`,
      `"${te.industry}"`,
      `"${te.opportunityType}"`,
      te.estimatedValueUsd,
      `"${te.engagementStatus}"`,
      `"${te.verificationStatus}"`,
      `"${te.verifiedDate || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ZITF_Trade_Impact_Engagements_${selectedEditionId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Module Four: Trade Impact &amp; B2B Engagements
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
              {editionTitle}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Audited measurement of business connections, bilateral supplier contracts, export deals, and independent transaction verification.
          </p>
        </div>

        {canWriteTrade && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Log New Trade Engagement</span>
          </button>
        )}
      </div>

      <FilterBar
        onExportCsv={handleExportCsv}
        exportLabel="Export Trade Records (CSV)"
        totalFilteredCount={displayedEngagements.length}
        totalLabel="Logged Engagements"
      />

      {/* Strategic Notice Strip: Clear 3-Tier Classification Rigor */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold tracking-wider uppercase text-amber-400">
            Methodological Trade Governance Framework
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed mb-3">
          To maintain international credibility, ZITF does not classify every casual business inquiry as a concluded commercial transaction. All engagements are strictly audited across three distinct verification tiers:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80">
            <div className="flex items-center gap-1.5 font-bold text-blue-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span>1. Opportunities Facilitated ({formatUsdCompact(executiveMetrics.facilitatedDealsUsd)})</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Matchmaking introductions, B2B meetings, and quotation requests organized through the ZITF Business Centre ({executiveMetrics.facilitatedOppsCount} active leads).
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80">
            <div className="flex items-center gap-1.5 font-bold text-amber-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>2. Reported Deals ({formatUsdCompact(executiveMetrics.reportedDealsUsd)})</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Commercial deal sizes self-declared by buyers or exhibitors during post-meeting exit questionnaires ({executiveMetrics.reportedDealsCount} engagements).
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>3. Independently Verified ({formatUsdCompact(executiveMetrics.verifiedDealsUsd)})</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Formally audited transactions substantiated with signed supply agreements, distributor contracts, or letters of intent ({executiveMetrics.verifiedDealsCount} deals).
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
        <MetricCard
          title="B2B Meetings"
          value={executiveMetrics.b2bMeetingsCount.toLocaleString()}
          icon={Handshake}
          badge={`${crossBorderPct}% Cross-Border`}
          badgeVariant="purple"
          breakdown={[
            { label: 'Converted', value: String(executiveMetrics.convertedDealsCount) },
            { label: 'Facilitated Pipeline', value: String(executiveMetrics.facilitatedOppsCount) },
          ]}
          insight={
            executiveMetrics.b2bMeetingsCount > 0
              ? `${executiveMetrics.b2bMeetingsCount} logged B2B matchmaking sessions in ${editionTitle}; ${crossBorderPct}% involve cross-border buyer-supplier pairs.`
              : `No B2B trade engagements recorded for ${editionTitle}.`
          }
          subtitle="Logged B2B Sessions"
          deepDive={{
            headline: 'Live B2B Matchmaking Funnel',
            drivers: [
              'Aggregated directly from TradeEngagement rows in the SQLite warehouse',
              `${executiveMetrics.convertedDealsCount} engagements currently marked as Opportunity Converted`,
            ],
            recommendation: 'Verify supporting contracts on completed negotiations to promote deals into Tier 3.',
          }}
        />

        <MetricCard
          title="Verified Deals"
          value={formatUsdCompact(executiveMetrics.verifiedDealsUsd)}
          icon={CheckCircle}
          badge={`${executiveMetrics.verifiedDealsCount} Audited`}
          badgeVariant="emerald"
          breakdown={[
            { label: 'Verified Count', value: String(executiveMetrics.verifiedDealsCount) },
            { label: 'Total Pipeline', value: formatUsdCompact(executiveMetrics.verifiedDealsUsd + executiveMetrics.reportedDealsUsd + executiveMetrics.facilitatedDealsUsd) },
          ]}
          insight={
            executiveMetrics.verifiedDealsUsd > 0
              ? `Independently audited contracts total ${formatUsdCompact(executiveMetrics.verifiedDealsUsd)} across ${executiveMetrics.verifiedDealsCount} verified engagement(s).`
              : `No independently verified contracts in ${editionTitle} yet.`
          }
          subtitle="Audited Contracts"
          deepDive={{
            headline: 'Empirical Economic Deal Verification',
            drivers: [
              'Includes only deals whose verificationStatus is Independently Verified',
              'Backed by documented supporting contract filenames and cryptographic audit timestamps',
            ],
            recommendation: 'Use the "Verify Deal" action on qualified participant-reported contracts below.',
          }}
        />

        <MetricCard
          title="Reported Value"
          value={formatUsdCompact(executiveMetrics.reportedDealsUsd)}
          icon={FileCheck}
          badge={`${executiveMetrics.reportedDealsCount} Reported`}
          badgeVariant="blue"
          breakdown={[
            { label: 'Reported Deals', value: String(executiveMetrics.reportedDealsCount) },
            { label: 'Facilitated', value: formatUsdCompact(executiveMetrics.facilitatedDealsUsd) },
          ]}
          insight={
            executiveMetrics.reportedDealsUsd > 0
              ? `Participants self-declared ${formatUsdCompact(executiveMetrics.reportedDealsUsd)} across ${executiveMetrics.reportedDealsCount} commercial deal(s) awaiting formal audit.`
              : `No participant-reported deal values logged in ${editionTitle}.`
          }
          subtitle="Self-Declared Pipeline"
          deepDive={{
            headline: 'Participant-Reported Pipeline Tracking',
            drivers: [
              'Captures exit survey and exhibitor-declared transaction estimates separately from audited totals',
              'Facilitated pipeline sits separately at ' + formatUsdCompact(executiveMetrics.facilitatedDealsUsd),
            ],
            recommendation: 'Conduct post-fair buyer verification checks to validate reported estimates.',
          }}
        />

        <MetricCard
          title="Follow-up Rate"
          value={`${executiveMetrics.followUpRatePct}%`}
          icon={Building}
          badge="Active Continuity"
          badgeVariant="emerald"
          targetValue="85.0% Goal"
          targetProgress={Math.min(100, Math.round((executiveMetrics.followUpRatePct / 85) * 100))}
          breakdown={[
            { label: 'Active / Advanced', value: `${executiveMetrics.followUpRatePct}%` },
            { label: 'Total Logged', value: String(executiveMetrics.b2bMeetingsCount) },
          ]}
          insight={
            executiveMetrics.b2bMeetingsCount > 0
              ? `${executiveMetrics.followUpRatePct}% of logged B2B engagements have progressed past initial introduction into active follow-up, negotiation, or conversion.`
              : 'No engagements available to compute follow-up progression.'
          }
          subtitle="Active Deal Pipeline"
          deepDive={{
            headline: 'Post-Meeting Pipeline Continuity',
            drivers: [
              'Measures share of deals excluding New and Closed / Unsuccessful states',
              'Updated dynamically as trade officers advance deal engagement statuses',
            ],
            recommendation: 'Review deals flagged as Follow-up Required before scheduled deadlines.',
          }}
        />

        <MetricCard
          title="Converted Deals"
          value={executiveMetrics.convertedDealsCount.toLocaleString()}
          icon={Handshake}
          badge="Signed / Converted"
          badgeVariant="purple"
          breakdown={[
            { label: 'Converted Status', value: String(executiveMetrics.convertedDealsCount) },
            { label: 'Verified Tier', value: String(executiveMetrics.verifiedDealsCount) },
          ]}
          insight={
            executiveMetrics.convertedDealsCount > 0
              ? `${executiveMetrics.convertedDealsCount} logged engagement(s) reached Opportunity Converted status.`
              : 'No engagements currently marked Opportunity Converted.'
          }
          subtitle="Contracts Concluded"
          deepDive={{
            headline: 'Deal Conversion Tracking',
            drivers: [
              'Counts TradeEngagement records with status Opportunity Converted',
              'Tracked across Supply Contracts, Export Opportunities, Distribution, and Investment leads',
            ],
            recommendation: 'Ensure every converted engagement uploads its signed MoU or contract reference.',
          }}
        />

        <MetricCard
          title="Active Leads"
          value={executiveMetrics.smeLeadsCount.toLocaleString()}
          icon={Building}
          badge="Pipeline Leads"
          badgeVariant="amber"
          breakdown={[
            { label: 'Supply / Export', value: String(filteredTradeEngagements.filter((t) => t.opportunityType === 'Supply Contract' || t.opportunityType === 'Export Opportunity').length) },
            { label: 'Dist / JV / Inv', value: String(filteredTradeEngagements.filter((t) => t.opportunityType !== 'Supply Contract' && t.opportunityType !== 'Export Opportunity').length) },
          ]}
          insight={
            executiveMetrics.smeLeadsCount > 0
              ? `${executiveMetrics.smeLeadsCount} active open trade leads excluding Closed / Unsuccessful engagements.`
              : 'No active trade leads remaining in the pipeline.'
          }
          subtitle="Open Pipeline Deals"
          deepDive={{
            headline: 'Active Commercial Pipeline Volume',
            drivers: [
              'Counts all engagements except Closed / Unsuccessful entries',
              'Provides management visibility into ongoing supply, export, and distributor negotiations',
            ],
            recommendation: 'Route open leads to regional trade attaches for 90-day closure tracking.',
          }}
        />
      </div>

      {/* Visualisations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deal Value by Opportunity Type */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-slate-900">Commercial Pipeline by Opportunity Type ($M USD)</h3>
            <p className="text-xs text-slate-500">Live aggregation across supply contracts, export deals, and investments</p>
          </div>
          <div className="h-64">
            {dealTypeData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                No trade engagement records in current filter scope.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dealTypeData} margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                  <XAxis dataKey="type" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="M" />
                  <Tooltip
                    formatter={(_val: any, _name: any, item: any) => [
                      `${formatUsdCompact(item.payload.valueUsd)} (${item.payload.count} deals)`,
                      'Estimated Value',
                    ]}
                    contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="value" fill="#0F2137" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Verification Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-slate-900">Trade Outcome Verification Split</h3>
            <p className="text-xs text-slate-500">Independently verified vs participant reported vs active leads</p>
          </div>
          {filteredTradeEngagements.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No engagements available to break down by verification tier.
            </div>
          ) : (
            <div className="h-64 flex flex-col sm:flex-row items-center justify-between">
              <div className="w-full sm:w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={verificationBreakdownData.filter((v) => v.rawUsd > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {verificationBreakdownData
                        .filter((v) => v.rawUsd > 0)
                        .map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                      formatter={(_val: any, _n: any, item: any) => [
                        `${formatUsdCompact(item.payload.rawUsd)} (${item.payload.count} records)`,
                        item.payload.name,
                      ]}
                      contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full sm:w-1/2 space-y-2 text-xs">
                {verificationBreakdownData.map((item, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-200/60">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-slate-800">{item.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{item.count} deals</span>
                    </div>
                    <div className="text-base font-bold text-slate-900 tabular-nums">
                      {formatUsdCompact(item.rawUsd)} <span className="text-xs font-normal text-slate-500">USD</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trade Engagements Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by buyer, supplier, ref number, or industry..."
              className="w-full bg-slate-50 pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Verification:</span>
            <select
              aria-label="Verification Filter"
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="all">All Verification Tiers</option>
              <option value="Independently Verified">Independently Verified</option>
              <option value="Reported by Participant">Reported by Participant</option>
              <option value="Facilitated Opportunity">Facilitated Opportunity</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Engagement Ref &amp; Date</th>
                <th className="px-4 py-3">Buyer &amp; Supplier Match</th>
                <th className="px-4 py-3">Opportunity Type</th>
                <th className="px-4 py-3">Estimated Value</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Verification Tier</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayedEngagements.map((te) => (
                <tr key={te.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold text-slate-900">{te.refNumber}</div>
                    <div className="text-[11px] text-slate-400">{te.date}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-medium text-slate-900">
                      <span>{te.buyerOrg}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span>{te.supplierOrg}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {te.buyerCountry} ➔ {te.supplierCountry} · {te.industry}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800">{te.opportunityType}</span>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{te.description}</p>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900 tabular-nums">
                    ${(te.estimatedValueUsd / 1000).toLocaleString()}k
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {te.engagementStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        te.verificationStatus === 'Independently Verified'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : te.verificationStatus === 'Reported by Participant'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {te.verificationStatus === 'Independently Verified' && <CheckCircle className="w-3 h-3" />}
                      <span>{te.verificationStatus}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {canVerifyTrade && te.verificationStatus !== 'Independently Verified' && (
                        <button
                          onClick={() => {
                            setVerifyingDeal(te);
                            setSupportingDocInput(te.supportingDocName || 'Executed_Agreement.pdf');
                          }}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Verify Deal</span>
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedDealForDetail(te)}
                        className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      {canWriteTrade && (
                        <button
                          onClick={() => deleteTradeEngagement(te.id)}
                          title="Delete engagement"
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verify Deal Modal */}
      {verifyingDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
                <span className="text-sm font-bold">Independent Deal Verification</span>
              </div>
              <button onClick={() => setVerifyingDeal(null)} className="text-emerald-200 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-slate-600 leading-relaxed">
                You are transitioning trade engagement <strong className="text-slate-900">{verifyingDeal.refNumber}</strong> ({verifyingDeal.buyerOrg} ➔ {verifyingDeal.supplierOrg}) into <strong className="text-emerald-700">Independently Verified</strong> status.
              </p>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="text-[11px] text-slate-500">Declared Value:</div>
                <div className="text-base font-bold text-slate-900">
                  ${verifyingDeal.estimatedValueUsd.toLocaleString()} USD
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Supporting Verification Document / MoU Name
                </label>
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={supportingDocInput}
                    onChange={(e) => setSupportingDocInput(e.target.value)}
                    placeholder="e.g. Export_Agreement_Signed.pdf"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Timestamp and user audit signature will be cryptographically logged.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVerifyingDeal(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmVerification}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
                >
                  Confirm Verification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedDealForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="text-base font-bold">{selectedDealForDetail.refNumber}</div>
                <div className="text-amber-400 text-xs">{selectedDealForDetail.opportunityType}</div>
              </div>
              <button onClick={() => setSelectedDealForDetail(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Matchmaking Parties</div>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  {selectedDealForDetail.buyerOrg} ({selectedDealForDetail.buyerCountry})
                </div>
                <div className="text-xs text-slate-600">Supplying Partner: {selectedDealForDetail.supplierOrg} ({selectedDealForDetail.supplierCountry})</div>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">Opportunity Scope &amp; Terms:</span>
                <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
                  {selectedDealForDetail.description}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">Documented Outcome:</span>
                <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
                  {selectedDealForDetail.outcome}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="p-2 border border-slate-200 rounded">
                  <span className="text-slate-400 block">Estimated Commercial Value</span>
                  <span className="text-sm font-bold text-slate-900">${selectedDealForDetail.estimatedValueUsd.toLocaleString()} USD</span>
                </div>
                <div className="p-2 border border-slate-200 rounded">
                  <span className="text-slate-400 block">Supporting Document</span>
                  <span className="font-mono text-slate-800">{selectedDealForDetail.supportingDocName || 'Pending Audit Upload'}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedDealForDetail(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-medium"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Trade Engagement Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-sm font-bold">Log New B2B Trade Engagement</span>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEngagement} className="p-5 space-y-3 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Buyer Organization *</label>
                  <input
                    type="text"
                    required
                    value={formData.buyerOrg || ''}
                    onChange={(e) => setFormData({ ...formData, buyerOrg: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Buyer Country</label>
                  <input
                    type="text"
                    value={formData.buyerCountry || 'Zimbabwe'}
                    onChange={(e) => setFormData({ ...formData, buyerCountry: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Supplier / Exhibitor *</label>
                  <input
                    type="text"
                    required
                    value={formData.supplierOrg || ''}
                    onChange={(e) => setFormData({ ...formData, supplierOrg: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Supplier Country</label>
                  <input
                    type="text"
                    value={formData.supplierCountry || 'Zimbabwe'}
                    onChange={(e) => setFormData({ ...formData, supplierCountry: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Opportunity Type</label>
                  <select
                    value={formData.opportunityType || 'Supply Contract'}
                    onChange={(e) => setFormData({ ...formData, opportunityType: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="Supply Contract">Supply Contract</option>
                    <option value="Export Opportunity">Export Opportunity</option>
                    <option value="Import Opportunity">Import Opportunity</option>
                    <option value="Distribution Agreement">Distribution Agreement</option>
                    <option value="Joint Venture / Partnership">Joint Venture / Partnership</option>
                    <option value="Investment Enquiry">Investment Enquiry</option>
                    <option value="Technology Transfer">Technology Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Estimated Value (USD)</label>
                  <input
                    type="number"
                    value={formData.estimatedValueUsd || 1000000}
                    onChange={(e) => setFormData({ ...formData, estimatedValueUsd: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Details of the commercial engagement, scope, products..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Engagement Status</label>
                  <select
                    value={formData.engagementStatus || 'Meeting Scheduled'}
                    onChange={(e) => setFormData({ ...formData, engagementStatus: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="New">New</option>
                    <option value="Contact Established">Contact Established</option>
                    <option value="Meeting Scheduled">Meeting Scheduled</option>
                    <option value="Meeting Completed">Meeting Completed</option>
                    <option value="Follow-up Required">Follow-up Required</option>
                    <option value="Negotiation Ongoing">Negotiation Ongoing</option>
                    <option value="Opportunity Converted">Opportunity Converted</option>
                    <option value="Closed / Unsuccessful">Closed / Unsuccessful</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Verification Status</label>
                  <select
                    value={formData.verificationStatus || 'Facilitated Opportunity'}
                    onChange={(e) => setFormData({ ...formData, verificationStatus: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="Facilitated Opportunity">1. Facilitated Opportunity</option>
                    <option value="Reported by Participant">2. Reported by Participant</option>
                    <option value="Independently Verified">3. Independently Verified</option>
                  </select>
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
                  Save Engagement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
