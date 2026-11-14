import * as XLSX from 'xlsx-js-style';
import { ColumnMapping, DateToleranceOption, ReconciliationItem, StandardInvoiceRow } from '../types/reconciliation';
import { 
  autoDetectSupplierGstin, 
  autoDetectSupplierStateCode, 
  extractGstStateCode, 
  findCol, 
  getStateNameByCode, 
  parseDateObj, 
  parseNumber, 
  resolvePlaceOfSupplyWithStateName, 
  simplifyInvoiceNo 
} from './fileParser';

export const KNOWN_PARTY_NAMES: Record<string, string> = {
  '27AAPFU0939F1ZV': 'Apex Engineering Pvt Ltd',
  '07AAGCB1234A1Z5': 'Bharat Electronics & Retail',
  '29ABCDE5678F1Z9': 'Crestline Logistics Solutions',
  '33AABCT9999K1Z1': 'Delta Dynamic Tech Corp',
  '06AAACR5544B1Z3': 'Horizon Infrastructure LLP',
  '24AAACH7788C1Z6': 'Zenith Industrial Supplies',
  '19AAACA0000A1Z5': 'Orient Exports & Trading Co.',
  '09AAACC4455D1Z2': 'Shree Balaji Trading Co.',
  '08AABCT7766E1Z4': 'Jaipur Metal Industries',
  '10AABCB9988F1Z6': 'Patna Distribution Network',
  '23AABCK3322G1Z8': 'Central India Traders',
  '36AABCP5544H1Z0': 'Hyderabad Tech Innovations',
  '03AABCS1122J1Z3': 'Punjab Agro Corporation'
};

export function getPartyNameForGstin(gstin: string, rawPartyName?: string | null): string {
  if (rawPartyName && rawPartyName.trim() && rawPartyName.trim().toUpperCase() !== 'NAN') {
    return rawPartyName.trim();
  }
  const cleanG = (gstin || '').trim().toUpperCase();
  if (KNOWN_PARTY_NAMES[cleanG]) {
    return KNOWN_PARTY_NAMES[cleanG];
  }
  if (!cleanG || ['URP', 'EXP', 'NAN', ''].includes(cleanG)) {
    return 'Unregistered / Consumer';
  }
  const stateCode = extractGstStateCode(cleanG);
  const stateName = getStateNameByCode(stateCode) || 'Commercial';
  const panPart = cleanG.length >= 12 ? cleanG.substring(2, 12) : cleanG;
  return `${stateName} Enterprise (${panPart})`;
}

