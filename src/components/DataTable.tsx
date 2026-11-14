import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft, 
  ChevronRight, 
  SlidersHorizontal, 
  Layers, 
  Calendar, 
  X,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  FileWarning,
  ShieldCheck,
  PackagePlus
} from 'lucide-react';
import { ColumnMapping, ReconciliationItem, ReconciliationStatus } from '../types/reconciliation';
import { exportReconciliationToExcel } from '../utils/reconciliation';

interface DataTableProps {
  items: ReconciliationItem[];
  currentFilter: ReconciliationStatus;
  onFilterChange: (status: ReconciliationStatus) => void;
  gstrMapping?: ColumnMapping | null;
  ewbMapping?: ColumnMapping | null;
  onOpenMapping?: () => void;
}

// Convert "DD-MM-YYYY" string into "YYYY-MM-DD" for comparison
function toIsoDate(dStr: string | null): string | null {
  if (!dStr) return null;
  const m = dStr.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (m) {
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return null;
}

// Highlight matching search text
function highlightMatch(text: string | null | undefined, query: string) {
  if (!text) return '-';
  if (!query.trim()) return text;

  const trimmed = query.trim();
  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text;

  const before = text.substring(0, index);
  const match = text.substring(index, index + trimmed.length);
  const after = text.substring(index + trimmed.length);

  return (
    <>
      {before}
      <mark className="bg-amber-200 text-slate-950 rounded-xs px-0.5 font-semibold">{match}</mark>
      {after}
    </>
  );
}

export const DataTable: React.FC<DataTableProps> = ({
  items,
  currentFilter,
  onFilterChange,
  gstrMapping,
  ewbMapping,
  onOpenMapping
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showMapping, setShowMapping] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    if (!text || text === '-') return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1500);
  };

  // Filter and search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Category Status Filter
      const matchesStatus = currentFilter === 'All' || item.Status === currentFilter;
      if (!matchesStatus) return false;

      // 2. Date Range Filter
      if (startDate || endDate) {
        const itemDate = toIsoDate(item['GSTR-1 Date']) || toIsoDate(item['E-Way Bill Date']);
        if (itemDate) {
          if (startDate && itemDate < startDate) return false;
          if (endDate && itemDate > endDate) return false;
        } else {
          return false;
        }
      }

      // 3. Real-time Search by Invoice No. or GSTIN
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      const inv = String(item['Invoice No.'] || '').toLowerCase();
      const gstin = String(item.GSTIN || '').toLowerCase();
      return inv.includes(q) || gstin.includes(q);
    });
  }, [items, currentFilter, searchTerm, startDate, endDate]);

  // Reset page when filter or search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [currentFilter, searchTerm, startDate, endDate, pageSize]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const formatCurrency = (val: number | null | undefined) => {
    if (val == null) return '-';
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Count items by category for breakdown bar
  const distribution = useMemo(() => {
    const total = items.length;
    if (total === 0) return null;

    let matched = 0;
    let unmatched = 0;
    let ewbNotFound = 0;
    let ewbNotRequired = 0;
    let extraEwb = 0;
    let duplicate = 0;

    for (const it of items) {
      if (it.Status === 'Matched') matched++;
      else if (it.Status === 'Unmatched') unmatched++;
      else if (it.Status === 'E-Way Bill Not Found') ewbNotFound++;
      else if (it.Status === 'E-Way Bill Not Required (< ₹50k)') ewbNotRequired++;
      else if (it.Status === 'Extra E-Way Bill') extraEwb++;
      else if (it.Status === 'Review - Duplicate') duplicate++;
    }

    return {
      total,
      matched: { count: matched, pct: (matched / total) * 100 },
      ewbNotRequired: { count: ewbNotRequired, pct: (ewbNotRequired / total) * 100 },
      unmatched: { count: unmatched, pct: (unmatched / total) * 100 },
      ewbNotFound: { count: ewbNotFound, pct: (ewbNotFound / total) * 100 },
      extraEwb: { count: extraEwb, pct: (extraEwb / total) * 100 },
      duplicate: { count: duplicate, pct: (duplicate / total) * 100 },
    };
  }, [items]);

  const getStatusBadge = (status: ReconciliationStatus) => {
    switch (status) {
      case 'Matched':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Matched
          </span>
        );
      case 'Unmatched':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Unmatched
          </span>
        );
      case 'E-Way Bill Not Found':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-50 text-orange-800 border border-orange-200">
            <FileWarning className="w-3 h-3 text-orange-600" />
            EWB Missing
          </span>
        );
      case 'E-Way Bill Not Required (< ₹50k)':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200" title="Exempted from mandatory E-Way Bill under Rule 138">
            <ShieldCheck className="w-3 h-3 text-teal-600" />
            Rule 138 Exempt
          </span>
        );
      case 'Extra E-Way Bill':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <PackagePlus className="w-3 h-3 text-purple-600" />
            Extra E-Way Bill
          </span>
        );
      case 'Review - Duplicate':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            Duplicate
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const statusOptions: ReconciliationStatus[] = [
    'All',
    'Matched',
    'Unmatched',
    'E-Way Bill Not Found',
    'E-Way Bill Not Required (< ₹50k)',
    'Extra E-Way Bill',
    'Review - Duplicate',
  ];

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden flex flex-col">
      {/* Visual Compliance Distribution Bar */}
      {distribution && distribution.total > 0 && (
        <div className="px-5 pt-3.5 pb-2.5 bg-slate-50/70 border-b border-slate-200/80">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1.5">
            <span className="flex items-center gap-1.5 text-slate-800 uppercase tracking-wider">
              Compliance Distribution Ratio
            </span>
            <span className="font-mono text-slate-500">
              {distribution.matched.pct.toFixed(1)}% Harmonized
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-200/70 rounded-full overflow-hidden flex shadow-inner">
            {distribution.matched.pct > 0 && (
              <div 
                style={{ width: `${distribution.matched.pct}%` }} 
                className="bg-emerald-500 h-full cursor-pointer hover:opacity-90 transition-opacity" 
                title={`Matched: ${distribution.matched.count} (${distribution.matched.pct.toFixed(1)}%)`}
                onClick={() => onFilterChange('Matched')}
              />
            )}
            {distribution.ewbNotRequired.pct > 0 && (
              <div 
                style={{ width: `${distribution.ewbNotRequired.pct}%` }} 
                className="bg-teal-500 h-full cursor-pointer hover:opacity-90 transition-opacity" 
                title={`Rule 138 Exempt: ${distribution.ewbNotRequired.count} (${distribution.ewbNotRequired.pct.toFixed(1)}%)`}
                onClick={() => onFilterChange('E-Way Bill Not Required (< ₹50k)')}
              />
            )}
            {distribution.unmatched.pct > 0 && (
              <div 
                style={{ width: `${distribution.unmatched.pct}%` }} 
                className="bg-amber-400 h-full cursor-pointer hover:opacity-90 transition-opacity" 
                title={`Unmatched: ${distribution.unmatched.count} (${distribution.unmatched.pct.toFixed(1)}%)`}
                onClick={() => onFilterChange('Unmatched')}
              />
            )}
            {distribution.ewbNotFound.pct > 0 && (
              <div 
                style={{ width: `${distribution.ewbNotFound.pct}%` }} 
                className="bg-orange-500 h-full cursor-pointer hover:opacity-90 transition-opacity" 
                title={`EWB Missing: ${distribution.ewbNotFound.count} (${distribution.ewbNotFound.pct.toFixed(1)}%)`}
                onClick={() => onFilterChange('E-Way Bill Not Found')}
              />
            )}
            {distribution.extraEwb.pct > 0 && (
              <div 
                style={{ width: `${distribution.extraEwb.pct}%` }} 
                className="bg-purple-500 h-full cursor-pointer hover:opacity-90 transition-opacity" 
                title={`Extra EWB: ${distribution.extraEwb.count} (${distribution.extraEwb.pct.toFixed(1)}%)`}
                onClick={() => onFilterChange('Extra E-Way Bill')}
              />
            )}
            {distribution.duplicate.pct > 0 && (
              <div 
                style={{ width: `${distribution.duplicate.pct}%` }} 
                className="bg-rose-500 h-full cursor-pointer hover:opacity-90 transition-opacity" 
                title={`Duplicates: ${distribution.duplicate.count} (${distribution.duplicate.pct.toFixed(1)}%)`}
                onClick={() => onFilterChange('Review - Duplicate')}
              />
            )}
          </div>
        </div>
      )}

      {/* Top Filter & Search Bar */}
      <div className="p-4 border-b border-slate-200 bg-white flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Filter Status:</label>
              <select
                value={currentFilter}
                onChange={(e) => onFilterChange(e.target.value as ReconciliationStatus)}
                className="text-xs py-1.5 px-3 bg-white border border-slate-300 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-semibold"
              >
                {statusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Real-time Search Box */}
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="text"
                aria-label="Search invoices by invoice number or GSTIN"
                placeholder="Search Invoice No. or GSTIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchTerm('');
                }}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-slate-400 text-slate-900"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  title="Clear search (Esc)"
                  aria-label="Clear search"
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons: Export & Custom Mapping */}
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50/90 px-2 py-1 rounded-md border border-emerald-200/80 shadow-2xs" title="Per Section 170 CGST Act: Fractional differences up to ₹1.00 are treated as statutory rounding and ignored">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              ≤₹1.00 Rounding Ignored
            </span>

            {onOpenMapping && (
              <button
                type="button"
                onClick={onOpenMapping}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="Adjust column mapping manually"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                Column Map
              </button>
            )}

            <button
              type="button"
              onClick={() => exportReconciliationToExcel(items)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer active:scale-[0.99]"
              title="Download Side-by-Side GSTR-1 vs E-Way Bill Reconciliation Excel workbook"
            >
              <Download className="w-3.5 h-3.5" />
              Export Excel Report
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Date Range:</span>
          </div>

          {/* Quick Date Presets Dropdown */}
          <select
            value={startDate || endDate ? 'custom' : 'all'}
            onChange={(e) => {
              const preset = e.target.value;
              const now = new Date();
              const year = now.getFullYear();
              const month = now.getMonth();

              if (preset === 'all') {
                setStartDate('');
                setEndDate('');
              } else if (preset === 'this-month') {
                const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
                const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
                setStartDate(firstDay);
                setEndDate(lastDay);
              } else if (preset === 'last-month') {
                const firstDay = new Date(year, month - 1, 1).toISOString().split('T')[0];
                const lastDay = new Date(year, month, 0).toISOString().split('T')[0];
                setStartDate(firstDay);
                setEndDate(lastDay);
              } else if (preset === 'last-30') {
                const past = new Date();
                past.setDate(past.getDate() - 30);
                setStartDate(past.toISOString().split('T')[0]);
                setEndDate(now.toISOString().split('T')[0]);
              } else if (preset === 'fy-2425') {
                setStartDate('2024-04-01');
                setEndDate('2025-03-31');
              } else if (preset === 'fy-2324') {
                setStartDate('2023-04-01');
                setEndDate('2024-03-31');
              }
            }}
            className="py-1 px-2.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">All Dates</option>
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
            <option value="last-30">Last 30 Days</option>
            <option value="fy-2425">FY 2024-25</option>
            <option value="fy-2324">FY 2023-24</option>
            <option value="custom">Custom Date Range...</option>
          </select>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-0.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-0.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row counter info */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-2 flex-wrap">
          <span>
            Showing <strong className="font-bold font-mono text-slate-900">{filteredItems.length.toLocaleString('en-IN')}</strong> invoices
          </span>
          {currentFilter !== 'All' && <span>in <strong className="text-slate-900">{currentFilter}</strong></span>}
          {searchTerm && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100/90 text-blue-900 font-medium text-[11px]">
              Query: &ldquo;{searchTerm}&rdquo;
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="hover:text-blue-950 ml-0.5 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {(startDate || endDate) && (
            <span> between {startDate || 'start'} and {endDate || 'end'}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-[11px]">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="text-xs bg-white border border-slate-300 rounded px-1.5 py-0.5 font-medium"
          >
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Main High-Density Table */}
      <div className="overflow-x-auto flex-1 max-h-[640px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 shadow-2xs">
            {/* Super Header / Section Groups */}
            <tr className="text-[10px] uppercase font-bold tracking-wider border-b border-slate-200 select-none">
              <th colSpan={4} className="py-2 px-3 bg-slate-100 text-slate-700 border-r border-slate-300">
                1. Invoice &amp; Recipient Details
              </th>
              <th colSpan={6} className="py-2 px-3 bg-blue-100/80 text-blue-900 border-r border-blue-300 text-center font-extrabold">
                2. GSTR-1 Outward Filing (Portal)
              </th>
              <th colSpan={6} className="py-2 px-3 bg-indigo-100/80 text-indigo-900 border-r border-indigo-300 text-center font-extrabold">
                3. E-Way Bill Consignment (NIC)
              </th>
              <th colSpan={5} className="py-2 px-3 bg-amber-100/80 text-amber-950 border-r border-amber-300 text-center font-extrabold">
                4. Variance / Difference (GSTR-1 − EWB)
              </th>
              <th colSpan={2} className="py-2 px-3 bg-slate-100 text-slate-600 text-center">
                Row Ref
              </th>
            </tr>

            {/* Individual Column Header Row */}
            <tr className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              {/* Document Info */}
              <th className="py-2 px-3 whitespace-nowrap bg-slate-50">Status</th>
              <th className="py-2 px-3 min-w-[200px] bg-slate-50">Discrepancy Reason</th>
              <th className="py-2 px-3 whitespace-nowrap bg-slate-50">Invoice No.</th>
              <th className="py-2 px-3 whitespace-nowrap bg-slate-50 border-r border-slate-300">Buyer GSTIN</th>

              {/* GSTR-1 Columns */}
              <th className="py-2 px-3 whitespace-nowrap bg-blue-50/50 text-blue-900">Date</th>
              <th className="py-2 px-3 text-right whitespace-nowrap bg-blue-50/50 text-blue-900">Taxable</th>
              <th className="py-2 px-3 text-right whitespace-nowrap bg-blue-50/50 text-blue-900">IGST</th>
              <th className="py-2 px-3 text-right whitespace-nowrap bg-blue-50/50 text-blue-900">CGST</th>
              <th className="py-2 px-3 text-right whitespace-nowrap bg-blue-50/50 text-blue-900">SGST</th>
              <th className="py-2 px-3 text-right whitespace-nowrap bg-blue-50/70 text-blue-950 font-black border-r border-blue-300">Total Value</th>

              {/* E-Way Bill Columns */}
              <th className="py-2 px-3 whitespace-nowrap bg-indigo-50/50 text-indigo-900">Date</th>
              <th className="py-2 px-3 text-right whitespace-nowrap bg-indigo-50/50 text-indigo-900">Taxable</th>
              <th className="py-2 px-3 text-right whitespace-nowrap bg-indigo-50/50 text-indigo-900">IGST</th>
              <th className="py-2 px-3 text-right whitespace-nowrap bg-indigo-50/50 text-indigo-900">CGST</th>
              <th className="py-2 px-3 text-right whitespace-nowrap bg-indigo-50/50 text-indigo-900">SGST</th>
              <th className="py-2 px-3 text-right whitespace-nowrap bg-indigo-50/70 text-indigo-950 font-black border-r border-indigo-300">Total Value</th>

              {/* Difference Columns */}
              <th className="py-2 px-3 text-right whitespace-nowrap bg-amber-50/50 text-amber-900">Diff Taxable</th>
              <th className="py-2 px-3 text-right whitespace-nowrap bg-amber-50/50 text-amber-900">Diff IGST</th>
              <th className="py-2 px-3 text-right whitespace-nowrap bg-amber-50/50 text-amber-900">Diff CGST</th>
              <th className="py-2 px-3 text-right whitespace-nowrap bg-amber-50/50 text-amber-900">Diff SGST</th>
              <th className="py-2 px-3 text-right whitespace-nowrap bg-amber-50/70 text-amber-950 font-black border-r border-amber-300">Diff Total</th>

              {/* Row Sources */}
              <th className="py-2 px-2.5 text-center whitespace-nowrap text-slate-400 bg-slate-50">GSTR</th>
              <th className="py-2 px-2.5 text-center whitespace-nowrap text-slate-400 bg-slate-50">EWB</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={23} className="py-14 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                    <Search className="w-8 h-8 text-slate-300" />
                    <p className="font-bold text-slate-700">No matching invoices found</p>
                    <p className="text-xs text-slate-500">
                      {searchTerm
                        ? `No records match "${searchTerm}" in current filter view.`
                        : 'No records match the current filter and date criteria.'}
                    </p>
                    {(searchTerm || currentFilter !== 'All' || startDate || endDate) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm('');
                          onFilterChange('All');
                          setStartDate('');
                          setEndDate('');
                        }}
                        className="mt-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedItems.map((item, idx) => {
                const gVal = item['GSTR-1 Invoice Value'];
                const eVal = item['EWB Invoice Value'];
                const hasAmountDiff = gVal != null && eVal != null && Math.abs(gVal - eVal) > 1.0;

                const renderDiffBadge = (val: number | null | undefined) => {
                  if (val == null) return <span className="text-slate-400">-</span>;
                  if (Math.abs(val) <= 1.0) {
                    return (
                      <span className="text-emerald-700 font-mono font-medium" title="Variance ≤ ₹1.00 ignored per GST rounding rules">
                        ₹0.00
                      </span>
                    );
                  }
                  const isPositive = val > 0;
                  const color = isPositive
                    ? 'text-amber-800 bg-amber-50 px-1 py-0.5 rounded font-bold border border-amber-200/60'
                    : 'text-rose-800 bg-rose-50 px-1 py-0.5 rounded font-bold border border-rose-200/60';
                  const sign = isPositive ? '+' : '-';
                  return (
                    <span className={`font-mono tabular-nums inline-block ${color}`} title={isPositive ? 'GSTR-1 is higher by this amount' : 'E-Way Bill is higher by this amount'}>
                      {sign}₹{Math.abs(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  );
                };

                return (
                  <tr
                    key={`${item['Invoice No.']}-${idx}`}
                    className="hover:bg-blue-50/40 transition-colors odd:bg-white even:bg-slate-50/40 text-[11px]"
                  >
                    {/* 1. Document Info */}
                    <td className="py-2 px-3 whitespace-nowrap">{getStatusBadge(item.Status)}</td>
                    <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={item.Reason}>
                      {item.Reason}
                    </td>

                    {/* Invoice Number with Click-to-Copy */}
                    <td className="py-2 px-3 font-bold font-mono text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1 group">
                        <span>{highlightMatch(item['Invoice No.'], searchTerm)}</span>
                        {item['Invoice No.'] && (
                          <button
                            type="button"
                            onClick={() => handleCopy(item['Invoice No.'], `inv-${idx}`)}
                            title="Copy invoice number"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            {copiedKey === `inv-${idx}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* GSTIN & Place of Supply with Click-to-Copy */}
                    <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap border-r border-slate-200">
                      <div className="flex items-center gap-1 group">
                        <span className="font-semibold">{highlightMatch(item.GSTIN, searchTerm)}</span>
                        {item.GSTIN && item.GSTIN !== 'URP' && (
                          <button
                            type="button"
                            onClick={() => handleCopy(item.GSTIN, `gst-${idx}`)}
                            title="Copy GSTIN"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            {copiedKey === `gst-${idx}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                      {(item['Party Name'] || item['Particulars / Party Name']) && (
                        <div className="text-[10px] text-slate-700 font-sans font-semibold truncate max-w-[200px]" title={item['Party Name'] || item['Particulars / Party Name'] || ''}>
                          {item['Party Name'] || item['Particulars / Party Name']}
                        </div>
                      )}
                      {(item['Place of Supply'] || item['Supply Type']) && (
                        <div className="flex items-center gap-1 mt-0.5">
                          {item['Place of Supply'] && (
                            <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-medium border border-slate-200/80">
                              POS: {item['Place of Supply']}
                            </span>
                          )}
                          {item['Supply Type'] && (
                            <span className={`text-[9px] font-sans px-1 py-0.2 rounded font-medium ${
                              item['Supply Type'] === 'Intra-State'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                            }`}>
                              {item['Supply Type']}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 2. GSTR-1 Data (Left Side) */}
                    <td className="py-2 px-3 whitespace-nowrap font-mono text-slate-600 bg-blue-50/20">{item['GSTR-1 Date'] || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 bg-blue-50/20">
                      {formatCurrency(item['GSTR-1 Taxable'])}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-600 bg-blue-50/20">
                      {formatCurrency(item['GSTR-1 IGST'])}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-600 bg-blue-50/20">
                      {formatCurrency(item['GSTR-1 CGST'])}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-600 bg-blue-50/20">
                      {formatCurrency(item['GSTR-1 SGST'])}
                    </td>
                    <td className={`py-2 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap border-r border-blue-200 ${
                      hasAmountDiff ? 'text-blue-900 bg-blue-100/50' : 'text-slate-900 bg-blue-50/30'
                    }`}>
                      {formatCurrency(item['GSTR-1 Invoice Value'])}
                    </td>

                    {/* 3. E-Way Bill Data (Right Side) */}
                    <td className="py-2 px-3 whitespace-nowrap font-mono text-slate-600 bg-indigo-50/20">{item['E-Way Bill Date'] || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 bg-indigo-50/20">
                      {formatCurrency(item['EWB Taxable'])}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-600 bg-indigo-50/20">
                      {formatCurrency(item['EWB IGST'])}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-600 bg-indigo-50/20">
                      {formatCurrency(item['EWB CGST'])}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-600 bg-indigo-50/20">
                      {formatCurrency(item['EWB SGST'])}
                    </td>
                    <td className={`py-2 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap border-r border-indigo-200 ${
                      hasAmountDiff ? 'text-indigo-900 bg-indigo-100/50' : 'text-slate-900 bg-indigo-50/30'
                    }`}>
                      {formatCurrency(item['EWB Invoice Value'])}
                    </td>

                    {/* 4. Differences */}
                    <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap bg-amber-50/15">
                      {renderDiffBadge(item['Diff Taxable'])}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap bg-amber-50/15">
                      {renderDiffBadge(item['Diff IGST'])}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap bg-amber-50/15">
                      {renderDiffBadge(item['Diff CGST'])}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap bg-amber-50/15">
                      {renderDiffBadge(item['Diff SGST'])}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap border-r border-amber-200 bg-amber-50/25">
                      {renderDiffBadge(item['Diff Invoice Value'])}
                    </td>

                    {/* 5. Row References */}
                    <td className="py-2 px-2 text-center text-slate-400 font-mono whitespace-nowrap text-[10px]">
                      {item['GSTR-1 Source Row'] ?? '-'}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-400 font-mono whitespace-nowrap text-[10px]">
                      {item['EWB Source Row'] ?? '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-600">
          <div>
            Page <span className="font-bold font-mono text-slate-900">{currentPage}</span> of{' '}
            <span className="font-bold font-mono text-slate-900">{totalPages}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Verified Column Mapping */}
      <div className="border-t border-slate-200 bg-slate-50/60">
        <button
          type="button"
          onClick={() => setShowMapping(!showMapping)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100/60 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" />
            Active Column Mapping Invariants
          </span>
          {showMapping ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showMapping && (
          <div className="p-4 pt-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs border-t border-slate-200/60 bg-white">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="font-bold text-slate-900 mb-2">GSTR-1 Mapped Columns:</h4>
              <div className="space-y-1 font-mono text-[11px] text-slate-700">
                {gstrMapping ? (
                  Object.entries(gstrMapping)
                    .filter(([, v]) => v !== null)
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-slate-200/60 py-0.5">
                        <span className="text-slate-500">{k}:</span>
                        <span className="font-bold text-blue-700">{v}</span>
                      </div>
                    ))
                ) : (
                  <p className="text-slate-400">Auto-detected schema</p>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="font-bold text-slate-900 mb-2">E-Way Bill Mapped Columns:</h4>
              <div className="space-y-1 font-mono text-[11px] text-slate-700">
                {ewbMapping ? (
                  Object.entries(ewbMapping)
                    .filter(([, v]) => v !== null)
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-slate-200/60 py-0.5">
                        <span className="text-slate-500">{k}:</span>
                        <span className="font-bold text-indigo-700">{v}</span>
                      </div>
                    ))
                ) : (
                  <p className="text-slate-400">Auto-detected schema</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
