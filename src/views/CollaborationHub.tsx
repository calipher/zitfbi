import React, { useMemo, useState } from 'react';
import { useBI } from '../context/BIContext';
import { ShareCollaborateModal } from '../components/common/ShareCollaborateModal';
import {
  AnnotationComment,
  CollaborationTargetType,
  CollaborationWorkflowStatus,
  SharedBriefItem,
} from '../types';
import {
  Share2,
  MessageSquare,
  Mail,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Copy,
  Trash2,
  ExternalLink,
  Download,
  Plus,
  AtSign,
  ArrowUpRight,
  Check,
  RotateCcw,
  FileText,
  Sparkles,
} from 'lucide-react';

type CollabTab = 'workflows' | 'annotations' | 'email';

const TARGET_ROUTE_MAP: Record<CollaborationTargetType, string> = {
  Report: 'reports',
  Dashboard: 'overview',
  DataMining: 'mining',
  TradeDeal: 'trade',
  Incident: 'operations',
  MarketInsight: 'market',
};

const WORKFLOW_BADGE_MAP: Record<CollaborationWorkflowStatus, string> = {
  Shared: 'bg-blue-100 text-blue-800 border-blue-200',
  'In Review': 'bg-amber-100 text-amber-900 border-amber-200',
  'Changes Requested': 'bg-rose-100 text-rose-800 border-rose-200',
  Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export const CollaborationHub: React.FC<{
  onNavigate: (tab: string) => void;
  activeShareToken?: string | null;
  onClearShareToken?: () => void;
}> = ({ onNavigate, activeShareToken, onClearShareToken }) => {
  const {
    currentUser,
    users,
    reports,
    sharedItems,
    annotations,
    emailDispatches,
    transitionShareWorkflow,
    deleteSharedItem,
    addAnnotation,
    toggleAnnotationStatus,
    deleteAnnotation,
    sendEmailBrief,
    executiveMetrics,
    selectedEditionId,
  } = useBI();

  const [activeTab, setActiveTab] = useState<CollabTab>('workflows');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'inbox' | 'sent'>('all');
  const [statusFilter, setStatusFilter] = useState<'All' | CollaborationWorkflowStatus>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Share Modal Quick Composer
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareModalInitMode, setShareModalInitMode] = useState<'share' | 'email'>('share');
  const [shareTargetType, setShareTargetType] = useState<CollaborationTargetType>('Report');
  const [shareTargetId, setShareTargetId] = useState<string>(reports[0]?.id || 'exec-dashboard');
  const [shareTargetTitle, setShareTargetTitle] = useState<string>(
    reports[0]?.title || 'Executive Business Intelligence Snapshot'
  );

  // Annotation Composer State
  const [annFilter, setAnnFilter] = useState<'All' | 'Open' | 'Resolved' | 'Mentions'>('All');
  const [annTargetType, setAnnTargetType] = useState<CollaborationTargetType>('Report');
  const [annTargetId, setAnnTargetId] = useState<string>(reports[0]?.id || 'exec-dashboard');
  const [annSectionTag, setAnnSectionTag] = useState<string>('Executive Summary');
  const [annBody, setAnnBody] = useState<string>('');
  const [isPostingAnn, setIsPostingAnn] = useState(false);

  // Standalone Email Composer State
  const [emailSelectedUsers, setEmailSelectedUsers] = useState<string[]>(() =>
    users.filter((u) => u.isActive && u.email !== currentUser.email).slice(0, 2).map((u) => u.email)
  );
  const [emailExternalInput, setEmailExternalInput] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>(
    `[ZITF BI] Executive Brief & Metrics Snapshot (${selectedEditionId.toUpperCase()})`
  );
  const [emailTargetType, setEmailTargetType] = useState<CollaborationTargetType>('Dashboard');
  const [emailBody, setEmailBody] = useState<string>(
    `ZITF Executive Metrics Summary:\n- Exhibitors: ${executiveMetrics.totalExhibitors} (${executiveMetrics.internationalPct}% International)\n- Visitors: ${executiveMetrics.totalVisitors.toLocaleString()} (${executiveMetrics.businessVisitors.toLocaleString()} Business Delegates)\n- Commercial Revenue: $${executiveMetrics.totalRevenueUsd.toLocaleString()} USD (${executiveMetrics.collectionRatePct}% Collected)\n- Verified Trade Deals: $${executiveMetrics.verifiedDealsUsd.toLocaleString()} USD (${executiveMetrics.verifiedDealsCount} Audited Deals)`
  );
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailDispatchBanner, setEmailDispatchBanner] = useState<{
    message: string;
    mailtoUrl?: string;
    emlContent?: string;
  } | null>(null);

  const highlightedShare = useMemo(() => {
    if (!activeShareToken) return null;
    return (
      sharedItems.find(
        (s) => s.shareToken.toLowerCase() === activeShareToken.toLowerCase() || s.id === activeShareToken
      ) || null
    );
  }, [activeShareToken, sharedItems]);

  const filteredShares = useMemo(() => {
    return sharedItems.filter((item) => {
      if (scopeFilter === 'inbox') {
        const isRecipient =
          item.recipientEmails.some((e) => e.toLowerCase() === currentUser.email.toLowerCase()) ||
          item.recipientRoles.includes(currentUser.role);
        if (!isRecipient) return false;
      } else if (scopeFilter === 'sent') {
        if (item.sharedByEmail.toLowerCase() !== currentUser.email.toLowerCase()) return false;
      }
      if (statusFilter !== 'All' && item.workflowStatus !== statusFilter) return false;
      return true;
    });
  }, [sharedItems, scopeFilter, statusFilter, currentUser.email, currentUser.role]);

  const openAnnotationsCount = useMemo(
    () => annotations.filter((a) => a.status === 'Open').length,
    [annotations]
  );

  const pendingReviewsCount = useMemo(
    () => sharedItems.filter((s) => s.workflowStatus === 'In Review' || s.workflowStatus === 'Changes Requested').length,
    [sharedItems]
  );

  const filteredAnnotations = useMemo(() => {
    return annotations.filter((a) => {
      if (annFilter === 'Open') return a.status === 'Open';
      if (annFilter === 'Resolved') return a.status === 'Resolved';
      if (annFilter === 'Mentions') {
        return a.mentions.some((m) => m.toLowerCase() === currentUser.email.toLowerCase());
      }
      return true;
    });
  }, [annotations, annFilter, currentUser.email]);

  const buildShareLink = (token: string) => {
    if (typeof window === 'undefined') return `/?share=${token}`;
    return `${window.location.origin}/?share=${encodeURIComponent(token)}`;
  };

  const handleCopyShareLink = async (item: SharedBriefItem) => {
    const url = buildShareLink(item.shareToken);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  };

  const resolveAnnotationTargetTitle = (type: CollaborationTargetType, id: string) => {
    if (type === 'Report') {
      return reports.find((r) => r.id === id)?.title || id;
    }
    if (type === 'Dashboard') return 'Executive Consolidated BI Dashboard';
    if (type === 'DataMining') return 'Algorithmic Data Mining & OLS Forecasting Suite';
    return id;
  };

  const handlePostAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annBody.trim()) return;
    setIsPostingAnn(true);
    try {
      await addAnnotation({
        targetType: annTargetType,
        targetId: annTargetId,
        targetTitle: resolveAnnotationTargetTitle(annTargetType, annTargetId),
        sectionTag: annSectionTag,
        body: annBody,
      });
      setAnnBody('');
    } finally {
      setIsPostingAnn(false);
    }
  };

  const handleAppendMention = (email: string) => {
    setAnnBody((prev) => {
      const prefix = prev && !prev.endsWith(' ') ? `${prev} ` : prev;
      return `${prefix}@${email} `;
    });
  };

  const handleSendStandaloneEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const allRecipients = Array.from(
      new Set([
        ...emailSelectedUsers,
        ...emailExternalInput
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter((s) => s.includes('@')),
      ])
    );
    if (allRecipients.length === 0 || !emailSubject.trim() || !emailBody.trim()) return;

    setIsSendingEmail(true);
    setEmailDispatchBanner(null);
    try {
      const res = await sendEmailBrief({
        targetType: emailTargetType,
        targetId: `${emailTargetType.toLowerCase()}-${selectedEditionId}`,
        subject: emailSubject.trim(),
        recipients: allRecipients,
        body: emailBody.trim(),
        shareUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      if (res.ok && res.dispatch) {
        setEmailDispatchBanner({
          message: `Dispatched "${res.dispatch.subject}" to ${res.dispatch.recipients.join(', ')} (${res.dispatch.status}).`,
          mailtoUrl: res.mailtoUrl,
          emlContent: res.emlContent,
        });
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  const downloadEml = (content: string, filename = 'ZITF_BI_Dispatch.eml') => {
    const blob = new Blob([content], { type: 'message/rfc822;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const openQuickShare = (mode: 'share' | 'email') => {
    setShareModalInitMode(mode);
    setShareTargetType(reports[0] ? 'Report' : 'Dashboard');
    setShareTargetId(reports[0]?.id || 'exec-dashboard');
    setShareTargetTitle(reports[0]?.title || 'Executive Consolidated BI Brief');
    setIsShareModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Share &amp; Collaborate Hub
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
              {currentUser.name} · {currentUser.role}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Server-persisted in-app sharing, approval &amp; sign-off workflows, section-pinned annotations with @mentions, and email brief dispatch.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => openQuickShare('email')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
          >
            <Mail className="w-4 h-4 text-slate-600" />
            <span>Email BI Brief</span>
          </button>
          <button
            onClick={() => openQuickShare('share')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-amber-400" />
            <span>Share Report / Dashboard</span>
          </button>
        </div>
      </div>

      {/* Deep-Link Share Banner if opened via ?share=TOKEN */}
      {highlightedShare && (
        <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 shadow-xs space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-700" />
              <span className="font-bold text-slate-900">
                Opened Shared Permalink: {highlightedShare.shareToken}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  WORKFLOW_BADGE_MAP[highlightedShare.workflowStatus]
                }`}
              >
                {highlightedShare.workflowStatus}
              </span>
            </div>
            {onClearShareToken && (
              <button
                onClick={onClearShareToken}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Dismiss Link Banner
              </button>
            )}
          </div>
          <div className="font-semibold text-slate-900">{highlightedShare.title}</div>
          <p className="text-slate-700">
            Shared by <strong>{highlightedShare.sharedByName}</strong> ({highlightedShare.sharedByRole}) · Access:{' '}
            <strong>{highlightedShare.accessLevel}</strong>
            {highlightedShare.note ? ` — "${highlightedShare.note}"` : ''}
          </p>
        </div>
      )}

      {/* Summary Telemetry Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-slate-500 font-semibold">Active Shared Links &amp; Reviews</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{sharedItems.length}</div>
            <div className="text-[11px] text-amber-700 font-medium mt-0.5">
              {pendingReviewsCount} awaiting review / changes
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
            <Share2 className="w-5 h-5 text-amber-700" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-slate-500 font-semibold">Open Discussion Annotations</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{openAnnotationsCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {annotations.length} total pinned comments across pillars
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-700" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-slate-500 font-semibold">Dispatched Email Briefs</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{emailDispatches.length}</div>
            <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
              RFC MIME &amp; Webhook Relay logged in SQLite
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <Mail className="w-5 h-5 text-emerald-700" />
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('workflows')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'workflows'
              ? 'border-amber-600 text-slate-900 bg-amber-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Share2 className="w-4 h-4 text-amber-600" />
          <span>Shared Briefs &amp; Approval Workflows ({sharedItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('annotations')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'annotations'
              ? 'border-amber-600 text-slate-900 bg-amber-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-amber-600" />
          <span>Comments &amp; Annotations ({openAnnotationsCount} Open)</span>
        </button>

        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'email'
              ? 'border-amber-600 text-slate-900 bg-amber-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Mail className="w-4 h-4 text-amber-600" />
          <span>Email Dispatch &amp; Logs ({emailDispatches.length})</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: SHARED BRIEFS & COLLABORATIVE APPROVAL WORKFLOWS   */}
      {/* ========================================================= */}
      {activeTab === 'workflows' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'all', label: 'All Shares' },
                  { id: 'inbox', label: 'Shared With Me' },
                  { id: 'sent', label: 'Shared By Me' },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setScopeFilter(s.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                    scopeFilter === s.id
                      ? 'bg-slate-900 text-amber-400'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(['All', 'Shared', 'In Review', 'Changes Requested', 'Approved'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    statusFilter === st
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {filteredShares.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
              No shared briefs match the active filters. Click &quot;Share Report / Dashboard&quot; above to initiate a collaborative review.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredShares.map((item) => {
                const relatedComments = annotations.filter(
                  (a) => a.targetType === item.targetType && a.targetId === item.targetId
                );
                const isHighlighted = highlightedShare?.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl border p-4 shadow-2xs text-xs space-y-3 ${
                      isHighlighted ? 'border-amber-500 ring-2 ring-amber-400/30' : 'border-slate-200/90'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
                            {item.shareToken}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {item.targetType}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              WORKFLOW_BADGE_MAP[item.workflowStatus]
                            }`}
                          >
                            {item.workflowStatus}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-600">
                            {item.accessLevel}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                        <div className="text-[11px] text-slate-500">
                          Shared by <strong className="text-slate-700">{item.sharedByName}</strong> ({item.sharedByRole}) on{' '}
                          {item.createdAt.replace('T', ' ').substring(0, 16)} · Recipients:{' '}
                          <span className="text-slate-700 font-medium">
                            {item.recipientEmails.join(', ') || item.recipientRoles.join(', ')}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => onNavigate(TARGET_ROUTE_MAP[item.targetType] || 'overview')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
                        >
                          <span>Open Module</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopyShareLink(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5 text-amber-600" />
                          <span>{copiedId === item.id ? 'Copied Link!' : 'Copy Link'}</span>
                        </button>
                        <button
                          onClick={() => deleteSharedItem(item.id)}
                          title="Revoke share link"
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {item.note && (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700 leading-relaxed">
                        <span className="font-bold text-slate-900">Collaboration Note: </span>
                        {item.note}
                      </div>
                    )}

                    {item.snapshotSummary && (
                      <div className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-200/60 text-[11px] font-mono text-amber-950">
                        {item.snapshotSummary}
                      </div>
                    )}

                    {/* Workflow Transition Bar */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                          <span>{relatedComments.length} linked annotation(s)</span>
                        </span>
                        {item.approvedBy && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              Signed off by {item.approvedBy} ({item.approvedAt})
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.workflowStatus !== 'In Review' && item.workflowStatus !== 'Approved' && (
                          <button
                            onClick={() => transitionShareWorkflow(item.id, 'In Review')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold cursor-pointer"
                          >
                            <Clock className="w-3 h-3" />
                            <span>Start Review</span>
                          </button>
                        )}
                        {item.workflowStatus !== 'Changes Requested' && item.workflowStatus !== 'Approved' && (
                          <button
                            onClick={() => transitionShareWorkflow(item.id, 'Changes Requested')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold cursor-pointer"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span>Request Changes</span>
                          </button>
                        )}
                        {item.workflowStatus !== 'Approved' ? (
                          <button
                            onClick={() => transitionShareWorkflow(item.id, 'Approved')}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>Approve &amp; Sign-Off</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => transitionShareWorkflow(item.id, 'In Review')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Re-open Review</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: SECTION-PINNED COMMENTS & ANNOTATIONS              */}
      {/* ========================================================= */}
      {activeTab === 'annotations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 text-xs">
          {/* Left: Composer */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-3 h-fit">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <Plus className="w-4 h-4 text-amber-600" />
              <span>Post Section Annotation</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Pin feedback to a report, forecast, or pillar section and notify teammates with @email mentions.
            </p>

            <form onSubmit={handlePostAnnotation} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Module</label>
                <select
                  value={annTargetType}
                  onChange={(e) => {
                    const nextType = e.target.value as CollaborationTargetType;
                    setAnnTargetType(nextType);
                    if (nextType === 'Report' && reports[0]) {
                      setAnnTargetId(reports[0].id);
                    } else {
                      setAnnTargetId(`${nextType.toLowerCase()}-${selectedEditionId}`);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                >
                  <option value="Report">BI Report Brief</option>
                  <option value="Dashboard">Executive Dashboard</option>
                  <option value="DataMining">Data Mining &amp; OLS Forecast</option>
                  <option value="TradeDeal">Trade Impact Deal</option>
                  <option value="Incident">Operational Incident</option>
                  <option value="MarketInsight">Strategic Market Insight</option>
                </select>
              </div>

              {annTargetType === 'Report' && reports.length > 0 && (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Specific Report</label>
                  <select
                    value={annTargetId}
                    onChange={(e) => setAnnTargetId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                  >
                    {reports.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.reportNumber} — {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Pinned Section Tag</label>
                <select
                  value={annSectionTag}
                  onChange={(e) => setAnnSectionTag(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                >
                  <option value="Executive Summary">Executive Summary</option>
                  <option value="KPI Snapshot">KPI Snapshot</option>
                  <option value="Recommendations">Recommendations</option>
                  <option value="Forecast Confidence">Forecast Confidence &amp; OLS</option>
                  <option value="Outlier Review">MAD Statistical Outliers</option>
                  <option value="Trade Verification">Trade Deal Verification</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Annotation Comment *</label>
                <textarea
                  rows={4}
                  required
                  value={annBody}
                  onChange={(e) => setAnnBody(e.target.value)}
                  placeholder="Write review notes... Use @email to tag colleagues (e.g. @s.nkomo@zitf.co.zw)."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                  <AtSign className="w-3 h-3" />
                  <span>Quick @Mention Staff</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {users
                    .filter((u) => u.isActive && u.email !== currentUser.email)
                    .map((u) => (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => handleAppendMention(u.email)}
                        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 font-mono text-[10px] cursor-pointer"
                      >
                        @{u.name.split(' ')[0].toLowerCase()}
                      </button>
                    ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isPostingAnn}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-amber-400" />
                <span>{isPostingAnn ? 'Posting...' : 'Post Pinned Annotation'}</span>
              </button>
            </form>
          </div>

          {/* Right: Annotation Thread Feed */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Collaboration Annotations ({filteredAnnotations.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Audit-logged feedback threads across reports, mining forecasts, and trade records
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'All', label: 'All' },
                    { id: 'Open', label: 'Open' },
                    { id: 'Resolved', label: 'Resolved' },
                    { id: 'Mentions', label: '@Mentions Me' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setAnnFilter(f.id)}
                    className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                      annFilter === f.id
                        ? 'bg-slate-900 text-amber-400'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredAnnotations.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                No annotations match &quot;{annFilter}&quot;.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredAnnotations.map((ann: AnnotationComment) => (
                  <div key={ann.id} className="p-4 space-y-2 hover:bg-slate-50/50">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">{ann.authorName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                            {ann.authorRole}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                            {ann.sectionTag}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              ann.status === 'Resolved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {ann.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-slate-400" />
                          <span>
                            {ann.targetType}: <strong>{ann.targetTitle}</strong> · {ann.createdAt}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() =>
                            toggleAnnotationStatus(ann.id, ann.status === 'Open' ? 'Resolved' : 'Open')
                          }
                          className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                            ann.status === 'Open'
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {ann.status === 'Open' ? 'Resolve' : 'Re-open'}
                        </button>
                        <button
                          onClick={() => deleteAnnotation(ann.id)}
                          title="Delete annotation"
                          className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                      {ann.body}
                    </p>

                    {(ann.mentions.length > 0 || ann.resolvedBy) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        {ann.mentions.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap text-amber-800 font-mono">
                            <AtSign className="w-3 h-3" />
                            <span>Mentioned: {ann.mentions.join(', ')}</span>
                          </div>
                        ) : (
                          <span />
                        )}
                        {ann.resolvedBy && (
                          <span className="text-emerald-700 font-medium">
                            Resolved by {ann.resolvedBy} ({ann.resolvedAt})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: EMAIL BRIEF DISPATCH & DISTRIBUTION AUDIT LOG      */}
      {/* ========================================================= */}
      {activeTab === 'email' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 text-xs">
          {/* Left: Composer */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-3 h-fit">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <Mail className="w-4 h-4 text-amber-600" />
              <span>Compose &amp; Dispatch Email Brief</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Persists MIME dispatch receipt in SQLite, relays via Webhook (`EMAIL_WEBHOOK_URL`) when configured, and generates one-click `mailto:` &amp; `.eml` downloads.
            </p>

            {emailDispatchBanner && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Email Dispatch Logged</span>
                </div>
                <p>{emailDispatchBanner.message}</p>
                <div className="flex flex-wrap gap-2">
                  {emailDispatchBanner.mailtoUrl && (
                    <a
                      href={emailDispatchBanner.mailtoUrl}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 text-white font-bold"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open Mail Client</span>
                    </a>
                  )}
                  {emailDispatchBanner.emlContent && (
                    <button
                      type="button"
                      onClick={() => downloadEml(emailDispatchBanner.emlContent!)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-emerald-300 text-slate-800 font-bold cursor-pointer"
                    >
                      <Download className="w-3 h-3 text-emerald-700" />
                      <span>Download .eml</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSendStandaloneEmail} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">ZITF Staff Recipients</label>
                <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto p-2 rounded-lg bg-slate-50 border border-slate-200">
                  {users
                    .filter((u) => u.isActive)
                    .map((u) => {
                      const checked = emailSelectedUsers.includes(u.email);
                      return (
                        <label key={u.id} className="flex items-center gap-2 cursor-pointer text-[11px]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setEmailSelectedUsers((prev) =>
                                prev.includes(u.email)
                                  ? prev.filter((e) => e !== u.email)
                                  : [...prev, u.email]
                              )
                            }
                          />
                          <span className="font-semibold text-slate-800">{u.name}</span>
                          <span className="text-slate-400 truncate">({u.email})</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">External Recipients (comma-separated)</label>
                <input
                  type="text"
                  value={emailExternalInput}
                  onChange={(e) => setEmailExternalInput(e.target.value)}
                  placeholder="board@zitf.co.zw, delegate@zimtrade.co.zw"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Briefing Subject *</label>
                <input
                  type="text"
                  required
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Pillar Context</label>
                <select
                  value={emailTargetType}
                  onChange={(e) => setEmailTargetType(e.target.value as CollaborationTargetType)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer"
                >
                  <option value="Dashboard">Executive Dashboard Snapshot</option>
                  <option value="Report">BI Report Brief</option>
                  <option value="DataMining">Data Mining &amp; OLS Forecast</option>
                  <option value="TradeDeal">Trade Impact Summary</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email Body *</label>
                <textarea
                  rows={5}
                  required
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-[11px]"
                />
              </div>

              <button
                type="submit"
                disabled={isSendingEmail}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-amber-400" />
                <span>{isSendingEmail ? 'Dispatching...' : 'Dispatch Email & Save MIME Receipt'}</span>
              </button>
            </form>
          </div>

          {/* Right: Dispatch Log */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-900">
                Email Dispatch &amp; Distribution Ledger ({emailDispatches.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Immutable audit history of all report emails, executive flashes, and shared brief notifications
              </p>
            </div>

            {emailDispatches.length === 0 ? (
              <div className="p-10 text-center text-slate-500">No email dispatches recorded yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {emailDispatches.map((d) => (
                  <div key={d.id} className="p-4 space-y-2 hover:bg-slate-50/50">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">{d.subject}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              d.status === 'Dispatched'
                                ? 'bg-emerald-100 text-emerald-800'
                                : d.status === 'Queued (MIME Ready)'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {d.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          To: <strong className="text-slate-700">{d.recipients.join(', ')}</strong> · Sent by{' '}
                          {d.senderName} ({d.deliveryMode})
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">{d.dispatchedAt}</span>
                    </div>

                    <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 line-clamp-3">
                      {d.bodyPreview}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share & Email Modal */}
      <ShareCollaborateModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        initialMode={shareModalInitMode}
        targetType={shareTargetType}
        targetId={shareTargetId}
        targetTitle={shareTargetTitle}
        editionId={selectedEditionId === 'all' ? 'zitf-2026' : selectedEditionId}
        snapshotSummary={`Exhibitors: ${executiveMetrics.totalExhibitors} | Visitors: ${executiveMetrics.totalVisitors.toLocaleString()} | Revenue: $${executiveMetrics.totalRevenueUsd.toLocaleString()} USD | Verified Deals: $${executiveMetrics.verifiedDealsUsd.toLocaleString()} USD`}
      />
    </div>
  );
};
