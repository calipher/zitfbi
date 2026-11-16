import React from 'react';
import { useBI } from '../../context/BIContext';
import { Filter, Globe, Layers, MapPin, RotateCcw, Download, Map as MapIcon } from 'lucide-react';
import { GlobalParticipationMap } from './GlobalParticipationMap';

interface FilterBarProps {
  onExportCsv?: () => void;
  exportLabel?: string;
  totalFilteredCount?: number;
  totalLabel?: string;
  hideGlobalMap?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  onExportCsv,
  exportLabel = 'Export CSV',
  totalFilteredCount,
  totalLabel = 'Records',
  hideGlobalMap = false,
}) => {
  const {
    selectedSector,
    setSelectedSector,
    geographicFilter,
    setGeographicFilter,
    selectedCountry,
    setSelectedCountry,
    availableCountries,
    isGlobalMapOpen,
    setIsGlobalMapOpen,
    selectedPeriod,
    setSelectedPeriod,
    selectedEditionId,
    editions,
  } = useBI();

  const sectors = [
    'Mining & Natural Resources',
    'Agriculture & Food Processing',
    'Information & Digital Technologies',
    'Heavy Engineering & Logistics',
    'Energy & Power Infrastructure',
    'Financial Services',
    'Manufacturing',
    'Trade & Investment Facilitation',
    'Education & Innovation',
  ];

  const currentEdition = editions.find((e) => e.id === selectedEditionId);
  const isFiltered =
    selectedSector !== 'all' ||
    geographicFilter !== 'all' ||
    selectedCountry !== 'all' ||
    selectedPeriod !== 'all';

  const resetFilters = () => {
    setSelectedSector('all');
    setGeographicFilter('all');
    setSelectedCountry('all');
    setSelectedPeriod('all');
  };

  return (
    <div className="space-y-4 mb-5">
      <div className="bg-white rounded-md border border-slate-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-slate-500 font-semibold uppercase tracking-wider text-[11px] mr-1">
              <Filter className="w-3.5 h-3.5 text-slate-600" />
              <span>Filters:</span>
            </div>

            {/* Sector Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                aria-label="Sector Filter"
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer pr-1 max-w-[165px] truncate"
              >
                <option value="all">All Industry Sectors</option>
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Origin Scope Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                aria-label="Geographic Scope"
                value={geographicFilter}
                onChange={(e) => setGeographicFilter(e.target.value as any)}
                className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer pr-1"
              >
                <option value="all">All Origins (Local &amp; Int&apos;l)</option>
                <option value="local">Zimbabwe Local Enterprises</option>
                <option value="international">International Delegations</option>
              </select>
            </div>

            {/* Country Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#0d6efd] shrink-0" />
              <select
                aria-label="Country Filter"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer pr-1 max-w-[155px] truncate"
              >
                <option value="all">All Countries ({availableCountries.length})</option>
                {availableCountries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset button */}
            {isFiltered && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1 text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1.5 rounded font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Right Info, Global Map Toggle and Export */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {totalFilteredCount !== undefined && (
              <div className="text-slate-500 text-xs">
                <span className="font-bold text-slate-900 tabular-nums">{totalFilteredCount}</span>{' '}
                <span>{totalLabel}</span>
                <span className="text-slate-300 mx-1.5">|</span>
                <span className="text-slate-500">
                  {selectedCountry !== 'all' ? selectedCountry : currentEdition ? currentEdition.name : 'Historical'}
                </span>
              </div>
            )}

            {!hideGlobalMap && (
              <button
                type="button"
                onClick={() => setIsGlobalMapOpen(!isGlobalMapOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isGlobalMapOpen
                    ? 'bg-[#343a40] text-white border-[#343a40]'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>{isGlobalMapOpen ? 'Hide Global Map' : 'Global Map'}</span>
              </button>
            )}

            {onExportCsv && (
              <button
                type="button"
                onClick={onExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d6efd] hover:bg-blue-700 text-white rounded font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exportLabel}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Global Map Panel when active */}
      {!hideGlobalMap && isGlobalMapOpen && (
        <GlobalParticipationMap onClose={() => setIsGlobalMapOpen(false)} />
      )}
    </div>
  );
};
