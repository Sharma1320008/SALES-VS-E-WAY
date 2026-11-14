import * as XLSX from 'xlsx-js-style';
import { ColumnMapping, StandardInvoiceRow } from '../types/reconciliation';

export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Center Jurisdiction'
};

export function extractGstStateCode(val: any): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;

  // 1. Direct 2-digit code prefix (e.g. GSTIN "27AAPFU0939F1ZV" or "27-Maharashtra" or "27")
  const match2Digit = s.match(/^(\d{2})/);
  if (match2Digit && GST_STATE_CODES[match2Digit[1]]) {
    return match2Digit[1];
  }

  // 2. Exact 2-digit state code word anywhere in string
  const matchCodeAnywhere = s.match(/\b(\d{2})\b/);
  if (matchCodeAnywhere && GST_STATE_CODES[matchCodeAnywhere[1]]) {
    return matchCodeAnywhere[1];
  }

  // 3. Name lookup in GST_STATE_CODES
  const lower = s.toLowerCase();
  for (const [code, name] of Object.entries(GST_STATE_CODES)) {
    if (lower.includes(name.toLowerCase())) {
      return code;
    }
  }

  return null;
}

export function getStateNameByCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return GST_STATE_CODES[code] || null;
}

export function resolvePlaceOfSupplyWithStateName(posVal: any, gstinVal?: any): string {
  // Extract 2-digit GST state code from POS or GSTIN
  let code = extractGstStateCode(posVal);
  if (!code && gstinVal) {
    code = extractGstStateCode(gstinVal);
  }

  // Return strictly the State Name (without 2-digit state code per user requirement)
  if (code && GST_STATE_CODES[code]) {
    return GST_STATE_CODES[code];
  }

  // If posVal is a string (e.g. "27-Maharashtra" or "Maharashtra"), strip any leading code
  if (posVal) {
    const s = String(posVal).trim().replace(/^\d{1,2}\s*[-–:]\s*/, '').trim();
    if (s && s !== 'NAN' && s !== 'undefined') {
      const lower = s.toLowerCase();
      for (const [, stateName] of Object.entries(GST_STATE_CODES)) {
        if (stateName.toLowerCase() === lower || lower.includes(stateName.toLowerCase())) {
          return stateName;
        }
      }
      return s;
    }
  }

  if (gstinVal) {
    const s = String(gstinVal).trim().toUpperCase();
    if (s.length >= 2) {
      const c = s.substring(0, 2);
      if (GST_STATE_CODES[c]) {
        return GST_STATE_CODES[c];
      }
    }
  }

  return '-';
}

