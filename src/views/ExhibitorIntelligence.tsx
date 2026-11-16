import React, { useState, useMemo } from 'react';
import { useBI } from '../context/BIContext';
import { Exhibitor } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { FilterBar } from '../components/common/FilterBar';
import {
  Store,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  MapPin,
  Mail,
  Phone,
  Building2,
  Award,
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

export const ExhibitorIntelligence: React.FC = () => {
  const {
    filteredExhibitors,
    addExhibitor,
    updateExhibitor,
    deleteExhibitor,
    selectedEditionId,
    editions,
    executiveMetrics,
  } = useBI();

  const currentEditionObj = editions.find((e) => e.id === selectedEditionId);
  const editionTitle = currentEditionObj ? currentEditionObj.name : 'Historical';

  // State for search & modal
  const [localSearch, setLocalSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedExhibitorForView, setSelectedExhibitorForView] = useState<Exhibitor | null>(null);
  const [editingExhibitor, setEditingExhibitor] = useState<Exhibitor | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<Exhibitor>>({
    companyName: '',
    regNumber: '',
    businessDescription: '',
    industry: 'Mining & Quarrying',
    sector: 'Mining & Natural Resources',
    country: 'Zimbabwe',
    provinceCity: 'Bulawayo',
    contactPerson: '',
    email: '',
    phone: '',
    website: '',
    productsServices: ['Industrial Machinery'],
    editionId: selectedEditionId === 'all' ? 'zitf-2026' : selectedEditionId,
    hallStand: 'Hall 1 - Stand A01',
    standSizeSqm: 60,
    category: 'Local Commercial',
    bookingStatus: 'Confirmed',
    paymentStatus: 'Fully Paid',
    returningStatus: 'Returning',
    satisfactionScore: 4.8,
    participationHistory: [2025, 2026],
  });

  // Filter exhibitors by localSearch and category
  const displayedExhibitors = filteredExhibitors.filter((e) => {
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
    if (localSearch.trim()) {
      const q = localSearch.toLowerCase();
      return (
        e.companyName.toLowerCase().includes(q) ||
        e.regNumber.toLowerCase().includes(q) ||
        e.contactPerson.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q) ||
        e.sector.toLowerCase().includes(q) ||
        e.hallStand.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Live Analytics aggregations computed from SQLite records
  const countryDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    filteredExhibitors.forEach((e) => {
      const key = e.country?.trim() || 'Unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredExhibitors]);

  const categoryDistribution = useMemo(() => {
    const CATEGORY_COLORS: Record<string, string> = {
      'Local Commercial': '#0F2137',
      'SME / Emerging': '#059669',
      'International Pavilion': '#C69214',
      'State Owned Enterprise': '#2563EB',
      'Education & Research': '#7C3AED',
      'Tech & Innovation': '#0891B2',
    };
    const counts = new Map<string, number>();
    filteredExhibitors.forEach((e) => {
      const key = e.category || 'Local Commercial';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        count,
        color: CATEGORY_COLORS[name] || '#64748B',
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredExhibitors]);

  const paymentCounts = useMemo(() => {
    const paid = filteredExhibitors.filter((e) => e.paymentStatus === 'Fully Paid').length;
    const pending = filteredExhibitors.length - paid;
    return { paid, pending };
  }, [filteredExhibitors]);

  const totalBookedSqm = useMemo(
    () => filteredExhibitors.reduce((s, e) => s + (Number(e.standSizeSqm) || 0), 0),
    [filteredExhibitors]
  );

  const handleOpenAddModal = (exhibitorToEdit?: Exhibitor) => {
    if (exhibitorToEdit) {
      setEditingExhibitor(exhibitorToEdit);
      setFormData(exhibitorToEdit);
    } else {
      setEditingExhibitor(null);
      setFormData({
        companyName: '',
        regNumber: `ZW-${Math.floor(Math.random() * 9000 + 1000)}`,
        businessDescription: '',
        industry: 'Mining & Quarrying',
        sector: 'Mining & Natural Resources',
        country: 'Zimbabwe',
        provinceCity: 'Bulawayo',
        contactPerson: '',
        email: '',
        phone: '+263 ',
        website: 'https://',
        productsServices: ['Display & Equipment'],
        editionId: selectedEditionId === 'all' ? 'zitf-2026' : selectedEditionId,
        hallStand: 'Hall 2 - Stand B01',
        standSizeSqm: 40,
        category: 'Local Commercial',
        bookingStatus: 'Confirmed',
        paymentStatus: 'Fully Paid',
        returningStatus: 'New',
        satisfactionScore: 4.6,
        participationHistory: [2026],
      });
    }
    setIsAddModalOpen(true);
  };

  const handleSaveExhibitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName) return;

    if (editingExhibitor) {
      updateExhibitor(editingExhibitor.id, formData);
    } else {
      addExhibitor(formData as any);
    }
    setIsAddModalOpen(false);
    setEditingExhibitor(null);
  };

  const handleExportCsv = () => {
    const headers = [
      'Company Name',
      'Registration No.',
      'Sector',
      'Industry',
      'Country',
      'City',
      'Contact Person',
      'Email',
      'Phone',
      'Hall & Stand',
      'Stand Size (sqm)',
      'Category',
      'Returning Status',
      'Payment Status',
    ];

    const rows = displayedExhibitors.map((e) => [
      `"${e.companyName.replace(/"/g, '""')}"`,
      `"${e.regNumber}"`,
      `"${e.sector}"`,
      `"${e.industry}"`,
      `"${e.country}"`,
      `"${e.provinceCity}"`,
      `"${e.contactPerson}"`,
      `"${e.email}"`,
      `"${e.phone}"`,
      `"${e.hallStand}"`,
      e.standSizeSqm,
      `"${e.category}"`,
      `"${e.returningStatus}"`,
      `"${e.paymentStatus}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ZITF_Exhibitor_Directory_${selectedEditionId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Module One: Exhibitor Intelligence
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
              {editionTitle}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Analyze who exhibits, sector representation, stand capacity, and multi-year exhibitor retention trends.
          </p>
        </div>

        <button
          onClick={() => handleOpenAddModal()}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Add New Exhibitor</span>
        </button>
      </div>

      {/* Filter Bar */}
      <FilterBar
        onExportCsv={handleExportCsv}
        exportLabel="Export Exhibitors (CSV)"
        totalFilteredCount={displayedExhibitors.length}
        totalLabel="Registered Exhibitors"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
        <MetricCard
          title="Total Exhibitors"
          value={executiveMetrics.totalExhibitors}
          icon={Store}
          badge={`${executiveMetrics.internationalCountriesCount} Foreign States`}
          badgeVariant="emerald"
          breakdown={[
            { label: 'Local', value: executiveMetrics.localExhibitors },
            { label: "Int'l", value: executiveMetrics.internationalExhibitors },
          ]}
          insight={`${executiveMetrics.localExhibitors} domestic and ${executiveMetrics.internationalExhibitors} international organizations active in ${editionTitle}.`}
          subtitle="All Halls & Outdoor Arena"
        />

        <MetricCard
          title="Retention Rate"
          value={`${executiveMetrics.retentionRate}%`}
          icon={Award}
          badge="Brand Loyalty"
          badgeVariant="emerald"
          targetProgress={executiveMetrics.retentionRate}
          breakdown={[
            { label: 'Returning', value: executiveMetrics.returningExhibitorsCount },
            { label: 'First-Time', value: executiveMetrics.newExhibitorsCount },
          ]}
          insight={`${executiveMetrics.returningExhibitorsCount} returning brands out of ${executiveMetrics.totalExhibitors} exhibitors in context.`}
          subtitle="Returning Exhibiting Brands"
        />

        <MetricCard
          title="New Exhibitors"
          value={executiveMetrics.newExhibitorsCount}
          icon={Plus}
          badge="First-Time Entrants"
          badgeVariant="blue"
          breakdown={[
            { label: 'New Share', value: executiveMetrics.totalExhibitors > 0 ? `${(100 - executiveMetrics.retentionRate).toFixed(1)}%` : '0%' },
            { label: 'Paid', value: paymentCounts.paid },
          ]}
          insight={`${executiveMetrics.newExhibitorsCount} first-time exhibitors registered in ${editionTitle}.`}
          subtitle="First-Time Fair Entrants"
        />

        <MetricCard
          title="International %"
          value={`${executiveMetrics.internationalPct}%`}
          icon={Building2}
          badge="Global Footprint"
          badgeVariant="purple"
          targetProgress={executiveMetrics.internationalPct}
          breakdown={[
            { label: 'Foreign Orgs', value: executiveMetrics.internationalExhibitors },
            { label: 'Countries', value: executiveMetrics.internationalCountriesCount },
          ]}
          insight={`Foreign exhibitors account for ${executiveMetrics.internationalPct}% across ${executiveMetrics.internationalCountriesCount} countries.`}
          subtitle="Cross-Border Share"
        />

        <MetricCard
          title="Avg Stand Area"
          value={executiveMetrics.avgStandAreaSqm}
          unit="sqm"
          icon={Store}
          badge="Space Density"
          badgeVariant="slate"
          breakdown={[
            { label: 'Total Booked', value: `${totalBookedSqm.toLocaleString()} sqm` },
            { label: 'Stands', value: executiveMetrics.totalExhibitors },
          ]}
          insight={`Combined stand allocation totals ${totalBookedSqm.toLocaleString()} sqm across ${executiveMetrics.totalExhibitors} exhibitors.`}
          subtitle="Lettable Area Density"
        />

        <MetricCard
          title="Exhibitor Score"
          value={executiveMetrics.totalExhibitors > 0 ? `${executiveMetrics.exhibitorSatisfaction} / 5.0` : '0 / 5.0'}
          icon={CheckCircle2}
          badge={`N=${executiveMetrics.totalExhibitors} Rated`}
          badgeVariant="emerald"
          targetValue="5.0 Max"
          targetProgress={Math.round((executiveMetrics.exhibitorSatisfaction / 5) * 100)}
          breakdown={[
            { label: 'Paid Clear', value: paymentCounts.paid },
            { label: 'Pending/Part', value: paymentCounts.pending },
          ]}
          insight="Mean satisfaction score calculated directly across active exhibitor records."
          subtitle="Post-Fair Feedback Mean"
        />
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Country Distribution */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-slate-900">Exhibitor Origin by Country</h3>
            <p className="text-xs text-slate-500">Local Zimbabwean companies vs Foreign Trade Missions</p>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countryDistribution} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="country" type="category" width={110} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(val: any) => [`${val} Exhibitors`, 'Count']}
                  contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#C69214" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Category Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-slate-900">Participation by Exhibitor Category</h3>
            <p className="text-xs text-slate-500">Commercial corporations, SMEs, SOEs, and foreign pavilions</p>
          </div>
          <div className="h-60 flex flex-col sm:flex-row items-center justify-between">
            <div className="w-full sm:w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} Stands`, 'Count']}
                    contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 space-y-2 text-xs">
              {categoryDistribution.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="font-medium text-slate-700">{cat.name}</span>
                  </div>
                  <span className="font-bold text-slate-900 tabular-nums">{cat.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Exhibitor Database Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search by company, reg no, contact person, stand..."
                className="w-full bg-slate-50 pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
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
              <option value="Local Commercial">Local Commercial</option>
              <option value="International Pavilion">International Pavilion</option>
              <option value="State Owned Enterprise">State Owned Enterprise</option>
              <option value="SME / Emerging">SME / Emerging</option>
              <option value="Education & Research">Education & Research</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Company &amp; Reg No.</th>
                <th className="px-4 py-3">Sector &amp; Location</th>
                <th className="px-4 py-3">Stand &amp; Size</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status &amp; Retention</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayedExhibitors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No exhibitor records found matching criteria.
                  </td>
                </tr>
              ) : (
                displayedExhibitors.map((exh) => (
                  <tr key={exh.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{exh.companyName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{exh.regNumber}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{exh.sector}</div>
                      <div className="text-[11px] text-slate-400">
                        {exh.country} · {exh.provinceCity}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{exh.hallStand}</div>
                      <div className="text-[11px] text-slate-400">{exh.standSizeSqm} sqm</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded font-medium text-[11px] bg-slate-100 text-slate-800">
                        {exh.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            exh.paymentStatus === 'Fully Paid'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {exh.paymentStatus}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            exh.returningStatus === 'Returning'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {exh.returningStatus}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Rating: {exh.satisfactionScore} / 5.0
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedExhibitorForView(exh)}
                          title="View Profile & Participation History"
                          className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenAddModal(exh)}
                          title="Edit Exhibitor"
                          className="p-1 text-slate-500 hover:text-amber-700 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove exhibitor ${exh.companyName}?`)) {
                              deleteExhibitor(exh.id);
                            }
                          }}
                          title="Delete Record"
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exhibitor Profile Drawer / Modal */}
      {selectedExhibitorForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="text-base font-bold">{selectedExhibitorForView.companyName}</div>
                <div className="text-amber-400 text-xs font-mono">{selectedExhibitorForView.regNumber}</div>
              </div>
              <button
                onClick={() => setSelectedExhibitorForView(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <span className="font-bold text-slate-900 block mb-1">Business Description</span>
                <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                  {selectedExhibitorForView.businessDescription}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Sector &amp; Industry</span>
                  <span className="font-semibold text-slate-800">{selectedExhibitorForView.sector}</span>
                  <div className="text-slate-500 text-[11px]">{selectedExhibitorForView.industry}</div>
                </div>

                <div className="p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Stand Allocation</span>
                  <span className="font-semibold text-slate-800">{selectedExhibitorForView.hallStand}</span>
                  <div className="text-slate-500 text-[11px]">{selectedExhibitorForView.standSizeSqm} sqm</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="font-bold text-slate-900 block text-[11px] mb-1">Contact Information</span>
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedExhibitorForView.provinceCity}, {selectedExhibitorForView.country}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedExhibitorForView.email} ({selectedExhibitorForView.contactPerson})</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedExhibitorForView.phone}</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-900 block mb-1">Multi-Year Participation History</span>
                <div className="flex items-center gap-2">
                  {[2022, 2023, 2024, 2025, 2026].map((yr) => {
                    const participated = selectedExhibitorForView.participationHistory.includes(yr);
                    return (
                      <span
                        key={yr}
                        className={`px-2.5 py-1 rounded font-mono font-semibold text-xs border ${
                          participated
                            ? 'bg-amber-100 border-amber-300 text-amber-900'
                            : 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                        }`}
                      >
                        {yr}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedExhibitorForView(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-medium"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Exhibitor Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-sm font-bold">
                {editingExhibitor ? `Edit Exhibitor: ${editingExhibitor.companyName}` : 'Add New Exhibitor Record'}
              </span>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExhibitor} className="p-5 space-y-3 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.companyName || ''}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Company Reg / Ref No.</label>
                  <input
                    type="text"
                    value={formData.regNumber || ''}
                    onChange={(e) => setFormData({ ...formData, regNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Business Description</label>
                <textarea
                  rows={2}
                  value={formData.businessDescription || ''}
                  onChange={(e) => setFormData({ ...formData, businessDescription: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Industry Sector</label>
                  <select
                    value={formData.sector || 'Mining & Natural Resources'}
                    onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="Mining & Natural Resources">Mining &amp; Natural Resources</option>
                    <option value="Agriculture & Food Processing">Agriculture &amp; Food Processing</option>
                    <option value="Information & Digital Technologies">Information &amp; Digital Technologies</option>
                    <option value="Heavy Engineering & Logistics">Heavy Engineering &amp; Logistics</option>
                    <option value="Energy & Power Infrastructure">Energy &amp; Power Infrastructure</option>
                    <option value="Financial Services">Financial Services</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Trade & Investment Facilitation">Trade &amp; Investment Facilitation</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Exhibitor Category</label>
                  <select
                    value={formData.category || 'Local Commercial'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="Local Commercial">Local Commercial</option>
                    <option value="International Pavilion">International Pavilion</option>
                    <option value="State Owned Enterprise">State Owned Enterprise</option>
                    <option value="SME / Emerging">SME / Emerging</option>
                    <option value="Education & Research">Education &amp; Research</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
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
                    value={formData.provinceCity || 'Bulawayo'}
                    onChange={(e) => setFormData({ ...formData, provinceCity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Stand Size (sqm)</label>
                  <input
                    type="number"
                    value={formData.standSizeSqm || 60}
                    onChange={(e) => setFormData({ ...formData, standSizeSqm: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Hall &amp; Stand Number</label>
                  <input
                    type="text"
                    value={formData.hallStand || 'Hall 1 - Stand A10'}
                    onChange={(e) => setFormData({ ...formData, hallStand: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contactPerson || ''}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Payment Status</label>
                  <select
                    value={formData.paymentStatus || 'Fully Paid'}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="Fully Paid">Fully Paid</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Returning Status</label>
                  <select
                    value={formData.returningStatus || 'Returning'}
                    onChange={(e) => setFormData({ ...formData, returningStatus: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="Returning">Returning Exhibitor</option>
                    <option value="New">New Exhibitor</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold cursor-pointer"
                >
                  {editingExhibitor ? 'Save Updates' : 'Add Exhibitor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
