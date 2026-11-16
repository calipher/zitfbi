import React from 'react';
import { useBI } from '../../context/BIContext';
import { Database, RefreshCw, Trash2, Info } from 'lucide-react';

export const DemoDataNotice: React.FC = () => {
  const { isDemoMode, clearDemoData, resetToDemoData } = useBI();

  if (!isDemoMode) {
    return (
      <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center justify-between text-xs text-emerald-800">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-semibold">PRODUCTION DATABASE ACTIVE:</span>
          <span>Zero synthetic records. Ready for official ZITF exhibition data.</span>
        </div>
        <button
          onClick={resetToDemoData}
          className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded font-medium transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Load Demo Dataset
        </button>
      </div>
    );
  }

  return (
    <aside aria-label="Demonstration Data Notice" className="bg-amber-50/90 border-b border-amber-200 px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
      <div className="flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span className="font-bold tracking-wide uppercase text-amber-800">Demonstration Data Active:</span>
        <span className="text-amber-800">
          Showing realistic synthetic exhibition metrics for stakeholder demonstration. All calculations reflect active edition filters.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={clearDemoData}
          title="Remove all synthetic demo records and start with empty database"
          className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-medium transition-colors cursor-pointer"
        >
          <Trash2 className="w-3 h-3 text-red-500" />
          Clear Demo Data
        </button>
        <button
          onClick={resetToDemoData}
          title="Restore full baseline demo dataset"
          className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Reset Demo Set
        </button>
      </div>
    </aside>
  );
};
