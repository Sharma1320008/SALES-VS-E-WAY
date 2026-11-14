import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MetricCard } from './components/MetricCard';
import { DataTable } from './components/DataTable';
import { ColumnMappingModal } from './components/ColumnMappingModal';
import { ProgressModal, ProgressState } from './components/ProgressModal';
import { ColumnMapping, DateToleranceOption, ReconciliationItem, ReconciliationStatus } from './types/reconciliation';
import { autoDetectSupplierGstin, parseUploadedFile } from './utils/fileParser';
import { reconcile, standardize } from './utils/reconciliation';
import { SAMPLE_GSTR1_DATA, SAMPLE_EWB_DATA } from './utils/sampleData';
import { AlertCircle, FileCheck2, ArrowRight, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

const waitTick = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

export function App() {
  const [gstrFile, setGstrFile] = useState<File | null>(null);
  const [ewbFile, setEwbFile] = useState<File | null>(null);
  const [tolerance, setTolerance] = useState<number>(1.0);
  const [dateTolerance, setDateTolerance] = useState<DateToleranceOption>(1); // Default ±1 day
  const [ewbThreshold, setEwbThreshold] = useState<number>(50000); // Default ₹50k threshold
  const [supplierGstin, setSupplierGstin] = useState<string>('07AAAAA1111A1Z1');
  const [autoBifurcateTax, setAutoBifurcateTax] = useState<boolean>(true);
  const [progressState, setProgressState] = useState<ProgressState>({
    isProcessing: false,
    stage: 'idle',
    progress: 0,
    title: '',
    detail: ''
  });
  const [error, setError] = useState<string | null>(null);

  // Parsed raw data
  const [gstrColumns, setGstrColumns] = useState<string[]>([]);
  const [ewbColumns, setEwbColumns] = useState<string[]>([]);
  const [gstrRows, setGstrRows] = useState<any[]>([]);
  const [ewbRows, setEwbRows] = useState<any[]>([]);

  // Mappings
  const [gstrMapping, setGstrMapping] = useState<ColumnMapping | null>(null);
  const [ewbMapping, setEwbMapping] = useState<ColumnMapping | null>(null);

  // Reconciliation Results
  const [result, setResult] = useState<ReconciliationItem[] | null>(null);
  const [filterStatus, setFilterStatus] = useState<ReconciliationStatus>('All');
  const [isSampleActive, setIsSampleActive] = useState<boolean>(false);
  const [showMappingModal, setShowMappingModal] = useState<boolean>(false);

  // Metric computations
  const metrics = useMemo(() => {
    if (!result) return null;

    let matched = 0;
    let unmatched = 0;
    let ewbNotFound = 0;
    let ewbNotRequired = 0;
    let extraEwb = 0;
    let reviewDuplicate = 0;
    let gstrTotalAmount = 0;
    let ewbTotalAmount = 0;

    for (const r of result) {
      if (r['GSTR-1 Invoice Value'] != null) {
        gstrTotalAmount += r['GSTR-1 Invoice Value'];
      }
      if (r['EWB Invoice Value'] != null) {
        ewbTotalAmount += r['EWB Invoice Value'];
      }

      if (r.Status === 'Matched') matched++;
      else if (r.Status === 'Unmatched') unmatched++;
      else if (r.Status === 'E-Way Bill Not Found') ewbNotFound++;
      else if (r.Status === 'E-Way Bill Not Required (< ₹50k)') ewbNotRequired++;
      else if (r.Status === 'Extra E-Way Bill') extraEwb++;
      else if (r.Status === 'Review - Duplicate') reviewDuplicate++;
    }

    const totalGstr = matched + unmatched + ewbNotFound + ewbNotRequired + reviewDuplicate;
    const totalEwb = matched + unmatched + extraEwb + reviewDuplicate;
    const discrepancyCount = unmatched + ewbNotFound + extraEwb + reviewDuplicate;
    const matchRate = totalGstr > 0 ? ((matched + ewbNotRequired) / totalGstr) * 100 : 100;

    return {
      totalGstr,
      totalEwb,
      matched,
      unmatched,
      ewbNotFound,
      ewbNotRequired,
      extraEwb,
      reviewDuplicate,
      totalInvoices: result.length,
      gstrTotalAmount,
      ewbTotalAmount,
      matchRate,
      discrepancyCount
    };
  }, [result]);

  const runReconciliationProcess = async (
    gRows: any[],
    gCols: string[],
    eRows: any[],
    eCols: string[],
    customGstrMap?: Partial<ColumnMapping>,
    customEwbMap?: Partial<ColumnMapping>,
    overrideSupplierGstin?: string
  ) => {
    setError(null);
    const activeSupplier = overrideSupplierGstin || supplierGstin;

    try {
      // Stage 2: Standardizing Columns
      setProgressState((prev) => ({
        isProcessing: true,
        stage: 'standardizing',
        progress: Math.max(prev.progress, 40),
        title: 'Standardizing Columns & Invoice Keys',
        detail: `Normalizing ${gRows.length.toLocaleString()} sales records and ${eRows.length.toLocaleString()} e-way bills...`
      }));
      await waitTick(70);

      const { standardized: gs, mapping: gm } = standardize(gRows, gCols, 'GSTR-1', customGstrMap, {
        supplierGstin: activeSupplier,
        autoBifurcateTax: true
      });
      const { standardized: es, mapping: em } = standardize(eRows, eCols, 'E-Way Bill', customEwbMap, {
        supplierGstin: activeSupplier,
        autoBifurcateTax: true
      });

      setGstrMapping(gm);
      setEwbMapping(em);

      // Check if invoice_no was found
      const missingG = !gm.invoice_no;
      const missingE = !em.invoice_no;

      if (missingG || missingE) {
        setShowMappingModal(true);
        setError('Invoice number column could not be automatically detected. Please select the correct columns in the mapping window.');
        setProgressState({
          isProcessing: false,
          stage: 'idle',
          progress: 0,
          title: '',
          detail: ''
        });
        return;
      }

      // Stage 3: Reconciling Invoices
      setProgressState({
        isProcessing: true,
        stage: 'reconciling',
        progress: 70,
        title: 'Executing Cross-Reconciliation',
        detail: `Comparing taxable amounts (±₹${tolerance}), dates (±${dateTolerance === -1 ? 'all' : dateTolerance}d), & Rule 138 limit (<₹${ewbThreshold.toLocaleString('en-IN')})...`
      });
      await waitTick(80);

      const recResult = reconcile(gs, es, tolerance, dateTolerance, ewbThreshold, {
        autoBifurcateTax: true,
        supplierGstin: activeSupplier
      });

      // Stage 4: Finalizing Dashboard
      setProgressState({
        isProcessing: true,
        stage: 'finalizing',
        progress: 92,
        title: 'Compiling Compliance Summary',
        detail: `Generated audit metrics for ${recResult.length.toLocaleString()} total documents...`
      });
      await waitTick(70);

      setResult(recResult);

      // Completion stage
      setProgressState({
        isProcessing: true,
        stage: 'complete',
        progress: 100,
        title: 'Reconciliation Complete!',
        detail: `Loaded ${recResult.length.toLocaleString()} categorized invoice records.`
      });
      await waitTick(400);

      setProgressState({
        isProcessing: false,
        stage: 'idle',
        progress: 100,
        title: '',
        detail: ''
      });
    } catch (err: any) {
      console.error('Reconciliation error:', err);
      setError(err?.message || 'Error occurred while processing files.');
      setProgressState({
        isProcessing: false,
        stage: 'idle',
        progress: 0,
        title: '',
        detail: ''
      });
    }
  };

  const handleRun = async () => {
    if (isSampleActive) {
      setProgressState({
        isProcessing: true,
        stage: 'parsing',
        progress: 15,
        title: 'Loading Demo Dataset',
        detail: 'Reading built-in sample GSTR-1 and E-Way Bill records...'
      });
      await waitTick(80);

      await runReconciliationProcess(
        SAMPLE_GSTR1_DATA.rows,
        SAMPLE_GSTR1_DATA.columns,
        SAMPLE_EWB_DATA.rows,
        SAMPLE_EWB_DATA.columns
      );
      return;
    }

    if (!gstrFile || !ewbFile) {
      setError('Please upload both GSTR-1 and E-Way Bill files to proceed.');
      return;
    }

    setError(null);
    setProgressState({
      isProcessing: true,
      stage: 'parsing',
      progress: 15,
      title: 'Parsing Uploaded Reports',
      detail: `Reading "${gstrFile.name}" and "${ewbFile.name}"...`
    });

    try {
      await waitTick(60);

      const parsedGstr = await parseUploadedFile(gstrFile);
      setProgressState({
        isProcessing: true,
        stage: 'parsing',
        progress: 28,
        title: 'Parsing Uploaded Reports',
        detail: `Parsed ${parsedGstr.rows.length.toLocaleString()} GSTR-1 rows. Reading E-Way Bill workbook...`
      });
      await waitTick(50);

      const parsedEwb = await parseUploadedFile(ewbFile);
      setProgressState({
        isProcessing: true,
        stage: 'parsing',
        progress: 38,
        title: 'Parsing Uploaded Reports',
        detail: `Parsed ${parsedGstr.rows.length.toLocaleString()} GSTR-1 and ${parsedEwb.rows.length.toLocaleString()} EWB records.`
      });
      await waitTick(50);

      setGstrColumns(parsedGstr.columns);
      setGstrRows(parsedGstr.rows);
      setEwbColumns(parsedEwb.columns);
      setEwbRows(parsedEwb.rows);

      const detected = autoDetectSupplierGstin(parsedEwb.rows, parsedEwb.columns) ||
                       autoDetectSupplierGstin(parsedGstr.rows, parsedGstr.columns);
      if (detected) {
        setSupplierGstin(detected);
      }

      await runReconciliationProcess(
        parsedGstr.rows,
        parsedGstr.columns,
        parsedEwb.rows,
        parsedEwb.columns,
        undefined,
        undefined,
        detected || supplierGstin
      );
    } catch (err: any) {
      console.error('File parsing error:', err);
      setError(err?.message || 'Error occurred while parsing the uploaded reports.');
      setProgressState({
        isProcessing: false,
        stage: 'idle',
        progress: 0,
        title: '',
        detail: ''
      });
    }
  };

  const handleLoadSample = async () => {
    setIsSampleActive(true);
    setGstrFile(null);
    setEwbFile(null);
    setGstrColumns(SAMPLE_GSTR1_DATA.columns);
    setGstrRows(SAMPLE_GSTR1_DATA.rows);
    setEwbColumns(SAMPLE_EWB_DATA.columns);
    setEwbRows(SAMPLE_EWB_DATA.rows);

    setProgressState({
      isProcessing: true,
      stage: 'parsing',
      progress: 20,
      title: 'Loading Demonstration Dataset',
      detail: 'Extracting pre-configured GSTR-1 & EWB test fixtures...'
    });
    await waitTick(80);

    await runReconciliationProcess(
      SAMPLE_GSTR1_DATA.rows,
      SAMPLE_GSTR1_DATA.columns,
      SAMPLE_EWB_DATA.rows,
      SAMPLE_EWB_DATA.columns
    );
  };

  const handleReset = () => {
    setGstrFile(null);
    setEwbFile(null);
    setResult(null);
    setGstrColumns([]);
    setGstrRows([]);
    setEwbColumns([]);
    setEwbRows([]);
    setGstrMapping(null);
    setEwbMapping(null);
    setFilterStatus('All');
    setIsSampleActive(false);
    setError(null);
    setProgressState({
      isProcessing: false,
      stage: 'idle',
      progress: 0,
      title: '',
      detail: ''
    });
  };

  const handleCustomMappingApply = (
    customG: Partial<ColumnMapping>,
    customE: Partial<ColumnMapping>
  ) => {
    const gRows = isSampleActive ? SAMPLE_GSTR1_DATA.rows : gstrRows;
    const gCols = isSampleActive ? SAMPLE_GSTR1_DATA.columns : gstrColumns;
    const eRows = isSampleActive ? SAMPLE_EWB_DATA.rows : ewbRows;
    const eCols = isSampleActive ? SAMPLE_EWB_DATA.columns : ewbColumns;

    runReconciliationProcess(gRows, gCols, eRows, eCols, customG, customE);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200/90 px-6 py-3 flex items-center justify-between shadow-2xs sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-xs">
            ₹
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-sm tracking-tight">GST Reconciliation Pro</span>
              <span className="text-slate-300">/</span>
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">Statutory Sales &amp; Transit Reconciliation</span>
            </div>
            <p className="text-[11px] text-slate-400">Outward Supply (GSTR-1) ↔ NIC E-Way Bill Consignments</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleLoadSample}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Load Demo Data
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar */}
        <Sidebar
          gstrFile={gstrFile}
          ewbFile={ewbFile}
          onGstrFileChange={(file) => {
            setIsSampleActive(false);
            setGstrFile(file);
          }}
          onEwbFileChange={(file) => {
            setIsSampleActive(false);
            setEwbFile(file);
          }}
          tolerance={tolerance}
          onToleranceChange={setTolerance}
          dateTolerance={dateTolerance}
          onDateToleranceChange={setDateTolerance}
          ewbThreshold={ewbThreshold}
          onEwbThresholdChange={setEwbThreshold}
          supplierGstin={supplierGstin}
          onSupplierGstinChange={setSupplierGstin}
          autoBifurcateTax={autoBifurcateTax}
          onAutoBifurcateTaxChange={setAutoBifurcateTax}
          onRun={handleRun}
          isProcessing={progressState.isProcessing}
          progressPercent={progressState.progress}
          processingLabel={
            progressState.stage === 'parsing'
              ? 'Parsing'
              : progressState.stage === 'standardizing'
              ? 'Standardizing'
              : progressState.stage === 'reconciling'
              ? 'Reconciling'
              : progressState.stage === 'finalizing'
              ? 'Finalizing'
              : 'Processing'
          }
          onLoadSample={handleLoadSample}
          onReset={handleReset}
          hasResult={!!result}
          isSampleActive={isSampleActive}
        />

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Header summary={metrics} />

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">{error}</p>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowMappingModal(true)}
                    className="text-xs bg-rose-700 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-rose-800 cursor-pointer shadow-xs"
                  >
                    Open Column Mapper
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results View */}
          {result && metrics ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">Reconciliation Category Breakdown</h2>
                  <p className="text-xs text-slate-500">
                    Select any card below to filter the verified reconciliation table dynamically.
                  </p>
                </div>
              </div>

              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
                <MetricCard
                  label="GSTR-1 Bills"
                  value={metrics.totalGstr}
                  totalCount={metrics.totalGstr}
                  isSelected={filterStatus === 'All'}
                  onClick={() => setFilterStatus('All')}
                  variant="gstr"
                />
                <MetricCard
                  label="E-Way Bills"
                  value={metrics.totalEwb}
                  totalCount={metrics.totalEwb}
                  isSelected={filterStatus === 'All'}
                  onClick={() => setFilterStatus('All')}
                  variant="ewb"
                />
                <MetricCard
                  label="Matched"
                  value={metrics.matched}
                  totalCount={metrics.totalGstr}
                  isSelected={filterStatus === 'Matched'}
                  onClick={() => setFilterStatus('Matched')}
                  variant="matched"
                />
                <MetricCard
                  label="Unmatched"
                  value={metrics.unmatched}
                  totalCount={metrics.totalGstr}
                  isSelected={filterStatus === 'Unmatched'}
                  onClick={() => setFilterStatus('Unmatched')}
                  variant="unmatched"
                />
                <MetricCard
                  label="EWB Missing"
                  value={metrics.ewbNotFound}
                  totalCount={metrics.totalGstr}
                  isSelected={filterStatus === 'E-Way Bill Not Found'}
                  onClick={() => setFilterStatus('E-Way Bill Not Found')}
                  variant="ewbNotFound"
                />
                <MetricCard
                  label="Rule 138 Exempt (< ₹50k)"
                  value={metrics.ewbNotRequired}
                  totalCount={metrics.totalGstr}
                  isSelected={filterStatus === 'E-Way Bill Not Required (< ₹50k)'}
                  onClick={() => setFilterStatus('E-Way Bill Not Required (< ₹50k)')}
                  variant="ewbNotRequired"
                />
                <MetricCard
                  label="Extra E-Way Bills"
                  value={metrics.extraEwb}
                  totalCount={metrics.totalEwb}
                  isSelected={filterStatus === 'Extra E-Way Bill'}
                  onClick={() => setFilterStatus('Extra E-Way Bill')}
                  variant="extraEwb"
                />
                <MetricCard
                  label="Review / Duplicate"
                  value={metrics.reviewDuplicate}
                  totalCount={result.length}
                  isSelected={filterStatus === 'Review - Duplicate'}
                  onClick={() => setFilterStatus('Review - Duplicate')}
                  variant="reviewDuplicate"
                />
              </div>

              {/* Data Table */}
              <DataTable
                items={result}
                currentFilter={filterStatus}
                onFilterChange={setFilterStatus}
                gstrMapping={gstrMapping}
                ewbMapping={ewbMapping}
                onOpenMapping={() => setShowMappingModal(true)}
              />
            </div>
          ) : (
            /* Executive Empty State / Welcome Screen */
            <div className="space-y-6">
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/90 shadow-2xs">
                <div className="max-w-2xl mb-8">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold mb-3 border border-blue-200/60">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Automated Statutory Reconciliation
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    Statutory Sales &amp; E-Way Bill Reconciliation
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                    Cross-examine your GSTR-1 outward supply filings with official E-Way Bill transit records. Instantly detect unbilled dispatches, Rule 138 exemptions, value differences, and potential tax compliance queries.
                  </p>
                </div>

                {/* 3-Pillar Enterprise Workflow */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs mb-3">
                      01
                    </div>
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5">
                      1. Ingest Reports
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Upload GSTR-1 JSON (direct from portal), Excel, CSV, or PDF, plus the E-Way Bill report from the NIC EWB portal (Excel, CSV, or NIC PDF Print).
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs mb-3">
                      02
                    </div>
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5">
                      2. Automated Cross-Verification
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Applies fuzzy invoice matching, date transit gap tolerance (±1–30 days), and segregates non-mandatory &lt; ₹50k shipments.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs mb-3">
                      03
                    </div>
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5">
                      3. Multi-Sheet Export
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Export categorized Excel workbooks with separated sheets for Matched, Unmatched, Missing EWB, and Exemption schedules.
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>In-memory computation. Files never leave your local browser session.</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
                  >
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <span>Load Demo Dataset</span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Manual Column Mapping Modal */}
      <ColumnMappingModal
        isOpen={showMappingModal}
        onClose={() => setShowMappingModal(false)}
        gstrColumns={gstrColumns.length > 0 ? gstrColumns : SAMPLE_GSTR1_DATA.columns}
        ewbColumns={ewbColumns.length > 0 ? ewbColumns : SAMPLE_EWB_DATA.columns}
        initialGstrMapping={
          gstrMapping || {
            invoice_no: null,
            gstin: null,
            date: null,
            taxable: null,
            igst: null,
            cgst: null,
            sgst: null,
            total: null,
          }
        }
        initialEwbMapping={
          ewbMapping || {
            invoice_no: null,
            gstin: null,
            date: null,
            taxable: null,
            igst: null,
            cgst: null,
            sgst: null,
            total: null,
          }
        }
        onApply={handleCustomMappingApply}
      />

      {/* Visual Progress Bar & Spinner Modal for File Parsing & Reconciliation */}
      <ProgressModal state={progressState} />
    </div>
  );
}

export default App;
