import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Maximize2,
  X,
  Target,
  ArrowRight,
  Info,
  CheckCircle,
} from 'lucide-react';

export interface MetricCardBreakdownItem {
  label: string;
  value: string | number;
}

export interface MetricCardDeepDive {
  headline?: string;
  drivers?: string[];
  recommendation?: string;
  benchmark?: string;
  history?: { year: string; value: string | number; note?: string }[];
}

export interface MetricCardProps {
  title: string;
  value: string | number;
  previousValue?: string | number;
  changePct?: number;
  isPositiveGood?: boolean;
  unit?: string;
  subtitle?: string;
  icon?: React.ElementType;
  sparklineData?: number[];
  onClick?: () => void;
  // Rich Insights & Responsiveness Additions
  insight?: string;
  badge?: string;
  badgeVariant?: 'emerald' | 'amber' | 'blue' | 'purple' | 'slate';
  targetValue?: string | number;
  targetProgress?: number; // 0 to 100 percentage
  breakdown?: MetricCardBreakdownItem[];
  deepDive?: MetricCardDeepDive;
  category?: string;
  allowInspectModal?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  previousValue,
  changePct,
  isPositiveGood = true,
  unit,
  subtitle,
  icon: Icon,
  onClick,
  insight,
  badge,
  badgeVariant = 'slate',
  targetValue,
  targetProgress,
  breakdown,
  deepDive,
  category,
  allowInspectModal = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isUp = changePct !== undefined && changePct > 0;
  const isDown = changePct !== undefined && changePct < 0;
  const isNeutral = changePct === 0 || changePct === undefined;

  let trendColor = 'text-slate-600 bg-slate-100 border-slate-200';
  if (!isNeutral && changePct !== undefined) {
    const isGood = isPositiveGood ? isUp : isDown;
    trendColor = isGood
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : 'text-rose-700 bg-rose-50 border-rose-200';
  }

