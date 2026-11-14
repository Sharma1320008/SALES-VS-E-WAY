import React from 'react';
import { Loader2, CheckCircle2, FileSpreadsheet, Layers, GitCompare, BarChart3 } from 'lucide-react';

export type ReconciliationStage = 'idle' | 'parsing' | 'standardizing' | 'reconciling' | 'finalizing' | 'complete';

export interface ProgressState {
  isProcessing: boolean;
  stage: ReconciliationStage;
  progress: number; // 0 - 100
  title: string;
  detail: string;
}

interface ProgressModalProps {
  state: ProgressState;
}

const STAGES = [
  {
    key: 'parsing',
    label: 'Parsing Reports',
    description: 'Extracting GSTR-1 & E-Way Bill files',
    icon: FileSpreadsheet,
    stepNum: 1
  },
  {
    key: 'standardizing',
    label: 'Standardizing Columns',
    description: 'Normalizing invoice numbers, GSTIN & dates',
    icon: Layers,
    stepNum: 2
  },
  {
    key: 'reconciling',
    label: 'Reconciling Invoices',
    description: 'Matching tax amounts & Rule 138 limits',
    icon: GitCompare,
    stepNum: 3
  },
  {
    key: 'finalizing',
    label: 'Finalizing Dashboard',
    description: 'Computing metrics & discrepancy summary',
    icon: BarChart3,
    stepNum: 4
  }
];

export const ProgressModal: React.FC<ProgressModalProps> = ({ state }) => {
  if (!state.isProcessing && state.stage === 'idle') return null;

  const stageOrder: Record<ReconciliationStage, number> = {
    idle: 0,
    parsing: 1,
    standardizing: 2,
    reconciling: 3,
    finalizing: 4,
    complete: 5
  };

  const currentStep = stageOrder[state.stage];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Reconciliation Progress"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 max-w-lg w-full p-6 sm:p-7 relative overflow-hidden">
        {/* Animated Background Accent Glow */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-blue-100 rounded-full blur-3xl pointer-events-none opacity-60" />
        <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-indigo-100 rounded-full blur-3xl pointer-events-none opacity-60" />

        {/* Header with Spinner Animation */}
        <div className="relative flex items-center gap-3.5 mb-5">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 shadow-xs">
            {state.stage === 'complete' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 animate-in zoom-in-75 duration-200" />
            ) : (
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              {state.title || 'Reconciling Datasets...'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Processing in local browser memory
            </p>
          </div>
          <div className="ml-auto text-right">
            <span className="text-lg font-extrabold text-blue-600 tabular-nums">
              {Math.min(100, Math.max(0, Math.round(state.progress)))}%
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="relative mb-5">
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80 p-0.5">
            <div
              className="h-full bg-linear-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-300 ease-out shadow-xs relative"
              style={{ width: `${Math.min(100, Math.max(2, state.progress))}%` }}
            >
              {/* Shimmer overlay animation */}
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
          <div className="flex justify-between items-center mt-1.5 text-[11px] text-slate-400">
            <span>Stage {Math.min(4, Math.max(1, currentStep))} of 4</span>
            <span className="font-medium text-slate-600 truncate max-w-[280px]">
              {state.detail}
            </span>
          </div>
        </div>

        {/* Multi-Stage Stepper List */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          {STAGES.map((step) => {
            const isFinished = currentStep > step.stepNum || state.stage === 'complete';
            const isCurrent = currentStep === step.stepNum && state.stage !== 'complete';
            const StepIcon = step.icon;

            return (
              <div
                key={step.key}
                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 ${
                  isCurrent
                    ? 'bg-blue-50/70 border-blue-200/90 shadow-2xs'
                    : isFinished
                    ? 'bg-slate-50/50 border-slate-200/50 opacity-90'
                    : 'bg-white border-transparent opacity-40'
                }`}
              >
                {/* Status Indicator Icon */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isFinished
                      ? 'bg-emerald-100 text-emerald-700'
                      : isCurrent
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isFinished ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <StepIcon className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Stage Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-xs font-semibold truncate ${
                        isCurrent ? 'text-blue-900 font-bold' : isFinished ? 'text-slate-800' : 'text-slate-500'
                      }`}
                    >
                      {step.label}
                    </p>
                    {isCurrent && (
                      <span className="text-[10px] font-semibold text-blue-600 bg-blue-100/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        In Progress
                      </span>
                    )}
                    {isFinished && (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100/70 px-1.5 py-0.5 rounded-full">
                        Done
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Safety / Processing Hint */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Optimized for large multi-sheet Excel & JSON datasets</span>
          <span className="flex items-center gap-1 font-medium text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
            Live Processing
          </span>
        </div>
      </div>
    </div>
  );
};