export const ALIASES: Record<string, string[]> = {
  invoice_no: [
    'invoiceno', 'invoicenumber', 'documentnumber', 'docno', 'docnumber',
    'documentno', 'billno', 'billnumber', 'invno', 'inum', 'invnum',
    'docnum', 'challanno', 'ebillno', 'document', 'invoicedocumentno'
  ],
  party_name: [
    'receivername', 'recipientname', 'tradename', 'legalname', 'tradelegalname',
    'partytradelegalname', 'partyname', 'particulars', 'customername', 'buyername',
    'consigneename', 'cname', 'lgnm', 'nameofparty', 'nameofrecipient', 'nameofreceiver',
    'nameoftheparty', 'party', 'customer', 'buyer', 'clientname', 'billedtoname',
    'billtoname', 'receiver', 'recipient', 'partytrade'
  ],
  gstin: [
    // In sales reconciliation, recipient/buyer GSTIN is the key counterpart to GSTR-1 ctin
    'togstin', 'recipientgstin', 'receivergstin', 'consigneegstin', 'buyergstin',
    'gstinofrecipient', 'ctin', 'gstinuinofrecipient', 'gstin', 'gstinuin',
    'gstinnumber', 'fromgstin', 'suppliergstin', 'gstinofsupplier'
  ],
  from_gstin: [
    'fromgstin', 'suppliergstin', 'gstinofsupplier', 'genbygstin', 'dispatchgstin',
    'dispatchfromgstin', 'sellergstin', 'fromgstinuin', 'genby', 'supplygstin', 'supplier'
  ],
  pos: [
    'pos', 'placeofsupply', 'tostate', 'tostatecode', 'destinationstate',
    'stateofsupply', 'toplace', 'consigneestate', 'recipientstate', 'delivstate'
  ],
  date: [
    'invoicedate', 'documentdate', 'docdate', 'date', 'billdate', 'invdate',
    'idt', 'docdt', 'invdt', 'documentdt', 'ewbdate'
  ],
  taxable: [
    'taxablevalue', 'taxableamount', 'assessablevalue', 'taxable', 'txval',
    'taxableamt', 'totaltaxablevalue', 'assessableamt', 'totaltaxableamount',
    'taxableval', 'totaltaxableval', 'taxabletax', 'taxablevalues'
  ],
  igst: [
    'integratedtax', 'igst', 'integratedtaxamount', 'igstamount', 'iamt', 'igstamt',
    'integratedtaxamt', 'inttax', 'integratedtaxvalue', 'integratedgst', 'igsttax', 'integrated'
  ],
  cgst: [
    'centraltax', 'cgst', 'centraltaxamount', 'cgstamount', 'camt', 'cgstamt',
    'centraltaxamt', 'centtax', 'centraltaxvalue', 'centralgst', 'cgsttax', 'central'
  ],
  sgst: [
    'stateuttax', 'statetax', 'sgst', 'stateut', 'stateoruttax', 'stateanduttax',
    'sgstamount', 'samt', 'statetaxamount', 'sgstamt', 'statetaxamt', 'utgst',
    'utgstamount', 'utamt', 'sgstuttax', 'sgstutgst', 'utstatetax', 'statetaxsgst',
    'stateunionterritorytax', 'sgstut', 'statetaxamountsgst', 'stateuttaxamt',
    'stateuttaxvalue', 'stateutgst', 'sutgst', 'stategst', 'utstatetaxamt'
  ],
  total_tax: [
    'totaltax', 'taxamount', 'gstamount', 'totaltaxamount', 'totaltaxamt',
    'taxamt', 'totaltaxvalue', 'gstamt', 'totalgst', 'tax', 'totaltaxamt'
  ],
  total: [
    'invoicevalue', 'invoiceamount', 'totalinvoicevalue', 'totalvalue',
    'billamount', 'totalamount', 'val', 'totinvval', 'totinvvalue',
    'totaldocvalue', 'documentvalue', 'totalinvamount', 'grandtotal',
    'invval', 'invvalue', 'invoiceval'
  ],
};

export function normCol(c: any): string {
  return String(c ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function findCol(columns: string[], key: string, label?: 'GSTR-1' | 'E-Way Bill'): string | null {
  const normMap = new Map<string, string>();
  for (const c of columns) {
    normMap.set(normCol(c), c);
  }

  // If searching for recipient GSTIN in E-Way Bill report, specifically prioritize recipient/consignee columns
  let aliases = ALIASES[key] || [];
  if (key === 'gstin' && label === 'E-Way Bill') {
    aliases = [
      'togstin', 'recipientgstin', 'consigneegstin', 'receivergstin', 'buyergstin',
      'gstinofrecipient', 'ctin', 'gstinuinofrecipient', 'gstin', 'gstinnumber',
      'fromgstin', 'suppliergstin'
    ];
  } else if (key === 'from_gstin') {
    aliases = [
      'fromgstin', 'suppliergstin', 'gstinofsupplier', 'genbygstin', 'dispatchgstin',
      'sellergstin', 'fromgstinuin'
    ];
  }

  // 1. Exact alias match
  for (const alias of aliases) {
    if (normMap.has(alias)) {
      return normMap.get(alias)!;
    }
  }

  // 2. Substring match
  for (const [norm, orig] of normMap.entries()) {
    // If searching for buyer GSTIN, skip e-commerce GSTIN columns
    if (key === 'gstin' && (norm.includes('ecommerce') || norm.includes('ecom'))) {
      continue;
    }
    for (const alias of aliases) {
      if (alias.length > 3 && norm.includes(alias)) {
        return orig;
      }
    }
  }

  return null;
}

export function autoDetectSupplierGstin(rows: any[], columns: string[] = []): string | null {
  const fromCol = findCol(columns, 'from_gstin');
  const counts = new Map<string, number>();

  for (const row of rows) {
    // 1. Check mapped/found column
    if (fromCol && row[fromCol]) {
      const g = String(row[fromCol]).trim().toUpperCase();
      if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(g)) {
        counts.set(g, (counts.get(g) || 0) + 1);
      }
    }

    // 2. Check any property named like from_gstin, supplier, dispatch, or genby
    for (const [k, v] of Object.entries(row)) {
      const normK = normCol(k);
      if (
        normK.includes('fromgstin') ||
        normK.includes('suppliergstin') ||
        normK.includes('genbygstin') ||
        normK.includes('sellergstin') ||
        normK.includes('dispatchgstin') ||
        normK.includes('dispatchfromgstin') ||
        normK.includes('fromgstinuin')
      ) {
        const valStr = String(v ?? '').trim().toUpperCase();
        if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(valStr)) {
          counts.set(valStr, (counts.get(valStr) || 0) + 1);
        }
      }
    }
  }

  let topGstin: string | null = null;
  let topCount = 0;
  for (const [g, count] of counts.entries()) {
    if (count > topCount) {
      topCount = count;
      topGstin = g;
    }
  }

  return topGstin;
}