export function standardize(
  rows: any[],
  columns: string[],
  label: 'GSTR-1' | 'E-Way Bill',
  customMapping?: Partial<ColumnMapping>,
  options?: {
    supplierGstin?: string;
    autoBifurcateTax?: boolean;
  }
): { standardized: StandardInvoiceRow[]; mapping: ColumnMapping } {
  const mapping: ColumnMapping = {
    invoice_no: customMapping?.invoice_no ?? findCol(columns, 'invoice_no', label),
    party_name: customMapping?.party_name ?? findCol(columns, 'party_name', label),
    gstin: customMapping?.gstin ?? findCol(columns, 'gstin', label),
    from_gstin: customMapping?.from_gstin ?? findCol(columns, 'from_gstin', label),
    pos: customMapping?.pos ?? findCol(columns, 'pos', label),
    date: customMapping?.date ?? findCol(columns, 'date', label),
    taxable: customMapping?.taxable ?? findCol(columns, 'taxable', label),
    igst: customMapping?.igst ?? findCol(columns, 'igst', label),
    cgst: customMapping?.cgst ?? findCol(columns, 'cgst', label),
    sgst: customMapping?.sgst ?? findCol(columns, 'sgst', label),
    total_tax: customMapping?.total_tax ?? findCol(columns, 'total_tax', label),
    total: customMapping?.total ?? findCol(columns, 'total', label),
  };

  const detectedSupplierGstin = autoDetectSupplierGstin(rows, columns);
  const effectiveSupplierGstin = detectedSupplierGstin || options?.supplierGstin || '';
  const supplierState = autoDetectSupplierStateCode(rows, columns, effectiveSupplierGstin);

  const stdRows: StandardInvoiceRow[] = rows.map((row, idx) => {
    const rawInv = mapping.invoice_no && row[mapping.invoice_no] != null ? String(row[mapping.invoice_no]) : '';
    const cleanInv = rawInv.trim().toUpperCase().replace(/\s+/g, '');
    const cleanInvSimplified = simplifyInvoiceNo(cleanInv);

    let rawParty = mapping.party_name && row[mapping.party_name] != null
      ? String(row[mapping.party_name]).trim()
      : (row.party_name ? String(row.party_name).trim() : (row.party || row.cname || row.trade_name || ''));

    if (!rawParty || rawParty.toUpperCase() === 'NAN') {
      for (const [k, v] of Object.entries(row)) {
        if (v != null && String(v).trim() && String(v).trim().toUpperCase() !== 'NAN') {
          const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (
            normK === 'receivername' ||
            normK === 'recipientname' ||
            normK === 'tradename' ||
            normK === 'legalname' ||
            normK === 'tradelegalname' ||
            normK === 'partytradelegalname' ||
            normK === 'partyname' ||
            normK === 'customername' ||
            normK === 'buyername' ||
            normK === 'consigneename' ||
            normK === 'particulars' ||
            normK === 'cname' ||
            normK === 'lgnm' ||
            normK === 'party' ||
            normK === 'customer' ||
            normK === 'buyer'
          ) {
            rawParty = String(v).trim();
            break;
          }
        }
      }
    }

    const rawGstin = mapping.gstin && row[mapping.gstin] != null ? String(row[mapping.gstin]) : '';
    const cleanGstin = rawGstin.trim().toUpperCase();

    const rowFromGstin = mapping.from_gstin && row[mapping.from_gstin] != null
      ? String(row[mapping.from_gstin]).trim().toUpperCase()
      : (row.from_gstin ? String(row.from_gstin).trim().toUpperCase() : effectiveSupplierGstin);

    const rowPos = mapping.pos && row[mapping.pos] != null
      ? String(row[mapping.pos]).trim()
      : (row.pos ? String(row.pos).trim() : '');

    const rawDate = mapping.date ? row[mapping.date] : null;
    const { formatted: formattedDate, dateObj: parsedDate } = parseDateObj(rawDate);

    const taxable = mapping.taxable ? parseNumber(row[mapping.taxable]) : 0.0;
    let igst = mapping.igst ? parseNumber(row[mapping.igst]) : 0.0;
    let cgst = mapping.cgst ? parseNumber(row[mapping.cgst]) : 0.0;
    let sgst = mapping.sgst ? parseNumber(row[mapping.sgst]) : 0.0;
    const total = mapping.total ? parseNumber(row[mapping.total]) : 0.0;

    // Resilient fallback for SGST / State-UT Tax if unmapped or returned 0
    if (sgst === 0) {
      for (const [k, v] of Object.entries(row)) {
        if (v != null && v !== '') {
          const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (
            (normK.includes('state') || normK.includes('sgst') || normK.includes('utgst') || normK === 'samt') &&
            !normK.includes('place') && !normK.includes('pos') && !normK.includes('consignee') && !normK.includes('supplier')
          ) {
            const p = parseNumber(v);
            if (p > 0) {
              sgst = p;
              break;
            }
          }
        }
      }
    }

    // Resilient fallback for CGST / Central Tax if unmapped or returned 0
    if (cgst === 0) {
      for (const [k, v] of Object.entries(row)) {
        if (v != null && v !== '') {
          const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (
            (normK.includes('central') || normK.includes('cgst') || normK === 'camt') &&
            !normK.includes('place') && !normK.includes('pos') && !normK.includes('consignee') && !normK.includes('supplier')
          ) {
            const p = parseNumber(v);
            if (p > 0) {
              cgst = p;
              break;
            }
          }
        }
      }
    }

    // Resilient fallback for IGST / Integrated Tax if unmapped or returned 0
    if (igst === 0) {
      for (const [k, v] of Object.entries(row)) {
        if (v != null && v !== '') {
          const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (
            (normK.includes('integrated') || normK.includes('igst') || normK === 'iamt') &&
            !normK.includes('place') && !normK.includes('pos') && !normK.includes('consignee') && !normK.includes('supplier')
          ) {
            const p = parseNumber(v);
            if (p > 0) {
              igst = p;
              break;
            }
          }
        }
      }
    }

    // Statutory intra-state parity rule: In Indian GST, Central Tax (CGST) and State Tax (SGST) are legally equal for Intra-state supplies.
    if (cgst > 0 && sgst === 0 && igst === 0) {
      if (total > 0 && taxable > 0 && Math.abs((taxable + cgst * 2) - total) <= 1.0) {
        sgst = cgst;
      }
    } else if (sgst > 0 && cgst === 0 && igst === 0) {
      if (total > 0 && taxable > 0 && Math.abs((taxable + sgst * 2) - total) <= 1.0) {
        cgst = sgst;
      }
    }

    // Combined total tax column if provided in file
    const explicitTotalTax = mapping.total_tax ? parseNumber(row[mapping.total_tax]) : 0.0;
    let totalTax = explicitTotalTax > 0 ? explicitTotalTax : (igst + cgst + sgst);
    if (totalTax <= 0 && total > taxable && taxable > 0) {
      totalTax = Math.round((total - taxable) * 100) / 100;
    }

    let isBifurcated = false;
    let supplyType: 'Intra-State' | 'Inter-State' | undefined = undefined;

    // Automatic bifurcation for E-Way Bill files based on Supplier GSTIN and POS / Buyer GSTIN
    if (label === 'E-Way Bill' && options?.autoBifurcateTax !== false && totalTax > 0) {
      const rowSupplierState = extractGstStateCode(rowFromGstin) || supplierState;
      const buyerState = extractGstStateCode(rowPos) || extractGstStateCode(cleanGstin);

      if (rowSupplierState && buyerState) {
        if (rowSupplierState === buyerState) {
          // Intra-State supply: Tax must be 50% CGST + 50% SGST
          supplyType = 'Intra-State';
          cgst = Math.round((totalTax / 2) * 100) / 100;
          sgst = Math.round((totalTax - cgst) * 100) / 100;
          igst = 0.0;
          isBifurcated = true;
        } else {
          // Inter-State supply: Tax must be 100% IGST
          supplyType = 'Inter-State';
          igst = Math.round(totalTax * 100) / 100;
          cgst = 0.0;
          sgst = 0.0;
          isBifurcated = true;
        }
      } else if (cgst > 0 || sgst > 0) {
        supplyType = 'Intra-State';
      } else if (igst > 0) {
        supplyType = 'Inter-State';
      }
    } else if (cgst > 0 || sgst > 0) {
      supplyType = 'Intra-State';
    } else if (igst > 0) {
      supplyType = 'Inter-State';
    }

    return {
      invoice_no: cleanInv,
      clean_inv_no: cleanInvSimplified,
      party_name: rawParty,
      gstin: cleanGstin,
      from_gstin: rowFromGstin,
      date: formattedDate,
      parsed_date: parsedDate,
      taxable,
      igst,
      cgst,
      sgst,
      total_tax: totalTax,
      total,
      source_row: idx + 2,
      source: label,
      section: row.section,
      pos: rowPos || row.pos,
      inv_typ: row.inv_typ,
      is_bifurcated: isBifurcated,
      supply_type: supplyType
    };
  });

  // If GSTR-1, aggregate multi-item rows for the same invoice
  if (label === 'GSTR-1' && stdRows.length > 0) {
    const validRows = stdRows.filter(r => r.invoice_no !== '' && r.invoice_no !== 'NAN');
    const invalidRows = stdRows.filter(r => r.invoice_no === '' || r.invoice_no === 'NAN');

    const groupedMap = new Map<string, StandardInvoiceRow[]>();
    for (const r of validRows) {
      const gKey = `${r.gstin}|${r.invoice_no}`;
      if (!groupedMap.has(gKey)) {
        groupedMap.set(gKey, []);
      }
      groupedMap.get(gKey)!.push(r);
    }

    const aggregated: StandardInvoiceRow[] = [];
    for (const [, list] of groupedMap.entries()) {
      const first = list[0];
      const sumTaxable = list.reduce((acc, x) => acc + x.taxable, 0);
      const sumIgst = list.reduce((acc, x) => acc + x.igst, 0);
      const sumCgst = list.reduce((acc, x) => acc + x.cgst, 0);
      const sumSgst = list.reduce((acc, x) => acc + x.sgst, 0);

      const uniqueTotals = Array.from(new Set(list.map(x => x.total)));
      let computedTotal = (uniqueTotals.length === 1 && uniqueTotals[0] > 0)
        ? uniqueTotals[0]
        : Math.max(...list.map(x => x.total));

      if (computedTotal <= 0) {
        computedTotal = sumTaxable + sumIgst + sumCgst + sumSgst;
      }

      const rowNums = list.map(x => x.source_row).join(', ');

      aggregated.push({
        invoice_no: first.invoice_no,
        clean_inv_no: first.clean_inv_no,
        party_name: first.party_name,
        gstin: first.gstin,
        from_gstin: first.from_gstin,
        date: first.date,
        parsed_date: first.parsed_date,
        taxable: sumTaxable,
        igst: sumIgst,
        cgst: sumCgst,
        sgst: sumSgst,
        total_tax: sumIgst + sumCgst + sumSgst,
        total: computedTotal,
        source_row: rowNums,
        source: 'GSTR-1',
        section: first.section,
        pos: first.pos,
        inv_typ: first.inv_typ,
        supply_type: (sumCgst > 0 || sumSgst > 0) ? 'Intra-State' : 'Inter-State'
      });
    }

    return { standardized: [...aggregated, ...invalidRows], mapping };
  }

  return { standardized: stdRows, mapping };
}

export function makeKey(row: StandardInvoiceRow): string {
  const g = (row.gstin || '').toLowerCase();
  const prefix = (row.gstin && !['nan', 'urp', 'exp', ''].includes(g)) ? `${row.gstin}|` : '';
  return prefix + row.invoice_no;
}

