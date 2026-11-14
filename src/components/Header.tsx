import React from 'react';
import { ShieldCheck, ArrowRightLeft, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

interface HeaderProps {
  summary?: {
    totalInvoices: number;
    gstrTotalAmount: number;
    ewbTotalAmount: number;
    matchRate: number;
    discrepancyCount: number;
  } | null;
}

export const Header: React.FC<HeaderProps> = ({ summary }) => {
  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString('en-IN', {
      maximumFractionDigits: 0
    })}`;
  };

  const diffAmount = summary ? Math.abs(summary.gstrTotalAmount - summary.ewbTotalAmount) : 0;

  return (
    <div className="mb-6 space-y-4">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Reconciliation &amp; Compliance Dashboard
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Rule 138 &amp; Sec 37
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated cross-reconciliation between Outward Supply Register (GSTR-1) and E-Way Bill Transit Records
          </p>
        </div>

        {summary && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs text-xs font-medium text-slate-700">
              <span className={`w-2 h-2 rounded-full ${summary.matchRate >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>Compliance: <strong className="font-bold text-slate-900">{summary.matchRate.toFixed(1)}%</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Financial Executive Summary Cards (Rendered when reconciliation data exists) */}
      {summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          {/* Card 1: GSTR-1 Turnover */}
          <div className="p-3 rounded-lg bg-slate-50/80 border border-slate-100">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              <span>GSTR-1 Turnover</span>
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-base sm:text-lg font-bold font-mono text-slate-900 tabular-nums">
              {formatCurrency(summary.gstrTotalAmount)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Reported outward sales</p>
          </div>

          {/* Card 2: E-Way Bill Consignment Value */}
          <div className="p-3 rounded-lg bg-slate-50/80 border border-slate-100">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              <span>EWB Consignment Val</span>
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <p className="text-base sm:text-lg font-bold font-mono text-slate-900 tabular-nums">
              {formatCurrency(summary.ewbTotalAmount)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Portal transit documentation</p>
          </div>

          {/* Card 3: Net Valuation Variance */}
          <div className="p-3 rounded-lg bg-slate-50/80 border border-slate-100">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              <span>Valuation Variance</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${diffAmount === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {diffAmount === 0 ? 'Exact' : 'Diff'}
              </span>
            </div>
            <p className={`text-base sm:text-lg font-bold font-mono tabular-nums ${diffAmount === 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
              {formatCurrency(diffAmount)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Net reconciliation delta</p>
          </div>

          {/* Card 4: Discrepancies Requiring Action */}
          <div className="p-3 rounded-lg bg-slate-50/80 border border-slate-100">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              <span>Review Items</span>
              {summary.discrepancyCount > 0 ? (
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              )}
            </div>
            <p className={`text-base sm:text-lg font-bold font-mono tabular-nums ${summary.discrepancyCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {summary.discrepancyCount.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {summary.discrepancyCount > 0 ? 'Invoices needing review' : 'Zero discrepancy flags'}
            </p>
          </div>
        </div>
      ) : (
        /* Quiet guidance banner for initial screen */
        <div className="flex items-center justify-between p-3.5 bg-white border border-slate-200/90 rounded-xl shadow-2xs text-xs text-slate-600">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-slate-900">Statutory Compliance Check:</span> Upload your GSTR-1 and E-Way Bill files on the left to reconcile invoice documents, identify Rule 138 (&lt; ₹50k) exemptions, and export verified reports.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
