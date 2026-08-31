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
export function exportToCsv({ documentType, filtered, L, dateFrom, dateTo, statusFilter, search }: ExportCsvParams) {
  const headers = [
    'Date',
    L.noColumn,
    'Party Name',
    'Party Type',
    'Amount (₹)',
    'Status',
    'SO Ref',
  ];

  const rows = filtered.map((est) => {
    const dateVal = formatDate(est.createdAt);
    const noVal = est.quotationNumber || est.proformaNumber || '—';
    const partyVal = est.customer?.name || est.customerName || '—';
    const partyTypeVal = est.partyType || (est.customerId ? 'CUSTOMER' : '—');
    const amtVal = Number(est.totalAmount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const statusVal = (est.status && (L[est.status] || est.status)) || 'DRAFT';
    const soRefVal = est.convertedOrderNumber || '—';
    return [dateVal, noVal, partyVal, partyTypeVal, amtVal, statusVal, soRefVal];
  });

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell);
          // Escape double quotes by doubling them and wrap in quotes if needed
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
          }
          return str;
        })
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fileName = `${documentType}-${dateFrom || 'all'}-${dateTo || 'all'}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
