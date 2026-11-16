import React, { useEffect, useState } from 'react';
import { useBI } from '../../context/BIContext';
import { CollaborationTargetType, SharedBriefItem, UserRole } from '../../types';
import {
  Share2,
  Mail,
  X,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';

interface ShareCollaborateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'share' | 'email';
  targetType: CollaborationTargetType;
  targetId: string;
  targetTitle: string;
  editionId?: string;
  snapshotSummary?: string;
  onSuccessNavigateToCollab?: () => void;
}

export const ShareCollaborateModal: React.FC<ShareCollaborateModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'share',
  targetType,
  targetId,
  targetTitle,
  editionId,
  snapshotSummary = '',
  onSuccessNavigateToCollab,
}) => {
  const { users, currentUser, shareBrief, sendEmailBrief } = useBI();

  const [mode, setMode] = useState<'share' | 'email'>(initialMode);
  const [selectedUserEmails, setSelectedUserEmails] = useState<string[]>([]);
  const [externalEmailsInput, setExternalEmailsInput] = useState<string>('');
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(['Executive Management']);
  const [accessLevel, setAccessLevel] = useState<SharedBriefItem['accessLevel']>('Approve / Sign-Off');
  const [note, setNote] = useState<string>('');
  const [alsoSendEmail, setAlsoSendEmail] = useState<boolean>(true);

  const [emailSubject, setEmailSubject] = useState<string>(`[ZITF BI] ${targetType}: ${targetTitle}`);
  const [emailBody, setEmailBody] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultInfo, setResultInfo] = useState<{
    message: string;
    shareUrl?: string;
    shareToken?: string;
    mailtoUrl?: string;
    emlContent?: string;
  } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setResultInfo(null);
      setErrorMsg(null);
      setCopiedUrl(false);
      setEmailSubject(`[ZITF BI] ${targetType}: ${targetTitle}`);
      setEmailBody(
        [
          `Dear Colleague,`,
          ``,
          `Please find the ZITF Business Intelligence brief for your review:`,
          `Document: ${targetTitle}`,
          `Module: ${targetType} (${targetId})`,
          snapshotSummary ? `\nKey Live Metrics Snapshot:\n${snapshotSummary}` : '',
          ``,
          `Prepared by ${currentUser.name} (${currentUser.role})`,
        ]
          .filter((l) => l !== '')
          .join('\n')
      );
      const defaultRecipients = users
        .filter((u) => u.isActive && u.email !== currentUser.email)
        .slice(0, 2)
        .map((u) => u.email);
      setSelectedUserEmails(defaultRecipients);
    }
  }, [isOpen, initialMode, targetType, targetId, targetTitle, snapshotSummary, currentUser.email, currentUser.name, currentUser.role, users]);

  if (!isOpen) return null;

  const combinedRecipients = Array.from(
    new Set([
      ...selectedUserEmails,
      ...externalEmailsInput
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter((s) => s.includes('@')),
    ])
  );

  const toggleRecipient = (email: string) => {
    setSelectedUserEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const toggleRole = (role: UserRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      setCopiedUrl(false);
    }
  };

  const handleDownloadEml = (emlContent: string) => {
    const blob = new Blob([emlContent], { type: 'message/rfc822;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZITF_BI_${targetId.replace(/[^a-zA-Z0-9_-]/g, '_')}.eml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (combinedRecipients.length === 0 && selectedRoles.length === 0) {
      setErrorMsg('Select at least one recipient email or target role.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await shareBrief({
        targetType,
        targetId,
        title: targetTitle,
        editionId,
        recipientEmails: combinedRecipients,
        recipientRoles: selectedRoles,
        accessLevel,
        note: note.trim(),
        snapshotSummary: snapshotSummary || undefined,
        sendEmail: alsoSendEmail && combinedRecipients.length > 0,
      });

      if (!res.ok || !res.sharedItem) {
        setErrorMsg(res.error || 'Failed to share item.');
        return;
      }

      setResultInfo({
        message:
          alsoSendEmail && res.emailResult
            ? `Shared in-app (${res.sharedItem.shareToken}) and logged email dispatch to ${combinedRecipients.length} recipient(s).`
            : `Shared in-app with workflow status "${res.sharedItem.workflowStatus}" (${res.sharedItem.shareToken}).`,
        shareUrl: res.shareUrl,
        shareToken: res.sharedItem.shareToken,
        mailtoUrl: res.emailResult?.mailtoUrl,
        emlContent: res.emailResult?.emlContent,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (combinedRecipients.length === 0) {
      setErrorMsg('Enter or select at least one recipient email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const shareRes = await shareBrief({
        targetType,
        targetId,
        title: targetTitle,
        editionId,
        recipientEmails: combinedRecipients,
        recipientRoles: [],
        accessLevel: 'Comment & Annotate',
        note: `Email brief dispatched: ${emailSubject}`,
        snapshotSummary: snapshotSummary || undefined,
        sendEmail: false,
      });

      const emailRes = await sendEmailBrief({
        targetType,
        targetId,
        subject: emailSubject,
        recipients: combinedRecipients,
        body: emailBody,
        shareUrl: shareRes.shareUrl,
      });

      if (!emailRes.ok || !emailRes.dispatch) {
        setErrorMsg(emailRes.error || 'Failed to dispatch email brief.');
        return;
      }

      setResultInfo({
        message: `Email brief "${emailRes.dispatch.subject}" recorded (${emailRes.dispatch.status}) for ${combinedRecipients.join(', ')}.`,
        shareUrl: shareRes.shareUrl,
        shareToken: shareRes.sharedItem?.shareToken,
        mailtoUrl: emailRes.mailtoUrl,
        emlContent: emailRes.emlContent,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const allRoles: UserRole[] = [
    'Executive Management',
    'Department Manager',
    'Data Analyst',
    'Super Administrator',
    'External Stakeholder / Viewer',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 no-print">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden text-xs max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              {mode === 'share' ? (
                <Share2 className="w-4 h-4 text-amber-400" />
              ) : (
                <Mail className="w-4 h-4 text-amber-400" />
              )}
              <span className="text-sm font-bold">
                {mode === 'share' ? 'Share & Route Collaborative Review' : 'Email Intelligence Brief'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-md">
              {targetType}: {targetTitle}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="px-5 pt-3 border-b border-slate-200 flex items-center gap-2 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMode('share');
              setResultInfo(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 font-bold border-b-2 cursor-pointer ${
              mode === 'share'
                ? 'border-amber-600 text-slate-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-amber-600" />
            <span>In-App Share &amp; Approval Workflow</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('email');
              setResultInfo(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 font-bold border-b-2 cursor-pointer ${
              mode === 'email'
                ? 'border-amber-600 text-slate-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-amber-600" />
            <span>Email Dispatch &amp; .eml Export</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-medium">
              {errorMsg}
            </div>
          )}

          {resultInfo ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Collaboration Dispatch Confirmed</span>
                </div>
                <p className="text-xs leading-relaxed">{resultInfo.message}</p>

                {resultInfo.shareUrl && (
                  <div className="pt-2">
                    <label className="block text-[10px] font-bold uppercase text-emerald-800 mb-1">
                      Direct ZITF BI Permalink ({resultInfo.shareToken})
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={resultInfo.shareUrl}
                        className="flex-1 bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyLink(resultInfo.shareUrl!)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-amber-400" />
                        <span>{copiedUrl ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {(resultInfo.emlContent || resultInfo.mailtoUrl) && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    {resultInfo.mailtoUrl && (
                      <a
                        href={resultInfo.mailtoUrl}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open in Email Client (mailto:)</span>
                      </a>
                    )}
                    {resultInfo.emlContent && (
                      <button
                        type="button"
                        onClick={() => handleDownloadEml(resultInfo.emlContent!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-emerald-300 font-bold cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Download RFC .eml Message</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                {onSuccessNavigateToCollab && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSuccessNavigateToCollab();
                    }}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
                  >
                    Open Share &amp; Collaborate Hub
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={mode === 'share' ? handleShareSubmit : handleEmailSubmit} className="space-y-4">
              {/* Select Registered ZITF Users */}
              <div>
                <label className="font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-600" />
                  <span>Select ZITF Recipients</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2 rounded-lg bg-slate-50 border border-slate-200">
                  {users
                    .filter((u) => u.isActive)
                    .map((u) => {
                      const checked = selectedUserEmails.includes(u.email);
                      return (
                        <label
                          key={u.id}
                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer border ${
                            checked
                              ? 'bg-amber-50 border-amber-300 text-slate-900'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRecipient(u.email)}
                          />
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{u.name}</div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {u.role} · {u.email}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Additional External Emails */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Additional Recipient Email(s) (comma-separated)
                </label>
                <input
                  type="text"
                  value={externalEmailsInput}
                  onChange={(e) => setExternalEmailsInput(e.target.value)}
                  placeholder="board@zitf.co.zw, min.industry@gov.zw"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              {mode === 'share' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Access &amp; Workflow Action</label>
                      <select
                        value={accessLevel}
                        onChange={(e) => setAccessLevel(e.target.value as SharedBriefItem['accessLevel'])}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium cursor-pointer"
                      >
                        <option value="Approve / Sign-Off">Approve / Sign-Off (Starts In Review)</option>
                        <option value="Comment & Annotate">Comment &amp; Annotate</option>
                        <option value="View Only">View Only Snapshot</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                        <span>Target Role Visibility</span>
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {allRoles.map((r) => {
                          const active = selectedRoles.includes(r);
                          return (
                            <button
                              type="button"
                              key={r}
                              onClick={() => toggleRole(r)}
                              className={`px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer ${
                                active
                                  ? 'bg-slate-900 text-amber-400 border-slate-900'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {r.split(' ')[0]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Collaboration / Review Note</label>
                    <textarea
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add context, review questions, or @email mentions for recipients..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-semibold">
                    <input
                      type="checkbox"
                      checked={alsoSendEmail}
                      onChange={(e) => setAlsoSendEmail(e.target.checked)}
                    />
                    <span>Also dispatch email notification &amp; generate RFC .eml brief to selected recipients</span>
                  </label>
                </>
              ) : (
                <>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Email Subject *</label>
                    <input
                      type="text"
                      required
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Briefing Body *</label>
                    <textarea
                      rows={6}
                      required
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-[11px]"
                    />
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {isSubmitting
                      ? 'Processing...'
                      : mode === 'share'
                      ? 'Create Share & Dispatch'
                      : 'Dispatch Email Brief'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
