import React, { useRef, useState, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  RefreshCw, 
  Sparkles, 
  X, 
  Calendar, 
  ShieldCheck, 
  FileCheck2,
  Lock
} from 'lucide-react';
import { DateToleranceOption } from '../types/reconciliation';

interface SidebarProps {
  gstrFile: File | null;
  ewbFile: File | null;
  onGstrFileChange: (file: File | null) => void;
  onEwbFileChange: (file: File | null) => void;
  tolerance: number;
  onToleranceChange: (val: number) => void;
  dateTolerance: DateToleranceOption;
  onDateToleranceChange: (val: DateToleranceOption) => void;
  ewbThreshold: number;
  onEwbThresholdChange: (val: number) => void;
  supplierGstin?: string;
  onSupplierGstinChange?: (val: string) => void;
  autoBifurcateTax?: boolean;
  onAutoBifurcateTaxChange?: (val: boolean) => void;
  onRun: () => void;
  isProcessing: boolean;
  onLoadSample: () => void;
  onReset: () => void;
  hasResult: boolean;
  isSampleActive: boolean;
  progressPercent?: number;
  processingLabel?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  gstrFile,
  ewbFile,
  onGstrFileChange,
  onEwbFileChange,
  tolerance,
  onToleranceChange,
  dateTolerance,
  onDateToleranceChange,
  ewbThreshold,
  onEwbThresholdChange,
  onRun,
  isProcessing,
  onLoadSample,
  onReset,
  hasResult,
  isSampleActive,
  progressPercent,
  processingLabel
}) => {
  const gstrInputRef = useRef<HTMLInputElement>(null);
  const ewbInputRef = useRef<HTMLInputElement>(null);

  const presetValues = [0, 1, 2, 3, 7, 15, 30, -1];
  const [selectedDropdownVal, setSelectedDropdownVal] = useState<string>(
    presetValues.includes(dateTolerance) ? String(dateTolerance) : 'custom'
  );
  const [customDays, setCustomDays] = useState<number>(
    dateTolerance >= 0 ? dateTolerance : 5
  );

  useEffect(() => {
    if (presetValues.includes(dateTolerance)) {
      setSelectedDropdownVal(String(dateTolerance));
    } else {
      setSelectedDropdownVal('custom');
      setCustomDays(dateTolerance);
    }
  }, [dateTolerance]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <aside className="w-full lg:w-84 bg-white border-r border-slate-200/90 p-5 flex flex-col gap-5 shrink-0 shadow-2xs">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Reconciliation Workbench
          </h2>
          <p className="text-[11px] text-slate-500">Configure parameters &amp; sources</p>
        </div>
        <button
          type="button"
          onClick={onLoadSample}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200/70"
          title="Load demonstration dataset"
        >
          <Sparkles className="w-3 h-3" />
          {isSampleActive ? 'Demo Active' : 'Load Demo'}
        </button>
      </div>

      {/* 1. Upload Section */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-bold">
              1
            </span>
            Source Documents
          </label>
          <span className="text-[10px] text-slate-400 font-medium">Excel / JSON / CSV / PDF</span>
        </div>

        {/* GSTR-1 File Box */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-semibold text-slate-700">GSTR-1 Outward Supply</span>
            <span className="text-[10px] text-slate-400">Portal Register / PDF</span>
          </div>
          <input
            type="file"
            ref={gstrInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onGstrFileChange(e.target.files[0]);
              }
            }}
            accept=".xlsx,.xls,.json,.csv,.pdf"
            className="hidden"
          />

          {gstrFile ? (
            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div className="flex items-center gap-2 truncate">
                <div className="w-7 h-7 rounded bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <p className="font-semibold text-slate-900 truncate leading-tight">{gstrFile.name}</p>
                  <p className="text-[10px] text-slate-400">{formatFileSize(gstrFile.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onGstrFileChange(null);
                  if (gstrInputRef.current) gstrInputRef.current.value = '';
                }}
                className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                title="Remove file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : isSampleActive ? (
            <div className="flex items-center justify-between p-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-lg text-xs">
              <div className="flex items-center gap-2 truncate">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-950 leading-tight">Demo GSTR-1 Sample</p>
                  <p className="text-[10px] text-emerald-700">8 Outward supply records</p>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => gstrInputRef.current?.click()}
              className="w-full border border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/20 transition-all rounded-lg p-3 text-center flex flex-col items-center justify-center gap-1 cursor-pointer group"
            >
              <Upload className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
              <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-700">Upload GSTR-1 Report</span>
              <span className="text-[10px] text-slate-400">Excel, JSON, CSV, or PDF</span>
            </button>
          )}
        </div>

        {/* E-Way Bill File Box */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-semibold text-slate-700">E-Way Bill Register</span>
            <span className="text-[10px] text-slate-400">NIC EWB Portal / PDF</span>
          </div>
          <input
            type="file"
            ref={ewbInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onEwbFileChange(e.target.files[0]);
              }
            }}
            accept=".xlsx,.xls,.csv,.pdf"
            className="hidden"
          />

          {ewbFile ? (
            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div className="flex items-center gap-2 truncate">
                <div className="w-7 h-7 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <p className="font-semibold text-slate-900 truncate leading-tight">{ewbFile.name}</p>
                  <p className="text-[10px] text-slate-400">{formatFileSize(ewbFile.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onEwbFileChange(null);
                  if (ewbInputRef.current) ewbInputRef.current.value = '';
                }}
                className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                title="Remove file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : isSampleActive ? (
            <div className="flex items-center justify-between p-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-lg text-xs">
              <div className="flex items-center gap-2 truncate">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-950 leading-tight">Demo E-Way Bill Sample</p>
                  <p className="text-[10px] text-emerald-700">7 Consignment records</p>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => ewbInputRef.current?.click()}
              className="w-full border border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/20 transition-all rounded-lg p-3 text-center flex flex-col items-center justify-center gap-1 cursor-pointer group"
            >
              <Upload className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-700">Upload E-Way Bill File</span>
              <span className="text-[10px] text-slate-400">Excel, CSV, or NIC PDF Print</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Tolerance Settings Section */}
      <div className="space-y-4 pt-3 border-t border-slate-100">
        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-bold">
            2
          </span>
          Tolerance Settings
        </label>

        {/* Amount Difference Tolerance */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-semibold text-slate-700">Amount Difference Tolerance</span>
            <span className="text-[10px] font-mono text-slate-500">±₹{tolerance.toFixed(1)}</span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono font-medium">₹</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={tolerance}
              onChange={(e) => onToleranceChange(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Absorbs minor rounding or fractional tax differences.</p>
        </div>

        {/* Date Difference Tolerance */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-blue-600" />
              Date Difference Tolerance
            </span>
          </div>
          <select
            value={selectedDropdownVal}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedDropdownVal(val);
              if (val === 'custom') {
                onDateToleranceChange(customDays);
              } else {
                onDateToleranceChange(Number(val));
              }
            }}
            className="w-full py-1.5 px-2.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="0">±0 Days (Exact Date Match)</option>
            <option value="1">±1 Day Gap</option>
            <option value="2">±2 Days Gap</option>
            <option value="3">±3 Days Gap (Recommended for transit)</option>
            <option value="7">±7 Days Gap (1 Week)</option>
            <option value="15">±15 Days Gap (Fortnight)</option>
            <option value="30">±30 Days Gap (1 Month)</option>
            <option value="custom">Custom Days Range...</option>
            <option value="-1">Ignore Date Differences (Value Only)</option>
          </select>

          {selectedDropdownVal === 'custom' && (
            <div className="mt-2 p-2 bg-blue-50/70 border border-blue-200 rounded-md flex items-center gap-2">
              <span className="text-xs text-blue-700 font-bold">±</span>
              <input
                type="number"
                min="0"
                max="365"
                value={customDays}
                onChange={(e) => {
                  const v = Math.max(0, parseInt(e.target.value) || 0);
                  setCustomDays(v);
                  onDateToleranceChange(v);
                }}
                className="w-full px-2 py-0.5 text-xs bg-white border border-blue-300 rounded font-semibold text-slate-900"
                placeholder="Days"
              />
              <span className="text-[11px] text-blue-900 font-medium">Days</span>
            </div>
          )}
        </div>

        {/* Rule 138 Exemption Limit */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-teal-600" />
              Rule 138 Exemption Limit
            </span>
            <span className="text-[10px] font-mono text-slate-500">₹{ewbThreshold.toLocaleString('en-IN')}</span>
          </div>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono font-medium">₹</span>
            <input
              type="number"
              min="0"
              step="5000"
              value={ewbThreshold}
              onChange={(e) => onEwbThresholdChange(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Quick preset buttons for statutory thresholds */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <button
              type="button"
              onClick={() => onEwbThresholdChange(50000)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer border ${
                ewbThreshold === 50000
                  ? 'bg-teal-50 text-teal-700 border-teal-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              ₹50,000 (Central Standard)
            </button>
            <button
              type="button"
              onClick={() => onEwbThresholdChange(100000)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer border ${
                ewbThreshold === 100000
                  ? 'bg-teal-50 text-teal-700 border-teal-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              ₹1,00,000 (Intra-state)
            </button>
          </div>
        </div>
      </div>

      {/* 4. Action Section */}
      <div className="space-y-2.5 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onRun}
          disabled={isProcessing || (!isSampleActive && (!gstrFile || !ewbFile))}
          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
            isProcessing || (!isSampleActive && (!gstrFile || !ewbFile))
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
              : 'bg-slate-900 hover:bg-slate-800 text-white hover:shadow-md active:scale-[0.99]'
          }`}
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
              <span>
                {processingLabel || 'Processing'}
                {progressPercent !== undefined ? ` (${Math.round(progressPercent)}%)` : ''}
              </span>
            </>
          ) : (
            <>
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              <span>Run Reconciliation</span>
            </>
          )}
        </button>

        {isProcessing && progressPercent !== undefined && (
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/70">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-200"
              style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
            />
          </div>
        )}

        {hasResult && (
          <button
            type="button"
            onClick={onReset}
            className="w-full py-2 px-3 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
          >
            Clear / Start New Reconciliation
          </button>
        )}
      </div>

      {/* Security Footnote */}
      <div className="mt-auto pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-start gap-2">
        <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-tight">
          Client-side in-memory reconciliation. Tax data is neither stored nor transmitted to external servers.
        </p>
      </div>
    </aside>
  );
};