/**
 * Automatically identifies the 2-digit Supplier State Code for GST statutory classification.
 * Checks:
 * 1. Explicit Supplier GSTIN from file headers or columns
 * 2. If GSTR-1 contains any intra-state transaction with CGST & SGST > 0, the recipient's state code IS the supplier's state code!
 * 3. Fallback GSTIN prefix
 */
export function autoDetectSupplierStateCode(
  rows: any[],
  columns: string[] = [],
  fallbackGstin?: string
): string | null {
  const gstin = autoDetectSupplierGstin(rows, columns) || fallbackGstin;
  const fromGstinState = extractGstStateCode(gstin);
  if (fromGstinState) return fromGstinState;

  // Infer from Intra-State supplies: in GST statutory accounting, if CGST and SGST are charged, supplier state == recipient state!
  for (const r of rows) {
    const cgstVal = parseNumber(r.cgst ?? r.camt ?? r.centraltax ?? r['CGST Amount'] ?? r['CGST'] ?? 0);
    const sgstVal = parseNumber(r.sgst ?? r.samt ?? r.statetax ?? r['SGST Amount'] ?? r['SGST'] ?? 0);
    if (cgstVal > 0 && sgstVal > 0) {
      const recipientGstin = r.gstin ?? r.ctin ?? r.togstin ?? r['Receiver GSTIN'] ?? r['Buyer GSTIN'] ?? '';
      const posVal = r.pos ?? r.placeofsupply ?? r['Place of Supply'] ?? '';
      const state = extractGstStateCode(recipientGstin) || extractGstStateCode(posVal);
      if (state) return state;
    }
  }

  return null;
}

