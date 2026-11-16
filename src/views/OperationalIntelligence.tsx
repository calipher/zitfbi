import React, { useState, useMemo } from 'react';
import { useBI } from '../context/BIContext';
import { OperationalIncident } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { FilterBar } from '../components/common/FilterBar';
import {
  Plus,
  Search,
  Wifi,
  AlertTriangle,
  CheckCircle2,
  Building,
  Zap,
  Shield,
  Layers,
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
} from 'recharts';

export const OperationalIntelligence: React.FC = () => {
  const {
    filteredIncidents,
    filteredExhibitors,
    selectedCountry,
    addIncident,
    updateIncident,
    hallUtilisation,
    selectedEditionId,
    editions,
    executiveMetrics,
  } = useBI();

  const currentEditionObj = editions.find((e) => e.id === selectedEditionId);
  const editionTitle = currentEditionObj ? currentEditionObj.name : 'Historical';

  const [localSearch, setLocalSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<OperationalIncident>>({
    title: '',
    hallOrArea: 'Hall 1',
    category: 'ICT & Network',
    severity: 'Medium',
    description: '',
    status: 'In Progress',
    editionId: selectedEditionId === 'all' ? 'zitf-2026' : selectedEditionId,
  });

  const displayedIncidents = filteredIncidents.filter((inc) => {
    if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
    if (localSearch.trim()) {
      const q = localSearch.toLowerCase();
      return (
        inc.title.toLowerCase().includes(q) ||
        inc.hallOrArea.toLowerCase().includes(q) ||
        inc.category.toLowerCase().includes(q) ||
        inc.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const scopedHalls = useMemo(() => {
    if (selectedCountry === 'all' || selectedCountry.trim().toLowerCase() === 'zimbabwe') {
      return hallUtilisation;
    }
    const delegationHalls = new Set<string>();
    filteredExhibitors.forEach((e) => {
      const prefix = (e.hallStand || '').split('-')[0]?.trim().toLowerCase();
      if (prefix) delegationHalls.add(prefix);
    });
    if (delegationHalls.size === 0) return [];
    return hallUtilisation.filter(
      (h) =>
        delegationHalls.has(h.hallName.trim().toLowerCase()) ||
        Array.from(delegationHalls).some((prefix) => h.hallName.trim().toLowerCase().includes(prefix))
    );
  }, [hallUtilisation, selectedCountry, filteredExhibitors]);

  const hallOccupancyData = scopedHalls.map((h) => ({
    name: h.hallId.toUpperCase(),
    fullName: h.hallName,
    utilization: h.utilizationRatePct,
    capacity: h.totalCapacitySqm,
    occupied: h.occupiedSqm,
  }));

  const opsSummary = useMemo(() => {
    const activeHallsCount = scopedHalls.length;
    const totalStands = scopedHalls.reduce((s, h) => s + (Number(h.activeExhibitorsCount) || 0), 0);
    const indoorHalls = scopedHalls.filter((h) => !h.hallName.toLowerCase().includes('outdoor'));
    const outdoorHalls = scopedHalls.filter((h) => h.hallName.toLowerCase().includes('outdoor'));
    const indoorOccupiedSqm = indoorHalls.reduce((s, h) => s + (Number(h.occupiedSqm) || 0), 0);
    const outdoorOccupiedSqm = outdoorHalls.reduce((s, h) => s + (Number(h.occupiedSqm) || 0), 0);
    const totalCapSqm = scopedHalls.reduce((s, h) => s + (Number(h.totalCapacitySqm) || 0), 0);
    const totalOccSqm = scopedHalls.reduce((s, h) => s + (Number(h.occupiedSqm) || 0), 0);
    const scopedOccupancyPct = totalCapSqm > 0 ? Number(((totalOccSqm / totalCapSqm) * 100).toFixed(1)) : 0;
    const criticalOrHighOpen = filteredIncidents.filter(
      (i) => i.status !== 'Resolved' && (i.severity === 'Critical' || i.severity === 'High')
    ).length;
    const avgWifiPct =
      activeHallsCount > 0
        ? Number((scopedHalls.reduce((s, h) => s + (Number(h.wifiUptimePct) || 0), 0) / activeHallsCount).toFixed(1))
        : 0;
    const soldOutCount = scopedHalls.filter((h) => h.utilizationRatePct >= 95).length;
    const totalReportedIncidents = filteredIncidents.length;
    const resolutionRatePct =
      totalReportedIncidents > 0
        ? Math.round((executiveMetrics.resolvedIncidentsCount / totalReportedIncidents) * 100)
        : 100;

    return {
      activeHallsCount,
      totalStands,
      indoorOccupiedSqm,
      outdoorOccupiedSqm,
      totalCapSqm,
      totalOccSqm,
      scopedOccupancyPct,
      criticalOrHighOpen,
      avgWifiPct,
      soldOutCount,
      totalReportedIncidents,
      resolutionRatePct,
    };
  }, [scopedHalls, filteredIncidents, executiveMetrics.resolvedIncidentsCount]);

  const handleSaveIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    addIncident({
      ...formData,
      refNumber: `OPS-${Date.now().toString().slice(-4)}`,
      reportedTime: new Date().toISOString().replace('T', ' ').substring(0, 16),
    } as any);

    setIsAddModalOpen(false);
  };

  const handleResolveIncident = (id: string) => {
    updateIncident(id, {
      status: 'Resolved',
      resolvedTime: new Date().toISOString().replace('T', ' ').substring(0, 16),
      resolutionNotes: 'Inspected and verified nominal by Duty Operations Officer.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Module Five: Operational Intelligence
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
              {editionTitle}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Monitor venue capacity, hall space utilization, ICT infrastructure availability, and facilities response registers.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Log Operational Incident</span>
        </button>
      </div>

      <FilterBar
        totalFilteredCount={displayedIncidents.length}
        totalLabel="Incidents In Context"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
        <MetricCard
          title="Space Occupancy"
          value={`${opsSummary.scopedOccupancyPct}%`}
          icon={Building}
          badge={`${opsSummary.soldOutCount} Halls >=95%`}
          badgeVariant="amber"
          targetValue={`${opsSummary.totalCapSqm.toLocaleString()} sqm`}
          targetProgress={Math.min(100, Math.round(opsSummary.scopedOccupancyPct))}
          breakdown={[
            { label: 'Indoor Halls', value: `${opsSummary.indoorOccupiedSqm.toLocaleString()} sqm` },
            { label: 'Outdoor Zones', value: `${opsSummary.outdoorOccupiedSqm.toLocaleString()} sqm` },
          ]}
          insight={
            opsSummary.totalCapSqm > 0
              ? `${opsSummary.totalOccSqm.toLocaleString()} sqm occupied out of ${opsSummary.totalCapSqm.toLocaleString()} sqm lettable capacity across ${opsSummary.activeHallsCount} scoped exhibition zone(s).`
              : 'No hall capacity records match the current country filter.'
          }
          subtitle={`${opsSummary.totalCapSqm.toLocaleString()} sqm Capacity`}
          deepDive={{
            headline: 'Exhibition Hall Floor Utilization',
            drivers: [
              `Computed strictly as sum(occupiedSqm) / sum(totalCapacitySqm) across ${opsSummary.activeHallsCount} halls`,
              `${opsSummary.soldOutCount} zone(s) operating at or above 95% utilization`,
            ],
            recommendation: 'Reallocate overflow bookings to underutilized outdoor or mezzanine bays.',
          }}
        />

        <MetricCard
          title="Network Uptime"
          value={`${opsSummary.avgWifiPct}%`}
          icon={Wifi}
          badge={opsSummary.avgWifiPct >= 99 ? 'SLA Nominal' : 'Degraded'}
          badgeVariant={opsSummary.avgWifiPct >= 99 ? 'emerald' : 'amber'}
          targetValue="99.9% SLA"
          targetProgress={Math.min(100, opsSummary.avgWifiPct)}
          breakdown={[
            { label: 'Zones Tracked', value: String(opsSummary.activeHallsCount) },
            { label: 'Mean Uptime', value: `${opsSummary.avgWifiPct}%` },
          ]}
          insight={
            opsSummary.activeHallsCount > 0
              ? `Mean Wi-Fi & infrastructure uptime across ${opsSummary.activeHallsCount} monitored hall(s) is ${opsSummary.avgWifiPct}%.`
              : 'No network telemetry zones match the current filter.'
          }
          subtitle="Monitored Hall Zones"
          deepDive={{
            headline: 'Hall ICT Telemetry Aggregation',
            drivers: [
              'Derived directly from wifiUptimePct across hall_utilisation records in SQLite',
              'Monitors core ticketing, exhibitor stand POS, and matchmaking centers',
            ],
            recommendation: 'Inspect any hall logging ICT & Network incidents with uptime below 99.0%.',
          }}
        />

        <MetricCard
          title="Monitored Halls"
          value={opsSummary.activeHallsCount}
          icon={Layers}
          badge={`${opsSummary.soldOutCount} High-Load`}
          badgeVariant="blue"
          breakdown={[
            { label: 'Total Occupied', value: `${opsSummary.totalOccSqm.toLocaleString()} sqm` },
            { label: 'Total Capacity', value: `${opsSummary.totalCapSqm.toLocaleString()} sqm` },
          ]}
          insight={`${opsSummary.activeHallsCount} exhibition hall(s) and outdoor zone(s) active in current filter context.`}
          subtitle={selectedCountry !== 'all' ? `${selectedCountry} Zones` : 'Exhibition Zones'}
          deepDive={{
            headline: 'Active Exhibition Venue Footprint',
            drivers: [
              'Tracks indoor halls, international pavilions, and outdoor machinery grounds',
              `Aggregate floor capacity equals ${opsSummary.totalCapSqm.toLocaleString()} sqm`,
            ],
            recommendation: 'Audit perimeter booth grids ahead of peak setup week.',
          }}
        />

        <MetricCard
          title="Active Stands"
          value={opsSummary.totalStands.toLocaleString()}
          icon={Building}
          badge="Floor Allocation"
          badgeVariant="blue"
          breakdown={[
            { label: 'Halls Covered', value: String(opsSummary.activeHallsCount) },
            { label: 'Avg Occupancy', value: `${executiveMetrics.spaceOccupancyPct}%` },
          ]}
          insight={
            opsSummary.totalStands > 0
              ? `${opsSummary.totalStands.toLocaleString()} active exhibitor stands tracked across all ${opsSummary.activeHallsCount} monitored halls.`
              : 'No active stand counts recorded in hall utilisation.'
          }
          subtitle="Across All Halls"
          deepDive={{
            headline: 'Stand Density Across Fairgrounds',
            drivers: [
              'Sum of activeExhibitorsCount across all hall_utilisation SQLite records',
              'Synchronized alongside the Exhibitor Intelligence directory',
            ],
            recommendation: 'Balance pedestrian flow corridors near high-stand-count pavilions.',
          }}
        />

        <MetricCard
          title="Resolved Issues"
          value={executiveMetrics.resolvedIncidentsCount}
          icon={CheckCircle2}
          badge={`${opsSummary.resolutionRatePct}% Closed`}
          badgeVariant="emerald"
          targetValue="100% Closed"
          targetProgress={opsSummary.resolutionRatePct}
          breakdown={[
            { label: 'Resolved', value: String(executiveMetrics.resolvedIncidentsCount) },
            { label: 'Total Logged', value: String(opsSummary.totalReportedIncidents) },
          ]}
          insight={
            opsSummary.totalReportedIncidents > 0
              ? `${executiveMetrics.resolvedIncidentsCount} of ${opsSummary.totalReportedIncidents} logged incidents (${opsSummary.resolutionRatePct}%) have been resolved and closed.`
              : 'Zero operational incidents logged for the selected edition.'
          }
          subtitle="Facilities Closure"
          deepDive={{
            headline: 'Facilities & Maintenance Closure Rate',
            drivers: [
              'Calculated directly from operational_incidents records marked Resolved',
              'Tracks HVAC, electrical, ICT, logistics, and safety dispatch completion',
            ],
            recommendation: 'Maintain documented resolution notes on all resolved operational logs.',
          }}
        />

        <MetricCard
          title="Active Incidents"
          value={executiveMetrics.openIncidentsCount}
          icon={AlertTriangle}
          badge={opsSummary.criticalOrHighOpen === 0 ? 'Zero Critical/High' : `${opsSummary.criticalOrHighOpen} High/Crit`}
          badgeVariant={executiveMetrics.openIncidentsCount === 0 ? 'emerald' : 'amber'}
          breakdown={[
            { label: 'High / Critical', value: String(opsSummary.criticalOrHighOpen) },
            { label: 'Open / In Prog', value: String(executiveMetrics.openIncidentsCount) },
          ]}
          insight={
            executiveMetrics.openIncidentsCount > 0
              ? `${executiveMetrics.openIncidentsCount} incident(s) currently Open or In Progress (${opsSummary.criticalOrHighOpen} High/Critical priority).`
              : 'All logged operational incidents are currently resolved.'
          }
          subtitle={`${opsSummary.criticalOrHighOpen} Urgent Priority`}
          deepDive={{
            headline: 'Open Operational Incident Queue',
            drivers: [
              'Filters operational_incidents where status != Resolved',
              'Real-time triage updates immediately upon clicking Mark Resolved',
            ],
            recommendation: 'Resolve open High or Critical tickets before daily fair opening.',
          }}
        />
      </div>

      {/* Hall Utilization Cards & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-slate-900">Exhibition Hall Space Utilization Rate (%)</h3>
            <p className="text-xs text-slate-500">Gross indoor lettable exhibition area vs occupied stands</p>
          </div>
          <div className="h-64">
            {hallOccupancyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                No hall utilization records available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hallOccupancyData} margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                  <Tooltip
                    formatter={(val: any, _name: any, item: any) => [
                      `${val}% Occupied (${item.payload.occupied.toLocaleString()} / ${item.payload.capacity.toLocaleString()} sqm)`,
                      item.payload.fullName,
                    ]}
                    contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="utilization" fill="#0F2137" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Quick Venue Status */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <h3 className="font-bold text-sm text-slate-900 mb-1">Venue Infrastructure Telemetry</h3>
          <p className="text-xs text-slate-500 mb-4">Live metrics computed from warehouse halls &amp; incident register</p>

          <div className="space-y-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-600" />
                <div>
                  <div className="font-semibold text-slate-900">Hall Wi-Fi Mesh Average</div>
                  <div className="text-[11px] text-slate-500">{opsSummary.activeHallsCount} monitored venue zones</div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                {opsSummary.avgWifiPct}% Uptime
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <div>
                  <div className="font-semibold text-slate-900">Floor Space Allocation</div>
                  <div className="text-[11px] text-slate-500">
                    {opsSummary.totalOccSqm.toLocaleString()} / {opsSummary.totalCapSqm.toLocaleString()} sqm
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                {opsSummary.scopedOccupancyPct}% Occupied
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <div>
                  <div className="font-semibold text-slate-900">Incident Resolution SLA</div>
                  <div className="text-[11px] text-slate-500">
                    {executiveMetrics.resolvedIncidentsCount} resolved · {executiveMetrics.openIncidentsCount} open
                  </div>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  opsSummary.criticalOrHighOpen > 0
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {opsSummary.resolutionRatePct}% Cleared
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hall Utilization Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scopedHalls.map((hall) => (
          <div key={hall.hallId} className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 line-clamp-1">{hall.hallName}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-800 shrink-0">
                {hall.activeExhibitorsCount} Stands
              </span>
            </div>

            <div className="flex items-baseline justify-between mt-3 text-xs">
              <span className="text-slate-500">Utilization Rate</span>
              <span className="text-base font-bold text-slate-900 tabular-nums">{hall.utilizationRatePct}%</span>
            </div>

            <div className="mt-1.5 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  backgroundColor: hall.utilizationRatePct > 95 ? '#C69214' : '#0F2137',
                  width: `${hall.utilizationRatePct}%`,
                }}
              />
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>{hall.occupiedSqm.toLocaleString()} sqm utilized</span>
              <span>Total {hall.totalCapacitySqm.toLocaleString()} sqm</span>
            </div>
          </div>
        ))}
      </div>

      {/* Operational Incident Register Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Operational Incident &amp; Facilities Register</h3>
            <p className="text-xs text-slate-500">Audited logs for HVAC, power, ICT networks, logistics, and facilities</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search incidents..."
                className="bg-slate-50 pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <select
              aria-label="Severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Incident Ref &amp; Time</th>
                <th className="px-4 py-3">Location &amp; Area</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Title &amp; Observation</th>
                <th className="px-4 py-3">Severity &amp; Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayedIncidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono">
                    <div className="font-semibold text-slate-900">{inc.refNumber}</div>
                    <div className="text-[11px] text-slate-400">{inc.reportedTime}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{inc.hallOrArea}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {inc.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-sm">
                    <div className="font-semibold text-slate-900">{inc.title}</div>
                    <p className="text-[11px] text-slate-500 line-clamp-1">{inc.description}</p>
                    {inc.resolutionNotes && (
                      <p className="text-[10px] text-emerald-700 mt-0.5 font-medium">
                        Res: {inc.resolutionNotes}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          inc.severity === 'Critical'
                            ? 'bg-rose-100 text-rose-800'
                            : inc.severity === 'High'
                            ? 'bg-orange-100 text-orange-800'
                            : inc.severity === 'Medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {inc.severity}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          inc.status === 'Resolved'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {inc.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {inc.status !== 'Resolved' && (
                      <button
                        onClick={() => handleResolveIncident(inc.id)}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-[11px] cursor-pointer"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Incident Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-sm font-bold">Log Operational Incident / Maintenance</span>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveIncident} className="p-5 space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Incident Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Hall 2 North Air Handling Fan Noise"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Venue Hall / Area</label>
                  <input
                    type="text"
                    value={formData.hallOrArea || 'Hall 1'}
                    onChange={(e) => setFormData({ ...formData, hallOrArea: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Incident Category</label>
                  <select
                    value={formData.category || 'ICT & Network'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="ICT & Network">ICT &amp; Network</option>
                    <option value="Electrical & Power">Electrical &amp; Power</option>
                    <option value="Facilities & HVAC">Facilities &amp; HVAC</option>
                    <option value="Logistics & Transport">Logistics &amp; Transport</option>
                    <option value="Security & Safety">Security &amp; Safety</option>
                    <option value="Customer Care">Customer Care</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Severity Level</label>
                  <select
                    value={formData.severity || 'Medium'}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="Low">Low (Informational)</option>
                    <option value="Medium">Medium (Attention required)</option>
                    <option value="High">High (Urgent action)</option>
                    <option value="Critical">Critical (Immediate shutdown)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Initial Status</label>
                  <select
                    value={formData.status || 'In Progress'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description &amp; Action Plan</label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detail observations, affected stands, corrective steps..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
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
                  Log Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
