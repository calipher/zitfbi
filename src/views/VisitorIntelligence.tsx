import React, { useState, useMemo } from 'react';
import { useBI } from '../context/BIContext';
import { Visitor } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { FilterBar } from '../components/common/FilterBar';
import {
  Users,
  Plus,
  Search,
  CheckCircle2,
  Briefcase,
  Globe,
  Trash2,
  X,
  Star,
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
} from 'recharts';

export const VisitorIntelligence: React.FC = () => {
  const {
    filteredVisitors,
    addVisitor,
    deleteVisitor,
    selectedEditionId,
    editions,
    executiveMetrics,
  } = useBI();

  const currentEditionObj = editions.find((e) => e.id === selectedEditionId);
  const editionTitle = currentEditionObj ? currentEditionObj.name : 'Historical';

  const [localSearch, setLocalSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<Visitor>>({
    fullName: '',
    visitorRef: '',
    category: 'Business Visitors',
    country: 'Zimbabwe',
    cityProvince: 'Bulawayo',
    organization: '',
    industry: 'Mining & Quarrying',
    email: '',
    phone: '+263 ',
    editionId: selectedEditionId === 'all' ? 'zitf-2026' : selectedEditionId,
    attendanceDays: ['Day 1 - 21 Apr'],
    interests: ['Mining Equipment', 'Clean Power'],
    areasVisited: ['Hall 1', 'Hall 3'],
    feedbackRating: 5,
    repeatVisitor: true,
  });

  const displayedVisitors = filteredVisitors.filter((v) => {
    if (categoryFilter !== 'all' && v.category !== categoryFilter) return false;
    if (localSearch.trim()) {
      const q = localSearch.toLowerCase();
      return (
        v.fullName.toLowerCase().includes(q) ||
        v.visitorRef.toLowerCase().includes(q) ||
        v.organization.toLowerCase().includes(q) ||
        v.country.toLowerCase().includes(q) ||
        v.cityProvince.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Live Analytics computed from filteredVisitors
  const categoryChartData = useMemo(() => {
    const VISITOR_COLORS: Record<string, string> = {
      'Business Visitors': '#0F2137',
      'Buyers and Procurement': '#059669',
      'International Delegates': '#C69214',
      Investors: '#2563EB',
      'Government Representatives': '#0EA5E9',
      'General Public': '#64748B',
      Students: '#8B5CF6',
      'Media Representatives': '#EC4899',
    };
    const counts = new Map<string, number>();
    filteredVisitors.forEach((v) => {
      const key = v.category || 'Business Visitors';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        count,
        color: VISITOR_COLORS[name] || '#475569',
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredVisitors]);

  const interestData = useMemo(() => {
    const counts = new Map<string, number>();
    filteredVisitors.forEach((v) => {
      (v.interests || []).forEach((interest) => {
        const key = interest.trim();
        if (key) counts.set(key, (counts.get(key) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .map(([interest, delegates]) => ({ interest, delegates }))
      .sort((a, b) => b.delegates - a.delegates)
      .slice(0, 8);
  }, [filteredVisitors]);

  const daySplitCounts = useMemo(() => {
    const bizDays = filteredVisitors.filter((v) =>
      v.attendanceDays.some((d) => d.includes('Day 1') || d.includes('Day 2') || d.includes('Day 3'))
    ).length;
    const pubDays = filteredVisitors.filter((v) =>
      v.attendanceDays.some((d) => d.includes('Day 4') || d.includes('Day 5'))
    ).length;
    return { bizDays, pubDays };
  }, [filteredVisitors]);

  const handleSaveVisitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName) return;

    addVisitor({
      ...formData,
      visitorRef: `VR-${Date.now().toString().slice(-5)}`,
      registrationDate: new Date().toISOString().substring(0, 10),
    } as any);

    setIsAddModalOpen(false);
  };

  const handleExportCsv = () => {
    const headers = [
      'Visitor Reference',
      'Full Name',
      'Category',
      'Organization',
      'Industry',
      'Country',
      'Province / City',
      'Attendance Days',
      'Feedback Rating',
    ];

    const rows = displayedVisitors.map((v) => [
      `"${v.visitorRef}"`,
      `"${v.fullName.replace(/"/g, '""')}"`,
      `"${v.category}"`,
      `"${v.organization.replace(/"/g, '""')}"`,
      `"${v.industry}"`,
      `"${v.country}"`,
      `"${v.cityProvince}"`,
      `"${v.attendanceDays.join('; ')}"`,
      v.feedbackRating,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ZITF_Visitor_Database_${selectedEditionId}.csv`);
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
              Module Two: Visitor Intelligence
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
              {editionTitle}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Analyze attendee demographics, business delegate segmentation, sourcing interests, and exit satisfaction.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Register New Visitor</span>
        </button>
      </div>

      <FilterBar
        onExportCsv={handleExportCsv}
        exportLabel="Export Visitors (CSV)"
        totalFilteredCount={displayedVisitors.length}
        totalLabel="Registered Visitors"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
        <MetricCard
          title="Total Visitors"
          value={executiveMetrics.totalVisitors.toLocaleString()}
          icon={Users}
          badge={filteredVisitors.length > 0 ? 'Warehouse Live' : 'No Records'}
          badgeVariant={filteredVisitors.length > 0 ? 'blue' : 'slate'}
          breakdown={[
            { label: 'Trade Delegates', value: executiveMetrics.businessVisitors.toLocaleString() },
            { label: 'Public / Students', value: executiveMetrics.publicVisitors.toLocaleString() },
          ]}
          insight={
            executiveMetrics.totalVisitors > 0
              ? `${executiveMetrics.totalVisitors.toLocaleString()} registered visitors in ${editionTitle}; ${daySplitCounts.bizDays} attended Business Days 1–3 and ${daySplitCounts.pubDays} attended Consumer Days 4–5.`
              : `No visitor registrations recorded for ${editionTitle}.`
          }
          subtitle="All Registered Attendees"
          deepDive={{
            headline: 'Live Attendance Composition',
            drivers: [
              `Trade & Business Delegates account for ${executiveMetrics.totalVisitors > 0 ? Math.round((executiveMetrics.businessVisitors / executiveMetrics.totalVisitors) * 100) : 0}% of total registered visitors`,
              `${executiveMetrics.foreignVisitorsCount} international attendees logged from ${executiveMetrics.foreignVisitorCountriesCount} foreign countries`,
            ],
            recommendation: 'Import gate turnstile scans or CSV registration exports in Data Management to keep counts current.',
          }}
        />

        <MetricCard
          title="Trade Delegates"
          value={executiveMetrics.businessVisitors.toLocaleString()}
          icon={Briefcase}
          badge="Business Segments"
          badgeVariant="emerald"
          breakdown={[
            { label: 'Days 1–3 Logs', value: daySplitCounts.bizDays.toLocaleString() },
            { label: 'Share of Total', value: executiveMetrics.totalVisitors > 0 ? `${((executiveMetrics.businessVisitors / executiveMetrics.totalVisitors) * 100).toFixed(1)}%` : '0%' },
          ]}
          insight={
            executiveMetrics.businessVisitors > 0
              ? `${executiveMetrics.businessVisitors.toLocaleString()} high-intent business, procurement, investor, and government delegates registered.`
              : `No accredited trade delegates recorded for ${editionTitle}.`
          }
          subtitle="Business & Buyers"
          deepDive={{
            headline: 'Commercial Buyer Segmentation',
            drivers: [
              'Aggregated directly from Business Visitors, Buyers & Procurement, International Delegates, Investors, and Government categories',
              `Top sourcing sectors derived from ${interestData.length} active interest tags`,
            ],
            recommendation: 'Match accredited procurement buyers with exhibitors via Trade Impact B2B logging.',
          }}
        />

        <MetricCard
          title="Public Attendance"
          value={executiveMetrics.publicVisitors.toLocaleString()}
          icon={Users}
          badge="Consumer Days"
          badgeVariant="amber"
          breakdown={[
            { label: 'Days 4–5 Logs', value: daySplitCounts.pubDays.toLocaleString() },
            { label: 'Share of Total', value: executiveMetrics.totalVisitors > 0 ? `${((executiveMetrics.publicVisitors / executiveMetrics.totalVisitors) * 100).toFixed(1)}%` : '0%' },
          ]}
          insight={
            executiveMetrics.publicVisitors > 0
              ? `${executiveMetrics.publicVisitors.toLocaleString()} general public, student, and media attendees recorded in the centralized warehouse.`
              : `No public/consumer day registrations in ${editionTitle}.`
          }
          subtitle="General Public & Media"
          deepDive={{
            headline: 'Consumer & Educational Footfall',
            drivers: [
              'Includes General Public, Students, and Media Representatives registered in the active scope',
              `${daySplitCounts.pubDays} visitor passes scanned on Consumer Days 4–5`,
            ],
            recommendation: 'Schedule consumer retail promotions and student tours across Halls 3 and 5.',
          }}
        />

        <MetricCard
          title="Foreign Delegates"
          value={executiveMetrics.foreignVisitorsCount.toLocaleString()}
          icon={Globe}
          badge={`${executiveMetrics.foreignVisitorCountriesCount} Nations`}
          badgeVariant="purple"
          breakdown={[
            { label: 'Domestic (ZW)', value: (executiveMetrics.totalVisitors - executiveMetrics.foreignVisitorsCount).toLocaleString() },
            { label: 'Foreign Share', value: executiveMetrics.totalVisitors > 0 ? `${((executiveMetrics.foreignVisitorsCount / executiveMetrics.totalVisitors) * 100).toFixed(1)}%` : '0%' },
          ]}
          insight={
            executiveMetrics.foreignVisitorsCount > 0
              ? `${executiveMetrics.foreignVisitorsCount.toLocaleString()} foreign visitors logged across ${executiveMetrics.foreignVisitorCountriesCount} distinct non-Zimbabwe nationalities.`
              : `No foreign delegate entries currently recorded in ${editionTitle}.`
          }
          subtitle={`${executiveMetrics.foreignVisitorCountriesCount} Foreign Countries`}
          deepDive={{
            headline: 'Cross-Border Visitor Reach',
            drivers: [
              'Counted directly from non-Zimbabwe country fields in the Visitor table',
              'Supports bilateral trade corridor analysis across SADC and intercontinental markets',
            ],
            recommendation: 'Prioritize fast-track airport accreditation for top source countries.',
          }}
        />

        <MetricCard
          title="Repeat Visitors"
          value={`${executiveMetrics.repeatVisitorPct}%`}
          icon={CheckCircle2}
          badge="Recurring Loyalty"
          badgeVariant="emerald"
          targetValue="70.0% Goal"
          targetProgress={Math.min(100, Math.round((executiveMetrics.repeatVisitorPct / 70) * 100))}
          breakdown={[
            { label: 'Repeat Count', value: executiveMetrics.repeatVisitorsCount.toLocaleString() },
            { label: 'First-Time', value: (executiveMetrics.totalVisitors - executiveMetrics.repeatVisitorsCount).toLocaleString() },
          ]}
          insight={
            executiveMetrics.totalVisitors > 0
              ? `${executiveMetrics.repeatVisitorsCount.toLocaleString()} of ${executiveMetrics.totalVisitors.toLocaleString()} attendees (${executiveMetrics.repeatVisitorPct}%) are returning visitors.`
              : 'No attendance loyalty records available.'
          }
          subtitle={`${executiveMetrics.repeatVisitorsCount.toLocaleString()} Returning`}
          deepDive={{
            headline: 'Attendee Loyalty Metrics',
            drivers: [
              'Computed strictly from the repeatVisitor flag on stored visitor records',
              'Measures year-over-year buyer retention for fair programming',
            ],
            recommendation: 'Offer early-bird multi-day digital badges to repeat corporate buyers.',
          }}
        />

        <MetricCard
          title="Visitor Rating"
          value={executiveMetrics.totalVisitors > 0 ? `${executiveMetrics.visitorSatisfaction} / 5.0` : '0.0 / 5.0'}
          icon={Star}
          badge={executiveMetrics.totalVisitors > 0 ? `${Math.round((executiveMetrics.visitorSatisfaction / 5) * 100)}% Index` : 'No Surveys'}
          badgeVariant="emerald"
          targetValue="4.8 / 5.0"
          targetProgress={Math.min(100, Math.round((executiveMetrics.visitorSatisfaction / 4.8) * 100))}
          breakdown={[
            { label: 'Responses', value: executiveMetrics.totalVisitors.toLocaleString() },
            { label: 'Scale Max', value: '5.0' },
          ]}
          insight={
            executiveMetrics.totalVisitors > 0
              ? `Mean post-visit feedback rating across ${executiveMetrics.totalVisitors.toLocaleString()} submitted scores is ${executiveMetrics.visitorSatisfaction} / 5.0.`
              : 'No visitor feedback ratings recorded.'
          }
          subtitle={`Exit Survey (N=${executiveMetrics.totalVisitors})`}
          deepDive={{
            headline: 'Verified Exit Survey Scoring',
            drivers: [
              'Arithmetic average of feedbackRating across all filtered visitor records in SQLite',
              'Tracks attendee experience across wayfinding, matchmaking, and venue facilities',
            ],
            recommendation: 'Audit low-scoring feedback records immediately after gate closure.',
          }}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-slate-900">Attendance Segmentation by Category</h3>
            <p className="text-xs text-slate-500">Live breakdown of accredited buyers, delegates, and public visitors</p>
          </div>
          {categoryChartData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No visitor records found in current filter scope.
            </div>
          ) : (
            <div className="h-60 flex flex-col sm:flex-row items-center justify-between">
              <div className="w-full sm:w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="count"
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [`${val.toLocaleString()} attendees`, 'Attendance']}
                      contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full sm:w-1/2 space-y-1.5 text-xs overflow-y-auto max-h-56 pr-1">
                {categoryChartData.map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="font-medium text-slate-700 truncate">{cat.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 tabular-nums">{cat.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top Sourcing Interests */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-slate-900">Top Sourcing Interests by Sector</h3>
            <p className="text-xs text-slate-500">Live interest tags declared by registered visitors</p>
          </div>
          {interestData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No sourcing interest tags found in current filter scope.
            </div>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={interestData} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="interest" type="category" width={140} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(val: any) => [`${val.toLocaleString()} Buyers`, 'Delegates']}
                    contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="delegates" fill="#0F2137" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Visitor Database Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by name, organization, ref number..."
              className="w-full bg-slate-50 pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Category:</span>
            <select
              aria-label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="Business Visitors">Business Visitors</option>
              <option value="Buyers and Procurement">Buyers and Procurement</option>
              <option value="International Delegates">International Delegates</option>
              <option value="Investors">Investors</option>
              <option value="Government Representatives">Government Representatives</option>
              <option value="General Public">General Public</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Visitor Name &amp; Ref</th>
                <th className="px-4 py-3">Organization &amp; Industry</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Attendance Days</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayedVisitors.map((vis) => (
                <tr key={vis.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{vis.fullName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{vis.visitorRef}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{vis.organization}</div>
                    <div className="text-[11px] text-slate-400">{vis.industry}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded font-medium text-[11px] bg-slate-100 text-slate-800">
                      {vis.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>{vis.country}</div>
                    <div className="text-[11px] text-slate-400">{vis.cityProvince}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[11px] text-slate-600">{vis.attendanceDays.join(', ')}</div>
                    <div className="text-[10px] text-amber-600 font-medium">Rating: {vis.feedbackRating} / 5.0</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Remove visitor registration for ${vis.fullName}?`)) {
                          deleteVisitor(vis.id);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Visitor Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-sm font-bold">Register Trade Visitor / Delegate</span>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVisitor} className="p-5 space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.fullName || ''}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Visitor Category</label>
                  <select
                    value={formData.category || 'Business Visitors'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="Business Visitors">Business Visitors</option>
                    <option value="Buyers and Procurement">Buyers and Procurement</option>
                    <option value="International Delegates">International Delegates</option>
                    <option value="Investors">Investors</option>
                    <option value="Government Representatives">Government Representatives</option>
                    <option value="General Public">General Public</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Organization / Employer</label>
                  <input
                    type="text"
                    value={formData.organization || ''}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country || 'Zimbabwe'}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">City / Province</label>
                  <input
                    type="text"
                    value={formData.cityProvince || 'Bulawayo'}
                    onChange={(e) => setFormData({ ...formData, cityProvince: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Feedback Rating (1–5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={formData.feedbackRating || 5}
                    onChange={(e) => setFormData({ ...formData, feedbackRating: Number(e.target.value) })}
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
                  Save Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