export function reconcile(
  gstrRows: StandardInvoiceRow[],
  ewbRows: StandardInvoiceRow[],
  tolerance = 1.0,
  dateToleranceDays: DateToleranceOption = 0,
  ewbExemptionThreshold = 50000,
  options?: {
    autoBifurcateTax?: boolean;
    supplierGstin?: string;
  }
): ReconciliationItem[] {
  const g = gstrRows
    .filter(r => r.invoice_no !== '')
    .map(r => ({ ...r, key: makeKey(r) }));

  const e = ewbRows
    .filter(r => r.invoice_no !== '')
    .map(r => ({ ...r, key: makeKey(r) }));

  // Track duplicated keys within GSTR-1
  const gKeyCounts = new Map<string, number>();
  for (const r of g) {
    gKeyCounts.set(r.key, (gKeyCounts.get(r.key) || 0) + 1);
  }
  const gDuplicates = new Set<string>();
  for (const [k, count] of gKeyCounts.entries()) {
    if (count > 1) gDuplicates.add(k);
  }

  // Available E-Way Bills (with original index for unambiguous matching)
  interface EwbIndexedItem {
    row: StandardInvoiceRow & { key: string };
    index: number;
    matched: boolean;
  }

  const ewbItems: EwbIndexedItem[] = e.map((row, idx) => ({
    row,
    index: idx,
    matched: false,
  }));

  // Identify Supplier State across all GSTR-1 and EWB records:
  const allSupplierGstin =
    options?.supplierGstin ||
    ewbRows.find(r => r.from_gstin)?.from_gstin ||
    gstrRows.find(r => r.from_gstin)?.from_gstin ||
    '';

  let globalSupplierState = extractGstStateCode(allSupplierGstin);

  if (!globalSupplierState) {
    // If not found in from_gstin, infer from any Intra-State supply in GSTR-1:
    // In GST, if CGST and SGST are charged, the recipient's state code IS the supplier's state code!
    for (const gr of gstrRows) {
      if (gr.cgst > 0 && gr.sgst > 0) {
        const state = extractGstStateCode(gr.pos) || extractGstStateCode(gr.gstin);
        if (state) {
          globalSupplierState = state;
          break;
        }
      }
    }
  }

  // Build a lookup map of GSTIN -> Party Name directly from the GSTR-1 dataset:
  // User Requirement: "party name Gstin se match kar ke GSTR 1 report se pick kar lo"
  const gstrPartyNameByGstin = new Map<string, string>();
  for (const gr of gstrRows) {
    const cleanGstin = (gr.gstin || '').trim().toUpperCase();
    const pName = (gr.party_name || '').trim();
    if (cleanGstin && cleanGstin !== 'URP' && pName && pName.toUpperCase() !== 'NAN') {
      if (!gstrPartyNameByGstin.has(cleanGstin)) {
        gstrPartyNameByGstin.set(cleanGstin, pName);
      }
    }
  }

  const rows: ReconciliationItem[] = [];

  for (const gr of g) {
    const isGDuplicate = gDuplicates.has(gr.key);

    // Multi-tiered search for corresponding E-Way bill:
    let matchedEwbItem: EwbIndexedItem | null = null;

    // Strategy 1: Exact Key (GSTIN + Invoice No)
    const exactKeyMatches = ewbItems.filter(item => !item.matched && item.row.key === gr.key);
    if (exactKeyMatches.length > 0) {
      // Pick best amount match if multiple
      matchedEwbItem = exactKeyMatches.reduce((best, cur) => {
        const curDiff = Math.abs(cur.row.total - gr.total);
        const bestDiff = Math.abs(best.row.total - gr.total);
        return curDiff < bestDiff ? cur : best;
      }, exactKeyMatches[0]);
    }

    // Strategy 2: Exact GSTIN + Clean Simplified Invoice No (e.g. INV-001 vs INV/001)
    if (!matchedEwbItem && gr.gstin && !['urp', 'exp', 'nan', ''].includes(gr.gstin.toLowerCase())) {
      const gstinSimplifiedMatches = ewbItems.filter(
        item => !item.matched &&
          item.row.gstin === gr.gstin &&
          item.row.clean_inv_no &&
          gr.clean_inv_no &&
          item.row.clean_inv_no === gr.clean_inv_no
      );
      if (gstinSimplifiedMatches.length > 0) {
        matchedEwbItem = gstinSimplifiedMatches[0];
      }
    }

    // Strategy 3: Invoice Number Match (exact string)
    if (!matchedEwbItem) {
      const invMatches = ewbItems.filter(item => !item.matched && item.row.invoice_no === gr.invoice_no);
      if (invMatches.length > 0) {
        // Prefer one where GSTIN matches or is empty, or closest amount
        matchedEwbItem = invMatches.reduce((best, cur) => {
          const curGstinMatch = cur.row.gstin === gr.gstin;
          const bestGstinMatch = best.row.gstin === gr.gstin;
          if (curGstinMatch && !bestGstinMatch) return cur;
          if (!curGstinMatch && bestGstinMatch) return best;
          const curDiff = Math.abs(cur.row.total - gr.total);
          const bestDiff = Math.abs(best.row.total - gr.total);
          return curDiff < bestDiff ? cur : best;
        }, invMatches[0]);
      }
    }

    // Strategy 4: Simplified Invoice Number Match (stripping -, /, leading zeros)
    if (!matchedEwbItem && gr.clean_inv_no) {
      const simplifiedMatches = ewbItems.filter(
        item => !item.matched && item.row.clean_inv_no === gr.clean_inv_no
      );
      if (simplifiedMatches.length > 0) {
        matchedEwbItem = simplifiedMatches.reduce((best, cur) => {
          const curDiff = Math.abs(cur.row.total - gr.total);
          const bestDiff = Math.abs(best.row.total - gr.total);
          return curDiff < bestDiff ? cur : best;
        }, simplifiedMatches[0]);
      }
    }

    let status: ReconciliationItem['Status'];
    let reason = '';
    let er: StandardInvoiceRow | null = null;

    if (isGDuplicate) {
      status = 'Review - Duplicate';
      reason = 'Duplicate invoice number & GSTIN detected in GSTR-1';
      if (matchedEwbItem) {
        matchedEwbItem.matched = true;
        er = matchedEwbItem.row;
      }
    } else if (!matchedEwbItem) {
      // E-Way Bill Not Found in uploaded report
      // Check Rule 138: Under GST, E-Way Bill is NOT required if invoice value is below threshold
      const invoiceVal = gr.total > 0 ? gr.total : gr.taxable;
      if (invoiceVal > 0 && invoiceVal < ewbExemptionThreshold) {
        status = 'E-Way Bill Not Required (< ₹50k)';
        reason = `Invoice value (₹${invoiceVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) is below ₹${ewbExemptionThreshold.toLocaleString('en-IN')}; E-Way Bill is not legally mandatory under GST Rule 138.`;
      } else {
        status = 'E-Way Bill Not Found';
        reason = `No corresponding invoice found in E-Way Bill report (Invoice value ₹${invoiceVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} requires E-Way Bill).`;
      }
    } else {
      matchedEwbItem.matched = true;
      er = { ...matchedEwbItem.row };

      // Statutory Tax Bifurcation Engine for E-Way Bill:
      // In GST, E-Way Bill often reports a combined "Total Tax" amount or lumps taxes together.
      // We bifurcate EWB total tax into 50% CGST + 50% SGST (Intra-state) or 100% IGST (Inter-state)
      // strictly following statutory GST rules:
      // 1. If GSTR-1 has CGST > 0 or SGST > 0 -> unequivocally Intra-State! EWB tax is 50% CGST + 50% SGST.
      // 2. If GSTR-1 has IGST > 0 and no CGST/SGST -> unequivocally Inter-State! EWB tax is 100% IGST.
      // 3. Otherwise, compare Supplier State with Place of Supply (POS) / Buyer GSTIN state.
      if (options?.autoBifurcateTax !== false && er) {
        let ewbTotalTax = (er.total_tax && er.total_tax > 0)
          ? er.total_tax
          : ((er.igst + er.cgst + er.sgst) > 0 ? (er.igst + er.cgst + er.sgst) : (er.total > er.taxable ? Math.round((er.total - er.taxable) * 100) / 100 : 0));

        if (ewbTotalTax > 0) {
          const isGrIntra = (gr.cgst > 0 || gr.sgst > 0);
          const isGrInter = (gr.igst > 0 && gr.cgst === 0 && gr.sgst === 0);

          let isIntraState = false;
          if (isGrIntra) {
            isIntraState = true;
          } else if (isGrInter) {
            isIntraState = false;
          } else {
            const rowSupplierState = extractGstStateCode(er.from_gstin) || extractGstStateCode(gr.from_gstin) || globalSupplierState;
            const buyerState = extractGstStateCode(gr.pos) || extractGstStateCode(er.pos) || extractGstStateCode(gr.gstin) || extractGstStateCode(er.gstin);
            if (rowSupplierState && buyerState) {
              isIntraState = (rowSupplierState === buyerState);
            }
          }

          if (isIntraState) {
            // Intra-State: 50% CGST + 50% SGST
            er.cgst = Math.round((ewbTotalTax / 2) * 100) / 100;
            er.sgst = Math.round((ewbTotalTax - er.cgst) * 100) / 100;
            er.igst = 0.0;
            er.is_bifurcated = true;
            er.supply_type = 'Intra-State';
          } else {
            // Inter-State: 100% IGST
            er.igst = ewbTotalTax;
            er.cgst = 0.0;
            er.sgst = 0.0;
            er.is_bifurcated = true;
            er.supply_type = 'Inter-State';
          }
        }
      }

      const diffs: string[] = [];
      let dayDiff: number | null = null;

      // 1. Date comparison with tolerance
      if (dateToleranceDays !== -1) {
        if (gr.parsed_date && er.parsed_date) {
          dayDiff = Math.round(Math.abs(gr.parsed_date.getTime() - er.parsed_date.getTime()) / 86400000);
          if (dayDiff > dateToleranceDays) {
            diffs.push(`Date mismatch (GSTR-1: ${gr.date} vs EWB: ${er.date}, gap: ${dayDiff} day${dayDiff > 1 ? 's' : ''})`);
          }
        } else if (gr.date && er.date && gr.date !== er.date && dateToleranceDays === 0) {
          diffs.push(`Date mismatch (GSTR-1: ${gr.date} vs EWB: ${er.date})`);
        }
      }

      // 2. Total Invoice Value comparison (Ignore up to ₹1.00 difference per statutory round-off requirement)
      const hasGrTotal = gr.total > 0;
      const hasErTotal = er.total > 0;
      const invoiceValTolerance = Math.max(1.0, tolerance);
      let totalDiff = 0;
      if (hasGrTotal && hasErTotal) {
        totalDiff = Math.abs(gr.total - er.total);
        if (totalDiff > invoiceValTolerance) {
          diffs.push(`Invoice value diff: ₹${totalDiff.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (GSTR-1: ₹${gr.total.toLocaleString('en-IN')} vs EWB: ₹${er.total.toLocaleString('en-IN')})`);
        }
      }

      // 3. Taxable Value comparison
      const hasGrTaxable = gr.taxable > 0;
      const hasErTaxable = er.taxable > 0;
      let taxDiff = 0;
      if (hasGrTaxable && hasErTaxable) {
        taxDiff = Math.abs(gr.taxable - er.taxable);
        if (taxDiff > invoiceValTolerance) {
          diffs.push(`Taxable value diff: ₹${taxDiff.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (GSTR-1: ₹${gr.taxable.toLocaleString('en-IN')} vs EWB: ₹${er.taxable.toLocaleString('en-IN')})`);
        }
      }

      // 4. Tax components (IGST, CGST, SGST) comparison
      const taxComponents: Array<{ key: 'igst' | 'cgst' | 'sgst'; title: string }> = [
        { key: 'igst', title: 'IGST' },
        { key: 'cgst', title: 'CGST' },
        { key: 'sgst', title: 'SGST' }
      ];

      for (const { key, title } of taxComponents) {
        const a = gr[key];
        const b = er[key];
        // Only trigger discrepancy if both have values or if variance exceeds ₹1.00
        if ((a > 0 || b > 0) && Math.abs(a - b) > invoiceValTolerance) {
          diffs.push(`${title} diff: ₹${Math.abs(a - b).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        }
      }

      if (diffs.length > 0) {
        status = 'Unmatched';
        reason = diffs.join('; ');
      } else {
        status = 'Matched';
        const hasRoundoff = (totalDiff > 0.01 && totalDiff <= invoiceValTolerance) || (taxDiff > 0.01 && taxDiff <= invoiceValTolerance);
        if (dayDiff != null && dayDiff > 0 && dateToleranceDays > 0) {
          reason = `Exact match within tolerance (Date gap: ${dayDiff}d; ${hasRoundoff ? '₹1 round-off ignored' : 'value matched'})`;
        } else if (hasRoundoff) {
          reason = er.is_bifurcated
            ? `Exact match (E-Way Bill tax bifurcated; ₹${totalDiff.toFixed(2)} round-off difference ignored)`
            : `Exact match (₹${totalDiff.toFixed(2)} round-off difference ignored per GST rules)`;
        } else {
          reason = er.is_bifurcated
            ? 'Exact match (E-Way Bill tax bifurcated by GSTIN & POS)'
            : 'Exact match within tolerance limit';
        }
      }
    }

    // Calculate differences (GSTR-1 minus E-Way Bill)
    // Rule: Any difference up to ₹1.00 is treated as statutory round-off and ignored (recorded as 0.00)
    const calcDiff = (a: number | null, b: number | null, ignoreLimit = 1.0): number | null => {
      if (a == null && b == null) return null;
      const valA = a ?? 0;
      const valB = b ?? 0;
      const rawDiff = Math.round((valA - valB) * 100) / 100;
      if (Math.abs(rawDiff) <= ignoreLimit) {
        return 0.0;
      }
      return rawDiff;
    };

    const diffTaxable = calcDiff(gr.taxable, er ? er.taxable : null);
    const diffIgst = calcDiff(gr.igst, er ? er.igst : null);
    const diffCgst = calcDiff(gr.cgst, er ? er.cgst : null);
    const diffSgst = calcDiff(gr.sgst, er ? er.sgst : null);
    const diffTotal = calcDiff(gr.total, er ? er.total : null);

    const cleanGstin = (gr.gstin || '').trim().toUpperCase();
    // Prioritize Party Name picked directly from GSTR-1 report by matching GSTIN
    const gstrReportParty = (gr.party_name && gr.party_name.trim() && gr.party_name.trim().toUpperCase() !== 'NAN')
      ? gr.party_name.trim()
      : (cleanGstin ? gstrPartyNameByGstin.get(cleanGstin) : null);

    const partyName = gstrReportParty || (er?.party_name?.trim() && er.party_name.trim().toUpperCase() !== 'NAN' ? er.party_name.trim() : null) || getPartyNameForGstin(cleanGstin, null);
    const gstrPos = resolvePlaceOfSupplyWithStateName(gr.pos, gr.gstin);
    const ewbPos = er ? resolvePlaceOfSupplyWithStateName(er.pos, er.gstin) : gstrPos;

    rows.push({
      'Status': status,
      'Reason': reason,
      'Party Name': partyName,
      'Particulars / Party Name': partyName,
      'Invoice No.': gr.invoice_no,
      'GSTIN': gr.gstin,
      'Place of Supply': gstrPos,
      'EWB Place of Supply': ewbPos,
      'Supply Type': gr.supply_type || (er ? er.supply_type : null),
      'Tax Bifurcated': er?.is_bifurcated ?? false,
      // GSTR-1 Data (Left Block)
      'GSTR-1 Date': gr.date,
      'GSTR-1 Taxable': gr.taxable,
      'GSTR-1 IGST': gr.igst,
      'GSTR-1 CGST': gr.cgst,
      'GSTR-1 SGST': gr.sgst,
      'GSTR-1 Invoice Value': gr.total,
      // E-Way Bill Data (Right Block)
      'E-Way Bill Date': er ? er.date : null,
      'EWB Taxable': er ? er.taxable : null,
      'EWB IGST': er ? er.igst : null,
      'EWB CGST': er ? er.cgst : null,
      'EWB SGST': er ? er.sgst : null,
      'EWB Invoice Value': er ? er.total : null,
      // Variance / Differences
      'Diff Taxable': diffTaxable,
      'Diff IGST': diffIgst,
      'Diff CGST': diffCgst,
      'Diff SGST': diffSgst,
      'Diff Invoice Value': diffTotal,
      // Audit references
      'GSTR-1 Source Row': gr.source_row,
      'EWB Source Row': er ? er.source_row : null,
    });
  }

  // Extra E-Way Bills (in EWB file but never matched to any GSTR-1 invoice)
  for (const item of ewbItems) {
    if (!item.matched) {
      const er = { ...item.row };

      if (options?.autoBifurcateTax !== false) {
        let ewbTotalTax = (er.total_tax && er.total_tax > 0)
          ? er.total_tax
          : ((er.igst + er.cgst + er.sgst) > 0 ? (er.igst + er.cgst + er.sgst) : (er.total > er.taxable ? Math.round((er.total - er.taxable) * 100) / 100 : 0));

        if (ewbTotalTax > 0 && !er.is_bifurcated) {
          const rowSupplierState = extractGstStateCode(er.from_gstin) || globalSupplierState;
          const buyerState = extractGstStateCode(er.pos) || extractGstStateCode(er.gstin);
          if (rowSupplierState && buyerState) {
            if (rowSupplierState === buyerState) {
              er.cgst = Math.round((ewbTotalTax / 2) * 100) / 100;
              er.sgst = Math.round((ewbTotalTax - er.cgst) * 100) / 100;
              er.igst = 0.0;
              er.is_bifurcated = true;
              er.supply_type = 'Intra-State';
            } else {
              er.igst = ewbTotalTax;
              er.cgst = 0.0;
              er.sgst = 0.0;
              er.is_bifurcated = true;
              er.supply_type = 'Inter-State';
            }
          }
        }
      }

      const diffTaxable = Math.round((0 - (er.taxable || 0)) * 100) / 100;
      const diffIgst = Math.round((0 - (er.igst || 0)) * 100) / 100;
      const diffCgst = Math.round((0 - (er.cgst || 0)) * 100) / 100;
      const diffSgst = Math.round((0 - (er.sgst || 0)) * 100) / 100;
      const diffTotal = Math.round((0 - (er.total || 0)) * 100) / 100;

      const cleanGstin = (er.gstin || '').trim().toUpperCase();
      // Look up party name in GSTR-1 report by matching GSTIN:
      const gstrReportParty = cleanGstin ? gstrPartyNameByGstin.get(cleanGstin) : null;
      const partyName = gstrReportParty || (er.party_name?.trim() && er.party_name.trim().toUpperCase() !== 'NAN' ? er.party_name.trim() : null) || getPartyNameForGstin(cleanGstin, null);
      const ewbPos = resolvePlaceOfSupplyWithStateName(er.pos, er.gstin);

      rows.push({
        'Status': 'Extra E-Way Bill',
        'Reason': 'Invoice exists in E-Way Bill report but not in GSTR-1 outward filing',
        'Party Name': partyName,
        'Particulars / Party Name': partyName,
        'Invoice No.': er.invoice_no,
        'GSTIN': er.gstin,
        'Place of Supply': ewbPos,
        'EWB Place of Supply': ewbPos,
        'Supply Type': er.supply_type || null,
        'Tax Bifurcated': er.is_bifurcated ?? false,
        // GSTR-1 Data (Left Block - Empty)
        'GSTR-1 Date': null,
        'GSTR-1 Taxable': null,
        'GSTR-1 IGST': null,
        'GSTR-1 CGST': null,
        'GSTR-1 SGST': null,
        'GSTR-1 Invoice Value': null,
        // E-Way Bill Data (Right Block)
        'E-Way Bill Date': er.date,
        'EWB Taxable': er.taxable,
        'EWB IGST': er.igst,
        'EWB CGST': er.cgst,
        'EWB SGST': er.sgst,
        'EWB Invoice Value': er.total,
        // Variance / Differences
        'Diff Taxable': diffTaxable,
        'Diff IGST': diffIgst,
        'Diff CGST': diffCgst,
        'Diff SGST': diffSgst,
        'Diff Invoice Value': diffTotal,
        // Audit references
        'GSTR-1 Source Row': null,
        'EWB Source Row': er.source_row,
      });
    }
  }

  return rows;
}

/**
 * Creates a structured side-by-side reconciliation sheet strictly matching the PDF format with executive colors:
 * - Row 1 Super-Headers: Status | Reason | Party Name | GSTIN | Invoice No. | As Per GSTR-1 | As Per E-Way Bill Report | Difference | GSTR-1 Source Row | EWB Source Row
 * - Row 2 Sub-Headers:
 *   - Under As Per GSTR-1: Date, Invoice Value, Taxable, IGST, CGST, SGST, Place of Supply
 *   - Under As Per E-Way Bill Report: Bill Date, Invoice Value, Taxable, IGST, CGST, SGST, Place of Supply
 *   - Under Difference: Invoice Value, Taxable, IGST, CGST, SGST, Place of Supply
 * - Rule: Difference <= ₹1.00 is ignored and recorded as 0.00
 * - Styling: High-contrast executive palette (Navy, Royal Blue, Indigo, Amber, Mint Green, Rose)
 */
export function createSideBySideReconciliationSheet(items: ReconciliationItem[]): XLSX.WorkSheet {
  const aoa: any[][] = [];

  // Super Header Row 1 (Merged groups according to format.pdf)
  aoa.push([
    'Status',
    'Reason',
    'Party Name',
    'GSTIN',
    'Invoice No.',
    'As Per GSTR-1', '', '', '', '', '', '',
    'As Per E-Way Bill Report', '', '', '', '', '', '',
    'Difference', '', '', '', '', '',
    'GSTR-1 Source Row',
    'EWB Source Row'
  ]);

  // Column Sub-Header Row 2
  aoa.push([
    'Status',
    'Reason',
    'Party Name',
    'GSTIN',
    'Invoice No.',
    // As Per GSTR-1
    'Date',
    'Invoice Value',
    'Taxable',
    'IGST',
    'CGST',
    'SGST',
    'Place of Supply',
    // As Per E-Way Bill Report
    'Bill Date',
    'Invoice Value',
    'Taxable',
    'IGST',
    'CGST',
    'SGST',
    'Place of Supply',
    // Difference
    'Invoice Value',
    'Taxable',
    'IGST',
    'CGST',
    'SGST',
    'Place of Supply',
    // Audit Row Reference
    'GSTR-1 Source Row',
    'EWB Source Row'
  ]);

  // Data rows
  for (const item of items) {
    // If difference in invoice value or tax is <= ₹1.00, statutory round-off is ignored (set to 0.00)
    const formatDiffNum = (v: number | null): number | string => {
      if (v == null) return '';
      if (Math.abs(v) <= 1.0) return 0.0;
      return v;
    };

    const gstrPos = resolvePlaceOfSupplyWithStateName(item['Place of Supply'], item.GSTIN);
    const ewbPos = resolvePlaceOfSupplyWithStateName(item['EWB Place of Supply'], item.GSTIN);
    let diffPos = '-';
    if (gstrPos !== '-' && ewbPos !== '-' && gstrPos !== ewbPos) {
      diffPos = 'POS Mismatch';
    }

    aoa.push([
      item.Status,
      item.Reason,
      item['Party Name'] || item['Particulars / Party Name'] || '',
      item.GSTIN,
      item['Invoice No.'],
      // As Per GSTR-1
      item['GSTR-1 Date'] || '',
      item['GSTR-1 Invoice Value'] != null ? item['GSTR-1 Invoice Value'] : '',
      item['GSTR-1 Taxable'] != null ? item['GSTR-1 Taxable'] : '',
      item['GSTR-1 IGST'] != null ? item['GSTR-1 IGST'] : '',
      item['GSTR-1 CGST'] != null ? item['GSTR-1 CGST'] : '',
      item['GSTR-1 SGST'] != null ? item['GSTR-1 SGST'] : '',
      gstrPos,
      // As Per E-Way Bill Report
      item['E-Way Bill Date'] || '',
      item['EWB Invoice Value'] != null ? item['EWB Invoice Value'] : '',
      item['EWB Taxable'] != null ? item['EWB Taxable'] : '',
      item['EWB IGST'] != null ? item['EWB IGST'] : '',
      item['EWB CGST'] != null ? item['EWB CGST'] : '',
      item['EWB SGST'] != null ? item['EWB SGST'] : '',
      ewbPos,
      // Difference (<= ₹1.00 difference is ignored / set to 0.0)
      formatDiffNum(item['Diff Invoice Value']),
      formatDiffNum(item['Diff Taxable']),
      formatDiffNum(item['Diff IGST']),
      formatDiffNum(item['Diff CGST']),
      formatDiffNum(item['Diff SGST']),
      diffPos,
      // Source Row References
      item['GSTR-1 Source Row'] != null ? item['GSTR-1 Source Row'] : '',
      item['EWB Source Row'] != null ? item['EWB Source Row'] : '',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Set merged headers strictly matching PDF structure
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },   // A1:A2 Status
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },   // B1:B2 Reason
    { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },   // C1:C2 Party Name
    { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },   // D1:D2 GSTIN
    { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },   // E1:E2 Invoice No.
    { s: { r: 0, c: 5 }, e: { r: 0, c: 11 } },  // F1:L1 As Per GSTR-1
    { s: { r: 0, c: 12 }, e: { r: 0, c: 18 } }, // M1:S1 As Per E-Way Bill Report
    { s: { r: 0, c: 19 }, e: { r: 0, c: 24 } }, // T1:Y1 Difference
    { s: { r: 0, c: 25 }, e: { r: 1, c: 25 } }, // Z1:Z2 GSTR-1 Source Row
    { s: { r: 0, c: 26 }, e: { r: 1, c: 26 } }, // AA1:AA2 EWB Source Row
  ];

  // Specific widths to avoid truncation or ### display
  ws['!cols'] = [
    { wch: 18 }, // Status
    { wch: 44 }, // Reason
    { wch: 30 }, // Party Name
    { wch: 18 }, // GSTIN
    { wch: 18 }, // Invoice No.
    // As Per GSTR-1
    { wch: 13 }, // Date
    { wch: 18 }, // Invoice Value
    { wch: 16 }, // Taxable
    { wch: 14 }, // IGST
    { wch: 14 }, // CGST
    { wch: 14 }, // SGST
    { wch: 20 }, // Place of Supply
    // As Per E-Way Bill Report
    { wch: 13 }, // Bill Date
    { wch: 18 }, // Invoice Value
    { wch: 16 }, // Taxable
    { wch: 14 }, // IGST
    { wch: 14 }, // CGST
    { wch: 14 }, // SGST
    { wch: 20 }, // Place of Supply
    // Difference
    { wch: 18 }, // Invoice Value
    { wch: 16 }, // Taxable
    { wch: 14 }, // IGST
    { wch: 14 }, // CGST
    { wch: 14 }, // SGST
    { wch: 18 }, // Place of Supply
    // Source Row References
    { wch: 14 }, // GSTR-1 Source Row
    { wch: 14 }, // EWB Source Row
  ];

  // Apply Executive Colors & Styling
  const thinBorder = {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } },
  };

  // Header styles for Row 1 (Super-headers)
  const superStyles: Record<string, any> = {
    doc: {
      fill: { fgColor: { rgb: '1E293B' } }, // Slate-800
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder
    },
    gstr: {
      fill: { fgColor: { rgb: '1D4ED8' } }, // Blue-700
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder
    },
    ewb: {
      fill: { fgColor: { rgb: '4338CA' } }, // Indigo-700
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder
    },
    diff: {
      fill: { fgColor: { rgb: 'B45309' } }, // Amber-700
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder
    },
    src: {
      fill: { fgColor: { rgb: '334155' } }, // Slate-700
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder
    }
  };

  // Sub-header styles for Row 2
  const subStyles: Record<string, any> = {
    doc: {
      fill: { fgColor: { rgb: 'F1F5F9' } }, // Slate-100
      font: { color: { rgb: '0F172A' }, bold: true, sz: 10, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: thinBorder
    },
    gstr: {
      fill: { fgColor: { rgb: 'DBEAFE' } }, // Blue-100
      font: { color: { rgb: '1E3A8A' }, bold: true, sz: 10, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: thinBorder
    },
    ewb: {
      fill: { fgColor: { rgb: 'E0E7FF' } }, // Indigo-100
      font: { color: { rgb: '312E81' }, bold: true, sz: 10, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: thinBorder
    },
    diff: {
      fill: { fgColor: { rgb: 'FEF3C7' } }, // Amber-100
      font: { color: { rgb: '78350F' }, bold: true, sz: 10, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: thinBorder
    },
    src: {
      fill: { fgColor: { rgb: 'F1F5F9' } },
      font: { color: { rgb: '334155' }, bold: true, sz: 10, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder
    }
  };

  for (let c = 0; c < 27; c++) {
    // Style Row 1
    const r1Ref = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[r1Ref]) ws[r1Ref] = { t: 's', v: '' };
    if (c <= 4) ws[r1Ref].s = superStyles.doc;
    else if (c <= 11) ws[r1Ref].s = superStyles.gstr;
    else if (c <= 18) ws[r1Ref].s = superStyles.ewb;
    else if (c <= 24) ws[r1Ref].s = superStyles.diff;
    else ws[r1Ref].s = superStyles.src;

    // Style Row 2
    const r2Ref = XLSX.utils.encode_cell({ r: 1, c });
    if (!ws[r2Ref]) ws[r2Ref] = { t: 's', v: '' };
    if (c <= 4) ws[r2Ref].s = subStyles.doc;
    else if (c <= 11) ws[r2Ref].s = subStyles.gstr;
    else if (c <= 18) ws[r2Ref].s = subStyles.ewb;
    else if (c <= 24) ws[r2Ref].s = subStyles.diff;
    else ws[r2Ref].s = subStyles.src;
  }

  // Row height for headers
  ws['!rows'] = [{ hpt: 24 }, { hpt: 22 }];

  // Status cell colors
  const statusColors: Record<string, { bg: string; text: string }> = {
    'Matched': { bg: 'DCFCE7', text: '14532D' }, // Emerald-100 / Emerald-900
    'Unmatched': { bg: 'FEE2E2', text: '991B1B' }, // Red-100 / Red-900
    'E-Way Bill Not Found': { bg: 'FFEDD5', text: '9A3412' }, // Orange-100 / Orange-900
    'E-Way Bill Not Required (< ₹50k)': { bg: 'CCFBF1', text: '115E59' }, // Teal-100 / Teal-900
    'Extra E-Way Bill': { bg: 'F3E8FF', text: '6B21A8' }, // Purple-100 / Purple-900
    'Review - Duplicate': { bg: 'FEF9C3', text: '854D0E' } // Yellow-100 / Yellow-900
  };

  // Style Data Rows
  for (let r = 2; r < aoa.length; r++) {
    const item = items[r - 2];
    const isEven = r % 2 === 0;
    const baseRowBg = isEven ? 'FFFFFF' : 'F8FAFC';

    for (let c = 0; c < 27; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) continue;

      let cellBg = baseRowBg;
      let fontColor = '1E293B';
      let isBold = false;
      let align = 'left';

      // Status column (col 0)
      if (c === 0 && item?.Status && statusColors[item.Status]) {
        cellBg = statusColors[item.Status].bg;
        fontColor = statusColors[item.Status].text;
        isBold = true;
        align = 'center';
      }
      // Invoice No, GSTIN, Dates, POS, Source Rows
      else if (c === 3 || c === 4 || c === 5 || c === 12 || c === 24 || c === 25 || c === 26) {
        align = 'center';
        if (c === 4) isBold = true;
      }
      // Place of Supply columns (cols 11, 18)
      else if (c === 11 || c === 18) {
        align = 'center';
        cellBg = c === 11 ? 'F0F9FF' : 'EEF2FF'; // very subtle tint
      }
      // Numeric amount columns
      else if (
        (c >= 6 && c <= 10) ||
        (c >= 13 && c <= 17) ||
        (c >= 19 && c <= 23)
      ) {
        align = 'right';
        // Difference columns (cols 19-23)
        if (c >= 19 && c <= 23) {
          const val = ws[cellRef].v;
          if (val != null && typeof val === 'number') {
            if (Math.abs(val) > 1.0) {
              cellBg = 'FFE4E6'; // Highlight discrepancy in light rose
              fontColor = '9F1239';
              isBold = true;
            } else {
              cellBg = 'F0FDF4'; // Subtle green for exact/roundoff match
              fontColor = '166534';
            }
          }
        }
      }

      ws[cellRef].s = {
        fill: { fgColor: { rgb: cellBg } },
        font: { color: { rgb: fontColor }, bold: isBold, sz: 10, name: 'Calibri' },
        alignment: { horizontal: align, vertical: 'center' },
        border: thinBorder
      };
    }
  }

  return ws;
}

/**
 * Creates an executive audit summary sheet with compliance statistics and value totals
 */
export function createExecutiveSummarySheet(items: ReconciliationItem[]): XLSX.WorkSheet {
  const aoa: any[][] = [];

  aoa.push(['GST RECONCILIATION AUDIT REPORT', '', '', '']);
  aoa.push(['GSTR-1 Outward Supplies vs NIC E-Way Bill Consignments', '', '', '']);
  aoa.push(['Generated On:', new Date().toLocaleString('en-IN'), '', '']);
  aoa.push(['Statutory Rule:', 'Invoice Value & Tax variance <= ₹1.00 ignored per GST rounding rules (Sec 170)', '', '']);
  aoa.push([]);

  let matched = 0, unmatched = 0, ewbNotFound = 0, ewbNotRequired = 0, extraEwb = 0, reviewDuplicate = 0;
  let gTaxable = 0, gIgst = 0, gCgst = 0, gSgst = 0, gTotal = 0;
  let eTaxable = 0, eIgst = 0, eCgst = 0, eSgst = 0, eTotal = 0;

  for (const it of items) {
    if (it.Status === 'Matched') matched++;
    else if (it.Status === 'Unmatched') unmatched++;
    else if (it.Status === 'E-Way Bill Not Found') ewbNotFound++;
    else if (it.Status === 'E-Way Bill Not Required (< ₹50k)') ewbNotRequired++;
    else if (it.Status === 'Extra E-Way Bill') extraEwb++;
    else if (it.Status === 'Review - Duplicate') reviewDuplicate++;

    gTaxable += it['GSTR-1 Taxable'] || 0;
    gIgst += it['GSTR-1 IGST'] || 0;
    gCgst += it['GSTR-1 CGST'] || 0;
    gSgst += it['GSTR-1 SGST'] || 0;
    gTotal += it['GSTR-1 Invoice Value'] || 0;

    eTaxable += it['EWB Taxable'] || 0;
    eIgst += it['EWB IGST'] || 0;
    eCgst += it['EWB CGST'] || 0;
    eSgst += it['EWB SGST'] || 0;
    eTotal += it['EWB Invoice Value'] || 0;
  }

  const rawDiffTotal = Math.round((gTotal - eTotal) * 100) / 100;
  const netDiffTotal = Math.abs(rawDiffTotal) <= 1.0 ? 0.0 : rawDiffTotal;

  aoa.push(['COMPLIANCE AUDIT STATUS BREAKDOWN', '', '', '']);
  aoa.push(['Category', 'Invoice Count', 'Percentage (%)', 'Statutory Impact']);
  aoa.push(['Matched (Harmonized)', matched, items.length ? Number(((matched / items.length) * 100).toFixed(1)) : 0, 'Full GST Compliance']);
  aoa.push(['Rule 138 Exempt (< ₹50k)', ewbNotRequired, items.length ? Number(((ewbNotRequired / items.length) * 100).toFixed(1)) : 0, 'Legally Exempt']);
  aoa.push(['Unmatched (Value/Date Discrepancy)', unmatched, items.length ? Number(((unmatched / items.length) * 100).toFixed(1)) : 0, 'Requires Verification']);
  aoa.push(['E-Way Bill Missing (> ₹50k)', ewbNotFound, items.length ? Number(((ewbNotFound / items.length) * 100).toFixed(1)) : 0, 'Non-compliance Risk']);
  aoa.push(['Extra E-Way Bill (NIC only)', extraEwb, items.length ? Number(((extraEwb / items.length) * 100).toFixed(1)) : 0, 'Unreported in GSTR-1']);
  aoa.push(['Review - Duplicates', reviewDuplicate, items.length ? Number(((reviewDuplicate / items.length) * 100).toFixed(1)) : 0, 'Duplicate Filing Risk']);
  aoa.push(['Total Reconciled Records', items.length, 100.0, 'All Transactions']);
  aoa.push([]);

  aoa.push(['FINANCIAL VALUE COMPARISON', '', '', '']);
  aoa.push(['Tax Component', 'GSTR-1 Outward (₹)', 'E-Way Bill NIC (₹)', 'Net Variance (₹)']);
  aoa.push(['Taxable Value', Math.round(gTaxable * 100) / 100, Math.round(eTaxable * 100) / 100, Math.round((gTaxable - eTaxable) * 100) / 100]);
  aoa.push(['IGST', Math.round(gIgst * 100) / 100, Math.round(eIgst * 100) / 100, Math.round((gIgst - eIgst) * 100) / 100]);
  aoa.push(['CGST', Math.round(gCgst * 100) / 100, Math.round(eCgst * 100) / 100, Math.round((gCgst - eCgst) * 100) / 100]);
  aoa.push(['SGST', Math.round(gSgst * 100) / 100, Math.round(eSgst * 100) / 100, Math.round((gSgst - eSgst) * 100) / 100]);
  aoa.push(['Total Invoice Value', Math.round(gTotal * 100) / 100, Math.round(eTotal * 100) / 100, netDiffTotal]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 36 }, { wch: 24 }, { wch: 24 }, { wch: 26 }];

  // Apply colors and cell formatting
  const thinBorder = {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } },
  };

  // Title formatting
  if (ws['A1']) {
    ws['A1'].s = {
      font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: '0F172A' } }
    };
  }
  if (ws['A2']) {
    ws['A2'].s = {
      font: { name: 'Calibri', sz: 11, bold: false, color: { rgb: '475569' } }
    };
  }

  // Section Headers
  const sectionHeaderRows = [6, 16]; // 1-based index (row 6: COMPLIANCE..., row 16: FINANCIAL...)
  for (const r of sectionHeaderRows) {
    const ref = `A${r}`;
    if (ws[ref]) {
      ws[ref].s = {
        font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1E293B' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: thinBorder
      };
    }
  }

  // Table Column Headers (row 7 and row 17)
  const headerRows = [7, 17];
  for (const r of headerRows) {
    for (let c = 0; c < 4; c++) {
      const colLetter = String.fromCharCode(65 + c);
      const ref = `${colLetter}${r}`;
      if (ws[ref]) {
        ws[ref].s = {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '1E3A8A' } },
          fill: { fgColor: { rgb: 'DBEAFE' } },
          alignment: { horizontal: c === 0 ? 'left' : 'right', vertical: 'center' },
          border: thinBorder
        };
      }
    }
  }

  // Table Data Rows
  const styleTableRows = (startR: number, endR: number) => {
    for (let r = startR; r <= endR; r++) {
      const isTotalRow = (r === endR);
      const isZebra = (r % 2 === 0);
      const defaultBg = isTotalRow ? 'F1F5F9' : (isZebra ? 'F8FAFC' : 'FFFFFF');
      for (let c = 0; c < 4; c++) {
        const colLetter = String.fromCharCode(65 + c);
        const ref = `${colLetter}${r}`;
        if (ws[ref]) {
          let cellBg = defaultBg;
          let fontColor = isTotalRow ? '0F172A' : '334155';
          let isBold = isTotalRow;

          // Highlight variance in row 22 (Total Invoice Value)
          if (r === 22 && c === 3) {
            const val = ws[ref].v;
            if (val != null && typeof val === 'number') {
              if (Math.abs(val) > 1.0) {
                cellBg = 'FFE4E6';
                fontColor = '9F1239';
                isBold = true;
              } else {
                cellBg = 'F0FDF4';
                fontColor = '166534';
                isBold = true;
              }
            }
          }

          ws[ref].s = {
            font: { name: 'Calibri', sz: 10, bold: isBold, color: { rgb: fontColor } },
            fill: { fgColor: { rgb: cellBg } },
            alignment: { horizontal: c === 0 ? 'left' : 'right', vertical: 'center' },
            border: thinBorder
          };
        }
      }
    }
  };

  styleTableRows(8, 14);  // Status breakdown rows
  styleTableRows(18, 22); // Financial value rows

  return ws;
}

export function exportReconciliationToExcel(items: ReconciliationItem[]) {
  const wb = XLSX.utils.book_new();

  // 1. Executive Summary Sheet
  const summaryWs = createExecutiveSummarySheet(items);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Executive Summary');

  // 2. Full Side-by-Side Reconciliation Matrix (Master Sheet)
  const masterWs = createSideBySideReconciliationSheet(items);
  XLSX.utils.book_append_sheet(wb, masterWs, 'All Invoices (Reconciled)');

  // 3. Sub-sheets for specific compliance categories
  const categories: Array<{ status: ReconciliationItem['Status']; sheetName: string }> = [
    { status: 'Matched', sheetName: 'Matched Invoices' },
    { status: 'Unmatched', sheetName: 'Unmatched Discrepancies' },
    { status: 'E-Way Bill Not Found', sheetName: 'EWB Missing (>50k)' },
    { status: 'E-Way Bill Not Required (< ₹50k)', sheetName: 'Rule 138 Exempt (<50k)' },
    { status: 'Extra E-Way Bill', sheetName: 'Extra E-Way Bills' },
    { status: 'Review - Duplicate', sheetName: 'Review Duplicates' },
  ];

  for (const { status, sheetName } of categories) {
    const filtered = items.filter(x => x.Status === status);
    if (filtered.length > 0) {
      const ws = createSideBySideReconciliationSheet(filtered);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  }

  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `GST_EWB_Reconciliation_${timestamp}.xlsx`;

  XLSX.writeFile(wb, filename);
}

