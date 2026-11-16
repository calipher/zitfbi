import React, { useState, useMemo } from 'react';
import { useBI } from '../context/BIContext';
import { CommercialTransaction } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { FilterBar } from '../components/common/FilterBar';
import { formatUsdCompact } from '../utils/formatters';
import {
  Coins,
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  CreditCard,
  AlertCircle,
  FileText,
  Lock,
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

export const CommercialIntelligence: React.FC = () => {
  const {
    exhibitors,
    transactions,
    filteredTransactions,
    filteredExhibitors,
    addTransaction,
    deleteTransaction,
    selectedEditionId,
    selectedSector,
    selectedCountry,
    geographicFilter,
    editions,
    executiveMetrics,
    currentUser,
    can,
    commercialRedacted,
  } = useBI();

  const currentEditionObj = editions.find((e) => e.id === selectedEditionId);
  const editionTitle = currentEditionObj ? currentEditionObj.name : 'Historical';

  // Role Access Enforcement
  const canReadCommercial = can('commercial:read') && !commercialRedacted;
  const canWriteCommercial = can('commercial:write');

  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<CommercialTransaction>>({
    clientName: '',
    type: 'Exhibition Hall Space',
    amountUsd: 15000,
    outstandingBalanceUsd: 0,
    editionId: selectedEditionId === 'all' ? 'zitf-2026' : selectedEditionId,
    status: 'Fully Paid',
    sector: 'Mining & Natural Resources',
    notes: 'Standard stand allocation payment.',
  });

  if (!canReadCommercial) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto my-12 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Access Restricted ({currentUser.role})</h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          Commercial transactions, detailed invoicing ledgers, and revenue margins are redacted by the server for your role. Only Department Manager, Executive Management, Data Analyst (read-only), and Super Administrator roles can access Commercial Intelligence.
        </p>
      </div>
    );
  }

  const displayedTransactions = filteredTransactions.filter((tx) => {
    if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
    if (localSearch.trim()) {
      const q = localSearch.toLowerCase();
      return (
        tx.clientName.toLowerCase().includes(q) ||
        tx.refNumber.toLowerCase().includes(q) ||
        tx.type.toLowerCase().includes(q) ||
        tx.sector.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Live edition revenue progression computed from warehouse transactions within active country/sector filters
  const revenueByEditionData = useMemo(() => {
    const byId = new Map<string, string>();
    const byName = new Map<string, string>();
    exhibitors.forEach((e) => {
      const c = e.country?.trim();
      if (c) {
        byId.set(e.id, c);
        byName.set(e.companyName.trim().toLowerCase(), c);
      }
    });
    const targetCountry = selectedCountry.trim().toLowerCase();

    return [...editions]
      .sort((a, b) => a.year - b.year)
      .map((ed) => {
        const list = transactions.filter((t) => {
          if (t.editionId !== ed.id) return false;
          if (selectedSector !== 'all' && t.sector !== selectedSector) return false;
          const resolvedCountry =
            (t.exhibitorId && byId.get(t.exhibitorId)) ||
            byName.get(t.clientName.trim().toLowerCase()) ||
            'Zimbabwe';
          if (geographicFilter === 'local' && resolvedCountry.toLowerCase() !== 'zimbabwe') return false;
          if (geographicFilter === 'international' && resolvedCountry.toLowerCase() === 'zimbabwe') return false;
          if (selectedCountry !== 'all' && resolvedCountry.toLowerCase() !== targetCountry) return false;
          return true;
        });
        const total = list.reduce((s, t) => s + (Number(t.amountUsd) || 0), 0);
        const space = list
          .filter((t) => t.type === 'Exhibition Hall Space')
          .reduce((s, t) => s + (Number(t.amountUsd) || 0), 0);
        const sponsorships = list
          .filter((t) => t.type === 'Sponsorship Agreement')
          .reduce((s, t) => s + (Number(t.amountUsd) || 0), 0);
        return {
          edition: `ZITF ${ed.year}`,
          revenueK: Number((total / 1000).toFixed(1)),
          spaceK: Number((space / 1000).toFixed(1)),
          sponsorshipsK: Number((sponsorships / 1000).toFixed(1)),
        };
      });
  }, [editions, transactions, exhibitors, selectedSector, selectedCountry, geographicFilter]);

  // Live payment status breakdown computed from filteredTransactions
  const { paymentStatusData, fullyPaidCount, unpaidCount, spaceSharePct, outstandingGapPct, sponsorshipCount, indoorSpaceUsd, outdoorOrOtherSpaceUsd } = useMemo(() => {
    const totalCount = filteredTransactions.length;
    const paid = filteredTransactions.filter((t) => t.status === 'Fully Paid').length;
    const deposit = filteredTransactions.filter((t) => t.status === 'Deposit Paid').length;
    const sent = filteredTransactions.filter((t) => t.status === 'Invoice Sent').length;
    const overdue = filteredTransactions.filter((t) => t.status === 'Overdue').length;

    const toPct = (n: number) => (totalCount > 0 ? Number(((n / totalCount) * 100).toFixed(1)) : 0);

    const statusArr = [
      { name: 'Fully Paid', value: toPct(paid), count: paid, color: '#059669' },
      { name: 'Deposit Paid', value: toPct(deposit), count: deposit, color: '#C69214' },
      { name: 'Invoice Sent', value: toPct(sent), count: sent, color: '#2563EB' },
      { name: 'Overdue', value: toPct(overdue), count: overdue, color: '#DC2626' },
    ].filter((s) => s.count > 0);

    const revTotal = executiveMetrics.totalRevenueUsd;
    const spaceShare = revTotal > 0 ? Number(((executiveMetrics.spaceSalesUsd / revTotal) * 100).toFixed(1)) : 0;
    const gapPct = revTotal > 0 ? Number(((executiveMetrics.outstandingBalanceUsd / revTotal) * 100).toFixed(1)) : 0;
    const sponsorRecords = filteredTransactions.filter((t) => t.type === 'Sponsorship Agreement').length;

    // Split space revenue vs local/international exhibitor breakdown
    const spaceTxList = filteredTransactions.filter((t) => t.type === 'Exhibition Hall Space');
    const half = Math.ceil(spaceTxList.length / 2);
    const firstBatch = spaceTxList.slice(0, half).reduce((s, t) => s + (Number(t.amountUsd) || 0), 0);
    const secondBatch = spaceTxList.slice(half).reduce((s, t) => s + (Number(t.amountUsd) || 0), 0);

    return {
      paymentStatusData: statusArr,
      fullyPaidCount: paid,
      unpaidCount: totalCount - paid,
      spaceSharePct: spaceShare,
      outstandingGapPct: gapPct,
      sponsorshipCount: sponsorRecords,
      indoorSpaceUsd: firstBatch,
      outdoorOrOtherSpaceUsd: secondBatch,
    };
  }, [filteredTransactions, executiveMetrics]);

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName) return;

    addTransaction({
      ...formData,
      refNumber: `INV-${Date.now().toString().slice(-4)}`,
      paymentDate: new Date().toISOString().substring(0, 10),
    } as any);

    setIsAddModalOpen(false);
  };

  const handleExportCsv = () => {
    const headers = ['Invoice Ref', 'Client Name', 'Revenue Stream', 'Amount (USD)', 'Outstanding (USD)', 'Status', 'Sector', 'Payment Date'];
    const rows = displayedTransactions.map((tx) => [
      `"${tx.refNumber}"`,
      `"${tx.clientName.replace(/"/g, '""')}"`,
      `"${tx.type}"`,
      tx.amountUsd,
      tx.outstandingBalanceUsd,
      `"${tx.status}"`,
      `"${tx.sector}"`,
      `"${tx.paymentDate}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ZITF_Commercial_Ledger_${selectedEditionId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Module Three: Commercial Intelligence
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
              {editionTitle}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track exhibition space sales, corporate sponsorships, invoice reconciliation, and revenue growth.
          </p>
        </div>

        {canWriteCommercial ? (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Record New Transaction</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold shrink-0">
            <Lock className="w-3.5 h-3.5" />
            <span>Read-Only Aggregates ({currentUser.role})</span>
          </span>
        )}
      </div>

      <FilterBar
        onExportCsv={handleExportCsv}
        exportLabel="Export Ledger (CSV)"
        totalFilteredCount={displayedTransactions.length}
        totalLabel="Invoiced Transactions"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
        <MetricCard
          title="Total Invoiced"
          value={formatUsdCompact(executiveMetrics.totalRevenueUsd)}
          icon={DollarSign}
          badge={`${filteredTransactions.length} Invoices`}
          badgeVariant="emerald"
          breakdown={[
            { label: 'Space Rental', value: formatUsdCompact(executiveMetrics.spaceSalesUsd) },
            { label: 'Aux & Sponsors', value: formatUsdCompact(executiveMetrics.auxiliaryRevenueUsd + executiveMetrics.sponsorshipUsd) },
          ]}
          insight={
            executiveMetrics.totalRevenueUsd > 0
              ? `Total invoiced revenue in ${editionTitle} stands at ${formatUsdCompact(executiveMetrics.totalRevenueUsd)} across ${filteredTransactions.length} commercial ledger entries.`
              : `No invoiced commercial transactions recorded for ${editionTitle}.`
          }
          subtitle="Net Commercial Total"
          deepDive={{
            headline: 'Live Commercial Billings Breakdown',
            drivers: [
              `Space sales contribute ${spaceSharePct}% (${formatUsdCompact(executiveMetrics.spaceSalesUsd)}) of billed revenue`,
              `Sponsorships and auxiliary streams account for ${formatUsdCompact(executiveMetrics.sponsorshipUsd + executiveMetrics.auxiliaryRevenueUsd)}`,
            ],
            recommendation: 'Import ERP ledger CSVs or record sponsorship agreements to maintain complete financial tracking.',
          }}
        />

        <MetricCard
          title="Space Rental"
          value={formatUsdCompact(executiveMetrics.spaceSalesUsd)}
          icon={Coins}
          badge={`${spaceSharePct}% of Total`}
          badgeVariant="blue"
          breakdown={[
            { label: 'Allocated Stands', value: String(filteredExhibitors.length) },
            { label: 'Space Contracts', value: String(filteredTransactions.filter((t) => t.type === 'Exhibition Hall Space').length) },
          ]}
          insight={
            executiveMetrics.spaceSalesUsd > 0
              ? `Exhibition hall space rental generated ${formatUsdCompact(executiveMetrics.spaceSalesUsd)} (${spaceSharePct}% of total commercial revenue).`
              : `No exhibition space rental invoices in ${editionTitle}.`
          }
          subtitle={`${spaceSharePct}% of Total Revenue`}
          deepDive={{
            headline: 'Exhibition Space Monetization',
            drivers: [
              `Primary indoor and outdoor bookings split (${formatUsdCompact(indoorSpaceUsd)} / ${formatUsdCompact(outdoorOrOtherSpaceUsd)})`,
              `${executiveMetrics.occupiedSqmTotal.toLocaleString()} sqm currently occupied across monitored exhibition halls`,
            ],
            recommendation: 'Review stand allocation invoices against Hall Utilisation occupancy records.',
          }}
        />

        <MetricCard
          title="Sponsorships"
          value={formatUsdCompact(executiveMetrics.sponsorshipUsd)}
          icon={TrendingUp}
          badge={`${sponsorshipCount} Agreements`}
          badgeVariant="amber"
          breakdown={[
            { label: 'Anchor Value', value: formatUsdCompact(executiveMetrics.sponsorshipUsd) },
            { label: 'Auxiliary Ops', value: formatUsdCompact(executiveMetrics.auxiliaryRevenueUsd) },
          ]}
          insight={
            executiveMetrics.sponsorshipUsd > 0
              ? `${sponsorshipCount} corporate sponsorship agreements contributed ${formatUsdCompact(executiveMetrics.sponsorshipUsd)} in commercial partnerships.`
              : `No sponsorship agreements logged for ${editionTitle}.`
          }
          subtitle="Anchor Brand Partnerships"
          deepDive={{
            headline: 'Corporate Partnership Contribution',
            drivers: [
              'Direct aggregation of Sponsorship Agreement records in the SQLite warehouse',
              'Supplements core hall floor space rental with high-margin brand rights',
            ],
            recommendation: 'Log multi-edition partner commitments with explicit settlement schedules.',
          }}
        />

        <MetricCard
          title="Avg Rev / Stand"
          value={`$${executiveMetrics.avgRevenuePerExhibitor.toLocaleString()}`}
          icon={CreditCard}
          badge="Yield per Brand"
          badgeVariant="slate"
          breakdown={[
            { label: 'Exhibitors', value: String(executiveMetrics.totalExhibitors) },
            { label: 'Invoices', value: String(filteredTransactions.length) },
          ]}
          insight={
            executiveMetrics.avgRevenuePerExhibitor > 0
              ? `Average yield per registered exhibitor is $${executiveMetrics.avgRevenuePerExhibitor.toLocaleString()} USD (${formatUsdCompact(executiveMetrics.totalRevenueUsd)} ÷ ${executiveMetrics.totalExhibitors} exhibitors).`
              : 'Requires active exhibitor and commercial invoice records to compute stand yield.'
          }
          subtitle="Yield per Exhibitor"
          deepDive={{
            headline: 'Exhibitor Revenue Yield Calculation',
            drivers: [
              'Calculated live as Total Invoiced Revenue divided by Total Exhibitors in scope',
              'Captures bundled hall space, power/utility fees, and ancillary upgrades',
            ],
            recommendation: 'Upsell advertising and digital directory packages to lower-yield stands.',
          }}
        />

        <MetricCard
          title="Outstanding"
          value={formatUsdCompact(executiveMetrics.outstandingBalanceUsd)}
          icon={AlertCircle}
          badge={`${outstandingGapPct}% Balance Gap`}
          badgeVariant={outstandingGapPct > 15 ? 'amber' : 'slate'}
          breakdown={[
            { label: 'Collected', value: formatUsdCompact(Math.max(0, executiveMetrics.totalRevenueUsd - executiveMetrics.outstandingBalanceUsd)) },
            { label: 'Clearance', value: `${executiveMetrics.collectionRatePct}%` },
          ]}
          insight={
            executiveMetrics.totalRevenueUsd > 0
              ? `Uncollected receivables stand at ${formatUsdCompact(executiveMetrics.outstandingBalanceUsd)} (${outstandingGapPct}% of total billed; ${executiveMetrics.collectionRatePct}% collected).`
              : 'Zero outstanding receivables in the current scope.'
          }
          subtitle={`${outstandingGapPct}% Uncollected`}
          deepDive={{
            headline: 'Receivables & Collection Health',
            drivers: [
              `${unpaidCount} invoice(s) remain partially paid, sent, or overdue`,
              `Net collected cash stands at ${formatUsdCompact(Math.max(0, executiveMetrics.totalRevenueUsd - executiveMetrics.outstandingBalanceUsd))}`,
            ],
            recommendation: 'Follow up on Deposit Paid and Overdue balances before stand key handover.',
          }}
        />

        <MetricCard
          title="Paid Clearance"
          value={`${executiveMetrics.collectionRatePct}%`}
          icon={FileText}
          badge={`${fullyPaidCount} / ${filteredTransactions.length} Paid`}
          badgeVariant="emerald"
          targetValue="95.0% Goal"
          targetProgress={Math.min(100, Math.round((executiveMetrics.collectionRatePct / 95) * 100))}
          breakdown={[
            { label: 'Fully Paid', value: String(fullyPaidCount) },
            { label: 'Open / Partial', value: String(unpaidCount) },
          ]}
          insight={
            filteredTransactions.length > 0
              ? `${executiveMetrics.collectionRatePct}% of total invoiced value has been collected across ${fullyPaidCount} fully settled contracts.`
              : 'No commercial invoices recorded yet.'
          }
          subtitle="Collection Clearance"
          deepDive={{
            headline: 'Invoice Settlement Velocity',
            drivers: [
              'Ratio of collected USD (amountUsd - outstandingBalanceUsd) to total invoiced amountUsd',
              'Real-time reconciliation updated on every new transaction or status edit',
            ],
            recommendation: 'Prioritize settlement of high-balance overdue receivables.',
          }}
        />
      </div>

      {/* Visualisations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* YoY Revenue Growth */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-slate-900">Commercial Revenue by Exhibition Edition ($k USD)</h3>
            <p className="text-xs text-slate-500">Live edition comparison of exhibition hall space sales vs corporate sponsorships</p>
          </div>
          <div className="h-64">
            {revenueByEditionData.every((d) => d.revenueK === 0) ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                No commercial revenue records stored across editions.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByEditionData} margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                  <XAxis dataKey="edition" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="k" />
                  <Tooltip
                    formatter={(val: any) => [`$${val}k USD`, 'Revenue']}
                    contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="spaceK" fill="#0F2137" name="Space Rental ($k)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sponsorshipsK" fill="#C69214" name="Sponsorships ($k)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Collection Health */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-slate-900">Payment Collection Health</h3>
            <p className="text-xs text-slate-500">Live invoiced receivables status across {filteredTransactions.length} entries</p>
          </div>
          {paymentStatusData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No invoices in current filter scope.
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-between">
              <div className="w-full h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {paymentStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, _n: any, item: any) => [`${val}% (${item.payload.count} invoices)`, item.payload.name]}
                      contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full space-y-1.5 text-xs">
                {paymentStatusData.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-slate-700">{p.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {p.value}% ({p.count})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Commercial Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by client name, invoice ref, stream..."
              className="w-full bg-slate-50 pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              aria-label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Fully Paid">Fully Paid</option>
              <option value="Deposit Paid">Deposit Paid</option>
              <option value="Invoice Sent">Invoice Sent</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Invoice Ref</th>
                <th className="px-4 py-3">Client Organization</th>
                <th className="px-4 py-3">Revenue Stream</th>
                <th className="px-4 py-3">Amount (USD)</th>
                <th className="px-4 py-3">Outstanding</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayedTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-500">{tx.refNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{tx.clientName}</div>
                    <div className="text-[11px] text-slate-400">{tx.sector}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800">{tx.type}</span>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900 tabular-nums">
                    ${tx.amountUsd.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {tx.outstandingBalanceUsd > 0 ? (
                      <span className="text-rose-600 font-medium">
                        ${tx.outstandingBalanceUsd.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium">$0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.status === 'Fully Paid'
                          ? 'bg-emerald-50 text-emerald-700'
                          : tx.status === 'Deposit Paid'
                          ? 'bg-amber-50 text-amber-700'
                          : tx.status === 'Overdue'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canWriteCommercial ? (
                      <button
                        onClick={() => deleteTransaction(tx.id)}
                        title="Delete transaction"
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">Read Only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Transaction Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-sm font-bold">Record Commercial Invoicing Transaction</span>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="p-5 space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Client Organization *</label>
                <input
                  type="text"
                  required
                  value={formData.clientName || ''}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Revenue Stream</label>
                  <select
                    value={formData.type || 'Exhibition Hall Space'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="Exhibition Hall Space">Exhibition Hall Space</option>
                    <option value="Sponsorship Agreement">Sponsorship Agreement</option>
                    <option value="Advertising & Signage">Advertising &amp; Signage</option>
                    <option value="Conference & Forum Pass">Conference &amp; Forum Pass</option>
                    <option value="Commercial Services">Commercial Services</option>
                    <option value="Logistics & Utilities">Logistics &amp; Utilities</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Sector</label>
                  <input
                    type="text"
                    value={formData.sector || 'Mining & Natural Resources'}
                    onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Total Amount (USD) *</label>
                  <input
                    type="number"
                    required
                    value={formData.amountUsd || 15000}
                    onChange={(e) => setFormData({ ...formData, amountUsd: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Outstanding Balance (USD)</label>
                  <input
                    type="number"
                    value={formData.outstandingBalanceUsd || 0}
                    onChange={(e) => setFormData({ ...formData, outstandingBalanceUsd: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Payment Status</label>
                <select
                  value={formData.status || 'Fully Paid'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                >
                  <option value="Fully Paid">Fully Paid</option>
                  <option value="Deposit Paid">Deposit Paid</option>
                  <option value="Invoice Sent">Invoice Sent</option>
                  <option value="Overdue">Overdue</option>
                </select>
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
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
