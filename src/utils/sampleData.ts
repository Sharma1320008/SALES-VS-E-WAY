export const SAMPLE_GSTR1_DATA = {
  columns: ['Invoice No', 'Receiver Name', 'Receiver GSTIN', 'Place of Supply', 'Invoice Date', 'Taxable Value', 'IGST Amount', 'CGST Amount', 'SGST Amount', 'Total Invoice Value'],
  rows: [
    {
      // Inter-state supply (Delhi -> Maharashtra)
      'Invoice No': 'INV-2024-001',
      'Receiver Name': 'Apex Engineering Pvt Ltd',
      'Receiver GSTIN': '27AAPFU0939F1ZV',
      'Place of Supply': 'Maharashtra',
      'Invoice Date': '15-05-2024',
      'Taxable Value': 150000,
      'IGST Amount': 27000,
      'CGST Amount': 0,
      'SGST Amount': 0,
      'Total Invoice Value': 177000,
    },
    {
      // Intra-state supply (Delhi -> Delhi): CGST + SGST
      'Invoice No': 'INV-2024-002',
      'Receiver Name': 'Bharat Electronics & Retail',
      'Receiver GSTIN': '07AAGCB1234A1Z5',
      'Place of Supply': 'Delhi',
      'Invoice Date': '18-05-2024',
      'Taxable Value': 80000,
      'IGST Amount': 0,
      'CGST Amount': 7200,
      'SGST Amount': 7200,
      'Total Invoice Value': 94400,
    },
    {
      // Inter-state (Delhi -> Karnataka), 1-day date gap
      'Invoice No': 'INV-2024-003',
      'Receiver Name': 'Crestline Logistics Solutions',
      'Receiver GSTIN': '29ABCDE5678F1Z9',
      'Place of Supply': 'Karnataka',
      'Invoice Date': '20-05-2024',
      'Taxable Value': 210000,
      'IGST Amount': 37800,
      'CGST Amount': 0,
      'SGST Amount': 0,
      'Total Invoice Value': 247800,
    },
    {
      // Inter-state (Delhi -> Tamil Nadu) with ₹0.80 round-off difference (ignored per <= ₹1.00 rule)
      'Invoice No': 'INV-2024-004',
      'Receiver Name': 'Delta Dynamic Tech Corp',
      'Receiver GSTIN': '33AABCT9999K1Z1',
      'Place of Supply': 'Tamil Nadu',
      'Invoice Date': '22-05-2024',
      'Taxable Value': 45000,
      'IGST Amount': 8100.80,
      'CGST Amount': 0,
      'SGST Amount': 0,
      'Total Invoice Value': 53100.80,
    },
    {
      // Missing in EWB and Value > 50k -> "E-Way Bill Not Found"
      'Invoice No': 'INV-2024-005',
      'Receiver Name': 'Apex Engineering Pvt Ltd',
      'Receiver GSTIN': '27AAPFU0939F1ZV',
      'Place of Supply': 'Maharashtra',
      'Invoice Date': '25-05-2024',
      'Taxable Value': 120000,
      'IGST Amount': 21600,
      'CGST Amount': 0,
      'SGST Amount': 0,
      'Total Invoice Value': 141600,
    },
    {
      // Invoice format variation: INV/2024/006 in GSTR-1 vs INV-2024-006 in EWB
      'Invoice No': 'INV/2024/006',
      'Receiver Name': 'Horizon Infrastructure LLP',
      'Receiver GSTIN': '06AAACR5544B1Z3',
      'Place of Supply': 'Haryana',
      'Invoice Date': '28-05-2024',
      'Taxable Value': 350000,
      'IGST Amount': 63000,
      'CGST Amount': 0,
      'SGST Amount': 0,
      'Total Invoice Value': 413000,
    },
    {
      // Intra-state duplicate test (Delhi -> Delhi)
      'Invoice No': 'INV-2024-007',
      'Receiver Name': 'Bharat Electronics & Retail',
      'Receiver GSTIN': '07AAGCB1234A1Z5',
      'Place of Supply': 'Delhi',
      'Invoice Date': '30-05-2024',
      'Taxable Value': 50000,
      'IGST Amount': 0,
      'CGST Amount': 4500,
      'SGST Amount': 4500,
      'Total Invoice Value': 59000,
    },
    {
      'Invoice No': 'INV-2024-007',
      'Receiver Name': 'Bharat Electronics & Retail',
      'Receiver GSTIN': '07AAGCB1234A1Z5',
      'Place of Supply': 'Delhi',
      'Invoice Date': '30-05-2024',
      'Taxable Value': 50000,
      'IGST Amount': 0,
      'CGST Amount': 4500,
      'SGST Amount': 4500,
      'Total Invoice Value': 59000,
    },
    {
      // Missing in EWB but Value < 50,000 -> "E-Way Bill Not Required (< ₹50k)"
      'Invoice No': 'INV-2024-008',
      'Receiver Name': 'Bharat Electronics & Retail',
      'Receiver GSTIN': '07AAGCB1234A1Z5',
      'Place of Supply': 'Delhi',
      'Invoice Date': '31-05-2024',
      'Taxable Value': 32000,
      'IGST Amount': 0,
      'CGST Amount': 2880,
      'SGST Amount': 2880,
      'Total Invoice Value': 37760,
    },
    {
      // Material Amount Mismatch (> ₹1.00 tolerance) -> "Unmatched"
      'Invoice No': 'INV-2024-010',
      'Receiver Name': 'Apex Engineering Pvt Ltd',
      'Receiver GSTIN': '27AAPFU0939F1ZV',
      'Place of Supply': 'Maharashtra',
      'Invoice Date': '05-06-2024',
      'Taxable Value': 100000,
      'IGST Amount': 18000,
      'CGST Amount': 0,
      'SGST Amount': 0,
      'Total Invoice Value': 118000,
    }
  ]
};

