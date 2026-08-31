import { formatDate } from '@/lib/utils';

interface ExportCsvParams {
  documentType: string;
  filtered: any[];
  L: any;
  dateFrom?: string;
  dateTo?: string;
  statusFilter?: string;
  search?: string;
}

/**
 * Generates and triggers download of a CSV file for the given estimations.
 * The CSV respects the current filters (date range, status, search) already applied
 * to the `filtered` array passed in.
 */
export function exportToCsv({ documentType, filtered, L }: ExportCsvParams) {
  // The task spec's exact required header for the document-number column is
  // "Estimate No" — the on-screen label (`L.noColumn`) is the abbreviated
  // "Est No" (or "PI No" for Proforma), which is a UI-display concern we're
  // not touching here. Keep the CSV header literal for Estimates and fall
  // back to the type's own label for any other document type reusing this
  // export (e.g. Proforma).
  const noHeader = documentType === 'ESTIMATE' ? 'Estimate No' : L.noColumn;
  const headers = ['Date', noHeader, 'Party Name', 'Party Type', 'Amount', 'Status', 'Sales Order No'];

  const rows = filtered.map((est) => {
    const dateVal = formatDate(est.createdAt);
    const noVal = est.quotationNumber || est.proformaNumber || '';
    const partyVal = est.customer?.name || est.customerName || '';
    const partyTypeVal = est.partyType || (est.customerId ? 'CUSTOMER' : '');
    // totalAmount already carries the final payable figure INCLUDING
    // round-off (see roundOffAmount handling in SalesService) — never
    // recompute subtotal+tax here, that would silently drop the rounding
    // adjustment the customer actually saw. Plain fixed-point, no
    // thousands separator: a locale-formatted "1,234.56" would need
    // quoting for the embedded comma and Excel would then read it back as
    // text rather than a number, failing the "must remain numeric" import
    // requirement.
    const amtVal = Number(est.totalAmount || 0).toFixed(2);
    const statusVal = est.status || 'DRAFT';
    const soRefVal = est.convertedOrderNumber || '';
    return [dateVal, noVal, partyVal, partyTypeVal, amtVal, statusVal, soRefVal];
  });

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell);
          // Escape double quotes by doubling them and wrap in quotes if needed
          if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return '"' + str.replace(/"/g, '""') + '"';
          }
          return str;
        })
        .join(',')
    )
    // CRLF per RFC 4180 / Excel's native CSV line ending.
    .join('\r\n');

  // Leading UTF-8 BOM so Excel (which sniffs encoding rather than trusting
  // the Blob's charset metadata) opens this as UTF-8 instead of mis-decoding
  // non-ASCII party names or the ₹ symbol as Latin-1/ANSI.
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date();
  const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const prefix = documentType === 'PROFORMA' ? 'Proforma-Invoices' : 'Estimates';
  const fileName = `${prefix}-${todayStr}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
