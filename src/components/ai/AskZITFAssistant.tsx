import React, { useState, useRef, useEffect } from 'react';
import { useBI } from '../../context/BIContext';
import { formatUsdCompact } from '../../utils/formatters';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Bot,
  User,
  HelpCircle,
  Copy,
  Check,
  ShieldCheck,
  Building,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source?: string;
  isRuleBased?: boolean;
  supportingData?: Record<string, any>;
}

export const AskZITFAssistant: React.FC = () => {
  const {
    isAIAssistantOpen,
    setIsAIAssistantOpen,
    selectedEditionId,
    editions,
    currentUser,
    executiveMetrics,
    filteredExhibitors,
    filteredTransactions,
    filteredTradeEngagements,
    authFetch,
  } = useBI();

  const currentEditionObj = editions.find((e) => e.id === selectedEditionId);
  const editionTitle = currentEditionObj ? currentEditionObj.name : 'All Editions';

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Greetings ${currentUser.name}. I am **Ask ZITF Intelligence**, your institutional Business Intelligence analyst connected to the centralized SQLite data warehouse.

I have direct contextual visibility into **${editionTitle}** covering:
- **${executiveMetrics.totalExhibitors.toLocaleString()} Exhibitors** (${executiveMetrics.internationalExhibitors} international from ${executiveMetrics.internationalCountriesCount} countries).
- **${executiveMetrics.totalVisitors.toLocaleString()} Visitors** (${executiveMetrics.businessVisitors.toLocaleString()} accredited business trade delegates).
- **${formatUsdCompact(executiveMetrics.totalRevenueUsd)} Commercial Invoiced Revenue** across exhibition space, sponsorships, and services.
- **${executiveMetrics.b2bMeetingsCount.toLocaleString()} Facilitated B2B Matchmaking Engagements** (${formatUsdCompact(executiveMetrics.verifiedDealsUsd)} independently verified deals).
- **${executiveMetrics.spaceOccupancyPct}% Exhibition Hall Space Utilization** with ${executiveMetrics.networkUptimePct}% network uptime.

You can ask me questions in natural language, or pick one of the recommended queries below.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'ZITF Trade Intelligence Engine',
      isRuleBased: true,
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sampleQuestions = [
    'How many exhibitors participated in the latest exhibition?',
    'Which sectors recorded the highest growth?',
    'Compare local and international exhibitors over the last three years.',
    'Which exhibition categories generated the highest revenue?',
    'What were the most common visitor interests?',
    'How many B2B meetings resulted in follow-up engagements?',
    'Which business opportunities are still open?',
    'What operational areas require management attention?',
    'Summarise the commercial performance of the last exhibition.',
    'Identify emerging industry trends from available ZITF data.',
  ];

  const handleSend = async (queryText?: string) => {
    const q = (queryText || inputPrompt).trim();
    if (!q || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      // Build lightweight context aligned with server.ts rule-based & Gemini prompts
      const contextPayload = {
        totalExhibitors: executiveMetrics.totalExhibitors,
        localExhibitors: executiveMetrics.localExhibitors,
        internationalExhibitors: executiveMetrics.internationalExhibitors,
        internationalCountriesCount: executiveMetrics.internationalCountriesCount,
        retentionRate: executiveMetrics.retentionRate,
        exhibitorSatisfaction: executiveMetrics.exhibitorSatisfaction,
        totalVisitors: executiveMetrics.totalVisitors,
        businessVisitors: executiveMetrics.businessVisitors,
        visitorSatisfaction: executiveMetrics.visitorSatisfaction,
        totalRevenueUsd: executiveMetrics.totalRevenueUsd,
        spaceSalesUsd: executiveMetrics.spaceSalesUsd,
        sponsorshipUsd: executiveMetrics.sponsorshipUsd,
        outstandingBalanceUsd: executiveMetrics.outstandingBalanceUsd,
        avgRevenuePerExhibitor: executiveMetrics.avgRevenuePerExhibitor,
        verifiedDealsUsd: executiveMetrics.verifiedDealsUsd,
        reportedDealsUsd: executiveMetrics.reportedDealsUsd,
        b2bMeetingsCount: executiveMetrics.b2bMeetingsCount,
        facilitatedOppsCount: executiveMetrics.facilitatedOppsCount,
        spaceOccupancyPct: executiveMetrics.spaceOccupancyPct,
        networkUptimePct: executiveMetrics.networkUptimePct,
        openIncidentsCount: executiveMetrics.openIncidentsCount,
        topExhibitorsSample: filteredExhibitors.slice(0, 5).map((e) => ({
          name: e.companyName,
          sector: e.sector,
          country: e.country,
          stand: e.hallStand,
        })),
        recentDealsSample: filteredTradeEngagements.slice(0, 4).map((t) => ({
          buyer: t.buyerOrg,
          supplier: t.supplierOrg,
          valueUsd: t.estimatedValueUsd,
          status: t.engagementStatus,
          verified: t.verificationStatus,
        })),
        revenueDistribution: filteredTransactions.slice(0, 5).map((tx) => ({
          client: tx.clientName,
          type: tx.type,
          amount: tx.amountUsd,
        })),
      };

      const res = await authFetch('/api/gemini/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: q,
          context: contextPayload,
          edition: editionTitle,
          userRole: currentUser.role,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: data.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: data.source || 'ZITF Intelligence Engine',
        isRuleBased: data.isRuleBased,
        supportingData: data.supportingData,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Error querying ZITF intelligence:', err);
      // Client-side fallback derived strictly from live warehouse metrics
      const fallbackMsg: ChatMessage = {
        id: `asst-err-${Date.now()}`,
        sender: 'assistant',
        text: `### Query Result for: "${q}"\n\nBased on live SQLite warehouse records for **${editionTitle}**:\n- **Exhibitors:** ${executiveMetrics.totalExhibitors} registered companies (${executiveMetrics.internationalPct}% international from ${executiveMetrics.internationalCountriesCount} nations).\n- **Total Revenue:** ${formatUsdCompact(executiveMetrics.totalRevenueUsd)} USD across space bookings, sponsorships, and commercial services.\n- **Trade Impact:** ${executiveMetrics.b2bMeetingsCount} B2B matchmaking meetings logged; ${formatUsdCompact(executiveMetrics.verifiedDealsUsd)} independently verified deals concluded.\n- **Operational Status:** ${executiveMetrics.spaceOccupancyPct}% hall space occupancy with ${executiveMetrics.networkUptimePct}% network reliability.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'ZITF Local Warehouse Fallback',
        isRuleBased: true,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isAIAssistantOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-700/80 h-full flex flex-col shadow-2xl text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-100">Ask ZITF Intelligence</span>
                <span className="text-[10px] font-mono uppercase bg-amber-950 text-amber-400 border border-amber-800/80 px-1.5 py-0.2 rounded">
                  Gemini Ready
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Building className="w-3 h-3 text-slate-500" />
                <span>Context: {editionTitle}</span>
                <span aria-hidden="true">·</span>
                <ShieldCheck className="w-3 h-3 text-slate-500" />
                <span>{currentUser.role}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAIAssistantOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-7 h-7 rounded-md bg-amber-600/30 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[88%] rounded-xl p-3.5 leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-amber-600 text-slate-950 font-medium'
                    : 'bg-slate-800/90 border border-slate-700/80 text-slate-200 shadow-sm'
                }`}
              >
                {/* Content */}
                <div className="prose prose-invert prose-xs max-w-none whitespace-pre-line">
                  {msg.text}
                </div>

                {/* Metadata footer for assistant */}
                {msg.sender === 'assistant' && (
                  <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400">{msg.source}</span>
                      <span aria-hidden="true">·</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(msg.text, msg.id)}
                      className="flex items-center gap-1 text-slate-400 hover:text-amber-400 cursor-pointer"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-md bg-slate-700 flex items-center justify-center text-slate-200 shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 items-center text-slate-400 text-xs py-2">
              <div className="w-7 h-7 rounded-md bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 px-3 py-2 rounded-lg">
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>Analyzing ZITF trade records and computing metrics...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Suggested Queries Pill Strip */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            <HelpCircle className="w-3 h-3 text-amber-400" />
            <span>Recommended Strategic Questions</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
            {sampleQuestions.slice(0, 5).map((q, idx) => (
              <button
                key={idx}
                disabled={isLoading}
                onClick={() => handleSend(q)}
                className="whitespace-nowrap shrink-0 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-amber-300 border border-slate-700/80 transition-colors cursor-pointer text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ask anything about ZITF exhibitors, revenue, B2B deals, visitors..."
              disabled={isLoading}
              className="flex-1 bg-slate-800 text-slate-100 text-xs px-3.5 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder:text-slate-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputPrompt.trim() || isLoading}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
            <span>Enterprise Trade Intelligence · Cites verified data records</span>
            <span>Confidential Internal Use Only</span>
          </div>
        </div>
      </div>
    </div>
  );
};
