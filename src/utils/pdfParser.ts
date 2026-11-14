import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { normCol, findHeaderRow } from './fileParser';

// Configure pdfjs worker for browser environment
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

interface TextItemPos {
  str: string;
  x: number;
  y: number;
  page: number;
}

interface ParsedPdfResult {
  columns: string[];
  rows: any[];
}

/**
 * Extracts all text items with (x, y) coordinates from PDF ArrayBuffer
 */
async function extractPdfTextItems(buffer: ArrayBuffer): Promise<TextItemPos[]> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfDoc = await loadingTask.promise;
  const items: TextItemPos[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if ('str' in item && item.str.trim() !== '') {
        // item.transform: [scaleX, skewY, skewX, scaleY, transX, transY]
        const x = item.transform[4];
        const y = item.transform[5];
        items.push({
          str: item.str,
          x,
          y,
          page: pageNum,
        });
      }
    }
  }

  return items;
}

/**
 * Groups items into horizontal text lines per page, sorted from top to bottom
 */
function groupIntoLines(items: TextItemPos[], yTolerance = 4): string[][] {
  // Group by page first
  const pageMap = new Map<number, TextItemPos[]>();
  for (const it of items) {
    if (!pageMap.has(it.page)) pageMap.set(it.page, []);
    pageMap.get(it.page)!.push(it);
  }

  const allLines: string[][] = [];

  for (const [, pageItems] of pageMap.entries()) {
    // Sort descending by Y (PDF Y=0 is at bottom), then ascending by X
    pageItems.sort((a, b) => {
      if (Math.abs(b.y - a.y) > yTolerance) {
        return b.y - a.y;
      }
      return a.x - b.x;
    });

    const lines: Array<{ y: number; tokens: TextItemPos[] }> = [];

    for (const item of pageItems) {
      const match = lines.find(l => Math.abs(l.y - item.y) <= yTolerance);
      if (match) {
        match.tokens.push(item);
      } else {
        lines.push({ y: item.y, tokens: [item] });
      }
    }

    for (const line of lines) {
      // Sort left-to-right
      line.tokens.sort((a, b) => a.x - b.x);
      const rowTokens = line.tokens.map(t => t.str.trim()).filter(Boolean);
      if (rowTokens.length > 0) {
        allLines.push(rowTokens);
      }
    }
  }

  return allLines;
}

/**
 * Parses E-Way Bill Print Slips (NIC E-Way Bill format).
 * A single PDF can have 1 or more EWB slips.
 * E-Way Bill printouts contain distinct fields like:
 * - e-Way Bill No: 1234 5678 9012
 * - Doc. No / Invoice No: INV-2024-001
 * - Doc. Date: 12/04/2024
 * - To GSTIN / Recipient: 27AABCU9603R1ZM
 * - Total Taxable Amount: 150000.00
 * - CGST / SGST / IGST: ...
 * - Total Inv. Value: 177000.00
 */
function tryParseEwbPrintSlips(lines: string[][]): any[] | null {
  const fullText = lines.map(line => line.join(' ')).join('\n');

  // Check if text looks like NIC E-Way Bill print slip
  const isEwbSlip = /e[- ]?way\s*bill/i.test(fullText) && (/doc(ument)?\.?\s*no/i.test(fullText) || /to\s*gstin/i.test(fullText));
  if (!isEwbSlip) return null;

  // Split into slip blocks if multiple EWBs exist in a single PDF
  const slipSplitRegex = /(?:e[- ]?way\s*bill\s*no\.?[\s:]+[\d\s]{12,16})/gi;
  const matches = [...fullText.matchAll(slipSplitRegex)];

  const blocks: string[] = [];
  if (matches.length > 1) {
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index!;
      const end = i + 1 < matches.length ? matches[i + 1].index! : fullText.length;
      blocks.push(fullText.substring(start, end));
    }
  } else {
    blocks.push(fullText);
  }

  const rows: any[] = [];

  for (const block of blocks) {
    // 1. EWB Number
    const ewbMatch = block.match(/e[- ]?way\s*bill\s*no\.?[\s:]+([\d\s]{12,18})/i);
    const ewbNo = ewbMatch ? ewbMatch[1].replace(/\s+/g, '') : '';

    // 2. Document / Invoice Number
    const docMatch = block.match(/doc(?:ument)?\.?\s*no\.?[\s:]+([A-Za-z0-9\-_/]+)/i);
    const invoiceNo = docMatch ? docMatch[1].trim() : '';

    // 3. Document Date
    const dateMatch = block.match(/doc(?:ument)?\.?\s*date\.?[\s:]+([\d]{1,2}[/-][\d]{1,2}[/-][\d]{2,4})/i);
    const date = dateMatch ? dateMatch[1].trim() : '';

    // 4. Recipient GSTIN
    // Look for To GSTIN, Consignee GSTIN, or recipient GSTIN pattern
    let toGstin = '';
    const toGstinMatch = block.match(/(?:to\s*gstin|consignee\s*gstin|recipient\s*gstin)[\s:]+([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])/i);
    if (toGstinMatch) {
      toGstin = toGstinMatch[1].toUpperCase();
    } else {
      // Find GSTINs in block
      const allGstins = block.match(/[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]/g);
      if (allGstins && allGstins.length >= 2) {
        // In EWB print, second GSTIN is usually Recipient / To GSTIN
        toGstin = allGstins[1].toUpperCase();
      } else if (allGstins && allGstins.length === 1) {
        toGstin = allGstins[0].toUpperCase();
      }
    }

    // 5. Taxable Amount
    const taxMatch = block.match(/(?:total\s*taxable\s*amt|taxable\s*amount|taxable\s*value)[\s:]+₹?\s*([\d,]+\.?\d*)/i);
    const taxable = taxMatch ? taxMatch[1] : '0';

    // 6. IGST Amount
    const igstMatch = block.match(/(?:igst\s*amt|integrated\s*tax)[\s:]+₹?\s*([\d,]+\.?\d*)/i);
    const igst = igstMatch ? igstMatch[1] : '0';

    // 7. CGST Amount
    const cgstMatch = block.match(/(?:cgst\s*amt|central\s*tax)[\s:]+₹?\s*([\d,]+\.?\d*)/i);
    const cgst = cgstMatch ? cgstMatch[1] : '0';

    // 8. SGST Amount
    const sgstMatch = block.match(/(?:sgst\s*amt|state\s*tax)[\s:]+₹?\s*([\d,]+\.?\d*)/i);
    const sgst = sgstMatch ? sgstMatch[1] : '0';

    // 9. Total Invoice Value
    const totalMatch = block.match(/(?:total\s*inv(?:oice)?\s*val(?:ue)?|total\s*value|tot\s*inv\s*amt)[\s:]+₹?\s*([\d,]+\.?\d*)/i);
    const total = totalMatch ? totalMatch[1] : '0';

    if (invoiceNo || ewbNo) {
      rows.push({
        'invoice_no': invoiceNo || ewbNo,
        'eway_bill_no': ewbNo,
        'gstin': toGstin,
        'date': date,
        'taxable': taxable,
        'igst': igst,
        'cgst': cgst,
        'sgst': sgst,
        'total': total,
      });
    }
  }

  return rows.length > 0 ? rows : null;
}