export function parseGstr1Json(obj: any): any[] | null {
  const rows: any[] = [];
  if (!obj || typeof obj !== 'object') return null;

  const supplierGstin = obj.gstin || '';

  // 1. B2B & B2BA
  for (const sectionKey of ['b2b', 'b2ba']) {
    const section = obj[sectionKey];
    if (Array.isArray(section)) {
      for (const group of section) {
        const ctin = group?.ctin || '';
        const cname = group?.cname || group?.party_name || group?.trade_name || group?.lgnm || group?.receiver_name || '';
        for (const inv of group?.inv || []) {
          const inum = String(inv?.inum || '').trim();
          const idt = inv?.idt || '';
          const val = inv?.val != null ? Number(inv.val) : null;
          const invTyp = inv?.inv_typ || '';
          const pos = inv?.pos || '';

          let txval = 0.0;
          let iamt = 0.0;
          let camt = 0.0;
          let samt = 0.0;
          let hasItems = false;

          for (const itm of inv?.itms || []) {
            const det = itm?.itm_det || itm;
            txval += Number(det?.txval || 0);
            iamt += Number(det?.iamt || 0);
            camt += Number(det?.camt || 0);
            samt += Number(det?.samt || 0);
            hasItems = true;
          }

          rows.push({
            invoice_no: inum,
            party_name: cname,
            gstin: ctin,
            from_gstin: supplierGstin,
            date: idt,
            taxable: hasItems ? txval : null,
            igst: hasItems ? iamt : null,
            cgst: hasItems ? camt : null,
            sgst: hasItems ? samt : null,
            total: val,
            section: sectionKey.toUpperCase(),
            pos,
            inv_typ: invTyp
          });
        }
      }
    }
  }

  // 2. B2CL & B2CLA
  for (const sectionKey of ['b2cl', 'b2cla']) {
    const section = obj[sectionKey];
    if (Array.isArray(section)) {
      for (const group of section) {
        const pos = group?.pos || '';
        for (const inv of group?.inv || []) {
          const inum = String(inv?.inum || '').trim();
          const idt = inv?.idt || '';
          const val = inv?.val != null ? Number(inv.val) : null;

          let txval = 0.0;
          let iamt = 0.0;
          let hasItems = false;

          for (const itm of inv?.itms || []) {
            const det = itm?.itm_det || itm;
            txval += Number(det?.txval || 0);
            iamt += Number(det?.iamt || 0);
            hasItems = true;
          }

          rows.push({
            invoice_no: inum,
            gstin: 'URP',
            from_gstin: supplierGstin,
            date: idt,
            taxable: hasItems ? txval : null,
            igst: hasItems ? iamt : null,
            cgst: 0.0,
            sgst: 0.0,
            total: val,
            section: sectionKey.toUpperCase(),
            pos,
            inv_typ: 'B2CL'
          });
        }
      }
    }
  }

  // 3. EXP & EXPA
  for (const sectionKey of ['exp', 'expa']) {
    const section = obj[sectionKey];
    if (Array.isArray(section)) {
      for (const group of section) {
        const expTyp = group?.exp_typ || '';
        for (const inv of group?.inv || []) {
          const inum = String(inv?.inum || '').trim();
          const idt = inv?.idt || '';
          const val = inv?.val != null ? Number(inv.val) : null;

          let txval = 0.0;
          let iamt = 0.0;
          let hasItems = false;

          for (const itm of inv?.itms || []) {
            const det = itm?.itm_det || itm;
            txval += Number(det?.txval || 0);
            iamt += Number(det?.iamt || 0);
            hasItems = true;
          }

          rows.push({
            invoice_no: inum,
            gstin: 'EXP',
            from_gstin: supplierGstin,
            date: idt,
            taxable: hasItems ? txval : null,
            igst: hasItems ? iamt : null,
            cgst: 0.0,
            sgst: 0.0,
            total: val,
            section: sectionKey.toUpperCase(),
            pos: '',
            inv_typ: expTyp
          });
        }
      }
    }
  }

  // 4. CDNR & CDNRA
  for (const sectionKey of ['cdnr', 'cdnra']) {
    const section = obj[sectionKey];
    if (Array.isArray(section)) {
      for (const group of section) {
        const ctin = group?.ctin || '';
        const cname = group?.cname || group?.party_name || group?.trade_name || group?.lgnm || group?.receiver_name || '';
        for (const nt of group?.nt || []) {
          const ntNum = String(nt?.nt_num || '').trim();
          const ntDt = nt?.nt_dt || '';
          const val = nt?.val != null ? Number(nt.val) : null;
          const ntty = nt?.ntty || '';

          let txval = 0.0;
          let iamt = 0.0;
          let camt = 0.0;
          let samt = 0.0;
          let hasItems = false;

          for (const itm of nt?.itms || []) {
            const det = itm?.itm_det || itm;
            txval += Number(det?.txval || 0);
            iamt += Number(det?.iamt || 0);
            camt += Number(det?.camt || 0);
            samt += Number(det?.samt || 0);
            hasItems = true;
          }

          rows.push({
            invoice_no: ntNum,
            party_name: cname,
            gstin: ctin,
            from_gstin: supplierGstin,
            date: ntDt,
            taxable: hasItems ? txval : null,
            igst: hasItems ? iamt : null,
            cgst: hasItems ? camt : null,
            sgst: hasItems ? samt : null,
            total: val,
            section: `${sectionKey.toUpperCase()} (${ntty})`,
            pos: '',
            inv_typ: ntty
          });
        }
      }
    }
  }

  // 5. CDNUR & CDNURA
  for (const sectionKey of ['cdnur', 'cdnura']) {
    const section = obj[sectionKey];
    if (Array.isArray(section)) {
      for (const group of section) {
        const typ = group?.typ || 'URP';
        for (const nt of group?.nt || []) {
          const ntNum = String(nt?.nt_num || '').trim();
          const ntDt = nt?.nt_dt || '';
          const val = nt?.val != null ? Number(nt.val) : null;

          let txval = 0.0;
          let iamt = 0.0;
          let camt = 0.0;
          let samt = 0.0;
          let hasItems = false;

          for (const itm of nt?.itms || []) {
            const det = itm?.itm_det || itm;
            txval += Number(det?.txval || 0);
            iamt += Number(det?.iamt || 0);
            camt += Number(det?.camt || 0);
            samt += Number(det?.samt || 0);
            hasItems = true;
          }

          rows.push({
            invoice_no: ntNum,
            gstin: typ,
            from_gstin: supplierGstin,
            date: ntDt,
            taxable: hasItems ? txval : null,
            igst: hasItems ? iamt : null,
            cgst: hasItems ? camt : null,
            sgst: hasItems ? samt : null,
            total: val,
            section: sectionKey.toUpperCase(),
            pos: '',
            inv_typ: typ
          });
        }
      }
    }
  }

  return rows.length > 0 ? rows : null;
}

