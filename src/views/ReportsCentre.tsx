import React, { useMemo, useState } from 'react';
import { useBI } from '../context/BIContext';
import {
  AlertMetricKey,
  AlertOperator,
  AlertSeverity,
  BIReport,
  ScheduleFrequency,
  ScheduledReportConfig,
  ThresholdAlertRule,
} from '../types';
import { formatUsdCompact } from '../utils/formatters';
import {
  ALERT_METRIC_CATALOG,
  computeAlertMetricValues,
  formatAlertMetricValue,
  formatOperatorSymbol,
  testAlertCondition,
} from '../utils/alertsAndSchedules';
import { ShareCollaborateModal } from '../components/common/ShareCollaborateModal';
import {
  Printer,
  Download,
  Plus,
  Shield,
  Calendar,
  Building,
  CheckCircle,
  FileText,
  Eye,
  BellRing,
  Clock,
  Play,
  Trash2,
  Edit3,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Pause,
  X,
  Share2,
  Mail,
  MessageSquare,
  Send,
  Check,
  AlertCircle,
} from 'lucide-react';

type ReportsTab = 'builder' | 'alerts' | 'schedules';

export const ReportsCentre: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const {
    reports,
    addReport,
    selectedEditionId,
    editions,
    exhibitors,
    visitors,
    transactions,
    tradeEngagements,
    hallUtilisation,
    incidents,
    executiveMetrics,
    currentUser,
    alertRules,
    alertEvents,
    scheduledReports,
    addAlertRule,
    updateAlertRule,
    deleteAlertRule,
    evaluateAlerts,
    updateAlertEventStatus,
    addScheduledReport,
    updateScheduledReport,
    deleteScheduledReport,
    runScheduledReportNow,
    sharedItems,
    annotations,
    addAnnotation,
    toggleAnnotationStatus,
    transitionShareWorkflow,
  } = useBI();

  const currentEditionObj = editions.find((e) => e.id === selectedEditionId);
  const editionTitle = currentEditionObj ? currentEditionObj.name : 'All Editions';

  const [activeTab, setActiveTab] = useState<ReportsTab>('builder');

  // Report Builder state
  const [selectedPillar, setSelectedPillar] = useState<BIReport['pillar']>('Executive');
  const [selectedConfidentiality, setSelectedConfidentiality] = useState<BIReport['confidentiality']>(
    'Confidential - Board & Executive'
  );
  const [activePreviewReport, setActivePreviewReport] = useState<BIReport | null>(reports[0] || null);

  // Alert Rule Modal state
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ThresholdAlertRule | null>(null);
  const [ruleForm, setRuleForm] = useState<{
    name: string;
    metricKey: AlertMetricKey;
    operator: AlertOperator;
    threshold: number;
    severity: AlertSeverity;
    editionId: string;
    recipients: string;
    isActive: boolean;
  }>({
    name: '',
    metricKey: 'collection_rate_pct',
    operator: 'lt',
    threshold: 85,
    severity: 'Warning',
    editionId: selectedEditionId || 'zitf-2026',
    recipients: 'executive@zitf.co.zw',
    isActive: true,
  });
  const [isEvaluatingAlerts, setIsEvaluatingAlerts] = useState(false);
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);
  const [eventStatusFilter, setEventStatusFilter] = useState<'All' | 'Active' | 'Acknowledged' | 'Resolved'>('All');

  // Schedule Modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledReportConfig | null>(null);
  const [schedForm, setSchedForm] = useState<{
    name: string;
    pillar: BIReport['pillar'];
    editionId: string;
    confidentiality: BIReport['confidentiality'];
    frequency: ScheduleFrequency;
    runTimeUtc: string;
    dayOfWeekOrMonth: string;
    recipients: string;
    includeMiningForecast: boolean;
    isActive: boolean;
  }>({
    name: '',
    pillar: 'Executive',
    editionId: selectedEditionId || 'zitf-2026',
    confidentiality: 'Confidential - Board & Executive',
    frequency: 'Daily',
    runTimeUtc: '07:00',
    dayOfWeekOrMonth: 'Every Day',
    recipients: 'board@zitf.co.zw',
    includeMiningForecast: true,
    isActive: true,
  });
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);
  const [scheduleFeedback, setScheduleFeedback] = useState<string | null>(null);

  // Share, Email & Inline Report Annotation state
  const [shareModalMode, setShareModalMode] = useState<'share' | 'email' | null>(null);
  const [inlineSectionTag, setInlineSectionTag] = useState<string>('Executive Summary');
  const [inlineCommentText, setInlineCommentText] = useState<string>('');
  const [isPostingInlineComment, setIsPostingInlineComment] = useState<boolean>(false);

  const reportAnnotations = useMemo(() => {
    if (!activePreviewReport) return [];
    return annotations.filter(
      (a) =>
        a.targetType === 'Report' &&
        (a.targetId === activePreviewReport.id || a.targetId === activePreviewReport.reportNumber)
    );
  }, [annotations, activePreviewReport]);

  const activeReportShare = useMemo(() => {
    if (!activePreviewReport) return null;
    return (
      sharedItems.find(
        (s) =>
          s.targetType === 'Report' &&
          (s.targetId === activePreviewReport.id || s.targetId === activePreviewReport.reportNumber)
      ) || null
    );
  }, [sharedItems, activePreviewReport]);

  const handlePostInlineAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePreviewReport || !inlineCommentText.trim()) return;
    setIsPostingInlineComment(true);
    try {
      await addAnnotation({
        targetType: 'Report',
        targetId: activePreviewReport.id,
        targetTitle: activePreviewReport.title,
        sectionTag: inlineSectionTag,
        body: inlineCommentText,
      });
      setInlineCommentText('');
    } finally {
      setIsPostingInlineComment(false);
    }
  };

  const activeAlertCount = useMemo(
    () => alertEvents.filter((e) => e.status === 'Active').length,
    [alertEvents]
  );

  // Live metric evaluation map for every configured rule
  const liveRuleReadings = useMemo(() => {
    const scope = {
      editions,
      exhibitors,
      visitors,
      transactions,
      tradeEngagements,
      hallUtilisation,
      incidents,
    };
    const byEd = new Map<string, Record<AlertMetricKey, number>>();
    const readings: Record<string, { observed: number; breached: boolean; label: string }> = {};

    for (const rule of alertRules) {
      const ed = rule.editionId || 'zitf-2026';
      if (!byEd.has(ed)) {
        byEd.set(ed, computeAlertMetricValues(scope, ed));
      }
      const metrics = byEd.get(ed)!;
      const observed = metrics[rule.metricKey] ?? 0;
      const breached = rule.isActive && testAlertCondition(observed, rule.operator, rule.threshold);
      const meta = ALERT_METRIC_CATALOG.find((m) => m.key === rule.metricKey);
      readings[rule.id] = {
        observed,
        breached,
        label: meta?.label || rule.metricKey,
      };
    }
    return readings;
  }, [
    alertRules,
    editions,
    exhibitors,
    visitors,
    transactions,
    tradeEngagements,
    hallUtilisation,
    incidents,
  ]);

  const filteredEvents = useMemo(() => {
    if (eventStatusFilter === 'All') return alertEvents;
    return alertEvents.filter((e) => e.status === eventStatusFilter);
  }, [alertEvents, eventStatusFilter]);

  const handleGenerateReport = () => {
    let title = '';
    let summary = '';
    let kpis = [];
    let recommendations = [];

    if (selectedPillar === 'Executive') {
      title = `Executive Consolidated Trade & Commercial Intelligence Report - ${editionTitle}`;
      summary = `Consolidated multi-pillar strategic performance summary for ${editionTitle} from the centralized SQLite warehouse. Total exhibitors reached ${executiveMetrics.totalExhibitors} across ${executiveMetrics.internationalCountriesCount} foreign source nations (${executiveMetrics.internationalPct}% international). Invoiced commercial revenue achieved ${formatUsdCompact(executiveMetrics.totalRevenueUsd)} USD, while independently verified B2B trade contracts totaled ${formatUsdCompact(executiveMetrics.verifiedDealsUsd)} USD with ${executiveMetrics.spaceOccupancyPct}% venue space utilization.`;
      kpis = [
        { label: 'Total Exhibitors', value: `${executiveMetrics.totalExhibitors} Companies`, trend: `${executiveMetrics.internationalPct}% Int'l` },
        { label: 'Total Visitors', value: executiveMetrics.totalVisitors.toLocaleString(), trend: `${executiveMetrics.businessVisitors.toLocaleString()} Business` },
        { label: 'Commercial Revenue', value: `${formatUsdCompact(executiveMetrics.totalRevenueUsd)} USD`, trend: `${executiveMetrics.collectionRatePct}% Collected` },
        { label: 'Independently Verified Deals', value: `${formatUsdCompact(executiveMetrics.verifiedDealsUsd)} USD`, trend: `${executiveMetrics.verifiedDealsCount} Audited` },
        { label: 'Hall Space Occupancy', value: `${executiveMetrics.spaceOccupancyPct}%`, trend: `${executiveMetrics.occupiedSqmTotal.toLocaleString()} sqm` },
        { label: 'Exhibitor Retention Rate', value: `${executiveMetrics.retentionRate}%`, trend: `${executiveMetrics.returningExhibitorsCount} Returning` },
      ];
      recommendations = [
        'Expand indoor lettable mezzanine capacity in top-utilized halls before the next edition.',
        `Accelerate year-round B2B matchmaking follow-ups to convert the ${formatUsdCompact(executiveMetrics.reportedDealsUsd)} participant-reported pipeline into verified deals.`,
        'Institutionalize digital trade registration with pre-fair QR badge issuance and live connector sync.',
      ];
    } else if (selectedPillar === 'Trade Impact') {
      title = `Trade Impact & B2B Matchmaking Outcome Evaluation - ${editionTitle}`;
      summary = `Comprehensive audit of trade connections facilitated at ${editionTitle}. ${executiveMetrics.b2bMeetingsCount} logged B2B matchmaking sessions resulted in ${executiveMetrics.convertedDealsCount} converted commercial contracts and ${formatUsdCompact(executiveMetrics.verifiedDealsUsd)} in independently verified transactions (${executiveMetrics.verifiedDealsCount} deals), alongside ${formatUsdCompact(executiveMetrics.reportedDealsUsd)} in participant-reported trade agreements.`;
      kpis = [
        { label: 'B2B Matchmaking Meetings', value: `${executiveMetrics.b2bMeetingsCount} Sessions`, trend: `${executiveMetrics.convertedDealsCount} Converted` },
        { label: 'Independently Verified Contracts', value: `${formatUsdCompact(executiveMetrics.verifiedDealsUsd)} USD`, trend: `${executiveMetrics.verifiedDealsCount} Audited` },
        { label: 'Participant Reported Deals', value: `${formatUsdCompact(executiveMetrics.reportedDealsUsd)} USD`, trend: `${executiveMetrics.reportedDealsCount} Self-Declared` },
        { label: 'Pipeline Follow-up Rate', value: `${executiveMetrics.followUpRatePct}%`, trend: `${executiveMetrics.smeLeadsCount} Active Leads` },
      ];
      recommendations = [
        'Deploy dedicated trade attache liaisons to assist cross-border customs clearance for regional off-take buyers.',
        'Require third-party contract validation before promoting participant-reported transactions to Verified tier.',
      ];
    } else if (selectedPillar === 'Commercial') {
      const spaceShare =
        executiveMetrics.totalRevenueUsd > 0
          ? ((executiveMetrics.spaceSalesUsd / executiveMetrics.totalRevenueUsd) * 100).toFixed(1)
          : '0.0';
      const outGap =
        executiveMetrics.totalRevenueUsd > 0
          ? ((executiveMetrics.outstandingBalanceUsd / executiveMetrics.totalRevenueUsd) * 100).toFixed(1)
          : '0.0';
      title = `Commercial Revenue & Sales Performance Audit - ${editionTitle}`;
      summary = `Comprehensive financial analysis of exhibition space sales, corporate sponsorships, and ancillary commercial services in ${editionTitle}. Outstanding receivables stand at ${outGap}% (${formatUsdCompact(executiveMetrics.outstandingBalanceUsd)}), with collection clearance of ${executiveMetrics.collectionRatePct}% and average revenue per exhibitor of $${executiveMetrics.avgRevenuePerExhibitor.toLocaleString()} USD.`;
      kpis = [
        { label: 'Total Invoiced Revenue', value: `${formatUsdCompact(executiveMetrics.totalRevenueUsd)} USD`, trend: `${executiveMetrics.collectionRatePct}% Collected` },
        { label: 'Exhibition Hall Space', value: `${formatUsdCompact(executiveMetrics.spaceSalesUsd)} USD`, trend: `${spaceShare}% of Total` },
        { label: 'Corporate Sponsorships', value: `${formatUsdCompact(executiveMetrics.sponsorshipUsd)} USD`, trend: 'Headline Partners' },
        { label: 'Outstanding Invoices', value: `${formatUsdCompact(executiveMetrics.outstandingBalanceUsd)} USD`, trend: `${outGap}% of Total` },
      ];
      recommendations = [
        'Enforce 60-day advance full payment cutoff for non-corporate exhibitors to further reduce outstanding receivables.',
        'Develop digital sponsorship packages for the Smart Stand Locator and virtual trade directory.',
      ];
    } else {
      title = `${selectedPillar} Intelligence Brief - ${editionTitle}`;
      summary = `Official departmental business intelligence brief focusing on ${selectedPillar} indicators stored in the centralized SQLite warehouse for ${editionTitle}.`;
      kpis = [
        { label: 'Active Reporting Period', value: editionTitle, trend: 'Warehouse Live' },
        { label: 'Exhibitors / Visitors', value: `${executiveMetrics.totalExhibitors} / ${executiveMetrics.totalVisitors}`, trend: 'Active Scope' },
        { label: 'Venue Occupancy', value: `${executiveMetrics.spaceOccupancyPct}%`, trend: `${executiveMetrics.openIncidentsCount} Open Incidents` },
      ];
      recommendations = [
        'Maintain daily database synchronizations and external API connector pulls during active fair operations.',
        'Validate uploaded CSV/JSON datasets through Data Governance deduplication checks.',
      ];
    }

    const newReport: Omit<BIReport, 'id'> = {
      reportNumber: `ZITF-BI-${Date.now().toString().slice(-4)}`,
      title,
      pillar: selectedPillar,
      editionId: selectedEditionId === 'all' ? 'zitf-2026' : selectedEditionId,
      generationDate: new Date().toISOString().substring(0, 10),
      author: `${currentUser.name} (${currentUser.role})`,
      confidentiality: selectedConfidentiality,
      summaryFindings: summary,
      kpis,
      recommendations,
      isDemo: false,
    };

    addReport(newReport);
    setActivePreviewReport({ ...newReport, id: `rep-${Date.now()}` });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportJson = () => {
    if (!activePreviewReport) return;
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activePreviewReport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${activePreviewReport.reportNumber}_Executive_Report.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Alert Rule Modal Handlers
  const openCreateRuleModal = () => {
    setEditingRule(null);
    const meta = ALERT_METRIC_CATALOG[0];
    setRuleForm({
      name: '',
      metricKey: meta.key,
      operator: meta.defaultOperator,
      threshold: meta.defaultThreshold,
      severity: 'Warning',
      editionId: selectedEditionId || 'zitf-2026',
      recipients: 'executive@zitf.co.zw',
      isActive: true,
    });
    setIsRuleModalOpen(true);
  };

  const openEditRuleModal = (rule: ThresholdAlertRule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      metricKey: rule.metricKey,
      operator: rule.operator,
      threshold: rule.threshold,
      severity: rule.severity,
      editionId: rule.editionId,
      recipients: rule.recipients,
      isActive: rule.isActive,
    });
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.name.trim()) return;
    if (editingRule) {
      await updateAlertRule(editingRule.id, {
        ...ruleForm,
        notifyRoles: editingRule.notifyRoles,
      });
      setAlertFeedback(`Updated alert rule "${ruleForm.name}" and re-evaluated against SQLite warehouse.`);
    } else {
      await addAlertRule({
        ...ruleForm,
        notifyRoles: ['Super Administrator', 'Executive Management'],
      });
      setAlertFeedback(`Created alert rule "${ruleForm.name}" and evaluated live KPIs.`);
    }
    setIsRuleModalOpen(false);
  };

  const handleEvaluateNow = async () => {
    setIsEvaluatingAlerts(true);
    try {
      const res = await evaluateAlerts();
      setAlertFeedback(
        res.triggeredCount > 0
          ? `Evaluation complete: ${res.triggeredCount} new threshold breach alert(s) recorded.`
          : 'Evaluation complete: all active alert rules evaluated against live SQLite metrics (no new unlogged breaches).'
      );
    } finally {
      setIsEvaluatingAlerts(false);
    }
  };

  // Schedule Modal Handlers
  const openCreateScheduleModal = () => {
    setEditingSchedule(null);
    setSchedForm({
      name: '',
      pillar: 'Executive',
      editionId: selectedEditionId || 'zitf-2026',
      confidentiality: 'Confidential - Board & Executive',
      frequency: 'Daily',
      runTimeUtc: '07:00',
      dayOfWeekOrMonth: 'Every Day',
      recipients: 'board@zitf.co.zw, s.nkomo@zitf.co.zw',
      includeMiningForecast: true,
      isActive: true,
    });
    setIsScheduleModalOpen(true);
  };

  const openEditScheduleModal = (sched: ScheduledReportConfig) => {
    setEditingSchedule(sched);
    setSchedForm({
      name: sched.name,
      pillar: sched.pillar,
      editionId: sched.editionId,
      confidentiality: sched.confidentiality,
      frequency: sched.frequency,
      runTimeUtc: sched.runTimeUtc,
      dayOfWeekOrMonth: sched.dayOfWeekOrMonth || 'Every Day',
      recipients: sched.recipients,
      includeMiningForecast: sched.includeMiningForecast,
      isActive: sched.isActive,
    });
    setIsScheduleModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedForm.name.trim()) return;
    if (editingSchedule) {
      await updateScheduledReport(editingSchedule.id, schedForm);
      setScheduleFeedback(`Updated schedule "${schedForm.name}".`);
    } else {
      await addScheduledReport(schedForm);
      setScheduleFeedback(`Created recurring schedule "${schedForm.name}" (${schedForm.frequency}).`);
    }
    setIsScheduleModalOpen(false);
  };

  const handleRunScheduleNow = async (sched: ScheduledReportConfig) => {
    setRunningScheduleId(sched.id);
    try {
      const generated = await runScheduledReportNow(sched.id);
      if (generated) {
        setActivePreviewReport(generated);
        setScheduleFeedback(`Executed "${sched.name}" and archived ${generated.reportNumber}.`);
      }
    } finally {
      setRunningScheduleId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 no-print">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Reports, Threshold Alerts &amp; Scheduled Delivery
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
              {editionTitle}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Compile institutional BI briefs, enforce real-time KPI threshold alert rules, and automate recurring report schedules.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'builder' && (
            <>
              {activePreviewReport && (
                <>
                  <button
                    onClick={() => setShareModalMode('share')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share &amp; Route Approval</span>
                  </button>
                  <button
                    onClick={() => setShareModalMode('email')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5 text-amber-600" />
                    <span>Email Report</span>
                  </button>
                </>
              )}
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Print Report (PDF)</span>
              </button>
              <button
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>Export Report Data</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 no-print">
        <button
          onClick={() => setActiveTab('builder')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'builder'
              ? 'border-amber-600 text-slate-900 bg-amber-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4 text-amber-600" />
          <span>Report Builder &amp; Archive ({reports.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'alerts'
              ? 'border-amber-600 text-slate-900 bg-amber-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BellRing className="w-4 h-4 text-amber-600" />
          <span>Configurable Threshold Alerts ({alertRules.length})</span>
          {activeAlertCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
              {activeAlertCount} Active
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('schedules')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'schedules'
              ? 'border-amber-600 text-slate-900 bg-amber-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-600" />
          <span>Scheduled Reports ({scheduledReports.length})</span>
        </button>
      </div>

      {/* ======================================================= */}
      {/* TAB 1: REPORT BUILDER & PREVIEW                         */}
      {/* ======================================================= */}
      {activeTab === 'builder' && (
        <div className="space-y-6">
          {/* Generator Control Panel */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs no-print">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Configure &amp; Generate New BI Report
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Intelligence Pillar</label>
                <select
                  value={selectedPillar}
                  onChange={(e) => setSelectedPillar(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium cursor-pointer"
                >
                  <option value="Executive">Consolidated Executive Overview</option>
                  <option value="Exhibitor">Exhibitor Intelligence</option>
                  <option value="Visitor">Visitor Intelligence</option>
                  <option value="Commercial">Commercial Intelligence</option>
                  <option value="Trade Impact">Trade Impact &amp; B2B Deals</option>
                  <option value="Operational">Operational Intelligence</option>
                  <option value="Market Insight">Strategic Market Insight</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Exhibition Edition</label>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800">
                  {editionTitle}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Confidentiality Classification</label>
                <select
                  value={selectedConfidentiality}
                  onChange={(e) => setSelectedConfidentiality(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium cursor-pointer"
                >
                  <option value="Confidential - Board & Executive">Confidential - Board &amp; Executive</option>
                  <option value="Management Internal">Management Internal</option>
                  <option value="Public Trade Release">Public Trade Release</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={handleGenerateReport}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Generate &amp; Preview Report</span>
              </button>
            </div>
          </div>

          {/* Report Preview Canvas */}
          {activePreviewReport ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-10 max-w-4xl mx-auto print:border-none print:shadow-none print:p-0">
              {/* Report Letterhead Header */}
              <div className="border-b-2 border-slate-900 pb-5 mb-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-12 px-2.5 py-1 rounded-lg bg-white border border-slate-300 shadow-2xs flex items-center justify-center shrink-0">
                      <img
                        src="/assets/aistudio/zitf_3bc77275.png"
                        alt="ZITF Logo"
                        className="h-8 w-auto object-contain"
                      />
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                        ZIMBABWE INTERNATIONAL TRADE FAIR
                      </h2>
                      <p className="text-xs font-semibold text-amber-700 tracking-wide uppercase">
                        ZITF Business Intelligence
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Zimbabwe International Exhibition Centre, Bulawayo, Zimbabwe
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-xs shrink-0">
                    <span className="inline-block px-2.5 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-200 mb-1">
                      {activePreviewReport.reportNumber}
                    </span>
                    <div className="text-slate-500 font-medium">Date: {activePreviewReport.generationDate}</div>
                    <div className="text-[11px] font-semibold text-rose-700">
                      {activePreviewReport.confidentiality}
                    </div>
                  </div>
                </div>
              </div>

              {/* Report Title & Metadata Strip */}
              <div className="mb-6">
                <h1 className="text-xl font-bold text-slate-900 leading-snug">
                  {activePreviewReport.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                  <span className="flex items-center gap-1 font-medium">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>Pillar: {activePreviewReport.pillar} Intelligence</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Edition: {editionTitle}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 font-medium">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span>Author: {activePreviewReport.author}</span>
                  </span>
                </div>
              </div>

              {/* Executive Summary Findings */}
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1.5 mb-2.5">
                  1. Executive Summary &amp; Findings
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-200/80">
                  {activePreviewReport.summaryFindings}
                </p>
              </div>

              {/* Consolidated Key Performance Indicators Table */}
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1.5 mb-2.5">
                  2. Core Performance Indicator Snapshot
                </h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <table className="w-full text-left divide-y divide-slate-200">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="px-4 py-2.5">Key Performance Indicator</th>
                        <th className="px-4 py-2.5">Metric Value</th>
                        <th className="px-4 py-2.5 text-right">Trend / Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {activePreviewReport.kpis.map((kpi, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium">{kpi.label}</td>
                          <td className="px-4 py-2.5 font-bold tabular-nums text-slate-900">{kpi.value}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-[11px] text-emerald-700 font-bold">
                            {kpi.trend}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Strategic Recommendations */}
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1.5 mb-2.5">
                  3. Strategic Management Recommendations
                </h3>
                <div className="space-y-2 text-xs">
                  {activePreviewReport.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/60 text-slate-800"
                    >
                      <CheckCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Signoff & Data Integrity Disclaimer */}
              <div className="pt-6 border-t-2 border-slate-200 text-[11px] text-slate-500 space-y-1">
                <div className="flex items-center justify-between">
                  <span>
                    <strong>Data Governance Attribution:</strong> ZITF Business Intelligence Data Warehouse
                  </span>
                  <span>
                    Classification: <strong>{activePreviewReport.confidentiality}</strong>
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  This report has been compiled through the ZITF Business Intelligence Platform pursuant to Zimbabwean national trade facilitation standards. All statistics reflect independently audited and participant-verified submissions.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
              Select or generate a report above to preview.
            </div>
          )}

          {/* Collaborative Workflow & Pinned Annotations Panel for Active Report */}
          {activePreviewReport && (
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5 max-w-4xl mx-auto no-print space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-amber-600" />
                    <span>Report Annotations &amp; Review Workflow ({reportAnnotations.length})</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pin section-level review feedback or transition sign-off status for {activePreviewReport.reportNumber}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeReportShare ? (
                    <>
                      <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        Workflow: {activeReportShare.workflowStatus}
                      </span>
                      {activeReportShare.workflowStatus !== 'Approved' && (
                        <>
                          <button
                            onClick={() => transitionShareWorkflow(activeReportShare.id, 'Changes Requested')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold cursor-pointer"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span>Request Changes</span>
                          </button>
                          <button
                            onClick={() => transitionShareWorkflow(activeReportShare.id, 'Approved')}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>Approve &amp; Sign-Off</span>
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => setShareModalMode('share')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Start Approval Workflow</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Inline Comment Form */}
              <form onSubmit={handlePostInlineAnnotation} className="flex flex-col sm:flex-row gap-2">
                <select
                  value={inlineSectionTag}
                  onChange={(e) => setInlineSectionTag(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-semibold text-slate-700 cursor-pointer shrink-0"
                >
                  <option value="Executive Summary">1. Executive Summary</option>
                  <option value="KPI Snapshot">2. KPI Snapshot</option>
                  <option value="Recommendations">3. Recommendations</option>
                  <option value="General">General Report</option>
                </select>
                <input
                  type="text"
                  value={inlineCommentText}
                  onChange={(e) => setInlineCommentText(e.target.value)}
                  placeholder="Add annotation or @email mention (e.g. @s.nkomo@zitf.co.zw verify Q2 figures)..."
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
                />
                <button
                  type="submit"
                  disabled={isPostingInlineComment || !inlineCommentText.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isPostingInlineComment ? 'Posting...' : 'Pin Comment'}</span>
                </button>
              </form>

              {reportAnnotations.length > 0 && (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {reportAnnotations.map((ann) => (
                    <div key={ann.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">{ann.authorName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                            {ann.sectionTag}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              ann.status === 'Resolved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {ann.status}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{ann.createdAt}</span>
                        </div>
                        <p className="text-slate-700">{ann.body}</p>
                      </div>
                      <button
                        onClick={() =>
                          toggleAnnotationStatus(ann.id, ann.status === 'Open' ? 'Resolved' : 'Open')
                        }
                        className={`px-2.5 py-1 rounded font-bold shrink-0 cursor-pointer ${
                          ann.status === 'Open'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {ann.status === 'Open' ? 'Resolve' : 'Re-open'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Previously Generated Reports Archive */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5 no-print">
            <h3 className="font-bold text-sm text-slate-900 mb-1">Archived Business Intelligence Reports</h3>
            <p className="text-xs text-slate-500 mb-4">
              Click to inspect or reprint manual and scheduled executive briefs
            </p>

            <div className="divide-y divide-slate-100 text-xs">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  onClick={() => setActivePreviewReport(rep)}
                  className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="font-semibold text-slate-900">{rep.title}</div>
                      <div className="text-[11px] text-slate-400">
                        {rep.reportNumber} · {rep.pillar} · {rep.generationDate} · {rep.author}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                      {rep.confidentiality}
                    </span>
                    <Eye className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* TAB 2: CONFIGURABLE THRESHOLD ALERTS                    */}
      {/* ======================================================= */}
      {activeTab === 'alerts' && (
        <div className="space-y-5 no-print">
          {/* Action Toolbar */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BellRing className="w-4 h-4 text-amber-600" />
                <span>Automated KPI Threshold Alert Rules</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Server-enforced monitoring rules evaluated against live SQLite warehouse metrics on every import and 60s scheduler tick.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleEvaluateNow}
                disabled={isEvaluatingAlerts}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isEvaluatingAlerts ? 'animate-spin' : ''}`} />
                <span>{isEvaluatingAlerts ? 'Evaluating...' : 'Evaluate All Rules Now'}</span>
              </button>
              <button
                onClick={openCreateRuleModal}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>New Threshold Rule</span>
              </button>
            </div>
          </div>

          {alertFeedback && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
              <span>{alertFeedback}</span>
              <button onClick={() => setAlertFeedback(null)} className="text-amber-700 hover:text-amber-950">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Rules Table */}
          <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <th className="p-3">Rule &amp; Scope</th>
                    <th className="p-3">Monitored KPI</th>
                    <th className="p-3">Condition</th>
                    <th className="p-3 text-right">Live Value</th>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Recipients</th>
                    <th className="p-3">Live State</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alertRules.map((rule) => {
                    const reading = liveRuleReadings[rule.id];
                    const breached = reading?.breached;
                    return (
                      <tr key={rule.id} className="hover:bg-slate-50/70">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{rule.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">Scope: {rule.editionId}</div>
                        </td>
                        <td className="p-3 text-slate-700 font-medium">{reading?.label || rule.metricKey}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {formatOperatorSymbol(rule.operator)}{' '}
                          {formatAlertMetricValue(rule.metricKey, rule.threshold)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          <span className={breached ? 'text-rose-700' : 'text-emerald-700'}>
                            {reading ? formatAlertMetricValue(rule.metricKey, reading.observed) : '—'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              rule.severity === 'Critical'
                                ? 'bg-rose-100 text-rose-800'
                                : rule.severity === 'Warning'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {rule.severity}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-slate-600 max-w-[180px] truncate" title={rule.recipients}>
                          {rule.recipients || 'Default Executive List'}
                        </td>
                        <td className="p-3">
                          {!rule.isActive ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                              Paused
                            </span>
                          ) : breached ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                              <AlertTriangle className="w-3 h-3" />
                              BREACHED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              NOMINAL
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => updateAlertRule(rule.id, { isActive: !rule.isActive })}
                              title={rule.isActive ? 'Pause rule' : 'Enable rule'}
                              className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                            >
                              {rule.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => openEditRuleModal(rule)}
                              title="Edit rule"
                              className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteAlertRule(rule.id)}
                              title="Delete rule"
                              className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alert Events History */}
          <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Triggered Alert Events ({filteredEvents.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Persistent breach history with executive acknowledgement and resolution tracking
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {(['All', 'Active', 'Acknowledged', 'Resolved'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setEventStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                      eventStatusFilter === st
                        ? 'bg-slate-900 text-amber-400'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No alert events matching &quot;{eventStatusFilter}&quot;.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {filteredEvents.map((ev) => (
                  <div key={ev.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            ev.severity === 'Critical'
                              ? 'bg-rose-100 text-rose-800'
                              : ev.severity === 'Warning'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {ev.severity}
                        </span>
                        <span className="font-bold text-slate-900">{ev.ruleName}</span>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            ev.status === 'Active'
                              ? 'bg-rose-600 text-white'
                              : ev.status === 'Acknowledged'
                              ? 'bg-amber-200 text-amber-950'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {ev.status}
                        </span>
                      </div>
                      <p className="text-slate-700">{ev.message}</p>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Triggered: {ev.triggeredAt}
                        {ev.acknowledgedBy ? ` · Handled by ${ev.acknowledgedBy} (${ev.acknowledgedAt})` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {ev.status === 'Active' && (
                        <button
                          onClick={() => updateAlertEventStatus(ev.id, 'Acknowledged')}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 font-semibold cursor-pointer"
                        >
                          Acknowledge
                        </button>
                      )}
                      {ev.status !== 'Resolved' && (
                        <button
                          onClick={() => updateAlertEventStatus(ev.id, 'Resolved')}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                        >
                          Resolve
                        </button>
                      )}
                      {ev.status === 'Resolved' && (
                        <button
                          onClick={() => updateAlertEventStatus(ev.id, 'Active')}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                        >
                          Re-open
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* TAB 3: SCHEDULED REPORTS & AUTOMATED DELIVERY           */}
      {/* ======================================================= */}
      {activeTab === 'schedules' && (
        <div className="space-y-5 no-print">
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Automated Report Schedules &amp; Executive Distribution</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Server scheduler checks due intervals every 60s and archives compiled BI reports from live SQLite tables.
              </p>
            </div>
            <button
              onClick={openCreateScheduleModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>New Report Schedule</span>
            </button>
          </div>

          {scheduleFeedback && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2">
              <span>{scheduleFeedback}</span>
              <div className="flex items-center gap-2">
                {activePreviewReport && (
                  <button
                    onClick={() => setActiveTab('builder')}
                    className="px-2.5 py-1 rounded bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    Open Generated Report
                  </button>
                )}
                <button onClick={() => setScheduleFeedback(null)} className="text-emerald-700 hover:text-emerald-950">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <th className="p-3">Schedule Name &amp; Pillar</th>
                    <th className="p-3">Cadence</th>
                    <th className="p-3">Recipients</th>
                    <th className="p-3">Next Run (UTC)</th>
                    <th className="p-3 text-right">Runs</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scheduledReports.map((sched) => (
                    <tr key={sched.id} className="hover:bg-slate-50/70">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{sched.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {sched.pillar} · {sched.editionId}
                          {sched.includeMiningForecast ? ' · +OLS Forecast & Outliers' : ''}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-slate-800">
                        <div>{sched.frequency}</div>
                        <div className="text-[11px] text-slate-400">
                          {sched.runTimeUtc} UTC {sched.dayOfWeekOrMonth ? `(${sched.dayOfWeekOrMonth})` : ''}
                        </div>
                      </td>
                      <td className="p-3 text-[11px] text-slate-600 max-w-[180px] truncate" title={sched.recipients}>
                        {sched.recipients || 'Executive Committee'}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-700">
                        <div>{sched.nextRunAt.replace('T', ' ').substring(0, 16)}</div>
                        {sched.lastRunAt && (
                          <div className="text-slate-400">
                            Last: {sched.lastRunAt.replace('T', ' ').substring(0, 16)}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">{sched.runCount}</td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            sched.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {sched.isActive ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleRunScheduleNow(sched)}
                            disabled={runningScheduleId === sched.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer disabled:opacity-50"
                          >
                            <Play className="w-3 h-3" />
                            <span>{runningScheduleId === sched.id ? 'Running...' : 'Run Now'}</span>
                          </button>
                          <button
                            onClick={() => updateScheduledReport(sched.id, { isActive: !sched.isActive })}
                            title={sched.isActive ? 'Pause schedule' : 'Activate schedule'}
                            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          >
                            {sched.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => openEditScheduleModal(sched)}
                            title="Edit schedule"
                            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteScheduledReport(sched.id)}
                            title="Delete schedule"
                            className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL: CREATE / EDIT THRESHOLD ALERT RULE               */}
      {/* ======================================================= */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-sm font-bold">
                {editingRule ? 'Edit Threshold Alert Rule' : 'Configure New Threshold Alert Rule'}
              </span>
              <button onClick={() => setIsRuleModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="p-5 space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder="e.g. Receivables Collection Below 85%"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Monitored SQLite KPI</label>
                <select
                  value={ruleForm.metricKey}
                  onChange={(e) => {
                    const key = e.target.value as AlertMetricKey;
                    const meta = ALERT_METRIC_CATALOG.find((m) => m.key === key);
                    setRuleForm({
                      ...ruleForm,
                      metricKey: key,
                      operator: meta?.defaultOperator || ruleForm.operator,
                      threshold: meta?.defaultThreshold ?? ruleForm.threshold,
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                >
                  {ALERT_METRIC_CATALOG.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Operator</label>
                  <select
                    value={ruleForm.operator}
                    onChange={(e) => setRuleForm({ ...ruleForm, operator: e.target.value as AlertOperator })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="lt">Less than (&lt;)</option>
                    <option value="lte">At most (≤)</option>
                    <option value="gt">Greater than (&gt;)</option>
                    <option value="gte">At least (≥)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Threshold Value</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={ruleForm.threshold}
                    onChange={(e) => setRuleForm({ ...ruleForm, threshold: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Severity</label>
                  <select
                    value={ruleForm.severity}
                    onChange={(e) => setRuleForm({ ...ruleForm, severity: e.target.value as AlertSeverity })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="Critical">Critical</option>
                    <option value="Warning">Warning</option>
                    <option value="Info">Info</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Edition Scope</label>
                  <select
                    value={ruleForm.editionId}
                    onChange={(e) => setRuleForm({ ...ruleForm, editionId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    {editions.map((ed) => (
                      <option key={ed.id} value={ed.id}>
                        {ed.name}
                      </option>
                    ))}
                    <option value="all">All Editions</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Recipient Emails</label>
                  <input
                    type="text"
                    value={ruleForm.recipients}
                    onChange={(e) => setRuleForm({ ...ruleForm, recipients: e.target.value })}
                    placeholder="finance@zitf.co.zw, ceo@zitf.co.zw"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ruleForm.isActive}
                  onChange={(e) => setRuleForm({ ...ruleForm, isActive: e.target.checked })}
                />
                <span className="font-semibold text-slate-700">Enable continuous evaluation</span>
              </label>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold cursor-pointer"
                >
                  {editingRule ? 'Save Rule Changes' : 'Create & Evaluate Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL: CREATE / EDIT REPORT SCHEDULE                    */}
      {/* ======================================================= */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-sm font-bold">
                {editingSchedule ? 'Edit Scheduled Report' : 'Configure Automated Report Schedule'}
              </span>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="p-5 space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Schedule Name *</label>
                <input
                  type="text"
                  required
                  value={schedForm.name}
                  onChange={(e) => setSchedForm({ ...schedForm, name: e.target.value })}
                  placeholder="e.g. Daily Executive Trade & Revenue Flash"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Intelligence Pillar</label>
                  <select
                    value={schedForm.pillar}
                    onChange={(e) => setSchedForm({ ...schedForm, pillar: e.target.value as BIReport['pillar'] })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="Executive">Executive</option>
                    <option value="Exhibitor">Exhibitor</option>
                    <option value="Visitor">Visitor</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Trade Impact">Trade Impact</option>
                    <option value="Operational">Operational</option>
                    <option value="Market Insight">Market Insight</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Edition Scope</label>
                  <select
                    value={schedForm.editionId}
                    onChange={(e) => setSchedForm({ ...schedForm, editionId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    {editions.map((ed) => (
                      <option key={ed.id} value={ed.id}>
                        {ed.name}
                      </option>
                    ))}
                    <option value="all">All Editions</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Frequency</label>
                  <select
                    value={schedForm.frequency}
                    onChange={(e) =>
                      setSchedForm({ ...schedForm, frequency: e.target.value as ScheduleFrequency })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="Hourly (Monitor)">Hourly (Monitor)</option>
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Run Time (UTC)</label>
                  <input
                    type="time"
                    value={schedForm.runTimeUtc}
                    onChange={(e) => setSchedForm({ ...schedForm, runTimeUtc: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Confidentiality</label>
                  <select
                    value={schedForm.confidentiality}
                    onChange={(e) =>
                      setSchedForm({
                        ...schedForm,
                        confidentiality: e.target.value as BIReport['confidentiality'],
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    <option value="Confidential - Board & Executive">Board &amp; Executive</option>
                    <option value="Management Internal">Management Internal</option>
                    <option value="Public Trade Release">Public Release</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Distribution Recipients</label>
                <input
                  type="text"
                  value={schedForm.recipients}
                  onChange={(e) => setSchedForm({ ...schedForm, recipients: e.target.value })}
                  placeholder="board@zitf.co.zw, finance@zitf.co.zw"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schedForm.includeMiningForecast}
                    onChange={(e) =>
                      setSchedForm({ ...schedForm, includeMiningForecast: e.target.checked })
                    }
                  />
                  <span className="font-semibold text-slate-700">
                    Append Algorithmic OLS Revenue Forecast &amp; MAD Outlier Count
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schedForm.isActive}
                    onChange={(e) => setSchedForm({ ...schedForm, isActive: e.target.checked })}
                  />
                  <span className="font-semibold text-slate-700">Active automated schedule</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold cursor-pointer"
                >
                  {editingSchedule ? 'Save Schedule' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share & Email Brief Modal */}
      {activePreviewReport && (
        <ShareCollaborateModal
          isOpen={shareModalMode !== null}
          onClose={() => setShareModalMode(null)}
          initialMode={shareModalMode || 'share'}
          targetType="Report"
          targetId={activePreviewReport.id}
          targetTitle={`${activePreviewReport.reportNumber}: ${activePreviewReport.title}`}
          editionId={activePreviewReport.editionId}
          snapshotSummary={activePreviewReport.summaryFindings}
          onSuccessNavigateToCollab={onNavigate ? () => onNavigate('collaborate') : undefined}
        />
      )}
    </div>
  );
};