export const SAMPLE_EWB_DATA = {
  // In real-world E-Way Bill files, tax is often provided as a combined "Total Tax Amt"
  // along with From GSTIN (Supplier) and To GSTIN / POS.
  columns: ['Doc No', 'From GSTIN', 'To GSTIN', 'POS', 'Doc Date', 'Taxable Amt', 'Total Tax Amt', 'Total Value'],
  rows: [
    {
      // Inter-state Match: Supplier Delhi -> Buyer Maharashtra (POS Maharashtra). Combined tax ₹27,000 bifurcated to IGST ₹27,000.
      'Doc No': 'INV-2024-001',
      'From GSTIN': '07AAAAA1111A1Z1',
      'To GSTIN': '27AAPFU0939F1ZV',
      'POS': 'Maharashtra',
      'Doc Date': '15-05-2024',
      'Taxable Amt': 150000,
      'Total Tax Amt': 27000,
      'Total Value': 177000,
    },
    {
      // Intra-state Match: Supplier Delhi -> Buyer Delhi (POS Delhi). Combined tax ₹14,400 bifurcated to CGST ₹7,200 + SGST ₹7,200.
      'Doc No': 'INV-2024-002',
      'From GSTIN': '07AAAAA1111A1Z1',
      'To GSTIN': '07AAGCB1234A1Z5',
      'POS': 'Delhi',
      'Doc Date': '18-05-2024',
      'Taxable Amt': 80000,
      'Total Tax Amt': 14400,
      'Total Value': 94400,
    },
    {
      // Date is 21-05-2024 (1 day variance) - Inter-state
      'Doc No': 'INV-2024-003',
      'From GSTIN': '07AAAAA1111A1Z1',
      'To GSTIN': '29ABCDE5678F1Z9',
      'POS': 'Karnataka',
      'Doc Date': '21-05-2024',
      'Taxable Amt': 210000,
      'Total Tax Amt': 37800,
      'Total Value': 247800,
    },
    {
      // Inter-state Match
      'Doc No': 'INV-2024-004',
      'From GSTIN': '07AAAAA1111A1Z1',
      'To GSTIN': '33AABCT9999K1Z1',
      'POS': 'Tamil Nadu',
      'Doc Date': '22-05-2024',
      'Taxable Amt': 45000,
      'Total Tax Amt': 8100,
      'Total Value': 53100,
    },
    // INV-2024-005 is omitted in EWB and > 50k -> "E-Way Bill Not Found"
    {
      // Matched via simplified number (INV-2024-006 vs INV/2024/006)
      'Doc No': 'INV-2024-006',
      'From GSTIN': '07AAAAA1111A1Z1',
      'To GSTIN': '06AAACR5544B1Z3',
      'POS': 'Haryana',
      'Doc Date': '28-05-2024',
      'Taxable Amt': 350000,
      'Total Tax Amt': 63000,
      'Total Value': 413000,
    },
    {
      // Duplicate in GSTR-1
      'Doc No': 'INV-2024-007',
      'From GSTIN': '07AAAAA1111A1Z1',
      'To GSTIN': '07AAGCB1234A1Z5',
      'POS': 'Delhi',
      'Doc Date': '30-05-2024',
      'Taxable Amt': 50000,
      'Total Tax Amt': 9000,
      'Total Value': 59000,
    },
    {
      // Extra E-Way Bill (not in GSTR-1)
      'Doc No': 'INV-2024-099',
      'From GSTIN': '07AAAAA1111A1Z1',
      'To GSTIN': '24AAACH7788C1Z6',
      'POS': 'Gujarat',
      'Doc Date': '12-05-2024',
      'Taxable Amt': 195000,
      'Total Tax Amt': 35100,
      'Total Value': 230100,
    },
    {
      // Another Extra E-Way Bill
      'Doc No': 'INV-2024-100',
      'From GSTIN': '07AAAAA1111A1Z1',
      'To GSTIN': '19AAACA0000A1Z5',
      'POS': 'West Bengal',
      'Doc Date': '14-05-2024',
      'Taxable Amt': 67000,
      'Total Tax Amt': 12060,
      'Total Value': 79060,
    },
    {
      // Corresponding EWB with amount discrepancy (₹1,15,000 vs ₹1,18,000 in GSTR-1, diff ₹3,000 > ₹1.00)
      'Doc No': 'INV-2024-010',
      'From GSTIN': '07AAAAA1111A1Z1',
      'To GSTIN': '27AAPFU0939F1ZV',
      'POS': 'Maharashtra',
      'Doc Date': '05-06-2024',
      'Taxable Amt': 97457.63,
      'Total Tax Amt': 17542.37,
      'Total Value': 115000,
    }
  ]
};

