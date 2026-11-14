import React, { useState } from 'react';
import { X, Check, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { ColumnMapping } from '../types/reconciliation';

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  gstrColumns: string[];
  ewbColumns: string[];
  initialGstrMapping: ColumnMapping;
  initialEwbMapping: ColumnMapping;
  onApply: (gstr: Partial<ColumnMapping>, ewb: Partial<ColumnMapping>) => void;
}

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  isOpen,
  onClose,
  gstrColumns,
  ewbColumns,
  initialGstrMapping,
  initialEwbMapping,
  onApply
}) => {
  const [gstrMap, setGstrMap] = useState<ColumnMapping>({ ...initialGstrMapping });
  const [ewbMap, setEwbMap] = useState<ColumnMapping>({ ...initialEwbMapping });

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(gstrMap, ewbMap);
    onClose();
  };

  const fields: Array<{ key: keyof ColumnMapping; label: string; required?: boolean; hint?: string }> = [
    { key: 'invoice_no', label: 'Invoice / Document Number', required: true },
    { key: 'gstin', label: 'Buyer GSTIN / Consignee' },
    { key: 'from_gstin', label: 'Supplier GSTIN / From GSTIN', hint: 'Used for intra vs inter-state tax bifurcation' },
    { key: 'pos', label: 'Place of Supply (POS) / To State', hint: 'Used for intra vs inter-state tax bifurcation' },
    { key: 'date', label: 'Document Date' },
    { key: 'taxable', label: 'Taxable Assessable Value' },
    { key: 'total_tax', label: 'Total GST Combined Tax Amount', hint: 'Auto-bifurcated into CGST/SGST or IGST' },
    { key: 'igst', label: 'Integrated Tax (IGST)' },
    { key: 'cgst', label: 'Central Tax (CGST)' },
    { key: 'sgst', label: 'State / UT Tax (SGST)' },
    { key: 'total', label: 'Invoice Total Value' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200/90 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Column Schema Mapping
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Map header columns from custom GSTR-1 or ERP/NIC E-Way Bill files to canonical reconciliation fields
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* GSTR-1 Mapping */}
            <div className="space-y-3.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  GSTR-1 Outward Columns
                </span>
                <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-semibold border border-blue-200">
                  {gstrColumns.length} Detected
                </span>
              </div>
              {fields.map(({ key, label, required }) => (
                <div key={`gstr-${key}`}>
                  <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                    {label} {required && <span className="text-rose-500 font-bold">*</span>}
                  </label>
                  <select
                    value={gstrMap[key] || 'None'}
                    onChange={(e) =>
                      setGstrMap((prev) => ({
                        ...prev,
                        [key]: e.target.value === 'None' ? null : e.target.value
                      }))
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                  >
                    <option value="None">-- Not Selected --</option>
                    {gstrColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* E-Way Bill Mapping */}
            <div className="space-y-3.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  E-Way Bill Columns
                </span>
                <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-semibold border border-indigo-200">
                  {ewbColumns.length} Detected
                </span>
              </div>
              {fields.map(({ key, label, required }) => (
                <div key={`ewb-${key}`}>
                  <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                    {label} {required && <span className="text-rose-500 font-bold">*</span>}
                  </label>
                  <select
                    value={ewbMap[key] || 'None'}
                    onChange={(e) =>
                      setEwbMap((prev) => ({
                        ...prev,
                        [key]: e.target.value === 'None' ? null : e.target.value
                      }))
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900"
                  >
                    <option value="None">-- Not Selected --</option>
                    {ewbColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            Invoice Number is mandatory for deterministic cross-matching.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Apply Schema &amp; Reconcile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