/**
 * Parses Tabular PDFs (e.g. GSTR-1 outward supply table or E-Way Bill summary table)
 */
function tryParseTabularPdf(lines: string[][]): ParsedPdfResult | null {
  // Use findHeaderRow to detect headers
  const { headers, rows } = findHeaderRow(lines);

  if (headers.length >= 3 && rows.length > 0) {
    // Check if headers contain invoice-related columns
    const norm = headers.map(normCol).join(' ');
    const hasInv = ['invoice', 'inv', 'doc', 'bill', 'inum'].some(k => norm.includes(k));
    const hasAmount = ['taxable', 'amount', 'val', 'value', 'total', 'tax', 'cgst', 'sgst', 'igst'].some(k => norm.includes(k));

    if (hasInv || hasAmount) {
      return {
        columns: headers,
        rows,
      };
    }
  }

  return null;
}

/**
 * Line-by-line fallback scanner for documents that list invoice transactions
 */
function tryScanInvoiceLines(lines: string[][]): ParsedPdfResult | null {
  const gstinRegex = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]/i;
  const dateRegex = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/;
  const amountRegex = /\b\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?\b/;

  const candidateRows: any[] = [];

  for (const line of lines) {
    const lineStr = line.join(' ');
    const gstinMatch = lineStr.match(gstinRegex);
    const dateMatch = lineStr.match(dateRegex);

    if (dateMatch && (gstinMatch || line.length >= 4)) {
      // Find all amounts
      const amounts = line.filter(t => /^\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?$/.test(t.replace(/[₹\s]/g, '')));
      // Candidate invoice number: token with alphanumeric + hyphens/slashes
      const invCandidates = line.filter(t => 
        /^[A-Za-z0-9\-_/]{3,25}$/.test(t) && 
        !/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(t) &&
        !gstinRegex.test(t)
      );

      if (invCandidates.length > 0) {
        candidateRows.push({
          'invoice_no': invCandidates[0],
          'gstin': gstinMatch ? gstinMatch[0].toUpperCase() : '',
          'date': dateMatch ? dateMatch[0] : '',
          'taxable': amounts.length >= 2 ? amounts[0] : (amounts[0] || '0'),
          'total': amounts.length >= 2 ? amounts[amounts.length - 1] : (amounts[0] || '0'),
          'igst': '0',
          'cgst': '0',
          'sgst': '0',
        });
      }
    }
  }

  if (candidateRows.length > 0) {
    return {
      columns: ['invoice_no', 'gstin', 'date', 'taxable', 'total', 'igst', 'cgst', 'sgst'],
      rows: candidateRows,
    };
  }

  return null;
}

/**
 * Main PDF parser entry point
 */
export async function parsePdfFile(buffer: ArrayBuffer): Promise<ParsedPdfResult> {
  const items = await extractPdfTextItems(buffer);
  if (items.length === 0) {
    throw new Error('PDF file appears to be empty or contains scanned images without selectable text.');
  }

  const lines = groupIntoLines(items);

  // Strategy 1: E-Way Bill Print Slips (NIC Portal printouts)
  const ewbSlips = tryParseEwbPrintSlips(lines);
  if (ewbSlips && ewbSlips.length > 0) {
    return {
      columns: Object.keys(ewbSlips[0]),
      rows: ewbSlips,
    };
  }

  // Strategy 2: Tabular GSTR-1 or EWB Report
  const tabularResult = tryParseTabularPdf(lines);
  if (tabularResult && tabularResult.rows.length > 0) {
    return tabularResult;
  }

  // Strategy 3: Invoice Line Scanner
  const scannedResult = tryScanInvoiceLines(lines);
  if (scannedResult && scannedResult.rows.length > 0) {
    return scannedResult;
  }

  // Fallback: return raw reconstructed lines
  const headers = lines[0] || ['col_0'];
  const rows = lines.slice(1).map(line => {
    const obj: Record<string, any> = {};
    headers.forEach((h, idx) => {
      obj[h || `col_${idx}`] = line[idx] !== undefined ? line[idx] : null;
    });
    return obj;
  });

  return {
    columns: headers,
    rows,
  };
}
