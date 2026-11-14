export type ReconciliationStatus =
  | 'All'
  | 'Matched'
  | 'Unmatched'
  | 'E-Way Bill Not Found'
  | 'E-Way Bill Not Required (< ₹50k)'
  | 'Extra E-Way Bill'
  | 'Review - Duplicate';

export type DateToleranceOption = number; // -1 means ignore date difference, >= 0 means allowed days gap

export interface StandardInvoiceRow {
  invoice_no: string;
  clean_inv_no?: string;
  party_name?: string; // Particulars / Trade Name / Legal Name of Buyer or Consignee
  gstin: string; // Recipient / Buyer GSTIN
  from_gstin?: string; // Supplier GSTIN
  date: string | null;
  parsed_date?: Date | null;
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
  total_tax?: number; // Total combined tax amount
  total: number;
  source_row: string | number;
  source: 'GSTR-1' | 'E-Way Bill';
  section?: string;
  pos?: string; // Place of Supply / Destination State
  inv_typ?: string;
  key?: string;
  is_bifurcated?: boolean; // Flag indicating tax was split according to GST rules
  supply_type?: 'Intra-State' | 'Inter-State';
}

export interface ReconciliationItem {
  'Status': ReconciliationStatus;
  'Reason': string;
  'Party Name'?: string | null;
  'Particulars / Party Name'?: string | null;
  'Invoice No.': string;
  'GSTIN': string;
  'Place of Supply'?: string | null;
  'EWB Place of Supply'?: string | null;
  'Supply Type'?: 'Intra-State' | 'Inter-State' | null;
  'Tax Bifurcated'?: boolean;
  // GSTR-1 Outward Supply Data (Left Side)
  'GSTR-1 Date': string | null;
  'GSTR-1 Taxable': number | null;
  'GSTR-1 IGST': number | null;
  'GSTR-1 CGST': number | null;
  'GSTR-1 SGST': number | null;
  'GSTR-1 Invoice Value': number | null;
  // E-Way Bill Consignment Data (Right Side)
  'E-Way Bill Date': string | null;
  'EWB Taxable': number | null;
  'EWB IGST': number | null;
  'EWB CGST': number | null;
  'EWB SGST': number | null;
  'EWB Invoice Value': number | null;
  // Variance / Difference (GSTR-1 minus EWB)
  'Diff Taxable': number | null;
  'Diff IGST': number | null;
  'Diff CGST': number | null;
  'Diff SGST': number | null;
  'Diff Invoice Value': number | null;
  // Audit & Source Line References
  'GSTR-1 Source Row': string | number | null;
  'EWB Source Row': string | number | null;
}

export interface ColumnMapping {
  invoice_no: string | null;
  party_name?: string | null;
  gstin: string | null;
  from_gstin?: string | null;
  pos?: string | null;
  date: string | null;
  taxable: string | null;
  igst: string | null;
  cgst: string | null;
  sgst: string | null;
  total_tax?: string | null;
  total: string | null;
}

export interface ReconciliationSummary {
  totalGstr: number;
  totalEwb: number;
  matched: number;
  unmatched: number;
  ewbNotFound: number;
  ewbNotRequired: number;
  extraEwb: number;
  reviewDuplicate: number;
}