export function genericJsonToFrames(obj: any): any[] {
  const found: { path: string; rows: any[] }[] = [];

  function walk(x: any, path = '') {
    if (x && typeof x === 'object' && !Array.isArray(x)) {
      for (const [k, v] of Object.entries(x)) {
        if (Array.isArray(v) && v.length > 0 && v.every(z => z && typeof z === 'object')) {
          const hasNested = v.some(item => Object.values(item).some(val => Array.isArray(val)));
          if (hasNested) {
            v.forEach((item, idx) => walk(item, `${path}/${k}[${idx}]`));
          } else {
            const simpleRows = v.map(item => {
              const row: Record<string, any> = {};
              for (const [kk, vv] of Object.entries(item as object)) {
                if (typeof vv !== 'object') {
                  row[kk] = vv;
                }
              }
              return row;
            });
            if (simpleRows.length > 0) {
              found.push({ path: `${path}/${k}`, rows: simpleRows });
            }
          }
        } else {
          walk(v, `${path}/${k}`);
        }
      }
    } else if (Array.isArray(x)) {
      x.forEach((v, i) => walk(v, `${path}/${i}`));
    }
  }

  walk(obj);

  if (found.length === 0) {
    throw new Error('No tabular invoice data found in JSON file. Please check file format.');
  }

  // Score candidate arrays based on invoice keywords and length
  function score(item: { rows: any[] }) {
    if (item.rows.length === 0) return 0;
    const cols = Object.keys(item.rows[0]).map(normCol).join(' ');
    const hasInv = ['inum', 'invoiceno', 'documentnumber', 'docno', 'billno'].some(a => cols.includes(a)) ? 1000 : 0;
    return hasInv + item.rows.length;
  }

  found.sort((a, b) => score(b) - score(a));
  return found[0].rows;
}

export function findHeaderRow(matrix: any[][]): { headers: string[]; rows: any[] } {
  const keywords = ['invoice', 'doc', 'bill', 'gstin', 'date', 'taxable', 'value', 'amount', 'total', 'rate', 'cgst', 'sgst', 'igst', 'eway', 'inum', 'ctin', 'txval', 'central', 'integrated', 'state', 'stateuttax', 'centraltax', 'integratedtax'];

  let bestScore = 0;
  let bestIdx = 0;
  const maxCheck = Math.min(15, matrix.length);

  for (let idx = 0; idx < maxCheck; idx++) {
    const row = matrix[idx];
    if (!row || !Array.isArray(row)) continue;
    const rowStr = row.map(normCol).join(' ');
    const score = keywords.reduce((acc, kw) => acc + (rowStr.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx + 1; // 1-based index where headers are at bestIdx-1
    }
  }

  if (bestIdx > 0 && bestScore >= 2) {
    const headerRow = matrix[bestIdx - 1];
    const headers = headerRow.map((c, j) => {
      const s = String(c ?? '').trim();
      return s ? s : `col_${j}`;
    });

    const dataRows = matrix.slice(bestIdx).map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((h, j) => {
        obj[h] = row[j] !== undefined ? row[j] : null;
      });
      return obj;
    });

    return { headers, rows: dataRows };
  }

  // If no good header row detected, use first row or generate col_0...
  if (matrix.length > 0) {
    const firstRow = matrix[0];
    const headers = firstRow.map((c, j) => String(c ?? `col_${j}`).trim() || `col_${j}`);
    const dataRows = matrix.slice(1).map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((h, j) => {
        obj[h] = row[j] !== undefined ? row[j] : null;
      });
      return obj;
    });
    return { headers, rows: dataRows };
  }

  return { headers: [], rows: [] };
}

