import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  FileWarning, 
  ShieldCheck, 
  PackagePlus, 
  Copy, 
  FileSpreadsheet, 
  Truck 
} from 'lucide-react';

export type MetricVariant = 
  | 'gstr' 
  | 'ewb' 
  | 'matched' 
  | 'unmatched' 
  | 'ewbNotFound' 
  | 'ewbNotRequired' 
  | 'extraEwb' 
  | 'reviewDuplicate';

interface MetricCardProps {
  label: string;
  value: number;
  totalCount?: number;
  isSelected?: boolean;
  onClick?: () => void;
  variant?: MetricVariant;
}

const VARIANT_CONFIG: Record<
  MetricVariant, 
  {
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    topBorder: string;
    iconBg: string;
    iconColor: string;
  }
> = {
  gstr: {
    icon: FileSpreadsheet,
    accentColor: 'text-slate-900',
    topBorder: 'border-t-blue-600',
    iconBg: 'bg-blue-50 text-blue-700',
    iconColor: 'text-blue-600'
  },
  ewb: {
    icon: Truck,
    accentColor: 'text-slate-900',
    topBorder: 'border-t-indigo-600',
    iconBg: 'bg-indigo-50 text-indigo-700',
    iconColor: 'text-indigo-600'
  },
  matched: {
    icon: CheckCircle2,
    accentColor: 'text-emerald-700',
    topBorder: 'border-t-emerald-600',
    iconBg: 'bg-emerald-50 text-emerald-700',
    iconColor: 'text-emerald-600'
  },
  unmatched: {
    icon: AlertTriangle,
    accentColor: 'text-amber-700',
    topBorder: 'border-t-amber-500',
    iconBg: 'bg-amber-50 text-amber-700',
    iconColor: 'text-amber-600'
  },
  ewbNotFound: {
    icon: FileWarning,
    accentColor: 'text-orange-700',
    topBorder: 'border-t-orange-500',
    iconBg: 'bg-orange-50 text-orange-700',
    iconColor: 'text-orange-600'
  },
  ewbNotRequired: {
    icon: ShieldCheck,
    accentColor: 'text-teal-700',
    topBorder: 'border-t-teal-600',
    iconBg: 'bg-teal-50 text-teal-700',
    iconColor: 'text-teal-600'
  },
  extraEwb: {
    icon: PackagePlus,
    accentColor: 'text-purple-700',
    topBorder: 'border-t-purple-600',
    iconBg: 'bg-purple-50 text-purple-700',
    iconColor: 'text-purple-600'
  },
  reviewDuplicate: {
    icon: Copy,
    accentColor: 'text-rose-700',
    topBorder: 'border-t-rose-600',
    iconBg: 'bg-rose-50 text-rose-700',
    iconColor: 'text-rose-600'
  }
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  totalCount,
  isSelected = false,
  onClick,
  variant = 'gstr'
}) => {
  const cfg = VARIANT_CONFIG[variant] || VARIANT_CONFIG.gstr;
  const Icon = cfg.icon;

  const percentage = totalCount && totalCount > 0 
    ? ((value / totalCount) * 100).toFixed(1) 
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left w-full transition-all duration-150 p-4 rounded-xl border bg-white flex flex-col justify-between cursor-pointer relative overflow-hidden group border-t-3 ${
        cfg.topBorder
      } ${
        isSelected
          ? 'ring-2 ring-slate-900 border-slate-900 shadow-md bg-slate-50/40'
          : 'border-slate-200/90 shadow-2xs hover:shadow-sm hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2 w-full">
        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block truncate">
          {label}
        </span>
        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="flex items-baseline justify-between mt-1 w-full">
        <span className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${cfg.accentColor}`}>
          {value.toLocaleString('en-IN')}
        </span>

        {percentage ? (
          <span className="text-[11px] font-medium text-slate-400 tabular-nums">
            {percentage}%
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 font-medium group-hover:text-slate-600 transition-colors">
            {isSelected ? 'Active' : 'Filter'}
          </span>
        )}
      </div>
    </button>
  );
};