  const badgeStyles: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
    purple: 'bg-purple-50 text-purple-800 border-purple-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const hasExtraInsights = Boolean(insight || breakdown?.length || targetProgress !== undefined || deepDive);

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicking a sub-button, don't trigger parent card click
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    if (onClick) {
      onClick();
    } else if (hasExtraInsights) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className={`group bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs hover:shadow-md hover:border-amber-400/80 transition-all duration-200 flex flex-col justify-between relative ${
          onClick || hasExtraInsights ? 'cursor-pointer' : ''
        }`}
      >
        {/* Top Header: Category / Title & Actions */}
        <div>
          <div className="flex items-start justify-between gap-1.5 mb-1.5">
            <div className="min-w-0 flex-1">
              {category && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 truncate mb-0.5">
                  {category}
                </div>
              )}
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider truncate" title={title}>
                {title}
              </h3>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {badge && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border leading-none tracking-tight hidden sm:inline-block ${
                    badgeStyles[badgeVariant] || badgeStyles.slate
                  }`}
                >
                  {badge}
                </span>
              )}

              {Icon && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-100 group-hover:bg-amber-50 group-hover:text-amber-700 transition-colors flex items-center justify-center text-slate-600 shrink-0">
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              )}
            </div>
          </div>

          {/* Primary Value & Unit */}
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 tabular-nums">
              {value}
            </span>
            {unit && <span className="text-xs font-semibold text-slate-500">{unit}</span>}
          </div>

          {/* Trend & Previous comparison badge */}
          <div className="mt-2 flex items-center justify-between gap-1 text-[11px] flex-wrap">
            {changePct !== undefined ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold border tabular-nums text-[10px] sm:text-[11px] ${trendColor}`}
                >
                  {isUp && <TrendingUp className="w-3 h-3" />}
                  {isDown && <TrendingDown className="w-3 h-3" />}
                  {isNeutral && <Minus className="w-3 h-3" />}
                  <span>{Math.abs(changePct)}%</span>
                </span>
                {previousValue && (
                  <span className="text-slate-500 text-[10px] sm:text-[11px] truncate">
                    vs {previousValue}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-500 text-[11px] truncate font-medium">
                {subtitle || 'Nominal Benchmark'}
              </span>
            )}

            {/* Mobile Badge if not shown at top */}
            {badge && (
              <span
                className={`text-[9px] font-semibold px-1 py-0.5 rounded border leading-none sm:hidden ${
                  badgeStyles[badgeVariant] || badgeStyles.slate
                }`}
              >
                {badge}
              </span>
            )}
          </div>

          {/* Target Progress Bar (if provided) */}
          {targetProgress !== undefined && (
            <div className="mt-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                <span className="font-medium flex items-center gap-1">
                  <Target className="w-3 h-3 text-amber-600" />
                  <span>{targetValue ? `Target: ${targetValue}` : 'Attainment'}</span>
                </span>
                <span className="font-bold text-slate-800 tabular-nums">{targetProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    targetProgress >= 95
                      ? 'bg-emerald-500'
                      : targetProgress >= 80
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, targetProgress))}%` }}
                />
              </div>
            </div>
          )}

          {/* Micro Breakdown pills (if provided) */}
          {breakdown && breakdown.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 grid grid-cols-2 gap-1.5">
              {breakdown.map((item, i) => (
                <div
                  key={i}
                  className="bg-slate-50 border border-slate-150 rounded px-1.5 py-1 text-[10px] flex items-center justify-between"
                >
                  <span className="text-slate-500 font-medium truncate">{item.label}</span>
                  <span className="font-bold text-slate-800 tabular-nums ml-1 shrink-0">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* In-Card Insight Callout (visible or expanded) */}
          {insight && (
            <div
              className={`mt-2.5 pt-2 border-t border-slate-100 ${
                isExpanded ? 'block' : 'hidden sm:block'
              }`}
            >
              <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200/70 text-[11px] text-amber-900 leading-snug">
                <div className="flex items-start gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="line-clamp-2 hover:line-clamp-none transition-all">{insight}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card Footer: Toggle / Inspect Button */}
        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="truncate text-slate-400 text-[10px]">
            {subtitle ? subtitle : 'ZITF Intelligence Metric'}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Mobile Expand Toggle if hidden on mobile */}
            {insight && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 sm:hidden"
                aria-label="Toggle card insight"
              >
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Inspect Modal Trigger */}
            {allowInspectModal && (hasExtraInsights || deepDive) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-600 hover:text-amber-800 hover:bg-amber-100/70 transition-colors"
                title="Open deep-dive insights"
              >
                <Info className="w-3 h-3" />
                <span className="hidden sm:inline">Insights</span>
              </button>
            )}

            {onClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
                className="inline-flex items-center gap-0.5 text-slate-400 hover:text-amber-600 font-semibold text-[10px] ml-1"
                title="View full pillar details"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Deep-Dive Inspection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {Icon && (
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Metric Deep-Dive
                    </span>
                    {badge && (
                      <span className="text-[10px] font-semibold text-slate-300">
                        {badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1">{title}</h3>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              {/* Primary Value Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Current Recorded Value
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-0.5 tabular-nums">
                    {value} {unit && <span className="text-sm font-semibold text-slate-500">{unit}</span>}
                  </div>
                </div>

                {changePct !== undefined && (
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold text-xs ${trendColor}`}>
                      {isUp && <TrendingUp className="w-3.5 h-3.5" />}
                      {isDown && <TrendingDown className="w-3.5 h-3.5" />}
                      {isNeutral && <Minus className="w-3.5 h-3.5" />}
                      <span>{Math.abs(changePct)}% YoY</span>
                    </span>
                    {previousValue && (
                      <div className="text-[11px] text-slate-400 mt-1">Previous: {previousValue}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Contextual Analytical Insight */}
              {insight && (
                <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-4">
                  <div className="flex items-center gap-2 font-bold text-amber-900 text-xs mb-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Executive Strategic Assessment</span>
                  </div>
                  <p className="text-amber-950 text-xs leading-relaxed">{insight}</p>
                </div>
              )}

              {/* Progress & Target */}
              {targetProgress !== undefined && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Strategic Target Benchmark</span>
                    <span className="font-extrabold text-slate-900 tabular-nums">
                      {targetProgress}% Attained
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(5, targetProgress))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Baseline: {previousValue || 'Prior Cycle'}</span>
                    <span>Target: {targetValue || '100% Target'}</span>
                  </div>
                </div>
              )}

              {/* Sub-Segment Breakdown */}
              {breakdown && breakdown.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs">Segment Composition</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {breakdown.map((b, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                        <span className="text-[11px] text-slate-500 block truncate">{b.label}</span>
                        <span className="text-sm font-bold text-slate-900 block mt-0.5">{b.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3-Year Historical Trajectory (if available in deepDive) */}
              {deepDive?.history && deepDive.history.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs">3-Year Performance Trajectory</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {deepDive.history.map((h, idx) => (
                      <div key={idx} className="border border-slate-200 rounded-lg p-2 text-center bg-white">
                        <span className="text-[10px] font-semibold text-slate-400 block">{h.year}</span>
                        <span className="text-sm font-bold text-slate-900 block mt-0.5">{h.value}</span>
                        {h.note && <span className="text-[10px] text-slate-500 block truncate">{h.note}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Drivers */}
              {deepDive?.drivers && deepDive.drivers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs">Primary Catalysts &amp; Contributing Drivers</h4>
                  <ul className="space-y-1.5">
                    {deepDive.drivers.map((driver, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{driver}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Executive Recommendation */}
              {deepDive?.recommendation && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900">
                  <span className="font-bold block mb-1">Recommended Institutional Action</span>
                  <p className="leading-relaxed text-blue-950">{deepDive.recommendation}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Close View
              </button>

              {onClick && (
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    onClick();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <span>Explore Pillar Section</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