export async function parseUploadedFile(file: File): Promise<{ columns: string[]; rows: any[] }> {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (name.endsWith('.pdf')) {
    const { parsePdfFile } = await import('./pdfParser');
    return await parsePdfFile(buffer);
  }

  if (name.endsWith('.json')) {
    const text = new TextDecoder('utf-8').decode(buffer);
    const obj = JSON.parse(text);
    const parsedGstr = parseGstr1Json(obj);
    if (parsedGstr && parsedGstr.length > 0) {
      return {
        columns: Object.keys(parsedGstr[0]),
        rows: parsedGstr
      };
    }
    const genericRows = genericJsonToFrames(obj);
    return {
      columns: genericRows.length > 0 ? Object.keys(genericRows[0]) : [],
      rows: genericRows
    };
  }

  // For CSV or Excel (.xlsx, .xls)
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheetCandidates: { priority: number; rowCount: number; sheetName: string; rows: any[]; columns: string[] }[] = [];

  for (const sheetName of workbook.SheetNames) {
    try {
      const worksheet = workbook.Sheets[sheetName];
      const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (matrix.length === 0) continue;

      const { headers, rows } = findHeaderRow(matrix);
      if (headers.length === 0 || rows.length === 0) continue;

      const colsNorm = headers.map(normCol).join(' ');
      const hasInv = ['inum', 'invoiceno', 'documentnumber', 'docno', 'billno', 'invno'].some(a => colsNorm.includes(a));
      const sLower = sheetName.toLowerCase();
      const isInvSheet = ['b2b', 'b2ba', 'b2cl', 'cdnr', 'exp', 'invoice', 'outward', 'sheet1'].some(target => sLower.includes(target));
      const isSummary = ['b2cs', 'hsn', 'doc_issue', 'instructions', 'summary', 'master'].some(skip => sLower.includes(skip));

      let priority = 0;
      if (hasInv) priority += 10;
      if (isInvSheet) priority += 5;
      if (isSummary) priority -= 15;

      sheetCandidates.push({
        priority,
        rowCount: rows.length,
        sheetName,
        rows,
        columns: headers
      });
    } catch {
      // Continue to next sheet
    }
  }

  if (sheetCandidates.length === 0) {
    throw new Error('No usable data sheet found in the uploaded file.');
  }

  sheetCandidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.rowCount - a.rowCount;
  });

  const bestSheet = sheetCandidates[0];
  return {
    columns: bestSheet.columns,
    rows: bestSheet.rows
  };
}

export function parseDateObj(val: any): { formatted: string | null; dateObj: Date | null } {
  if (val == null || val === '') return { formatted: null, dateObj: null };

  let d: Date | null = null;

  if (val instanceof Date && !isNaN(val.getTime())) {
    d = val;
  } else if (typeof val === 'number' && val > 30000 && val < 60000) {
    // Excel serial number
    d = new Date(Math.round((val - 25569) * 86400 * 1000));
  } else {
    const str = String(val).trim();
    // Check if string is numeric Excel serial
    if (/^\d{5}(\.\d+)?$/.test(str)) {
      const num = parseFloat(str);
      if (num > 30000 && num < 60000) {
        d = new Date(Math.round((num - 25569) * 86400 * 1000));
      }
    }

    if (!d) {
      // DD-MM-YYYY or DD/MM/YYYY (may have timestamp like 15-05-2024 14:30:00)
      const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (dmy) {
        d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
      } else {
        // YYYY-MM-DD
        const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (ymd) {
          d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
        } else {
          const direct = new Date(str);
          if (!isNaN(direct.getTime())) {
            d = direct;
          }
        }
      }
    }
  }

  if (d && !isNaN(d.getTime())) {
    const normalized = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return {
      formatted: `${dd}-${mm}-${yyyy}`,
      dateObj: normalized
    };
  }

  return { formatted: String(val).trim() || null, dateObj: null };
}

export function parseDate(val: any): string | null {
  return parseDateObj(val).formatted;
}

export function simplifyInvoiceNo(val: any): string {
  if (val == null) return '';
  return String(val)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^0+/, '');
}

export function parseNumber(val: any): number {
  if (val == null) return 0.0;
  if (typeof val === 'number') return isNaN(val) ? 0.0 : val;
  const cleaned = String(val)
    .replace(/[₹, \s]/g, '')
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0.0 : num;
}
